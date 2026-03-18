from io import BytesIO

from django.contrib import admin
from django.test import TestCase

from users.import_jobs import process_user_import_job
from users.admin import UserAdmin
from users.models import User, UserImportJob


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
