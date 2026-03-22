from datetime import date

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.utils import timezone

from sections.models import Section

from .models import ReturnApplicability, ReturnPeriodEntry


def get_user_visible_sections(user):
    if user.role == 'AG':
        return Section.objects.all().order_by('name')

    if user.role == 'DAG':
        return user.sections.all().order_by('name')

    if user.role == 'auditor':
        section_ids = list(
            user.auditor_subsections.values_list('section_id', flat=True).distinct()
        )
        if section_ids:
            return Section.objects.filter(id__in=section_ids).order_by('name')
        if user.subsection_id:
            return Section.objects.filter(id=user.subsection.section_id).order_by('name')
        return Section.objects.none()

    if user.subsection_id:
        return Section.objects.filter(id=user.subsection.section_id).order_by('name')

    return Section.objects.none()


def get_user_submission_section_ids(user):
    if user.role == 'AAO' and user.subsection_id:
        return {user.subsection.section_id}

    if user.role == 'auditor':
        section_ids = set(user.auditor_subsections.values_list('section_id', flat=True))
        if section_ids:
            return section_ids
        if user.subsection_id:
            return {user.subsection.section_id}

    return set()


def resolve_section_filter(user, section_id=None):
    visible_sections = list(get_user_visible_sections(user))
    visible_ids = {section.id for section in visible_sections}

    if section_id:
        resolved_id = int(section_id)
        if resolved_id not in visible_ids:
            raise PermissionDenied('You do not have access to the requested section.')
        selected_section = next(section for section in visible_sections if section.id == resolved_id)
        return visible_sections, selected_section

    if user.role in {'AG', 'DAG'}:
        return visible_sections, None

    if visible_sections:
        return visible_sections, visible_sections[0]

    return visible_sections, None


def coerce_period(year=None, month=None):
    today = timezone.localdate()
    resolved_year = int(year or today.year)
    resolved_month = int(month or today.month)

    if resolved_month < 1 or resolved_month > 12:
        raise ValueError('Month must be between 1 and 12.')

    return resolved_year, resolved_month


def month_label(year, month):
    return date(year, month, 1).strftime('%B %Y')


def month_sequence(end_year, end_month, count):
    count = max(1, count)
    year = end_year
    month = end_month
    values = []
    for _ in range(count):
        values.append((year, month))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    values.reverse()
    return values


def ensure_period_entries(year, month, section_ids=None):
    applicabilities = ReturnApplicability.objects.select_related(
        'return_definition',
        'section',
    ).filter(
        active=True,
        return_definition__active=True,
    )

    if section_ids:
        applicabilities = applicabilities.filter(section_id__in=section_ids)

    applicable_rows = [
        applicability
        for applicability in applicabilities
        if applicability.applies_to_month(month)
    ]
    if not applicable_rows:
        return 0

    existing_keys = set(
        ReturnPeriodEntry.objects.filter(
            year=year,
            month=month,
            section_id__in=[row.section_id for row in applicable_rows],
            return_definition_id__in=[row.return_definition_id for row in applicable_rows],
        ).values_list('return_definition_id', 'section_id')
    )

    missing_entries = []
    for applicability in applicable_rows:
        key = (applicability.return_definition_id, applicability.section_id)
        if key in existing_keys:
            continue
        missing_entries.append(
            ReturnPeriodEntry(
                return_definition=applicability.return_definition,
                applicability=applicability,
                section=applicability.section,
                year=year,
                month=month,
                report_code_snapshot=applicability.return_definition.code,
                report_name_snapshot=applicability.return_definition.name,
                frequency_snapshot=applicability.return_definition.frequency,
                due_day_snapshot=applicability.due_day,
                due_date=applicability.get_due_date(year, month),
            )
        )

    if not missing_entries:
        return 0

    with transaction.atomic():
        ReturnPeriodEntry.objects.bulk_create(missing_entries, ignore_conflicts=True)

    return len(missing_entries)

