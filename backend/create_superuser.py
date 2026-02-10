#!/usr/bin/env python
"""
One-time script to create a superuser for production.
Run this manually after first deployment.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

# Only create if no superuser exists
if not User.objects.filter(is_superuser=True).exists():
    print("Creating superuser...")
    User.objects.create_superuser(
        username='admin',
        email='admin@office.gov',
        password='admin123',  # CHANGE THIS PASSWORD AFTER FIRST LOGIN!
        full_name='System Administrator',
        role='AG'
    )
    print("✅ Superuser 'admin' created successfully!")
    print("⚠️  Default password: admin123")
    print("⚠️  IMPORTANT: Change this password immediately after first login!")
else:
    print("ℹ️  Superuser already exists. Skipping creation.")
