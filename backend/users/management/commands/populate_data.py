from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Backward-compatible alias for the idempotent bootstrap flow.'

    def add_arguments(self, parser):
        parser.add_argument('--skip-superuser', action='store_true')
        parser.add_argument('--skip-sections', action='store_true')
        parser.add_argument('--skip-users', action='store_true')
        parser.add_argument('--sections-file')
        parser.add_argument('--users-file')
        parser.add_argument('--update-existing-sections', action='store_true')
        parser.add_argument('--update-existing-users', action='store_true')

    def handle(self, *args, **kwargs):
        call_command(
            'bootstrap_system',
            skip_superuser=kwargs['skip_superuser'],
            skip_sections=kwargs['skip_sections'],
            skip_users=kwargs['skip_users'],
            sections_file=kwargs['sections_file'],
            users_file=kwargs['users_file'],
            update_existing_sections=kwargs['update_existing_sections'],
            update_existing_users=kwargs['update_existing_users'],
        )
