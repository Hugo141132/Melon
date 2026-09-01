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
- profilee management.
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
1 → 300 mL (UI 0.3 L)
2 → 1,000 mL (UI 1 L)
3 → 1,500 mL (UI 1.5 L)
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
  - Validation contracts for forgot/reset schemas (`packages/contracts/src/__tests__/user.test.ts`, 12 tests).
  - Resend email delivery service with bounded exponential backoff retry and simulated fallback (`apps/web/test/unit/resend-email.test.ts`, 7 tests).
  - Anti-enumeration generic 200 responses and rate limits on forgot-password (`apps/web/test/unit/forgot-password-route.test.ts`, 6 tests).
  - Reset-password route validation and rate limits (`apps/web/test/unit/reset-password-route.test.ts`, 8 tests).
  - Forgot-password UI with 15:00 countdown, `sessionStorage` persistence, and 5s auto-dismiss toast (`apps/web/test/unit/forgot-password-ui.test.tsx`, 6 tests).
  - Reset-password UI form and invalid token banner (`apps/web/test/unit/reset-password-ui.test.tsx`, 4 tests).
  - Server-side guest route guard (`apps/web/test/unit/server-guest-guard.test.ts`, 7 tests) enforcing instant HTTP 307 redirect to `/` for active sessions with zero UI flash (`DEC-AUTH-103`).
- Registration email verification unit test suite (`TASK-0214` / `DEC-AUTH-104`):
  - 6-digit numeric CSPRNG code generation, `sha256(userId:code)` hashing, 15-minute expiry, bounded `P2034` concurrency retries, and `P2025` mapping to `TOKEN_ALREADY_USED` (`packages/database/test/user-repository.test.ts`, 17 tests).
  - Decoupled `emailVerifiedAt` verification state and status preservation (`ADMIN` remains `PENDING_APPROVAL`, `OWNER` remains `ACTIVE`).
  - Owner authentication gate blocking login with HTTP 403 `EMAIL_NOT_VERIFIED` for unverified Owners (`packages/database/test/session-service.test.ts`).
  - Server-side Owner approval and rejection gates requiring `emailVerifiedAt IS NOT NULL` (returning HTTP 409 `INVALID_STATUS` if unverified).
  - Route validation, generic anti-enumeration responses, and rate limits on verify/resend endpoints (`apps/web/test/unit/verify-email-routes.test.ts`, 9 tests).
  - `/verify-email` UI view (`apps/web/test/unit/verify-email-ui.test.tsx`, 11 tests) verifying 6-digit code input, target email switcher, 60s cooldown timer persisted in `sessionStorage`, legacy token auto-verification, StrictMode-safe in-flight deduplication, settlement cache eviction (`finally`), Admin automatic redirect to `/status?status=PENDING_APPROVAL`, and Owner login prompts.
  - Server-side guest route guard on `/verify-email` (`apps/web/test/unit/server-guest-guard.test.ts`) redirecting active sessions to `/`.
  - *Delivery & Testing Status Note*: Verification has been manually exercised using Resend test mode/test recipients and 6-digit code dispatch. We have not yet tested delivery to arbitrary real email recipients using a verified custom sending domain, because no such domain is currently configured. Real-mailbox deliverability is treated as pending deployment/infrastructure acceptance, not an application logic failure.
- Account-status access decision.
- Session-expiry calculation.
- Session-revocation check.
- Registration role forcing.
- Registration status forcing.

## 10.2 Authorisation & Device Registry Units

Test:

- Permission evaluation.
- Owner permission matrix.
- Admin permission matrix.
- Device access.
- View versus control.
- Self-profilee versus other-profilee access.
- Deny-by-default behaviour.
- Authorised device list and detail test suite (`TASK-0305` / `DEC-DEV-028` / `DEC-DEV-030`):
  - `apps/web/app/api/v1/devices/test/route.test.ts` (24/24 tests):
    - Owner global scope with canonical `deviceId` returned in safe DTO.
    - Admin scoped strictly to active assignments (`revokedAt IS NULL`) with canonical `deviceId` concealed.
    - Admin IDOR prevention on unassigned/revoked devices returning HTTP 403 `DEVICE_NOT_ASSIGNED`.
    - Early `device.read` permission and active account checks before database querying, returning HTTP 401 `UNAUTHENTICATED` / HTTP 403 `ACCOUNT_NOT_ACTIVE`.
    - Identifier resolution supporting both immutable database UUID `id` and canonical `deviceId` string.
    - Query pagination validation returning HTTP 422 `VALIDATION_ERROR`.
    - Owner-only device update (`PATCH /api/v1/devices/{deviceId}`) with duplicate rejection (HTTP 409 `DUPLICATE_DEVICE_ID`).
    - Device deactivation (`POST /api/v1/devices/{deviceId}/deactivate`) setting `accountStatus = 'DEACTIVATED'` and `connectionStatus = 'INACTIVE'`.
    - Device activation (`POST /api/v1/devices/{deviceId}/activate`) setting `accountStatus = 'ACTIVE'`, `connectionStatus = 'UNKNOWN'`, and rejecting Admin calls with HTTP 403 `INSUFFICIENT_PERMISSION`.
    - Removal of hard deletion (`DELETE /api/v1/devices/{deviceId}` removed).
  - `packages/database/test/device-repository.test.ts` (12/12 tests): Repository querying, partial index assignment filtering, immutable UUID integrity, `activateDevice` and `deactivateDevice` lifecycle mutations with `audit_logs` persistence.
  - `packages/contracts/src/__tests__/device.test.ts` (7/7 tests): Safe DTO contract validation and schema stripping.
  - `apps/web/app/devices/test/page.test.ts` & `apps/web/app/devices/test/selector.test.ts`: UI presentation, Reactivate modal action, and role-based badge rendering.
  - Combined device test pass rate: **100% passed**.

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

## 10.7 TASK-1001 Monorepo Unit Test Suite Verification (Reconciled 2026-08-21)

The complete monorepo unit test suite (`TASK-1001`) was audited, hardened, and verified with 100% test pass rate across all four workspaces:
- **Test Results:** **102 test files, 958/958 unit tests passed (100%)**.
- **Line Coverage in Contracts:** >99.6% line coverage in `@kebun-melon/contracts`.
- **Branch Hardening:**
  - `packages/contracts/src/__tests__/device-capabilities.test.ts`: Added test case verifying `getCanonicalCapabilitiesForDeviceType` returns `[]` for unknown/unrecognized device types.
  - `packages/contracts/src/__tests__/logging.test.ts`: Added test case verifying `isLogLevelEnabled` falls back to `info` priority for unrecognized log levels.
  - `packages/contracts/src/__tests__/user.test.ts`: Added test case verifying `toPublicSafeUserDto` handles `userRoles: undefined` and deduplicates duplicate active role assignments.
