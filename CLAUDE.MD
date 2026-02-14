# CLAUDE.md

Copy and paste this 👇

---

## 🗺️ Quick Navigation

**NEW**: Before exploring the codebase, read **MAP.md** for a complete codebase map with ASCII tree structure, file descriptions, and quick reference guide. This will significantly reduce token usage by helping you navigate directly to the right files.

---

## Project Context
Build a secure, role-based office workflow and mail tracking application for internal office use.
The system tracks received mails/actions, assigns them to officers, monitors progress through different stages, and maintains audit trail.
**Key Purpose**: Track where each mail is stuck (who is working on it right now and for how long).
The app is hosted locally (laptop server) and prioritizes correctness, security, and long-term maintainability over scale.

### Roles and Permissions
1. **AG (Accountant General)** - Head of office
   - Can do anything: create, assign, reassign, close, view all records
   - Full system access across all sections

2. **DAG (Deputy Accountant General)** - Section heads
   - **CANNOT create** mail entries (only AG can create)
   - Can reassign mails within their managed sections
   - Can view: Own section records + all records they've ever touched
   - Can update status and close records they're handling

3. **SrAO/AAO (Senior Audit Officer / Assistant Audit Officer)** - Staff officers
   - Can update status of mails assigned to them
   - Can close mails they're currently handling
   - Can view records assigned to them

### Workflow Stages
1. **Received** - Mail logged into system (initial state when created)
2. **Assigned** - Auto-transitions when mail is assigned to an officer
3. **In Progress** - Auto-transitions when assigned officer starts working on it
4. **Closed** - Manually set by current handler when work is completed

**Auto-transition rules:**
- Creating a mail → Status: Received
- Assigning to an officer → Status: Assigned
- Officer updates/works on it → Status: In Progress
- Handler explicitly closes → Status: Closed

### Mail Tracking Fields
- **Date Received** - When mail entered the system
- **Source Department** - Where the mail came from
- **Subject/Description** - What the mail is about
- **Current Handler** - Who has it right now
- **Current Stage** - Which workflow stage it's in (auto-transitions)
- **Time in Current Stage** - How long it's been with current handler
- **Section** - Which office section owns this mail (assigned by creator when creating the entry)
- **Audit Trail** - Full history of all handlers, status changes, and timestamps

---

## Tech Stack

### Backend
- Framework: Django 5.x
- API: Django REST Framework
- Language: Python 3.11+
- Authentication: JWT (SimpleJWT) with username/password
- Database: SQLite (local file)
- Hosting: Laptop (LAN access)

### Frontend
- Framework: React 18
- UI Library: Material-UI (MUI) v5
- HTTP Client: Axios
- State: Local state + hooks (Context API for auth)
- Styling: MUI's built-in theming system
- Form Handling: React Hook Form (for validation)
- Date Picker: MUI X Date Pickers

---

## Key Directories

### backend/
- config/ → Django settings, URLs, WSGI
- users/ → User model, roles (AG/DAG/SrAO/AAO), authentication
- records/ → Core mail tracking records model
- audit/ → Audit trail for tracking all changes and handler history
- sections/ → Predefined office sections/departments
- permissions/ → Custom permission classes for role-based access
- manage.py → Django entry point
- db.sqlite3 → SQLite database file

### frontend/
- src/pages/ → Page-level components
- src/components/ → Reusable UI components
- src/services/ → API calls (Axios)
- src/layouts/ → Role-based layouts
- src/utils/ → Helpers, constants, enums

---

## Commands

### Backend
```bash
# Start dev server (accessible on LAN)
python manage.py runserver 0.0.0.0:8000

# Make and apply migrations
python manage.py makemigrations
python manage.py migrate

# Create admin user
python manage.py createsuperuser
```

### Frontend
```bash
# Install dependencies and start dev server
npm install
npm run dev

# Build for production
npm run build
```

---

## How I Want You To Work

### Before Coding
- Ask clarifying questions if anything is unclear
- Draft a short plan for complex tasks
- Confirm assumptions before writing code

