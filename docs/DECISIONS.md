# Consolidated Product and Technical Decision Register: Kebun Melon

> **Task Reference:** `TASK-0002 — Resolve Release-Blocking Product Decisions`
> **Status:** APPROVED — Formally Approved with User Revisions (Reconciled: 2026-07-27)
> **Source of Truth Rule:** Recommendations prefer the least disruptive implementation, strict server-side security defaults, deny-by-default access, physical control feature-flag protection, and full visual compatibility with [docs/FRONTEND_AUDIT.md](file:///c:/Users/hugop/Documents/Web%20Monitoring/Kebun-Melon/docs/FRONTEND_AUDIT.md).
>
> **Reconciliation Note (2026-07-27):** During the TASK-0002 audit pass, items lacking explicit user-approval records were restored to **TBD**: `SameSite` exact cookie value, device offline/stale thresholds, command timeout durations, cancellation/stop support, accessibility standard level, API performance targets, physical test run count, dispensing volume tolerance, and telemetry/heartbeat intervals. All previously confirmed decisions are preserved.

---

## 1. Executive Summary Tables

### Table 1 — Confirmed and Approved Core Architectural Decisions

| Decision ID | Decision Title | Status | Approved Choice / Policy | Implementation Directive |
|---|---|---|---|---|
| `DEC-INF-075` | Monorepo Structure | **APPROVED** | npm monorepo workspace (`apps/web`, `apps/iot-gateway`, `packages/database`, `packages/contracts`) | Structure repository into workspaces in `TASK-0101` |
| `DEC-INF-076` | Database ORM Selection | **DECISION REQUIRED** | PostgreSQL confirmed. ORM not yet selected — neither Prisma nor Drizzle is present in `package.json`. User must select exactly one before `TASK-0104` begins. Recommendation: Prisma (see §2.5). | Record selection here once user decides. Do not install either ORM until user selects. |
| `DEC-AUTH-001` | Authentication Architecture | **APPROVED** | HTTP-only secure cookies (`HttpOnly`, `Secure` in prod, `SameSite` policy **TBD**) + PostgreSQL session store | Implement in `TASK-0204` (30m idle, 12h max). `SameSite=Strict` not yet explicitly approved — see DEC-AUTH-001 note. |
| `DEC-AUTH-006` | First Owner Provisioning | **APPROVED** | CLI interactive seed script (`npm run seed:owner`). Public sign-up NEVER creates Owner. | Implement in `TASK-0106` |
| `DEC-RBAC-015` | Admin Faucet Authorization | **APPROVED (REVISED)** | `Active ADMIN + assigned device access + active/controllable device = faucet-control permission` | Remove separate `canControl` grant. Device assignment confers control. |
| `DEC-DEV-020` | Device Communication Protocol | **APPROVED** | MQTT 5.0 over TLS via long-running backend IoT Gateway service | Implement in `TASK-0401` (per-device username/password & ACLs) |
| `DEC-CTRL-051` | Faucet Command Concurrency | **APPROVED** | Maximum 1 active command per device; no auto retries; idempotency key required | Implement in `TASK-0802` & `TASK-0803` |
| `DEC-CTRL-067` | Production Feature Flag | **APPROVED** | `ENABLE_FAUCET_CONTROL=false` by default; requires dual written Owner & Hardware Lead sign-off before production activation | Feature flag in `TASK-0103`; faucet code may be built and tested behind flag; production activation blocked until dual sign-off recorded |
| `DEC-INF-078` | Web-to-Gateway Internal Health & Readiness Probe | **APPROVED** | Internal HTTP probe with mandatory `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>`, 2000ms default timeout | Implemented in `TASK-0905` |

---

### Table 2 — Feature-Specific Approved Decisions Grouped by Subsystem

| Subsystem | Decision IDs | Status | Approved Policy |
|---|---|---|---|
| **Authentication** | `DEC-AUTH-001` to `DEC-AUTH-012` | **APPROVED** | HTTP-only secure cookies, PostgreSQL session table, 30m idle / 12h max timeouts, CLI Owner seed, no public Owner creation. `SameSite` cookie value: **TBD** — pending explicit user approval. |
| **RBAC** | `DEC-RBAC-013` to `DEC-RBAC-019` | **APPROVED** | Owner has global device visibility. Admins have mandatory per-device assignments; device assignment automatically grants both monitoring and faucet control. Owners manage assignments. No separate per-user-device `canControl` permission in v1. |
| **Devices** | `DEC-DEV-020` to `DEC-DEV-029` | **APPROVED** | Multi-protocol architecture: Soil & Water quality monitoring telemetry via REST API over Wi-Fi (no MQTT broker). Water Tank monitoring (tank volume & flow rate) via MQTT through an EMQX broker (MQTT 5.0 over TLS via IoT Gateway). Shared INA219 electrical monitoring via REST/Wi-Fi. Per-device credentials/ACLs, no anonymous access, no direct browser-to-MQTT. Offline threshold: **TBD**. Stale threshold: **TBD**. In-app device creation / Add Device removed (`DEC-DEV-027`). External `deviceId` editable by OWNER only; internal DB UUID immutable; canonical `deviceId` strictly hidden from ADMIN in UI & API (`DEC-DEV-028`). Previously/last-accessed device history & persistent restoration removed while preserving all telemetry/command/assignment/audit history (`DEC-DEV-029`). |
| **Monitoring** | `DEC-MON-036` to `DEC-MON-050` | **APPROVED** | Three distinct monitoring domains: 1) Soil monitoring (NPK, Temp, Moisture, pH, EC in `µS/cm`, status), 2) Water Quality monitoring (pH, TDS in ppm, EC in `µS/cm`, status), 3) Water Tank monitoring (Tank Vol in `L`, Flow in `m³/h`, status). Canonical display unit for EC is `µS/cm` (values in `mS/cm` converted at presentation boundary via `×1000`). Control capabilities (Solenoid Valve, Relay) are actuators, not monitoring sensors. INA219 electrical monitoring tracks system electrical consumption (voltage, current, power) as device health/power telemetry, not as a battery percentage or primary agronomic measurement. Sensor precision and valid ranges: **TBD**. |
| **Faucet Control** | `DEC-CTRL-051` to `DEC-CTRL-067` | **APPROVED** | Max 1 active command/device, no auto retries, `ENABLE_FAUCET_CONTROL=false` default, dual written sign-off (Owner + Hardware Lead) required before production activation. Duplicate command IDs never re-dispense. Timeout ≠ completion. ACK timeout, completion timeout, expiry duration: **TBD**. Cancellation/stop support: **TBD**. |
| **I18N** | `DEC-I18N-068` to `DEC-I18N-074` | **APPROVED** | Default `id` (Bahasa Indonesia), `en` fallback, mandatory centered language-selection gate for unauthenticated visitors without valid locale (`English` -> `en`, `Bahasa Indonesia` -> `id`), cookie-based non-prefixed routing (no URL path pollution), subsequent language changes strictly in Settings (`/settings`), UTC storage with `Asia/Jakarta` (WIB) presentation. |
| **Infrastructure** | `DEC-INF-075` to `DEC-INF-088` | **APPROVED (ORM DECISION REQUIRED)** | npm monorepo, PostgreSQL (ORM TBD — see §2.5). Backup schedule, retention period, RPO, and RTO: **TBD** — pending explicit user approval. |
| **Testing** | `DEC-TST-089` to `DEC-TST-100` | **APPROVED** | Modern Evergreen browsers. Mobile viewport primary (360-430px). Accessibility standard: **TBD**. API performance targets (p95): **TBD**. Physical test run count per faucet phase: **TBD**. |
| **UI/UX & Frontend** | `DEC-UIUX-101` | **APPROVED** | 6 primary UI directions (1 per task), authoritative Kebun Melon color palette (UNCHANGED), controlled 12-motion library, performant motion quality, mandatory task-level frontend declaration, 21st.dev MCP required ONLY for material redesigns. |

