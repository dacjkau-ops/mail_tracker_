from rest_framework import permissions
from django.db.models import Q


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
    - DAG: Can view own section records
           Can create/assign/reassign within their section
    - SrAO/AAO: Can view all mails in their subsection
                Can update/close their assigned records
    - auditor: Can view mails in their configured auditor_subsections only
               Can reassign only to SrAO/AAO
    - clerk: Can view mails in their own subsection
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

        if view.action in ['list', 'retrieve']:
            return True

        if view.action == 'create':
            return True

        if view.action in ['update', 'partial_update', 'close', 'reassign', 'reopen']:
            return True

        if view.action in [
            'multi_assign', 'assignments', 'update_assignment',
            'complete_assignment', 'add_assignment_remark',
            'reassign_assignment', 'update_current_action',
            'reassign_candidates',
            'upload_pdf', 'get_pdf_metadata', 'view_pdf',
        ]:
            return True

        return False

    def _can_view_mail(self, user, obj, request):
        """Helper: check if user can view this mail record"""
        if user.role == 'DAG':
            section_id = obj.section_id or (obj.subsection.section_id if obj.subsection_id else None)
            return bool(section_id and user.sections.filter(id=section_id).exists())

        if user.role in ['SrAO', 'AAO', 'clerk']:
            return bool(user.subsection_id and obj.subsection_id == user.subsection_id)

        if user.role == 'auditor':
            auditor_sub_ids = set(user.auditor_subsections.values_list('id', flat=True))
            if not auditor_sub_ids:
                return False
            if obj.subsection_id and obj.subsection_id in auditor_sub_ids:
                return True
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
        section_id = obj.section_id or (obj.subsection.section_id if obj.subsection_id else None)
        return user.role == 'DAG' and section_id and user.sections.filter(id=section_id).exists()

    def _has_active_assignment(self, user, obj):
        from records.models import MailAssignment
        return MailAssignment.objects.filter(
            mail_record=obj,
            status='Active'
        ).filter(
            Q(assigned_to=user) | Q(reassigned_to=user)
        ).exists()

    def has_object_permission(self, request, view, obj):
        """Check if user can perform action on specific mail record"""
        user = request.user

        if user.role == 'AG':
            return True

        if view.action in ['retrieve', 'assignments']:
            return self._can_view_mail(user, obj, request)

        if view.action in ['update', 'partial_update']:
            return obj.current_handler == user

        if view.action == 'update_current_action':
            return obj.current_handler == user

        if view.action == 'close':
            return obj.current_handler == user

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

        if view.action == 'multi_assign':
            return self._is_dag_for_section(user, obj)

        if view.action == 'reopen':
            return False

        if view.action in [
            'update_assignment', 'complete_assignment',
            'add_assignment_remark', 'reassign_assignment',
        ]:
            return self._can_view_mail(user, obj, request)

        if view.action == 'upload_pdf':
            if user.role == 'DAG':
                return self._is_dag_for_section(user, obj)
            if user.role in ['SrAO', 'AAO']:
                return obj.current_handler == user
            if user.role in ['auditor', 'clerk']:
                return obj.current_handler == user
            return False

        if view.action in ['get_pdf_metadata', 'view_pdf']:
            return self._can_view_mail(user, obj, request)

        return False
