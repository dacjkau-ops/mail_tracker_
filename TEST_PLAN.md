# Mail Tracker v1.3 - Comprehensive Test Plan

**Version:** v1.3 (includes v1.2 features + Signup workflow)
**Date:** 2026-03-06
**Status:** Pending Approval

---

## Executive Summary

This test plan covers end-to-end testing of the Mail Tracker application including authentication, user management, mail lifecycle, role-based permissions, PDF handling, and stress testing.

**Test Categories:**
1. Authentication & Authorization (45 test cases)
2. User Management (38 test cases)
3. Mail Record Lifecycle (52 test cases)
4. Role-Based Permissions (48 test cases)
5. Section/Subsection Hierarchy (24 test cases)
6. PDF Attachment Handling (18 test cases)
7. Audit Trail (22 test cases)
8. Signup Workflow (28 test cases)
9. Edge Cases & Boundary Conditions (35 test cases)
10. Security Testing (32 test cases)
11. Stress & Performance Testing (15 test cases)

**Total: 357 Test Cases**

---

## 1. Authentication & Authorization Tests (45 cases)

### 1.1 Login Tests
| TC-ID | Test Case | Steps | Expected Result | Priority | Evaluation Metric |
|-------|-----------|-------|-----------------|----------|-------------------|
| AUTH-01 | Valid user login | Enter valid username/password | JWT token returned, user data included | P0 | Pass/Fail |
| AUTH-02 | Invalid username | Enter non-existent username | 401 Unauthorized, error message | P0 | Pass/Fail |
| AUTH-03 | Invalid password | Enter wrong password | 401 Unauthorized, error message | P0 | Pass/Fail |
| AUTH-04 | Empty username | Submit empty username | 400 Bad Request, validation error | P0 | Pass/Fail |
| AUTH-05 | Empty password | Submit empty password | 400 Bad Request, validation error | P0 | Pass/Fail |
| AUTH-06 | SQL injection in username | Enter `' OR '1'='1` | 401 Unauthorized (sanitized) | P1 | Pass/Fail |
| AUTH-07 | XSS attempt in username | Enter `<script>alert(1)</script>` | 401 or sanitized response | P1 | Pass/Fail |
| AUTH-08 | Case sensitivity | Test username case variations | Case-insensitive match expected | P2 | Pass/Fail |
| AUTH-09 | Special characters in password | Test `!@#$%^&*()_+-=[]{}|;':\",./<>?` | Login successful | P1 | Pass/Fail |
| AUTH-10 | Unicode in password | Test `密码パスワード🔐` | Login successful | P2 | Pass/Fail |
| AUTH-11 | Very long password (256+ chars) | Create user with 256 char password | Login works, no truncation | P2 | Pass/Fail |
| AUTH-12 | Inactive user login | Try to login with `is_active=False` user | 403 Forbidden | P0 | Pass/Fail |

### 1.2 Token Tests
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| AUTH-13 | Access token expiry | Wait 24 hours, use token | 401 Unauthorized | P0 | Pass/Fail |
| AUTH-14 | Refresh token | Use valid refresh token | New access token returned | P0 | Pass/Fail |
| AUTH-15 | Refresh token expiry | Wait 7 days, refresh | 401 Unauthorized | P0 | Pass/Fail |
| AUTH-16 | Invalid token | Send garbage JWT | 401 Unauthorized | P0 | Pass/Fail |
| AUTH-17 | Token format | Send malformed token | 401 Unauthorized | P0 | Pass/Fail |
| AUTH-18 | Missing Authorization header | Omit header entirely | 401 Unauthorized | P0 | Pass/Fail |
| AUTH-19 | Token with wrong prefix | Send `Token abc` instead of `Bearer` | 401 Unauthorized | P1 | Pass/Fail |

### 1.3 Change Password Tests
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| AUTH-20 | Valid password change | Enter correct current + new password | Success message, can login with new | P0 | Pass/Fail |
| AUTH-21 | Wrong current password | Enter incorrect current password | 400 Bad Request | P0 | Pass/Fail |
| AUTH-22 | Same password | Set new password = current | 400 Bad Request | P1 | Pass/Fail |
| AUTH-23 | Weak password | Set password = "123" | 400 Bad Request (if validated) | P1 | Pass/Fail |
| AUTH-24 | Password without JWT | Call /change-password/ without token | Should work (AllowAny) | P0 | Pass/Fail |
| AUTH-25 | Change then verify old fails | Try login with old password | 401 Unauthorized | P0 | Pass/Fail |
| AUTH-26 | Change then verify new works | Try login with new password | 200 OK | P0 | Pass/Fail |

### 1.4 Session Tests
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| AUTH-27 | Session persistence | Login, refresh page, check auth | User still authenticated | P0 | Pass/Fail |
| AUTH-28 | Session after logout | Logout, check localStorage | Token removed, redirect to login | P0 | Pass/Fail |
| AUTH-29 | Multiple logins | Login from 2 browsers simultaneously | Both sessions valid | P2 | Pass/Fail |
| AUTH-30 | Concurrent requests | Send 50 parallel requests with valid token | All return 200 | P2 | Pass/Fail |

### 1.5 Protected Route Tests
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| AUTH-31 | /api/records/ without auth | No Authorization header | 403 Forbidden | P0 | Pass/Fail |
| AUTH-32 | /api/users/ without auth | No Authorization header | 403 Forbidden | P0 | Pass/Fail |
| AUTH-33 | /api/sections/ without auth | No Authorization header | 403 Forbidden | P0 | Pass/Fail |
| AUTH-34 | /api/audit/ without auth | No Authorization header | 403 Forbidden | P0 | Pass/Fail |
| AUTH-35 | Valid token with expired session | Use expired token | 401/403 Forbidden | P0 | Pass/Fail |
| AUTH-36 | Valid token after user deleted | Delete user, use their token | 403 Forbidden | P1 | Pass/Fail |

### 1.6 Frontend Auth Flow
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| AUTH-37 | Login redirect | Access /mails while logged out | Redirect to /login | P0 | Pass/Fail |
| AUTH-38 | Post-login redirect | Login after accessing protected route | Redirect to original route | P2 | Pass/Fail |
| AUTH-39 | Login page while logged in | Access /login when authenticated | Redirect to dashboard | P1 | Pass/Fail |
| AUTH-40 | Token refresh in background | Use app for >1 hour | Token refreshed automatically | P1 | Pass/Fail |
| AUTH-41 | Handle 401 gracefully | Force token expiry, trigger action | Redirect to login with message | P1 | Pass/Fail |
| AUTH-42 | Network error during login | Disconnect internet, try login | Show error message, no crash | P1 | Pass/Fail |
| AUTH-43 | Loading states | Login, check button state | Button shows loading, disabled | P1 | Pass/Fail |
| AUTH-44 | Form validation | Submit empty form | Show validation errors | P1 | Pass/Fail |
| AUTH-45 | Remember me (if applicable) | Check "Remember me", close browser | Session persisted | P2 | Pass/Fail |