---

### Table 3 — Safe Deferrals

| Decision ID | Decision Title | Priority | Safe Temporary Default | Impact of Deferral |
|---|---|---|---|---|
| `DEC-AUTH-010` | Email Verification | `P2` | Disabled in v1 (Admin accounts created by direct Owner approval) | None for internal/admin releases |
| `DEC-AUTH-012` | Owner Account MFA | `P2` | Disabled in v1 (Strong password + session security enforced) | MFA can be added in Phase 9 security hardening |
| `DEC-DEV-026` | Multi-Site Management | `P2` | Database schema includes optional `site_id`, UI defaults to primary site | Multi-site UI selector deferred to Phase 11 |
| `DEC-MON-048` | Telemetry Data Retention | `P2` | 90 days raw telemetry, 1 year daily rollups | Database storage optimization deferred to Phase 9 |
| `DEC-INF-077` | Redis Cache & Message Broker | `P2` | PostgreSQL for session state; SSE in-memory transport in v1 | Redis optional until multi-instance Gateway scale required |
| `DEC-AUD-101` | Radix UI Dependency Cleanup | `P2` | Keep installed Radix packages in `package.json` | Used in Phase 2 for auth dialogs and tab components |

---

### Table 4 — Corrected Task Status Readiness

> **Note:** Task IDs and titles match the **actual definitions in `TASKS.md`**. Statuses reflect the dependency chain applied strictly. Tasks that depend on an unstarted task cannot be READY.

| Task ID | Task Title (from TASKS.md) | Status | Reason & Dependency |
|---|---|---|---|
| `TASK-0001` | Confirm Existing Frontend Technology | `DONE` | Frontend audit complete; `docs/FRONTEND_AUDIT.md` created and populated. |
| `TASK-0002` | Resolve Release-Blocking Product Decisions | `DONE` | All release-blocking decisions recorded. Several numeric values restored to TBD pending explicit approval. Reconciliation complete. |
| `TASK-0003` | Establish Requirement IDs | `READY` | No implementation dependencies. Can begin immediately. |
| `TASK-0101` | Establish Repository Structure | `READY` | Monorepo structure approved (`DEC-INF-075`). Depends on `TASK-0001` (DONE). ORM selection still required before `TASK-0104` but does not block repository scaffolding. |
| `TASK-0102` | Configure TypeScript and Code Quality | `BACKLOG` | Depends on `TASK-0101` (not yet started). Cannot be READY until `TASK-0101` is DONE. |
| `TASK-0103` | Configure Environment Validation | `BACKLOG` | Depends on `TASK-0101` (not yet started). Cannot be READY until `TASK-0101` is DONE. |
| `TASK-0104` | Configure PostgreSQL and ORM | `BLOCKED` | Depends on `TASK-0101` (BACKLOG) and ORM user selection (`DEC-INF-076` unresolved). |
| `TASK-0105` | Seed Roles and Permissions | `BACKLOG` | Depends on `TASK-0104` (BLOCKED). |
| `TASK-0106` | Implement Secure First Owner Provisioning | `BLOCKED` | Depends on `TASK-0104` (BLOCKED) and `TASK-0002` (DONE). |
| `TASK-0107` | Configure Testing Foundation | `BACKLOG` | Depends on `TASK-0101` (BACKLOG). |
| `TASK-0108` | Configure CI Pipeline | `BACKLOG` | Depends on `TASK-0102` and `TASK-0107` (both BACKLOG). |
| `TASK-0201` | Implement User Account Model | `BACKLOG` | Depends on `TASK-0104` (BLOCKED). |
| `TASK-0202` | Implement Password Hashing | `BACKLOG` | Depends on `TASK-0201` (BACKLOG). |
| `TASK-0203` | Implement Public Admin Registration | `BACKLOG` | Depends on `TASK-0201` and `TASK-0202` (both BACKLOG). |
| `TASK-0204` | Implement Login and Session Management | `BLOCKED` | Depends on `TASK-0201` (BACKLOG) and `TASK-0002` (DONE). Blocked transitively via `TASK-0201`. |
| `TASK-0209` | Implement Authorisation Library | `BACKLOG` | Depends on `TASK-0105` and `TASK-0204` (both blocked/backlog). |
| `TASK-0301` | Implement Site Model | `BLOCKED` | Depends on `TASK-0104` (BLOCKED) and `TASK-0002` (DONE). |
| `TASK-0302` | Implement Device Registry | `BACKLOG` | Depends on `TASK-0104` (BLOCKED). |
| `TASK-0304` | Implement User-Device Assignments | `BACKLOG` | Depends on `TASK-0302` and `TASK-0209` (both blocked/backlog). |
| `TASK-0401` | Create IoT Gateway Service | `BACKLOG` | Depends on `TASK-0101` (BACKLOG) and `TASK-0002` (DONE). Awaits `TASK-0101`. |
| `TASK-0801` | Finalise Faucet Permission Matrix | `BLOCKED` | Depends on `TASK-0002` (DONE). Remains BLOCKED: cancellation/stop, timeout values, and Owner control scope still TBD. |
| `TASK-0802` | Implement Faucet Command Database Model | `BACKLOG` | Depends on `TASK-0104` (BLOCKED). |
| `TASK-0803` | Implement Faucet Command API | `IMPLEMENTED` | Completed. |
| `TASK-1010` | Controlled Production Release | `BLOCKED` | Blocked until dual written sign-off (Owner + Hardware Lead) for `ENABLE_FAUCET_CONTROL=true`. This is a production-activation block, not an implementation block. |

