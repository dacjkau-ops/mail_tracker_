from django.contrib import admin
from .models import MailRecord


@admin.register(MailRecord)
class MailRecordAdmin(admin.ModelAdmin):
    list_display = ['sl_no', 'letter_no', 'mail_reference_subject', 'current_handler', 'current_action_status', 'status', 'due_date', 'created_at']
    list_filter = ['status', 'current_action_status', 'section', 'action_required', 'created_at']
    search_fields = ['sl_no', 'letter_no', 'mail_reference_subject', 'from_office']
    readonly_fields = ['sl_no', 'created_at', 'updated_at', 'last_status_change', 'current_action_updated_at']
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
        ('Current Action', {
            'fields': ('current_action_status', 'current_action_remarks', 'current_action_updated_at'),
            'description': 'What the current handler is actively doing with this mail'
        }),
        ('Additional Info', {
            'fields': ('remarks', 'created_by', 'created_at', 'updated_at')
        }),
    )
