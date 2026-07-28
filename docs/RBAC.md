# Role-Based Access Control Specification

## 1. Document Information

| Item | Description |
|---|---|
| Product | Web-Based Soil and Water Monitoring and Faucet Control System |
| Document | Role-Based Access Control Specification |
| Version | 1.0 |
| Status | Initial specification |
| Supported roles | `OWNER`, `ADMIN` |
| Related documents | `FRONTEND_AUDIT.md`, `UI_UX.md`, `PRD.md` |

---

## 2. Purpose

This document defines the role-based access control model for the web-based monitoring and faucet-control application.

The purpose of this specification is to ensure that:

- Only authenticated users can access protected application features.
- Admin accounts cannot access the protected website before Owner approval.
- Owners can manage other users.
- Admins can manage only their own profiles.
- Monitoring access and faucet-control access are enforced separately.
- Device-level access is checked for every device-specific request.
- Role and account-status restrictions are enforced on the server, not only in the frontend.
- Authorisation behaviour remains consistent in English and Bahasa Indonesia.

---

## 3. Scope

This specification covers:

- Application roles.
- Canonical permissions.
- Account statuses.
- Registration and approval access.
- Profile-management access.
- Device-access rules.
- Monitoring permissions.
- Historical-data permissions.
- Faucet-control permissions.
- Alert permissions.
- Audit-log permissions.
- Language and settings permissions.
- Frontend visibility rules.
- API authorisation rules.
- Privilege-escalation prevention.
- Security and audit requirements.

This specification does not define:

- Sensor calibration.
- Sensor measurement algorithms.
- ESP32/NodeMCU firmware.
- Physical faucet execution logic.
- Hardware safety design.
- Final MQTT topic structure.
- Final device communication protocol.
- Agronomic or water-quality thresholds.

---

## 4. RBAC Principles

The system shall apply the following principles.

### 4.1 Authentication Before Authorisation (RBAC-PERM-001)

The system shall verify that a valid authenticated session exists before checking role or permission.

Unauthenticated users shall not access protected:

- Dashboard pages.
- Monitoring pages.
- Device pages.
- Historical-data pages.
- Faucet-control pages.
- Alert pages.
- User-management pages.
- Settings pages.
- Protected API endpoints.

### 4.2 Server-Side Enforcement (RBAC-PERM-002)

The system shall enforce authorisation on the server.

The following shall not be treated as sufficient security:

- Hiding a navigation item.
- Disabling a button.
- Removing a frontend component.
- Relying on a route name.
- Trusting a role value supplied by the browser.

Every protected server operation shall independently verify:

1. Authentication.
2. Account status.
3. Role.
4. Required permission.
5. Target-resource access.
6. Device assignment, when applicable.

### 4.3 Least Privilege (RBAC-PERM-003)

Users shall receive only the permissions required for their role and assigned resources.

An Admin shall not receive Owner permissions by default.

Device assignment is mandatory for Admin access. All active Admin users possess faucet-control permission for devices assigned to them by an Owner, subject to:

```text
Active ADMIN
+ assigned device access
+ active and controllable device
= faucet-control permission
```

### 4.4 Explicit Denial (RBAC-PERM-004)

When no permission rule explicitly allows an action, the action shall be denied.

### 4.5 Resource-Level Authorisation (RBAC-PERM-005)

Role permission alone shall not automatically grant access to every device.

For device-specific operations, the system shall also verify that the user may access the target device.

### 4.6 Stable Internal Values (RBAC-PERM-006)

The system shall use language-neutral internal values for:

- Roles.
- Permissions.
- Account statuses.
- Device statuses.
- Command statuses.

Translated labels shall be used only for presentation.

### 4.7 Auditability (RBAC-PERM-007)

Security-sensitive actions shall generate audit records.

---

## 5. Roles

The first version of the application shall support exactly two roles:

```text
OWNER
ADMIN
```

The system shall not introduce additional roles such as:

- Viewer.
- Operator.
- Super Admin.
- Manager.
- Guest.

Additional roles require an approved change to the product requirements and this RBAC specification.

---

## 6. Role Definitions

### 6.1 Owner (RBAC-ROLE-001)

The Owner is the highest-authority application user.

The Owner shall be able to:

- Access protected application pages while the Owner account is active.
- View authorised devices.
- View current monitoring data.
- View historical monitoring data.
- View device status and alerts.
- View their own profile.
- Edit their own permitted profile fields.
- View other users' profiles.
- Edit permitted fields in other users' profiles.
- Review pending Admin registrations.
- Approve Admin registrations.
- Reject Admin registrations.
- Suspend Admin accounts.
- Deactivate Admin accounts.
- Assign or remove device access for Admin users.
- View account and control audit records.
- Manage access-related settings permitted by the final system policy.
- Access faucet-control functionality only where the final control policy allows it.

The Owner shall not:

- Bypass server-side authorisation.
- Assign a public registrant directly as Owner through the registration workflow.
- Read or expose passwords, session tokens, device secrets, or broker credentials.
- Modify immutable audit records.
- Access devices outside the Owner's authorised organisation or scope, if organisational scoping is implemented.

### 6.2 Admin (RBAC-ROLE-002)

The Admin is an operational application user whose account requires Owner approval.

The Admin shall be able to:

- Submit an account registration request.
- Access protected application pages only after approval and activation.
- View their own profile.
- Edit only their own permitted profile fields.
- Change their own password.
- Change their own language preference.
- View devices assigned to them.
- View current monitoring data for assigned devices.
- View historical monitoring data for assigned devices.
- View alerts within their authorised device scope.
- Use faucet-control functionality for assigned devices while the account is active and the device is controllable and faucet control is enabled (`ENABLE_FAUCET_CONTROL=true`).

The Admin shall not be able to:

- View another user's private profile.
- Edit another user's profile.
- Approve or reject account registrations.
- Activate, suspend, or deactivate another user.
- Change their own role.
- Change another user's role.
- Change their own account status.
- Assign devices to themselves.
- Assign devices to another user.
- Access Owner-only user-management pages.
- Read full Owner audit information unless explicitly allowed.
- Control devices outside their authorised scope.
- Bypass the Owner approval process.
- Register themselves as Owner.

---

## 7. Account Statuses

The system shall use the following canonical account statuses:

```text
PENDING_APPROVAL
APPROVED
ACTIVE
REJECTED
SUSPENDED
DEACTIVATED
```

### 7.1 Status Definitions

#### `PENDING_APPROVAL` (RBAC-STATE-001)

The account has been registered but has not yet been approved by an Owner.

A user with this status shall:

- Be unable to access protected application pages.
- Be unable to call protected APIs.
- Be allowed to see an account-pending message after login or registration.
- Be allowed to use limited account-status or support pages where implemented.

#### `APPROVED` (RBAC-STATE-002)

The Owner has approved the account, but the account may still require an activation step.

The separate use of `APPROVED` and `ACTIVE` is currently `TBD`.

Possible activation dependencies include:

- Email verification.
- Owner activation.
- Password setup.
- Device assignment.
- Acceptance of terms.

Until the activation policy is finalised, protected access shall require `ACTIVE`.

#### `ACTIVE` (RBAC-STATE-003)

The account is approved, enabled, and permitted to authenticate into protected application areas.

#### `REJECTED` (RBAC-STATE-004)

The Owner rejected the account registration.

A rejected account shall:

- Be denied protected access.
- Be prevented from gaining access through an earlier session.
- Display an appropriate account-status message.
- Require a defined reapplication or review process before reconsideration.

The reapplication policy is `TBD`.

#### `SUSPENDED` (RBAC-STATE-005)

The account is temporarily blocked.

A suspended account shall:

- Be denied new protected sessions.
- Lose access through existing sessions as soon as practical.
- Be unable to call protected APIs.
- Retain historical audit records.
- Be eligible for reactivation by an Owner, subject to policy.

#### `DEACTIVATED` (RBAC-STATE-006)

The account is disabled and is not expected to regain access without an explicit Owner action or administrative recovery process.

A deactivated account shall:

- Be denied protected access.
- Lose access through existing sessions.
- Remain in historical records for audit purposes.
- Not be physically deleted when deletion would break audit integrity.

---

## 8. Account-Status Access Matrix

| Account status | Login attempt | Protected UI | Protected API | Profile access | Notes |
|---|---:|---:|---:|---:|---|
| `PENDING_APPROVAL` | Limited response | No | No | Limited status page only | Awaiting Owner decision |
| `APPROVED` | TBD | No unless activated | No unless activated | TBD | Depends on activation policy |
| `ACTIVE` | Yes | Yes, subject to permissions | Yes, subject to permissions | Yes |
| `REJECTED` | Denied | No | No | Limited status page only | Reapplication policy TBD |
| `SUSPENDED` | Denied | No | No | No or limited support page | Existing sessions must be invalidated |
| `DEACTIVATED` | Denied | No | No | No | Historical record retained |

