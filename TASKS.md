# Implementation Task Plan

## 1. Document Information

| Item | Description |
|---|---|
| Product | Web-Based Soil and Water Monitoring and Faucet Control System |
| Document | Implementation Task Plan |
| Version | 1.0 |
| Status | Initial implementation backlog |
| Primary roles | `OWNER`, `ADMIN` |
| Hardware | ESP32 / NodeMCU |
| Recommended device protocol | MQTT 5.0 over TLS |
| Related documents | `FRONTEND_AUDIT.md`, `UI_UX.md`, `PRD.md`, `RBAC.md`, `USER_FLOWS.md`, `I18N.md`, `DEVICE_COMMUNICATION.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `SECURITY.md`, `TESTING.md` |

---

## 2. Purpose

This document converts the approved product and technical specifications into an actionable implementation backlog.

It defines:

- Work phases.
- Task identifiers.
- Dependencies.
- Priorities.
- Deliverables.
- Acceptance criteria.
- Security requirements.
- Testing obligations.
- Release gates.
- Explicit blockers caused by unresolved decisions.

This document is intended to guide developers and coding agents. It does not replace the authoritative requirements in the related specification files.

---

## 3. Source-of-Truth Order

When requirements conflict, use this precedence:

1. `PRD.md`
2. `RBAC.md`
3. `USER_FLOWS.md`
4. `SECURITY.md`
5. `DEVICE_COMMUNICATION.md`
6. `API.md`
7. `DATABASE.md`
8. `ARCHITECTURE.md`
9. `I18N.md`
10. `UI_UX.md`
11. `FRONTEND_AUDIT.md`
12. `TESTING.md`
13. `TASKS.md`

`FRONTEND_AUDIT.md` remains the source of truth for the current codebase and implemented visual structure.

`UI_UX.md` remains the source of truth for interface behaviour and design consistency.

This task plan shall not be used to silently override a more authoritative requirement.

---

## 4. Task Status Values

Use only:

```text
BACKLOG
BLOCKED
READY
IN_PROGRESS
IN_REVIEW
READY_FOR_TEST
DONE
DEFERRED
CANCELLED
```

Initial status for all implementation tasks is:

```text
BACKLOG
```

unless explicitly marked otherwise.

---

## 5. Priority Values

| Priority | Meaning |
|---|---|
| `P0` | Release-blocking, security-critical, or physical-control critical |
| `P1` | Required for the first usable release |
| `P2` | Important but may follow core functionality |
| `P3` | Optional improvement or future enhancement |

---

## 6. Task Completion Rules

A task is `DONE` only when:

1. Implementation is complete.
2. Required tests are added.
3. Existing tests pass.
4. Security implications are reviewed.
5. Documentation is updated.
6. No known regression remains.
7. Acceptance criteria are met.
8. Relevant unresolved assumptions are not silently invented.

Code completion alone is not task completion.

---

# 7. Phase Overview

| Phase | Goal | Release dependency |
|---|---|---|
| Phase 0 | Resolve blockers and validate existing frontend | Required |
| Phase 1 | Repository, configuration, database, and quality foundation | Required |
| Phase 2 | Authentication, account approval, and RBAC | Required |
| Phase 3 | Device registry and access assignments | Required |
| Phase 4 | IoT gateway and telemetry ingestion | Required |
| Phase 5 | Monitoring dashboard and historical data | Required |
| Phase 6 | Internationalisation | Required |
| Phase 7 | Alerts and device-state handling | Required |
| Phase 8 | Faucet-control command lifecycle | Required before physical control |
| Phase 9 | Security hardening and observability | Required |
| Phase 10 | Test automation, UAT, and production readiness | Required |
| Phase 11 | Optional enhancements | Not required for initial release |

---

# 8. Phase 0 — Decisions and Frontend Validation

## TASK-0001 — Confirm Existing Frontend Technology

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** None
**Completed:** 2026-07-27 — `docs/FRONTEND_AUDIT.md` created.

### Work

- Read `FRONTEND_AUDIT.md`.
- Confirm:
  - Framework.
  - Version.
  - Build tool.
  - Routing system.
  - State-management approach.
  - Styling approach.
  - Existing component library.
  - Authentication code, if any.
  - Existing API integration.
  - Existing chart and map libraries.
- Record the selected frontend stack in `ARCHITECTURE.md`.

### Acceptance Criteria

- The framework and version are documented.
- No frontend migration is started without justification.
- Existing design and components to preserve are listed.
- Unsupported or obsolete dependencies are identified.

---

## TASK-0002 — Resolve Release-Blocking Product Decisions

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** None
**Completed:** 2026-07-27 — All release-blocking decisions recorded in `docs/DECISIONS.md`. Several numeric values restored to TBD pending explicit approval; see §3 of `DECISIONS.md` for the required-decisions list.

### Required decisions

- Whether `APPROVED` and `ACTIVE` remain separate.
- First Owner provisioning process.
- Whether multiple Owners are allowed.
- Owner device scope.
- Whether Owner may control faucets.
- Whether Admin may control faucets.
- Whether control is assigned per role, user, or device.
- Concurrent faucet-command policy.
- Cancellation and stop support.
- Meaning and unit of `Water BAT`.
- Measurement units.
- Offline and stale thresholds.
- Default and fallback locale.
- Authentication and session method.

### Acceptance Criteria

- Each decision is recorded as approved or deferred.
- Deferred decisions have a safe implementation default.
- No physical-control feature is enabled using an invented policy.

---

## TASK-0003 — Establish Requirement IDs

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** None
**Completed:** 2026-07-27 — Established requirement IDs across all specification documents and created docs/TRACEABILITY.md matrix.

### Work

Create stable identifiers for requirements across:

- PRD.
- RBAC.
- User flows.
- Security.
- Device communication.
- API.
- Database.
- Testing.

Recommended pattern:

```text
PRD-FR-001
RBAC-PERM-001
FLOW-AUTH-001
SEC-CONTROL-001
API-DEVICE-001
DB-CMD-001
TEST-RBAC-001
```

### Acceptance Criteria

- Critical requirements have unique IDs.
- Test cases can link to requirements.
- Task acceptance criteria can reference requirement IDs.

---

# 9. Phase 1 — Project Foundation

## TASK-0101 — Establish Repository Structure

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0001`

