# AGENTS.md

## 1. Purpose

This file defines how coding agents shall work inside the web-based soil and water monitoring and faucet-control project.

It is an execution policy for:

- Reading project documentation.
- Selecting implementation tasks.
- Modifying the existing codebase.
- Preserving the approved frontend design.
- Handling unresolved requirements.
- Implementing authentication, RBAC, device access, telemetry, MQTT, alerts, and faucet control.
- Writing tests.
- Reporting work.
- Avoiding unsafe assumptions.
- Stopping before high-risk production actions.

All coding agents must read this file before changing project files.

---

## 2. Project Summary

The project is a web-based multi-device monitoring and control system for ESP32/NodeMCU devices.

The system monitors:

### Soil Monitoring (REST API over Wi-Fi)

- Nitrogen, Phosphorus, Potassium, Temperature, Moisture, pH, EC, Soil status (Battery deleted per `DEC-MON-086`).

### Water Quality Monitoring (REST API over Wi-Fi)

- pH, TDS, EC, Water status (Battery, Latitude, and Longitude deleted).

### Reservoir-Water Monitoring (MQTT 5.0 over TLS via EMQX Broker)

- Reservoir water volume, Reservoir water flow rate, Reservoir status.

### Sensor Battery (`BAT`)

- Battery (`BAT`) parameter is completely removed from soil and water quality monitoring domains (`DEC-MON-086`, superseding `DEC-MON-085`).

### Faucet Control Presets

| Phase | Target volume |
|---|---:|
| Phase 1 | 300 mL |
| Phase 2 | 1,000 mL |
| Phase 3 | 1,500 mL |

The initial application roles are exactly:

```text
OWNER
ADMIN
```

Public registration creates only an Admin request with:

```text
role = ADMIN
accountStatus = PENDING_APPROVAL
```

An Owner must approve the Admin before protected access is allowed.

---

## 3. Mandatory Reading Order

Before starting any implementation task, read the relevant documentation completely.

Use this order of authority:

1. `docs/PRD.md`
2. `docs/RBAC.md`
3. `docs/USER_FLOWS.md`
4. `docs/SECURITY.md`
5. `docs/DEVICE_COMMUNICATION.md`
6. `docs/API.md`
7. `docs/DATABASE.md`
8. `docs/ARCHITECTURE.md`
9. `docs/I18N.md`
10. `docs/UI_UX.md`
11. `docs/FRONTEND_AUDIT.md`
12. `docs/TESTING.md`
13. `TASKS.md`
14. `AGENTS.md`

Interpretation rules:

- `PRD.md` defines product intent.
- `RBAC.md` defines permissions and account-access rules.
- `USER_FLOWS.md` defines expected end-to-end behaviour.
- `SECURITY.md` defines mandatory safety and security constraints.
- `DEVICE_COMMUNICATION.md` defines device and MQTT contracts.
- `API.md` defines application interfaces.
- `DATABASE.md` defines persistence and integrity rules.
- `ARCHITECTURE.md` defines component boundaries.
- `I18N.md` defines multilingual behaviour.
- `UI_UX.md` defines interface behaviour and design expectations.
- `FRONTEND_AUDIT.md` defines the current codebase and existing frontend implementation.
- `TESTING.md` defines required verification.
- `TASKS.md` defines implementation sequencing.

When two documents conflict, follow the higher-ranked document and report the conflict.

Do not silently resolve contradictions.

---

## 4. Existing Frontend Is the Visual Source of Truth

The existing frontend design and source code shall be preserved unless a task explicitly requires a change.

Agents shall:

- Reuse existing layouts.
- Reuse existing components.
- Reuse current spacing, typography, colours, and visual patterns.
- Avoid redesigning pages without instruction.
- Avoid replacing the frontend framework unless formally approved.
- Avoid introducing a second competing design system.
- Avoid rewriting working pages merely for stylistic preference.

Before changing frontend structure:

1. Read `FRONTEND_AUDIT.md`.
2. Identify the existing framework and conventions.
3. Identify reusable components.
4. Make the smallest coherent change.
5. Confirm visual regression risk.

A technically cleaner redesign is not automatically an approved change.

### 4.1 Mandatory Frontend Design Governance

