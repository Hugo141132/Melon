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
| Phase 1 | 300 mL (UI 0.3 L) |
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

#### TASK-0214 Governance Record

`TASK-0214` email verification code redesign and reliability audit record:
- Status: `DONE` (Completed 2026-08-22)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Skeleton loading`, `Modal`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Redesigned email verification into a secure 6-digit numeric verification code flow (`{ email, code }` with 15-minute expiry and `sha256(userId:code)` database token hashing). Audited Resend email service and added exponential backoff retry with jitter (up to 3 attempts) for HTTP 429 rate limits, 5xx server errors, and network timeouts while keeping tokens redacted from logs. Updated verification email HTML/plain text templates with prominent monospace code box and security instructions. Implemented `/verify-email` UI with 6-digit code input, target email display and switcher, and 60-second resend cooldown timer persisted via `sessionStorage`. Removed decorative illustration frame and unused `Image` import from `/reset-password` conforming strictly to `Premium Minimal Ops`. Preserved backward-compatible legacy token auto-verification. Verified 100% test pass rate across 31 unit test suites (255/255 tests) and TypeScript typecheck (0 errors across 4 monorepo workspaces).

#### TASK-0215 Governance Record

`TASK-0215` centralized authentication state hydration record:
- Status: `DONE` (Completed 2026-08-22)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented centralized authentication state hydration to eliminate delayed UI rendering and layout shifts across navigation and protected pages. Added React `AuthContext` (`AuthProvider` / `useAuth()`) in `@kebun-melon/web`, providing unified access to `{ user, role, isAuthenticated }`. Implemented `getSessionOrNull()` server helper in `lib/auth/rbac.ts` for safe, non-throwing session retrieval in the root layout (`RootLayout`) during SSR. Eliminated redundant client-side `useEffect` and `fetch('/api/v1/auth/session')` calls from `/`, `/setting`, `/profileee`, `TopAppBar`, and `Sidebar`. Refactored `Sidebar` and `TopAppBar` to consume `useAuth()` directly, removing unnecessary prop drilling. Refactored `/setting` and `/profileee` to instantaneously render user profileee identity and role-conditional menu items (`/users` and `/approvals` for `OWNER`) without loading spinners. Maintained strict server-side RBAC and route protection. Verified 100% test pass rate across 35 unit test suites (260/260 tests) and 14 E2E critical flows.

#### TASK-0302 Governance Record


`TASK-0302` device registry reconciliation record:
- Status: `DONE` (Completed 2026-08-23)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Modal`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Reconciled device registry per `DEC-DEV-027`, `DEC-DEV-028`, and `DEC-DEV-030`. Removed all in-app and API device creation (`POST /api/v1/devices`, "Add Device" button/modal, `device.create` permission, `CreateDeviceInputSchema`). Preserved existing pre-provisioned devices (`soil-node-001`, `water-quality-node-001`, and `water-tank-node-zi37gz`) immediately visible to Owner by default. Permanently removed hard device deletion (`DELETE /api/v1/devices/{deviceId}` and delete UI modal removed per `DEC-DEV-030`), preserving all historical relational telemetry, alerts, and audit logs. Implemented `POST /api/v1/devices/{deviceId}/activate` and `POST /api/v1/devices/{deviceId}/deactivate` backed by `activateDevice` and `deactivateDevice` in `DeviceRepository` with `device.activate` and `device.deactivate` Owner permissions. Kept internal database primary key UUID (`devices.id`) strictly immutable, preserving all relational foreign key references (`user_device_access`, telemetry, commands, alerts) across renames. Supported Owner-only external canonical `deviceId` string and `name` updates via `PATCH /api/v1/devices/{deviceId}` with duplicate rejection (`DeviceConflictError` -> HTTP 409 `DUPLICATE_DEVICE_ID`). Enforced strict Admin canonical `deviceId` concealment across `GET /api/v1/devices`, `GET /api/v1/devices/{deviceId}`, and `/devices` UI cards. Documented physical ESP32/NodeMCU firmware reconfiguration and EMQX broker credential/ACL synchronization following a rename as `TBD / BLOCKING` operational automation. Verified 100% test pass rate across unit test suites (`device-repository.test.ts` 12/12, `route.test.ts` 24/24), TypeScript typecheck (0 errors), Next.js build (37/37 routes), and pre-commit quality checks.

#### TASK-0303 Governance Record

