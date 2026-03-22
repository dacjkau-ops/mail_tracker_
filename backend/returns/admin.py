import csv
from io import TextIOWrapper

from django import forms
from django.contrib import admin, messages
from django.shortcuts import redirect, render
from django.urls import path

from sections.models import Section

from .models import ReturnApplicability, ReturnDefinition, ReturnPeriodEntry, ReturnStatusLog


class ImportReturnsForm(forms.Form):
    file = forms.FileField(
        label='Select file',
        help_text='CSV file with return master data.',
    )

    def clean_file(self):
        file = self.cleaned_data['file']
        ext = file.name.split('.')[-1].lower()
        if ext != 'csv':
            raise forms.ValidationError('Only CSV files are supported.')
        return file


class ReturnApplicabilityInline(admin.TabularInline):
    model = ReturnApplicability
    extra = 0
    fields = ['section', 'due_day', 'applicable_months', 'active']


@admin.register(ReturnDefinition)
class ReturnDefinitionAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'frequency', 'active', 'applicability_count', 'updated_at']
    list_filter = ['frequency', 'active']
    search_fields = ['code', 'name', 'description']
    inlines = [ReturnApplicabilityInline]
    change_list_template = 'admin/returns/returndefinition/change_list.html'

    def applicability_count(self, obj):
        return obj.applicabilities.count()

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import/', self.admin_site.admin_view(self.import_returns), name='returns_returndefinition_import'),
        ]
        return custom_urls + urls

    def import_returns(self, request):
        if request.method == 'POST':
            form = ImportReturnsForm(request.POST, request.FILES)
            if form.is_valid():
                try:
                    results = self._import_from_csv(form.cleaned_data['file'])

                    if results['definitions_created']:
                        messages.success(
                            request,
                            f"Created {results['definitions_created']} return definition(s).",
                        )
                    if results['definitions_updated']:
                        messages.success(
                            request,
                            f"Updated {results['definitions_updated']} return definition(s).",
                        )
                    if results['applicabilities_created']:
                        messages.success(
                            request,
                            f"Created {results['applicabilities_created']} section mapping(s).",
                        )
                    if results['applicabilities_updated']:
                        messages.success(
                            request,
                            f"Updated {results['applicabilities_updated']} section mapping(s).",
                        )
                    for error in results['errors']:
                        messages.error(request, error)
                except Exception as exc:
                    messages.error(request, f'Import failed: {exc}')
                return redirect('..')
        else:
            form = ImportReturnsForm()

        context = {
            'form': form,
            'title': 'Import Calendar of Returns Master',
            'opts': self.model._meta,
            'has_view_permission': self.has_view_permission(request),
        }
        return render(request, 'admin/returns/returndefinition/import_returns.html', context)

    def _import_from_csv(self, file):
        results = {
            'definitions_created': 0,
            'definitions_updated': 0,
            'applicabilities_created': 0,
            'applicabilities_updated': 0,
            'errors': [],
        }

        text_file = TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(text_file)
        required_columns = ['report_code', 'report_name', 'frequency', 'section_name', 'due_day']
        if not reader.fieldnames:
            raise ValueError('CSV file is empty.')

        normalized_fields = {str(name).strip().lower() for name in reader.fieldnames if name}
        missing = [column for column in required_columns if column not in normalized_fields]
        if missing:
            raise ValueError(f"Missing required columns: {', '.join(missing)}")

        all_sections = list(Section.objects.all().order_by('name'))
        all_sections_map = {section.name.strip().lower(): section for section in all_sections}
        if not all_sections:
            raise ValueError('No sections exist. Import sections before importing returns.')

        for row_num, row in enumerate(reader, start=2):
            normalized = {
                str(key or '').strip().lower(): '' if value is None else str(value).strip()
                for key, value in (row or {}).items()
            }
            code = normalized.get('report_code', '').upper()
            name = normalized.get('report_name', '')
            frequency = normalized.get('frequency', '').lower()
            section_name = normalized.get('section_name', '')
            due_day_raw = normalized.get('due_day', '')
            applicable_months_raw = normalized.get('applicable_months', '')
            active_raw = normalized.get('active', 'true').lower()
            description = normalized.get('description', '')

            if not all([code, name, frequency, section_name, due_day_raw]):
                results['errors'].append(
                    f'Row {row_num}: report_code, report_name, frequency, section_name, and due_day are required.'
                )
                continue

            if frequency not in {'monthly', 'quarterly', 'annual'}:
                results['errors'].append(
                    f'Row {row_num} ({code}): frequency must be monthly, quarterly, or annual.'
                )
                continue

            try:
                due_day = int(due_day_raw)
            except ValueError:
                results['errors'].append(f'Row {row_num} ({code}): due_day must be a number.')
                continue

            try:
                if applicable_months_raw:
                    applicable_months = [int(token.strip()) for token in applicable_months_raw.split(',') if token.strip()]
                else:
                    applicable_months = []
            except ValueError:
                results['errors'].append(f'Row {row_num} ({code}): applicable_months must contain valid month numbers.')
                continue

            active = active_raw in {'1', 'true', 'yes', 'y'}

            definition, created = ReturnDefinition.objects.update_or_create(
                code=code,
                defaults={
                    'name': name,
                    'description': description,
                    'frequency': frequency,
                    'active': active,
                },
            )
            if created:
                results['definitions_created'] += 1
            else:
                results['definitions_updated'] += 1

            if section_name.upper() == 'ALL':
                target_sections = all_sections
            else:
                section = all_sections_map.get(section_name.strip().lower())
                if not section:
                    results['errors'].append(
                        f'Row {row_num} ({code}): section "{section_name}" does not exist.'
                    )
                    continue
                target_sections = [section]

            for section in target_sections:
                try:
                    _, applicability_created = ReturnApplicability.objects.update_or_create(
                        return_definition=definition,
                        section=section,
                        defaults={
                            'due_day': due_day,
                            'applicable_months': applicable_months,
                            'active': active,
                        },
                    )
                except Exception as exc:
                    results['errors'].append(
                        f'Row {row_num} ({code}): could not save mapping for section "{section.name}": {exc}'
                    )
                    continue
                if applicability_created:
                    results['applicabilities_created'] += 1
                else:
                    results['applicabilities_updated'] += 1

        return results


