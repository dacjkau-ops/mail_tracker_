# Phase 1: Infrastructure & PDF Backend - Research Report

## Executive Summary

This research report covers the technical approaches needed to implement Phase 1 of the PDF attachment feature for the Mail Tracker application. The project is a brownfield Django 5.x + React application with existing role-based permissions (AG/DAG/SrAO/AAO), audit trail logging, and SQLite database.

---

## 1. Django File Upload Patterns

### 1.1 UUID-Based Filename Approach

**Why UUID?**
- Prevents filename collisions when multiple users upload files with the same name
- Prevents path traversal attacks (user cannot manipulate path via filename)
- Makes URL guessing attacks infeasible (security through obscurity layer)
- Allows preserving original filename in metadata while storing safely

**Recommended Implementation:**

```python
import uuid
import os
from django.core.files.storage import FileSystemStorage

def pdf_upload_path(instance, filename):
    """
    Generate a secure upload path with UUID filename.
    Structure: /srv/mailtracker/pdfs/{uuid}.pdf
    """
    # Extract extension and validate
    ext = os.path.splitext(filename)[1].lower()
    if ext != '.pdf':
        raise ValidationError("Only PDF files are allowed.")

    # Generate UUID filename
    new_filename = f"{uuid.uuid4()}{ext}"

    # Return path - actual storage root configured in settings
    return new_filename


class RecordAttachment(models.Model):
    """
    Model for storing PDF attachments linked to mail records.
    """
    mail_record = models.ForeignKey(
        'records.MailRecord',
        on_delete=models.CASCADE,
        related_name='attachments'
    )

    # File storage - UUID-based filename on disk
    file = models.FileField(
        upload_to=pdf_upload_path,
        storage=FileSystemStorage(location='/srv/mailtracker/pdfs'),
        max_length=255
    )

    # Metadata (preserved from original upload)
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField()  # Size in bytes
    mime_type = models.CharField(max_length=100, default='application/pdf')

    # Upload metadata
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='uploaded_attachments'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    # Replacement tracking
    is_current = models.BooleanField(default=True)
    replaced_at = models.DateTimeField(null=True, blank=True)
    replaced_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='replaced_attachments',
        null=True,
        blank=True
    )

    class Meta:
        ordering = ['-uploaded_at']
        # Ensure only one current attachment per mail record
        constraints = [
            models.UniqueConstraint(
                fields=['mail_record'],
                condition=models.Q(is_current=True),
                name='unique_current_attachment_per_record'
            )
        ]
```

### 1.2 Storing Metadata vs File Content

**Key Decision: Store metadata in database, file content on filesystem**

| Approach | Pros | Cons |
|----------|------|------|
| **Metadata in DB + Filesystem storage** | Fast queries, searchable, file served efficiently by nginx | Synchronization risk if file deleted outside Django |
| **File in DB (BLOB)** | Single source of truth, ACID compliance | Poor performance for large files, database bloat |
| **External storage (S3)** | Scalable, CDN-ready | Overkill for this project, adds complexity |

**For this project:**
- Filesystem storage at `/srv/mailtracker/pdfs` is appropriate
- Metadata in database enables fast queries and audit logging
- PostgreSQL in Docker will store metadata; files in named volume

### 1.3 File Replacement Strategy

**Soft Delete Pattern (Recommended):**

```python
from django.db import transaction

class RecordAttachment(models.Model):
    # ... fields from above ...

    def replace(self, new_file, replaced_by_user):
        """
        Replace this attachment with a new file.
        Old file is marked as replaced but kept for audit trail.
        """
        with transaction.atomic():
            # Mark current attachment as replaced
            self.is_current = False
            self.replaced_at = timezone.now()
            self.replaced_by = replaced_by_user
            self.save()

            # Create new attachment
            new_attachment = RecordAttachment.objects.create(
                mail_record=self.mail_record,
                file=new_file,
                original_filename=new_file.name,
                file_size=new_file.size,
                uploaded_by=replaced_by_user,
                is_current=True
            )

            return new_attachment
```

**Why soft delete?**
- Audit trail completeness - can see what file was replaced
- Recovery capability if replacement was accidental
- Aligns with existing `AuditTrail` model philosophy

