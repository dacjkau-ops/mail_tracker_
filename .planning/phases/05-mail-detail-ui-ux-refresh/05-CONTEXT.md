# Phase 5: Mail Detail UI/UX Refresh - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the Mail Detail page — how individual mail information is structured, presented, and interacted with. This phase covers layout, information grouping, audit timeline display, action button behaviour, and status/overdue visual treatment. New capabilities (bulk actions, notifications, search) belong in other phases.

</domain>

<decisions>
## Implementation Decisions

### Card content & field grouping

**Left column (65%) — three cards:**
- **Origin card**: From Office, Date Received, Letter No (no Section)
- **Instructions card**: action_required field only
- **Handler Remarks card**: current handler's remarks; always rendered (even when empty — show "No remarks yet" placeholder); this is the most important field in the view

**Right column (35%):**
- Current Handler and Due Date only — no Section, no Monitoring Officer
- No completion date shown anywhere on the detail page (it belongs in the audit trail)

**Null/empty field rule**: Hide all fields with null or empty values EXCEPT Handler Remarks, which always shows with a "No remarks yet" placeholder.

### Audit timeline entry format

- **Timestamp**: Show both — relative time prominently ("3 days ago") with absolute datetime in smaller text beneath ("Feb 20, 2026 · 10:30 AM")
- **Remarks**: Always fully visible under each entry — no collapse, no truncation
- **Sort order**: Newest first (most recent action at the top)

### Action button layout

- **Visibility**: Buttons the current user cannot perform are hidden entirely — no greyed-out state, no tooltips explaining unavailability
- **Edit Remarks**: Inline editing — the remarks text in the Handler Remarks card becomes editable in place (click to edit); no modal or dialog
- **Layout**: Claude's discretion on exact button arrangement and styling within the right column

### Status & overdue visual treatment

- **Status chip labels and groups**:
  - Received + Assigned → displayed as **"Pending"** (one neutral/grey chip — the status distinction is not meaningful to the reader at a glance)
  - In Progress → **"In Progress"** chip (amber/orange)
  - Closed → **"Closed"** chip (green)
- **Overdue treatment**: Two-layer warning — red due date text in the right column AND a warning banner below the page header ("Overdue by X days") for mails where current date > due date and status ≠ Closed

### Claude's Discretion

- All visual design details: card spacing, shadows, rounded corners, typography scale, icon choices
- Exact status chip colors (within the grey/amber/green semantic scheme)
- Overdue banner style (color, typography, icon)
- Action button arrangement within the right column (stacking, sizing, grouping primary vs secondary actions)
- Inline editing UX: how to trigger save/cancel for remarks (click outside, Enter key, explicit Save button)
- MUI Timeline entry visual design: connector line style, icon per action type, spacing between entries

</decisions>

<specifics>
## Specific Ideas

- Handler Remarks is the **most important field** — it captures what the current handler knows and is doing. Give it visual prominence in the left column.
- The status grouping decision ("Pending" for both Received and Assigned) reflects that from the reader's perspective, both states mean "no one is actively working on it yet."
- Inline editing for remarks should feel natural — not a form, just editable text in context.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-mail-detail-ui-ux-refresh*
*Context gathered: 2026-02-22*
