from rest_framework import serializers
from .models import MailRecord
from users.serializers import UserMinimalSerializer
from sections.serializers import SectionSerializer


class MailRecordListSerializer(serializers.ModelSerializer):
    """Serializer for list view"""
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    current_handler_name = serializers.CharField(source='current_handler.full_name', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True)
    time_in_stage = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = MailRecord
        fields = [
            'id', 'sl_no', 'letter_no', 'mail_reference_subject', 'from_office',
            'assigned_to', 'assigned_to_name', 'current_handler', 'current_handler_name',
            'section', 'section_name', 'due_date', 'status', 'date_of_completion',
            'time_in_stage', 'is_overdue', 'created_at'
        ]
        read_only_fields = ['id', 'sl_no', 'created_at']

    def get_time_in_stage(self, obj):
        return obj.time_in_current_stage()

    def get_is_overdue(self, obj):
        return obj.is_overdue()


class MailRecordDetailSerializer(serializers.ModelSerializer):
    """Serializer for detail view with all fields"""
    assigned_to_details = UserMinimalSerializer(source='assigned_to', read_only=True)
    current_handler_details = UserMinimalSerializer(source='current_handler', read_only=True)
    monitoring_officer_details = UserMinimalSerializer(source='monitoring_officer', read_only=True)
    section_details = SectionSerializer(source='section', read_only=True)
    created_by_details = UserMinimalSerializer(source='created_by', read_only=True)
    time_in_stage = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = MailRecord
        fields = '__all__'
        read_only_fields = ['id', 'sl_no', 'created_at', 'updated_at', 'last_status_change', 'created_by']

    def get_time_in_stage(self, obj):
        return obj.time_in_current_stage()

    def get_is_overdue(self, obj):
        return obj.is_overdue()


class MailRecordCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating mail records"""

    class Meta:
        model = MailRecord
        fields = [
            'letter_no', 'date_received', 'mail_reference_subject', 'from_office',
            'action_required', 'action_required_other', 'section', 'assigned_to',
            'due_date', 'remarks'
        ]

    def validate(self, data):
        # Validate that due_date is not in the past
        from django.utils import timezone
        if data.get('due_date') and data['due_date'] < timezone.now().date():
            raise serializers.ValidationError({
                'due_date': 'Due date cannot be in the past.'
            })

        # Validate action_required_other is provided when action_required is 'Other'
        if data.get('action_required') == 'Other' and not data.get('action_required_other'):
            raise serializers.ValidationError({
                'action_required_other': 'This field is required when action is "Other".'
            })

        return data


class MailRecordUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating mail records (limited fields)"""

    class Meta:
        model = MailRecord
        fields = ['remarks']


class MailRecordReassignSerializer(serializers.Serializer):
    """Serializer for reassigning mail records"""
    new_handler = serializers.IntegerField(required=True)
    remarks = serializers.CharField(required=True, allow_blank=False)


class MailRecordCloseSerializer(serializers.Serializer):
    """Serializer for closing mail records"""
    remarks = serializers.CharField(required=True, allow_blank=False)
