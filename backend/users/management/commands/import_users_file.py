from pathlib import Path
import csv
import json

from django.contrib import admin
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from users.admin import UserAdmin
from users.models import User
from sections.models import Section, Subsection


class Command(BaseCommand):
    help = "Import users from CSV or JSON using the same logic as Django admin import."

    def add_arguments(self, parser):
        parser.add_argument(
            "file_path",
            help="Path to users CSV or JSON file",
        )
        parser.add_argument(
            "--update-existing",
            action="store_true",
            help="Update existing users by username instead of skipping them.",
        )
        parser.add_argument(
            "--show-errors",
            action="store_true",
            help="Print all row-level errors (default prints first 20).",
        )

    def handle(self, *args, **options):
        file_path = Path(options["file_path"]).expanduser().resolve()
        show_errors = options["show_errors"]
        update_existing = options["update_existing"]

        if not file_path.exists():
            raise CommandError(f"File not found: {file_path}")
        if not file_path.is_file():
            raise CommandError(f"Not a file: {file_path}")

        ext = file_path.suffix.lower().lstrip(".")
        if ext not in {"csv", "json"}:
            raise CommandError("Only .csv and .json files are supported.")

        importer = UserAdmin(User, admin.site)

        try:
            with file_path.open("rb") as import_file:
                if ext == "csv" and not update_existing:
                    results = importer._import_from_csv(import_file)
                elif ext == "json" and not update_existing:
                    results = importer._import_from_json(import_file)
                else:
                    rows, row_start = self._read_rows(import_file, ext)
                    results = self._import_rows_update_existing(rows, row_start, importer)
        except Exception as exc:
            raise CommandError(f"Import failed: {exc}") from exc

        created = results.get("created", [])
        updated = results.get("updated", [])
        skipped = results.get("skipped", [])
        errors = results.get("errors", [])

        self.stdout.write(self.style.SUCCESS(f"Created users: {len(created)}"))
        if created:
            preview = ", ".join(created[:20])
            suffix = "" if len(created) <= 20 else f" ... (+{len(created) - 20} more)"
            self.stdout.write(f"  {preview}{suffix}")

        if update_existing:
            self.stdout.write(self.style.SUCCESS(f"Updated users: {len(updated)}"))
            if updated:
                preview = ", ".join(updated[:20])
                suffix = "" if len(updated) <= 20 else f" ... (+{len(updated) - 20} more)"
                self.stdout.write(f"  {preview}{suffix}")

        self.stdout.write(self.style.WARNING(f"Skipped users: {len(skipped)}"))
        if skipped:
            preview = ", ".join(skipped[:20])
            suffix = "" if len(skipped) <= 20 else f" ... (+{len(skipped) - 20} more)"
            self.stdout.write(f"  {preview}{suffix}")

        if errors:
            self.stdout.write(self.style.ERROR(f"Errors: {len(errors)}"))
            to_print = errors if show_errors else errors[:20]
            for err in to_print:
                self.stdout.write(self.style.ERROR(f"  - {err}"))
            if not show_errors and len(errors) > 20:
                self.stdout.write(self.style.WARNING(f"  ... (+{len(errors) - 20} more errors, use --show-errors)"))
        else:
            self.stdout.write(self.style.SUCCESS("Errors: 0"))

    def _read_rows(self, import_file, ext):
        if ext == "csv":
            text = import_file.read().decode("utf-8-sig")
            reader = csv.DictReader(text.splitlines())
            return list(reader), 2

        content = import_file.read().decode("utf-8")
        data = json.loads(content)
        if not isinstance(data, list):
            raise CommandError("JSON must be an array of user objects.")
        return data, 1

    def _import_rows_update_existing(self, rows, row_start, importer):
        results = {"created": [], "updated": [], "skipped": [], "errors": []}
        if not rows:
            return results

        section_cache = {s.name: s for s in Section.objects.all()}
        subsection_items = list(Subsection.objects.select_related("section").all())
        subsection_by_pair = {(s.section.name, s.name): s for s in subsection_items}
        subsection_by_name = {}
        for subsection in subsection_items:
            subsection_by_name.setdefault(subsection.name, []).append(subsection)

        pending_usernames = set()

        for idx, row in enumerate(rows):
            row_num = row_start + idx
            normalized = {}
            for key, value in (row or {}).items():
                normalized_key = str(key or "").strip().lstrip("\ufeff").lower()
                normalized[normalized_key] = "" if value is None else str(value).strip()

            username = normalized.get("username", "")
            email = normalized.get("email", "")
            password = normalized.get("password", "")
            full_name = normalized.get("full_name", "")
            role = importer._normalize_role(normalized.get("role", ""))
            actual_role = normalized.get("actual_role", "").strip()
            section_value = normalized.get("section", normalized.get("section_name", ""))
            sections_raw = normalized.get("sections", section_value).strip()
            subsection_raw = normalized.get("subsection", normalized.get("subsection_name", "")).strip()
            auditor_subsections_raw = normalized.get("auditor_subsections", "").strip()
            section_hint = sections_raw.split(",")[0].strip() if sections_raw else ""

            if not all([username, email, password, full_name, role]):
                results["errors"].append(
                    f"Row {row_num}: Missing required fields (username, email, password, full_name, role)"
                )
                continue

            valid_roles = ["AG", "DAG", "SrAO", "AAO", "auditor", "clerk"]
            if role not in valid_roles:
                results["errors"].append(
                    f'Row {row_num} ({username}): Invalid role "{role}". Must be one of: {", ".join(valid_roles)}'
                )
                continue

            if username in pending_usernames:
                results["errors"].append(f"Row {row_num} ({username}): Duplicate username in import file")
                continue
            pending_usernames.add(username)

            if role == "DAG":
                section_names = [name.strip() for name in sections_raw.split(",") if name.strip()]
                dag_sections = [importer._get_or_create_section(name, section_cache) for name in section_names]
                dag_sections = [s for s in dag_sections if s is not None]
            else:
                dag_sections = []

            subsection = None
            if role in ["SrAO", "AAO", "clerk"] and subsection_raw:
                if not section_hint:
                    results["errors"].append(
                        f'Row {row_num} ({username}): "section" is required when "subsection" is provided'
                    )
                    continue
                subsection, subsection_error = importer._get_or_create_subsection(
                    section_hint, subsection_raw, section_cache, subsection_by_pair, subsection_by_name
                )
                if subsection_error:
                    results["errors"].append(f"Row {row_num} ({username}): {subsection_error}")
                    continue

            auditor_subsections = []
            auditor_primary_subsection = None
            if role == "auditor":
                raw_value = auditor_subsections_raw or subsection_raw
                if raw_value:
                    tokens = [name.strip() for name in raw_value.split(",") if name.strip()]
                    parse_failed = False
                    parsed = []
                    for token in tokens:
                        if not section_hint:
                            results["errors"].append(
                                f'Row {row_num} ({username}): "section" is required when importing auditor subsections'
                            )
                            parse_failed = True
                            break
                        parsed_sub, sub_error = importer._get_or_create_subsection(
                            section_hint, token, section_cache, subsection_by_pair, subsection_by_name
                        )
                        if sub_error:
                            results["errors"].append(f"Row {row_num} ({username}): {sub_error}")
                            parse_failed = True
                            break
                        parsed.append(parsed_sub)
                    if parse_failed:
                        continue
                    auditor_subsections = parsed
                    if parsed:
                        auditor_primary_subsection = parsed[0]

            existing = User.objects.filter(username=username).first()
            if existing and existing.is_superuser:
                results["errors"].append(
                    f"Row {row_num} ({username}): Refusing to update superuser via bulk import."
                )
                continue

            with transaction.atomic():
                if existing:
                    existing.email = email
                    existing.password = make_password(password)
                    existing.full_name = full_name
                    existing.role = role
                    existing.actual_role = actual_role or role
                    existing.subsection = subsection or auditor_primary_subsection
                    existing.is_active = True
                    existing.save()

                    if role == "DAG":
                        existing.sections.set(dag_sections)
                        existing.auditor_subsections.clear()
                    elif role == "auditor":
                        existing.sections.clear()
                        existing.auditor_subsections.set(auditor_subsections)
                    else:
                        existing.sections.clear()
                        existing.auditor_subsections.clear()

                    results["updated"].append(username)
                else:
                    user = User.objects.create(
                        username=username,
                        email=email,
                        password=make_password(password),
                        full_name=full_name,
                        role=role,
                        actual_role=actual_role or role,
                        subsection=subsection or auditor_primary_subsection,
                        is_active=True,
                    )
                    if role == "DAG":
                        user.sections.set(dag_sections)
                    if role == "auditor":
                        user.auditor_subsections.set(auditor_subsections)
                    results["created"].append(username)

        return results