**When to hard delete:**
- Only when explicitly requested by admin
- As a scheduled cleanup task for very old replaced files

---

## 2. X-Accel-Redirect Implementation

### 2.1 How X-Accel-Redirect Works

**Architecture:**
```
Client → Nginx (public) → Django (auth check) → Nginx (internal location) → File
```

1. Client requests PDF via `/api/records/{id}/pdf`
2. Nginx proxies to Django
3. Django checks permissions (JWT token validation + role-based access)
4. If authorized, Django returns `X-Accel-Redirect` header with internal path
5. Nginx handles the redirect internally (client never sees it)
6. Nginx serves file directly from filesystem (high performance)

**Benefits:**
- Django handles authorization (secure)
- Nginx serves file (fast, supports range requests)
- File path never exposed to client
- Supports PDF streaming and byte-range requests (needed for browser PDF viewer)

### 2.2 Django View Implementation

```python
from django.http import HttpResponse, Http404
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

class MailRecordViewSet(viewsets.ModelViewSet):
    # ... existing code ...

    @action(detail=True, methods=['get'], url_path='pdf')
    def get_pdf(self, request, pk=None):
        """
        Return X-Accel-Redirect for PDF viewing.
        Only accessible if user can view the mail record.
        """
        mail_record = self.get_object()

        # Check if mail has attachment
        attachment = mail_record.attachments.filter(is_current=True).first()
        if not attachment:
            raise Http404("No PDF attached to this record.")

        # Check view permission (reuses existing can_view logic)
        if not mail_record.can_view(request.user):
            return Response(
                {'error': 'You do not have permission to view this PDF.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Return X-Accel-Redirect header
        # Nginx will internally redirect to this location
        internal_path = f"/internal/pdfs/{attachment.file.name}"

        response = HttpResponse()
        response['X-Accel-Redirect'] = internal_path
        response['X-Accel-Buffering'] = 'no'  # For streaming
        response['Content-Type'] = 'application/pdf'
        response['Content-Disposition'] = f'inline; filename="{attachment.original_filename}"'

        return response
```

### 2.3 Nginx Configuration

**Key Configuration Sections:**

```nginx
# Public location - proxies to Django for auth
cation /api/records/([^/]+)/pdf/ {
    proxy_pass http://django_backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Authorization $http_authorization;

    # Pass JWT token to Django
    proxy_pass_header Authorization;
}

# Internal location - only accessible via X-Accel-Redirect
location /internal/pdfs/ {
    internal;  # Critical: only internal redirects allowed

    alias /srv/mailtracker/pdfs/;  # Physical file location

    # Enable range requests for PDF streaming
    add_header Accept-Ranges bytes;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    # Cache settings
    expires 1h;
    add_header Cache-Control "private, must-revalidate";
}
```

### 2.4 Permission Checking Before Redirect

**Permission Matrix for PDF Access:**

| Role | Can View PDF When |
|------|-------------------|
| AG | Always |
| DAG | Mail in their section OR they've touched the mail |
| SrAO/AAO | Mail assigned to them OR they've touched the mail |

**Reuse existing permission logic:**

```python
def can_view_pdf(self, user):
    """
    PDF view permission mirrors mail view permission.
    Reuses existing can_view logic from MailRecord model.
    """
    return self.can_view(user)
```

### 2.5 Handling Range Requests

Nginx handles range requests automatically when:
- `add_header Accept-Ranges bytes;` is set
- Client sends `Range: bytes=0-1024` header
- File is seekable (regular file on filesystem)

For PDFs, this enables:
- Fast page navigation in browser PDF viewer
- Streaming of large PDFs without full download
- Resume of interrupted downloads

---

## 3. Docker Compose Setup

