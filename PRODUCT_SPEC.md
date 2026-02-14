# Mail Tracker Product Spec (Canonical)

This file is the canonical runtime spec for implementation and QA.  
If `CLAUDE.md` conflicts with this file, follow this file.

## Scope

- Secure, role-based office mail workflow tracking.
- Focus: current handler visibility, stage duration, reassignment trail, closure accountability.
- No attachments, no external integrations, no priority flags.

## Roles and Permissions

1. AG
- Can view all records.
- Can create records.
- Can reassign any record.
- Can close any record.
- Can reopen closed records.

2. DAG
- Cannot create records.
- Can view records in managed sections plus records touched/assigned through history rules.
- Can reassign only within managed sections.
- Can close only when current handler.

3. SrAO/AAO
- Cannot create records.
- Can view records assigned/handled/touched per backend rules.
- Can update current action when current handler.
- Can close only when current handler.

All permissions are enforced in backend APIs.

## Workflow States

State labels:
- `Received`
- `Assigned`
- `In Progress`
- `Closed`

Practical transition behavior used in this codebase:
- Create + assign flow lands in `Assigned`.
- First active work update/reassign moves to `In Progress`.
- Close action moves to `Closed` and sets completion metadata.
- Reopen moves back to `In Progress`.

## Deployment

- Frontend: Vercel
- Backend: Render web service
- Database: external managed PostgreSQL (durable, non-expiring free-tier trial behavior avoided)

## Security and Storage

- JWT auth required for API access (except health endpoint).
- Frontend local storage keeps tokens only.
- User profile is fetched from backend (`/api/users/me/`) after token validation.

## Operational Requirements

- `/api/health/` must return service + DB health.
- Slow requests must be logged above configured threshold.
- Backups must be possible with `pg_dump`/`psql` scripts.
