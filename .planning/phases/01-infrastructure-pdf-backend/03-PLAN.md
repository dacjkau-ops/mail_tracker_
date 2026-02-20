---
phase: 01-infrastructure-pdf-backend
plan: 03
type: execute
wave: 3
depends_on: ["02-PLAN.md"]
files_modified:
  - backend/records/models.py
  - backend/records/migrations/XXXX_add_upload_stage_to_recordattachment.py
  - backend/records/views.py
  - backend/records/serializers.py
  - backend/config/settings.py
autonomous: true
requirements:
  - PDF-02
  - PDF-03
  - PDF-04
  - PDF-05
  - PDF-06
  - PDF-07
  - PDF-08

must_haves:
  truths:
    - "POST /api/records/{id}/pdf/ accepts a multipart PDF upload and returns 201 with attachment metadata"
    - "POST /api/records/{id}/pdf/ returns 403 when called by a user without create/close permission for the record"
    - "POST /api/records/{id}/pdf/ with upload_stage='created' returns 403 if record status is not 'Received' or 'Assigned'"
    - "POST /api/records/{id}/pdf/ with upload_stage='closed' returns 403 if record status is not 'Closed'"
    - "GET /api/records/{id}/pdf/ returns attachment metadata JSON including exists, stage, original_filename, file_size, uploaded_by, uploaded_at"
    - "GET /api/records/{id}/pdf/view/ returns 200 with X-Accel-Redirect header pointing to /_protected_pdfs/{uuid}.pdf"
    - "GET /api/records/{id}/pdf/view/ returns 403 when called by a user who cannot view the mail record"
    - "Uploading a second PDF for the same upload_stage marks the previous attachment is_current=False and stores the new file"
    - "PDF files are stored at the path configured by PDF_STORAGE_PATH setting (falls back to BASE_DIR/pdfs in dev)"
  artifacts:
    - path: "backend/records/models.py"
      provides: "RecordAttachment.upload_stage field and PDFFileSystemStorage class"
      contains: "upload_stage"
    - path: "backend/records/views.py"
      provides: "upload_pdf, get_pdf_metadata, view_pdf actions on MailRecordViewSet"
      exports: ["upload_pdf", "get_pdf_metadata", "view_pdf"]
    - path: "backend/records/serializers.py"
      provides: "PDFUploadSerializer, PDFMetadataSerializer"
      exports: ["PDFUploadSerializer", "PDFMetadataSerializer"]
    - path: "backend/config/settings.py"
      provides: "PDF_STORAGE_PATH, FILE_UPLOAD_MAX_MEMORY_SIZE, DATA_UPLOAD_MAX_MEMORY_SIZE settings"
      contains: "PDF_STORAGE_PATH"
  key_links:
    - from: "backend/records/views.py upload_pdf action"
      to: "backend/records/models.py RecordAttachment"
      via: "RecordAttachment.objects.create with upload_stage from request data"
      pattern: "RecordAttachment\\.objects\\.create"
    - from: "backend/records/views.py view_pdf action"
      to: "nginx /_protected_pdfs/ internal location"
      via: "response['X-Accel-Redirect'] = f'/_protected_pdfs/{uuid}.pdf'"
      pattern: "X-Accel-Redirect.*_protected_pdfs"
    - from: "backend/records/views.py upload_pdf action"
      to: "backend/config/permissions.py MailRecordPermission"
      via: "view.action == 'upload_pdf' permission gate in has_object_permission"
      pattern: "upload_pdf.*permission|permission.*upload_pdf"
---

<objective>
Create the PDF API endpoint layer: upload, metadata retrieval, and X-Accel-Redirect view endpoints on MailRecordViewSet. This wave also patches the RecordAttachment model (from 02-PLAN.md) with the upload_stage field and configures PDF storage settings.

Purpose: Expose the PDF functionality built in Wave 2 as working REST API endpoints with correct permission enforcement and X-Accel-Redirect serving.

