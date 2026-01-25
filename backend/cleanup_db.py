import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from users.models import User
from sections.models import Section
from records.models import MailRecord
from audit.models import AuditTrail

print("=== Database Cleanup ===\n")

# Count before
print("Before cleanup:")
print(f"  Users: {User.objects.count()}")
print(f"  Sections: {Section.objects.count()}")
print(f"  Mail Records: {MailRecord.objects.count()}")
print(f"  Audit Trails: {AuditTrail.objects.count()}")

# Delete all mail records (this will cascade delete audit trails)
mail_count = MailRecord.objects.count()
MailRecord.objects.all().delete()
print(f"\n✓ Deleted {mail_count} mail records")

# Delete all users except admin (must be done before sections due to PROTECT)
users_to_delete = User.objects.exclude(username='admin')
user_count = users_to_delete.count()
users_to_delete.delete()
print(f"✓ Deleted {user_count} users (kept admin)")

# Delete all sections
section_count = Section.objects.count()
Section.objects.all().delete()
print(f"✓ Deleted {section_count} sections")

# Count after
print("\nAfter cleanup:")
print(f"  Users: {User.objects.count()}")
print(f"  Sections: {Section.objects.count()}")
print(f"  Mail Records: {MailRecord.objects.count()}")
print(f"  Audit Trails: {AuditTrail.objects.count()}")

# Show remaining admin user
admin = User.objects.get(username='admin')
print(f"\nRemaining user:")
print(f"  Username: {admin.username}")
print(f"  ID: {admin.id}")
print(f"  Email: {admin.email}")
print(f"  Role: {admin.role}")
print(f"  Full Name: {admin.full_name}")

print("\n✅ Cleanup complete!")