- **Coverage Domain Verification:** Verified full coverage across all 8 mandatory acceptance domains in `TASKS.md` §18:
  1. *Account-Status Decisions:* State transitions (`PENDING_APPROVAL`, `APPROVED`, `ACTIVE`, `REJECTED`, `SUSPENDED`, `DEACTIVATED`), email verification gates, and session revocation.
  2. *Permission Checks:* Full RBAC matrix across Owner global scope and Admin assigned-device scope.
  3. *Device Access Isolation:* Admin canonical `deviceId` concealment (`DEC-DEV-028`), unassigned device blocking (403), and immutable UUID integrity.
  4. *Telemetry Validation:* Range bounds, zero vs null semantics, gap preservation, and complete omission of `BAT` (`DEC-MON-086`).
  5. *Phase & Volume Mapping:* Phase 1 (300 mL), Phase 2 (1,000 mL), Phase 3 (1,500 mL) calculations with `plantCount` multipliers, and manual `OPEN`/`CLOSE` volume omission.
  6. *Command State Machine:* Strict transitions (`QUEUED` → `SENT` → `ACKNOWLEDGED` → `IN_PROGRESS` → `COMPLETED`/`FAILED`), terminal state immutability, and physical state mapping (`OPEN`, `CLOSED`, `UNKNOWN`).
  7. *Idempotency & Concurrency:* Header deduplication, database race recovery (`P2002`), and max 1 active command concurrency.
  8. *Locale Validation:* Default `id` / fallback `en` (`DEC-I18N-068`), 17 namespace key & placeholder parity, and technical unit preservation.
- **Pre-commit Quality Gate:** Verified `npm run check:quality` passing with 0 TypeScript errors, 0 lint errors, clean formatting, 100% translation parity (`i18n:check`), 0 hardcoded secrets, 0 unapproved dependency vulnerabilities, and clean Next.js production build.

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
- User profilee menu.

## 11.3 Device Selector

- One device.
- Multiple devices.
- No assigned devices.
- Revoked device.
- Loading.
- Error.
- Fresh initial selection resolution without persistent access history (`DEC-DEV-029`).

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

### 11.4.1 Historical Monitoring Charts Testing (`TASK-0504`, `DEC-UIUX-104`)

Unit and component test suite (`apps/web/test/unit/historical-charts.test.tsx` and `apps/web/test/unit/soil-telemetry-ui.test.tsx`):
- **NPK LineChart Rendering:** Verifies NPK trend renders with three separate series (Nitrogen `#0d631b`, Phosphorus `#884200`, Potassium `#476800`) and individual AreaCharts with correct localized titles.
- **Instant Client-Side Range Switching:** Verifies switching between range presets (24h, 7d, 30d) resolves synchronously from `globalHistoryCache` with `loading=false`, eliminating skeleton flashes and redundant network calls.
- **Range-Based X-Axis Formatting (`getCustomXTicks`):**
  - *24 Hours:* Generates 5–8 evenly spaced readable time ticks (`HH:mm`) rather than displaying all 24 hours.
  - *7 Days:* Generates 4–5 well-spaced daily ticks (`DD MMM`) to prevent text overlap on mobile screens while preserving 1-hour resolution data points.
  - *30 Days:* Generates 5–7 evenly spaced date ticks across the month.
- **Locale-Aware Formatting & Punctuation Cleanup (`formatDayMonth`):**
  - Formats date labels dynamically according to active locale: Indonesian (`20 Agu`) vs English (`20 Aug`).
  - Strips trailing commas and periods from axis labels, data strings, and tooltip headers (`20 Agu`, not `20 Agu,`).
- **State Handling:** Verifies loading skeleton, empty state banners (`Tidak ada data riwayat untuk rentang waktu ini.`), and error banners.
- **Verification Gates:** Verified with 25 passing unit tests across charting suites, 0 TypeScript compile errors across 4 workspaces, and visual UI verification via Playwright for 24h, 7d, and 30d views.

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
- manual open/close, if supported.

## 11.6 User Management

- Pending user list.
- Approval dialog.
- Rejection dialog.
- profilee edit.
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

- Duplicate `deviceId` rejected with conflict error.
- Immutable database primary key UUID (`devices.id`) preserved across canonical `deviceId` renames (`DEC-DEV-028`).
- In-app device creation removed; devices managed out-of-band (`DEC-DEV-027`).
- Canonical `deviceId` strictly concealed from Admin role projections (`DEC-DEV-028`).
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

- View own profilee.
- Edit own permitted fields.
- View Admin profilee.
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

- View own profilee.
- Edit own permitted fields.
- View assigned devices.
- View authorised monitoring.
- View authorised history.
- Change own locale.

Admin cannot:

- View another profilee.
- Edit another profilee.
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

## 20.1 Preset Mapping & Action Semantics

| Phase | Preset target volume per plant | Formula |
|---|---:|:---|
| `1` | `300 mL (UI 0.3 L)` | `targetVolumeMl = 300 * plantCount` |
| `2` | `1,000 mL (UI 1 L)` | `targetVolumeMl = 1000 * plantCount` |
| `3` | `1,500 mL (UI 1.5 L)` | `targetVolumeMl = 1500 * plantCount` |

### Action Requirements & Validation

- **`DISPENSE`**:
  - `phase` required (`1`, `2`, or `3`).
  - `plantCount` required (integer $\ge 1$).
  - `targetVolumeMl` server-derived (`presetVolumeMl * plantCount`).
  - Browser/client-supplied arbitrary `targetVolumeMl` authority strictly rejected.
- **`OPEN` / `CLOSE`**:
  - `phase`, `plantCount`, and `targetVolumeMl` must be `null`.
- **Database CHECK Constraint Enforcement**:
  - `faucet_commands_action_check` multi-column constraint enforces valid attribute combinations.
- **Contract & Schema Testing**:
  - Correct preset mapping and multi-plant volume multiplication.
  - Invalid phase rejection.
  - Missing/zero/negative `plantCount` rejection.
  - `OPEN`/`CLOSE` with non-null phase or volume rejection.
  - Out-of-range phase rejection.

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

**Verification Evidence (TASK-0808):**
- **Idempotency Retry Testing:** Verified via `FaucetCommandRepository` integration tests handling sequential retry with identical payloads (`P2002` race recovery returning existing accepted command).
- **Conflict Testing:** Verified via `FaucetCommandConflictError` thrown for payload/parameter mismatches against identical `idempotencyKey` strings.
- **Concurrency Testing:** Verified under high-load simulation (50 parallel dispatches). Transactional locking and `P2002` unique constraints safely rejected identical requests without writing duplicate commands to the database.
- **Database Integrity:** Confirmed 0 duplicate command records generated during load testing.
- **Performance Verification:** Sequential idempotent replay resolves in ~400ms without negative upstream effects.

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

## 20.8 Hardware-in-the-Loop Volume Test (TASK-0811 / Scope Demarcation)

