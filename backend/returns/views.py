from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.db.models import Avg, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import ReturnPeriodEntry
from .serializers import ReturnPeriodEntrySerializer
from .services import (
    coerce_period,
    ensure_period_entries,
    get_user_submission_section_ids,
    month_label,
    month_sequence,
    resolve_section_filter,
)


class ReturnEntryViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def _parse_period(self, request):
        try:
            return coerce_period(
                year=request.query_params.get('year'),
                month=request.query_params.get('month'),
            )
        except ValueError as exc:
            raise ValidationError(str(exc))

    def _resolve_sections(self, request):
        section_param = request.query_params.get('section')
        try:
            return resolve_section_filter(request.user, section_param or None)
        except PermissionDenied as exc:
            raise ValidationError(str(exc))

    def _base_queryset(self, request, year, month, selected_section=None):
        visible_sections, _ = self._resolve_sections(request)
        visible_section_ids = [section.id for section in visible_sections]
        ensure_period_entries(year, month, visible_section_ids)

        queryset = ReturnPeriodEntry.objects.select_related(
            'section',
            'return_definition',
            'submitted_by',
        ).filter(
            section_id__in=visible_section_ids,
            year=year,
            month=month,
        )

        if selected_section:
            queryset = queryset.filter(section=selected_section)

        return queryset

    def list(self, request):
        year, month = self._parse_period(request)
        visible_sections, selected_section = self._resolve_sections(request)
        visible_section_ids = [section.id for section in visible_sections]
        ensure_period_entries(year, month, visible_section_ids)

        scoped_queryset = self._base_queryset(request, year, month, selected_section=selected_section)
        pending_queryset = scoped_queryset.filter(status=ReturnPeriodEntry.STATUS_PENDING).order_by(
            'due_date',
            'report_name_snapshot',
        )

        serializer = ReturnPeriodEntrySerializer(
            pending_queryset,
            many=True,
            context={
                'request': request,
                'submit_section_ids': get_user_submission_section_ids(request.user),
            },
        )

        section_overview = []
        if request.user.role in {'AG', 'DAG'}:
            section_queryset = ReturnPeriodEntry.objects.filter(
                section_id__in=visible_section_ids,
                year=year,
                month=month,
            )
            for section in visible_sections:
                section_rows = section_queryset.filter(section=section)
                total_count = section_rows.count()
                if total_count == 0:
                    continue
                section_overview.append(
                    {
                        'section': section.id,
                        'section_name': section.name,
                        'total_count': total_count,
                        'pending_count': section_rows.filter(status=ReturnPeriodEntry.STATUS_PENDING).count(),
                        'submitted_count': section_rows.filter(status=ReturnPeriodEntry.STATUS_SUBMITTED).count(),
                        'overdue_count': section_rows.filter(
                            status=ReturnPeriodEntry.STATUS_PENDING,
                            due_date__lt=timezone.localdate(),
                        ).count(),
                    }
                )

        return Response(
            {
                'year': year,
                'month': month,
                'month_label': month_label(year, month),
                'entries': serializer.data,
                'summary': {
                    'total_count': scoped_queryset.count(),
                    'pending_count': pending_queryset.count(),
                    'submitted_count': scoped_queryset.filter(status=ReturnPeriodEntry.STATUS_SUBMITTED).count(),
                    'overdue_count': scoped_queryset.filter(
                        status=ReturnPeriodEntry.STATUS_PENDING,
                        due_date__lt=timezone.localdate(),
                    ).count(),
                },
                'available_sections': [{'id': section.id, 'name': section.name} for section in visible_sections],
                'selected_section': (
                    {'id': selected_section.id, 'name': selected_section.name}
                    if selected_section
                    else None
                ),
                'section_overview': section_overview,
                'can_submit': request.user.role in {'AAO', 'auditor'},
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['get'])
    def history(self, request):
        year, month = self._parse_period(request)
        visible_sections, selected_section = self._resolve_sections(request)
        visible_section_ids = [section.id for section in visible_sections]
        ensure_period_entries(year, month, visible_section_ids)

        queryset = self._base_queryset(request, year, month, selected_section=selected_section).order_by(
            'due_date',
            'report_name_snapshot',
        )
        serializer = ReturnPeriodEntrySerializer(
            queryset,
            many=True,
            context={
                'request': request,
                'submit_section_ids': get_user_submission_section_ids(request.user),
            },
        )

        return Response(
            {
                'year': year,
                'month': month,
                'month_label': month_label(year, month),
                'entries': serializer.data,
                'summary': {
                    'total_count': queryset.count(),
                    'pending_count': queryset.filter(status=ReturnPeriodEntry.STATUS_PENDING).count(),
                    'submitted_count': queryset.filter(status=ReturnPeriodEntry.STATUS_SUBMITTED).count(),
                },
                'available_sections': [{'id': section.id, 'name': section.name} for section in visible_sections],
                'selected_section': (
                    {'id': selected_section.id, 'name': selected_section.name}
                    if selected_section
                    else None
                ),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['get'], url_path='delay-summary')
    def delay_summary(self, request):
        try:
            months_requested = int(request.query_params.get('months', 6))
        except (TypeError, ValueError):
            raise ValidationError('Months must be a valid integer.')

        months_requested = max(1, min(months_requested, 24))
        year, month = self._parse_period(request)
        visible_sections, selected_section = self._resolve_sections(request)
        visible_section_ids = [section.id for section in visible_sections]
        target_section_ids = [selected_section.id] if selected_section else visible_section_ids

        points = []
        total_entries = 0
        total_submitted = 0
        total_delayed = 0
        total_delay_days = 0
        total_delayed_entries = 0

        for period_year, period_month in month_sequence(year, month, months_requested):
            ensure_period_entries(period_year, period_month, target_section_ids)
            queryset = ReturnPeriodEntry.objects.filter(
                section_id__in=target_section_ids,
                year=period_year,
                month=period_month,
            )

            average_delay = queryset.filter(delay_days__gt=0).aggregate(value=Avg('delay_days'))['value'] or 0
            delayed_count = queryset.filter(delay_days__gt=0).count()
            delay_days_total = queryset.filter(delay_days__gt=0).aggregate(value=Sum('delay_days'))['value'] or 0

            points.append(
                {
                    'year': period_year,
                    'month': period_month,
                    'label': month_label(period_year, period_month),
                    'total_count': queryset.count(),
                    'submitted_count': queryset.filter(status=ReturnPeriodEntry.STATUS_SUBMITTED).count(),
                    'pending_count': queryset.filter(status=ReturnPeriodEntry.STATUS_PENDING).count(),
                    'delayed_count': delayed_count,
                    'average_delay_days': round(average_delay, 2),
                }
            )

            total_entries += queryset.count()
            total_submitted += queryset.filter(status=ReturnPeriodEntry.STATUS_SUBMITTED).count()
            total_delayed += delayed_count
            total_delay_days += delay_days_total
            total_delayed_entries += delayed_count

        return Response(
            {
                'months_requested': months_requested,
                'end_period': {
                    'year': year,
                    'month': month,
                    'label': month_label(year, month),
                },
                'selected_section': (
                    {'id': selected_section.id, 'name': selected_section.name}
                    if selected_section
                    else None
                ),
                'points': points,
                'summary': {
                    'total_entries': total_entries,
                    'total_submitted': total_submitted,
                    'total_delayed': total_delayed,
                    'average_delay_days': round(total_delay_days / total_delayed_entries, 2) if total_delayed_entries else 0,
                },
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        try:
            entry = ReturnPeriodEntry.objects.select_related('section').get(pk=pk)
        except ReturnPeriodEntry.DoesNotExist:
            return Response({'error': 'Return entry not found.'}, status=status.HTTP_404_NOT_FOUND)

        visible_sections, _ = resolve_section_filter(request.user)
        if entry.section_id not in {section.id for section in visible_sections}:
            return Response({'error': 'You do not have access to this return entry.'}, status=status.HTTP_403_FORBIDDEN)

        submit_section_ids = get_user_submission_section_ids(request.user)
        if entry.section_id not in submit_section_ids:
            return Response(
                {'error': 'Only AAO and auditor users in the target section can mark a return as submitted.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            entry.mark_submitted(request.user)
        except DjangoValidationError as exc:
            return Response({'error': exc.message}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ReturnPeriodEntrySerializer(
            entry,
            context={'request': request, 'submit_section_ids': submit_section_ids},
        )
        return Response(serializer.data, status=status.HTTP_200_OK)
