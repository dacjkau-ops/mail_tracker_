# Roadmap: Mail Tracker Enhancements

**Created:** 2026-02-20
**Last updated:** 2026-02-24

---

## Milestones

- ✅ **v1.0 PDF Attachments + Docker** — Phases 1-3 (shipped 2026-02-21)
- ✅ **v1.1 Password Change + UI/UX Refresh** — Phases 4-5 (shipped 2026-02-22)
- [ ] **v1.2 Refactor & Create Mail UX** — Phases 6-8

---

## Phases

<details>
<summary>✅ v1.0 PDF Attachments + Docker (Phases 1-3) — SHIPPED 2026-02-21</summary>

- [x] Phase 1: Infrastructure & PDF Backend (3/3 plans) — completed 2026-02-20
- [x] Phase 2: Role System & Backend Updates (3/3 plans) — completed 2026-02-21
- [x] Phase 3: Frontend & Workflow (3/3 plans) — completed 2026-02-21

Archive: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Password Change + UI/UX Refresh (Phases 4-5) — SHIPPED 2026-02-22</summary>

- [x] Phase 4: Password Change (2/2 plans) — completed 2026-02-22
- [x] Phase 5: Mail Detail UI/UX Refresh (2/2 plans) — completed 2026-02-22

Archive: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### v1.2 Refactor & Create Mail UX

- [ ] **Phase 6: Backend Cleanup & Refactoring** - Remove deprecated fields, optimize queries, and improve code quality
- [ ] **Phase 7: Create Mail UX** - Faster page load, smarter section field layout and auto-population
- [ ] **Phase 8: Mail List Enhancements** - PDF attachment indicator and server-side pagination

---

## Phase Details

### Phase 6: Backend Cleanup & Refactoring
**Goal:** Codebase is free of deprecated fields and backend queries are optimized for fewer DB hits
**Depends on:** Nothing (standalone backend work)
**Requirements:** CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04, CLEAN-05, REFAC-01, REFAC-02, REFAC-03, REFAC-04, REFAC-05
**Success Criteria** (what must be TRUE):
  1. The MailRecord model no longer has `action_required_other` or `remarks` fields, and MailAssignment no longer has `user_remarks` — confirmed via migration and database schema
  2. No import of `formatDistanceToNow` or definition of `getRelativeTime` exists anywhere in the frontend codebase
  3. Multi-assignment creation uses `bulk_create()` for both MailAssignment and AuditTrail rows instead of individual saves
  4. DAG section officer lookup and "touched records" visibility each execute in one query instead of two or more sequential queries
  5. No duplicate utility functions — `_human_readable_size()` exists in exactly one place as a static/class method
**Plans:** TBD

### Phase 7: Create Mail UX
**Goal:** The Create Mail page loads fast and intelligently handles section selection based on assignee
**Depends on:** Phase 6 (clean models and optimized queries reduce form load overhead)
**Requirements:** PERF-01, CMUX-01, CMUX-02, CMUX-03
**Success Criteria** (what must be TRUE):
  1. Create Mail page reaches form-ready state (all dropdowns populated, form interactive) within 500ms of navigation
  2. Section and Assigned To fields appear on the same row in the form layout
  3. Selecting a single assignee auto-fills the Section field with that user's section
  4. Selecting multiple assignees auto-fills Section using the first assignee's section (or common section if all share one)
**Plans:** TBD

### Phase 8: Mail List Enhancements
**Goal:** Users can see which mails have PDFs at a glance and navigate large mail lists efficiently with pagination
**Depends on:** Phase 6 (clean backend; pagination queries benefit from refactored query patterns)
**Requirements:** MLUX-01, MLUX-02, PAGE-01, PAGE-02, PAGE-03
**Success Criteria** (what must be TRUE):
  1. Mails with a PDF attachment show a clickable PDF icon next to the subject in the mail list
  2. Clicking the PDF icon opens the attached PDF in a new browser tab (via X-Accel-Redirect)
  3. Mail list API returns paginated responses (25 records per page) with total count and page metadata
  4. Frontend displays page navigation controls (previous/next, current page indicator) below the mail list
  5. Pagination works correctly with all existing filters (status, section/subsection, search) — changing a filter resets to page 1
**Plans:** TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure & PDF Backend | v1.0 | 3/3 | Complete | 2026-02-20 |
| 2. Role System & Backend Updates | v1.0 | 3/3 | Complete | 2026-02-21 |
| 3. Frontend & Workflow | v1.0 | 3/3 | Complete | 2026-02-21 |
| 4. Password Change | v1.1 | 2/2 | Complete | 2026-02-22 |
| 5. Mail Detail UI/UX Refresh | v1.1 | 2/2 | Complete | 2026-02-22 |
| 6. Backend Cleanup & Refactoring | v1.2 | 0/? | Not started | - |
| 7. Create Mail UX | v1.2 | 0/? | Not started | - |
| 8. Mail List Enhancements | v1.2 | 0/? | Not started | - |

---

*Roadmap created: 2026-02-20*
*Last updated: 2026-02-24 — v1.2 phases 6-8 added*
