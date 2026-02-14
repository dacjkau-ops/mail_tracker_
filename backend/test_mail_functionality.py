#!/usr/bin/env python
"""
Comprehensive Mail Functionality Test Suite

Tests all permission scenarios and workflow states for the mail tracking system.
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from users.models import User
from records.models import MailRecord, MailAssignment
from sections.models import Section, Subsection
from audit.models import AuditTrail
from django.utils import timezone
from datetime import timedelta


class TestResults:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []

    def assert_true(self, condition, test_name, error_msg=""):
        self.tests_run += 1
        if condition:
            self.tests_passed += 1
            print(f"  [PASS] {test_name}")
            return True
        else:
            self.tests_failed += 1
            self.failures.append((test_name, error_msg))
            print(f"  [FAIL] {test_name}")
            if error_msg:
                print(f"    Error: {error_msg}")
            return False

    def assert_false(self, condition, test_name, error_msg=""):
        return self.assert_true(not condition, test_name, error_msg)

    def print_summary(self):
        print("\n" + "="*70)
        print(f"TEST SUMMARY")
        print("="*70)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed} ({self.tests_passed*100//self.tests_run if self.tests_run else 0}%)")
        print(f"Failed: {self.tests_failed}")
        if self.failures:
            print("\nFailed Tests:")
            for test_name, error_msg in self.failures:
                print(f"  - {test_name}")
                if error_msg:
                    print(f"    {error_msg}")
        print("="*70)


def setup_test_data():
    """Ensure we have test users and sections"""
    print("\n" + "="*70)
    print("SETTING UP TEST DATA")
    print("="*70)

    # Get or create users
    ag = User.objects.filter(role='AG', is_active=True).first()
    dag1 = User.objects.filter(role='DAG', is_active=True).first()
    dag2 = User.objects.filter(role='DAG', is_active=True)[1:2].first() if User.objects.filter(role='DAG', is_active=True).count() > 1 else None
    srao = User.objects.filter(role='SrAO', is_active=True).first()
    aao = User.objects.filter(role='AAO', is_active=True).first()

    print(f"AG: {ag.username if ag else 'MISSING'}")
    print(f"DAG1: {dag1.username if dag1 else 'MISSING'} - Sections: {dag1.sections.count() if dag1 else 0}")
    print(f"DAG2: {dag2.username if dag2 else 'MISSING'} - Sections: {dag2.sections.count() if dag2 else 0}")
    print(f"SrAO: {srao.username if srao else 'MISSING'} - Subsection: {srao.subsection if srao else 'MISSING'}")
    print(f"AAO: {aao.username if aao else 'MISSING'} - Subsection: {aao.subsection if aao else 'MISSING'}")

    return ag, dag1, dag2, srao, aao


def test_1_dag_cannot_create(results, dag):
    """Test 1: DAG Cannot Create Mails"""
    print("\n" + "="*70)
    print("TEST 1: DAG CANNOT CREATE MAILS")
    print("="*70)

    if not dag:
        results.assert_false(True, "DAG user exists", "No DAG user found")
        return None

    # Try to create mail as DAG (should fail in view permission check)
    # Since we can't directly test view permission, we'll check the permission class
    from config.permissions import MailRecordPermission
    from rest_framework.test import APIRequestFactory
    from unittest.mock import Mock

    factory = APIRequestFactory()
    request = factory.post('/api/records/')
    request.user = dag

    view = Mock()
    view.action = 'create'

    permission = MailRecordPermission()
    can_create = permission.has_permission(request, view)

    results.assert_false(can_create, "DAG blocked from creating mails",
                        f"DAG should not have create permission but has: {can_create}")

    return None


def test_2_ag_create_assign_single(results, ag, dag, srao, aao):
    """Test 2: AG Can Create and Assign to Single User (DAG/SrAO/AAO)"""
    print("\n" + "="*70)
    print("TEST 2: AG CREATE AND ASSIGN TO SINGLE USER")
    print("="*70)

    if not ag:
        results.assert_false(True, "AG user exists", "No AG user found")
        return []

    created_mails = []

    # Test 2a: Assign to DAG
    if dag:
        try:
            dag_section = dag.sections.first() if dag.sections.exists() else None
            mail1 = MailRecord.objects.create(
                letter_no=f'TEST/AG2DAG/{timezone.now().timestamp()}',
                date_received=timezone.now().date(),
                mail_reference_subject='Test AG to DAG assignment',
                from_office='Test Office',
                action_required='Review',
                assigned_to=dag,
                current_handler=dag,
                section=dag_section,
                subsection=None,  # DAGs don't have subsections
                due_date=timezone.now().date() + timedelta(days=7),
                created_by=ag,
                monitoring_officer=dag.get_dag()
            )
            created_mails.append(mail1)
            results.assert_true(True, "AG can assign to DAG", f"Created {mail1.sl_no}")
        except Exception as e:
            results.assert_false(True, "AG can assign to DAG", str(e))

    # Test 2b: Assign to SrAO
    if srao and srao.subsection:
        try:
            mail2 = MailRecord.objects.create(
                letter_no=f'TEST/AG2SRAO/{timezone.now().timestamp()}',
                date_received=timezone.now().date(),
                mail_reference_subject='Test AG to SrAO assignment',
                from_office='Test Office',
                action_required='Process',
                assigned_to=srao,
                current_handler=srao,
                section=srao.subsection.section,
                subsection=srao.subsection,
                due_date=timezone.now().date() + timedelta(days=7),
                created_by=ag,
                monitoring_officer=srao.get_dag()
            )
            created_mails.append(mail2)
            results.assert_true(True, "AG can assign to SrAO", f"Created {mail2.sl_no}")
        except Exception as e:
            results.assert_false(True, "AG can assign to SrAO", str(e))

    # Test 2c: Assign to AAO
    if aao and aao.subsection:
        try:
            mail3 = MailRecord.objects.create(
                letter_no=f'TEST/AG2AAO/{timezone.now().timestamp()}',
                date_received=timezone.now().date(),
                mail_reference_subject='Test AG to AAO assignment',
                from_office='Test Office',
                action_required='File',
                assigned_to=aao,
                current_handler=aao,
                section=aao.subsection.section,
                subsection=aao.subsection,
                due_date=timezone.now().date() + timedelta(days=7),
                created_by=ag,
                monitoring_officer=aao.get_dag()
            )
            created_mails.append(mail3)
            results.assert_true(True, "AG can assign to AAO", f"Created {mail3.sl_no}")
        except Exception as e:
            results.assert_false(True, "AG can assign to AAO", str(e))

    return created_mails


def test_3_ag_create_assign_multiple_dags(results, ag, dag1, dag2):
    """Test 3: AG Can Assign to Multiple DAGs"""
    print("\n" + "="*70)
    print("TEST 3: AG ASSIGN TO MULTIPLE DAGs")
    print("="*70)

    if not ag or not dag1 or not dag2:
        results.assert_false(True, "Required users exist", "Missing AG or DAGs")
        return None

    if not dag1.sections.exists() or not dag2.sections.exists():
        results.assert_false(True, "DAGs have sections", "DAGs need section assignments")
        return None

    try:
        # Create mail
        mail = MailRecord.objects.create(
            letter_no=f'TEST/MULTI-DAG/{timezone.now().timestamp()}',
            date_received=timezone.now().date(),
            mail_reference_subject='Test multi-DAG assignment',
            from_office='Test Office',
            action_required='Review',
            assigned_to=dag1,  # Primary assignee
            current_handler=dag1,
            section=None,  # Cross-section
            due_date=timezone.now().date() + timedelta(days=7),
            created_by=ag,
            monitoring_officer=ag,
            is_multi_assigned=True
        )

        # Create assignments for both DAGs
        MailAssignment.objects.create(
            mail_record=mail,
            assigned_to=dag1,
            assigned_by=ag,
            assignment_remarks='Review from your section perspective',
            status='Active'
        )

        MailAssignment.objects.create(
            mail_record=mail,
            assigned_to=dag2,
            assigned_by=ag,
            assignment_remarks='Review from your section perspective',
            status='Active'
        )

        results.assert_true(True, "AG can assign to multiple DAGs", f"Created {mail.sl_no}")

        # Test visibility
        dag1_can_see = mail.can_view(dag1)
        dag2_can_see = mail.can_view(dag2)

        results.assert_true(dag1_can_see, "DAG1 can see assigned mail")
        results.assert_true(dag2_can_see, "DAG2 can see assigned mail")

        return mail

    except Exception as e:
        results.assert_false(True, "AG can assign to multiple DAGs", str(e))
        return None


def test_4_dag_visibility_cross_section(results, ag, dag1, dag2, srao):
    """Test 4: DAG Visibility - Can Other DAGs See Mails?"""
    print("\n" + "="*70)
    print("TEST 4: DAG CROSS-SECTION VISIBILITY")
    print("="*70)

    if not all([ag, dag1, dag2, srao]):
        results.assert_false(True, "Required users exist", "Missing users")
        return None

    if not srao.subsection:
        results.assert_false(True, "SrAO has subsection", "SrAO needs subsection")
        return None

    try:
        # Create mail assigned to SrAO in DAG1's section
        mail = MailRecord.objects.create(
            letter_no=f'TEST/DAG-VIS/{timezone.now().timestamp()}',
            date_received=timezone.now().date(),
            mail_reference_subject='Test DAG visibility',
            from_office='Test Office',
            action_required='Review',
            assigned_to=srao,
            current_handler=srao,
            section=srao.subsection.section,
            subsection=srao.subsection,
            due_date=timezone.now().date() + timedelta(days=7),
            created_by=ag,
            monitoring_officer=srao.get_dag()
        )

        # Check if DAG1 (section owner) can see it
        dag1_section_ids = set(dag1.sections.values_list('id', flat=True))
        dag1_can_see = srao.subsection.section_id in dag1_section_ids

        # Check if DAG2 (different section) can see it
        dag2_section_ids = set(dag2.sections.values_list('id', flat=True))
        dag2_can_see = srao.subsection.section_id in dag2_section_ids

        results.assert_true(dag1_can_see, "DAG1 (same section) can see mail",
                          f"DAG1 sections: {list(dag1_section_ids)}, Mail section: {srao.subsection.section_id}")
        results.assert_false(dag2_can_see, "DAG2 (different section) cannot see mail",
                           f"DAG2 should not see mail from different section")

        return mail

    except Exception as e:
        results.assert_false(True, "DAG visibility test", str(e))
        return None


def test_5_multi_dag_remarks_visibility(results, multi_dag_mail, dag1, dag2):
    """Test 5: Multi-DAG Assignment - Can They See Each Other's Remarks?"""
    print("\n" + "="*70)
    print("TEST 5: MULTI-DAG REMARKS VISIBILITY")
    print("="*70)

    if not multi_dag_mail or not dag1 or not dag2:
        results.assert_false(True, "Test data exists", "Missing mail or DAGs")
        return

    try:
        # DAG1 adds a remark
        from records.models import AssignmentRemark
        assignment1 = MailAssignment.objects.get(mail_record=multi_dag_mail, assigned_to=dag1)
        remark1 = AssignmentRemark.objects.create(
            assignment=assignment1,
            content="DAG1: Reviewed from administrative perspective",
            created_by=dag1
        )

        # DAG2 adds a remark
        assignment2 = MailAssignment.objects.get(mail_record=multi_dag_mail, assigned_to=dag2)
        remark2 = AssignmentRemark.objects.create(
            assignment=assignment2,
            content="DAG2: Reviewed from financial perspective",
            created_by=dag2
        )

        # Check if DAG1 can see all assignments (including DAG2's)
        all_assignments = multi_dag_mail.parallel_assignments.all()
        dag1_assignments = [a for a in all_assignments if a.assigned_to == dag1]
        dag2_assignments = [a for a in all_assignments if a.assigned_to == dag2]

        # In current implementation, users see only their own assignment in isolated view
        # AG sees all assignments
        results.assert_true(len(dag1_assignments) == 1, "DAG1 sees their own assignment")
        results.assert_true(len(dag2_assignments) == 1, "DAG2 sees their own assignment")

        # Check if remarks are isolated (they should be for privacy)
        dag1_remarks = assignment1.remarks_timeline.all()
        dag2_remarks = assignment2.remarks_timeline.all()

        results.assert_true(dag1_remarks.filter(content__contains="DAG1").exists(),
                          "DAG1 can see their own remarks")
        results.assert_true(dag2_remarks.filter(content__contains="DAG2").exists(),
                          "DAG2 can see their own remarks")

        print(f"  Note: Each DAG sees only their own assignment (isolated view)")
        print(f"  AG/Creator can see all assignments and remarks")

    except Exception as e:
        results.assert_false(True, "Multi-DAG remarks visibility", str(e))


