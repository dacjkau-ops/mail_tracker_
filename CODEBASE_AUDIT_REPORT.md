# Codebase Audit Report

Date: 2026-03-23
Scope: full repository walk-through, runtime wiring, test/dev setup, deletion review
Codemap used: `MAP.md`

## Executive Summary

The production application lives in:
- `backend/` for Django API + admin + database schema
- `frontend/` for the React/Vite UI
- `nginx/` for the Docker reverse-proxy path
- `render.yaml` and `docker-compose.yml` for deployment/runtime orchestration

The codebase also contains a large amount of non-runtime material:
- historical test reports and plans
- stale one-off backend scripts
- local-machine artifacts and generated folders
- leftover Vite starter files

The test/dev module is **not** in a healthy state:
- canonical Django tests do not start in the checked-in local venv
- frontend production build works, but lint fails
- there is no frontend automated test runner
- several ad hoc test scripts are stale and no longer match the current schema/API

## Critical Findings

1. `render.yaml` contains plaintext Cloudflare R2 credentials.
   Impact: secret exposure risk; these should be rotated and removed from source.

2. `backend/users/admin.py` reset-all-data logic assumes filesystem-backed attachments and uses `attachment.file.path`.
   Impact: with current R2/S3 storage this can fail in production admin flows.

3. `frontend/src/pages/MailListPage.jsx` applies subsection filtering only on the already paginated page result.
   Impact: AG/DAG users can get incomplete or misleading filtered lists.

4. The checked-in local venv is drifted/broken for testing.
   Observed state:
   - `backend/requirements.txt` requires `dj-database-url`
   - `backend/venv` does not have it installed
   - `manage.py test` fails before any tests run

## Runtime Folders

| Path | Used by | Importance | Delete? | Notes |
|---|---|---|---|---|
| `backend/` | production backend, dev backend | Critical | No | Main Django app. |
| `frontend/` | production frontend, dev frontend | Critical | No | Main React app. |
| `nginx/` | Docker deployment path | Important if using Docker/nginx | No if Docker path stays | Needed for `docker-compose.yml`. |
| `docs/` | ops documentation | Dev/ops only | Keep | Small and useful. |
| `.git/` | Git metadata | Dev only | No unless destroying repo | Not app code. |
| `.claude/` | local assistant metadata | Dev only | Yes, safe local delete | Ignored by git. |
| `.planning/` | local planning metadata | Dev only | Yes, safe local delete | Ignored by git. |

## Top-Level Files

### Keep

| File | Role | Dev/Prod | Delete? | Notes |
|---|---|---|---|---|
| `.env.example` | env template | Dev/ops | No | Good template for setup. |
| `.gitignore` | ignore rules | Dev | No | Correctly ignores local junk like `backend/venv`, `users.csv`, `.claude/`. |
| `CLAUDE.MD` | active engineering instructions | Dev | Keep if still used | Referenced by docs and workflow. |
| `MAP.md` | active codemap | Dev | Keep | Useful and current enough to navigate. |
| `PRODUCT_SPEC.md` | canonical product/runtime spec | Dev | Keep | Treated as source-of-truth by `CLAUDE.MD`. |
| `RETURNS.md` | returns module design note | Dev | Keep | Explains returns architecture. |
| `docker-compose.yml` | local/container deployment | Dev/ops | No | Valid runtime config. |
| `render.yaml` | Render deployment blueprint | Prod/ops | No, but sanitize | Keep after removing secrets. |

### Keep, But Dev-Only

| File | Role | Delete? | Notes |
|---|---|---|---|
| `start_servers.ps1` | convenience launcher | Optional | Works only on this machine path; rewrite if you want it portable. |
| `USER_MANAGEMENT_GUIDE.md` | admin guide | Optional | Still useful. |
| `docs/operations/db-provider-migration.md` | Postgres migration runbook | No | Useful ops doc. |

### Likely Redundant / Historical Docs

These are not runtime files. Keep only if you want historical audit trails.

