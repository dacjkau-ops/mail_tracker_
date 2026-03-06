# Django Admin User Management Guide

## Admin URL
- `http://127.0.0.1:8000/admin/`

## Current Roles
- `AG`
- `DAG`
- `SrAO`
- `AAO`
- `auditor`
- `clerk`

## Add Single User (Admin)
1. Go to `Users` in Django admin.
2. Click `Add user`.
3. Set `username` + password.
4. Save and continue.
5. Fill:
- `full_name`
- `email` (unique)
- `role`
- `sections` (for DAG)
- `subsection` (for SrAO/AAO/clerk)
- `auditor_subsections` (for auditor)

## Bulk Import Users (CSV/JSON)
1. Go to `Users`.
2. Click `Import Users (CSV/JSON)`.
3. Upload file.

Required columns:
- `username`
- `email`
- `password`
- `full_name`
- `role`

Optional columns:
- `sections` (comma-separated, DAG)
- `subsection` (SrAO/AAO/clerk, use `Section - Subsection` or unique subsection name)
- `auditor_subsections` (auditor, comma-separated subsection values)

Notes:
- Import is optimized for large files using bulk create.
- `SRAO` is normalized to `SrAO`.
- Existing usernames are skipped.

## Signup Request Workflow (New)
Public signup does not create active users directly.

Endpoints:
- `POST /api/auth/signup/`
- `GET /api/auth/signup-metadata/`

Behavior:
- Creates `SignupRequest` with status `pending`.
- Only superuser can approve/reject in Django admin.
- Superuser can edit requested role/section/subsection before approval.

Signup constraints:
- Allowed roles: `SrAO`, `AAO`, `auditor`, `clerk`
- Blocked email domains: `gmail.com`, `hotmail.com`, `nic.in`

## Visibility Rules (Important)
- AG: all records.
- DAG: managed section scope only.
- SrAO/AAO/clerk: own subsection scope only.
- auditor: configured auditor subsection scope only.
- Historical/touched visibility fallback is not used for non-AG roles.

## Reset Data (Admin)
- In `Users` admin changelist, use `Delete All Data` for clean reset.
- Deletes operational data and non-superuser users.
- Keeps superusers to prevent admin lockout.
