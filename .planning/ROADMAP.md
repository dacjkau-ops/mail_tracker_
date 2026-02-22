# Roadmap: Mail Tracker Enhancements

**Created:** 2026-02-20
**Last updated:** 2026-02-22

---

## Milestones

- [x] **v1.0 PDF Attachments + Docker** - Phases 1-3 (shipped 2026-02-21)
- [ ] **v1.1 Password Change + UI/UX Refresh** - Phases 4-5 (in progress)

---

## Phases

<details>
<summary>v1.0 PDF Attachments + Docker (Phases 1-3) - SHIPPED 2026-02-21</summary>

### Phase 1: Infrastructure & PDF Backend
**Goal**: Establish Docker infrastructure and PDF attachment backend
**Depends on**: Nothing (first phase)
**Requirements**: PDF-01 to PDF-11, DOCKER-01 to DOCKER-10, NGINX-01 to NGINX-08
**Success Criteria** (what must be TRUE):
  1. Docker Compose environment runs with postgres, backend, and nginx
  2. PDF can be uploaded and stored on filesystem
  3. PDF metadata endpoint returns correct information
  4. X-Accel-Redirect endpoint authorizes and returns proper headers
  5. Audit log entries created for PDF operations
  6. Nginx serves static files and proxies API correctly
**Plans**: 3/3 plans complete

Plans:
- [x] 01-01: Docker Compose + PostgreSQL setup
- [x] 01-02: PDF model, upload endpoint, view endpoint
- [x] 01-03: Nginx configuration with X-Accel-Redirect

### Phase 2: Role System & Backend Updates
**Goal**: Expand role system and update permissions for new hierarchy
**Depends on**: Phase 1
**Requirements**: ROLE-01 to ROLE-08, BACKEND-01 to BACKEND-06, WORKFLOW-04 to WORKFLOW-05
**Success Criteria** (what must be TRUE):
  1. User model supports auditor and clerk roles
  2. All authenticated users can create mails
  3. Bottom-up visibility enforced in list/detail endpoints
  4. DAG sees all section mails, SrAO/AAO/Clerk see subsection mails
  5. Auditor has configurable subsection visibility
  6. action_required accepts free text with validation
  7. Existing data compatibility preserved
**Plans**: 3/3 plans complete

Plans:
- [x] 02-01: Add auditor/clerk roles, auditor_subsections M2M, convert action_required to free-text
- [x] 02-02: Update permissions and queryset visibility for new role hierarchy
- [x] 02-03: Enable all roles to create mails with subsection scoping, add attachment_metadata to serializers

### Phase 3: Frontend & Workflow
**Goal**: Update frontend for PDF upload, free-text actions, and new roles
**Depends on**: Phase 2
**Requirements**: WORKFLOW-01 to WORKFLOW-03, WORKFLOW-06 to WORKFLOW-07, FRONTEND-01 to FRONTEND-06, CLEANUP-01 to CLEANUP-06
**Success Criteria** (what must be TRUE):
  1. Create mail form includes PDF upload input
  2. File input validates PDF type and size
  3. Mail detail page shows PDF with view/download
  4. Action required field is free text input
  5. Role badges display correctly for auditor and clerk
  6. Codebase cleaned of unused files
  7. All functionality tested end-to-end
**Plans**: 3/3 plans complete

Plans:
- [x] 03-01: Create mail form — free-text action_required + two-step PDF upload + canCreateMail expansion
- [x] 03-02: Mail detail page — PDF view/download section + role badge labels + remove RemarksEditDialog
- [x] 03-03: Codebase cleanup — delete dead code, fix duplicate import, update CLAUDE.md

</details>

---

### v1.1 Password Change + UI/UX Refresh (In Progress)

**Milestone Goal:** Add self-service password change for all users and redesign the Mail Detail view for better clarity, context, and usability

