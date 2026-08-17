# Testing Strategy and Quality Assurance Specification

## 1. Document Information

| Item | Description |
|---|---|
| Product | Web-Based Soil and Water Monitoring and Faucet Control System |
| Document | Testing Strategy and Quality Assurance Specification |
| Version | 1.0 |
| Status | Proposed baseline test plan |
| Primary roles | `OWNER`, `ADMIN` |
| Device platform | ESP32 / NodeMCU |
| Recommended device protocol | MQTT 5.0 over TLS |
| Related documents | `FRONTEND_AUDIT.md`, `UI_UX.md`, `PRD.md`, `RBAC.md`, `USER_FLOWS.md`, `I18N.md`, `DEVICE_COMMUNICATION.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `SECURITY.md` |

---

## 2. Purpose

This document defines how the application shall be tested before release.

The test strategy covers:

- User registration and account approval.
- Authentication and session management.
- Owner and Admin authorisation.
- Device-level access.
- Soil and water monitoring.
- Historical data.
- Device online, offline, stale, empty, and invalid states.
- Faucet-control commands.
- MQTT communication.
- English and Bahasa Indonesia.
- API contracts.
- Database integrity.
- Security.
- Performance.
- Reliability.
- Accessibility.
- Deployment validation.
- Production release gates.

The goal is to ensure that the application behaves correctly, securely, consistently, and safely before real devices and physical control are enabled in production.

---

## 3. Testing Objectives

The test programme shall verify that:

1. Product requirements are implemented correctly.
2. Only authorised users access protected features.
3. Admin accounts remain blocked until Owner approval.
4. Admins cannot manage other users.
5. Owners can manage permitted user and device access.
6. Device data is never mixed between devices.
7. Monitoring values preserve zero, null, stale, and invalid semantics.
8. Historical queries return correct bounded results.
9. Language switching does not alter permissions or data.
10. Faucet commands are validated, idempotent, auditable, and safely reported.
11. MQTT messages are authenticated and isolated by device.
12. The system fails safely when dependencies are unavailable.
13. Security controls resist common web and IoT attacks.
14. The system meets defined performance and reliability targets.
15. Release quality is measurable and repeatable.

---

## 4. Testing Principles

### 4.1 Risk-Based Testing

The highest-priority test areas are:

```text
1. Faucet control
2. Authentication and session security
3. Owner/Admin RBAC
4. Device-level access isolation
5. MQTT command delivery and duplicate prevention
6. Account approval
7. Telemetry correctness
8. Audit integrity
```

### 4.2 Automation First

Automated tests shall cover stable, repeatable behaviour.

Manual testing shall focus on:

- Visual quality.
- Exploratory testing.
- Hardware behaviour.
- Accessibility.
- Operational scenarios.
- Usability.
- Uncertain physical states.

### 4.3 Test at Multiple Layers

The system shall be tested through:

- Unit tests.
- Component tests.
- Contract tests.
- Integration tests.
- API tests.
- Database tests.
- End-to-end tests.
- Security tests.
- Performance tests.
- Hardware-in-the-loop tests.
- User acceptance tests.

### 4.4 Production-Like Environments

Staging shall resemble production for:

- Authentication.
- Database.
- MQTT broker.
- TLS.
- Device credentials.
- Gateway.
- Real-time delivery.
- Environment variables.
- Deployment topology.

### 4.5 Safe Physical Testing

Physical faucet-control testing shall begin with:

1. Device simulator.
2. Relay or valve simulator.
3. Controlled laboratory device.
4. Measured water output.
5. Limited staging deployment.
6. Production enablement after approval.

---

## 5. Test Scope

### 5.1 In Scope

- Existing frontend behaviour.
- Authentication.
- Registration.
- Approval.
- RBAC.
- Profile management.
- Device assignment.
- Telemetry ingestion via **REST API over Wi-Fi** (soil payload validation, water quality payload validation, invalid payload rejection, unauthorized device rejection, shared BAT placement verification).
- Telemetry ingestion via **MQTT/EMQX** (reservoir volume telemetry, reservoir flow rate telemetry, invalid topic/payload rejection, per-device ACL enforcement, broker reconnects, duplicate handling, gateway validation).
- Internationalisation.
- API.
- Database.
- MQTT broker and gateway.
- Security.
- Performance.
- Accessibility.
- Deployment.
- Recovery.
- Observability.

### 5.2 Out of Scope

Unless separately agreed:

- Sensor calibration accuracy.
- Scientific validation of N, P, K measurements.
- Physical valve engineering.
- Electrical safety certification.
- ESP32 hardware durability.
- Network provider reliability.
- Agronomic threshold correctness.
- Hardware enclosure waterproofing.

These items belong to the hardware or domain-validation scope.

---

## 6. Quality Gates

A release shall not proceed when any of the following exists:

- Open critical defect.
- Open high-severity security defect.
- RBAC bypass.
- Device-access bypass.
- Duplicate physical command execution.
- Public Owner account creation.
- Pending Admin protected access.
- Missing command audit trail.
- Incorrect phase-to-volume mapping.
- Unconfirmed command shown as completed.
- Production secret exposed.
- MQTT cross-device topic access.
- Failed database migration.
- Failed restore test for a required production release.
- Missing critical translation on protected flows.
- Failed required regression suite.

---

## 7. Test Environments

## 7.1 Local Development

Components:

```text
Web application
IoT gateway
PostgreSQL
Mosquitto
Optional Redis
Device simulator
```

Purpose:

- Unit tests.
- Component tests.
- Contract tests.
- Basic integration tests.
- Developer regression.

## 7.2 Continuous Integration

CI shall provide:

- Clean dependency installation.
- Static analysis.
- Type checking.
- Unit tests.
- Component tests.
- Contract tests.
- API tests.
- Database migration test.
- Translation completeness test (`npm run i18n:check`).
- Security scanning.
- Build verification.

## 7.3 Staging

Staging shall include:

- Production-like authentication.
- Separate PostgreSQL.
- Separate broker.
- TLS.
- Test device credentials.
- Real-time updates.
- Device simulator.
- At least one physical test device when available.

Purpose:

- End-to-end tests.
- Hardware-in-the-loop tests.
- Performance tests.
- Security verification.
- UAT.
- Release validation.

## 7.4 Production

Production tests shall be limited to:

- Smoke tests.
- Health checks.
- Read-only monitoring checks.
- Carefully approved low-risk control checks.
- Observability validation.

Production test accounts and devices shall be clearly identified.

---

## 8. Recommended Test Tooling

The final tools depend on the existing frontend stack.

### 8.1 Frontend

Recommended:

```text
Vitest
React Testing Library
Playwright
axe-core
```

Alternatives:

```text
Jest
Cypress
```

### 8.2 API

Recommended:

```text
Vitest or Jest
Supertest
OpenAPI validation
```

### 8.3 Database

Recommended:

```text
Testcontainers
Dedicated PostgreSQL test database
Migration validation scripts
```

### 8.4 MQTT and Gateway

Recommended:

```text
MQTT.js test client
Mosquitto test broker
Testcontainers
Device simulator
```

### 8.5 Performance

Recommended:

```text
k6
```

### 8.6 Security

Recommended:

```text
OWASP ZAP
npm audit or package-manager audit
Trivy
Semgrep
Gitleaks
```

### 8.7 Accessibility

Recommended:

```text
axe-core
Playwright accessibility checks
Manual keyboard and screen-reader tests
```

The final test stack is `TBD`.

---

## 9. Test Data Strategy

### 9.1 User Test Data

Required users:

```text
owner.active
admin.pending
admin.approved
admin.active
admin.rejected
admin.suspended
admin.deactivated
admin.no_devices
admin.view_only
admin.control_enabled
```

### 9.2 Device Test Data

Required devices:

```text
device.soil.online
device.water.online
device.combined.online
device.offline
device.stale
device.invalid
device.inactive
device.unassigned
device.control_busy
```

### 9.3 Telemetry Test Values

Include:

- Normal positive values.
- Valid zero.
- Null.
- Missing optional field.
- Invalid string.
- `NaN`.
- Infinity.
- Boundary coordinate values.
- Future timestamp.
- Old timestamp.
- Duplicate message ID.
- Out-of-order sequence.

### 9.4 Faucet Commands

Required phases:

```text
1 → 300 mL
2 → 1,000 mL
3 → 1,500 mL
```

Required command states:

```text
QUEUED
SENT
ACKNOWLEDGED
IN_PROGRESS
COMPLETED
FAILED
CANCELLED
TIMEOUT
EXPIRED
```

---

# 10. Unit Testing (TEST-UNIT-001..TEST-UNIT-005)

## 10.1 Authentication Units

Test:

- Pure password service unit test suite (`npm run db:test:password-service` / `packages/database/test/password-service.test.ts`):
  - Password policy compliance (12+ length, uppercase, lowercase, digit, special character).
  - Argon2id hashing parameters and output structure (`$argon2id$`).
  - Salt randomness (unique salts for identical passwords).
  - Password verification logic (`verifyPassword`).
  - Non-throwing safe error handling for malformed or corrupt hashes.
  - Secret leak prevention (no plain passwords in error objects or strings).
  - Immutability of input strings.
- Password verification integration.
- Password recovery and reset unit test suite (`TASK-0213` / `DEC-AUTH-102`):
  - Token creation and SHA-256 hashing (`packages/database/test/user-repository-reset-password.test.ts`, 10 tests).
  - Reset token validation, 15-minute expiry, and single-use enforcement.
  - Transactional user session revocation upon reset.
  - Account status preservation across resets (never auto-approves pending accounts).
  - Validation contracts for forgot/reset schemas (`packages/contracts/src/__tests__/user.test.ts`, 10 tests).
  - Resend email delivery service and simulated fallback (`apps/web/test/unit/resend-email.test.ts`, 5 tests).
  - Anti-enumeration generic 200 responses and rate limits on forgot-password (`apps/web/test/unit/forgot-password-route.test.ts`, 6 tests).
  - Reset-password route validation and rate limits (`apps/web/test/unit/reset-password-route.test.ts`, 8 tests).
  - Forgot-password UI with 15:00 countdown, `sessionStorage` persistence, and 5s auto-dismiss toast (`apps/web/test/unit/forgot-password-ui.test.tsx`, 6 tests).
  - Reset-password UI form and invalid token banner (`apps/web/test/unit/reset-password-ui.test.tsx`, 4 tests).
  - Server-side guest route guard (`apps/web/test/unit/server-guest-guard.test.ts`, 7 tests) enforcing instant HTTP 307 redirect to `/` for active sessions with zero UI flash (`DEC-AUTH-103`).
- Registration email verification unit test suite (`TASK-0214` / `DEC-AUTH-104`):
  - Token creation, SHA-256 hashing, 24-hour expiry, bounded `P2034` concurrency retries, and `P2025` mapping to `TOKEN_ALREADY_USED` (`packages/database/test/user-repository.test.ts`, 15 tests).
  - Decoupled `emailVerifiedAt` verification state and status preservation (`ADMIN` remains `PENDING_APPROVAL`, `OWNER` remains `ACTIVE`).
  - Owner authentication gate blocking login with HTTP 403 `EMAIL_NOT_VERIFIED` for unverified Owners (`packages/database/test/session-service.test.ts`).
  - Server-side Owner approval and rejection gates requiring `emailVerifiedAt IS NOT NULL` (returning HTTP 409 `INVALID_STATUS` if unverified).
  - Route validation, generic anti-enumeration responses, and rate limits on verify/resend endpoints (`apps/web/test/unit/verify-email-routes.test.ts`, 8 tests).
  - `/verify-email` UI view (`apps/web/test/unit/verify-email-ui.test.tsx`, 11 tests) verifying StrictMode-safe in-flight deduplication, settlement cache eviction (`finally`), Admin automatic redirect to `/status?status=PENDING_APPROVAL`, and Owner login prompts.
  - Server-side guest route guard on `/verify-email` (`apps/web/test/unit/server-guest-guard.test.ts`) redirecting active sessions to `/`.
  - *Delivery & Testing Status Note*: Verification has been manually exercised using Resend test mode/test recipients and the Resend-provided verification link. We have not yet tested delivery to arbitrary real email recipients using a verified custom sending domain, because no such domain is currently configured. Real-mailbox deliverability is treated as pending deployment/infrastructure acceptance, not an application logic failure.
- Account-status access decision.
- Session-expiry calculation.
- Session-revocation check.
- Registration role forcing.
- Registration status forcing.

## 10.2 Authorisation Units

Test:

- Permission evaluation.
- Owner permission matrix.
- Admin permission matrix.
- Device access.
- View versus control.
- Self-profile versus other-profile access.
- Deny-by-default behaviour.

## 10.3 Locale Units

Test:

- Supported locale validation (`apps/web/test/unit/i18n-config.test.ts`, `TASK-0601`).
- Default locale (`TASK-0601`).
- Fallback locale (`TASK-0601`).
- Translation-key lookup & 17 namespace key parity (`apps/web/test/unit/i18n-namespaces.test.ts`, `TASK-0602`).
- Non-empty translations and matching ICU interpolation placeholders (`TASK-0602`).
- Technical parameter preservation and `BAT` parameter omission (`TASK-0602`).
- Hardcoded UI text replacement and component localization (`TASK-0603` verified across 15 unit test suites, 107/107 tests passed).
- Translation completeness, duplicate key, and parity verification (`apps/web/test/unit/i18n-completeness.test.ts`, `TASK-0605`).
- Status translation mapping at presentation time (`TASK-0603`).
- Date and number formatting in active locale (`TASK-0603`).
- HTML language attribute update (`TASK-0603`).

## 10.4 Telemetry Units

Test:

- Soil payload parsing.
- Water payload parsing.
- Null semantics.
- Valid zero.
- Invalid numeric values.
- Coordinate validation.
- Freshness calculation.
- Online/offline calculation.
- Duplicate detection.
- Schema-version validation.

## 10.5 Faucet Units

Test:

- Phase mapping.
- Command expiry.
- Command-state transition.
- Duplicate command detection.
- Active-command conflict.
- Device controllability.
- Final-state protection.
- Late-event reconciliation rules when approved.

## 10.6 Alert Units

Test:

- Alert severity mapping.
- Alert status transition.
- Alert scope.
- Translation key generation.
- Duplicate acknowledgement handling.

---

# 11. Component Testing

Component tests shall verify isolated frontend behaviour.

## 11.1 Authentication Components

- Login form.
- Registration form.
- Pending approval page.
- Rejected page.
- Suspended page.
- Deactivated page.
- Password validation.
- Error rendering.

## 11.2 Navigation

- Owner navigation.
- Admin navigation.
- No Owner-only links for Admin.
- Mobile navigation.
- Active route.
- User profile menu.

## 11.3 Device Selector

- One device.
- Multiple devices.
- No assigned devices.
- Revoked device.
- Loading.
- Error.
- Persisted selection.

## 11.4 Monitoring Cards

Test each state:

```text
Loading
Current
Stale
Offline
Empty
Invalid
Unavailable
```

Test each metric:

- N.
- P.
- K.
- Soil temperature.
- Soil moisture.
- Soil pH.
- Soil EC.
- Water pH.
- TDS.
- Water EC.
- Tank volume.
- Flow rate.

## 11.5 Faucet Control

- Phase selection.
- Target display.
- Confirmation dialog.
- Permission denied.
- Device offline.
- Busy device.
- Queued.
- In progress.
- Completed.
- Failed.
- Timeout.
- Cancel or stop, if supported.

## 11.6 User Management

- Pending user list.
- Approval dialog.
- Rejection dialog.
- Profile edit.
- Device assignment.
- Suspend and deactivate confirmation.

---

# 12. API Contract Testing (TEST-API-001..TEST-API-005)

The API test suite shall validate:

- Paths.
- Methods.
- Authentication requirements.
- Permission requirements.
- Request schema.
- Response schema.
- Error schema.
- Canonical enums.
- Pagination.
- Idempotency headers.
- OpenAPI compatibility.

## 12.1 Registration Contract

Verify:

- Role input is ignored or rejected.
- Status input is ignored or rejected.
- Response status is `PENDING_APPROVAL`.
- Duplicate email error.
- Password-policy error.

## 12.2 Monitoring Contract

Verify:

- Device access required.
- Null remains null.
- Zero remains zero.
- Timestamps are ISO 8601.
- Canonical statuses remain untranslated.
- Latest and history response schemas.

## 12.3 Faucet Contract

Verify:

- `Idempotency-Key` required.
- Only phase is authoritative.
- Server returns mapped volume.
- `202 Accepted` for queued command.
- Stable command ID.
- Stable status enum.
- Safe timeout response.

---

# 13. Database Testing (TEST-DB-001..TEST-DB-003)

## 13.1 Schema Tests

Verify:

- Required tables exist.
- Foreign keys exist.
- Unique constraints exist.
- Check constraints exist.
- Indexes exist.
- Canonical enum constraints exist.
- Timestamps use timezone-aware types.

## 13.2 User Integrity

- Duplicate email rejected.
- One active role per user.
- Public Owner creation prevented at service layer.
- Invalid account status rejected.
- Approval history retained.

## 13.3 Device Integrity

- Duplicate `device_id` rejected.
- Invalid coordinates rejected.
- Duplicate active assignment rejected.
- Revoked assignments retained.
- View/control flags remain separate.

## 13.4 Telemetry Integrity

- Duplicate message ID rejected.
- Null accepted where allowed.
- Invalid numeric types rejected before insert.
- Latest query uses correct device.
- Historical query uses correct order.
- Device foreign key enforced.

## 13.5 Faucet Integrity

- Invalid phase rejected.
- Phase-volume mismatch rejected.
- Duplicate command ID rejected.
- Duplicate idempotency key rejected or returns existing.
- Command events remain append-only.
- Invalid state regression prevented by service logic.

## 13.6 Migration Tests

Each migration shall be tested against:

- Empty database.
- Previous production-like schema.
- Seeded test data.
- Rollback plan, where possible.
- Large telemetry table sample.

---

# 14. Authentication and Account Flow Tests (TEST-E2E-001..TEST-E2E-005)

## 14.1 Registration

- Valid registration creates pending Admin.
- Role injection fails.
- Status injection fails.
- Owner registration fails.
- Duplicate email fails.
- Unsupported locale fails.
- Password mismatch fails.
- Rate limit activates.

## 14.2 Approval

- Owner lists pending users.
- Owner approves pending Admin.
- Owner rejects pending Admin.
- Admin cannot approve.
- Admin cannot reject.
- Duplicate approval does not conflict silently.
- Approval notification failure does not roll back decision.

## 14.3 Login

Test all account statuses:

| Status | Expected protected access |
|---|---|
| `PENDING_APPROVAL` | Denied |
| `APPROVED` | Denied unless activation policy says otherwise |
| `ACTIVE` | Allowed |
| `REJECTED` | Denied |
| `SUSPENDED` | Denied |
| `DEACTIVATED` | Denied |

## 14.4 Logout and Session

- Logout revokes session.
- Back navigation does not expose protected content.
- Session expiry redirects to login.
- Suspension revokes active session.
- Password change revokes sessions according to policy.

---

# 15. RBAC Testing

## 15.1 Owner Tests

Owner can:

- View own profile.
- Edit own permitted fields.
- View Admin profile.
- Edit Admin permitted fields.
- Approve Admin.
- Reject Admin.
- Assign device.
- Remove device.
- Suspend Admin.
- Deactivate Admin.
- View permitted audit logs.

## 15.2 Admin Tests

Admin can:

- View own profile.
- Edit own permitted fields.
- View assigned devices.
- View authorised monitoring.
- View authorised history.
- Change own locale.

Admin cannot:

- View another profile.
- Edit another profile.
- Change role.
- Change status.
- Approve account.
- Reject account.
- Assign device.
- Access Owner-only routes.
- Access Owner-only APIs.

## 15.3 Manipulation Tests

Attempt bypass through:

- URL editing.
- Query parameter editing.
- Request body editing.
- Hidden field injection.
- Direct API call.
- Stale browser state.
- Changed device ID.
- Changed user ID.
- Changed role value.
- Changed account status.

All shall fail server-side.

---

# 16. Device Access Tests

## 16.1 Assigned Device

Admin can:

- List assigned device.
- View latest data.
- View history.
- Receive live updates.

## 16.2 Unassigned Device

Admin cannot:

- List the device.
- Open device route.
- Query telemetry.
- Query history.
- Receive live events.
- Control device.

## 16.3 Revoked Access

After revocation:

- New API requests fail.
- Live event stream stops.
- Device disappears from selector.
- Cached data is not treated as accessible.
- Faucet control fails.
- Audit event exists.

---

# 17. Telemetry Testing

## 17.1 Soil Telemetry

Verify fields:

```text
nitrogen
phosphorus
potassium
temperature
moisture
ph
ec
status
```

## 17.2 Water Quality Telemetry (REST API per DEC-DEV-020)

Verify fields:

```text
ph
tds
ec
status
```

*Note:* `battery` (`BAT`), `latitude`, and `longitude` are deleted parameters per `DEC-MON-086`.

## 17.2.1 Reservoir Water Telemetry (MQTT per DEC-DEV-020 & TASK-0408)

Verify fields (`WATER_TANK_NODE`):

```text
tankVolume
flowRate
status
```

## 17.3 Data States

Test:

- Current.
- Stale.
- Offline.
- Empty.
- Invalid.
- Partial.
- Unknown.
- Reconnected.

## 17.4 Timestamp Behaviour

Test:

- Valid device time.
- Missing device time.
- Future device time.
- Delayed telemetry.
- Server receipt time.
- Clock drift.
- Out-of-order messages.

## 17.5 Duplicate Telemetry

Publish the same `messageId` twice.

Expected:

- One stored reading.
- Duplicate metric incremented.
- No duplicate live chart point.
- No duplicate alert unless explicitly intended.

---

# 18. Historical Data Testing

Test:

- Default date range.
- Custom range.
- Invalid range.
- Future range.
- Excessive range.
- No data.
- Sparse data.
- Aggregation.
- Pagination.
- Correct timezone.
- English formatting.
- Indonesian formatting.
- Device isolation.
- Export, if implemented.

Missing intervals shall not become zero.

---

# 19. MQTT and Gateway Testing (TEST-MQTT-001..TEST-MQTT-004)

## 19.1 Connection

Test:

- Valid device connection.
- Invalid credentials.
- Anonymous connection.
- Wrong client ID.
- Revoked device.
- TLS failure.
- Broker restart.
- Gateway restart.
- Device reconnect.

## 19.2 Topic ACL

Verify a device cannot:

- Publish to another device's telemetry.
- Publish to another device's acknowledgement topic.
- Subscribe to another device's command topic.
- Subscribe to broad production wildcards.

## 19.3 Payload Validation

Test:

- Valid JSON.
- Invalid JSON.
- Unsupported schema version.
- Missing `deviceId`.
- Topic/payload mismatch.
- Oversized message.
- Invalid enum.
- Invalid coordinate.
- `NaN`.
- Infinity.
- Unknown command ID.

## 19.4 Last Will

Test:

- Unexpected disconnect publishes offline.
- Retained status updates correctly.
- Reconnect publishes online.
- Stale threshold is not based only on retained status.

## 19.5 Reconnection

Verify:

- Exponential backoff.
- No reconnect storm.
- Subscription restored.
- Telemetry resumes.
- Expired command does not execute.

---

# 20. Faucet-Control Testing (TEST-CTRL-001..TEST-CTRL-005)

## 20.1 Preset Mapping

| Phase | Expected target |
|---|---:|
| `1` | `300 mL` |
| `2` | `1,000 mL` |
| `3` | `1,500 mL` |

Test:

- Correct mapping.
- Invalid phase.
- Client-supplied arbitrary volume.
- Missing phase.
- String phase.
- Out-of-range phase.

## 20.2 Permission Tests

- View-only Admin denied.
- Control-enabled Admin allowed.
- Unassigned Admin denied.
- Owner according to final policy.
- Suspended user denied.
- Revoked access denied.

## 20.3 State Tests

- Device online.
- Device offline.
- Device stale.
- Device inactive.
- Device busy.
- Gateway unavailable.
- Broker unavailable.
- Database unavailable.

## 20.4 Idempotency

- Same key and same payload returns same command.
- Same key and different payload returns conflict.
- Network retry creates one command.
- MQTT QoS duplicate executes once.
- Device restart does not re-execute remembered command.

## 20.5 Lifecycle

Verify transitions:

```text
QUEUED
→ SENT
→ ACKNOWLEDGED
→ IN_PROGRESS
→ COMPLETED
```

Alternative finals:

```text
FAILED
TIMEOUT
EXPIRED
CANCELLED
```

Invalid backwards transitions shall not replace final state.

## 20.6 Completion Integrity

Test that UI does not show completed after:

- API acceptance only.
- MQTT publish only.
- Device acknowledgement only.
- In-progress event only.

## 20.7 Timeout

Verify:

- Timeout state is shown.
- Physical state is labelled uncertain where applicable.
- No blind automatic retry.
- Late event is handled according to policy.
- Audit event exists.

## 20.8 Hardware-in-the-Loop Volume Test

When hardware is ready:

1. Place calibrated measuring vessel.
2. Run Phase 1 repeatedly.
3. Run Phase 2 repeatedly.
4. Run Phase 3 repeatedly.
5. Record target and actual volume.
6. Record command duration.
7. Record flow sensor output.
8. Record failures.
9. Compare against hardware-team tolerance.

Tolerance remains `TBD`.

Software testing shall not define the acceptable physical accuracy without hardware-team approval.

---

# 21. Alert Testing

Test:

- Device offline alert.
- Stale data alert.
- Invalid payload alert.
- Command failed alert.
- Command timeout alert.
- Pending approval alert.
- Alert scope by device.
- Alert severity.
- Duplicate suppression.
- Acknowledgement.
- Admin acknowledgement according to policy.
- Translation keys.
- Resolution behaviour.

---

# 22. Internationalisation Testing

## 22.1 Coverage

Verify both:

```text
en
id
```

for:

- Login.
- Registration.
- Approval.
- Navigation.
- Dashboard.
- Device selector.
- Monitoring labels.
- History.
- Alerts.
- User management.
- Profile.
- Settings.
- Faucet control.
- Errors.
- Accessibility labels.

## 22.2 Persistence

Test:

- Change language.
- Refresh.
- Logout.
- Login.
- New browser session.
- Multiple devices.
- Invalid stored locale.
- Missing translation key.

## 22.3 Data Integrity

Changing locale shall not change:

- Role.
- Permission.
- Account status.
- Device access.
- Device ID.
- API field name.
- Raw sensor value.
- MQTT topic.
- Command status.

## 22.4 Formatting

Test:

- Dates.
- Times.
- Decimal separators.
- Thousands separators.
- Relative time.
- Units.
- Chart labels.
- Table headers.

## 22.5 Layout

Test longer Indonesian text in:

- Buttons.
- Dialogs.
- Sidebar.
- Mobile menu.
- Status badges.
- Alerts.
- Chart legends.
- Table columns.

---

# 23. Accessibility Testing

The target accessibility level is `TBD`.

Recommended target:

```text
WCAG 2.2 AA
```

Test:

- Keyboard-only navigation.
- Visible focus.
- Logical focus order.
- Skip link.
- Form labels.
- Error association.
- Colour contrast.
- Screen-reader labels.
- Dialog focus trap.
- Status announcements.
- Live command updates.
- Language attribute.
- Responsive zoom.
- Touch target size.
- Chart alternatives.
- Offline and error state announcements.

Automated accessibility tests shall be supplemented by manual testing.

---

# 24. Visual Regression Testing

Visual regression shall cover:

- Login.
- Registration.
- Pending approval.
- Owner dashboard.
- Admin dashboard.
- Monitoring cards.
- Device selector.
- History charts.
- Faucet-control dialog.
- Alert list.
- User-management page.
- English layout.
- Indonesian layout.
- Desktop.
- Tablet.
- Mobile.
- Loading, empty, error, stale, and offline states.

The existing frontend design remains the visual source of truth.

---

# 25. Performance Testing

## 25.1 Performance Metrics

Measure:

- Page load.
- API latency.
- Database query latency.
- Telemetry ingestion latency.
- Live update latency.
- Command API acceptance latency.
- Command acknowledgement latency.
- Historical query latency.
- Broker throughput.
- Concurrent live connections.

## 25.2 Initial Targets

Targets remain `TBD`.

Recommended initial service-level targets:

| Metric | Proposed target |
|---|---:|
| Common API p95 | Under 500 ms |
| Latest monitoring API p95 | Under 750 ms |
| Historical query p95 | Under 2 s for bounded range |
| Telemetry ingestion p95 | Under 1 s from gateway receipt to persistence |
| Live update p95 | Under 2 s from persistence to UI |
| Command API acceptance p95 | Under 1 s, excluding physical execution |

These are provisional and require production-capacity validation.

## 25.3 Load Scenarios

Test:

- Multiple devices publishing simultaneously.
- Multiple users viewing dashboard.
- Multiple live SSE connections.
- Historical chart requests.
- Alert bursts.
- Login bursts.
- Approval list.
- Command requests without violating safety controls.

## 25.4 Soak Testing

Run sustained telemetry and monitoring traffic to detect:

- Memory leaks.
- Connection leaks.
- Database growth.
- Reconnect storms.
- Event-stream degradation.
- Duplicate processing.
- Log growth.

---

# 26. Reliability and Resilience Testing

Test failure of:

- Browser network.
- Web server.
- Database.
- Gateway.
- MQTT broker.
- Device Wi-Fi.
- Device power.
- Real-time connection.
- Notification provider.

Verify:

- Safe error state.
- Automatic recovery where approved.
- No duplicate command.
- No false completion.
- Historical data remains available where possible.
- Health status reflects dependency state.
- Audit and logs support diagnosis.

---

# 27. Security Testing (TEST-SEC-001..TEST-SEC-005)

Security testing shall align with `SECURITY.md`.

## 27.1 Web Security

Test:

- Authentication bypass.
- Session fixation.
- Session theft scenarios.
- CSRF.
- XSS.
- SQL injection.
- Mass assignment.
- BOLA/IDOR.
- CORS.
- Rate limits.
- Sensitive error leakage.
- Security headers.
- Password reset abuse.

## 27.2 IoT Security

Test:

- Device impersonation.
- Topic spoofing.
- Cross-device subscription.
- Shared credential misuse.
- Revoked credential.
- TLS validation.
- Replay.
- Retained old command.
- Duplicate QoS delivery.
- Malformed payload flood.

## 27.3 Secret Scanning

CI shall scan for:

- Database URLs.
- MQTT passwords.
- Private keys.
- API keys.
- Auth secrets.
- Device credentials.

## 27.4 Dependency Scanning

CI shall detect:

- Known vulnerable dependencies.
- Vulnerable container images.
- High-severity transitive dependencies.
- Unmaintained critical packages.

---

# 28. Backup and Recovery Testing

Test:

- Automated backup creation.
- Backup encryption.
- Backup access control.
- Restore into clean environment.
- User and role restoration.
- Device assignment restoration.
- Telemetry restoration.
- Command history restoration.
- Audit-log restoration.
- Point-in-time recovery if supported.

Restore tests shall be documented.

---

# 29. Deployment Testing

Before release:

- Build production image.
- Validate environment variables.
- Run migrations.
- Verify rollback.
- Verify health and readiness.
- Verify HTTPS.
- Verify MQTT TLS.
- Verify broker ACL.
- Verify no development secret is used.
- Verify staging and production isolation.
- Verify logs and metrics.
- Verify backup status.

---

# 30. Smoke Test Suite

The minimum post-deployment smoke test shall verify:

1. Login page loads.
2. Active Owner can log in.
3. Active Admin can log in.
4. Pending Admin is blocked.
5. Dashboard loads.
6. Authorised device appears.
7. Latest monitoring loads.
8. Unauthorised device is denied.
9. Language switch works.
10. Owner can view pending registrations.
11. API health is healthy.
12. Gateway is ready.
13. Broker connection is healthy.
14. Database is reachable.

Physical faucet smoke tests require explicit production approval.

---

# 31. Regression Test Suite

The regression suite shall include:

- Authentication.
- Approval.
- RBAC.
- Profiles.
- Device assignment.
- Monitoring.
- History.
- Alerts.
- I18N.
- Faucet command lifecycle.
- Audit.
- Realtime.
- Security-critical API tests.
- Database constraints.
- MQTT contract tests.

Every defect fix shall add a regression test where practical.

---

# 32. User Acceptance Testing

UAT participants should include:

- Product Owner.
- Operational Owner user.
- Admin user.
- Hardware-team representative.
- Developer or QA representative.

UAT shall validate:

- Registration.
- Approval.
- Login.
- Device assignment.
- Monitoring readability.
- Historical charts.
- Language switching.
- Alert usability.
- Faucet confirmation.
- Command status clarity.
- Error messages.
- Mobile usability.

UAT approval shall be recorded.

---

# 33. Defect Severity

## 33.1 Critical

Examples:

- Unauthorised faucet control.
- Duplicate physical command execution.
- Owner account created publicly.
- Admin accesses another user's profile.
- Device data leakage.
- Production secret exposure.
- Audit loss for control command.
- False completion state.

## 33.2 High

Examples:

- Pending Admin accesses protected page.
- Device assignment bypass.
- Account suspension does not revoke access.
- MQTT cross-device access.
- Historical data from wrong device.
- Command state corruption.

## 33.3 Medium

Examples:

- Incorrect translated label.
- Broken filter.
- Stale warning missing.
- Non-critical accessibility failure.
- Retry button failure.

## 33.4 Low

Examples:

- Minor spacing issue.
- Non-blocking visual inconsistency.
- Cosmetic typo.

---

# 34. Defect Workflow

Recommended lifecycle:

```text
NEW
TRIAGED
IN_PROGRESS
READY_FOR_RETEST
VERIFIED
CLOSED
REOPENED
DEFERRED
```

Every defect shall include:

- Title.
- Environment.
- Build version.
- Preconditions.
- Steps.
- Expected result.
- Actual result.
- Evidence.
- Severity.
- Related requirement.
- Related test case.

---

# 35. Traceability

Every test case should link to one or more:

- PRD requirement.
- RBAC rule.
- User flow.
- API endpoint.
- Database constraint.
- Security control.
- Device communication rule.

Recommended matrix:

```text
Requirement ID
→ Test Case ID
→ Test Result
→ Defect ID
```

Formal requirement IDs are `TBD`.

---

# 36. Test Case Naming

Recommended format:

```text
AUTH-LOGIN-001
RBAC-ADMIN-004
DEVICE-ACCESS-003
MONITOR-SOIL-007
I18N-LOCALE-002
FAUCET-IDEMPOTENCY-005
MQTT-ACL-003
SEC-BOLA-002
```

---

# 37. CI Pipeline Gates

A pull request shall pass:

1. Formatting.
2. Linting.
3. Type checking.
4. Unit tests.
5. Component tests.
6. API contract tests.
7. Database migration test.
8. Translation completeness.
9. Secret scanning.
10. Dependency scanning.
11. Production build.

Main or release branch shall additionally pass:

- Integration tests.
- End-to-end tests.
- Security smoke tests.
- Container scan.
- Deployment validation.

---

# 38. Release Readiness Checklist

Before release:

- [ ] All critical test cases pass.
- [ ] No open critical defects.
- [ ] No unaccepted high defects.
- [ ] RBAC regression passes.
- [ ] Device isolation passes.
- [ ] MQTT ACL tests pass.
- [ ] Faucet idempotency passes.
- [ ] Phase mapping passes.
- [ ] Timeout behaviour passes.
- [ ] Audit trail passes.
- [ ] I18N completeness passes.
- [ ] Accessibility critical checks pass.
- [ ] Performance targets are reviewed.
- [ ] Security scans pass.
- [ ] Migrations pass.
- [ ] Backup and restore are verified where required.
- [ ] UAT approval is recorded.
- [ ] Rollback plan exists.
- [ ] Production secrets are validated.
- [ ] Physical-control enablement is approved.

---

# 39. Testing Acceptance Criteria

The testing strategy is satisfied when:

1. Automated tests cover critical business logic.
2. RBAC is tested at UI, API, and service levels.
3. Device access is tested for every device endpoint.
4. Account statuses are tested individually.
5. Monitoring zero, null, stale, empty, and invalid states are covered.
6. Historical queries are tested for correctness and bounds.
7. English and Bahasa Indonesia are tested.
8. Faucet phase mapping is tested.
9. Faucet idempotency is tested.
10. MQTT duplicate delivery is tested.
11. Device ACL isolation is tested.
12. Timeouts do not display false completion.
13. Audit records are verified.
14. Security scans run in CI.
15. End-to-end critical paths pass in staging.
16. Hardware-in-the-loop tests pass before production control enablement.
17. Release gates are documented and enforced.
18. Critical regressions block deployment.

---

# 40. Open Decisions

1. Final frontend test framework.
2. Playwright versus Cypress.
3. Final CI provider.
4. Required code coverage.
5. Accessibility conformance target.
6. Performance targets.
7. Device simulation framework.
8. Hardware-in-the-loop environment.
9. Physical volume tolerance.
10. Number of repeated physical tests per phase.
11. UAT approvers.
12. Test-data reset strategy.
13. Staging hosting.
14. Production smoke-test scope.
15. Security testing ownership.
16. Penetration-testing schedule.
17. Backup restore frequency.
18. Supported browsers.
19. Supported mobile devices.
20. Release cadence.
21. Defect-tracking system.
22. Requirement ID convention.
23. Test-report format.
24. Command late-event reconciliation tests.
25. Cancel and stop tests.
26. Admin control permission test matrix.
27. ~~Admin alert acknowledgement test matrix.~~ **RESOLVED** — Verified for OWNER global scope and ADMIN assigned-device scope (`TEST-API-005`, `TASK-0704`).

---

# 41. Conflicts and Gaps Found

1. Final faucet-control permissions remain unresolved, so the exact role test matrix is incomplete.
2. Physical dispensing tolerance is not defined by the hardware team.
3. Device online, offline, and stale thresholds are not final.
4. The final authentication and session mechanism is not selected.
5. The real-time transport is not final.
6. Command cancellation, stop, concurrency, retry, and late-event policies remain unresolved.
7. Exact telemetry units and valid measurement ranges are not final.
8. Browser and mobile support requirements are not defined.
9. Performance service-level targets remain provisional.
10. UAT ownership and release approval authority are not yet documented.

---

# 42. First Owner Provisioning Test Suite (`TASK-0106`)

Automated tests for first Owner provisioning are maintained in `packages/database/test/seed-owner.test.ts` (`npm run db:test:seed-owner`).

Test Coverage Enforced:
1. **Password Policy & Email Normalisation:** Verifies minimum 12 characters, uppercase, lowercase, digit, and special character requirements from `docs/SECURITY.md` §8.2. Verifies `trim().toLowerCase()` email normalisation.
2. **Database URL Safety:** Rejects test runs if `TEST_DATABASE_URL` database name does not contain `test` or `disposable`.
3. **Precondition & Missing Role Check:** Verifies error handling when canonical `OWNER` role is missing from DB.
4. **Duplicate Email Rejection:** Verifies rejection of mixed-case duplicate email attempts when a non-Owner user exists.
5. **Successful Creation Lifecycle:** Verifies atomic creation of 1 `ACTIVE` User, 1 non-revoked `OWNER` assignment, 0 `ADMIN` assignments, 0 `AccountApproval` rows, and 1 system `AuditLog` entry (null actor, non-sensitive metadata, no secrets/DB URLs). Verifies Argon2id password hash verification via library `verify()`.
6. **Second-Attempt Rejection:** Verifies second provisioning attempt is rejected safely even if the existing Owner user account is `SUSPENDED` or `DEACTIVATED`.
7. **Transaction Rollback:** Verifies complete rollback on simulated failure (`simulateFailure`), leaving 0 users, 0 assignments, 0 audit records.
8. **Ordinary RBAC Seed Separation:** Verifies ordinary `npm run db:seed` creates 0 users, 0 sessions, 0 device assignments.
9. **Separate OS Process Concurrency Test:** Spawns two separate OS processes simultaneously running `seed-owner.ts` against the same database, verifying exactly 1 process exits 0 and 1 process exits 1 (non-zero).

---

# 43. UI Localization & Hard-Coded Text Replacement Test Suite (`TASK-0603`)

Automated unit and component verification for hard-coded UI text migration to `next-intl` translation keys is verified across 15 Vitest unit test suites:

### Agent-Executed Automated Tests
1. **Unit Test Suite Pass:** 15 test files, **107/107 tests passed** (`apps/web/test/unit/*`, including `faucet-control-ui.test.tsx`, `i18n-namespaces.test.ts`, `historical-charts.test.tsx`, `monitoring-dashboard.test.tsx`, `water-tank-monitoring-card.test.tsx`, `sidebar-navigation.test.tsx`, `i18n-config.test.ts`).
2. **Static Typecheck:** Clean `npx tsc --noEmit` pass with 0 errors across `@kebun-melon/web`.
3. **Production Build:** Static page generation pass (`31/31` static pages generated cleanly).
4. **Browser Verification:** Playwright visual smoke check on public auth pages (`/login`, `/register`).

### User-Reported Pre-Commit Suite Verification
The user independently executed and confirmed 100% pass across all five reserved pre-commit commands:
- `npm run test:coverage` — PASSED (User-reported)
- `npm run test:integration` — PASSED (User-reported)
- `npm run check:quality` — PASSED (User-reported)
- `npm run test` — PASSED (User-reported)
- `npm run test:e2e` — PASSED (User-reported)

---

# 44. Language Gate & Settings Locale Change Test Suite (`TASK-0604`)

Automated unit, API contract, and component verification for the mandatory initial language gate, Settings modal language switcher, preferences persistence API, default device label localization, and responsive mobile layout:

### Agent-Executed Automated Tests
1. **Unit Test Suite Pass:** 18 test files, **136/136 tests passed** (`apps/web/test/unit/*`), including:
   - `i18n-language-gate-and-settings.test.tsx` (14 tests): Gate rendering for unauthenticated visitors without cookie, cookie persistence (`locale`), gate skip on valid cookie, accessible Settings modal dialog trigger & radio options, `PATCH /api/v1/me/preferences` invocation, error handling display, and route/device context preservation.
   - `me-preferences-api.test.ts` (7 tests): Route validation for `preferredLocale`, RBAC `language.self.update` enforcement, unauthenticated rejection (401), invalid locale rejection (400), transaction persistence to `user_preferences` table, and `profile.self.updated` audit logging.
   - `device-selector-localization.test.tsx` (8 tests): `formatDeviceDisplayName` localization of default labels in `id` and `en`, custom device name preservation, canonical `deviceId`/`deviceType` enum stability, DeviceSelector rendering in `id` and `en`, selected device persistence across locale switch, TopAppBar responsive centering, and dropdown viewport bounding at mobile widths (360px, 390px, 430px).
2. **Static Typecheck:** Clean `npx tsc --noEmit` pass with 0 errors across `@kebun-melon/web`.
3. **Production Build:** Static page generation pass (`32/32` static pages generated cleanly).
4. **Browser & Mobile Viewport Verification:** Playwright testing on `/login`, `/register`, and `/forgot-password` across 360px, 390px, 430px, and 1280px widths with 0 console errors and clean layout.

### User-Reported Pre-Commit Suite Verification
The user independently executed and confirmed 100% pass across all five reserved pre-commit commands:
- `npm run test:coverage` — PASSED (User-reported)
- `npm run test:integration` — PASSED (User-reported)
- `npm run check:quality` — PASSED (User-reported)
- `npm run test` — PASSED (User-reported)
- `npm run test:e2e` — PASSED (User-reported)

