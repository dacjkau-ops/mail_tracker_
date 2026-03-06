from django.db import migrations


def backfill_auditor_subsection(apps, schema_editor):
    User = apps.get_model('users', 'User')
    through_model = User.auditor_subsections.through

    auditors = User.objects.filter(role='auditor')
    for user in auditors.iterator():
        mapped_sub_ids = list(
            through_model.objects.filter(user_id=user.id)
            .order_by('subsection_id')
            .values_list('subsection_id', flat=True)
        )

        # If FK subsection is missing but mapping exists, backfill FK.
        if not user.subsection_id and mapped_sub_ids:
            user.subsection_id = mapped_sub_ids[0]
            user.save(update_fields=['subsection'])

        # If FK subsection exists but mapping missing, keep mapping in sync.
        if user.subsection_id and user.subsection_id not in mapped_sub_ids:
            through_model.objects.create(user_id=user.id, subsection_id=user.subsection_id)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0010_user_actual_role'),
    ]

    operations = [
        migrations.RunPython(backfill_auditor_subsection, noop_reverse),
    ]

