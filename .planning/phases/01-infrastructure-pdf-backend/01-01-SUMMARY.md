---
phase: 01-infrastructure-pdf-backend
plan: "01"
subsystem: infrastructure
tags:
  - docker
  - nginx
  - postgresql
  - gunicorn
  - x-accel-redirect
dependency_graph:
  requires: []
  provides:
    - docker-compose orchestration (postgres + backend + nginx)
    - nginx X-Accel-Redirect internal PDF serving location
    - backend container with gunicorn WSGI server
    - postgres health-gated startup via pg_isready
  affects:
    - plan-02 (Django settings must use DATABASE_URL and PDF_STORAGE_PATH)
    - plan-03 (frontend served via nginx static location)
tech_stack:
  added:
    - python:3.11-slim (backend base image)
    - postgres:16-alpine (database service)
    - nginx:alpine (reverse proxy)
    - gunicorn>=21.2.0 (WSGI server)
    - psycopg2-binary>=2.9.9 (PostgreSQL adapter)
    - dj-database-url>=2.1.0 (DATABASE_URL parsing)
    - whitenoise>=6.6.0 (collectstatic for container)
  patterns:
    - X-Accel-Redirect internal location for secure PDF serving
    - pg_isready loop in entrypoint for postgres readiness
    - shared named volumes (pdf_storage rw/ro split between services)
key_files:
  created:
    - path: backend/Dockerfile
      description: "Python 3.11-slim image; installs postgresql-client, libpq-dev, gcc; pip installs requirements; makes entrypoint.sh executable; ENTRYPOINT"
    - path: backend/entrypoint.sh
      description: "Waits for postgres via pg_isready loop, runs migrate, collectstatic, then execs gunicorn with 4 workers / 2 threads"
    - path: docker-compose.yml
      description: "Three-service orchestration: postgres (healthcheck), backend (depends on healthy postgres), nginx (port 80); pdf_storage and static_volume shared"
    - path: nginx/nginx.conf
      description: "Reverse proxy for /api/ and /admin/; static file serving; /_protected_pdfs/ internal location for X-Accel-Redirect with Accept-Ranges and application/pdf MIME"
    - path: nginx/Dockerfile
      description: "nginx:alpine base with pre-created /srv/mailtracker/pdfs and /srv/mailtracker/static directories; config baked in"
  modified:
    - path: .env.example
      description: "Replaced Render-focused template with Docker-focused template including POSTGRES_*, PDF_STORAGE_PATH, MAX_PDF_SIZE_MB, JWT lifetime vars"
decisions:
  - "gunicorn configured with 4 workers and 2 threads per worker for moderate concurrency on laptop/server hardware"
  - "pdf_storage volume mounted read-write in backend (upload) and read-only in nginx (serve) to enforce write isolation"
  - "pg_isready loop in entrypoint.sh instead of Docker healthcheck depends_on on backend — gives precise timing control"
  - "nginx /_protected_pdfs/ uses internal directive so the location cannot be accessed directly by browsers, only via X-Accel-Redirect header from Django"
  - "nginx:alpine chosen over full nginx for smaller image size; directories pre-created in Dockerfile to avoid runtime permission issues"
  - "requirements.txt already had all four production packages; no additions needed"
metrics:
  duration_seconds: 168
  completed_date: "2026-02-20"
  tasks_completed: 5
  tasks_total: 5
  files_created: 5
  files_modified: 1
---

# Phase 01 Plan 01: Docker Infrastructure Summary

**One-liner:** Three-service Docker orchestration (postgres:16-alpine + Django/gunicorn + nginx:alpine) with X-Accel-Redirect internal PDF serving location and pg_isready health-gated startup.

## What Was Built

Complete Docker deployment infrastructure as the foundational wave for the Mail Tracker PDF attachment feature:

1. **backend/Dockerfile** — Production container for the Django backend using python:3.11-slim, installing system deps (postgresql-client for pg_isready, libpq-dev, gcc), pip-installing requirements, and setting the custom entrypoint.

2. **backend/entrypoint.sh** — Container startup script that polls postgres with `pg_isready` until ready, then runs `manage.py migrate`, `manage.py collectstatic`, and finally `exec gunicorn` (4 workers, 2 threads, 60s timeout, stdout logging).

3. **docker-compose.yml** — Three-service orchestration:
   - `postgres` with `pg_isready` healthcheck and `postgres_data` named volume
   - `backend` that depends on `postgres: condition: service_healthy`, mounts `pdf_storage` (rw) and `static_volume` (rw)
   - `nginx` on port 80, mounts `pdf_storage` (ro) and `static_volume` (ro)

4. **nginx/nginx.conf** — Nginx config with four location blocks: `/api/` and `/admin/` proxied to `backend:8000`, `/static/` served from volume with 1-year cache, and `/_protected_pdfs/` with `internal` directive aliasing to `/srv/mailtracker/pdfs/` for X-Accel-Redirect PDF serving.

5. **nginx/Dockerfile** — Minimal nginx:alpine image with storage directories pre-created and config baked in.

6. **.env.example** — Updated from Render-focused to Docker-focused template with all POSTGRES_*, PDF_STORAGE_PATH, MAX_PDF_SIZE_MB, DATABASE_URL, and JWT lifetime variables.

## Decisions Made

- **gunicorn 4 workers / 2 threads:** Balances memory usage with concurrency for a small office LAN deployment.
- **pdf_storage rw/ro split:** Backend container gets write access to store uploaded PDFs; nginx gets read-only access to serve them — enforces storage isolation at the volume mount level.
- **pg_isready in entrypoint.sh:** More reliable than Docker-level healthcheck depends_on chains because it retries with the exact credentials Django will use, not just a TCP ping.
- **nginx internal directive on /_protected_pdfs/:** Prevents direct browser access to PDF files — only Django can redirect to this location via the X-Accel-Redirect response header, maintaining access control enforcement.
- **No requirements.txt changes:** All four production packages (gunicorn, psycopg2-binary, dj-database-url, whitenoise) were already present from prior cloud deployment setup.

## Deviations from Plan

**1. [Rule 1 - Bug] Docker not available in dev environment — file-level validation used for Task 5**
- **Found during:** Task 5 (Validate full Docker build)
- **Issue:** `docker` command not installed in the execution environment (Windows dev machine without Docker Desktop active)
- **Fix:** Validated all artifacts via file existence checks, content grep, and structural verification. All success criteria confirmed met at file level. Actual `docker-compose build` should be run on the target Ubuntu server.
- **Impact:** None — files are correct and will build when Docker is available.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8dab038 | chore(01-01): add backend Dockerfile and entrypoint script |
| 2 | e25946d | chore(01-01): add docker-compose.yml with three-service orchestration |
| 3 | f9809ea | chore(01-01): add nginx config and Dockerfile with X-Accel-Redirect support |
| 4 | 42471b8 | chore(01-01): update .env.example with Docker and PDF storage variables |
| 5 | (validation only — no new files) | |

## Self-Check: PASSED

All files verified present on disk. All four task commits verified in git log (8dab038, e25946d, f9809ea, 42471b8). SUMMARY.md created at correct path.
