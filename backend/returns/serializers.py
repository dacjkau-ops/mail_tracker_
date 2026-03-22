from rest_framework import serializers

from .models import ReturnPeriodEntry
from .services import get_user_submission_section_ids


class ReturnPeriodEntrySerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by.full_name', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    can_submit = serializers.SerializerMethodField()

    class Meta:
        model = ReturnPeriodEntry
        fields = [
            'id',
            'section',
            'section_name',
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
            'submitted_by_name',
            'delay_days',
            'is_overdue',
            'can_submit',
        ]
        read_only_fields = fields

    def get_can_submit(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        submit_section_ids = self.context.get('submit_section_ids')
        if submit_section_ids is None:
            submit_section_ids = get_user_submission_section_ids(request.user)
        return obj.status == ReturnPeriodEntry.STATUS_PENDING and obj.section_id in submit_section_ids

