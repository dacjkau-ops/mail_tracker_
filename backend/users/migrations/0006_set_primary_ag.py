from django.db import migrations


def set_primary_ag(apps, schema_editor):
    User = apps.get_model('users', 'User')
    if User.objects.filter(role='AG', is_active=True, is_primary_ag=True).exists():
        return

    first_active_ag = User.objects.filter(role='AG', is_active=True).order_by('id').first()
    if first_active_ag:
        first_active_ag.is_primary_ag = True
        first_active_ag.save(update_fields=['is_primary_ag'])


def unset_primary_ag(apps, schema_editor):
    User = apps.get_model('users', 'User')
    User.objects.filter(role='AG', is_primary_ag=True).update(is_primary_ag=False)


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_user_is_primary_ag'),
    ]

    operations = [
        migrations.RunPython(set_primary_ag, reverse_code=unset_primary_ag),
    ]
