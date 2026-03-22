# Returns Module Notes

This file documents the `Calendar of Returns` implementation that is being added beside the mail tracker.

## Goal

Add a separate returns-compliance module without disturbing the existing mail tracker.

Shared pieces:
- same login and JWT auth
- same `User` model
- same `Section` and `Subsection` hierarchy

Independent pieces:
- separate Django app: `backend/returns/`
- separate frontend routes under `/returns`
- separate post-login module selector page under `/apps`

## Why This Structure

### Why a new Django app

I am putting this in a new app because the feature is not a mail record.
It has different concepts:
- report master definitions
- section applicability
- month snapshots
- submission history
- delay summaries

If this were forced into `records/`, the mail workflow and returns workflow would become coupled and harder to maintain.

### Why a period-entry snapshot table

The master list can change later.
History should not change when the master changes.

That is why the implementation stores month-wise snapshots in `ReturnPeriodEntry`:
- report name snapshot
- frequency snapshot
- due day snapshot
- due date
- submitted date
- submitted by
- delay days

This preserves historical truth.

### Why a module selector after login

The user asked for one shared login with two module icons.
That is implemented as:
- `/apps` for the selector
- `/mails` for mail tracker
- `/returns` for returns

This keeps navigation explicit and avoids making the mail dashboard pretend to own the returns module.

## Backend Design

Files added:
- `backend/returns/models.py`
- `backend/returns/services.py`
- `backend/returns/serializers.py`
- `backend/returns/views.py`
- `backend/returns/admin.py`
- `backend/returns/migrations/0001_initial.py`

### Data Model

#### `ReturnDefinition`

Master report record.

Fields:
- `code`
- `name`
- `description`
- `frequency`
- `active`

#### `ReturnApplicability`

Maps a report to a section and schedule.

Fields:
- `return_definition`
- `section`
- `due_day`
- `applicable_months`
- `active`

Examples:
- monthly: months can be blank
- quarterly: `3,6,9,12`
- annual: `4`

#### `ReturnPeriodEntry`

Month-wise generated snapshot.

Fields:
- `return_definition`
- `applicability`
- `section`
- `year`
- `month`
- `report_code_snapshot`
- `report_name_snapshot`
- `frequency_snapshot`
- `due_day_snapshot`
- `due_date`
- `status`
- `submitted_at`
- `submitted_by`
- `delay_days`

This is the main runtime table used by dashboard and history.

#### `ReturnStatusLog`

Submission audit log.

Current action tracked:
- `submitted`

### Service Layer

`backend/returns/services.py` exists to keep the view logic small and predictable.

Main responsibilities:
- resolve visible sections by role
- resolve which sections a user can submit for
- normalize year/month input
- lazily generate month entries from active master rules

### Lazy Entry Generation

Entries are not pre-created for every month in advance.

Instead, when the dashboard or history is opened:
1. determine requested year/month
2. determine visible sections
3. generate missing `ReturnPeriodEntry` rows for that month if needed
4. return pending/history data

Why this approach:
- no scheduler dependency
- less operational complexity
- easy to reason about

## Role Rules Implemented

### View

- `AG`: all sections
- `DAG`: managed sections
- `AAO`: own section
- `SrAO`: own section, view only
- `auditor`: configured auditor section scope
- `clerk`: own section, view only

### Submit

Only:
- `AAO`
- `auditor`

Actual click time is stored in `submitted_at`.

## Admin and CSV Import

Admin entry point:
- Django admin -> Returns -> Return definitions -> `Import Returns Master`

CSV columns:
- required: `report_code`, `report_name`, `frequency`, `section_name`, `due_day`
- optional: `applicable_months`, `active`, `description`

Example:

```csv
report_code,report_name,frequency,section_name,due_day,applicable_months,active,description
ITA,ITA Report,monthly,ALL,7,,true,Common report for all sections
SMU,SMU Report,monthly,ALL,10,,true,
IR,IR Report,quarterly,IR,15,"3,6,9,12",true,Quarterly return
ANNUAL_A,Annual Return,annual,AMG-I,30,"4",true,Annual filing
```

Import behavior:
- creates or updates report definitions by `report_code`
- creates or updates section mappings by `(report, section)`
- does not delete missing old rows automatically

That last point is intentional. It is safer for existing data.
If you need to stop a return, deactivate it in admin.

## Frontend Design

Files added:
- `frontend/src/pages/AppSelectorPage.jsx`
- `frontend/src/layouts/ReturnsLayout.jsx`
- `frontend/src/pages/ReturnsDashboardPage.jsx`
- `frontend/src/pages/ReturnsHistoryPage.jsx`
- `frontend/src/services/returnsService.js`

Files updated:
- `frontend/src/App.jsx`
- `frontend/src/pages/LoginPage.jsx`
- `frontend/src/layouts/MainLayout.jsx`

### Route Structure

- `/apps`
- `/mails`
- `/returns`
- `/returns/history`

### Why separate layout for returns

The mail top bar is mail-specific.
Returns now has its own layout and app bar so both modules can evolve independently.

### Dashboard behavior

`/returns` shows:
- current month pending entries
- summary cards
- section overview for `AG` and `DAG`
- submit button only for `AAO` and `auditor`

When all entries are submitted:
- pending list becomes empty
- page shows a completed state
- archive remains available in history

### History behavior

`/returns/history` shows:
- month archive
- processed date
- processed by
- delay days
- multi-month delay summary

## If You Had To Build This Yourself

Do it in this order.

1. Create a separate Django app.
   Reason: keep the feature isolated from mail tracking.

2. Model the master data first.
   Add report definitions and applicability rules before any UI work.

3. Add a snapshot table for month history.
   Do not compute everything live from the master or you will lose historical accuracy.

4. Write section-scope helpers.
   Reuse the existing user/section hierarchy instead of inventing a second access model.

5. Add read APIs before submit APIs.
   First make sure the right users can see the right month/section data.

6. Add the submit action with strict backend validation.
   UI can hide buttons, but backend must enforce role and section scope.

7. Add admin import and manual admin editing.
   Initial bulk load plus future maintenance both matter.

8. Add the frontend routes and pages.
   Only after the backend contracts are stable.

9. Add verification.
   Test monthly, quarterly, annual generation and role restrictions.

## What To Check While Extending It

If you add a new report rule:
- confirm the section exists
- confirm the frequency is right
- confirm `applicable_months` is set for quarterly/annual items

If you add a new API:
- check visible section scope first
- then check submit permission separately

If you add new workflow actions:
- keep them in `ReturnStatusLog`
- do not overwrite history silently

If you add a new UI page:
- keep it under `/returns`
- do not mix it into mail pages unless the user explicitly asks for a unified dashboard

## Current Implementation Status

Implemented:
- separate backend app
- models and migration
- admin import
- dashboard API
- history API
- delay summary API
- submit API
- module selector page
- returns layout
- returns dashboard page
- returns history page

Still worth hardening further after this base:
- more backend tests
- richer analytics cards
- optional in-app admin UI beyond Django admin
- optional per-entry detailed log modal if submission history becomes more complex