### Work

- Preserve the current frontend.
- Decide monorepo or separate repositories.
- If monorepo is approved, create:
  - `apps/web`
  - `apps/iot-gateway`
  - `packages/contracts`
  - `packages/database`
  - `packages/authorization`
  - `packages/config`
- Move files only when migration risk is understood.
- Preserve Git history where practical.

### Acceptance Criteria

- Existing frontend still builds.
- Existing visual pages remain unchanged unless explicitly modified.
- Web and gateway boundaries are clear.
- Shared contracts do not depend on frontend-only code.

---

## TASK-0102 — Configure TypeScript and Code Quality

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0101`

### Work

- Enable strict TypeScript settings.
- Configure linting.
- Configure formatting.
- Configure import ordering.
- Configure pre-commit or CI checks.
- Remove or document unsafe `any` use.

### Acceptance Criteria

- Type checking passes.
- Linting passes.
- Formatting is deterministic.
- Production build passes.
- Critical code paths use typed contracts.

---

## TASK-0103 — Configure Environment Validation

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0101`

### Work

Validate environment variables at startup:

```text
APP_ENV
DATABASE_URL
AUTH_SECRET
MQTT_BROKER_URL
MQTT_GATEWAY_CLIENT_ID
MQTT_GATEWAY_USERNAME
MQTT_GATEWAY_PASSWORD or certificate paths
DEFAULT_LOCALE
FALLBACK_LOCALE
REALTIME_TRANSPORT
```

### Acceptance Criteria

- Missing required values fail startup safely.
- Production rejects development defaults.
- Secrets are not logged.
- Example environment files contain placeholders only.

---

## TASK-0104 — Configure PostgreSQL and ORM

**Priority:** `P0`  
**Status:** `DONE`  
**Dependencies:** `TASK-0101`, `TASK-0002`

### Work

- Select ORM.
- Configure PostgreSQL.
- Create migration framework.
- Implement schema from `DATABASE.md`.
- Support advanced PostgreSQL constraints using raw migrations when needed.

### Acceptance Criteria

- Empty database migration succeeds.
- Seed migration succeeds.
- Schema constraints match `DATABASE.md`.
- Roll-forward migration process is documented.

---

## TASK-0105 — Seed Roles and Permissions

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0104`

### Work

Seed exactly:

```text
OWNER
ADMIN
```

Seed canonical permissions from `RBAC.md`.

### Acceptance Criteria

- No additional role is seeded.
- Role-permission mappings are deterministic.
- Re-running seed does not create duplicates.
- Permission codes are machine-readable and stable.

---

## TASK-0106 — Implement Secure First Owner Provisioning

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0104`, `TASK-0002`

### Work

Implement the approved first Owner provisioning method.

Possible approved methods:

- One-time CLI.
- Secure migration seed using secret input.
- Restricted administrative script.
- Deployment-time provisioning.

### Acceptance Criteria

- Public registration cannot create Owner.
- Owner credentials are not committed.
- Provisioning is auditable.
- Provisioning cannot accidentally run repeatedly.
- Owner account is `ACTIVE`.

---

## TASK-0107 — Configure Testing Foundation

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0101`

### Work

Configure:

- Unit test runner.
- Component test tools.
- API integration test tools.
- Database test containers.
- Playwright or approved E2E tool.
- MQTT test broker.
- Coverage reporting.
- Test data factories.

### Acceptance Criteria

- Example unit, API, database, and E2E tests pass.
- Tests run in CI.
- Test database is isolated.
- Test MQTT namespace is isolated.

---

## TASK-0108 — Configure CI Pipeline

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0102`, `TASK-0107`

### Work

Add checks for:

1. Dependency installation.
2. Formatting.
3. Linting.
4. Type checking.
5. Unit tests.
6. Component tests.
7. API tests.
8. Migration tests.
9. Translation completeness.
10. Secret scanning.
11. Dependency scanning.
12. Production build.

### Acceptance Criteria

- Pull requests cannot merge when required checks fail.
- Secrets are not printed.
- CI uses isolated test services.
- Production build is verified.

---

# 10. Phase 2 — Authentication, Approval, and RBAC

## TASK-0201 — Implement User Account Model

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0104`

### Work

Implement:

- User entity.
- Account statuses.
- Password hash.
- Role assignment.
- User preferences.
- Approval records.
- Timestamps.

### Acceptance Criteria

- Account statuses use canonical values.
- Password hash is never returned.
- User role is stored independently.
- Public registration path cannot directly set role or status.

---

## TASK-0202 — Implement Password Hashing

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0201`

### Work

- Use Argon2id or approved fallback.
- Configure secure parameters.
- Add password verification.
- Add password-policy validation.

### Acceptance Criteria

- Plain passwords are never stored or logged.
- Hash verification tests pass.
- Unsupported weak hashing is not used.
- Registration and password-change tests pass.

---

## TASK-0203 — Implement Public Admin Registration

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0201`, `TASK-0202`

### Work

Implement:

```text
POST /api/v1/auth/register
```

Server shall force:

```text
role = ADMIN
accountStatus = PENDING_APPROVAL
```

### Acceptance Criteria

- Valid registration creates pending Admin.
- Role injection is rejected or ignored.
- Status injection is rejected or ignored.
- Owner registration is impossible.
- Duplicate email is rejected.
- Registration is audited.
- UI shows pending approval.

---

## TASK-0204 — Implement Login and Session Management

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0201`, `TASK-0002`

### Work

- Implement approved session model.
- Add login.
- Add logout.
- Add session lookup.
- Rotate sessions after login.
- Revalidate account status.

### Acceptance Criteria

- Only `ACTIVE` accounts access protected pages.
- Pending, rejected, suspended, and deactivated users are blocked.
- Session expires correctly.
- Logout invalidates session.
- Session cookies or tokens meet `SECURITY.md`.