### While Coding
- Write complete, working code (no placeholders, no TODOs)
- Keep code simple and readable
- Follow existing patterns in the project
- Make one logical change at a time
- Prefer backend enforcement over frontend logic

### After Coding
- Ensure code runs without errors
- Ensure permissions are enforced correctly
- Summarize what was changed and why

---

## Code Style

### Python
- Use Django best practices
- Clear variable and function names
- Small, focused functions
- No commented-out code
- No unused imports

### React
- Functional components only
- Hooks for state and lifecycle
- Descriptive component names
- One component per file
- No inline business logic (use services)

---

## Core Features

### Must Have
- Track where mail is currently stuck (current handler + time in stage)
- Complete audit trail of all changes and handlers
- Role-based access control strictly enforced on backend
- Section-based visibility for DAG roles
- Simple, clean UI focused on tracking (no document storage)

### Explicitly NOT Needed
- No priority flags or urgency levels
- No file attachments or document management
- No reporting dashboard (for now)
- No email notifications
- No external integrations

## Do Not

- Do not change the tech stack
- Do not introduce cloud services
- Do not replace SQLite
- Do not add features not requested
- Do not bypass backend permissions
- Do not expose secrets to frontend
- Do not assume scale requirements
- Do not refactor unrelated code
- Do not add document storage or file upload features
- Do not add priority/urgency fields unless explicitly requested

---

## Verification Loop

After completing a task, verify:

1. Code runs without errors
2. Backend permissions work correctly
3. UI shows correct data per role
4. Summary logic works
5. No linting errors
6. No security shortcuts
7. Changes match the request exactly

If any check fails, fix it before marking complete.

---

## Permission Logic (Critical)

### View Permissions
- **AG**: Can view ALL records across all sections
- **DAG**: Can view own section records + all records that were assigned to them at any point in history
- **SrAO/AAO**: Can view only records currently assigned to them

### Create Permissions
- **AG**: Can create mails for any section
- **DAG**: Can create mails only for their own section
- **SrAO/AAO**: Cannot create mails

### Update/Assign Permissions
- **AG**: Can assign/reassign any mail to anyone
- **DAG**: Can assign/reassign mails within their own section
- **SrAO/AAO**: Can only update status of mails assigned to them

### Close Permissions
- **AG**: Can close any mail
- **DAG**: Can close mails they're currently handling
- **SrAO/AAO**: Can close mails they're currently handling

**CRITICAL**: All permissions MUST be enforced on the backend. Frontend UI only hides/shows buttons based on role, but backend API endpoints validate permissions on every request.

---

## Important Principles

- Backend is the source of truth
- UI is convenience, not authority
- Security > Features
- Correctness > Speed
- Simplicity > Cleverness
- Laptop hosting is intentional
- SQLite is intentional
- Long-term maintainability matters
- Focus on tracking, not storing documents
- Audit trail is mandatory for accountability
- Workflow stages auto-transition based on actions

---

## Success Criteria

### Phase 1: Core Functionality (MVP)
The system will be considered successful when these functional requirements are met:

#### 1. Authentication & Authorization
- ✅ Users can log in with username/password
- ✅ JWT tokens issued and validated correctly
- ✅ Sessions expire after 24 hours (refresh tokens work for 7 days)
- ✅ Unauthorized users cannot access protected pages
- ✅ Role-based UI elements hide/show correctly
- ✅ All API endpoints enforce backend permissions

#### 2. User Management
- ✅ Admin creates users via Django admin panel with username/password
- ✅ Users have correct role (AG/DAG/SrAO/AAO) and section assignments
- ✅ Only active users appear in assignment dropdowns
- ✅ User profile displays correctly (name, role, section)

#### 3. Section Management
- ✅ Sections are pre-configured and visible in system
- ✅ Sections display correctly in mail creation form
- ✅ DAG users are correctly linked to their section(s)

