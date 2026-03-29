from io import BytesIO
from unittest.mock import patch

from django.contrib import admin
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from users.import_jobs import process_user_import_job
from users.admin import UserAdmin
from audit.models import AuditTrail
from records.models import MailAssignment, MailRecord, RecordAttachment
from sections.models import Section, Subsection
from users.models import SignupRequest, User, UserImportJob


class UserImportTests(TestCase):
    def test_csv_import_falls_back_to_username_when_full_name_missing(self):
        importer = UserAdmin(User, admin.site)
        csv_bytes = BytesIO(
            b"username,email,password,full_name,role,section,subsection\n"
            b"nan4,nan4@office.gov,secret,,Auditor,FAW,FAW\n"
        )

        results = importer._import_from_csv(csv_bytes)

        self.assertEqual(results["errors"], [])
        self.assertEqual(results["created"], ["nan4"])
        user = User.objects.get(username="nan4")
        self.assertEqual(user.full_name, "nan4")
        self.assertEqual(user.role, "auditor")

    def test_background_import_job_processes_csv_and_records_summary(self):
        job = UserImportJob.objects.create(
            original_filename='users.csv',
            file_format='csv',
            payload=(
                "username,email,password,full_name,role,section,subsection\n"
                "nan5,nan5@office.gov,secret,,Auditor,FAW,FAW\n"
            ),
        )

        process_user_import_job(job.id)

        job.refresh_from_db()
        self.assertEqual(job.status, 'completed')
        self.assertEqual(job.created_count, 1)
        self.assertEqual(job.error_count, 0)
        self.assertEqual(job.summary['created_preview'], ['nan5'])
        self.assertTrue(User.objects.filter(username='nan5').exists())


class UserAdminResetAllDataTests(TestCase):
    def setUp(self):
        self.superuser = User.objects.create_user(
            username='reset_admin',
            password='pass12345',
            email='reset-admin@example.com',
            full_name='Reset Admin',
            role='AG',
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_login(self.superuser)

        self.section = Section.objects.create(name='Reset Section')
        self.subsection = Subsection.objects.create(section=self.section, name='Reset-1')
        self.staff_user = User.objects.create_user(
            username='reset_staff',
            password='pass12345',
            email='reset-staff@example.com',
            full_name='Reset Staff',
            role='AAO',
            subsection=self.subsection,
        )

        self.mail = MailRecord.objects.create(
            letter_no='RESET/001',
            date_received=timezone.now().date(),
            mail_reference_subject='Reset all data coverage',
            from_office='Reset Office',
            action_required='Delete safely',
            assigned_to=self.staff_user,
            current_handler=self.staff_user,
            monitoring_officer=self.superuser,
            section=self.section,
            subsection=self.subsection,
            due_date=timezone.now().date(),
            status='Assigned',
            created_by=self.superuser,
        )
        self.assignment = MailAssignment.objects.create(
            mail_record=self.mail,
            assigned_to=self.staff_user,
            assigned_by=self.superuser,
            assignment_remarks='Reset test assignment',
            status='Active',
        )
        AuditTrail.objects.create(
            mail_record=self.mail,
            action='CREATE',
            performed_by=self.superuser,
            remarks='Created for reset test',
        )
        self.attachment = RecordAttachment.objects.create(
            mail_record=self.mail,
            file='pdfs/reset-test.pdf',
            original_filename='reset-test.pdf',
            file_size=128,
            uploaded_by=self.superuser,
            upload_stage='created',
            is_current=True,
        )
        SignupRequest.objects.create(
            username='pending_signup',
            email='pending@example.com',
            full_name='Pending Signup',
            password_hash='hashed-password',
            requested_role='AAO',
            requested_section=self.section,
            requested_subsection=self.subsection,
        )
        UserImportJob.objects.create(
            original_filename='import.csv',
            file_format='csv',
            payload='username,email,password,full_name,role\n',
            created_by=self.superuser,
        )

    def test_reset_all_data_uses_storage_delete_and_clears_operational_records(self):
        storage = RecordAttachment._meta.get_field('file').storage

        with patch.object(storage, 'path', side_effect=NotImplementedError('No local filesystem path')), \
             patch.object(storage, 'delete') as delete_mock, \
             self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse('admin:users_reset_all_data'),
                {'confirm': 'yes'},
            )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(MailRecord.objects.count(), 0)
        self.assertEqual(MailAssignment.objects.count(), 0)
        self.assertEqual(RecordAttachment.objects.count(), 0)
        self.assertEqual(Section.objects.count(), 0)
        self.assertEqual(Subsection.objects.count(), 0)
        self.assertEqual(SignupRequest.objects.count(), 0)
        self.assertEqual(UserImportJob.objects.count(), 0)
        self.assertEqual(User.objects.filter(is_superuser=False).count(), 0)
        self.assertTrue(User.objects.filter(id=self.superuser.id).exists())
        delete_mock.assert_called_once_with('pdfs/reset-test.pdf')