| File | Recommendation | Why |
|---|---|---|
| `API_TEST_REPORT.md` | Archive/delete if no longer needed | Historical report, not executable. |
| `FINAL_TEST_REPORT.md` | Archive/delete if no longer needed | Historical report. |
| `TEST_REPORT_P0.md` | Archive/delete if no longer needed | Historical report. |
| `VERIFICATION_STATUS.md` | Archive/delete if no longer needed | Status snapshot, not authoritative. |
| `SETUP_COMPLETE.md` | Archive/delete if no longer needed | Historical setup note. |
| `LEARNINGS.md` | Keep only if actively read | Knowledge note, not runtime. |
| `TEST_PLAN.md` | Keep only if actively maintained | Large plan, but current execution does not match it. |
| `TROUBLESHOOTING.md` | Review or archive | Contains stale claim that backend tests pass. |

### Safe To Delete Now

| File | Why |
|---|---|
| `build.sh` | Stale duplicate. Actual deployment uses `backend/build.sh`; this root script is not referenced by runtime config. |
| `1.txt` | Empty untracked file. |
| `minio.exe` | Untracked local binary; no repository references found. |
| `test.jpg` | Local reference artifact only. |
| `test_2.jpg` | Local reference artifact only. |
| `test.txt` | Raw plan artifact referenced only by a test comment. |
| `users.csv` | Ignored local data dump/import file. |

### Already Deleted In Worktree

| File | Note |
|---|---|
| `renderdb.jpg` | Already deleted from the worktree; appears to be a historical artifact. |

## Backend Folder Audit

### `backend/config/`

| Path | Status | Delete? | Notes |
|---|---|---|---|
| `settings.py` | Keep | No | Core runtime config. Current code hard-requires R2 storage. |
| `urls.py` | Keep | No | API routing entrypoint. |
| `views.py` | Keep | No | Health endpoint. |
| `permissions.py` | Keep | No | Core backend authorization logic. |
| `middleware.py` | Keep | No | Slow-request logging middleware. |
| `asgi.py`, `wsgi.py`, `__init__.py` | Keep | No | Standard Django entrypoints/package markers. |

### `backend/users/`

| Group | Status | Delete? | Notes |
|---|---|---|---|
| `models.py`, `serializers.py`, `views.py` | Keep | No | Core auth/user/signup logic. |
| `admin.py` | Keep, but fix | No | Important admin/import tooling; `reset_all_data` is not R2-safe. |
| `import_jobs.py` | Keep | No | Used by background admin import flow. |
| `management/commands/*.py` | Keep | Mostly no | `bootstrap_system`, `ensure_superuser`, `import_users_file` are useful. `populate_data.py` is only a backward-compatible alias and could be dropped if nobody uses it. |
| `templates/admin/users/user/*.html` | Keep | No | Used by custom admin import/reset UI. |
| `migrations/*.py` | Keep | No | Required for schema history and fresh deployments. |
| `tests.py` | Keep | No | Useful tests for user import jobs. |
| `apps.py`, `__init__.py`, `management/__init__.py`, command `__init__.py`, migrations `__init__.py` | Keep | No | Framework glue. |

### `backend/sections/`

| Group | Status | Delete? | Notes |
|---|---|---|---|
| `models.py`, `serializers.py`, `views.py`, `admin.py` | Keep | No | Core section hierarchy and admin import tooling. |
| `management/commands/import_sections_file.py` | Keep | No | Useful bootstrap/import command. |
| `templates/admin/sections/section/*.html` | Keep | No | Needed by custom admin import button/page. |
| `migrations/*.py` | Keep | No | Schema history. |
| `tests.py` | Placeholder only | Optional | Currently empty; either add tests or delete placeholder. |
| `apps.py`, `__init__.py`, command `__init__.py`, management `__init__.py`, migrations `__init__.py` | Keep | No | Framework glue. |

### `backend/records/`

| Group | Status | Delete? | Notes |
|---|---|---|---|
| `models.py`, `serializers.py`, `views.py`, `admin.py` | Keep | No | Core mail workflow and PDF handling. |
| `migrations/*.py` | Keep | No | Critical schema history. |
| `tests.py` | Keep | No | Main backend functional test coverage. |
| `apps.py`, `__init__.py`, migrations `__init__.py` | Keep | No | Framework glue. |

### `backend/audit/`

| Group | Status | Delete? | Notes |
|---|---|---|---|
| `models.py`, `serializers.py`, `views.py`, `admin.py` | Keep | No | Production audit trail feature. |
| `migrations/*.py` | Keep | No | Schema history. |
| `tests.py` | Placeholder only | Optional | Empty placeholder. |
| `apps.py`, `__init__.py`, migrations `__init__.py` | Keep | No | Framework glue. |

