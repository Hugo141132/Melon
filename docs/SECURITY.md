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
- User profilees.
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
- Encrypted in production and development (TLS 1.2/1.3 over TCP `mqtts://` port 8883 / WebSocket `wss://` port 8084 via EMQX Cloud with strict certificate verification `rejectUnauthorized: true`).
- Logged appropriately with sensitive passwords, tokens, and credentials strictly redacted.
- Segregated by environment topic namespaces (`agriculture/development/...` vs `agriculture/staging/...` vs `agriculture/production/...`) and unique client IDs (`gateway-kebun-melon-dev-local-*` vs `gateway-kebun-melon-staging-*` vs `sim-${tankDeviceId}-${random}`).
- Validated for exact topic `deviceId` and payload `deviceId` parity to eliminate device-spoofing vectors. Hardware simulator identities are resolved dynamically via CLI/env rather than hardcoding canonical hardware IDs in source code.
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

### 7.6 Password Recovery & Email Reset Security (DEC-AUTH-102)

Password recovery and email reset shall conform to:

- **Approved Email Provider**: Resend is the approved transactional email provider for password recovery notifications.
- **Anti-Enumeration Guarantee**: `POST /api/v1/auth/forgot-password` unconditionally returns HTTP 200 with a generic message (`If an account exists with that email, a password reset link has been sent.`) regardless of account existence or status, and applies cryptographic timing equalizers to prevent side-channel timing enumeration.
- **Token Security & Cryptography**: Reset tokens are generated as 256-bit (32 bytes) CSPRNG random hex strings. Only the SHA-256 hash (`token_hash`) is stored in the database. Raw tokens are never stored, logged, or serialized into audit records.
- **Trusted Link URL Construction**: Reset URLs are strictly constructed from trusted server environment configuration (`APP_URL` / `NEXT_PUBLIC_APP_URL`). In production, an explicit trusted HTTPS URL is required (cannot point to localhost/127.0.0.1). The untrusted request `Host` header is strictly ignored, preventing password-reset poisoning.
- **Approved Operational Policies**:
  - Token expiry is formally approved as **15 minutes** (`AUTH_RESET_TOKEN_EXPIRY_MINUTES = 15`).
  - Forgot-password rate limit is formally approved as **3 requests per minute** (`RATE_LIMIT_FORGOT_PASSWORD_MAX = 3`).
  - Reset-password rate limit is formally approved as **5 requests per minute** (`RATE_LIMIT_RESET_PASSWORD_MAX = 5`).
  - Environment variables remain available for operational configuration with these approved values as defaults.
- **Single-Use & Replay Protection**: Consumed tokens are marked `used_at = NOW()` and cannot be replayed. Requesting a new token invalidates prior unused tokens for that user.
- **Session Revocation & Account Status Preservation**: Resetting password transactionally revokes all active user sessions across all devices per `TASK-0908`. Password recovery is available to any existing account with an email, but password reset NEVER activates or modifies the account's `accountStatus` (e.g. `PENDING_APPROVAL` or `SUSPENDED` accounts remain unchanged). Normal login status checks continue to enforce access control.

### 7.7 Server-Side Guest Route Guard Security (DEC-AUTH-103)

Guest-only authentication entry points (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) shall enforce:

- **Zero UI Page Flash**: Server Components invoke `requireGuestSession` to evaluate session validity in PostgreSQL before streaming component markup. Valid active sessions immediately receive an HTTP 307 redirect to `/`.
- **Database Session Validation**: Cookie presence alone is never trusted. Only genuinely valid sessions with `accountStatus = ACTIVE` trigger redirection.
- **Stale / Malformed Cookie Resilience**: Invalid, expired, revoked, or fake session cookies resolve cleanly without triggering redirect loops, allowing visitors to re-authenticate normally.
- **Reset-Password & Verify-Email Isolation**: Authenticated active sessions are barred from accessing `/reset-password` or `/verify-email` to prevent accidental consumption of links while logged into another account; users must log out or use an unauthenticated browser.

### 7.8 Registration Email Verification Security (DEC-AUTH-104 / TASK-0214)

Registration email ownership verification shall enforce the following security controls:

- **Decoupled Verification State**: Verification status is recorded in a nullable `emailVerifiedAt` timestamp on the `users` table, completely decoupled from `accountStatus`. Verifying email ownership MUST NEVER alter or automatically activate an account.
- **Owner Authentication Gate**: Although the first Owner is created as `ACTIVE`, login and protected access remain strictly blocked with `EMAIL_NOT_VERIFIED` (HTTP 403) until `emailVerifiedAt` is populated.
- **Admin Approval & Rejection Gate**: Pending Admin registrations cannot be approved or rejected by an Owner via `approvePendingAdmin` or `rejectPendingAdmin` until the applicant's email ownership is verified (`emailVerifiedAt IS NOT NULL`, returning HTTP 409 `INVALID_STATUS` if unverified). Unverified Admin accounts are filtered from the active approval queue (`getPendingApprovals`).
- **Admin Status Preservation**: When an Admin verifies their email, their account status strictly remains `PENDING_APPROVAL` and automatically redirects to `/status?status=PENDING_APPROVAL` until an Owner explicitly reviews and approves the registration.
- **Session-Free Verification**: `POST /api/v1/auth/verify-email` verifies email ownership exclusively and MUST NOT issue, create, or return an authentication session. Normal authentication remains a separate login step.
- **Code Security & Cryptography**: Verification codes are generated as 6-digit numeric CSPRNG random codes (`crypto.randomInt(100000, 1000000)`). Only the scoped SHA-256 hash `sha256(userId:code)` is persisted in `email_verification_tokens.token_hash`. Scoping prevents hash collisions across different users receiving the same numeric code. Raw codes and tokens are never logged or persisted in plaintext.
- **Code Expiry & Replay Protection**: Verification codes expire after **15 minutes** (`AUTH_VERIFY_TOKEN_EXPIRY_MINUTES = 15`). Creating a new verification code transactionally invalidates prior unused codes for the user. Upon successful verification, the code record is consumed/deleted.
- **Anti-Enumeration & Rate Limiting**: `POST /api/v1/auth/resend-verification` unconditionally returns HTTP 200 with a generic message regardless of email existence or verification state, applies timing attack mitigations, and is rate-limited to 3 requests per minute (`RATE_LIMIT_RESEND_VERIFICATION_MAX = 3`). `POST /api/v1/auth/verify-email` is rate-limited to 5 requests per window. The frontend enforces a 60-second cooldown timer on code resend.
- **Resend Email Delivery Reliability**: Email dispatch via Resend applies `sendWithRetry` with bounded exponential backoff (up to 3 attempts, initial delay 300ms, max 2500ms) and randomized jitter (0–100ms) for transient errors, including HTTP 429 rate limits, HTTP 5xx server errors, and network timeouts (`ECONNRESET`, `ETIMEDOUT`). Structured error logs strictly redact API keys, tokens, and recipient secrets.
- **Database Concurrency & Conflict Protection**: In `verifyEmailWithToken`, Prisma `P2034` transaction write conflicts are retried with bounded exponential backoff (3 attempts), returning `CONCURRENCY_CONFLICT` (HTTP 409) upon exhaustion and `TOKEN_ALREADY_USED` (HTTP 400) for `P2025` records.
- **Frontend In-Flight Request Deduplication**: The `/verify-email` view uses a module-level in-flight Promise map with immediate cache eviction on settlement (`finally`), preventing competing network requests during React Strict Mode or remounts while delivering navigation triggers to the active mount.
- **Delivery & Testing Scope**: Verification has been manually exercised using Resend test mode/test recipients and 6-digit code dispatch. We have not yet tested delivery to arbitrary real email recipients using a verified custom sending domain, because no such domain is currently configured. Real-mailbox deliverability is treated as pending deployment/infrastructure acceptance, not an application logic failure.

### 7.9 Self-Service Verified Email Change Security (SEC-AUTH-006 / DEC-AUTH-106)

Self-service email changes for authenticated users shall enforce the following security controls:

- **Re-Authentication Barrier**: `POST /api/v1/me/email/request` mandates verification of the user's `currentPassword` before accepting an email change request.
- **Authority Isolation**: The existing email remains 100% authoritative for login, notifications, and access control until the new email address is verified.
- **Candidate Uniqueness & Collision Checking**: The candidate `newEmail` is verified for uniqueness against both existing `User.email` records and active `EmailVerificationToken.pendingEmail` tokens.
- **Token Cryptography & Scoping**: Generates a 6-digit numeric CSPRNG code (`100000`–`999999`) with 15-minute expiry (`AUTH_VERIFY_TOKEN_EXPIRY_MINUTES = 15`), persisting only user-and-target-scoped SHA-256 hashes `sha256(userId:newEmail:code)` in `email_verification_tokens`. Raw codes are never persisted or logged.
- **Atomic Promotion & Concurrency**: Verification (`POST /api/v1/me/email/verify`) operates in an atomic `RepeatableRead` transaction with bounded exponential backoff retries (3 attempts) on `P2034` write conflicts.
- **Session Preservation**: Upon verification, the active session is preserved and synchronized in-memory via `AuthContext` without forced logout.
- **Privacy-Preserving Audit Logging**: The emitted `account.email.changed` audit log contains strictly non-sensitive metadata (`{ emailChanged: true }`), omitting raw plaintext old/new email addresses.

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