---

## 2. User Management Tests (38 cases)

### 2.1 User Creation (Admin)
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| USER-01 | Create AG user | Via admin, fill all fields | User created, can login | P0 | Pass/Fail |
| USER-02 | Create DAG with sections | Assign multiple sections | Sections saved correctly | P0 | Pass/Fail |
| USER-03 | Create SrAO with subsection | Select subsection | Subsection linked | P0 | Pass/Fail |
| USER-04 | Create AAO | Set role=AAO | User created | P0 | Pass/Fail |
| USER-05 | Create auditor | Set role=auditor | User created | P0 | Pass/Fail |
| USER-06 | Create clerk | Set role=clerk | User created | P0 | Pass/Fail |
| USER-07 | Duplicate username | Try to create user with existing username | Validation error | P0 | Pass/Fail |
| USER-08 | Duplicate email | Try duplicate email | Validation error | P1 | Pass/Fail |
| USER-09 | Password hashing | Create user, check DB | Password is hashed (not plaintext) | P0 | Pass/Fail |
| USER-10 | Empty required fields | Leave username blank | Validation error | P1 | Pass/Fail |
| USER-11 | Invalid email format | Enter "not-an-email" | Validation error | P1 | Pass/Fail |
| USER-12 | Long username (150+ chars) | Create with 150 char username | Success | P2 | Pass/Fail |

### 2.2 User Update
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| USER-13 | Update own profile | Change full_name | Updated successfully | P0 | Pass/Fail |
| USER-14 | Change user sections (DAG) | Add/remove sections | Sections updated | P1 | Pass/Fail |
| USER-15 | Change user subsection | Change SrAO's subsection | Subsection updated | P1 | Pass/Fail |
| USER-16 | Deactivate user | Set is_active=False | User cannot login | P0 | Pass/Fail |
| USER-17 | Reactivate user | Set is_active=True | User can login again | P0 | Pass/Fail |
| USER-18 | Update password via admin | Set new password in admin | Password hashed, works | P1 | Pass/Fail |

### 2.3 Bulk Import
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| USER-19 | Import valid CSV | Upload users_sample.csv | All users created | P0 | Pass/Fail |
| USER-20 | Import valid JSON | Upload JSON format | All users created | P0 | Pass/Fail |
| USER-21 | Import with sections (DAG) | CSV with sections column | DAG sections populated | P1 | Pass/Fail |
| USER-22 | Import with subsection | CSV with subsection column | Subsection linked | P1 | Pass/Fail |
| USER-23 | Import duplicate usernames | CSV with duplicate usernames | Second skipped or error | P1 | Pass/Fail |
| USER-24 | Import invalid role | CSV with role="Invalid" | Error or skipped | P1 | Pass/Fail |
| USER-25 | Import missing required field | Omit username column | Error | P1 | Pass/Fail |
| USER-26 | Import empty file | Upload empty CSV | Error message | P2 | Pass/Fail |
| USER-27 | Import malformed CSV | Upload corrupted CSV | Graceful error | P2 | Pass/Fail |
| USER-28 | Role normalization (SRAO→SrAO) | Import with SRAO | Normalized to SrAO | P1 | Pass/Fail |
| USER-29 | Bulk create efficiency | Import 100 users | Completed in <5 seconds | P2 | Time |

### 2.4 User Listing & Queries
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| USER-30 | List all users | GET /api/users/ | Returns user list | P0 | Pass/Fail |
| USER-31 | Filter by role | ?role=DAG | Only DAG users | P1 | Pass/Fail |
| USER-32 | Filter by section | ?section=1 | Users in that section | P1 | Pass/Fail |
| USER-33 | Minimal user list | GET /api/users/list_minimal/ | Returns minimal fields | P0 | Pass/Fail |
| USER-34 | Current user endpoint | GET /api/users/me/ | Returns current user | P0 | Pass/Fail |
| USER-35 | List excludes inactive | Default list | is_active=False hidden | P1 | Pass/Fail |
| USER-36 | Include inactive with flag | ?is_active=false | Shows inactive users | P2 | Pass/Fail |

### 2.5 Delete All Data (Admin Action)
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| USER-37 | Delete all data action | Click "Delete All Data" in admin | All data deleted, superusers kept | P0 | Pass/Fail |
| USER-38 | Verify superuser remains | Check after delete | Superuser still exists | P0 | Pass/Fail |

---

## 3. Mail Record Lifecycle Tests (52 cases)

### 3.1 Mail Creation
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| MAIL-01 | AG creates mail | Login as AG, create mail | Mail created, sl_no generated | P0 | Pass/Fail |
| MAIL-02 | DAG creates mail | Login as DAG, create mail | Mail created, section auto-set | P0 | Pass/Fail |
| MAIL-03 | SrAO creates mail | Login as SrAO, create mail | Mail created, subsection scoped | P0 | Pass/Fail |
| MAIL-04 | Clerk creates mail | Login as clerk, create | Mail created | P0 | Pass/Fail |
| MAIL-05 | Auditor creates mail | Login as auditor, create | Mail created (if configured) | P1 | Pass/Fail |
| MAIL-06 | Serial number format | Create mail in 2026 | sl_no = "2026/001" | P0 | Pass/Fail |
| MAIL-07 | Serial reset on new year | Create mail in 2027 | sl_no = "2027/001" | P1 | Pass/Fail |
| MAIL-08 | Auto status assignment | Create mail with assignee | status="Assigned" | P0 | Pass/Fail |
| MAIL-09 | Due date validation | Set due_date in past | Rejected or warning | P1 | Pass/Fail |
| MAIL-10 | Monitoring officer auto-set | Create with assignee | monitoring_officer = assignee's DAG | P0 | Pass/Fail |
| MAIL-11 | Current handler set | Create with assignee | current_handler = assigned_to | P0 | Pass/Fail |
| MAIL-12 | Section derived from assignee | Create mail, select assignee | Section auto-populated | P1 | Pass/Fail |
| MAIL-13 | Empty action_required | Submit empty action | Validation error (if required) | P1 | Pass/Fail |
| MAIL-14 | Long action_required (500+ chars) | Enter 501 characters | Rejected or truncated | P2 | Pass/Fail |
| MAIL-15 | Create with multiple assignees | AG multi-assigns to 3 users | 3 MailAssignment rows | P0 | Pass/Fail |

