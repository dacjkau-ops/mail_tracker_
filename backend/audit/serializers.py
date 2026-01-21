from rest_framework import serializers
from .models import AuditTrail
from users.serializers import UserMinimalSerializer


class AuditTrailSerializer(serializers.ModelSerializer):
    performed_by_details = UserMinimalSerializer(source='performed_by', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditTrail
        fields = [
            'id', 'mail_record', 'action', 'action_display',
            'performed_by', 'performed_by_details', 'timestamp',
            'old_value', 'new_value', 'remarks'
        ]
        read_only_fields = fields
