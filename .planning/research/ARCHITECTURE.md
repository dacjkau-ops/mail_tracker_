# Architecture Research: Mail Detail View v1.1

**Domain:** Mail Tracker UI/UX Refresh
**Researched:** 2026-02-21
**Confidence:** HIGH

---

## System Overview

The new Mail Detail view replaces the monolithic table-based layout with a card-based, two-column design focused on information hierarchy and action clarity.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MailDetailPage (Container)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Header (Subject H4, Serial H6, Status Chip, Action Buttons)          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  ┌─────────────────────────────┐     │
│  │        LEFT COLUMN (65%)       │  │     RIGHT COLUMN (35%)      │     │
│  ├──────────────────────────────────┤  ├─────────────────────────────┤     │
│  │  ┌────────────────────────────┐  │  │  ┌─────────────────────┐     │     │
│  │  │   OriginCard             │  │  │  │ CurrentHandlerCard  │     │     │
│  │  │   - Source Department    │  │  │  │ - Handler Info      │     │     │
│  │  │   - Letter Details       │  │  │  │ - Time Tracker      │     │     │
│  │  │   - Date Received        │  │  │  └─────────────────────┘     │     │
│  │  └────────────────────────────┘  │  │  ┌─────────────────────┐     │     │
│  │  ┌────────────────────────────┐  │  │  │   DueDateCard       │     │     │
│  │  │   InstructionCard          │  │  │  │ - Due Date Display  │     │     │
│  │  │   - Initial Instructions   │  │  │  │ - Overdue Warning   │     │     │
│  │  └────────────────────────────┘  │  │  └─────────────────────┘     │     │
│  │  ┌────────────────────────────┐  │  └─────────────────────────────┘     │
│  │  │   HandlerRemarksCard     │  │                                      │
│  │  │   - Current Action       │  │                                      │
│  │  │   - Remarks History      │  │                                      │
│  │  └────────────────────────────┘  │                                      │
│  └──────────────────────────────────┘                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ AuditTimeline (Vertical Timeline - Full Width)                      │   │
│  │ - CREATE, ASSIGN, REASSIGN, CLOSE, REOPEN entries                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Existing Dialogs (Reused): ReassignDialog, CloseMailDialog, ReopenDialog   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Responsibility | Integration Point |
|-----------|----------------|-------------------|
| `MailDetailPage` | Container: data fetching, state management, action handlers | Route handler, Parent |
| `DetailHeader` | Display subject (H4), serial (H6), status chip, action buttons | MailDetailPage |
| `OriginCard` | Source department, letter number, from office, date received | MailDetailPage |
| `InstructionCard` | Initial instructions with expand/collapse | MailDetailPage |
| `HandlerRemarksCard` | Current action status, remarks history, edit button | MailDetailPage |
| `CurrentHandlerCard` | Handler name, role, avatar, time-in-stage tracker | MailDetailPage |
| `DueDateCard` | Due date display with overdue highlighting | MailDetailPage |
| `AuditTimeline` | Vertical timeline of all audit trail events | MailDetailPage |
| `ActionButtonBar` | Reassign, Close, Reopen buttons (permission-based) | DetailHeader or standalone |

---

## Recommended Project Structure

```
frontend/src/
├── pages/
│   └── MailDetailPage.jsx          # Main container (MODIFY - refactor layout)
│
├── components/
│   ├── detail/                     # NEW: Detail view components
│   │   ├── DetailHeader.jsx        # Header with subject, status, actions
│   │   ├── OriginCard.jsx          # Origin/source information card
│   │   ├── InstructionCard.jsx     # Initial instructions display
│   │   ├── HandlerRemarksCard.jsx  # Handler remarks and action status
│   │   ├── CurrentHandlerCard.jsx  # Handler info with time tracker
│   │   ├── DueDateCard.jsx         # Due date with overdue highlighting
│   │   └── AuditTimeline.jsx       # Vertical timeline component
│   │
│   ├── dialogs/                    # EXISTING: Reused without changes
│   │   ├── ReassignDialog.jsx      # Reuse as-is
│   │   ├── CloseMailDialog.jsx     # Reuse as-is
│   │   ├── ReopenDialog.jsx        # Reuse as-is
│   │   ├── MultiAssignDialog.jsx   # Reuse as-is
│   │   └── UpdateCurrentActionDialog.jsx  # Reuse as-is
│   │
│   └── AssignmentsPanel.jsx        # EXISTING: Keep for multi-assign view
│
├── services/
│   └── mailService.js              # EXISTING: No changes needed
│
├── utils/
│   ├── dateHelpers.js              # EXISTING: calculateTimeInStage, isOverdue
│   └── constants.js                # EXISTING: STATUS_COLORS
│
└── context/
    └── AuthContext.jsx             # EXISTING: useAuth hook for permissions
```

