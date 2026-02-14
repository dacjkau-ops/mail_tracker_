from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_alter_user_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='is_primary_ag',
            field=models.BooleanField(
                default=False,
                help_text='Use this AG as default monitoring fallback when multiple AG users exist.'
            ),
        ),
        migrations.AddConstraint(
            model_name='user',
            constraint=models.UniqueConstraint(
                condition=models.Q(role='AG', is_primary_ag=True),
                fields=('is_primary_ag',),
                name='unique_primary_ag_user',
            ),
        ),
    ]
