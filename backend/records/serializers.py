from rest_framework import serializers
from .models import MailRecord, MailAssignment, AssignmentRemark
from users.serializers import UserMinimalSerializer
from sections.serializers import SectionSerializer


class MailRecordListSerializer(serializers.ModelSerializer):
    """Serializer for list view"""
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    current_handler_name = serializers.CharField(source='current_handler.full_name', read_only=True)
    section_name = serializers.SerializerMethodField()
    time_in_stage = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    def get_section_name(self, obj):
        """Return section name or 'Cross-Section' for null sections"""
        return obj.section.name if obj.section else 'Cross-Section'

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
    assignments = serializers.SerializerMethodField()
    time_in_stage = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    active_assignments_count = serializers.SerializerMethodField()

    class Meta:
        model = MailRecord
        fields = '__all__'
        read_only_fields = ['id', 'sl_no', 'created_at', 'updated_at', 'last_status_change', 'created_by']

    def get_time_in_stage(self, obj):
        return obj.time_in_current_stage()

    def get_is_overdue(self, obj):
        return obj.is_overdue()

    def get_assignments(self, obj):
        """Return assignments based on user role - isolated for assignees, full for supervisors"""
        request = self.context.get('request')
        if not request or not request.user:
            return []

        user = request.user
        assignments = obj.parallel_assignments.all()

        # AG, DAG, or creator sees all assignments
        if user.is_ag() or user.is_dag() or obj.created_by == user:
            return MailAssignmentSerializer(assignments, many=True, context=self.context).data

        # Assignee sees only their own assignment (isolated view)
        own_assignments = assignments.filter(assigned_to=user)
        return MailAssignmentIsolatedSerializer(own_assignments, many=True, context=self.context).data

    def get_active_assignments_count(self, obj):
        return obj.parallel_assignments.filter(status='Active').count()


class MailRecordCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating mail records"""
    assigned_to = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        help_text="List of user IDs to assign (can be single or multiple)"
    )
    initial_instructions = serializers.CharField(required=False, allow_blank=True)
    # Section is now optional - will be auto-detected based on role and assignees
    section = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = MailRecord
        fields = [
            'letter_no', 'date_received', 'mail_reference_subject', 'from_office',
            'action_required', 'action_required_other', 'section', 'assigned_to',
            'due_date', 'initial_instructions'
        ]

    def validate(self, data):
        from django.utils import timezone
        from users.models import User

        # Validate that due_date is not in the past
        if data.get('due_date') and data['due_date'] < timezone.now().date():
            raise serializers.ValidationError({
                'due_date': 'Due date cannot be in the past.'
            })

        # Validate action_required_other is provided when action_required is 'Other'
        if data.get('action_required') == 'Other' and not data.get('action_required_other'):
            raise serializers.ValidationError({
                'action_required_other': 'This field is required when action is "Other".'
            })

        # Get the requesting user for role-based validation
        request = self.context.get('request')
        if request and request.user:
            user = request.user
            assigned_to_ids = data.get('assigned_to', [])

            # Validate assignees exist and are active
            assignees = User.objects.filter(id__in=assigned_to_ids, is_active=True)
            if len(assignees) != len(assigned_to_ids):
                raise serializers.ValidationError({
                    'assigned_to': 'One or more assigned users do not exist or are inactive.'
                })

            # DAG: Must assign within their own section only
            if user.is_dag():
                for assignee in assignees:
                    if assignee.section != user.section:
                        raise serializers.ValidationError({
                            'assigned_to': f'DAG can only assign to officers within their section. {assignee.full_name} is from a different section.'
                        })
                # Auto-set section for DAG
                data['section'] = user.section.id if user.section else None

            # AG: Can assign cross-section
            elif user.is_ag():
                # Check if all assignees are from same section or different sections
                sections = set(a.section_id for a in assignees if a.section_id)
                if len(sections) > 1:
                    # Cross-section assignment - section will be null
                    data['section'] = None
                elif len(sections) == 1:
                    # Single section - keep the section
                    data['section'] = sections.pop()
                # If no sections found, keep as null

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


# Multi-assignment serializers
class MailAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for viewing mail assignments (for supervisors)"""
    assigned_to_details = UserMinimalSerializer(source='assigned_to', read_only=True)
    assigned_by_details = UserMinimalSerializer(source='assigned_by', read_only=True)
    reassigned_to_details = UserMinimalSerializer(source='reassigned_to', read_only=True)
    remarks_timeline = serializers.SerializerMethodField()
    has_responded = serializers.SerializerMethodField()

    class Meta:
        model = MailAssignment
        fields = [
            'id', 'mail_record', 'assigned_to', 'assigned_to_details',
            'assigned_by', 'assigned_by_details', 'assignment_remarks',
            'user_remarks', 'status', 'created_at', 'updated_at', 'completed_at',
            'reassigned_to', 'reassigned_to_details', 'reassigned_at',
            'remarks_timeline', 'has_responded'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'assigned_by']

    def get_remarks_timeline(self, obj):
        """Return the append-only remarks timeline for this assignment"""
        from .models import AssignmentRemark
        remarks = obj.remarks_timeline.all()
        return AssignmentRemarkSerializer(remarks, many=True).data

    def get_has_responded(self, obj):
        """Check if assignee has added any remarks or reassigned"""
        # Reassignment counts as a response
        if obj.reassigned_to is not None:
            return True
        return obj.remarks_timeline.exists() or bool(obj.user_remarks)


