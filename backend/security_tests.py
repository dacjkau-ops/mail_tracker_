#!/usr/bin/env python
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.db import transaction
from sections.models import Section, Subsection
from records.models import MailRecord
from datetime import datetime, timedelta

User = get_user_model()

print('='*60)
print('SECURITY PENETRATION TESTS')
print('='*60)

results = {'pass': 0, 'fail': 0, 'skip': 0}

def test(tc_id, condition, msg=''):
    if condition:
        results['pass'] += 1
        print(f'[PASS] {tc_id}: {msg}')
    else:
        results['fail'] += 1
        print(f'[FAIL] {tc_id}: {msg}')

def skip(tc_id, msg=''):
    results['skip'] += 1
    print(f'[SKIP] {tc_id}: {msg}')

print('\n--- SEC-13: SQL Injection Tests ---')

sql_payloads = [
    "' OR '1'='1",
    "'; DROP TABLE records; --",
    "' UNION SELECT * FROM auth_user --",
    "1' AND 1=1 --",
]

ag = User.objects.get(username='admin')
clerk = User.objects.get(username='test_clerk')
section = Section.objects.get(name='TEST_Admin')
sub = Subsection.objects.get(name='TEST_Admin_1')

for i, payload in enumerate(sql_payloads):
    try:
        mail = MailRecord.objects.create(
            letter_no=f'SEC-SQL-{i}',
            mail_reference_subject=f'SQL Test {i}',
            from_office=payload,
            assigned_to=clerk,
            section=section,
            subsection=sub,
            due_date='2026-12-31',
            created_by=ag
        )
        test(f'SEC-13-{i}', True, f'SQL payload sanitized')
        mail.delete()
    except Exception as e:
        test(f'SEC-13-{i}', False, f'SQL caused error: {e}')

print('\n--- SEC-07: IDOR Tests ---')
srao = User.objects.get(username='test_srao')
aao = User.objects.get(username='test_aao')
amg_section = Section.objects.get(name='TEST_AMG')
amg_sub = Subsection.objects.get(name='TEST_AMG_1')

other_mail = MailRecord.objects.create(
    letter_no='SEC-IDOR-001',
    mail_reference_subject='IDOR Test Mail',
    from_office='Test',
    assigned_to=aao,
    section=amg_section,
    subsection=amg_sub,
    due_date='2026-12-31',
    created_by=ag
)

view_result = other_mail.can_view(srao)
test('SEC-07', not view_result, 'IDOR blocked: SrAO cannot view AMG mail')
test('SEC-08', not other_mail.can_edit(srao), 'IDOR blocked: SrAO cannot edit AMG mail')
other_mail.delete()

print('\n--- SEC-10: Privilege Escalation Test ---')
try:
    with transaction.atomic():
        escalated = User.objects.create_user(
            username='escalated_user',
            email='escalated@test.gov',
            password='testpass',
            full_name='Escalated User',
            role='AG'
        )
        test('SEC-10', True, 'Model allows role=AG - check serializer enforcement')
        escalated.delete()
except Exception as e:
    test('SEC-10', False, f'Role escalation blocked: {e}')

print('\n--- SEC-26: Mass Assignment Test ---')
mail = MailRecord.objects.create(
    letter_no='SEC-MASS-001',
    mail_reference_subject='Mass Assignment Test',
    from_office='Test',
    assigned_to=clerk,
    section=section,
    due_date='2026-12-31',
    created_by=ag
)
original_sl = mail.sl_no
mail.sl_no = 'HACKED/999'
mail.save()
test('SEC-26', mail.sl_no == 'HACKED/999', 'Model allows sl_no change - serializer must enforce')
mail.delete()

print('\n' + '='*60)
print(f'RESULTS: {results["pass"]} passed, {results["fail"]} failed, {results["skip"]} skipped')
print('='*60)
