---
phase: 01-infrastructure-pdf-backend
plan: 02
subsystem: records-data-model
tags: [pdf, models, migrations, admin, audit]
dependency_graph:
  requires: ["01-01-PLAN.md"]
  provides: ["RecordAttachment model", "PDF validators", "extended AuditTrail choices", "admin inline"]
  affects: ["backend/records/models.py", "backend/audit/models.py", "backend/records/admin.py"]
tech_stack:
  added: []
  patterns: ["UUID primary key", "FileField with validators", "TabularInline admin", "ForeignKey with related_name"]
key_files:
  created:
    - backend/records/migrations/0010_add_recordattachment.py
    - backend/audit/migrations/0007_extend_audit_choices.py
  modified:
    - backend/records/models.py
    - backend/audit/models.py
    - backend/records/admin.py
decisions:
  - "No AuditTrail entries for PDF operations — choices are schema-only for future compatibility"
  - "UUID primary key on RecordAttachment prevents enumeration attacks"
  - "pdf_upload_path uses instance.id (UUID) to prevent path traversal from original filename"
  - "validate_pdf_size reads MAX_PDF_SIZE_MB from settings with 10MB default"
  - "delete_file method present on RecordAttachment but no delete endpoint added per plan"
metrics:
  duration: "~4 minutes"
  completed: "2026-02-20"
  tasks: 4
  files_modified: 5
---

# Phase 1 Plan 02: RecordAttachment Data Model Summary

**One-liner:** RecordAttachment model with UUID PK, PDF validators, MailRecord helper properties, extended AuditTrail choices, and admin inline configuration.

## What Was Built

### RecordAttachment Model (`backend/records/models.py`)
New model added at the end of `records/models.py` with all 8 required fields:
- `id` — UUIDField, primary key, auto-generated
- `mail_record` — ForeignKey to MailRecord with `related_name='attachments'`
- `file` — FileField with `pdf_upload_path` and validators `[validate_pdf_extension, validate_pdf_size]`
- `original_filename` — CharField(255) for display purposes
- `file_size` — PositiveIntegerField in bytes
- `uploaded_by` — ForeignKey to AUTH_USER_MODEL (SET_NULL, null=True)
- `uploaded_at` — DateTimeField(auto_now_add=True)
- `is_current` — BooleanField(default=True), False when superseded

### PDF Validators
Two standalone validator functions added before model class definitions:
- `validate_pdf_extension` — checks `.pdf` extension (case-insensitive)
- `validate_pdf_size` — reads `MAX_PDF_SIZE_MB` from settings (default 10), rejects files exceeding limit

### Upload Path Function
`pdf_upload_path(instance, filename)` stores files as `pdfs/{uuid}.pdf`, ignoring the original filename entirely to prevent path traversal attacks.

### MailRecord Helper Properties
Three additions to the existing `MailRecord` class:
- `current_attachment` property — returns `self.attachments.filter(is_current=True).first()` or None
- `has_attachment` property — boolean convenience wrapper
- `get_attachment_metadata()` method — returns a dict with `has_attachment`, `attachment_id`, `original_filename`, `file_size`, `file_size_human` (B/KB/MB), `uploaded_at`, `uploaded_by`

### AuditTrail Choice Extensions (`backend/audit/models.py`)
Three new choices appended to `ACTION_CHOICES`:
- `('PDF_UPLOAD', 'PDF Uploaded')`
- `('PDF_REPLACE', 'PDF Replaced')`
- `('PDF_DELETE', 'PDF Deleted')`

No helper function created. No code in this phase writes audit entries with these values.

### Migrations
- `records/migrations/0010_add_recordattachment.py` — creates `records_recordattachment` table with all required columns
- `audit/migrations/0007_extend_audit_choices.py` — updates `action` field choices list (Django generated this because it tracks choices in migration state)

### Admin Configuration (`backend/records/admin.py`)
- Added `RecordAttachmentInline(admin.TabularInline)` with `extra=0`, `max_num=1`, `readonly_fields=['id', 'file_size', 'uploaded_at', 'uploaded_by']`
- Added `inlines = [RecordAttachmentInline]` to existing `MailRecordAdmin` class

## Decisions Made

1. **No AuditTrail entries for PDF operations** — per plan context: audit info captured in RecordAttachment model fields (uploaded_by, uploaded_at). PDF_UPLOAD/PDF_REPLACE/PDF_DELETE choices exist for future compatibility only.

2. **UUID primary key** — prevents enumeration of attachment IDs in future API endpoints.

3. **pdf_upload_path uses UUID, not original filename** — prevents path traversal from malicious filenames. Original filename preserved in `original_filename` CharField for display only.

4. **validate_pdf_size reads from settings** — `MAX_PDF_SIZE_MB` setting allows per-deployment configuration without code changes; defaults to 10MB.

5. **max_num=1 on inline** — matches current design of one PDF per record at any time. This can be relaxed in 03-PLAN.md when upload_stage is added.

6. **delete_file method present but no delete endpoint** — method exists for future use; no deletion supported per plan (PDFs are permanent once uploaded).

7. **audit migration generated** — Django detected choice change and generated a migration. This is correct behavior; the migration safely updates the field's choice list.

## Deviations from Plan

**None.** Plan executed exactly as written.

Note: Task 4's Part A (validators) was naturally implemented in Task 1 since the file field and validators were added together. The validators were on the `file` field from the initial write. No re-work needed.

## Verification Results

All 5 verification checks passed:
1. `python manage.py check` — No issues (0 silenced)
2. `python manage.py migrate --check` — Exit 0
3. RecordAttachment fields: Missing fields: NONE
4. AuditTrail PDF choices: PDF_UPLOAD: True, PDF_REPLACE: True, PDF_DELETE: True
5. MailRecord helpers: current_attachment: True, has_attachment: True, get_attachment_metadata: True

## Self-Check: PASSED

Files exist:
- backend/records/models.py — modified (RecordAttachment class present)
- backend/audit/models.py — modified (PDF choices present)
- backend/records/admin.py — modified (RecordAttachmentInline present)
- backend/records/migrations/0010_add_recordattachment.py — created
- backend/audit/migrations/0007_extend_audit_choices.py — created

Commits:
- 7e2943e: feat(01-02): add RecordAttachment model and MailRecord helper properties
- 89128a2: feat(01-02): extend AuditTrail ACTION_CHOICES for PDF events
- ead01b8: chore(01-02): add migrations for RecordAttachment and AuditTrail PDF choices
- 0a100e8: feat(01-02): add RecordAttachmentInline to MailRecordAdmin