---

## 9. Canonical Permissions

The application shall use stable, machine-readable permission keys.

### 9.1 Authentication and Account Permissions

```text
account.register
account.status.read.self
account.approve
account.reject
account.activate
account.suspend
account.deactivate
account.role.update
```

### 9.2 Profile Permissions

```text
profile.self.read
profile.self.update
profile.other.read
profile.other.update
profile.password.update.self
profile.password.reset.other
```

### 9.3 Device Permissions

```text
device.read
device.create
device.update
device.deactivate
device.assign
device.unassign
```

### 9.4 Monitoring Permissions

```text
monitoring.current.read
monitoring.history.read
monitoring.location.read
monitoring.export
```

### 9.5 Faucet-Control Permissions

```text
device.control.dispense
device.control.cancel
device.control.stop
device.control.history.read
```

### 9.6 Alert Permissions

```text
alert.read
alert.acknowledge
alert.configure
```

### 9.7 Audit Permissions

```text
audit.read
audit.export
```

### 9.8 Settings and Language Permissions

```text
settings.self.read
settings.self.update
settings.system.read
settings.system.update
language.self.update
```

The final implementation may refine permission names, but it shall preserve the same semantic distinctions.

---

## 10. Baseline Role-Permission Matrix

Legend:

- `Allow`: permitted when account is active and resource scope is valid.
- `Deny`: not permitted.
- `TBD`: policy decision not yet final.

| Permission | Owner | Admin |
|---|---:|---:|
| `account.register` | Not required | Allow before authentication |
| `account.status.read.self` | Allow | Allow |
| `account.approve` | Allow | Deny |
| `account.reject` | Allow | Deny |
| `account.activate` | Allow | Deny |
| `account.suspend` | Allow | Deny |
| `account.deactivate` | Allow | Deny |
| `account.role.update` | Allow | Deny |
| `profile.self.read` | Allow | Allow |
| `profile.self.update` | Allow | Allow |
| `profile.other.read` | Allow | Deny |
| `profile.other.update` | Allow | Deny |
| `profile.password.update.self` | Allow | Allow |
| `profile.password.reset.other` | Allow | Deny |
| `device.read` | Allow within scope | Allow for assigned devices |
| `device.create` | Allow | Deny |
| `device.update` | Allow | Deny |
| `device.deactivate` | Allow | Deny |
| `device.assign` | Allow | Deny |
| `device.unassign` | Allow | Deny |
| `monitoring.current.read` | Allow within scope | Allow for assigned devices |
| `monitoring.history.read` | Allow within scope | Allow for assigned devices |
| `monitoring.location.read` | Allow within scope | Allow for assigned devices |
| `monitoring.export` | Allow within scope | Allow for assigned devices |
| `device.control.dispense` | Allow within scope | Allow for assigned devices |
| `device.control.cancel` | Allow within scope | Allow for assigned devices |
| `device.control.stop` | Allow within scope | Allow for assigned devices |
| `device.control.history.read` | Allow within scope | Allow for assigned devices |
| `alert.read` | Allow within scope | Allow within assigned scope |
| `alert.acknowledge` | Allow within scope | Allow for assigned devices |
| `alert.configure` | Allow | Deny |
| `audit.read` | Allow | Deny |
| `audit.export` | Allow | Deny |
| `settings.self.read` | Allow | Allow |
| `settings.self.update` | Allow | Allow |
| `settings.system.read` | Allow | Deny |
| `settings.system.update` | Allow | Deny |
| `language.self.update` | Allow | Allow |

---

## 11. Admin Registration and Owner Approval

### 11.1 Public Registration

The public create-account workflow shall:

- Create only an Admin registration request.
- Assign role `ADMIN`.
- Assign account status `PENDING_APPROVAL`.
- Ignore or reject any client-supplied role value.
- Ignore or reject any client-supplied active status.
- Prevent public creation of an Owner.
- Record the registration timestamp.
- Record the source of registration where permitted.
- Notify an Owner through the configured channel: `TBD`.

### 11.2 Owner Review

An Owner shall be able to:

- View pending Admin registrations.
- View the submitted registration details.
- Approve a registration.
- Reject a registration.
- Add an optional decision note.
- See whether another Owner has already acted on the request.

