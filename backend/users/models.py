from django.db import models
from django.db import transaction
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from sections.models import Section, Subsection


class User(AbstractUser):
    ROLE_CHOICES = [
        ('AG', 'Accountant General'),
        ('DAG', 'Deputy Accountant General'),
        ('SrAO', 'Senior Audit Officer'),
        ('AAO', 'Assistant Audit Officer'),
        ('auditor', 'Auditor'),
        ('clerk', 'Clerk'),
    ]

    # Override email to make it required and unique
    email = models.EmailField(unique=True)

    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    actual_role = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Display role/title shown in UI (functional permissions still use role)."
    )

    # DAG can manage multiple sections (e.g., same DAG for Admin, AMG-I, FAW)
    sections = models.ManyToManyField(
        Section,
        related_name='dags',
        blank=True,
        help_text="Sections managed by this DAG (only for DAG role)"
    )

    # SrAO/AAO belong to a specific subsection
    subsection = models.ForeignKey(
        Subsection,
        on_delete=models.PROTECT,
        related_name='staff_officers',
        null=True,
        blank=True,
        help_text="Subsection for SrAO/AAO/clerk officers"
    )

    # Auditor can be configured to see multiple subsections
    auditor_subsections = models.ManyToManyField(
        Subsection,
        related_name='auditors',
        blank=True,
        help_text="Subsections visible to this auditor (configured by admin). Only used when role='auditor'."
    )

    full_name = models.CharField(max_length=100)
    is_primary_ag = models.BooleanField(
        default=False,
        help_text="Use this AG as default monitoring fallback when multiple AG users exist."
    )

    class Meta:
        ordering = ['full_name']
        constraints = [
            models.UniqueConstraint(
                fields=['is_primary_ag'],
                condition=models.Q(role='AG', is_primary_ag=True),
                name='unique_primary_ag_user'
            )
        ]

    def __str__(self):
        display_role = self.actual_role or self.role
        return f"{self.full_name} ({display_role})"

    def save(self, *args, **kwargs):
        if not self.actual_role:
            self.actual_role = self.role
        if self.role != 'AG':
            self.is_primary_ag = False
        super().save(*args, **kwargs)

    def is_ag(self):
        return self.role == 'AG'

    def is_dag(self):
        return self.role == 'DAG'

    def is_staff_officer(self):
        return self.role in ['SrAO', 'AAO']

    def is_auditor(self):
        return self.role == 'auditor'

    def is_clerk(self):
        return self.role == 'clerk'

    def get_sections_list(self):
        """Get list of sections for this user based on role"""
        if self.role == 'AG':
            return Section.objects.all()
        elif self.role == 'DAG':
            return self.sections.all()
        elif self.role == 'auditor':
            # Return sections that contain any of the auditor's configured subsections
            subsection_ids = self.auditor_subsections.values_list('id', flat=True)
            sections = Section.objects.filter(subsections__id__in=subsection_ids).distinct()
            if sections.exists():
                return sections
            if self.subsection_id:
                return Section.objects.filter(id=self.subsection.section_id)
            return Section.objects.none()
        elif self.subsection:
            # SrAO, AAO, clerk — subsection FK
            return Section.objects.filter(id=self.subsection.section_id)
        return Section.objects.none()

    def get_effective_subsection(self, persist=False):
        """
        Resolve the operative subsection for role-scoped logic.
        For auditors, prefer FK `subsection`, else fallback to first configured auditor_subsection.
        Optionally persist back to FK to keep data consistent.
        """
        if self.subsection_id:
            return self.subsection

        if self.role != 'auditor':
            return None

        first_sub = self.auditor_subsections.select_related('section').order_by('id').first()
        if first_sub and persist:
            self.subsection = first_sub
            self.save(update_fields=['subsection'])
        return first_sub

    def get_dag(self):
        """
        Returns the DAG (monitoring officer) for this user
        - If user is AG: returns self
        - If user is DAG: returns AG
        - If user is auditor: returns first active SrAO/AAO in their primary auditor subsection
        - If user is SrAO/AAO/clerk: returns the DAG of their subsection's parent section
        """
        if self.role == 'AG':
            return self
        elif self.role == 'DAG':
            return User.get_primary_ag()
        elif self.role == 'auditor':
            # Auditor's immediate superior is an SrAO/AAO in any of their configured subsections
            # Return first active SrAO/AAO in their primary auditor subsection (first configured)
            first_sub = self.get_effective_subsection()
            if first_sub:
                return User.objects.filter(
                    role__in=['SrAO', 'AAO'],
                    subsection=first_sub,
                    is_active=True
                ).order_by('id').first()
            return None
        else:  # SrAO, AAO, clerk
            # Return the DAG managing their subsection's parent section
            if self.subsection and self.subsection.section:
                # Check if section reports directly to AG
                if self.subsection.section.directly_under_ag:
                    return User.get_primary_ag()
                # Otherwise find the DAG managing this section
                return User.objects.filter(
                    role='DAG',
                    sections=self.subsection.section,
                    is_active=True
                ).order_by('id').first()
        return None

    @classmethod
    def get_primary_ag(cls):
        """
        Deterministic AG resolver:
        1) active AG marked is_primary_ag
        2) fallback to earliest active AG by id
        """
        primary = cls.objects.filter(
            role='AG',
            is_active=True,
            is_primary_ag=True
        ).order_by('id').first()
        if primary:
            return primary
        return cls.objects.filter(role='AG', is_active=True).order_by('id').first()


class SignupRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    REQUESTABLE_ROLES = [
        ('SrAO', 'Senior Audit Officer'),
        ('AAO', 'Assistant Audit Officer'),
        ('auditor', 'Auditor'),
        ('clerk', 'Clerk'),
    ]

    username = models.CharField(max_length=150)
    email = models.EmailField()
    full_name = models.CharField(max_length=100)
    password_hash = models.CharField(max_length=128)

    requested_role = models.CharField(max_length=10, choices=REQUESTABLE_ROLES)
    requested_section = models.ForeignKey(
        Section,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='signup_requests'
    )
    requested_subsection = models.ForeignKey(
        Subsection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='signup_requests'
    )

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    approved_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_signup_requests'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    processed_user = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_signup_requests'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['username']),
            models.Index(fields=['email']),
        ]

    def __str__(self):
        return f"{self.username} ({self.requested_role}) - {self.status}"

    def approve(self, reviewer, role=None, section=None, subsection=None):
        if self.status != 'pending':
            raise ValueError('Only pending signup requests can be approved.')
        if not reviewer or not reviewer.is_superuser:
            raise ValueError('Only superusers can approve signup requests.')

        final_role = role or self.requested_role
        final_section = section if section is not None else self.requested_section
        final_subsection = subsection if subsection is not None else self.requested_subsection

        if final_role not in {'SrAO', 'AAO', 'auditor', 'clerk'}:
            raise ValueError('Invalid role for signup approval.')
        if not final_subsection:
            raise ValueError('Subsection is required for approval.')
        if final_section and final_subsection.section_id != final_section.id:
            raise ValueError('Selected subsection does not belong to selected section.')

        if User.objects.filter(username=self.username).exists():
            raise ValueError(f'Username "{self.username}" is already in use.')
        if User.objects.filter(email=self.email).exists():
            raise ValueError(f'Email "{self.email}" is already in use.')

        with transaction.atomic():
            user = User.objects.create(
                username=self.username,
                email=self.email,
                password=self.password_hash,
                full_name=self.full_name,
                role=final_role,
                subsection=final_subsection if final_role in {'SrAO', 'AAO', 'clerk'} else None,
                is_active=True,
            )
            if final_role == 'auditor':
                user.auditor_subsections.set([final_subsection])
            self.status = 'approved'
            self.approved_by = reviewer
            self.reviewed_at = timezone.now()
            self.processed_user = user
            self.requested_role = final_role
            self.requested_section = final_subsection.section
            self.requested_subsection = final_subsection
            self.save(
                update_fields=[
                    'status',
                    'approved_by',
                    'reviewed_at',
                    'processed_user',
                    'requested_role',
                    'requested_section',
                    'requested_subsection',
                    'updated_at',
                ]
            )
            return user

    def reject(self, reviewer):
        if self.status != 'pending':
            raise ValueError('Only pending signup requests can be rejected.')
        if not reviewer or not reviewer.is_superuser:
            raise ValueError('Only superusers can reject signup requests.')
        self.status = 'rejected'
        self.approved_by = reviewer
        self.reviewed_at = timezone.now()
        self.save(update_fields=['status', 'approved_by', 'reviewed_at', 'updated_at'])


class UserImportJob(models.Model):
    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    FORMAT_CHOICES = [
        ('csv', 'CSV'),
        ('json', 'JSON'),
    ]

    original_filename = models.CharField(max_length=255)
    file_format = models.CharField(max_length=10, choices=FORMAT_CHOICES)
    payload = models.TextField(help_text='Original uploaded CSV/JSON content.')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='queued')
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='initiated_user_import_jobs'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    summary = models.JSONField(default=dict, blank=True)
    failure_message = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f"{self.original_filename} [{self.status}]"