*Note:* Physical hardware and flow accuracy validation remain under `TASK-0811`. Software and UI tests under `TASK-0807` verify client/API contracts, state handling, and rendering only.

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

## 20.9 Faucet Control UI & Performance Verification (TASK-0807)

Comprehensive software, UI, and performance verification completed under `TASK-0807`:

### A. Component & Unit Test Coverage (`faucet-control-ui.test.tsx`)
- **Coverage**: 24/24 unit test cases passing (100%).
- **Presets & Liters Rendering**: Verified 0.3 L, 1.0 L, 1.5 L formatting.
- **Plant Count Calculations**: Verified live multiplier ($0.3\text{ L} \times \text{count} = \text{Total L}$) and minimum clamp ($\ge 1$).
- **Manual Actions**: Verified distinct modal dialogs and payload dispatch for `OPEN` and `CLOSE`.
- **Physical State Derivation**: Verified strict mapping to `OPEN` (completed open), `CLOSED` (completed close), and `UNKNOWN` (active commands, failures, and dispense completions).
- **Safety Gating**: Verified disablement banners when offline, lacking permission, or when `ENABLE_FAUCET_CONTROL=false`.
- **History Table**: Verified action-aware rendering and pagination controls.

### B. UI Responsiveness & Performance Benchmarks
- **Initial Mount Latency**: `FaucetControlPanel` mounts in $31\text{ ms}$ ($< 50\text{ ms}$ threshold), DOM tree size 119 elements.
- **Interaction Latency**: Rapid `plantCount` stepper average $1.2\text{ ms/click}$, preset switching $1.8\text{ ms}$, manual triggers $1.1\text{ ms}$.
- **Modal Lifecycle & Memory Safety**: 50 consecutive open/close cycles completed in $570\text{ ms}$ with 0 lingering dialog nodes.
- **Polling Resource Safety**: Verified 2,500ms status polling strictly during active states (`QUEUED`, `SENT`, `ACKNOWLEDGED`, `IN_PROGRESS`) and immediate timer destruction (`clearInterval`) upon terminal states with zero blind retries.
- **Responsive Layout Verification**: Playwright verified $390\times 844$ (mobile), $768\times 1024$ (tablet), and $1280\times 800$ (desktop) with 0 horizontal overflow and 0 console errors.

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
- profilee.
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
- profilees.
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
- Admin accesses another user's profilee.
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
6. Command manual open/close, stop, concurrency, retry, and late-event policies remain unresolved.
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
   - `me-preferences-api.test.ts` (7 tests): Route validation for `preferredLocale`, RBAC `language.self.update` enforcement, unauthenticated rejection (401), invalid locale rejection (400), transaction persistence to `user_preferences` table, and `profilee.self.updated` audit logging.
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


---

# 45. Monitoring UUID & History Regression Verification Suite (`TASK-0306` / `TASK-0501` / `TASK-0503` / `TASK-0504`)

Automated unit, integration, HTTP route-level, and manual runtime verification for the dual-lookup identifier resolution, zero-record HTTP 200 history handling, and frontend UUID selection:

### Agent-Executed Automated Tests
1. **Targeted Test Suites Pass:**
   - `apps/web/app/api/v1/devices/[deviceId]/monitoring/test/history.test.ts` (18/18 tests passed): Soil and water historical telemetry queries, query bounds (24h default, 31-day max), internal UUID vs. canonical deviceId lookup, 200 OK empty series handling (`{ series: [], pagination: { totalRecords: 0 } }`), and 404 DEVICE_NOT_FOUND on missing devices.
   - `apps/web/app/api/v1/devices/[deviceId]/monitoring/test/latest.test.ts` (14/14 tests passed): Latest monitoring snapshot, soil latest, and water latest with dual UUID/canonical identifier resolution and 404 handling.
   - `packages/database/test/device-repository.test.ts` (12/12 tests passed): `getDeviceByCanonicalId` regression tests verifying lookup by internal database UUID and external canonical string.
   - `packages/database/test/telemetry-repository.test.ts` (14/14 tests passed): Bounded query range verification and telemetry mapping.
2. **Direct HTTP Route-Level Registration Verification:**
   - Direct HTTP request to `GET /api/v1/devices/3216f033-4c21-4b19-adc6-365854c31704/monitoring/soil/history` returns `HTTP/1.1 401 Unauthorized` with `Content-Type: application/json` and structured API error payload (`UNAUTHENTICATED`), confirming that the App Router resolves dynamic route segments directly to the API boundary without falling back to Next.js HTML 404.
3. **Dev-Server Restart Diagnostic & Operational Isolation:**
   - The intermittent Next.js HTML `_not-found` 404 encountered during restart cycles was diagnosed as a development-runtime/startup issue (Windows PowerShell `Ctrl+C` leaving a background zombie Node process holding port 3000, causing subsequent `next dev` processes to bind to port 3001 while browser requests hit the stale 3000 process).
   - Confirmed deterministic route registration across hot and cold `.next` cycles with port cleanup (`Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force`).
4. **Manual Runtime Verification Completed:**
   - Authenticated browser monitoring runtime verification completed across `/soil`, `/water`, `/sensor`, and `/controls`.
   - Verified telemetry correctly loads for selected authorized devices using immutable UUIDs (`devices.id`).
   - Verified valid date ranges with zero historical telemetry return HTTP 200 with empty series (`{ series: [] }`) and render clean empty-state charts without false 404 alerts or graph distortions.
   - Verified historical telemetry data remains strictly isolated to the authorized device.
   - Verified Admin canonical `deviceId` concealment remains intact across UI cards and selector dropdowns.

---

## Monitoring and Device Testing Implementation Note (Reconciled 2026-08-19)

The following facts are verified in test suites and runtime verification regarding device selection, routing, and monitoring resolution (`TASK-0306`, `TASK-0501`, `TASK-0503`, `TASK-0504`):
- **Frontend Selection/Context/URL:** Uses immutable `devices.id` UUID.
- **Bare Routes:** Remain neutral with no auto-selection (`/`, `/sensor`, `/soil`, `/water`).
- **Rehydration:** Valid `?deviceId=<UUID>` rehydrates after authorization on hard refresh.
- **Invalid/Revoked IDs:** Clear selection safely to `null` with a notice banner.
- **Admin Privacy:** Admin canonical `deviceId` concealment remains enforced.
- **Legacy Routes:** `/air` and `/tanah` are explicitly maintained as legacy 404 routes.
- **History Query Integrity:** Soil/water history queries with zero matching telemetry records return HTTP 200 with `{ series: [], pagination: { page: 1, pageSize: 20, totalRecords: 0, totalPages: 1 } }`, never HTTP 404 or fabricated data.
- **Manual Runtime Verification:** Completed and confirmed operational stability across all monitoring views.
< ! - -   T A S K - 0 8 0 2   R e c o n c i l e d :   2 0 2 6 - 0 8 - 1 9   - - >  
 