---

## 2. Comprehensive Decision Register

---

### 2.1 Authentication and Accounts

#### DEC-AUTH-001: Authentication Architecture and Session Library
* **Related Task IDs**: `TASK-0204`
* **Related Documentation**: `PRD.md` §6.1, `SECURITY.md` §3.1, `FRONTEND_AUDIT.md` §6.10
* **Status**: **APPROVED BY USER**
* **Current Confirmed Facts**: Next.js 14 App Router; login/register forms use client `useState`.
* **Approved Decision**: Custom session handlers backed by a PostgreSQL `sessions` table using HTTP-only secure cookies.
* **Session Configuration**: 30-minute idle timeout, 12-hour absolute maximum lifetime, `HttpOnly`, `Secure` in production.
* **SameSite Policy**: **TBD** — the value `SameSite=Strict` was not separately and explicitly approved. Browser-compatibility with all application flows (cross-origin auth redirects, etc.) has not been evaluated. Implement as the appropriate SameSite value until explicit user approval is recorded here.
* **Security Implications**: High — HTTP-only secure cookies prevent XSS token theft; PostgreSQL session storage enables instant server-side session revocation upon user suspension.

---

#### DEC-AUTH-006: First Owner Account Provisioning Method
* **Related Task IDs**: `TASK-0106`
* **Related Documentation**: `PRD.md` §6.4, `RBAC.md` §4.1
* **Status**: **APPROVED BY USER**
* **Current Confirmed Facts**: Public sign-up creates only `ADMIN` with `PENDING_APPROVAL` status. Public registration MUST NEVER create an Owner account.
* **Approved Decision**: First Owner account is provisioned via CLI interactive seed script (`npm run seed:owner`).
* **Security Implications**: Critical — Completely eliminates public self-registration vulnerability for Owner privilege escalation.

---

#### DEC-AUTH-102: Password-Recovery Email Provider & Token Lifecycle Architecture
* **Related Task IDs**: `TASK-0213`
* **Related Documentation**: `docs/SECURITY.md`, `docs/DATABASE.md`, `docs/API.md`, `docs/USER_FLOWS.md`, `docs/TRACEABILITY.md`, `TASKS.md`
* **Status**: **APPROVED BY USER**
* **Approved Decision**:
  1. **Approved Email Provider**: **Resend** is the formally approved transactional email provider for password recovery notifications.
  2. **Token Cryptography & Security**: Reset tokens are generated as 256-bit (32 bytes) CSPRNG random hex strings. Only the SHA-256 hash (`token_hash`) is persisted in `password_reset_tokens`. The raw token is NEVER stored in the database, logged, or serialized.
  3. **Reset Link URL Construction**: Reset URLs are constructed strictly from server-configured trusted environment variables (`APP_URL` / `NEXT_PUBLIC_APP_URL`). In production, an explicit trusted HTTPS URL is required (cannot point to localhost/127.0.0.1). The untrusted request `Host` header MUST NEVER be used, preventing Host Header injection / password reset poisoning.
  4. **Email Dispatch & Anti-Enumeration**: Email dispatch is explicitly `await`ed (preventing lost sends or unhandled promise rejections). `POST /api/v1/auth/forgot-password` unconditionally returns HTTP 200 with a generic message (`If an account exists with that email, a password reset link has been sent.`) and applies timing-mitigation equalizers to prevent side-channel account existence enumeration. In production with Resend, `RESEND_FROM_EMAIL` must use a verified sender domain (not `onboarding@resend.dev`).
  5. **Approved Operational Policies**:
     - Reset-token expiry is formally approved as **15 minutes** (`AUTH_RESET_TOKEN_EXPIRY_MINUTES = 15`).
     - Forgot-password rate limit is formally approved as **3 requests per minute** (`RATE_LIMIT_FORGOT_PASSWORD_MAX = 3`).
     - Reset-password rate limit is formally approved as **5 requests per minute** (`RATE_LIMIT_RESET_PASSWORD_MAX = 5`).
     - Environment variables remain available for operational configuration with these approved values as defaults.
  6. **Single-Use, Invalidation & Session Revocation**: When a token is created, any prior unused tokens for the user are invalidated. Once consumed, the token is marked `used_at = NOW()` and cannot be replayed. Successful password reset transactionally revokes all active user sessions across devices per `TASK-0908`.
  7. **Account Status Policy**: Password recovery is permitted for any existing user account with an email. Password reset MUST NEVER activate, approve, or alter the `accountStatus` of an account (e.g. `PENDING_APPROVAL` or `SUSPENDED` accounts remain unchanged). Normal login status checks continue to enforce system access control.

---

### 2.2 Roles and Permissions (RBAC)

#### DEC-RBAC-015: Admin Faucet Control Authorization Policy
* **Related Task IDs**: `TASK-0304`, `TASK-0803`
* **Related Documentation**: `RBAC.md` §4.4, `USER_FLOWS.md` §6.1
* **Status**: **APPROVED BY USER (REVISED RULE)**
* **Current Confirmed Facts**: Admin is an operational role requiring Owner approval and device assignment.
* **Approved Decision**: All active Admin users possess faucet control permission for devices assigned to them by an Owner. Do NOT use a separate per-user-device `canControl` permission grant.
* **Effective Rule**:
  ```text
  Active ADMIN
  + assigned device access
  + active and controllable device
  + global faucet-control feature enabled (ENABLE_FAUCET_CONTROL=true)
  = faucet-control permission
  ```
* **Security Implications**: Device assignment remains mandatory. Admins cannot view or control unassigned devices. Admins cannot assign devices to themselves or others. Owners manage all device assignments.

---

#### DEC-RBAC-016: Device Permission Assignment Granularity Model
* **Related Task IDs**: `TASK-0304`, `TASK-0302`
* **Related Documentation**: `RBAC.md` §5.1, `DATABASE.md` §3.3
* **Status**: **APPROVED BY USER (REVISED RULE)**
* **Current Confirmed Facts**: System enforces mandatory per-device access control.
* **Approved Decision**: Device assignment (`user_devices` table: `user_id`, `device_id`, `assigned_by`, `assigned_at`) is mandatory for Admin access. Separate `canControl` column is not used in v1. Device assignment grants both telemetry monitoring and faucet control for active Admins on active controllable devices.
* **Database Implications**: `user_devices` table stores mapping between `user_id` and `device_id` with auditing (`assigned_by`, `assigned_at`).

