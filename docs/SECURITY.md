# Security Specification

## 1. Document Information

| Item | Description |
|---|---|
| Product | Web-Based Soil and Water Monitoring and Faucet Control System |
| Document | Security Specification |
| Version | 1.0 |
| Status | Proposed baseline security requirements |
| Primary roles | `OWNER`, `ADMIN` |
| Device platform | ESP32 / NodeMCU |
| Recommended device protocol | MQTT 5.0 over TLS |
| Related documents | `FRONTEND_AUDIT.md`, `UI_UX.md`, `PRD.md`, `RBAC.md`, `USER_FLOWS.md`, `I18N.md`, `DEVICE_COMMUNICATION.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md` |

---

## 2. Purpose

This document defines the security requirements for the web-based monitoring and faucet-control application.

The system has both information-security and physical-control implications. A compromised account or device could expose monitoring data, alter user access, or send unauthorised faucet commands. Security controls must therefore protect:

- User identities.
- Owner approval workflows.
- Admin access.
- Device assignments.
- Soil and water monitoring data.
- Device location data.
- Faucet-control commands.
- MQTT broker communication.
- Device credentials.
- Audit records.
- Infrastructure and deployment secrets.

---

## 3. Security Objectives

The system shall provide:

### 3.1 Confidentiality

Only authorised users and services shall access:

- Protected application pages.
- User profiles.
- Device data.
- Device locations.
- Historical monitoring.
- Faucet-command history.
- Audit records.
- Device and broker credentials.

### 3.2 Integrity

The system shall prevent unauthorised changes to:

- User roles.
- Account statuses.
- Device assignments.
- Monitoring records.
- Faucet-command states.
- Alert acknowledgements.
- Audit logs.
- Device configuration.
- Application settings.

### 3.3 Availability

The system shall remain resilient to:

- Failed login floods.
- Excessive API requests.
- MQTT reconnect storms.
- Device message floods.
- Database failures.
- Broker failures.
- Gateway failures.
- Malformed device payloads.
- Repeated faucet-control submissions.

### 3.4 Accountability

The system shall record who performed security-sensitive actions, when they occurred, which resource was affected, and whether the action succeeded.

### 3.5 Safe Failure

When authentication, authorisation, device status, gateway status, or command state is uncertain, the system shall deny or suspend high-risk actions rather than assume they are safe.

---

## 4. Security Scope

This specification covers:

- User authentication.
- Owner and Admin authorisation.
- Account registration and approval.
- Session management.
- Password security.
- Device access.
- Faucet-control security.
- MQTT and device authentication.
- API security.
- Database security.
- Input validation.
- Secrets management.
- Logging and audit.
- Deployment and infrastructure.
- Monitoring and incident response.
- Backup and recovery.
- Security testing.
- Secure development practices.

This document does not define:

- Physical enclosure security.
- Sensor calibration security.
- Hardware anti-tamper design.
- ESP32 secure boot implementation details.
- Hardware cryptographic chip selection.
- Field technician operational procedures.

Those items require coordination with the hardware team.

---

## 5. Threat Model

### 5.1 Protected Assets

Critical assets include:

- Owner accounts.
- Admin accounts.
- Password hashes.
- Sessions.
- User-device assignments.
- Device credentials.
- MQTT broker credentials.
- TLS private keys.
- Faucet-control permissions.
- Faucet-command history.
- Monitoring data.
- Device locations.
- Audit logs.
- Backups.
- Database credentials.
- Deployment secrets.

### 5.2 Potential Threat Actors

Potential threat actors include:

- Unauthenticated internet users.
- Rejected or pending applicants.
- Compromised Admin accounts.
- Malicious insiders.
- Compromised ESP32 devices.
- Attackers with stolen device credentials.
- Attackers with access to source code or deployment logs.
- Automated bots.
- Attackers on an insecure Wi-Fi network.
- Attackers replaying captured commands.

### 5.3 Key Threats

The security design shall address:

- Credential theft.
- Brute-force login.
- Session hijacking.
- Privilege escalation.
- Broken object-level authorisation.
- Public registration as Owner.
- Admin modification of another user.
- Admin self-promotion.
- Device-assignment tampering.
- MQTT topic spoofing.
- Device impersonation.
- Command replay.
- Duplicate faucet execution.
- Cross-device control.
- Retained old commands.
- Malformed telemetry.
- SQL injection.
- Cross-site scripting.
- Cross-site request forgery.
- Mass assignment.
- Sensitive data leakage.
- Log injection.
- Denial of service.
- Dependency compromise.
- Backup exposure.

---

→ ESP32 / NodeMCU
```

Data crossing any trust boundary shall be:

- Authenticated where applicable.
- Authorised.
- Validated.
- Encrypted in production.
- Logged appropriately.
- Treated as untrusted input.

The ESP32 device shall not be trusted merely because it is connected to the broker.

The browser shall not be trusted to supply role, status, permission, device ownership, or target volume.

---

## 7. Authentication Security (SEC-AUTH-001..SEC-AUTH-005)

### 7.1 Protected Access

Only users with:

```text
accountStatus = ACTIVE
```

shall access protected application functionality.

Accounts with these statuses shall be blocked:

```text
PENDING_APPROVAL
APPROVED
REJECTED
SUSPENDED
DEACTIVATED
```

`APPROVED` may access protected pages only if the final lifecycle defines it as equivalent to `ACTIVE`. Until then, access shall be denied.

### 7.2 Public Registration

Public registration shall:

- Create only role `ADMIN`.
- Create only status `PENDING_APPROVAL`.
- Ignore or reject client-supplied role.
- Ignore or reject client-supplied account status.
- Prevent creation of `OWNER`.
- Validate email uniqueness.
- Apply rate limiting.
- Generate an audit event.
- Avoid revealing excessive account-existence information.

### 7.3 Owner Provisioning

The first Owner account shall be provisioned through a secure administrative process.

The first Owner may be created via public registration when no Owner exists in the system (transitioning directly to `ACTIVE`). Once created, public Owner registration is disabled server-side and greyed out in the UI.

The provisioning process is the CLI interactive seed script (`npm run seed:owner`). Public registration MUST NEVER create an Owner account.

### 7.4 Login

Login shall:

- Use encrypted HTTPS transport.
- Validate credentials on the server.
- Apply generic authentication errors where appropriate.
- Rate-limit repeated failures.
- Record security-relevant failures.
- Check account status after credential validation.
- Reject stale or revoked sessions.
- Avoid logging submitted passwords.

### 7.5 Multi-Factor Authentication

Multi-factor authentication is recommended for Owner accounts.

Initial MFA support is `TBD`.

If introduced, it should be mandatory for:

- Owner accounts.
- High-risk administrative actions.
- Credential recovery.
- New-device login, where appropriate.

---

## 8. Password Security

### 8.1 Password Hashing

Passwords shall be hashed using a modern password-hashing function.

Approved algorithm and implementation:

```text
Argon2id (via @node-rs/argon2 N-API compiled binary)
Algorithm variant: Argon2id (algorithm = 2)
Default parameters: OWASP recommended baseline (memoryCost = 65536 KiB / 64 MiB, timeCost = 3 iterations, parallelism = 4 threads)
```

The reusable password service is encapsulated in `@kebun-melon/database` (`packages/database/src/password-service.ts`) exposing:
- `validatePasswordPolicy(password)`
- `hashPassword(password, options?)`
- `verifyPassword(storedHash, candidatePassword)`

Acceptable fallback:

```text
bcrypt with an approved cost
```

The system shall not use:

- Plain-text storage.
- MD5.
- SHA-1.
- Unsalted general-purpose hashes.
- Reversible encryption for passwords.

### 8.2 Password Policy

The approved password policy is:

- Minimum length of 12 characters.
- Requires uppercase, lowercase, digit, and special character complexity.
- Permit passphrases.
- Block commonly compromised passwords where feasible.
- Do not silently truncate passwords.
- Require confirmation during registration and reset.

### 8.3 Password Change

Password change shall:

- Require the current password, unless using an approved recovery flow.
- Validate the new password.
- Revoke other sessions according to policy.
- Generate an audit event.
- Never return the password hash.

### 8.4 Password Reset

Reset tokens shall:

- Be random and high entropy.
- Be single use.
- Expire.
- Be stored hashed where possible.
- Be invalidated after successful use.
- Not reveal whether an email address exists.

---

## 9. Session Security

### 9.1 Recommended Session Model

For a web-only system, secure server-managed sessions are required.

Session cookies shall use:

```text
HttpOnly
Secure in production
SameSite=Strict
```

### 9.2 Session Expiry

The approved session expiration limits are:

- **Idle timeout**: 30 minutes of inactivity.
- **Absolute expiry**: 8 hours maximum session lifetime.
- Revocation on logout, password change, suspension, or deactivation.

### 9.3 Session Revocation

Sessions shall be revoked or restricted when:

- User logs out.
- Password changes.
- Account is suspended.
- Account is deactivated.
- Role changes.
- High-risk compromise is suspected.

Device-access changes shall affect subsequent authorisation checks even when the user session remains active.

### 9.4 Session Fixation

The system shall rotate the session identifier after:

- Successful login.
- Privilege change.
- Password reset.
- Account activation.

### 9.5 CSRF Protection

When cookie-based sessions are used, state-changing requests shall use CSRF protection where required.

Controls may include:

- SameSite cookies.
- CSRF tokens.
- Origin and Referer validation.
- Rejection of cross-origin form submissions.
- JSON-only state-changing API endpoints.

---

## 10. Authorisation Security (SEC-RBAC-001..SEC-RBAC-004)

### 10.1 Server-Side Enforcement

Every protected operation shall validate:

1. Session.
2. Account status.
3. Role.
4. Permission.
5. Resource scope.
6. Device assignment.
7. Current state.

### 10.2 Canonical Roles

The first version shall support only:

```text
OWNER
ADMIN
```

### 10.3 Owner Rules

The Owner may:

- Approve or reject Admin registrations.
- View and edit permitted fields of other users.
- Suspend or deactivate Admins.
- Assign devices.
- Review audit records.
- Access system functions according to the final permission matrix.

### 10.4 Admin Rules

The Admin may:

- View and edit only their own profile.
- View authorised devices assigned to them.
- View authorised monitoring data for assigned devices.
- Use faucet control for assigned devices while the account is active, the device is controllable, and faucet control is enabled (`ENABLE_FAUCET_CONTROL=true`).
- Change their own language preference.

The Admin shall not:

- View another user's private profile.
- Edit another user.
- Approve an account.
- Reject an account.
- Change role.
- Change account status.
- Assign devices to themselves or other users.
- Access Owner-only endpoints.

### 10.5 Object-Level Authorisation

The system shall prevent IDOR/BOLA attacks.

For every request containing:

```text
userId
deviceId
alertId
commandId
auditId
```

the server shall verify that the authenticated user is authorised for that specific object.

### 10.6 Mass Assignment

The server shall use allowlists of editable fields.

Request bodies shall never be mapped directly to database entities.

---

## 11. Account Approval Security

### 11.1 Approval Transaction

Owner approval shall occur transactionally.

The system shall:

- Verify the acting user is an active Owner.
- Lock or re-check the pending account.
- Confirm current status is `PENDING_APPROVAL`.
- Prevent duplicate or conflicting decisions.
- Record the previous and new status.
- Record the acting Owner.
- Record the timestamp.
- Commit before sending notifications.

### 11.2 Approval Replay

Repeated approval or rejection requests shall not create conflicting decisions.

Recommended controls:

- Current-state comparison.
- Transaction locking.
- Idempotency key.
- Unique decision constraint where appropriate.

### 11.3 Notification Failure

Notification failure shall not roll back a valid approval decision.

The notification failure shall be logged separately.

---

## 12. Device Access Security (SEC-RBAC-002)

### 12.1 Mandatory Device Assignment

Admins shall access only explicitly assigned devices. Device assignment is managed by Owners.

Device assignment grants both monitoring access and faucet-control access for active Admin users on active, controllable devices:

```text
Active ADMIN
+ assigned device access
+ active and controllable device
= faucet-control permission
```

Separate per-user-device `canControl` permission grants are not used.

### 12.2 Device Scope Validation

Every device request shall verify:

- User is authenticated and account is `ACTIVE`.
- Device is explicitly assigned to the user (or user is Owner).
- Device is active and controllable.
- Faucet control is enabled (`ENABLE_FAUCET_CONTROL=true`).

### 12.3 Access Revocation

When device access is revoked:

- New API requests shall fail.
- Live event streams shall stop.
- Cached access shall be invalidated.
- Control commands shall not be accepted.
- The event shall be audited.

---

## 13. Faucet-Control Security (SEC-CTRL-001..SEC-CTRL-006)

Faucet control is a high-risk feature because it produces a physical action.

### 13.1 Authorisation Rule

Admin faucet control permission is derived directly from mandatory device assignment:

```text
Active ADMIN
+ assigned device access
+ active and controllable device
= faucet-control permission
```

No separate `canControl` grant is required. Device assignment confers control capability for active Admins on controllable devices.

### 13.2 Server-Side Phase Mapping

The browser shall submit only the selected phase.

The server shall map:

```text
Phase 1 → 300 mL
Phase 2 → 1,000 mL
Phase 3 → 1,500 mL
```

The browser shall not define the authoritative target volume.

### 13.3 Confirmation

The frontend shall require explicit confirmation before command submission.

The confirmation shall display:

- Device.
- Phase.
- Target volume.
- Current device status.
- Any applicable warning.

### 13.4 Command Preconditions

Before creating a command, the server shall verify:

- Active session.
- Active account.
- Control permission.
- Device assignment.
- Device control capability.
- Device active status.
- Device online or controllable status.
- Valid phase.
- No prohibited conflicting command.
- Valid idempotency key.
- Gateway availability, according to policy.

### 13.5 Durable Command Record

A command shall be persisted before publication to the IoT gateway.

If a durable record cannot be created, the command shall not be published.

### 13.6 Idempotency

Every command shall use:

```text
commandId
idempotencyKey
```

The same logical request shall not create more than one physical execution.

### 13.7 Replay Protection

Controls shall include:

- Unique command ID.
- Expiry timestamp.
- TLS.
- Device identity.
- Device-side duplicate memory.
- Valid state transitions.
- Non-retained MQTT command messages.

### 13.8 Completion Integrity

The UI shall not display `COMPLETED` merely because:

- The API accepted the request.
- The gateway published the message.
- MQTT delivered the message.
- The device acknowledged receipt.

Completion requires a valid final device event or approved equivalent.

### 13.9 Timeout Safety

A timeout shall not be displayed as confirmed completion or confirmed closure.

When final physical state is uncertain, the UI shall say so explicitly.

### 13.10 Concurrent Commands

The concurrent-command policy is `TBD`.

Until approved, the safest default is one active faucet command per device.

### 13.11 Cancel and Stop

Cancel and stop functions are `TBD`.

If implemented:

- They require separate permission.
- They reference the original command.
- They require confirmation.
- They remain unconfirmed until device acknowledgement.
- Failure to confirm shall produce an uncertain-state warning.

---

## 14. MQTT and Broker Security (SEC-DEV-001..SEC-DEV-004)

### 14.1 Production Transport

Production devices and gateways shall use:

```text
MQTT over TLS
```

Plain MQTT may be used only in isolated local development.

### 14.2 Anonymous Access

Anonymous production broker access shall be disabled.

### 14.3 Unique Credentials

Each device shall have unique credentials.

Minimum:

```text
Unique client ID
Unique username
Unique strong password
```

Preferred:

```text
Mutual TLS
Unique client certificate
Topic-level ACL
```

### 14.4 Topic ACL

A device shall publish and subscribe only within its own topic namespace.

Example:

```text
ALLOW publish:
.../{deviceId}/telemetry/#
.../{deviceId}/status
.../{deviceId}/heartbeat
.../{deviceId}/ack/#
.../{deviceId}/event/#

