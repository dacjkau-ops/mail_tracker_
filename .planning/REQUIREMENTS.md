# Requirements: Mail Tracker Enhancements

**Defined:** 2026-02-20
**Core Value:** Users can securely attach, store, and view PDF documents with proper access control and audit logging

## v1 Requirements

### PDF Attachment System

- [x] **PDF-01**: RecordAttachment model exists with fields: record (FK), file (FileField, UUID.pdf filename), original_filename, file_size, uploaded_by (FK), uploaded_at, upload_stage, is_current
- [x] **PDF-02**: Upload endpoint POST /api/records/{id}/pdf/ accepts multipart/form-data with PDF file (max 10MB)
- [x] **PDF-03**: Upload endpoint enforces role-based permissions matching record access
- [x] **PDF-04**: Upload replaces existing PDF within the same workflow stage (one PDF per stage: 'created' or 'closed'; up to two active PDFs per record)
- [x] **PDF-05**: Metadata endpoint GET /api/records/{id}/pdf/ returns attachment metadata and exists flag
- [x] **PDF-06**: View endpoint GET /api/records/{id}/pdf/view/ returns 200 with X-Accel-Redirect header to internal nginx location
- [x] **PDF-07**: View endpoint enforces read permissions before issuing redirect
- [x] **PDF-08**: PDF stored at configurable path (/srv/mailtracker/pdfs in production, local path in dev)
- [x] **PDF-09**: ~~Audit log entry created on PDF upload with action PDF_UPLOAD~~ — **Superseded by context decision**: audit info captured in RecordAttachment model fields (uploaded_by, uploaded_at, upload_stage). AuditTrail choice PDF_UPLOAD added to schema for forward compatibility only.
- [x] **PDF-10**: ~~Audit log entry created on PDF replacement with action PDF_REPLACE~~ — **Superseded by context decision**: same rationale as PDF-09. RecordAttachment.is_current=False on replaced attachment serves as the immutable replacement record.
- [x] **PDF-11**: ~~Audit log entry created on PDF delete with action PDF_DELETE~~ — **Superseded by context decision**: PDFs are permanent (no hard deletion). PDF_DELETE added to schema only for future compatibility.

### Docker Deployment

- [x] **DOCKER-01**: docker-compose.yml defines postgres, backend, and nginx services
- [x] **DOCKER-02**: postgres service uses persistent named Docker volume (postgres_data at /var/lib/postgresql/data)
- [x] **DOCKER-03**: backend service builds from Dockerfile and runs migrations on startup
- [x] **DOCKER-04**: backend service runs gunicorn on port 8000
- [x] **DOCKER-05**: nginx service proxies /api/ to backend service
- [x] **DOCKER-06**: nginx service serves /static/ from shared volume
- [x] **DOCKER-07**: PDFs volume mounted to both backend (write) and nginx (read) at /srv/mailtracker/pdfs
- [x] **DOCKER-08**: Static files volume mounted to backend (write) and nginx (read)
- [x] **DOCKER-09**: Environment variables loaded from .env file: SECRET_KEY, DEBUG, ALLOWED_HOSTS, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, DATABASE_URL, PDF_STORAGE_PATH
- [x] **DOCKER-10**: Services communicate via internal Docker network

### Nginx Configuration

- [x] **NGINX-01**: nginx.conf configures upstream backend for gunicorn
- [x] **NGINX-02**: Location /api/ proxies to backend with proper headers
- [x] **NGINX-03**: Location /static/ serves files from shared volume
- [x] **NGINX-04**: Internal location /_protected_pdfs/ defined with internal directive
- [x] **NGINX-05**: /_protected_pdfs/ maps to /srv/mailtracker/pdfs/ filesystem path
- [x] **NGINX-06**: X-Accel-Redirect responses handled correctly
- [x] **NGINX-07**: Range requests enabled for PDF streaming
- [x] **NGINX-08**: Correct MIME types set for PDF files

### Role System Expansion

- [x] **ROLE-01**: User model supports new roles: auditor, clerk
- [ ] **ROLE-02**: AG has full access (unchanged)
- [ ] **ROLE-03**: DAG has section-level visibility (can see all mails in their section)
- [ ] **ROLE-04**: SrAO/AAO have subsection-level visibility (can see mails in their subsection)
- [ ] **ROLE-05**: Clerk has subsection-level visibility (can see mails in their subsection)
- [ ] **ROLE-06**: Auditor has read-only access with configurable visibility level
- [ ] **ROLE-07**: All authenticated users can create mails (AG, DAG, SrAO, AAO, clerk)
- [x] **ROLE-08**: Role hierarchy enforced in all list/detail endpoints

### Workflow Changes

- [x] **WORKFLOW-01**: Create mail page includes PDF upload field
- [ ] **WORKFLOW-02**: PDF uploaded during mail creation is attached to the record
- [x] **WORKFLOW-03**: action_required field changed from dropdown to free text input
- [x] **WORKFLOW-04**: Free text action_required has max length validation (500 chars)
- [x] **WORKFLOW-05**: Existing action_required choices preserved for data compatibility
- [x] **WORKFLOW-06**: Mail detail page shows PDF attachment if exists
- [x] **WORKFLOW-07**: PDF can be viewed inline or downloaded from detail page

### Backend Updates