`TASK-0303` frontend implementation record:
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Skeleton loading`
- 21st.dev MCP: `NOT REQUIRED`

#### TASK-0305 Governance Record

`TASK-0305` authorised device list reconciliation record:
- Status: `DONE` (Verified & Reconciled 2026-08-18)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Reconciled and verified authorized device listing and detail endpoints (`GET /api/v1/devices`, `GET /api/v1/devices/{deviceId}`). Verified Owner global access scope returning full safe DTO with canonical `deviceId`, and Admin strictly scoped to active assignments (`revokedAt === null`) with canonical `deviceId` strictly concealed per `DEC-DEV-028` while retaining safe immutable database UUID `id`. Verified dynamic `permissions` DTO (`canView`, `canControl`) dynamically evaluated using RBAC, active account status, device capabilities, and `ENABLE_FAUCET_CONTROL` feature flag. Hardened baseline permission check (`requirePermission(session, 'device.read')`) and active account enforcement on device detail route prior to DB lookup, eliminating device-existence leakage. Verified IDOR/BOLA prevention on unassigned devices, UUID/canonical ID manipulation attempts, unauthenticated requests (401), non-active accounts (403), and invalid pagination (422). Executed focused query and execution plan review via Supabase MCP on staging DB: confirmed index-only scan on `user_device_access_active_user_device_unique` for Admin assignment filtering, index scans on `devices_pkey` and `device_capabilities_device_id_capability_key`, zero N+1 queries, zero database performance regression, and zero index/schema alterations required. Preserved immutable database UUID `devices.id` and all relational foreign key histories. Verified 100% test pass rate across targeted test suites (24/24 route tests, 34/34 database/contracts/device tests, 58/58 combined), Semgrep scan (0 findings), and TypeScript typecheck (0 errors). Confirmed no device creation path reintroduced (`POST /api/v1/devices` remains removed per `DEC-DEV-027`), TASK-0306 last-accessed persistence behavior remains outside scope, and physical ESP32/EMQX rename reconciliation remains `TBD / BLOCKING`.

#### TASK-0306 Governance Record

`TASK-0306` device selector state reconciliation record:
- Status: `DONE` (Reconciled 2026-08-18)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Dropdown`, `Modal`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Reconciled device selector and context state per `DEC-DEV-028` and `DEC-DEV-029`. Enforced neutral initial state (`selectedDevice = null`) on fresh login and bare routes (`/`, `/sensor`, `/soil` without `?deviceId=`), eliminating all automatic first-device fallbacks. Removed persistent restoration from `localStorage`, `sessionStorage`, cookies, and profileee preferences (`DEC-DEV-029`). Restricted device selection strictly to explicit user action in the `/sensor` device cards or header `DeviceSelector`. Preserved active in-memory selection during client navigation and synchronized selection with route URL (`?deviceId=...`). Supported route-scoped rehydration on hard refresh (Ctrl+Shift+R) after validating against the fresh `GET /api/v1/devices` server-authorized list. Handled loading skeleton states vs true empty lists on `/sensor`. Cleared selection to `null` with a notice banner if access to the selected device is revoked, unassigned, or invalid without silent fallback. Preserved canonical `deviceId` monospace rendering for Owner users and strict concealment for Admin users (`DEC-DEV-028`). Verified 100% test pass rate across 31 test suites (239/239 tests), TypeScript typecheck (0 errors), and Semgrep scan (0 findings).

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
- Status: `DONE` (Reconciled 2026-08-19)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Skeleton loading`, `Chart loading`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented bounded historical telemetry chart components (`NPKChart`, `WaterNutrientChart`, `HistoricalChartControls`) and data fetching hook (`useHistoricalMonitoring`) on canonical `/soil` and `/water` routes (legacy `/tanah` and `/air` return 404 Not Found). Enforced `DEC-MON-087` date-range bounds (default 24h, max 31 days) and raw pagination. Preserved null values as visual gaps (`connectNulls={false}`), supported empty history returns (HTTP 200 with empty series, no fake zero values or 404s), synchronized `DeviceSelector` context across routes, resolved canonical `deviceId` string and database UUID lookups, and formatted timestamps using Indonesian localization (`id-ID`).
- 2026-08-19 Monitoring Reconciliation: Fixed monitoring 404 regression (`GET /api/v1/devices/{deviceId}/monitoring/latest`, `.../soil/history`, `.../water/history`). Ensured frontend consistently transmits immutable database UUID `devices.id` in `activeDeviceId` and `selectedDevice`. Hardened backend route handlers, RBAC checks (`requireDeviceViewAccess`), and database repositories (`DeviceRepository`, `TelemetryRepository`) to seamlessly resolve both UUIDs and canonical `deviceId` strings. Verified zero-record queries return HTTP 200 `{ series: [] }` without false 404s. Preserved strict Admin canonical `deviceId` concealment (`DEC-DEV-028`). Added comprehensive unit tests in `@kebun-melon/database` and `@kebun-melon/web` route suites with 100% pass rate. Diagnosed intermittent dev-server restart Next.js HTML 404 as Windows zombie background process holding port 3000 upon Ctrl+C. Completed authenticated browser manual runtime verification across `/soil`, `/water`, `/sensor`, and `/controls`.

#### TASK-0502 Governance Record

`TASK-0502` live soil and water monitoring UI data binding & telemetry freshness record:
- Status: `DONE` (Reconciled & Audited 2026-08-23)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Skeleton loading`, `Card hover`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Reconciled real telemetry data binding across `/soil` and `/water` routes. Unified all 7 soil telemetry parameters (Nitrogen, Phosphorus, Potassium, Temperature, Moisture, pH, EC) into the single approved `SoilMetricMeter` visual card design. Reconciled parameter titles in Indonesian and English dictionaries (`messages/id.json`, `messages/en.json`) to remove redundant "Soil" / "Tanah" prefixes (`Nitrogen`, `Fosfor` / `Phosphorus`, `Kalium` / `Potassium`, `Suhu` / `Temperature`, `Kelembapan` / `Moisture`, `pH`, `EC`). Bound agreed units: NPK (`mg/kg`), pH (*no unit*), Moisture (`%RH`), Temperature (`°C`), EC (`µS/cm`), TDS (`ppm`). Completely removed fallback mock datasets (`NPK_TREND_DATA`, `EC_TREND_DATA`) from charts (`NPKChart`, `WaterNutrientChart`), ensuring empty series cleanly render empty notices (`Tidak ada data riwayat untuk rentang waktu ini.`) without fake graph lines. Enforced stale telemetry suppression: when telemetry is stale (`isStale: true` or `connectionStatus: STALE`), numerical sensor values are suppressed and rendered as `'-'` with `0%` gauge fills, active status quotes are hidden, and the prominent Stale Alert Banner (`Update: Real-Time: Kedaluwarsa`) is displayed while preserving `lastSeenAt`/`recordedAt` timestamps. Restored homepage (`/`) overview isolation by removing embedded `MonitoringDashboard`. Verified 100% test pass rate across 33 unit test files (251/251 tests) and TypeScript typecheck (0 errors).

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
- Summary: Created all 17 approved translation namespaces (`common`, `auth`, `navigation`, `dashboard`, `devices`, `soil`, `water`, `history`, `faucet`, `alerts`, `users`, `approvals`, `profileee`, `settings`, `validation`, `errors`, `accessibility`) across `apps/web/messages/id.json` and `apps/web/messages/en.json` while preserving TASK-0601 `system` infrastructure. Enforced 100% key parity, real non-empty strings, and identical ICU placeholders (`{time}`, `{count}`, `{volume}`, `{name}`, `{metric}`, `{message}`, `{deviceId}`, `{deviceName}`). Preserved technical abbreviations (`N`, `P`, `K`, `pH`, `EC`, `TDS`, `ESP32`, `NodeMCU`, `MQTT`, `API`, `RBAC`, `mL`, `L`, `°C`, `%`) untranslated and omitted `BAT` parameter per `DEC-MON-086`. Added targeted unit test suite (`apps/web/test/unit/i18n-namespaces.test.ts`) passing 7/7 tests. User manually executed and verified reserved pre-commit suite (`npm run check:quality`). Hard-coded component UI text replacement remains TASK-0603; language gate and settings UI selector belong to TASK-0604.

