import csv
import json
import os
from io import TextIOWrapper
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.shortcuts import render, redirect
from django.urls import path
from django import forms
from .models import User
from sections.models import Section, Subsection
from records.models import MailRecord, MailAssignment, AssignmentRemark, RecordAttachment
from audit.models import AuditTrail


class ImportUsersForm(forms.Form):
    """Form for importing users from CSV or JSON file"""
    file = forms.FileField(
        label='Select file',
        help_text='CSV or JSON file with user data'
    )

    def clean_file(self):
        file = self.cleaned_data['file']
        ext = file.name.split('.')[-1].lower()
        if ext not in ['csv', 'json']:
            raise forms.ValidationError('Only CSV and JSON files are supported.')
        return file


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'full_name', 'email', 'role', 'is_primary_ag', 'get_sections_display', 'subsection', 'is_active']
    list_filter = ['role', 'is_primary_ag', 'is_active']
    search_fields = ['username', 'full_name', 'email']
    filter_horizontal = ['sections']  # For ManyToMany field
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Additional Info', {'fields': ('role', 'is_primary_ag', 'sections', 'subsection', 'full_name')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Additional Info', {'fields': ('role', 'is_primary_ag', 'sections', 'subsection', 'full_name', 'email')}),
    )
    change_list_template = 'admin/users/user/change_list.html'

    def get_sections_display(self, obj):
        """Display sections for DAG or subsection's section for SrAO/AAO"""
        if obj.role == 'DAG':
            return ', '.join([s.name for s in obj.sections.all()]) or '-'
        elif obj.subsection:
            return obj.subsection.section.name
        return '-'
    get_sections_display.short_description = 'Sections'

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import/', self.admin_site.admin_view(self.import_users), name='users_user_import'),
            path('reset-all-data/', self.admin_site.admin_view(self.reset_all_data), name='users_reset_all_data'),
        ]
        return custom_urls + urls

    def import_users(self, request):
        """Handle user import from CSV/JSON file"""
        if request.method == 'POST':
            form = ImportUsersForm(request.POST, request.FILES)
            if form.is_valid():
                file = form.cleaned_data['file']
                ext = file.name.split('.')[-1].lower()

                try:
                    if ext == 'csv':
                        results = self._import_from_csv(file)
                    else:
                        results = self._import_from_json(file)

                    # Show results
                    if results['created']:
                        created_preview = self._format_username_preview(results['created'])
                        messages.success(
                            request,
                            f"Successfully created {len(results['created'])} users: {created_preview}"
                        )
                    if results['errors']:
                        for error in results['errors']:
                            messages.error(request, error)
                    if results['skipped']:
                        skipped_preview = self._format_username_preview(results['skipped'])
                        messages.warning(
                            request,
                            f"Skipped {len(results['skipped'])} existing users: {skipped_preview}"
                        )

                except Exception as e:
                    messages.error(request, f'Import failed: {str(e)}')

                return redirect('..')
        else:
            form = ImportUsersForm()

        context = {
            'form': form,
            'title': 'Import Users',
            'opts': self.model._meta,
            'has_view_permission': self.has_view_permission(request),
        }
        return render(request, 'admin/users/user/import_users.html', context)

    def reset_all_data(self, request):
        """Delete all operational data while retaining superusers."""
        if not request.user.is_superuser:
            messages.error(request, 'Only superusers can delete all data.')
            return redirect('..')

        if request.method == 'POST':
            if request.POST.get('confirm') != 'yes':
                messages.error(request, 'Confirmation failed. Data was not deleted.')
                return redirect('admin:users_reset_all_data')

            summary = {
                'mail_records': MailRecord.objects.count(),
                'assignments': MailAssignment.objects.count(),
                'assignment_remarks': AssignmentRemark.objects.count(),
                'audit_logs': AuditTrail.objects.count(),
                'attachments': RecordAttachment.objects.count(),
                'sections': Section.objects.count(),
                'subsections': Subsection.objects.count(),
                'users': User.objects.filter(is_superuser=False).count(),
            }

            attachment_paths = []
            for attachment in RecordAttachment.objects.only('file'):
                if attachment.file and attachment.file.name:
                    attachment_paths.append(attachment.file.path)

            with transaction.atomic():
                AssignmentRemark.objects.all().delete()
                MailAssignment.objects.all().delete()
                AuditTrail.objects.all().delete()
                RecordAttachment.objects.all().delete()
                MailRecord.objects.all().delete()
                User.objects.filter(is_superuser=False).delete()
                Subsection.objects.all().delete()
                Section.objects.all().delete()

            for path in attachment_paths:
                try:
                    if os.path.isfile(path):
                        os.remove(path)
                except Exception:
                    pass

            messages.success(
                request,
                (
                    "Deleted data successfully: "
                    f"{summary['mail_records']} mail records, "
                    f"{summary['assignments']} assignments, "
                    f"{summary['assignment_remarks']} assignment remarks, "
                    f"{summary['audit_logs']} audit logs, "
                    f"{summary['attachments']} attachments, "
                    f"{summary['sections']} sections, "
                    f"{summary['subsections']} subsections, "
                    f"{summary['users']} non-superuser users."
                )
            )
            return redirect('admin:users_user_changelist')

        context = {
            'title': 'Delete All Data',
            'opts': self.model._meta,
        }
        return render(request, 'admin/users/user/reset_all_data.html', context)

    def _import_from_csv(self, file):
        """Import users from CSV file"""
        # Read CSV file
        text_file = TextIOWrapper(file, encoding='utf-8')
        reader = csv.DictReader(text_file)

        # Validate required columns
        required_columns = ['username', 'email', 'password', 'full_name', 'role']
        if not reader.fieldnames:
            raise ValueError('CSV file is empty')

        missing = [col for col in required_columns if col not in reader.fieldnames]
        if missing:
            raise ValueError(f'Missing required columns: {", ".join(missing)}. Optional: sections (for DAG), subsection (for SrAO/AAO)')

        rows = list(reader)
        return self._import_rows(rows, row_start=2)

    def _import_from_json(self, file):
        """Import users from JSON file"""
        # Read JSON file
        content = file.read().decode('utf-8')
        data = json.loads(content)

        if not isinstance(data, list):
            raise ValueError('JSON must be an array of user objects')
        return self._import_rows(data, row_start=1)

    def _normalize_role(self, role_value):
        role_raw = str(role_value or '').strip()
        role_upper = role_raw.upper()
        role_map = {
            'AG': 'AG',
            'DAG': 'DAG',
            'SRAO': 'SrAO',
            'SrAO': 'SrAO',
            'AAO': 'AAO',
            'AUDITOR': 'auditor',
            'CLERK': 'clerk',
        }
        return role_map.get(role_raw, role_map.get(role_upper, role_raw))

    def _parse_subsection(self, subsection_name, subsection_by_pair, subsection_by_name):
        subsection_name = (subsection_name or '').strip()
        if not subsection_name:
            return None, None

        if ' - ' in subsection_name:
            section_name, sub_name = subsection_name.split(' - ', 1)
            subsection = subsection_by_pair.get((section_name.strip(), sub_name.strip()))
            if not subsection:
                return None, f'Subsection "{subsection_name}" does not exist'
            return subsection, None

        matches = subsection_by_name.get(subsection_name, [])
        if not matches:
            return None, f'Subsection "{subsection_name}" does not exist'
        if len(matches) > 1:
            return None, f'Multiple subsections named "{subsection_name}" found. Use format: "Section - Subsection"'
        return matches[0], None

    def _format_username_preview(self, usernames, limit=20):
        if not usernames:
            return ''
        preview = ', '.join(usernames[:limit])
        if len(usernames) > limit:
            return f'{preview} ... (+{len(usernames) - limit} more)'
        return preview

    def _import_rows(self, rows, row_start=1):
        results = {'created': [], 'errors': [], 'skipped': []}
        if not rows:
            return results

        section_cache = {section.name: section for section in Section.objects.all()}
        subsection_items = list(Subsection.objects.select_related('section').all())
        subsection_by_pair = {(s.section.name, s.name): s for s in subsection_items}
        subsection_by_name = {}
        for subsection in subsection_items:
            subsection_by_name.setdefault(subsection.name, []).append(subsection)

        existing_usernames = set(User.objects.values_list('username', flat=True))
        existing_emails = set(User.objects.values_list('email', flat=True))
        pending_usernames = set()
        pending_emails = set()
        pending_users = []
        dag_section_map = {}
        auditor_subsection_map = {}

        for idx, row in enumerate(rows):
            row_num = row_start + idx

            username = str(row.get('username', '')).strip()
            email = str(row.get('email', '')).strip()
            password = str(row.get('password', '')).strip()
            full_name = str(row.get('full_name', '')).strip()
            role = self._normalize_role(row.get('role', ''))
            sections_raw = str(row.get('sections', row.get('section_name', ''))).strip()
            subsection_raw = str(row.get('subsection', '')).strip()
            auditor_subsections_raw = str(row.get('auditor_subsections', '')).strip()

            if not all([username, email, password, full_name, role]):
                results['errors'].append(
                    f'Row {row_num}: Missing required fields (username, email, password, full_name, role)'
                )
                continue

            valid_roles = ['AG', 'DAG', 'SrAO', 'AAO', 'auditor', 'clerk']
            if role not in valid_roles:
                results['errors'].append(
                    f'Row {row_num} ({username}): Invalid role "{role}". Must be one of: {", ".join(valid_roles)}'
                )
                continue

            if username in existing_usernames:
                results['skipped'].append(username)
                continue
            if username in pending_usernames:
                results['errors'].append(f'Row {row_num} ({username}): Duplicate username in import file')
                continue

            if email in existing_emails or email in pending_emails:
                results['errors'].append(f'Row {row_num} ({username}): Email "{email}" is already in use')
                continue

            sections_for_dag = []
            if role == 'DAG' and sections_raw:
                section_names = [name.strip() for name in sections_raw.split(',') if name.strip()]
                missing_sections = [name for name in section_names if name not in section_cache]
                if missing_sections:
                    results['errors'].append(
                        f'Row {row_num} ({username}): Section(s) not found: {", ".join(missing_sections)}'
                    )
                    continue
                sections_for_dag = [section_cache[name] for name in section_names]

            subsection = None
            if role in ['SrAO', 'AAO', 'clerk'] and subsection_raw:
                subsection, subsection_error = self._parse_subsection(
                    subsection_raw,
                    subsection_by_pair,
                    subsection_by_name
                )
                if subsection_error:
                    results['errors'].append(f'Row {row_num} ({username}): {subsection_error}')
                    continue

            auditor_subsections = []
            if role == 'auditor':
                raw_value = auditor_subsections_raw or subsection_raw
                if raw_value:
                    subsection_tokens = [name.strip() for name in raw_value.split(',') if name.strip()]
                    parsed = []
                    parse_failed = False
                    for token in subsection_tokens:
                        parsed_subsection, subsection_error = self._parse_subsection(
                            token,
                            subsection_by_pair,
                            subsection_by_name
                        )
                        if subsection_error:
                            results['errors'].append(f'Row {row_num} ({username}): {subsection_error}')
                            parse_failed = True
                            break
                        parsed.append(parsed_subsection)
                    if parse_failed:
                        continue
                    auditor_subsections = parsed

            user = User(
                username=username,
                email=email,
                password=make_password(password),
                full_name=full_name,
                role=role,
                subsection=subsection,
                is_active=True,
            )
            pending_users.append(user)
            pending_usernames.add(username)
            pending_emails.add(email)
            dag_section_map[username] = sections_for_dag
            auditor_subsection_map[username] = auditor_subsections

        if not pending_users:
            return results

        with transaction.atomic():
            User.objects.bulk_create(pending_users, batch_size=500)
            created_users = {
                u.username: u
                for u in User.objects.filter(username__in=pending_usernames)
            }

            dag_through = User.sections.through
            dag_links = []
            auditor_through = User.auditor_subsections.through
            auditor_links = []

            for username, user in created_users.items():
                for section in dag_section_map.get(username, []):
                    dag_links.append(
                        dag_through(user_id=user.id, section_id=section.id)
                    )
                for subsection in auditor_subsection_map.get(username, []):
                    auditor_links.append(
                        auditor_through(user_id=user.id, subsection_id=subsection.id)
                    )

            if dag_links:
                dag_through.objects.bulk_create(dag_links, ignore_conflicts=True)
            if auditor_links:
                auditor_through.objects.bulk_create(auditor_links, ignore_conflicts=True)

        results['created'].extend(sorted(created_users.keys()))
        return results
