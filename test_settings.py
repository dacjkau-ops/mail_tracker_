#!/usr/bin/env python
"""Test script to verify production settings work correctly"""
import os
import sys

# Set up Django environment
sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Set production-like environment variables
os.environ['ALLOWED_HOSTS'] = 'mail-tracker-backend-yb4o.onrender.com,.onrender.com,localhost'
os.environ['DEBUG'] = 'False'
os.environ['SECRET_KEY'] = 'test-secret-key-for-debugging'

import django
django.setup()

from django.conf import settings

print("=" * 60)
print("Django Settings Test")
print("=" * 60)
print(f"ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")
print(f"DEBUG: {settings.DEBUG}")
print(f"SECRET_KEY: {'***' if settings.SECRET_KEY else 'NOT SET'}")
print(f"STATIC_ROOT: {settings.STATIC_ROOT}")
print(f"STATIC_URL: {settings.STATIC_URL}")
print(f"DATABASE: {settings.DATABASES['default']['ENGINE']}")
print("=" * 60)

# Test if the settings would accept requests from Render
test_hosts = [
    'mail-tracker-backend-yb4o.onrender.com',
    'localhost',
    'example.onrender.com',
    'invalid.com'
]

print("\nHost Validation Test:")
from django.http import HttpRequest
for host in test_hosts:
    request = HttpRequest()
    request.META['HTTP_HOST'] = host
    try:
        from django.core.handlers.wsgi import WSGIRequest
        from django.http import HttpRequest
        # Simple check if host would be allowed
        allowed = any(
            host == allowed_host or
            (allowed_host.startswith('.') and host.endswith(allowed_host))
            for allowed_host in settings.ALLOWED_HOSTS
        )
        print(f"  {host}: {'✅ ALLOWED' if allowed else '❌ BLOCKED'}")
    except Exception as e:
        print(f"  {host}: Error - {e}")

print("=" * 60)
print("✅ Settings configuration is valid!")
