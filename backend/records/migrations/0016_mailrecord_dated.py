from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('records', '0015_mailrecord_current_handler_nullable'),
    ]

    operations = [
        migrations.AddField(
            model_name='mailrecord',
            name='dated',
            field=models.DateField(
                blank=True,
                help_text='Actual date printed on the letter',
                null=True,
            ),
        ),
    ]
