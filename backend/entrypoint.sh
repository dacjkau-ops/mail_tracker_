#!/bin/sh
set -e

echo "Waiting for postgres..."
while ! pg_isready -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1; do
    sleep 1
done
echo "Postgres is ready."

echo "Running migrations..."
python manage.py migrate --noinput

if [ "${BOOTSTRAP_ON_START:-True}" = "True" ]; then
    echo "Bootstrapping application data..."
    python manage.py bootstrap_system --no-input
fi

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting gunicorn..."
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${WEB_CONCURRENCY:-4}" \
    --threads "${GUNICORN_THREADS:-2}" \
    --timeout "${GUNICORN_TIMEOUT:-300}" \
    --access-logfile - \
    --error-logfile -