### 3.2 Mail Listing
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| MAIL-16 | AG sees all mails | List as AG | All records returned | P0 | Pass/Fail |
| MAIL-17 | DAG sees managed section | List as DAG | Only managed section mails | P0 | Pass/Fail |
| MAIL-18 | SrAO sees own subsection | List as SrAO | Only own subsection mails | P0 | Pass/Fail |
| MAIL-19 | Filter by status | ?status=Assigned | Only assigned mails | P1 | Pass/Fail |
| MAIL-20 | Search by sl_no | ?search=2026/001 | Matching record | P1 | Pass/Fail |
| MAIL-21 | Search by letter_no | ?search=LET-123 | Matching records | P1 | Pass/Fail |
| MAIL-22 | Search by subject | ?search="Annual Report" | Matching records | P1 | Pass/Fail |
| MAIL-23 | Pagination | ?page=2&page_size=25 | Returns 25 records, page 2 | P0 | Pass/Fail |
| MAIL-24 | Page size 50 | ?page_size=50 | Returns 50 records | P1 | Pass/Fail |
| MAIL-25 | Page size 100 | ?page_size=100 | Returns 100 records | P1 | Pass/Fail |
| MAIL-26 | Created by me filter | ?scope=created_by_me | Mails I created | P1 | Pass/Fail |
| MAIL-27 | Assigned to me filter | ?scope=assigned | Mails assigned to me | P1 | Pass/Fail |
| MAIL-28 | Closed filter | ?scope=closed | Closed mails only | P1 | Pass/Fail |
| MAIL-29 | Overdue highlighting | View list with overdue mails | Red highlighting visible | P1 | Pass/Fail |
| MAIL-30 | Time in stage calculation | Check time_in_current_stage | Accurate calculation | P1 | Pass/Fail |

### 3.3 Mail Detail
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| MAIL-31 | View detail as AG | Access any mail | Full details visible | P0 | Pass/Fail |
| MAIL-32 | View detail as DAG | Access managed section mail | Details visible | P0 | Pass/Fail |
| MAIL-33 | View detail unauthorized | Access other section mail | 403 Forbidden | P0 | Pass/Fail |
| MAIL-34 | Detail shows assignments | View mail with assignments | Assignment rows visible | P0 | Pass/Fail |
| MAIL-35 | Detail shows audit trail | View any mail | Audit entries visible | P0 | Pass/Fail |
| MAIL-36 | Detail shows time in stage | Check detail view | time_in_current_stage displayed | P1 | Pass/Fail |
| MAIL-37 | Detail shows overdue status | View overdue mail | Overdue indicator visible | P1 | Pass/Fail |

### 3.4 Reassignment
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| MAIL-38 | AG reassigns to anyone | Reassign to any user | Success, status→In Progress | P0 | Pass/Fail |
| MAIL-39 | DAG reassigns within section | Reassign to same section user | Success | P0 | Pass/Fail |
| MAIL-40 | DAG cannot reassign outside | Try reassign to other section | 403 Forbidden | P0 | Pass/Fail |
| MAIL-41 | Current handler reassigns | Handler reassigns own mail | Success | P0 | Pass/Fail |
| MAIL-42 | Reassign without remarks | Submit empty remarks | Validation error | P0 | Pass/Fail |
| MAIL-43 | Reassign updates current_handler | Check after reassignment | current_handler = new user | P0 | Pass/Fail |
| MAIL-44 | Reassign updates status | Check status after | status="In Progress" | P0 | Pass/Fail |
| MAIL-45 | Multiple reassignments | Reassign A→B→C→D | Chain preserved in audit | P1 | Pass/Fail |
| MAIL-46 | Reassign to self | Try to reassign to self | Validation error | P2 | Pass/Fail |
| MAIL-47 | Reassign to same user | Reassign to current handler | Validation error | P2 | Pass/Fail |
| MAIL-48 | Reassign closed mail | Try to reassign closed mail | 400/403 Error | P1 | Pass/Fail |

### 3.5 Closing Mail
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| MAIL-49 | AG closes any mail | Close as AG | Success, status=Closed | P0 | Pass/Fail |
| MAIL-50 | DAG closes own mail | Close as current handler | Success | P0 | Pass/Fail |
| MAIL-51 | SrAO closes own mail | Close as current handler | Success | P0 | Pass/Fail |
| MAIL-52 | Close without remarks | Submit empty final_remarks | Validation error | P0 | Pass/Fail |
| MAIL-53 | Close sets completion date | Check after close | date_of_completion = today | P0 | Pass/Fail |
| MAIL-54 | Close already closed mail | Try close again | 400 Error | P1 | Pass/Fail |
| MAIL-55 | Unauthorized close attempt | SrAO tries to close other's mail | 403 Forbidden | P0 | Pass/Fail |

### 3.6 Reopening Mail
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| MAIL-56 | AG reopens closed mail | Reopen as AG | Success, status=In Progress | P0 | Pass/Fail |
| MAIL-57 | DAG cannot reopen | Try reopen as DAG | 403 Forbidden | P0 | Pass/Fail |
| MAIL-58 | Reopen clears completion date | Check after reopen | date_of_completion = null | P0 | Pass/Fail |
| MAIL-59 | Reopen requires remarks | Submit without remarks | Validation error | P0 | Pass/Fail |
| MAIL-60 | Reopen open mail | Try reopen already open mail | 400 Error | P1 | Pass/Fail |

### 3.7 Multi-Assignment
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| MAIL-61 | AG multi-assigns | Assign to 3 users simultaneously | 3 active assignments | P0 | Pass/Fail |
| MAIL-62 | DAG multi-assigns | Assign within section | Success | P0 | Pass/Fail |
| MAIL-63 | Multi-assignment visibility | View mail as one assignee | Mail visible | P0 | Pass/Fail |
| MAIL-64 | Complete individual assignment | Mark one assignment complete | Others remain active | P0 | Pass/Fail |
| MAIL-65 | Assignment remark timeline | Add remarks to assignment | Timeline visible | P1 | Pass/Fail |