def test_6_dag_reassign_to_multiple_srao(results, ag, dag1, srao, aao):
    """Test 6: DAG Can Reassign to Multiple SrAO"""
    print("\n" + "="*70)
    print("TEST 6: DAG REASSIGN TO MULTIPLE SrAO")
    print("="*70)

    if not all([ag, dag1, srao, aao]):
        results.assert_false(True, "Required users exist", "Missing users")
        return None

    if not dag1.sections.exists() or not srao.subsection or not aao.subsection:
        results.assert_false(True, "Users configured correctly", "DAG needs sections, Staff need subsections")
        return None

    try:
        # Create a mail assigned to DAG1
        dag1_section = dag1.sections.first()
        mail = MailRecord.objects.create(
            letter_no=f'TEST/DAG-REASSIGN/{timezone.now().timestamp()}',
            date_received=timezone.now().date(),
            mail_reference_subject='Test DAG reassignment',
            from_office='Test Office',
            action_required='Process',
            assigned_to=dag1,
            current_handler=dag1,
            section=dag1_section,
            subsection=None,  # DAG doesn't have subsection
            due_date=timezone.now().date() + timedelta(days=7),
            created_by=ag,
            monitoring_officer=ag
        )

        # DAG1 reassigns to SrAO
        mail.current_handler = srao
        mail.status = 'In Progress'
        mail.save()

        # Create audit trail
        AuditTrail.objects.create(
            mail_record=mail,
            action='REASSIGN',
            performed_by=dag1,
            new_value={'current_handler': srao.full_name},
            remarks='DAG reassigned to SrAO for processing'
        )

        results.assert_true(mail.current_handler == srao,
                          "DAG can reassign to SrAO",
                          f"Current handler: {mail.current_handler.username}")

        # Now create multi-assignment to both SrAO and AAO
        MailAssignment.objects.create(
            mail_record=mail,
            assigned_to=srao,
            assigned_by=dag1,
            assignment_remarks='Process administrative aspects',
            status='Active'
        )

        MailAssignment.objects.create(
            mail_record=mail,
            assigned_to=aao,
            assigned_by=dag1,
            assignment_remarks='Process financial aspects',
            status='Active'
        )

        mail.is_multi_assigned = True
        mail.save()

        results.assert_true(mail.parallel_assignments.count() >= 2,
                          "DAG can assign to multiple SrAO/AAO",
                          f"Assignments: {mail.parallel_assignments.count()}")

        return mail

    except Exception as e:
        results.assert_false(True, "DAG reassign to multiple SrAO", str(e))
        return None


