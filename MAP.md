# Mail Tracker Codebase Map

**Purpose**: Quick reference guide to navigate the codebase efficiently and reduce token usage.

## Runtime Delta (2026-03-05)

Use this section as the latest behavior reference when older sections below differ.

- Mail statuses: `Created`, `Assigned`, `In Progress`, `Closed`.
- Mail list status scopes support:
  - `all`
  - `assigned`
  - `created_by_me`
  - `closed`
- All operational roles can create mail: `AG`, `DAG`, `SrAO`, `AAO`, `auditor`, `clerk` (role-scoped validation still applies).
- Non-AG visibility is strict scope-based:
  - DAG: managed section scope only
  - SrAO/AAO/clerk: own subsection scope only
  - auditor: configured auditor subsection scope only
- Historical/touched visibility fallback is disabled for non-AG roles.
- Reassignment chain behavior:
  - `reassign_assignment` updates the same `MailAssignment` row (`reassigned_to`), not a new row.
  - Timeline is append-only in `AssignmentRemark`.
  - Current assignee can add remarks and complete assignment after reassignment.
- DAG `multi_assign` works for records in DAG-managed sections.
- Multi-assigned detail UI shows a single consolidated assignment-history table, with reassignment history appended in-row.

### v1.3 Changes (2026-03-05)
- **Signup workflow:** Public signup request flow added:
  - `POST /api/auth/signup/`
  - `GET /api/auth/signup-metadata/`
  - Uses `SignupRequest` model with superuser-only approval in Django admin.
- **Signup constraints:** roles limited to `SrAO`, `AAO`, `auditor`, `clerk`; blocked email domains: `gmail.com`, `hotmail.com`, `nic.in`.
- **Admin controls:** one-click `Delete All Data` action available in Users admin (keeps superusers).
- **User import reliability:** CSV/JSON import optimized with bulk create + role normalization (`SRAO` -> `SrAO`).

### v1.2 Changes (2026-02-24)
- **Deprecated fields removed:** `action_required_other`, `remarks` (MailRecord), `user_remarks` (MailAssignment) — migration 0014
- **Query optimizations:** `bulk_create` for MailAssignment+AuditTrail, per-request caching for assigned IDs, single-query DAG lookups
- **Create Mail UX:** Form shell renders immediately (fieldset disabled pattern), section auto-derived from assignees (no standalone section dropdown), assignee rows with section chips
- **Mail List pagination:** Server-side pagination (25/page) via `MailRecordPagination`, `?page=` and `?page_size=` params, MUI Pagination controls
- **Search filter:** DRF `SearchFilter` on `sl_no`, `letter_no`, `mail_reference_subject` via `?search=` param
- **PDF icon:** Paperclip icon on mail list for mails with attachments, click opens PDF in new tab

---

## 📁 Project Structure (ASCII Tree)