### 3.8 Assignment Remarks
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| MAIL-66 | Add remark to assignment | POST to add_remark | Remark saved, audit logged | P0 | Pass/Fail |
| MAIL-67 | Remark appears in timeline | View assignment details | Remarks chronologically listed | P1 | Pass/Fail |
| MAIL-68 | Update own remarks | Try edit existing remark | Not allowed (immutable) | P1 | Pass/Fail |
| MAIL-69 | Current assignee adds remark | As current assignee, add remark | Success | P0 | Pass/Fail |
| MAIL-70 | Unauthorized remark | Non-assignee tries to add | 403 Forbidden | P0 | Pass/Fail |

---

## 4. Role-Based Permissions Tests (48 cases)

### 4.1 AG Permissions
| TC-ID | Test Case | AG Action | Expected Result | Priority | Metric |
|-------|-----------|-----------|-----------------|----------|--------|
| ROLE-01 | View all | Access any mail | Allowed | P0 | Pass/Fail |
| ROLE-02 | Create in any section | Create mail for any section | Allowed | P0 | Pass/Fail |
| ROLE-03 | Reassign anyone | Reassign to any user | Allowed | P0 | Pass/Fail |
| ROLE-04 | Close any | Close any mail | Allowed | P0 | Pass/Fail |
| ROLE-05 | Reopen closed | Reopen any closed mail | Allowed | P0 | Pass/Fail |
| ROLE-06 | Delete all data | Use admin delete action | Allowed | P0 | Pass/Fail |
| ROLE-07 | View all users | List users | Allowed | P0 | Pass/Fail |
| ROLE-08 | Create users | Create any role | Allowed | P0 | Pass/Fail |

### 4.2 DAG Permissions
| TC-ID | Test Case | DAG Action | Expected Result | Priority | Metric |
|-------|-----------|------------|------------|----------|--------|
| ROLE-09 | View managed section | View own section mails | Allowed | P0 | Pass/Fail |
| ROLE-10 | View other section | Try other section | 403 Forbidden | P0 | Pass/Fail |
| ROLE-11 | Create in own section | Create mail | Allowed | P0 | Pass/Fail |
| ROLE-12 | Create in other section | Try create for other | 403 Forbidden | P0 | Pass/Fail |
| ROLE-13 | Reassign within section | Reassign to section users | Allowed | P0 | Pass/Fail |
| ROLE-14 | Reassign outside section | Try reassign outside | 403 Forbidden | P0 | Pass/Fail |
| ROLE-15 | Close own mail | Close as handler | Allowed | P0 | Pass/Fail |
| ROLE-16 | Close other's mail | Try close other DAG's | 403 Forbidden | P0 | Pass/Fail |
| ROLE-17 | Reopen any | Try reopen | 403 Forbidden | P0 | Pass/Fail |
| ROLE-18 | Multi-assign in section | Multi-assign | Allowed | P0 | Pass/Fail |
| ROLE-19 | Multi-assign outside | Try multi-assign outside | 403 Forbidden | P0 | Pass/Fail |
| ROLE-20 | View subordinates | View SrAO/AAO in section | Allowed | P1 | Pass/Fail |

### 4.3 SrAO/AAO Permissions
| TC-ID | Test Case | SrAO Action | Expected Result | Priority | Metric |
|-------|-----------|-------------|------------|----------|--------|
| ROLE-21 | View own subsection | View mails in subsection | Allowed | P0 | Pass/Fail |
| ROLE-22 | View other subsection | Try other subsection | 403 Forbidden | P0 | Pass/Fail |
| ROLE-23 | Create in own subsection | Create mail | Allowed | P0 | Pass/Fail |
| ROLE-24 | Create in other subsection | Try create for other | 403 Forbidden | P0 | Pass/Fail |
| ROLE-25 | Reassign own mail | Reassign mail assigned to self | Allowed | P0 | Pass/Fail |
| ROLE-26 | Reassign other's mail | Try reassign other's | 403 Forbidden | P0 | Pass/Fail |
| ROLE-27 | Close own mail | Close as handler | Allowed | P0 | Pass/Fail |
| ROLE-28 | Close other's mail | Try close other's | 403 Forbidden | P0 | Pass/Fail |
| ROLE-29 | Reopen any | Try reopen | 403 Forbidden | P0 | Pass/Fail |
| ROLE-30 | Edit remarks | Edit own mail remarks | Allowed | P0 | Pass/Fail |
| ROLE-31 | Cannot create users | Try create user | 403 Forbidden | P1 | Pass/Fail |
| ROLE-32 | Cannot view all users | Try list all users | Limited/403 | P1 | Pass/Fail |

### 4.4 Auditor/Clerk Permissions
| TC-ID | Test Case | Action | Expected Result | Priority | Metric |
|-------|-----------|--------|-----------------|----------|--------|
| ROLE-33 | Auditor view scope | View configured subsections | Allowed | P0 | Pass/Fail |
| ROLE-34 | Clerk create scope | Create in own subsection | Allowed | P0 | Pass/Fail |
| ROLE-35 | Auditor cannot reassign | Try reassign | 403 Forbidden | P0 | Pass/Fail |
| ROLE-36 | Clerk cannot close others | Try close other's mail | 403 Forbidden | P0 | Pass/Fail |

### 4.5 Cross-Role Boundary Tests
| TC-ID | Test Case | Test Scenario | Expected Result | Priority | Metric |
|-------|-----------|---------------|-----------------|----------|--------|
| ROLE-37 | AG vs DAG boundaries | AG creates, DAG tries to view outside section | DAG can't see | P0 | Pass/Fail |
| ROLE-38 | DAG vs SrAO boundaries | DAG reassigns to SrAO, SrAO tries to reassign back | Allowed | P0 | Pass/Fail |
| ROLE-39 | Multi-role visibility | Mail assigned to SrAO in DAG section | Both can view | P1 | Pass/Fail |
| ROLE-40 | Hierarchy escalation | Mail moves AG→DAG→SrAO | Each can handle | P1 | Pass/Fail |
| ROLE-41 | Section isolation | Two DAGs, different sections | Cannot see each other | P0 | Pass/Fail |
| ROLE-42 | Subsection isolation | Two SrAOs, different subsections | Cannot see each other | P0 | Pass/Fail |
| ROLE-43 | Shared subsection visibility | Multiple users, same subsection | All can view | P0 | Pass/Fail |
| ROLE-44 | Reassignment chain permissions | A(SrAO)→B(SrAO) in same subsection | Both can handle | P1 | Pass/Fail |
| ROLE-45 | Auditor visibility limit | Auditor configured for specific subsections | Only those visible | P0 | Pass/Fail |
| ROLE-46 | Clerk creation scope | Clerk creates, DAG manages section | DAG can see | P1 | Pass/Fail |
| ROLE-47 | Historical visibility disabled | SrAO tries to view previously touched mail | 403 Forbidden | P0 | Pass/Fail |
| ROLE-48 | Scope-first enforcement | Non-AG role, scope check first | No fallback to touched | P0 | Pass/Fail |

