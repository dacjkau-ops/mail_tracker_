# State: Mail Tracker v1.1 UI/UX Refresh + Password Change

**Current Phase:** 4 — Password Change
**Current Plan:** 02 (complete)
**Last Action:** Executed 04-02 — frontend change-password page
**Date:** 2026-02-22

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Users can securely attach, store, and view PDF documents with proper access control and audit logging
**Current focus:** v1.1 — Phase 4: Password Change (complete), next: Phase 5 Mail Detail UI/UX Refresh

## Current Position

Phase: 4 of 5 (Password Change)
Plan: 02 complete — frontend change-password page done
Status: Phase 4 complete — ready for Phase 5
Last activity: 2026-02-22 — 04-02 complete (ChangePasswordPage, authService.changePassword, LoginPage link, App.jsx route)

Progress: [███████░░░] 70% (4/5 phases complete, phase 5 not started)

## Phase Status

| Phase | Status | Requirements | Completed |
|-------|--------|--------------|-----------|
| 1. Infrastructure & PDF Backend | Done | 29 | 3/3 plans done |
| 2. Role System & Backend Updates | Done | 16 | 3/3 plans done |
| 3. Frontend & Workflow | Done | 17 | 3/3 plans done |
| 4. Password Change | Done | 7 | 2/2 plans done |
| 5. Mail Detail UI/UX Refresh | Not started | 13 | 0/? plans |

## Active Context

**Environment:** Dev laptop (Windows)
**Target:** Ubuntu server (Docker)
**Database:** PostgreSQL in Docker
**File Storage:** /srv/mailtracker/pdfs (X-Accel-Redirect)

## Key Decisions (Recent)

- **AllowAny on change-password endpoint** — users may be logged out or have expired tokens; current_password is the authentication factor
- **authenticate() not raw DB lookup** — respects Django auth pipeline; inactive users auto-rejected
- **Validation order: fields → mismatch → length → wrong password** — fail fast on cheapest checks before DB hit
- **Change password as separate page** — /change-password route; cleaner UX than modal; standard pattern users know
- **Change password without JWT** — users may not be logged in; current password acts as authentication
- **/change-password not wrapped in PublicRoute** — authenticated users may also want to change password; ProtectedRoute would block logged-out users
- **Success message via router state** — navigate('/login', { state: { successMessage } }) + useLocation() pattern; no global state needed
- **Card-based detail view** — better information hierarchy than table layout
- **Two-column layout (65/35)** — separates mail context (left) from tracking/accountability (right)
- **Vertical MUI Timeline** — easier to follow audit story than table rows

## Current Blockers

None

## Notes

- v1.0 shipped 2026-02-21: PDF attachments, Docker deployment, expanded roles, free-text actions
- v1.1 roadmap defined 2026-02-22: Phase 4 (password change) + Phase 5 (Mail Detail redesign)
- 04-01 complete: POST /api/auth/change-password/ wired, verified with curl, all 5 error/success cases confirmed
- 04-02 complete: ChangePasswordPage.jsx, changePassword() in authService, link on LoginPage, /change-password public route

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
| 04 | 01 | ~2 min | 2/2 | 2 |
| 04 | 02 | ~4 min | 3/3 | 4 |

## Stopped At

Completed 04-02-PLAN.md — frontend change-password page shipped, Phase 4 Password Change complete

---
*State tracking for Mail Tracker v1.1 UI/UX Refresh*
