from django.db import models
from django.conf import settings
from django.utils import timezone
from sections.models import Section


class MailRecord(models.Model):
    STATUS_CHOICES = [
        ('Received', 'Received'),
        ('Assigned', 'Assigned'),
        ('In Progress', 'In Progress'),
        ('Closed', 'Closed'),
    ]

    ACTION_CHOICES = [
        ('Review', 'Review'),
        ('Approve', 'Approve'),
        ('Process', 'Process'),
        ('File', 'File'),
        ('Reply', 'Reply'),
        ('Other', 'Other'),
    ]

    # Auto-generated serial number
    sl_no = models.CharField(max_length=20, unique=True, editable=False)

    # Mail details
    letter_no = models.CharField(max_length=200)
    date_received = models.DateField(default=timezone.now)
    mail_reference_subject = models.TextField()
    from_office = models.CharField(max_length=200)
    action_required = models.CharField(max_length=50, choices=ACTION_CHOICES)
    action_required_other = models.CharField(max_length=200, blank=True, null=True)

    # Assignment fields
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='assigned_mails'
    )
    current_handler = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='current_mails'
    )
    monitoring_officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='monitored_mails',
        null=True,
        blank=True
    )

    # Section and deadlines
    section = models.ForeignKey(
        Section,
        on_delete=models.PROTECT,
        related_name='mails'
    )
    due_date = models.DateField()

    # Status tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Received')
    date_of_completion = models.DateField(null=True, blank=True)
    last_status_change = models.DateTimeField(auto_now_add=True)

    # Additional info
    remarks = models.TextField(blank=True, null=True)

    # Multi-assignment support (for assigning to multiple persons)
    is_multi_assigned = models.BooleanField(default=False)
    consolidated_remarks = models.TextField(blank=True, null=True)

    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_mails'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        # PERFORMANCE FIX: Add indexes for frequently filtered/queried fields
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['section']),
            models.Index(fields=['current_handler']),
            models.Index(fields=['assigned_to']),
            models.Index(fields=['due_date']),
            models.Index(fields=['created_at']),
            models.Index(fields=['section', 'status']),  # Composite for common filter
        ]

    def __str__(self):
        return f"{self.sl_no} - {self.mail_reference_subject[:50]}"

    def save(self, *args, **kwargs):
        # Generate sl_no if not exists
        if not self.sl_no:
            year = timezone.now().year
            last_record = MailRecord.objects.filter(
                sl_no__startswith=f"{year}/"
            ).order_by('-sl_no').first()

            if last_record:
                last_number = int(last_record.sl_no.split('/')[1])
                new_number = last_number + 1
            else:
                new_number = 1

            self.sl_no = f"{year}/{new_number:03d}"

        # Auto-set current_handler if not set
        if not self.current_handler_id:
            self.current_handler = self.assigned_to

        # Auto-set monitoring officer based on assigned_to's DAG
        if not self.monitoring_officer_id and self.assigned_to:
            self.monitoring_officer = self.assigned_to.get_dag()

        super().save(*args, **kwargs)

    def time_in_current_stage(self):
        """Calculate time spent in current stage
        For closed mails: total time from creation to completion
        For open mails: time since last status change
        """
        if self.status == 'Closed' and self.date_of_completion:
            # For closed mails, show total processing time from creation to completion
            end_time = timezone.make_aware(
                timezone.datetime.combine(self.date_of_completion, timezone.datetime.max.time().replace(microsecond=0))
            )
            start_time = self.created_at
        else:
            # For open mails, show time since last status change
            end_time = timezone.now()
            start_time = self.last_status_change

        delta = end_time - start_time
        days = delta.days
        hours = delta.seconds // 3600
        minutes = (delta.seconds % 3600) // 60

        if days > 0:
            return f"{days} days {hours} hours"
        elif hours > 0:
            return f"{hours} hours {minutes} mins"
        else:
            return f"{minutes} mins"

    def is_overdue(self):
        """Check if mail is overdue"""
        if self.status == 'Closed':
            return False
        return timezone.now().date() > self.due_date

    def can_view(self, user):
        """Check if user can view this mail record"""
        if user.is_ag():
            return True

        if user.is_dag():
            # DAG can view own section's mails
            if self.section == user.section:
                return True
            # DAG can view mails they touched at any point
            from audit.models import AuditTrail
            return AuditTrail.objects.filter(
                mail_record=self,
                performed_by=user
            ).exists()

        # SrAO/AAO can view mails assigned to them or they touched
        if self.current_handler == user or self.assigned_to == user:
            return True

        from audit.models import AuditTrail
        return AuditTrail.objects.filter(
            mail_record=self,
            performed_by=user
        ).exists()

    def can_edit(self, user):
        """Check if user can edit this mail record"""
        if user.is_ag():
            return True

        if user.is_dag():
            return self.section == user.section

        # Staff officers can only edit remarks
        return False

    def can_reassign(self, user):
        """Check if user can reassign this mail"""
        if user.is_ag():
            return True

        if user.is_dag() and self.section == user.section:
            return True

        # Current handler can reassign their own mail
        return self.current_handler == user

    def can_close(self, user):
        """Check if user can close this mail"""
        if user.is_ag():
            return True

        if user.is_dag() and self.current_handler == user:
            return True

        return self.current_handler == user

    def can_reopen(self, user):
        """Only AG can reopen closed mails"""
        return user.is_ag() and self.status == 'Closed'

    def can_multi_assign(self, user):
        """Check if user can assign this mail to multiple people"""
        if self.status == 'Closed':
            return False
        return user.is_ag() or (user.is_dag() and self.section == user.section)

    def update_consolidated_remarks(self):
        """Update consolidated remarks from all parallel assignments"""
        assignments = self.parallel_assignments.filter(
            status__in=['Active', 'Completed']
        ).exclude(user_remarks__isnull=True).exclude(user_remarks='')

        if not assignments.exists():
            self.consolidated_remarks = None
            self.save(update_fields=['consolidated_remarks'])
            return

        remarks_parts = []
        for a in assignments.order_by('created_at'):
            status_label = "[DONE]" if a.status == 'Completed' else "[IN PROGRESS]"
            remarks_parts.append(
                f"{status_label} {a.assigned_to.full_name}: {a.user_remarks}"
            )

        self.consolidated_remarks = "\n---\n".join(remarks_parts)
        self.save(update_fields=['consolidated_remarks'])