---

## 5. Section/Subsection Hierarchy Tests (24 cases)

### 5.1 Section Tests
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| SECT-01 | Create section | Via admin, create section | Section created | P1 | Pass/Fail |
| SECT-02 | Section with DAG | Assign DAG to section | DAG can manage section | P0 | Pass/Fail |
| SECT-03 | Multiple DAGs per section | Assign 2 DAGs | Both can manage | P1 | Pass/Fail |
| SECT-04 | DAG with multiple sections | Assign sections A,B,C | DAG manages all three | P0 | Pass/Fail |
| SECT-05 | Section directly under AG | Set directly_under_ag=True | No DAG needed | P1 | Pass/Fail |
| SECT-06 | Duplicate section name | Try duplicate | Validation error | P1 | Pass/Fail |
| SECT-07 | Delete section | Delete with no subsections/mails | Deleted | P2 | Pass/Fail |
| SECT-08 | Delete section with mails | Try delete with existing mails | Protected/restricted | P1 | Pass/Fail |

### 5.2 Subsection Tests
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| SECT-09 | Create subsection | Create under section | Subsection created | P0 | Pass/Fail |
| SECT-10 | Assign SrAO to subsection | Set user's subsection | SrAO can access | P0 | Pass/Fail |
| SECT-11 | Subsection visibility | Create mail in subsection | SrAO can view | P0 | Pass/Fail |
| SECT-12 | Duplicate subsection name | Same name, different section | Allowed | P1 | Pass/Fail |
| SECT-13 | Duplicate in same section | Same name, same section | Validation error | P1 | Pass/Fail |
| SECT-14 | Subsection hierarchy | Get subsections via API | Nested under section | P1 | Pass/Fail |
| SECT-15 | Filter subsections by section | ?section=1 | Only that section's | P1 | Pass/Fail |

### 5.3 Bulk Import Sections
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| SECT-16 | Import CSV sections | Upload sections_sample.csv | Sections created | P0 | Pass/Fail |
| SECT-17 | Import JSON sections | Upload JSON format | Sections created | P0 | Pass/Fail |
| SECT-18 | Import with subsections | CSV with subsection_name | Subsections created | P1 | Pass/Fail |
| SECT-19 | Import directly_under_ag | Set flag in CSV | Flag set correctly | P1 | Pass/Fail |
| SECT-20 | Duplicate section import | Import same section twice | Second skipped | P2 | Pass/Fail |
| SECT-21 | Circular reference check | Self-referencing section | Prevented | P2 | Pass/Fail |

### 5.4 Hierarchy Logic
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| SECT-22 | get_dag() for SrAO | Get DAG of SrAO | Returns correct DAG | P0 | Pass/Fail |
| SECT-23 | get_dag() for directly_under_ag | Get DAG for section under AG | Returns AG | P0 | Pass/Fail |
| SECT-24 | get_dag() for DAG | Get DAG of DAG user | Returns AG | P0 | Pass/Fail |

---

## 6. PDF Attachment Tests (18 cases)

### 6.1 PDF Upload
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| PDF-01 | Upload valid PDF | Attach PDF to mail | Upload success | P0 | Pass/Fail |
| PDF-02 | Upload large PDF (>10MB) | Try large file | Rejected/limit enforced | P1 | Pass/Fail |
| PDF-03 | Upload non-PDF | Try .exe file | Rejected | P0 | Pass/Fail |
| PDF-04 | Upload image | Try .jpg | Rejected or converted | P1 | Pass/Fail |
| PDF-05 | Upload empty file | 0 byte file | Rejected | P2 | Pass/Fail |
| PDF-06 | Multiple uploads | Try upload second PDF | Replace or append based on design | P1 | Pass/Fail |

### 6.2 PDF Viewing
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| PDF-07 | View PDF via API | GET /pdf/view/ | X-Accel-Redirect header | P0 | Pass/Fail |
| PDF-08 | View PDF as authorized | User with view permission | PDF streams | P0 | Pass/Fail |
| PDF-09 | View PDF unauthorized | User without permission | 403 Forbidden | P0 | Pass/Fail |
| PDF-10 | View non-existent PDF | Try invalid UUID | 404 Not Found | P1 | Pass/Fail |
| PDF-11 | PDF icon in list | Mail with PDF | Paperclip icon visible | P0 | Pass/Fail |
| PDF-12 | Click PDF icon | Click icon | Opens PDF in new tab | P0 | Pass/Fail |

### 6.3 PDF Security
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| PDF-13 | Direct file access | Try access file directly | Blocked/protected | P0 | Pass/Fail |
| PDF-14 | Path traversal attempt | Try ../../../etc/passwd | Sanitized/blocked | P0 | Pass/Fail |
| PDF-15 | UUID guessing | Try random UUIDs | 404 Not Found | P1 | Pass/Fail |
| PDF-16 | PDF metadata leak | Check headers | No sensitive info | P2 | Pass/Fail |

### 6.4 PDF Storage
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| PDF-17 | Filename uniqueness | Check saved filename | UUID format, unique | P1 | Pass/Fail |
| PDF-18 | Delete mail with PDF | Delete mail record | PDF file also deleted | P1 | Pass/Fail |

---

## 7. Audit Trail Tests (22 cases)

### 7.1 Audit Logging
| TC-ID | Test Case | Action | Expected Audit Entry | Priority | Metric |
|-------|-----------|--------|---------------------|----------|--------|
| AUDIT-01 | CREATE logged | Create mail | CREATE entry with timestamp | P0 | Pass/Fail |
| AUDIT-02 | ASSIGN logged | Assign mail | ASSIGN entry | P0 | Pass/Fail |
| AUDIT-03 | REASSIGN logged | Reassign mail | REASSIGN entry with old/new | P0 | Pass/Fail |
| AUDIT-04 | CLOSE logged | Close mail | CLOSE entry with remarks | P0 | Pass/Fail |
| AUDIT-05 | REOPEN logged | Reopen mail | REOPEN entry | P0 | Pass/Fail |
| AUDIT-06 | Multi-assign logged | Multi-assign | Multiple ASSIGN entries | P1 | Pass/Fail |
| AUDIT-07 | Remark logged | Add remark | Entry with remark content | P1 | Pass/Fail |
| AUDIT-08 | Performed by correct | Check performed_by | Matches actual user | P0 | Pass/Fail |
| AUDIT-09 | Timestamp accurate | Check timestamp | Within seconds of action | P0 | Pass/Fail |
| AUDIT-10 | Mail record linked | Check mail_record FK | Correctly linked | P0 | Pass/Fail |