---

### 2.3 Devices and Communication

#### DEC-DEV-020: Primary Device Communication Protocols, EMQX Broker Selection & Device Routing
* **Related Task IDs**: `TASK-0401`
* **Related Documentation**: `DEVICE_COMMUNICATION.md` §3.1, §7.1, `ARCHITECTURE.md` §5.1
* **Status**: **APPROVED BY USER (2026-07-28)**
* **Approved Decision**: Communication protocol is defined per domain:
  1. **Soil Monitoring**: REST API over Wi-Fi submitted directly to backend ingestion endpoint (No MQTT broker).
  2. **Water Monitoring**: REST API over Wi-Fi submitted directly to backend ingestion endpoint (No MQTT broker).
  3. **Reservoir-Water Monitoring**: MQTT 5.0 over TLS via EMQX broker ingested through long-running backend IoT Gateway service.
  4. **Sensor Battery (`BAT`)**: `BAT` parameter is removed completely from soil and water quality monitoring (`DEC-MON-086`, superseding `DEC-MON-085`).
  5. **Protocol Routing Determinism**: Protocol selection is deterministically resolved using `DeviceType` (`SOIL_NODE`, `WATER_QUALITY_NODE`, `WATER_TANK_NODE`) combined with registered `DeviceCapability` entries (`SOIL_TELEMETRY`, `WATER_TELEMETRY`, `TANK_MONITORING`, `FLOW_MONITORING`, `FAUCET_CONTROL`). The existing `DeviceType` enum values are sufficient without schema modification.

#### DEC-MON-085: Battery (BAT) Parameter Identity & Sensor Node Incorporation
* **Related Task IDs**: `TASK-0405`, `TASK-0406`
* **Related Documentation**: `DEVICE_COMMUNICATION.md` §14, `DATABASE.md` §8.5, `AGENTS.md` §2
* **Status**: **SUPERSEDED BY DEC-MON-086**

#### DEC-MON-086: Complete Removal of Sensor Battery (BAT) Parameter from Soil & Water Quality Domains
* **Related Task IDs**: `TASK-0405`, `TASK-0406`
* **Related Documentation**: `DEVICE_COMMUNICATION.md` §14, `DATABASE.md` §8.5, `AGENTS.md` §2
* **Status**: **APPROVED BY USER (2026-08-10)**
* **Approved Decision**:
  1. The `BAT` (Battery) monitoring parameter is removed completely from both **soil monitoring sensors** (`SOIL_NODE`) and **water quality sensors** (`WATER_QUALITY_NODE`).
  2. Battery power telemetry is not part of soil or water-quality payload schemas or database ingestion.
  3. `DEC-MON-085` is officially SUPERSEDED by `DEC-MON-086`.

#### DEC-DEV-027: Removal of In-App Device Creation / Add Device Requirement
* **Related Task IDs**: `TASK-0302`, `TASK-0305`
* **Related Documentation**: `docs/PRD.md` §8.1, `docs/API.md` §14.3, `docs/RBAC.md` §9.3, §10, `docs/UI_UX.md` §6, `docs/TRACEABILITY.md` (`API-DEV-003`)
* **Status**: **APPROVED BY USER (2026-08-18)**
* **Implementation Status**: **IMPLEMENTED & VERIFIED (2026-08-18 / TASK-0302)**
* **Approved Decision**:
  1. **No In-App Device Creation**: Devices can no longer be created from `/devices` or through the application UI or application API (`POST /api/v1/devices`).
  2. **Add Device Requirement Removed**: The "Add Device" product requirement, UI button/modal, and `device.create` permission are removed.
  3. **Existing Devices Preserved**: Pre-existing registered devices remain in the system. Device provisioning is managed out-of-band / via database seeding scripts.
* **Implementation Evidence**:
  - Removed `POST /api/v1/devices` endpoint from `apps/web/app/api/v1/devices/route.ts`.
  - Removed "Add Device" button and creation modal from `apps/web/app/devices/page.tsx`.
  - Removed `CreateDeviceInputSchema` and creation types from `packages/contracts/src/device.ts`.
  - Removed `device.create` permission from `packages/database/prisma/seed.ts` and `packages/database/src/device-repository.ts`.
  - Verified 100% test pass across unit/schema tests (`packages/contracts/src/__tests__/device.test.ts`, `apps/web/app/devices/test/page.test.ts`).

#### DEC-DEV-028: Owner-Only External deviceId Modification, Immutable Database UUID, and Strict Admin deviceId Concealment
* **Related Task IDs**: `TASK-0302`, `TASK-0305`, `TASK-0306`
* **Related Documentation**: `docs/PRD.md` §8.1, §13.4, `docs/RBAC.md` §6.1, §9.3, §10, `docs/API.md` §14.1, §14.2, §14.4, `docs/DATABASE.md` §7.2, `docs/DEVICE_COMMUNICATION.md` §6, `docs/SECURITY.md` §10.5, `docs/UI_UX.md` §7.1
* **Status**: **APPROVED BY USER (2026-08-18)**
* **Implementation Status**: **IMPLEMENTED & VERIFIED (2026-08-18 / TASK-0302)**
* **Approved Decision**:
  1. **Owner-Only External deviceId Edit**: The Project Owner is authorized to edit the external/canonical `deviceId` string (as well as user-facing `name`) via `PATCH /api/v1/devices/{deviceId}`.
  2. **Immutable Database UUID**: The internal database primary key UUID (`devices.id`) is strictly immutable. All internal relational foreign key relationships (`user_device_access`, `soil_readings`, `water_readings`, `telemetry_reservoir`, `faucet_commands`, `alerts`, `device_status_events`) reference `devices.id` and are preserved without cascading mutations across the relational database.
  3. **Strict Admin deviceId Concealment**: Admin users MUST NOT be able to view or edit the external/canonical `deviceId`, across all UI views and API responses (`GET /api/v1/devices`, `GET /api/v1/devices/{deviceId}`, alerts, commands, telemetry). Admin-facing responses omit or mask canonical `deviceId`, presenting only the user-facing device name (`name`) or localized system default display name.
  4. **Hardware & Broker Rename Reconciliation TBD (BLOCKING)**: Operational and hardware procedures for reconciling physical ESP32/NodeMCU firmware configurations, MQTT client identifiers, and EMQX broker credentials/topic ACLs after an Owner renames a `deviceId` are NOT resolved and are marked as **TBD / BLOCKING** further rename automation.
