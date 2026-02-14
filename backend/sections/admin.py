import csv
import json
from io import TextIOWrapper
from django.contrib import admin, messages
from django.shortcuts import render, redirect
from django.urls import path
from django import forms
from .models import Section, Subsection


class ImportSectionsForm(forms.Form):
    """Form for importing sections and subsections from CSV or JSON file"""
    file = forms.FileField(
        label='Select file',
        help_text='CSV or JSON file with section and subsection data'
    )

    def clean_file(self):
        file = self.cleaned_data['file']
        ext = file.name.split('.')[-1].lower()
        if ext not in ['csv', 'json']:
            raise forms.ValidationError('Only CSV and JSON files are supported.')
        return file


class SubsectionInline(admin.TabularInline):
    model = Subsection
    extra = 1
    fields = ['name', 'description']


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ['name', 'directly_under_ag', 'description', 'created_at']
    list_filter = ['directly_under_ag']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at']
    inlines = [SubsectionInline]
    change_list_template = 'admin/sections/section/change_list.html'

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import/', self.admin_site.admin_view(self.import_sections), name='sections_section_import'),
        ]
        return custom_urls + urls

    def import_sections(self, request):
        """Handle section and subsection import from CSV/JSON file"""
        if request.method == 'POST':
            form = ImportSectionsForm(request.POST, request.FILES)
            if form.is_valid():
                file = form.cleaned_data['file']
                ext = file.name.split('.')[-1].lower()

                try:
                    if ext == 'csv':
                        results = self._import_from_csv(file)
                    else:
                        results = self._import_from_json(file)

                    # Show results
                    if results['created_sections']:
                        messages.success(
                            request,
                            f"Successfully created {len(results['created_sections'])} sections: {', '.join(results['created_sections'])}"
                        )
                    if results['created_subsections']:
                        messages.success(
                            request,
                            f"Successfully created {results['created_subsections']} subsections"
                        )
                    if results['errors']:
                        for error in results['errors']:
                            messages.error(request, error)
                    if results['skipped']:
                        messages.warning(
                            request,
                            f"Skipped {len(results['skipped'])} existing sections: {', '.join(results['skipped'])}"
                        )

                except Exception as e:
                    messages.error(request, f'Import failed: {str(e)}')

                return redirect('..')
        else:
            form = ImportSectionsForm()

        context = {
            'form': form,
            'title': 'Import Sections and Subsections',
            'opts': self.model._meta,
            'has_view_permission': self.has_view_permission(request),
        }
        return render(request, 'admin/sections/section/import_sections.html', context)

    def _import_from_csv(self, file):
        """Import sections and subsections from CSV file

        CSV Format:
        section_name, description, directly_under_ag, subsection_name, subsection_description

        Example:
        Admin,Administrative section,true,Admin-1,First admin subsection
        Admin,,,Admin-2,Second admin subsection
        Finance,Finance department,false,Finance-A,Finance subsection A
        """
        results = {'created_sections': [], 'created_subsections': 0, 'errors': [], 'skipped': []}

        # Read CSV file
        text_file = TextIOWrapper(file, encoding='utf-8')
        reader = csv.DictReader(text_file)

        # Validate required columns
        required_columns = ['section_name']
        if not reader.fieldnames:
            raise ValueError('CSV file is empty')

        missing = [col for col in required_columns if col not in reader.fieldnames]
        if missing:
            raise ValueError(f'Missing required columns: {", ".join(missing)}')

        section_cache = {}  # Cache to avoid duplicate section creation

        for row_num, row in enumerate(reader, start=2):
            section_name = row.get('section_name', '').strip()
            description = row.get('description', '').strip()
            directly_under_ag_str = row.get('directly_under_ag', 'false').strip().lower()
            subsection_name = row.get('subsection_name', '').strip()
            subsection_description = row.get('subsection_description', '').strip()

            if not section_name:
                results['errors'].append(f'Row {row_num}: section_name is required')
                continue

            # Parse boolean
            directly_under_ag = directly_under_ag_str in ['true', '1', 'yes', 't']

            # Create or get section
            section = None
            if section_name in section_cache:
                section = section_cache[section_name]
            elif Section.objects.filter(name=section_name).exists():
                section = Section.objects.get(name=section_name)
                section_cache[section_name] = section
                if section_name not in results['skipped']:
                    results['skipped'].append(section_name)
            else:
                try:
                    section = Section.objects.create(
                        name=section_name,
                        description=description or '',
                        directly_under_ag=directly_under_ag
                    )
                    section_cache[section_name] = section
                    results['created_sections'].append(section_name)
                except Exception as e:
                    results['errors'].append(f'Row {row_num}: Failed to create section "{section_name}": {str(e)}')
                    continue

            # Create subsection if specified
            if subsection_name and section:
                if Subsection.objects.filter(section=section, name=subsection_name).exists():
                    # Skip existing subsection
                    pass
                else:
                    try:
                        Subsection.objects.create(
                            section=section,
                            name=subsection_name,
                            description=subsection_description or ''
                        )
                        results['created_subsections'] += 1
                    except Exception as e:
                        results['errors'].append(
                            f'Row {row_num}: Failed to create subsection "{subsection_name}" for section "{section_name}": {str(e)}'
                        )

        return results

    def _import_from_json(self, file):
        """Import sections and subsections from JSON file

        JSON Format:
        [
            {
                "name": "Admin",
                "description": "Administrative section",
                "directly_under_ag": true,
                "subsections": [
                    {"name": "Admin-1", "description": "First admin subsection"},
                    {"name": "Admin-2", "description": "Second admin subsection"}
                ]
            },
            {
                "name": "Finance",
                "description": "Finance department",
                "directly_under_ag": false,
                "subsections": [
                    {"name": "Finance-A", "description": "Finance subsection A"}
                ]
            }
        ]
        """
        results = {'created_sections': [], 'created_subsections': 0, 'errors': [], 'skipped': []}

        # Read JSON file
        content = file.read().decode('utf-8')
        data = json.loads(content)

        if not isinstance(data, list):
            raise ValueError('JSON must be an array of section objects')

        for idx, section_data in enumerate(data, start=1):
            section_name = section_data.get('name', '').strip()
            description = section_data.get('description', '').strip()
            directly_under_ag = section_data.get('directly_under_ag', False)
            subsections_data = section_data.get('subsections', [])

            if not section_name:
                results['errors'].append(f'Item {idx}: "name" is required')
                continue

            # Create or get section
            section = None
            if Section.objects.filter(name=section_name).exists():
                section = Section.objects.get(name=section_name)
                results['skipped'].append(section_name)
            else:
                try:
                    section = Section.objects.create(
                        name=section_name,
                        description=description or '',
                        directly_under_ag=directly_under_ag
                    )
                    results['created_sections'].append(section_name)
                except Exception as e:
                    results['errors'].append(f'Item {idx}: Failed to create section "{section_name}": {str(e)}')
                    continue

            # Create subsections
            if section and isinstance(subsections_data, list):
                for sub_idx, subsection_data in enumerate(subsections_data, start=1):
                    subsection_name = subsection_data.get('name', '').strip()
                    subsection_description = subsection_data.get('description', '').strip()

                    if not subsection_name:
                        results['errors'].append(
                            f'Item {idx}, Subsection {sub_idx}: "name" is required'
                        )
                        continue

                    if Subsection.objects.filter(section=section, name=subsection_name).exists():
                        # Skip existing subsection
                        continue

                    try:
                        Subsection.objects.create(
                            section=section,
                            name=subsection_name,
                            description=subsection_description or ''
                        )
                        results['created_subsections'] += 1
                    except Exception as e:
                        results['errors'].append(
                            f'Item {idx}, Subsection {sub_idx}: Failed to create "{subsection_name}": {str(e)}'
                        )

        return results


@admin.register(Subsection)
class SubsectionAdmin(admin.ModelAdmin):
    list_display = ['name', 'section', 'description', 'created_at']
    list_filter = ['section']
    search_fields = ['name', 'description', 'section__name']
    readonly_fields = ['created_at']
