# Phase 3: Frontend & Workflow - Research

**Researched:** 2026-02-21
**Domain:** React 18 / MUI v7 / React Hook Form — file upload UI, role badge updates, free-text field migration, codebase cleanup
**Confidence:** HIGH

---

## Summary

Phase 3 is a pure frontend/cleanup phase. All backend endpoints, serializers, and data contracts were delivered in Phases 1 and 2. The frontend must be updated to (a) add a PDF upload input to the create mail form, (b) display the PDF attachment section on the detail page with view/download, (c) convert `action_required` from a `Select` to a `TextField`, (d) update the role badge to show `auditor` and `clerk`, and (e) clean up dead code and unused artefacts.

The stack is already installed and working: React 19, MUI v7, React Hook Form v7, Axios, Vite. No new packages are needed for any of the required features. File upload uses the browser's native `<input type="file">` via React Hook Form's `Controller`, and the Axios request must be sent as `multipart/form-data`. MUI's `Button` component with `component="label"` is the standard MUI v5/v7 pattern for styled file inputs.

The PDF view/download flow is backend-driven: the frontend calls `GET /api/records/{id}/pdf/view/?stage=created` and the response is an `X-Accel-Redirect` redirect intercepted by nginx — the browser receives the PDF file. The simplest correct frontend implementation is `window.open(viewUrl)` or `window.location.href = viewUrl` with the JWT token attached. However, since the endpoint is a protected API route requiring JWT auth in the Authorization header, `window.open` will not attach the header. The correct pattern is to call the endpoint via Axios (which has the auth interceptor), receive the blob, and create an object URL — OR use a token-bearing URL (i.e., pass the token as a query param). Reviewing the backend view, it returns an `HttpResponse` with `X-Accel-Redirect` and no body. The browser cannot follow X-Accel-Redirect — nginx does that. So the fetch must go through the `api` Axios instance and the browser must display or trigger download of the binary. The simplest pattern: create a temporary `<a>` element with the Blob URL and click it.

**Primary recommendation:** No new packages. Use existing `api` Axios instance for PDF upload and download/view. File input via `Controller` + `input[type=file]` inside a MUI `Button` label. Role badge in `MainLayout.jsx` just needs the new role names added to the display label map.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WORKFLOW-01 | Create mail page includes PDF upload field | MUI Button+label file input pattern; React Hook Form Controller for uncontrolled file input |
| WORKFLOW-02 | PDF uploaded during mail creation is attached to the record | Two-step flow: create mail first (POST /records/), then upload PDF (POST /records/{id}/pdf/); multipart/form-data via Axios |
| WORKFLOW-03 | action_required field changed from dropdown to free text input | Replace `FormControl/Select` block with `TextField` in CreateMailPage; remove showOtherAction state and action_required_other field |
| WORKFLOW-06 | Mail detail page shows PDF attachment if exists | `attachment_metadata` field already included in MailRecordDetailSerializer response; read `mail.attachment_metadata` |
| WORKFLOW-07 | PDF can be viewed inline or downloaded from detail page | Axios GET /records/{id}/pdf/view/ returning blob → window.open with Blob URL OR `<a download>` click pattern |
| FRONTEND-01 | Create mail form includes file input for PDF upload | Controller wrapping `<input type="file" accept=".pdf">` inside MUI Button label |
| FRONTEND-02 | File input shows selected filename and validation | useState for selectedFile; validate type (.pdf) and size (≤10MB) in onChange handler; show filename as Typography below input |
| FRONTEND-03 | Action required changed from Select to TextField | Remove `FormControl/InputLabel/Select/MenuItem` block; replace with single `TextField` controller; remove `ACTION_REQUIRED_OPTIONS` import and `showOtherAction` state |
| FRONTEND-04 | Mail detail page displays PDF attachment section | Conditional `Paper` section reading `mail.attachment_metadata.has_attachment`; show filename, size, upload date |
| FRONTEND-05 | PDF view button opens in new tab or downloads | Axios GET → Blob → `window.open(URL.createObjectURL(blob), '_blank')` — opens in new tab inline; OR `<a>` click for download |
| FRONTEND-06 | Role badge updated to show new roles (auditor, clerk) | `MainLayout.jsx` Chip label already shows `user?.role`; no change needed if raw role string is acceptable; add display-name map if human-readable label is wanted |
| CLEANUP-01 | Unused imports removed from all Python files | Grep backend Python files for unused imports; focus on recently modified files from Phase 1 and 2 |
| CLEANUP-02 | Unused components removed from frontend | `RemarksEditDialog.jsx` is imported in MailDetailPage but the button that opens it was removed — verify usage; confirm `ACTION_REQUIRED_OPTIONS` constant becomes orphaned |
| CLEANUP-03 | Sample data files organized or removed if not needed | `backend/sample_data/` has CSV and JSON; keep as reference but ensure not in git if sensitive |
| CLEANUP-04 | Deprecated fields marked or removed | `remarks` field on MailRecord model has a `# DEPRECATED` comment; `user_remarks` on MailAssignment is also flagged deprecated; frontend still references `mail.remarks` in MailDetailPage — confirm no display regressions after Phase 3 |
| CLEANUP-05 | Build artifacts not tracked in git | `frontend/dist/` is in .gitignore already; `backend/staticfiles/` is in .gitignore; verify neither is tracked in git index |
| CLEANUP-06 | Documentation updated to reflect changes | CLAUDE.md still lists `action_required` dropdown in Action Required dropdown; update to reflect free-text. Also update role references if needed |
</phase_requirements>

