from pathlib import Path
import csv
import json

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from sections.models import Section, Subsection


class Command(BaseCommand):
    help = "Import sections and subsections from CSV or JSON."

    def add_arguments(self, parser):
        parser.add_argument("file_path", help="Path to a CSV or JSON file")
        parser.add_argument(
            "--update-existing",
            action="store_true",
            help="Update matching sections/subsections instead of skipping them.",
        )

    def handle(self, *args, **options):
        file_path = Path(options["file_path"]).expanduser().resolve()
        update_existing = options["update_existing"]

        if not file_path.exists():
            raise CommandError(f"File not found: {file_path}")
        if not file_path.is_file():
            raise CommandError(f"Not a file: {file_path}")

        suffix = file_path.suffix.lower()
        if suffix not in {".csv", ".json"}:
            raise CommandError("Only .csv and .json files are supported.")

        try:
            if suffix == ".csv":
                results = self._import_csv(file_path, update_existing)
            else:
                results = self._import_json(file_path, update_existing)
        except Exception as exc:
            raise CommandError(f"Section import failed: {exc}") from exc

        self.stdout.write(self.style.SUCCESS(f"Created sections: {results['created_sections']}"))
        self.stdout.write(self.style.SUCCESS(f"Updated sections: {results['updated_sections']}"))
        self.stdout.write(self.style.SUCCESS(f"Created subsections: {results['created_subsections']}"))
        self.stdout.write(self.style.SUCCESS(f"Updated subsections: {results['updated_subsections']}"))
        self.stdout.write(self.style.WARNING(f"Skipped entries: {results['skipped']}"))

        errors = results["errors"]
        if errors:
            self.stdout.write(self.style.ERROR(f"Errors: {len(errors)}"))
            for error in errors:
                self.stdout.write(self.style.ERROR(f"  - {error}"))
            raise CommandError("Section import completed with errors.")

    def _import_csv(self, file_path, update_existing):
        with file_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames:
                raise CommandError("CSV file is empty.")

            normalized_fieldnames = {str(name).strip().lower() for name in reader.fieldnames if name}
            if "section_name" not in normalized_fieldnames:
                raise CommandError("Missing required column: section_name")

            rows = []
            for row in reader:
                normalized = {}
                for key, value in (row or {}).items():
                    normalized[str(key or "").strip().lower()] = "" if value is None else str(value).strip()
                rows.append(normalized)
        return self._import_rows(rows, update_existing)

    def _import_json(self, file_path, update_existing):
        with file_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        if not isinstance(data, list):
            raise CommandError("JSON must be an array of sections.")

        rows = []
        for item in data:
            section_name = str(item.get("name", "")).strip()
            description = str(item.get("description", "")).strip()
            directly_under_ag = bool(item.get("directly_under_ag", False))
            rows.append(
                {
                    "section_name": section_name,
                    "description": description,
                    "directly_under_ag": directly_under_ag,
                    "subsection_name": "",
                    "subsection_description": "",
                }
            )
            for subsection in item.get("subsections", []) or []:
                rows.append(
                    {
                        "section_name": section_name,
                        "description": description,
                        "directly_under_ag": directly_under_ag,
                        "subsection_name": str(subsection.get("name", "")).strip(),
                        "subsection_description": str(subsection.get("description", "")).strip(),
                    }
                )
        return self._import_rows(rows, update_existing)

    def _import_rows(self, rows, update_existing):
        results = {
            "created_sections": 0,
            "updated_sections": 0,
            "created_subsections": 0,
            "updated_subsections": 0,
            "skipped": 0,
            "errors": [],
        }

        with transaction.atomic():
            for index, row in enumerate(rows, start=1):
                section_name = str(row.get("section_name", "")).strip()
                description = str(row.get("description", "")).strip()
                directly_under_ag_value = row.get("directly_under_ag", False)
                subsection_name = str(row.get("subsection_name", "")).strip()
                subsection_description = str(row.get("subsection_description", "")).strip()

                if not section_name:
                    results["errors"].append(f"Row {index}: section_name is required.")
                    continue

                directly_under_ag = self._to_bool(directly_under_ag_value)

                section, section_created = Section.objects.get_or_create(
                    name=section_name,
                    defaults={
                        "description": description,
                        "directly_under_ag": directly_under_ag,
                    },
                )
                if section_created:
                    results["created_sections"] += 1
                elif update_existing:
                    changed = False
                    if section.description != description:
                        section.description = description
                        changed = True
                    if section.directly_under_ag != directly_under_ag:
                        section.directly_under_ag = directly_under_ag
                        changed = True
                    if changed:
                        section.save(update_fields=["description", "directly_under_ag"])
                        results["updated_sections"] += 1
                    else:
                        results["skipped"] += 1
                else:
                    results["skipped"] += 1

                if not subsection_name:
                    continue

                subsection, subsection_created = Subsection.objects.get_or_create(
                    section=section,
                    name=subsection_name,
                    defaults={"description": subsection_description},
                )
                if subsection_created:
                    results["created_subsections"] += 1
                elif update_existing:
                    if subsection.description != subsection_description:
                        subsection.description = subsection_description
                        subsection.save(update_fields=["description"])
                        results["updated_subsections"] += 1
                    else:
                        results["skipped"] += 1
                else:
                    results["skipped"] += 1

        return results

    def _to_bool(self, value):
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in {"1", "true", "yes", "y", "on", "t"}