---

## TASK-0205 — Implement Account-Status Pages

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0203`, `TASK-0204`

### Work

Implement pages for:

- Pending approval.
- Approved but not active, if applicable.
- Rejected.
- Suspended.
- Deactivated.
- Session expired.

### Acceptance Criteria

- Status messages are translated.
- No protected content is displayed.
- Appropriate support or logout actions are available.
- Account state is loaded from the server.

---

## TASK-0206 — Implement Owner Pending Approval List

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0204`

### Work

Implement:

```text
GET /api/v1/approvals/pending
GET /api/v1/approvals/{userId}
```

Create Owner UI.

### Acceptance Criteria

- Only active Owner can access.
- Admin receives `403`.
- Empty and loading states exist.
- No passwords or secrets are exposed.

---

## TASK-0207 — Implement Owner Approval

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0206`, `TASK-0002`

### Work

Implement transactional approval.

### Acceptance Criteria

- Current status is rechecked.
- Duplicate decisions do not conflict silently.
- Approval history is inserted.
- Audit event is inserted.
- Account becomes approved/active according to policy.
- Notification failure does not roll back decision.

---

## TASK-0208 — Implement Owner Rejection

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0206`

### Acceptance Criteria

- Only pending accounts may be rejected.
- Decision is transactional.
- Target becomes `REJECTED`.
- Decision is audited.
- Duplicate conflicting actions return conflict.

---

## TASK-0209 — Implement Authorisation Library

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0105`, `TASK-0204`

### Work

Implement reusable server helpers:

```text
requireSession()
requireActiveAccount()
requireRole()
requirePermission()
requireSelfOrPermission()
requireDeviceViewAccess()
requireDeviceControlAccess()
```

### Acceptance Criteria

- Deny by default.
- No browser-supplied role is trusted.
- Unit tests cover Owner and Admin permissions.
- API endpoints use shared checks rather than duplicated ad hoc logic.

---

## TASK-0210 — Protect Routes and APIs

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0209`

### Work

- Protect all required pages.
- Protect all API routes.
- Add Owner-only guards.
- Add session-expiry handling.

### Acceptance Criteria

- Direct URL access cannot bypass RBAC.
- Hidden frontend controls are not the only protection.
- Unauthenticated returns `401`.
- Authenticated but forbidden returns `403` or concealed `404`.

---

## TASK-0211 — Implement Self Profile

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0204`, `TASK-0209`

### Work

Implement:

```text
GET /api/v1/me
PATCH /api/v1/me
```

### Acceptance Criteria

- Owner and Admin can read own profile.
- Only allowlisted fields can be edited.
- Role and status injection fail.
- Changes are audited where required.

---

## TASK-0212 — Implement Owner User Management

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0209`

### Work

Implement:

- User list.
- User detail.
- Permitted profile edit.
- Suspension.
- Deactivation.
- Activation, if approved.

### Acceptance Criteria

- Admin cannot call endpoints.
- Immutable and secret fields cannot be edited.
- Status changes revoke sessions.
- Actions are audited.

---

# 11. Phase 3 — Device Registry and Access

## TASK-0301 — Implement Site Model

**Priority:** `P2`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0104`, `TASK-0002`

### Work

Implement sites if required for version 1.

### Acceptance Criteria

- Site code is unique.
- Devices may be scoped to a site.
- Site access integrates with Owner scope.

---

## TASK-0302 — Implement Device Registry

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0104`

### Work

Implement:

- Device identity.
- Device type.
- Lifecycle status.
- Connection status.
- Capabilities.
- Firmware metadata.
- Last seen.
- Coordinates.

### Acceptance Criteria

- `deviceId` is unique.
- Device IDs are canonical and untranslated.
- Device credentials are not exposed.
- Inactive devices cannot receive commands.

---

## TASK-0303 — Implement Device Capabilities

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0302`

### Work

Support:

```text
SOIL_TELEMETRY
WATER_TELEMETRY
LOCATION
TANK_MONITORING
FLOW_MONITORING
FAUCET_CONTROL
BATTERY_MONITORING
```

### Acceptance Criteria

- UI can determine relevant modules from backend data.
- Missing capability is not shown as device failure.
- Duplicate capability is prevented.

---

## TASK-0304 — Implement User-Device Assignments

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0302`, `TASK-0209`

### Work

Implement:

```text
canView
canControl
assignedBy
assignedAt
revokedAt
```

### Acceptance Criteria

- Owner can assign and revoke.
- Admin cannot self-assign.
- View and control are separate.
- Revocation is historically retained.
- Assignment changes are audited.

---

## TASK-0305 — Implement Authorised Device List

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0304`

### Work

Implement:

```text
GET /api/v1/devices
GET /api/v1/devices/{deviceId}
```

### Acceptance Criteria

- Admin sees only assigned devices.
- Owner sees devices within approved scope.
- Device permissions include `canView` and `canControl`.
- Device ID manipulation fails.

---

## TASK-0306 — Implement Device Selector

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0305`

### Work

Frontend states:

- Loading.
- One device.
- Multiple devices.
- No assigned devices.
- Revoked access.
- Error.

### Acceptance Criteria

- All device-specific panels use one selected device.
- Switching devices clears misleading prior values.
- Unauthorised devices cannot be selected through URL manipulation.
- Default selection follows approved policy.

---

# 12. Phase 4 — IoT Gateway and Telemetry Ingestion

## TASK-0401 — Create IoT Gateway Service

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0101`, `TASK-0002`

### Work

Create long-running service with:

- MQTT client.
- Topic router.
- Payload validator.
- Telemetry processor.
- Device-status processor.
- Command publisher.
- Acknowledgement processor.
- Health endpoints.
- Logging and metrics.

### Acceptance Criteria

- Gateway starts independently.
- Gateway reconnects safely.
- Gateway exposes health and readiness.
- Broker secrets remain server-side.

---

## TASK-0402 — Configure Development MQTT Broker

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0401`