```
Mail_Tracker/
├── backend/                          # Django REST API
│   ├── config/                       # Main Django configuration
│   │   ├── settings.py              # Django settings (DB, CORS, JWT, static files)
│   │   ├── urls.py                  # API routing + JWT endpoints
│   │   ├── permissions.py           # Custom permission classes (MailRecordPermission)
│   │   └── wsgi.py                  # WSGI entry point
│   │
│   ├── users/                        # User authentication & management
│   │   ├── models.py                # User model (AG/DAG/SrAO/AAO roles)
│   │   ├── serializers.py           # UserSerializer, UserMinimalSerializer
│   │   ├── views.py                 # UserViewSet, JWT login view
│   │   ├── admin.py                 # User admin + CSV/JSON import
│   │   └── migrations/              # DB migrations for users
│   │
│   ├── sections/                     # Office sections & subsections
│   │   ├── models.py                # Section, Subsection models
│   │   ├── serializers.py           # SectionSerializer, SubsectionSerializer
│   │   ├── views.py                 # SectionViewSet, SubsectionViewSet (read-only)
│   │   ├── admin.py                 # Section/Subsection admin with inline editing
│   │   └── migrations/              # DB migrations for sections
│   │
│   ├── records/                      # Mail tracking core functionality
│   │   ├── models.py                # MailRecord, MailAssignment, AssignmentRemark
│   │   ├── serializers.py           # CRUD serializers for mail records
│   │   ├── views.py                 # MailRecordViewSet, MailAssignmentViewSet
│   │   └── migrations/              # DB migrations for records
│   │
│   ├── audit/                        # Audit trail logging
│   │   ├── models.py                # AuditTrail model (who did what, when)
│   │   ├── serializers.py           # AuditTrailSerializer
│   │   ├── views.py                 # AuditTrailViewSet (read-only)
│   │   └── migrations/              # DB migrations for audit
│   │
│   ├── manage.py                     # Django CLI entry point
│   ├── create_superuser.py           # Auto-create admin user (for deployment)
│   ├── build.sh                      # Render deployment build script
│   ├── requirements.txt              # Python dependencies
│   └── db.sqlite3                    # SQLite database (local dev)
│
├── frontend/                         # React + MUI application
│   ├── src/
│   │   ├── pages/                   # Page-level components
│   │   ├── components/              # Reusable UI components
│   │   ├── services/                # Axios API calls
│   │   ├── layouts/                 # Role-based layouts
│   │   └── utils/                   # Helpers, constants, enums
│   ├── package.json                 # Node dependencies
│   ├── vite.config.js               # Vite build config
│   └── vercel.json                  # Vercel deployment config
│
├── CLAUDE.md                         # Project instructions (READ THIS FIRST!)
├── MAP.md                            # This file - codebase navigation guide
└── README.md                         # DELETED (no longer exists)
```

---

## 🗂️ Backend Deep Dive

### **config/ - Django Configuration**

| File | Purpose | Key Contents |
|------|---------|--------------|
| `settings.py` | Django settings | DATABASE (SQLite/PostgreSQL), CORS_ALLOWED_ORIGINS, JWT config, ALLOWED_HOSTS, WhiteNoise static files |
| `urls.py` | API routing | Router registration for all viewsets, JWT endpoints (`/api/auth/login/`, `/api/auth/refresh/`) |
| `permissions.py` | Custom permissions | `MailRecordPermission` - enforces role-based access on backend |

---

### **users/ - User Management**

#### **models.py - User Model**
```python
class User(AbstractUser):
    ROLES: AG, DAG, SrAO, AAO, auditor, clerk

    # IMPORTANT: DAG can manage multiple sections (ManyToMany)
    sections = ManyToManyField(Section)  # For DAG role

    # SrAO/AAO belong to a subsection
    subsection = ForeignKey(Subsection)  # For SrAO/AAO roles

    # Helper methods
    is_ag() -> bool
    is_dag() -> bool
    is_staff_officer() -> bool
    get_sections_list() -> QuerySet[Section]
    get_dag() -> User  # Returns monitoring officer

class SignupRequest:
    status: pending/approved/rejected
    requested_role: SrAO/AAO/auditor/clerk
    requested_section: FK(Section)
    requested_subsection: FK(Subsection)
```

**Key Logic:**
- `get_dag()`: Returns monitoring officer based on hierarchy
  - AG → self
  - DAG → any active AG
  - SrAO/AAO → DAG of their subsection's parent section (or AG if section.directly_under_ag=True)

#### **serializers.py - User Serializers**
- `UserSerializer`: Full user details with sections_list and subsection_detail
- `UserCreateSerializer`: Create user with password hashing + ManyToMany sections
- `UserMinimalSerializer`: Minimal info for dropdowns (id, full_name, role, sections_display)

#### **views.py - User ViewSet**
```python
UserViewSet:
    - Filters: ?role=DAG, ?section=1, ?subsection=2
    - Custom actions:
        - /list_minimal/ → Returns minimal user data for dropdowns
        - /me/ → Returns current logged-in user info
```