Output: Three @action methods on MailRecordViewSet, two serializers, RecordAttachment.upload_stage field + migration, and PDF_STORAGE_PATH settings.
</objective>

<execution_context>
@C:/Users/vaish/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/vaish/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-infrastructure-pdf-backend/02-PLAN.md

## CRITICAL CONTEXT DECISIONS (honor exactly — from /gsd:discuss-phase)

### Upload permissions
- Upload allowed ONLY when creating a mail OR when closing a mail (not mid-workflow)
- Upload user = whoever can create (AG/DAG) or whoever is current_handler closing
- This plan creates the endpoint infrastructure; workflow integration (blocking upload except at create/close) is a later phase concern
- For now: check that user can view the record AND is AG, DAG, or current_handler
  - AG: always allowed
  - DAG: allowed if mail.section is in their managed sections
  - SrAO/AAO: allowed only if they are current_handler

### View permissions (PDF-07)
- Anyone who can view the mail record can view its PDFs
- Reuse existing `MailRecordPermission._can_view_mail()` logic

### Multiple PDFs — stage-based (PDF-04 context decision)
- One PDF per stage ('created', 'closed') — not one PDF per record
- Uploading a new PDF for the same stage replaces the previous one for that stage (is_current set to False on old one)
- No deletion — PDFs are permanent once uploaded (no delete endpoint)
- 02-PLAN.md created RecordAttachment WITHOUT upload_stage field — this plan must add that field via migration

### No separate AuditTrail entries (PDF-09, PDF-10, PDF-11 superseded)
- Context decision: audit info captured in RecordAttachment model fields only (uploaded_by, uploaded_at, upload_stage)
- Do NOT create AuditTrail log entries for PDF operations
- PDF-09, PDF-10, PDF-11 requirement IDs are covered by this decision; no separate audit tasks needed

### Storage (PDF-08)
- PDF_STORAGE_PATH env var → /srv/mailtracker/pdfs in production
- Falls back to BASE_DIR / 'pdfs' in dev (Docker dev uses named volume, local dev uses filesystem)
- Use a custom FileSystemStorage instance pointing at PDF_STORAGE_PATH instead of Django's default MEDIA_ROOT

### X-Accel-Redirect path pattern (PDF-06)
- Django view sets: response['X-Accel-Redirect'] = f'/_protected_pdfs/{stored_filename}'
- stored_filename is the UUID-based filename (e.g., 550e8400-e29b-41d4-a716-446655440000.pdf)
- Nginx /_protected_pdfs/ internal location (configured in 01-PLAN.md) aliases to /srv/mailtracker/pdfs/
- Content-Disposition: inline (opens in browser tab)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add upload_stage to RecordAttachment and configure PDF storage settings</name>
  <files>
    backend/records/models.py
    backend/config/settings.py
  </files>
  <action>
## Part A: Patch RecordAttachment model in backend/records/models.py

02-PLAN.md created RecordAttachment without upload_stage. Add this field now.

First, read the current state of backend/records/models.py to find the RecordAttachment class. Then add:

1. Import at top of file (if not already present):
   ```python
   import uuid
   import os
   from django.core.files.storage import FileSystemStorage
   from django.core.exceptions import ValidationError
   from django.conf import settings as django_settings
   ```

2. Add a module-level custom storage class and upload path function BEFORE the RecordAttachment class definition:
   ```python
   def get_pdf_storage():
       """Return FileSystemStorage pointed at PDF_STORAGE_PATH setting."""
       storage_path = getattr(django_settings, 'PDF_STORAGE_PATH', None)
       if storage_path is None:
           from pathlib import Path
           storage_path = Path(django_settings.BASE_DIR) / 'pdfs'
       os.makedirs(storage_path, exist_ok=True)
       return FileSystemStorage(location=str(storage_path))


   def pdf_upload_path(instance, filename):
       """Store PDF as UUID.pdf, ignoring original filename to prevent path traversal."""
       return f"{uuid.uuid4()}.pdf"
   ```

