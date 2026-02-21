---
phase: 02-role-system-backend-updates
plan: "01"
subsystem: database
tags: [django, orm, migrations, roles, sqlite]

# Dependency graph
requires:
  - phase: 01-infrastructure-pdf-backend
    provides: Stable User and MailRecord models as base for role expansion
provides:
  - User model with auditor and clerk roles in ROLE_CHOICES
  - User.auditor_subsections ManyToManyField to Subsection
  - User.is_auditor() and User.is_clerk() helper methods
  - get_sections_list() and get_dag() extended for auditor/clerk roles
  - MailRecord.action_required as free-text CharField(500, blank=True)
  - Migrations 0007 (users) and 0012 (records) applied to SQLite DB
affects:
  - 02-role-system-backend-updates (plans 02, 03 depend on these roles)
  - 03-frontend-workflow (frontend dropdowns, serializer field updates)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Role helper methods pattern: is_auditor(), is_clerk() follow same pattern as is_ag(), is_dag(), is_staff_officer()"
    - "M2M for role-scoped access: auditor_subsections M2M mirrors DAG sections M2M pattern"
    - "Free-text field migration: remove choices and widen max_length — no data migration needed when values fit"

key-files:
  created:
    - backend/users/migrations/0007_add_auditor_clerk_roles.py
    - backend/records/migrations/0012_action_required_free_text.py
  modified:
    - backend/users/models.py
    - backend/records/models.py

key-decisions:
  - "auditor escalates to SrAO/AAO superior (not DAG): get_dag() returns first active SrAO/AAO in auditor's primary subsection"
  - "clerk reuses subsection FK (not a new field): mirrors SrAO/AAO field, so get_dag() for clerk uses same else branch"
  - "action_required_other field retained unchanged: legacy field, may have data, not cleaned up in this phase"
  - "auditor get_sections_list() uses M2M subsections to derive parent sections: consistent with how DAG sections M2M works"

patterns-established:
  - "Role helper methods: one is_X() method per role, returning self.role == 'X'"
  - "M2M for multi-scope access: auditor_subsections pattern for roles that need fine-grained subsection visibility"

requirements-completed:
  - ROLE-01
  - WORKFLOW-04
  - WORKFLOW-05

# Metrics
duration: 12min
completed: 2026-02-21
---

# Phase 02 Plan 01: Role System Data Model Summary

**Expanded User model with auditor/clerk roles and auditor_subsections M2M; converted action_required to free-text CharField(500, blank=True) with migrations applied**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-02-21T00:00:00Z
- **Completed:** 2026-02-21T00:12:00Z
- **Tasks:** 3/3
- **Files modified:** 4

## Accomplishments

- Added `auditor` and `clerk` roles to `User.ROLE_CHOICES`, completing the six-role system
- Added `User.auditor_subsections` ManyToManyField and helper methods `is_auditor()`, `is_clerk()`
- Extended `get_sections_list()` and `get_dag()` to handle auditor (M2M-based lookup) and clerk (subsection FK reuse)
- Converted `MailRecord.action_required` from a six-choice dropdown to free-text `CharField(max_length=500, blank=True)`
- Generated and applied both migrations cleanly with zero data loss

## Task Commits

Each task was committed atomically:

1. **Task 1: Add auditor/clerk roles and auditor_subsections to User model** - `0ffd2b6` (feat)
2. **Task 2: Convert action_required to free-text CharField(500)** - `ed4ee58` (feat)
3. **Task 3: Generate and apply migrations for both model changes** - `c4a2d16` (chore)

## Files Created/Modified

- `backend/users/models.py` - Added auditor/clerk to ROLE_CHOICES, auditor_subsections M2M field, is_auditor(), is_clerk(), updated get_sections_list() and get_dag()
- `backend/records/models.py` - Removed ACTION_CHOICES constant, widened action_required to CharField(500, blank=True)
- `backend/users/migrations/0007_add_auditor_clerk_roles.py` - AddField auditor_subsections, AlterField role choices, AlterField subsection help_text
- `backend/records/migrations/0012_action_required_free_text.py` - AlterField action_required (max_length 50->500, choices removed, blank=True)

## Decisions Made

- **auditor escalates to SrAO/AAO, not DAG**: `get_dag()` for auditor returns the first active SrAO/AAO in their primary configured subsection, reflecting that auditors are subordinate to staff officers rather than the DAG hierarchy
- **clerk reuses subsection FK**: No new field added for clerk; clerk uses the existing `subsection` ForeignKey (same as SrAO/AAO), so `get_dag()` for clerk falls into the same `else` branch as SrAO/AAO — clean and consistent
- **action_required_other retained unchanged**: Legacy field preserved as-is; could have data and cleanup is explicitly deferred
- **No data migration for action_required**: Existing values ('Review', 'Approve', etc.) are all shorter than 500 chars and remain valid as free-text strings; `blank=True` allows empty strings — no backfill needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Minor: `python -c` without `DJANGO_SETTINGS_MODULE` raised `ImproperlyConfigured`. Resolved by setting `os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'` before `django.setup()`. Not a code issue — environment variable required when running Python outside of `manage.py`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 02, Plan 02 (permission logic updates) can now reference `user.is_auditor()`, `user.is_clerk()`, and `user.auditor_subsections` in QuerySet filters and permission checks
- Phase 02, Plan 03 (serializer/API updates) can use free-text `action_required` without choices validation
- No blockers

## Self-Check: PASSED

All files present and all commits verified:
- FOUND: backend/users/models.py
- FOUND: backend/records/models.py
- FOUND: backend/users/migrations/0007_add_auditor_clerk_roles.py
- FOUND: backend/records/migrations/0012_action_required_free_text.py
- FOUND: .planning/phases/02-role-system-backend-updates/02-01-SUMMARY.md
- FOUND commit 0ffd2b6 (Task 1)
- FOUND commit ed4ee58 (Task 2)
- FOUND commit c4a2d16 (Task 3)

---
*Phase: 02-role-system-backend-updates*
*Completed: 2026-02-21*
