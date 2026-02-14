import csv
import json
from io import TextIOWrapper
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.shortcuts import render, redirect
from django.urls import path
from django import forms
from .models import User
from sections.models import Section, Subsection


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
    list_display = ['username', 'full_name', 'email', 'role', 'get_sections_display', 'subsection', 'is_active']
    list_filter = ['role', 'is_active']
    search_fields = ['username', 'full_name', 'email']
    filter_horizontal = ['sections']  # For ManyToMany field
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Additional Info', {'fields': ('role', 'sections', 'subsection', 'full_name')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Additional Info', {'fields': ('role', 'sections', 'subsection', 'full_name', 'email')}),
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
                        messages.success(
                            request,
                            f"Successfully created {len(results['created'])} users: {', '.join(results['created'])}"
                        )
                    if results['errors']:
                        for error in results['errors']:
                            messages.error(request, error)
                    if results['skipped']:
                        messages.warning(
                            request,
                            f"Skipped {len(results['skipped'])} existing users: {', '.join(results['skipped'])}"
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

    def _import_from_csv(self, file):
        """Import users from CSV file"""
        results = {'created': [], 'errors': [], 'skipped': []}

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

        for row_num, row in enumerate(reader, start=2):
            result = self._create_user_from_row(row, row_num)
            if result['status'] == 'created':
                results['created'].append(result['username'])
            elif result['status'] == 'skipped':
                results['skipped'].append(result['username'])
            elif result['status'] == 'error':
                results['errors'].append(result['message'])

        return results

    def _import_from_json(self, file):
        """Import users from JSON file"""
        results = {'created': [], 'errors': [], 'skipped': []}

        # Read JSON file
        content = file.read().decode('utf-8')
        data = json.loads(content)

        if not isinstance(data, list):
            raise ValueError('JSON must be an array of user objects')

        for idx, row in enumerate(data, start=1):
            result = self._create_user_from_row(row, idx)
            if result['status'] == 'created':
                results['created'].append(result['username'])
            elif result['status'] == 'skipped':
                results['skipped'].append(result['username'])
            elif result['status'] == 'error':
                results['errors'].append(result['message'])

        return results

    def _create_user_from_row(self, row, row_num):
        """Create a single user from row data"""
        username = row.get('username', '').strip()
        email = row.get('email', '').strip()
        password = row.get('password', '').strip()
        full_name = row.get('full_name', '').strip()
        role = row.get('role', '').strip()
        sections_str = row.get('sections', '').strip()  # Comma-separated for DAG
        subsection_name = row.get('subsection', '').strip()  # For SrAO/AAO

        # Validate required fields
        if not all([username, email, password, full_name, role]):
            return {
                'status': 'error',
                'message': f'Row {row_num}: Missing required fields (username, email, password, full_name, role)'
            }

        # Validate role
        valid_roles = ['AG', 'DAG', 'SrAO', 'AAO']
        if role not in valid_roles:
            return {
                'status': 'error',
                'message': f'Row {row_num} ({username}): Invalid role "{role}". Must be one of: {", ".join(valid_roles)}'
            }

        # Check if user already exists
        if User.objects.filter(username=username).exists():
            return {'status': 'skipped', 'username': username}

        # Get sections for DAG (ManyToMany)
        sections_list = []
        if role == 'DAG' and sections_str:
            section_names = [s.strip() for s in sections_str.split(',')]
            for section_name in section_names:
                try:
                    section = Section.objects.get(name=section_name)
                    sections_list.append(section)
                except Section.DoesNotExist:
                    return {
                        'status': 'error',
                        'message': f'Row {row_num} ({username}): Section "{section_name}" does not exist'
                    }

        # Get subsection for SrAO/AAO
        subsection = None
        if role in ['SRAO', 'AAO'] and subsection_name:
            # Expected format: "Section Name - Subsection Name"
            if ' - ' in subsection_name:
                section_name, sub_name = subsection_name.split(' - ', 1)
                section_name = section_name.strip()
                sub_name = sub_name.strip()
                try:
                    section = Section.objects.get(name=section_name)
                    subsection = Subsection.objects.get(section=section, name=sub_name)
                except (Section.DoesNotExist, Subsection.DoesNotExist):
                    return {
                        'status': 'error',
                        'message': f'Row {row_num} ({username}): Subsection "{subsection_name}" does not exist'
                    }
            else:
                # Try to find subsection by name only (assuming unique)
                try:
                    subsection = Subsection.objects.get(name=subsection_name)
                except Subsection.DoesNotExist:
                    return {
                        'status': 'error',
                        'message': f'Row {row_num} ({username}): Subsection "{subsection_name}" does not exist'
                    }
                except Subsection.MultipleObjectsReturned:
                    return {
                        'status': 'error',
                        'message': f'Row {row_num} ({username}): Multiple subsections named "{subsection_name}" found. Use format: "Section - Subsection"'
                    }

        # Create user
        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                full_name=full_name,
                role=role,
                subsection=subsection,
            )
            # Add sections for DAG (ManyToMany)
            if sections_list:
                user.sections.set(sections_list)

            return {'status': 'created', 'username': username}
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Row {row_num} ({username}): {str(e)}'
            }
