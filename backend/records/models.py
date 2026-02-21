import uuid
import os

from django.db import models
from django.conf import settings as django_settings
from django.core.exceptions import ValidationError
from django.core.files.storage import FileSystemStorage
from django.utils import timezone
from sections.models import Section, Subsection


def get_pdf_storage():
    """Return FileSystemStorage pointed at PDF_STORAGE_PATH setting."""
    storage_path = getattr(django_settings, 'PDF_STORAGE_PATH', None)
    if storage_path is None:
        from pathlib import Path
        storage_path = Path(django_settings.BASE_DIR) / 'pdfs'
    os.makedirs(storage_path, exist_ok=True)
    return FileSystemStorage(location=str(storage_path))


def pdf_upload_path(instance, filename):
    """Store PDF as UUID.pdf, ignoring original filename to prevent path traversal."""
    return f"{uuid.uuid4()}.pdf"


def validate_pdf_extension(value):
    ext = os.path.splitext(value.name)[1].lower()
    if ext != '.pdf':
        raise ValidationError('Only PDF files are allowed.')


def validate_pdf_size(value):
    max_mb = getattr(django_settings, 'MAX_PDF_SIZE_MB', 10)
    max_size = max_mb * 1024 * 1024
    if value.size > max_size:
        raise ValidationError(f'File size exceeds {max_mb}MB limit.')


class MailRecord(models.Model):
    STATUS_CHOICES = [
        ('Received', 'Received'),
        ('Assigned', 'Assigned'),
        ('In Progress', 'In Progress'),
        ('Closed', 'Closed'),
    ]

    # Current work status choices - what the current handler is actively doing
    CURRENT_ACTION_STATUS_CHOICES = [
        ('Under Review', 'Under Review'),
        ('Drafting Reply', 'Drafting Reply'),
        ('Seeking Clarification', 'Seeking Clarification'),
        ('Awaiting Information', 'Awaiting Information'),
        ('Processing', 'Processing'),
        ('Finalizing', 'Finalizing'),
        ('Completed', 'Completed'),
        ('On Hold', 'On Hold'),
        ('Consulting', 'Consulting'),
        ('Verification', 'Verification'),
    ]

    # Auto-generated serial number
    sl_no = models.CharField(max_length=10, unique=True, editable=False)

    # Mail details
    letter_no = models.CharField(max_length=200)
    date_received = models.DateField(default=timezone.now)
    mail_reference_subject = models.TextField()
    from_office = models.CharField(max_length=200)
    action_required = models.CharField(
        max_length=500,
        blank=True,
        help_text="What action is required on this mail (free text, optional, max 500 chars)"
    )
    action_required_other = models.CharField(max_length=100, blank=True, null=True)

    # Assignment fields
    assigned_to = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='assigned_mails'
    )
    current_handler = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='current_mails'
    )
    monitoring_officer = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='monitored_mails',
        null=True,
        blank=True
    )

    # Section and deadlines
    # Section is optional for cross-section assignments (AG only)
    section = models.ForeignKey(
        Section,
        on_delete=models.PROTECT,
        related_name='mails',
        null=True,
        blank=True,
        help_text="Section owning this mail. Null for cross-section multi-assignments."
    )
    subsection = models.ForeignKey(
        Subsection,
        on_delete=models.PROTECT,
        related_name='mails',
        null=True,
        blank=True,
        help_text="Subsection within the section (optional, used when assigned to SrAO/AAO)"
    )
    due_date = models.DateField()

    # Status tracking
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='Received')
    date_of_completion = models.DateField(null=True, blank=True)
    last_status_change = models.DateTimeField(auto_now_add=True)

    # Current handler's work status (what they're actively doing with the mail)
    current_action_status = models.CharField(
        max_length=25,
        choices=CURRENT_ACTION_STATUS_CHOICES,
        null=True,
        blank=True,
        help_text="What the current handler is actively doing with this mail"
    )
    current_action_remarks = models.TextField(
        blank=True,
        null=True,
        help_text="Optional details about the current action being performed"
    )
    current_action_updated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the current action status was last updated"
    )

    # Additional info
    initial_instructions = models.TextField(blank=True, null=True, help_text="Initial instructions from creator, visible to all assignees")
    remarks = models.TextField(blank=True, null=True, help_text="DEPRECATED: Use initial_instructions or assignment-level remarks")

    # Multi-assignment support (for assigning to multiple persons)
    is_multi_assigned = models.BooleanField(default=False)
    consolidated_remarks = models.TextField(blank=True, null=True, help_text="Auto-generated from all assignment remarks")

    # Metadata
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
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
            models.Index(fields=['current_action_status']),  # For filtering by current work status
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
            # DAG can view mails from any of their managed sections
            if self.section and user.sections.filter(id=self.section.id).exists():
                return True
            # DAG can view mails where they have a parallel assignment
            if self.parallel_assignments.filter(assigned_to=user, status='Active').exists():
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

        # Staff can view mails where they have a parallel assignment
        if self.parallel_assignments.filter(assigned_to=user, status='Active').exists():
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
            # DAG can edit if mail belongs to any of their managed sections
            return self.section and user.sections.filter(id=self.section.id).exists()

        # Staff officers can only edit remarks
        return False

    def can_reassign(self, user):
        """Check if user can reassign this mail"""
        if user.is_ag():
            return True

        if user.is_dag():
            # DAG can reassign if mail belongs to any of their managed sections
            return self.section and user.sections.filter(id=self.section.id).exists()

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
        if user.is_ag():
            return True
        if user.is_dag():
            # DAG can multi-assign if mail belongs to any of their managed sections
            return self.section and user.sections.filter(id=self.section.id).exists()
        return False

    @property
    def current_attachment(self):
        return self.attachments.filter(is_current=True).first()

    @property
    def has_attachment(self):
        return bool(self.current_attachment)

    def get_attachment_metadata(self):
        attachment = self.current_attachment
        if not attachment:
            return {
                'has_attachment': False,
                'attachment_id': None,
                'original_filename': None,
                'file_size': None,
                'file_size_human': None,
                'uploaded_at': None,
                'uploaded_by': None,
            }
        size = attachment.file_size
        if size < 1024:
            size_human = f"{size} B"
        elif size < 1024 * 1024:
            size_human = f"{size / 1024:.1f} KB"
        else:
            size_human = f"{size / (1024 * 1024):.1f} MB"
        return {
            'has_attachment': True,
            'attachment_id': str(attachment.id),
            'original_filename': attachment.original_filename,
            'file_size': size,
            'file_size_human': size_human,
            'uploaded_at': attachment.uploaded_at.isoformat() if attachment.uploaded_at else None,
            'uploaded_by': attachment.uploaded_by.username if attachment.uploaded_by else None,
        }

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
        django_settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='parallel_assigned_mails'
    )
    assigned_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='parallel_assignments_made'
    )
    assignment_remarks = models.TextField(blank=True, null=True)  # Instructions from supervisor
    user_remarks = models.TextField(blank=True, null=True)  # DEPRECATED: Use AssignmentRemark timeline instead
    status = models.CharField(max_length=10, choices=ASSIGNMENT_STATUS_CHOICES, default='Active')

    # Track reassignment within the same assignment
    reassigned_to = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='reassigned_from_assignments',
        null=True,
        blank=True,
        help_text="If assignee reassigned to another officer, track the new person"
    )
    reassigned_at = models.DateTimeField(null=True, blank=True)

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

    def get_remarks_timeline(self):
        """Get all remarks in chronological order"""
        return self.remarks_timeline.all()

    def get_current_assignee(self):
        """Get the current person handling this assignment (may be different if reassigned)"""
        return self.reassigned_to or self.assigned_to


