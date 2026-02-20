---
phase: 01-infrastructure-pdf-backend
plan: 03
subsystem: api
tags: [django, drf, pdf, x-accel-redirect, nginx, file-storage, permissions]

# Dependency graph
requires:
  - phase: 01-infrastructure-pdf-backend
    plan: 02
    provides: RecordAttachment model (without upload_stage), validate_pdf_extension, validate_pdf_size validators, is_current field
provides:
  - RecordAttachment.upload_stage field (created/closed) with migration
  - RecordAttachment uses get_pdf_storage callable (lazy FileSystemStorage)
  - RecordAttachment.stored_filename property for X-Accel-Redirect
  - RecordAttachment.get_metadata_dict() method
  - POST /api/records/{id}/pdf/ — upload endpoint with stage-based replacement
  - GET /api/records/{id}/pdf/ — metadata endpoint
  - GET /api/records/{id}/pdf/view/ — X-Accel-Redirect serve endpoint
  - PDF_STORAGE_PATH, FILE_UPLOAD_MAX_MEMORY_SIZE, DATA_UPLOAD_MAX_MEMORY_SIZE settings
  - MailRecordPermission gates for all three PDF actions
affects:
  - Phase 2: role system updates that integrate PDF into workflow
  - Phase 3: frontend components for PDF upload/view UI

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Callable storage pattern: storage=get_pdf_storage (not get_pdf_storage()) for lazy evaluation"
    - "X-Accel-Redirect pattern: Django returns HttpResponse with X-Accel-Redirect header, nginx serves file"
    - "Stage-based PDF replacement: mark existing is_current=False, create new, all in transaction.atomic()"
    - "upload_to=pdf_upload_path generates uuid4.pdf filename, ignoring original (path traversal prevention)"

key-files:
  created:
    - backend/records/migrations/0011_add_upload_stage_to_recordattachment.py
  modified:
    - backend/records/models.py
    - backend/records/serializers.py
    - backend/records/views.py
    - backend/config/permissions.py
    - backend/config/settings.py

key-decisions:
  - "get_pdf_storage is passed as a callable (not called) to FileField.storage — Django calls it lazily per instance, avoids import-time side effects"
  - "pdf_upload_path uses uuid4 (not instance.id) since instance.id (UUID pk) exists at model instantiation but we generate a fresh UUID per file to avoid collisions if same record uploads twice"
  - "view_pdf returns raw HttpResponse (not DRF Response) to preserve custom headers that DRF content negotiation would strip"
  - "X-Accel-Redirect path: /_protected_pdfs/{stored_filename} — aligns with nginx internal location from 01-PLAN.md"
  - "Workflow stage restriction enforced in upload_pdf view: created-stage upload requires Received/Assigned status; closed-stage requires Closed status"
  - "PDF permission gates: upload_pdf allows AG always, DAG if section matches, SrAO/AAO if current_handler; metadata/view reuses _can_view_mail"

patterns-established:
  - "PDF upload: PDFUploadSerializer validates extension + size before any file I/O"
  - "PDF metadata: get_metadata_dict() on model keeps serialization logic close to data"
  - "PDF replacement: filter(upload_stage=stage, is_current=True).first() then set is_current=False"

requirements-completed:
  - PDF-02
  - PDF-03
  - PDF-04
  - PDF-05
  - PDF-06
  - PDF-07
  - PDF-08

# Metrics
duration: 6min
completed: 2026-02-20
---

# Phase 1 Plan 3: PDF API Endpoints Summary

**Three REST API endpoints for PDF upload, metadata retrieval, and X-Accel-Redirect serving on MailRecordViewSet, with stage-based replacement logic and role-aware permission gates**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-20T04:02:40Z
- **Completed:** 2026-02-20T04:08:08Z
- **Tasks:** 3/3
- **Files modified:** 5

## Accomplishments
- Added `upload_stage` field to RecordAttachment with migration 0011, enabling per-stage (created/closed) PDF tracking
- Exposed three PDF endpoints on MailRecordViewSet: POST/GET `/api/records/{id}/pdf/` and GET `/api/records/{id}/pdf/view/`
- view_pdf returns raw HttpResponse with X-Accel-Redirect header so nginx serves the file directly without Django streaming bytes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add upload_stage to RecordAttachment and configure PDF storage settings** - `4c90266` (feat)
2. **Task 2: Create migration for upload_stage field** - `d389807` (chore)
3. **Task 3: Add PDF serializers and three PDF endpoint actions to MailRecordViewSet** - `de64d3a` (feat)

## Files Created/Modified
- `backend/records/models.py` - Added get_pdf_storage() callable, updated pdf_upload_path() to use fresh uuid4, added upload_stage field, updated FileField to use callable storage, added stored_filename property and get_metadata_dict() method
- `backend/records/migrations/0011_add_upload_stage_to_recordattachment.py` - Generated migration for upload_stage, updated file storage, updated is_current help_text
- `backend/records/serializers.py` - Added import os, PDFUploadSerializer (validates .pdf extension + 10MB limit), PDFMetadataSerializer
- `backend/records/views.py` - Added imports for HttpResponse, RecordAttachment, PDF serializers; added upload_pdf, get_pdf_metadata, view_pdf actions
- `backend/config/permissions.py` - Added PDF actions to has_permission allowlist; added object-level gates for upload_pdf (role-based) and get_pdf_metadata/view_pdf (mirrors view permission)
- `backend/config/settings.py` - Added PDF_STORAGE_PATH (env var or BASE_DIR/pdfs), FILE_UPLOAD_MAX_MEMORY_SIZE (10MB), DATA_UPLOAD_MAX_MEMORY_SIZE (10MB)

## Decisions Made
- Used `storage=get_pdf_storage` (callable) not `storage=get_pdf_storage()` (instance) so Django evaluates storage lazily per-instance, avoiding import-time file system side effects
- `pdf_upload_path` generates a fresh `uuid4()` filename rather than using `instance.id` (the UUIDField primary key). Both are UUIDs, but uuid4() here ensures each file gets a unique name even if the same record uploads multiple times at the same stage
- `view_pdf` returns a raw `HttpResponse` rather than a DRF `Response` — DRF content negotiation strips custom headers like X-Accel-Redirect
- Permission design: upload_pdf requires ability to create/handle mail; view endpoints reuse the existing _can_view_mail() helper for consistency

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- All three PDF endpoints are functional and permission-gated
- X-Accel-Redirect pattern is established; nginx internal location (configured in 01-PLAN.md) must be running for view_pdf to serve files in production
- Phase 2 can integrate PDF upload into the mail creation and close workflows on the frontend

---
*Phase: 01-infrastructure-pdf-backend*
*Completed: 2026-02-20*
