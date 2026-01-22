from django.core.management.base import BaseCommand
from users.models import User


class Command(BaseCommand):
    help = 'Create initial superuser/AG if none exists'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            default='admin',
            help='Username for the superuser (default: admin)'
        )
        parser.add_argument(
            '--email',
            default='admin@office.gov',
            help='Email for the superuser'
        )
        parser.add_argument(
            '--password',
            default='admin123',
            help='Password for the superuser (default: admin123)'
        )
        parser.add_argument(
            '--full-name',
            default='System Administrator',
            help='Full name for the superuser'
        )

    def handle(self, *args, **kwargs):
        username = kwargs['username']
        email = kwargs['email']
        password = kwargs['password']
        full_name = kwargs['full_name']

        # Check if any superuser exists
        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write(self.style.WARNING('Superuser already exists. Skipping creation.'))
            self.stdout.write('\nTo create users and sections:')
            self.stdout.write('1. Go to Django Admin: http://localhost:8000/admin/')
            self.stdout.write('2. Create sections under "Sections"')
            self.stdout.write('3. Create users under "Users" with appropriate roles and sections')
            self.stdout.write('4. Or use CSV/JSON import in User admin')
            return

        # Create superuser with AG role
        try:
            user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password,
                full_name=full_name,
                role='AG',
                section=None,  # AG has no specific section
            )
            self.stdout.write(self.style.SUCCESS(f'Created superuser: {username}'))
            self.stdout.write(f'\nLogin credentials:')
            self.stdout.write(f'Username: {username}')
            self.stdout.write(f'Password: {password}')
            self.stdout.write(f'\nDjango Admin: http://localhost:8000/admin/')
            self.stdout.write('\nNext steps:')
            self.stdout.write('1. Create sections in Django Admin')
            self.stdout.write('2. Create users with appropriate roles (AG, DAG, SrAO, AAO)')
            self.stdout.write('3. Or use CSV/JSON import for bulk user creation')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Failed to create superuser: {e}'))
