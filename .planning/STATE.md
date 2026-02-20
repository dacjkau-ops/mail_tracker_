# State: Mail Tracker Enhancements

**Current Phase:** Phase 1 - Infrastructure & PDF Backend
**Current Plan:** 03 (next to execute)
**Last Action:** Completed Phase 1 Plan 02 - RecordAttachment Data Model
**Date:** 2026-02-20

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Users can securely attach, store, and view PDF documents with proper access control and audit logging
**Current focus:** Phase 1 - Infrastructure & PDF Backend

## Phase Status

| Phase | Status | Requirements | Completed |
|-------|--------|--------------|-----------|
| 1. Infrastructure & PDF Backend | ◑ In Progress | 29 | 2/2 plans done |
| 2. Role System & Backend Updates | ○ Pending | 16 | 0/16 |
| 3. Frontend & Workflow | ○ Pending | 17 | 0/17 |

## Active Context

**Environment:** Dev laptop (Windows)
**Target:** Ubuntu server (to be set up Monday)
**Database:** PostgreSQL in Docker
**File Storage:** /srv/mailtracker/pdfs (X-Accel-Redirect)

## Decisions Made

- **gunicorn 4 workers / 2 threads** for backend container (balances memory/concurrency on laptop/server)
- **pdf_storage volume rw/ro split** — backend writes, nginx reads-only (enforces storage isolation)
- **pg_isready in entrypoint.sh** rather than Docker-level depends_on healthcheck (uses actual DB credentials)
- **nginx /_protected_pdfs/ with internal directive** — direct browser access blocked, only X-Accel-Redirect from Django allowed
- **UUID primary key on RecordAttachment** — prevents enumeration attacks on future attachment API endpoints
- **pdf_upload_path uses UUID, not original filename** — prevents path traversal from malicious filenames
- **No AuditTrail entries for PDF operations** — PDF_UPLOAD/PDF_REPLACE/PDF_DELETE choices are schema-only for future compatibility; audit captured in RecordAttachment model fields
- **validate_pdf_size reads MAX_PDF_SIZE_MB from settings** — configurable per deployment, defaults to 10MB

## Current Blockers

None

## Notes

- Project initialized from existing Mail Tracker codebase
- Existing system: Django + React, JWT auth, role-based permissions
- New: PDF attachments, Docker deployment, expanded roles, free-text actions
- Dev laptop testing before Monday server deployment
- Docker not available in dev environment — file-level validation used; actual docker build to run on Ubuntu server

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | ~3 min | 5/5 | 6 |
| 01 | 02 | ~4 min | 4/4 | 5 |

## Stopped At

Completed 01-02-PLAN.md (RecordAttachment Data Model). Phase 1 complete. Next: Phase 2.

---
*State tracking for Mail Tracker Enhancements*