* **Implementation Evidence**:
  - Added `deviceId` to `UpdateDeviceInputSchema` with `.strict()` schema stripping in `packages/contracts/src/device.ts`.
  - Implemented `updateDevice` in `DeviceRepository` (`packages/database/src/device-repository.ts`) with duplicate `deviceId` check throwing `DeviceConflictError`, while preserving immutable UUID primary key (`devices.id`).
  - Added role-based DTO projection (`AdminSafeDeviceDtoSchema`) concealing `deviceId` for Admin role in `GET /api/v1/devices` and `GET /api/v1/devices/{deviceId}` routes while preserving safe immutable UUID `id` and `permissions.canView/canControl`.
  - Hardened `GET /api/v1/devices/{deviceId}` with early `requirePermission(session, 'device.read')` and active account enforcement before DB querying to eliminate device-existence leakage (`TASK-0305`).
  - Verified query performance on Supabase staging DB: index-only scan on `user_device_access_active_user_device_unique` for Admin assignment filtering, zero N+1 queries, and zero DB performance regression.
  - Updated `apps/web/app/devices/page.tsx` displaying `deviceId` badges only to Owners, and providing Owner Edit Modal for `deviceId` and `name` updates.
  - Verified 100% test pass on route authorization, IDOR prevention, and conflict handling (`apps/web/app/api/v1/devices/test/route.test.ts` 24/24 tests, `packages/database/test/device-repository.test.ts` 10/10 tests, 58/58 combined device tests).

#### DEC-DEV-029: Removal of Previously/Last-Accessed Device History, Persistent Restoration, and Neutral Initial State
* **Related Task IDs**: `TASK-0306`, `TASK-0504`
* **Related Documentation**: `docs/PRD.md` §8.2, `docs/USER_FLOWS.md` §9 (Flow 23, Flow 24), `docs/UI_UX.md` §7.2, `docs/DECISIONS.md` (`DEC-MON-088`)
* **Status**: **APPROVED BY USER (2026-08-18)**
* **Approved Decision**:
  1. **No Stored Access History**: Persistent tracking, storage, and restoration of previously/last-accessed device history across logins, sessions, cookies, or user profile records is completely removed.
  2. **Neutral Fresh Selection Resolution & Route-Scoped Rehydration**: Initial load, fresh login, and bare route visits (`/`, `/sensor`, `/soil` without `?deviceId=`) resolve into a neutral initial state (`selectedDevice = null`). The system does NOT auto-select the first device. Once a user explicitly selects a device on `/sensor` or the header `DeviceSelector`, selection is active in-memory and reflected in the active route URL (`?deviceId=...`). Hard refresh (Ctrl+Shift+R) on a specific device route rehydrates the route candidate after validating it against the fresh `GET /api/v1/devices` server-authorized list, without restoring historical 'last accessed' persistence across sessions. If access to the currently selected device is revoked or unassigned (or if an invalid candidate ID is provided), selection is cleared back to `null` and a notice is displayed without silent fallback.
  3. **Non-Selection History 100% Intact**: This removal strictly applies to the device selector and access tracking. It does NOT remove or affect:
     - Telemetry historical data and charts (`TASK-0503` / `TASK-0504`, `/soil`, `/water`);
     - Faucet command execution and event history;
     - User-device assignment and revocation history (`user_device_access` with `revokedAt`);
     - Device connectivity and status history (`device_status_events`);
     - Security, authentication, and audit history (`audit_logs`).

#### DEC-MON-087: Historical Query API Range Bounds, Pagination Limits & Aggregation Policy
* **Related Task IDs**: `TASK-0503`
* **Related Documentation**: `docs/API.md` §17, `docs/DATABASE.md` §8.5, `AGENTS.md` §2
* **Status**: **APPROVED BY PRODUCT OWNER (2026-08-11)**
* **Approved Decision**:
  1. **Default History Range**: Default query range is the last 24 hours (`from` defaults to `now - 24 hours`, `to` defaults to `now`).
  2. **Maximum History Range**: Maximum date range is 31 days (`to - from <= 31 days`). Queries exceeding 31 days are rejected with HTTP 400 (`DATE_RANGE_EXCEEDED`).
  3. **Default Page Size**: Default `pageSize` is `20` per `API.md`.
  4. **Maximum Page Size**: Maximum `pageSize` is `100`. Queries requesting `pageSize > 100` are rejected with HTTP 400 (`VALIDATION_ERROR`).
  5. **Raw Bounded Pagination Only**: `TASK-0503` implements raw bounded pagination only. Bucket aggregation (`interval` parameter) is deferred until its rules are separately approved.
  6. **Telemetry Scope Isolation**: Water-quality history queries remain strictly separate from reservoir water telemetry. Optional combined-history endpoint is unapproved and omitted.

#### DEC-MON-088: Historical Monitoring Chart Component Presentation & Route Resolution
* **Related Task IDs**: `TASK-0504`
* **Related Documentation**: `docs/API.md` §17, `docs/UI_UX.md` §25, `AGENTS.md` §2, §4.1
* **Status**: **APPROVED BY PRODUCT OWNER (2026-08-11)**
* **Approved Decision**:
  1. **Canonical Domain Routes**: Historical telemetry charts render on canonical `/soil` and `/water` routes. Legacy `/tanah` and `/air` paths return 404 Not Found.
  2. **Chart Controls & Metric Selection**: Visual controls allow metric selection, date range adjustments (default 24h, max 31 days per `DEC-MON-087`), and page navigation.
  3. **Null Values & Data Absence**: Missing values are rendered as visual gaps (`connectNulls={false}`). Empty history returns HTTP 200 with an empty series and no-data UI, never fake zero values or a 404 error.
  4. **EC Unit Conversion**: Telemetry EC is stored/contracted in `mS/cm` and converted to `µS/cm` (×1000) deterministically for UI chart presentation.
  5. **Device & Route Synchronization**: Selected device ID is synchronized across domain routes via top-bar `DeviceSelector` in-memory context; persistent restoration of previously/last-accessed device history across logins/sessions is removed per `DEC-DEV-029`.
  6. **Device ID Resolution**: Backend lookups resolve both canonical string `deviceId` (e.g. `soil-node-001`) and internal database UUID `id`.

---

### 2.4 Faucet Control Safety Rules

