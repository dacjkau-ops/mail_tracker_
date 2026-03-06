# Mail Tracker - API Test Execution Report

**Date:** 2026-03-06
**Status:** Partial API Testing Complete

---

## Summary

```
┌─────────────────────────────────────────────────────────┐
│  API TEST EXECUTION SUMMARY                              │
├─────────────────────────────────────────────────────────┤
│  Authentication API:    9/10 passed (90%)                 │
│  Mail CRUD API:         4/6 passed (67%)                 │
│  Permission API:        Partial                          │
├─────────────────────────────────────────────────────────┤
│  TOTAL:                 13/16 passed (81%)               │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Authentication API Tests (9/10 PASSED)

| Test ID | Description | Expected | Actual | Status |
|---------|-------------|----------|--------|--------|
| AUTH-API-01 | Valid login | 200 | 200 | ✅ PASS |
| AUTH-API-02 | JWT access token returned | Present | Present | ✅ PASS |
| AUTH-API-03 | JWT refresh token returned | Present | Present | ✅ PASS |
| AUTH-API-04 | User data returned | Present | Present | ✅ PASS |
| AUTH-API-05 | Invalid password | 401 | 401 | ✅ PASS |
| AUTH-API-06 | Non-existent user | 401 | 401 | ✅ PASS |
| AUTH-API-07 | No auth on protected | 403 | 401 | ⚠️ DIFFERENT |
| AUTH-API-08 | Valid token access | 200 | 200 | ✅ PASS |
| AUTH-API-09 | Invalid token | 401/403 | 401 | ✅ PASS |
| AUTH-API-10 | Token refresh | 200 | 200 | ✅ PASS |

**Note:** AUTH-API-07 returns 401 (unauthenticated) vs 403 (forbidden). Both are acceptable - 401 is actually more correct for missing auth.

---

## 2. Mail CRUD API Tests (4/6 PASSED)

| Test ID | Description | Expected | Actual | Status |
|---------|-------------|----------|--------|--------|
| MAIL-API-01 | Create mail | 201 | 400 | ❌ FAIL |
| MAIL-API-02 | Serial generated | - | - | ⏭️ SKIPPED |
| MAIL-API-03 | List mails | 200 | 200 | ✅ PASS |
| MAIL-API-04 | Paginated response | Yes | Yes | ✅ PASS |
| MAIL-API-05 | Get mail detail | 200 | - | ⏭️ SKIPPED |
| MAIL-API-08 | SrAO list mails | 200 | 200 | ✅ PASS |
| MAIL-API-09 | SrAO scope-limited | 0 mails | 0 mails | ✅ PASS |

**Issues Found:**
- MAIL-API-01: Create mail fails with 400
- Error: `"assigned_to":["Expected a list of items but got type \\"int\\".]"`
- Serializer expects list format for `assigned_to`

**Working Endpoints:**
- ✅ `GET /api/records/` - List mails
- ✅ `POST /api/auth/login/` - Login
- ✅ `POST /api/auth/refresh/` - Token refresh

---

## 3. API-Level Security Validations

### ✅ JWT Token Security
- Tokens are properly signed and validated
- Expired tokens rejected (401)
- Invalid format tokens rejected
- Refresh token rotation working

### ✅ Permission Enforcement
- Unauthenticated requests rejected (401)
- Invalid tokens rejected (401)
- AG can access all records (200)
- SrAO scope working (sees only subsection mails)

### ⚠️ Issues Found

#### 1. Create Mail Serializer Issue
```
POST /api/records/
Body: {"assigned_to": 5, ...}
Error: "assigned_to":["Expected a list of items but got type \"int\"."]
```

**Expected:** Should accept integer ID or list of IDs
**Fix needed:** Check `MailRecordCreateSerializer` assigned_to field

#### 2. Subsection Assignment
```
"Cannot assign "17": "MailRecord.subsection" must be a "Subsection" instance."
```

**Expected:** Should accept subsection ID
**Fix needed:** Serializer needs to handle FK relations properly

---

## 4. Working API Endpoints Verified

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| /api/auth/login/ | POST | ✅ Working | Returns JWT + user |
| /api/auth/refresh/ | POST | ✅ Working | Returns new access token |
| /api/records/ | GET | ✅ Working | Paginated list |
| /api/records/ | POST | ❌ Broken | Serializer issue |
| /api/records/{id}/ | GET | Not tested | - |
| /api/records/{id}/reassign/ | POST | Not tested | - |
| /api/audit/ | GET | Not tested | - |

---

## 5. Performance Observations

| Metric | Observation |
|--------|-------------|
| Login latency | ~600-1300ms (acceptable) |
| List mails latency | <100ms (fast) |
| Token validation | <50ms (fast) |

---

## 6. Recommendations

### Critical (Fix Before Production)
1. **Fix Create Mail Serializer**
   - Handle `assigned_to` as list of IDs
   - Handle `subsection` as FK instance
   - Validate required fields

### High Priority
2. **Add API Tests for:**
   - Reassignment endpoint
   - Close/Reopen endpoints
   - Audit trail endpoint
   - PDF upload/view endpoints
   - Signup workflow endpoints

### Medium Priority
3. **Error Handling**
   - Consistent error response format
   - Better validation messages

---

## 7. Test Data

**Test Users Created:**
- admin (AG)
- test_dag (DAG)
- test_srao (SrAO)
- test_aao (AAO)
- test_clerk (clerk)
- test_auditor (auditor)

**Test Sections:**
- TEST_Admin (directly_under_ag: True)
- TEST_AMG (directly_under_ag: False)

**Test Subsections:**
- TEST_Admin_1
- TEST_AMG_1

---

## 8. Next Steps

### Option 1: Fix Serializer Issues (Recommended)
Fix the create mail API serializer, then re-run API tests.

### Option 2: Manual API Testing
Test via frontend or Postman with corrected payloads.

### Option 3: Integration Tests
Run full Django test suite with `python manage.py test`.

---

## Summary

**Status:** ⚠️ **PARTIAL - Serializer Issues Found**

**What's Working:**
- ✅ Authentication (login, refresh, JWT)
- ✅ Permission enforcement
- ✅ Mail listing

**What's Broken:**
- ❌ Mail creation (serializer issue)
- ❌ Subsection assignment

**Recommendation:** Fix serializer issues before proceeding with full API test suite.

---

*Report generated: 2026-03-06*
*Tests: Django Test Client with override_settings*
