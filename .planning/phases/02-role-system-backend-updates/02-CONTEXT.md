# Phase 2: Role System & Backend Updates - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand the user role model with two new roles (auditor, clerk), update create and visibility permissions for all roles, enforce subsection-level scoping for lower-tier roles, and convert the `action_required` field from a dropdown to optional free text. No frontend changes — backend and data model only.

Subsection model already exists in the codebase — work with it as-is.

</domain>

<decisions>
## Implementation Decisions

### Create permissions
- SrAO/AAO can now create mails — scoped to their own subsection only
- Clerk can create mails — scoped to their own subsection only
- Auditor can create mails — scoped to their assigned subsections (configured by admin)
- When any of these users creates a mail, the `assigned_to` dropdown shows only users in their own subsection
- `assigned_to` is still required explicitly — not auto-assigned to creator

### Visibility rules
- **AG**: sees all mails across all sections (unchanged)
- **DAG**: sees all mails in all subsections under their section (expanded — previously section-level, now explicitly includes subsections)
- **SrAO/AAO**: see all mails in their subsection (expanded from "only assigned to them")
- **Clerk**: narrow — sees only mails assigned to them OR created by them
- **Auditor**: sees mails in their configured subsections only (admin-assigned per user)

### Auditor role
- New role added to user model: `auditor`
- Auditor capabilities: create mail, add remarks, close mails, view mails, reassign to immediate superior
- Auditor's immediate superior = SrAO or AAO only (cannot escalate to DAG or AG)
- Auditor visibility is per-user configurable: admin assigns specific subsections to each auditor account
- Auditor cannot reassign freely — only upward to SrAO/AAO within their assigned subsections

### Clerk role
- New role added to user model: `clerk`
- Clerk capabilities: create mails (subsection-scoped), view their own mails, standard mail handling
- Clerk visibility: narrow — only assigned-to-them or created-by-them mails (NOT all subsection mails)

### action_required field
- Remove dropdown choices entirely — field becomes a plain free-text CharField
- Field is now optional — can be left blank
- Max 500 chars when filled (no other validation)
- No data migration for existing records — existing values (Review, Approve, etc.) remain as free-text strings
- Goal: leaner, not bulkier — remove all choice constraints

### Claude's Discretion
- How to model auditor subsection assignment (many-to-many field on user, or separate model)
- Whether clerk's "assigned to them" visibility uses same mechanism as existing SrAO/AAO pattern
- Database migration strategy for removing `action_required` choices
- Exact permission class structure for the expanded role hierarchy

</decisions>

<specifics>
## Specific Ideas

- "Make this leaner not bulkier" — guiding principle for the action_required change; remove dropdown cruft entirely
- Auditor is an active role, not purely read-only: creates, closes, remarks, and escalates upward to SrAO/AAO
- Clerk has the narrowest visibility of any role that can create — they only see what they personally touch

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-role-system-backend-updates*
*Context gathered: 2026-02-20*
