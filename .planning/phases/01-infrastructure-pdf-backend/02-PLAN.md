---
phase: 01-infrastructure-pdf-backend
plan: 02
type: execute
wave: 2
depends_on: ["01-PLAN.md"]
files_modified:
  - backend/records/models.py
  - backend/audit/models.py
  - backend/records/migrations/XXXX_add_recordattachment.py
  - backend/audit/migrations/XXXX_extend_audit_choices.py
  - backend/records/admin.py
autonomous: true
requirements:
  - PDF-01
  - PDF-09
  - PDF-10
  - PDF-11

must_haves:
  truths:
    - "RecordAttachment model exists with UUID primary key, mail_record FK, file field, original_filename, file_size, uploaded_by, uploaded_at, is_current"
    - "MailRecord.current_attachment property returns the most recent is_current=True attachment or None"
    - "AuditTrail ACTION_CHOICES includes PDF_UPLOAD, PDF_REPLACE, PDF_DELETE"
    - "Migrations apply cleanly with python manage.py migrate"
    - "Django admin shows RecordAttachmentInline on the MailRecord change page"
  artifacts:
    - path: "backend/records/models.py"
      provides: "RecordAttachment model and MailRecord.current_attachment property"
      contains: "RecordAttachment"
    - path: "backend/audit/models.py"
      provides: "Extended ACTION_CHOICES with PDF audit event types"
      contains: "PDF_UPLOAD"
    - path: "backend/records/admin.py"
      provides: "RecordAttachmentInline registered on MailRecordAdmin"
      contains: "RecordAttachmentInline"
  key_links:
    - from: "backend/records/models.py RecordAttachment"
      to: "backend/records/models.py MailRecord"
      via: "ForeignKey mail_record with related_name='attachments'"
      pattern: "ForeignKey.*MailRecord|related_name.*attachments"
    - from: "backend/records/models.py RecordAttachment"
      to: "backend/records/migrations/XXXX_add_recordattachment.py"
      via: "python manage.py makemigrations records"
      pattern: "CreateModel.*RecordAttachment"
---

<objective>
Create the RecordAttachment model for PDF storage and extend the AuditTrail model to support PDF action choice values. This wave handles all database schema changes for PDF functionality.

Purpose: The data layer must exist before the API layer (03-PLAN.md) can be built. RecordAttachment stores PDF metadata and file references. AuditTrail choice extensions are schema-only — no helper functions.

Output: RecordAttachment model, MailRecord helper properties, extended AuditTrail choices, migrations, model validation, and admin configuration.
</objective>

<execution_context>
@C:/Users/vaish/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/vaish/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

## CRITICAL CONTEXT DECISIONS (from /gsd:discuss-phase — honor exactly)

- **No AuditTrail entries for PDF operations** — audit info is captured in RecordAttachment model fields only (uploaded_by, uploaded_at, upload_stage). Do NOT create AuditTrail log entries for PDF operations. The PDF_UPLOAD/PDF_REPLACE/PDF_DELETE choices are added to the schema for future compatibility only; no code should call AuditTrail.objects.create with these values in this phase.
- **No deletion** — PDFs are permanent once uploaded. Do not add delete endpoints or delete logic.
- **Multiple PDFs per record** — one per workflow stage ('created', 'closed'). The upload_stage field is added by 03-PLAN.md; this plan creates RecordAttachment without it.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create RecordAttachment model and MailRecord helper properties</name>
  <files>
    backend/records/models.py
  </files>
  <action>
Read the current state of `backend/records/models.py` to understand the existing MailRecord class.

Add these imports at the top of the file if not already present:
```python
import uuid
import os
```

Add the following upload path function BEFORE the RecordAttachment class definition (can be placed just above the class):
```python
def pdf_upload_path(instance, filename):
    # Store as UUID.pdf, ignore original filename to prevent path traversal
    return f'pdfs/{instance.id}.pdf'
```

