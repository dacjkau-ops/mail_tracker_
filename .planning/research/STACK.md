# Stack Research

**Domain:** Mail Tracker UI/UX Refresh v1.1 — Card-Based Detail Views, Timeline, Time Tracking
**Researched:** 2026-02-21
**Confidence:** HIGH

---

## Executive Summary

For the Mail Tracker v1.1 UI/UX refresh, the current MUI v7.x stack (compatible with MUI v5 patterns) already supports all required components. No new dependencies are needed. The redesign requires strategic use of existing MUI components: `Card`/`CardContent` for information hierarchy, `Grid`/`Grid2` for responsive layouts, and custom styling via `sx` prop for overdue highlighting. The Timeline component requires custom implementation or lightweight lab components, not heavy charting libraries.

---

## Recommended Stack

### Core MUI Components (Already Installed)

| Component | Version | Purpose | Usage in Mail Tracker |
|-----------|---------|---------|----------------------|
| `@mui/material/Card` | v7.x (v5 compatible) | Information hierarchy containers | Origin Card, Instruction Card, Handler Card |
| `@mui/material/CardContent` | v7.x | Content padding within cards | All card interiors |
| `@mui/material/CardHeader` | v7.x | Card titles with icon + action | Section headers with status icons |
| `@mui/material/Grid` | v7.x | Two-column layout (65%/35%) | Main content / Sidebar split |
| `@mui/material/Grid2` | v7.x | Modern grid API with better responsive control | Preferred for new layouts |
| `@mui/material/Chip` | v7.x | Status badges | Status, Overdue, Priority indicators |
| `@mui/material/Divider` | v7.x | Visual separation between sections | Between card sections |
| `@mui/material/Box` | v7.x | Layout wrapper with `sx` prop | Overdue border highlighting |
| `@mui/material/Paper` | v7.x | Elevation/surface containers | Card backgrounds |
| `@mui/material/Typography` | v7.x | Text hierarchy | All text content |
| `@mui/material/Stack` | v7.x | Vertical/horizontal spacing | Card content stacking |

### Supporting Libraries (Already Installed)

| Library | Version | Purpose | Usage |
|---------|---------|---------|-------|
| `date-fns` | ^4.1.0 | Time duration formatting | "2 Days, 4 Hours" display |
| `@mui/icons-material` | ^7.3.7 | Status/action icons | Timeline icons, card headers |

### MUI Lab Components (Conditional)

| Component | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| `@mui/lab/Timeline` | v7.x alpha | Vertical audit trail | If complex timeline needed; otherwise custom List |
| `@mui/lab/TimelineItem` | v7.x alpha | Individual events | Part of Timeline group |
| `@mui/lab/TimelineContent` | v7.x alpha | Event details | Part of Timeline group |
| `@mui/lab/TimelineDot` | v7.x alpha | Event markers | Part of Timeline group |

---

## Component Selection Guide

### Card-Based Information Hierarchy

**Recommended Pattern:**
```
<Card>
  <CardHeader
    title="Origin"
    avatar={<LocationOnIcon color="primary" />}
  />
  <CardContent>
    <Stack spacing={2}>
      <Field label="From Office" value={...} />
      <Field label="Letter No" value={...} />
    </Stack>
  </CardContent>
</Card>
```

**Cards Needed:**
1. **Origin Card** — LocationOnIcon, mail source details
2. **Instruction Card** — AssignmentIndIcon, action_required, initial_instructions
3. **Handler Card** — PersonIcon, current_handler, monitoring_officer
4. **Timeline Card** — HistoryIcon, audit trail container
5. **Status Card** — ScheduleIcon, due_date, time_in_stage

### Two-Column Grid Layout (65%/35%)

**Recommended:** Use `Grid2` (modern MUI v7 API) over legacy `Grid`.

```jsx
import Grid from '@mui/material/Grid2'; // Note the /Grid2 import

<Grid container spacing={3}>
  {/* Main Content - 65% */}
  <Grid size={{ xs: 12, md: 8 }}>
    {/* Cards stack here */}
  </Grid>

  {/* Sidebar - 35% */}
  <Grid size={{ xs: 12, md: 4 }}>
    {/* Status card, timeline here */}
  </Grid>
</Grid>
```

