# Roadmap: Mail Tracker Enhancements

**Created:** 2026-02-20
**Phases:** 3
**Requirements:** 52 v1 requirements

---

## Phase 1: Infrastructure & PDF Backend

**Goal:** Establish Docker infrastructure and PDF attachment backend

**Requirements:** PDF-01 to PDF-11, DOCKER-01 to DOCKER-10, NGINX-01 to NGINX-08
**Phase ID:** 1
**Depends On:** None

### Success Criteria

1. Docker Compose environment runs with postgres, backend, and nginx
2. PDF can be uploaded and stored on filesystem
3. PDF metadata endpoint returns correct information
4. X-Accel-Redirect endpoint authorizes and returns proper headers
5. Audit log entries created for PDF operations
6. Nginx serves static files and proxies API correctly

---

## Phase 2: Role System & Backend Updates

**Goal:** Expand role system and update permissions for new hierarchy

**Requirements:** ROLE-01 to ROLE-08, BACKEND-01 to BACKEND-06, WORKFLOW-04 to WORKFLOW-05
**Phase ID:** 2
**Depends On:** Phase 1

**Plans:** 3 plans

Plans:
- [ ] 02-01-PLAN.md — Add auditor/clerk roles to User model, auditor_subsections M2M, convert action_required to free-text
- [ ] 02-02-PLAN.md — Update permissions and queryset visibility for new role hierarchy
- [ ] 02-03-PLAN.md — Enable all roles to create mails with subsection scoping, add attachment_metadata to serializers

### Success Criteria

1. User model supports auditor and clerk roles
2. All authenticated users can create mails
3. Bottom-up visibility enforced in list/detail endpoints
4. DAG sees all section mails, SrAO/AAO/Clerk see subsection mails
5. Auditor has configurable subsection visibility
6. action_required accepts free text with validation
7. Existing data compatibility preserved

---

## Phase 3: Frontend & Workflow

**Goal:** Update frontend for PDF upload, free-text actions, and new roles

**Requirements:** WORKFLOW-01 to WORKFLOW-03, WORKFLOW-06 to WORKFLOW-07, FRONTEND-01 to FRONTEND-06, CLEANUP-01 to CLEANUP-06
**Phase ID:** 3
**Depends On:** Phase 2

### Success Criteria

1. Create mail form includes PDF upload input
2. File input validates PDF type and size
3. Mail detail page shows PDF with view/download
4. Action required field is free text input
5. Role badges display correctly for auditor and clerk
6. Codebase cleaned of unused files
7. All functionality tested end-to-end

---

## Phase Mapping

| Requirement | Phase | Description |
|-------------|-------|-------------|
| PDF-01 to PDF-11 | 1 | PDF model and endpoints | Complete    | 2026-02-20 | 1 | Docker infrastructure |
| NGINX-01 to NGINX-08 | 1 | Nginx configuration |
| ROLE-01 to ROLE-08 | 2 | Role system expansion |
| BACKEND-01 to BACKEND-06 | 2 | Backend updates |
| WORKFLOW-04 to WORKFLOW-05 | 2 | Free-text action backend |
| WORKFLOW-01 to WORKFLOW-03 | 3 | PDF in create mail |
| WORKFLOW-06 to WORKFLOW-07 | 3 | PDF viewing |
| FRONTEND-01 to FRONTEND-06 | 3 | Frontend updates |
| CLEANUP-01 to CLEANUP-06 | 3 | Codebase cleanup |

---

## Coverage Summary

| Category | Total | Phase 1 | Phase 2 | Phase 3 |
|----------|-------|---------|---------|---------|
| PDF System | 11 | 11 | 0 | 0 |
| Docker | 10 | 10 | 0 | 0 |
| Nginx | 8 | 8 | 0 | 0 |
| Roles | 8 | 0 | 8 | 0 |
| Backend | 6 | 0 | 6 | 0 |
| Workflow | 7 | 0 | 2 | 5 |
| Frontend | 6 | 0 | 0 | 6 |
| Cleanup | 6 | 0 | 0 | 6 |
| **Total** | **52** | **29** | **16** | **17** |

**Coverage Status:** 100% ✓

---

## Dependencies

```
Phase 1 (Infrastructure)
    ↓
Phase 2 (Roles & Backend)
    ↓
Phase 3 (Frontend & Cleanup)
```

---

*Roadmap created: 2026-02-20*
*Last updated: 2026-02-20*
