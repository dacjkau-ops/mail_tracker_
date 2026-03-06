#!/usr/bin/env python
"""
API-Level Test Suite for Mail Tracker
Tests Django REST API endpoints
"""
import os
import sys
import json

# Set test environment
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
os.environ['ALLOWED_HOSTS'] = 'localhost,127.0.0.1,testserver'
os.environ['DEBUG'] = 'True'

import django
django.setup()

from django.test import Client, override_settings
from django.contrib.auth import get_user_model
from records.models import MailRecord
from sections.models import Section, Subsection
from datetime import datetime, timedelta

User = get_user_model()

print('='*60)
print('API-LEVEL TEST SUITE')
print('='*60)

# Create client with CSRF checks disabled for API testing
client = Client(enforce_csrf_checks=False)

results = {'pass': 0, 'fail': 0}

def test(tc_id, condition, msg=''):
    if condition:
        results['pass'] += 1
        print(f'[PASS] {tc_id}: {msg}')
    else:
        results['fail'] += 1
        print(f'[FAIL] {tc_id}: {msg}')

print('\n' + '='*60)
print('SECTION 1: AUTHENTICATION API')
print('='*60)

# AUTH-API-01: Login with valid credentials
print('\n--- Login Tests ---')
response = client.post('/api/auth/login/',
    data=json.dumps({'username': 'admin', 'password': 'admin'}),
    content_type='application/json')
test('AUTH-API-01', response.status_code == 200,
    f'Login status: {response.status_code}')

if response.status_code == 200:
    data = json.loads(response.content)
    access_token = data.get('access')
    refresh_token = data.get('refresh')
    test('AUTH-API-02', 'access' in data, 'Access token present')
    test('AUTH-API-03', 'refresh' in data, 'Refresh token present')
    test('AUTH-API-04', 'user' in data, 'User data present')
else:
    print(f'Login response: {response.content}')
    access_token = None
    refresh_token = None

# AUTH-API-05: Invalid credentials
response = client.post('/api/auth/login/',
    data=json.dumps({'username': 'admin', 'password': 'wrong'}),
    content_type='application/json')
test('AUTH-API-05', response.status_code in [401, 400],
    f'Invalid login returns {response.status_code}')

# AUTH-API-06: Non-existent user
response = client.post('/api/auth/login/',
    data=json.dumps({'username': 'nonexistent123', 'password': 'pass'}),
    content_type='application/json')
test('AUTH-API-06', response.status_code in [401, 400],
    f'Non-existent user returns {response.status_code}')

print('\n--- Token Tests ---')
# AUTH-API-07: Protected endpoint without auth
response = client.get('/api/records/')
test('AUTH-API-07', response.status_code == 403,
    f'No auth returns {response.status_code}')

# AUTH-API-08: Protected endpoint with valid token
if access_token:
    response = client.get('/api/records/', HTTP_AUTHORIZATION=f'Bearer {access_token}')
    test('AUTH-API-08', response.status_code == 200,
        f'Valid token returns {response.status_code}')

# AUTH-API-09: Invalid token
response = client.get('/api/records/', HTTP_AUTHORIZATION='Bearer invalidtoken123')
test('AUTH-API-09', response.status_code in [401, 403],
    f'Invalid token returns {response.status_code}')

# AUTH-API-10: Token refresh
if refresh_token:
    response = client.post('/api/auth/refresh/',
        data=json.dumps({'refresh': refresh_token}),
        content_type='application/json')
    test('AUTH-API-10', response.status_code == 200,
        f'Token refresh returns {response.status_code}')
    if response.status_code == 200:
        data = json.loads(response.content)
        test('AUTH-API-11', 'access' in data, 'New access token returned')

print('\n' + '='*60)
print('SECTION 2: USER API')
print('='*60)

# USER-API-01: List users with auth
if access_token:
    response = client.get('/api/users/', HTTP_AUTHORIZATION=f'Bearer {access_token}')
    test('USER-API-01', response.status_code == 200,
        f'List users returns {response.status_code}')
    if response.status_code == 200:
        data = json.loads(response.content)
        test('USER-API-02', isinstance(data, list) or 'results' in data,
            'Users data returned')

# USER-API-03: Current user endpoint
if access_token:
    response = client.get('/api/users/me/', HTTP_AUTHORIZATION=f'Bearer {access_token}')
    test('USER-API-03', response.status_code == 200,
        f'Current user returns {response.status_code}')
    if response.status_code == 200:
        data = json.loads(response.content)
        test('USER-API-04', data.get('username') == 'admin',
            'Current user is admin')

print('\n' + '='*60)
print('SECTION 3: MAIL RECORDS API')
print('='*60)

# Get test data
ag = User.objects.get(username='admin')
clerk = User.objects.get(username='test_clerk')
section = Section.objects.get(name='TEST_Admin')
sub = Subsection.objects.get(name='TEST_Admin_1')

# MAIL-API-01: Create mail via API
if access_token:
    response = client.post('/api/records/',
        data=json.dumps({
            'letter_no': 'API-TEST-001',
            'date_received': str(datetime.now().date()),
            'mail_reference_subject': 'API Test Mail',
            'from_office': 'Test Office',
            'action_required': 'Test action',
            'assigned_to': clerk.id,
            'section': section.id,
            'subsection': sub.id,
            'due_date': str(datetime.now().date() + timedelta(days=7))
        }),
        content_type='application/json',
        HTTP_AUTHORIZATION=f'Bearer {access_token}')
    test('MAIL-API-01', response.status_code == 201,
        f'Create mail returns {response.status_code}')

    if response.status_code == 201:
        data = json.loads(response.content)
        test('MAIL-API-02', 'sl_no' in data, 'Serial number returned')
        test('MAIL-API-03', data.get('status') == 'Assigned', 'Status is Assigned')
        mail_id = data.get('id')
    else:
        print(f'Create mail error: {response.content}')
        mail_id = None