### 3.1 Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Network                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Nginx      │  │   Django     │  │  PostgreSQL  │       │
│  │   (web)      │  │   (app)      │  │   (db)       │       │
│  │              │  │              │  │              │       │
│  │ Port 80/443  │  │ Port 8000    │  │ Port 5432    │       │
│  │              │  │              │  │              │       │
│  │ - Serves     │  │ - JWT Auth   │  │ - Persistent │       │
│  │   static     │  │ - PDF Upload │  │   data       │       │
│  │ - X-Accel    │  │ - Business   │  │              │       │
│  │   redirect   │  │   logic      │  │              │       │
│  │ - Reverse    │  │              │  │              │       │
│  │   proxy      │  │              │  │              │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                    Named Volumes                             │
│         - pdf_storage:/srv/mailtracker/pdfs                 │
│         - postgres_data:/var/lib/postgresql/data            │
│         - static_files:/app/staticfiles                     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Docker Compose Configuration

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    container_name: mailtracker-db
    environment:
      POSTGRES_DB: mail_tracker
      POSTGRES_USER: mail_tracker
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - mailtracker_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mail_tracker -d mail_tracker"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: mailtracker-backend
    environment:
      - DEBUG=False
      - DATABASE_URL=postgres://mail_tracker:${DB_PASSWORD:-changeme}@db:5432/mail_tracker
      - SECRET_KEY=${SECRET_KEY:-generate-a-secure-key}
      - ALLOWED_HOSTS=${ALLOWED_HOSTS:-localhost}
      - PDF_STORAGE_PATH=/srv/mailtracker/pdfs
    volumes:
      - pdf_storage:/srv/mailtracker/pdfs
      - static_files:/app/staticfiles
    depends_on:
      db:
        condition: service_healthy
    networks:
      - mailtracker_network
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             gunicorn config.wsgi:application --bind 0.0.0.0:8000"

  nginx:
    image: nginx:alpine
    container_name: mailtracker-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - pdf_storage:/srv/mailtracker/pdfs:ro
      - static_files:/var/www/static:ro
    depends_on:
      - backend
    networks:
      - mailtracker_network

volumes:
  postgres_data:
    driver: local
  pdf_storage:
    driver: local
  static_files:
    driver: local

networks:
  mailtracker_network:
    driver: bridge
```

### 3.3 Volume Strategy

**Named Volumes:**

| Volume | Purpose | Backup Strategy |
|--------|---------|-----------------|
| `postgres_data` | PostgreSQL database files | `pg_dump` daily |
| `pdf_storage` | Uploaded PDF files | `rsync` to backup server |
| `static_files` | Django collected static files | Recreated on build |

**Why separate volumes:**
- Independent backup schedules
- Different persistence requirements
- Can migrate database without touching files
- Static files are ephemeral (recollected on deploy)

### 3.4 Environment Variable Management

**`.env` file (not committed to git):**

```bash
# Database
DB_PASSWORD=secure-password-here

# Django
SECRET_KEY=your-256-bit-secret-key-here
DEBUG=False
ALLOWED_HOSTS=mailtracker.office.local,192.168.1.100

# CORS (for frontend)
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://192.168.1.100:5173

# JWT
ACCESS_TOKEN_LIFETIME_HOURS=24
REFRESH_TOKEN_LIFETIME_DAYS=7
```

**Environment Handling in Django:**

```python
# settings.py additions for Docker
import os

# File storage configuration
PDF_STORAGE_PATH = os.environ.get('PDF_STORAGE_PATH', '/srv/mailtracker/pdfs')

# Ensure upload directory exists
os.makedirs(PDF_STORAGE_PATH, exist_ok=True)

# File upload limits
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB

# Database uses DATABASE_URL from environment (dj-database-url)
```

---

## 4. Audit Logging

### 4.1 Extending Existing AuditTrail Model

**Current AuditTrail Actions:**
```python
ACTION_CHOICES = [
    ('CREATE', 'Created'),
    ('ASSIGN', 'Assigned'),
    ('REASSIGN', 'Reassigned'),
    ('UPDATE', 'Added remarks'),
    ('CLOSE', 'Closed'),
    ('REOPEN', 'Reopened'),
    ('MULTI_ASSIGN', 'Assigned to Multiple'),
    ('ASSIGNMENT_UPDATE', 'Assignment Updated'),
    ('ASSIGNMENT_COMPLETE', 'Assignment Completed'),
    ('ASSIGNMENT_REVOKE', 'Assignment Revoked'),
]
```

**New Actions to Add:**
```python
# In audit/models.py, add to ACTION_CHOICES:
('PDF_UPLOAD', 'PDF Uploaded'),
('PDF_REPLACE', 'PDF Replaced'),
('PDF_DELETE', 'PDF Deleted'),
('PDF_VIEW', 'PDF Viewed'),  # Optional: if download tracking needed
```

### 4.2 Audit Logging Implementation

```python
class RecordAttachment(models.Model):
    # ... existing fields ...

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)

        # Log to audit trail
        if is_new:
            AuditTrail.log_action(
                mail_record=self.mail_record,
                action='PDF_UPLOAD',
                performed_by=self.uploaded_by,
                new_value={
                    'filename': self.original_filename,
                    'size': self.file_size,
                    'stored_as': self.file.name
                },
                remarks=f"PDF uploaded: {self.original_filename} ({self.file_size} bytes)"
            )

    def replace(self, new_file, replaced_by_user):
        """Replace attachment with audit logging."""
        old_filename = self.original_filename

        with transaction.atomic():
            # Create replacement
            new_attachment = super().replace(new_file, replaced_by_user)

            # Log replacement
            AuditTrail.log_action(
                mail_record=self.mail_record,
                action='PDF_REPLACE',
                performed_by=replaced_by_user,
                old_value={'filename': old_filename},
                new_value={
                    'filename': new_attachment.original_filename,
                    'size': new_attachment.file_size
                },
                remarks=f"PDF replaced: {old_filename} → {new_attachment.original_filename}"
            )

            return new_attachment
```

### 4.3 What Metadata to Log

**PDF Upload:**
- Original filename
- File size (bytes)
- Stored UUID filename
- Upload timestamp
- Uploading user

**PDF Replace:**
- Old original filename
- New original filename
- Old file size
- New file size
- Replacement timestamp
- Replacing user

**PDF Delete (if implemented):**
- Original filename
- File size
- Deletion timestamp
- Deleting user
- Reason (if provided)

---

## 5. Security Considerations

### 5.1 File Type Validation

**Critical: Only PDF files allowed**

```python
import magic  # python-magic library
from django.core.exceptions import ValidationError

class RecordAttachment(models.Model):
    # ... fields ...

    def clean(self):
        super().clean()

        # Extension check (first line of defense)
        ext = os.path.splitext(self.file.name)[1].lower()
        if ext != '.pdf':
            raise ValidationError("Only PDF files are allowed.")

        # MIME type check (second line of defense)
        if self.file:
            self.file.seek(0)
            mime = magic.from_buffer(self.file.read(1024), mime=True)
            self.file.seek(0)

            if mime != 'application/pdf':
                raise ValidationError(
                    f"Invalid file type. Expected PDF, got {mime}."
                )
```

**Django Form/Serializer Validation:**

```python
from rest_framework import serializers

class PDFUploadSerializer(serializers.Serializer):
    file = serializers.FileField(
        max_length=255,
        allow_empty_file=False,
        help_text="PDF file to upload (max 10MB)"
    )

    def validate_file(self, value):
        # Check file size
        if value.size > 10 * 1024 * 1024:  # 10MB
            raise serializers.ValidationError("File size cannot exceed 10MB.")

        # Check extension
        ext = os.path.splitext(value.name)[1].lower()
        if ext != '.pdf':
            raise serializers.ValidationError("Only PDF files are allowed.")

        return value
```

### 5.2 File Size Limits

**Django Settings:**
```python
# Maximum size for in-memory file uploads
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB

# Maximum size for request body (includes multipart data)
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB

# Temporary directory for large uploads
FILE_UPLOAD_TEMP_DIR = '/tmp'

# Upload handlers
FILE_UPLOAD_HANDLERS = [
    'django.core.files.uploadhandler.MemoryFileUploadHandler',
    'django.core.files.uploadhandler.TemporaryFileUploadHandler',
]
```

### 5.3 Path Traversal Prevention

**UUID-based storage inherently prevents path traversal:**

| User Input | Stored As | Risk |
|------------|-----------|------|
| `../../../etc/passwd` | `550e8400-e29b-41d4-a716-446655440000.pdf` | None - UUID is generated |
| `malicious.pdf` | `6ba7b810-9dad-11d1-80b4-00c04fd430c8.pdf` | None - original name stored separately |

**Additional protections:**
```python
def pdf_upload_path(instance, filename):
    # Never use user-provided filename in path
    # Always generate UUID
    ext = '.pdf'  # Force extension
    return f"{uuid.uuid4()}{ext}"