The system shall prevent duplicate or conflicting approval decisions.

### 11.3 Approval Enforcement

An Admin account shall not gain protected access merely because the frontend displays an approval status.

Protected access shall require a server-side check that the account is `ACTIVE`.

### 11.4 Approval Audit

Each decision shall record:

- Registration ID.
- Applicant user ID.
- Acting Owner user ID.
- Previous status.
- New status.
- Decision.
- Decision timestamp.
- Optional note.
- Source IP or device information where permitted.

---

## 12. Profile-Management Rules

### 12.1 Owner Profile

An Owner may:

- Read their own profile.
- Update their own permitted fields.
- Change their own password.
- Change their own preferred language.

An Owner may not:

- Read their own password hash.
- Directly edit immutable audit records.
- Change security-sensitive identity fields without validation.

### 12.2 Owner Management of Other Users

An Owner may:

- View an Admin profile.
- Edit permitted Admin profile fields.
- Change an Admin account status.
- Assign or remove device access.
- Review the Admin's approval history.
- Review permitted activity information.
- Trigger a password reset where the final policy allows it.

An Owner shall not:

- View user passwords.
- Set or retrieve a user's current password in plain text.
- Remove historical security records.

### 12.3 Admin Self-Management

An Admin may:

- View their own profile.
- Edit their own permitted fields.
- Change their own password.
- Change their own preferred language.

An Admin may not:

- View another user's private profile.
- Change the `userId` target to edit another user.
- Change their role.
- Change their account status.
- Assign devices.
- Modify approval records.
- Change Owner data.

### 12.4 Editable Fields

The final list of editable profile fields is `TBD`.

At minimum, the implementation shall distinguish:

- User-editable fields.
- Owner-editable fields.
- System-managed fields.
- Immutable fields.

Suggested classification:

| Field | Admin self-edit | Owner edit | System managed |
|---|---:|---:|---:|
| Full name | Yes | Yes | No |
| Email | TBD | Yes or TBD | No |
| Preferred language | Yes | Yes | No |
| Role | No | Subject to policy | No |
| Account status | No | Yes | No |
| Approval metadata | No | No | Yes |
| Created timestamp | No | No | Yes |
| Last login | No | No | Yes |
| Password hash | No | No direct edit | Yes |

---

## 13. Device-Level Access Model

### 13.1 Device Scoping

The system shall not assume that every Admin may access every device.

The preferred first-version model is:

- Owners may access devices within the Owner's authorised scope.
- Admins may access only devices explicitly assigned to them.

The exact Owner scope model is `TBD`.

Possible scope models include:

- Global application scope.
- Organisation scope.
- Site scope.
- Project scope.

### 13.2 Device Assignment

Only an Owner shall assign or remove Admin device access.

A device-access record should contain at least:

- User ID.
- Device ID.
- Assignment status.
- Assigned by Owner ID.
- Assigned timestamp.
- Removed timestamp, if applicable.

### 13.3 Device-Specific Verification

Every request containing a device identifier shall verify:

1. The user is authenticated.
2. The account is active.
3. The role has the required permission.
4. The user has access to the target device.
5. The device is active where required.
6. The request action is allowed for the device's current state.

### 13.4 Prohibited Device Access

An Admin shall not gain access by:

- Changing a device ID in a URL.
- Changing a query parameter.
- Changing a request body.
- Calling an endpoint directly.
- Modifying frontend state.
- Reusing data from another user's browser session.

---

## 14. Monitoring Permissions

### 14.1 Current Monitoring Data

A user with `monitoring.current.read` may view current soil and water data only for authorised devices.

### 14.2 Historical Monitoring Data

A user with `monitoring.history.read` may view historical data only for authorised devices.

Historical queries shall remain scoped by:

- User.
- Device.
- Date range.
- Metric.
- Any site or organisation boundary.

### 14.3 Location Data

Water latitude and longitude shall require `monitoring.location.read`.

Location data shall not be exposed to users without access to the associated device.

### 14.4 Data Export

Monitoring export permission is `TBD`.

The system shall not assume that viewing data automatically allows exporting it.

---

## 15. Faucet-Control Permissions

### 15.1 Device Assignment and Control Rule

Device assignment is mandatory for Admin users. An active Admin user may view telemetry and control faucets for devices assigned to them by an Owner. An Admin cannot view or control unassigned devices.

