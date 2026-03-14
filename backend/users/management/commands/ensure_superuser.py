import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Command(BaseCommand):
    help = "Create the initial AG superuser if one does not already exist."

    def add_arguments(self, parser):
        parser.add_argument("--username", default=os.environ.get("DJANGO_SUPERUSER_USERNAME", "admin"))
        parser.add_argument("--email", default=os.environ.get("DJANGO_SUPERUSER_EMAIL", "admin@office.gov"))
        parser.add_argument("--password", default=os.environ.get("DJANGO_SUPERUSER_PASSWORD", "admin123"))
        parser.add_argument("--full-name", default=os.environ.get("DJANGO_SUPERUSER_FULL_NAME", "System Administrator"))
        parser.add_argument(
            "--actual-role",
            default=os.environ.get("DJANGO_SUPERUSER_ACTUAL_ROLE", "Accountant General"),
        )
        parser.add_argument(
            "--promote-existing",
            action="store_true",
            default=env_bool("DJANGO_SUPERUSER_PROMOTE_EXISTING", False),
            help="Promote an existing matching username if no superuser exists yet.",
        )

    def handle(self, *args, **options):
        user_model = get_user_model()
        existing_superuser = user_model.objects.filter(is_superuser=True).order_by("id").first()
        if existing_superuser:
            self.stdout.write(
                self.style.WARNING(
                    f"Superuser already exists ({existing_superuser.username}). Skipping bootstrap superuser creation."
                )
            )
            return

        username = options["username"].strip()
        email = options["email"].strip()
        password = options["password"]
        full_name = options["full_name"].strip()
        actual_role = options["actual_role"].strip() or "Accountant General"
        promote_existing = options["promote_existing"]

        if not all([username, email, password, full_name]):
            raise CommandError("username, email, password, and full-name are required.")

        existing_user = user_model.objects.filter(username=username).first()
        if existing_user and not promote_existing:
            raise CommandError(
                f'User "{username}" already exists but is not a superuser. Use --promote-existing to reuse it.'
            )

        if existing_user:
            existing_user.email = email
            existing_user.full_name = full_name
            existing_user.role = "AG"
            existing_user.actual_role = actual_role
            existing_user.is_primary_ag = True
            existing_user.is_staff = True
            existing_user.is_superuser = True
            existing_user.is_active = True
            existing_user.set_password(password)
            existing_user.save()
            self.stdout.write(self.style.SUCCESS(f'Promoted existing user "{username}" to AG superuser.'))
            return

        user_model.objects.create_superuser(
            username=username,
            email=email,
            password=password,
            full_name=full_name,
            role="AG",
            actual_role=actual_role,
            is_primary_ag=True,
        )
        self.stdout.write(self.style.SUCCESS(f'Created AG superuser "{username}".'))
