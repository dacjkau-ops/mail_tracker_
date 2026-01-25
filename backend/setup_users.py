import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from users.models import User
from sections.models import Section

print("=== Creating Sections and Users ===\n")

# Create Sections
sections_data = [
    {'name': 'Accounts', 'description': 'Financial and accounting matters'},
    {'name': 'Administration', 'description': 'General administration and HR'},
    {'name': 'Establishment', 'description': 'Personnel and establishment'},
    {'name': 'Legal', 'description': 'Legal affairs and compliance'},
]

sections = {}
print("Creating Sections:")
for section_data in sections_data:
    section = Section.objects.create(**section_data)
    sections[section.name] = section
    print(f"  ✓ {section.name} (ID: {section.id})")

print("\n" + "="*60)
print("Creating Users:")
print("="*60)

# Create Users
users_data = [
    {
        'username': 'ag_sharma',
        'email': 'sharma@office.gov',
        'password': 'test123',
        'full_name': 'Rajesh Sharma',
        'role': 'AG',
        'section': None,
        'is_staff': True,
        'is_superuser': True,
    },
    {
        'username': 'dag_admin',
        'email': 'dag.admin@office.gov',
        'password': 'test123',
        'full_name': 'Priya Kumar',
        'role': 'DAG',
        'section': sections['Administration'],
        'is_staff': True,
        'is_superuser': False,
    },
    {
        'username': 'dag_accounts',
        'email': 'dag.accounts@office.gov',
        'password': 'test123',
        'full_name': 'Amit Singh',
        'role': 'DAG',
        'section': sections['Accounts'],
        'is_staff': True,
        'is_superuser': False,
    },
    {
        'username': 'srao_reddy',
        'email': 'reddy@office.gov',
        'password': 'test123',
        'full_name': 'Lakshmi Reddy',
        'role': 'SrAO',
        'section': sections['Administration'],
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'srao_verma',
        'email': 'verma@office.gov',
        'password': 'test123',
        'full_name': 'Sunita Verma',
        'role': 'SrAO',
        'section': sections['Accounts'],
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'aao_patel',
        'email': 'patel@office.gov',
        'password': 'test123',
        'full_name': 'Rahul Patel',
        'role': 'AAO',
        'section': sections['Accounts'],
        'is_staff': False,
        'is_superuser': False,
    },
]

print("\n{:<15} {:<8} {:<30} {:<10} {:<20} {:<10}".format(
    "USERNAME", "ID", "EMAIL", "PASSWORD", "ROLE", "SECTION"
))
print("-" * 100)

for user_data in users_data:
    password = user_data.pop('password')
    section_name = user_data['section'].name if user_data['section'] else 'None'
    
    user = User.objects.create_user(**user_data)
    user.set_password(password)
    user.save()
    
    print("{:<15} {:<8} {:<30} {:<10} {:<10} {:<20}".format(
        user.username,
        user.id,
        user.email,
        'test123',
        user.role,
        section_name
    ))

print("\n" + "="*60)
print("Summary:")
print("="*60)
print(f"Total Sections: {Section.objects.count()}")
print(f"Total Users: {User.objects.count()} (including admin)")
print(f"  - AG: {User.objects.filter(role='AG').count()}")
print(f"  - DAG: {User.objects.filter(role='DAG').count()}")
print(f"  - SrAO: {User.objects.filter(role='SrAO').count()}")
print(f"  - AAO: {User.objects.filter(role='AAO').count()}")

print("\n" + "="*60)
print("Login Credentials (All passwords: test123)")
print("="*60)
print("\nAG (Full Access):")
print("  - admin / admin123 (existing)")
print("  - ag_sharma / test123 (new)")
print("\nDAG (Section Supervisors):")
print("  - dag_admin / test123 (Administration)")
print("  - dag_accounts / test123 (Accounts)")
print("\nStaff Officers:")
print("  - srao_reddy / test123 (Administration)")
print("  - srao_verma / test123 (Accounts)")
print("  - aao_patel / test123 (Accounts)")

print("\n✅ Setup complete!")
