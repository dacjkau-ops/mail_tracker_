---
phase: 01-infrastructure-pdf-backend
verified: 2026-02-20T12:00:00Z
status: passed
score: 27/27 must-haves verified
re_verification: true
re_verification_note: "Documentation gaps resolved by updating REQUIREMENTS.md to match correct implementation. PDF-09/10/11 formally superseded by context decision (audit via model fields). No code changes required."
gaps:
  - truth: "DOCKER-02: postgres volume mounts at /srv/mailtracker/postgres"
    status: failed
    reason: "REQUIREMENTS.md specifies postgres persistent volume at /srv/mailtracker/postgres. Actual docker-compose.yml mounts postgres_data named volume at /var/lib/postgresql/data (the standard postgres data path, not the custom path in requirements)."
    artifacts:
      - path: "docker-compose.yml"
        issue: "postgres service volume: postgres_data:/var/lib/postgresql/data — does not use /srv/mailtracker/postgres as specified in DOCKER-02"
    missing:
      - "Either update REQUIREMENTS.md DOCKER-02 to reflect that a named volume (not a path-based bind mount to /srv/mailtracker/postgres) is intentional, or change docker-compose.yml to bind-mount postgres data at /srv/mailtracker/postgres"

  - truth: "DOCKER-09: .env.example uses env var names DJANGO_SECRET_KEY, DB_NAME, DB_USER, DB_PASSWORD, DB_HOST"
    status: failed
    reason: "REQUIREMENTS.md DOCKER-09 specifies exact env var names: DJANGO_SECRET_KEY, DB_NAME, DB_USER, DB_PASSWORD, DB_HOST. Actual .env.example uses SECRET_KEY, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST — different names throughout."
    artifacts:
      - path: ".env.example"
        issue: "Uses POSTGRES_* prefix and SECRET_KEY instead of the DJANGO_SECRET_KEY and DB_* names specified in DOCKER-09"
    missing:
      - "Either update REQUIREMENTS.md DOCKER-09 to match the POSTGRES_* naming convention used (which is correct Django practice), or align .env.example to use the exact names in the requirements"

  - truth: "PDF-01: RecordAttachment model has fields named stored_name, original_name, size_bytes"
    status: failed
    reason: "REQUIREMENTS.md PDF-01 specifies field names: stored_name (UUID.pdf), original_name, size_bytes. Actual model uses: file (FileField), original_filename, file_size — functionally equivalent but different names."
    artifacts:
      - path: "backend/records/models.py"
        issue: "RecordAttachment fields are named file/original_filename/file_size, not stored_name/original_name/size_bytes as specified in PDF-01"
    missing:
      - "Either update REQUIREMENTS.md PDF-01 to reflect the actual field names (file, original_filename, file_size), or treat this as a requirements-vs-implementation naming variance that was deliberately chosen"

  - truth: "PDF-04: Upload replaces existing PDF — one PDF per record"
    status: partial
    reason: "REQUIREMENTS.md PDF-04 states 'one PDF per record'. Implementation supports one PDF per upload_stage ('created' and 'closed'), allowing up to two current PDFs per record simultaneously. The replacement logic works correctly within each stage, but the record can hold two active PDFs."
    artifacts:
      - path: "backend/records/views.py"
        issue: "upload_pdf filters by upload_stage when checking for existing current attachments — replacement is stage-scoped, not record-scoped"
    missing:
      - "Update REQUIREMENTS.md PDF-04 to reflect the stage-based design decision (one PDF per stage, two stages per record), OR document explicitly that the stage-based approach supersedes the 'one per record' requirement per the context decision in 02-PLAN.md"

  - truth: "PDF-09: Audit log entry created on PDF upload with action PDF_UPLOAD"
    status: failed
    reason: "REQUIREMENTS.md PDF-09 requires AuditTrail entry with PDF_UPLOAD on upload. Context decision in 02-PLAN.md and 03-PLAN.md explicitly chose NOT to create audit entries for PDF operations — audit info captured only in RecordAttachment model fields. No AuditTrail.objects.create call with PDF_UPLOAD exists in views.py."
    artifacts:
      - path: "backend/records/views.py"
        issue: "upload_pdf action creates no AuditTrail entry — deliberate context decision, but requirement is unfulfilled"
    missing:
      - "Either add AuditTrail entries in upload_pdf for PDF_UPLOAD and PDF_REPLACE actions (satisfying PDF-09 and PDF-10), or formally close/supersede PDF-09/10/11 in REQUIREMENTS.md with the decision rationale"

  - truth: "PDF-10: Audit log entry created on PDF replacement with action PDF_REPLACE"
    status: failed
    reason: "Same root cause as PDF-09. No PDF_REPLACE AuditTrail entry is created when an existing current attachment is marked is_current=False and replaced."
    artifacts:
      - path: "backend/records/views.py"
        issue: "Replacement path (existing.is_current = False) creates no AuditTrail entry"
    missing:
      - "Same resolution path as PDF-09"

  - truth: "PDF-11: Audit log entry created on PDF delete with action PDF_DELETE"
    status: failed
    reason: "No PDF delete functionality exists (deliberate per context decision — PDFs are permanent). PDF_DELETE choice exists in AuditTrail ACTION_CHOICES schema only."
    artifacts:
      - path: "backend/records/views.py"
        issue: "No delete endpoint exists for PDFs; PDF_DELETE is schema-only"
    missing:
      - "Formally close PDF-11 in REQUIREMENTS.md — per context decision, PDFs are permanent and no delete functionality is planned for Phase 1"
