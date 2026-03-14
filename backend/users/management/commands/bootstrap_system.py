import os
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Command(BaseCommand):
    help = "Idempotent bootstrap for a fresh deployment: superuser, sections, and optional users."

    def add_arguments(self, parser):
        parser.add_argument("--skip-superuser", action="store_true")
        parser.add_argument("--skip-sections", action="store_true")
        parser.add_argument("--skip-users", action="store_true")
        parser.add_argument("--sections-file", default=os.environ.get("INITIAL_SECTIONS_FILE", "").strip())
        parser.add_argument("--users-file", default=os.environ.get("INITIAL_USERS_FILE", "").strip())
        parser.add_argument(
            "--update-existing-sections",
            action="store_true",
            default=env_bool("INITIAL_SECTIONS_UPDATE_EXISTING", True),
        )
        parser.add_argument(
            "--update-existing-users",
            action="store_true",
            default=env_bool("INITIAL_USERS_UPDATE_EXISTING", False),
        )
        parser.add_argument("--no-input", action="store_true", help="Accepted for non-interactive startup flows.")

    def handle(self, *args, **options):
        if not options["skip_superuser"]:
            self.stdout.write("Ensuring AG superuser exists...")
            call_command("ensure_superuser")

        if not options["skip_sections"]:
            sections_file = options["sections_file"]
            if sections_file:
                resolved_path = Path(sections_file).expanduser()
                self.stdout.write(f"Importing section hierarchy from {resolved_path}...")
                call_command(
                    "import_sections_file",
                    str(resolved_path),
                    update_existing=options["update_existing_sections"],
                )
            else:
                self.stdout.write(self.style.WARNING("No INITIAL_SECTIONS_FILE configured. Skipping section bootstrap."))

        if not options["skip_users"]:
            users_file = options["users_file"]
            if users_file:
                resolved_path = Path(users_file).expanduser()
                if not resolved_path.exists():
                    raise CommandError(f"INITIAL_USERS_FILE does not exist: {resolved_path}")
                self.stdout.write(f"Importing users from {resolved_path}...")
                call_command(
                    "import_users_file",
                    str(resolved_path),
                    update_existing=options["update_existing_users"],
                )
            else:
                self.stdout.write(self.style.WARNING("No INITIAL_USERS_FILE configured. Skipping user bootstrap."))

        self.stdout.write(self.style.SUCCESS("Bootstrap completed."))