### 7.2 Audit Immutability
| TC-ID | Test Case | Action | Expected Result | Priority | Metric |
|-------|-----------|--------|-----------------|----------|--------|
| AUDIT-11 | Cannot edit audit | Try PATCH audit entry | 405 or 403 | P0 | Pass/Fail |
| AUDIT-12 | Cannot delete audit | Try DELETE audit entry | 405 or 403 | P0 | Pass/Fail |
| AUDIT-13 | Admin cannot edit | Via Django admin | No edit option | P0 | Pass/Fail |
| AUDIT-14 | Admin cannot delete | Via Django admin | No delete option | P0 | Pass/Fail |

### 7.3 Audit Display
| TC-ID | Test Case | Action | Expected Result | Priority | Metric |
|-------|-----------|--------|-----------------|----------|--------|
| AUDIT-15 | List audit for mail | GET /api/audit/?mail_record=1 | Entries sorted by time | P0 | Pass/Fail |
| AUDIT-16 | Chronological order | Check multiple entries | Oldest first in detail | P1 | Pass/Fail |
| AUDIT-17 | Newest first in UI | Check Timeline component | Newest first display | P1 | Pass/Fail |
| AUDIT-18 | Color-coded entries | Check UI | Different colors per action | P1 | Pass/Fail |
| AUDIT-19 | Relative timestamps | Check "2 hours ago" | Accurate relative time | P1 | Pass/Fail |
| AUDIT-20 | Absolute timestamps | Hover/click for date | Full datetime visible | P1 | Pass/Fail |
| AUDIT-21 | Remarks in timeline | Check reassignment | Remarks visible | P0 | Pass/Fail |
| AUDIT-22 | Complete chain | Multiple actions | Full history visible | P0 | Pass/Fail |

---

## 8. Signup Workflow Tests (28 cases)

### 8.1 Signup Submission
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| SIGNUP-01 | Valid signup request | POST valid data | Pending SignupRequest created | P0 | Pass/Fail |
| SIGNUP-02 | Blocked email domain | Try gmail.com | Rejected | P0 | Pass/Fail |
| SIGNUP-03 | Blocked hotmail | Try hotmail.com | Rejected | P0 | Pass/Fail |
| SIGNUP-04 | Blocked nic.in | Try nic.in | Rejected | P0 | Pass/Fail |
| SIGNUP-05 | Allowed email domain | Try company.gov.in | Accepted | P0 | Pass/Fail |
| SIGNUP-06 | Invalid AG signup | Request role=AG | Rejected | P0 | Pass/Fail |
| SIGNUP-07 | Invalid DAG signup | Request role=DAG | Rejected | P0 | Pass/Fail |
| SIGNUP-08 | Valid SrAO signup | Request role=SrAO | Accepted | P0 | Pass/Fail |
| SIGNUP-09 | Valid AAO signup | Request role=AAO | Accepted | P0 | Pass/Fail |
| SIGNUP-10 | Valid auditor signup | Request role=auditor | Accepted | P0 | Pass/Fail |
| SIGNUP-11 | Valid clerk signup | Request role=clerk | Accepted | P0 | Pass/Fail |
| SIGNUP-12 | Duplicate username | Request existing username | Rejected | P0 | Pass/Fail |
| SIGNUP-13 | Duplicate email | Request existing email | Rejected | P1 | Pass/Fail |
| SIGNUP-14 | Missing required field | Omit full_name | Validation error | P1 | Pass/Fail |

### 8.2 Signup Metadata
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| SIGNUP-15 | Get signup metadata | GET /api/auth/signup-metadata/ | Roles + sections returned | P0 | Pass/Fail |
| SIGNUP-16 | Sections in metadata | Check response | Available sections listed | P1 | Pass/Fail |
| SIGNUP-17 | Subsections in metadata | Check response | Subsections per section | P1 | Pass/Fail |
| SIGNUP-18 | Metadata public access | No auth token | 200 OK (public) | P0 | Pass/Fail |

### 8.3 Signup Approval
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| SIGNUP-19 | Approve signup request | Superuser approves | User created, status=approved | P0 | Pass/Fail |
| SIGNUP-20 | Reject signup request | Superuser rejects | Status=rejected, no user | P0 | Pass/Fail |
| SIGNUP-21 | Edit before approve | Change requested role | Role updated before creation | P1 | Pass/Fail |
| SIGNUP-22 | Edit section before approve | Change section/subsection | Updated in created user | P1 | Pass/Fail |
| SIGNUP-23 | Cannot approve twice | Try approve approved | Error | P2 | Pass/Fail |
| SIGNUP-24 | Cannot approve rejected | Try approve rejected | Error | P2 | Pass/Fail |

### 8.4 Approved User Flow
| TC-ID | Test Case | Steps | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| SIGNUP-25 | Login after approval | Use approved credentials | Login successful | P0 | Pass/Fail |
| SIGNUP-26 | Login before approval | Try with pending status | 403 or error | P0 | Pass/Fail |
| SIGNUP-27 | Login after rejection | Try with rejected credentials | 403 or error | P0 | Pass/Fail |
| SIGNUP-28 | Approved user role correct | Check created user | Matches approved role | P0 | Pass/Fail |

---

## 9. Edge Cases & Boundary Tests (35 cases)

### 9.1 Date Boundaries
| TC-ID | Test Case | Scenario | Expected Result | Priority | Metric |
|-------|-----------|----------|-----------------|----------|--------|
| EDGE-01 | Due date today | Set due_date = today | Not overdue | P1 | Pass/Fail |
| EDGE-02 | Due date yesterday | Set due_date = yesterday | Overdue flag | P1 | Pass/Fail |
| EDGE-03 | Due date leap year | Feb 29, 2024 | Valid date | P2 | Pass/Fail |
| EDGE-04 | Year-end serial | Create mail on Dec 31 | sl_no = current_year/XXX | P2 | Pass/Fail |
| EDGE-05 | New year serial | Create mail on Jan 1 | sl_no = new_year/001 | P2 | Pass/Fail |
| EDGE-06 | Future date received | date_received in future | Validation warning? | P2 | Pass/Fail |
| EDGE-07 | Very old date | date_received = 1900-01-01 | Accepted or rejected | P2 | Pass/Fail |

