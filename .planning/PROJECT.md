# Mail Tracker Enhancement Project

## What This Is

Enhancement of an existing Django + React Mail Tracking application. The system tracks received mails/actions, assigns them to officers, monitors progress through different stages, and maintains a complete audit trail. v1.0 added PDF attachments, Docker deployment, and expanded roles. v1.1 focuses on UI/UX improvements for the mail detail view.

## Current Milestone: v1.1 UI/UX Refresh

**Goal:** Redesign the Mail Detail view for better clarity, context, and usability

**Target features:**
- Header redesign with Subject as primary heading and Serial Number as secondary
- Two-column layout separating core information from tracking/accountability
- Card-based presentation for Origin, Instructions, and Handler Remarks
- Prominent time tracking and due date display with overdue highlighting
- Vertical Timeline for audit trail instead of table
- Conditional field display (hide N/A values)

## Core Value

Users can securely attach, store, and view PDF documents for mail records with proper access control and audit logging, while maintaining the existing hierarchy-based visibility and workflow automation.

## Requirements

### Validated (Existing - Working)

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

### Active (Current Scope - To Build)

- [ ] Redesigned Mail Detail header with Subject/Serial as title
- [ ] Status Chip with color coding next to title
- [ ] Two-column layout (65%/35%) for detail view
- [ ] MUI Cards for Origin, Instruction, and Handler Remarks
- [ ] Current Handler card with time tracking display
- [ ] Due Date with overdue highlighting
- [ ] Vertical Timeline for audit trail history
- [ ] Action buttons grouped in top-right corner
- [ ] Hide N/A fields conditionally

### Out of Scope

- Multiple attachments per mail — only one PDF per record (keep it simple)
- PDF editing or annotation — view-only
- OCR or text extraction from PDFs — not needed
- Cloud storage (S3, etc.) — local file system only
- Email notifications — already out of scope
- Real-time updates via WebSockets — polling is sufficient
- Mobile app — web-only
- Advanced search within PDFs — not needed

## Context

### Current System State

**Backend:**
- Django 5.x with Django REST Framework
- SQLite database (to be migrated to PostgreSQL in Docker)
- JWT authentication (SimpleJWT)
- Existing roles: AG, DAG, SrAO, AAO
- No file upload capability currently exists
- Audit trail implemented via AuditTrail model

**Frontend:**
- React 18 with Material-UI v5
- Axios for API calls
- No file upload components exist
- Current action_required is a dropdown with fixed choices

**Current Permission Model:**
- AG: Full access, can create for any section
- DAG: Can create only for own section
- SrAO/AAO: Cannot create mails
- Visibility based on assignment + "touched" records

### New Requirements Context

**PDF Storage:**
- Production path: `/srv/mailtracker/pdfs`
- UUID-based filenames to prevent collisions
- Database stores only metadata (filename, original name, size)
- Nginx serves files directly via X-Accel-Redirect

**Deployment:**
- On-premise Docker deployment
- PostgreSQL for production database
- Nginx as reverse proxy and static/PDF server
- Persistent volumes for data and PDFs

**Role Changes:**
- Add "auditor" (read-only, cross-section visibility)
- Add "clerk" (can create, limited visibility)
- Everyone can create mails (AG, DAG, SrAO, AAO, clerk)
- Bottom-up visibility: See own level and below

## Constraints

- **Storage:** PDFs stored on filesystem, not database — performance
- **Security:** X-Accel-Redirect required, Django must not stream PDFs — security
- **Permissions:** Must maintain existing audit trail and permission enforcement
- **Migration:** Must not break existing SQLite data during transition
- **Hosting:** On-premise only (laptop/server), no cloud dependencies
- **Compatibility:** Existing frontend must work during transition

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| One PDF per record only | Simplicity, matches use case | ✓ Good |
| Nginx X-Accel-Redirect | Django authorizes, Nginx streams efficiently | ✓ Good |
| PostgreSQL in Docker | Production-grade, fits Docker model | ✓ Good |
| Everyone creates mails | Workflow requirement from office | ✓ Good |
| Bottom-up visibility | Section heads need oversight of subordinates | ✓ Good |
| Free-text action field | Flexibility in describing actions | ✓ Good |
| Card-based detail view | Better information hierarchy than table | — Pending |
| Two-column layout | Separate context from tracking | — Pending |
| Vertical timeline | Easier to follow audit story than table | — Pending |

---
*Last updated: 2026-02-21 after starting v1.1 milestone*