### Structure Rationale

- **`detail/` folder:** Groups all new card components for the detail view, making the architecture modular and maintainable.
- **Page remains container:** MailDetailPage keeps data fetching and state management; presentation delegated to card components.
- **Dialogs stay separate:** Existing dialog components are reused without modification to minimize regression risk.
- **Utils reused:** Existing dateHelpers and constants provide formatting and color logic.

---

## Architectural Patterns

### Pattern 1: Container/Presentational Component Split

**What:** MailDetailPage (container) handles data fetching and state; card components (presentational) receive props and render UI.

**When to use:** When a page has complex data requirements but needs a clean, testable UI structure.

**Trade-offs:**
- Pros: Clear separation of concerns, easier testing, reusable presentational components
- Cons: Prop drilling for deeply nested data (mitigated by flat card structure)

**Example:**
```jsx
// Container (MailDetailPage.jsx)
const MailDetailPage = () => {
  const [mail, setMail] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);

  useEffect(() => { loadMail(); loadAuditTrail(); }, [id]);

  return (
    <Box>
      <DetailHeader mail={mail} onReassign={handleReassign} />
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <OriginCard mail={mail} />
          <InstructionCard instructions={mail?.initial_instructions} />
          <HandlerRemarksCard mail={mail} />
        </Grid>
        <Grid item xs={12} md={4}>
          <CurrentHandlerCard mail={mail} />
          <DueDateCard dueDate={mail?.due_date} status={mail?.status} />
        </Grid>
      </Grid>
      <AuditTimeline entries={auditTrail} />
    </Box>
  );
};
```

### Pattern 2: Conditional Rendering for N/A Values

**What:** Components hide fields that have no value (null, undefined, empty string, "N/A").

**When to use:** To reduce visual clutter and focus user attention on meaningful data.

**Trade-offs:**
- Pros: Cleaner UI, progressive disclosure
- Cons: Users cannot distinguish between "not loaded" and "not applicable"

**Example:**
```jsx
// In OriginCard.jsx
{mail?.letter_no && mail.letter_no !== 'N/A' && (
  <Box>
    <Typography variant="caption" color="text.secondary">Letter No</Typography>
    <Typography variant="body1">{mail.letter_no}</Typography>
  </Box>
)}
```

### Pattern 3: Compound Card Layout with MUI Grid

**What:** Two-column responsive layout using MUI Grid: 65% left (8 cols), 35% right (4 cols) on desktop; single column on mobile.

**When to use:** When information has clear primary/secondary hierarchy.

**Trade-offs:**
- Pros: Responsive, leverages MUI's breakpoint system
- Cons: Right column may have excess whitespace if left column content is short

**Example:**
```jsx
<Grid container spacing={3}>
  {/* Left Column - 65% */}
  <Grid item xs={12} md={8}>
    <Stack spacing={3}>
      <OriginCard mail={mail} />
      <InstructionCard ... />
      <HandlerRemarksCard ... />
    </Stack>
  </Grid>

  {/* Right Column - 35% */}
  <Grid item xs={12} md={4}>
    <Stack spacing={3}>
      <CurrentHandlerCard mail={mail} />
      <DueDateCard ... />
    </Stack>
  </Grid>
</Grid>
```

---

## Data Flow

### Request Flow

```
User Action (click Reassign)
    ↓
DetailHeader → onReassign prop
    ↓
MailDetailPage.handleReassign()
    ↓
mailService.reassignMail(id, data)
    ↓
API POST /records/{id}/reassign/
    ↓
loadMail() + loadAuditTrail() → setState → Re-render
```

### State Management

```
MailDetailPage State:
├── mail: MailRecord | null
├── auditTrail: AuditEntry[]
├── loading: boolean
├── error: string | null
└── dialogOpen states: { reassign, close, reopen, ... }
    ↓ (passed as props)
Card Components (read-only props)
    ↓
Dialog Components (callbacks trigger parent handlers)
```

### Key Data Flows

1. **Initial Load:**
   - `useEffect` triggers `loadMail()` and `loadAuditTrail()`
   - Services fetch from `/records/{id}/` and `/audit/?mail_record={id}`
   - State updates trigger re-render with data

2. **Action Completion:**
   - Dialog calls `onSuccess` callback passed from MailDetailPage
   - Callback refreshes mail data and audit trail
   - Components receive updated props