class AssignmentRemark(models.Model):
    """
    Append-only remarks timeline for each assignment.
    Previous remarks cannot be edited - new remarks are appended.
    This creates a complete audit trail of officer responses.
    """
    assignment = models.ForeignKey(
        MailAssignment,
        on_delete=models.CASCADE,
        related_name='remarks_timeline'
    )
    content = models.TextField()
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='assignment_remarks_made'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['assignment', 'created_at']),
        ]

    def __str__(self):
        return f"Remark by {self.created_by.full_name} on {self.created_at.strftime('%Y-%m-%d %H:%M')}"


class RecordAttachment(models.Model):
    UPLOAD_STAGE_CHOICES = [
        ('created', 'Created'),
        ('closed', 'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mail_record = models.ForeignKey(
        MailRecord,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.FileField(
        upload_to=pdf_upload_path,
        storage=get_pdf_storage,  # callable — evaluated lazily, not at import time
        max_length=255,
        validators=[validate_pdf_extension, validate_pdf_size]
    )
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(help_text="File size in bytes")
    uploaded_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_attachments'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    upload_stage = models.CharField(
        max_length=7,
        choices=UPLOAD_STAGE_CHOICES,
        default='created',
        help_text="Workflow stage at which this PDF was uploaded"
    )
    is_current = models.BooleanField(
        default=True,
        help_text="False when superseded by a replacement for the same stage"
    )

    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = 'Record Attachment'
        verbose_name_plural = 'Record Attachments'

    def __str__(self):
        return f"{self.original_filename} ({self.mail_record.sl_no}) [{self.upload_stage}]"

    @property
    def stored_filename(self):
        """Return just the UUID filename (e.g., 'abc123.pdf') for X-Accel-Redirect."""
        return os.path.basename(self.file.name) if self.file else None

    def get_metadata_dict(self):
        return {
            'id': str(self.id),
            'original_filename': self.original_filename,
            'file_size': self.file_size,
            'file_size_human': self._human_readable_size(self.file_size),
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'uploaded_by': self.uploaded_by.full_name if self.uploaded_by else None,
            'upload_stage': self.upload_stage,
        }

    @staticmethod
    def _human_readable_size(size_bytes):
        if size_bytes is None:
            return None
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        else:
            return f"{size_bytes / (1024 * 1024):.1f} MB"

    def delete_file(self):
        """Delete physical file from storage."""
        if self.file:
            if os.path.isfile(self.file.path):
                os.remove(self.file.path)