3. In the RecordAttachment class, add the upload_stage field after the `uploaded_at` field (or alongside existing fields from 02-PLAN.md):
   ```python
   UPLOAD_STAGE_CHOICES = [
       ('created', 'Created'),
       ('closed', 'Closed'),
   ]

   upload_stage = models.CharField(
       max_length=10,
       choices=UPLOAD_STAGE_CHOICES,
       default='created',
       help_text="Workflow stage at which this PDF was uploaded"
   )
   ```

4. Ensure the `file` FileField uses the custom storage and upload path, and retains the validators added by 02-PLAN.md Task 4:
   ```python
   file = models.FileField(
       upload_to=pdf_upload_path,
       storage=get_pdf_storage,  # callable — evaluated lazily, not at import time
       max_length=255,
       validators=[validate_pdf_extension, validate_pdf_size]
   )
   ```
   NOTE: Pass `get_pdf_storage` (the function) not `get_pdf_storage()` (the result). Django accepts a callable for storage to allow lazy evaluation. `validate_pdf_extension` and `validate_pdf_size` are already defined in models.py by 02-PLAN.md Task 4 — do not redefine them.

5. Add a property `stored_filename` that extracts just the filename from the file field path (needed for X-Accel-Redirect):
   ```python
   @property
   def stored_filename(self):
       """Return just the UUID filename (e.g., 'abc123.pdf') for X-Accel-Redirect."""
       return os.path.basename(self.file.name) if self.file else None
   ```

6. Add a `get_metadata_dict()` method returning all fields needed by the metadata endpoint:
   ```python
   def get_metadata_dict(self):
       return {
           'id': str(self.id),
           'original_filename': self.original_filename,
           'file_size': self.file_size,
           'file_size_human': self._human_readable_size(self.file_size),
           'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
           'uploaded_by': self.uploaded_by.full_name if self.uploaded_by else None,
           'upload_stage': self.upload_stage,
       }

   @staticmethod
   def _human_readable_size(size_bytes):
       if size_bytes is None:
           return None
       if size_bytes < 1024:
           return f"{size_bytes} B"
       elif size_bytes < 1024 * 1024:
           return f"{size_bytes / 1024:.1f} KB"
       else:
           return f"{size_bytes / (1024 * 1024):.1f} MB"
   ```

If RecordAttachment does not yet exist in models.py (02-PLAN.md may not have been executed yet), create the full class with all fields from 02-PLAN.md plus upload_stage. In this scenario, also define the validator functions BEFORE the class (since 02-PLAN.md Task 4 did not run):
```python
def validate_pdf_extension(value):
    ext = os.path.splitext(value.name)[1].lower()
    if ext != '.pdf':
        raise ValidationError('Only PDF files are allowed.')


def validate_pdf_size(value):
    max_mb = getattr(django_settings, 'MAX_PDF_SIZE_MB', 10)
    max_size = max_mb * 1024 * 1024
    if value.size > max_size:
        raise ValidationError(f'File size exceeds {max_mb}MB limit.')


class RecordAttachment(models.Model):
    UPLOAD_STAGE_CHOICES = [
        ('created', 'Created'),
        ('closed', 'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mail_record = models.ForeignKey(
        'MailRecord',
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.FileField(
        upload_to=pdf_upload_path,
        storage=get_pdf_storage,
        max_length=255,
        validators=[validate_pdf_extension, validate_pdf_size]
    )
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(help_text="File size in bytes")
    uploaded_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_attachments'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    upload_stage = models.CharField(
        max_length=10,
        choices=UPLOAD_STAGE_CHOICES,
        default='created',
        help_text="Workflow stage at which this PDF was uploaded"
    )
    is_current = models.BooleanField(
        default=True,
        help_text="False when superseded by a replacement for the same stage"
    )

    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = 'Record Attachment'
        verbose_name_plural = 'Record Attachments'

    def __str__(self):
        return f"{self.original_filename} ({self.mail_record.sl_no}) [{self.upload_stage}]"

    @property
    def stored_filename(self):
        return os.path.basename(self.file.name) if self.file else None

    def get_metadata_dict(self):
        return {
            'id': str(self.id),
            'original_filename': self.original_filename,
            'file_size': self.file_size,
            'file_size_human': self._human_readable_size(self.file_size),
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'uploaded_by': self.uploaded_by.full_name if self.uploaded_by else None,
            'upload_stage': self.upload_stage,
        }

    @staticmethod
    def _human_readable_size(size_bytes):
        if size_bytes is None:
            return None
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        else:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
```

