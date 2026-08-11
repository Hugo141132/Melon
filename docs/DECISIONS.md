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

---

### Table 2 — Feature-Specific Approved Decisions Grouped by Subsystem

| Subsystem | Decision IDs | Status | Approved Policy |
|---|---|---|---|
| **Authentication** | `DEC-AUTH-001` to `DEC-AUTH-012` | **APPROVED** | HTTP-only secure cookies, PostgreSQL session table, 30m idle / 12h max timeouts, CLI Owner seed, no public Owner creation. `SameSite` cookie value: **TBD** — pending explicit user approval. |
| **RBAC** | `DEC-RBAC-013` to `DEC-RBAC-019` | **APPROVED** | Owner has global device visibility. Admins have mandatory per-device assignments; device assignment automatically grants both monitoring and faucet control. Owners manage assignments. No separate per-user-device `canControl` permission in v1. |
| **Devices** | `DEC-DEV-020` to `DEC-DEV-035` | **APPROVED** | Multi-protocol architecture: Soil & Water quality monitoring telemetry via REST API over Wi-Fi (no MQTT broker). Water Tank monitoring (tank volume & flow rate) via MQTT through an EMQX broker (MQTT 5.0 over TLS via IoT Gateway). Shared INA219 electrical monitoring via REST/Wi-Fi. Per-device credentials/ACLs, no anonymous access, no direct browser-to-MQTT. Offline threshold: **TBD**. Stale threshold: **TBD**. |
| **Monitoring** | `DEC-MON-036` to `DEC-MON-050` | **APPROVED** | Three distinct monitoring domains: 1) Soil monitoring (NPK, Temp, Moisture, pH, EC, status), 2) Water Quality monitoring (pH, TDS in ppm, EC, status), 3) Water Tank monitoring (Tank Vol in `L`, Flow in `m³/h`, status). Control capabilities (Solenoid Valve, Relay) are actuators, not monitoring sensors. INA219 electrical monitoring tracks system electrical consumption (voltage, current, power) as device health/power telemetry, not as a battery percentage or primary agronomic measurement. Sensor precision and valid ranges: **TBD**. |
| **Faucet Control** | `DEC-CTRL-051` to `DEC-CTRL-067` | **APPROVED** | Max 1 active command/device, no auto retries, `ENABLE_FAUCET_CONTROL=false` default, dual written sign-off (Owner + Hardware Lead) required before production activation. Duplicate command IDs never re-dispense. Timeout ≠ completion. ACK timeout, completion timeout, expiry duration: **TBD**. Cancellation/stop support: **TBD**. |
| **I18N** | `DEC-I18N-068` to `DEC-I18N-074` | **APPROVED** | Default `id` (Bahasa Indonesia), `en` fallback, cookie-based locale routing (no URL path pollution), UTC storage with `Asia/Jakarta` (WIB) presentation. |
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
| `TASK-0803` | Implement Faucet Command API | `BLOCKED` | Depends on `TASK-0801` (BLOCKED), `TASK-0802`, and `TASK-0304`. |
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
* **Status**: **DECISION REQUIRED FROM USER**
* **Context**: PostgreSQL is the confirmed database. The current `package.json` contains neither Prisma nor Drizzle. Exactly one ORM must be selected before `TASK-0104` begins. Do not install either until this decision is recorded.
* **Recommendation**: Prisma — mature migration system, type-safe client, broad Next.js ecosystem support.
* **Required Action**: Record the selected ORM here once the user decides.

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
| Sensor Battery (`BAT`) parameter identity & scope | `TASK-0405`, `TASK-0406` | Approved: `BAT` stands for Battery, incorporated into soil and water quality sensors (`DEC-MON-085`). |
| Reservoir-Water Volume and Flow Rate units | `TASK-0408` | Reservoir-water monitoring is a distinct domain from general water quality. Units TBD. |
| Accessibility standard level | `TASK-1006` | WCAG level not yet approved. |
| API performance targets (p95) | `TASK-1007` | No numeric values approved. |
| Physical test run count per faucet phase | `TASK-0811` | No numeric value approved. |
| Telemetry publish interval | `TASK-0405`, `TASK-0406` | Not defined. |
| Heartbeat interval | `TASK-0407` | Not defined. |
| Backup schedule, retention, RPO, RTO | `TASK-0909` | Not yet explicitly approved. |

---

## 4. Approval Log

* **Approver**: Project Owner
* **Approval Date**: 2026-07-27
* **Reconciliation Date**: 2026-07-27
* **Reconciliation Author**: Documentation audit pass (TASK-0002)
* **Status**: All confirmed decisions recorded in `docs/DECISIONS.md` are approved for implementation. Items restored to TBD do not have explicit approval records and must not be used as implementation constants until approved.
