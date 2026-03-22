from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('sections', '0003_alter_section_id_alter_section_name_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ReturnDefinition',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=50, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, default='')),
                ('frequency', models.CharField(choices=[('monthly', 'Monthly'), ('quarterly', 'Quarterly'), ('annual', 'Annual')], max_length=10)),
                ('active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['name'],
                'indexes': [
                    models.Index(fields=['code'], name='returns_ret_code_53b4a8_idx'),
                    models.Index(fields=['active'], name='returns_ret_active_836121_idx'),
                    models.Index(fields=['frequency', 'active'], name='returns_ret_frequen_8a3945_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='ReturnApplicability',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('due_day', models.PositiveSmallIntegerField(help_text='Calendar day of the month on which this return is due.')),
                ('applicable_months', models.JSONField(blank=True, default=list, help_text='Month numbers (1-12). Leave blank for monthly returns.')),
                ('active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('return_definition', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='applicabilities', to='returns.returndefinition')),
                ('section', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='return_applicabilities', to='sections.section')),
            ],
            options={
                'ordering': ['section__name', 'return_definition__name'],
                'indexes': [
                    models.Index(fields=['section', 'active'], name='returns_ret_section_b8caf8_idx'),
                    models.Index(fields=['return_definition', 'active'], name='returns_ret_return__b0fb4d_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='ReturnPeriodEntry',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('year', models.PositiveIntegerField()),
                ('month', models.PositiveSmallIntegerField()),
                ('report_code_snapshot', models.CharField(max_length=50)),
                ('report_name_snapshot', models.CharField(max_length=255)),
                ('frequency_snapshot', models.CharField(choices=[('monthly', 'Monthly'), ('quarterly', 'Quarterly'), ('annual', 'Annual')], max_length=10)),
                ('due_day_snapshot', models.PositiveSmallIntegerField()),
                ('due_date', models.DateField()),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('submitted', 'Submitted')], default='pending', max_length=10)),
                ('submitted_at', models.DateTimeField(blank=True, null=True)),
                ('delay_days', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('applicability', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='period_entries', to='returns.returnapplicability')),
                ('return_definition', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='period_entries', to='returns.returndefinition')),
                ('section', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='return_period_entries', to='sections.section')),
                ('submitted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='submitted_returns', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['due_date', 'report_name_snapshot'],
                'indexes': [
                    models.Index(fields=['section', 'year', 'month'], name='returns_ret_section_3b1639_idx'),
                    models.Index(fields=['year', 'month', 'status'], name='returns_ret_year_758d21_idx'),
                    models.Index(fields=['section', 'status'], name='returns_ret_section_62f240_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='ReturnStatusLog',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('submitted', 'Submitted')], max_length=20)),
                ('performed_at', models.DateTimeField(auto_now_add=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('entry', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='status_logs', to='returns.returnperiodentry')),
                ('performed_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='return_status_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-performed_at'],
                'indexes': [
                    models.Index(fields=['entry', 'performed_at'], name='returns_ret_entry_i_17a179_idx'),
                    models.Index(fields=['performed_by'], name='returns_ret_perform_32eafc_idx'),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name='returnapplicability',
            constraint=models.UniqueConstraint(fields=('return_definition', 'section'), name='unique_return_applicability_per_section'),
        ),
        migrations.AddConstraint(
            model_name='returnperiodentry',
            constraint=models.UniqueConstraint(fields=('return_definition', 'section', 'year', 'month'), name='unique_return_period_entry'),
        ),
    ]