The effective authorization rule is:

```text
Active ADMIN
+ assigned device access
+ active and controllable device
= faucet-control permission
```

Owners manage device assignments. Admins cannot assign devices to themselves or other users.

### 15.2 Required Checks

Before creating a faucet command, the server shall verify:

1. Authenticated session.
2. Active account.
3. Target device assignment (or Owner global scope).
4. Device is active and controllable.
5. Faucet control is enabled (`ENABLE_FAUCET_CONTROL=true`).
6. No active command exists on target device (max 1 active command rule).
7. Valid preset phase (Phase 1: 300mL, Phase 2: 1,000mL, Phase 3: 1,500mL).
8. Client-provided `idempotencyKey` is unique.
9. Tank water volume is sufficient.

### 15.3 Confirmed Presets

| Phase | Target volume |
|---|---:|
| Phase 1 | 300 mL |
| Phase 2 | 1,000 mL |
| Phase 3 | 1,500 mL |

The server shall not trust a client-supplied arbitrary volume when the user selects a defined phase.

### 15.4 Approved Role and Safety Policy

The approved faucet control safety policy is:

- **Owner Control**: Owners possess faucet control permission across all system devices.
- **Admin Control**: Active Admins possess faucet control permission for devices assigned to them by an Owner.
- **Concurrency**: Maximum 1 active command per device (HTTP 409 Conflict if busy).
- **Retries**: Automatic retries are strictly FORBIDDEN for physical control commands.
- **Environment Feature Flag**: `ENABLE_FAUCET_CONTROL=false` by default.
- **Production Enablement**: Requires dual written sign-off from BOTH Project Owner AND Hardware Lead.
- **Command Idempotency**: Unique `idempotencyKey` required; duplicate command IDs never trigger repeated dispensing.
- **Timeout**: ACK timeout (10s), completion timeout (180s), and expiry (30s) are tracked; timeouts are NEVER treated as completion.

---

## 16. Alert Permissions

### 16.1 Alert Visibility

Owners may view alerts within their authorised scope.

Admins may view alerts only for assigned devices.

### 16.2 Alert Acknowledgement

The permission for Admins to acknowledge alerts is `TBD`.

Owners may acknowledge alerts where acknowledgement is supported.

### 16.3 Alert Configuration

Alert-threshold configuration shall be Owner-only or separately defined.

Admins shall not configure system-wide thresholds unless a later requirement explicitly permits it.

---

## 17. Audit-Log Permissions

### 17.1 Owner Access

Owners may view:

- Account registration events.
- Approval and rejection events.
- User-profile changes.
- Role changes.
- Device-access assignments.
- Login events.
- Faucet-command events.
- Security-sensitive changes.

### 17.2 Admin Access

Admin audit access is limited.

An Admin may be allowed to view:

- Their own profile-change history.
- Their own faucet-command history.
- Activity for assigned devices.

Full system audit access shall remain denied unless explicitly approved.

### 17.3 Audit Integrity

No role shall be permitted to:

- Edit audit records.
- Delete security-critical audit events through normal application functions.
- Change audit actor identity.
- Replace historical approval decisions.

---

## 18. Language and Settings Permissions

Both Owner and Admin may:

- Read their own language preference.
- Change their own language preference.
- Use English or Bahasa Indonesia.

An Owner may manage system-level settings only where the final settings policy permits it.

An Admin shall not:

- Change another user's language.
- Change system-wide authorisation policy.
- Use a language change to bypass permissions.

Authorisation decisions shall use canonical role, permission, account-status, and resource values, not translated labels.

---

## 19. Frontend Visibility Rules

The frontend shall adapt visible navigation and actions to the authenticated user's permissions.

### 19.1 Owner Interface

The Owner interface may display:

- Dashboard.
- Devices.
- Monitoring.
- History.
- Alerts.
- Faucet control, if permitted.
- User management.
- Pending approvals.
- Audit logs.
- Settings.
- Own profile.

### 19.2 Admin Interface

The Admin interface may display:

- Dashboard.
- Assigned devices.
- Monitoring.
- History.
- Alerts within scope.
- Faucet control, if permitted.
- Own profile.
- Own settings.

The Admin interface shall not display Owner-only:

- Pending approval management.
- Other-user profile management.
- Role management.
- Device assignment management.
- Full audit logs.
- System-wide security settings.

### 19.3 Security Limitation

