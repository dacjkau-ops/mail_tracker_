from rest_framework import permissions


class IsAG(permissions.BasePermission):
    """Permission class to check if user is AG"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'AG'


class IsDAG(permissions.BasePermission):
    """Permission class to check if user is DAG"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'DAG'


class IsStaffOfficer(permissions.BasePermission):
    """Permission class to check if user is SrAO or AAO"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['SrAO', 'AAO']


class IsAGOrDAG(permissions.BasePermission):
    """Permission class to check if user is AG or DAG"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['AG', 'DAG']


class MailRecordPermission(permissions.BasePermission):
    """
    Custom permission for MailRecord:
    - AG: Full access to all records
    - DAG: Can view own section records + records they've touched
           Can create/assign/reassign within their section
    - SrAO/AAO: Can view records assigned to them
                Can update/close their assigned records
    """

    def has_permission(self, request, view):
        """Check if user can access the endpoint at all"""
        if not request.user or not request.user.is_authenticated:
            return False

        # All authenticated users can list and retrieve
        if view.action in ['list', 'retrieve']:
            return True

        # Only AG can create
        if view.action == 'create':
            return request.user.role == 'AG'

        # All users can potentially update/close/reassign (checked at object level)
        if view.action in ['update', 'partial_update', 'close', 'reassign', 'reopen']:
            return True

        # Custom actions on detail records - allow authenticated users
        # Object-level permissions and view logic handle authorization
        if view.action in [
            'multi_assign', 'assignments', 'update_assignment',
            'complete_assignment', 'add_assignment_remark',
            'reassign_assignment', 'update_current_action',
            'reassign_candidates',
        ]:
            return True

        return False

    def _can_view_mail(self, user, obj, request):
        """Helper: check if user can view this mail record"""
        if user.role == 'DAG':
            # Check if mail's section is in DAG's managed sections
            if obj.section and user.sections.filter(id=obj.section.id).exists():
                return True
            # Check if DAG has an active parallel assignment
            from records.models import MailAssignment
            if MailAssignment.objects.filter(
                mail_record=obj, assigned_to=user, status='Active'
            ).exists():
                return True
            # Check if any of DAG's section officers have assignments on this mail
            from users.models import User
            dag_section_ids = list(user.sections.values_list('id', flat=True))
            if dag_section_ids:
                section_officer_ids = User.objects.filter(
                    subsection__section_id__in=dag_section_ids, is_active=True
                ).values_list('id', flat=True)
                if MailAssignment.objects.filter(
                    mail_record=obj,
                    assigned_to_id__in=section_officer_ids,
                    status__in=['Active', 'Completed']
                ).exists():
                    return True
            # PERFORMANCE FIX: Use cached touched_record_ids from request if available
            touched_ids = getattr(request, '_touched_record_ids_cache', None)
            if touched_ids is None:
                from audit.models import AuditTrail
                touched_ids = set(AuditTrail.objects.filter(
                    performed_by=user
                ).values_list('mail_record_id', flat=True))
                request._touched_record_ids_cache = touched_ids
            return obj.id in touched_ids

        # Staff officers can view records assigned to them or they've touched
        if user.role in ['SrAO', 'AAO']:
            if obj.current_handler == user or obj.assigned_to == user:
                return True
            # Check parallel assignments
            from records.models import MailAssignment
            if MailAssignment.objects.filter(
                mail_record=obj, assigned_to=user, status='Active'
            ).exists():
                return True
            # PERFORMANCE FIX: Check touched records with caching
            touched_ids = getattr(request, '_touched_record_ids_cache', None)
            if touched_ids is None:
                from audit.models import AuditTrail
                touched_ids = set(AuditTrail.objects.filter(
                    performed_by=user
                ).values_list('mail_record_id', flat=True))
                request._touched_record_ids_cache = touched_ids
            return obj.id in touched_ids

        return False

    def _is_dag_for_section(self, user, obj):
        """Helper: check if DAG manages the mail's section"""
        return user.role == 'DAG' and obj.section and user.sections.filter(id=obj.section.id).exists()

    def has_object_permission(self, request, view, obj):
        """Check if user can perform action on specific mail record"""
        user = request.user

        # AG has full access
        if user.role == 'AG':
            return True

        # View permission (retrieve + read-only custom actions)
        if view.action in ['retrieve', 'assignments']:
            return self._can_view_mail(user, obj, request)

        # Update permission (only remarks)
        if view.action in ['update', 'partial_update']:
            return obj.current_handler == user

        # Update current action status (current handler only)
        if view.action == 'update_current_action':
            return obj.current_handler == user

        # Close permission
        if view.action == 'close':
            return obj.current_handler == user

        # Reassign permission
        if view.action == 'reassign':
            if self._is_dag_for_section(user, obj):
                return True
            return obj.current_handler == user

        if view.action == 'reassign_candidates':
            if self._is_dag_for_section(user, obj):
                return True
            return obj.current_handler == user

        # Multi-assign permission (AG or DAG for their sections)
        if view.action == 'multi_assign':
            return self._is_dag_for_section(user, obj)

        # Reopen permission (only AG - already handled above)
        if view.action == 'reopen':
            return False

        # Assignment-level actions: allow if user can view the mail
        # The view methods do their own fine-grained permission checks
        if view.action in [
            'update_assignment', 'complete_assignment',
            'add_assignment_remark', 'reassign_assignment',
        ]:
            return self._can_view_mail(user, obj, request)

        return False