---

# 46. Gateway Command Publisher Verification Suite (`TASK-0804`)

Automated unit, contract, error handling, and simulated performance sanity verification for the gateway command publisher:

### Agent-Executed Automated Tests
1. **Targeted Publisher Test Suite Pass (`apps/iot-gateway/src/__tests__/command-publisher.test.ts`):** 10/10 tests passed (100% path pass rate):
   - Direct `publishCommand` canonical topic routing (`agriculture/{environment}/{siteId}/{deviceId}/command/faucet`), QoS 1, and `retain=false`.
   - `DISPENSE` payload construction with valid `phase`, `plantCount >= 1`, and server-persisted `targetVolumeMl` integer (without publisher-side recalculation).
   - `OPEN` and `CLOSE` command payload construction with strict omission of `phase`, `plantCount`, and `targetVolumeMl`.
   - Expired `QUEUED` command transition to `EXPIRED` without publishing.
   - Non-`WATER_TANK_NODE` device filtering and missing `siteId` rejection (skipped without state corruption).
   - Atomic database transition from `QUEUED` to `SENT` with unique `messageId` and topic metadata only upon confirmed MQTT publication.
   - MQTT failure error recovery leaving command status untouched as `QUEUED` in database with `0` false `SENT` marks.
2. **Gateway Contract Test Suite Pass (`command-publisher.test.ts` + `topic-router.test.ts`):** 42/42 tests passed cleanly.
3. **Static Typecheck:** Clean `npx tsc --noEmit -p apps/iot-gateway/tsconfig.json` pass with 0 errors.

### Local Simulated Performance Sanity Results (Mocked/In-Memory Infrastructure)
*Note: The following measurements represent local simulated sanity testing on mocked/in-memory infrastructure and do NOT constitute live WAN EMQX/TLS benchmarks (deferred to formal TASK-1007 performance testing):*
- **Direct Publication Latency (1,000 invocations):** ~68.3 ops/sec (p50: 15.52 ms, p90: 18.48 ms, p95: 20.08 ms, max: 44.30 ms).
- **Burst Batch Processing (500 commands in batches of 50):** ~67.0 cmds/sec (Batch p50: 745.58 ms, Batch p95: 829.48 ms).
- **Sustained Soak (2,000 commands across 40 batches):** ~66.7 cmds/sec with zero memory leaks (Heap delta: +3.34 MB, RSS delta: +3.84 MB).
- **Safety Under Fault Injection:** 0 duplicate publications, 0 false `SENT` transitions; 20 queued commands safely preserved during simulated broker disconnect and published successfully upon reconnection.
<!-- TASK-0804 Reconciled: 2026-08-20 -->

---

# 47. Device Acknowledgement Processing Verification Suite (`TASK-0805`)

Automated unit, contract, error recovery, and simulated performance sanity verification for device acknowledgement processing:

### Agent-Executed Automated Tests
1. **Targeted ACK Processor Test Suite Pass (`apps/iot-gateway/src/__tests__/acknowledgement-processor.test.ts`):** **25/25 tests passed (100% path pass rate)**:
   - QoS 1 canonical topic validation (`agriculture/{environment}/{siteId}/{deviceId}/ack/faucet`) and non-faucet subpath rejection.
   - Authoritative contract adherence identifying commands through `commandId` and `deviceId` (without requiring a payload action field).
   - Stored command action retrieval and assertion against `[DISPENSE, OPEN, CLOSE]`, safely rejecting unsupported actions (`success: false`).
   - Strict state progression: accepted ACKs transition `SENT` → `ACKNOWLEDGED` (guaranteeing status never becomes `COMPLETED` and never infers physical state).
   - Rejected ACKs transition `SENT` → `FAILED` with canonical reason codes (`DEVICE_BUSY`, `UNSUPPORTED_ACTION`, `DEVICE_NOT_READY`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`) and trigger `CommandFailureAlert` creation.
   - Idempotent handling of duplicate `messageId` occurrences without duplicate database event writes.
   - Non-`SENT` / late / out-of-order ACKs safely ignored without database writes or state regression.
   - Device scoping enforcement for `WATER_TANK_NODE` device types.
2. **IoT Gateway Test Suites Pass:** **16 test files, 195/195 tests passed (100%)**.
3. **Contracts & Database Test Suites Pass:** **26 test files, 228/228 tests passed (100%)**.
4. **Static Typecheck:** Clean `npm run typecheck` pass across all 4 monorepo workspaces with 0 errors.
5. **Security Scanning:** Semgrep SAST scan with 0 findings, 0 errors.

### Local In-Memory Performance Sanity Microbenchmark Results
*Note: The following measurements represent local in-memory microbenchmarks of processor logic with mock repositories and do NOT constitute end-to-end network, broker, or database system capacity benchmarks:*
- **Sequential 1,000 Unique ACKs:** 3,979.0 ACKs/sec (Duration: 251.32 ms, p50: 0.087 ms, p95: 0.297 ms, p99: 2.151 ms, Min: 0.045 ms, Max: 45.068 ms, Errors: 0, State Regressions: 0, Heap Delta: +2.00 MB).
- **Burst 500 Concurrent ACKs (`Promise.all`):** 7,579.7 ACKs/sec (Duration: 65.97 ms, p50: 56.555 ms, p95: 63.893 ms, p99: 64.786 ms, Errors: 0, State Regressions: 0, Heap Delta: -0.33 MB).
- **Repeated Duplicate `messageId` (1,000 ACKs):** 5,887.7 ACKs/sec (Duration: 169.85 ms, p50: 0.048 ms, p95: 0.360 ms, p99: 2.970 ms, Errors: 0, Redundant DB Writes: 0, Heap Delta: +1.20 MB).
- **Short Soak (2,000 ACKs across 4 batches of 500):** 4,453.1 ACKs/sec (Duration: 449.13 ms, p50: 0.047 ms, p95: 0.848 ms, p99: 3.018 ms, Errors: 0, State Regressions: 0, Heap Delta: +1.10 MB).

### Staging & Credential Boundary
- Physical ESP32 hardware and live staging EMQX Cloud Serverless broker TLS end-to-end ACK verification remain credential/manual dependent and are not claimed complete.
<!-- TASK-0805 Reconciled: 2026-08-20 -->

---

# 48. Device Execution Event State Machine Verification Suite (`TASK-0806`)

Automated unit, contract, error recovery, and simulated performance sanity verification for the command execution event state machine:

### Agent-Executed Automated Tests
1. **Targeted Event Processor Test Suite Pass (`apps/iot-gateway/src/__tests__/faucet-event-processor.test.ts`):** **30/30 tests passed (100%)**:
   - QoS 1 canonical topic validation (`agriculture/{environment}/{siteId}/{deviceId}/event/faucet`) and non-faucet subpath rejection.
   - Authoritative contract adherence resolving commands via `commandId` and `deviceId` and validating persisted actions (`DISPENSE`, `OPEN`, `CLOSE`).
   - Strict lifecycle transitions (`ACKNOWLEDGED` → `IN_PROGRESS` → `COMPLETED`, `ACKNOWLEDGED`/`IN_PROGRESS` → `FAILED`).
   - Authoritative physical faucet state determination:
     - `COMPLETED OPEN` → `OPEN`
     - `COMPLETED CLOSE` → `CLOSED`
     - `COMPLETED DISPENSE` → `UNKNOWN` (strictly does not assume closed valve)
     - `FAILED` / `IN_PROGRESS` / timeout / uncertain → `UNKNOWN`
     - Physical state is NEVER inferred from API creation, MQTT publication, or command ACKs.
   - Action-specific volume handling: `DISPENSE` validates target volume parity and non-negative `actualVolumeMl`; `OPEN` and `CLOSE` treat volume measurement as non-applicable and store `null`/`undefined` in the command record.
   - Terminal state immutability: terminal commands (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `EXPIRED`) ignore late events without state regression.
   - Idempotent handling of duplicate `messageId` occurrences with zero redundant database writes.
   - `CommandFailureAlert` dispatching on `FAILED` execution events.
2. **Device Simulator Test Suite Pass (`apps/iot-gateway/src/__tests__/device-simulator.test.ts`):** **25/25 tests passed (100%)** including canonical `FAUCET_PRESET_VOLUMES` import fix.
3. **Full IoT Gateway Test Suites Pass:** **16 test files, 210/210 tests passed (100%)**.
4. **Monorepo Static Typecheck:** Clean `npm run typecheck` pass across all 4 monorepo workspaces with 0 errors.

### Local In-Memory Performance Sanity Microbenchmark Results
*Note: The following measurements represent local in-memory microbenchmarks of processor logic with mock repositories and do NOT constitute live broker or production database capacity benchmarks:*
- **Sequential 1,000 Valid Events:** 4,609 events/sec (Duration: 216.95 ms, p50: 0.105 ms, p95: 0.349 ms, p99: 1.351 ms, Errors: 0, State Regressions: 0, Heap Delta: +0.47 MB).
- **Burst 500 Concurrent Events (`Promise.all`):** 4,178 events/sec (Duration: 119.66 ms, p50: 55.524 ms, p95: 61.312 ms, p99: 62.331 ms, Errors: 0, State Regressions: 0, Heap Delta: -1.87 MB).
- **Repeated Duplicate `messageId` (1,000 Events):** 7,334 events/sec (Duration: 136.35 ms, p50: 0.050 ms, p95: 0.437 ms, p99: 2.051 ms, Errors: 0, Redundant DB Writes: 0, Heap Delta: +2.09 MB).
- **Short Soak (5,000 Events across 10 batches of 500):** 3,422 events/sec (Duration: 1,461.27 ms, p50: 0.044 ms, p95: 1.347 ms, p99: 4.350 ms, Errors: 0, State Regressions: 0, Heap Delta: +7.02 MB).
- **Safety Invariant Totals (7,500 events):** 0 state regressions, 0 terminal mutations, 0 duplicate redundant writes, 0 unexpected errors.

### Staging & Credential Boundary
- Live local faucet MQTT E2E was not completed because the local Mosquitto test fixture lacks a matching `WATER_TANK_NODE` credential/ACL identity; live MQTT TLS and physical HIL verification remain credential/manual dependent.
<!-- TASK-0806 Reconciled: 2026-08-20 -->

---

# 49. Manual Faucet Open/Close Control Verification Suite (`TASK-0810`)

Automated unit, contract, UI component, state mapping, and security verification for manual faucet Open/Close control:

### Agent-Executed Automated Tests
1. **Targeted Contracts & Database Verification:**
   - `packages/contracts/src/__tests__/audit.test.ts`: **9/9 tests passed (100%)** validating canonical enum keys `faucet.command.open.created` and `faucet.command.close.created`.
   - `packages/database/src/__tests__/faucet-command-repository.test.ts`: **23/23 tests passed (100%)** validating transactional command creation, idempotency, and audit log generation for `OPEN` and `CLOSE` actions.
2. **Faucet Control Component & Integration Suites Pass:**
   - 5 test suites (`faucet-control-ui.test.tsx`, `faucet-commands/route.test.ts`, `faucet-command-repository.test.ts`, `faucet-event-processor.test.ts`, `faucet.test.ts`): **114/114 tests passed (100%)**.
3. **Full Workspace Monorepo Regression Suite Pass:**
   - **102 test files, 955/955 tests passed (100%)** across all workspaces.
4. **Monorepo Static Typecheck:**
   - Clean `npm run typecheck` pass across all 4 monorepo workspaces with 0 errors.
5. **Linting & Code Quality:**
   - Clean `npm run lint` across all workspaces with 0 errors and 0 warnings.
6. **Security Scanning:**
   - `npm run scan:secrets`: 0 hardcoded secrets detected.
   - `npm run scan:deps`: 0 unapproved vulnerabilities.

### Quality & Operational Safety Constraints
- Discrete manual `OPEN` and `CLOSE` actions do not fabricate or transmit volume/phase values.
- Authoritative physical faucet state is deterministically badges as `OPEN`, `CLOSED`, or `UNKNOWN` (with `COMPLETED DISPENSE` mapping to `UNKNOWN` to avoid false assumptions of closed valves).
- Fail-safe hardware auto-close behavior during connection loss remains an explicit `UNRESOLVED / TBD` item (`DEC-CTRL-090`), safely protected by `ENABLE_FAUCET_CONTROL=false` default configuration.
<!-- TASK-0810 Reconciled: 2026-08-21 -->

---

# 50. Centralized Authentication State Hydration Verification Suite (`TASK-0215`)

Automated unit, context mock, component rendering, and RBAC verification for centralized authentication state hydration:

### Agent-Executed Automated Tests
1. **Targeted Web App Test Suites Pass:**
   - `apps/web/test/unit/setting-page.test.tsx`: **3/3 tests passed (100%)** verifying immediate hydration on `/setting` and role-based conditional rendering (`OWNER` vs `ADMIN`).
   - `apps/web/test/unit/sidebar-navigation.test.tsx`: **6/6 tests passed (100%)** verifying `Sidebar` role filtering with mocked `AuthContext`.
   - `apps/web/test/unit/device-selector-localization.test.tsx`: **6/6 tests passed (100%)** verifying `TopAppBar` with mocked `AuthContext`.
2. **Full Web Test Suite Pass:** **34 test files, 258/258 tests passed (100%)**.
3. **Monorepo Static Typecheck:** Clean `npm run typecheck` pass across all 4 monorepo workspaces with 0 errors.
4. **Security & Quality Compliance:** Zero regressions in existing security headers, rate limiting, and server-side RBAC guards.
<!-- TASK-0215 Reconciled: 2026-08-22 -->

---

# 51. Live Soil and Water Monitoring & Telemetry Freshness Verification Suite (`TASK-0502`)

Automated unit, context, empty state, and telemetry freshness verification for live soil and water monitoring UI:

### Agent-Executed Automated Tests
1. **Targeted Monitoring & Soil Telemetry Test Suites Pass:**
   - `apps/web/test/unit/soil-telemetry-ui.test.tsx`: **7/7 tests passed (100%)**:
     - Verified all 7 soil telemetry parameters (Nitrogen, Phosphorus, Potassium, Temperature, Moisture, pH, EC) render live values with unified visual meters and agreed units (`mg/kg`, `°C`, `%RH`, `µS/cm`, `ppm`, no unit on pH).
     - Verified clean parameter titles without "Soil" / "Tanah" prefixes.
     - Verified stale telemetry suppression: when telemetry is stale (`isStale: true` or `connectionStatus: STALE`), numerical sensor values are suppressed and replaced with `'-'` placeholders, `0%` gauge fills, and an amber Stale Alert Banner (`Update: Real-Time: Kedaluwarsa`) while preserving `lastSeenAt`/`recordedAt` timestamps.
     - Verified safe empty states when telemetry is null.
     - Verified `/water` live rendering and stale suppression.
     - Verified homepage (`/`) isolation with zero embedded `MonitoringDashboard`.
     - Verified historical charts (`NPKChart`, `WaterNutrientChart`) default to empty state (`Tidak ada data riwayat untuk rentang waktu ini.`) without mock fallbacks.
   - `apps/web/test/unit/monitoring-dashboard.test.tsx`: **7/7 tests passed (100%)**.
2. **Full Web Test Suite Pass:** **33 test files, 251/251 tests passed (100%)**.
3. **Monorepo Static Typecheck:** Clean `tsc --noEmit` pass across `@kebun-melon/web` with 0 errors.
4. **Zero Mock Telemetry:** Complete removal of `NPK_TREND_DATA` and `EC_TREND_DATA` fallback dependencies in UI charts.
<!-- TASK-0502 Reconciled: 2026-08-23 -->

---

# 52. Telemetry Data Retention and Automated Maintenance Policy Verification Suite (`TASK-0913`)

Automated unit, batch chunking, table isolation, scheduler lifecycle, and historical query non-regression verification for data retention:

### Agent-Executed Automated Tests
1. **Targeted Database Retention Service Suite (`packages/database/test/retention-service.test.ts`):**
   - **8/8 tests passed (100%)**:
     - Verified exact 90-day cutoff date calculation (`now - 90 days`).
     - Verified iterative chunked batching (`batchSize: 1000`) deleting across multiple batches until clear.
     - Verified clean single-check execution on empty tables (0 rows deleted).
     - Verified `UnapprovedRetentionTableError` is thrown when unapproved or protected tables (`audit_logs`, `faucet_commands`, etc.) are targeted.
     - Verified compliance/security audit tables (`audit_logs`, `faucet_commands`, `faucet_command_events`, `account_approvals`) are NEVER touched during maintenance.
     - Verified per-table summary reporting (`RetentionSummary`).
2. **Targeted IoT Gateway Scheduler Suite (`apps/iot-gateway/src/__tests__/retention-scheduler.test.ts`):**
   - **6/6 tests passed (100%)**:
     - Verified scheduler disables when `RETENTION_ENABLED=false`.
     - Verified recurring 24h periodic timer and initial startup run.
     - Verified clean cancellation on `stop()` clearing both intervals and timeouts.
     - Verified `isJobRunning` guard skips overlapping/concurrent triggers.
     - Verified error propagation and structured JSON error logging.
3. **Historical Telemetry Query Non-Regression:**
   - `apps/web/test/unit/historical-charts.test.tsx` and historical API suites: **100% passed** verifying that 31-day historical query window (`DEC-MON-087`) is completely unaffected by 90-day retention pruning.
4. **Static Quality & Security Audits:**
   - `npm run typecheck`: **0 errors** across all 4 monorepo workspaces.
   - `npm run scan:secrets`: **0 hardcoded secrets**.
   - `npm run scan:deps`: **0 unapproved dependencies**.
   - `npm run format:check`: **100% Prettier compliant**.
<!-- TASK-0913 Reconciled: 2026-08-24 -->

---

# 53. Direct EMQX Cloud Connectivity & Device Simulator Verification Suite (`TASK-0914`)

Automated unit, client lifecycle, environment validation, and dynamic simulator identity verification for direct EMQX Cloud TLS connectivity:

### Agent-Executed Automated Tests
1. **Targeted IoT Gateway EMQX Connectivity Suite (`apps/iot-gateway/src/__tests__/emqx-connectivity.test.ts`):**
   - **7/7 tests passed (100%)**:
     - Verified direct connection to EMQX Cloud over TLS (`mqtts://` port 8883 / `wss://` port 8084) in development and staging configurations.
     - Verified client lifecycle state transitions and health/readiness probe reporting (`/health` returns 200 pass; `/ready` returns 503 DEGRADED when disconnected and 200 UP when connected).
     - Verified structured error logging with strict secret and token redaction.
2. **Targeted Device Simulator Suite (`apps/iot-gateway/src/__tests__/device-simulator.test.ts`):**
   - **26/26 tests passed (100%)**:
     - Verified dynamic device-ID resolution (`--tank-device-id`, `MQTT_TANK_DEVICE_ID`) and clear actionable errors when device IDs are unconfigured without source code hardcoding.
     - Verified canonical reservoir telemetry payload generation adhering strictly to contract schema (`schemaVersion`, `messageId`, `deviceId`, `siteId`, `sequence`, `recordedAt`, `sentAt`, `firmwareVersion`, `data: { tankVolume, flowRate, status }`).
     - Verified topic `deviceId` and payload `deviceId` exact parity.
     - Verified unique simulation client ID generation (`sim-${tankDeviceId}-${random}`).
3. **Targeted Mosquitto Fallback Suite (`apps/iot-gateway/src/__tests__/broker-config.test.ts`):**
   - **7/7 tests passed (100%)**:
     - Verified static Mosquitto fallback configuration and ACL files are intact and insulated from runtime `.env` overrides.
4. **Permanent Environment Configuration Suite (`scripts/test-env.ts`):**
   - **18/18 tests passed (100%)**:
     - Verified development accepts EMQX Cloud TLS/WSS URLs and staging validates required staging credentials and client IDs.
5. **Static Quality & Security Audits:**
   - `npm run scan:secrets`: **0 hardcoded secrets** detected in repository files or git history.
6. **Live Runtime & Scope Verification:**
   - Live development gateway, EMQX broker TLS, and canonical development device live ingestion verified end-to-end.
   - **Deferred Verification:** Monitoring UI live smoke testing was intentionally **deferred/skipped** during backend gateway verification.
   - **Staging Impact:** Staging deployment and database require no update or redeployment.
<!-- TASK-0914 Reconciled: 2026-08-26 -->

---

# 54. Controls Loading Experience & Responsive Header Centering Verification Suite (Reconciled 2026-08-27)

Automated unit, loading transition, component skeleton parity, responsive header geometry, and type safety verification for `/controls` and `TopAppBar`:

### Agent-Executed Automated Tests
1. **Targeted Controls Loading & Header Test Suites:**
   - `apps/web/test/unit/controls-loading-transition.test.tsx` [NEW]: **4/4 tests passed (100%)**:
     - Verified `/controls` route loading shell matches final page layout composition.
     - Verified `WaterTankMonitoringCard` renders structured 2-column skeleton cards during initial loading.
     - Verified `FaucetControlPanel` and `FaucetHistoryTable` render table skeleton rows during device loading.
     - Verified no generic single-box placeholder or layout collapse occurs.
   - `apps/web/test/unit/water-tank-monitoring-card.test.tsx`: **6/6 tests passed (100%)**.
   - `apps/web/test/unit/device-selector-localization.test.tsx`: **7/7 tests passed (100%)**:
     - Verified `TopAppBar` implements 3-column CSS Grid (`grid-cols-[1fr_auto_1fr]`).
     - Verified `DeviceSelector` dropdown overlay is centered (`left-1/2 -translate-x-1/2`).
2. **Full Web Workspace Unit Suites:** **34 test files, 257/257 tests passed (100%)**.
3. **Workspace Static Typecheck:** `npm run typecheck` returned **0 errors** across all 4 monorepo packages (`@kebun-melon/web`, `@kebun-melon/iot-gateway`, `@kebun-melon/contracts`, `@kebun-melon/database`).
4. **Next.js Production Build:** `npm run build` in `apps/web` compiled successfully across all 37 routes with zero static optimization or hydration errors.
5. **Non-Credentialed Browser Smoke Test:** `e2e/smoke.spec.ts` via Playwright with Microsoft Edge: **2/2 tests passed (100%)**.
6. **Manual Authenticated Browser Verification:**
   - Verified client navigation into `/controls` and hard refresh (Ctrl+Shift+R) render the static shell and structural skeletons immediately.
   - Verified zero layout jumps, no fabricated telemetry values, and preserved offline/stale banner indicators.
   - Verified `DeviceSelector` is horizontally centered at 50% across desktop, tablet, and mobile viewports.

### Pre-Commit Test Gate Status (Reconciled 2026-08-28)
All five final pre-commit validation commands were executed and verified **PASS**:
- `npm run test:coverage`: **PASS** — Verified monorepo unit test coverage across all packages.
- `npm run test:integration`: **PASS** — Verified database and gateway integration suites.
- `npm run check:quality`: **PASS** — Verified typecheck (0 errors across 4 workspaces), ESLint (0 errors), Prettier code style (100% compliant), translation completeness (100% parity), secret scan (0 secrets), and dependency security check (0 unapproved advisories).
- `npm run test`: **PASS** — Verified monorepo test suites passing.
- `npm run test:e2e`: **PASS** — Verified 14/14 tests passed across Playwright critical flows and smoke test suites using Microsoft Edge.
<!-- Controls Loading & Header Centering Testing Reconciled: 2026-08-28 -->

---

# 55. Single Active Session & Verified Email Change Test Suite Specifications (Reconciled 2026-08-29)

> **Associated Tasks:** `TASK-0217` (P0, DONE), `TASK-0216` (P1, READY_FOR_TEST)
> **Governing Decisions:** `DEC-AUTH-106`, `DEC-AUTH-107`, `DEC-UIUX-102`

### 1. Single Active Session Enforcement Verification (`TASK-0217` / `DEC-AUTH-107`) — VERIFIED & COMPLETED
- **PostgreSQL 15 Integration Tests (`packages/database/test/session-service.integration.test.ts`):**
  - **10 / 10 tests passed (100%)** in local disposable Docker PostgreSQL runner (`packages/database/scripts/run-session-docker-integration-test.ts`):
    1. Valid ACTIVE login returns raw token and safe DTO, stores token hash only, updates lastLoginAt, creates audit record without secrets.
    2. Invalid email or wrong password throws generic InvalidCredentialsError (no account enumeration).
    3. Non-ACTIVE accounts are rejected with AccountStatusForbiddenError.
    4. Session lookup enforces 30-min idle and 8-hour absolute timeouts.
    5. Account status changes to non-ACTIVE immediately invalidate sessions upon lookup.
    6. Logout revokes session and creates audit log, and is safe & idempotent when repeated.
    7. Simultaneous concurrent login attempts for the same user atomically allow exactly one session and reject the other with ActiveSessionExistsError.
    8. Existing active session is preserved when a conflicting login attempt is rejected.
    9. Expired, idle (>30m), and revoked sessions do not block new login attempts.
    10. Regression Flow: Login A succeeds $\rightarrow$ Login B is denied (409) $\rightarrow$ Logout A revokes session $\rightarrow$ Login B succeeds $\rightarrow$ exactly one valid active session remains.
- **API Route Tests:**
  - `apps/web/app/api/v1/auth/login/test/route.test.ts`: **5/5 tests passed** (HTTP 409 Conflict `ACTIVE_SESSION_EXISTS`, localized error payload, existing session preservation).
  - `apps/web/app/api/v1/auth/logout/test/route.test.ts`: **4/4 tests passed** (Cookie extraction via `cookies()` and raw headers, 204 No Content, fail-closed 500 `INTERNAL_ERROR` on server errors).
- **Profile Security Component Tests (`apps/web/test/unit/profile-page.test.tsx`):**
  - **4/4 tests passed** (Absence of "Linked Devices" card, presence of Account & Session Security section, omission of client IP/User-Agent, PasswordChangeModal wiring and redirect to `/login?message=PASSWORD_CHANGED`).

### 2. Verified Self-Service Email Change Verification (`TASK-0216` / `DEC-AUTH-106`) — VERIFIED & COMPLETED (DONE)
- **Targeted Automated Test Suites (6 test files, 59/59 tests passed, 100%):**
  1. `packages/contracts/src/__tests__/user.test.ts`: **14/14 tests passed** (Schema validation for `RequestEmailChangeInputSchema` and `VerifyEmailChangeInputSchema`, trimming/normalization, 6-digit code format constraints).
  2. `packages/database/test/user-repository-email-change.test.ts`: **13/13 tests passed** (Enforcing current password check, 6-digit CSPRNG generation, `pending_email` and `sha256(userId:newEmail:code)` storage, candidate email collision check against existing users and pending tokens, atomic promotion with session preservation, token deletion, non-sensitive audit logging, and `P2034` write conflict backoff retries).
  3. `apps/web/test/unit/email-change-routes.test.ts`: **14/14 tests passed** (`POST /api/v1/me/email/request` and `POST /api/v1/me/email/verify` session validation, `profilee.self.update` permission check, 3 req/min and 5 req/min rate limiters, Resend email dispatch, and HTTP error envelopes).
  4. `apps/web/test/unit/email-change-ui.test.tsx`: **7/7 tests passed** (`EmailChangeModal` step 1 password & new email input, step 2 6-digit code entry, 60s cooldown timer persisted in `sessionStorage`, reactive UI error presentation, and zero-reload `AuthContext` state update).
  5. `apps/web/test/unit/profile-page.test.tsx`: **4/4 tests passed** (Profile page integration, Change Email button wiring, Account & Session Security card rendering, zero layout shift).
  6. `apps/web/test/unit/i18n-completeness.test.ts`: **7/7 tests passed** (100% translation key parity across Indonesian `messages/id.json` and English `messages/en.json`).
- **Test-Isolation & Regression Hardening (Resolved 2026-08-30):**
  - Investigated pre-commit test-isolation bugs: (1) an incomplete glob pattern in `packages/database/vitest.config.ts` allowed top-level database integration tests (`approvals.service.integration.test.ts`) to execute during unit/coverage runs without test DB safety guards; (2) `apps/web/test/unit/rate-limit-routes.test.ts` called `registerPOST` without mocking `@kebun-melon/database` or `@/lib/email/resend`, executing live registration writes against Supabase DEV; (3) `e2e/critical-flows.spec.ts` used `test.beforeAll()` to upsert a hardcoded Owner account using ambient `DATABASE_URL`, writing persistent data to Supabase DEV.
  - Hardened exclude patterns (`**/*.integration.test.ts`, `test/*.integration.test.ts`, `test/**/*.integration.test.ts`) in `vitest.config.ts` and added fail-closed `validateTestDatabaseUrl` guards across all database integration test suites.
  - Added comprehensive in-memory module mocks for `@kebun-melon/database` (`registerUser`, `loginUser`, `UserRepository`) and `@/lib/email/resend` in `apps/web/test/unit/rate-limit-routes.test.ts`.
  - Hardened `packages/database/src/owner-provisioning.ts` (`validateTestDatabaseUrl`) with remote host exclusion (`supabase.co`, `supabase.com`, `railway.app`, `neon.tech`) and database name constraints (`test` or `disposable`).
  - Updated `e2e/critical-flows.spec.ts` and `playwright.config.ts` to enforce isolated test DBs (`E2E_DATABASE_URL` / `TEST_DATABASE_URL`), eliminated all hardcoded credentials and remote URL fallbacks, adopted dynamic synthetic E2E identities, and added deterministic teardown in `test.afterAll`.
  - Reconciled translation key `profile.tooManyRequests` in `messages/id.json` and `messages/en.json`, with `apps/web/test/unit/i18n-namespaces.test.ts` passing **8/8 tests**.
  - Verified 100% test pass rate across all 5 pre-commit quality gates: `npm run test:coverage` (PASS), `npm run test:integration` (PASS), `npm run check:quality` (PASS), `npm run test` (112 test files, 1045/1045 passed), and `npm run test:e2e` (14/14 tests passed, 12 critical flows + 2 smoke tests) with zero Supabase DEV database pollution confirmed via read-only SQL inspection.
- **Static Typecheck:** `npm run typecheck` returned **0 errors** across all 4 monorepo packages (`@kebun-melon/web`, `@kebun-melon/iot-gateway`, `@kebun-melon/contracts`, `@kebun-melon/database`).
- **Database Schema Validation:** `npm run db:validate` confirmed schema is valid and synchronized with DEV database.
- **Manual Authenticated End-to-End Verification:** **PASSED** (Successfully verified 2-step email change modal, current password re-authentication, candidate email validation, Resend 6-digit verification code delivery, 60s cooldown timer, code verification, atomic database update, immediate zero-reload `AuthContext` update, and preserved active session without logout).
<!-- Testing Specifications Reconciled: 2026-08-30 -->

---

# 56. Faucet Control UI Refinement & Lifecycle Regression Test Suite (Reconciled 2026-09-01)

Automated unit, database repository, IoT gateway event processor, device simulator, and type safety verification for Faucet Controls:

### Agent-Executed Automated Tests
1. **Faucet Control UI Tests (`apps/web/test/unit/faucet-control-ui.test.tsx`):** **27/27 tests passed (100%)**:
   - Verified physical valve state guards: `CLOSED` state disables 0.3L, 1L, 1.5L dispensing preset cards, plant count stepper controls (`-`, input, `+`), and Close Valve manual action while keeping Open Valve enabled.
   - Verified `OPEN` state disables Open Valve manual action while keeping dispensing presets and Close Valve enabled.
   - Verified `UNKNOWN` state enables all valid actions.
   - Verified clean, enum-free status presentation across status cards, action headers, and history tables in English and Indonesian.
2. **Database Repository Lifecycle Tests (`packages/database/src/__tests__/faucet-command-repository.test.ts`):** **25/25 tests passed (100%)**:
   - Verified `addCommandEvent()` transactionally rejects/ignores non-terminal progress events (`IN_PROGRESS`) when the parent command is in a terminal status (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `EXPIRED`), returning the latest event idempotently.
   - Verified `addCommandEvent()` throws `FaucetCommandNotFoundError` when target command does not exist.
3. **IoT Gateway Event Processor Tests (`apps/iot-gateway/src/__tests__/faucet-event-processor.test.ts`):** **32/32 tests passed (100%)**:
   - Verified late `IN_PROGRESS` events for commands in terminal status `COMPLETED` are ignored and do not call `addCommandEvent()`.
   - Verified graceful handling and logging when `updateCommandStatus` or `addCommandEvent` encounters concurrent transition to terminal status (`InvalidCommandStateTransitionError`).
4. **Device Simulator Scenario Tests (`apps/iot-gateway/src/__tests__/device-simulator.test.ts`):** **31/31 tests passed (100%)**:
   - Verified `sendFaucetProgress()` publishes with QoS 1.
   - Verified lifecycle scenarios (`faucet-dispense`, `faucet-open`, `faucet-close`) execute with realistic hardware delays.
5. **Full Web Workspace Unit Suite (`apps/web/test/unit`):** **36 test files, 288/288 tests passed (100%)**.
6. **Workspace Static Typecheck:** `npm run typecheck` returned **0 errors** across all 4 monorepo packages (`@kebun-melon/web`, `@kebun-melon/iot-gateway`, `@kebun-melon/contracts`, `@kebun-melon/database`).
<!-- Faucet Controls Testing Reconciled: 2026-09-01 -->



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