## Part B: PDF storage settings in backend/config/settings.py

Read settings.py and add these lines in the appropriate section (after BASE_DIR definition, before or alongside DATABASES):

```python
import os

# PDF Storage Configuration
PDF_STORAGE_PATH = os.environ.get('PDF_STORAGE_PATH', str(BASE_DIR / 'pdfs'))

# File upload size limits (10MB max for PDF uploads)
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024   # 10 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024   # 10 MB
```

Do NOT set MEDIA_ROOT or DEFAULT_FILE_STORAGE — PDFs use a custom storage instance, not Django's default media file handling.

If `import os` is already at the top of settings.py, do not add it again.
  </action>
  <verify>
Run from the backend directory:
```bash
python manage.py check
```
Should produce no errors. If RecordAttachment was already partially defined by 02-PLAN.md, confirm `upload_stage` field is present by running:
```bash
python manage.py shell -c "from records.models import RecordAttachment; print([f.name for f in RecordAttachment._meta.get_fields()])"
```
Output must include 'upload_stage'.
  </verify>
  <done>
- RecordAttachment model has upload_stage field with choices ('created', 'closed')
- RecordAttachment.file uses get_pdf_storage callable for lazy storage resolution
- RecordAttachment.stored_filename property returns UUID filename
- RecordAttachment.get_metadata_dict() method exists and returns all required keys
- settings.py has PDF_STORAGE_PATH, FILE_UPLOAD_MAX_MEMORY_SIZE, DATA_UPLOAD_MAX_MEMORY_SIZE
- `python manage.py check` passes with no errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Create migration for upload_stage field</name>
  <files>
    backend/records/migrations/XXXX_add_upload_stage_to_recordattachment.py
  </files>
  <action>
Generate the migration for the upload_stage field and any other RecordAttachment fields added in Task 1.

Run from the backend directory:
```bash
python manage.py makemigrations records --name add_upload_stage_to_recordattachment
```

If RecordAttachment did not exist before (02-PLAN.md not yet executed), this command will generate the full initial migration for RecordAttachment. That is correct — proceed.

If RecordAttachment already exists from 02-PLAN.md execution and already has upload_stage (because 02-PLAN.md was re-run after Task 1), run:
```bash
python manage.py makemigrations records --name add_upload_stage_to_recordattachment --check
```
If it reports no changes, the field is already migrated — skip this task and mark done.

After generating the migration file, apply it:
```bash
python manage.py migrate records
```

Verify migration applied cleanly — no errors in output.

IMPORTANT: The migration file name will include a numeric prefix (e.g., 0010_add_upload_stage_to_recordattachment.py). The exact number depends on existing migrations. Do not hardcode the number — let Django assign it.
  </action>
  <verify>
```bash
python manage.py migrate --check
```
Should output "No migrations to apply." or exit 0, meaning all migrations are applied.

```bash
python manage.py shell -c "
from records.models import RecordAttachment
import django.db.models as m
field = RecordAttachment._meta.get_field('upload_stage')
print('choices:', field.choices)
print('default:', field.default)
"
```
Should print choices list with ('created', 'Created') and ('closed', 'Closed') and default 'created'.
  </verify>
  <done>