### `backend/returns/`

| Group | Status | Delete? | Notes |
|---|---|---|---|
| `models.py`, `serializers.py`, `views.py`, `services.py`, `admin.py` | Keep | No | Production returns module. |
| `templates/admin/returns/returndefinition/*.html` | Keep | No | Admin import UI. |
| `migrations/*.py` | Keep | No | Schema history. |
| `tests.py` | Keep | No | Useful returns coverage. |
| `apps.py`, `__init__.py`, migrations `__init__.py` | Keep | No | Framework glue. |

### `backend/sample_data/`

| File | Status | Delete? | Notes |
|---|---|---|---|
| `sections_sample.csv`, `sections_sample.json` | Keep | No | Useful import/bootstrap templates. |
| `README.md` | Keep | Optional | Helpful onboarding note. |

### `backend/scripts/`

| File | Status | Delete? | Notes |
|---|---|---|---|
| `export_postgres_backup.sh` | Keep | No | Useful ops script. |
| `import_postgres_backup.sh` | Keep | No | Useful ops script. |

### `backend/` Root Files

| File | Recommendation | Why |
|---|---|---|
| `manage.py` | Keep | Django entrypoint. |
| `Dockerfile` | Keep | Production/container build path. |
| `build.sh` | Keep | Actual backend build script used by Render. |
| `entrypoint.sh` | Keep | Actual container runtime entrypoint. |
| `requirements.txt` | Keep | Dependency spec. |
| `create_superuser.py` | Keep only if deployment still calls it | Thin wrapper around `ensure_superuser`. |
| `api_tests.py` | Delete/archive | Ad hoc script, not part of canonical tests, depends on seeded local data. |
| `security_tests.py` | Delete/archive | Ad hoc script, uses outdated assumptions and manual prints. |
| `test_ag_workflow.py` | Delete/archive | Stale script; references removed fields like `remarks` and old user relationships. |
| `test_mail_functionality.py` | Delete/archive | Stale ad hoc script and inaccurate permission assumptions. |
| `test_visibility.py` | Delete/archive | Stale script; references removed `user.section` logic. |
| `setup_users.py` | Delete/archive | Stale bootstrap script based on old schema (`section` on user). |
| `check_data.py` | Delete/archive | Broken against current schema (`u.section`). |
| `cleanup_db.py` | Delete/archive | Dangerous one-off destructive script; redundant with admin reset flow. |

### Generated / Local Backend Directories

| Path | Delete? | Notes |
|---|---|---|
| `backend/venv/` | Yes, safe local delete | Ignored local venv; huge and not source. |
| `backend/__pycache__/` | Yes | Generated. |
| `backend/staticfiles/` | Yes | Generated collectstatic output. |
| `backend/pdfs/` | Yes if not storing local dev data you need | Local/generated storage directory. |

## Frontend Folder Audit

### Core Runtime Files

| Group | Status | Delete? | Notes |
|---|---|---|---|
| `src/main.jsx`, `src/App.jsx` | Keep | No | Frontend entrypoints. |
| `src/context/AuthContext.jsx` | Keep, but lint-clean | No | Core auth state; contains lint issues and an unused `clearAuth`. |
| `src/services/api.js`, `authService.js`, `mailService.js`, `returnsService.js` | Keep | Mostly no | Runtime API layer. `mailService.js` has some dead helper methods. |
| `src/layouts/MainLayout.jsx`, `ReturnsLayout.jsx` | Keep | No | Runtime layouts. |
| `src/pages/*.jsx` | Keep | No | Main screens for login, signup, mail tracker, returns. |
| `src/components/*.jsx` | Keep | No | Dialog/action components used by detail pages. |
| `src/utils/dateHelpers.js`, `pdfExport.js`, `constants.js` | Keep, but prune | Mostly no | `constants.js` exports some unused constants. |
| `package.json`, `package-lock.json`, `vite.config.js`, `eslint.config.js`, `index.html`, `.env.development`, `.env.production`, `vercel.json`, `.gitignore` | Keep | No | Standard frontend config. |

### Safe To Delete Now

| File | Why |
|---|---|
| `frontend/src/App.css` | Unused Vite starter CSS. |
| `frontend/src/assets/react.svg` | Unused Vite starter asset. |

### Delete Only If You Also Update One Reference