#### DEC-CTRL-051: Faucet Control Safety Rules
* **Related Task IDs**: `TASK-0801` – `TASK-0809`
* **Related Documentation**: `SECURITY.md` §5.1 – §5.8, `DEVICE_COMMUNICATION.md` §7.1
* **Status**: **APPROVED BY USER**
* **Approved Decision**:
  1. Maximum 1 active command per device (HTTP 409 Conflict if busy).
  2. Automatic retries strictly FORBIDDEN for physical control commands.
  3. `ENABLE_FAUCET_CONTROL=false` by default in environment configuration.
  4. Dual written production sign-off required from BOTH Project Owner AND Hardware Lead before enabling physical control in production (`ENABLE_FAUCET_CONTROL=true`). This blocks **production activation**, not implementation and testing behind the feature flag.
  5. Mandatory `idempotencyKey` on command creation; duplicate command IDs must NEVER trigger repeated physical dispensing.
  6. Command timeout durations (ACK timeout, completion timeout, expiry duration): **TBD** — specific numeric values have not received explicit user approval. Do not hardcode until approved. Timeout events must NEVER be treated as completion regardless of the final values.

---

### 2.5 Infrastructure and Operations

#### DEC-INF-075: Monorepo Structure
* **Related Task IDs**: `TASK-0101`
* **Related Documentation**: `ARCHITECTURE.md` §3.1, `DATABASE.md` §2.1
* **Status**: **APPROVED BY USER**
* **Approved Decision**: npm monorepo workspace containing:
  - `apps/web`
  - `apps/iot-gateway`
  - `packages/database`
  - `packages/contracts`
* Additional packages may be proposed later but are not automatically approved.

---

#### DEC-INF-076: ORM Selection
* **Related Task IDs**: `TASK-0104`
* **Related Documentation**: `DATABASE.md` §2.1
* **Status**: **APPROVED BY USER**
* **Approved Decision**: Prisma selected as ORM for `@kebun-melon/database`.

---

#### DEC-INF-078: Web-to-Gateway Internal Health & Readiness Probe
* **Related Task IDs**: `TASK-0905`
* **Related Documentation**: `docs/API.md` §23, §24; `docs/ARCHITECTURE.md` §32.1, §32.2; `docs/SECURITY.md` §16
* **Status**: **APPROVED BY USER**
* **Approved Decision**:
  1. **Internal Endpoint**: `apps/iot-gateway` shall expose `GET /internal/v1/health` and `GET /internal/v1/ready` matching `docs/API.md` §23.
  2. **Caller Authentication**: Caller authentication is mandatory via `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>`. Secrets must remain strictly environment-only and never appear in logs, responses, or client bundles.
  3. **Configuration**: `apps/web` shall configure `INTERNAL_GATEWAY_URL` and `INTERNAL_SERVICE_TOKEN`. In staging/production, these must be explicitly configured; localhost fallback is rejected. In development/test, default fallback to `http://127.0.0.1:3001` is allowed.
  4. **Probe Timeout**: Approved default probe timeout duration is `INTERNAL_GATEWAY_TIMEOUT_MS=2000` (2000 ms).
  5. **Failure Semantics**:
     - Gateway HTTP 200 $\rightarrow$ `dependencies.gateway = "up"`, `dependencies.broker` as reported by gateway (`"up"` / `"down"`).
     - Gateway HTTP 503 $\rightarrow$ `dependencies.gateway = "up"`, `dependencies.broker` as reported by gateway.
     - Gateway unreachable / network failure / timeout / 401 $\rightarrow$ `dependencies.gateway = "down"`, `dependencies.broker = "down"`.
     - Web overall readiness (`GET /ready`) returns HTTP 200 when `database`, `gateway`, and `broker` are all `"up"`, and HTTP 503 when any dependency is `"down"`.
     - Liveness (`GET /health`) remains strictly independent of all downstream dependency failures (always HTTP 200 `{ "status": "ok" }`).

---


### 2.6 Internationalisation (I18N)

#### DEC-I18N-068: Internationalisation Architecture, Mandatory Initial Language Gate, Settings Locale Selection & Non-Prefixed Cookie Routing
* **Related Task IDs**: `TASK-0601` through `TASK-0605`
* **Related Documentation**: `docs/I18N.md`, `docs/UI_UX.md`, `docs/USER_FLOWS.md`, `docs/PRD.md`, `TASKS.md`, `docs/TESTING.md`, `docs/TRACEABILITY.md`
* **Status**: **APPROVED BY USER**
* **Approved Decision**:
  1. **Locales**: Supported locales are `id` (Bahasa Indonesia) and `en` (English). Default locale is `id`. Fallback locale is `en`.
  2. **Unauthenticated Language-Entry UX**: An unauthenticated visitor with no valid persisted locale cookie MUST NOT see the normal login, register, or account-status UI first. Instead, render a small centered mandatory language-selection gate (`English` → `en`, `Bahasa Indonesia` → `id`) using concise bilingual/language-neutral text.
  3. **Gate Selection & Routing**: After locale selection, validate the locale, persist it in a non-prefixed cookie (`locale`), and render the requested authentication/public page in that locale without altering URL paths (preserving non-prefixed routes like `/login`, `/register`, `/dashboard`). If a valid locale cookie already exists, skip the gate and render requested pages directly.
  4. **Post-Entry Language Changes**: After initial gate selection, language changes are available exclusively from **Settings** (`/settings`), NOT from the application header, user menu, login/register forms, or mobile navigation.
  5. **Authenticated Profile Persistence**: Authenticated locale preference remains stored in the user profile model (`preferredLocale`). Language selection MUST NEVER alter RBAC, device assignment, canonical values, timezone semantics, or permissions.
  6. **TASK-0601 Implementation**: `next-intl` infrastructure configured for `@kebun-melon/web` with locales `id`/`en`, default `id`, fallback `en`, non-prefixed cookie resolution (`locale`), server/client rendering support, bootstrap dictionaries (`messages/id.json`, `messages/en.json`), and safe missing key fallback handling.
  7. **TASK-0603 Implementation**: Hard-coded user-facing UI text migrated to `next-intl` translation keys across all authentication pages, protected dashboard and sensor views, historical charts, faucet controls, and shell navigation. 100% key parity and ICU placeholder consistency verified with 15 unit test suites (107/107 tests passed) and user-reported pre-commit suite.
  8. **TASK-0604 Implementation**: Implemented mandatory initial language gate (`Select Language / Pilih Bahasa`, English -> `en`, Bahasa Indonesia -> `id`) on `(auth)/layout.tsx` for visitors without a valid `locale` cookie. Implemented authenticated language modal selector exclusively on `/pengaturan` (`SettingsLocaleSwitcher`) backed by `PATCH /api/v1/me/preferences` with strict Zod schema validation (`UserPreferenceUpdateInputSchema`), `language.self.update` RBAC check, transactional persistence to `user_preferences` table with `profile.self.updated` audit logging, immediate client-side `locale` cookie synchronization, and `/settings` Next.js permanent redirect. Fixed system default device display labels (`Node Sensor Tanah` <-> `Soil Sensor Node`, `Node Kualitas Air` <-> `Water Quality Node`, `Node Tangki Air` <-> `Water Tank Node`) in presentation layer while preserving custom names, device IDs, and canonical enums. Responsive mobile selector centering and dropdown viewport bounding enforced across 360px, 390px, 430px, and desktop viewports. Verified with 18 unit test suites (136/136 tests passed), 0 TypeScript errors, 32/32 static build routes, automated Playwright desktop/mobile checks, and user-verified credentialed pre-commit suite.

