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
from .import_jobs import start_user_import_job
from .models import User, SignupRequest, UserImportJob
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
    list_display = ['username', 'full_name', 'email', 'role', 'actual_role', 'is_primary_ag', 'get_sections_display', 'subsection', 'is_active']
    list_filter = ['role', 'is_primary_ag', 'is_active']
    search_fields = ['username', 'full_name', 'email']
    filter_horizontal = ['sections']  # For ManyToMany field
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Additional Info', {'fields': ('role', 'actual_role', 'is_primary_ag', 'sections', 'subsection', 'full_name')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Additional Info', {'fields': ('role', 'actual_role', 'is_primary_ag', 'sections', 'subsection', 'full_name', 'email')}),
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
                    content = file.read().decode('utf-8-sig' if ext == 'csv' else 'utf-8')
                    job = UserImportJob.objects.create(
                        original_filename=file.name,
                        file_format=ext,
                        payload=content,
                        created_by=request.user,
                    )
                    transaction.on_commit(lambda: start_user_import_job(job.id))
                    messages.success(
                        request,
                        f'Import started in background as job #{job.id}. Refresh this page to see progress.'
                    )

                except Exception as e:
                    messages.error(request, f'Import failed: {str(e)}')

                return redirect('admin:users_user_import')
        else:
            form = ImportUsersForm()

        context = {
            'form': form,
            'title': 'Import Users',
            'opts': self.model._meta,
            'has_view_permission': self.has_view_permission(request),
            'recent_jobs': UserImportJob.objects.select_related('created_by')[:10],
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

        normalized_fieldnames = {str(name).strip().lower() for name in reader.fieldnames if name}
        missing = [col for col in required_columns if col not in normalized_fieldnames]
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

    def _get_or_create_section(self, section_name, section_cache):
        section_name = (section_name or '').strip()
        if not section_name:
            return None
        section = section_cache.get(section_name)
        if section:
            return section
        section = Section.objects.create(name=section_name, directly_under_ag=False)
        section_cache[section_name] = section
        return section

    def _get_or_create_subsection(
        self,
        section_name,
        subsection_name,
        section_cache,
        subsection_by_pair,
        subsection_by_name
    ):
        section_name = (section_name or '').strip()
        subsection_name = (subsection_name or '').strip()
        if not section_name or not subsection_name:
            return None, 'Both section and subsection names are required to create subsection.'

        pair_key = (section_name, subsection_name)
        existing = subsection_by_pair.get(pair_key)
        if existing:
            return existing, None

        section = self._get_or_create_section(section_name, section_cache)
        subsection = Subsection.objects.create(section=section, name=subsection_name)
        subsection_by_pair[(section.name, subsection.name)] = subsection
        subsection_by_name.setdefault(subsection.name, []).append(subsection)
        return subsection, None

    def _format_username_preview(self, usernames, limit=20):
        if not usernames:
            return ''
        preview = ', '.join(usernames[:limit])
        if len(usernames) > limit:
            return f'{preview} ... (+{len(usernames) - limit} more)'
        return preview

    def _resolve_full_name(self, full_name, username):
        full_name = (full_name or '').strip()
        if full_name:
            return full_name
        return (username or '').strip()

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
        pending_user_map = {}

        for idx, row in enumerate(rows):
            row_num = row_start + idx

            normalized_row = {}
            for key, value in (row or {}).items():
                normalized_key = str(key or '').strip().lstrip('\ufeff').lower()
                normalized_row[normalized_key] = '' if value is None else str(value).strip()

            username = normalized_row.get('username', '').strip()
            email = normalized_row.get('email', '').strip()
            password = normalized_row.get('password', '').strip()
            full_name = self._resolve_full_name(
                normalized_row.get('full_name', ''),
                normalized_row.get('username', ''),
            )
            actual_role = normalized_row.get('actual_role', '').strip()
            role = self._normalize_role(normalized_row.get('role', ''))
            section_value = normalized_row.get('section', normalized_row.get('section_name', ''))
            sections_raw = normalized_row.get('sections', section_value).strip()
            subsection_raw = normalized_row.get('subsection', normalized_row.get('subsection_name', '')).strip()
            auditor_subsections_raw = normalized_row.get('auditor_subsections', '').strip()
            section_hint = ''
            if sections_raw:
                section_hint = sections_raw.split(',')[0].strip()

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
                sections_for_dag = [self._get_or_create_section(name, section_cache) for name in section_names]
                sections_for_dag = [section for section in sections_for_dag if section is not None]

            subsection = None
            if role in ['SrAO', 'AAO', 'clerk'] and subsection_raw:
                if not section_hint:
                    results['errors'].append(
                        f'Row {row_num} ({username}): "section" is required when "subsection" is provided'
                    )
                    continue
                subsection, subsection_error = self._get_or_create_subsection(
                    section_hint,
                    subsection_raw,
                    section_cache,
                    subsection_by_pair,
                    subsection_by_name
                )
                if subsection_error:
                    results['errors'].append(f'Row {row_num} ({username}): {subsection_error}')
                    continue

            auditor_subsections = []
            auditor_primary_subsection = None
            if role == 'auditor':
                raw_value = auditor_subsections_raw or subsection_raw
                if raw_value:
                    subsection_tokens = [name.strip() for name in raw_value.split(',') if name.strip()]
                    parsed = []
                    parse_failed = False
                    for token in subsection_tokens:
                        if not section_hint:
                            results['errors'].append(
                                f'Row {row_num} ({username}): "section" is required when importing auditor subsections'
                            )
                            parse_failed = True
                            break
                        parsed_subsection, subsection_error = self._get_or_create_subsection(
                            section_hint,
                            token,
                            section_cache,
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
                    if parsed:
                        auditor_primary_subsection = parsed[0]

            user = User(
                username=username,
                email=email,
                password=make_password(password),
                full_name=full_name,
                role=role,
                actual_role=actual_role or role,
                subsection=(subsection or auditor_primary_subsection),
                is_active=True,
            )
            pending_users.append(user)
            pending_user_map[username] = user
            pending_usernames.add(username)
            pending_emails.add(email)
            dag_section_map[username] = sections_for_dag
            auditor_subsection_map[username] = auditor_subsections

        if not pending_users:
            return results

        created_users = {}
        try:
            with transaction.atomic():
                User.objects.bulk_create(pending_users, batch_size=500)
                created_users = {
                    u.username: u
                    for u in User.objects.filter(username__in=pending_usernames)
                }
        except Exception as bulk_exc:
            results['errors'].append(
                f'Bulk create failed. Falling back to row-wise import: {bulk_exc}'
            )
            for username in pending_usernames:
                user_obj = pending_user_map.get(username)
                if not user_obj:
                    continue
                try:
                    user_obj.save()
                    created_users[username] = user_obj
                except Exception as row_exc:
                    results['errors'].append(
                        f'Row import failed ({username}): {row_exc}'
                    )

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


@admin.register(SignupRequest)
class SignupRequestAdmin(admin.ModelAdmin):
    list_display = [
        'username',
        'email',
        'full_name',
        'requested_role',
        'requested_section',
        'requested_subsection',
        'status',
        'created_at',
        'approved_by',
    ]
    list_filter = ['status', 'requested_role', 'created_at']
    search_fields = ['username', 'email', 'full_name']
    actions = ['approve_requests', 'reject_requests']
    readonly_fields = ['created_at', 'updated_at', 'reviewed_at', 'approved_by', 'processed_user']
    exclude = ['password_hash']

    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    @admin.action(description='Approve selected signup requests')
    def approve_requests(self, request, queryset):
        if not request.user.is_superuser:
            self.message_user(request, 'Only superusers can approve signup requests.', level=messages.ERROR)
            return

        approved_count = 0
        for signup_request in queryset.filter(status='pending'):
            try:
                signup_request.approve(
                    reviewer=request.user,
                    role=signup_request.requested_role,
                    section=signup_request.requested_section,
                    subsection=signup_request.requested_subsection
                )
                approved_count += 1
            except Exception as exc:
                self.message_user(
                    request,
                    f'Could not approve "{signup_request.username}": {exc}',
                    level=messages.ERROR
                )

        if approved_count:
            self.message_user(request, f'Approved {approved_count} signup request(s).', level=messages.SUCCESS)

    @admin.action(description='Reject selected signup requests')
    def reject_requests(self, request, queryset):
        if not request.user.is_superuser:
            self.message_user(request, 'Only superusers can reject signup requests.', level=messages.ERROR)
            return

        rejected_count = 0
        for signup_request in queryset.filter(status='pending'):
            try:
                signup_request.reject(reviewer=request.user)
                rejected_count += 1
            except Exception as exc:
                self.message_user(
                    request,
                    f'Could not reject "{signup_request.username}": {exc}',
                    level=messages.ERROR
                )

        if rejected_count:
            self.message_user(request, f'Rejected {rejected_count} signup request(s).', level=messages.SUCCESS)

    def save_model(self, request, obj, form, change):
        if not request.user.is_superuser:
            self.message_user(request, 'Only superusers can review signup requests.', level=messages.ERROR)
            return

        if obj.status == 'approved' and not obj.processed_user_id:
            obj.approve(
                reviewer=request.user,
                role=obj.requested_role,
                section=obj.requested_section,
                subsection=obj.requested_subsection
            )
            return
        if obj.status == 'rejected' and obj.reviewed_at is None:
            obj.reject(reviewer=request.user)
            return

        super().save_model(request, obj, form, change)


@admin.register(UserImportJob)
class UserImportJobAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'original_filename',
        'file_format',
        'status',
        'created_count',
        'skipped_count',
        'error_count',
        'created_by',
        'created_at',
        'finished_at',
    ]
    list_filter = ['status', 'file_format', 'created_at']
    search_fields = ['original_filename', 'created_by__username', 'created_by__full_name']
    readonly_fields = [
        'original_filename',
        'file_format',
        'payload',
        'status',
        'created_by',
        'created_at',
        'started_at',
        'finished_at',
        'created_count',
        'skipped_count',
        'error_count',
        'summary',
        'failure_message',
    ]

    def has_add_permission(self, request):
        return False