### Work

- Configure Mosquitto or approved development broker.
- Add authentication.
- Add development topic ACLs.
- Separate environments.

### Acceptance Criteria

- Anonymous access is disabled unless explicitly isolated.
- Device topics are isolated.
- Faucet commands are not retained.
- Broker configuration is version controlled without secrets.

---

## TASK-0403 — Implement MQTT Topic Router

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0401`

### Work

Parse:

```text
environment
siteId
deviceId
message category
message subtype
```

### Acceptance Criteria

- Topic and payload device mismatch is rejected.
- Unknown topic patterns are rejected.
- Production and test namespaces remain separate.

---

## TASK-0404 — Implement Shared Message Validation

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0403`

### Work

Validate:

- JSON.
- Schema version.
- Message ID.
- Device ID.
- Timestamp.
- Sequence.
- Message size.
- Required data fields.

### Acceptance Criteria

- Invalid messages do not overwrite valid data.
- Unsupported versions are rejected.
- `NaN` and infinity are rejected.
- Errors use canonical codes.

---

## TASK-0405 — Implement Soil Telemetry Ingestion

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0404`, `TASK-0104`

### Work

Process:

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

### Acceptance Criteria

- Valid zero remains zero.
- Unavailable values remain null.
- Duplicate message IDs are idempotent.
- `recordedAt` and `receivedAt` are stored separately.
- Device last seen is updated after valid processing.

---

## TASK-0406 — Implement Water Telemetry Ingestion

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0404`, `TASK-0104`, `TASK-0002`

### Work

Process:

```text
ph
tds
ec
battery
latitude
longitude
status
tankVolume
flowRate
```

### Acceptance Criteria

- Coordinate bounds are enforced.
- Missing values are not converted to zero.
- `Water BAT` meaning and unit are documented.
- Duplicate message IDs are idempotent.

---

## TASK-0407 — Implement Heartbeat and Device Status

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0404`, `TASK-0002`

### Work

Implement:

- Online status.
- Offline status.
- Last Will handling.
- Heartbeat processing.
- Last seen.
- Stale calculation.

### Acceptance Criteria

- Last Will unexpected disconnect produces offline state.
- Reconnect produces online state.
- Stale and offline thresholds use approved values.
- Retained status does not bypass freshness checks.

---

## TASK-0408 — Implement Device Simulator

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0402`, `TASK-0404`

### Work

Simulate:

- Soil telemetry.
- Water telemetry.
- Heartbeat.
- Disconnect.
- Invalid payload.
- Duplicate payload.
- Faucet acknowledgement.
- Faucet progress.
- Faucet completion.
- Faucet failure.
- Timeout.

### Acceptance Criteria

- Scenarios are repeatable.
- Device IDs are configurable.
- Simulator can publish duplicate and out-of-order messages.
- Simulator does not use production credentials.

---

## TASK-0409 — Implement Gateway Observability

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0401`

### Work

Metrics:

- Broker connection.
- Messages received.
- Invalid messages.
- Duplicate messages.
- Ingestion latency.
- Connected devices.
- Command status.
- Timeouts.

### Acceptance Criteria

- Logs are structured.
- Credentials are redacted.
- Correlation IDs are present.
- Health reflects broker and database dependencies.

---

# 13. Phase 5 — Monitoring and History

## TASK-0501 — Implement Latest Monitoring API

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0405`, `TASK-0406`, `TASK-0305`

### Work

Implement:

```text
GET /devices/{deviceId}/monitoring/latest
GET /devices/{deviceId}/monitoring/soil/latest
GET /devices/{deviceId}/monitoring/water/latest
```

### Acceptance Criteria

- Device access is verified.
- Canonical values are returned.
- Zero and null semantics are preserved.
- Freshness is included.
- Raw MQTT details are not exposed.

---

## TASK-0502 — Implement Monitoring Dashboard

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0501`, `TASK-0306`

### Work

Display:

- Soil metrics.
- Water metrics.
- Tank metrics.
- Device state.
- Last update.
- Location.
- Status.

### Acceptance Criteria

- Existing design is preserved.
- Unsupported capabilities are hidden appropriately.
- Loading, current, stale, offline, empty, invalid, and unavailable states exist.
- All values belong to selected device.

---

## TASK-0503 — Implement Historical Query API

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0405`, `TASK-0406`

### Work

Implement bounded history for soil and water.

### Acceptance Criteria

- Date range is validated.
- Device access is enforced.
- Missing intervals remain missing or null.
- Pagination or aggregation prevents unbounded queries.
- Indexes are used.

---

## TASK-0504 — Implement Historical Charts

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0503`

### Acceptance Criteria

- Metrics can be selected.
- Date range can be changed.
- Missing values are represented accurately.
- Chart text is localised.
- Mobile layout remains usable.

---

## TASK-0505 — Implement Realtime Monitoring Stream

**Priority:** `P1`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0401`, `TASK-0501`, `TASK-0002`

### Work

Implement selected real-time transport.

Recommended initial:

```text
Server-Sent Events
```

### Acceptance Criteria

- Session is authenticated.
- Device events are filtered.
- Revoked access stops the stream.
- Session expiry closes stream.
- MQTT credentials are never exposed.
- Polling fallback exists if required.

---

# 14. Phase 6 — Internationalisation

## TASK-0601 — Select and Configure I18N Library

**Priority:** `P1`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0001`, `TASK-0002`

### Work

Select compatible library:

- Next.js: `next-intl`.
- React/Vite: `react-i18next`.
- Vue: `vue-i18n`.
- Other framework equivalent.

### Acceptance Criteria

- `en` and `id` are configured.
- Default and fallback locale are configured.
- Raw keys do not appear.
- Server and client rendering are supported where needed.

---

## TASK-0602 — Create Translation Namespaces

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0601`

Create:

```text
common
auth
navigation
dashboard
devices
soil
water
history
faucet
alerts
users
approvals
profile
settings
validation
errors
accessibility
```

### Acceptance Criteria