3. **Permission-Based Rendering:**
   - `useAuth()` provides user role and permissions
   - Utility functions (`canReassignMail()`, `canCloseMail()`) determine visibility
   - Buttons conditionally render based on permission checks

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 mails/day | Current architecture sufficient. Card-based layout performs well. |
| 100-1k mails/day | Audit timeline may need virtualization if entries exceed 50. Consider paginating audit trail. |
| 1k+ mails/day | Split AuditTimeline into separate API endpoint with pagination. Lazy load card data. |

### Scaling Priorities

1. **First bottleneck:** Audit trail length. Mitigate by capping initial load to last 20 entries with "Load More" button.
2. **Second bottleneck:** Time calculation frequency. Memoize `calculateTimeInStage` with `useMemo`.

---

## Anti-Patterns

### Anti-Pattern 1: Deep Prop Drilling

**What people do:** Pass individual fields as props: `<OriginCard letterNo={mail.letter_no} fromOffice={mail.from_office} ... />`

**Why it's wrong:** Verbose, hard to maintain, breaks when MailRecord schema changes.

**Do this instead:** Pass the mail object: `<OriginCard mail={mail} />` and destructure inside component.

### Anti-Pattern 2: Inline Permission Logic in JSX

**What people do:** `{user?.role === 'AG' || (user?.role === 'DAG' && user?.sections?.includes(mail?.section)) && <Button>}`

**Why it's wrong:** Clutters JSX, hard to test, inconsistent permission logic across components.

**Do this instead:** Extract to named functions in container: `canReassignMail()`, `canCloseMail()`, pass boolean props to children.

### Anti-Pattern 3: Duplicating Data Fetching in Cards

**What people do:** Each card calls `useEffect` to fetch its own data.

**Why it's wrong:** Multiple API calls, loading states become uncoordinated, race conditions.

**Do this instead:** Centralize data fetching in MailDetailPage, pass data as props to card components.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| mailService | Import and call methods | Existing service, no changes needed |
| useAuth | Context hook | Provides user role for permission checks |
| dateHelpers | Import utility functions | `calculateTimeInStage`, `isOverdue`, `formatDate` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| MailDetailPage ↔ Card Components | Props down, callbacks up | Container/presentational split |
| MailDetailPage ↔ Dialogs | State + callback props | `open`, `onClose`, `onSuccess` pattern |
| Card Components ↔ Utils | Direct import | Pure functions for formatting |

---

## Build Order (Dependencies)

1. **Create directory structure** - `components/detail/`

2. **Build independent utility components first** (no dependencies):
   - `DueDateCard` - Only needs date string and status
   - `OriginCard` - Only needs mail object

3. **Build components with existing utility dependencies**:
   - `CurrentHandlerCard` - Uses `calculateTimeInStage` from dateHelpers
   - `InstructionCard` - Simple text display

4. **Build components with child dependencies**:
   - `HandlerRemarksCard` - May use internal remark item component

5. **Build composite components**:
   - `DetailHeader` - Combines Typography, Chip, Buttons
   - `AuditTimeline` - Maps over auditTrail array

6. **Refactor MailDetailPage**:
   - Replace table-based layout with Grid + Card composition
   - Import and integrate all new card components
   - Keep existing dialog integration intact

7. **Test integration**:
   - Verify data flows correctly
   - Check responsive behavior
   - Validate permission-based rendering

---

## Suggested File Implementation Order

| Order | File | Depends On | Effort |
|-------|------|------------|--------|
| 1 | `components/detail/OriginCard.jsx` | None | Small |
| 2 | `components/detail/DueDateCard.jsx` | dateHelpers | Small |
| 3 | `components/detail/CurrentHandlerCard.jsx` | dateHelpers | Small |
| 4 | `components/detail/InstructionCard.jsx` | None | Small |
| 5 | `components/detail/HandlerRemarksCard.jsx` | None | Medium |
| 6 | `components/detail/AuditTimeline.jsx` | dateHelpers | Medium |
| 7 | `components/detail/DetailHeader.jsx` | Existing dialogs | Medium |
| 8 | `pages/MailDetailPage.jsx` | All above | Large |

---

## Sources

- Existing codebase analysis: `frontend/src/pages/MailDetailPage.jsx`
- Component inventory: `frontend/src/components/`
- Service layer: `frontend/src/services/mailService.js`
- Material-UI v5 Grid documentation: https://mui.com/material-ui/react-grid/
- MUI Card component patterns: https://mui.com/material-ui/react-card/

---

*Architecture research for: Mail Tracker v1.1 UI/UX Refresh*
*Researched: 2026-02-21*