#### 4. Mail Creation
- ✅ AG can create mails for any section
- ✅ DAG can create mails only for their own section(s)
- ✅ SrAO/AAO cannot access mail creation (UI hidden, API blocked)
- ✅ Serial number (sl_no) auto-generates in YYYY/NNN format
- ✅ date_received defaults to today but is editable
- ✅ All required fields validated (letter_no, subject, from_office, action_required, section, assigned_to, due_date)
- ✅ action_required dropdown shows: Review, Approve, Process, File, Reply, Other
- ✅ assigned_to dropdown filtered correctly (AG sees all, DAG sees section users)
- ✅ Status auto-set to "Received" on creation
- ✅ monitoring_officer auto-assigned based on assigned_to user's DAG
- ✅ current_handler set to assigned_to initially
- ✅ Audit trail logs mail creation with creator and timestamp

#### 5. Mail List View
- ✅ Users see mails based on role permissions:
  - AG: ALL mails
  - DAG: Own section mails + mails they've touched
  - SrAO/AAO: Only mails assigned to them + mails they've touched
- ✅ Table displays all required columns: sl_no, letter_no, subject, from_office, assigned_to, due_date, status, time_in_current_stage, current_handler, date_of_completion
- ✅ Status filter works (Received/Assigned/In Progress/Closed)
- ✅ Overdue items highlighted in RED (current_date > due_date AND status ≠ Closed)
- ✅ Time in current stage calculated and displayed correctly (e.g., "2 days 5 hours")
- ✅ Columns are sortable (at minimum: date_received, due_date, status)
- ✅ Clicking a row navigates to detail page

#### 6. Mail Detail View
- ✅ All mail information displayed correctly (read-only fields)
- ✅ Status badge shows correct color (Received=gray, Assigned=blue, In Progress=orange, Closed=green)
- ✅ Current remarks visible
- ✅ Action buttons display based on permissions:
  - Reassign: Visible to AG, DAG, current_handler
  - Close: Visible to AG, DAG (if handling), current_handler
  - Reopen: Only visible to AG for closed mails
  - Edit Remarks: Only visible to current_handler
- ✅ Audit trail shows complete history chronologically
- ✅ Audit entries include: timestamp, action type, performed by, remarks

#### 7. Reassignment Workflow
- ✅ Reassign modal opens with user dropdown and remarks field
- ✅ Remarks field is MANDATORY (cannot submit without it)
- ✅ AG can reassign to anyone
- ✅ DAG can reassign only within their section(s)
- ✅ current_handler can reassign their assigned mail
- ✅ On reassignment: current_handler updates, status moves to "In Progress"
- ✅ Audit trail logs reassignment with old/new handler and remarks

#### 8. Close/Complete Workflow
- ✅ Close modal opens with mandatory remarks field
- ✅ Cannot close without providing final remarks
- ✅ On closing: status → "Closed", date_of_completion auto-filled with current date
- ✅ Closed mails show completion date in list view
- ✅ Audit trail logs closure with final remarks

#### 9. Reopen Workflow
- ✅ Only AG can reopen closed mails
- ✅ Reopen requires mandatory remarks
- ✅ On reopening: status → "In Progress", date_of_completion cleared
- ✅ Audit trail logs reopen action with remarks

#### 10. Edit Restrictions
- ✅ Only current_handler can edit remarks field
- ✅ AG cannot edit due_date, letter_no, from_office, action_required, section, date_received after creation
- ✅ Auto-generated fields (sl_no, timestamps) are never editable
- ✅ Editing remarks updates updated_at timestamp

#### 11. Auto-Transitions
- ✅ Creating mail → status: "Received"
- ✅ Assigning mail (on creation) → status: "Assigned"
- ✅ Reassigning mail → status: "In Progress"
- ✅ Handler updates remarks → status: "In Progress" (if not already)
- ✅ Handler closes → status: "Closed"

