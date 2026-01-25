from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from config.permissions import MailRecordPermission
from .models import MailRecord, MailAssignment, AssignmentRemark
from .serializers import (
    MailRecordListSerializer,
    MailRecordDetailSerializer,
    MailRecordCreateSerializer,
    MailRecordUpdateSerializer,
    MailRecordReassignSerializer,
    MailRecordCloseSerializer,
    MailAssignmentSerializer,
    MailAssignmentIsolatedSerializer,
    MultiAssignSerializer,
    AssignmentUpdateSerializer,
    AssignmentCompleteSerializer,
    AddRemarkSerializer,
    AssignmentReassignSerializer,
    AssignmentRemarkSerializer
)
from audit.models import AuditTrail
from users.models import User
from sections.models import Section


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

        # DAG can see own section records + records they've touched + cross-section where their officers are assigned
        elif user.role == 'DAG':
            # PERFORMANCE FIX: Get all touched record IDs in ONE query upfront
            touched_record_ids = list(AuditTrail.objects.filter(
                performed_by=user
            ).values_list('mail_record_id', flat=True).distinct())

            # Get records where user is assigned via parallel assignment
            assigned_via_parallel = list(MailAssignment.objects.filter(
                assigned_to=user,
                status='Active'
            ).values_list('mail_record_id', flat=True).distinct())

            # NEW: Get records where DAG's section officers have assignments (cross-section visibility)
            section_officer_ids = list(User.objects.filter(
                section=user.section, is_active=True
            ).values_list('id', flat=True))
            cross_section_mail_ids = list(MailAssignment.objects.filter(
                assigned_to_id__in=section_officer_ids,
                status__in=['Active', 'Completed']
            ).values_list('mail_record_id', flat=True).distinct())

            # Combine: section records OR touched records OR parallel assignments OR cross-section where officers assigned
            queryset = queryset.filter(
                Q(section=user.section) |
                Q(id__in=touched_record_ids) |
                Q(id__in=assigned_via_parallel) |
                Q(id__in=cross_section_mail_ids)
            )

        # Staff officers can see records assigned to them OR they've touched
        else:  # SrAO or AAO
            # PERFORMANCE FIX: Include records they've touched (from audit trail)
            touched_record_ids = list(AuditTrail.objects.filter(
                performed_by=user
            ).values_list('mail_record_id', flat=True).distinct())
            
            # CRITICAL: Get records where user is assigned via parallel assignment
            assigned_via_parallel = list(MailAssignment.objects.filter(
                assigned_to=user,
                status='Active'
            ).values_list('mail_record_id', flat=True).distinct())

            queryset = queryset.filter(
                Q(current_handler=user) | Q(assigned_to=user) | Q(id__in=touched_record_ids) | Q(id__in=assigned_via_parallel)
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
        """Create new mail record with multi-assignment support"""
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        # Check permissions - only AG and DAG can create
        user = request.user
        if user.role not in ['AG', 'DAG']:
            return Response(
                {'error': 'You do not have permission to create mail records.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get assigned user IDs (now it's a list) - validation already done in serializer
        assigned_to_ids = serializer.validated_data.pop('assigned_to')
        initial_instructions = serializer.validated_data.get('initial_instructions', '')

        # Get assignees
        assignees = list(User.objects.filter(id__in=assigned_to_ids, is_active=True))

        # Set first assignee as primary (for backward compatibility)
        primary_assignee = assignees[0]
        monitoring_officer = primary_assignee.get_dag()

        # Get section from serializer (may be null for cross-section)
        section_id = serializer.validated_data.pop('section', None)
        section = None
        if section_id:
            try:
                section = Section.objects.get(id=section_id)
            except Section.DoesNotExist:
                pass

        # Create the mail record
        mail_record = serializer.save(
            created_by=user,
            assigned_to=primary_assignee,
            current_handler=primary_assignee,
            monitoring_officer=monitoring_officer,
            section=section,  # Can be None for cross-section assignments
            status='Assigned',
            is_multi_assigned=(len(assignees) > 1),
            initial_instructions=initial_instructions,
            last_status_change=timezone.now()
        )

        # Create assignment records for each assignee
        for assignee in assignees:
            MailAssignment.objects.create(
                mail_record=mail_record,
                assigned_to=assignee,
                assigned_by=user,
                assignment_remarks=initial_instructions,
                status='Active'
            )

        # Create audit trail for creation
        AuditTrail.objects.create(
            mail_record=mail_record,
            action='CREATE',
            performed_by=user,
            new_value={'sl_no': mail_record.sl_no, 'status': 'Assigned'},
            remarks=f'Created with initial instructions: {initial_instructions[:100]}'
        )

        # Create audit trail for assignment
        assignee_names = [a.full_name for a in assignees]
        action_type = 'MULTI_ASSIGN' if len(assignees) > 1 else 'ASSIGN'
        AuditTrail.objects.create(
            mail_record=mail_record,
            action=action_type,
            performed_by=user,
            new_value={'assigned_to': assignee_names},
            remarks=f"Assigned to {len(assignees)} officer(s): {', '.join(assignee_names)}"
        )

        response_serializer = MailRecordDetailSerializer(mail_record, context={'request': request})
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

        response_serializer = MailRecordDetailSerializer(instance, context={'request': request})
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
            if mail_record.section and mail_record.section != user.section:
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
            # Staff can only reassign if they're current handler or have an active assignment
            user_assignment = mail_record.parallel_assignments.filter(
                assigned_to=user, status='Active'
            ).first() if mail_record.is_multi_assigned else None
            
            if not user_assignment and mail_record.current_handler != user:
                return Response(
                    {'error': 'You can only reassign mails assigned to you.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Store old handler
        old_handler = mail_record.current_handler

        # For multi-assigned mails: Also update the user's assignment record
        if mail_record.is_multi_assigned:
            user_assignment = mail_record.parallel_assignments.filter(
                assigned_to=user, status='Active'
            ).first()
            
            if user_assignment:
                # Update the assignment with reassignment info
                user_assignment.reassigned_to = new_handler
                user_assignment.reassigned_at = timezone.now()
                user_assignment.save()
                
                # Add to remarks timeline to track the reassignment
                from .models import AssignmentRemark
                AssignmentRemark.objects.create(
                    assignment=user_assignment,
                    content=f"Reassigned to {new_handler.full_name}: {remarks}",
                    created_by=user
                )

        # Reassign at mail level
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

        response_serializer = MailRecordDetailSerializer(mail_record, context={'request': request})
        return Response(response_serializer.data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close mail record"""
        mail_record = self.get_object()
        serializer = MailRecordCloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        remarks = serializer.validated_data['remarks']
        user = request.user

        # Check if already closed
        if mail_record.status == 'Closed':
            return Response(
                {'error': 'This mail is already closed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Multi-assigned mails: only AG can close (after reviewing all responses)
        if mail_record.is_multi_assigned:
            if user.role != 'AG':
                return Response(
                    {'error': 'Only AG can close multi-assigned mails after reviewing all responses.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            # Note pending assignments in remarks if any
            active_count = mail_record.parallel_assignments.filter(status='Active').count()
            if active_count > 0:
                remarks = f"{remarks} [Note: {active_count} assignment(s) still pending at closure]"

        # Single-assigned mails: current handler or AG can close
        else:
            if user.role != 'AG' and mail_record.current_handler != user:
                return Response(
                    {'error': 'Only the current handler or AG can close this mail.'},
                    status=status.HTTP_403_FORBIDDEN
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
            performed_by=user,
            old_value={'status': old_status},
            new_value={'status': 'Closed', 'date_of_completion': str(mail_record.date_of_completion)},
            remarks=remarks
        )

        response_serializer = MailRecordDetailSerializer(mail_record, context={'request': request})
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

        response_serializer = MailRecordDetailSerializer(mail_record, context={'request': request})
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

        response_serializer = MailRecordDetailSerializer(mail_record, context={'request': request})
        return Response(response_serializer.data)

    @action(detail=True, methods=['post'], url_path='assignments/(?P<assignment_id>[^/.]+)/update')
    def update_assignment(self, request, pk=None, assignment_id=None):
        """Allow assignee to update their own remarks"""
        mail_record = self.get_object()
        
        try:
            assignment = MailAssignment.objects.get(
                id=assignment_id,
                mail_record=mail_record,
                assigned_to=request.user,
                status='Active'
            )
        except MailAssignment.DoesNotExist:
            return Response(
                {'error': 'Assignment not found or cannot be edited.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user_remarks = request.data.get('user_remarks', '')
        if not user_remarks:
            return Response(
                {'error': 'Remarks cannot be empty.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        assignment.user_remarks = user_remarks
        assignment.save()
        
        # Update consolidated remarks
        mail_record.update_consolidated_remarks()
        
        # Log in audit trail
        AuditTrail.objects.create(
            mail_record=mail_record,
            action='ASSIGNMENT_UPDATE',
            performed_by=request.user,
            remarks=f"{request.user.full_name}: {user_remarks[:150]}"
        )
        
        return Response(MailAssignmentSerializer(assignment).data)
    
    @action(detail=True, methods=['post'], url_path='assignments/(?P<assignment_id>[^/.]+)/complete')
    def complete_assignment(self, request, pk=None, assignment_id=None):
        """Mark assignment as completed"""
        mail_record = self.get_object()

        try:
            assignment = MailAssignment.objects.get(
                id=assignment_id,
                mail_record=mail_record,
                assigned_to=request.user,
                status='Active'
            )
        except MailAssignment.DoesNotExist:
            return Response(
                {'error': 'Assignment not found or already completed.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if assignee has added any remarks (from timeline or legacy field)
        has_remarks = assignment.remarks_timeline.exists() or assignment.user_remarks
        if not has_remarks:
            return Response(
                {'error': 'Please add remarks before marking as complete.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        assignment.status = 'Completed'
        assignment.completed_at = timezone.now()
        assignment.save()

        # Log completion in audit trail
        AuditTrail.objects.create(
            mail_record=mail_record,
            action='ASSIGNMENT_COMPLETE',
            performed_by=request.user,
            remarks=f'{request.user.full_name} completed their assignment'
        )

        # For multi-assigned mails: DO NOT auto-close. AG must review and close.
        # For single-assigned mails: Still don't auto-close, assignee can close themselves
        # This gives AG visibility to review all responses before closure

        return Response(MailAssignmentSerializer(assignment).data)

    @action(detail=True, methods=['post'], url_path='assignments/(?P<assignment_id>[^/.]+)/add_remark')
    def add_assignment_remark(self, request, pk=None, assignment_id=None):
        """Add a new remark to assignment (append-only, never edit previous)"""
        mail_record = self.get_object()

        try:
            assignment = MailAssignment.objects.get(
                id=assignment_id,
                mail_record=mail_record,
                status='Active'
            )
            # Check if user is the assignee or the current assignee (if reassigned)
            current_assignee = assignment.reassigned_to or assignment.assigned_to
            if current_assignee != request.user:
                return Response(
                    {'error': 'Only the current assignee can add remarks.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        except MailAssignment.DoesNotExist:
            return Response(
                {'error': 'Assignment not found or not active.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = AddRemarkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        content = serializer.validated_data['content']

        # Create new remark entry (append-only)
        AssignmentRemark.objects.create(
            assignment=assignment,
            content=content,
            created_by=request.user
        )

        # Also update user_remarks for backward compatibility
        assignment.user_remarks = content
        assignment.save()

        # Update consolidated remarks on mail record
        mail_record.update_consolidated_remarks()

        # Log in audit
        AuditTrail.objects.create(
            mail_record=mail_record,
            action='ASSIGNMENT_UPDATE',
            performed_by=request.user,
            remarks=f'{request.user.full_name}: {content[:100]}'
        )

        return Response({'status': 'Remark added successfully'})

    @action(detail=True, methods=['post'], url_path='assignments/(?P<assignment_id>[^/.]+)/reassign')
    def reassign_assignment(self, request, pk=None, assignment_id=None):
        """Assignee reassigns their assignment to another officer (same section only for non-AG)"""
        mail_record = self.get_object()
        user = request.user

        try:
            assignment = MailAssignment.objects.get(
                id=assignment_id,
                mail_record=mail_record,
                status='Active'
            )
            # Check if user is the current assignee
            current_assignee = assignment.reassigned_to or assignment.assigned_to
            if current_assignee != user:
                return Response(
                    {'error': 'Only the current assignee can reassign this assignment.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        except MailAssignment.DoesNotExist:
            return Response(
                {'error': 'Assignment not found or not active.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = AssignmentReassignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_assignee_id = serializer.validated_data['new_assignee']
        remarks = serializer.validated_data['remarks']

        try:
            new_assignee = User.objects.get(id=new_assignee_id, is_active=True)
        except User.DoesNotExist:
            return Response(
                {'error': 'Invalid user selected.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # CRITICAL: Same-section only for non-AG users
        if user.role != 'AG':
            if new_assignee.section != user.section:
                return Response(
                    {'error': 'You can only reassign to officers within your section.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Update assignment
        old_assignee = current_assignee
        assignment.reassigned_to = new_assignee
        assignment.reassigned_at = timezone.now()
        assignment.save()

        # Add a remark about the reassignment
        AssignmentRemark.objects.create(
            assignment=assignment,
            content=f'Reassigned to {new_assignee.full_name}: {remarks}',
            created_by=user
        )

        # Audit
        AuditTrail.objects.create(
            mail_record=mail_record,
            action='REASSIGN',
            performed_by=user,
            old_value={'assigned_to': old_assignee.full_name},
            new_value={'assigned_to': new_assignee.full_name},
            remarks=f'Assignment reassigned: {remarks}'
        )

        return Response({'status': 'Assignment reassigned successfully'})

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