#### TASK-0603 Governance Record

`TASK-0603` hard-coded UI text replacement record:
- Status: `DONE` (Completed 2026-08-14)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Replaced hard-coded user-facing text across all authentication pages, protected dashboard and sensor views (`/`, `/sensor`, `/soil`, `/water`, `/controls`, `/devices`, `/users`, `/approvals`, `/setting`, `/profileee`, `/notifikasi`), historical charts (`NPKChart`, `WaterNutrientChart`, `HistoricalChartControls`), faucet control components, and shell navigation (`Sidebar`, `TopAppBar`, `DeviceSelector`) using `next-intl` translation hooks. Preserved 100% key parity across `messages/id.json` and `messages/en.json` with matching ICU placeholders. Preserved canonical internal API/DB/MQTT values, hardware names, raw measurement numbers, and units (`N`, `P`, `K`, `pH`, `EC`, `TDS`, `ESP32`, `NodeMCU`, `MQTT`, `mL`, `L`, `m³/h`, `ppm`, `µS/cm`). Preserved `BAT` parameter omission per `DEC-MON-086`. Verified 100% test pass rate across 15 targeted unit test suites (107/107 tests), TypeScript typecheck (`tsc --noEmit` 0 errors), Next.js production build (`31/31` static pages), Playwright browser verification on `/login` and `/register`, and verified user-reported completion of all 5 reserved pre-commit checks (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`). Initial language gate and settings UI switcher belong to `TASK-0604`.

#### TASK-0604 Governance Record

`TASK-0604` mandatory initial language gate & settings locale change flow record:
- Status: `DONE` (Completed 2026-08-14)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Summary: Implemented mandatory initial language gate (`Select Language / Pilih Bahasa`, English -> `en`, Bahasa Indonesia -> `id`) blocking unauthenticated access on `/login`, `/register`, `/forgot-password`, `/status` until a valid non-prefixed `locale` cookie is set. Implemented authenticated language modal selector exclusively on `/setting` (`SettingsLocaleSwitcher`), backed by `PATCH /api/v1/me/preferences` with strict Zod schema validation (`UserPreferenceUpdateInputSchema`), `language.self.update` RBAC permission check, transactional persistence to `user_preferences` table with `profileee.self.updated` audit logging, and immediate client-side `locale` cookie synchronization. Replaced inline select with accessible modal dialog adhering to `Premium Minimal Ops` (clear active indicator, localized error handling, preserved route & device context). Fixed presentation-layer system default device display labels (`Node Sensor Tanah` <-> `Soil Sensor Node`, `Node Kualitas Air` <-> `Water Quality Node`, `Node Tangki Air` <-> `Water Tank Node`) in `formatDeviceDisplayName` and `DeviceSelector` across `id` and `en` modes while preserving canonical device IDs, database records, deviceType enums, and user-custom device names. Responsive mobile selector centering and dropdown viewport bounding enforced across 360px, 390px, 430px, and desktop widths. Verified dynamic `<html lang>` attribute updates, device context and route preservation, canonical internal value stability, 100% test pass rate across 18 unit test suites (136/136 tests, including new `device-selector-localization.test.tsx`), 0 TypeScript errors, 32/32 static pages generated in Next.js production build, Playwright verification across desktop and mobile viewports with 0 console errors, and confirmed user pass across all 5 reserved pre-commit checks (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`).

#### TASK-0703 Governance Record

