# Mail Tracker Enhancement Project

## What This Is

Enhancement of an existing Django + React Mail Tracking application. The system tracks received mails/actions, assigns them to officers, monitors progress through different stages, and maintains a complete audit trail. v1.0 added PDF attachments, Docker deployment, and expanded roles. v1.1 added self-service password change and a full redesign of the Mail Detail view for clearer information hierarchy.

## Current State (after v1.1)

**Shipped milestones:**
- **v1.0** (2026-02-21) — Docker + PostgreSQL, PDF upload/view via X-Accel-Redirect, auditor/clerk roles, universal mail creation, bottom-up visibility, free-text action field, Nginx proxy
- **v1.1** (2026-02-22) — Self-service password change (no JWT required), Mail Detail two-column redesign, MUI Timeline audit trail, inline remarks editing, status chip grouping (Pending/In Progress/Closed)

**Codebase:** 3,158 Python LOC (backend) + 4,244 React/JS LOC (frontend)

**Tech stack:** Django 5.x + DRF + SimpleJWT | React 18 + MUI v5 + @mui/lab | PostgreSQL in Docker | Nginx (X-Accel-Redirect) | Docker Compose

## Core Value

An on-premise office workflow tracker where every mail/action is visible to the right people, assigned to someone accountable, and tracked through its lifecycle — with a complete audit trail showing who did what and when.

## Requirements

### Validated

- ✓ User authentication with JWT (AG, DAG, SrAO, AAO, auditor, clerk roles) — v1.0
- ✓ Mail record CRUD with auto-generated serial numbers — v1.0
- ✓ Role-based permission system — v1.0
- ✓ Section/subsection hierarchy — v1.0
- ✓ Audit trail for all mail actions — v1.0
- ✓ Multi-assignment support — v1.0
- ✓ Auto-transition workflow (Received → Assigned → In Progress → Closed) — v1.0
- ✓ PDF export of mail list — v1.0
- ✓ PDF attachment upload and storage system — v1.0
- ✓ X-Accel-Redirect based PDF viewing via Nginx — v1.0
- ✓ Docker Compose deployment with PostgreSQL — v1.0
- ✓ Nginx reverse proxy configuration — v1.0
- ✓ Additional roles (auditor, clerk) — v1.0
- ✓ Universal mail creation permissions (all roles) — v1.0
- ✓ Bottom-up hierarchy visibility model — v1.0
- ✓ Free-text action field (replacing dropdown) — v1.0
- ✓ PDF upload integration in mail creation — v1.0
- ✓ Codebase cleanup and optimization — v1.0
- ✓ Self-service password change (no JWT required, credential-based auth) — v1.1
- ✓ Mail Detail header redesign (Subject h5 title, sl_no subtitle, Pending/In Progress/Closed chip) — v1.1
- ✓ Two-column Mail Detail layout (65% info / 35% tracking) — v1.1
- ✓ Card-based information grouping (Origin, Instructions, Handler Remarks) — v1.1
- ✓ Inline remarks editing (click-to-edit TextField in Handler Remarks card) — v1.1
- ✓ Due date overdue highlighting (red text + warning banner) — v1.1
- ✓ MUI Timeline audit trail (newest-first, color-coded, relative+absolute timestamps) — v1.1
- ✓ Conditional field display (null/empty fields hidden, no N/A placeholders) — v1.1

### Active (Next Milestone)

*(No active requirements — planning next milestone)*

### Out of Scope

- Multiple attachments per mail — one PDF per record (simplicity)
- PDF editing or annotation — view-only
- OCR or text extraction from PDFs — not needed
- Cloud storage (S3, etc.) — on-premise filesystem only
- Email notifications — intentionally excluded
- Real-time updates via WebSockets — not needed
- Mobile app — web-only
- Advanced search within PDFs — not needed

## Context

### Current System State

**Backend (Django):**
- Django 5.x + DRF + SimpleJWT
- PostgreSQL in Docker (production), SQLite (dev fallback)
- Roles: AG, DAG, SrAO, AAO, auditor, clerk
- Password change endpoint: POST /api/auth/change-password/ (AllowAny, credential-auth)
- PDF storage: /srv/mailtracker/pdfs (UUID filenames, metadata in DB)
- Audit trail: AuditTrail model with all action types

**Frontend (React):**
- React 18 + MUI v5 + @mui/lab (Timeline components)
- Mail Detail: two-column card layout, MUI Timeline audit trail, inline remarks editing
- ChangePasswordPage at /change-password (public route, no JWT required)
- Constants: DETAIL_STATUS_CHIP (Pending/In Progress/Closed grouping)

**Deployment:**
- Docker Compose: postgres + backend + nginx services
- Nginx: proxies /api/, serves /static/, internal /_protected_pdfs/ via X-Accel-Redirect
- Persistent volumes: postgres_data, pdfs, staticfiles

## Constraints

- **Storage:** PDFs on filesystem, not database — performance
- **Security:** X-Accel-Redirect required, Django authorizes but doesn't stream PDFs
- **Hosting:** On-premise only (laptop/server), no cloud dependencies
- **Database:** PostgreSQL in Docker for production (SQLite for dev)
- **Scale:** Designed for single-office use, not multi-tenant

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| One PDF per record only | Simplicity, matches use case | ✓ Good |
| Nginx X-Accel-Redirect | Django authorizes, Nginx streams efficiently | ✓ Good |
| PostgreSQL in Docker | Production-grade, fits Docker model | ✓ Good |
| Everyone creates mails | Workflow requirement from office | ✓ Good |
| Bottom-up visibility | Section heads need oversight of subordinates | ✓ Good |
| Free-text action field | Flexibility in describing actions | ✓ Good |
| Card-based detail view | Better information hierarchy than table | ✓ Good |
| Two-column layout (65/35) | Separates mail context from tracking/accountability | ✓ Good |
| Vertical MUI Timeline | Easier to follow audit story than table rows | ✓ Good |
| Change password as separate page | Cleaner UX than modal; standard pattern users know | ✓ Good |
| AllowAny on change-password endpoint | Users may be logged out or have expired tokens | ✓ Good |
| Inline remarks editing | Natural in-context editing; no modal friction | ✓ Good |
| Status chip grouping (Received+Assigned→Pending) | Reader perspective: both mean "not actively worked on" | ✓ Good |
| Handler Remarks always visible | Most important field in the detail view; never hidden | ✓ Good |
| Two-layer overdue warning | Red due date text + banner ensures visibility | ✓ Good |

---
*Last updated: 2026-02-22 after v1.1 milestone — Password Change + UI/UX Refresh complete*
