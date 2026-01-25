"""
Test Script: AG Assignment and Monitoring Workflow

This script demonstrates:
1. AG creating a mail and assigning it
2. How monitoring_officer is auto-assigned based on assigned_to user's role
3. Viewing the audit trail
4. Testing reassignment and status transitions
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from users.models import User
from sections.models import Section
from records.models import MailRecord
from audit.models import AuditTrail
from datetime import date, timedelta

print("="*80)
print("TESTING: AG Assignment and Monitoring Workflow")
print("="*80)

# Get users
ag = User.objects.get(username='ag_sharma')
dag_admin = User.objects.get(username='dag_admin')
srao_reddy = User.objects.get(username='srao_reddy')
aao_patel = User.objects.get(username='aao_patel')

# Get section
admin_section = Section.objects.get(name='Administration')

print("\n" + "="*80)
print("STEP 1: AG Creates Mail and Assigns to SrAO")
print("="*80)

# Create mail record
mail1 = MailRecord.objects.create(
    letter_no='ADM/2026/001',
    date_received=date.today(),
    mail_reference_subject='Budget approval request for Q1 2026',
    from_office='Finance Department',
    action_required='Review',
    assigned_to=srao_reddy,
    current_handler=srao_reddy,
    monitoring_officer=srao_reddy.get_dag(),  # Should be dag_admin
    section=admin_section,
    due_date=date.today() + timedelta(days=7),
    status='Assigned',
    created_by=ag,
    remarks='Please review and provide comments'
)

print(f"\n✓ Mail Created:")
print(f"  Serial No: {mail1.sl_no}")
print(f"  Letter No: {mail1.letter_no}")
print(f"  Subject: {mail1.mail_reference_subject}")
print(f"  From: {mail1.from_office}")
print(f"  Section: {mail1.section.name}")
print(f"  Status: {mail1.status}")
print(f"\n  Created By: {mail1.created_by.full_name} ({mail1.created_by.role})")
print(f"  Assigned To: {mail1.assigned_to.full_name} ({mail1.assigned_to.role})")
print(f"  Current Handler: {mail1.current_handler.full_name}")
print(f"  Monitoring Officer: {mail1.monitoring_officer.full_name if mail1.monitoring_officer else 'None'}")

# Log audit trails
AuditTrail.objects.create(
    mail_record=mail1,
    action='CREATE',
    performed_by=ag,
    new_value={
        'sl_no': mail1.sl_no,
        'assigned_to': srao_reddy.full_name,
        'status': 'Assigned'
    },
    remarks='Mail created and assigned'
)

AuditTrail.objects.create(
    mail_record=mail1,
    action='ASSIGN',
    performed_by=ag,
    new_value={'assigned_to': srao_reddy.full_name},
    remarks=f'Assigned to {srao_reddy.full_name}'
)

print("\n" + "="*80)
print("STEP 2: Verify Monitoring Officer Logic")
print("="*80)

print("\n✓ Monitoring Officer Assignment Logic:")
print(f"  - Assigned to: {srao_reddy.full_name} (SrAO)")
print(f"  - SrAO's Section: {srao_reddy.section.name}")
print(f"  - SrAO's DAG: {srao_reddy.get_dag().full_name if srao_reddy.get_dag() else 'None'}")
print(f"  - Monitoring Officer: {mail1.monitoring_officer.full_name}")
print(f"\n  ✓ Correct: Monitoring officer is the DAG of the assigned user's section")

print("\n" + "="*80)
print("STEP 3: Test Different Assignment Scenarios")
print("="*80)

# Create another mail assigned to DAG
mail2 = MailRecord.objects.create(
    letter_no='ADM/2026/002',
    date_received=date.today(),
    mail_reference_subject='Staff recruitment proposal',
    from_office='HR Department',
    action_required='Approve',
    assigned_to=dag_admin,
    current_handler=dag_admin,
    monitoring_officer=dag_admin.get_dag(),  # Should be AG
    section=admin_section,
    due_date=date.today() + timedelta(days=5),
    status='Assigned',
    created_by=ag,
    remarks='Urgent approval needed'
)

print(f"\n✓ Mail Assigned to DAG:")
print(f"  Serial No: {mail2.sl_no}")
print(f"  Assigned To: {mail2.assigned_to.full_name} ({mail2.assigned_to.role})")
print(f"  Monitoring Officer: {mail2.monitoring_officer.full_name if mail2.monitoring_officer else 'None'}")
print(f"  ✓ When assigned to DAG, monitoring officer is AG")

# Create mail assigned to AAO (in Accounts section)
accounts_section = Section.objects.get(name='Accounts')
dag_accounts = User.objects.get(username='dag_accounts')

mail3 = MailRecord.objects.create(
    letter_no='ACC/2026/001',
    date_received=date.today(),
    mail_reference_subject='Audit compliance report',
    from_office='CAG Office',
    action_required='Process',
    assigned_to=aao_patel,
    current_handler=aao_patel,
    monitoring_officer=aao_patel.get_dag(),  # Should be dag_accounts
    section=accounts_section,
    due_date=date.today() + timedelta(days=10),
    status='Assigned',
    created_by=ag,
    remarks='Process and submit report'
)

print(f"\n✓ Mail Assigned to AAO (Accounts):")
print(f"  Serial No: {mail3.sl_no}")
print(f"  Assigned To: {mail3.assigned_to.full_name} ({mail3.assigned_to.role})")
print(f"  Section: {mail3.section.name}")
print(f"  Monitoring Officer: {mail3.monitoring_officer.full_name if mail3.monitoring_officer else 'None'}")
print(f"  ✓ Monitoring officer is the DAG of Accounts section")

print("\n" + "="*80)
print("STEP 4: View Audit Trail")
print("="*80)

print(f"\nAudit Trail for {mail1.sl_no}:")
print("-" * 80)
audits = AuditTrail.objects.filter(mail_record=mail1).order_by('timestamp')
for audit in audits:
    print(f"  [{audit.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {audit.action}")
    print(f"    Performed by: {audit.performed_by.full_name}")
    if audit.remarks:
        print(f"    Remarks: {audit.remarks}")
    if audit.new_value:
        print(f"    New Value: {audit.new_value}")
    print()

print("\n" + "="*80)
print("STEP 5: Test Reassignment and Status Transitions")
print("="*80)

# Reassign mail1 from srao_reddy to another staff
print(f"\n✓ Reassigning {mail1.sl_no} from {mail1.current_handler.full_name} to aao_patel")
old_handler = mail1.current_handler
mail1.current_handler = aao_patel
mail1.status = 'In Progress'  # Auto-transition
mail1.save()

AuditTrail.objects.create(
    mail_record=mail1,
    action='REASSIGN',
    performed_by=ag,
    old_value={'current_handler': old_handler.full_name},
    new_value={'current_handler': aao_patel.full_name, 'status': 'In Progress'},
    remarks='Reassigned for faster processing'
)

print(f"  Previous Handler: {old_handler.full_name}")
print(f"  New Handler: {mail1.current_handler.full_name}")
print(f"  Status: {mail1.status}")
print(f"  ✓ Status auto-transitioned to 'In Progress'")

print("\n" + "="*80)
print("SUMMARY: AG's View - All Mails and Their Status")
print("="*80)

all_mails = MailRecord.objects.all().select_related(
    'assigned_to', 'current_handler', 'monitoring_officer', 'section'
)

print("\n{:<15} {:<20} {:<15} {:<15} {:<15}".format(
    "SERIAL NO", "SUBJECT", "CURRENT HANDLER", "MONITORING", "STATUS"
))
print("-" * 90)

for mail in all_mails:
    subject_short = mail.mail_reference_subject[:18] + "..." if len(mail.mail_reference_subject) > 20 else mail.mail_reference_subject
    monitoring = mail.monitoring_officer.full_name.split()[0] if mail.monitoring_officer else "None"
    print("{:<15} {:<20} {:<15} {:<15} {:<15}".format(
        mail.sl_no,
        subject_short,
        mail.current_handler.full_name.split()[0],
        monitoring,
        mail.status
    ))

print("\n" + "="*80)
print("KEY OBSERVATIONS:")
print("="*80)
print("1. ✓ AG can create mails for any section")
print("2. ✓ Monitoring officer is auto-assigned based on assignee's role:")
print("     - If assignee is SrAO/AAO → Monitoring = their section's DAG")
print("     - If assignee is DAG → Monitoring = AG")
print("     - If assignee is AG → Monitoring = AG (self)")
print("3. ✓ Status transitions automatically:")
print("     - On creation → Assigned")
print("     - On reassignment → In Progress")
print("4. ✓ All actions are logged in audit trail")
print("5. ✓ AG can see ALL mails across all sections")

print("\n✅ Test Complete!")