### 8.4 Password Reset and Recovery (DEC-AUTH-102 / TASK-0213)

Password recovery and email reset flow shall conform to the following security controls:

- **Approved Email Provider**: Transactional recovery emails are dispatched via **Resend** using `resend.emails.send`. In non-production/test environments without API keys, delivery is safely simulated without crashing.
- **Token Cryptography**: Tokens are generated using 256-bit (32 bytes) CSPRNG random hex strings (`crypto.randomBytes(32).toString('hex')`).
- **Storage**: Only the cryptographic SHA-256 hash of the token (`crypto.createHash('sha256').update(rawToken).digest('hex')`) is stored in the `password_reset_tokens.token_hash` column. Raw tokens are NEVER stored in the database.
- **Redaction & Masking**: Raw tokens and constructed reset URLs are strictly forbidden from appearing in application logs, database tables, or error responses.
- **Trusted Reset URLs**: Reset URLs (`${baseUrl}/reset-password?token=${rawToken}`) are constructed strictly from server-configured environment variables (`APP_URL` / `NEXT_PUBLIC_APP_URL`). The untrusted request `Host` header MUST NEVER be used, preventing Host Header poisoning attacks.
- **Anti-Enumeration Guarantee**: `POST /api/v1/auth/forgot-password` unconditionally returns HTTP 200 with a generic message (`If an account exists with that email, a password reset link has been sent.`) regardless of whether the email exists, has pending approval, or is suspended.
- **Single-Use and Invalidation**: Prior unused tokens for the user are invalidated upon new token creation. Once consumed, the token is marked `used_at = NOW()` and cannot be replayed.
- **Configurable Expiration**: Token expiry is environment-configurable via `AUTH_RESET_TOKEN_EXPIRY_MINUTES` (default: 15 minutes).
- **Session Revocation**: Successful password reset transactionally invalidates the used token, invalidates any other pending tokens for the user, and revokes all existing user sessions across devices (`session-service.ts` / `TASK-0908`).
- **Account Eligibility**: Password reset is restricted to accounts with `ACTIVE` status. Password reset MUST NEVER activate, approve, or alter the `accountStatus` of pending or suspended accounts.
- **Audit Logging**: Structured audit logs are emitted for `auth.password_reset.requested`, `auth.password_reset.completed`, and `auth.password_reset.failed` without logging passwords, tokens, or hashes.

### 8.5 Verified Self-Service Email Change (DEC-AUTH-106 / TASK-0216)

Self-service email change for authenticated users shall conform to the following security controls:

- **Authentication & Eligibility**: Only authenticated users with `ACTIVE` account status may request an email change. Current password verification is required before generating a verification code.
- **Authority Isolation**: The user's existing email address remains 100% authoritative for all system logins, notifications, alerts, and access control until the new email address is successfully verified.
- **6-Digit Code Cryptography**: Verification codes are 6-digit numeric CSPRNG codes (`100000`–`999999`) with an approved 15-minute lifetime (`AUTH_VERIFY_TOKEN_EXPIRY_MINUTES = 15`).
- **Target & User Scoped Hashing**: The code is hashed as `sha256(userId:newEmail:code)` and stored in `email_verification_tokens.token_hash`, with candidate email stored in `email_verification_tokens.pending_email`. Raw codes are never stored in plaintext or logged.
- **Atomic Uniqueness & Commit**: Target email uniqueness is validated at request time and re-validated inside the commit transaction. Verification updates `users.email = newEmail` and `users.emailVerifiedAt = NOW()`, deletes the token, and preserves the active session without forced logout.
- **Rate Limiting & Anti-Abuse**: `POST /api/v1/me/email/request` is rate-limited to 3 req/min; `POST /api/v1/me/email/verify` is rate-limited to 5 req/min.
- **Privacy-Preserving Audit Logging**: Audit log for `account.email.changed` records non-sensitive operational metadata (e.g. `{ action: 'EMAIL_CHANGED' }`, actor user ID, target user ID, timestamp). Plaintext raw old or new email addresses MUST NEVER be recorded in audit log records.

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
- **Absolute expiry**: 8 hours maximum session lifetime (`SESSION_ABSOLUTE_LIFETIME_MS = 28800000`).
- Revocation on logout, password change, suspension, or deactivation.

### 9.3 Session Revocation

Sessions shall be revoked or restricted when:

- User logs out.
- Password changes (revokes all active sessions).
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

### 9.6 Single Active Session Enforcement (DEC-AUTH-107 / TASK-0217)

To prevent credential sharing, concurrent operational conflicts, and session hijacking risks, the system strictly enforces a single active session policy:

- **Maximum 1 Active Session**: Each user account is permitted exactly one valid active session at any given time.
- **Denial & Preservation Semantics**: When valid credentials (`email` + `password`) are provided during `POST /api/v1/auth/login`, if an active session already exists (where `revokedAt IS NULL`, `NOW() < expiresAt`, and `NOW() - lastSeenAt <= 30m`), the login request is rejected with HTTP 409 Conflict (`ACTIVE_SESSION_EXISTS`).
- **Existing Session Integrity**: The existing valid active session is NEVER revoked, invalidated, or downgraded by the rejected concurrent login attempt.
- **Automatic Stale Session Cleanup**: Expired (`NOW() >= expiresAt`), idle-timed-out (`NOW() - lastSeenAt > 30m`), or revoked sessions are soft-revoked inside the transaction and do not block subsequent logins.
- **Database Concurrency Guarantee**: Single active session checks are executed atomically inside a PostgreSQL/Prisma transaction using user row locking and indexed lookups on `sessions(user_id, revoked_at, expires_at)`.

---

## 10. Authorisation Security (SEC-RBAC-001..SEC-RBAC-004)004)

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

- View and edit only their own profilee.
- View authorised devices assigned to them.
- View authorised monitoring data for assigned devices.
- Use faucet control for assigned devices while the account is active, the device is controllable, and faucet control is enabled (`ENABLE_FAUCET_CONTROL=true`).
- Change their own language preference.

The Admin shall not:

- View or edit the external canonical `deviceId` across any UI component or API response (`DEC-DEV-028`).
- View another user's private profilee.
- Edit another user.
- Approve an account.
- Reject an account.
- Change role.
- Change account status.
- Assign devices to themselves or other users.
- Access Owner-only endpoints.

### 10.5 Object-Level Authorisation and Identity Concealment

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

