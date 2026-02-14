# Troubleshooting: DAG Cannot Load Mail Details

## Problem
When DAG user opens a mail, the detail page fails to load.

## Root Cause Analysis

### ✅ Backend Status: WORKING
All backend tests pass successfully:
- API returns 200 OK
- Serialization works correctly
- Permissions are correct
- All data fields present

### ❌ Likely Issue: Frontend

Since backend works, the issue is in the frontend code.

---

## Backend Verification (PASSED)

### Test 1: Can DAG View Mail?
```bash
cd backend
python manage.py shell -c "
from users.models import User
from records.models import MailRecord

dag = User.objects.filter(role='DAG').first()
mail = MailRecord.objects.filter(assigned_to=dag).first()

print(f'Can view: {mail.can_view(dag)}')
"
```
**Result**: `Can view: True` ✅

### Test 2: Does API Return Data?
```bash
cd backend
python manage.py runserver
```

Then test:
```bash
# Get token first
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "dag_admin", "password": "your_password"}'

# Use token to get mail details
curl http://localhost:8000/api/records/33/ \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
**Result**: Returns full JSON with 34 fields ✅

### Test 3: Serializer Check
```bash
python manage.py shell -c "
from records.serializers import MailRecordDetailSerializer
# ... (see test code)
"
```
**Result**: Serialization successful ✅

---

## Frontend Debugging Steps

### Step 1: Check Browser Console
1. Open mail detail page as DAG
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Look for JavaScript errors (red text)

**Common errors to look for:**
- `Cannot read property 'X' of undefined`
- `TypeError: ...`
- `Network Error`

### Step 2: Check Network Tab
1. Open Developer Tools (F12)
2. Go to Network tab
3. Reload the page
4. Look for the API call to `/api/records/{id}/`

**Check:**
- Status code (should be 200)
- Response preview (should have data)
- Headers (should have Authorization token)

### Step 3: Check Frontend Code

Look in frontend code for:

**A. API Call**
```javascript
// frontend/src/services/recordsService.js or similar
axios.get(`/api/records/${id}/`)
```

**B. Data Handling**
```javascript
// Check if code expects fields that don't exist
const section = mail.section_details.name  // Might fail if section_details is null
```

**C. Conditional Rendering**
```javascript
// Should handle null/undefined gracefully
{mail.subsection_details?.name || 'N/A'}
```

---

## Common Frontend Issues & Fixes

### Issue 1: Null Reference Error
**Symptom**: `Cannot read property 'name' of null`

**Cause**: Code tries to access nested property without null check

**Fix**:
```javascript
// Before (breaks):
const sectionName = mail.section_details.name

// After (safe):
const sectionName = mail.section_details?.name || 'N/A'
```

### Issue 2: Wrong API Endpoint
**Symptom**: 404 Not Found in Network tab

**Cause**: Frontend calling wrong URL

**Check**:
```javascript
// Correct:
/api/records/33/

// Wrong:
/api/mails/33/
/records/33/
```

### Issue 3: Missing Authorization Header
**Symptom**: 401 Unauthorized

**Cause**: JWT token not sent or expired

**Fix**:
```javascript
// Ensure token is in headers
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
```

### Issue 4: CORS Error
**Symptom**: CORS policy error in console

**Cause**: Backend CORS settings

**Fix** (backend/config/settings.py):
```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
]
```

### Issue 5: Data Structure Mismatch
**Symptom**: Page partially loads or shows undefined

**Cause**: Frontend expects different field names

**Example**:
```javascript
// Frontend expects:
mail.section.name

// Backend returns:
mail.section_details.name
```

---

## Quick Test Script

Run this to verify backend is working:

```bash
cd backend
python manage.py shell
```

```python
from users.models import User
from records.models import MailRecord
from rest_framework_simplejwt.tokens import RefreshToken
import requests

# Get DAG user
dag = User.objects.filter(role='DAG').first()
mail = MailRecord.objects.filter(assigned_to=dag).first()

# Get token
refresh = RefreshToken.for_user(dag)
token = str(refresh.access_token)

print(f"Mail ID: {mail.id}")
print(f"Token: {token[:50]}...")

# Test API
url = f'http://localhost:8000/api/records/{mail.id}/'
headers = {'Authorization': f'Bearer {token}'}
response = requests.get(url, headers=headers)

print(f"Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"SUCCESS! Got {len(data)} fields")
    print(f"Fields: {list(data.keys())[:15]}")
else:
    print(f"ERROR: {response.text}")
```

---

## Expected API Response Structure

When DAG requests mail details, the API returns:

```json
{
  "id": 33,
  "sl_no": "2026/027",
  "letter_no": "TEST/...",
  "mail_reference_subject": "...",
  "from_office": "...",
  "action_required": "Review",
  "action_required_other": null,
  "section": 1,
  "subsection": null,
  "due_date": "2026-02-22",
  "status": "In Progress",
  "date_of_completion": null,
  "is_multi_assigned": false,
  "initial_instructions": "...",
  "remarks": null,
  "consolidated_remarks": null,
  "created_at": "...",
  "updated_at": "...",
  "last_status_change": "...",

  "assigned_to_details": {
    "id": 2,
    "full_name": "DAG Admin",
    "role": "DAG",
    "sections_display": "AMG-I",
    "subsection": null,
    "subsection_name": null
  },

  "current_handler_details": {
    "id": 2,
    "full_name": "DAG Admin",
    "role": "DAG",
    "sections_display": "AMG-I",
    "subsection": null,
    "subsection_name": null
  },

  "section_details": {
    "id": 1,
    "name": "AMG-I",
    "description": "",
    "directly_under_ag": false,
    "subsections": [...],
    "created_at": "..."
  },

  "subsection_details": null,  // Can be null!

  "monitoring_officer_details": {...},
  "created_by_details": {...},

  "assignments": [...],

  "time_in_stage": "5 hours 23 mins",
  "is_overdue": false,
  "active_assignments_count": 2
}
```

**⚠️ Important**: Some fields can be `null`:
- `subsection_details` - if mail not assigned to subsection
- `action_required_other` - if action is not "Other"
- `date_of_completion` - if mail not closed
- `remarks` - deprecated field

Frontend must handle these nulls gracefully!

---

## Solution Checklist

- [ ] Backend API returns 200 OK (test with curl/Postman)
- [ ] Browser console shows no errors
- [ ] Network tab shows successful API call
- [ ] JWT token is valid and sent in headers
- [ ] Frontend handles null fields safely (use `?.` operator)
- [ ] Frontend expects correct field names (`section_details` not `section`)
- [ ] CORS is configured correctly
- [ ] API base URL is correct in frontend config

---

## If Issue Persists

1. **Share browser console errors** - Screenshot of red errors in Console tab
2. **Share network request** - Screenshot of Network tab showing the API call
3. **Share frontend code** - The component that loads mail details
4. **Test with different user** - Does it work for AG? SrAO?

---

## Contact Points

- Backend logs: `backend/` (check terminal running runserver)
- Frontend logs: Browser Developer Tools → Console
- API testing: Use Postman or curl to isolate backend vs frontend

**Current Status**: Backend ✅ Working | Frontend ❌ Needs Investigation