Frontend visibility rules improve usability but do not replace server-side authorisation.

---

## 20. API Authorisation Rules

Every protected API endpoint shall:

1. Validate the session.
2. Load the user from a trusted server-side source.
3. Verify account status.
4. Verify required permission.
5. Verify target-resource access.
6. Validate the request payload.
7. Record security-sensitive actions.
8. Return a standard error response when denied.

Suggested status responses:

| Situation | HTTP status |
|---|---:|
| No valid session | `401 Unauthorized` |
| Authenticated but not permitted | `403 Forbidden` |
| Resource not found or intentionally concealed | `404 Not Found` |
| Invalid request | `400 Bad Request` |
| Conflict with current state | `409 Conflict` |

The API shall not disclose sensitive information in error messages.

---

## 21. Session and Account-State Enforcement

The system shall re-check account status for protected operations.

When an account becomes:

- `SUSPENDED`.
- `DEACTIVATED`.
- `REJECTED`.

The system shall:

- Prevent creation of new sessions.
- Invalidate or restrict existing sessions as soon as practical.
- Reject protected API requests.
- Record the status-change event.

Role or device-assignment changes shall take effect without requiring the user to keep stale permissions indefinitely.

The exact session invalidation mechanism is `TBD`.

---

## 22. Privilege-Escalation Prevention

The system shall prevent privilege escalation through:

- Modified request bodies.
- Modified URLs.
- Modified query parameters.
- Hidden form fields.
- Browser developer tools.
- Direct API calls.
- Stale sessions.
- Manipulated role names.
- Manipulated account statuses.
- Manipulated device IDs.
- Replayed approval requests.
- Replayed faucet commands.

Specific requirements:

- Public registration shall always create role `ADMIN`.
- Public registration shall always create status `PENDING_APPROVAL`.
- The server shall ignore any public request to create role `OWNER`.
- The server shall ignore any public request to create status `ACTIVE`.
- An Admin shall not update their own role.
- An Admin shall not update their own account status.
- An Admin shall not update another user's profile.
- Device access shall be verified independently of role.
- Faucet control shall require explicit permission.

---

## 23. Audit Requirements

The system shall create audit events for at least:

- Admin registration.
- Owner approval.
- Owner rejection.
- Account activation.
- Account suspension.
- Account deactivation.
- Role change.
- Profile update by Owner.
- Self-profile update.
- Device assignment.
- Device unassignment.
- Login success.
- Login failure, subject to security policy.
- Faucet command creation.
- Faucet command cancellation.
- Faucet command failure.
- Alert acknowledgement.
- Authorisation denial for high-risk operations, where appropriate.

Each audit event shall include:

- Event ID.
- Actor user ID.
- Actor role.
- Action.
- Target type.
- Target ID.
- Previous value, where appropriate.
- New value, where appropriate.
- Timestamp.
- Result.
- Relevant request metadata.
- Optional reason or note.

Audit records shall not include:

- Plain-text passwords.
- Password hashes.
- Session tokens.
- Device secrets.
- MQTT credentials.
- Private keys.

---

## 24. Acceptance Criteria

### 24.1 Authentication and Status

- An unauthenticated user cannot access protected pages.
- A `PENDING_APPROVAL` Admin cannot access protected pages.
- A `REJECTED` Admin cannot access protected pages.
- A `SUSPENDED` Admin cannot access protected pages.
- A `DEACTIVATED` Admin cannot access protected pages.
- An `ACTIVE` Owner can access Owner-authorised features.
- An `ACTIVE` Admin can access Admin-authorised features.

### 24.2 Registration and Approval

- Public registration creates an `ADMIN`.
- Public registration creates `PENDING_APPROVAL`.
- Public registration cannot create an `OWNER`.
- An Owner can approve a pending Admin.
- An Owner can reject a pending Admin.
- An Admin cannot approve or reject an account.
- Duplicate approval attempts do not create conflicting status changes.
- Approval decisions are audited.

### 24.3 Profile Management

- An Owner can view and edit permitted fields in another user's profile.
- An Admin can view and edit only their own permitted fields.
- An Admin cannot edit another user by changing a URL.
- An Admin cannot edit another user by changing a request body.
- An Admin cannot change their own role.
- An Admin cannot change their own account status.
- An Admin cannot edit Owner data.

### 24.4 Device Access