- Migration file exists in backend/records/migrations/ with upload_stage field
- `python manage.py migrate` applies cleanly with no errors
- `python manage.py migrate --check` exits 0
  </done>
</task>

<task type="auto">
  <name>Task 3: Add PDF serializers and three PDF endpoint actions to MailRecordViewSet</name>
  <files>
    backend/records/serializers.py
    backend/records/views.py
    backend/config/permissions.py
  </files>
  <action>
## Part A: Add serializers to backend/records/serializers.py

Read the current serializers.py and append at the bottom:

```python
class PDFUploadSerializer(serializers.Serializer):
    """Serializer for validating PDF file uploads."""
    file = serializers.FileField(
        max_length=255,
        allow_empty_file=False,
        help_text="PDF file to upload. Maximum size: 10MB."
    )
    upload_stage = serializers.ChoiceField(
        choices=[('created', 'Created'), ('closed', 'Closed')],
        help_text="Workflow stage this PDF belongs to: 'created' or 'closed'."
    )

    def validate_file(self, value):
        # Validate extension
        ext = os.path.splitext(value.name)[1].lower()
        if ext != '.pdf':
            raise serializers.ValidationError("Only PDF files are allowed. File must have a .pdf extension.")

        # Validate size (settings fallback if not configured)
        from django.conf import settings
        max_size = getattr(settings, 'FILE_UPLOAD_MAX_MEMORY_SIZE', 10 * 1024 * 1024)
        if value.size > max_size:
            max_mb = max_size // (1024 * 1024)
            raise serializers.ValidationError(f"File size exceeds {max_mb}MB limit. Received {value.size / (1024*1024):.1f}MB.")

        return value


class PDFMetadataSerializer(serializers.Serializer):
    """Read-only serializer for PDF attachment metadata response."""
    exists = serializers.BooleanField()
    attachments = serializers.ListField(child=serializers.DictField(), required=False)
```

Ensure `import os` is present at the top of serializers.py (add if missing).

## Part B: Add permission gate for PDF actions in backend/config/permissions.py

Read config/permissions.py. In `MailRecordPermission.has_permission()`, add 'upload_pdf', 'get_pdf_metadata', 'view_pdf' to the list of actions that return True (allow all authenticated users through to object-level check):

In the block that handles custom actions, add to the list:
```python
if view.action in [
    'multi_assign', 'assignments', 'update_assignment',
    'complete_assignment', 'add_assignment_remark',
    'reassign_assignment', 'update_current_action',
    'reassign_candidates',
    'upload_pdf', 'get_pdf_metadata', 'view_pdf',  # PDF endpoints
]:
    return True
```

In `MailRecordPermission.has_object_permission()`, add object-level permission gates. Add these cases BEFORE the final `return False`:

```python
# PDF upload permission
# Allowed: AG always, DAG if mail section in their sections, SrAO/AAO if current_handler
if view.action == 'upload_pdf':
    if user.role == 'AG':
        return True
    if user.role == 'DAG':
        return self._is_dag_for_section(user, obj)
    if user.role in ['SrAO', 'AAO']:
        return obj.current_handler == user
    return False

# PDF metadata and view permission — mirrors view permission
if view.action in ['get_pdf_metadata', 'view_pdf']:
    if user.role == 'AG':
        return True
    return self._can_view_mail(user, obj, request)
```

## Part C: Add three @action methods to MailRecordViewSet in backend/records/views.py

Read views.py to find where it ends (or after the last @action decorator). Add the following three methods to the MailRecordViewSet class. Add necessary imports at the top of the file if not already present:

```python
from django.http import HttpResponse
from .models import RecordAttachment
from .serializers import PDFUploadSerializer, PDFMetadataSerializer
```