- Key sets match between locales.
- No empty required translation exists.
- Interpolation placeholders are consistent.

---

## TASK-0603 — Replace Hard-Coded UI Text

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0602`

### Acceptance Criteria

- Authentication and protected pages are translated.
- Status badges are translated at presentation time.
- Canonical API values remain unchanged.
- Accessibility labels are translated.

---

## TASK-0604 — Implement Locale Persistence

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0601`, `TASK-0211`

### Acceptance Criteria

- Unauthenticated preference persists locally.
- Authenticated preference persists in profile.
- Refresh retains locale.
- Locale change does not alter device selection or RBAC.

---

## TASK-0605 — Add Translation Completeness Checks

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0602`, `TASK-0108`

### Acceptance Criteria

CI detects:

- Missing keys.
- Extra keys.
- Empty values.
- Placeholder mismatches.
- Raw translation keys.

---

# 15. Phase 7 — Alerts and State Management

## TASK-0701 — Implement Alert Model and API

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0104`, `TASK-0304`

### Work

Implement:

- Alert list.
- Alert detail.
- Scope filtering.
- Canonical type and severity.
- Translation keys and parameters.

### Acceptance Criteria

- Users see only authorised alerts.
- Alerts store canonical values.
- System text is translated in frontend.

---

## TASK-0702 — Implement Device Offline and Stale Alerts

**Priority:** `P1`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0407`, `TASK-0002`

### Acceptance Criteria

- Approved thresholds are used.
- Duplicate alert floods are prevented.
- Reconnection or fresh data resolves or updates alerts according to policy.

---

## TASK-0703 — Implement Command Failure and Timeout Alerts

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0806`

### Acceptance Criteria

- Failure and timeout are distinct.
- Alert links to device and command.
- Timeout does not claim known physical state.

---

## TASK-0704 — Implement Alert Acknowledgement

**Priority:** `P2`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0701`, `TASK-0002`

### Acceptance Criteria

- Permission is checked.
- Device scope is checked.
- Acknowledgement is audited.
- Alert is not deleted.

---

# 16. Phase 8 — Faucet Control

## TASK-0801 — Finalise Faucet Permission Matrix

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0002`

### Work

Document:

- Owner control permission.
- Admin control permission.
- Per-device `canControl`.
- Cancellation.
- Stop.
- Emergency stop.
- Concurrent command policy.

### Acceptance Criteria

- `RBAC.md`, `API.md`, `SECURITY.md`, and tests are updated.
- No control feature proceeds using assumptions.

---

## TASK-0802 — Implement Faucet Command Database Model

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0104`

### Acceptance Criteria

- Phase-volume check constraint exists.
- Command ID is unique.
- Idempotency key is unique.
- Command events are append-only.
- Final states cannot regress silently.

---

## TASK-0803 — Implement Faucet Command API

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0801`, `TASK-0802`, `TASK-0304`

### Work

Implement:

```text
POST /devices/{deviceId}/faucet-commands
```

### Acceptance Criteria

- Active session required.
- Active account required.
- Control permission required.
- Device access required.
- Device capability required.
- Device online/controllable required.
- Phase mapping is server-side.
- Command is persisted before publication.
- Idempotency is enforced.
- Response starts as `QUEUED`.

---

## TASK-0804 — Implement Gateway Command Publisher

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0401`, `TASK-0803`

### Acceptance Criteria

- Command targets one device.
- Command is not retained.
- QoS matches approved specification.
- Expiry is included.
- Publication result updates status.
- Failed publish does not appear as sent.

---

## TASK-0805 — Implement Device Acknowledgement Processing

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0804`

### Acceptance Criteria

- Acknowledgement links to command and device.
- Unknown command is rejected or logged.
- Duplicate acknowledgement is idempotent.
- Rejection reason is canonical.
- `ACKNOWLEDGED` does not become `COMPLETED`.

---

## TASK-0806 — Implement Command Event State Machine

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0805`

### Work

Support:

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

### Acceptance Criteria

- Invalid transitions are rejected or flagged.
- Final states do not regress.
- Late events follow approved reconciliation.
- Timeout remains distinct from failure and completion.
- Events are audited.

---

## TASK-0807 — Implement Faucet Control UI

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0803`, `TASK-0806`

### Acceptance Criteria

- User selects phase only.
- Target volume is displayed.
- Confirmation is required.
- Device name and status are shown.
- Permission denied is handled.
- Offline and busy states are handled.
- Queue, progress, completion, failure, and timeout states exist.
- Completion is not shown prematurely.

---

## TASK-0808 — Implement Duplicate Command Protection

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0803`, `TASK-0804`, `TASK-0805`

### Acceptance Criteria

- Same idempotency key and payload returns existing command.
- Same key with different payload returns conflict.
- MQTT duplicate delivery executes once.
- Device simulator confirms duplicate protection.
- Tests cover network retry.

---

## TASK-0809 — Implement Command Timeout Processor

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0806`, `TASK-0002`

### Acceptance Criteria

- Approved acknowledgement and completion timeouts are used.
- Timeout event is stored.
- UI receives timeout.
- No blind physical retry occurs.
- Late acknowledgement follows approved policy.

---

## TASK-0810 — Implement Cancel and Stop

**Priority:** `P2`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0801`, `TASK-0806`

Only implement if approved.

### Acceptance Criteria

- Separate permission.
- Original command reference.
- Confirmation.
- Device acknowledgement.
- Uncertain state shown when stop cannot be confirmed.

---

## TASK-0811 — Hardware-in-the-Loop Control Validation

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0807`, hardware readiness

### Work

Test each phase repeatedly with measured output.

### Acceptance Criteria

- Device receives one command.
- Correct phase is reported.
- Target and actual volume are recorded.
- Duplicate command does not repeat dispensing.
- Timeout and disconnect behaviour are documented.
- Hardware-team tolerance is met.
- Production control remains disabled until approved.

---

# 17. Phase 9 — Security and Observability

