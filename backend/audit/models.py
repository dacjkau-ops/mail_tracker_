from django.db import models
from django.conf import settings
from records.models import MailRecord


class AuditTrail(models.Model):
    ACTION_CHOICES = [
        ('CREATE', 'Created'),
        ('ASSIGN', 'Assigned'),
        ('REASSIGN', 'Reassigned'),
        ('UPDATE', 'Added remarks'),
        ('CLOSE', 'Closed'),
        ('REOPEN', 'Reopened'),
    ]

    mail_record = models.ForeignKey(
        MailRecord,
        on_delete=models.CASCADE,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='audit_actions'
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['timestamp']  # Chronological order for history log
        # PERFORMANCE FIX: Add indexes for frequently queried fields
        indexes = [
            models.Index(fields=['mail_record', 'performed_by']),
            models.Index(fields=['performed_by']),
            models.Index(fields=['mail_record']),
            models.Index(fields=['timestamp']),
        ]

    def __str__(self):
        return f"{self.action} - {self.mail_record.sl_no} by {self.performed_by.full_name}"

    @classmethod
    def log_action(cls, mail_record, action, performed_by, remarks='', old_value=None, new_value=None):
        """
        Helper method to create audit log entries
        """
        return cls.objects.create(
            mail_record=mail_record,
            action=action,
            performed_by=performed_by,
            remarks=remarks,
            old_value=old_value,
            new_value=new_value
        )