#### **admin.py - User Admin + Import**
- **CSV/JSON Import**: `/admin/users/user/import/`
- **Required columns**: username, email, password, full_name, role
- **Optional columns**:
  - `sections` (comma-separated for DAG, e.g., "Admin, AMG-I")
  - `subsection` (for SrAO/AAO, format: "Section - Subsection" or "Subsection")

---

### **sections/ - Sections & Subsections**

#### **models.py - Section & Subsection Models**
```python
class Section:
    name: str (unique)
    directly_under_ag: bool  # True if reports to AG (no DAG)
    subsections: Reverse FK → Subsection[]

class Subsection:
    section: ForeignKey(Section)
    name: str
    # Unique constraint: (section, name)
```

**Hierarchy Logic:**
- If `Section.directly_under_ag=True`: AG → Section → Subsections → SrAO/AAO
- If `Section.directly_under_ag=False`: AG → DAG → Sections → Subsections → SrAO/AAO

#### **views.py - Section ViewSets**
```python
SectionViewSet (read-only):
    - Includes nested subsections
    - GET /api/sections/

SubsectionViewSet (read-only):
    - Filter: ?section=1
    - GET /api/subsections/
```

#### **admin.py - Section Admin + Import**
- **CSV/JSON Import**: `/admin/sections/section/import/`
- **CSV Format**:
  - Required: `section_name`
  - Optional: `description`, `directly_under_ag`, `subsection_name`, `subsection_description`
  - Repeat section name for multiple subsections
- **JSON Format**:
  ```json
  [
    {
      "name": "Admin",
      "description": "Administrative section",
      "directly_under_ag": true,
      "subsections": [
        {"name": "Admin-1", "description": "General admin"},
        {"name": "Admin-2", "description": "Establishment"}
      ]
    }
  ]
  ```
- **Sample Files**: `backend/sample_data/sections_sample.csv` and `sections_sample.json`

---

### **records/ - Mail Tracking (CORE)**

#### **models.py - MailRecord Model**
```python
class MailRecord:
    # Auto-generated
    sl_no: str  # Format: YYYY/NNN (e.g., 2026/001)

    # Mail details
    letter_no, date_received, mail_reference_subject, from_office
    action_required: text (free-text, max 500 chars)

    # Assignment
    assigned_to: FK(User)  # Who it's assigned to
    current_handler: FK(User)  # Who has it NOW
    monitoring_officer: FK(User)  # Supervisor (auto-set to assigned_to's DAG)

    # Hierarchy
    section: FK(Section, null=True)  # Owning section
    subsection: FK(Subsection, null=True)  # Optional subsection

    # Status tracking
    status: Created/Assigned/In Progress/Closed
    due_date: date
    date_of_completion: date (null until closed)
    last_status_change: datetime (tracks time in current stage)

    # Multi-assignment support
    is_multi_assigned: bool
    consolidated_remarks: text (auto-generated from assignments)

    # Methods
    time_in_current_stage() -> str  # "2 days 5 hours"
    is_overdue() -> bool
    can_view(user) -> bool
    can_edit(user) -> bool
    can_reassign(user) -> bool
    can_close(user) -> bool
    can_reopen(user) -> bool  # AG only
```

**Permission Logic Summary:**
| Action | AG | DAG | SrAO/AAO |
|--------|----|----|----------|
| View | All mails | Managed section scope | Own subsection scope |
| Create | Any section | Own sections | Own subsection |
| Reassign | Anyone | Within own sections | Own mail only |
| Close | Any mail | If current handler | If current handler |
| Reopen | ✅ | ❌ | ❌ |

#### **models.py - MailAssignment Model**
```python
class MailAssignment:
    # For parallel/multi-assignments (AG/DAG can assign to multiple people)
    mail_record: FK(MailRecord)
    assigned_to: FK(User)
    assigned_by: FK(User)
    status: Active/Completed/Revoked

    # Remarks timeline
    remarks_timeline: Reverse FK → AssignmentRemark[]
```