---

## Standard Stack

### Core (already installed — NO new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | UI framework | Already in use |
| MUI (Material-UI) | 7.3.7 | Component library | Already in use |
| React Hook Form | 7.71.1 | Form state + validation | Already in use for create form |
| Axios | 1.13.2 | HTTP client with auth interceptors | Already in use; handles JWT header |
| Vite | 7.2.4 | Build tool | Already in use |

### No Additional Packages Required

All required features (file upload, blob download, text field) are achievable with the installed stack. The browser's native File API handles file selection and validation. Axios handles multipart upload. Blob URLs handle PDF display.

---

## Architecture Patterns

### Existing Project Structure (do not change)

```
frontend/src/
├── pages/           # Page-level components (CreateMailPage, MailDetailPage, MailListPage)
├── components/      # Reusable dialogs (ReassignDialog, CloseMailDialog, etc.)
├── services/        # API calls (mailService.js, api.js)
├── context/         # AuthContext
├── layouts/         # MainLayout
└── utils/           # constants.js, dateHelpers.js, pdfExport.js
```

### Pattern 1: PDF Upload — Two-Step Flow

The backend does NOT accept a PDF during the initial `POST /records/` (which is `application/json`). Upload is a separate `POST /records/{id}/pdf/` request with `multipart/form-data`.

**Implementation approach:**
1. User fills the create form including optionally selecting a PDF file.
2. On submit: `createMail(mailData)` → get back `createdMail.id`.
3. If user selected a file: `uploadPDF(createdMail.id, file, 'created')`.
4. Navigate to detail page.

This means `onSubmit` in `CreateMailPage.jsx` becomes async with two sequential calls. Error handling: if mail creation succeeds but PDF upload fails, show a partial-success message ("Mail created but PDF upload failed. You can upload the PDF from the detail page.") and still navigate.

**mailService addition:**
```js
async uploadPDF(mailId, file, uploadStage = 'created') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_stage', uploadStage);
  const response = await api.post(`/records/${mailId}/pdf/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
},

async getPDFMetadata(mailId) {
  const response = await api.get(`/records/${mailId}/pdf/`);
  return response.data;
},

