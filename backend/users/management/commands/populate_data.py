from django.core.management.base import BaseCommand
from sections.models import Section
from users.models import User


class Command(BaseCommand):
    help = 'Populate database with sample sections and users'

    def handle(self, *args, **kwargs):
        self.stdout.write('Creating sections...')

        # Create sections
        sections_data = [
            {'name': 'AMG-I', 'description': 'AMG-I Section'},
            {'name': 'AMG-II', 'description': 'AMG-II Section'},
            {'name': 'Administration', 'description': 'Establishment Section'},
            {'name': 'AMG-III', 'description': 'AMG-III Section'},
            {'name': 'SMU', 'description': 'Strategic Management Unit'},
            {'name': 'Report', 'description': 'Report Section'},
            {'name': 'ITA', 'description': 'Internal Test Audit Section'},
            {'name': 'Accounts', 'description': 'Accounts Section'},
        ]

        sections = {}
        for section_data in sections_data:
            section, created = Section.objects.get_or_create(
                name=section_data['name'],
                defaults={'description': section_data['description']}
            )
            sections[section.name] = section
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created section: {section.name}'))
            else:
                self.stdout.write(f'Section already exists: {section.name}')

        self.stdout.write('\nCreating users...')

        # Create users
        users_data = [
            {
                'username': 'ag_sharma',
                'email': 'ag.sharma@office.gov',
                'password': 'password123',
                'full_name': 'Rajesh Sharma',
                'role': 'AG',
                'section': None,
            },
            {
                'username': 'dag_accounts',
                'email': 'dag.accounts@office.gov',
                'password': 'password123',
                'full_name': 'Priya Kumar',
                'role': 'DAG',
                'section': sections['Accounts'],
            },
            {
                'username': 'dag_admin',
                'email': 'dag.admin@office.gov',
                'password': 'password123',
                'full_name': 'Amit Singh',
                'role': 'DAG',
                'section': sections['Administration'],
            },
            {
                'username': 'srao_verma',
                'email': 'srao.verma@office.gov',
                'password': 'password123',
                'full_name': 'Sunita Verma',
                'role': 'SrAO',
                'section': sections['Accounts'],
            },
            {
                'username': 'aao_patel',
                'email': 'aao.patel@office.gov',
                'password': 'password123',
                'full_name': 'Rahul Patel',
                'role': 'AAO',
                'section': sections['Accounts'],
            },
            {
                'username': 'srao_reddy',
                'email': 'srao.reddy@office.gov',
                'password': 'password123',
                'full_name': 'Lakshmi Reddy',
                'role': 'SrAO',
                'section': sections['Administration'],
            },
        ]

        for user_data in users_data:
            try:
                user = User.objects.get(username=user_data['username'])
                self.stdout.write(f'User already exists: {user_data["username"]}')
            except User.DoesNotExist:
                user = User.objects.create_user(
                    username=user_data['username'],
                    email=user_data['email'],
                    password=user_data['password'],
                    full_name=user_data['full_name'],
                    role=user_data['role'],
                    section=user_data['section'],
                )
                self.stdout.write(self.style.SUCCESS(
                    f'Created user: {user.username} ({user.role})'
                ))

        self.stdout.write(self.style.SUCCESS('\nData population completed!'))
        self.stdout.write('\nSample credentials:')
        self.stdout.write('AG: ag_sharma / password123')
        self.stdout.write('DAG (Accounts): dag_accounts / password123')
        self.stdout.write('SrAO: srao_verma / password123')