#### **serializers.py - Mail Serializers**
- `MailRecordListSerializer`: List view (includes time_in_stage, is_overdue, section_name, subsection_name)
- `MailRecordDetailSerializer`: Detail view with nested objects (section_details, subsection_details, assignments)
- `MailRecordCreateSerializer`: Create mail (accepts section, subsection, assigned_to[])
- `MailRecordReassignSerializer`: Reassign with mandatory remarks
- `MailRecordCloseSerializer`: Close with mandatory final remarks

#### **views.py - MailRecordViewSet**
```python
get_queryset():
    # CRITICAL FILTERING LOGIC

    AG: See ALL mails

    DAG: See mails where:
        - section_id in user.sections (ManyToMany)
        - OR section is null and subsection.section_id in user.sections

    SrAO/AAO: See mails where:
        - subsection = user.subsection

Custom actions:
    - /reassign/ → POST with {assigned_to_id, remarks}
    - /close/ → POST with {final_remarks}
    - /reopen/ → POST with {remarks} (AG only)
    - /multi_assign/ → POST with {user_ids[], instructions}
```

---

### **audit/ - Audit Trail**

#### **models.py - AuditTrail Model**
```python
class AuditTrail:
    mail_record: FK(MailRecord)
    action_type: CREATE/ASSIGN/REASSIGN/UPDATE/CLOSE/REOPEN
    performed_by: FK(User)
    timestamp: datetime
    remarks: text

    # Immutable - no edit/delete allowed
```

**Purpose**: Complete history of who did what and when for accountability.

---

## 🌐 API Endpoints Quick Reference

### **Authentication**
```
POST /api/auth/login/          # Login (returns JWT + user data)
POST /api/auth/refresh/        # Refresh JWT token
POST /api/auth/change-password/ # Change password (username + current password)
POST /api/auth/signup/         # Submit signup request (pending approval)
GET  /api/auth/signup-metadata/ # Roles + sections/subsections for signup form
```

### **Users**
```
GET    /api/users/             # List users (?role=DAG, ?section=1, ?subsection=2)
POST   /api/users/             # Create user
GET    /api/users/{id}/        # User detail
PATCH  /api/users/{id}/        # Update user
GET    /api/users/me/          # Current logged-in user
GET    /api/users/list_minimal/ # Minimal user data for dropdowns
```

### **Sections & Subsections**
```
GET /api/sections/             # List sections (with nested subsections)
GET /api/sections/{id}/        # Section detail

GET /api/subsections/          # List subsections (?section=1)
GET /api/subsections/{id}/     # Subsection detail
```

### **Mail Records**
```
GET    /api/records/           # List mails (?status=Created&page=1&page_size=25&search=term)
POST   /api/records/           # Create mail
GET    /api/records/{id}/      # Mail detail
PATCH  /api/records/{id}/      # Update mail
POST   /api/records/{id}/reassign/      # Reassign mail
POST   /api/records/{id}/close/         # Close mail
POST   /api/records/{id}/reopen/        # Reopen mail (AG only)
POST   /api/records/{id}/multi_assign/  # Multi-assign to multiple users
GET    /api/records/{id}/pdf/view/      # View attached PDF (X-Accel-Redirect)
```

### **Assignments**
```
GET    /api/assignments/       # List assignments (?mail_record=1)
PATCH  /api/assignments/{id}/update/    # Update assignment status
POST   /api/assignments/{id}/complete/  # Mark assignment complete
POST   /api/assignments/{id}/add_remark/ # Add remark to assignment
```

### **Audit Trail**
```
GET /api/audit/                # List audit records (?mail_record=1)
GET /api/audit/{id}/           # Audit detail
```

---

## 🔑 Key Files for Common Tasks

### **Adding a New Field to MailRecord**
1. Update `backend/records/models.py` → MailRecord class
2. Run `python manage.py makemigrations && python manage.py migrate`
3. Update `backend/records/serializers.py` → Add field to relevant serializers
4. Update `backend/records/admin.py` → Add to list_display/fieldsets (if needed)