```

### 5.4 Access Control Enforcement

**Critical: Backend must enforce permissions, never trust frontend**

```python
class PDFPermission(permissions.BasePermission):
    """
    Permission class for PDF operations.
    Mirrors mail record view permissions.
    """

    def has_object_permission(self, request, view, obj):
        # AG has full access
        if request.user.role == 'AG':
            return True

        # DAG can view PDFs for mails in their sections
        if request.user.role == 'DAG':
            return obj.mail_record.can_view(request.user)

        # SrAO/AAO can view PDFs for assigned mails
        if request.user.role in ['SrAO', 'AAO']:
            return obj.mail_record.can_view(request.user)

        return False


# In viewset:
@action(detail=True, methods=['get'], url_path='pdf', permission_classes=[IsAuthenticated, PDFPermission])
def get_pdf(self, request, pk=None):
    # ... implementation ...
```

**Permission Enforcement Points:**
1. **Upload**: Only AG/DAG can upload (same as create permission)
2. **View**: Same as mail view permission
3. **Replace**: Only AG/DAG (for their sections) + original uploader
4. **Delete**: Only AG (hard delete)

### 5.5 Additional Security Measures

**Content Security Headers:**
```python
# settings.py
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'SAMEORIGIN'  # Allow PDF viewer in iframe from same origin
```

**Nginx Security:**
```nginx
# Prevent execution of uploaded files
location /internal/pdfs/ {
    internal;
    alias /srv/mailtracker/pdfs/;

    # Explicitly disable script execution
    location ~* \.php$ {
        return 403;
    }

    # Add security headers
    add_header X-Content-Type-Options "nosniff";
    add_header X-Frame-Options "SAMEORIGIN";

    # Limit to PDF only
    if ($request_filename !~* \.pdf$) {
        return 403;
    }
}
```

---

## 6. Specific Recommendations for This Project

### 6.1 Database Migration Strategy

Since moving from SQLite to PostgreSQL:

```bash
# 1. Backup existing SQLite data
python manage.py dumpdata --natural-foreign --natural-primary \
    -e contenttypes -e auth.Permission --indent 2 > backup.json

# 2. Start Docker Compose with PostgreSQL
docker-compose up -d db

# 3. Run migrations in Docker
docker-compose run --rm backend python manage.py migrate

# 4. Load data
docker-compose run --rm backend python manage.py loaddata backup.json

# 5. Create new attachment table
docker-compose run --rm backend python manage.py makemigrations attachments
docker-compose run --rm backend python manage.py migrate
```

### 6.2 Model Integration

Add attachment relationship to existing `MailRecord` model:

```python
class MailRecord(models.Model):
    # ... existing fields ...

    @property
    def current_pdf(self):
        """Get current PDF attachment (convenience property)."""
        return self.attachments.filter(is_current=True).first()

    def can_upload_pdf(self, user):
        """Check if user can upload PDF to this record."""
        if user.is_ag():
            return True
        if user.is_dag() and self.section and user.sections.filter(id=self.section.id).exists():
            return True
        return False
```

### 6.3 API Endpoint Design

Add to existing `MailRecordViewSet`:

```python
@action(detail=True, methods=['post'], url_path='pdf/upload')
def upload_pdf(self, request, pk=None):
    """Upload PDF to mail record."""
    mail_record = self.get_object()

    if not mail_record.can_upload_pdf(request.user):
        return Response({'error': 'Permission denied'}, status=403)

    # Handle existing PDF (replace)
    existing = mail_record.current_pdf

    serializer = PDFUploadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    if existing:
        # Replace existing
        new_attachment = existing.replace(
            serializer.validated_data['file'],
            request.user
        )
    else:
        # New upload
        new_attachment = RecordAttachment.objects.create(
            mail_record=mail_record,
            file=serializer.validated_data['file'],
            original_filename=serializer.validated_data['file'].name,
            file_size=serializer.validated_data['file'].size,
            uploaded_by=request.user
        )

    return Response({
        'id': new_attachment.id,
        'original_filename': new_attachment.original_filename,
        'file_size': new_attachment.file_size,
        'uploaded_at': new_attachment.uploaded_at
    }, status=201)


