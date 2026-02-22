# State: Mail Tracker v1.1 UI/UX Refresh + Password Change

**Current Phase:** Not started
**Current Plan:** —
**Last Action:** Scoped milestone v1.1 — password change + Mail Detail redesign
**Date:** 2026-02-22

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Users can securely attach, store, and view PDF documents with proper access control and audit logging
**Current focus:** v1.1 — password change for all users + Mail Detail view redesign

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-22 — Milestone v1.1 scoped (password change + UI/UX refresh)

## Phase Status

| Phase | Status | Requirements | Completed |
|-------|--------|--------------|-----------|
| 1. Infrastructure & PDF Backend | ● Done | 29 | 3/3 plans done |
| 2. Role System & Backend Updates | ● Done | 16 | 3/3 plans done |
| 3. Frontend & Workflow | ● Done | 17 | 17/17 |
| 4. Password Change | ○ Pending | — | 0/0 |
| 5. UI/UX Refresh | ○ Pending | — | 0/0 |

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
- **attachment_metadata on both list and detail serializers** — frontend can show attachment status on list rows without an extra API call
- **Other sentinel validation removed from CreateSerializer** — action_required is free-text; the old 'Other' check was obsolete
- **create() branches on role in view body** — serializer validates assignee scope, view forces section/subsection from creator's profile
- **DAG section defaults to first managed section in create()** — avoids error when DAG omits section field; safe default
- **auditor_subsections exposed on UserSerializer** — /api/users/me/ and login response returns subsection IDs for frontend role-scoping
- **canCreateMail() uses array includes()** — expanding from AG-only to all 6 roles; flat array, easy to extend
- **PDF upload failure redirects to ?pdfError=1** — mail record is already created; blocking navigation would orphan the record from user's perspective
- **Two-step form submit pattern** — createMail() then uploadPdf() with graceful degradation; client-side PDF validation (MIME + size) before any network call
- **viewPdf uses Axios blob responseType** — window.open cannot send JWT auth headers, so blob + createObjectURL is mandatory
- **revokeObjectURL after 60s for view, 5s for download** — allows new tab to load before revocation; download anchor click is synchronous
- **ROLE_LABELS defined outside component** — prevents object recreation on every render; covers all 6 roles (AG, DAG, SrAO, AAO, auditor, clerk)
- **Single aliased settings import** — `from django.conf import settings as django_settings` only; bare import removed; inline import inside validate_pdf_size() removed
- **CLEANUP-04 deferred** — remarks/user_remarks fields retained; removal requires migration and frontend fallback read still references mail.remarks

## Current Blockers

None

## Notes

- Project initialized from existing Mail Tracker codebase
- v1.0 shipped: PDF attachments, Docker deployment, expanded roles, free-text actions
- v1.1 focus: UI/UX improvements to Mail Detail view
- All prior phases complete; starting fresh milestone for frontend enhancements

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | ~3 min | 5/5 | 6 |
| 01 | 02 | ~4 min | 4/4 | 5 |
| 01 | 03 | ~6 min | 3/3 | 5 |
| 02 | 01 | ~12 min | 3/3 | 4 |
| 02 | 02 | ~3 min | 2/2 | 2 |
| 02 | 03 | ~4 min | 3/3 | 3 |
| 03 | 01 | ~3 min | 2/2 | 3 |
| 03 | 02 | ~5 min | 2/2 | 3 |
| 03 | 03 | ~3 min | 2/2 | 4 |

## Stopped At

Scoped milestone v1.1 — ready to define requirements and create roadmap

---
*State tracking for Mail Tracker v1.1 UI/UX Refresh*