For device resources:
- Internal database primary key UUIDs (`devices.id`) are immutable and anchor all relational integrity.
- Admin users are restricted to assigned devices, and API responses strictly conceal the canonical `deviceId` (`DEC-DEV-028` / `TASK-0305`).
- `GET /api/v1/devices/{deviceId}` strictly enforces active-account and `device.read` permission checks before querying the database, eliminating device-existence leakage and timing attacks on non-active accounts (`TASK-0305`).
- IDOR/BOLA attacks attempting to query unassigned or revoked devices return HTTP 403 `DEVICE_NOT_ASSIGNED`.
- In-app device creation is forbidden; device endpoints do not accept client-side creation requests (`DEC-DEV-027`).
- **Data-Loss Prevention via Zero Hard Deletion (`DEC-DEV-030`)**: Device hard deletion (`DELETE /api/v1/devices/{deviceId}`) is strictly forbidden and removed across all layers. Device lifecycle is controlled via `POST /deactivate` and `POST /activate`, preserving all historical telemetry, command, alert, and audit logs. Deactivation immediately revokes faucet control capabilities.

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
Phase 1 → 300 mL (UI 0.3 L)
Phase 2 → 1,000 mL (UI 1 L)
Phase 3 → 1,500 mL (UI 1.5 L)
```

The browser shall not define the authoritative target volume.

### 13.3 Confirmation

The frontend shall require explicit confirmation before command submission.

The confirmation modal shall display:

- Device name.
- Action (`DISPENSE`, `OPEN`, or `CLOSE`).
- Phase & Volume per plant (for `DISPENSE`).
- Plant count & total calculated Liters (for `DISPENSE`).
- Explicit warning messages for manual valve operations (`OPEN` / `CLOSE`).

### 13.4 Command Preconditions

Before creating a command, the server shall verify:

- Active session.
- Active account.
- Control permission (`device.control.dispense`).
- Device assignment.
- Device control capability (`WATER_TANK_NODE`).
- Device active status.
- Feature flag status (`ENABLE_FAUCET_CONTROL=true`).
- Device online status.
- Valid phase and integer `plantCount >= 1` (for `DISPENSE`).
- No conflicting active command (maximum 1 active command per device).
- Valid idempotency key.

### 13.5 Durable Command Record

A command shall be persisted in PostgreSQL as `QUEUED` with an audit log before publication to the IoT gateway.

If a durable record cannot be created, the command shall not be published.

### 13.6 Idempotency (TASK-0807)

Every command dispatched from the UI shall transmit a unique idempotency key via the standard HTTP header:

```text
Idempotency-Key: cmd-<uuid>
```

The frontend does not inject arbitrary body fields for idempotency. The backend enforces unique idempotency keys within transactional boundaries, returning the existing command record on identical retries and HTTP 409 `IDEMPOTENCY_CONFLICT` on mismatched payloads.

### 13.7 Replay Protection

Controls shall include:

- Unique command ID.
- Strict 5-minute expiry timestamp (`expiresAt = requestedAt + 5m`).
- TLS for MQTT and REST.
- Per-device topic authorization ACLs.
- Non-retained MQTT command messages (`retain = false`, QoS 1).

### 13.8 Completion & Physical State Integrity (TASK-0807)

The UI shall not display `COMPLETED` or assume valve state closure merely because:

- The API accepted the request.
- The gateway published the message.
- The device acknowledged receipt.

**Authoritative Physical State Rules:**
- Active commands (`QUEUED`, `SENT`, `ACKNOWLEDGED`, `IN_PROGRESS`) strictly present `UNKNOWN`.
- `DISPENSE` completion strictly presents `UNKNOWN` (the system cannot authoritatively confirm whether the physical valve mechanically closed without dedicated limit switches).
- Only terminal `COMPLETED` manual `OPEN` transitions to `OPEN`.
- Only terminal `COMPLETED` manual `CLOSE` transitions to `CLOSED`.
- Terminal `FAILED` or `TIMEOUT` strictly preserves `UNKNOWN`.

### 13.9 Timeout Safety

A timeout shall record `physicalOutcome = 'UNKNOWN'` without claiming known physical completion.

### 13.10 Concurrent Commands

Enforced as exactly one active faucet command (`QUEUED`, `SENT`, `ACKNOWLEDGED`, `IN_PROGRESS`) per device via partial unique index `faucet_commands_one_active_per_device`.

### 13.11 Manual Open/Close Actions (TASK-0807)

Manual `OPEN` and `CLOSE` controls are implemented on `/controls`:

- Require `device.control.dispense` and `ENABLE_FAUCET_CONTROL=true`.
- Require explicit confirmation in dedicated modal dialogs with safety warnings.
- Omit phase, plantCount, and volume parameters.
- Dispatched through standard `Idempotency-Key` header flow.

### 13.12 No Blind Retries (TASK-0807)

The UI performs zero automatic resubmissions or blind retry loops when commands fail or time out. All command retries require explicit, conscious user re-confirmation. Status polling occurs strictly via read-only `GET` requests during active states.

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
- Faucet manual open/close.
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
| Confidential | User profilees, device locations, telemetry |
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

### 17.5 Data Retention and Lifecycle Policy (TASK-0913 / SEC-DATA-004)

1. **High-Frequency Raw Telemetry Retention:** Raw sensor telemetry (`soil_readings`, `water_readings`, `reservoir_water_readings`, `sensor_battery_readings`) and ephemeral operational logs (`device_status_events`, `integration_errors`) are subject to an automated 90-day retention policy (`DEC-MON-048`). Records older than 90 days are automatically purged in controlled batches.
2. **Protected & Exempt Records (Non-Purgeable):**
   - Compliance and security audit logs (`audit_logs`) are strictly exempt from telemetry purges and retained indefinitely.
   - Actuator commands and lifecycle state transitions (`faucet_commands`, `faucet_command_events`) are retained permanently for physical accountability and safety auditing.
   - Account approvals and rejection history (`account_approvals`) are retained permanently.
3. **Immutability Enforcement:** The database service layer ([`RetentionService`](file:///c:/Users/Puroh/Documents/Melon/packages/database/src/retention-service.ts)) enforces a strict whitelist (`APPROVED_RETENTION_TABLES`). Any programmatic attempt to invoke retention deletion against protected tables throws `UnapprovedRetentionTableError`.

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

### 18.1 Audit Immutability (SEC-DATA-004)

Audit logs shall be append-only through normal application functions.

Normal application endpoints and automated maintenance jobs shall not support editing or deleting audit records. Audit records are explicitly excluded from data retention purges.

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
profilee.self.updated
profilee.other.updated
device.updated
device.activated
device.deactivated
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
- Admin attempts to access other profilees.
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
- Admin cannot edit another profilee.
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
14. Manual Open/Close support.
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
29. ~~Production hosting environment.~~ **RESOLVED** — Dedicated Linux VPS with containerized topology behind automated HTTPS reverse proxy (`TASK-1011`, `DEC-INF-088`).
30. Regulatory and privacy obligations.

---

## 33. Conflicts and Gaps Found

1. The authentication and session mechanism is not final.
2. The Owner account provisioning process is implemented via secure one-time CLI (`DEC-AUTH-006`, `TASK-0106`).
3. Faucet-control permissions for Owner and Admin are unresolved.
4. Concurrent command, manual open/close, stop, and timeout policies remain unresolved.
5. Device authentication may use passwords or certificates; the final production approach is not selected.
6. Hardware fail-safe behaviour requires confirmation from the hardware team.
7. Audit, backup, and personal-data retention periods are not defined.
8. ~~The production hosting environment is still under discussion.~~ **RESOLVED** — Dedicated Linux VPS with Docker Compose, hardened OS, UFW firewall, SSH key-only access, non-root containers, and automated HTTPS reverse proxy (`TASK-1011`); staging is containerized (`TASK-1012`), decoupled from Railway (`DEC-INF-088`).
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

---

## Monitoring and Device Security Controls Implementation Note (Reconciled 2026-08-19)

The following security controls are active and verified across monitoring endpoints and device selection (`TASK-0306`, `TASK-0501`, `TASK-0503`, `TASK-0504`):
- **Server-Side Authorization & Anti-Enumeration:** Monitoring endpoints (`/monitoring/latest`, `/monitoring/soil/latest`, `/monitoring/water/latest`, `/monitoring/soil/history`, `/monitoring/water/history`) execute authentication and `device.read` / `monitoring.history.read` permission checks before attempting database lookups. Unauthenticated requests return 401; unassigned Admin device requests return 403, preventing device existence probing or IDOR/BOLA exploitation.
- **Admin Identifier Concealment (`DEC-DEV-028`):** Admin users receive only user-facing device names and metadata; canonical `deviceId` strings are strictly concealed across UI, list, and detail API payloads. Safe immutable UUIDs (`devices.id`) are used for frontend routing.
- **Strict Query Range Boundaries (`DEC-MON-087`):** Historical telemetry queries enforce maximum date range limits (31 days) and page size limits (max 100), rejecting abusive ranges with HTTP 400 (`DATE_RANGE_EXCEEDED`).
- **Empty Result Integrity:** Zero-matching telemetry queries safely return HTTP 200 with empty series, preventing data leakage or confusion with missing device 404 errors.
< ! - -   T A S K - 0 8 0 2   R e c o n c i l e d :   2 0 2 6 - 0 8 - 1 9   - - >  
 
---

## Gateway Command Publishing Security Controls Implementation Note (Reconciled 2026-08-20)

The following security controls are active and verified across the gateway command publisher (`TASK-0804`):
- **Broker Direct Isolation:** Browsers are completely isolated from MQTT brokers; publishing occurs exclusively through the server-side gateway backend via authenticated TLS connection.
- **Payload Sanitization:** For `OPEN` and `CLOSE` commands, `phase`, `plantCount`, and `targetVolumeMl` are strictly omitted to prevent parameter tampering or unexpected actuator states.
- **QoS & Retention Safety:** All faucet commands publish with QoS 1 and `retain=false` to prevent stale command replay upon device reconnection.
- **State Progression Safety:** Commands transition to `SENT` only upon confirmed broker publication. Failed/disconnected publishes remain `QUEUED`. Expired commands transition to `EXPIRED` without transmission.
<!-- TASK-0804 Reconciled: 2026-08-20 -->

---

## Device Acknowledgement Processing Security Controls Implementation Note (Reconciled 2026-08-20)

The following security controls are active and verified across the device acknowledgement processor (`TASK-0805`):
- **Zero Security Exceptions:** No security bypasses, exceptions, or hardcoded secrets were introduced.
- **Topic & Payload Validation:** Validates incoming messages on canonical QoS 1 topics `agriculture/{environment}/{siteId}/{deviceId}/ack/faucet`. Validates schema structure and enforces identity matching between topic `deviceId` and payload `deviceId`.
- **Persisted Command Action Assertion:** Retrieves the persisted `FaucetCommand` and strictly asserts its action is one of `DISPENSE`, `OPEN`, `CLOSE` before updating state, safely rejecting unsupported actions.
- **Replay & Idempotency Protection:** Replayed `messageId` occurrences are detected against event history without executing redundant database updates or regressing command state.
- **Out-of-Order Safety:** Late or non-`SENT` ACKs are ignored safely without altering command status.
- **Outcome Separation:** Status is never transitioned to `COMPLETED` during ACK processing; physical state is never inferred until verified downstream execution events arrive (`TASK-0806`).
<!-- TASK-0805 Reconciled: 2026-08-20 -->

---

## Device Execution Event State Machine Security Controls Implementation Note (Reconciled 2026-08-20)

The following security controls are active and verified across the device execution event processor (`TASK-0806`):
- **Zero Security Exceptions:** No security bypasses, unauthenticated endpoints, or hardcoded credentials were introduced.
- **Topic & Device Isolation:** Subscribes to canonical QoS 1 topics `agriculture/{environment}/{siteId}/{deviceId}/event/faucet`. Validates schema structure, topic-payload device identifier consistency, and topic `siteId` matching.
- **Authoritative Physical State Safeguard:**
  - `COMPLETED OPEN` → `physicalState: 'OPEN'`
  - `COMPLETED CLOSE` → `physicalState: 'CLOSED'`
  - `COMPLETED DISPENSE` → `physicalState: 'UNKNOWN'` (valve closure is NEVER assumed without direct physical confirmation)
  - `FAILED` / `IN_PROGRESS` / timeout / uncertain → `physicalState: 'UNKNOWN'`
  - Prevents false claims of closed valve positions following dispense cycles.
  - Physical state is NEVER inferred from API creation, MQTT publication, or command ACKs.
- **Terminal State Immutability & Replay Defense:** Commands in terminal statuses (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `EXPIRED`) ignore incoming events without state mutation or redundant writes.
- **Duplicate Idempotency:** Duplicate `messageId` occurrences are matched against stored event history and ignored without invoking database writes.
- **Failure Alert Dispatching:** Generates `CommandFailureAlert` for `FAILED` execution events linking device, command, and `physicalOutcome: 'UNKNOWN'`.
<!-- TASK-0806 Reconciled: 2026-08-20 -->

---

## Centralized Authentication State Hydration Security Controls Implementation Note (Reconciled 2026-08-22)

The following security controls are active and verified for `TASK-0215` (Centralized Authentication State Hydration):
- **Server Authorization Independence:** Hydrated auth state in React `AuthContext` is strictly for presentation and UX responsiveness. Every API route and Server Action independently executes full, authoritative server-side session and RBAC authorization (`requireSession`, `requireRole`, `requirePermission`).
- **Data Minimization:** `AuthContext` and `getSessionOrNull()` expose only non-sensitive user and role metadata (`id`, `fullName`, `email`, `accountStatus`, `activeRoles`). No session tokens, secret keys, or database credentials are included in context.
- **Zero Client Token Storage:** Session tokens remain stored solely in `HttpOnly`, `Secure`, `SameSite` cookies; tokens are never mirrored to `localStorage` or `sessionStorage`.
- **Safe Non-Throwing Retrieval:** `getSessionOrNull()` safely catches and neutralizes unauthenticated session errors during SSR without leaking stack traces or unhandled exceptions.
<!-- TASK-0215 Reconciled: 2026-08-22 -->

---

## Controls Loading & Header Device Selector Security Controls Implementation Note (Reconciled 2026-08-27)

The following security controls are active and verified regarding `TASK-0807`, `TASK-0502`, and `TASK-0306` (`/controls` Loading & Header Stability):
- **Zero Fabricated State:** Skeletons and placeholder states in `WaterTankMonitoringCard` and `FaucetControlPanel` never fabricate sensor measurements (e.g. tank volume, flow rate) or physical actuator states (`OPEN` / `CLOSED`) during loading.
- **Admin Device ID Concealment:** The centered header `DeviceSelector` and controls views strictly preserve canonical `deviceId` concealment for Admin accounts (`DEC-DEV-028`).
<!-- Controls Loading & Header Centering Security Reconciled: 2026-08-27 -->

---

## Single Active Session Enforcement & Profile Security Controls Note (Reconciled 2026-08-29)

The following security controls are active and verified regarding `TASK-0217` (Single Active Session Enforcement and Profile Security UI):
- **Universal Single Active Session Limit (`DEC-AUTH-107` / `SEC-AUTH-007`):** Enforces at most 1 active session per user account across all client devices.
- **Fail-Closed Concurrency & Database Row Locking:** During login, `session-service.ts` acquires an explicit PostgreSQL user row lock (`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`) inside a transaction, eliminating race conditions during simultaneous login attempts.
- **Conflict Denial & Session Preservation:** A new valid login attempt against an account with an active session is rejected with HTTP 409 Conflict (`ACTIVE_SESSION_EXISTS`). The pre-existing valid active session is never invalidated or downgraded by the rejected attempt.
- **Automatic Stale Session Pruning:** Sessions past their absolute lifetime (8 hours), idle timeout (30 minutes), or explicitly revoked are soft-revoked inside the login transaction and do not block subsequent logins.
- **Fail-Closed Logout Semantics:** `POST /api/v1/auth/logout` extracts the session token, revokes the session row in PostgreSQL (`revoked_at = NOW()`), records an `AUTH_LOGOUT` audit log, and clears the cookie. If an unexpected server/database error occurs, the endpoint fails closed with HTTP 500 `INTERNAL_ERROR` rather than a false 204 success.
- **Profile UI Privacy & Password Revocation (`DEC-UIUX-102`):** Removed misleading "Linked Devices" from `/profile`, omitted unapproved client PII (IP address and User-Agent), and wired Change Password to `POST /api/v1/auth/change-password` with session revocation and redirect to `/login?message=PASSWORD_CHANGED`.
<!-- TASK-0217 Reconciled: 2026-08-29 -->

---

## Verified Self-Email Change & Test Isolation Security Controls Note (Reconciled 2026-08-30)

The following security controls are active and verified regarding `TASK-0216` (Verified Self-Email Change) and test environment isolation:
- **Authority Preservation (`DEC-AUTH-106`):** The current email remains 100% authoritative for authentication, RBAC authorization, and system communications until the verification code sent to the new email is verified.
- **Re-Authentication Requirement:** Requesting an email change strictly requires valid `currentPassword` verification, preventing session hijackers or unauthorized physical access from initiating email changes without credentials.
- **Scoped Token Hashing & CSPRNG:** Verification codes are 6-digit numeric CSPRNG strings with 15-minute expiry. Stored token hashes in PostgreSQL are scoped cryptographically via `sha256(userId:newEmail:code)`, preventing replay or cross-user token substitution.
- **Privacy-Preserving Audit Logging (`SEC-AUTH-006`):** Emits structured audit event `account.email.changed` containing strictly non-sensitive audit metadata (user ID, timestamp, IP/actor reference) without logging raw plaintext old or new email addresses.
- **Test Database Isolation & Fail-Closed Guards:** `validateTestDatabaseUrl` enforces strict isolation across test runners. All automated integration and E2E suites fail closed if executed against remote cloud environments (`supabase.co`, `supabase.com`, `railway.app`, `neon.tech`), and all E2E test identities use synthetic disposable identifiers with full deterministic teardown.
<!-- TASK-0216 Reconciled: 2026-08-30 -->


---

## TASK-0915: Real-Time Faucet Command History Synchronization

*This section documents the resolution of real-time event delivery failures across the system (Recorded: 2026-09-01).*

### 1. Original Problem
- Faucet Command History did not update automatically.
- QUEUED appeared immediately, but SENT/ACKNOWLEDGED/IN_PROGRESS/COMPLETED required a manual refresh.

### 2. Investigation Timeline
- Initial suspicion: Frontend state reconciliation logic.
- Investigated React 18 batching and `lastEvent`/`useEffect` flow.
- Investigated device ID filtering for Server-Sent Events (SSE).
- Discovered that the issue affected both `ADMIN` and `OWNER` accounts, eliminating RBAC/UUID filtering as the root cause.

### 3. Final Root Cause
- IoT Gateway sends `faucet.command.updated` through an internal webhook.
- Next.js middleware blocked `/api/v1/internal/realtime/publish` because it lacked a user `session_token` cookie.
- Backend-to-backend authentication uses `INTERNAL_SERVICE_TOKEN` instead of user sessions.
- The webhook returned a `401 UNAUTHENTICATED` before reaching the route handler.
- Therefore, `realtimeEventHub` never received IoT lifecycle events, and SSE never delivered status updates to `FaucetHistoryTable`.

### 4. Final Fix
- Added `/api/v1/internal/` to `PUBLIC_PATH_PREFIXES` in the Next.js middleware.
- Kept `INTERNAL_SERVICE_TOKEN` validation inside the internal realtime publish route to enforce machine-to-machine authentication.
- Preserved all security and RBAC isolation mechanisms.

### 5. Verification
- `OWNER` and `ADMIN` were both affected prior to the fix.
- `FaucetStatusCard` updated correctly because it used fallback polling.
- `FaucetHistoryTable` depended entirely on SSE.
- After the fix, the expected flow (`QUEUED` → `SENT` → `ACKNOWLEDGED` → `IN_PROGRESS` → `COMPLETED`) successfully updates the same history row without requiring manual refresh.

### 6. Deployment Notes
- **Only the web application deployment is required.**
- No database migrations.
- No IoT Gateway deployment required.
- No MQTT configuration changes required.
- Staging environments must update the `web` service to reflect the middleware change.

---

## Operational Dashboard & Environmental Weather Security Controls Note (TASK-0506 / Reconciled 2026-09-02)

The following security and privacy controls are verified for `TASK-0506` (`/` and `/dashboard`):
- **Fixed Coordinates & Zero Geolocation Tracking:** Environmental weather in `WeatherCard.tsx` uses hardcoded static farm coordinates (Latitude `-7.172934`, Longitude `113.2257627`). Browser geolocation APIs (`navigator.geolocation`) are completely omitted, preventing client location tracking or PII leakage.
- **Public Weather API Boundary:** Weather data is retrieved client-side from the public Open-Meteo REST API without storing, transmitting, or embedding third-party API keys or credentials.
- **Canonical Identifier Concealment:** The dashboard summary cards expose only aggregated node counts (`Total`, `Online`, `Offline/Stale`). Canonical device IDs (`deviceId`) remain concealed from Admin users (`DEC-DEV-028`).
- **Zero Ingestion of Synthetic Claims:** The synthetic 92/100 health score is permanently deleted, eliminating fabricated system health representations.
<!-- TASK-0506 Security Reconciled: 2026-09-02 -->