@action(detail=True, methods=['get'], url_path='pdf')
def get_pdf(self, request, pk=None):
    """View PDF via X-Accel-Redirect."""
    mail_record = self.get_object()
    attachment = mail_record.current_pdf

    if not attachment:
        return Response({'error': 'No PDF attached'}, status=404)

    if not mail_record.can_view(request.user):
        return Response({'error': 'Permission denied'}, status=403)

    # Return X-Accel-Redirect response
    response = HttpResponse()
    response['X-Accel-Redirect'] = f"/internal/pdfs/{attachment.file.name}"
    response['Content-Type'] = 'application/pdf'
    response['Content-Disposition'] = f'inline; filename="{attachment.original_filename}"'
    return response


@action(detail=True, methods=['delete'], url_path='pdf')
def delete_pdf(self, request, pk=None):
    """Delete PDF (AG only)."""
    mail_record = self.get_object()

    if not request.user.is_ag():
        return Response({'error': 'Only AG can delete PDFs'}, status=403)

    attachment = mail_record.current_pdf
    if attachment:
        attachment.delete()
        return Response({'status': 'PDF deleted'})

    return Response({'error': 'No PDF to delete'}, status=404)
```

### 6.4 Frontend Integration Points

**Existing API client pattern (to maintain):**
- Use Axios with JWT interceptor
- Handle 403/404 responses consistently
- Show loading states during upload

**New endpoints to add to API service:**

```javascript
// services/api.js additions

uploadPDF: (recordId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/records/${recordId}/pdf/upload/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
},

viewPDF: (recordId) => {
    // Returns URL with auth token as query param for direct browser access
    return api.get(`/records/${recordId}/pdf/`);
},

deletePDF: (recordId) => {
    return api.delete(`/records/${recordId}/pdf/`);
}
```

### 6.5 Testing Strategy

**Unit Tests:**
```python
# tests/test_pdf_upload.py

class PDFUploadTests(TestCase):
    def test_upload_valid_pdf(self):
        """Test successful PDF upload."""
        pass

    def test_upload_invalid_file_type(self):
        """Test rejection of non-PDF files."""
        pass

    def test_upload_oversized_file(self):
        """Test rejection of files > 10MB."""
        pass

    def test_ag_can_upload_to_any_record(self):
        """Test AG upload permissions."""
        pass

    def test_dag_can_upload_to_section_records(self):
        """Test DAG upload permissions."""
        pass

    def test_srao_cannot_upload(self):
        """Test SrAO upload restrictions."""
        pass
```

**Integration Tests:**
```python
# tests/test_pdf_viewing.py

class PDFViewingTests(TestCase):
    def test_x_accel_redirect_header_present(self):
        """Test X-Accel-Redirect header is returned."""
        pass

    def test_unauthorized_user_cannot_view_pdf(self):
        """Test permission enforcement."""
        pass

    def test_pdf_view_logged_in_audit_trail(self):
        """Test audit logging."""
        pass