class MultiAssignSerializer(serializers.Serializer):
    """Serializer for assigning mail to multiple users"""
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        max_length=10,  # Reasonable limit
        help_text='List of user IDs to assign this mail to'
    )
    remarks = serializers.CharField(
        required=True,
        allow_blank=False,
        help_text='Instructions for all assignees'
    )


class AssignmentUpdateSerializer(serializers.Serializer):
    """Serializer for assignee to update their remarks"""
    remarks = serializers.CharField(required=True, allow_blank=False)


class AssignmentCompleteSerializer(serializers.Serializer):
    """Serializer for assignee to mark their work complete"""
    remarks = serializers.CharField(required=True, allow_blank=False)


class AssignmentRemarkSerializer(serializers.ModelSerializer):
    """Serializer for viewing assignment remarks timeline"""
    created_by_details = UserMinimalSerializer(source='created_by', read_only=True)

    class Meta:
        model = AssignmentRemark
        fields = ['id', 'content', 'created_by', 'created_by_details', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']


class AddRemarkSerializer(serializers.Serializer):
    """Serializer for adding a new remark (append-only)"""
    content = serializers.CharField(required=True, allow_blank=False)


class MailAssignmentIsolatedSerializer(serializers.ModelSerializer):
    """
    Serializer for assignee's isolated view - no peer visibility.
    Shows only the assignee's own assignment with initial instructions.
    """
    initial_instructions = serializers.CharField(
        source='mail_record.initial_instructions',
        read_only=True
    )
    mail_sl_no = serializers.CharField(source='mail_record.sl_no', read_only=True)
    mail_subject = serializers.CharField(source='mail_record.mail_reference_subject', read_only=True)
    remarks_timeline = serializers.SerializerMethodField()

    class Meta:
        model = MailAssignment
        fields = [
            'id', 'mail_record', 'mail_sl_no', 'mail_subject',
            'initial_instructions', 'assignment_remarks', 'remarks_timeline',
            'status', 'created_at', 'completed_at'
        ]
        read_only_fields = ['id', 'mail_record', 'created_at', 'completed_at']

    def get_remarks_timeline(self, obj):
        """Return the append-only remarks timeline for this assignment"""
        return AssignmentRemarkSerializer(obj.remarks_timeline.all(), many=True).data


class AssignmentReassignSerializer(serializers.Serializer):
    """Serializer for assignee to reassign their assignment to another officer"""
    new_assignee = serializers.IntegerField(required=True)
    remarks = serializers.CharField(required=True, allow_blank=False)


class MailAssignmentFullSerializer(serializers.ModelSerializer):
    """
    Full serializer for supervisors to see all assignment details including remarks timeline.
    Used in the tabular audit trail view.
    """
    assigned_to_details = UserMinimalSerializer(source='assigned_to', read_only=True)
    assigned_by_details = UserMinimalSerializer(source='assigned_by', read_only=True)
    reassigned_to_details = UserMinimalSerializer(source='reassigned_to', read_only=True)
    remarks_timeline = serializers.SerializerMethodField()
    has_responded = serializers.SerializerMethodField()

    class Meta:
        model = MailAssignment
        fields = [
            'id', 'mail_record', 'assigned_to', 'assigned_to_details',
            'assigned_by', 'assigned_by_details', 'assignment_remarks',
            'user_remarks', 'status', 'created_at', 'updated_at', 'completed_at',
            'reassigned_to', 'reassigned_to_details', 'reassigned_at',
            'remarks_timeline', 'has_responded'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'assigned_by']

    def get_remarks_timeline(self, obj):
        """Return the append-only remarks timeline for this assignment"""
        return AssignmentRemarkSerializer(obj.remarks_timeline.all(), many=True).data

    def get_has_responded(self, obj):
        """Check if assignee has added any remarks"""
        return obj.remarks_timeline.exists() or bool(obj.user_remarks)