### 9.2 String Boundaries
| TC-ID | Test Case | Scenario | Expected Result | Priority | Metric |
|-------|-----------|----------|-----------------|----------|--------|
| EDGE-08 | Empty subject | subject = "" | Validation error | P1 | Pass/Fail |
| EDGE-09 | Very long subject | 500+ character subject | Accepted/truncated | P2 | Pass/Fail |
| EDGE-10 | Unicode in subject | "Subject 中文 🔥" | Accepted | P1 | Pass/Fail |
| EDGE-11 | SQL in text fields | "'; DROP TABLE records;" | Sanitized/safe | P0 | Pass/Fail |
| EDGE-12 | XSS in text fields | "<script>alert(1)</script>" | Escaped/stripped | P0 | Pass/Fail |
| EDGE-13 | Newlines in action_required | Multi-line text | Preserved/displayed | P2 | Pass/Fail |
| EDGE-14 | Special chars in letter_no | "LET-001/2026/A&B" | Accepted | P1 | Pass/Fail |

### 9.3 Numeric Boundaries
| TC-ID | Test Case | Scenario | Expected Result | Priority | Metric |
|-------|-----------|----------|-----------------|----------|--------|
| EDGE-15 | Serial number 999 | Create 999th mail in year | sl_no = 2026/999 | P2 | Pass/Fail |
| EDGE-16 | Serial number 1000 | Create 1000th mail | sl_no = 2026/1000 | P2 | Pass/Fail |
| EDGE-17 | Serial number 9999 | Create 9999th mail | Works correctly | P2 | Pass/Fail |
| EDGE-18 | Page size 0 | ?page_size=0 | Default to 25 or error | P2 | Pass/Fail |
| EDGE-19 | Negative page | ?page=-1 | Error or page 1 | P2 | Pass/Fail |
| EDGE-20 | Very large page size | ?page_size=10000 | Limited to max | P2 | Pass/Fail |

### 9.4 Null/Empty Handling
| TC-ID | Test Case | Scenario | Expected Result | Priority | Metric |
|-------|-----------|----------|-----------------|----------|--------|
| EDGE-21 | Null subsection | Create without subsection | Allowed (null) | P1 | Pass/Fail |
| EDGE-22 | Null date_of_completion | Open mail | Null in DB | P1 | Pass/Fail |
| EDGE-23 | Empty remarks | Close without remarks | Validation error | P0 | Pass/Fail |
| EDGE-24 | Whitespace-only text | Input "   " | Validation error | P1 | Pass/Fail |
| EDGE-25 | Null assigned_to | Try create without assignee | Validation error | P0 | Pass/Fail |

### 9.5 Concurrent Operations
| TC-ID | Test Case | Scenario | Expected Result | Priority | Metric |
|-------|-----------|----------|-----------------|----------|--------|
| EDGE-26 | Simultaneous create | 2 users create at same time | Both succeed, different sl_no | P1 | Pass/Fail |
| EDGE-27 | Simultaneous reassignment | 2 users reassign same mail | Last wins or error | P1 | Pass/Fail |
| EDGE-28 | Read during write | View list while creating | Consistent data | P1 | Pass/Fail |
| EDGE-29 | Race condition on serial | Rapid sequential creates | No duplicate sl_no | P0 | Pass/Fail |
| EDGE-30 | Concurrent audit writes | Multiple actions simultaneously | All logged, no loss | P1 | Pass/Fail |

### 9.6 Network/Failure Recovery
| TC-ID | Test Case | Scenario | Expected Result | Priority | Metric |
|-------|-----------|----------|-----------------|----------|--------|
| EDGE-31 | Network timeout during create | Disconnect mid-request | Graceful error, no partial data | P1 | Pass/Fail |
| EDGE-32 | Browser back after action | Submit, go back, resubmit | Idempotent or error | P1 | Pass/Fail |
| EDGE-33 | Refresh during loading | Refresh while page loading | Graceful recovery | P2 | Pass/Fail |
| EDGE-34 | Token expiry mid-action | Token expires during POST | 401, prompt re-login | P1 | Pass/Fail |
| EDGE-35 | Database connection lost | Simulate DB down | Error message, no crash | P1 | Pass/Fail |

---

## 10. Security Tests (32 cases)

### 10.1 Authentication Security
| TC-ID | Test Case | Attack | Expected Defense | Priority | Metric |
|-------|-----------|--------|------------------|----------|--------|
| SEC-01 | Brute force login | 1000 login attempts | Rate limit / account lock | P0 | Pass/Fail |
| SEC-02 | Credential stuffing | Try common passwords | Rejected | P0 | Pass/Fail |
| SEC-03 | Session fixation | Force session ID | New ID on login | P1 | Pass/Fail |
| SEC-04 | Token in URL | Pass token in query param | Not accepted | P1 | Pass/Fail |
| SEC-05 | Weak password acceptance | Password="password" | Rejected if policy exists | P1 | Pass/Fail |
| SEC-06 | Password in logs | Check server logs | Password not logged | P0 | Pass/Fail |

### 10.2 Authorization Security
| TC-ID | Test Case | Attack | Expected Defense | Priority | Metric |
|-------|-----------|--------|------------------|----------|--------|
| SEC-07 | IDOR - view other mail | Change URL id param | 403 Forbidden | P0 | Pass/Fail |
| SEC-08 | IDOR - reassign other mail | Change record id in POST | 403 Forbidden | P0 | Pass/Fail |
| SEC-09 | IDOR - close other mail | POST close to other's record | 403 Forbidden | P0 | Pass/Fail |
| SEC-10 | Privilege escalation | Try to set role=AG | Rejected | P0 | Pass/Fail |
| SEC-11 | Horizontal privilege | SrAO A views SrAO B's mail | 403 Forbidden | P0 | Pass/Fail |
| SEC-12 | Vertical privilege | SrAO tries AG action | 403 Forbidden | P0 | Pass/Fail |

### 10.3 Input Validation Security
| TC-ID | Test Case | Attack | Expected Defense | Priority | Metric |
|-------|-----------|--------|------------------|----------|--------|
| SEC-13 | SQL injection | "' OR '1'='1" in search | Sanitized | P0 | Pass/Fail |
| SEC-14 | NoSQL injection | MongoDB-style injection | N/A (not Mongo) | P0 | Pass/Fail |
| SEC-15 | Command injection | "; rm -rf /" in field | Sanitized | P0 | Pass/Fail |
| SEC-16 | XSS reflected | <script> in search | Escaped | P0 | Pass/Fail |
| SEC-17 | XSS stored | <script> in mail data | Escaped/stripped | P0 | Pass/Fail |
| SEC-18 | CSRF attack | POST without CSRF token | Rejected (if enforced) | P1 | Pass/Fail |
| SEC-19 | CSRF with token | POST with valid token | Accepted | P1 | Pass/Fail |