- [x] **BACKEND-01**: Permission classes updated for new hierarchy
- [ ] **BACKEND-02**: List endpoints filter by user's visibility level
- [ ] **BACKEND-03**: MailRecordSerializer includes attachment metadata
- [ ] **BACKEND-04**: Settings support both SQLite (dev) and PostgreSQL (docker)
- [ ] **BACKEND-05**: File storage backend configurable via environment
- [x] **BACKEND-06**: AuditTrail ACTION_CHOICES includes PDF operations

### Frontend Updates

- [x] **FRONTEND-01**: Create mail form includes file input for PDF upload
- [ ] **FRONTEND-02**: File input shows selected filename and validation
- [ ] **FRONTEND-03**: Action required changed from Select to TextField
- [ ] **FRONTEND-04**: Mail detail page displays PDF attachment section
- [ ] **FRONTEND-05**: PDF view button opens in new tab or downloads
- [x] **FRONTEND-06**: Role badge updated to show new roles

### Codebase Cleanup

- [x] **CLEANUP-01**: Unused imports removed from all Python files
- [ ] **CLEANUP-02**: Unused components removed from frontend
- [ ] **CLEANUP-03**: Sample data files organized or removed if not needed
- [ ] **CLEANUP-04**: Deprecated fields marked or removed
- [ ] **CLEANUP-05**: Build artifacts not tracked in git
- [x] **CLEANUP-06**: Documentation updated to reflect changes

### Password Change (v1.1)

- [ ] **PASSWD-01**: Login page includes a "Change Password" link navigating to `/change-password`
- [ ] **PASSWD-02**: `/change-password` page renders a form with: Username, Current Password, New Password, Confirm New Password
- [ ] **PASSWD-03**: Backend `POST /api/auth/change-password/` authenticates via username + current password (no JWT required)
- [ ] **PASSWD-04**: Backend validates new password matches confirm password before updating
- [ ] **PASSWD-05**: Backend enforces minimum password length of 8 characters
- [ ] **PASSWD-06**: On success, user is redirected to `/login` with a success message
- [ ] **PASSWD-07**: On failure, user sees specific error messages (wrong current password, mismatch, too short)

### UI/UX Refresh — Mail Detail (v1.1)

- [ ] **UIUX-01**: Mail Detail header shows Subject as primary title (h5 typography)
- [ ] **UIUX-02**: Serial Number (sl_no) displayed as secondary subtitle below the title
- [ ] **UIUX-03**: Status Chip with color coding shown next to title (Received=gray, Assigned=blue, In Progress=orange, Closed=green)
- [ ] **UIUX-04**: Mail Detail uses two-column layout (65% left / 35% right)
- [ ] **UIUX-05**: Left column contains Origin Card (from_office, date_received, letter_no, section)
- [ ] **UIUX-06**: Left column contains Instructions Card (action_required)
- [ ] **UIUX-07**: Left column contains Handler Remarks Card (current remarks)
- [ ] **UIUX-08**: Right column contains Current Handler Card with handler name and time-in-stage displayed
- [ ] **UIUX-09**: Due date shown in right column with red highlight when overdue and status is not Closed
- [ ] **UIUX-10**: Action buttons (Reassign, Close, Reopen, Edit Remarks) grouped in right column top area
- [ ] **UIUX-11**: Audit trail displayed as vertical MUI Timeline (replaces existing table)
- [ ] **UIUX-12**: Timeline entries show: timestamp, action type, performed by, remarks
- [ ] **UIUX-13**: Fields with null/empty values are hidden conditionally (not shown as blank or N/A)

## v2 Requirements (Future)

### Additional Features

- **V2-01**: Multiple PDF attachments per record
- **V2-02**: PDF preview thumbnail generation
- **V2-03**: Drag-and-drop file upload
- **V2-04**: Upload progress indicator
- **V2-05**: PDF virus scanning on upload
- **V2-06**: Backup and restore functionality for PDFs

### Advanced Deployment

- **V2-07**: Health checks for all services
- **V2-08**: Automated database backups
- **V2-09**: Log aggregation with structured logging
- **V2-10**: SSL/TLS termination in nginx

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud storage integration | On-premise requirement |
| Email notifications | Already excluded per CLAUDE.md |
| Real-time chat | Already excluded per CLAUDE.md |
| Mobile app | Web-only per CLAUDE.md |
| OCR/text extraction | Not needed for viewing |
| PDF annotation/editing | View-only requirement |
| Advanced reporting | Deferred to v2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PDF-01 to PDF-11 | Phase 1 | Pending |
| DOCKER-01 to DOCKER-10 | Phase 1 | Pending |
| NGINX-01 to NGINX-08 | Phase 1 | Pending |
| ROLE-01 to ROLE-08 | Phase 2 | Complete |
| WORKFLOW-01 to WORKFLOW-07 | Phase 2 | Complete |
| BACKEND-01 to BACKEND-06 | Phase 2 | Complete |
| FRONTEND-01 to FRONTEND-06 | Phase 3 | Complete |
| CLEANUP-01 to CLEANUP-06 | Phase 3 | Complete |
| PASSWD-01 to PASSWD-07 | Phase 4 | Pending |
| UIUX-01 to UIUX-13 | Phase 5 | Pending |

**Coverage:**
- v1 requirements (v1.0): 52 total — all complete ✓
- v1.1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-22 after v1.1 milestone scope definition*
