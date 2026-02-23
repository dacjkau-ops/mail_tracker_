# State: Mail Tracker v1.2 Refactor & Create Mail UX

**Current Phase:** Phase 6 — Backend Cleanup & Refactoring
**Current Plan:** TBD (awaiting plan-phase)
**Last Action:** Roadmap created for v1.2
**Date:** 2026-02-24

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** An on-premise office workflow tracker where every mail/action is visible to the right people, assigned to someone accountable, and tracked through its lifecycle.
**Current focus:** v1.2 — Phase 6: Backend Cleanup & Refactoring

## Current Position

Phase: 6 — Backend Cleanup & Refactoring (not started)
Plan: TBD
Status: Roadmap complete, awaiting phase planning
Last activity: 2026-02-24 — Roadmap created with 3 phases (6-8)

```
v1.2 Progress: [..........] 0% (0/3 phases)
```

## Active Context

**Environment:** Dev laptop (Windows)
**Target:** Ubuntu server (Docker)
**Database:** PostgreSQL in Docker
**File Storage:** /srv/mailtracker/pdfs (X-Accel-Redirect)

## Phase Summary

| Phase | Goal | Status |
|-------|------|--------|
| 6 | Backend cleanup + query optimization | Not started |
| 7 | Create Mail perf + section UX | Not started |
| 8 | PDF icon on list + pagination | Not started |

## Key Decisions (Recent)

*(Carried from v1.1)*
- **AllowAny on change-password endpoint** — users may be logged out; current_password is auth factor
- **Inline remarks editing** — no modal friction
- **Two-column detail layout (65/35)** — separates mail context from tracking

## Current Blockers

None

## Notes

- v1.0 shipped 2026-02-21
- v1.1 shipped 2026-02-22
- v1.2 started 2026-02-24: 19 requirements across 3 phases
- Phase 6 is backend-only (no UI changes), unblocks phases 7 and 8
- Phase 7 depends on Phase 6 (clean models reduce form load)
- Phase 8 depends on Phase 6 (clean queries benefit pagination)

---
*State tracking for Mail Tracker v1.2 Refactor & Create Mail UX*