### 10.4 File Upload Security
| TC-ID | Test Case | Attack | Expected Defense | Priority | Metric |
|-------|-----------|--------|------------------|----------|--------|
| SEC-20 | Upload executable | Upload .exe | Rejected | P0 | Pass/Fail |
| SEC-21 | Upload PHP shell | Upload shell.php | Rejected | P0 | Pass/Fail |
| SEC-22 | Double extension | "file.pdf.exe" | Rejected | P0 | Pass/Fail |
| SEC-23 | Null byte injection | "file.pdf%00.exe" | Rejected | P0 | Pass/Fail |
| SEC-24 | MIME type spoofing | Fake MIME type | Content-type verified | P1 | Pass/Fail |
| SEC-25 | SVG with XSS | Upload malicious SVG | Sanitized/rejected | P2 | Pass/Fail |

### 10.5 API Security
| TC-ID | Test Case | Attack | Expected Defense | Priority | Metric |
|-------|-----------|--------|------------------|----------|--------|
| SEC-26 | Mass assignment | Extra fields in POST | Ignored | P1 | Pass/Fail |
| SEC-27 | Parameter pollution | ?id=1&id=2 | Consistent handling | P1 | Pass/Fail |
| SEC-28 | JSON injection | Malformed JSON | 400 Bad Request | P1 | Pass/Fail |
| SEC-29 | Large payload | 10MB JSON | Rejected/limited | P2 | Pass/Fail |
| SEC-30 | Slowloris | Slow HTTP headers | Timeout/connection close | P2 | Pass/Fail |

### 10.6 Information Disclosure
| TC-ID | Test Case | Check | Expected Result | Priority | Metric |
|-------|-----------|-------|-----------------|----------|--------|
| SEC-31 | Stack traces | Force 500 error | No stack trace in response | P0 | Pass/Fail |
| SEC-32 | Sensitive data in response | Check API responses | No internal paths, DB info | P0 | Pass/Fail |

---

## 11. Stress & Performance Tests (15 cases)

### 11.1 Load Testing
| TC-ID | Test Case | Scenario | Expected Result | Priority | Metric |
|-------|-----------|----------|-----------------|----------|--------|
| PERF-01 | Concurrent logins | 50 users login simultaneously | All succeed, <3s response | P1 | Time |
| PERF-02 | Mail list with 1000 records | Load 1000 mails, view list | <2s load time | P0 | Time |
| PERF-03 | Mail list pagination | Navigate through 40 pages | Smooth, no delays | P1 | Time |
| PERF-04 | Concurrent mail creation | 20 users create simultaneously | All succeed, no dup sl_no | P1 | Pass/Fail |
| PERF-05 | Search performance | Search across 1000 records | <500ms | P1 | Time |
| PERF-06 | Concurrent reassignments | 10 users reassign | All succeed, data consistent | P1 | Pass/Fail |

### 11.2 Data Volume Tests
| TC-ID | Test Case | Scenario | Expected Result | Priority | Metric |
|-------|-----------|----------|-----------------|----------|--------|
| PERF-07 | Large number of users | 500 users in system | Performance acceptable | P2 | Time |
| PERF-08 | Large number of sections | 50 sections | List loads quickly | P2 | Time |
| PERF-09 | Many subsections | 200 subsections | Dropdown responsive | P2 | Time |
| PERF-10 | Long audit trail | Mail with 100 audit entries | Timeline renders quickly | P2 | Time |
| PERF-11 | Many assignments | Mail with 20 assignees | Detail page loads <2s | P2 | Time |

### 11.3 Resource Tests
| TC-ID | Test Case | Scenario | Expected Result | Priority | Metric |
|-------|-----------|----------|-----------------|----------|--------|
| PERF-12 | Memory usage | Monitor during heavy load | No memory leaks | P2 | Memory |
| PERF-13 | Database connections | Monitor connection pool | No exhaustion | P2 | Count |
| PERF-14 | File descriptor usage | Monitor during PDF uploads | Within limits | P2 | Count |
| PERF-15 | API rate under load | 1000 requests/minute | <10% error rate | P1 | Error% |

---

## Test Execution Strategy

### Phase 1: Critical Path (P0 tests)
- Execute all P0 tests first
- Must pass 100% before proceeding
- Covers core functionality and security

### Phase 2: Important Features (P1 tests)
- Execute P1 tests
- Target: >95% pass rate
- Covers edge cases and secondary features

### Phase 3: Nice to Have (P2 tests)
- Execute P2 tests
- Target: >90% pass rate
- Covers stress and boundary conditions

### Environment Setup
```bash
# Reset database before testing
python manage.py flush --noinput
python manage.py migrate
python manage.py createsuperuser  # Create test AG

# Load test fixtures
python manage.py shell < load_test_data.py
```

### Test Data Requirements
- 1 AG user
- 3 DAG users (with multiple sections)
- 6 SrAO users (different subsections)
- 3 AAO users
- 2 auditor users
- 2 clerk users
- 10 sections
- 30 subsections
- 1000+ mail records for performance testing

---

## Evaluation Metrics Summary

| Category | Total | P0 | P1 | P2 |
|----------|-------|----|----|----|
| Authentication | 45 | 18 | 20 | 7 |
| User Management | 38 | 15 | 16 | 7 |
| Mail Lifecycle | 52 | 28 | 18 | 6 |
| Role Permissions | 48 | 32 | 12 | 4 |
| Section/Subsection | 24 | 10 | 10 | 4 |
| PDF Handling | 18 | 10 | 6 | 2 |
| Audit Trail | 22 | 12 | 8 | 2 |
| Signup Workflow | 28 | 16 | 10 | 2 |
| Edge Cases | 35 | 10 | 15 | 10 |
| Security | 32 | 22 | 8 | 2 |
| Performance | 15 | 5 | 8 | 2 |
| **TOTAL** | **357** | **178** | **131** | **48** |

### Success Criteria
- **P0**: 100% pass rate (no exceptions)
- **P1**: ≥95% pass rate
- **P2**: ≥90% pass rate
- **Security**: 100% of P0 security tests must pass
- **Performance**: All P0 performance metrics must meet targets

---

## Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| Test Plan Author | Claude | 2026-03-06 | Draft |
| Reviewer | [User] | Pending | Pending Approval |
| Test Execution | [To be filled] | Pending | Not Started |

---

*This test plan covers all features from CLAUDE.md v2026-03-05 and MAP.md v2026-02-24*
