import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from users.models import User
from sections.models import Section
from records.models import MailRecord

print("=== Database Status ===")
print(f"Users: {User.objects.count()}")
print(f"Sections: {Section.objects.count()}")
print(f"Mail Records: {MailRecord.objects.count()}")

print("\n=== Users ===")
users = User.objects.all()
for u in users[:10]:
    section_name = u.section.name if u.section else "No Section"
    print(f"  - {u.username} ({u.role}) - {section_name}")

print("\n=== Sections ===")
sections = Section.objects.all()
for s in sections[:10]:
    print(f"  - {s.name}")