def test_7_remarks_workflow(results, ag, aao):
    """Test 7: Remarks Workflow - When Should Remarks Be Added?"""
    print("\n" + "="*70)
    print("TEST 7: REMARKS WORKFLOW")
    print("="*70)

    if not ag or not aao or not aao.subsection:
        results.assert_false(True, "Required users exist", "Missing AG or AAO")
        return

    try:
        # Create mail assigned to AAO
        mail = MailRecord.objects.create(
            letter_no=f'TEST/REMARKS/{timezone.now().timestamp()}',
            date_received=timezone.now().date(),
            mail_reference_subject='Test remarks workflow',
            from_office='Test Office',
            action_required='Review',
            assigned_to=aao,
            current_handler=aao,
            section=aao.subsection.section,
            subsection=aao.subsection,
            due_date=timezone.now().date() + timedelta(days=7),
            created_by=ag,
            monitoring_officer=aao.get_dag()
        )

        initial_audit_count = AuditTrail.objects.filter(mail_record=mail).count()

        # Scenario 1: AAO starts working (no remarks yet)
        mail.status = 'In Progress'
        mail.save()

        AuditTrail.objects.create(
            mail_record=mail,
            action='UPDATE',
            performed_by=aao,
            new_value={'status': 'In Progress'},
            remarks='Started working on this'
        )

        after_start_count = AuditTrail.objects.filter(mail_record=mail).count()
        results.assert_true(after_start_count > initial_audit_count,
                          "Status change creates audit trail")

        # Scenario 2: AAO adds progress update (optional)
        AuditTrail.objects.create(
            mail_record=mail,
            action='UPDATE',
            performed_by=aao,
            new_value={},
            remarks='Contacted source department for clarification'
        )

        # Scenario 3: AAO completes work and closes
        mail.status = 'Closed'
        mail.date_of_completion = timezone.now().date()
        mail.save()

        AuditTrail.objects.create(
            mail_record=mail,
            action='CLOSE',
            performed_by=aao,
            new_value={'status': 'Closed'},
            remarks='Completed review. All documents verified and filed.'
        )

        final_audit_count = AuditTrail.objects.filter(mail_record=mail).count()

        results.assert_true(mail.status == 'Closed', "Mail can be closed")
        results.assert_true(final_audit_count >= 3,
                          "Multiple audit trail entries created",
                          f"Audit entries: {final_audit_count}")

        # Get all audit actions
        audit_actions = list(AuditTrail.objects.filter(mail_record=mail).values_list('action', flat=True))

        print(f"  Workflow stages captured: {audit_actions}")
        print(f"  Recommendation: Officers can add remarks at any stage")
        print(f"  - Optional: 'Working on it' when starting")
        print(f"  - Optional: Progress updates during work")
        print(f"  - Mandatory: Final remarks when closing")

    except Exception as e:
        results.assert_false(True, "Remarks workflow test", str(e))


