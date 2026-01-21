from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import AuditTrail
from .serializers import AuditTrailSerializer


class AuditTrailViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for audit trails"""
    serializer_class = AuditTrailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = AuditTrail.objects.select_related(
            'mail_record', 'performed_by'
        )

        # Filter by mail record if specified
        mail_record_id = self.request.query_params.get('mail_record', None)
        if mail_record_id:
            queryset = queryset.filter(mail_record_id=mail_record_id)

        return queryset.order_by('-timestamp')