## TASK-0901 — Implement Security Headers

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0204`

Implement:

- CSP.
- HSTS.
- `X-Content-Type-Options`.
- Referrer policy.
- Permissions policy.
- Frame restrictions.

### Acceptance Criteria

- Production headers pass security review.
- Existing UI resources continue loading.
- Inline script exceptions are minimised.

---

## TASK-0902 — Implement Rate Limiting

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0204`, `TASK-0002`

Apply to:

- Login.
- Registration.
- Password reset.
- Approval actions.
- Faucet commands.
- Exports.
- Expensive history.

### Acceptance Criteria

- Limits are environment configurable.
- Rate-limit response is stable.
- Internal trusted services are handled safely.
- Faucet rate limit complements idempotency.

---

## TASK-0903 — Implement Audit Logging

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0104`

### Acceptance Criteria

- Required events are captured.
- Audit rows are append-only through normal APIs.
- Passwords, tokens, and secrets are redacted.
- Actor, target, result, and request ID are stored.

---

## TASK-0904 — Implement Structured Application Logging

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0103`

### Acceptance Criteria

- JSON or structured format.
- Correlation IDs.
- Environment and service name.
- No secrets.
- Log levels are configurable.

---

## TASK-0905 — Implement Health and Readiness Checks

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0104`, `TASK-0401`

### Acceptance Criteria

- Web liveness is independent from temporary dependency failure.
- Readiness checks database and gateway.
- Gateway readiness checks broker and database.
- No credentials are returned.

---

## TASK-0906 — Implement Secret Scanning and Dependency Scanning

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0108`

### Acceptance Criteria

- CI blocks detected secrets.
- Dependency scan runs.
- Container image scan runs when container builds exist.
- Exceptions require documented review.

---

## TASK-0907 — Configure Production MQTT TLS and ACLs

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0402`, hosting decision

### Acceptance Criteria

- Anonymous access disabled.
- TLS enabled.
- Device credentials unique.
- Topic ACL isolates each device.
- Gateway has only required permissions.
- Revoked device cannot reconnect.

---

## TASK-0908 — Implement Session Revocation

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-0204`

### Acceptance Criteria

- Suspension revokes sessions.
- Deactivation revokes sessions.
- Password change follows approved revocation policy.
- Session expiry closes live stream.
- Device-access revocation affects subsequent requests immediately or within approved cache limit.

---

## TASK-0909 — Configure Backup and Restore

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** hosting decision

### Acceptance Criteria

- Automated backup exists.
- Backup is encrypted.
- Restore test succeeds.
- Required data domains are restored.
- Backup status is monitored.

---

# 18. Phase 10 — Verification and Release

## TASK-1001 — Complete Unit Test Suite

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** Implementation tasks

### Acceptance Criteria

Critical unit coverage includes:

- Account-status decision.
- Permission checks.
- Device access.
- Telemetry validation.
- Phase mapping.
- Command transition.
- Idempotency.
- Locale validation.

---

## TASK-1002 — Complete API Integration Tests

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** API implementation

### Acceptance Criteria

- Authentication matrix passes.
- RBAC matrix passes.
- Device isolation passes.
- Monitoring schema passes.
- Faucet idempotency passes.
- Error envelopes match specification.

---

## TASK-1003 — Complete MQTT Contract Tests

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** `TASK-0401`, `TASK-0408`, `TASK-0806`

### Acceptance Criteria

- Valid and invalid payloads tested.
- Topic mismatch tested.
- Duplicate telemetry tested.
- Duplicate command tested.
- Last Will tested.
- Reconnect tested.
- Expired command tested.

---

## TASK-1004 — Complete End-to-End Critical Flows

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** Core UI and APIs

Required flows:

- Admin registration.
- Owner approval.
- Active Admin login.
- Device assignment.
- Monitoring.
- History.
- Language switch.
- Faucet command.
- Command completion.
- Command failure.
- Session expiry.
- Access revocation.

### Acceptance Criteria

- Flows pass in staging.
- Screenshots or test traces are retained.
- Failures block release.

---

## TASK-1005 — Complete Security Test Suite

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** Security implementation

### Acceptance Criteria

- IDOR/BOLA tests pass.
- Role injection fails.
- Status injection fails.
- CSRF and CORS are reviewed.
- XSS and SQL injection tests pass.
- MQTT ACL tests pass.
- Secret scan passes.
- No critical or high unresolved security defect remains.

---

## TASK-1006 — Complete Accessibility Review

**Priority:** `P1`  
**Status:** `BACKLOG`  
**Dependencies:** Frontend completion

### Acceptance Criteria

- Keyboard navigation works.
- Visible focus exists.
- Form errors are announced.
- Language attribute is correct.
- Dialog focus is managed.
- Critical contrast issues are resolved.
- English and Indonesian accessibility text is present.

---

## TASK-1007 — Complete Performance and Soak Tests

**Priority:** `P1`  
**Status:** `BLOCKED`  
**Dependencies:** capacity targets

### Acceptance Criteria

- Agreed API targets are met.
- Sustained telemetry does not leak resources.
- Live streams remain stable.
- Historical queries remain bounded.
- Broker and gateway recover after restart.

---

## TASK-1008 — Complete UAT

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** Critical flows complete

### Participants

- Product Owner.
- Operational Owner user.
- Admin user.
- Hardware-team representative.
- QA/developer representative.

### Acceptance Criteria

- UAT scenarios completed.
- Feedback is recorded.
- Release-blocking issues are resolved.
- Formal approval is recorded.

---

## TASK-1009 — Production Readiness Review

**Priority:** `P0`  
**Status:** `BACKLOG`  
**Dependencies:** All required Phase 10 tasks

### Checklist

- No critical defects.
- No unaccepted high defects.
- Security tests pass.
- MQTT TLS and ACL verified.
- Backups verified.
- Migrations verified.
- Rollback plan exists.
- Production secrets validated.
- Monitoring and logs active.
- Physical control approval recorded.

---

## TASK-1010 — Controlled Production Release

**Priority:** `P0`  
**Status:** `BLOCKED`  
**Dependencies:** `TASK-1009`

### Release order