#### 12. Audit Trail
- ✅ All CREATE actions logged
- ✅ All ASSIGN actions logged
- ✅ All REASSIGN actions logged
- ✅ All CLOSE actions logged
- ✅ All REOPEN actions logged
- ✅ Audit records include: who, when, what changed, remarks
- ✅ Audit records are immutable (no edit/delete capability)

#### 13. PDF Export
- ✅ Export button visible on mail list page
- ✅ Exports currently filtered/visible mails
- ✅ PDF includes all table columns
- ✅ PDF filename: Mail_Tracker_Report_YYYY-MM-DD.pdf
- ✅ PDF formatting is readable and professional

### Phase 2: Performance & UX
These criteria ensure the system is usable and performant:

#### 14. Performance
- ✅ Mail list loads within 2 seconds (for up to 1000 records)
- ✅ Mail detail page loads within 1 second
- ✅ API responses return within 500ms for standard queries
- ✅ No UI freezing or lag during normal operations
- ✅ PDF export completes within 5 seconds (for up to 100 records)

#### 15. User Experience
- ✅ Forms provide clear validation error messages
- ✅ Success messages display after create/update/reassign/close actions
- ✅ Loading indicators show during API calls
- ✅ Responsive design works on laptop screens (1366x768 minimum)
- ✅ Keyboard navigation works for forms
- ✅ Date pickers are easy to use
- ✅ Dropdowns are searchable (for user selection)

#### 16. Data Integrity
- ✅ No duplicate sl_no values
- ✅ Serial numbers reset correctly each year
- ✅ monitoring_officer correctly assigned based on logic
- ✅ status transitions follow defined rules
- ✅ date_of_completion only populated when status = Closed
- ✅ Timestamps (created_at, updated_at) accurate
- ✅ No orphaned records (all FKs valid)

### Phase 3: Security & Deployment
These criteria ensure the system is secure and production-ready:

#### 17. Security
- ✅ Passwords hashed (never stored in plain text)
- ✅ SQL injection protected (using Django ORM)
- ✅ XSS protection enabled
- ✅ CSRF protection enabled for state-changing operations
- ✅ JWT tokens validated on every protected endpoint
- ✅ No sensitive data in frontend localStorage (only JWT token)
- ✅ API returns 403 Forbidden for unauthorized access attempts
- ✅ No permission bypass possible from frontend manipulation

#### 18. Deployment
- ✅ Django backend runs on 0.0.0.0:8000 (accessible on LAN)
- ✅ React frontend accessible via browser on LAN
- ✅ Database file (db.sqlite3) created and functional
- ✅ Initial AG superuser created successfully
- ✅ Sample sections imported
- ✅ Sample users imported with correct roles and sections
- ✅ System survives server restart (data persists)

#### 19. Error Handling
- ✅ Backend API returns proper HTTP status codes (200, 201, 400, 403, 404, 500)
- ✅ Frontend displays user-friendly error messages
- ✅ Network errors handled gracefully (timeout, no connection)
- ✅ 404 page shows for invalid routes
- ✅ 403 page shows for unauthorized access
- ✅ Django admin logs errors for debugging

### Final Acceptance Criteria
The system is considered COMPLETE when:

1. ✅ All Phase 1 functional requirements met (items 1-13)
2. ✅ All Phase 2 performance/UX requirements met (items 14-16)
3. ✅ All Phase 3 security/deployment requirements met (items 17-19)
4. ✅ User acceptance testing completed with AG, DAG, and SrAO/AAO roles
5. ✅ No critical bugs or security vulnerabilities identified
6. ✅ System runs continuously for 24 hours without crashes
7. ✅ All role-based permissions verified with real user accounts
8. ✅ Audit trail tested and verified for all major actions
9. ✅ PDF export tested with various filter combinations
10. ✅ Documentation complete (user guide, API docs, deployment guide)

---

## Cloud Deployment Guide

### Production Deployment Architecture

The application can be deployed to cloud platforms while maintaining free tier usage:

- **Backend**: Render (Django + PostgreSQL)
- **Frontend**: Vercel (React/Vite)
- **Database**: PostgreSQL on Render (free tier)

