from django.db import models
from django.contrib.auth.models import AbstractUser
from sections.models import Section


class User(AbstractUser):
    ROLE_CHOICES = [
        ('AG', 'Additional General'),
        ('DAG', 'Deputy Additional General'),
        ('SrAO', 'Senior Accounts Officer'),
        ('AAO', 'Assistant Accounts Officer'),
    ]

    # Override email to make it required and unique
    email = models.EmailField(unique=True)

    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    section = models.ForeignKey(
        Section,
        on_delete=models.PROTECT,
        related_name='users',
        null=True,
        blank=True
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

    def get_dag(self):
        """
        Returns the DAG (monitoring officer) for this user
        - If user is AG: returns self
        - If user is DAG: returns AG
        - If user is SrAO/AAO: returns their section's DAG
        """
        if self.role == 'AG':
            return self
        elif self.role == 'DAG':
            # Return any AG in the system
            return User.objects.filter(role='AG', is_active=True).first()
        else:  # SrAO or AAO
            # Return the DAG of their section
            if self.section:
                return User.objects.filter(
                    role='DAG',
                    section=self.section,
                    is_active=True
                ).first()
        return None