1. Deploy database migrations.
2. Deploy web backend.
3. Deploy gateway.
4. Verify health and readiness.
5. Verify read-only monitoring.
6. Verify Owner access.
7. Verify Admin access.
8. Verify device data.
9. Enable faucet control only after explicit approval.
10. Monitor logs and metrics.

### Acceptance Criteria

- Smoke tests pass.
- No data isolation issue occurs.
- No command anomaly occurs.
- Rollback remains available.
- Release is documented.

---

# 19. Phase 11 — Optional Enhancements

## TASK-1101 — Monitoring Export

**Priority:** `P2`  
**Status:** `DEFERRED`

Implement CSV or approved export after permissions and localisation policy are final.

---

## TASK-1102 — Audit Export

**Priority:** `P3`  
**Status:** `DEFERRED`

---

## TASK-1103 — Multi-Factor Authentication

**Priority:** `P2`  
**Status:** `DEFERRED`

Recommended for Owner accounts.

---

## TASK-1104 — Advanced Telemetry Aggregation

**Priority:** `P2`  
**Status:** `DEFERRED`

Possible:

- Hourly rollups.
- Daily rollups.
- Partitioning.
- Retention automation.

---

## TASK-1105 — Advanced Device Provisioning

**Priority:** `P2`  
**Status:** `DEFERRED`

Possible:

- QR-assisted setup.
- Certificate provisioning.
- Credential rotation portal.
- Technician workflow.

---

## TASK-1106 — Notifications

**Priority:** `P2`  
**Status:** `DEFERRED`

Possible:

- Email.
- In-app.
- Other approved channels.

---

# 20. Cross-Cutting Definition of Done

Every completed feature shall satisfy:

## Functional

- Requirement implemented.
- Error states implemented.
- Empty and loading states implemented.
- No silent fallback to fabricated data.

## Security

- Server-side authorisation.
- Input validation.
- Secret redaction.
- Audit event where required.
- Device access where required.

## Internationalisation

- English translation.
- Indonesian translation.
- Accessibility translation.
- No translated canonical values in API/database.

## Testing

- Unit tests.
- Integration tests.
- Relevant E2E tests.
- Regression test for fixed defects.

## Documentation

- API updated.
- Database updated.
- Architecture updated if boundary changed.
- Open decision removed or revised when resolved.

---

# 21. Recommended Sprint Grouping

## Sprint 1 — Foundation

- `TASK-0001`
- `TASK-0002`
- `TASK-0101`
- `TASK-0102`
- `TASK-0103`
- `TASK-0104`
- `TASK-0105`
- `TASK-0107`
- `TASK-0108`

## Sprint 2 — Authentication and Approval

- `TASK-0106`
- `TASK-0201`
- `TASK-0202`
- `TASK-0203`
- `TASK-0204`
- `TASK-0205`
- `TASK-0206`
- `TASK-0207`
- `TASK-0208`
- `TASK-0209`
- `TASK-0210`

## Sprint 3 — Profiles and Devices

- `TASK-0211`
- `TASK-0212`
- `TASK-0302`
- `TASK-0303`
- `TASK-0304`
- `TASK-0305`
- `TASK-0306`

## Sprint 4 — Gateway and Telemetry

- `TASK-0401`
- `TASK-0402`
- `TASK-0403`
- `TASK-0404`
- `TASK-0405`
- `TASK-0406`
- `TASK-0407`
- `TASK-0408`
- `TASK-0409`

## Sprint 5 — Monitoring

- `TASK-0501`
- `TASK-0502`
- `TASK-0503`
- `TASK-0504`
- `TASK-0505`

## Sprint 6 — I18N and Alerts

- `TASK-0601`
- `TASK-0602`
- `TASK-0603`
- `TASK-0604`
- `TASK-0605`
- `TASK-0701`
- `TASK-0702`
- `TASK-0704`

## Sprint 7 — Faucet Control

- `TASK-0801`
- `TASK-0802`
- `TASK-0803`
- `TASK-0804`
- `TASK-0805`
- `TASK-0806`
- `TASK-0807`
- `TASK-0808`
- `TASK-0809`

## Sprint 8 — Hardening and Release

- `TASK-0901` through `TASK-0909`
- `TASK-1001` through `TASK-1010`

Sprint duration and team capacity are `TBD`.

---

# 22. Agent Execution Rules

A coding agent shall:

1. Read the related specification files before starting a task.
2. Work on one coherent task or small dependency group at a time.
3. State which task IDs are being implemented.
4. Avoid changing unrelated files.
5. Preserve the existing frontend design.
6. Never invent unresolved requirements.
7. Mark blocked tasks rather than choosing an unsafe assumption.
8. Add tests in the same change.
9. Report files changed.
10. Report tests run.
11. Report unresolved issues.
12. Stop before enabling production physical control without approval.

---

# 23. High-Risk Task Review Requirement

The following tasks require mandatory human review:

```text
TASK-0106 First Owner provisioning
TASK-0204 Session management
TASK-0207 Account approval
TASK-0209 Authorisation library
TASK-0304 Device assignments
TASK-0402 Broker security
TASK-0803 Faucet command API
TASK-0804 Gateway command publisher
TASK-0805 Acknowledgement processing
TASK-0806 Command state machine
TASK-0808 Duplicate command protection
TASK-0809 Timeout processor
TASK-0907 Production MQTT security
TASK-0908 Session revocation
TASK-0909 Backup and restore
TASK-1010 Production release
```

---

# 24. Release Blockers

The first production release is blocked until:

- [ ] First Owner provisioning is approved.
- [ ] Authentication method is selected.
- [ ] Session revocation works.
- [ ] Owner/Admin permissions are final.
- [ ] Device-access rules are implemented.
- [ ] MQTT security is configured.
- [ ] Telemetry units are documented.
- [ ] `Water BAT` is clarified.
- [ ] Stale and offline thresholds are approved.
- [ ] Faucet permission matrix is approved.
- [ ] Command concurrency is approved.
- [ ] Timeout behaviour is approved.
- [ ] Duplicate execution protection passes.
- [ ] Security tests pass.
- [ ] UAT is approved.
- [ ] Backup and rollback are verified.