Whenever a task intentionally modifies the visual frontend UI, agents must strictly follow the repository governance rules specified here and detailed in [docs/UI_UX.md](file:///c:/Users/hugop/Documents/Web%20Monitoring/Kebun-Melon/docs/UI_UX.md).

#### Task-Level Frontend Declaration

For every future task involving visual frontend changes, the agent MUST explicitly declare before or during implementation:

```text
Frontend impact:
[NONE | MINOR | MATERIAL REDESIGN]

Selected UI direction:
<exactly one approved design direction>

Existing color template:
UNCHANGED

Selected motion effects:
<relevant subset of the 12 approved motion effects>

21st.dev MCP:
[REQUIRED | NOT REQUIRED]

Reason:
<short justification>
```

If `Frontend impact = NONE`, selecting a UI direction or motion set is not required.

#### Controlled List of 6 Approved UI Directions

When modifying UI, select exactly ONE primary direction from this controlled list:

1. `Premium Minimal Ops`
2. `Soft Bento Dashboard`
3. `Swiss Data Minimalism`
4. `Soft Glass Layers`
5. `Neo-Industrial Monitoring`
6. `Editorial Analytics`

Rules:
- Select the ONE primary direction that best suits the page/task.
- Do not arbitrarily combine multiple visual paradigms.
- Existing implemented pages do not need to be retroactively redesigned solely to satisfy this rule.

#### Color Governance (MANDATORY)

The existing Kebun Melon color template and design tokens are authoritative. Frontend work MUST NOT:
- replace the current palette;
- rebrand the application;
- introduce a competing primary color system;
- change the established color template merely because another design style was selected.

Selecting a UI direction changes visual/layout treatment, NOT the established brand color palette. Existing project color tokens must be reused wherever practical.

#### Controlled List of 12 Approved Motion Effects

When visual frontend work is performed, select only the relevant motion effects from this controlled list:

1. Page enter
2. Card hover
3. Button hover
4. Sidebar selection
5. Dropdown
6. Modal
7. KPI refresh
8. Chart loading
9. New event
10. Healthy status
11. Critical alert
12. Skeleton loading

All motion must be lightweight, subtle, performant, appropriate for an operations dashboard, non-distracting, accessible, and respect `prefers-reduced-motion`. Continuous expensive animations, excessive blur, or purely decorative movement are strictly forbidden.

#### 21st.dev MCP Governance

21st.dev MCP is **REQUIRED** before implementation when frontend work requires a `MATERIAL REDESIGN` (substantial page composition change, major dashboard layout, new component system, major visual UX restructuring).

21st.dev MCP is **NOT REQUIRED** for minor API wiring, data binding, text changes, small state indicators, small additions using existing components, or bug fixes that preserve the established layout.

#### TASK-0303 Governance Record

`TASK-0303` frontend implementation record:
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Skeleton loading`
- 21st.dev MCP: `NOT REQUIRED`

#### TASK-1004 Governance & Infrastructure Record

`TASK-1004` staging infrastructure and verification record:
- Frontend impact: `NONE`
- Provisioned Staging Hosting: Railway PaaS (`melon-monitor.up.railway.app` for `web`, `iot-gateway-production-7e17.up.railway.app` for `iot-gateway`)
- Provisioned Staging Database: Supabase PostgreSQL (`scqrbtfilmttqrutynyo`) via Supavisor Session Pooler (`aws-0-ap-south-1.pooler.supabase.com:6543`)
- Provisioned Staging MQTT Broker: EMQX Cloud Serverless (`wss://` TLS active, password-authenticated gateway service, per-device topic ACLs)
- Safety Configuration: `ENABLE_FAUCET_CONTROL=false` strictly enforced
- Verification Results: 11/12 flows verified (Flow 7 Language switch verified passing under Phase 6 `TASK-0604`; Flows 8-10 safely blocked by feature flag)

#### TASK-0408 Governance & Simulator Record

`TASK-0408` simulator implementation record:
- Frontend impact: `NONE`
- Entry Point: `npm run sim:device` (`scripts/device-simulator.ts`)
- Target Domains & Scenarios:
  - Soil Telemetry (`SOIL_NODE` via REST API over Wi-Fi)
  - Water Quality Telemetry (`WATER_QUALITY_NODE` via REST API over Wi-Fi: `ph`, `tds`, `ec`, `status`)
  - Reservoir Telemetry (`WATER_TANK_NODE` via MQTT 5.0 over TLS: `tankVolume`, `flowRate`, `status`)
  - Faucet Control Lifecycle (`WATER_TANK_NODE` via MQTT: `ACKNOWLEDGED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`)
  - Fault Simulation: Duplicate payload (`messageId`), out-of-order sequence, invalid JSON/schema, wrong-domain device ID rejection, disconnect/reconnect cycles
- Safety & Blocked Constraints:
  - Heartbeat & stale calculation remain blocked by `TASK-0407` (TBD numeric thresholds preserved)
  - Faucet command timeouts remain blocked by `TASK-0809` (TBD numeric duration preserved)
  - `BAT` parameter is omitted from soil and water-quality telemetry per `DEC-MON-086`
  - Direct browser-to-MQTT connections forbidden; browser uses backend REST/SSE boundaries

#### TASK-0504 Governance Record

`TASK-0504` historical monitoring charts & controls implementation record:
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Skeleton loading`, `Chart loading`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented bounded historical telemetry chart components (`NPKChart`, `WaterNutrientChart`, `HistoricalChartControls`) and data fetching hook (`useHistoricalMonitoring`) on canonical `/soil` and `/water` routes (legacy `/tanah` and `/air` return 404 Not Found). Enforced `DEC-MON-087` date-range bounds (default 24h, max 31 days) and raw pagination. Preserved null values as visual gaps (`connectNulls={false}`), supported empty history returns (HTTP 200 with empty series, no fake zero values or 404s), synchronized `DeviceSelector` context across routes, resolved canonical `deviceId` string and database UUID lookups, and formatted timestamps using Indonesian localization (`id-ID`). Verified 100% test pass rate across unit test suite (`apps/web/test/unit/historical-charts.test.tsx`), Playwright OWNER/ADMIN verification, and pre-commit suite.

#### TASK-0601 Governance Record

`TASK-0601` I18N infrastructure & configuration record:
- Frontend impact: `NONE`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Configured `next-intl` infrastructure in `@kebun-melon/web` per `DEC-I18N-068` with locales `id` (default) and `en` (fallback), non-prefixed cookie resolution (`locale`), server/client rendering support, bootstrap dictionaries (`messages/id.json`, `messages/en.json`), and safe missing key fallback handling. Created `i18n/request.ts` request configuration and centralized config (`lib/i18n/config.ts`). Verified 100% test pass rate on unit test suite (`apps/web/test/unit/i18n-config.test.ts`), `security-headers.test.ts`, web typecheck (`tsc --noEmit`), production build (`31/31` static pages), and Playwright non-credentialed browser smoke test on `/login`. Initial language gate UI and Settings switcher component belong to `TASK-0604` and are NOT implemented yet.

#### TASK-0602 Governance Record

`TASK-0602` translation namespaces implementation record:
- Frontend impact: `NONE`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Created all 17 approved translation namespaces (`common`, `auth`, `navigation`, `dashboard`, `devices`, `soil`, `water`, `history`, `faucet`, `alerts`, `users`, `approvals`, `profile`, `settings`, `validation`, `errors`, `accessibility`) across `apps/web/messages/id.json` and `apps/web/messages/en.json` while preserving TASK-0601 `system` infrastructure. Enforced 100% key parity, real non-empty strings, and identical ICU placeholders (`{time}`, `{count}`, `{volume}`, `{name}`, `{metric}`, `{message}`, `{deviceId}`, `{deviceName}`). Preserved technical abbreviations (`N`, `P`, `K`, `pH`, `EC`, `TDS`, `ESP32`, `NodeMCU`, `MQTT`, `API`, `RBAC`, `mL`, `L`, `°C`, `%`) untranslated and omitted `BAT` parameter per `DEC-MON-086`. Added targeted unit test suite (`apps/web/test/unit/i18n-namespaces.test.ts`) passing 7/7 tests. User manually executed and verified reserved pre-commit suite (`npm run check:quality`). Hard-coded component UI text replacement remains TASK-0603; language gate and settings UI selector belong to TASK-0604.

#### TASK-0603 Governance Record

`TASK-0603` hard-coded UI text replacement record:
- Status: `DONE` (Completed 2026-08-14)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Replaced hard-coded user-facing text across all authentication pages, protected dashboard and sensor views (`/`, `/sensor`, `/soil`, `/water`, `/controls`, `/devices`, `/users`, `/approvals`, `/pengaturan`, `/profil`, `/notifikasi`), historical charts (`NPKChart`, `WaterNutrientChart`, `HistoricalChartControls`), faucet control components, and shell navigation (`Sidebar`, `TopAppBar`, `DeviceSelector`) using `next-intl` translation hooks. Preserved 100% key parity across `messages/id.json` and `messages/en.json` with matching ICU placeholders. Preserved canonical internal API/DB/MQTT values, hardware names, raw measurement numbers, and units (`N`, `P`, `K`, `pH`, `EC`, `TDS`, `ESP32`, `NodeMCU`, `MQTT`, `mL`, `L`, `m³/h`, `ppm`, `µS/cm`). Preserved `BAT` parameter omission per `DEC-MON-086`. Verified 100% test pass rate across 15 targeted unit test suites (107/107 tests), TypeScript typecheck (`tsc --noEmit` 0 errors), Next.js production build (`31/31` static pages), Playwright browser verification on `/login` and `/register`, and verified user-reported completion of all 5 reserved pre-commit checks (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`). Initial language gate and settings UI switcher belong to `TASK-0604`.

