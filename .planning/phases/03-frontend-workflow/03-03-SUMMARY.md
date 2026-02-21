---
phase: 03-frontend-workflow
plan: 03
subsystem: cleanup
tags: [dead-code-removal, python, react, docs]

# Dependency graph
requires:
  - phase: 03-frontend-workflow
    plan: 01
    provides: "CreateMailPage with free-text action_required; canCreateMail() for all 6 roles; all ACTION_REQUIRED_OPTIONS consumers removed"
  - phase: 03-frontend-workflow
    plan: 02
    provides: "RemarksEditDialog removed from MailDetailPage; PDF attachment section implemented"

provides:
  - "RemarksEditDialog.jsx deleted from repository (file previously unused after Plan 02 cleanup)"
  - "ACTION_REQUIRED_OPTIONS export removed from constants.js (zero references across frontend/src)"
  - "backend/records/models.py with single aliased settings import: `from django.conf import settings as django_settings`"
  - "CLAUDE.md updated: action_required described as free-text field, no dropdown options list"

affects:
  - "No downstream consumers — this is terminal cleanup"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single aliased import pattern for django.conf settings: always use `as django_settings` to avoid bare settings. references"

key-files:
  created: []
  modified:
    - frontend/src/utils/constants.js
    - backend/records/models.py
    - CLAUDE.MD
  deleted:
    - frontend/src/components/RemarksEditDialog.jsx

key-decisions:
  - "Remove bare `from django.conf import settings` and keep only aliased form — get_pdf_storage and validate_pdf_size both use django_settings alias; bare form was unused"
  - "ACTION_REQUIRED_OPTIONS removed entirely — free-text action_required introduced in Phase 2; no consumers remain after Plans 01-02"
  - "CLEANUP-04 (deprecated remarks/user_remarks fields) assessed and intentionally retained — removing would require a migration and frontend still reads mail.remarks as fallback"
  - "backend/sample_data/ files confirmed tracked in git — reference data, not build artifacts; left in place"

patterns-established:
  - "Aliased django.conf settings import: single top-level `from django.conf import settings as django_settings` removes need for inline imports"

requirements-completed:
  - CLEANUP-01
  - CLEANUP-02
  - CLEANUP-03
  - CLEANUP-05
  - CLEANUP-06

requirements-deferred:
  - CLEANUP-04: assessed — remarks/user_remarks fields intentionally retained; removal requires migration and frontend fallback read

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 3 Plan 03: Codebase Cleanup — Dead Code and Stale Docs Summary

**Deleted RemarksEditDialog.jsx, removed ACTION_REQUIRED_OPTIONS from constants.js, consolidated models.py to single aliased settings import, updated CLAUDE.md to reflect free-text action_required**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-21T00:02:22Z
- **Completed:** 2026-02-21T00:07:00Z
- **Tasks:** 2/2
- **Files modified:** 3
- **Files deleted:** 1

## Accomplishments

- RemarksEditDialog.jsx deleted — the component was already removed from MailDetailPage.jsx (Plan 02); the file itself was the only remaining reference
- ACTION_REQUIRED_OPTIONS array and export removed from constants.js — free-text action_required replaced the dropdown in Plan 01; zero consumers remained across frontend/src/
- backend/records/models.py consolidated from two settings imports to one: removed bare `from django.conf import settings` (unused), removed redundant inline import inside validate_pdf_size(), replaced all bare `settings.AUTH_USER_MODEL` references with `django_settings.AUTH_USER_MODEL`
- CLAUDE.md line 289 updated from "action_required dropdown shows: Review, Approve, Process, File, Reply, Other" to "action_required is a free-text field (max 500 chars); the old dropdown options are no longer enforced"
- Confirmed frontend/dist and backend/staticfiles are gitignored (frontend/.gitignore:11 and .gitignore:22 respectively)
- Confirmed backend/sample_data/ (README.md, sections_sample.csv, sections_sample.json) is tracked in git and left in place

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove dead frontend code and fix backend duplicate import** - `ddeeacb` (chore)
2. **Task 2: Update CLAUDE.md and confirm git hygiene** - `247fdee` (docs)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/utils/constants.js` - ACTION_REQUIRED_OPTIONS block (lines 20-28) removed; all other constants untouched
- `backend/records/models.py` - Duplicate bare settings import removed; inline import inside validate_pdf_size() removed; all settings.AUTH_USER_MODEL replaced with django_settings.AUTH_USER_MODEL
- `CLAUDE.MD` - Line 289 updated to describe free-text action_required
- `frontend/src/components/RemarksEditDialog.jsx` - DELETED

## Decisions Made

- Bare `from django.conf import settings` removed entirely — `get_pdf_storage()` and `validate_pdf_size()` both use `django_settings`; the bare form was never referenced
- CLEANUP-04 (deprecated remarks/user_remarks DB fields) intentionally NOT removed — removing would require a migration, and MailDetailPage reads `mail.remarks` as a fallback. Assessed and documented as deferred, not blocked
- sample_data files confirmed intentionally tracked — they are reference CSV/JSON for seeding sections, not build artifacts

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. py_compile passed on first attempt. npm build exit 0 (pre-existing chunk size warning unrelated to these changes).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 3 Plan 03 is the final cleanup plan; Phase 3 is now complete
- Codebase is clean: no dead exports, no duplicate imports, no stale docs
- Build artifacts correctly gitignored; sample data correctly tracked
- All 17 Phase 3 requirements addressed (CLEANUP-04 intentionally deferred)

## Self-Check: PASSED

- FOUND: frontend/src/utils/constants.js (ACTION_REQUIRED_OPTIONS absent — 0 grep matches)
- FOUND: backend/records/models.py (single aliased import, py_compile OK)
- FOUND: CLAUDE.MD (free-text description on line 289)
- MISSING: frontend/src/components/RemarksEditDialog.jsx (correctly deleted)
- FOUND commit: ddeeacb
- FOUND commit: 247fdee
- npm build: exit 0

---
*Phase: 03-frontend-workflow*
*Completed: 2026-02-21*