async viewPDF(mailId, stage = 'created') {
  const response = await api.get(`/records/${mailId}/pdf/view/`, {
    params: { stage },
    responseType: 'blob',
  });
  return response.data;
},
```

### Pattern 2: File Input with MUI Styling

MUI v7 has no built-in file upload component. Standard pattern is a hidden `<input type="file">` inside a styled `<label>`:

```jsx
// Inside Controller render prop
const [selectedFile, setSelectedFile] = useState(null);
const [fileError, setFileError] = useState('');

const handleFileChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.name.endsWith('.pdf')) {
    setFileError('Only PDF files are allowed.');
    setSelectedFile(null);
    return;
  }
  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    setFileError('File size must be 10MB or less.');
    setSelectedFile(null);
    return;
  }
  setFileError('');
  setSelectedFile(file);
};

// In JSX:
<Box>
  <input
    type="file"
    accept=".pdf"
    id="pdf-upload-input"
    style={{ display: 'none' }}
    onChange={handleFileChange}
  />
  <label htmlFor="pdf-upload-input">
    <Button variant="outlined" component="span" startIcon={<UploadFileIcon />}>
      {selectedFile ? 'Change PDF' : 'Attach PDF (Optional)'}
    </Button>
  </label>
  {selectedFile && (
    <Typography variant="body2" sx={{ mt: 1 }}>
      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
    </Typography>
  )}
  {fileError && (
    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
      {fileError}
    </Typography>
  )}
