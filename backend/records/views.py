from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from config.permissions import MailRecordPermission
from .models import MailRecord, MailAssignment
from .serializers import (
    MailRecordListSerializer,
    MailRecordDetailSerializer,
    MailRecordCreateSerializer,
    MailRecordUpdateSerializer,
    MailRecordReassignSerializer,
    MailRecordCloseSerializer,
    MailAssignmentSerializer,
    MultiAssignSerializer,
    AssignmentUpdateSerializer,
    AssignmentCompleteSerializer
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

    @action(detail=True, methods=['post'])
    def multi_assign(self, request, pk=None):
        """Assign mail to multiple users in parallel"""
        mail_record = self.get_object()
        serializer = MultiAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_ids = serializer.validated_data['user_ids']
        remarks = serializer.validated_data['remarks']

        # Permission check: only AG and DAG can multi-assign
        user = request.user
        if user.role not in ['AG', 'DAG']:
            return Response(
                {'error': 'Only AG/DAG can assign to multiple persons.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # DAG can only assign within their section
        if user.role == 'DAG' and mail_record.section != user.section:
            return Response(
                {'error': 'You can only assign mails within your section.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Validate all users exist and are active
        users = User.objects.filter(id__in=user_ids, is_active=True)
        if users.count() != len(user_ids):
            return Response(
                {'error': 'One or more invalid users selected.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # For DAG, validate all users are in their section
        if user.role == 'DAG':
            for u in users:
                if u.section != user.section:
                    return Response(
                        {'error': f'{u.full_name} is not in your section.'},
                        status=status.HTTP_403_FORBIDDEN
                    )

        # Create assignments
        created_assignments = []
        for u in users:
            assignment, created = MailAssignment.objects.get_or_create(
                mail_record=mail_record,
                assigned_to=u,
                status='Active',
                defaults={
                    'assigned_by': user,
                    'assignment_remarks': remarks
                }
            )
            if created:
                created_assignments.append(assignment)
                # Audit trail for each assignment
                AuditTrail.objects.create(
                    mail_record=mail_record,
                    action='MULTI_ASSIGN',
                    performed_by=user,
                    new_value={'assigned_to': u.full_name},
                    remarks=f"Assigned to {u.full_name}: {remarks}"
                )

        # Update mail record flags
        mail_record.is_multi_assigned = True
        mail_record.status = 'In Progress'
        mail_record.last_status_change = timezone.now()
        mail_record.save()

        response_serializer = MailRecordDetailSerializer(mail_record)
        return Response(response_serializer.data)

    @action(detail=True, methods=['get'])
    def assignments(self, request, pk=None):
        """Get all parallel assignments for a mail"""
        mail_record = self.get_object()
        assignments = mail_record.parallel_assignments.all()
        return Response(MailAssignmentSerializer(assignments, many=True).data)


class MailAssignmentViewSet(viewsets.ModelViewSet):
    """ViewSet for parallel assignment operations"""
    serializer_class = MailAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'AG':
            return MailAssignment.objects.all()
        elif user.role == 'DAG':
            return MailAssignment.objects.filter(
                Q(mail_record__section=user.section) |
                Q(assigned_to=user) |
                Q(assigned_by=user)
            )
        else:
            return MailAssignment.objects.filter(assigned_to=user)

    @action(detail=True, methods=['post'])
    def update_remarks(self, request, pk=None):
        """Assignee updates their remarks"""
        assignment = self.get_object()

        # Only the assignee can update their remarks
        if assignment.assigned_to != request.user:
            return Response(
                {'error': 'Only the assignee can update remarks.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if assignment.status != 'Active':
            return Response(
                {'error': 'Cannot update completed/revoked assignment.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = AssignmentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assignment.user_remarks = serializer.validated_data['remarks']
        assignment.save()

        # Update consolidated remarks on mail record
        assignment.mail_record.update_consolidated_remarks()

        # Audit trail
        AuditTrail.objects.create(
            mail_record=assignment.mail_record,
            action='ASSIGNMENT_UPDATE',
            performed_by=request.user,
            new_value={'remarks': assignment.user_remarks},
            remarks=f"{request.user.full_name} updated remarks"
        )

        return Response(MailAssignmentSerializer(assignment).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Assignee marks their work as complete"""
        assignment = self.get_object()

        if assignment.assigned_to != request.user:
            return Response(
                {'error': 'Only the assignee can mark as complete.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if assignment.status != 'Active':
            return Response(
                {'error': 'Assignment already completed/revoked.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = AssignmentCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assignment.user_remarks = serializer.validated_data['remarks']
        assignment.status = 'Completed'
        assignment.completed_at = timezone.now()
        assignment.save()

        # Update consolidated remarks
        assignment.mail_record.update_consolidated_remarks()

        # Audit trail
        AuditTrail.objects.create(
            mail_record=assignment.mail_record,
            action='ASSIGNMENT_COMPLETE',
            performed_by=request.user,
            remarks=f"{request.user.full_name} completed: {assignment.user_remarks}"
        )

        return Response(MailAssignmentSerializer(assignment).data)

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Supervisor revokes an assignment"""
        assignment = self.get_object()

        # Only AG or the assigning supervisor can revoke
        if request.user.role == 'AG':
            pass  # AG can revoke any
        elif request.user == assignment.assigned_by:
            pass  # Assigner can revoke
        else:
            return Response(
                {'error': 'Only AG or the assigning supervisor can revoke.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if assignment.status != 'Active':
            return Response(
                {'error': 'Assignment not active.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        remarks = request.data.get('remarks', '')
        if not remarks:
            return Response(
                {'error': 'Remarks required for revocation.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        assignment.status = 'Revoked'
        assignment.save()

        # Update consolidated remarks
        assignment.mail_record.update_consolidated_remarks()

        # Audit trail
        AuditTrail.objects.create(
            mail_record=assignment.mail_record,
            action='ASSIGNMENT_REVOKE',
            performed_by=request.user,
            remarks=f"Revoked assignment to {assignment.assigned_to.full_name}: {remarks}"
        )

        return Response(MailAssignmentSerializer(assignment).data)