### **Changing Permission Logic**
- **Backend enforcement**: `backend/records/models.py` → `can_view()`, `can_edit()`, etc.
- **API permission class**: `backend/config/permissions.py` → `MailRecordPermission`
- **Filtering logic**: `backend/records/views.py` → `get_queryset()`

### **Adding New Role or Modifying User Fields**
1. Update `backend/users/models.py` → User.ROLE_CHOICES
2. Update `backend/users/serializers.py`
3. Update permission methods in `backend/records/models.py`
4. Run migrations

### **Bulk Import (CSV/JSON)**

#### **Sections and Subsections Import**
- **Location**: Django admin → Sections → Import Sections/Subsections button
- **CSV Template**: `backend/sample_data/sections_sample.csv`
- **JSON Template**: `backend/sample_data/sections_sample.json`
- **CSV Columns**: section_name (required), description, directly_under_ag, subsection_name, subsection_description
- **JSON Structure**: Array of section objects with nested subsections array

#### **Users Import**
- **Location**: Django admin → Users → Import button
- **CSV Columns**: username, email, password, full_name, role, sections (comma-sep for DAG), subsection (for SrAO/AAO)

### **Deployment**
- **Backend (Render)**: `backend/build.sh` runs on deploy (collectstatic, migrate, create superuser)
- **Frontend (Vercel)**: Auto-deploys from GitHub, uses `frontend/vercel.json` config
- **Environment vars**: See CLAUDE.md → Cloud Deployment Guide

---

## 🎯 Most Important Files (80/20 Rule)

If you only read **5 files**, read these:

1. **CLAUDE.md** - Project instructions, requirements, and deployment guide
2. **backend/records/models.py** - Core business logic (MailRecord, permissions)
3. **backend/records/views.py** - API filtering and custom actions
4. **backend/users/models.py** - User roles and hierarchy logic
5. **backend/config/urls.py** - All API endpoints registered here

---

## 🧭 Decision Tree: "Where Do I Go?"

**Q: I need to change what users can see/do**
→ Go to `backend/records/models.py` → `can_view()`, `can_edit()`, etc.
→ Also check `backend/records/views.py` → `get_queryset()` filtering

**Q: I need to add a new field to track**
→ Go to `backend/records/models.py` → Add field to MailRecord
→ Create migration, update serializers

**Q: I need to change API response format**
→ Go to `backend/records/serializers.py` (or users/, sections/, audit/)

**Q: I need to add a new API endpoint**
→ Go to `backend/records/views.py` → Add `@action` decorator method
→ Or create new ViewSet and register in `backend/config/urls.py`

**Q: I need to modify admin interface**
→ Go to `backend/*/admin.py` for the relevant app

**Q: I need to understand user hierarchy**
→ Go to `backend/users/models.py` → `get_dag()` method
→ See `backend/sections/models.py` → `Section.directly_under_ag`

**Q: I need to see deployment settings**
→ Go to CLAUDE.md → Cloud Deployment Guide
→ Check `backend/build.sh` and `backend/config/settings.py`

**Q: I need to import bulk users**
→ Go to `backend/users/admin.py` → `_create_user_from_row()` method
→ Use Django admin → Users → Import

---

## 📊 Data Model Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                        User (AG)                            │
│  - role: AG                                                 │
│  - sections: [] (empty, sees all)                           │
│  - subsection: null                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ manages
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Section                                │
│  - name: "Admin"                                            │
│  - directly_under_ag: True/False                            │
└─────────────────────────────────────────────────────────────┘
           │                                 │
           │ has many                        │ managed by (if directly_under_ag=False)
           ▼                                 ▼