</Box>
```

Note: `component="span"` is used instead of `component="label"` for the inner Button to avoid nested `<label>` elements (which are invalid HTML). The outer `<label>` handles the click.

### Pattern 3: PDF View/Download from Detail Page

The `GET /api/records/{id}/pdf/view/?stage=created` endpoint returns HTTP 200 with `X-Accel-Redirect` header. Nginx intercepts and serves the binary file. From the browser's perspective, the response body is the PDF bytes.

Axios with `responseType: 'blob'` receives the binary correctly:

```js
// mailService.viewPDF returns a Blob
const blob = await mailService.viewPDF(mailId, 'created');
const url = URL.createObjectURL(blob);
window.open(url, '_blank');
// Cleanup after short delay to allow browser to open the tab
setTimeout(() => URL.revokeObjectURL(url), 10000);
```

For download instead of view-inline:
```js
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = attachment.original_filename || 'document.pdf';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
```

### Pattern 4: attachment_metadata in API Response

The `MailRecordDetailSerializer` already returns `attachment_metadata` as a field on every detail response. The shape is:

```json
{
  "has_attachment": true,
  "attachment_id": "uuid-string",
  "original_filename": "report.pdf",
  "file_size": 102400,
  "file_size_human": "100.0 KB",
  "upload_stage": "created",
  "uploaded_at": "2026-02-21T10:00:00+00:00",
  "uploaded_by": "john.smith"
}
```

When `has_attachment` is false, all other fields are null. Frontend checks `mail.attachment_metadata?.has_attachment`.

Note: `get_attachment_metadata()` on `MailRecord` returns only the FIRST current attachment (the one with `is_current=True` — singular). However, `get_pdf_metadata()` on the view endpoint returns ALL current attachments as a list (one per stage). For the detail page, `mail.attachment_metadata` from the serializer is the single-record shortcut and is sufficient for Phase 3.

### Pattern 5: role_badge Display

`MainLayout.jsx` already renders:
```jsx
<Chip label={user?.role || 'User'} size="small" color="secondary" />
```

The `user.role` comes directly from the API (`/api/users/me/`). The backend `User` model has `role` choices: `AG`, `DAG`, `SrAO`, `AAO`, `auditor`, `clerk`. The existing chip will show raw role strings. For `auditor` and `clerk`, the raw string is already human-readable enough. If a display label map is wanted:

```js
const ROLE_DISPLAY = {
  AG: 'AG',
  DAG: 'DAG',
  SrAO: 'Sr. AO',
  AAO: 'AAO',
  auditor: 'Auditor',
  clerk: 'Clerk',
};
// Usage: ROLE_DISPLAY[user?.role] || user?.role
```

### Anti-Patterns to Avoid

- **Sending the PDF in the initial createMail request**: The backend `POST /records/` endpoint only accepts `application/json`. Sending `multipart/form-data` there will fail. Always use the two-step create-then-upload approach.
- **Using `window.open(viewUrl)` with a plain URL**: The `/api/records/{id}/pdf/view/` endpoint requires the `Authorization: Bearer <token>` header. A plain `window.open(url)` call does not include this header and will get a 401. Must use Axios with `responseType: 'blob'`.
- **Nesting `<label>` inside MUI `Button component="label"`**: Button renders as `<label>`, and the nested `<input>` makes it valid, but adding another `<label>` inside causes invalid HTML. Use `component="span"` on the inner button and an outer `<label htmlFor="...">`.
- **Not revoking Blob URLs**: `URL.createObjectURL()` creates memory that persists until revoked or page unload. Always call `URL.revokeObjectURL(url)` after use.
- **Assuming `attachment_metadata` is always present**: The serializer returns it with `has_attachment: false` when no attachment exists. Always guard with `?.has_attachment` before rendering the PDF section.
- **Removing `canCreateMail()` logic without expanding it**: Currently `canCreateMail()` returns `user?.role === 'AG'` only. Phase 2 backend now allows ALL six roles to create. The `canCreateMail()` function in `AuthContext.jsx` must be updated to include DAG, SrAO, AAO, auditor, clerk — otherwise those users will not see the "Create Mail" button in the navbar even though the backend allows it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File type validation | Custom MIME sniffer | Check `file.name.endsWith('.pdf')` + backend validation | Backend already validates; client check is UX only |
| Auth-aware PDF serving | Proxy endpoint or signed URL | Axios `responseType: 'blob'` + Blob URL | Existing auth interceptor handles JWT header automatically |
| PDF viewer | Embed a third-party PDF renderer | `window.open` Blob URL (browser renders PDF natively) | Chrome/Firefox/Edge all render PDFs natively in new tabs |
| Form file state | Custom file store | `useState(null)` for `selectedFile` | RHF `register` doesn't handle file inputs well; manual state is simpler and more controllable |

---

## Common Pitfalls

### Pitfall 1: canCreateMail() Not Updated for New Roles

**What goes wrong:** SrAO, AAO, auditor, clerk users log in and see no "Create Mail" button. The backend accepts their requests but the frontend blocks navigation.

**Why it happens:** `AuthContext.jsx` line 114: `return user?.role === 'AG'` — hardcoded to AG only. Phase 2 expanded backend create permissions to all six roles but the frontend was not yet updated.

**How to avoid:** Update `canCreateMail()` to return `true` for all roles that the backend now allows: `AG`, `DAG`, `SrAO`, `AAO`, `auditor`, `clerk`. Per Phase 2 CONTEXT.md, all roles can create (with different scoping).

**Warning signs:** Non-AG users see no "Create Mail" button in the navbar.

### Pitfall 2: action_required_other State Left Orphaned

**What goes wrong:** After replacing the `Select` with a `TextField` for `action_required`, the `showOtherAction` state, the `action_required_other` field in `defaultValues`, and the conditional "Specify Other Action" block still exist in code and pollute `onSubmit` logic.

**Why it happens:** The `onSubmit` has this logic:
```js
action_required: data.action_required === 'Other' ? data.action_required_other : data.action_required
```
This logic should be removed — `action_required` is now just sent as-is.

**How to avoid:** When converting the field, remove the `showOtherAction` state, the `useEffect` that sets it, the `action_required_other` field from `defaultValues`, the conditional JSX block, and simplify the `onSubmit` mapping.

**Warning signs:** Extra state variables in component, dead JSX blocks, lint warnings about unused variables.

### Pitfall 3: PDF Upload on Create Breaks on Backend Validation Errors

**What goes wrong:** User fills the form, selects a PDF, submits. Mail creation fails (e.g., validation error). The PDF file is now lost from the input. User sees the error, fixes it, resubmits — but the file input no longer has the file selected (the component re-rendered or the input was reset).

**Why it happens:** `<input type="file">` state is not controlled by React state — it's an uncontrolled DOM element. After a failed submit and re-render, the file input shows no file even though `selectedFile` state still holds the reference.

**How to avoid:** Keep `selectedFile` in state (not reset on error). The actual file object persists in the state even if the DOM input is cleared. Use a `key` prop on the file input to force re-mount only when needed. Or simply: if mail creation fails with a validation error, don't reset `selectedFile` — the user can resubmit.

**Warning signs:** User has to re-select the PDF after fixing a form validation error.

### Pitfall 4: X-Accel-Redirect Not Working in Dev (Non-Docker)

**What goes wrong:** `GET /api/records/{id}/pdf/view/` returns HTTP 200 with `X-Accel-Redirect` header but the response body is empty (Django returns an empty `HttpResponse`). The Blob URL is empty.

**Why it happens:** X-Accel-Redirect only works when nginx intercepts the response. In development without nginx (running Django directly on port 8000), nginx is not in the path and does not serve the file. The Django response has no body.

**How to avoid:** In development (non-Docker), the PDF view endpoint returns an empty response. Either:
  a) Accept this as a dev-only limitation (PDF serving only works in Docker with nginx).
  b) Add a dev fallback in the Django view: if `DEBUG=True`, read the file and serve it directly.
  The current backend already uses X-Accel-Redirect unconditionally. For Phase 3 frontend work, test the PDF UI in Docker compose.

**Warning signs:** Empty PDF in browser tab, or Blob URL of size 0.

### Pitfall 5: attachment_metadata Returns Single Record, Not All Stages

**What goes wrong:** Frontend only shows one attachment even if there are two stages (created + closed).

**Why it happens:** `MailRecord.get_attachment_metadata()` (used by the serializer) returns only `current_attachment` — the single attachment with `is_current=True`. It does not return both the `created` and `closed` stage attachments.

**How to avoid:** For Phase 3, the requirement is only to show the attachment at the `created` stage (uploaded during mail creation). The single `attachment_metadata` from the serializer is sufficient. If both stages need to be shown, call `GET /api/records/{id}/pdf/` directly which returns all current attachments grouped by stage. For Phase 3 scope, use the serializer field only.

**Warning signs:** User uploads a PDF at `closed` stage but the detail page shows the `created` stage PDF. Only matters if both stages become relevant.

### Pitfall 6: Deprecated `remarks` Field Still Used in Frontend

**What goes wrong:** `MailDetailPage.jsx` uses `mail.current_action_remarks || mail.remarks` in the completion highlight section. The `remarks` field is marked deprecated in the model (`help_text="DEPRECATED"`). It should still be read for backward compatibility but should NOT be written to via new code.

**How to avoid:** During cleanup, audit all frontend reads of `mail.remarks`. They are acceptable as read-only fallbacks. Ensure no new form or service call writes to `remarks` directly.

---

## Code Examples

### Multipart PDF Upload via Axios

```js
// Source: Axios docs + backend endpoint contract from Phase 1
async uploadPDF(mailId, file, uploadStage = 'created') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_stage', uploadStage);
  const response = await api.post(`/records/${mailId}/pdf/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
},
```

### PDF Blob Download Pattern

```js
// Source: MDN Blob API + Axios responseType docs
async viewPDF(mailId, stage = 'created') {
  const response = await api.get(`/records/${mailId}/pdf/view/`, {
    params: { stage },
    responseType: 'blob',
  });
  return response.data; // Blob
},

// In component:
const handleViewPDF = async () => {
  try {
    const blob = await mailService.viewPDF(id, 'created');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  } catch (err) {
    setError('Failed to open PDF.');
  }
};
```

### Two-Step Create Mail + Upload PDF in onSubmit

```js
const onSubmit = async (data) => {
  setError('');
  setSaving(true);
  try {
    const mailData = { /* ... existing fields ... */ };
    const createdMail = await mailService.createMail(mailData);

    if (selectedFile) {
      try {
        await mailService.uploadPDF(createdMail.id, selectedFile, 'created');
      } catch (uploadErr) {
        // Non-fatal: mail was created, PDF upload failed
        navigate(`/mails/${createdMail.id}?pdfError=1`);
        return;
      }
    }

    navigate(`/mails/${createdMail.id}`);
  } catch (err) {
    setError(err.response?.data?.detail || 'Failed to create mail.');
  } finally {
    setSaving(false);
  }
};
```

### Updated canCreateMail() in AuthContext

```js
const canCreateMail = () => {
  // Phase 2 expanded create permissions to all six roles
  return ['AG', 'DAG', 'SrAO', 'AAO', 'auditor', 'clerk'].includes(user?.role);
};
```

### action_required as Free-Text TextField

```jsx
// Replace the Select FormControl block in CreateMailPage with:
<Controller
  name="action_required"
  control={control}
  render={({ field }) => (
    <TextField
      {...field}
      fullWidth
      label="Action Required"
      placeholder="e.g. Review and reply, Process for payment..."
      helperText="Describe the action required (optional)"
      error={!!errors.action_required}
    />
  )}
/>
```

Remove from `defaultValues`: `action_required: ''`, `action_required_other: ''`
Keep in `defaultValues`: `action_required: ''`
Remove: `showOtherAction` state, `useEffect` watching `actionRequired`, `actionRequired` watch variable, the conditional JSX block for "Specify Action".
Remove import: `ACTION_REQUIRED_OPTIONS` from `../utils/constants`.
In `onSubmit`: simplify to `action_required: data.action_required` (no more 'Other' sentinel check).

---

## Cleanup Analysis

### CLEANUP-01: Unused Python Imports

**Files to audit:**
- `backend/records/models.py` — has `from django.conf import settings as django_settings` (duplicate of `settings`). Check line 6.
- `backend/records/views.py` — verify `from sections.models import Section, Subsection` — Subsection was added in Phase 2 for type reference; confirm it's actually used.
- `backend/records/serializers.py` — all imports in use after Phase 2.
- `backend/users/serializers.py` — all imports in use.

Run: `python -m py_compile backend/records/models.py` and similar for a quick syntax check.

### CLEANUP-02: Unused Frontend Components

- `RemarksEditDialog.jsx`: Imported in `MailDetailPage.jsx` at line 33 and rendered at line 564 with `open={remarksDialogOpen}`. The button that opens it (`Edit Remarks`) was removed in a prior version but the dialog render is still there. Verify: search for `setRemarksDialogOpen(true)` — if no button calls it, the dialog is dead code. The current code shows `canEditRemarks() && mail.status !== 'Closed'` renders `Update Current Action` button, not `Edit Remarks`. The `remarksDialogOpen` state and `RemarksEditDialog` import appear unused.
- `ACTION_REQUIRED_OPTIONS` constant in `constants.js`: Only used in `CreateMailPage.jsx`. After converting to TextField, this will become unused. Remove the export (or keep if it might be referenced elsewhere — grep confirms only CreateMailPage uses it).
- `showOtherAction`, `action_required_other` form state in CreateMailPage: Fully dead after free-text conversion.

### CLEANUP-03: Sample Data Files

`backend/sample_data/sections_sample.csv` and `sections_sample.json` — these are import templates, not runtime data. They are not in git (check: `git ls-files backend/sample_data/`). If they are tracked, they should remain as reference files. No removal needed unless they contain sensitive data.

### CLEANUP-04: Deprecated Fields

- `MailRecord.remarks` — labeled `DEPRECATED` in model. Frontend reads it as fallback (`mail.current_action_remarks || mail.remarks`). Keep the read; do not add new writes. No removal in Phase 3 (would require migration).
- `MailAssignment.user_remarks` — labeled `DEPRECATED: Use AssignmentRemark timeline instead` in model. Backend still writes to it for backward compatibility. No frontend cleanup needed.

### CLEANUP-05: Build Artifacts in Git

- `.gitignore` already covers `frontend/dist/` and `backend/staticfiles/`.
- Verified: `frontend/dist/` is NOT tracked in git index.
- Check: `git ls-files | grep staticfiles` — if any files are tracked, they must be removed with `git rm --cached`.
- The `backend/__pycache__/` directory exists at project root (outside backend/) — check if tracked. `__pycache__/` is in `.gitignore` but verify it hasn't been accidentally committed.

### CLEANUP-06: Documentation

- `CLAUDE.md` still lists `action_required` dropdown options under "Mail Creation" success criteria: `action_required dropdown shows: Review, Approve, Process, File, Reply, Other`. Update to: `action_required is a free-text field (optional, max 500 chars)`.
- Role references in `CLAUDE.md` only mention AG/DAG/SrAO/AAO. Phase 2 added `auditor` and `clerk`. Update role descriptions if the file is to stay accurate.
- `MAP.md` — if it exists and describes the codebase structure, it may need updates for new files created in Phases 1-2.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| action_required dropdown (Select) | Free-text TextField | Decided in Phase 2 CONTEXT.md |
| AG-only create mail button | All six roles can create | Phase 2 backend; frontend not yet updated |
| No PDF attachment | PDF upload at create stage | Phase 1 backend endpoints live; Phase 3 wires frontend |
| Role badge shows only AG/DAG/SrAO/AAO | Must also show auditor/clerk | Phase 2 added roles |

---

## Open Questions

1. **PDF error handling UX on create**
   - What we know: If the mail is created but PDF upload fails, the mail exists without a PDF.
   - What's unclear: Should we show a warning on the detail page that PDF upload failed? Or just navigate normally and let the user retry upload from the detail page (if a detail-page upload button is added)?
   - Recommendation: Show a non-blocking warning alert on the detail page via URL query param `?pdfError=1` parsed in MailDetailPage. Keep it simple.

2. **Can users upload PDF from the detail page (not just create)?**
   - What we know: WORKFLOW-01/02 say PDF uploaded DURING mail creation. WORKFLOW-06/07 are about viewing.
   - What's unclear: Is there a "Upload PDF" button on the detail page as well?
   - Recommendation: Phase 3 scope is create-time upload only. Detail page shows existing attachment. No upload button on detail page unless explicitly requested.

3. **RemarksEditDialog truly unused?**
   - What we know: It's imported, the state exists, the component is rendered in JSX. But no button calls `setRemarksDialogOpen(true)`.
   - What's unclear: Was the "Edit Remarks" button intentionally removed, or is it a bug?
   - Recommendation: The `UpdateCurrentActionDialog` replaced it functionally. Safe to remove `RemarksEditDialog` entirely from MailDetailPage.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection: `frontend/src/pages/CreateMailPage.jsx`, `MailDetailPage.jsx`, `MainLayout.jsx`, `AuthContext.jsx`, `mailService.js`, `api.js`, `constants.js`
- Backend codebase: `records/models.py`, `records/views.py`, `records/serializers.py`, `users/models.py`, `users/serializers.py`
- Phase 2 summaries: `02-01-SUMMARY.md`, `02-02-SUMMARY.md`, `02-03-SUMMARY.md` — confirmed backend contracts
- `package.json` — confirmed installed library versions
- `.gitignore` — confirmed build artifact exclusions

### Secondary (MEDIUM confidence)
- MDN Web API: `URL.createObjectURL()`, `FormData`, `Blob` — standard browser APIs, stable
- Axios docs: `responseType: 'blob'` — standard documented feature
- MUI v7 `Button` with `component="span"` inside `<label>` — standard pattern for file inputs in MUI

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed, versions confirmed from package.json
- Architecture: HIGH — patterns derived from direct codebase inspection
- Pitfalls: HIGH — identified from actual code paths (canCreateMail, onSubmit logic, X-Accel-Redirect dev limitation)
- Cleanup: HIGH — grep and git ls-files used to verify actual state

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable stack, no fast-moving libraries involved)
