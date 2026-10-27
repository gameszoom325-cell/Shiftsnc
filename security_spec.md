# ShiftSync AI — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Default Deny**: All unmatched paths under `/databases/{database}/documents/{document=**}` are strictly denied (`allow read, write: if false;`).
2. **Verified Identity**: All writes require `isSignedIn() && request.auth.token.email_verified == true`.
3. **Path Variable Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) validates the document ID against `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
4. **UserProfile (`/users/{userId}`)**:
   - `userId` must match `request.auth.uid` and `incoming().uid == request.auth.uid`.
   - `role` on creation by non-admins is restricted to non-privileged roles (`construction_worker` or `college_student`), preventing self-assigned admin escalation.
   - `uid` and `createdAt` are immutable on update.
   - `read` (`get` and `list`) is restricted to the profile owner (`userId == request.auth.uid` / `resource.data.uid == request.auth.uid`) or verified `isAdmin()`.
5. **AttendanceRecord (`/attendance/{recordId}`)**:
   - `userId` must match `request.auth.uid` on creation and must reference an existing `/users/$(incoming().userId)` document.
   - `list` queries are strictly constrained to `resource.data.userId == request.auth.uid || isAdmin()`.
   - Terminal status `'Completed'` locks the record from non-admin updates.
6. **SafetyComplaint (`/complaints/{complaintId}`)**:
   - `authorId` must match `request.auth.uid` on creation and must reference an existing `/users/$(incoming().authorId)` document.
   - `status` on creation must start at `'Submitted'`.
   - Terminal status `'Resolved'` locks the record from further non-admin updates.
   - `list` queries require `resource.data.authorId == request.auth.uid || isAdmin()`.
7. **SkillRecord (`/skills/{skillId}`)**:
   - `userId` must match `request.auth.uid` on creation and must reference an existing `/users/$(incoming().userId)` document.
   - `verifiedStatus` on creation by a worker/student must be `'Pending'`; only `isAdmin()` can transition `verifiedStatus` to `'Verified'`.
   - Terminal status `'Verified'` locks the credential from non-admin edits.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Unverified Email Spoof**: Authenticated user with `email_verified: false` attempting to create `/users/user_1`. -> `PERMISSION_DENIED`
2. **Self-Assigned Admin Escalation**: Standard user creating `/users/user_1` with `role: "construction_admin"`. -> `PERMISSION_DENIED`
3. **Shadow Field Injection**: Updating `/users/user_1` with an undeclared key `isSuperAdmin: true`. -> `PERMISSION_DENIED`
4. **Cross-User PII Read**: Authenticated `user_2` attempting `get` on `/users/user_1`. -> `PERMISSION_DENIED`
5. **Blanket List Scraping**: Authenticated `user_2` executing an unfiltered `list` query on `/attendance`. -> `PERMISSION_DENIED`
6. **Orphaned Attendance Write**: Creating `/attendance/att_1` when `/users/user_1` does not exist. -> `PERMISSION_DENIED`
7. **Forged Timestamp Injection**: Creating `/complaints/cmp_1` with a past client timestamp (`createdAt != request.time`). -> `PERMISSION_DENIED`
8. **State Shortcutting on Creation**: Non-admin creating `/complaints/cmp_1` with `status: "Resolved"` or `/skills/sk_1` with `verifiedStatus: "Verified"`. -> `PERMISSION_DENIED`
9. **Terminal State Mutation**: Non-admin attempting to update `/complaints/cmp_1` after `existing().status == "Resolved"`. -> `PERMISSION_DENIED`
10. **Immutable Owner Swap**: Updating `/complaints/cmp_1` to change `authorId` or `createdAt`. -> `PERMISSION_DENIED`
11. **Denial-of-Wallet Oversized String**: Creating `/complaints/cmp_1` with a 5,000-character `description` (exceeding `maxLength: 1000`). -> `PERMISSION_DENIED`
12. **ID Poisoning Attack**: Creating a document with an invalid ID containing spaces or special characters. -> `PERMISSION_DENIED`
