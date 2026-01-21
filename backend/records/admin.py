from django.contrib import admin
from .models import MailRecord


@admin.register(MailRecord)
class MailRecordAdmin(admin.ModelAdmin):
    list_display = ['sl_no', 'letter_no', 'mail_reference_subject', 'current_handler', 'status', 'due_date', 'created_at']
    list_filter = ['status', 'section', 'action_required', 'created_at']
    search_fields = ['sl_no', 'letter_no', 'mail_reference_subject', 'from_office']
    readonly_fields = ['sl_no', 'created_at', 'updated_at', 'last_status_change']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Mail Information', {
            'fields': ('sl_no', 'letter_no', 'date_received', 'mail_reference_subject', 'from_office', 'action_required', 'action_required_other')
        }),
        ('Assignment', {
            'fields': ('section', 'assigned_to', 'current_handler', 'monitoring_officer')
        }),
        ('Status & Deadlines', {
            'fields': ('status', 'due_date', 'date_of_completion', 'last_status_change')
        }),
        ('Additional Info', {
            'fields': ('remarks', 'created_by', 'created_at', 'updated_at')
        }),
    )
