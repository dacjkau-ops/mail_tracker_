from django.db import models


class Section(models.Model):
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True, null=True)
    directly_under_ag = models.BooleanField(
        default=False,
        help_text="Check if this section reports directly to AG (no DAG)"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Subsection(models.Model):
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name='subsections'
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['section__name', 'name']
        unique_together = [['section', 'name']]

    def __str__(self):
        return f"{self.section.name} - {self.name}"