```

---

## 7. Common Pitfalls to Avoid

### 7.1 File Storage Pitfalls

| Pitfall | Why It's Bad | Solution |
|---------|--------------|----------|
| Using user-provided filename for storage | Path traversal attacks | Always use UUID |
| Storing files in container filesystem | Data loss on restart | Use named volumes |
| Not validating MIME type | Fake extensions bypass | Use python-magic |
| Hard-deleting replaced files | Audit trail gaps | Soft delete pattern |

### 7.2 X-Accel-Redirect Pitfalls

| Pitfall | Why It's Bad | Solution |
|---------|--------------|----------|
| Exposing internal path to client | Information leak | Use `internal` directive |
| Not checking permissions | Unauthorized access | Always auth in Django |
| Missing `Accept-Ranges` | Poor PDF UX | Add header in nginx |
| Not handling 404 | Poor error handling | Check existence first |

### 7.3 Docker Pitfalls

| Pitfall | Why It's Bad | Solution |
|---------|--------------|----------|
| Storing secrets in image | Security leak | Use .env file |
| No health checks | Cascading failures | Add healthcheck |
| Running as root | Container escape risk | Use non-root user |
| No volume backups | Data loss | Automated backups |

### 7.4 Permission Pitfalls

| Pitfall | Why It's Bad | Solution |
|---------|--------------|----------|
| Frontend-only permission checks | Bypassable | Always enforce in backend |
| Assuming role implies permission | Logic errors | Check both role and object |
| Not logging access | No audit trail | Log all PDF operations |

---

## 8. Implementation Checklist

### Week 1: Infrastructure Setup

- [ ] Create `.planning/phases/01-infrastructure-pdf-backend/` structure
- [ ] Write Phase 1 implementation spec (this research feeds into it)
- [ ] Create Docker Compose configuration
- [ ] Create nginx configuration with X-Accel-Redirect
- [ ] Set up environment variable handling
- [ ] Test Docker setup on Windows dev laptop
- [ ] Document deployment steps

### Week 2: Backend Implementation

- [ ] Create `attachments` Django app
- [ ] Implement `RecordAttachment` model
- [ ] Add new audit action types
- [ ] Implement file upload validation (PDF only, 10MB limit)
- [ ] Add API endpoints (upload, view, delete)
- [ ] Implement X-Accel-Redirect view
- [ ] Write unit tests
- [ ] Test permission enforcement

### Week 3: Integration & Testing

- [ ] Migrate from SQLite to PostgreSQL in Docker
- [ ] Test complete upload/view flow
- [ ] Load test with multiple concurrent PDF views
- [ ] Verify audit trail logging
- [ ] Security review
- [ ] Deploy to Ubuntu server
- [ ] Document production deployment

---

## 9. Key Files to Create

### New Backend Files:
```
backend/attachments/
├── __init__.py
├── models.py          # RecordAttachment model
├── serializers.py     # PDFUploadSerializer
├── views.py           # AttachmentViewSet (if separate)
└── tests.py           # Unit tests

backend/config/
├── settings.py        # Add FILE_UPLOAD_* settings
└── urls.py            # Add attachment endpoints (if separate)
```

### New Infrastructure Files:
```
backend/
├── Dockerfile         # Django/Gunicorn image
└── entrypoint.sh      # Migration + startup script

nginx/
├── nginx.conf         # Main nginx config
└── conf.d/
    └── mailtracker.conf  # Site-specific config

docker-compose.yml     # Service orchestration
.env.example           # Environment template
.env                   # Local environment (gitignored)
```

### Modified Existing Files:
```
backend/audit/models.py         # Add PDF_* action types
backend/records/models.py       # Add attachment relationship
backend/records/views.py        # Add PDF upload/view/delete actions
backend/records/serializers.py  # Add PDF metadata to serializers
backend/config/permissions.py   # Add PDFPermission class
```

---

## 10. Summary

This research provides the foundation for implementing Phase 1:

1. **File Upload**: UUID-based storage prevents path traversal and collisions
2. **X-Accel-Redirect**: Django authorizes, nginx serves (secure + fast)
3. **Docker Setup**: PostgreSQL + Django + Nginx with named volumes
4. **Audit Logging**: Extend existing AuditTrail with PDF_* action types
5. **Security**: Multi-layer validation (extension + MIME type + size)

**Next Step**: Write the Phase 1 implementation spec based on this research, then proceed with implementation.

---

## References

- Django File Uploads: https://docs.djangoproject.com/en/5.0/topics/http/file-uploads/
- Nginx X-Accel-Redirect: https://www.nginx.com/resources/wiki/start/topics/examples/x-accel/
- Django Docker Production: https://docs.docker.com/samples/django/
- python-magic: https://github.com/ahupp/python-magic
- PostgreSQL in Docker: https://hub.docker.com/_/postgres
