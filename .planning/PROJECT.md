# Mail Tracker Enhancement Project

## What This Is

Enhancement of an existing Django + React Mail Tracking application to add PDF attachment support, Docker deployment, expanded role hierarchy, and improved workflow flexibility. The system tracks received mails/actions, assigns them to officers, monitors progress through different stages, and maintains a complete audit trail.

## Core Value

Users can securely attach, store, and view PDF documents for mail records with proper access control and audit logging, while maintaining the existing hierarchy-based visibility and workflow automation.

## Requirements

### Validated (Existing - Working)

- ✓ User authentication with JWT (AG, DAG, SrAO, AAO roles) — existing
- ✓ Mail record CRUD with auto-generated serial numbers — existing
- ✓ Role-based permission system — existing
- ✓ Section/subsection hierarchy — existing
- ✓ Audit trail for all mail actions — existing
- ✓ Multi-assignment support — existing
- ✓ Auto-transition workflow (Received → Assigned → In Progress → Closed) — existing
- ✓ PDF export of mail list — existing

### Active (Current Scope - To Build)

- [ ] PDF attachment upload and storage system
- [ ] X-Accel-Redirect based PDF viewing via Nginx
- [ ] Docker Compose deployment with PostgreSQL
- [ ] Nginx reverse proxy configuration
- [ ] Additional roles (auditor, clerk)
- [ ] Universal mail creation permissions (all roles)
- [ ] Bottom-up hierarchy visibility model
- [ ] Free-text action field (replacing dropdown)
- [ ] PDF upload integration in mail creation
- [ ] Codebase cleanup and optimization

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
| One PDF per record only | Simplicity, matches use case | — Pending |
| Nginx X-Accel-Redirect | Django authorizes, Nginx streams efficiently | — Pending |
| PostgreSQL in Docker | Production-grade, fits Docker model | — Pending |
| Everyone creates mails | Workflow requirement from office | — Pending |
| Bottom-up visibility | Section heads need oversight of subordinates | — Pending |
| Free-text action field | Flexibility in describing actions | — Pending |

---
*Last updated: 2026-02-20 after requirements gathering*