| File | Why |
|---|---|
| `frontend/public/vite.svg` | Used only as the favicon in `frontend/index.html`. Safe if you remove or replace that line. |

### Generated / Local Frontend Directories

| Path | Delete? | Notes |
|---|---|---|
| `frontend/dist/` | Yes | Generated build output. |
| `frontend/node_modules/` | Yes if you want to reinstall later | Local dependency cache; not source. |

### Frontend Redundancy / Dead Code

- `frontend/src/services/mailService.js`
  - `updateRemarks`
  - `getAssignments`
  - `updateAssignmentRemarks`
  - `completeAssignment`
  - `revokeAssignment`
  - `completeAssignmentViaRecord`

  These methods have no current callers in `frontend/src/`. If there is no external consumer plan, remove them.

- `frontend/src/utils/constants.js`
  - `ROLES`
  - `AUDIT_ACTIONS`

  Exported but unused in current frontend code.

## Testing / Dev Module Assessment

### Current State

Verdict: **not perfect**

### Evidence

1. Backend canonical tests do not run in the checked-in dev environment.
   - `manage.py test` failed immediately because `dj_database_url` was missing from `backend/venv`.

2. Frontend has no automated test runner.
   - `frontend/package.json` contains `dev`, `build`, `lint`, `preview`, but no `test` script or test framework.

3. Frontend lint fails.
   - `npm run lint` reported 7 errors and 4 warnings.
   - Main issues: unused variables, React refresh rule violation, missing hook dependencies.

4. Frontend production build succeeds.
   - `npm run build` completed successfully.
   - Bundle warning: main JS chunk is large (~1.3 MB minified).

5. Backend test coverage is uneven.
   - `backend/records/tests.py`: active
   - `backend/returns/tests.py`: active
   - `backend/users/tests.py`: active
   - `backend/audit/tests.py`: empty placeholder
   - `backend/sections/tests.py`: empty placeholder

6. Ad hoc scripts are not reliable as a test strategy.
   - `test_runner.py` claims “178 P0 tests” but is a manual live-server script, not integrated into Django test running.
   - multiple backend root test scripts depend on seeded local data and outdated schema fields.

### Recommendation

- Keep and fix:
  - `backend/records/tests.py`
  - `backend/returns/tests.py`
  - `backend/users/tests.py`

- Add/repair:
  - `backend/audit/tests.py`
  - `backend/sections/tests.py`
  - a real frontend test stack (`Vitest` or `Playwright`, depending desired depth)

- Delete/archive the stale ad hoc scripts once their useful scenarios are moved into real tests.

## Final Delete Recommendations

### Safe To Delete Immediately

- `.claude/`
- `.planning/`
- `backend/venv/`
- `backend/__pycache__/`
- `backend/staticfiles/`
- `frontend/dist/`
- `frontend/src/App.css`
- `frontend/src/assets/react.svg`
- `1.txt`
- `minio.exe`
- `test.jpg`
- `test_2.jpg`
- `test.txt`
- `users.csv`
- `backend/api_tests.py`
- `backend/security_tests.py`
- `backend/test_ag_workflow.py`
- `backend/test_mail_functionality.py`
- `backend/test_visibility.py`
- `backend/setup_users.py`
- `backend/check_data.py`
- `backend/cleanup_db.py`
- old report docs if you do not need historical records

### Delete After Small Follow-Up Change

- `frontend/public/vite.svg`
  - remove/replace favicon reference in `frontend/index.html`

- `build.sh`
  - delete after confirming nobody runs it manually; runtime deployment already uses `backend/build.sh`

- `backend/users/management/commands/populate_data.py`
  - delete if no external automation still calls this alias

### Keep

- all Django app source files under `backend/users`, `backend/sections`, `backend/records`, `backend/audit`, `backend/returns`
- all migrations
- all admin templates
- all deployment/runtime config files that match your chosen deployment path
- `MAP.md`, `PRODUCT_SPEC.md`, `CLAUDE.MD`

## Practical Cleanup Order

1. Remove leaked secrets from `render.yaml` and rotate them.
2. Fix `reset_all_data` for R2 storage.
3. Fix backend dev env or delete the checked-in venv and recreate from `requirements.txt`.
4. Fix frontend lint errors.
5. Delete stale scripts and historical junk files.
6. Add real frontend tests and fill the empty backend test modules.
