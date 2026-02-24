# Phase 7: Create Mail UX - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve the Create Mail form: faster load time (500ms target), smarter form layout with paired fields, and intelligent section handling based on assignee selection. No new form fields or capabilities — this phase optimizes the existing creation workflow.

</domain>

<decisions>
## Implementation Decisions

### Form field layout
- Pair related fields on rows where they fit (e.g., Letter No + Date Received, From Office + Due Date)
- Keep the current field ordering — don't rearrange the sequence, just pair fields side-by-side
- Subject and Action Required remain full-width (own rows) since they are text-heavy fields
- PDF attachment stays at the bottom of the form, before the submit button

### Section auto-fill behavior
- Section field is removed as a standalone dropdown — section is derived from assignees
- When a single assignee is selected, their section becomes the mail's section (shown as read-only info next to the assignee)
- When multiple assignees share the same section, that section becomes the mail's section
- When assignees span different sections, the mail section value is "Multiple"
- Clearing all assignees clears the section value
- For DAG users (who can only create for their section): section is pre-filled and locked as read-only text — no dropdown needed
- If the user picks Section first (before assignee), the Assigned To dropdown filters to show only users from that section

### Loading experience
- Render the form shell immediately — dropdowns show "Loading..." placeholder until data arrives
- Entire form is disabled until all dropdown data has loaded (no partial input)
- Fetch sections and users in parallel for fastest load
- If a dropdown API call fails, show inline error on the failed field with a retry button

### Multi-assignee UX
- Multi-select dropdown for picking multiple assignees (not separate "add row" buttons)
- Selected assignees display as individual rows below the dropdown, each showing [Assignee Name] [Their Section]
- Preference for separate row/placeholder per assignee over chips; fallback to chips with X if row display isn't feasible
- Section info per assignee is read-only/informational

### Claude's Discretion
- Exact field pairing combinations (which short fields share rows)
- Styling of the per-assignee section label (badge, text, chip)
- Disabled form appearance (opacity, overlay, or field-level disabled)
- Retry button placement and styling for failed API calls
- How "Multiple" section value displays in the form and in the mail list

</decisions>

<specifics>
## Specific Ideas

- Each selected assignee should appear as its own row/line with their section shown in front — not lumped together as chips
- "Multiple" as section value when assignees span different sections — this is a UX convenience, not a real section entity
- DAG section should feel locked/definitive — read-only text, not a disabled dropdown

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-create-mail-ux*
*Context gathered: 2026-02-24*
