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
    Custom permission for MailRecord supporting all six roles:
    - AG: Full access to all records
    - DAG: Can view own section records + records they've touched
           Can create/assign/reassign within their section
    - SrAO/AAO: Can view all mails in their subsection + records they've touched
                Can update/close their assigned records
    - auditor: Can view mails in their configured auditor_subsections only
               Can reassign only to SrAO/AAO
    - clerk: Can view only mails assigned to them or created by them
             Can update/close mails they are current_handler for

    Note on view-level guards (these remain in views.py, not in this class):
    - multi_assign: blocked for auditor/clerk via `if user.role not in ['AG', 'DAG']` guard
    - reopen: blocked for auditor/clerk via `if request.user.role != 'AG'` guard
    - close of multi-assigned mails: blocked for auditor/clerk via
      `if mail_record.is_multi_assigned and user.role != 'AG'` guard
    """

    def has_permission(self, request, view):
        """Check if user can access the endpoint at all"""
        if not request.user or not request.user.is_authenticated:
            return False

        # All authenticated users can list and retrieve
        if view.action in ['list', 'retrieve']:
            return True

        # All authenticated users can create (view enforces role-based scoping)
        if view.action == 'create':
            return True

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
            'upload_pdf', 'get_pdf_metadata', 'view_pdf',  # PDF endpoints
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

        # SrAO/AAO: subsection-level visibility (expanded from assigned-only)
        if user.role in ['SrAO', 'AAO']:
            # All mails in user's own subsection
            if user.subsection_id and obj.subsection_id == user.subsection_id:
                return True
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

        # Clerk: narrow — only mails assigned to them or created by them
        if user.role == 'clerk':
            if obj.current_handler == user or obj.assigned_to == user:
                return True
            if obj.created_by_id == user.id:
                return True
            from records.models import MailAssignment
            if MailAssignment.objects.filter(
                mail_record=obj, assigned_to=user, status='Active'
            ).exists():
                return True
            return False

        # Auditor: only mails in their configured auditor_subsections
        if user.role == 'auditor':
            auditor_sub_ids = set(user.auditor_subsections.values_list('id', flat=True))
            if not auditor_sub_ids:
                return False
            if obj.subsection_id and obj.subsection_id in auditor_sub_ids:
                return True
            # Also allow section-level mails (no subsection set) where any configured
            # subsection belongs to the same parent section
            if obj.section_id and obj.subsection_id is None:
                from sections.models import Subsection
                if Subsection.objects.filter(
                    id__in=auditor_sub_ids, section_id=obj.section_id
                ).exists():
                    return True
            return False

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

        # Reassign permission — auditor can reassign only if current handler
        # (target role restriction to SrAO/AAO is enforced in the view)
        if view.action == 'reassign':
            if self._is_dag_for_section(user, obj):
                return True
            if user.role == 'auditor':
                return obj.current_handler == user
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

        # PDF upload permission
        # Allowed: AG always, DAG if mail section in their sections,
        # SrAO/AAO/auditor/clerk if current_handler
        if view.action == 'upload_pdf':
            if user.role == 'DAG':
                return self._is_dag_for_section(user, obj)
            if user.role in ['SrAO', 'AAO']:
                return obj.current_handler == user
            if user.role in ['auditor', 'clerk']:
                return obj.current_handler == user
            return False

        # PDF metadata and view permission — mirrors view permission
        if view.action in ['get_pdf_metadata', 'view_pdf']:
            return self._can_view_mail(user, obj, request)

        return False