@admin.register(ReturnApplicability)
class ReturnApplicabilityAdmin(admin.ModelAdmin):
    list_display = ['return_definition', 'section', 'due_day', 'applicable_months', 'active']
    list_filter = ['active', 'return_definition__frequency', 'section']
    search_fields = ['return_definition__code', 'return_definition__name', 'section__name']


@admin.register(ReturnPeriodEntry)
class ReturnPeriodEntryAdmin(admin.ModelAdmin):
    list_display = [
        'report_code_snapshot',
        'report_name_snapshot',
        'section',
        'year',
        'month',
        'due_date',
        'status',
        'submitted_at',
        'submitted_by',
        'delay_days',
    ]
    list_filter = ['status', 'frequency_snapshot', 'section', 'year', 'month']
    search_fields = ['report_code_snapshot', 'report_name_snapshot', 'section__name']
    readonly_fields = [
        'return_definition',
        'applicability',
        'section',
        'year',
        'month',
        'report_code_snapshot',
        'report_name_snapshot',
        'frequency_snapshot',
        'due_day_snapshot',
        'due_date',
        'status',
        'submitted_at',
        'submitted_by',
        'delay_days',
        'created_at',
        'updated_at',
    ]

    def has_add_permission(self, request):
        return False


@admin.register(ReturnStatusLog)
class ReturnStatusLogAdmin(admin.ModelAdmin):
    list_display = ['entry', 'action', 'performed_by', 'performed_at']
    list_filter = ['action', 'performed_at']
    search_fields = ['entry__report_code_snapshot', 'entry__report_name_snapshot', 'performed_by__full_name']
    readonly_fields = ['entry', 'action', 'performed_by', 'performed_at', 'metadata']

    def has_add_permission(self, request):
        return False