`TASK-0703` command failure and timeout alerts implementation record:
- Status: `DONE` (Completed 2026-08-14)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented physical faucet command failure (`COMMAND_FAILED`) and timeout (`COMMAND_TIMEOUT`) alerts. Added canonical `AlertType` enum to `@kebun-melon/contracts`. Implemented centralized, idempotent alert creation in `AlertRepository` (`createCommandFailureAlert`, `createCommandTimeoutAlert`) linking device UUID (`deviceId`) and faucet command UUID (`sourceId`, `sourceType: 'faucet_command'`). Guaranteed that command timeouts record `physicalOutcome: 'UNKNOWN'` without claiming known physical completion. Integrated failure alert creation into IoT Gateway `AcknowledgementProcessor` (rejected ACKs) and `FaucetEventProcessor` (`FAILED` execution events). Added full English and Indonesian translation keys (`commandFailedTitle`, `commandFailedMessage`, `commandTimeoutTitle`, `commandTimeoutMessage`) with ICU placeholders (`{commandId}`, `{deviceName}`, `{reason}`) and verified 100% key/placeholder parity. Preserved task boundaries keeping automated timeout scheduling/durations blocked under `TASK-0809` without inventing thresholds. Verified 100% test pass rate across targeted test suites (contracts, alert repository, gateway ACK/event processors, translation checks, web alert API tests) and confirmed user pass across all 5 reserved pre-commit checks (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`).

#### TASK-0704 Governance Record

`TASK-0704` alert acknowledgement implementation record:
- Status: `DONE` (Completed 2026-08-15)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented alert acknowledgement data contracts (`AcknowledgeAlertInputSchema`, `AlertAcknowledgementDto`), database transactional acknowledgement in `AlertRepository` (`acknowledgeAlert`) persisting acknowledgement records to `alert_acknowledgements` and emitting `alert.acknowledged` audit logs, `POST /api/v1/alerts/{alertId}/acknowledge` API route handler with RBAC enforcement (`alert.acknowledge` for OWNER global scope, ADMIN assigned-device scope), and `/notifikasi` frontend page wiring with `Premium Minimal Ops` modal for optional operator notes. Preserved alerts without deletion, handled duplicate acknowledgements safely and idempotently, and ensured 100% key parity and placeholder alignment for English and Indonesian translations. Reconciled documentation in `API.md`, `USER_FLOWS.md`, and `TRACEABILITY.md` to remove stale Admin acknowledgement TBD wording.

#### TASK-0705 Governance Record

`TASK-0705` live sidebar notification badge integration record:
- Status: `DONE` (Completed 2026-08-23)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Replaced static mock `ALERTS` evaluation in `Sidebar.tsx` with dynamic live backend alert data using lightweight client hook `useAlertBadge`. Hook queries canonical `GET /api/v1/alerts?status=OPEN&severity=CRITICAL` when authenticated. Subscribed to custom event `melon:alert-updated` emitted upon successful alert acknowledgement on `/notifikasi` page (`page.tsx`) to guarantee instant badge count updates without full page reloads. Preserved `Premium Minimal Ops` layout, badge positioning, and `bg-app-error` styling tokens. Added unit test coverage in `apps/web/test/unit/sidebar-navigation.test.tsx` (10/10 tests passed) and verified 100% test pass rate across full web unit suite (246/246 tests) and TypeScript typecheck (0 errors across 4 workspaces).

#### TASK-0807 Governance Record

`TASK-0807` faucet control UI implementation record:
- Status: `DONE` (Completed 2026-08-20)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Modal`, `Skeleton loading`, `KPI refresh`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented and verified complete Faucet Control UI revision on `/controls` adhering to `Premium Minimal Ops` UI standards:
  - Preset volume display in Liters: Phase 1 = `0.3 L / tanaman`, Phase 2 = `1 L / tanaman`, Phase 3 = `1.5 L / tanaman`.
  - `plantCount` integer input with stepper buttons (minimum 1, default 1) and live dynamic calculation preview (`preset.volumeL × plantCount = totalVolumeL`).
  - Browser-side calculation preview while strictly preserving server-side authority for final validation and execution.
  - Confirmation modal with action-aware layouts: for `DISPENSE` displaying device name, site location, phase, water per plant (L), plant count, total water (L), and safety warnings; for manual `OPEN` and `CLOSE` displaying device name, site, action title, safety description, and status.
  - Manual `OPEN` and `CLOSE` valve controls wired to `POST /api/v1/devices/{deviceId}/faucet-commands` with action `OPEN` | `CLOSE` without fabricating volume or phase parameters.
  - Idempotency integration: client dispatches unique `cmd-<uuid>` via HTTP header `Idempotency-Key` without arbitrary JSON body field injection.
  - Authoritative physical faucet state presentation (`OPEN`, `CLOSED`, `UNKNOWN`) strictly mapped from the TASK-0806 state machine: `COMPLETED OPEN` → `OPEN`, `COMPLETED CLOSE` → `CLOSED`, `COMPLETED DISPENSE` → `UNKNOWN`, active/failed/timeout/uncertain → `UNKNOWN`. Never inferred physical state from API submission, publication, or ACK.
  - Status Polling: `FaucetStatusCard` executes 2,500ms status polling strictly during active states (`QUEUED`, `SENT`, `ACKNOWLEDGED`, `IN_PROGRESS`) and terminates immediately upon terminal states or unmount with zero blind retries.
  - Full disabled and warning state handling for null device, unauthenticated/unauthorized users (`device.control.dispense`), disabled feature flag (`ENABLE_FAUCET_CONTROL=false`), offline devices (`OFFLINE`/`INACTIVE`), and active command in progress.
  - 100% Indonesian and English translation key parity with matching ICU placeholders.
  - Performance & Viewport Benchmarks: Mount latency $31\text{ ms} < 50\text{ ms}$, stepper latency $1.2\text{ ms}$, 50 modal cycles memory-safe, zero horizontal overflow across Mobile ($390\times 844$), Tablet ($768\times 1024$), and Desktop ($1280\times 800$).
  - Verified 100% test pass rate across 24 unit tests (`apps/web/test/unit/faucet-control-ui.test.tsx`), workspace TypeScript typecheck (0 errors), Semgrep scan (0 findings), and Next.js production build.

#### TASK-0810 Governance Record

`TASK-0810` manual faucet open/close control implementation record:
- Status: `DONE` (Completed 2026-08-21)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Modal`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented and verified discrete manual faucet `OPEN` and `CLOSE` valve control across Web backend API (`POST /api/v1/devices/{deviceId}/faucet-commands`), `@kebun-melon/contracts` (Zod schemas, action DTOs, and specific `AuditEventKey` enums `faucet.command.open.created` / `faucet.command.close.created`), `@kebun-melon/database` (`FaucetCommandRepository` transactional creation with audit trail and duplicate protection), IoT Gateway (`CommandPublisher` MQTT QoS 1 publish omitting fabricated volume/phase attributes; `AcknowledgementProcessor` and `FaucetEventProcessor` mapping physical state `COMPLETED OPEN` → `OPEN`, `COMPLETED CLOSE` → `CLOSED`, `COMPLETED DISPENSE` → `UNKNOWN`), and Web UI (`/controls` with action-aware `FaucetConfirmationModal`, disabled states for offline/busy/unauthorized, and authoritative physical badge presentation in `FaucetStatusCard`). Preserved `ENABLE_FAUCET_CONTROL=false` safety default. Verified 100% test pass rate across targeted test suites (32/32 tests), full faucet suites (114/114 tests), workspace test suite (102 test files, 955/955 tests), workspace typecheck (`tsc --noEmit` 0 errors), linting (0 errors), and security scanning (0 hardcoded secrets, 0 unapproved advisories). Documented hardware fail-safe valve behavior upon connection loss as an explicit UNRESOLVED/BLOCKING decision (`DEC-CTRL-090`).

#### TASK-0904 Governance Record

`TASK-0904` structured application logging implementation record:
- Status: `DONE` (Completed 2026-08-15)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented structured JSON application logging across `@kebun-melon/contracts`, `@kebun-melon/web`, and `@kebun-melon/iot-gateway`. Defined `LogLevel` enum/priorities, `LogMeta` correlation schema (`requestId`, `correlationId`, `userId`, `deviceId`, `commandId`, `messageId`, `traceId`), `StructuredLogEntry` schema, `shouldLog` level comparison, and `serializeStructuredLog` with recursive secret redaction (`redactSecrets`). Added `LOG_LEVEL` environment variable validation to `serverEnvSchema` and `gatewayEnvSchema` with defaults to `'info'`. Created unified `Logger` class supporting correlation context binding (`withContext`/`child`), dynamic level adjustment (`setLevel`/`getLevel`), service/environment tags, and structured error serialization. Replaced ad-hoc `console.error` calls across web routes and audit services. Added 100% test coverage across contract, web, gateway unit test suites, and environment validation test suites.

#### TASK-0905 Governance Record

`TASK-0905` health and readiness checks implementation record:
- Status: `DONE` (Completed 2026-08-15)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented health and readiness endpoints across `@kebun-melon/contracts`, `@kebun-melon/web`, and `@kebun-melon/iot-gateway` conforming to `docs/API.md` §23/§24 and `DEC-INF-078`. Defined `LivenessResponseDto` and `ReadinessResponseDto` in `@kebun-melon/contracts`. Created public `GET /health` (liveness independent of dependencies) and `GET /ready` in `@kebun-melon/web` checking database and internal IoT Gateway reachability via authenticated internal probe. Added `GET /internal/v1/health` and `GET /internal/v1/ready` to `@kebun-melon/iot-gateway` with mandatory `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>` verification, evaluating database and broker connectivity. Enforced strict environment configuration in production/staging (`INTERNAL_GATEWAY_URL`, `INTERNAL_SERVICE_TOKEN`, `INTERNAL_GATEWAY_TIMEOUT_MS=2000`) and verified zero credential or stack trace leakage in responses and logs across all failure modes.

#### TASK-0213 Governance Record

`TASK-0213` password recovery and email reset flow record:
- Status: `DONE` (Completed 2026-08-17)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented end-to-end password recovery and email reset flow with Resend as the approved email provider per `DEC-AUTH-102`. Added `ForgotPasswordInputSchema` and `ResetPasswordInputSchema` with strict validation to `@kebun-melon/contracts`. Created `PasswordResetToken` database model with versioned migration `20260817000000_add_password_reset_tokens/migration.sql`. Implemented `createPasswordResetToken` and `resetPasswordWithToken` in `UserRepository` (`packages/database`), generating 256-bit CSPRNG tokens, storing SHA-256 hashes, invalidating prior tokens, supporting password recovery for any existing account while strictly preserving `accountStatus` (never activating pending accounts), and transactionally revoking all user sessions across devices per `TASK-0908`. Implemented Resend email service (`apps/web/lib/email/resend.ts`) with trusted `APP_URL` reset links (never trusting request `Host` headers), strict production URL and sender domain validation, awaited delivery, and secret redaction. Added public endpoints `POST /api/v1/auth/forgot-password` (strictly anti-enumeration returning generic 200 with timing attack mitigation) and `POST /api/v1/auth/reset-password` with approved rate limits (3/min forgot-password, 5/min reset-password) and approved 15-minute token expiry. Implemented server-side guest route guard (`DEC-AUTH-103` / `requireGuestSession`) across `/login`, `/register`, `/forgot-password`, and `/reset-password` eliminating UI page flash by issuing instant HTTP 307 redirects to `/` for active sessions while allowing stale/fake sessions to render normally. Refined `/forgot-password` UX by removing the decorative image frame, initializing with empty input and neutral placeholder, adding a 15:00 countdown timer matching token lifetime with disabled button state, `sessionStorage` cooldown persistence across page refreshes, and a 5s auto-dismissing success toast. Verified 100% test pass rate across 67 unit tests in 9 test suites, 0 TypeScript typecheck errors, automated Playwright desktop/mobile browser checks with 0 console errors, user verification of real credential-dependent Resend email delivery/reset, token replay rejection, session revocation, and confirmed user pass across all 5 reserved pre-commit checks (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`).