#### Phase 4: Password Change
**Goal**: Users can change their own passwords without administrator intervention
**Depends on**: Phase 3
**Requirements**: PASSWD-01, PASSWD-02, PASSWD-03, PASSWD-04, PASSWD-05, PASSWD-06, PASSWD-07
**Success Criteria** (what must be TRUE):
  1. A "Change Password" link appears on the login page and navigates to /change-password
  2. User can submit a form with Username, Current Password, New Password, and Confirm New Password fields
  3. Submitting correct credentials with a valid new password redirects to /login with a success message
  4. Submitting wrong current password, mismatched passwords, or a password shorter than 8 characters each produce a specific error message
  5. The change-password endpoint works without a JWT token (accessible to logged-out users)
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Backend: POST /api/auth/change-password/ endpoint (AllowAny, validates credentials + password rules)
- [ ] 04-02-PLAN.md — Frontend: ChangePasswordPage + link on LoginPage + route in App.jsx + human verification checkpoint

#### Phase 5: Mail Detail UI/UX Refresh
**Goal**: The Mail Detail view presents information with a clear hierarchy and context-aware layout
**Depends on**: Phase 4
**Requirements**: UIUX-01, UIUX-02, UIUX-03, UIUX-04, UIUX-05, UIUX-06, UIUX-07, UIUX-08, UIUX-09, UIUX-10, UIUX-11, UIUX-12, UIUX-13
**Success Criteria** (what must be TRUE):
  1. Mail Detail header shows Subject as primary title with Serial Number as subtitle and a color-coded Status Chip alongside
  2. Detail view uses a two-column layout: left column (65%) holds Origin, Instructions, and Handler Remarks cards; right column (35%) holds Current Handler, Due Date, and Action Buttons
  3. Overdue mails show the due date highlighted in red when status is not Closed
  4. Audit trail is displayed as a vertical MUI Timeline showing timestamp, action type, actor, and remarks per entry
  5. Fields with null or empty values are not rendered (no blank labels or "N/A" placeholders visible to the user)
**Plans**: TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure & PDF Backend | v1.0 | 3/3 | Complete | 2026-02-20 |
| 2. Role System & Backend Updates | v1.0 | 3/3 | Complete | 2026-02-21 |
| 3. Frontend & Workflow | v1.0 | 3/3 | Complete | 2026-02-21 |
| 4. Password Change | v1.1 | 0/2 | Not started | - |
| 5. Mail Detail UI/UX Refresh | v1.1 | 0/? | Not started | - |

---

## Coverage Summary

| Category | Requirements | Phase |
|----------|-------------|-------|
| PDF System | PDF-01 to PDF-11 (11) | 1 |
| Docker | DOCKER-01 to DOCKER-10 (10) | 1 |
| Nginx | NGINX-01 to NGINX-08 (8) | 1 |
| Roles | ROLE-01 to ROLE-08 (8) | 2 |
| Backend | BACKEND-01 to BACKEND-06 (6) | 2 |
| Workflow (backend) | WORKFLOW-04 to WORKFLOW-05 (2) | 2 |
| Workflow (frontend) | WORKFLOW-01 to WORKFLOW-03, 06-07 (5) | 3 |
| Frontend | FRONTEND-01 to FRONTEND-06 (6) | 3 |
| Cleanup | CLEANUP-01 to CLEANUP-06 (6) | 3 |
| Password Change | PASSWD-01 to PASSWD-07 (7) | 4 |
| UI/UX Refresh | UIUX-01 to UIUX-13 (13) | 5 |
| **Total** | **72** | |

**Coverage Status:** 100% (v1.0: 52 requirements across phases 1-3; v1.1: 20 requirements across phases 4-5) ✓

---

## Dependencies

```
Phase 1 (Infrastructure & PDF Backend)
    |
Phase 2 (Role System & Backend Updates)
    |
Phase 3 (Frontend & Workflow)
    |
Phase 4 (Password Change)
    |
Phase 5 (Mail Detail UI/UX Refresh)
```

---

*Roadmap created: 2026-02-20*
*Last updated: 2026-02-22 — added phases 4-5 for v1.1 milestone*