---

# 25. Open Decisions

> **Status as of 2026-07-27:** Items 1–15 are resolved and recorded in `docs/DECISIONS.md`. Items 16–30 below remain unresolved. See `docs/DECISIONS.md` §3 for the authoritative list of required decisions.

1. ~~Frontend framework confirmation.~~ **RESOLVED** — Next.js 14 App Router (see FRONTEND_AUDIT.md).
2. ~~Monorepo versus separate repositories.~~ **RESOLVED** — npm monorepo (`DEC-INF-075`).
3. ~~Authentication library.~~ **RESOLVED** — Custom session handlers over PostgreSQL (`DEC-AUTH-001`).
4. ~~Session storage.~~ **RESOLVED** — PostgreSQL `sessions` table (`DEC-AUTH-001`).
5. ~~First Owner provisioning.~~ **RESOLVED** — CLI seed script `npm run seed:owner` (`DEC-AUTH-006`).
6. Multiple Owner policy. **TBD.**
7. ~~`APPROVED` versus `ACTIVE`.~~ **RESOLVED** — separate statuses per `AGENTS.md` canonical values.
8. Owner device scope. **TBD.**
9. Site model. **DEFERRED** — `DEC-DEV-026`; optional `site_id` column.
10. ~~Admin control permission.~~ **RESOLVED** — device assignment confers control (`DEC-RBAC-015`).
11. Owner control permission. **TBD.**
12. ~~Command concurrency.~~ **RESOLVED** — max 1 active command/device (`DEC-CTRL-051`).
13. Cancellation and stop. **TBD** — see `docs/DECISIONS.md` §3.
14. Timeout values (ACK, completion, expiry). **TBD** — see `docs/DECISIONS.md` §3.
15. Late-event reconciliation. **TBD.**
16. MQTT broker (production choice). **TBD.**
17. ~~Device authentication method.~~ **RESOLVED** — per-device username/password + ACLs (`DEC-DEV-020`).
18. Telemetry intervals. **TBD** — see `docs/DECISIONS.md` §3.
19. Offline and stale thresholds. **TBD** — see `docs/DECISIONS.md` §3.
20. ~~Measurement units.~~ **RESOLVED** — confirmed in `DEC-MON-036` through `DEC-MON-050`.
21. `Water BAT` meaning and unit. **TBD** — see `docs/DECISIONS.md` §3.
22. ~~Default and fallback locale.~~ **RESOLVED** — `id` default, `en` fallback (`DEC-I18N-068`).
23. Realtime transport. **DEFERRED** — SSE in-memory in v1 (`DEC-INF-077`).
24. Redis requirement. **DEFERRED** — not required in v1 (`DEC-INF-077`).
25. Notification provider. **TBD.**
26. Backup objectives (schedule, retention, RPO, RTO). **TBD** — see `docs/DECISIONS.md` §3.
27. Performance targets (p95 read/write). **TBD** — see `docs/DECISIONS.md` §3.
28. Browser support matrix. **TBD** (Evergreen browsers confirmed; specific minimum versions TBD).
29. UAT approvers. **TBD.**
30. Release cadence. **TBD.**
31. ORM selection (Prisma vs Drizzle). **TBD** — see `docs/DECISIONS.md` §3; required before `TASK-0104`.
32. `SameSite` cookie policy exact value. **TBD** — see `docs/DECISIONS.md` §3.
33. Accessibility standard level (WCAG version and level). **TBD** — see `docs/DECISIONS.md` §3.
34. Physical test run count per faucet phase. **TBD** — see `docs/DECISIONS.md` §3.
35. Heartbeat and telemetry publish intervals. **TBD** — see `docs/DECISIONS.md` §3.

---

# 26. Conflicts and Gaps Found

> **Status as of 2026-07-27 reconciliation:** Items updated to reflect resolved decisions.

1. The documentation set is sufficient to begin foundation work (`TASK-0003` and `TASK-0101`). Several physical-control policies remain blockers for Phase 8.
2. ~~The frontend technology must be confirmed before choosing implementation libraries.~~ **Resolved** — Next.js 14 App Router confirmed via `FRONTEND_AUDIT.md`.
3. ~~The authentication and session approach is not final.~~ **Resolved** — PostgreSQL session table with HTTP-only cookies approved (`DEC-AUTH-001`). `SameSite` exact value still TBD.
4. ~~Owner and Admin faucet permissions remain unresolved.~~ **Partially resolved** — Admin faucet permission rule approved (`DEC-RBAC-015`). Owner faucet permission and cancellation/stop support remain TBD.
5. Several sensor units confirmed (`DEC-MON`). `Water BAT` meaning and unit remain undefined.
6. Device freshness thresholds (offline and stale) remain undefined — see `docs/DECISIONS.md` §3.
7. ~~The production broker and device credential strategy remain unresolved.~~ **Resolved** — MQTT 5.0 over TLS, per-device credentials, per-device ACLs (`DEC-DEV-020`). Production broker vendor still TBD.
8. Command concurrency approved. Cancellation, stop, timeout values, and late-event handling remain TBD.
9. Performance and capacity targets remain provisional — see `docs/DECISIONS.md` §3.
10. Production physical control shall remain disabled until hardware-in-the-loop testing and explicit dual sign-off are complete.
11. **New (reconciliation):** ORM selection is unresolved. Neither Prisma nor Drizzle is installed. User must select one before `TASK-0104`.
12. **New (reconciliation):** TASKS.md Sections 25 and 26 had stale entries listing resolved decisions as still open. Updated above.
13. **New (reconciliation):** Previous DECISIONS.md Table 4 used incorrect task titles and IDs not matching TASKS.md. Corrected in DECISIONS.md revision.
14. **New (reconciliation):** Previous DECISIONS.md Table 4 marked TASK-0102 and TASK-0103 as READY despite depending on an unstarted TASK-0101. Corrected to BACKLOG.