#### DEC-AUTH-102: Password Recovery and Email Reset Architecture via Resend
* **Related Task IDs**: `TASK-0213`
* **Related Documentation**: `docs/SECURITY.md`, `docs/API.md`, `docs/DATABASE.md`, `TASKS.md`, `AGENTS.md`
* **Status**: **APPROVED BY USER**
* **Approved Decision**:
  1. **Email Provider**: Resend is approved as the email service provider for password recovery.
  2. **Token Security**: 256-bit CSPRNG tokens, stored as SHA-256 hashes in `password_reset_tokens` table. Single-use, invalidating prior tokens upon creation and upon successful password reset.
  3. **Approved Expiry & Rate Limits**: 15 minutes token expiry (`AUTH_RESET_TOKEN_EXPIRY_MINUTES = 15`), 3 requests/min for forgot password (`RATE_LIMIT_FORGOT_PASSWORD_MAX = 3`), 5 requests/min for reset password (`RATE_LIMIT_RESET_PASSWORD_MAX = 5`).
  4. **Account Scope**: Supports password recovery for any existing account with email/password regardless of status; password resets preserve existing `accountStatus` (never auto-activates pending accounts).
  5. **Session Revocation**: Password reset transactionally revokes all active sessions for the user.

#### DEC-AUTH-103: Server-Side Guest Route Guard with Zero Page Flash
* **Related Task IDs**: `TASK-0213`
* **Related Documentation**: `docs/SECURITY.md`, `docs/USER_FLOWS.md`, `AGENTS.md`
* **Status**: **APPROVED BY USER**
* **Approved Decision**:
  1. **Server-Side Verification**: Guest-only authentication pages (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) execute `requireGuestSession` server-side before rendering any component HTML.
  2. **Active Session Handling**: If a genuinely valid session with `accountStatus === 'ACTIVE'` exists in PostgreSQL, the server immediately issues an HTTP 307 redirect to `/` with zero HTML streamed for the auth page and zero page flash.
  3. **Stale/Invalid Session Handling**: Invalid, expired, revoked, malformed, or absent session tokens render the guest page normally with zero redirect loops.
  4. **Reset-Password & Verify-Email Policy**: `/reset-password` and `/verify-email` are inaccessible while authenticated; an authenticated user must log out or use an unauthenticated session.

#### DEC-AUTH-104: Mandatory Registration Email Verification
* **Related Task IDs**: `TASK-0214`
* **Related Documentation**: `docs/PRD.md`, `docs/API.md`, `docs/DATABASE.md`, `docs/SECURITY.md`, `docs/USER_FLOWS.md`, `AGENTS.md`, `TASKS.md`
* **Status**: **APPROVED BY USER**
* **Approved Decision**:
  1. **Independent Verification State**: Email ownership verification is tracked via a nullable `emailVerifiedAt` timestamp on the `users` table, completely decoupled from `accountStatus`. Verifying email ownership does NOT modify or auto-activate `accountStatus`.
  2. **Owner Login Gate**: Although the first Owner is created as `ACTIVE`, login and protected access remain strictly blocked with `EMAIL_NOT_VERIFIED` (HTTP 403) until `emailVerifiedAt` is populated.
  3. **Admin Approval Gate**: Pending Admin registrations cannot be approved or rejected by an Owner via `approvePendingAdmin` or `rejectPendingAdmin` until `emailVerifiedAt` is populated (unverified requests return `INVALID_STATUS` / HTTP 409). Unverified Admin accounts are filtered from the active Owner approval queue (`getPendingApprovals`).
  4. **Admin Status Preservation**: Verifying email ownership leaves an Admin account in `PENDING_APPROVAL` status and automatically redirects to `/status?status=PENDING_APPROVAL` until explicitly reviewed and approved by an Owner.
  5. **Session-Free Verification Endpoint**: `POST /api/v1/auth/verify-email` verifies email ownership exclusively and MUST NOT issue, create, or return an authentication session.
  6. **Token Security**: Verification tokens are generated as 256-bit CSPRNG random hex strings. Only the SHA-256 hash is persisted in `email_verification_tokens`. Token expiry is 24 hours (`AUTH_VERIFY_TOKEN_EXPIRY_HOURS = 24`). Creating a new token invalidates prior unused tokens for that user.
  7. **Rate Limiting & Anti-Enumeration**: `POST /api/v1/auth/resend-verification` enforces 3 req/min rate limit (`RATE_LIMIT_RESEND_VERIFICATION_MAX = 3`), timing attack mitigations, and returns generic HTTP 200 without exposing account existence.
  8. **Concurrency & Database Retries**: In `verifyEmailWithToken`, Prisma `P2034` transaction write conflicts are retried with bounded exponential backoff (3 attempts), returning controlled `CONCURRENCY_CONFLICT` (HTTP 409) if exhausted and `TOKEN_ALREADY_USED` (HTTP 400) for `P2025` (deleted token).
  9. **Frontend In-Flight Deduplication**: `/verify-email` utilizes a token-keyed in-flight Promise map with immediate cache eviction upon settlement (`finally`), ensuring exactly 1 network POST in React Strict Mode/remounts while delivering the result to the active mount and removing decorative illustrations for a clean layout.
  10. **Delivery & Testing Status**: Email verification has been manually exercised using Resend test mode/test recipients and the Resend-provided verification link. We have not yet tested delivery to arbitrary real email recipients using a verified custom sending domain, because no such domain is currently configured. Real-mailbox deliverability is treated as pending deployment/infrastructure acceptance, not an application logic failure.

---

### 2.9 UI/UX and Frontend Governance

