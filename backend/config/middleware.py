import logging
import time
from django.conf import settings


logger = logging.getLogger(__name__)


class SlowRequestLoggingMiddleware:
    """
    Logs requests that exceed the configured threshold.
    Controlled by SLOW_REQUEST_MS env var via settings.
    """
    def __init__(self, get_response):
        self.get_response = get_response
        self.threshold_ms = getattr(settings, 'SLOW_REQUEST_MS', 500)

    def __call__(self, request):
        start = time.perf_counter()
        response = self.get_response(request)
        duration_ms = (time.perf_counter() - start) * 1000

        if duration_ms >= self.threshold_ms:
            logger.warning(
                "Slow request: method=%s path=%s status=%s duration_ms=%.2f user_id=%s",
                request.method,
                request.path,
                getattr(response, 'status_code', 'n/a'),
                duration_ms,
                getattr(getattr(request, 'user', None), 'id', None),
            )
        return response
