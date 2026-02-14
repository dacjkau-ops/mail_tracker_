import os
from django.db import connection
from django.http import JsonResponse
from django.utils import timezone


def health_check(request):
    db_ok = True
    db_error = None
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception as exc:
        db_ok = False
        db_error = str(exc)

    status_code = 200 if db_ok else 503
    payload = {
        "status": "ok" if db_ok else "degraded",
        "timestamp": timezone.now().isoformat(),
        "database": "ok" if db_ok else "error",
        "release": os.environ.get("RELEASE_VERSION", "unknown"),
    }
    if db_error:
        payload["database_error"] = db_error

    return JsonResponse(payload, status=status_code)