#### DEC-UIUX-101: Mandatory Frontend Design Governance, Motion Library, and 21st.dev MCP Rules
* **Related Task IDs**: All frontend tasks (`TASK-0303`, `TASK-0501`–`TASK-0704`, etc.)
* **Related Documentation**: `AGENTS.md` §4.1, `docs/UI_UX.md` §25, `FRONTEND_AUDIT.md`
* **Status**: **APPROVED BY USER**
* **Approved Decision**:
  1. **Primary UI Direction**: Every task altering visual UI must select exactly ONE primary UI direction from the 6 approved options (`Premium Minimal Ops`, `Soft Bento Dashboard`, `Swiss Data Minimalism`, `Soft Glass Layers`, `Neo-Industrial Monitoring`, `Editorial Analytics`).
  2. **Color Governance**: Existing Kebun Melon color tokens (`globals.css`) are authoritative and MUST NOT be changed or replaced.
  3. **Motion Library**: Controlled list of 12 approved motion effects (`Page enter`, `Card hover`, `Button hover`, `Sidebar selection`, `Dropdown`, `Modal`, `KPI refresh`, `Chart loading`, `New event`, `Healthy status`, `Critical alert`, `Skeleton loading`). All motion must be subtle, lightweight, performant, non-distracting, and respect `prefers-reduced-motion`.
  4. **Task-Level Declaration**: Agents MUST declare Frontend Impact (`NONE`, `MINOR`, `MATERIAL REDESIGN`), UI direction, Color status (`UNCHANGED`), Motion effects, and 21st.dev MCP requirement before/during implementation.
  5. **21st.dev MCP Governance**: Required BEFORE implementation ONLY for `MATERIAL REDESIGN` (substantial composition changes, new component systems, major dashboard layout redesigns). Not required for minor wiring, text changes, small state indicators, or existing component additions.

---

## 3. Additional Required Decisions (Blockers for Specific Tasks)

The following decisions remain TBD and must be resolved before the listed tasks can begin:

| Decision | Required Before | Notes |
|---|---|---|
| ORM selection (Prisma vs Drizzle) | `TASK-0104` | Approved: Prisma (`DEC-INF-076`). |
| `SameSite` cookie policy exact value | `TASK-0204` | `SameSite=Strict` not yet approved. |
| Device offline threshold (minutes) | `TASK-0407` | No numeric value approved. |
| Device stale threshold (minutes) | `TASK-0407` | No numeric value approved. |
| Command ACK timeout (seconds) | `TASK-0809` | No numeric value approved. |
| Command completion timeout (seconds) | `TASK-0809` | No numeric value approved. |
| Command expiry duration (seconds) | `TASK-0809` | No numeric value approved. |
| Cancellation and stop support (yes/no) | `TASK-0810` | Unresolved. Default: do not implement. |
| Sensor Battery (`BAT`) parameter identity & scope | `TASK-0405`, `TASK-0406` | Resolved per `DEC-MON-086`: `BAT` parameter is completely removed from soil and water quality monitoring. |
| Reservoir-Water Volume and Flow Rate units | `TASK-0408` | Reservoir-water monitoring is a distinct domain from general water quality. Units TBD. |
| Accessibility standard level | `TASK-1006` | WCAG level not yet approved. |
| API performance targets (p95) | `TASK-1007` | No numeric values approved. |
| Physical test run count per faucet phase | `TASK-0811` | No numeric value approved. |
| Telemetry publish interval | `TASK-0405`, `TASK-0406` | Not defined. |
| Heartbeat interval | `TASK-0407` | Not defined. |
| Backup schedule, retention, RPO, RTO | `TASK-0909` | Not yet explicitly approved. |
| Physical device firmware & EMQX credentials/ACLs rename reconciliation | Post-Phase 3 device rename automation | Unresolved operational/hardware workflow (`DEC-DEV-028`). Manual/TBD. |

---

## 4. Approval Log

* **Approver**: Project Owner
* **Approval Date**: 2026-07-27
* **Reconciliation Date**: 2026-07-27
* **Reconciliation Author**: Documentation audit pass (TASK-0002)
* **Status**: All confirmed decisions recorded in `docs/DECISIONS.md` are approved for implementation. Items restored to TBD do not have explicit approval records and must not be used as implementation constants until approved.

---

## Monitoring and Device Decisions Implementation Note (Reconciled 2026-08-19)

The following facts are supported by the current implementation regarding device selection, routing, and monitoring resolution (`TASK-0306`, `TASK-0501`, `TASK-0503`, `TASK-0504`):
- **Frontend Selection/Context/URL:** Consistently uses immutable database `devices.id` UUID as the selected device identity across all routes (`/sensor`, `/soil`, `/water`).
- **Bare Routes & Canonical Paths:** Bare routes (`/`, `/sensor`, `/soil`, `/water`) remain neutral with no automatic first-device fallbacks. Canonical monitoring routes are `/soil` and `/water`; legacy `/tanah` and `/air` routes explicitly return 404.
- **Rehydration & Safety:** Valid `?deviceId=<UUID>` rehydrates only after verifying server authorization. Invalid or revoked IDs safely clear selection to `null` with a user notice.
- **Dual-Lookup Identifier Resolution:** Backend monitoring routes (`/monitoring/latest`, `/monitoring/soil/latest`, `/monitoring/water/latest`, `/monitoring/soil/history`, `/monitoring/water/history`) accept both internal UUID and external canonical `deviceId` string.
- **Admin Concealment & Scoping:** Admin canonical `deviceId` concealment (`DEC-DEV-028`) and assignment isolation (`revokedAt IS NULL`) remain strictly enforced.
- **Empty History Integrity:** Telemetry history queries with zero matching records return HTTP 200 with `{ series: [], pagination: { page: 1, pageSize: 20, totalRecords: 0, totalPages: 1 } }`, never HTTP 404 or fabricated data (`DEC-MON-087`).

## DEC-CTRL-090: Faucet Control Re-Architecture
- **Status:** APPROVED
- **Context:** Faucet control required updates for OPEN/CLOSE, plantCount, and L units in UI.
- **Decision:**
  - Replace Cancel/Stop with Manual OPEN/CLOSE.
  - UI displays L (e.g., 0.3 L) but canonical is integer mL.
  - DISPENSE requires plantCount >= 1. targetVolumeMl = baseVolumeMl * plantCount.
  - Unresolved: fail-safe behavior for OPEN faucet after connection loss. Requires user/hardware approval.

## DEC-CTRL-091: Faucet Control Permissions
- **Status:** APPROVED
- **Decision:** Granular permissions (`device.control.open`, `device.control.close`) are NOT invented. Use existing `device.control`. Any further granularity is TBD.
< ! - -   T A S K - 0 8 0 2   R e c o n c i l e d :   2 0 2 6 - 0 8 - 1 9   - - >  
 