class MailAssignment(models.Model):
    """
    Tracks parallel assignments of a mail to multiple users.
    Used when a supervisor assigns the same mail to multiple persons simultaneously.
    Each assignment allows the assignee to add their own remarks independently.
    """
    ASSIGNMENT_STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Completed', 'Completed'),
        ('Revoked', 'Revoked'),
    ]

    mail_record = models.ForeignKey(
        'MailRecord',
        on_delete=models.CASCADE,
        related_name='parallel_assignments'
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='parallel_assigned_mails'
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='parallel_assignments_made'
    )
    assignment_remarks = models.TextField(blank=True, null=True)  # Instructions from supervisor
    user_remarks = models.TextField(blank=True, null=True)  # Response from assignee
    status = models.CharField(max_length=20, choices=ASSIGNMENT_STATUS_CHOICES, default='Active')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['mail_record', 'status']),
            models.Index(fields=['assigned_to', 'status']),
        ]
        # Prevent duplicate active assignments to same user for same mail
        constraints = [
            models.UniqueConstraint(
                fields=['mail_record', 'assigned_to'],
                condition=models.Q(status='Active'),
                name='unique_active_assignment_per_user'
            )
        ]

    def __str__(self):
        return f"{self.mail_record.sl_no} -> {self.assigned_to.full_name} ({self.status})"