#### TASK-0214 Governance Record

`TASK-0214` mandatory email verification record:
- Status: `IN_ACCEPTANCE` (Implementation & Automated Tests Complete; Pending Final Manual Acceptance & Custom-Domain Delivery Verification)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented mandatory email ownership verification for `OWNER` and `ADMIN` accounts using the Resend infrastructure (`DEC-AUTH-104`). Added `EmailVerificationToken` model with versioned migration `20260817082153_add_email_verification_tokens/migration.sql`. Created `createEmailVerificationToken` and `verifyEmailWithToken` in `UserRepository` (`packages/database`), generating 256-bit CSPRNG tokens, storing SHA-256 hashes, invalidating prior tokens, and recording `emailVerifiedAt` timestamp independently of `accountStatus` (`ADMIN` remains `PENDING_APPROVAL`, `OWNER` remains `ACTIVE`). Handled Prisma `P2034` transaction write conflicts with bounded exponential backoff retries (3 attempts), returning `CONCURRENCY_CONFLICT` (HTTP 409) upon exhaustion and `TOKEN_ALREADY_USED` (HTTP 400) for `P2025` deletions. Enforced authentication gate in `loginUser` (`packages/database/src/session-service.ts`) throwing `UnverifiedEmailError` (HTTP 403 `EMAIL_NOT_VERIFIED`) for unverified Owners. Enforced server-side approval and rejection gates in `getPendingApprovals`, `getPendingApprovalById`, `approvePendingAdmin`, and `rejectPendingAdmin` asserting `emailVerifiedAt IS NOT NULL` (fixed 409 Reject bug caused by missing `emailVerifiedAt` projection). Unverified Admins remain hidden from `/approvals`. Created public endpoints `POST /api/v1/auth/verify-email` (verifying email ownership without creating a session) and `POST /api/v1/auth/resend-verification` (anti-enumeration with 3/min rate limit and 24-hour token expiry). Implemented `/verify-email` UI page adhering to `Premium Minimal Ops` with module-level in-flight Promise map deduplication, immediate cache eviction upon settlement (`finally`), automatic redirect to `/status?status=PENDING_APPROVAL` for Admin applicants, login prompt for Owners, and removal of decorative illustration frames. Integrated server-side guest guard (`DEC-AUTH-103`) redirecting authenticated users to `/`.
- Delivery & Testing Status Note: Verification has been manually exercised using Resend test mode/test recipients and the Resend-provided verification link. We have not yet tested delivery to arbitrary real email recipients using a verified custom sending domain, because no such domain is currently configured. Treat real-mailbox deliverability as pending deployment/infrastructure acceptance, not as an application logic failure.

