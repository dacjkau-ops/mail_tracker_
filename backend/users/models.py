from django.db import models
from django.contrib.auth.models import AbstractUser
from sections.models import Section, Subsection


class User(AbstractUser):
    ROLE_CHOICES = [
        ('AG', 'Accountant General'),
        ('DAG', 'Deputy Accountant General'),
        ('SrAO', 'Senior Audit Officer'),
        ('AAO', 'Assistant Audit Officer'),
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
        help_text="Subsection for SrAO/AAO officers"
    )

    full_name = models.CharField(max_length=200)

    class Meta:
        ordering = ['full_name']

    def __str__(self):
        return f"{self.full_name} ({self.role})"

    def is_ag(self):
        return self.role == 'AG'

    def is_dag(self):
        return self.role == 'DAG'

    def is_staff_officer(self):
        return self.role in ['SrAO', 'AAO']

    def get_sections_list(self):
        """Get list of sections for this user based on role"""
        if self.role == 'AG':
            return Section.objects.all()
        elif self.role == 'DAG':
            return self.sections.all()
        elif self.subsection:
            return Section.objects.filter(id=self.subsection.section_id)
        return Section.objects.none()

    def get_dag(self):
        """
        Returns the DAG (monitoring officer) for this user
        - If user is AG: returns self
        - If user is DAG: returns AG
        - If user is SrAO/AAO: returns the DAG of their subsection's parent section
        """
        if self.role == 'AG':
            return self
        elif self.role == 'DAG':
            # Return any AG in the system
            return User.objects.filter(role='AG', is_active=True).first()
        else:  # SrAO or AAO
            # Return the DAG managing their subsection's parent section
            if self.subsection and self.subsection.section:
                # Check if section reports directly to AG
                if self.subsection.section.directly_under_ag:
                    return User.objects.filter(role='AG', is_active=True).first()
                # Otherwise find the DAG managing this section
                return User.objects.filter(
                    role='DAG',
                    sections=self.subsection.section,
                    is_active=True
                ).first()
        return None