### Backend Deployment (Render)

#### Key Files Required

1. **render.yaml** - Blueprint configuration
```yaml
services:
  - type: web
    name: mail-tracker-backend
    runtime: python
    rootDir: backend
    buildCommand: "./build.sh"
    startCommand: "gunicorn config.wsgi:application"
    envVars:
      - key: PYTHON_VERSION
        value: 3.11
      - key: SECRET_KEY
        generateValue: true
      - key: DEBUG
        value: False
      - key: DATABASE_URL
        fromDatabase:
          name: mail-tracker-db
          property: connectionString

databases:
  - name: mail-tracker-db
    databaseName: mail_tracker
    user: mail_tracker_user
    plan: free
```

2. **backend/build.sh** - Build script
```bash
#!/usr/bin/env bash
set -o errexit

# Install Python dependencies
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --no-input

# Run database migrations
python manage.py migrate

# Create superuser if it doesn't exist
echo "Creating superuser if needed..."
python create_superuser.py
```

3. **backend/create_superuser.py** - Auto-create admin user
```python
#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

if not User.objects.filter(is_superuser=True).exists():
    print("Creating superuser...")
    User.objects.create_superuser(
        username='admin',
        email='admin@office.gov',
        password='admin123',  # CHANGE THIS PASSWORD AFTER FIRST LOGIN!
        full_name='System Administrator',
        role='AG'
    )
    print("✅ Superuser 'admin' created successfully!")
else:
    print("ℹ️  Superuser already exists. Skipping creation.")
```

4. **backend/requirements.txt** - Must include production dependencies:
```
Django>=5.0,<6.0
djangorestframework>=3.14.0
djangorestframework-simplejwt>=5.3.0
django-cors-headers>=4.3.0
pytz>=2024.1
python-dateutil>=2.8.2
whitenoise>=6.6.0
gunicorn>=21.2.0
psycopg2-binary>=2.9.9
dj-database-url>=2.1.0
```

#### Django Settings Configuration

**backend/config/settings.py** must use environment variables:

```python
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Environment-based configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-fallback-key')
DEBUG = os.environ.get('DEBUG', 'False') == 'True'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Database - uses PostgreSQL on Render, SQLite locally
import dj_database_url

DATABASES = {
    'default': dj_database_url.config(
        default=f'sqlite:///{BASE_DIR / "db.sqlite3"}',
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# CORS - allow frontend domain
CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://localhost:5173,http://localhost:5174'
).split(',')

# Static files with WhiteNoise
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Must be after SecurityMiddleware
    'corsheaders.middleware.CorsMiddleware',
    # ... other middleware
]

STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
```

#### Deployment Steps

1. **Create Render account** and connect GitHub repository
2. **Set Root Directory** in Render dashboard:
   - Go to Settings → Root Directory: `backend`
3. **Set Build Command**:
   - `chmod +x build.sh && ./build.sh`
4. **Set Start Command**:
   - `gunicorn config.wsgi:application` (no --chdir needed with rootDir)
5. **Add Environment Variables**:
   - `ALLOWED_HOSTS`: `your-app.onrender.com,.onrender.com`
   - `CORS_ALLOWED_ORIGINS`: `https://your-frontend.vercel.app`
   - `DEBUG`: `False` (only set to `True` for debugging)
6. **Deploy** and verify in logs:
   - "163 static files copied to 'staticfiles'" ✅
   - "Running migrations..." ✅
   - "Creating superuser if needed..." ✅

#### Common Issues and Fixes

**Issue 1: 500 Error on Admin Page**
- **Cause**: Build script not running, static files missing
- **Fix**: Ensure Build Command is `chmod +x build.sh && ./build.sh`
- **Verify**: Check logs for "163 static files copied"

**Issue 2: ALLOWED_HOSTS Error**
- **Cause**: Missing or incorrect ALLOWED_HOSTS environment variable
- **Fix**: Add `ALLOWED_HOSTS=your-app.onrender.com,.onrender.com` in Render Environment
- **Verify**: Check logs for "Invalid HTTP_HOST header" errors

