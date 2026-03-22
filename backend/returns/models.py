from calendar import monthrange
from datetime import date

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from sections.models import Section


class ReturnDefinition(models.Model):
    FREQUENCY_MONTHLY = 'monthly'
    FREQUENCY_QUARTERLY = 'quarterly'
    FREQUENCY_ANNUAL = 'annual'

    FREQUENCY_CHOICES = [
        (FREQUENCY_MONTHLY, 'Monthly'),
        (FREQUENCY_QUARTERLY, 'Quarterly'),
        (FREQUENCY_ANNUAL, 'Annual'),
    ]

    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['active']),
            models.Index(fields=['frequency', 'active']),
        ]

    def __str__(self):
        return f'{self.code} - {self.name}'


class ReturnApplicability(models.Model):
    return_definition = models.ForeignKey(
        ReturnDefinition,
        on_delete=models.CASCADE,
        related_name='applicabilities',
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name='return_applicabilities',
    )
    due_day = models.PositiveSmallIntegerField(
        help_text='Calendar day of the month on which this return is due.'
    )
    applicable_months = models.JSONField(
        default=list,
        blank=True,
        help_text='Month numbers (1-12). Leave blank for monthly returns.',
    )
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['section__name', 'return_definition__name']
        constraints = [
            models.UniqueConstraint(
                fields=['return_definition', 'section'],
                name='unique_return_applicability_per_section',
            )
        ]
        indexes = [
            models.Index(fields=['section', 'active']),
            models.Index(fields=['return_definition', 'active']),
        ]

    def __str__(self):
        return f'{self.section.name} - {self.return_definition.code}'

    def clean(self):
        if self.due_day < 1 or self.due_day > 31:
            raise ValidationError({'due_day': 'Due day must be between 1 and 31.'})

        months = self._normalize_months(self.applicable_months)
        if self.return_definition.frequency != ReturnDefinition.FREQUENCY_MONTHLY and not months:
            raise ValidationError(
                {'applicable_months': 'Quarterly and annual returns must define applicable months.'}
            )

    def save(self, *args, **kwargs):
        self.applicable_months = self._normalize_months(self.applicable_months)
        self.full_clean()
        super().save(*args, **kwargs)

    @staticmethod
    def _normalize_months(raw_months):
        if raw_months in (None, ''):
            return []

        if isinstance(raw_months, str):
            raw_months = [token.strip() for token in raw_months.split(',') if token.strip()]

        normalized = sorted({int(month) for month in raw_months})
        invalid = [month for month in normalized if month < 1 or month > 12]
        if invalid:
            raise ValidationError({'applicable_months': 'Months must be between 1 and 12.'})
        return normalized

    def get_active_months(self):
        if self.return_definition.frequency == ReturnDefinition.FREQUENCY_MONTHLY:
            return list(range(1, 13))
        return self._normalize_months(self.applicable_months)

    def applies_to_month(self, month):
        return month in self.get_active_months()

    def get_due_date(self, year, month):
        last_day = monthrange(year, month)[1]
        return date(year, month, min(self.due_day, last_day))


class ReturnPeriodEntry(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_SUBMITTED = 'submitted'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_SUBMITTED, 'Submitted'),
    ]

    return_definition = models.ForeignKey(
        ReturnDefinition,
        on_delete=models.PROTECT,
        related_name='period_entries',
    )
    applicability = models.ForeignKey(
        ReturnApplicability,
        on_delete=models.PROTECT,
        related_name='period_entries',
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.PROTECT,
        related_name='return_period_entries',
    )
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    report_code_snapshot = models.CharField(max_length=50)
    report_name_snapshot = models.CharField(max_length=255)
    frequency_snapshot = models.CharField(max_length=10, choices=ReturnDefinition.FREQUENCY_CHOICES)
    due_day_snapshot = models.PositiveSmallIntegerField()
    due_date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='submitted_returns',
    )
    delay_days = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date', 'report_name_snapshot']
        constraints = [
            models.UniqueConstraint(
                fields=['return_definition', 'section', 'year', 'month'],
                name='unique_return_period_entry',
            )
        ]
        indexes = [
            models.Index(fields=['section', 'year', 'month']),
            models.Index(fields=['year', 'month', 'status']),
            models.Index(fields=['section', 'status']),
        ]

    def __str__(self):
        return f'{self.section.name} - {self.report_code_snapshot} ({self.month}/{self.year})'

    @property
    def is_overdue(self):
        return self.status == self.STATUS_PENDING and timezone.localdate() > self.due_date

    def mark_submitted(self, user):
        if self.status == self.STATUS_SUBMITTED:
            raise ValidationError('This return has already been submitted.')

        submitted_at = timezone.now()
        delay_days = max((submitted_at.date() - self.due_date).days, 0)

        self.status = self.STATUS_SUBMITTED
        self.submitted_at = submitted_at
        self.submitted_by = user
        self.delay_days = delay_days
        self.save(update_fields=['status', 'submitted_at', 'submitted_by', 'delay_days', 'updated_at'])

        ReturnStatusLog.objects.create(
            entry=self,
            action=ReturnStatusLog.ACTION_SUBMITTED,
            performed_by=user,
            metadata={
                'submitted_at': submitted_at.isoformat(),
                'delay_days': delay_days,
            },
        )
        return self


class ReturnStatusLog(models.Model):
    ACTION_SUBMITTED = 'submitted'

    ACTION_CHOICES = [
        (ACTION_SUBMITTED, 'Submitted'),
    ]

    entry = models.ForeignKey(
        ReturnPeriodEntry,
        on_delete=models.CASCADE,
        related_name='status_logs',
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='return_status_logs',
    )
    performed_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-performed_at']
        indexes = [
            models.Index(fields=['entry', 'performed_at']),
            models.Index(fields=['performed_by']),
        ]

    def __str__(self):
        return f'{self.entry} - {self.action}'