else:
    mail_id = None

# MAIL-API-04: List mails
if access_token:
    response = client.get('/api/records/', HTTP_AUTHORIZATION=f'Bearer {access_token}')
    test('MAIL-API-04', response.status_code == 200,
        f'List mails returns {response.status_code}')

# MAIL-API-05: Search mails
if access_token:
    response = client.get('/api/records/?search=API-TEST',
        HTTP_AUTHORIZATION=f'Bearer {access_token}')
    test('MAIL-API-05', response.status_code == 200,
        f'Search mails returns {response.status_code}')

# MAIL-API-06: Filter by status
if access_token:
    response = client.get('/api/records/?status=Assigned',
        HTTP_AUTHORIZATION=f'Bearer {access_token}')
    test('MAIL-API-06', response.status_code == 200,
        f'Filter by status returns {response.status_code}')

# MAIL-API-07: Pagination
if access_token:
    response = client.get('/api/records/?page=1&page_size=10',
        HTTP_AUTHORIZATION=f'Bearer {access_token}')
    test('MAIL-API-07', response.status_code == 200,
        f'Pagination returns {response.status_code}')
    if response.status_code == 200:
        data = json.loads(response.content)
        test('MAIL-API-08', 'count' in data or 'results' in data,
            'Pagination data structure correct')

print('\n' + '='*60)
print('SECTION 4: PERMISSION API TESTS')
print('='*60)

# Get tokens for different users
print('\n--- Getting DAG Token ---')
dag = User.objects.get(username='test_dag')
response = client.post('/api/auth/login/',
    data=json.dumps({'username': 'test_dag', 'password': 'testpass123'}),
    content_type='application/json')
if response.status_code == 200:
    dag_token = json.loads(response.content).get('access')
    test('PERM-API-01', True, 'DAG login successful')
else:
    dag_token = None
    test('PERM-API-01', False, f'DAG login failed: {response.status_code}')

print('\n--- Getting SrAO Token ---')
response = client.post('/api/auth/login/',
    data=json.dumps({'username': 'test_srao', 'password': 'testpass123'}),
    content_type='application/json')
if response.status_code == 200:
    srao_token = json.loads(response.content).get('access')
    test('PERM-API-02', True, 'SrAO login successful')
else:
    srao_token = None
    test('PERM-API-02', False, f'SrAO login failed: {response.status_code}')

# PERM-API-03: DAG can view managed section mails
if dag_token:
    response = client.get('/api/records/',
        HTTP_AUTHORIZATION=f'Bearer {dag_token}')
    test('PERM-API-03', response.status_code == 200,
        f'DAG list mails returns {response.status_code}')

# PERM-API-04: SrAO can view own subsection mails
if srao_token:
    response = client.get('/api/records/',
        HTTP_AUTHORIZATION=f'Bearer {srao_token}')
    test('PERM-API-04', response.status_code == 200,
        f'SrAO list mails returns {response.status_code}')

print('\n' + '='*60)
print('SECTION 5: SIGNUP API TESTS')
print('='*60)

# SIGNUP-API-01: Get signup metadata
response = client.get('/api/auth/signup-metadata/')
test('SIGNUP-API-01', response.status_code == 200,
    f'Signup metadata returns {response.status_code}')
if response.status_code == 200:
    data = json.loads(response.content)
    test('SIGNUP-API-02', 'sections' in data, 'Sections in metadata')
    test('SIGNUP-API-03', 'roles' in data, 'Roles in metadata')

# SIGNUP-API-04: Blocked email domain
response = client.post('/api/auth/signup/',
    data=json.dumps({
        'username': 'testuser',
        'email': 'test@gmail.com',
        'full_name': 'Test User',
        'password': 'testpass123',
        'requested_role': 'clerk',
        'requested_section': section.id,
        'requested_subsection': sub.id
    }),
    content_type='application/json')
test('SIGNUP-API-04', response.status_code in [400, 403],
    f'Blocked domain gmail.com returns {response.status_code}')

# SIGNUP-API-05: Valid signup request
response = client.post('/api/auth/signup/',
    data=json.dumps({
        'username': 'testapiuser',
        'email': 'test@office.gov',
        'full_name': 'Test API User',
        'password': 'testpass123',
        'requested_role': 'clerk',
        'requested_section': section.id,
        'requested_subsection': sub.id
    }),
    content_type='application/json')
test('SIGNUP-API-05', response.status_code in [201, 200],
    f'Valid signup returns {response.status_code}')

print('\n' + '='*60)
print('SECTION 6: SECTIONS API')
print('='*60)

# SECTION-API-01: List sections
if access_token:
    response = client.get('/api/sections/',
        HTTP_AUTHORIZATION=f'Bearer {access_token}')
    test('SECTION-API-01', response.status_code == 200,
        f'List sections returns {response.status_code}')

# SECTION-API-02: List subsections
if access_token:
    response = client.get('/api/subsections/',
        HTTP_AUTHORIZATION=f'Bearer {access_token}')
    test('SECTION-API-02', response.status_code == 200,
        f'List subsections returns {response.status_code}')

# Cleanup
MailRecord.objects.filter(letter_no__startswith='API-TEST').delete()
User.objects.filter(username='testapiuser').delete()

print('\n' + '='*60)
print(f'FINAL RESULTS: {results["pass"]} passed, {results["fail"]} failed')
print('='*60)