#### TASK-0604 Governance Record

`TASK-0604` mandatory initial language gate & settings locale change flow record:
- Status: `DONE` (Completed 2026-08-14)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Summary: Implemented mandatory initial language gate (`Select Language / Pilih Bahasa`, English -> `en`, Bahasa Indonesia -> `id`) blocking unauthenticated access on `/login`, `/register`, `/forgot-password`, `/status` until a valid non-prefixed `locale` cookie is set. Implemented authenticated language modal selector exclusively on `/pengaturan` (`SettingsLocaleSwitcher`), backed by `PATCH /api/v1/me/preferences` with strict Zod schema validation (`UserPreferenceUpdateInputSchema`), `language.self.update` RBAC permission check, transactional persistence to `user_preferences` table with `profile.self.updated` audit logging, and immediate client-side `locale` cookie synchronization. Replaced inline select with accessible modal dialog adhering to `Premium Minimal Ops` (clear active indicator, localized error handling, preserved route & device context). Fixed presentation-layer system default device display labels (`Node Sensor Tanah` <-> `Soil Sensor Node`, `Node Kualitas Air` <-> `Water Quality Node`, `Node Tangki Air` <-> `Water Tank Node`) in `formatDeviceDisplayName` and `DeviceSelector` across `id` and `en` modes while preserving canonical device IDs, database records, deviceType enums, and user-custom device names. Responsive mobile selector centering and dropdown viewport bounding enforced across 360px, 390px, 430px, and desktop widths. Verified dynamic `<html lang>` attribute updates, device context and route preservation, canonical internal value stability, 100% test pass rate across 18 unit test suites (136/136 tests, including new `device-selector-localization.test.tsx`), 0 TypeScript errors, 32/32 static pages generated in Next.js production build, Playwright verification across desktop and mobile viewports with 0 console errors, and confirmed user pass across all 5 reserved pre-commit checks (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`).

---

## 5. Task Selection Rules

Use `TASKS.md` as the implementation backlog.

Before coding, state:

```text
Task ID:
Task title:
Dependencies:
Files expected to change:
Tests expected:
Known blockers:
```

Only start a task when:

- Its dependencies are complete.
- It is not marked `BLOCKED`.
- Required decisions are available.
- The implementation does not depend on an unresolved safety policy.

Tasks marked `BLOCKED` shall remain blocked.

Do not choose an assumption merely to remove a blocker.

When a task is too large, split it into coherent subtasks without changing its requirements.

---

## 6. Status Management

Allowed task statuses:

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

Do not mark a task `DONE` until:

- Implementation is complete.
- Tests are added.
- Tests pass.
- Security implications are reviewed.
- Documentation is updated.
- Acceptance criteria are met.
- No relevant unresolved assumption was invented.

---

## 7. General Coding Rules

Agents shall:

- Prefer small, reviewable changes.
- Follow existing repository conventions.
- Use strict typing.
- Validate external input at runtime.
- Keep domain logic outside visual components.
- Keep device communication outside the browser.
- Use canonical enum values.
- Preserve null and zero semantics.
- Add error handling.
- Add tests in the same change.
- Avoid unrelated refactoring.
- Avoid dead code.
- Avoid duplicated business logic.
- Document non-obvious security decisions.
- Keep secrets outside source control.

Agents shall not:

- Modify unrelated files.
- Replace libraries without justification.
- Add unnecessary dependencies.
- Invent sensor units.
- Invent thresholds.
- Invent hardware behaviour.
- Invent role permissions.
- Invent account lifecycle rules.
- Invent physical safety behaviour.
- Enable production physical control without explicit approval.

---

## 8. Canonical Internal Values

Internal values shall remain untranslated.

### Roles

```text
OWNER
ADMIN
```

### Account Statuses

```text
PENDING_APPROVAL
APPROVED
ACTIVE
REJECTED
SUSPENDED
DEACTIVATED
```

### Device Statuses

```text
ONLINE
OFFLINE
STALE
UNKNOWN
INACTIVE
```

### Monitoring Statuses

```text
NORMAL
WARNING
CRITICAL
UNKNOWN
UNAVAILABLE
INVALID
```

### Faucet Command Statuses

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

Do not store translated variants in:

- Database enums.
- API payloads.
- MQTT messages.
- Audit event keys.
- Permission keys.

Translations belong only in the presentation layer.

---

## 9. Authentication Rules

Agents working on authentication shall enforce:

- Only `ACTIVE` users may access protected functionality.
- Public registration creates only `ADMIN`.
- Public registration creates only `PENDING_APPROVAL`.
- Public registration must never create `OWNER`.
- Pending, rejected, suspended, and deactivated users cannot access protected pages.
- Account status is checked server-side.
- Passwords are securely hashed.
- Passwords and hashes are never logged.
- Sessions can be revoked.
- Logout invalidates the session.
- Suspension and deactivation invalidate access.
- Session fixation is prevented.
- Cookie sessions use secure attributes when applicable.

The first Owner must be created through the approved provisioning process, never through public registration.

---

## 10. RBAC Rules

Authorisation must be enforced on the server.

Hiding a button is not security.

Every protected operation shall validate:

1. Session.
2. Active account status.
3. Role.
4. Permission.
5. Target-resource access.
6. Device access where relevant.
7. Current resource state.

### Owner

The Owner may perform only the actions defined in `RBAC.md`.

### Admin

The Admin may:

- Manage only their own permitted profile fields.
- View assigned devices.
- View authorised monitoring.
- Use faucet control only when explicitly granted.

The Admin shall not:

- View another user's private profile.
- Edit another user.
- Approve or reject an account.
- Suspend or deactivate another user.
- Change their own role.
- Change their own account status.
- Assign devices.
- Self-grant control access.

Object-level authorisation must protect:

```text
userId
deviceId
alertId
commandId
auditId
```

---

## 11. Device Access Rules

Every device-specific action must verify access to the exact target device.

Device assignment is mandatory for Admin access. Admins cannot view or control unassigned devices.

Active device assignment grants both telemetry monitoring and faucet-control capabilities for active Admin users on active, controllable devices:

```text
Active ADMIN
+ assigned device access
+ active and controllable device
= faucet-control permission
```

Separate per-user-device `canControl` permission grants are not used.

Owners manage device assignments. Admins may not assign devices to themselves or other users.

Agents shall prevent access through:

- URL manipulation.
- Request-body manipulation.
- Query-parameter manipulation.
- Direct API calls.
- Stale browser state.
- Changed device ID.
- Reused data from another session.

When device access is revoked:

- New API requests must fail.
- Live updates must stop.
- Control must fail.
- Cached frontend access must not remain authoritative.
- The change must be audited.

---

## 12. Frontend Rules

Frontend code shall:

- Render server-authorised data.
- Support loading, empty, success, error, stale, offline, invalid, and unavailable states.
- Preserve the selected device consistently.
- Clear or distinguish previous device data during device switching.
- Not show stale values as current.
- Not show missing values as zero.
- Not infer permission from UI state alone.
- Not store device or MQTT secrets.
- Not publish directly to MQTT.
- Not claim physical completion without a confirmed final device event.

Frontend components shall use existing design patterns whenever available.

---

## 13. Internationalisation Rules

The application supports:

```text
en
id
```

Agents shall:

- Use translation keys for all user-facing text.
- Translate accessibility labels.
- Preserve canonical internal values.
- Persist locale according to `I18N.md`.
- Keep language changes independent from role, permission, device, and timezone.
- Test longer Indonesian labels.
- Update the HTML `lang` attribute.
- Use fallback behaviour.
- Prevent raw translation keys from appearing.

Do not translate:

- Device IDs.
- API field names.
- MQTT topics.
- Database fields.
- Audit event keys.
- pH, EC, TDS, N, P, K, ESP32, NodeMCU, MQTT, API, RBAC.
- Raw sensor values.
- Canonical statuses.

---

## 14. API Rules

API implementation shall follow `API.md`.

Required characteristics:

- Versioned routes.
- JSON payloads.
- Stable response envelopes.
- Stable error codes.
- ISO 8601 timestamps.
- Server-side validation.
- Server-side RBAC.
- Device-level access.
- Bounded pagination.
- Allowlisted filters and sort fields.
- Mass-assignment protection.
- Request correlation IDs.
- Safe error messages.
- Idempotency for faucet commands.

The API shall not expose:

- Password hashes.
- Session tokens.
- Device secrets.
- MQTT credentials.
- Private keys.
- Internal stack traces.
- Raw database errors.

---

## 15. Database Rules

Database changes shall follow `DATABASE.md`.

Agents shall:

- Use versioned migrations.
- Preserve foreign-key integrity.
- Add required indexes.
- Add unique constraints.
- Add check constraints.
- Keep telemetry append-oriented.
- Preserve audit history.
- Distinguish null from zero.
- Store timestamps as timezone-aware values.
- Use transactions for high-risk state changes.
- Avoid core domain data in unstructured JSON when typed columns are appropriate.

Do not hard-delete:

- Audit records.
- Faucet command history.
- Approval history.
- Users or devices when deactivation is sufficient.

Use raw SQL migrations when the ORM cannot express required PostgreSQL features safely.

---

## 16. Telemetry Rules

Telemetry processing shall:

1. Parse the topic.
2. Validate device identity.
3. Validate the payload.
4. Validate schema version.
5. Verify topic and payload device match.
6. Detect duplicate message IDs.
7. Preserve device and server timestamps.
8. Store valid values.
9. Update last-seen state.
10. Emit live updates after persistence.
11. Record operational metrics.

Agents shall preserve:

- Valid zero as `0`.
- Unavailable values as `null`.
- Missing optional capabilities as absent.
- Invalid values as invalid, not fabricated.
- `recordedAt` and `receivedAt` separately.

Do not invent:

- Sensor units.
- Sensor precision.
- Agronomic status thresholds.
- Water-quality thresholds.
- Calibration logic.

---

## 17. MQTT and IoT Gateway Rules

The browser shall never connect directly to MQTT.

The gateway shall be a long-running backend service.

Recommended protocol:

```text
MQTT 5.0 over TLS
```

The gateway shall:

- Authenticate to the broker.
- Subscribe only to required topics.
- Validate every message.
- Normalise device data.
- Store telemetry.
- Publish commands.
- Process acknowledgements.
- Track command states.
- Reject device/topic mismatches.
- Handle reconnects safely.
- Expose health and readiness.
- Redact secrets.

Faucet commands shall never be retained.

Each device shall have isolated topic permissions.

One device must not publish as or subscribe to another device.

---

## 18. Faucet-Control Rules

Faucet control is a high-risk physical action.

Agents shall not implement or enable control until the permission policy is approved.

### Approved Presets

```text
Phase 1 → 300 mL
Phase 2 → 1,000 mL
Phase 3 → 1,500 mL
```

The browser sends the phase.

The server maps the phase to target volume.

The browser must not be authoritative for the volume.

### Required Command Checks

Before command creation:

1. Authenticate user.
2. Verify active account.
3. Verify control permission.
4. Verify device access.
5. Verify device control capability.
6. Verify device active state.
7. Verify device online or controllable state.
8. Validate phase.
9. Check active-command conflict.
10. Check idempotency.
11. Persist command.
12. Publish only after durable persistence.

### Command Safety

Every command shall have:

```text
commandId
idempotencyKey
deviceId
phase
targetVolumeMl
requestedAt
expiresAt
```

Duplicate requests must not cause duplicate physical execution.

A command shall not be marked `COMPLETED` because it was:

- Accepted by the API.
- Stored.
- Published.
- Delivered.
- Acknowledged.

Completion requires the approved final device event.

A timeout must remain distinct from failure and completion.

When physical state is unknown, say it is unknown.

Do not implement blind automatic retries for physical commands.

---

## 19. Security Rules

Agents shall follow `SECURITY.md`.

Mandatory controls include:

- HTTPS in production.
- MQTT over TLS in production.
- Password hashing.
- Secure session handling.
- CSRF protection where required.
- CORS allowlist.
- Content Security Policy.
- Input validation.
- Rate limiting.
- Secret management.
- Topic ACLs.
- Device credential isolation.
- Audit logging.
- Security headers.
- Dependency scanning.
- Secret scanning.
- Safe logging.

Never create custom cryptography.

Never commit secrets.

Never store secrets in frontend code or local storage.

---

## 20. Testing Rules

Every implementation change must include relevant tests.

Use `TESTING.md` as the test authority.

Minimum expected test layers:

### Business Logic

- Unit tests.

### API or Database Change

- Integration tests.

### User Flow

- End-to-end test when feasible.

### Security-Sensitive Change

- Negative permission and manipulation tests.

### MQTT or Device Change

- Contract and integration tests.

### Faucet Control

- Idempotency, duplicate, expiry, timeout, and state-transition tests.

### I18N

- English and Indonesian tests.

A defect fix should include a regression test.

Do not remove failing tests merely to make CI pass.

---

## 21. Required Negative Tests

Agents must actively test what users are not allowed to do.

Examples:

- Pending Admin opens protected route.
- Admin approves another user.
- Admin edits another profile.
- Admin changes their own role.
- Admin changes their own status.
- Admin accesses an unassigned device.
- View-only Admin sends faucet command.
- User changes device ID in URL.
- Duplicate command is submitted.
- Expired command is delivered.
- Device publishes to another device topic.
- Missing telemetry is converted to zero.
- Language switch changes permission.

Negative tests are mandatory for security-critical features.

---

## 22. Logging and Audit Rules

High-risk actions shall produce audit events.

Required categories include:

- Registration.
- Approval.
- Rejection.
- Suspension.
- Deactivation.
- Profile updates.
- Device assignment.
- Device revocation.
- Login success and failure.
- Faucet command creation.
- Faucet command state changes.
- Alert acknowledgement.
- High-risk authorisation denial.

Logs and audit records shall not contain:

- Passwords.
- Password hashes.
- Session tokens.
- Reset tokens.
- Device passwords.
- Private keys.
- Broker administrator credentials.

Use structured logs and correlation identifiers.

---

## 23. Error Handling Rules

Errors shall be:

- Safe.
- Stable.
- Machine-readable.
- Translatable.
- Actionable where possible.

Do not expose:

- Stack traces.
- SQL details.
- Broker internals.
- Secret values.
- Private object existence where concealment is required.

Use appropriate distinctions:

```text
401 → unauthenticated
403 → authenticated but forbidden
404 → not found or concealed
409 → conflicting state
422 → domain validation
503 → dependency unavailable
```

---

## 24. Dependency Rules

Before adding a dependency:

1. Confirm the existing stack does not already provide the capability.
2. Verify maintenance status.
3. Review security history.
4. Confirm licence compatibility.
5. Prefer established libraries.
6. Avoid adding large libraries for trivial functionality.
7. Add the dependency to the correct package only.
8. Update lock files.
9. Add tests.

Do not add competing libraries for:

- Forms.
- Validation.
- Charts.
- Date handling.
- I18N.
- State management.

unless the change is explicitly approved.

---

## 25. Migration Rules

For database migrations:

- Make migrations versioned.
- Test from an empty database.
- Test from the previous schema.
- Avoid destructive changes without a backup plan.
- Consider locks on telemetry tables.
- Preserve backwards compatibility where possible.
- Document manual recovery steps.
- Never modify production schema manually during normal work.

For repository migrations:

- Preserve history where practical.
- Avoid broad file moves mixed with feature changes.
- Verify build before and after.

---

## 26. High-Risk Files and Areas

Changes in these areas require extra review:

```text
Authentication configuration
Session handling
RBAC helpers
User approval services
Device access services
MQTT broker configuration
Gateway command publisher
Command state machine
Idempotency logic
Database migrations
Secrets configuration
Production deployment
Backup and restore
```

Agents must call out these files explicitly in the final report.

---

## 27. Mandatory Human Review

Human review is required for:

- First Owner provisioning.
- Session architecture.
- Role or permission changes.
- Device assignment logic.
- Production MQTT credentials and ACLs.
- Faucet command API.
- Gateway command publishing.
- Command acknowledgement.
- Command state transitions.
- Duplicate-command protection.
- Timeout handling.
- Cancellation or stop.
- Production database migration.
- Backup and restore.
- Production physical-control enablement.

An agent must not bypass human review because tests pass.

---

## 28. Hard Stops

Stop implementation and report a blocker when:

- A task is marked `BLOCKED`.
- A required policy is `TBD`.
- A change could enable unauthorised physical control.
- Sensor units are required but unknown.
- `BAT` (Battery) parameter meaning or units are required but unknown.
- The Owner/Admin control matrix is unresolved.
- Command concurrency is unresolved and implementation depends on it.
- Timeout behaviour is unresolved and implementation depends on it.
- Hardware acknowledgement semantics are unclear.
- The task requires production credentials.
- The task requires irreversible production changes.
- Documents conflict materially.
- Existing code differs significantly from `FRONTEND_AUDIT.md`.

Do not guess.

---

## 29. Safe Defaults

When a non-blocking implementation detail is unresolved, prefer:

- Deny access.
- Disable physical control.
- Treat device state as unknown.
- Treat data as unavailable.
- Preserve historical records.
- Avoid automatic retry.
- Avoid exposing resource existence.
- Use canonical values.
- Use explicit validation.
- Keep feature behind configuration or feature flag.

Safe defaults must not replace decisions marked as mandatory blockers.

---

## 30. Feature Flags

High-risk incomplete features should be protected by feature flags.

Recommended flags:

```text
ENABLE_FAUCET_CONTROL
ENABLE_FAUCET_CANCEL
ENABLE_FAUCET_STOP
ENABLE_DEVICE_PROVISIONING
ENABLE_AUDIT_EXPORT
ENABLE_MONITORING_EXPORT
```

Production defaults should remain disabled until approved.

Feature flags shall not replace server-side authorisation.

---

## 31. Agent Work Procedure

For every task:

### Step 1 — Read

Read:

- `AGENTS.md`.
- Relevant task in `TASKS.md`.
- Related authoritative specifications.
- Existing code in affected modules.

### Step 2 — Inspect

Identify:

- Existing patterns.
- Existing tests.
- Existing utilities.
- Relevant database models.
- Relevant API handlers.
- Security boundaries.
- Potential regressions.

### Step 3 — Plan

Write a concise plan containing:

```text
Task IDs
Files to modify
Data changes
API changes
Security checks
Tests
Documentation updates
```

### Step 4 — Implement

- Make the smallest coherent change.
- Follow existing conventions.
- Keep business logic testable.
- Add runtime validation.
- Avoid unrelated refactoring.

### Step 5 — Test

Run the narrowest relevant tests first, then broader tests.

Recommended order:

1. Unit tests.
2. Type check.
3. Lint.
4. Integration tests.
5. E2E tests.
6. Build.

### Step 6 — Review

Check:

- Requirements.
- Security.
- RBAC.
- Device scope.
- I18N.
- Null handling.
- Error handling.
- Audit.
- Tests.

### Step 7 — Report

Provide the required completion report.

---

## 32. Required Completion Report

At the end of work, report:

```text
Implemented task IDs:
Summary:
Files changed:
Database migrations:
API changes:
Security considerations:
Tests added:
Tests run:
Test results:
Documentation updated:
Known limitations:
Remaining blockers:
Suggested next task:
```

Do not claim tests passed unless they were actually run.

Do not claim a feature is complete when a blocker remains.

---

## 33. Commit Guidance

Recommended commit format:

```text
type(scope): summary
```

Examples:

```text
feat(auth): add pending admin registration
feat(rbac): enforce device-level access
feat(gateway): validate soil telemetry
fix(control): prevent duplicate faucet commands
test(auth): cover suspended account access
docs(api): document approval endpoints
```

Keep security-critical changes in focused commits.

Do not mix broad formatting changes with functional changes.

---

## 34. Pull Request Guidance

A pull request should include:

- Task IDs.
- Requirement references.
- Summary.
- Screenshots for UI changes.
- API examples for contract changes.
- Migration notes.
- Security analysis.
- Test results.
- Rollback considerations.
- Remaining `TBD` items.

High-risk pull requests shall identify required human reviewers.

---

## 35. Code Review Checklist

Reviewers and agents shall verify:

### Requirements

- Does the change match the authoritative documents?
- Was a `TBD` invented?

### Security

- Is authentication required?
- Is account status checked?
- Is permission checked?
- Is resource access checked?
- Is device access checked?
- Are inputs validated?
- Are secrets protected?

### Data

- Are zero and null distinct?
- Are timestamps correct?
- Are canonical values used?
- Are transactions required?
- Are indexes needed?

### Frontend

- Is the existing design preserved?
- Are all UI states present?
- Is text translated?
- Is accessibility considered?

### Device Control

- Is the command durable?
- Is idempotency enforced?
- Is expiry enforced?
- Is completion confirmed correctly?
- Could the change trigger duplicate physical execution?

### Tests

- Are positive and negative tests included?
- Are regressions covered?
- Were tests actually run?

---

## 36. Documentation Update Rules

Update documentation when:

- An open decision is resolved.
- An API changes.
- A database schema changes.
- A permission changes.
- A command state changes.
- A device payload changes.
- A new error code is introduced.
- A new dependency changes architecture.
- A security control changes.
- A task is completed or split.

Do not let implementation become the only source of truth.

---

## 37. Definition of Done

A change is complete only when:

### Functional

- The requested behaviour works.
- Alternative and error states work.
- No fabricated values appear.
- Existing functionality remains stable.

### Security

- Authentication and authorisation are enforced.
- Device scope is enforced.
- High-risk actions are audited.
- Secrets are protected.

### Internationalisation

- English and Indonesian are supported.
- Accessibility labels are localised.
- Canonical values remain untranslated.

### Testing

- Tests are added.
- Tests pass.
- Negative paths are tested.
- Build passes.

### Documentation

- Relevant documents are updated.
- Blockers and limitations are reported.
- Task status is accurate.

---

## 38. Project-Specific Prohibitions

Agents shall never:

- Create an Owner through public registration.
- Allow a pending Admin into protected pages.
- Allow Admins to manage other users.
- Trust a browser-supplied role.
- Trust a browser-supplied account status.
- Trust a browser-supplied target volume.
- Expose MQTT credentials to the browser.
- Retain faucet commands in MQTT.
- Mark a command completed without final confirmation.
- Treat timeout as completion.
- Retry a physical command blindly.
- Convert missing telemetry into zero.
- Translate API or database enum values.
- Enable production control before approval.
- Commit secrets.
- Remove audit history to simplify development.
- Use frontend visibility as the only security control.

---

## 39. Recommended First Agent Prompt

Use this prompt after placing all specification files in the repository:

```text
Read AGENTS.md and all project documentation referenced by the selected task.

Start with TASK-0001 only: Confirm Existing Frontend Technology.

Do not modify application behaviour yet.

Inspect the current repository and update FRONTEND_AUDIT.md with:

- Framework and version
- Build tool
- Routing
- Styling
- Component libraries
- State management
- Authentication code
- API integration
- Chart and map libraries
- Project structure
- Reusable components
- Existing technical debt
- Security concerns
- Files that must be preserved
- Conflicts with the proposed architecture

Then report:

- Files inspected
- Findings
- Documentation changes
- Blockers
- Recommended next READY task

Do not start another task.
```

---

## 40. Recommended Prompt After Frontend Audit

After `TASK-0001` is complete and the architecture decisions are reviewed:

```text
Read AGENTS.md, TASKS.md, FRONTEND_AUDIT.md, ARCHITECTURE.md, DATABASE.md, SECURITY.md, and TESTING.md.

Implement only the next READY foundation task whose dependencies are complete.

Before coding, report:

- Task ID
- Task title
- Dependencies
- Files expected to change
- Tests expected
- Known blockers

Do not implement any BLOCKED task.
Do not enable faucet control.
Preserve the existing frontend design.
Add tests with the implementation.
At completion, use the reporting format required by AGENTS.md.
```

---

## 41. Current Documentation Checklist

Expected project documentation:

```text
docs/FRONTEND_AUDIT.md
docs/UI_UX.md
docs/PRD.md
docs/RBAC.md
docs/USER_FLOWS.md
docs/I18N.md
docs/DEVICE_COMMUNICATION.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API.md
docs/SECURITY.md
docs/TESTING.md
TASKS.md
AGENTS.md
README.md
```

Do not start full implementation if these files are missing from the working repository unless the task specifically concerns restoring the documentation set.

---

## 42. Current Known Blockers

The following remain unresolved unless newer project documentation says otherwise:

1. Existing frontend framework confirmation.
2. Authentication library and session strategy.
3. First Owner provisioning.
4. Whether `APPROVED` and `ACTIVE` remain separate.
5. Multiple Owner policy.
6. Owner device scope.
7. Owner faucet-control permission.
8. Admin faucet-control permission.
9. Control permission assignment model.
10. Concurrent command policy.
11. Cancel and stop support.
12. Command timeout values.
13. Late-event reconciliation.
14. Final MQTT broker.
15. Device authentication method.
16. Telemetry units.
17. ~~`Water BAT` meaning.~~ **RESOLVED** — `BAT` stands for Battery, incorporated into soil and water quality sensors (`DEC-MON-085`).
18. Telemetry interval.
19. Offline threshold.
20. Stale threshold.
21. Default and fallback locale.
22. Realtime transport.
23. Hosting.
24. Backup objectives.
25. Performance targets.
26. Hardware dispensing tolerance.

Agents shall check whether these blockers have been resolved in newer documentation before assuming they still apply.

---

## 43. Final Instruction

Implement carefully, incrementally, and transparently.

For this project, correctness and safety are more important than speed.

When uncertain:

```text
Stop.
Identify the exact conflict or missing decision.
Report the affected task and requirement.
Do not invent the answer.
```
