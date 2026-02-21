# Phase 1: Infrastructure & PDF Backend - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish Docker Compose infrastructure (postgres, backend, nginx) and the Django PDF attachment backend — model, upload/view endpoints, and X-Accel-Redirect serving. No frontend UI, no role system changes. Pure backend + infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Dev environment setup
- Everything runs in Docker (all services in containers — no native Django on Windows)
- Dev laptop uses SQLite (existing db.sqlite3), Ubuntu production server uses PostgreSQL
- How to handle dev vs prod split (two compose files vs env-variable switching): Claude's discretion
- PDF storage location inside Docker for dev (named volume vs bind mount): Claude's discretion

### PDF upload permissions
- PDF upload is allowed when **creating a mail** — same users who can create (AG and DAG)
- PDF upload is allowed when **closing a mail** — whoever is the current handler closing the record
- PDF upload is NOT allowed mid-workflow (no upload during reassign, remarks updates, etc.)
- PDF is the document evidence that accompanies creation or closure — alternative to typed remarks
- Anyone who can **view the mail record** can view its attached PDFs

### PDF attachment model — multiple PDFs per record
- Multiple PDFs allowed per record (one per workflow stage: Created, Closed)
- Each PDF is **tagged by stage** — users see "PDF uploaded at: Created by X on date" and "PDF uploaded at: Closed by Y on date"
- One PDF per stage maximum — uploading a new PDF for the same stage **replaces** the previous one for that stage
- **No deletion** — PDFs are permanent once uploaded (replacing within a stage is allowed, hard deletion is not)
- Audit trail via attachment record metadata only (uploaded_by + uploaded_at in the model) — no separate AuditTrail entries for PDF

### Nginx configuration
- HTTP only for now, but nginx.conf structured so HTTPS can be enabled by uncommenting SSL config later
- Port selection: Claude's discretion (standard approach for clean LAN access)
- Nginx handles backend API proxying + PDF serving only — React frontend is served separately (not by this nginx)
- PDF viewing: opens inline in a new browser tab (Content-Disposition: inline) using X-Accel-Redirect + range requests for streaming

### Claude's Discretion
- Whether to use two docker-compose files (dev/prod) or single file with .env switching
- Dev PDF storage (named volume vs bind mount to local folder)
- Which port nginx exposes on the host
- Exact nginx.conf structure and upstream naming

</decisions>

<specifics>
## Specific Ideas

- "Anyone who can create the mail will upload the PDF there. Similarly if one is closing the mail — either detailed remarks/action will be noted or a PDF will be uploaded." — PDF is the document evidence for key workflow actions
- PDF must open in a new browser tab using streaming (not downloaded) — browser's built-in PDF viewer is acceptable
- Dev on Windows laptop first, deploy to Ubuntu server on Monday — Docker setup must work on both

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-infrastructure-pdf-backend*
*Context gathered: 2026-02-20*