- An Admin sees only assigned devices.
- An Admin cannot access an unassigned device by changing the device ID.
- Historical data remains scoped to authorised devices.
- Location data remains scoped to authorised devices.
- Device-access changes are audited.

### 24.5 Monitoring and Control

- Monitoring access requires the relevant monitoring permission.
- Faucet control requires a separate control permission.
- Monitoring permission alone does not permit control.
- A control request verifies device access.
- A control request verifies the requested phase.
- A control request records the initiating user and target device.
- A user cannot control an unauthorised device.

### 24.6 Language

- Changing language does not change permissions.
- Role and account-status checks use canonical values.
- Translated labels are not trusted for authorisation.
- Owner-only actions remain Owner-only in both supported languages.

### 24.7 Server Enforcement

- Hidden frontend controls cannot be used to bypass the API.
- Protected endpoints return `401` without a valid session.
- Protected endpoints return `403` when permission is missing.
- High-risk actions create audit records.

---

## 25. Open Decisions

The following RBAC decisions remain unresolved:

1. Whether `APPROVED` and `ACTIVE` remain separate statuses.
2. The exact activation step after Owner approval.
3. Whether an approved Admin must verify email.
4. Whether rejected users may reapply.
5. Whether Owners automatically access all devices.
6. Whether Owner access is global, organisation-based, site-based, or project-based.
7. Whether Owners may create, edit, or deactivate devices.
8. Whether Owners may reset another user's password.
9. Whether Admins may acknowledge alerts.
10. Whether Admins may export monitoring data.
11. Whether Owners may control faucets.
12. Whether Admins may control faucets.
13. Whether control permission is assigned per role, per user, or per device.
14. Whether users may cancel an active faucet command.
15. Whether an emergency-stop permission exists.
16. Whether concurrent device commands are allowed.
17. Whether Admins may view their own audit history.
18. Whether Admins may view device-level control history for assigned devices.
19. The final list of editable profile fields.
20. Session invalidation strategy after suspension, deactivation, role changes, and device-access changes.
21. Audit-log retention period.
22. Whether multiple Owner accounts are allowed.
23. Who may create additional Owner accounts.
24. Whether an Owner may modify another Owner account.

---

## 26. Conflicts and Gaps Found

1. Owner and Admin roles are confirmed, but faucet-control access for each role is not yet confirmed.
2. Multi-device support is confirmed, but the exact device-assignment model is not yet final.
3. Owner management of other users is confirmed, but the permitted editable profile fields are not yet defined.
4. Owner approval is confirmed, but the distinction between `APPROVED` and `ACTIVE` is unresolved.
5. The first Owner provisioning process is implemented via secure one-time CLI (`DEC-AUTH-006`, `TASK-0106`).
6. It is not yet confirmed whether multiple Owners are allowed.
7. Admin monitoring access is confirmed, but export permissions are unresolved.
8. Alert acknowledgement permissions for Admins are unresolved.
9. Existing-session invalidation behaviour after account suspension or device reassignment is not yet defined.
10. The existing frontend must be checked to confirm that Owner-only and Admin-only states are visually represented without relying on frontend hiding as the sole security mechanism.

---

## 27. First Owner Provisioning Workflow (`TASK-0106`)

Initial system bootstrap creates the primary `OWNER` account via a secure, explicit, one-time CLI script (`npm run seed:owner`).

Key RBAC & Security Rules for Provisioning:
1. **Public Registration Safety:** Public registration endpoints must NEVER create an `OWNER` role account. Registration creates only `ADMIN` in `PENDING_APPROVAL` status.
2. **One-Time Bootstrap:** Provisioning checks for any existing non-revoked `OWNER` role assignment across all account statuses (`ACTIVE`, `APPROVED`, `PENDING_APPROVAL`, `SUSPENDED`, `DEACTIVATED`). Rejects if an Owner exists.
3. **PostgreSQL Advisory Lock:** Uses a stable 64-bit BigInt transaction-scoped advisory lock (`84736291106`) to guarantee serialised single execution across concurrent processes.
4. **Canonical Role Prerequisite:** Pre-checks canonical `OWNER` role existence in DB (`npm run db:seed` required prior to provisioning).
5. **Initial State:** The provisioned Owner is created in `ACTIVE` account status with exactly 1 `OWNER` assignment, 0 `ADMIN` assignments, 0 `AccountApproval` records, and 1 system `AuditLog` record (`ACCOUNT_PROVISION_OWNER`).