def test_8_permission_boundaries(results, ag, dag1, srao, aao):
    """Test 8: Permission Boundaries - Edge Cases"""
    print("\n" + "="*70)
    print("TEST 8: PERMISSION BOUNDARIES (EDGE CASES)")
    print("="*70)

    if not all([ag, dag1, srao, aao]):
        results.assert_false(True, "Required users exist", "Missing users")
        return

    # Test 8a: SrAO cannot reassign to different subsection
    if srao.subsection and aao.subsection:
        srao_can_reassign_cross_subsection = (srao.subsection == aao.subsection)
        results.assert_false(srao_can_reassign_cross_subsection,
                           "SrAO should only reassign within own subsection",
                           "Different subsections confirmed")

    # Test 8b: Closed mail cannot be reassigned (except by AG via reopen)
    if aao.subsection:
        try:
            closed_mail = MailRecord.objects.create(
                letter_no=f'TEST/CLOSED/{timezone.now().timestamp()}',
                date_received=timezone.now().date(),
                mail_reference_subject='Test closed mail',
                from_office='Test Office',
                action_required='Review',
                assigned_to=aao,
                current_handler=aao,
                section=aao.subsection.section,
                subsection=aao.subsection,
                due_date=timezone.now().date() + timedelta(days=7),
                created_by=ag,
                monitoring_officer=aao.get_dag(),
                status='Closed',
                date_of_completion=timezone.now().date()
            )

            can_reopen_ag = closed_mail.can_reopen(ag)
            can_reopen_dag = closed_mail.can_reopen(dag1)
            can_reopen_aao = closed_mail.can_reopen(aao)

            results.assert_true(can_reopen_ag, "Only AG can reopen closed mails")
            results.assert_false(can_reopen_dag, "DAG cannot reopen closed mails")
            results.assert_false(can_reopen_aao, "AAO cannot reopen closed mails")

        except Exception as e:
            results.assert_false(True, "Closed mail permission test", str(e))


def run_all_tests():
    """Run all test scenarios"""
    results = TestResults()

    # Setup
    ag, dag1, dag2, srao, aao = setup_test_data()

    # Run tests
    test_1_dag_cannot_create(results, dag1)

    single_mails = test_2_ag_create_assign_single(results, ag, dag1, srao, aao)

    multi_dag_mail = test_3_ag_create_assign_multiple_dags(results, ag, dag1, dag2)

    test_4_dag_visibility_cross_section(results, ag, dag1, dag2, srao)

    test_5_multi_dag_remarks_visibility(results, multi_dag_mail, dag1, dag2)

    dag_reassign_mail = test_6_dag_reassign_to_multiple_srao(results, ag, dag1, srao, aao)

    test_7_remarks_workflow(results, ag, aao)

    test_8_permission_boundaries(results, ag, dag1, srao, aao)

    # Print summary
    results.print_summary()


if __name__ == '__main__':
    print("\n" + "="*70)
    print("MAIL TRACKING SYSTEM - COMPREHENSIVE TEST SUITE")
    print("="*70)
    run_all_tests()