┌──────────────────────┐        ┌─────────────────────────────┐
│    Subsection        │        │      User (DAG)             │
│  - section: FK       │        │  - role: DAG                │
│  - name: "Admin-1"   │        │  - sections: [1, 2, 3]      │
└──────────────────────┘        │    (ManyToMany)             │
           │                    │  - subsection: null         │
           │ has staff          └─────────────────────────────┘
           ▼
┌──────────────────────┐
│  User (SrAO/AAO)     │
│  - role: SrAO/AAO    │
│  - sections: []      │
│  - subsection: FK    │
└──────────────────────┘
           │
           │ assigned to
           ▼
┌──────────────────────────────────────────────────────────────┐
│                     MailRecord                               │
│  - section: FK(Section, null=True)                           │
│  - subsection: FK(Subsection, null=True)                     │
│  - assigned_to: FK(User)                                     │
│  - current_handler: FK(User)                                 │
│  - monitoring_officer: FK(User) - auto-set to DAG            │
└──────────────────────────────────────────────────────────────┘
           │
           │ has many
           ▼
┌──────────────────────────────────────────────────────────────┐
│                  MailAssignment                              │
│  - mail_record: FK(MailRecord)                               │
│  - assigned_to: FK(User)                                     │
│  - status: Active/Completed/Revoked                          │
└──────────────────────────────────────────────────────────────┘
           │
           │ has timeline of
           ▼
┌──────────────────────────────────────────────────────────────┐
│                AssignmentRemark                              │
│  - assignment: FK(MailAssignment)                            │
│  - content: text                                             │
│  - created_by: FK(User)                                      │
│  - created_at: datetime                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Commands

```bash
# Backend
cd backend
python manage.py runserver 0.0.0.0:8000  # Start dev server
python manage.py makemigrations           # Create migrations
python manage.py migrate                  # Apply migrations
python manage.py createsuperuser          # Create admin user
python manage.py shell                    # Django shell

# Frontend
cd frontend
npm install                               # Install dependencies
npm run dev                               # Start dev server
npm run build                             # Production build

# Database
backend/db.sqlite3                        # SQLite DB file (local dev)

# Admin Panel
http://localhost:8000/admin/              # Django admin interface
```

---

## 📝 Recent Major Changes

### 2026-02-24 (v1.2 — Latest)

#### Backend Cleanup & Refactoring (Phase 6)
- Removed deprecated fields: `action_required_other`, `remarks`, `user_remarks`
- Migration 0014 removes columns from database
- `bulk_create` for MailAssignment and AuditTrail in mail creation
- DAG section officer query collapsed from 2 queries to 1
- Per-request caching for `_assigned_mail_ids_for_user`
- Scope-first permissions in `permissions.py` (no touched-history fallback for non-AG)

#### Create Mail UX (Phase 7)
- Form shell renders immediately (fieldset disabled pattern, no full-page spinner)
- Section auto-derived from assignees (no standalone dropdown)
- Sections API call removed from Create page
- Assignee rows with section chip, name, role, remove button

#### Mail List Enhancements (Phase 8)
- Server-side pagination: 25 records/page with MUI Pagination controls
- Search filter: `?search=` on sl_no, letter_no, subject
- PDF icon (paperclip) next to subject for mails with attachments
- Loading overlay on table instead of full-page spinner
- Page size selector (25/50/100)

---

## 💡 Pro Tips for Future Claude Code Sessions

1. **Always read CLAUDE.md first** - contains project requirements and rules
2. **Check MAP.md (this file)** before exploring the codebase
3. **For permissions**: Start with `records/models.py` → `can_*()` methods
4. **For API changes**: Check `serializers.py` → `views.py` → `urls.py` in that order
5. **For data model changes**: Always run migrations after model updates
6. **For deployment issues**: Check CLAUDE.md → Cloud Deployment Guide
7. **For user hierarchy**: Look at `users/models.py` → `get_dag()` method

---

**Last Updated**: 2026-02-24
**Codebase Version**: v1.2 — Refactor & Create Mail UX
**Django Version**: 5.x
**DRF Version**: 3.14+
