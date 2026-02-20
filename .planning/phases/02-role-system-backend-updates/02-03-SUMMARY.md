---
phase: 02-role-system-backend-updates
plan: "03"
subsystem: api
tags: [django, drf, serializers, roles, attachments, create-permissions]

# Dependency graph
requires:
  - phase: 02-role-system-backend-updates
    plan: "01"
    provides: auditor/clerk roles and auditor_subsections M2M on User model
  - phase: 02-role-system-backend-updates
    plan: "02"
    provides: permission class and get_queryset() with all six roles wired
provides:
  - attachment_metadata SerializerMethodField on MailRecordListSerializer and MailRecordDetailSerializer
  - create() allows all six roles (AG/DAG/SrAO/AAO/clerk/auditor) with subsection scoping
  - MailRecordCreateSerializer.validate() handles role-based section/assignee validation for all roles
  - UserSerializer exposes auditor_subsections field
  - UserCreateSerializer accepts and sets auditor_subsections in create()
  - UserMinimalSerializer.get_sections_display() handles auditor role
affects:
  - 03-frontend-workflow (frontend can now receive attachment_metadata in list/detail responses)
  - 03-frontend-workflow (all roles can create mails via the API)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SerializerMethodField on class body included in __all__: DRF includes declared method fields even with fields='__all__'"
    - "Role-branching in view create(): AG/DAG/SrAO+AAO+clerk/auditor each get their own subsection-scoping path"
    - "Serializer validate() vs view scoping: serializer validates scope correctness, view enforces it by force-setting subsection/section"

key-files:
  created: []
  modified:
    - backend/records/serializers.py
    - backend/records/views.py
    - backend/users/serializers.py

key-decisions:
  - "attachment_metadata added to both list and detail serializers: frontend can show attachment status without a separate API call"
  - "Other sentinel validation removed from MailRecordCreateSerializer: action_required is now free-text (no choices constraint since Plan 01)"
  - "create() branches on role, not just AG check: subsection-scoped roles have section forced from their user profile, not from request data"
  - "Serializer validate() adds assignee-scope checks for SrAO/AAO/clerk/auditor: belt-and-suspenders alongside view enforcement"
  - "Subsection added to sections.models import in views.py: needed for type reference in IDE but not functionally required (objects accessed via ORM)"

# Metrics
duration: ~4min
completed: 2026-02-21
---

# Phase 02 Plan 03: Serializer Completeness and Role-Based Creation Summary

**Added attachment_metadata to list/detail serializers and expanded create() to allow all six roles with subsection-scoped creation; updated UserSerializer for auditor_subsections**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-20T22:43:18Z
- **Completed:** 2026-02-20T22:47:10Z
- **Tasks:** 3/3
- **Files modified:** 3

## Accomplishments

- Added `attachment_metadata` SerializerMethodField to `MailRecordListSerializer` (with `get_attachment_metadata()` method and field in `Meta.fields`)
- Added `attachment_metadata` SerializerMethodField to `MailRecordDetailSerializer` (auto-included via `fields = '__all__'`)
- Removed 'Other' sentinel validation from `MailRecordCreateSerializer.validate()` (action_required is now free-text since Plan 01)
- Extended `MailRecordCreateSerializer.validate()` with role-based section and assignee scope validation for DAG, SrAO/AAO/clerk, and auditor roles
- Replaced AG-only `create()` guard with role-branched section/subsection determination for all six roles
- Added `Subsection` to `sections.models` import in `views.py`
- Added `auditor_subsections` to `UserSerializer.Meta.fields` for login/me endpoint exposure
- Updated `UserSerializer.get_sections_list()` with auditor branch (returns section+subsection pairs)
- Added `auditor_subsections` PrimaryKeyRelatedField to `UserCreateSerializer` with create() support
- Updated `UserMinimalSerializer.get_sections_display()` with auditor branch (shows `section/subsection` strings)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add attachment_metadata to list and detail serializers** - `16ce70d` (feat)
2. **Task 2: Allow all roles to create mails with subsection scoping** - `f99693c` (feat)
3. **Task 3: Update UserMinimalSerializer and UserSerializer for new roles** - `ae761ab` (feat)

## Files Created/Modified

- `backend/records/serializers.py` - attachment_metadata in List/Detail serializers; removed 'Other' sentinel; added DAG/SrAO+AAO+clerk/auditor validation in validate()
- `backend/records/views.py` - create() now handles all six roles with subsection scoping; added Subsection import
- `backend/users/serializers.py` - UserSerializer adds auditor_subsections field + auditor branch in get_sections_list(); UserCreateSerializer adds auditor_subsections field and create() support; UserMinimalSerializer adds auditor branch in get_sections_display(); Subsection import added

## Decisions Made

- **attachment_metadata on both serializers**: Frontend can show attachment indicator on list rows and full metadata on detail page without an additional API call — reduces round trips
- **Other sentinel validation removed**: `action_required` was converted to free-text in Plan 01; keeping the old 'Other' check would incorrectly fail valid submissions with the literal text "Other"
- **create() role branching in view, not just serializer**: The serializer validates that assignees are in scope, but the actual section/subsection override is done in the view after deserialization — clean separation between validation (serializer) and state mutation (view)
- **DAG section defaults to first managed section**: If a DAG doesn't select a section in the form, the view picks `user.sections.first()` as a safe default rather than returning an error
- **auditor_subsections exposed on UserSerializer**: The `/api/users/me/` and login response need to return auditor subsection IDs so the frontend can correctly limit what the auditor can see and do

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All 8 plan verification checks passed:
- `List attachment_metadata`: True
- `Detail attachment_metadata`: True
- `section in CreateSerializer (pre-existing)`: True
- `UserSerializer auditor_subsections`: True
- `UserCreateSerializer auditor_subsections`: True
- `Old AG-only guard removed`: True
- `Plan 02 auditor queryset intact`: True
- `Plan 02 auditor reassign intact`: True

## Self-Check: PASSED

All files present and all commits verified:
- FOUND: backend/records/serializers.py
- FOUND: backend/records/views.py
- FOUND: backend/users/serializers.py
- FOUND: .planning/phases/02-role-system-backend-updates/02-03-SUMMARY.md
- FOUND commit 16ce70d (Task 1)
- FOUND commit f99693c (Task 2)
- FOUND commit ae761ab (Task 3)

---
*Phase: 02-role-system-backend-updates*
*Completed: 2026-02-21*