**Issue 3: Database Not Migrating**
- **Cause**: build.sh not running or missing permissions
- **Fix**: Ensure build.sh is executable and in correct directory
- **Verify**: Check logs for "Running migrations" output

**Issue 4: Static Files Warning**
- **Cause**: collectstatic not running in build
- **Fix**: Ensure build.sh includes `python manage.py collectstatic --no-input`
- **Verify**: No warning "No directory at: .../staticfiles/"

### Frontend Deployment (Vercel)

#### Key Files Required

1. **frontend/vercel.json** - Vercel configuration
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

2. **frontend/.env.production** - Production API URL
```env
VITE_API_BASE_URL=https://your-backend.onrender.com/api
```

3. **frontend/src/utils/constants.js** - Environment variable support
```javascript
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
```

#### Deployment Steps

1. **Update .env.production** with actual Render backend URL
2. **Commit and push** changes to GitHub
3. **Create Vercel account** and import project from GitHub
4. **Set Root Directory**: `frontend`
5. **Framework Preset**: Vite (auto-detected)
6. **Deploy** automatically
7. **Update Backend CORS**:
   - Go to Render → Environment
   - Update `CORS_ALLOWED_ORIGINS` to include Vercel URL
   - Redeploy backend

### Critical Deployment Principles

1. **Build Command Must Run Full Script**
   - Don't manually set `pip install -r requirements.txt`
   - Always use `chmod +x build.sh && ./build.sh`
   - Verify in logs that all steps execute

2. **Root Directory Matters**
   - If `rootDir: backend`, commands run from backend/
   - build.sh must be in backend/ directory
   - Don't use `cd backend` in scripts when rootDir is set

3. **Environment Variables Are Critical**
   - Always set `ALLOWED_HOSTS` for your domain
   - `DEBUG=False` in production (set to True only for debugging)
   - `SECRET_KEY` auto-generated by Render
   - `DATABASE_URL` auto-injected from PostgreSQL

4. **Static Files Must Be Collected**
   - `collectstatic` must run in build phase
   - Verify "163 static files copied" in logs
   - WhiteNoise serves static files (no separate server needed)

5. **Database Auto-Migrates**
   - Migrations run automatically via build.sh
   - PostgreSQL on Render (production)
   - SQLite locally (development)
   - No manual migration needed

6. **Superuser Auto-Creates**
   - create_superuser.py runs in build
   - Default: username=admin, password=admin123
   - **MUST CHANGE PASSWORD** after first login!

### Post-Deployment Checklist

- ✅ Backend /admin/ loads with styling
- ✅ Backend /api/ returns 401 (auth required)
- ✅ Admin login works (admin/admin123)
- ✅ Frontend loads from Vercel URL
- ✅ Frontend can call backend APIs
- ✅ No CORS errors in browser console
- ✅ Change admin password immediately
- ✅ Test create/update/delete operations
- ✅ Verify audit trail logging works
- ✅ Check role-based permissions

### Free Tier Limitations

**Render Free Tier:**
- Web service sleeps after 15 minutes of inactivity
- First request after sleep takes ~30 seconds (cold start)
- PostgreSQL free tier expires after 90 days (backup data!)
- 750 hours/month free compute

**Vercel Free Tier:**
- 100 GB bandwidth/month
- Unlimited deployments
- No cold starts (always fast)

### Maintenance

1. **PostgreSQL Backup** (CRITICAL - expires in 90 days):
   ```bash
   python manage.py dumpdata --natural-foreign --natural-primary \
     -e contenttypes -e auth.Permission --indent 2 -o backup.json
   ```

2. **Password Change** (immediately after deployment):
   - Login to /admin/
   - Go to Users → admin
   - Change password from admin123

3. **Monitor Logs**:
   - Render: Dashboard → Logs
   - Vercel: Dashboard → Deployments → Function Logs

---
