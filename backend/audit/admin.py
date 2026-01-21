from django.contrib import admin
from .models import AuditTrail


@admin.register(AuditTrail)
class AuditTrailAdmin(admin.ModelAdmin):
    list_display = ['mail_record', 'action', 'performed_by', 'timestamp']
    list_filter = ['action', 'timestamp']
    search_fields = ['mail_record__sl_no', 'performed_by__full_name', 'remarks']
    readonly_fields = ['mail_record', 'action', 'performed_by', 'timestamp', 'old_value', 'new_value', 'remarks']
    date_hierarchy = 'timestamp'

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