**Responsive Behavior:**
- `xs: 12` — Full width on mobile
- `md: 8` / `md: 4` — 65%/35% split on desktop (tablet+)

### Timeline Component Decision

**Option A: Custom List-based (Recommended — No New Dependencies)**

Use existing `List`, `ListItem`, with custom styling for a clean timeline:

```jsx
<Box sx={{ position: 'relative', pl: 3 }}>
  {/* Vertical line */}
  <Box sx={{
    position: 'absolute',
    left: 11,
    top: 8,
    bottom: 8,
    width: 2,
    bgcolor: 'divider'
  }} />

  {auditTrail.map((entry, i) => (
    <Box key={i} sx={{ position: 'relative', mb: 2 }}>
      {/* Dot */}
      <Box sx={{
        position: 'absolute',
        left: -23,
        top: 4,
        width: 12,
        height: 12,
        borderRadius: '50%',
        bgcolor: getActionColor(entry.action),
        border: '2px solid white',
        boxShadow: 1
      }} />
      <Typography variant="body2">{entry.action}</Typography>
      <Typography variant="caption">{formatDateTime(entry.timestamp)}</Typography>
    </Box>
  ))}
</Box>
```

**Option B: MUI Lab Timeline**

```bash
npm install @mui/lab
```

Only use if needing advanced timeline features (alternate sides, complex connectors).

**Decision:** Use Option A (custom CSS) — it avoids adding `@mui/lab` dependency and provides full control over styling.

### Time Duration Display

**Using date-fns (Already Installed):**

```javascript
import { intervalToDuration, formatDuration } from 'date-fns';

function formatTimeDuration(startDate, endDate = new Date()) {
  const duration = intervalToDuration({
    start: new Date(startDate),
    end: new Date(endDate)
  });

  // Custom format: "2 Days, 4 Hours" or "3 Hours, 15 Minutes"
  const parts = [];
  if (duration.days > 0) parts.push(`${duration.days} Day${duration.days > 1 ? 's' : ''}`);
  if (duration.hours > 0) parts.push(`${duration.hours} Hour${duration.hours > 1 ? 's' : ''}`);
  if (duration.days === 0 && duration.hours === 0 && duration.minutes > 0) {
    parts.push(`${duration.minutes} Min`);
  }

  return parts.join(', ') || 'Just now';
}
```

**Rationale:** `date-fns` is already in the project. No additional library needed. More flexible than `moment` or `dayjs` for custom duration formatting.

### Status Chips with Color Coding

**Using existing constants pattern:**

```javascript
// constants.js
export const STATUS_COLORS = {
  'Received': 'default',    // Grey
  'Assigned': 'info',       // Blue
  'In Progress': 'warning', // Orange
  'Closed': 'success'       // Green
};

// Component
<Chip
  label={status}
  color={STATUS_COLORS[status]}
  size="small"
  sx={{ fontWeight: 600 }}
/>
```

### Overdue Highlighting (Red Border)

**CSS-in-JS Approach via `sx` Prop:**

```jsx
<Card
  sx={{
    border: isOverdue ? '2px solid' : '1px solid',
    borderColor: isOverdue ? 'error.main' : 'divider',
    boxShadow: isOverdue ? '0 0 0 4px rgba(211, 47, 47, 0.1)' : undefined,
    position: 'relative'
  }}
>
  {isOverdue && (
    <Chip
      label="OVERDUE"
      color="error"
      size="small"
      sx={{
        position: 'absolute',
        top: 12,
        right: 12,
        fontWeight: 700
      }}
    />
  )}
  {/* Card content */}
</Card>
```

**Why `sx` prop over `styled()`:**
- Inline conditional logic is clearer
- No additional imports
- Consistent with existing codebase patterns
- Better performance for dynamic values

---

## Installation

**No new dependencies required.** All components are available in the existing MUI v7 installation.

If MUI Lab Timeline is later needed:

```bash
npm install @mui/lab
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|----------------------|
| Custom CSS timeline | `@mui/lab/Timeline` | If needing alternating left/right layout |
| `date-fns` | `dayjs` | Already using date-fns, no benefit to switch |
| `Card` components | `Paper` with custom padding | Cards provide semantic meaning and consistent API |
| `Grid2` | Legacy `Grid` | Grid2 is the future API, but legacy Grid works fine |
| `sx` prop | `styled()` API | `styled()` better for reusable components; `sx` better for one-off styling |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `recharts` or charting libraries | Overkill for simple timeline display | Custom CSS or MUI Lab Timeline |
| `moment.js` | Heavy bundle size, deprecated | `date-fns` (already installed) |
| Third-party timeline libraries (react-vertical-timeline, etc.) | Additional dependencies, licensing | MUI Lab or custom CSS |
| `material-ui` v4 | Outdated, different API | `@mui/material` v7 (already installed) |
| CSS Modules or SASS | Unnecessary complexity | MUI `sx` prop + emotion (already configured) |
| Bootstrap or Tailwind | Conflicts with MUI styling system | MUI system + `sx` prop |

---

## Mobile-Responsive Approach

**Breakpoints Strategy:**

| Screen Size | Layout | Behavior |
|-------------|--------|----------|
| Mobile (< 768px) | Single column | Cards stack vertically, full width |
| Tablet (768-1024px) | Two column 60/40 | Cards side by side with reduced padding |
| Desktop (> 1024px) | Two column 65/35 | Optimal spacing, full feature display |

**Implementation:**

```jsx
<Grid container spacing={{ xs: 2, md: 3 }}>
  <Grid size={{ xs: 12, md: 8 }}>
    {/* Left column content */}
  </Grid>
  <Grid size={{ xs: 12, md: 4 }}>
    {/* Right column content */}
  </Grid>
</Grid>
```

**Card Padding Adjustments:**

```jsx
<Card>
  <CardContent sx={{ p: { xs: 2, md: 3 } }}>
    {/* Content */}
  </CardContent>
</Card>
```

---

## Version Compatibility

| Package | Current | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `@mui/material` | ^7.3.7 | React ^19.2.0 | v7 is API-compatible with v5 |
| `@mui/icons-material` | ^7.3.7 | @mui/material ^7.x | Keep versions in sync |
| `@emotion/react` | ^11.14.0 | MUI v7 | Required peer dependency |
| `@emotion/styled` | ^11.14.1 | MUI v7 | Required peer dependency |
| `date-fns` | ^4.1.0 | Any React version | Already installed |

---

## CSS-in-JS Patterns for Refresh

### Pattern 1: Card with Conditional Border

```jsx
const cardSx = (isOverdue) => ({
  border: isOverdue ? '2px solid' : '1px solid',
  borderColor: isOverdue ? 'error.main' : 'divider',
  borderRadius: 2,
  transition: 'box-shadow 0.2s',
  '&:hover': {
    boxShadow: 3
  }
});

<Card sx={cardSx(isOverdue)}>...</Card>
```

### Pattern 2: Timeline Connector Line

```jsx
const timelineLineSx = {
  position: 'absolute',
  left: '19px',
  top: '32px',
  bottom: '-16px',
  width: '2px',
  bgcolor: 'divider'
};
```

### Pattern 3: Status Dot

```jsx
const statusDotSx = (color) => ({
  width: 12,
  height: 12,
  borderRadius: '50%',
  bgcolor: `${color}.main`,
  border: '2px solid white',
  boxShadow: 1
});
```

---

## Sources

- [MUI v7 Component API](https://mui.com/material-ui/all-components/) — Verified Card, Grid2, Chip APIs
- [MUI Lab Timeline](https://mui.com/material-ui/react-timeline/) — Evaluated for audit trail use case
- [date-fns Documentation](https://date-fns.org/docs/Getting-Started) — Duration formatting verified
- [MUI System sx Prop](https://mui.com/system/getting-started/the-sx-prop/) — CSS-in-JS patterns
- Current codebase analysis — `frontend/package.json` shows MUI v7.3.7 already installed

---

## Summary for Implementation

1. **No new dependencies needed** — Use existing MUI v7.x
2. **Use `Grid2` for layout** — Modern API, better responsive control
3. **Custom CSS timeline** — Avoid `@mui/lab` unless complex features needed
4. **`date-fns` for time display** — Already installed, use `intervalToDuration`
5. **`sx` prop for conditional styling** — Overdue borders, status colors
6. **Five cards minimum** — Origin, Instruction, Handler, Timeline, Status
7. **Mobile-first responsive** — Stack on mobile, 65/35 split on desktop

---

*Stack research for: Mail Tracker v1.1 UI/UX Refresh*
*Researched: 2026-02-21*
