# State: Mail Tracker v1.1 UI/UX Refresh + Password Change

**Current Phase:** 5
**Current Plan:** 02 complete
**Last Action:** Executed 05-02 — Mail Detail body redesign (two-column layout + MUI Timeline)
**Date:** 2026-02-22

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Users can securely attach, store, and view PDF documents with proper access control and audit logging
**Current focus:** v1.1 — Phase 5: Mail Detail UI/UX Refresh (plan 02 of 2 complete)

## Current Position

Phase: 5 of 5 (Mail Detail UI/UX Refresh)
Plan: 02 complete — MailDetailPage body redesign done
Status: Phase 5 COMPLETE — all UIUX requirements delivered
Last activity: 2026-02-22 — 05-02 complete (two-column layout, card hierarchy, MUI Timeline audit trail, inline remarks editing)

Progress: [██████████] 100% (5/5 phases complete, phase 5 plan 02 done)

## Phase Status

| Phase | Status | Requirements | Completed |
|-------|--------|--------------|-----------|
| 1. Infrastructure & PDF Backend | Done | 29 | 3/3 plans done |
| 2. Role System & Backend Updates | Done | 16 | 3/3 plans done |
| 3. Frontend & Workflow | Done | 17 | 3/3 plans done |
| 4. Password Change | Done | 7 | 2/2 plans done |
| 5. Mail Detail UI/UX Refresh | Done | 13 | 2/2 plans done |

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
- **Subject as h5 primary title** — subject is more meaningful at-a-glance than serial number (sl_no becomes subtitle)
- **Pending chip label for Received+Assigned** — non-technical users don't need to distinguish unassigned vs assigned-but-not-started
- **Completion Highlight block removed** — completion date belongs in audit trail only, not a separate banner
- **Overdue banner inside header Paper** — contextually adjacent to status chip for immediate visual association
- **Inline remarks editing replaces UpdateCurrentAction button** — modal was unnecessarily heavy for a single textarea
- **Actions card hidden entirely when no permissions** — no greyed-out buttons to confuse read-only viewers
- **Handler Remarks always renders** — most critical tracking field must have guaranteed visibility even when empty
- **Section removed from Origin card** — internal routing metadata, not reader-relevant origin context
- **Null fields silently hidden** — no N/A text anywhere on the detail page

## Current Blockers

None

## Notes

- v1.0 shipped 2026-02-21: PDF attachments, Docker deployment, expanded roles, free-text actions
- v1.1 roadmap defined 2026-02-22: Phase 4 (password change) + Phase 5 (Mail Detail redesign)
- 04-01 complete: POST /api/auth/change-password/ wired, verified with curl, all 5 error/success cases confirmed
- 04-02 complete: ChangePasswordPage.jsx, changePassword() in authService, link on LoginPage, /change-password public route
- 05-01 complete: @mui/lab installed, DETAIL_STATUS_CHIP constant added to constants.js, MailDetailPage header replaced with subject-first redesign + overdue banner
- 05-02 complete: Two-column body layout, Origin/Instructions/Handler Remarks cards left, Actions/CurrentHandler/DueDate right, MUI Timeline audit trail

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
| 05 | 01 | ~4 min | 3/3 | 3 |
| 05 | 02 | ~6 min | 2/2 | 1 |

## Stopped At

Completed 05-02-PLAN.md — MailDetailPage body redesign shipped (two-column layout, card hierarchy, MUI Timeline, inline remarks editing)

---
*State tracking for Mail Tracker v1.1 UI/UX Refresh*
