import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from records.models import MailRecord, MailAssignment
from users.models import User
from django.db.models import Q
from audit.models import AuditTrail

# Get test mail
mail = MailRecord.objects.filter(sl_no='2026/003').first()
if mail:
    print(f'Mail: {mail.sl_no}')
    print(f'Status: {mail.status}')
    print(f'Is Multi-Assigned: {mail.is_multi_assigned}')
    print(f'Primary Assigned To: {mail.assigned_to.full_name}')
    print(f'\nAll Assignments:')
    assignments = MailAssignment.objects.filter(mail_record=mail)
    for a in assignments:
        print(f'  - {a.assigned_to.full_name} ({a.assigned_to.username}) - Status: {a.status}')
    
    print(f'\nInitial Instructions: {mail.initial_instructions[:100] if mail.initial_instructions else "None"}')
    
    # Test queryset filtering for each assignee
    print(f'\n--- Testing Queryset Visibility ---')
    for a in assignments:
        user = a.assigned_to
        print(f'\nUser: {user.full_name} ({user.username}) - Role: {user.role}')
        
        # Get parallel assignment IDs for this user
        assigned_via_parallel = list(MailAssignment.objects.filter(
            assigned_to=user,
            status='Active'
        ).values_list('mail_record_id', flat=True).distinct())
        
        print(f'  Parallel Assignment IDs: {assigned_via_parallel}')
        
        # Test if they can see the mail with new filtering
        queryset = MailRecord.objects.all()
        touched_record_ids = list(AuditTrail.objects.filter(
            performed_by=user
        ).values_list('mail_record_id', flat=True).distinct())
        
        if user.role == 'DAG':
            filtered = queryset.filter(
                Q(section=user.section) | Q(id__in=touched_record_ids) | 
                Q(id__in=assigned_via_parallel)
            )
        else:  # SrAO or AAO
            filtered = queryset.filter(
                Q(current_handler=user) | Q(assigned_to=user) | 
                Q(id__in=touched_record_ids) | Q(id__in=assigned_via_parallel)
            )
        
        print(f'  Can see mail 2026/003: {mail in filtered}')
        print(f'  Total visible mails: {filtered.count()}')
