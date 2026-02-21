from django.db import models
from django.contrib.auth.models import AbstractUser
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
        return f"{self.full_name} ({self.role})"

    def save(self, *args, **kwargs):
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
            return Section.objects.filter(subsections__id__in=subsection_ids).distinct()
        elif self.subsection:
            # SrAO, AAO, clerk — subsection FK
            return Section.objects.filter(id=self.subsection.section_id)
        return Section.objects.none()

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
            first_sub = self.auditor_subsections.first()
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