#### TASK-0802 Governance Record

`TASK-0802` faucet command database model reconciliation record:
- Status: `DONE` (Completed 2026-08-19)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented and reconciled the faucet command database model per `DEC-CTRL-051`, `DEC-CTRL-090`, and `DEC-CTRL-091`. Added versioned migration `20260819000000_task_0802_faucet_command_action/migration.sql` adding `action` (`DISPENSE`, `OPEN`, `CLOSE`) and `plant_count` (integer >= 1) columns, dropping the obsolete legacy check constraint `faucet_commands_phase_volume_check` to eliminate volume calculation conflicts with multi-plant dispense commands and null manual action fields, backfilling existing records with `action = 'DISPENSE'` and `plant_count = 1`, and establishing the multi-column check constraint `faucet_commands_action_check`. Reconciled server-derived volume calculations (`targetVolumeMl = mapPhaseToVolume(phase) * plantCount` for Phase 1: 300 mL, Phase 2: 1000 mL, Phase 3: 1500 mL) rejecting client-supplied target volume authority. Updated Zod schemas and TypeScript types in `@kebun-melon/contracts`. Updated `FaucetCommandRepository` in `@kebun-melon/database` with transactional state transition safeguards, idempotency deduplication, and active command concurrency protection. Executed local PostgreSQL 18 performance smoke test covering migration timing, 300 sequential creations across `DISPENSE`, `OPEN`, and `CLOSE`, 150 lookups, query execution plan verification via `EXPLAIN ANALYZE` (B-tree index scans on `faucet_commands_pkey`, `faucet_commands_idempotency_key_key`, `faucet_commands_device_time_idx`, `faucet_commands_one_active_per_device`), check constraint rejection verification, and concurrency idempotency/conflict tests with zero regressions.

#### TASK-0805 Governance Record

`TASK-0805` device acknowledgement processing implementation record:
- Status: `DONE` (Completed 2026-08-20)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Revalidated and hardened `AcknowledgementProcessor` in `@kebun-melon/iot-gateway` (`apps/iot-gateway/src/acknowledgements/processor.ts`) to handle command ACKs across all supported faucet command actions (`DISPENSE`, `OPEN`, and `CLOSE`). Enforced authoritative ACK payload contract identifying commands via `commandId` and `deviceId` without fabricating an action field in the MQTT ACK payload. Enforced persisted command action validation against `[DISPENSE, OPEN, CLOSE]`, rejecting unsupported or unknown actions (`success: false`). Enforced strict state transitions where accepted ACKs only transition `SENT` → `ACKNOWLEDGED` (guaranteeing status never transitions to `COMPLETED` and never infers physical state), and rejected ACKs transition `SENT` → `FAILED` with canonical `reasonCode` and `CommandFailureAlert` generation. Handled duplicate `messageId` idempotently and safely ignored non-`SENT` / late / out-of-order ACKs without state regression. Verified 100% test pass rate across 25 unit tests (`apps/iot-gateway/src/__tests__/acknowledgement-processor.test.ts`), 195/195 IoT Gateway tests, 228/228 contracts/database tests, Semgrep security scan (0 findings), and workspace typecheck (0 errors). Executed local in-memory performance sanity microbenchmarks (1,000 sequential ACKs: 3,979 ACKs/sec, p50: 0.087 ms; 500 concurrent burst ACKs: 7,579 ACKs/sec, p50: 56.55 ms; 1,000 duplicate ACKs: 5,887 ACKs/sec, 0 redundant DB writes; 2,000 soak ACKs: 4,453 ACKs/sec, stable heap; clearly labeled as in-memory microbenchmarks). Live staging MQTT/hardware verification remains credential/manual dependent.

#### TASK-0806 Governance Record

