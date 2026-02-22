---
phase: 04-password-change
plan: 01
subsystem: auth
tags: [django, rest-framework, password-change, authentication, AllowAny]

# Dependency graph
requires: []
provides:
  - "POST /api/auth/change-password/ endpoint accessible without JWT token"
  - "ChangePasswordView class in backend/users/views.py"
  - "URL route wired in backend/config/urls.py"
affects: [05-mail-detail-uiux, frontend-password-change-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AllowAny permission on auth endpoint that uses credential-based identity (username + current_password replaces JWT)"
    - "django.contrib.auth.authenticate() + user.set_password() for secure credential verification and password hashing"

key-files:
  created: []
  modified:
    - backend/users/views.py
    - backend/config/urls.py

key-decisions:
  - "AllowAny permission used instead of IsAuthenticated — users may be logged out or have expired tokens when changing password"
  - "django.contrib.auth.authenticate() used (not raw DB lookup) — respects Django auth pipeline including inactive user checks"
  - "Validation order: missing fields → mismatch → too short → wrong current password — fail fast on cheapest checks first"
  - "URL placed before router include to prevent router catching the path"

patterns-established:
  - "Unauthenticated endpoints use AllowAny + credential-based identity verification"

requirements-completed:
  - PASSWD-03
  - PASSWD-04
  - PASSWD-05

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 04 Plan 01: Change Password API Endpoint Summary

**POST /api/auth/change-password/ endpoint using username + current password as identity proof, returning specific 400 errors for each failure mode and 200 on success**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T12:29:09Z
- **Completed:** 2026-02-22T12:30:58Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- ChangePasswordView implemented with AllowAny permission — no JWT required
- All four validation error cases return specific messages (fields required, mismatch, too short, wrong current password)
- Password changed via Django's set_password() ensuring bcrypt hashing, not plaintext storage
- URL wired at /api/auth/change-password/ before router include so it is not swallowed by the API router

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ChangePasswordView to users/views.py** - `3543d4d` (feat)
2. **Task 2: Wire the change-password URL in config/urls.py** - `3b6c5f7` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `backend/users/views.py` - Added APIView, AllowAny, authenticate imports; appended ChangePasswordView class
- `backend/config/urls.py` - Imported ChangePasswordView; added path('api/auth/change-password/') before router URLs

## Request/Response Contract

**Endpoint:** `POST /api/auth/change-password/`
**Auth required:** None (AllowAny)
**Content-Type:** application/json

**Request body:**
```json
{
  "username": "string",
  "current_password": "string",
  "new_password": "string",
  "confirm_password": "string"
}
```

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Valid credentials, passwords match, length >= 8 | `{"message": "Password changed successfully."}` |
| 400 | Any field missing or empty | `{"error": "All fields are required."}` |
| 400 | new_password != confirm_password | `{"error": "New passwords do not match."}` |
| 400 | new_password length < 8 | `{"error": "New password must be at least 8 characters."}` |
| 400 | authenticate() returns None | `{"error": "Current password is incorrect."}` |
| 405 | GET/PUT/PATCH/DELETE | Method Not Allowed |

## Decisions Made
- AllowAny used: users who are logged out or have expired sessions must be able to self-serve; current password acts as authentication factor
- authenticate() used instead of raw User.objects.get(): respects Django's auth pipeline (inactive users are rejected automatically)
- Validation order chosen to fail fast on cheapest checks (field presence, string comparison) before hitting the database

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend endpoint complete and verified end-to-end
- Frontend change-password page (Phase 04 Plan 02, if planned) can call POST /api/auth/change-password/ without auth headers
- No blockers

## Self-Check: PASSED

- backend/users/views.py: FOUND
- backend/config/urls.py: FOUND
- .planning/phases/04-password-change/04-01-SUMMARY.md: FOUND
- commit 3543d4d (Task 1): FOUND
- commit 3b6c5f7 (Task 2): FOUND

---
*Phase: 04-password-change*
*Completed: 2026-02-22*
