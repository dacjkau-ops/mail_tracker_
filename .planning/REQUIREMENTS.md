# Requirements: Mail Tracker v1.2

**Defined:** 2026-02-24
**Core Value:** An on-premise office workflow tracker where every mail/action is visible to the right people, assigned to someone accountable, and tracked through its lifecycle.

## v1.2 Requirements

Requirements for v1.2 release. Each maps to roadmap phases.

### Code Cleanup

- [ ] **CLEAN-01**: Remove deprecated `action_required_other` field from MailRecord model, serializers, and admin
- [ ] **CLEAN-02**: Remove deprecated `remarks` field from MailRecord model, serializers, and admin
- [ ] **CLEAN-03**: Remove deprecated `user_remarks` field from MailAssignment model, serializers, and admin
- [ ] **CLEAN-04**: Remove unused `formatDistanceToNow` import and dead `getRelativeTime` function from dateHelpers.js
- [ ] **CLEAN-05**: Generate and apply migration for removed model fields

### Python Refactoring

- [ ] **REFAC-01**: Use `bulk_create()` for MailAssignment and AuditTrail in multi-assignment creation (records/views.py)
- [ ] **REFAC-02**: Collapse DAG section officer query from 2 sequential queries to 1 subquery (records/views.py)
- [ ] **REFAC-03**: Cache `_assigned_mail_ids_for_user()` result per request to avoid repeated DB hits
- [ ] **REFAC-04**: DRY up repeated audit trail "touched records" query in config/permissions.py with request-level cache
- [ ] **REFAC-05**: Deduplicate `_human_readable_size()` logic in records/models.py (use static method instead of inline)

### Create Mail Performance

- [ ] **PERF-01**: Create Mail page loads form-ready state within 500ms (identify and fix bottleneck)

### Create Mail UX

- [ ] **CMUX-01**: Section field displayed in same Grid row as Assigned To field
- [ ] **CMUX-02**: Section auto-populates from selected assignee's section (single assignment)
- [ ] **CMUX-03**: Section auto-populates correctly with multiple assignees (uses first assignee's section or common section)

### Mail List UX

- [ ] **MLUX-01**: PDF icon displayed adjacent to subject column for mails that have a PDF attachment
- [ ] **MLUX-02**: Clicking PDF icon opens the attached PDF in a new browser tab

### Pagination

- [ ] **PAGE-01**: Backend API returns paginated mail list responses (25 records per page)
- [ ] **PAGE-02**: Frontend mail list displays page controls (prev/next, page number indicators)
- [ ] **PAGE-03**: Pagination integrates correctly with existing filters (status, section, search)

## Future Requirements

*(None deferred from this milestone)*

## Out of Scope

| Feature | Reason |
|---------|--------|
| Infinite scroll | Pagination with page controls is simpler and more predictable |
| Client-side pagination | Backend pagination required for performance with growing data |
| Audit trail pagination | Not needed this milestone — detail page shows all entries |
| Model permission method removal | Low priority; refactoring focused on queries, not method pruning |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | Phase 6 | Pending |
| CLEAN-02 | Phase 6 | Pending |
| CLEAN-03 | Phase 6 | Pending |
| CLEAN-04 | Phase 6 | Pending |
| CLEAN-05 | Phase 6 | Pending |
| REFAC-01 | Phase 6 | Pending |
| REFAC-02 | Phase 6 | Pending |
| REFAC-03 | Phase 6 | Pending |
| REFAC-04 | Phase 6 | Pending |
| REFAC-05 | Phase 6 | Pending |
| PERF-01 | Phase 7 | Pending |
| CMUX-01 | Phase 7 | Pending |
| CMUX-02 | Phase 7 | Pending |
| CMUX-03 | Phase 7 | Pending |
| MLUX-01 | Phase 8 | Pending |
| MLUX-02 | Phase 8 | Pending |
| PAGE-01 | Phase 8 | Pending |
| PAGE-02 | Phase 8 | Pending |
| PAGE-03 | Phase 8 | Pending |

**Coverage:**
- v1.2 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 — traceability updated with phase mappings*
