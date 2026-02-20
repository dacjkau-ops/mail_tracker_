---
phase: 02-role-system-backend-updates
plan: "02"
subsystem: permissions
tags: [django, drf, permissions, roles, queryset, auditor, clerk]

# Dependency graph
requires:
  - phase: 02-role-system-backend-updates
    plan: "01"
    provides: auditor/clerk role constants and auditor_subsections M2M on User model
provides:
  - MailRecordPermission handling all six roles in has_permission(), _can_view_mail(), has_object_permission()
  - get_queryset() with distinct branches for SrAO/AAO (subsection-level), clerk (personal), auditor (configured subsections)
  - _get_reassign_candidates_queryset() with auditor (SrAO/AAO only) and clerk (same subsection) branches
  - reassign() view guard: auditor-to-SrAO/AAO-only restriction
affects:
  - 02-role-system-backend-updates (plan 03 builds on these permission foundations)
  - 03-frontend-workflow (frontend role-based UI depends on correct API visibility)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Role branching in get_queryset: explicit elif per role rather than else-catch-all"
    - "Auditor subsection visibility: Q(subsection__in=ids) | Q(subsection__isnull=True, section__subsections__id__in=ids)"
    - "Clerk visibility: narrow personal scope — current_handler | assigned_to | created_by"
    - "SrAO/AAO expanded scope: Q(subsection=user.subsection) added to existing filter"

key-files:
  created: []
  modified:
    - backend/config/permissions.py
    - backend/records/views.py

key-decisions:
  - "create action in has_permission() allows all authenticated users: view-level enforces role-based scoping (Plan 03 wires DAG/clerk create logic)"
  - "SrAO/AAO visibility expanded to subsection-level: subsection FK equality check, not just assigned-to-them — matches ROLE-04/05 requirements"
  - "Auditor reassign candidates limited to SrAO/AAO in configured subsections: double-enforced in both _get_reassign_candidates_queryset() and reassign() view guard"
  - "Existing view guards (multi_assign, reopen, close-multi) left untouched: they already correctly block auditor/clerk without changes"
  - "Clerk get_queryset includes created_by: clerk can see mails they originated even if not current handler"
  - "Auditor section-level fallback in queryset: Q(subsection__isnull=True, section__subsections__id__in=ids) covers mails assigned at section level with no subsection set"

# Metrics
duration: ~3min
completed: 2026-02-20
---

# Phase 02 Plan 02: Permission and Queryset Role Hierarchy Summary

**Updated MailRecordPermission and get_queryset() to wire auditor/clerk roles into authorization and data-filtering — completing the core behavioral change of Phase 2**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-20T22:38:02Z
- **Completed:** 2026-02-20T22:40:37Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Extended `MailRecordPermission.has_permission()`: `create` action now passes all authenticated users (view enforces scoping)
- Extended `_can_view_mail()`: added `clerk` branch (personal mails only) and `auditor` branch (configured auditor_subsections with section-level fallback)
- Expanded SrAO/AAO `_can_view_mail()` to include subsection-level check before falling back to assignment/touched logic
- Updated `upload_pdf` block in `has_object_permission()` to allow `auditor` and `clerk` roles when they are `current_handler`
- Added auditor branch to `reassign` block in `has_object_permission()` (current_handler check; target restriction in view)
- Replaced `else` catch-all in `get_queryset()` with explicit branches: SrAO/AAO (subsection-expanded), clerk (personal), auditor (M2M subsections), fallback `none()`
- Added auditor and clerk branches to `_get_reassign_candidates_queryset()`
- Added auditor-to-SrAO/AAO-only guard in `reassign()` view returning 403

## Task Commits

Each task was committed atomically:

1. **Task 1: Update MailRecordPermission for new role hierarchy** - `6b2412c` (feat)
2. **Task 2: Update get_queryset() and reassign view for new visibility rules** - `d08a5aa` (feat)

## Files Created/Modified

- `backend/config/permissions.py` - Added clerk/auditor to _can_view_mail(), expanded SrAO/AAO subsection check, updated upload_pdf and reassign blocks for new roles, changed create to allow all authenticated
- `backend/records/views.py` - Replaced else-SrAO/AAO with explicit role branches in get_queryset(), added auditor/clerk to _get_reassign_candidates_queryset(), added auditor target restriction in reassign()

## Decisions Made

- **create action allows all authenticated users**: The permission class no longer blocks non-AG from `create` — the view body (and upcoming Plan 03 changes) enforce who can actually create what. This is correct separation of concerns.
- **SrAO/AAO visibility expanded to subsection-level**: Per ROLE-04/05 requirements, they see all mails in their subsection, not just those assigned to them. The `Q(subsection=user.subsection)` filter handles this; existing fallbacks (assigned, touched) are preserved.
- **Double enforcement for auditor reassign target**: Both `_get_reassign_candidates_queryset()` (only returns SrAO/AAO candidates) and `reassign()` view (explicit 403 if target role is wrong) enforce the auditor-to-SrAO/AAO restriction. Belt-and-suspenders approach.
- **Auditor section-level fallback in queryset**: Mails with no subsection set but belonging to a section that contains an auditor's configured subsection are included. Prevents visibility gaps for legacy/uncategorized records.
- **Existing view guards left untouched**: `multi_assign`, `reopen`, and `close` (for multi-assigned) all already correctly block auditor/clerk with their own role checks. No modifications needed.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All 8 plan verification checks passed:
- `auditor` in permissions: True
- `auditor` in views: True
- `clerk` in permissions: True
- `clerk` in views: True
- `auditor_subsections` in views: True
- Auditor SrAO restriction in views: True
- multi_assign guard intact: True
- reopen guard intact: True

## Self-Check: PASSED

All files present and all commits verified:
- FOUND: backend/config/permissions.py
- FOUND: backend/records/views.py
- FOUND: .planning/phases/02-role-system-backend-updates/02-02-SUMMARY.md
- FOUND commit 6b2412c (Task 1)
- FOUND commit d08a5aa (Task 2)

---
*Phase: 02-role-system-backend-updates*
*Completed: 2026-02-20*