### Action 1: upload_pdf — POST /api/records/{id}/pdf/
```python
@action(detail=True, methods=['post'], url_path='pdf', url_name='upload-pdf')
def upload_pdf(self, request, pk=None):
    """
    POST /api/records/{id}/pdf/
    Upload a PDF to a mail record. Accepts multipart/form-data with:
      - file: PDF file (required, max 10MB, must be .pdf extension)
      - upload_stage: 'created' or 'closed' (required)

    Permissions:
      - AG: always allowed
      - DAG: allowed if mail.section is in their managed sections
      - SrAO/AAO: allowed only if they are current_handler

    Behavior:
      - If a current PDF already exists for the same upload_stage,
        mark it is_current=False (replacement, not deletion).
      - Store new file using UUID filename via RecordAttachment model.
      - Return 201 with attachment metadata on success.
    """
    mail_record = self.get_object()  # triggers has_object_permission

    serializer = PDFUploadSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    uploaded_file = serializer.validated_data['file']
    upload_stage = serializer.validated_data['upload_stage']

    # Enforce workflow stage restriction
    if upload_stage == 'created' and mail_record.status not in ['Received', 'Assigned']:
        return Response(
            {'error': "PDF can only be uploaded at the 'created' stage when the record status is 'Received' or 'Assigned'."},
            status=status.HTTP_403_FORBIDDEN
        )
    if upload_stage == 'closed' and mail_record.status != 'Closed':
        return Response(
            {'error': "PDF can only be uploaded at the 'closed' stage when the record has been closed."},
            status=status.HTTP_403_FORBIDDEN
        )

    with transaction.atomic():
        # Mark any existing current attachment for this stage as replaced
        existing = mail_record.attachments.filter(
            upload_stage=upload_stage,
            is_current=True
        ).first()
        if existing:
            existing.is_current = False
            existing.save(update_fields=['is_current'])

        # Create new attachment record — file saved by FileField
        attachment = RecordAttachment.objects.create(
            mail_record=mail_record,
            file=uploaded_file,
            original_filename=uploaded_file.name,
            file_size=uploaded_file.size,
            uploaded_by=request.user,
            upload_stage=upload_stage,
            is_current=True,
        )

    return Response(attachment.get_metadata_dict(), status=status.HTTP_201_CREATED)
```

### Action 2: get_pdf_metadata — GET /api/records/{id}/pdf/
```python
@action(detail=True, methods=['get'], url_path='pdf', url_name='pdf-metadata')
def get_pdf_metadata(self, request, pk=None):
    """
    GET /api/records/{id}/pdf/
    Returns metadata for all current PDF attachments on this record.
    One entry per upload_stage that has a current attachment.

    Response shape:
    {
      "exists": true,
      "attachments": [
        {
          "id": "...",
          "original_filename": "document.pdf",
          "file_size": 102400,
          "file_size_human": "100.0 KB",
          "uploaded_at": "2026-02-20T10:00:00+00:00",
          "uploaded_by": "John Smith",
          "upload_stage": "created"
        }
      ]
    }

    Permissions: same as viewing the mail record.
    """
    mail_record = self.get_object()  # triggers has_object_permission

    current_attachments = mail_record.attachments.filter(is_current=True).order_by('upload_stage')
    attachments_data = [a.get_metadata_dict() for a in current_attachments]

    return Response({
        'exists': len(attachments_data) > 0,
        'attachments': attachments_data,
    }, status=status.HTTP_200_OK)
```

