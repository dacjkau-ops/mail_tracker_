---
phase: 03-frontend-workflow
plan: 01
subsystem: ui
tags: [react, mui, react-hook-form, pdf-upload, roles]

# Dependency graph
requires:
  - phase: 01-infrastructure-pdf-backend
    provides: POST /records/{id}/pdf/ endpoint accepting multipart/form-data with upload_stage field
  - phase: 02-role-system-backend-updates
    provides: auditor and clerk roles; free-text action_required on CreateSerializer

provides:
  - canCreateMail() returns true for all 6 roles (AG, DAG, SrAO, AAO, auditor, clerk)
  - mailService.uploadPdf(id, file) posting FormData with upload_stage='created' to /records/{id}/pdf/
  - CreateMailPage with free-text TextField for action_required (no Select/dropdown)
  - CreateMailPage with optional PDF file input (client-side PDF type and 10 MB size validation)
  - Two-step submit flow: createMail() then uploadPdf(); PDF failure redirects to ?pdfError=1

affects:
  - 03-frontend-workflow (downstream plans that render mail detail or handle pdfError query param)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-step form submit: create resource then upload attachment; graceful degradation on upload failure"
    - "Client-side file validation before multipart POST: check MIME type and size before any network call"
    - "Role array membership check for canCreateMail() — single source of truth, easy to extend"

key-files:
  created: []
  modified:
    - frontend/src/context/AuthContext.jsx
    - frontend/src/services/mailService.js
    - frontend/src/pages/CreateMailPage.jsx

key-decisions:
  - "canCreateMail() uses array includes() — expanding from AG-only to all 6 roles via ['AG','DAG','SrAO','AAO','auditor','clerk']"
  - "PDF upload failure after mail creation redirects to ?pdfError=1 rather than blocking — mail record is already created and should be accessible"
  - "LinearProgress imported for future upload progress indicator (matches plan spec) but not yet wired to upload progress events"

patterns-established:
  - "Two-step submit: createMail() → uploadPdf() with graceful fallback to ?pdfError=1 on PDF failure"
  - "File input hidden inside Button component='label' for native file dialog without custom styling"

requirements-completed:
  - WORKFLOW-01
  - WORKFLOW-02
  - WORKFLOW-03
  - FRONTEND-01
  - FRONTEND-02
  - FRONTEND-03

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 3 Plan 01: Frontend Create Mail — Free-text Action + PDF Upload Summary

**Free-text action_required TextField with optional two-step PDF upload via mailService.uploadPdf() and canCreateMail() expanded to all six roles**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-20T23:53:55Z
- **Completed:** 2026-02-20T23:57:20Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- canCreateMail() updated to return true for AG, DAG, SrAO, AAO, auditor, and clerk — nav Create Mail button now accessible to all roles
- mailService.uploadPdf(id, file) added: posts FormData with `file` and `upload_stage='created'` to `/records/{id}/pdf/`
- CreateMailPage action_required field replaced: Select/dropdown with hardcoded options removed, free-text TextField added with placeholder "e.g. Review, Approve, Process..."
- PDF upload section added to create form: client-side validation rejects non-PDF and files over 10 MB before any network call
- Two-step onSubmit implemented: createMail() first, then uploadPdf() if a file is selected; PDF failure redirects to `/mails/{id}?pdfError=1` rather than rolling back the created record

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand canCreateMail and add uploadPdf service method** - `c37b01c` (feat)
2. **Task 2: Rewrite CreateMailPage — free-text action_required + PDF upload** - `5f746e3` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/context/AuthContext.jsx` - canCreateMail() now returns true for all 6 roles
- `frontend/src/services/mailService.js` - Added uploadPdf(id, file) method posting multipart FormData
- `frontend/src/pages/CreateMailPage.jsx` - Replaced Select with TextField for action_required; added PDF file input with validation; two-step submit flow

## Decisions Made

- canCreateMail() uses array `includes()` — readable, flat, easily extended if new roles are added
- PDF upload failure after mail creation redirects to `?pdfError=1` rather than blocking — the mail record already exists in the database; blocking navigation would orphan the record from the user's perspective
- `LinearProgress` imported (matches plan spec) but not yet wired to upload progress events — left for future enhancement when byte-level progress feedback is needed

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- canCreateMail() and uploadPdf() are ready for all downstream frontend pages to reference
- Detail page (next plan) should handle `?pdfError=1` query param and display a warning alert
- Build passes cleanly (exit 0); only pre-existing chunk size warning unrelated to these changes

---
*Phase: 03-frontend-workflow*
*Completed: 2026-02-21*