Add the RecordAttachment model class AFTER the MailRecord class (or at the end of the models file):
```python
class RecordAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mail_record = models.ForeignKey(
        MailRecord,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.FileField(upload_to=pdf_upload_path, max_length=255)
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(help_text="File size in bytes")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_attachments'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_current = models.BooleanField(
        default=True,
        help_text="False when superseded by a replacement"
    )

    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = 'Record Attachment'
        verbose_name_plural = 'Record Attachments'

    def __str__(self):
        return f"{self.original_filename} ({self.mail_record.sl_no})"

    def delete_file(self):
        """Delete physical file from storage."""
        if self.file:
            if os.path.isfile(self.file.path):
                os.remove(self.file.path)
```

In the existing MailRecord class, add these two properties (place them near the bottom of the class, before the Meta class if it's at the end, or after the last existing method):
```python
@property
def current_attachment(self):
    return self.attachments.filter(is_current=True).first()

@property
def has_attachment(self):
    return bool(self.current_attachment)

def get_attachment_metadata(self):
    attachment = self.current_attachment
    if not attachment:
        return {
            'has_attachment': False,
            'attachment_id': None,
            'original_filename': None,
            'file_size': None,
            'file_size_human': None,
            'uploaded_at': None,
            'uploaded_by': None,
        }
    size = attachment.file_size
    if size < 1024:
        size_human = f"{size} B"
    elif size < 1024 * 1024:
        size_human = f"{size / 1024:.1f} KB"
    else:
        size_human = f"{size / (1024 * 1024):.1f} MB"
    return {
        'has_attachment': True,
        'attachment_id': str(attachment.id),
        'original_filename': attachment.original_filename,
        'file_size': size,
        'file_size_human': size_human,
        'uploaded_at': attachment.uploaded_at.isoformat() if attachment.uploaded_at else None,
        'uploaded_by': attachment.uploaded_by.username if attachment.uploaded_by else None,
    }
```

If `settings` is not already imported in models.py (some projects import it as `from django.conf import settings`), add that import. Check for it before adding.
  </action>
  <verify>
```bash
python manage.py check
```
Should produce no errors.

```bash
python manage.py shell -c "from records.models import RecordAttachment, MailRecord; print('RecordAttachment fields:', [f.name for f in RecordAttachment._meta.get_fields()])"
```
Output must include: id, mail_record, file, original_filename, file_size, uploaded_by, uploaded_at, is_current.
  </verify>
  <done>
- RecordAttachment class exists in backend/records/models.py with all eight required fields
- MailRecord.current_attachment property exists and returns first is_current=True attachment or None
- MailRecord.has_attachment property exists
- MailRecord.get_attachment_metadata() method exists and returns dict with has_attachment key
- python manage.py check passes with no errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend AuditTrail ACTION_CHOICES for PDF events</name>
  <files>
    backend/audit/models.py
  </files>
  <action>
Read `backend/audit/models.py` to find the ACTION_CHOICES definition (likely a list of 2-tuples on the AuditTrail model or defined as a class-level variable).

Locate the action field definition — it will look something like:
```python
ACTION_CHOICES = [
    ('CREATE', 'Created'),
    ('ASSIGN', 'Assigned'),
    ('REASSIGN', 'Reassigned'),
    ('CLOSE', 'Closed'),
    ('REOPEN', 'Reopened'),
    ('UPDATE', 'Updated'),
]
```

Add exactly three new choices to the end of ACTION_CHOICES (or wherever the existing choices end):
```python
('PDF_UPLOAD', 'PDF Uploaded'),
('PDF_REPLACE', 'PDF Replaced'),
('PDF_DELETE', 'PDF Deleted'),
```

Do NOT add a log_pdf_action helper function. Do NOT create any utility file for PDF audit logging. The choices are schema-only additions — they extend the set of valid values for the action field. No code in this phase will write AuditTrail entries with these values.

If ACTION_CHOICES is defined inside the model class (as a class attribute), add the three entries there. If defined at module level, add them at module level. Match the existing pattern.
  </action>
  <verify>
```bash
python manage.py shell -c "
from audit.models import AuditTrail
choices_dict = dict(AuditTrail.ACTION_CHOICES)
print('PDF_UPLOAD present:', 'PDF_UPLOAD' in choices_dict)
print('PDF_REPLACE present:', 'PDF_REPLACE' in choices_dict)
print('PDF_DELETE present:', 'PDF_DELETE' in choices_dict)
"
```
All three should print True.
  </verify>
  <done>
- PDF_UPLOAD, PDF_REPLACE, PDF_DELETE added to AuditTrail ACTION_CHOICES
- No log_pdf_action function or utils.py file created
- python manage.py check passes with no errors
  </done>
</task>

<task type="auto">
  <name>Task 3: Create and apply migrations</name>
  <files>
    backend/records/migrations/XXXX_add_recordattachment.py
    backend/audit/migrations/XXXX_extend_audit_choices.py
  </files>
  <action>
Run migration generation from the backend directory:

```bash
python manage.py makemigrations records --name add_recordattachment
python manage.py makemigrations audit --name extend_audit_choices
```

Django will assign numeric prefixes automatically (e.g., 0010_add_recordattachment.py). Do not hardcode numbers.

For the audit migration: Django may detect no schema change (changing choices on a CharField does not change the database column). If `makemigrations audit` reports "No changes detected", that is acceptable — Django's choice validation is application-level, not database-level. In that case, the audit migration file does not need to exist.

Apply all migrations:
```bash
python manage.py migrate
```

Verify the records migration created the correct table:
```bash
python manage.py shell -c "
from django.db import connection
tables = connection.introspection.table_names()
print('records_recordattachment exists:', 'records_recordattachment' in tables)
"
```
  </action>
  <verify>
```bash
python manage.py migrate --check
```
Should exit 0 (no unapplied migrations).

```bash
python manage.py shell -c "
from django.db import connection
tables = connection.introspection.table_names()
print('Table exists:', 'records_recordattachment' in tables)
cols = [c.name for c in connection.introspection.get_table_description(connection.cursor(), 'records_recordattachment')]
print('Columns:', cols)
"
```
Output must include columns: id, mail_record_id, file, original_filename, file_size, uploaded_by_id, uploaded_at, is_current.
  </verify>
  <done>
- records migration file exists for RecordAttachment (XXXX_add_recordattachment.py)
- python manage.py migrate applies cleanly with no errors
- python manage.py migrate --check exits 0
- records_recordattachment table exists in the database with correct columns
  </done>
</task>

<task type="auto">
  <name>Task 4: Add model validation and admin configuration</name>
  <files>
    backend/records/models.py
    backend/records/admin.py
  </files>
  <action>
## Part A: Add validators to RecordAttachment in backend/records/models.py

Read the current RecordAttachment class. Add these two validator functions near the top of models.py (after imports, before the class definitions):

```python
def validate_pdf_extension(value):
    ext = os.path.splitext(value.name)[1].lower()
    if ext != '.pdf':
        raise ValidationError('Only PDF files are allowed.')


def validate_pdf_size(value):
    from django.conf import settings as django_settings
    max_mb = getattr(django_settings, 'MAX_PDF_SIZE_MB', 10)
    max_size = max_mb * 1024 * 1024
    if value.size > max_size:
        raise ValidationError(f'File size exceeds {max_mb}MB limit.')
```

Ensure `from django.core.exceptions import ValidationError` is imported at the top of models.py (add if not present).

Update the RecordAttachment.file field to include the validators:
```python
file = models.FileField(
    upload_to=pdf_upload_path,
    max_length=255,
    validators=[validate_pdf_extension, validate_pdf_size]
)
```

## Part B: Add RecordAttachmentInline to admin in backend/records/admin.py

Read the current admin.py to understand the existing MailRecordAdmin definition.

Add the inline class and update MailRecordAdmin. Add before the MailRecordAdmin class:

```python
class RecordAttachmentInline(admin.TabularInline):
    model = RecordAttachment
    readonly_fields = ['id', 'file_size', 'uploaded_at', 'uploaded_by']
    fields = ['id', 'original_filename', 'file', 'uploaded_by', 'uploaded_at', 'is_current']
    extra = 0
    max_num = 1
```

In the existing MailRecordAdmin class, add or update the inlines list:
```python
inlines = [RecordAttachmentInline]
```

If MailRecordAdmin already has an inlines list, append RecordAttachmentInline to it. If there is no inlines attribute, add one.

Ensure RecordAttachment is imported in admin.py:
```python
from .models import MailRecord, RecordAttachment
```
(Check existing import and extend it rather than adding a duplicate import.)
  </action>
  <verify>
```bash
python manage.py check
```
No errors.

Test validators are applied:
```bash
python manage.py shell -c "
from records.models import RecordAttachment
file_field = RecordAttachment._meta.get_field('file')
print('Validators on file field:', [v.__name__ for v in file_field.validators])
"
```
Output must include validate_pdf_extension and validate_pdf_size.

Verify admin registration:
```bash
python manage.py shell -c "
from django.contrib import admin
from records.models import MailRecord
ma = admin.site._registry.get(MailRecord)
print('MailRecordAdmin inlines:', [type(i).__name__ for i in ma.inlines] if ma else 'NOT REGISTERED')
"
```
Output must include RecordAttachmentInline.
  </verify>
  <done>
- validate_pdf_extension function exists in records/models.py
- validate_pdf_size function exists in records/models.py
- RecordAttachment.file field has both validators applied
- RecordAttachmentInline class exists in records/admin.py with readonly_fields and extra=0
- MailRecordAdmin.inlines includes RecordAttachmentInline
- python manage.py check passes with no errors
  </done>
</task>

</tasks>

<verification>
After all tasks complete, run this verification sequence from the backend directory:

1. System check:
   ```bash
   python manage.py check
   ```
   Expected: No errors.

2. All migrations applied:
   ```bash
   python manage.py migrate --check
   ```
   Expected: Exit 0.

3. RecordAttachment fields complete:
   ```bash
   python manage.py shell -c "
   from records.models import RecordAttachment
   fields = [f.name for f in RecordAttachment._meta.get_fields()]
   required = ['id', 'mail_record', 'file', 'original_filename', 'file_size', 'uploaded_by', 'uploaded_at', 'is_current']
   missing = [f for f in required if f not in fields]
   print('Missing fields:', missing if missing else 'NONE')
   "
   ```
   Expected: Missing fields: NONE.

4. AuditTrail PDF choices:
   ```bash
   python manage.py shell -c "
   from audit.models import AuditTrail
   choices_dict = dict(AuditTrail.ACTION_CHOICES)
   for key in ['PDF_UPLOAD', 'PDF_REPLACE', 'PDF_DELETE']:
       print(key, ':', key in choices_dict)
   "
   ```
   Expected: All three print True.

5. MailRecord helpers:
   ```bash
   python manage.py shell -c "
   from records.models import MailRecord
   print('current_attachment:', hasattr(MailRecord, 'current_attachment'))
   print('has_attachment:', hasattr(MailRecord, 'has_attachment'))
   print('get_attachment_metadata:', hasattr(MailRecord, 'get_attachment_metadata'))
   "
   ```
   Expected: All three print True.
</verification>

<success_criteria>
Wave 2 is complete when:
1. RecordAttachment model exists with all eight fields (id, mail_record, file, original_filename, file_size, uploaded_by, uploaded_at, is_current)
2. RecordAttachment.file field has validate_pdf_extension and validate_pdf_size validators
3. MailRecord.current_attachment, .has_attachment, .get_attachment_metadata() all exist
4. AuditTrail ACTION_CHOICES includes PDF_UPLOAD, PDF_REPLACE, PDF_DELETE
5. No log_pdf_action helper function exists anywhere in the codebase
6. Migrations apply cleanly (python manage.py migrate --check exits 0)
7. records_recordattachment table exists in database with correct columns
8. RecordAttachmentInline registered on MailRecordAdmin in admin.py
9. python manage.py check passes with no errors
</success_criteria>

<output>
After completion, create `.planning/phases/01-infrastructure-pdf-backend/01-02-SUMMARY.md` with:
- What was built (RecordAttachment model, AuditTrail choice extensions, admin config)
- Key implementation decisions (no AuditTrail entries for PDF ops, choices-only audit extension, upload path function)
- File list with brief description of changes to each
- Any deviations from this plan and why
</output>