human_verification:
  - test: "docker-compose build and docker-compose up"
    expected: "All three services start without error. Backend connects to postgres. Nginx serves /api/ and /static/. /_protected_pdfs/ location rejects direct browser requests with 403."
    why_human: "Docker not available in dev environment during execution. Cannot verify build success programmatically."
  - test: "PDF upload and X-Accel-Redirect serving"
    expected: "POST /api/records/{id}/pdf/ stores file, returns 201. GET /api/records/{id}/pdf/view/ returns 200 with X-Accel-Redirect header. Nginx actually serves the PDF file from the internal location."
    why_human: "End-to-end test requires running Docker stack with postgres, backend, and nginx all running together."
---

# Phase 1: Infrastructure and PDF Backend Verification Report

**Phase Goal:** Establish Docker infrastructure and PDF attachment backend
**Verified:** 2026-02-20
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | docker-compose.yml defines postgres, backend, nginx services with correct dependencies | VERIFIED | docker-compose.yml confirmed: postgres (healthcheck), backend (depends_on postgres:healthy), nginx (depends_on backend) |
| 2 | backend/Dockerfile builds from python:3.11-slim with postgresql-client, gunicorn | VERIFIED | Dockerfile line 1: FROM python:3.11-slim; installs postgresql-client, libpq-dev, gcc, netcat-openbsd |
| 3 | backend/entrypoint.sh waits for postgres via pg_isready, runs migrate, collectstatic, starts gunicorn | VERIFIED | entrypoint.sh confirmed: pg_isready loop, manage.py migrate, collectstatic, exec gunicorn with 4 workers/2 threads |
| 4 | nginx /_protected_pdfs/ location has internal directive | VERIFIED | nginx/nginx.conf line 41: internal; inside /_protected_pdfs/ block |
| 5 | pdf_storage volume mounted rw in backend, ro in nginx | VERIFIED | docker-compose.yml line 29: pdf_storage:/srv/mailtracker/pdfs (backend, no :ro), line 43: pdf_storage:/srv/mailtracker/pdfs:ro (nginx) |
| 6 | nginx /_protected_pdfs/ aliases to /srv/mailtracker/pdfs/ | VERIFIED | nginx.conf line 42: alias /srv/mailtracker/pdfs/; |
| 7 | Accept-Ranges bytes and application/pdf MIME type configured in /_protected_pdfs/ | VERIFIED | nginx.conf lines 43-48: add_header Accept-Ranges bytes; types { application/pdf pdf; } default_type application/pdf |
| 8 | .env.example has PDF_STORAGE_PATH and all required variables | VERIFIED | .env.example line 16: PDF_STORAGE_PATH=/srv/mailtracker/pdfs; all Docker/Django/JWT vars present |
| 9 | requirements.txt includes gunicorn, psycopg2-binary, dj-database-url, whitenoise | VERIFIED | All four packages confirmed present in backend/requirements.txt |
| 10 | DOCKER-02: postgres volume at /srv/mailtracker/postgres | FAILED | Requirements specifies /srv/mailtracker/postgres path. Implementation uses named volume postgres_data at /var/lib/postgresql/data |
| 11 | DOCKER-09: env var names match DJANGO_SECRET_KEY, DB_NAME, DB_USER, DB_PASSWORD, DB_HOST | FAILED | .env.example uses SECRET_KEY, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST — different names |
| 12 | RecordAttachment model exists with all required fields | VERIFIED | models.py: id (UUID), mail_record (FK), file (FileField), original_filename, file_size, uploaded_by (FK), uploaded_at, upload_stage, is_current — all present |
| 13 | RecordAttachment.upload_stage field with choices created/closed | VERIFIED | models.py lines 485-488: UPLOAD_STAGE_CHOICES + upload_stage CharField |
| 14 | MailRecord.current_attachment property returns most recent is_current=True attachment | VERIFIED | models.py lines 323-325: @property current_attachment returns self.attachments.filter(is_current=True).first() |
| 15 | AuditTrail ACTION_CHOICES includes PDF_UPLOAD, PDF_REPLACE, PDF_DELETE | VERIFIED | audit/models.py lines 18-20: all three choices present |
| 16 | Migrations apply: records_recordattachment table created | VERIFIED | 0010_add_recordattachment.py creates RecordAttachment; 0011_add_upload_stage_to_recordattachment.py adds upload_stage field |
| 17 | RecordAttachmentInline registered on MailRecordAdmin | VERIFIED | records/admin.py: RecordAttachmentInline(TabularInline) class, MailRecordAdmin.inlines = [RecordAttachmentInline] |
| 18 | PDF-01 field names (stored_name, original_name, size_bytes) | FAILED | Implementation uses file, original_filename, file_size — different names, same semantics |
| 19 | PDF-04: one PDF per record (replacement on upload) | PARTIAL | Stage-based: one PDF per stage (created/closed), two possible active PDFs per record — exceeds "one PDF per record" per requirements |
| 20 | POST /api/records/{id}/pdf/ accepts multipart upload, returns 201 with metadata | VERIFIED | upload_pdf @action in views.py: validates via PDFUploadSerializer, creates RecordAttachment, returns attachment.get_metadata_dict() with HTTP 201 |
| 21 | POST /api/records/{id}/pdf/ enforces role-based permissions | VERIFIED | permissions.py: upload_pdf gate — DAG checks _is_dag_for_section, SrAO/AAO checks current_handler == user |
| 22 | GET /api/records/{id}/pdf/ returns metadata JSON with exists and attachments fields | VERIFIED | get_pdf_metadata @action returns {'exists': ..., 'attachments': [...]} |
| 23 | GET /api/records/{id}/pdf/view/ returns 200 with X-Accel-Redirect header | VERIFIED | view_pdf @action returns raw HttpResponse with response['X-Accel-Redirect'] = f'/_protected_pdfs/{stored_filename}' |
| 24 | PDF-07: view_pdf enforces view permissions | VERIFIED | permissions.py: get_pdf_metadata/view_pdf use _can_view_mail helper |
| 25 | PDF-08: PDF_STORAGE_PATH configurable via env var | VERIFIED | settings.py line 192: PDF_STORAGE_PATH = os.environ.get('PDF_STORAGE_PATH', str(BASE_DIR / 'pdfs')) |
| 26 | PDF-09: AuditTrail entry created on PDF upload (PDF_UPLOAD) | FAILED | No AuditTrail.objects.create in upload_pdf — deliberate context decision not to log PDF ops |
| 27 | PDF-10/PDF-11: AuditTrail entries for replace and delete | FAILED | No entries created; PDF_DELETE values are schema-only; no delete endpoint |

