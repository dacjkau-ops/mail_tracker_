#!/usr/bin/env python
"""Compatibility wrapper for deployment/bootstrap tooling."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.management import call_command


if __name__ == '__main__':
    call_command('ensure_superuser')
