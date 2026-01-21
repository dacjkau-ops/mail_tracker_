from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from config.permissions import MailRecordPermission
from .models import MailRecord
from .serializers import (
    MailRecordListSerializer,
    MailRecordDetailSerializer,
    MailRecordCreateSerializer,
    MailRecordUpdateSerializer,
    MailRecordReassignSerializer,
    MailRecordCloseSerializer
)
from audit.models import AuditTrail
from users.models import User


class MailRecordViewSet(viewsets.ModelViewSet):
    permission_classes = [MailRecordPermission]

    def get_serializer_class(self):
        if self.action == 'list':
            return MailRecordListSerializer
        elif self.action == 'create':
            return MailRecordCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return MailRecordUpdateSerializer
        elif self.action == 'reassign':
            return MailRecordReassignSerializer
        elif self.action == 'close':
            return MailRecordCloseSerializer
        return MailRecordDetailSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = MailRecord.objects.select_related(
            'assigned_to', 'current_handler', 'monitoring_officer',
            'section', 'created_by'
        )

        # AG can see all records
        if user.role == 'AG':
            pass  # No filtering needed

        # DAG can see own section records + records they've touched
        elif user.role == 'DAG':
            # PERFORMANCE FIX: Get all touched record IDs in ONE query upfront
            # instead of checking each record individually
            touched_record_ids = list(AuditTrail.objects.filter(
                performed_by=user
            ).values_list('mail_record_id', flat=True).distinct())

            # Combine: section records OR touched records
            queryset = queryset.filter(
                Q(section=user.section) | Q(id__in=touched_record_ids)
            )

        # Staff officers can see records assigned to them OR they've touched
        else:  # SrAO or AAO
            # PERFORMANCE FIX: Include records they've touched (from audit trail)
            touched_record_ids = list(AuditTrail.objects.filter(
                performed_by=user
            ).values_list('mail_record_id', flat=True).distinct())

            queryset = queryset.filter(
                Q(current_handler=user) | Q(assigned_to=user) | Q(id__in=touched_record_ids)
            )

        # Apply filters
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        section_filter = self.request.query_params.get('section', None)
        if section_filter:
            queryset = queryset.filter(section_id=section_filter)

        overdue_filter = self.request.query_params.get('overdue', None)
        if overdue_filter == 'true':
            queryset = queryset.filter(
                due_date__lt=timezone.now().date()
            ).exclude(status='Closed')

        return queryset.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        """Create new mail record with auto-transitions"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Check permissions - only AG and DAG can create
        user = request.user
        if user.role not in ['AG', 'DAG']:
            return Response(
                {'error': 'You do not have permission to create mail records.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # DAG can only create for their section
        if user.role == 'DAG' and serializer.validated_data['section'] != user.section:
            return Response(
                {'error': 'You can only create mails for your section.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get assigned user and set monitoring officer
        assigned_to = serializer.validated_data['assigned_to']
        monitoring_officer = assigned_to.get_dag()

        # Create the mail record
        mail_record = serializer.save(
            created_by=user,
            current_handler=assigned_to,
            monitoring_officer=monitoring_officer,
            status='Assigned',  # Auto-transition to Assigned
            last_status_change=timezone.now()
        )

        # Create audit trail for creation
        AuditTrail.objects.create(
            mail_record=mail_record,
            action='CREATE',
            performed_by=user,
            new_value={
                'sl_no': mail_record.sl_no,
                'assigned_to': assigned_to.full_name,
                'status': 'Assigned'
            },
            remarks=serializer.validated_data.get('remarks', '')
        )

        # Create audit trail for assignment
        AuditTrail.objects.create(
            mail_record=mail_record,
            action='ASSIGN',
            performed_by=user,
            new_value={'assigned_to': assigned_to.full_name},
            remarks=f"Assigned to {assigned_to.full_name}"
        )

        response_serializer = MailRecordDetailSerializer(mail_record)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Update mail record (only remarks can be updated by current handler)"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # Only current handler can update
        if instance.current_handler != request.user:
            return Response(
                {'error': 'Only the current handler can update this mail.'},
                status=status.HTTP_403_FORBIDDEN
            )

        old_remarks = instance.remarks
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        # Auto-transition to In Progress if not already
        if instance.status == 'Assigned':
            instance.status = 'In Progress'
            instance.last_status_change = timezone.now()

        self.perform_update(serializer)

        # Create audit trail
        AuditTrail.objects.create(
            mail_record=instance,
            action='UPDATE',
            performed_by=request.user,
            old_value={'remarks': old_remarks},
            new_value={'remarks': instance.remarks, 'status': instance.status},
            remarks='Updated remarks'
        )

        response_serializer = MailRecordDetailSerializer(instance)
        return Response(response_serializer.data)

    @action(detail=True, methods=['post'])
    def reassign(self, request, pk=None):
        """Reassign mail to another user"""
        mail_record = self.get_object()
        serializer = MailRecordReassignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_handler_id = serializer.validated_data['new_handler']
        remarks = serializer.validated_data['remarks']

        try:
            new_handler = User.objects.get(id=new_handler_id, is_active=True)
        except User.DoesNotExist:
            return Response(
                {'error': 'Invalid user selected.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check permissions
        user = request.user
        if user.role == 'DAG':
            # DAG can only reassign within their section
            if mail_record.section != user.section:
                return Response(
                    {'error': 'You can only reassign mails within your section.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if new_handler.section != user.section:
                return Response(
                    {'error': 'You can only reassign to users in your section.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif user.role in ['SrAO', 'AAO']:
            # Staff can only reassign if they're current handler
            if mail_record.current_handler != user:
                return Response(
                    {'error': 'You can only reassign mails assigned to you.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Store old handler
        old_handler = mail_record.current_handler

        # Reassign
        mail_record.current_handler = new_handler
        mail_record.status = 'In Progress'  # Auto-transition
        mail_record.last_status_change = timezone.now()
        mail_record.save()

        # Create audit trail
        AuditTrail.objects.create(
            mail_record=mail_record,
            action='REASSIGN',
            performed_by=user,
            old_value={'current_handler': old_handler.full_name},
            new_value={'current_handler': new_handler.full_name, 'status': 'In Progress'},
            remarks=remarks
        )

        response_serializer = MailRecordDetailSerializer(mail_record)
        return Response(response_serializer.data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close mail record"""
        mail_record = self.get_object()
        serializer = MailRecordCloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        remarks = serializer.validated_data['remarks']

        # Check if already closed
        if mail_record.status == 'Closed':
            return Response(
                {'error': 'This mail is already closed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Close the mail
        old_status = mail_record.status
        mail_record.status = 'Closed'
        mail_record.date_of_completion = timezone.now().date()
        mail_record.last_status_change = timezone.now()
        mail_record.remarks = remarks
        mail_record.save()

        # Create audit trail
        AuditTrail.objects.create(
            mail_record=mail_record,
            action='CLOSE',
            performed_by=request.user,
            old_value={'status': old_status},
            new_value={'status': 'Closed', 'date_of_completion': str(mail_record.date_of_completion)},
            remarks=remarks
        )

        response_serializer = MailRecordDetailSerializer(mail_record)
        return Response(response_serializer.data)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        """Reopen closed mail (AG only)"""
        mail_record = self.get_object()

        # Only AG can reopen
        if request.user.role != 'AG':
            return Response(
                {'error': 'Only AG can reopen closed mails.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if mail is closed
        if mail_record.status != 'Closed':
            return Response(
                {'error': 'This mail is not closed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        remarks = request.data.get('remarks', '')
        if not remarks:
            return Response(
                {'error': 'Remarks are required for reopening.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Reopen the mail
        old_status = mail_record.status
        mail_record.status = 'In Progress'
        mail_record.date_of_completion = None
        mail_record.last_status_change = timezone.now()
        mail_record.save()

        # Create audit trail
        AuditTrail.objects.create(
            mail_record=mail_record,
            action='REOPEN',
            performed_by=request.user,
            old_value={'status': old_status},
            new_value={'status': 'In Progress'},
            remarks=remarks
        )

        response_serializer = MailRecordDetailSerializer(mail_record)
        return Response(response_serializer.data)
