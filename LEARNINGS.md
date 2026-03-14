# Project Learnings - Mail Tracker

This document captures key issues encountered and their solutions for future reference.

---

## 1. Django REST Framework Pagination

**Issue**: Frontend pages not loading (blank page, infinite spinner)

**Root Cause**: DRF returns paginated responses by default:
```json
{
  "count": 10,
  "next": null,
  "previous": null,
  "results": [...]
}
```
Frontend was expecting a plain array.

**Solution**: Always handle paginated responses in service layer:
```javascript
async getSections() {
  const response = await api.get('/sections/');
  return response.data.results || response.data;  // Handle both formats
}
```

**Prevention**: Check DRF pagination settings in `settings.py` and ensure frontend services handle paginated responses from day one.

---

## 2. JWT Token Refresh Endpoint Mismatch

**Issue**: Login works initially but fails after token expires

**Root Cause**: Frontend calling wrong endpoint:
- Frontend: `/api/auth/token/refresh/`
- Backend: `/api/auth/refresh/`

**Solution**: Verify backend URL patterns in `urls.py` and match exactly in frontend.

**Prevention**: Document all API endpoints in a shared location. Test token refresh flow early in development.

---

## 3. MUI Grid vs Grid2 Compatibility

**Issue**: Blank page with error: `'@mui/material' does not provide an export named 'Grid2'`

**Root Cause**: `Grid2` is not available in MUI v5. It was introduced in MUI v6+.

**Solution**: Use standard `Grid` with `item` and `xs`/`md` props:
```jsx
// Wrong (MUI v6+ only)
<Grid2 size={{ xs: 12, md: 6 }}>

// Correct (MUI v5)
<Grid item xs={12} md={6}>
```

**Prevention**: Check MUI version in `package.json` before using new components. Stick to documented API for installed version.

---

## 4. Auth Context Initialization Blocking Render

**Issue**: Page stays blank (stuck on loading spinner)

**Root Cause**: Async token validation in useEffect was:
1. Making API calls before render
2. Not handling failures gracefully
3. Never setting `loading=false` in some code paths

**Solution**: Simplified to synchronous localStorage check:
```javascript
useEffect(() => {
  const currentUser = authService.getCurrentUser();
  const hasToken = authService.isAuthenticated();

  if (currentUser && hasToken) {
    setUser(currentUser);
  }
  setLoading(false);  // Always set immediately
}, []);
```

**Prevention**:
- Keep auth initialization simple and synchronous
- Let API interceptors handle token refresh on actual requests
- Always ensure `loading` state is set to `false`

---

## 5. Backend Serializer Field Names

**Issue**: Detail page showing "N/A" for related fields (Section, Assigned To, etc.)

**Root Cause**: Backend serializer returns nested objects with `_details` suffix:
```json
{
  "section": 1,
  "section_details": { "id": 1, "name": "Finance" }
}
```
Frontend was using `section.name` instead of `section_details.name`.

**Solution**: Use the `_details` suffix fields:
```javascript
{mail.section_details?.name || 'N/A'}
{mail.assigned_to_details?.full_name || 'N/A'}
```

**Prevention**: Check backend serializer output (`/api/endpoint/?format=json`) before building frontend components.

---

## 6. API Request Field Name Mismatch

**Issue**: Reassign functionality returning 400 Bad Request

**Root Cause**: Frontend sending `assigned_to`, backend expecting `new_handler`.

**Solution**: Match field names exactly as backend expects:
```javascript
const [formData, setFormData] = useState({
  new_handler: '',  // Not assigned_to
  remarks: '',
});
```

**Prevention**: Check backend view/serializer for expected field names before implementing frontend forms.

---

## 7. Axios Interceptor Token Refresh Loop

**Issue**: Potential infinite loop or hanging requests during token refresh

**Root Cause**: Token refresh endpoint going through same interceptor that triggers refresh.

**Solution**: Skip interceptor logic for auth endpoints:
```javascript
if (originalRequest.url?.includes('/auth/login') ||
    originalRequest.url?.includes('/auth/refresh')) {
  return Promise.reject(error);
}
```

**Prevention**: Design interceptors with exclusions for auth-related endpoints from the start.

---

## 8. PDF Upload Route Collision and Empty Local Downloads

**Issue**:
- PDF upload from the create/close flow was failing.
- No attachment icon appeared because no attachment metadata was stored.
- In split local dev, clicking View/Download returned a 0-byte file.

**Root Cause**:
1. Backend defined both `GET /api/records/{id}/pdf/` and `POST /api/records/{id}/pdf/` as separate DRF actions on the same route, which made the upload path unreliable.
2. PDF view relied on nginx-style `X-Accel-Redirect`, so Django `runserver` returned no real file bytes in separate local-dev mode.

**Solution**:
- Split the upload route to `POST /api/records/{id}/pdf/upload/`.
- Keep metadata at `GET /api/records/{id}/pdf/`.
- Keep viewing at `GET /api/records/{id}/pdf/view/?stage=created|closed`.
- Return the PDF with Django `FileResponse` so local backend/frontend dev servers can actually stream the file.
- Extend attachment metadata so the UI can render separate created-stage and closed-stage eye icons.

**Prevention**:
- Do not define multiple DRF actions with the same `url_path` for different methods unless the routing behavior is explicitly verified.
- Any file-view endpoint must be tested both behind nginx and with plain Django `runserver`.
- Verify uploaded attachment metadata is present in the list/detail API before debugging the frontend icon rendering.

---

## Quick Checklist for New Projects

1. [ ] Verify DRF pagination settings and handle in frontend services
2. [ ] Document all API endpoints with exact URLs
3. [ ] Check MUI version and use appropriate component API
4. [ ] Keep auth initialization synchronous, handle refresh in interceptors
5. [ ] Inspect actual API responses before building UI
6. [ ] Match frontend field names to backend serializer expectations
7. [ ] Exclude auth endpoints from token refresh interceptor logic
8. [ ] Test full auth flow: login, refresh, logout, expired token scenarios
9. [ ] Test file upload routes separately from file metadata routes
10. [ ] Test binary download/view behavior in both dev and proxied environments

---

## Development Tips

1. **Always check browser DevTools Console** - Most issues show clear error messages
2. **Use Network tab** - See actual API requests/responses
3. **Test API endpoints directly** - Use browser or Postman before frontend integration
4. **Check backend logs** - Django shows detailed error traces
5. **Hard refresh (Ctrl+Shift+R)** - Clear cached JavaScript modules
