# State: Mail Tracker Enhancements

**Current Phase:** 2
**Current Plan:** 03 (next)
**Last Action:** Completed Phase 2 Plan 02 - Permission and Queryset Role Hierarchy
**Date:** 2026-02-21

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Users can securely attach, store, and view PDF documents with proper access control and audit logging
**Current focus:** Phase 2 - Role System & Backend Updates

## Phase Status

| Phase | Status | Requirements | Completed |
|-------|--------|--------------|-----------|
| 1. Infrastructure & PDF Backend | ● Done | 29 | 3/3 plans done |
| 2. Role System & Backend Updates | ◑ In Progress | 16 | 5/16 (Plans 01, 02 complete) |
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
- **get_pdf_storage passed as callable** to FileField.storage, not called at definition time — avoids import-time filesystem side effects
- **view_pdf returns raw HttpResponse** (not DRF Response) to preserve X-Accel-Redirect header through DRF content negotiation
- **Workflow stage restrictions in upload_pdf**: created-stage upload requires Received/Assigned; closed-stage requires Closed status
- **auditor escalates to SrAO/AAO, not DAG** — get_dag() for auditor returns first active SrAO/AAO in primary auditor subsection
- **clerk reuses subsection FK** — no new field; clerk uses existing subsection ForeignKey, get_dag() falls into same else branch as SrAO/AAO
- **action_required_other retained** — legacy field preserved as-is; cleanup deferred
- **action_required free-text with no data migration** — existing values all fit in 500 chars; blank=True allows empty strings
- **create action allows all authenticated users in has_permission()** — view enforces role-based scoping (DAG/clerk create logic in Plan 03)
- **SrAO/AAO visibility expanded to subsection-level** — Q(subsection=user.subsection) added; existing assignment/touched fallbacks preserved
- **Auditor reassign target double-enforced** — both _get_reassign_candidates_queryset() (SrAO/AAO only) and reassign() view (explicit 403) enforce auditor-to-SrAO/AAO restriction
- **Auditor section-level fallback in queryset** — Q(subsection__isnull=True, section__subsections__id__in=ids) covers mails with no subsection set
- **Existing view guards untouched** — multi_assign, reopen, close-multi already correctly block auditor/clerk

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
| 01 | 03 | ~6 min | 3/3 | 5 |
| 02 | 01 | ~12 min | 3/3 | 4 |
| 02 | 02 | ~3 min | 2/2 | 2 |

## Stopped At

Completed 02-02-PLAN.md (Permission and Queryset Role Hierarchy). Phase 2 Plan 02 complete (2/2 tasks). Next: Phase 2, Plan 03.

---
*State tracking for Mail Tracker Enhancements*