### Action 3: view_pdf — GET /api/records/{id}/pdf/view/
```python
@action(detail=True, methods=['get'], url_path='pdf/view', url_name='view-pdf')
def view_pdf(self, request, pk=None):
    """
    GET /api/records/{id}/pdf/view/?stage=created
    Returns 200 with X-Accel-Redirect header. Nginx intercepts and serves the PDF file.
    Query param 'stage' selects which stage PDF to serve (default: 'created').

    Response headers set:
      - X-Accel-Redirect: /_protected_pdfs/{uuid}.pdf
      - Content-Type: application/pdf
      - Content-Disposition: inline; filename="{original_filename}"
      - X-Accel-Buffering: no

    Permissions: same as viewing the mail record (PDF-07).
    """
    mail_record = self.get_object()  # triggers has_object_permission

    stage = request.query_params.get('stage', 'created')
    if stage not in ('created', 'closed'):
        return Response(
            {'error': "Invalid stage. Must be 'created' or 'closed'."},
            status=status.HTTP_400_BAD_REQUEST
        )

    attachment = mail_record.attachments.filter(
        upload_stage=stage,
        is_current=True
    ).first()

    if not attachment:
        return Response(
            {'error': f"No PDF found for stage '{stage}' on this record."},
            status=status.HTTP_404_NOT_FOUND
        )

    stored_filename = attachment.stored_filename
    if not stored_filename:
        return Response(
            {'error': "PDF file reference is missing. Contact an administrator."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    response = HttpResponse(status=200)
    response['X-Accel-Redirect'] = f'/_protected_pdfs/{stored_filename}'
    response['X-Accel-Buffering'] = 'no'
    response['Content-Type'] = 'application/pdf'
    # Sanitize original filename for Content-Disposition (remove quotes/special chars)
    safe_filename = attachment.original_filename.replace('"', '').replace('\\', '')
    response['Content-Disposition'] = f'inline; filename="{safe_filename}"'

    return Response(status=status.HTTP_200_OK) if False else response  # return HttpResponse directly
```

IMPORTANT: The view_pdf action must return the raw `HttpResponse` object (not a DRF `Response`), because DRF `Response` goes through content negotiation and would strip custom headers. The last line should simply be `return response`.

Clean up the false branch — the final line of view_pdf should be:
```python
    return response
```

Do not include the `if False else response` line — that was illustrative. The method body ends with `return response`.
  </action>
  <verify>
1. Run Django system check:
```bash
python manage.py check
```
No errors.

2. Verify the three actions are registered on the viewset:
```bash
python manage.py shell -c "
from records.views import MailRecordViewSet
actions = [name for name, method in vars(MailRecordViewSet).items() if callable(method) and hasattr(method, 'url_path')]
print(actions)
"
```
Output must include: upload_pdf, get_pdf_metadata, view_pdf.

3. Check URL routing includes the pdf endpoints:
```bash
python manage.py shell -c "
from django.urls import reverse
# These should not raise NoReverseMatch
try:
    print('Routes registered')
except Exception as e:
    print('ERROR:', e)
"
```

4. Verify permissions.py has the three PDF actions in both has_permission and has_object_permission:
```bash
grep -n "upload_pdf\|get_pdf_metadata\|view_pdf" backend/config/permissions.py
```
Should show lines in both has_permission (view.action in [...]) and has_object_permission blocks.
  </verify>
  <done>
- PDFUploadSerializer validates .pdf extension and 10MB size limit
- PDFMetadataSerializer shape is correct
- upload_pdf @action exists with url_path='pdf', methods=['post']
- get_pdf_metadata @action exists with url_path='pdf', methods=['get']
- view_pdf @action exists with url_path='pdf/view', methods=['get']
- view_pdf returns HttpResponse with X-Accel-Redirect header (not DRF Response)
- view_pdf X-Accel-Redirect value is /_protected_pdfs/{uuid}.pdf format
- Replacement logic: existing current attachment for same stage is marked is_current=False before new attachment created
- MailRecordPermission.has_permission allows all three PDF actions for authenticated users
- MailRecordPermission.has_object_permission enforces upload_pdf: AG always, DAG if section matches, SrAO/AAO if current_handler
- MailRecordPermission.has_object_permission enforces get_pdf_metadata/view_pdf: same as _can_view_mail
- `python manage.py check` passes
  </done>
</task>

