from io import BytesIO

from django.contrib import admin
from django.test import TestCase

from users.admin import UserAdmin
from users.models import User


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