`TASK-0806` command event state machine implementation record:
- Status: `DONE` (Completed 2026-08-20)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented and hardened `FaucetEventProcessor` in `@kebun-melon/iot-gateway` (`apps/iot-gateway/src/events/processor.ts`) to handle execution events across all supported faucet command actions (`DISPENSE`, `OPEN`, and `CLOSE`). Implemented authoritative physical state determination: `COMPLETED OPEN` → `OPEN`, `COMPLETED CLOSE` → `CLOSED`, `COMPLETED DISPENSE` → `UNKNOWN` (strictly avoiding assuming closed valve), and failed/uncertain/in-progress → `UNKNOWN`. Ensured physical state is NEVER inferred from API acceptance, publication, or ACK. Enforced persisted command action validation against `[DISPENSE, OPEN, CLOSE]`. Enforced contract-consistent volume handling: `DISPENSE` validates non-negative `actualVolumeMl` and target volume match if provided; `OPEN` and `CLOSE` treat volume as non-applicable and store `null`/`undefined` on the command record. Guaranteed terminal-state immutability (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `EXPIRED`), duplicate `messageId` idempotency, progress event appending, and `CommandFailureAlert` dispatching on `FAILED` events. Verified 100% test pass rate across 32 unit tests (`apps/iot-gateway/src/__tests__/faucet-event-processor.test.ts`), full 212-test IoT Gateway test suite, 934-test workspace suite, Semgrep security scan (0 findings), and TypeScript typecheck (0 errors).

#### TASK-0808 Governance Record

`TASK-0808` duplicate command protection implementation record:
- Status: `DONE` (Completed 2026-08-20)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented semantic duplicate command protection in `FaucetCommandRepository` (`@kebun-melon/database`) without relying on desired state comparisons or tracking external physical states. Maintained the strict "max 1 active command per device" concurrency constraint (`DEC-CTRL-051`), while throwing a specific `FaucetCommandConflictError` mapped to HTTP 409 Conflict with descriptive messages for duplicate physical intent scenarios. For `DISPENSE`, duplicate intent is verified by matching the `action`, `phase`, and `plantCount`. For `OPEN` and `CLOSE`, intent is verified strictly by matching the `action`. Non-semantic concurrent commands (e.g., trying to `OPEN` while `CLOSE` is active) continue to hit the generic concurrency rejection. Verified 100% test pass rate across 21 database unit tests and 31 API route tests. A known millisecond-level race condition due to absent strict database locking remains out-of-scope for this iteration.

#### TASK-1001 Governance Record

`TASK-1001` complete unit test suite implementation record:
- Status: `DONE` (Completed 2026-08-21)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Audited, hardened, and verified full monorepo unit test coverage across all 8 mandatory acceptance domains: account-status decisions, RBAC permission checks, device access isolation, telemetry validation (`BAT` parameter omitted per `DEC-MON-086`), phase/volume mapping calculations, command state machine transitions, idempotency deduplication, and bilingual locale validation. Hardened branch coverage in `@kebun-melon/contracts` for unrecognized device types, log level fallbacks, and user role deduplication. Verified 100% test pass rate across 102 test files (958/958 tests passed) and >99.6% line coverage in contracts. Maintained `ENABLE_FAUCET_CONTROL=false` safety default and asserted uncertain/timeout states strictly as `UNKNOWN`. Passed pre-commit quality suite (`npm run check:quality`): 0 TypeScript errors, 0 lint errors, clean Prettier formatting, 100% translation parity (`i18n:check`), 0 hardcoded secrets, 0 unapproved vulnerabilities, and successful 37-route Next.js production build.

#### TASK-0913 Governance Record

`TASK-0913` telemetry data retention and automated maintenance policy record:
- Status: `DONE` (Completed 2026-08-24)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented automated telemetry data lifecycle management in `@kebun-melon/database` (`RetentionService`) and `@kebun-melon/iot-gateway` (`RetentionScheduler`). Enforces a 90-day retention cutoff (`DEC-MON-048`) for high-frequency raw telemetry (`soil_readings`, `water_readings`, `reservoir_water_readings`, `sensor_battery_readings`) and operational event logs (`device_status_events`, `integration_errors`). Preserved strict immutability and exemption for compliance and security audit logs (`audit_logs`), actuator commands (`faucet_commands`, `faucet_command_events`), and account approvals (`account_approvals`) per `SEC-DATA-004`. Implemented chunked batch deletion (`batchSize: 1000`, `yieldMs: 20`) to eliminate table locks and transaction timeouts. Integrated scheduled execution into the IoT Gateway service lifecycle (`RETENTION_INTERVAL_MS=86400000`) with overlap protection and structured JSON metrics logging. Provided standalone operator maintenance script (`scripts/cleanup-retention.ts` / `npm run db:cleanup`). Verified 100% test pass rate across dedicated unit test suites (`retention-service.test.ts` 8/8, `retention-scheduler.test.ts` 6/6), workspace typecheck (0 errors across 4 workspaces), secret scan (0 findings), dependency scan (0 unapproved advisories), and historical query non-regression (`historical-charts.test.tsx` 13/13). Staging update is managed through normal CI/CD after push without requiring manual database migrations.

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

- Manage only their own permitted profileee fields.
- View assigned devices.
- View authorised monitoring.
- Use faucet control only when explicitly granted.

The Admin shall not:

- View another user's private profileee.
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

## 11. Device Access and Identity Rules

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

Device identity and governance rules:

- **No In-App Device Creation**: Devices cannot be created via `/devices` or application APIs; device registration is seeded/provisioned out-of-band (`DEC-DEV-027`).
- **Owner-Only Canonical `deviceId` Edit**: The Owner may update the external canonical `deviceId` string. The internal database UUID (`devices.id`) remains strictly immutable (`DEC-DEV-028`).
- **Strict Admin `deviceId` Concealment**: Admin users MUST NOT view or edit the external canonical `deviceId` across any UI component or API response. Admins only see the user-facing device `name` or localized default label (`DEC-DEV-028`).
- **Hardware/Broker Rename Reconciliation**: Physical ESP32/NodeMCU firmware reconfiguration and EMQX broker credential/ACL synchronization following a `deviceId` rename are operational workflows marked as **TBD / BLOCKING** automation (`DEC-DEV-028`).
- **Removal of Previously/Last-Accessed Device History**: Persistent restoration or tracking of previously/last-accessed device history across logins or storage is removed (`DEC-DEV-029`). Device selection resolves fresh on initial load. Historical telemetry charts (`TASK-0503`/`TASK-0504`), faucet commands, assignments, status events, and audit logs remain 100% intact.

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
- Admin edits another profileee.
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
- profileee updates.
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
- Manual Open/Close.
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


---

## Monitoring and Implementation Note (Reconciled 2026-08-19)

The following facts are supported by the current implementation regarding device selection, routing, and monitoring resolution (`TASK-0306`, `TASK-0501`, `TASK-0503`, `TASK-0504`):
- **Frontend Selection/Context/URL:** Consistently uses immutable `devices.id` UUID.
- **Bare Routes:** Remain neutral with no auto-selection (`/`, `/sensor`, `/soil`, `/water`). Canonical routes are `/soil` and `/water` (legacy `/air` and `/tanah` routes return 404).
- **Identifier Resolution:** Monitoring backend routes accept both internal database UUID and external canonical `deviceId` string.
- **Rehydration:** Valid `?deviceId=<UUID>` rehydrates after authorization on hard refresh.
- **Invalid/Revoked IDs:** Clear selection safely to `null` with a notice banner.
- **Admin Privacy:** Admin canonical `deviceId` concealment remains strictly enforced.
- **Empty History Handling:** Historical telemetry queries with zero matching records return HTTP 200 with `{ series: [], pagination: { ... } }`, never HTTP 404.
- **Operational Dev Server Isolation:** Intermittent Next.js HTML 404 on restarts isolated as Windows zombie process holding port 3000 upon Ctrl+C; resolved via port cleanup before dev server startup.
< ! - -   T A S K - 0 8 0 2   R e c o n c i l e d :   2 0 2 6 - 0 8 - 1 9   - - >  
 
---

## TASK-0804 Governance & Implementation Record

`TASK-0804` gateway command publisher implementation record:
- **Status:** `DONE` (Verified & Reconciled 2026-08-20)
- **Frontend Impact:** `NONE`
- **Selected UI Direction:** `N/A`
- **Existing Color Template:** `UNCHANGED`
- **Selected Motion Effects:** `None`
- **21st.dev MCP:** `NOT REQUIRED`
- **Summary:** Implemented and verified `CommandPublisher` in `@kebun-melon/iot-gateway`. Publishes eligible, unexpired `QUEUED` faucet commands for `WATER_TANK_NODE` devices over MQTT 5.0 (QoS 1, `retain=false`) to canonical topics `agriculture/{environment}/{siteId}/{deviceId}/command/faucet`. For `DISPENSE` actions, directly transmits the database-persisted canonical `targetVolumeMl` integer (from `TASK-0803`) alongside valid `phase` and `plantCount >= 1` without gateway-side recalculation. For `OPEN` and `CLOSE` actions, cleanly omits `phase`, `plantCount`, and `targetVolumeMl`. Enforces strict atomic state progression (`QUEUED` -> `SENT`) only upon broker publish confirmation; failed publishes leave commands `QUEUED` without false `SENT` marks; expired commands transition to `EXPIRED` without dispatch. Verified 100% test pass rate across targeted test suites (10/10 publisher tests, 42/42 gateway contract tests) and clean TypeScript typecheck (0 errors). Completed local simulated performance sanity tests (1,000 direct calls ~68.3 ops/s with p95 20.08 ms, 500 burst commands ~67.0 cmds/s, 2,000 soak commands ~66.7 cmds/s with zero leaks and safe reconnect recovery). Downstream `TASK-0805` (acknowledgement processing) remains pending and decoupled.
<!-- TASK-0804 Reconciled: 2026-08-20 -->

---

## TASK-0808 Governance & Implementation Record

`TASK-0808` duplicate command protection implementation record:
- **Status:** `DONE` (Completed 2026-08-20)
- **Frontend impact:** `NONE`
- **Selected UI direction:** `N/A`
- **Existing color template:** `UNCHANGED`
- **Selected motion effects:** `None`
- **21st.dev MCP:** `NOT REQUIRED`
- **Summary:** Revalidated duplicate command protection for all three faucet command action types (`DISPENSE`, `OPEN`, `CLOSE`) including the `plantCount` multiplier contract introduced in `TASK-0802`/`TASK-0803`. Confirmed that the existing `createCommand` implementation in `FaucetCommandRepository` (`packages/database/src/faucet-command-repository.ts`) is already correct for all three actions: the transactional idempotency key check compares `deviceId`, `action`, `phase ?? null`, and `plantCount ?? null`, which correctly produces `null` for both `OPEN` and `CLOSE` (which carry no phase/plantCount) and detects `plantCount` mismatches for `DISPENSE` network retries. No production code changes were required. Added 7 targeted unit tests to `packages/database/src/__tests__/faucet-command-repository.test.ts`: (1) DISPENSE + different `plantCount` → conflict, (2) DISPENSE + identical `plantCount` network retry → returns existing, (3) OPEN idempotent re-submission → returns existing, (4) OPEN key reused for CLOSE action → conflict, (5) CLOSE idempotent re-submission → returns existing, (6) P2002 race recovery for OPEN → returns existing, (7) P2002 race recovery for CLOSE → returns existing. Verified 21/21 tests pass (14 original + 7 new) with zero regressions across full workspace test suite. No database migrations, API changes, or frontend changes required.

<!-- TASK-0808 Completed: 2026-08-20 -->
