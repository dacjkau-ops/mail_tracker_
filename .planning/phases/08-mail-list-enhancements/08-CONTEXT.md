# Phase 8: Mail List Enhancements - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a PDF attachment indicator to the mail list and implement server-side pagination with page controls. No new columns, no new filters, no search changes — this phase adds visual PDF indication and paginated navigation to the existing mail list.

</domain>

<decisions>
## Implementation Decisions

### PDF icon placement
- Attachment/paperclip icon (not PDF-specific) appears to the right of the subject text, inline
- Generic tooltip on hover: "View PDF"
- Clicking the icon opens the PDF in a new browser tab (via X-Accel-Redirect)
- Space for the icon is always reserved (even for mails without a PDF) so subject text stays aligned
- Mails without a PDF show empty space where the icon would be

### Pagination controls
- Numbered page buttons (1, 2, 3 ... 18, 19, 20) with prev/next arrows — like Google search results
- Truncate with ellipsis for many pages (show first few, current range, last few)
- Pagination controls appear below the table only
- Page size is selectable: 25, 50, 100 records per page
- Page size selector appears above the table (near existing filters), not in the pagination bar

### Page info display
- Full context shown: "Showing 1-25 of 312 records"
- Info text on the left side, page buttons aligned right in the pagination bar
- When zero results: pagination bar stays visible, shows "0 records" with no page buttons

### Filter + pagination interaction
- Changing any filter (status, section, search) resets to page 1
- Changing page size resets to page 1
- Semi-transparent overlay with spinner on the table while new data loads (both for filter changes and page navigation)
- Auto-scroll to top of the table when changing pages
- No URL state — pagination and filters are ephemeral local state, refreshing resets to defaults

### Claude's Discretion
- Exact overlay opacity and spinner style
- Pagination button styling (outlined, contained, text)
- How the page size dropdown is styled and labeled
- Ellipsis threshold (at what page count to start truncating)
- Icon color and size for the attachment indicator

</decisions>

<specifics>
## Specific Ideas

- Pagination style should feel like Google search results — numbered buttons with ellipsis for large ranges
- The attachment icon is a paperclip, not a PDF document icon — keeps it generic for potential future attachment types
- "Showing X-Y of Z records" gives users full context about where they are in the list

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-mail-list-enhancements*
*Context gathered: 2026-02-24*