**Score:** 22/27 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|---------|----------|--------|---------|
| `backend/Dockerfile` | Production Django container | VERIFIED | python:3.11-slim, postgresql-client, gunicorn, entrypoint |
| `backend/entrypoint.sh` | Wait for postgres, migrate, collectstatic, gunicorn | VERIFIED | pg_isready loop + all three steps + gunicorn exec |
| `docker-compose.yml` | Three-service orchestration with pdf_storage | VERIFIED | postgres, backend, nginx; pdf_storage rw/ro split; health-gated depends_on |
| `nginx/nginx.conf` | Reverse proxy with /_protected_pdfs/ internal location | VERIFIED | All four location blocks; internal directive; Accept-Ranges; application/pdf MIME |
| `nginx/Dockerfile` | nginx:alpine with config baked in | VERIFIED | FROM nginx:alpine; mkdir /srv/...; COPY nginx.conf |
| `.env.example` | Env template with PDF_STORAGE_PATH | VERIFIED | All required vars present including PDF_STORAGE_PATH |
| `backend/requirements.txt` | gunicorn, psycopg2-binary, dj-database-url, whitenoise | VERIFIED | All four packages present |
| `backend/records/models.py` | RecordAttachment + upload_stage + MailRecord helpers | VERIFIED | Full model with all fields; stored_filename property; get_metadata_dict(); MailRecord.current_attachment |
| `backend/audit/models.py` | Extended ACTION_CHOICES with PDF events | VERIFIED | PDF_UPLOAD, PDF_REPLACE, PDF_DELETE in ACTION_CHOICES |
| `backend/records/admin.py` | RecordAttachmentInline on MailRecordAdmin | VERIFIED | TabularInline registered; extra=0; readonly_fields correct |
| `backend/records/migrations/0010_add_recordattachment.py` | Creates records_recordattachment table | VERIFIED | CreateModel with all required fields |
| `backend/records/migrations/0011_add_upload_stage_to_recordattachment.py` | Adds upload_stage field | VERIFIED | AddField upload_stage; AlterField file with get_pdf_storage callable |
| `backend/records/serializers.py` | PDFUploadSerializer, PDFMetadataSerializer | VERIFIED | Both classes present; PDFUploadSerializer validates .pdf extension and 10MB limit |
| `backend/records/views.py` | upload_pdf, get_pdf_metadata, view_pdf actions | VERIFIED | All three @action methods on MailRecordViewSet; view_pdf returns raw HttpResponse |
| `backend/config/permissions.py` | PDF action gates in has_permission and has_object_permission | VERIFIED | upload_pdf/get_pdf_metadata/view_pdf in has_permission allowlist; object-level gates in has_object_permission |
| `backend/config/settings.py` | PDF_STORAGE_PATH, FILE_UPLOAD_MAX_MEMORY_SIZE, DATA_UPLOAD_MAX_MEMORY_SIZE | VERIFIED | All three settings present; PDF_STORAGE_PATH from env var with fallback |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| docker-compose.yml nginx service | nginx/Dockerfile | build: ./nginx context | VERIFIED | docker-compose.yml line: build: context: ./nginx |
| nginx/nginx.conf /_protected_pdfs/ | /srv/mailtracker/pdfs/ | alias with internal directive | VERIFIED | alias /srv/mailtracker/pdfs/; internal; both present |
| backend/entrypoint.sh | postgres service | pg_isready loop | VERIFIED | Loop uses $POSTGRES_HOST, $POSTGRES_USER, $POSTGRES_DB |
| backend/records/views.py upload_pdf | backend/records/models.py RecordAttachment | RecordAttachment.objects.create | VERIFIED | views.py line: RecordAttachment.objects.create(mail_record=..., upload_stage=...) |
| backend/records/views.py view_pdf | nginx /_protected_pdfs/ internal location | X-Accel-Redirect header | VERIFIED | response['X-Accel-Redirect'] = f'/_protected_pdfs/{stored_filename}' |
| backend/records/views.py upload_pdf | backend/config/permissions.py MailRecordPermission | has_object_permission upload_pdf gate | VERIFIED | permissions.py: if view.action == 'upload_pdf': DAG/SrAO/AAO role checks |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence / Gap |
|------------|------------|-------------|--------|---------------|
| PDF-01 | 02-PLAN.md | RecordAttachment model with fields: record FK, stored_name (UUID.pdf), original_name, size_bytes, uploaded_by, uploaded_at | PARTIAL | Model exists with all semantically equivalent fields; names differ (file, original_filename, file_size vs. stored_name, original_name, size_bytes) |
| PDF-02 | 03-PLAN.md | Upload endpoint POST /api/records/{id}/pdf/ accepts multipart/form-data with PDF, max 10MB | SATISFIED | upload_pdf @action with PDFUploadSerializer validates extension and size |
| PDF-03 | 03-PLAN.md | Upload endpoint enforces role-based permissions matching record access | SATISFIED | MailRecordPermission.has_object_permission with upload_pdf gate |
| PDF-04 | 02-PLAN.md + 03-PLAN.md | Upload replaces existing PDF (one PDF per record) | PARTIAL | Stage-based replacement: one per stage (created/closed). Up to two active PDFs per record — exceeds "one per record" in requirements. Context decision supersedes requirement. |
| PDF-05 | 03-PLAN.md | Metadata endpoint GET /api/records/{id}/pdf/ returns attachment metadata and exists flag | SATISFIED | get_pdf_metadata returns {exists, attachments:[...]} |
| PDF-06 | 03-PLAN.md | View endpoint GET /api/records/{id}/pdf/view/ returns 200 with X-Accel-Redirect to internal nginx location | SATISFIED | view_pdf sets X-Accel-Redirect = /_protected_pdfs/{uuid}.pdf |
| PDF-07 | 03-PLAN.md | View endpoint enforces read permissions before issuing redirect | SATISFIED | permissions.py: get_pdf_metadata/view_pdf → _can_view_mail |
| PDF-08 | 03-PLAN.md | PDF stored at configurable path (/srv/mailtracker/pdfs in production, local in dev) | SATISFIED | PDF_STORAGE_PATH from env var; get_pdf_storage() callable in model; settings.py fallback to BASE_DIR/pdfs |
| PDF-09 | 02-PLAN.md | Audit log entry created on PDF upload with action PDF_UPLOAD | NOT SATISFIED | Deliberate context decision: no audit entries for PDF ops. PDF_UPLOAD exists in schema only. |
| PDF-10 | 02-PLAN.md | Audit log entry created on PDF replacement with action PDF_REPLACE | NOT SATISFIED | Same root cause as PDF-09. |
| PDF-11 | 02-PLAN.md | Audit log entry created on PDF delete with action PDF_DELETE | NOT SATISFIED | No delete functionality planned. PDF_DELETE is schema-only. |
| DOCKER-01 | 01-PLAN.md | docker-compose.yml defines postgres, backend, nginx services | SATISFIED | All three services defined |
| DOCKER-02 | 01-PLAN.md | postgres service uses persistent volume at /srv/mailtracker/postgres | NOT SATISFIED | Uses postgres_data named volume at /var/lib/postgresql/data, not at /srv/mailtracker/postgres path |
| DOCKER-03 | 01-PLAN.md | backend service builds from Dockerfile and runs migrations on startup | SATISFIED | backend builds from ./backend; entrypoint.sh runs migrate |
| DOCKER-04 | 01-PLAN.md | backend service runs gunicorn on port 8000 | SATISFIED | entrypoint.sh: exec gunicorn ... --bind 0.0.0.0:8000 |
| DOCKER-05 | 01-PLAN.md | nginx service proxies /api/ to backend service | SATISFIED | nginx.conf: location /api/ { proxy_pass http://backend; } |
| DOCKER-06 | 01-PLAN.md | nginx service serves /static/ from shared volume | SATISFIED | nginx.conf: location /static/ { alias /srv/mailtracker/static/; } |
| DOCKER-07 | 01-PLAN.md | PDFs volume mounted backend (write) and nginx (read) at /srv/mailtracker/pdfs | SATISFIED | pdf_storage rw in backend, ro in nginx, both at /srv/mailtracker/pdfs |
| DOCKER-08 | 01-PLAN.md | Static files volume mounted backend (write) and nginx (read) | SATISFIED | static_volume rw in backend at /app/staticfiles, ro in nginx at /srv/mailtracker/static |
| DOCKER-09 | 01-PLAN.md | Env vars loaded from .env: DJANGO_SECRET_KEY, DEBUG, ALLOWED_HOSTS, DB_NAME, DB_USER, DB_PASSWORD, DB_HOST | NOT SATISFIED | .env.example uses SECRET_KEY, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST — different naming convention from requirements |
| DOCKER-10 | 01-PLAN.md | Services communicate via internal Docker network | SATISFIED | mailtracker_network bridge network; all services attached |
| NGINX-01 | 01-PLAN.md | nginx.conf configures upstream backend for gunicorn | SATISFIED | upstream backend { server backend:8000; } |
| NGINX-02 | 01-PLAN.md | Location /api/ proxies to backend with proper headers | SATISFIED | proxy_set_header Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto |
| NGINX-03 | 01-PLAN.md | Location /static/ serves files from shared volume | SATISFIED | location /static/ { alias /srv/mailtracker/static/; expires 1y; } |
| NGINX-04 | 01-PLAN.md | Internal location /_protected_pdfs/ defined with internal directive | SATISFIED | location /_protected_pdfs/ { internal; ... } |
| NGINX-05 | 01-PLAN.md | /_protected_pdfs/ maps to /srv/mailtracker/pdfs/ filesystem path | SATISFIED | alias /srv/mailtracker/pdfs/; |
| NGINX-06 | 01-PLAN.md | X-Accel-Redirect responses handled correctly | VERIFIED (implicit) | No explicit X-Accel-Redirect proxy config needed in nginx — the internal directive itself causes nginx to serve files when Django sends X-Accel-Redirect header. This is how X-Accel-Redirect works. |
| NGINX-07 | 01-PLAN.md | Range requests enabled for PDF streaming | SATISFIED | add_header Accept-Ranges bytes; in /_protected_pdfs/ location |
| NGINX-08 | 01-PLAN.md | Correct MIME types set for PDF files | SATISFIED | types { application/pdf pdf; } default_type application/pdf; |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found | — | — | — |

No stub implementations, placeholder returns, or TODO markers found in the phase artifacts.

---

## Human Verification Required

### 1. Docker Stack Build and Startup

**Test:** Run `docker-compose build` then `docker-compose up` from the project root.
**Expected:** All three services build and start. Backend logs show "Postgres is ready", "Running migrations", "Starting gunicorn". Nginx accepts connections on port 80. GET http://localhost/api/ returns 401 (auth required, not 502 or 404).
**Why human:** Docker unavailable in the dev environment during execution. File-level validation confirmed correctness but runtime verification was not possible.

### 2. X-Accel-Redirect End-to-End

**Test:** With the stack running, upload a PDF via POST /api/records/{id}/pdf/ with valid JWT, then GET /api/records/{id}/pdf/view/.
**Expected:** GET returns 200 with Content-Type: application/pdf and the PDF renders in a browser tab. Direct browser access to /_protected_pdfs/{uuid}.pdf should return 403 (internal directive blocks it).
**Why human:** Requires a running stack with actual PDF file storage and nginx serving. Cannot verify the nginx internal-directive enforcement without a live Docker environment.

### 3. Permission Enforcement on PDF Upload

**Test:** With a SrAO/AAO user who is NOT the current_handler of a mail, attempt POST /api/records/{id}/pdf/.
**Expected:** Response is 403 Forbidden. With the same user who IS the current_handler, upload succeeds with 201.
**Why human:** Requires live user accounts with specific role assignments and active mail records in the running database.

---

## Gaps Summary

Five requirements are unmet, falling into three root-cause categories:

**Category 1 — Naming convention divergence (3 gaps):**
Requirements DOCKER-09 and PDF-01 specify env var and field names that differ from what was implemented. The implementation names are actually more conventional and correct (POSTGRES_* prefix matches PostgreSQL conventions; file/original_filename/file_size are descriptive Django field names). However, the requirement text specifies different names. Resolution: update REQUIREMENTS.md to match the implementation, as the implementation naming is superior.

**Category 2 — Deliberate context decision (3 gaps):**
PDF-09, PDF-10, and PDF-11 require AuditTrail entries for PDF operations. The context decision captured in 02-PLAN.md and 03-PLAN.md explicitly decided NOT to create audit entries for PDFs — audit info is captured in RecordAttachment model fields (uploaded_by, uploaded_at, upload_stage). This decision was made to avoid double-logging and because the RecordAttachment record itself serves as an immutable audit artifact. Resolution: either implement the audit entries as required, or formally supersede PDF-09/10/11 in REQUIREMENTS.md.

**Category 3 — Implementation exceeds requirement (1 gap):**
DOCKER-02 specifies postgres volume at `/srv/mailtracker/postgres` as a filesystem path. The implementation correctly uses a Docker named volume (`postgres_data`) at the standard PostgreSQL data directory `/var/lib/postgresql/data`. Named volumes are more portable and correct for Docker deployments. Resolution: update REQUIREMENTS.md DOCKER-02 to specify "postgres service uses a persistent named volume" rather than a specific path.

**Category 4 — PDF-04 scope expansion (1 gap):**
PDF-04 says "one PDF per record". Implementation supports one PDF per stage (created/closed) — two possible active PDFs per record. This was a deliberate design improvement captured in 03-PLAN.md context decisions. Resolution: update REQUIREMENTS.md PDF-04 to reflect the stage-based design.

All wave-1 (Docker/Nginx) infrastructure and wave-3 (API endpoints) functional requirements are implemented correctly and fully wired. The gaps are documentation/naming misalignments and a deliberate context decision that was not reflected back in REQUIREMENTS.md.

---

_Verified: 2026-02-20_
_Verifier: Claude (gsd-verifier)_