</tasks>

<verification>
After all tasks complete, run the following verification sequence from the backend directory:

1. System check passes:
   ```bash
   python manage.py check
   ```
   Expected: No errors.

2. All migrations applied:
   ```bash
   python manage.py migrate --check
   ```
   Expected: Exit 0.

3. RecordAttachment model has required fields:
   ```bash
   python manage.py shell -c "
   from records.models import RecordAttachment
   fields = [f.name for f in RecordAttachment._meta.get_fields()]
   required = ['id', 'mail_record', 'file', 'original_filename', 'file_size', 'uploaded_by', 'uploaded_at', 'upload_stage', 'is_current']
   missing = [f for f in required if f not in fields]
   print('Missing fields:', missing if missing else 'NONE — all present')
   "
   ```
   Expected: Missing fields: NONE — all present

4. Settings have PDF configuration:
   ```bash
   python manage.py shell -c "
   from django.conf import settings
   print('PDF_STORAGE_PATH:', settings.PDF_STORAGE_PATH)
   print('FILE_UPLOAD_MAX_MEMORY_SIZE:', settings.FILE_UPLOAD_MAX_MEMORY_SIZE)
   print('DATA_UPLOAD_MAX_MEMORY_SIZE:', settings.DATA_UPLOAD_MAX_MEMORY_SIZE)
   "
   ```
   Expected: PDF_STORAGE_PATH printed, sizes printed as 10485760 (10MB).

5. PDF actions on viewset:
   ```bash
   python manage.py shell -c "
   from records.views import MailRecordViewSet
   pdf_methods = [name for name, m in vars(MailRecordViewSet).items() if hasattr(m, 'url_path') and 'pdf' in getattr(m, 'url_path', '')]
   print('PDF actions:', pdf_methods)
   "
   ```
   Expected: List contains upload_pdf, get_pdf_metadata, view_pdf.

6. Permission classes include PDF action gates:
   ```bash
   python -c "
   import subprocess, sys
   result = subprocess.run(['grep', '-c', 'upload_pdf', 'config/permissions.py'], capture_output=True, text=True, cwd='backend')
   count = int(result.stdout.strip())
   print('upload_pdf references in permissions.py:', count, '(expected >= 2)')
   "
   ```
   Expected: 2 or more (one in has_permission, one in has_object_permission).
</verification>

<success_criteria>
Wave 3 is complete when:
1. RecordAttachment.upload_stage field exists with choices ('created', 'closed'), default 'created'
2. RecordAttachment.stored_filename property returns UUID-based filename
3. RecordAttachment.get_metadata_dict() returns dict with all required keys
4. PDF_STORAGE_PATH, FILE_UPLOAD_MAX_MEMORY_SIZE, DATA_UPLOAD_MAX_MEMORY_SIZE in settings
5. PDFUploadSerializer rejects non-PDF extensions and files > 10MB
6. POST /api/records/{id}/pdf/ endpoint exists, validates file, handles replacement by stage, returns 201
7. GET /api/records/{id}/pdf/ endpoint exists, returns {exists, attachments} JSON
8. GET /api/records/{id}/pdf/view/ endpoint exists, returns HttpResponse with X-Accel-Redirect header
9. X-Accel-Redirect value matches /_protected_pdfs/{uuid}.pdf pattern (aligns with nginx internal location from 01-PLAN.md)
10. Permissions enforced: upload_pdf blocked for wrong role, view_pdf blocked for users without view access
11. All migrations applied cleanly
12. `python manage.py check` passes with no errors
</success_criteria>

<output>
After completion, create `.planning/phases/01-infrastructure-pdf-backend/01-03-SUMMARY.md` with:
- What was built (models changed, serializers added, viewset actions added)
- Key implementation decisions (storage callable pattern, X-Accel-Redirect path, stage-based replacement logic)
- File list with brief description of changes to each
- Any deviations from this plan and why
</output>
