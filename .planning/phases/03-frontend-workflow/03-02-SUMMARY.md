---
phase: 03-frontend-workflow
plan: 02
subsystem: ui
tags: [react, mui, axios, blob, pdf, role-based-ui]

# Dependency graph
requires:
  - phase: 01-infrastructure-pdf-backend
    provides: "GET /records/{id}/pdf/view/ endpoint returning X-Accel-Redirect with JWT auth"
  - phase: 02-role-system-backend-updates
    provides: "attachment_metadata in record serializer (has_attachment, original_filename, file_size_human, uploaded_at)"

provides:
  - "mailService.viewPdf(id) — Axios blob fetch for JWT-authenticated PDF retrieval"
  - "MailDetailPage PDF Attachment section — view/download buttons using blob + createObjectURL pattern"
  - "MailDetailPage pdfError=1 query param warning — dismissable Alert for failed upload during create"
  - "MainLayout ROLE_LABELS map — human-readable labels for all 6 roles (AG, DAG, SrAO, AAO, auditor, clerk)"
  - "RemarksEditDialog fully removed — no import, state, handler, or JSX"

affects:
  - 03-frontend-workflow

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Blob pattern for JWT-authenticated file retrieval: api.get with responseType blob, URL.createObjectURL, window.open or anchor download, revokeObjectURL after delay"
    - "Role label map as module-level constant — ROLE_LABELS object outside component to avoid recreation on each render"

key-files:
  created: []
  modified:
    - frontend/src/services/mailService.js
    - frontend/src/layouts/MainLayout.jsx
    - frontend/src/pages/MailDetailPage.jsx

key-decisions:
  - "viewPdf uses Axios blob responseType — window.open cannot send JWT auth headers, so blob + createObjectURL is mandatory"
  - "revokeObjectURL after 60s for view, 5s for download — allows new tab to load before revocation"
  - "ROLE_LABELS defined outside component — prevents object recreation on every render"
  - "pdfUploadWarning driven by ?pdfError=1 query param — allows CreateMailPage to redirect with error signal after failed PDF upload"

patterns-established:
  - "JWT-authenticated file fetch: always use Axios blob responseType, never window.open with raw URL"
  - "Role display: always use ROLE_LABELS lookup with fallback chain (ROLE_LABELS[role] || role || 'User')"

requirements-completed:
  - WORKFLOW-06
  - WORKFLOW-07
  - FRONTEND-04
  - FRONTEND-05
  - FRONTEND-06

# Metrics
duration: 5min
completed: 2026-02-21
---

# Phase 3 Plan 02: PDF Attachment Display and Role Badge Summary

**PDF attachment view/download with JWT-authenticated blob pattern in MailDetailPage, plus human-readable role badge for all 6 roles in MainLayout**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-20T23:54:05Z
- **Completed:** 2026-02-20T23:58:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `mailService.viewPdf(id)` using Axios `responseType: 'blob'` to bypass window.open auth header limitation
- Added PDF Attachment Paper section to MailDetailPage (shows filename, size, upload date, View and Download buttons) — conditionally rendered when `attachment_metadata.has_attachment` is true
- Removed dead `RemarksEditDialog` code (import, state, handler, JSX) — no button ever called `setRemarksDialogOpen(true)`
- Added `pdfUploadWarning` Alert triggered by `?pdfError=1` query param — supports CreateMailPage redirect flow after failed PDF upload
- Added `ROLE_LABELS` constant to MainLayout covering all 6 roles so 'auditor' shows 'Auditor' and 'clerk' shows 'Clerk'

## Task Commits

Each task was committed atomically:

1. **Task 1: Add viewPdf service method and update role badge** - `87a6864` (feat)
2. **Task 2: Add PDF section to MailDetailPage and remove RemarksEditDialog** - `032c6b7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/services/mailService.js` - Added viewPdf(id) method with Axios blob responseType after uploadPdf
- `frontend/src/layouts/MainLayout.jsx` - Added ROLE_LABELS constant outside component; updated Chip to use lookup
- `frontend/src/pages/MailDetailPage.jsx` - Removed RemarksEditDialog; added PdfIcon import, handleViewPdf, handleDownloadPdf, pdfUploadWarning state/effect/Alert, and PDF Attachment Paper section

## Decisions Made

- viewPdf uses Axios blob responseType — window.open cannot send JWT auth headers, so blob + createObjectURL is mandatory
- revokeObjectURL after 60s for view (allows tab to load), 5s for download (anchor click is synchronous)
- ROLE_LABELS defined outside component to avoid object recreation on every render
- pdfUploadWarning driven by ?pdfError=1 query param so CreateMailPage can signal failure via redirect

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - build succeeded cleanly on first attempt. The chunk size warning in the build output is pre-existing and unrelated to these changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 complete: PDF attachment display working in MailDetailPage with proper blob auth pattern
- Plan 03 (mail creation form with PDF upload) can now redirect to detail page with ?pdfError=1 on upload failure and the warning will display automatically
- All attachment_metadata fields consumed by MailDetailPage — backend serializer integration complete

## Self-Check: PASSED

- FOUND: frontend/src/services/mailService.js
- FOUND: frontend/src/layouts/MainLayout.jsx
- FOUND: frontend/src/pages/MailDetailPage.jsx
- FOUND: .planning/phases/03-frontend-workflow/03-02-SUMMARY.md
- FOUND commit: 87a6864
- FOUND commit: 032c6b7

---
*Phase: 03-frontend-workflow*
*Completed: 2026-02-21*