ALLOW subscribe:
.../{deviceId}/command/#
.../{deviceId}/config

DENY:
all other topics
```

### 14.5 Broker Administration

Broker administration credentials shall:

- Be separate from device credentials.
- Never be embedded in firmware distributed broadly.
- Never be stored in the browser.
- Be restricted by network and role.
- Be rotated according to policy.

### 14.6 Retained Commands

Faucet commands shall never be retained.

This prevents an old command from executing after a device reconnects.

### 14.7 Last Will

Last Will messages may be retained for device status but shall contain no secrets.

### 14.8 Device Credential Revocation

The system shall support revoking one device without affecting others.

---

## 15. ESP32 / NodeMCU Security Requirements

The hardware team should implement, where supported:

- Secure storage of credentials.
- TLS certificate validation.
- Unique device identity.
- Secure firmware update process.
- Protection against duplicate command execution.
- Command-expiry validation.
- Topic restriction.
- Safe reboot behaviour.
- No hard-coded shared production secrets.
- Logging without secrets.
- Secure time synchronisation where feasible.

Additional controls such as secure boot, flash encryption, and hardware-backed keys are recommended and remain a hardware-team decision.

---

## 16. API Security

### 16.1 HTTPS

All production API traffic shall use HTTPS.

HTTP shall redirect to HTTPS or be disabled.

### 16.2 Input Validation

Every endpoint shall validate:

- Content type.
- Body size.
- Required fields.
- Type.
- Length.
- Enum membership.
- Date format.
- Date range.
- IDs.
- Pagination bounds.
- Locale.
- Device access.
- Current state.

### 16.3 Request Body Limits

Request bodies shall have endpoint-specific size limits.

Large or unexpected bodies shall be rejected.

### 16.4 Rate Limiting

Rate limiting shall apply to:

- Login.
- Registration.
- Password reset.
- Approval decisions.
- Faucet command creation.
- Faucet cancel or stop.
- Exports.
- Expensive historical queries.

Exact limits are `TBD`.

### 16.5 SQL Injection

The system shall use:

- Parameterised queries.
- ORM query builders.
- Allowlisted sort fields.
- Allowlisted filter fields.

### 16.6 Cross-Site Scripting

The frontend shall:

- Escape untrusted content.
- Avoid rendering unsanitised HTML.
- Treat user-entered notes as text.
- Avoid `dangerouslySetInnerHTML` or equivalents unless sanitised.
- Apply Content Security Policy.

### 16.7 CORS

CORS shall allow only approved origins.

Wildcard production origins shall not be used with credentials.

### 16.8 Security Headers

Recommended headers include:

```text
Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
frame-ancestors via CSP
```

### 16.9 Error Handling

API errors shall:

- Use stable codes.
- Avoid stack traces.
- Avoid database details.
- Avoid broker details.
- Avoid revealing whether protected objects exist.
- Include a request ID.

---

## 17. Data Security (SEC-DATA-001..SEC-DATA-004)

### 17.1 Data Classification

Recommended classifications:

| Classification | Examples |
|---|---|
| Public | Approved help text |
| Internal | Device names, non-sensitive settings |
| Confidential | User profiles, device locations, telemetry |
| Restricted | Password hashes, session tokens, credentials, private keys |

### 17.2 Encryption in Transit

Use encryption for:

- Browser to web.
- Web to database where supported.
- Gateway to broker.
- Device to broker.
- Internal service traffic where network trust is insufficient.
- Email provider communication.

### 17.3 Encryption at Rest

Production storage and backups should use encryption at rest.

Restricted secrets shall use dedicated secret storage, not ordinary database columns where avoidable.

### 17.4 Data Minimisation

Store only required user and device data.

Location data shall be exposed only to authorised users.

### 17.5 Retention

Retention periods are `TBD`.

Security-relevant records shall not be deleted before the approved retention period.

---

## 18. Database Security

The database shall:

- Not be publicly exposed.
- Use a dedicated application account.
- Use least privilege.
- Separate migration and runtime privileges where practical.
- Use TLS where supported.
- Maintain backups.
- Protect audit logs.
- Avoid plain-text credentials.
- Use constraints to preserve integrity.
- Log administrative access where supported.

Application users shall never connect directly to the database.

### 18.1 Audit Immutability

Audit logs shall be append-only through normal application functions.

Normal application endpoints shall not support editing or deleting audit records.

### 18.2 Telemetry Integrity

Telemetry insertions shall use unique message IDs to prevent duplicate storage.

Invalid payloads shall not overwrite valid readings.

---

## 19. Secrets Management

### 19.1 Secrets Include

- Authentication secret.
- Database credentials.
- MQTT gateway credentials.
- Device certificates.
- Broker admin credentials.
- Email provider credentials.
- TLS private keys.
- Encryption keys.
- API provider keys.

### 19.2 Storage

Development:

```text
Environment variables in non-committed local files
```

Production:

```text
Managed secret store or secured environment injection
```

### 19.3 Prohibited Locations

Secrets shall not be stored in:

- Git repository.
- Frontend bundles.
- Browser local storage.
- Public issue trackers.
- Screenshots.
- Normal logs.
- Markdown documentation.
- Shared device firmware as one universal credential.

### 19.4 Rotation

The system shall support secret rotation.

The rotation schedule is `TBD`.

Device rotation should permit one device to be rotated independently.

---

## 20. Logging and Audit Security

### 20.1 Required Audit Events

At minimum:

```text
account.registration.created
account.approved
account.rejected
account.suspended
account.deactivated
profile.self.updated
profile.other.updated
device.access.assigned
device.access.removed
auth.login.success
auth.login.failed
faucet.command.created
faucet.command.sent
faucet.command.completed
faucet.command.failed
faucet.command.timeout
alert.acknowledged
authorisation.high_risk.denied
```

### 20.2 Prohibited Log Data

Logs shall not contain:

- Passwords.
- Password hashes.
- Session tokens.
- Reset tokens.
- Device passwords.
- Private keys.
- Full broker credentials.
- Full sensitive request bodies.
- Raw secrets.

### 20.3 Log Integrity

Production logs should be centralised and access-controlled.

Security logs should be protected against unauthorised modification.

### 20.4 Correlation

Use:

```text
requestId
userId
deviceId
commandId
messageId
```

### 20.5 Log Injection

Untrusted values shall be structured and escaped.

Do not concatenate raw user input into unstructured security logs.

---

## 21. Monitoring and Detection

Security monitoring should detect:

- Repeated failed logins.
- Registration floods.
- Repeated forbidden requests.
- Admin attempts to access other profiles.
- Device publishing to unauthorised topics.
- Unknown device connections.
- Duplicate faucet commands.
- Excessive control attempts.
- Broker reconnect storms.
- Invalid payload spikes.
- Command timeout spikes.
- Unexpected privilege changes.
- Audit-log failures.
- Backup failures.

Alert thresholds are `TBD`.

---

## 22. Incident Response

The incident response process shall define:

1. Detection.
2. Triage.
3. Containment.
4. Credential revocation.
5. Device isolation.
6. Evidence preservation.
7. Recovery.
8. Communication.
9. Root-cause analysis.
10. Corrective action.

### 22.1 Compromised User Account

Actions may include:

- Suspend account.
- Revoke sessions.
- Reset password.
- Review audit logs.
- Review faucet commands.
- Review device assignments.
- Notify Owner.

### 22.2 Compromised Device

Actions may include:

- Revoke device credentials.
- Mark device inactive.
- Block broker connection.
- Prevent control commands.
- Preserve telemetry and broker logs.
- Re-provision the device.

### 22.3 Compromised Broker Credential

Actions may include:

- Rotate credential.
- Review topic activity.
- Revoke affected sessions.
- Restrict network access.
- Inspect command and telemetry anomalies.

---

## 23. Backup and Recovery Security

Backups shall:

- Be encrypted.
- Use access control.
- Be stored outside the primary runtime host where practical.
- Be tested through restore exercises.
- Avoid exposing secrets.
- Follow retention policy.

Restore procedures shall verify:

- User accounts.
- Roles and permissions.
- Device assignments.
- Telemetry.
- Faucet commands.
- Audit logs.

Recovery objectives remain `TBD`.

---

## 24. Dependency and Supply-Chain Security (SEC-OPS-001..SEC-OPS-004)

The development process shall:

- Pin dependency versions where appropriate.
- Use lock files.
- Review new dependencies.
- Run vulnerability scanning.
- Remove unused dependencies.
- Restrict install scripts where practical.
- Monitor security advisories.
- Separate development and production dependencies.
- Avoid abandoned libraries for authentication or cryptography.

The project shall not implement custom cryptography.

---

## 25. Secure Development Requirements

Developers and agents shall:

- Read the security specification before modifying authentication, authorisation, device control, or secrets.
- Avoid hard-coded secrets.
- Validate all inputs.
- Add tests for permission changes.
- Add tests for device scoping.
- Add tests for faucet idempotency.
- Review migrations for destructive effects.
- Use code review for security-sensitive changes.
- Update documentation when security behaviour changes.
- Avoid mock authentication in production.
- Avoid development broker credentials in production.

---

## 26. Environment Separation

Development, staging, and production shall use separate:

- Databases.
- Broker namespaces.
- Credentials.
- Devices or device simulators.
- Secrets.
- Domains.
- Logs.
- Backups.

Production data shall not be copied into development without an approved sanitisation process.

---

## 27. Deployment Security

Production deployment shall include:

- HTTPS.
- MQTT over TLS.
- Secure secret injection.
- Non-root containers where practical.
- Minimal container images.
- Restricted network exposure.
- Database private networking.
- Broker ACLs.
- Health checks.
- Automated security updates according to policy.
- Rollback capability.
- Backup verification.

### 27.1 Container Security

Containers should:

- Run as non-root.
- Use read-only filesystems where practical.
- Drop unnecessary capabilities.
- Avoid embedding secrets in images.
- Use trusted base images.
- Be scanned for vulnerabilities.

---

## 28. Physical-Control Safety Integration

Software security cannot guarantee physical safety alone.

The hardware system should independently enforce:

- Safe valve default state.
- Maximum continuous runtime.
- Duplicate-command rejection.
- Command expiry.
- Local emergency stop, if required.
- Fail-safe behaviour after communication loss.
- Protection against stuck relay or valve conditions.
- Actual-flow verification, where available.

These controls require hardware-team confirmation.

The website shall not represent a software command as physically complete unless confirmed through the agreed device contract.

---

## 29. Privacy Requirements

The system shall minimise collection of personal data.

Potential personal data includes:

- Name.
- Email.
- IP address.
- User agent.
- Login history.
- Activity history.

Device latitude and longitude are operational location data and shall be access-controlled.

Privacy retention and disclosure requirements are `TBD`.

---

## 30. Security Testing Requirements

### 30.1 Authentication Tests

- Brute-force protection.
- Invalid credentials.
- Pending account denial.
- Suspended account denial.
- Deactivated account denial.
- Session expiry.
- Session fixation.
- Logout revocation.
- Password reset token reuse.

### 30.2 Authorisation Tests

- Admin cannot approve users.
- Admin cannot edit another profile.
- Admin cannot change own role.
- Admin cannot change own status.
- Admin cannot self-assign a device.
- Device ID manipulation fails.
- Alert ID manipulation fails.
- Command ID manipulation fails.
- Owner-only endpoints reject Admins.

### 30.3 Faucet-Control Tests

- Missing permission denied.
- Unassigned device denied.
- Offline device denied.
- Invalid phase denied.
- Arbitrary target volume ignored or rejected.
- Duplicate request executes once.
- Expired command rejected.
- Retained command not executed.
- Timeout not shown as completion.
- Cross-device command rejected.

### 30.4 MQTT Tests

- Anonymous connection rejected.
- Invalid device credential rejected.
- Device cannot publish to another device topic.
- Device cannot subscribe to another device command topic.
- Revoked device cannot reconnect.
- TLS certificate validation succeeds.
- Plain production MQTT is rejected.
- Duplicate command does not execute twice.

### 30.5 API Tests

- SQL injection attempts.
- Cross-site scripting.
- CSRF.
- Mass assignment.
- Oversized requests.
- Invalid content type.
- Rate limiting.
- CORS.
- Error information leakage.
- Object-level authorisation bypass.

### 30.6 Infrastructure Tests

- Database not publicly exposed.
- Broker admin interface restricted.
- Secrets absent from images.
- Backups encrypted.
- Restore test successful.
- Logs exclude secrets.
- Container runs with restricted privileges.

### 30.7 Security Review

A security review shall occur before production deployment.

Penetration testing is recommended before enabling real physical control in production.

---

## 31. Security Acceptance Criteria

The security implementation is accepted when:

1. Public registration cannot create Owner accounts.
2. Pending Admins cannot access protected pages.
3. Suspended and deactivated accounts lose access.
4. Admins cannot manage other users.
5. Server-side RBAC protects every endpoint.
6. Device access is checked per resource.
7. Monitoring and control permissions remain separate.
8. Faucet phases are mapped on the server.
9. Commands are persisted before publication.
10. Duplicate faucet requests do not cause duplicate execution.
11. Expired commands do not execute.
12. The browser contains no MQTT or device secrets.
13. Production MQTT uses authentication and TLS.
14. Devices are restricted by topic ACL.
15. One device cannot impersonate another.
16. Passwords use approved hashing.
17. Sessions support revocation.
18. Security-sensitive actions are audited.
19. Logs exclude passwords, tokens, and keys.
20. API input is validated.
21. Production uses HTTPS.
22. Secrets are not committed to source control.
23. Backups are protected.
24. Security tests pass.
25. High-risk unresolved items are not silently enabled.

---

## 32. Open Decisions

1. Final authentication library.
2. Session storage mechanism.
3. Session idle and absolute timeout.
4. MFA requirement.
5. Password policy.
6. Email verification.
7. Password reset provider.
8. First Owner provisioning method.
9. Multiple Owner policy.
10. Owner device scope.
11. Admin control permission.
12. ~~Admin alert acknowledgement.~~ **RESOLVED** — Permitted for assigned devices (`alert.acknowledge`) per `RBAC.md`.
13. Concurrent faucet-command policy.
14. Cancel and stop support.
15. Command timeout.
16. Device-side command-ID retention.
17. Username/password versus mutual TLS for devices.
18. Device certificate provisioning.
19. Secret rotation schedule.
20. Rate limits.
21. CORS origins.
22. Content Security Policy details.
23. Audit retention.
24. IP and user-agent retention.
25. Backup objectives.
26. Incident-response ownership.
27. Hardware secure boot and flash encryption.
28. Penetration-testing scope.
29. Production hosting environment.
30. Regulatory and privacy obligations.

---

## 33. Conflicts and Gaps Found

1. The authentication and session mechanism is not final.
2. The Owner account provisioning process is implemented via secure one-time CLI (`DEC-AUTH-006`, `TASK-0106`).
3. Faucet-control permissions for Owner and Admin are unresolved.
4. Concurrent command, cancellation, stop, and timeout policies remain unresolved.
5. Device authentication may use passwords or certificates; the final production approach is not selected.
6. Hardware fail-safe behaviour requires confirmation from the hardware team.
7. Audit, backup, and personal-data retention periods are not defined.
8. The production hosting environment is still under discussion.
9. MFA is recommended for Owner accounts but not yet approved.
10. Security testing must be completed before production physical control is enabled.

---

## 34. First Owner Provisioning Security Controls (`TASK-0106`)

Security controls enforced during initial system bootstrap:
1. **Command-Line Input Safety:** Passwords must NOT be passed as visible command-line arguments. Passwords are accepts interactively via masked terminal input, stdin stream, or environment variable (`OWNER_PASSWORD`). Passwords are never logged or leaked.
2. **Password Policy Enforcement:** Validated directly against §8.2 (12+ characters, uppercase, lowercase, digit, special character).
3. **Argon2id Hashing:** Password hashes use `@node-rs/argon2` with algorithm Argon2id. Plaintext passwords are scrubbed from memory immediately after hashing.
4. **PostgreSQL Advisory Locking:** Acquires `pg_advisory_xact_lock(84736291106)` inside a `Serializable` transaction to eliminate race conditions between concurrent provisioning processes.
5. **Auditing without Leakage:** Logs a system `AuditLog` record (`eventKey = ACCOUNT_PROVISION_OWNER`, `actorUserId = null`, `result = SUCCESS`) containing target ID and role without any passwords, hashes, tokens, or database URLs.
6. **No Pre-created Approval Records:** Omits `AccountApproval` rows to maintain foreign key integrity when no approving Owner user exists.

---

## 35. Presentation Localization Security Boundary (`TASK-0603`)

Frontend presentation translation (`TASK-0603`) operates strictly in the presentation layer:
1. **Canonical Authorisation:** All RBAC checks, session validations, permission guards, and account statuses remain strictly canonical and untranslated.
2. **Audit & Log Integrity:** All audit log keys (`eventKey`), error codes, and server logs retain canonical, language-neutral identifiers.
3. **No Injection via Dictionaries:** Translation strings are loaded from static, server-validated JSON dictionaries with typed keys, preventing injection into runtime security contexts.
