from io import BytesIO
import threading

from django.contrib import admin
from django.db import close_old_connections
from django.utils import timezone

from users.models import User, UserImportJob


SUMMARY_PREVIEW_LIMIT = 20


def _build_preview(items, limit=SUMMARY_PREVIEW_LIMIT):
    if not items:
        return []
    return items[:limit]


def process_user_import_job(job_id):
    close_old_connections()

    job = UserImportJob.objects.get(id=job_id)
    if job.status not in {'queued', 'failed'}:
        return job

    job.status = 'running'
    job.started_at = timezone.now()
    job.failure_message = ''
    job.save(update_fields=['status', 'started_at', 'failure_message'])

    try:
        from users.admin import UserAdmin

        importer = UserAdmin(User, admin.site)
        payload_bytes = job.payload.encode('utf-8')
        if job.file_format == 'csv':
            results = importer._import_from_csv(BytesIO(payload_bytes))
        else:
            results = importer._import_from_json(BytesIO(payload_bytes))

        created = results.get('created', [])
        skipped = results.get('skipped', [])
        errors = results.get('errors', [])

        job.status = 'completed'
        job.created_count = len(created)
        job.skipped_count = len(skipped)
        job.error_count = len(errors)
        job.summary = {
            'created_preview': _build_preview(created),
            'skipped_preview': _build_preview(skipped),
            'error_preview': _build_preview(errors),
        }
    except Exception as exc:
        job.status = 'failed'
        job.failure_message = str(exc)
        job.error_count = 1
        job.summary = {
            'error_preview': [str(exc)],
        }
    finally:
        job.finished_at = timezone.now()
        job.save(
            update_fields=[
                'status',
                'created_count',
                'skipped_count',
                'error_count',
                'summary',
                'failure_message',
                'finished_at',
            ]
        )
        close_old_connections()

    return job


def start_user_import_job(job_id):
    worker = threading.Thread(
        target=process_user_import_job,
        args=(job_id,),
        daemon=True,
        name=f'user-import-job-{job_id}',
    )
    worker.start()
    return worker
