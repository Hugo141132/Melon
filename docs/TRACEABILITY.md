# System Requirement Traceability Matrix: Kebun Melon

> **Task Reference:** `TASK-0003 — Establish Requirement IDs`
> **Status:** DEFINED & RECONCILED (2026-08-26 — Synchronized with completed TASKS.md backlog)
> **Source of Truth Rule:** All requirement identifiers use standard 3-digit sequential numbering per family starting at `001`.

---

## Traceability Table

| Requirement ID | Requirement Summary | Source Document | Related Decision IDs | Related Task IDs | Related Test IDs | Status |
|---|---|---|---|---|---|---|
| `PRD-FR-001` | Authenticated access to monitoring system | `docs/PRD.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-002` | Multi-device ESP32/NodeMCU support | `docs/PRD.md` | `DEC-DEV-020` | `TASK-0302` | `TEST-API-003` | `VERIFIED` |
| `PRD-FR-003` | Display latest soil and water monitoring data | `docs/PRD.md` | `DEC-MON-036` | `TASK-0502` | `TEST-E2E-003` | `VERIFIED` |
| `PRD-FR-004` | Display device connectivity and status | `docs/PRD.md` | `` | `TASK-0407` | `TEST-MQTT-002` | `DEFERRED` |
| `PRD-FR-005` | Store and present historical monitoring data | `docs/PRD.md` | `DEC-MON-087` | `TASK-0503` | `TEST-API-004` | `IMPLEMENTED` |
| `PRD-FR-006` | Send predefined faucet-control commands | `docs/PRD.md` | `DEC-CTRL-051` | `TASK-0803` | `TEST-CTRL-001` | `IMPLEMENTED` |
| `PRD-FR-007` | Record faucet-control activity and outcomes | `docs/PRD.md` | `DEC-CTRL-051` | `TASK-0802` | `TEST-DB-002` | `IMPLEMENTED` |
| `PRD-FR-008` | Enforce Owner and Admin RBAC permissions | `docs/PRD.md` | `DEC-RBAC-015` | `TASK-0209` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-009` | Require Owner approval for new Admin registrations | `docs/PRD.md` | `DEC-AUTH-006` | `TASK-0203` | `TEST-E2E-002` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-010` | Provide English and Bahasa Indonesia UI | `docs/PRD.md` | `DEC-I18N-068` | `TASK-0603` | `TEST-E2E-004` | `VERIFIED` |
| `PRD-FR-011` | Preserve existing visual frontend design | `docs/PRD.md` | - | `TASK-0001` | `TEST-E2E-001` | `IMPLEMENTED` |
| `PRD-FR-012` | Separate website logic from hardware measurement implementation | `docs/PRD.md` | `DEC-DEV-020` | `TASK-0401` | `TEST-MQTT-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-013` | Owner role capabilities and management scope | `docs/PRD.md` | `DEC-RBAC-013` | `TASK-0212` | `TEST-SEC-002` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-014` | Admin role capabilities and scope limits | `docs/PRD.md` | `DEC-RBAC-015` | `TASK-0211` | `TEST-SEC-002` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-015` | Access restriction to authenticated users | `docs/PRD.md` | `DEC-AUTH-001` | `TASK-0210` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-016` | Admin account self-registration submission | `docs/PRD.md` | `DEC-AUTH-006` | `TASK-0203` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-017` | Admin approval workflow and account status transitions | `docs/PRD.md` | `DEC-AUTH-006` | `TASK-0207` | `TEST-API-002` | `IMPLEMENTED` |
| `PRD-FR-018` | First Owner account seed provisioning | `docs/PRD.md` | `DEC-AUTH-006` | `TASK-0106` | `TEST-API-002` | `IMPLEMENTED` |
| `PRD-FR-019` | Login behavior and account-status validation | `docs/PRD.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-020` | Multi-device support and metadata tracking | `docs/PRD.md` | `DEC-DEV-020` | `TASK-0302` | `TEST-DB-001` | `VERIFIED` |
| `PRD-FR-021` | Device selector interface and context persistence | `docs/PRD.md` | - | `TASK-0306` | `TEST-E2E-003` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-022` | Device access scope enforcement | `docs/PRD.md` | `DEC-RBAC-016` | `TASK-0304` | `TEST-SEC-003` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-023` | Soil monitoring metrics display | `docs/PRD.md` | `DEC-MON-036` | `TASK-0501` | `TEST-API-003` | `VERIFIED` |
| `PRD-FR-024` | Self-service verified email address change | `docs/PRD.md` | `DEC-AUTH-106` | `TASK-0216` | `TEST-API-001` | `VERIFIED` |
| `PRD-FR-025` | Single active session enforcement per account | `docs/PRD.md` | `DEC-AUTH-107` | `TASK-0217` | `TEST-SEC-001` | `VERIFIED` |
| `SEC-AUTH-006` | Email change token scoping and non-sensitive audit logging | `docs/SECURITY.md` | `DEC-AUTH-106` | `TASK-0216` | `TEST-SEC-005` | `VERIFIED` |
| `SEC-AUTH-007` | Atomic single active session verification and race-safe login rejection | `docs/SECURITY.md` | `DEC-AUTH-107` | `TASK-0217` | `TEST-SEC-001` | `VERIFIED` |
| `SEC-DATA-003` | Content Security Policy (CSP) and security headers | `docs/SECURITY.md` | - | `TASK-0901` | `TEST-SEC-005` | `IMPLEMENTED` |
| `SEC-DATA-004` | Immutable append-only audit log storage | `docs/SECURITY.md` | - | `TASK-0903` | `TEST-DB-002` | `READY_FOR_IMPLEMENTATION` |
| `SEC-OPS-001` | Automated secret scanning in CI pipeline | `docs/SECURITY.md` | - | `TASK-0906` | `TEST-SEC-005` | `IMPLEMENTED` |
| `SEC-OPS-002` | API rate limiting on authentication and control endpoints | `docs/SECURITY.md` | - | `TASK-0902` | `TEST-SEC-005` | `DECISION_REQUIRED` |
| `SEC-OPS-003` | Database backup encryption and offsite storage | `docs/SECURITY.md` | - | `TASK-0909` | `TEST-SEC-005` | `DECISION_REQUIRED` |
| `SEC-OPS-004` | Automated vulnerability scanning of dependencies | `docs/SECURITY.md` | - | `TASK-0906` | `TEST-SEC-005` | `IMPLEMENTED` |
| `TEST-UNIT-001` | Environment variable validation unit tests | `docs/TESTING.md` | - | `TASK-0103` | `TEST-UNIT-001` | `VERIFIED` |

| `TEST-UNIT-002` | Role and permission matrix unit tests | `docs/TESTING.md` | - | `TASK-0105` | `TEST-UNIT-002` | `VERIFIED` |
| `TEST-UNIT-003` | Telemetry data freshness and status unit tests | `docs/TESTING.md` | `` | `TASK-0407` | `TEST-UNIT-003` | `DEFERRED` |
| `TEST-UNIT-004` | I18N locale key and translation unit tests | `docs/TESTING.md` | `DEC-I18N-068` | `TASK-0601` | `TEST-UNIT-004` | `VERIFIED` |
| `TEST-UNIT-005` | Utility and format helper unit tests | `docs/TESTING.md` | - | `TASK-0102` | `TEST-UNIT-005` | `VERIFIED` |
| `TEST-API-001` | Authentication API endpoint integration tests | `docs/TESTING.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `TEST-API-002` | User and approval API integration tests | `docs/TESTING.md` | `DEC-AUTH-006` | `TASK-0207` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `TEST-API-003` | Device and monitoring API integration tests | `docs/TESTING.md` | `DEC-MON-036` | `TASK-0501` | `TEST-API-003` | `VERIFIED` |
| `TEST-API-004` | Historical query API integration tests | `docs/TESTING.md` | `DEC-MON-087` | `TASK-0503` | `TEST-API-004` | `VERIFIED` |
| `TEST-API-005` | Alerts and audit log API integration tests | `docs/TESTING.md` | - | `TASK-0701` | `TEST-API-005` | `READY_FOR_IMPLEMENTATION` |
| `TEST-DB-001` | Database migration and schema constraint tests | `docs/TESTING.md` | `DEC-INF-075` | `TASK-0104` | `TEST-DB-001` | `DEFINED` |
| `TEST-DB-002` | Audit log and command history append-only tests | `docs/TESTING.md` | - | `TASK-0903` | `TEST-DB-002` | `READY_FOR_IMPLEMENTATION` |
| `TEST-DB-003` | Database foreign key constraint cascade tests | `docs/TESTING.md` | `DEC-INF-075` | `TASK-0104` | `TEST-DB-003` | `DEFINED` |
| `TEST-E2E-001` | Critical path login and landing page E2E test | `docs/TESTING.md` | `DEC-AUTH-001` | `TASK-1004` | `TEST-E2E-001` | `READY_FOR_IMPLEMENTATION` |
| `TEST-E2E-002` | Admin registration and Owner approval E2E test | `docs/TESTING.md` | `DEC-AUTH-006` | `TASK-1004` | `TEST-E2E-002` | `READY_FOR_IMPLEMENTATION` |
| `TEST-E2E-003` | Device selection and monitoring dashboard E2E test | `docs/TESTING.md` | `DEC-MON-036` | `TASK-1004` | `TEST-E2E-003` | `READY_FOR_IMPLEMENTATION` |
| `TEST-E2E-004` | Language switching and locale persistence E2E test | `docs/TESTING.md` | `DEC-I18N-068` | `TASK-1004` | `TEST-E2E-004` | `READY_FOR_IMPLEMENTATION` |
| `TEST-E2E-005` | Accessibility keyboard navigation and screen reader test | `docs/TESTING.md` | `` | `TASK-1006` | `TEST-E2E-005` | `DECISION_REQUIRED` |
| `TEST-MQTT-001` | MQTT topic routing and payload contract tests | `docs/TESTING.md` | `DEC-DEV-020` | `TASK-1003` | `TEST-MQTT-001` | `READY_FOR_IMPLEMENTATION` |
| `TEST-MQTT-002` | MQTT ACL security and Last Will handling tests | `docs/TESTING.md` | `DEC-DEV-020` | `TASK-1003` | `TEST-MQTT-002` | `READY_FOR_IMPLEMENTATION` |
| `TEST-MQTT-003` | Telemetry ingestion latency and duplicate tests | `docs/TESTING.md` | `DEC-DEV-020` | `TASK-1003` | `TEST-MQTT-003` | `READY_FOR_IMPLEMENTATION` |
| `TEST-MQTT-004` | Faucet command MQTT publication and ACK contract tests | `docs/TESTING.md` | `DEC-CTRL-051` | `TASK-1003` | `TEST-MQTT-004` | `READY_FOR_IMPLEMENTATION` |
| `TEST-SEC-001` | Account status access enforcement security tests | `docs/TESTING.md` | `DEC-AUTH-001` | `TASK-1005` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `TEST-SEC-002` | RBAC role boundary and self-promotion security tests | `docs/TESTING.md` | `DEC-RBAC-015` | `TASK-1005` | `TEST-SEC-002` | `READY_FOR_IMPLEMENTATION` |
| `TEST-SEC-003` | Device isolation and URL manipulation security tests | `docs/TESTING.md` | `DEC-RBAC-016` | `TASK-1005` | `TEST-SEC-003` | `READY_FOR_IMPLEMENTATION` |
| `TEST-SEC-004` | MQTT broker authentication and TLS security tests | `docs/TESTING.md` | `DEC-DEV-020` | `TASK-1005` | `TEST-SEC-004` | `READY_FOR_IMPLEMENTATION` |
| `TEST-SEC-005` | Secret redaction and security headers test suite | `docs/TESTING.md` | - | `TASK-1005` | `TEST-SEC-005` | `READY_FOR_IMPLEMENTATION` |
| `TEST-CTRL-001` | Preset volume mapping contract tests | `docs/TESTING.md` | `DEC-CTRL-051` | `TASK-0802` | `TEST-CTRL-001` | `VERIFIED` |
| `TEST-CTRL-002` | Faucet command state machine transition tests | `docs/TESTING.md` | `DEC-CTRL-051` | `TASK-0806` | `TEST-CTRL-002` | `VERIFIED` |
| `TEST-CTRL-003` | Faucet command idempotency and duplicate tests | `docs/TESTING.md` | `DEC-CTRL-051` | `TASK-0808` | `TEST-CTRL-003` | `IMPLEMENTED` |
| `TEST-CTRL-004` | Faucet command timeout and expiry handling tests | `docs/TESTING.md` | `DEC-CTRL-051` | `TASK-0809` | `TEST-CTRL-004` | `DEFERRED` |
| `TEST-CTRL-005` | Faucet control feature flag and dual sign-off tests | `docs/TESTING.md` | `DEC-CTRL-067` | `TASK-0801` | `TEST-CTRL-005` | `READY_FOR_IMPLEMENTATION` |

---

## Monitoring and Traceability Implementation Note (Reconciled 2026-08-19)

The following facts are verified in the traceability matrix regarding device selection, routing, and monitoring resolution (`TASK-0306`, `TASK-0501`, `TASK-0503`, `TASK-0504`):
- **Frontend Selection/Context/URL:** Consistently uses immutable `devices.id` UUID.
- **Bare Routes:** Remain neutral with no auto-selection (`/`, `/sensor`, `/soil`, `/water`).
- **Rehydration:** Valid `?deviceId=<UUID>` rehydrates after authorization on hard refresh.
- **Invalid/Revoked IDs:** Clear selection safely to `null` with a notice banner.
- **Admin Privacy:** Admin canonical `deviceId` concealment remains enforced.
- **Legacy Routes:** `/air` and `/tanah` are explicitly maintained as legacy 404 routes.
- **Traceability Verification:** `API-MON-001`, `API-MON-002`, `TEST-API-003`, and `TEST-API-004` statuses are updated to `VERIFIED` reflecting completed route implementation, dual UUID/canonical identifier resolution, and 100% test pass rate across targeted test suites.

<!-- Reconciled for Manual Faucet Open/Close Control and Volume Presets -->
< ! - -   T A S K - 0 8 0 2   R e c o n c i l e d :   2 0 2 6 - 0 8 - 1 9   - - >

---

## Gateway Command Publishing Traceability Implementation Note (Reconciled 2026-08-20)

The following facts are verified in the traceability matrix regarding `TASK-0804` (`CommandPublisher` in `@kebun-melon/iot-gateway`):
- **Implementation Status:** `TASK-0804` is implemented and verified (`apps/iot-gateway/src/__tests__/command-publisher.test.ts`, 10/10 tests passed; gateway contract suites 42/42 passed).
- **Target Volume Passthrough:** For `DISPENSE` actions, the publisher consumes the canonical integer `targetVolumeMl` persisted during `TASK-0803` API command creation without recalculating from `phase` or `plantCount`.
- **Manual Control Schema:** Cleanly formats `OPEN` and `CLOSE` commands by omitting `phase`, `plantCount`, and `targetVolumeMl`.
- **State Progression:** Atomically transitions database status from `QUEUED` to `SENT` only after broker confirms publication. Expired commands are marked `EXPIRED` without transmission.
- **Dependency Isolation:** Downstream tasks (`TASK-0806` command state machine, `TASK-1003` MQTT E2E test suites) remain distinct and pending.
<!-- TASK-0804 Reconciled: 2026-08-20 -->

---

## Device Acknowledgement Processing Traceability Implementation Note (Reconciled 2026-08-20)

The following facts are verified in the traceability matrix regarding `TASK-0805` (`AcknowledgementProcessor` in `@kebun-melon/iot-gateway`):
- **Implementation Status:** `TASK-0805` is implemented and verified (`apps/iot-gateway/src/__tests__/acknowledgement-processor.test.ts`, 25/25 tests passed; gateway test suites 195/195 passed; contracts/database 228/228 passed).
- **Contract Integrity:** Authoritative ACK contract strictly identifies target commands via `commandId` and device identity (`deviceId`) on QoS 1 topic `agriculture/{environment}/{siteId}/{deviceId}/ack/faucet` without fabricating an action in the MQTT ACK payload.
- **Persisted Action Validation:** Persisted command action is retrieved and validated against `[DISPENSE, OPEN, CLOSE]`, rejecting unsupported actions with `{ success: false }`.
- **State Transition Integrity:** Accepted ACKs transition `SENT` → `ACKNOWLEDGED` only (never transitioning to `COMPLETED` or inferring physical state). Rejected ACKs transition `SENT` → `FAILED` with canonical `reasonCode` and generate `CommandFailureAlert`.
- **Idempotency & Non-Regression:** Duplicate `messageId` handling is verified idempotent against stored event history; non-`SENT` / late / out-of-order ACKs are safely ignored without state regression; and `WATER_TANK_NODE` device type scoping is enforced.
- **Verification & Microbenchmark Summary:** Clean typecheck, 0 Semgrep findings, and 0 errors/regressions across in-memory performance sanity scenarios (sequential: 3,979 ACKs/sec, burst: 7,579 ACKs/sec, duplicate: 5,887 ACKs/sec, soak: 4,453 ACKs/sec; clearly labeled as in-memory microbenchmarks). Live staging MQTT/hardware verification remains credential/manual dependent.
- **Downstream Decoupling:** Downstream execution state machine events (`TASK-0806`), duplicate command protection (`TASK-0808`), and timeout processing (`TASK-0809`) remain distinct and decoupled.
<!-- TASK-0805 Reconciled: 2026-08-20 -->

---

## Command Event State Machine Traceability Implementation Note (Reconciled 2026-08-20)

The following facts are verified in the traceability matrix regarding `TASK-0806` (`FaucetEventProcessor` in `@kebun-melon/iot-gateway`):
- **Implementation Status:** `TASK-0806` is implemented and verified (`apps/iot-gateway/src/__tests__/faucet-event-processor.test.ts`, 30/30 tests passed; device simulator suite 25/25 passed; full gateway test suites 210/210 passed; full workspace test suites 934/934 passed; typecheck 0 errors).
- **Authoritative Physical State:** Physical faucet state confirmation is strictly mapped: `COMPLETED OPEN` → `OPEN`, `COMPLETED CLOSE` → `CLOSED`, `COMPLETED DISPENSE` → `UNKNOWN` (strictly avoiding inferring closed valve without direct physical sensor confirmation), `FAILED` / `IN_PROGRESS` / timeout / uncertain → `UNKNOWN`. Physical state is NEVER inferred from API acceptance, publication, or ACK.
- **Persisted Action Validation:** Commands are resolved via `commandId` + `deviceId` and validated against persisted action (`DISPENSE`, `OPEN`, `CLOSE`).
- **Volume Handling Rules:** `DISPENSE` validates non-negative `actualVolumeMl` and target volume match if provided; `OPEN` and `CLOSE` treat volume measurement as non-applicable and store `null`/`undefined` on the command record.
- **State Machine Safeguards:** Enforces `ACKNOWLEDGED` → `IN_PROGRESS` → `COMPLETED`, `ACKNOWLEDGED`/`IN_PROGRESS` → `FAILED`, terminal-state immutability (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `EXPIRED`), duplicate `messageId` idempotency, progress event appending, and `CommandFailureAlert` dispatching on `FAILED` execution events.
- **Audit & Persistence:** Appends immutable audit records to `faucet_command_events` alongside mutable `faucet_commands` status with zero CQRS/event-sourcing claim.
- **Local In-Memory Benchmark:** Evaluated 7,500 events (sequential: 4,609 ops/s, burst: 4,178 ops/s, duplicate: 7,334 ops/s, soak: 3,422 ops/s) with 0 regressions, 0 terminal mutations, 0 duplicate redundant writes, 0 unexpected errors (targets TBD).
- **Testing Boundary:** Live local faucet MQTT E2E was not completed because the local Mosquitto test fixture lacks a matching `WATER_TANK_NODE` credential/ACL identity; live MQTT TLS and physical HIL verification remain credential/manual dependent.
- **Downstream Decoupling:** Downstream duplicate command protection (`TASK-0808`) and timeout processing (`TASK-0809`) remain distinct and decoupled.
<!-- TASK-0806 Reconciled: 2026-08-20 -->

---

## Faucet Control UI Traceability Implementation Note (Reconciled 2026-08-20)

The following facts are verified in the traceability matrix regarding `TASK-0807` (Faucet Control UI on `/controls` in `@kebun-melon/web`):
- **Implementation Status:** `TASK-0807` is implemented and verified (`apps/web/test/unit/faucet-control-ui.test.tsx`, 24/24 tests passed).
- **Preset Volume & Plant Calculations:** Presents Phase 1 (0.3 L), Phase 2 (1.0 L), Phase 3 (1.5 L) with `plantCount` stepper ($\ge 1$) and live dynamic volume calculation preview (`0.3 L × 3 tanaman = 0.9 L`).
- **Action Compatibility:** Provides action-aware modal confirmation for `DISPENSE` and manual `OPEN`/`CLOSE` with safety warnings.
- **Idempotency Integration:** Dispatches unique `cmd-<uuid>` via standard HTTP header `Idempotency-Key` without arbitrary JSON body payload injection.
- **Polling Lifecycle:** Actively polls `GET /api/v1/devices/{deviceId}/faucet-commands/{commandId}` every 2,500ms strictly during active states (`QUEUED`, `SENT`, `ACKNOWLEDGED`, `IN_PROGRESS`) and terminates immediately upon terminal states.
- **Authoritative Physical State:** Badges authoritative physical valve state as `OPEN` (completed open), `CLOSED` (completed close), or `UNKNOWN` (active commands, failures, and dispense completions).
- **Performance Benchmarks:** UI mount latency ($31\text{ ms} < 50\text{ ms}$), stepper interaction latency ($1.2\text{ ms}$), preset switch ($1.8\text{ ms}$), 50 modal open/close cycles memory clean, 0 horizontal overflow across Mobile/Tablet/Desktop viewports.
- **Scope Demarcation:** `TASK-0808` (Idempotency duplicate revalidation) is implemented and verified. `TASK-0809` (command timeout), `TASK-0810` (active command cancel), and `TASK-0811` (physical HIL testing) remain pending downstream tasks.
<!-- TASK-0807 Reconciled: 2026-08-20 -->

The following facts are verified in the traceability matrix regarding `TASK-0808` (Duplicate Command Protection in `@kebun-melon/database`):
- **Implementation Status:** `TASK-0808` is implemented and verified (`packages/database/src/__tests__/faucet-command-repository.test.ts`, 21/21 tests passed; full API route suites 31/31 passed).
- **Scope Demarcation:** Duplicate command protection semantic checks are implemented and decouple execution state (`TASK-0806`) and timeout tasks (`TASK-0809`).
<!-- TASK-0808 Reconciled: 2026-08-20 -->

---

## Manual Faucet Open/Close Control Traceability Implementation Note (Reconciled 2026-08-21)

The following facts are verified in the traceability matrix regarding `TASK-0810` (Manual Faucet Open/Close Control across Monorepo):
- **Implementation Status:** `TASK-0810` is implemented and verified (`packages/contracts/src/__tests__/audit.test.ts` 9/9 passed, `packages/database/src/__tests__/faucet-command-repository.test.ts` 23/23 passed, full faucet suite 114/114 passed, full monorepo suite 955/955 passed, typecheck 0 errors, lint 0 errors).
- **Requirements & Decoupling:** Fulfills `DEC-CTRL-090` by supporting discrete `OPEN` and `CLOSE` actions, enforcing strict absence of volume/phase parameters, and recording dedicated audit events (`faucet.command.open.created`, `faucet.command.close.created`).
- **Physical Valve State Integrity:** Physical state confirmation is deterministically bounded (`COMPLETED OPEN` → `OPEN`, `COMPLETED CLOSE` → `CLOSED`, `COMPLETED DISPENSE` → `UNKNOWN`, in-flight/failed → `UNKNOWN`), preventing false claims of closed valves after dispensing.
- **Fail-Safe Policy Demarcation:** Hardware fail-safe valve behavior upon connection loss remains an explicit `UNRESOLVED / TBD` item (`DEC-CTRL-090`), isolated safely by software state mapping and `ENABLE_FAUCET_CONTROL=false` environment gating.
<!-- TASK-0810 Reconciled: 2026-08-21 -->

---

## Complete Unit Test Suite Traceability Implementation Note (Reconciled 2026-08-21)

The following facts are verified in the traceability matrix regarding `TASK-1001` (Complete Unit Test Suite across Monorepo):
- **Implementation Status:** `TASK-1001` is implemented and verified (`102` test files passed, `958/958` tests passed, >99.6% line coverage in `@kebun-melon/contracts`, clean pre-commit quality gate `npm run check:quality`).
- **Domain Coverage Verified:** Covers all 8 mandatory acceptance domains: account status decisions, RBAC permission checks, device access isolation, telemetry validation (`BAT` parameter omitted per `DEC-MON-086`), phase/volume calculations, command state machine deterministic transitions, idempotency deduplication, and bilingual locale parity (`DEC-I18N-068`).
- **Safety Flags & Decisions:** `ENABLE_FAUCET_CONTROL=false` safety default is maintained, and uncertain/timeout states are strictly asserted as `UNKNOWN` without inventing timeout thresholds (`DEC-CTRL-092`).
<!-- TASK-1001 Reconciled: 2026-08-21 -->

---

## Email Verification Code & Resend Reliability Traceability Implementation Note (Reconciled 2026-08-22)

The following facts are verified in the traceability matrix regarding `TASK-0213` and `TASK-0214` (Password Recovery & 6-Digit Email Verification Code Flow):
- **Implementation Status:** `TASK-0213` and `TASK-0214` are implemented and verified (`31` unit test suites, `255/255` tests passed in web/database; `12` test suites, `106/106` tests passed in contracts; typecheck 0 errors).
- **Code Security & Hashing:** Verification codes are generated via CSPRNG (`crypto.randomInt(100000, 1000000)`), stored exclusively as scoped SHA-256 hashes `sha256(userId:code)` in `email_verification_tokens.token_hash` to eliminate token collisions across users, and expire after 15 minutes.
- **Resend Reliability & Retry:** Resend email delivery includes `sendWithRetry` with bounded exponential backoff and jitter (up to 3 attempts) handling HTTP 429 rate limits, 5xx server errors, and network timeouts while keeping credentials redacted from logs.
- **Auth UI Conformance:** Decorative illustration frame removed from `/reset-password` conforming to `Premium Minimal Ops` and `UI_UX.md`.
- **Status & Session Integrity:** Verifying email decouples `emailVerifiedAt` from `accountStatus` (`ADMIN` remains `PENDING_APPROVAL`, `OWNER` remains `ACTIVE`), blocks unverified Owner login, blocks unverified Admin approval/rejection, and avoids issuing authentication sessions from verification endpoints.
<!-- TASK-0214 Reconciled: 2026-08-22 -->

---

## Centralized Authentication State Hydration Traceability Implementation Note (Reconciled 2026-08-22)

The following facts are verified in the traceability matrix regarding `TASK-0215` (Centralized Authentication State Hydration):
- **Implementation Status:** `TASK-0215` is implemented and verified (`34` unit test suites, `258/258` tests passed in web; typecheck 0 errors).
- **Global Hydration Architecture:** `RootLayout` performs server-side session retrieval via `getSessionOrNull()` and hydrates `AuthProvider` (`AuthContext`), eliminating client-side layout shift and UI flicker.
- **Redundant Fetch Elimination:** Removed duplicated `fetch('/api/v1/auth/session')` in `page.tsx` (Dashboard) and `setting/page.tsx` (Settings).
- **Component Prop Cleanup:** `TopAppBar` and `Sidebar` consume `useAuth()` directly, removing prop drilling for `user` and `role`.
- **Security & Authorization:** Non-sensitive session metadata only; server-side RBAC validation remains authoritative across all routes and API endpoints.
<!-- TASK-0215 Reconciled: 2026-08-22 -->

---

## Device Lifecycle & Deletion Removal Traceability Implementation Note (Reconciled 2026-08-23)

The following facts are verified in the traceability matrix regarding `TASK-0302` and `TASK-0303` (Device Lifecycle, Activation, and Deletion Removal):
- **Implementation Status:** `TASK-0302` and `TASK-0303` lifecycle enhancements are implemented and verified (`packages/database/test/device-repository.test.ts` 12/12 passed, `apps/web/app/api/v1/devices/test/route.test.ts` 24/24 passed, full pre-commit quality check `npm run check:quality` clean exit code 0).
- **Zero Hard Deletion:** Hard deletion (`DELETE /api/v1/devices/{deviceId}`) is eliminated across UI and API layers per `DEC-DEV-030`, preserving all relational history across telemetry, commands, alerts, and audit logs.
- **Activation & Deactivation Lifecycle:** Implemented `POST /api/v1/devices/{deviceId}/activate` (`device.activate` permission) and `POST /api/v1/devices/{deviceId}/deactivate` (`device.deactivate` permission) restricted strictly to the `OWNER` role.
- **Audit Logging & Safety:** Deactivation and reactivation operations generate `device.deactivated` and `device.activated` audit logs, while deactivated devices automatically have faucet control capabilities blocked.
<!-- TASK-0302 Reconciled: 2026-08-23 -->

---

## Live Sidebar Notification Badge Traceability Implementation Note (Reconciled 2026-08-23)

The following facts are verified in the traceability matrix regarding `TASK-0705` (Live Sidebar Notification Badge Integration):
- **Implementation Status:** `TASK-0705` is implemented and verified (`apps/web/test/unit/sidebar-navigation.test.tsx` 10/10 tests passed, full web unit test suite 246/246 tests passed, workspace typecheck 0 errors).
- **Dynamic API Binding:** Replaced legacy static mock `ALERTS` constant filter with lightweight client hook `useAlertBadge`, querying canonical backend `GET /api/v1/alerts?status=OPEN&severity=CRITICAL`.
- **Event-Driven Reactivity:** Subscribes to custom browser event `melon:alert-updated` emitted on alert acknowledgement in `/notifikasi` page, guaranteeing immediate badge count synchronization without requiring a page reload.
- **Visual Design Integrity:** Preserves `Premium Minimal Ops` layout, badge placement, and design tokens (`bg-app-error text-white text-[9px] font-bold`) with automatic zero-count suppression.
<!-- TASK-0705 Reconciled: 2026-08-23 -->

---

## Telemetry Data Retention & Maintenance Policy Traceability Note (Reconciled 2026-08-24)

The following facts are verified in the traceability matrix regarding `TASK-0913` (Telemetry Data Retention and Automated Maintenance Policy):
- **Implementation Status:** `TASK-0913` is implemented and verified (`packages/database/test/retention-service.test.ts` 8/8 passed, `apps/iot-gateway/src/__tests__/retention-scheduler.test.ts` 6/6 passed, full gateway suite 216/216 passed, database suite 108/108 passed, historical query suite 13/13 passed, typecheck 0 errors, security scan clean).
- **Lifecycle & Storage Management:** Enforces 90-day retention cutoff (`DEC-MON-048`) across high-frequency raw telemetry (`soil_readings`, `water_readings`, `reservoir_water_readings`, `sensor_battery_readings`) and operational event tables (`device_status_events`, `integration_errors`).
- **Strict Compliance Protection (`SEC-DATA-004`):** Compliance/security audit logs (`audit_logs`), actuator commands (`faucet_commands`, `faucet_command_events`), and account approvals (`account_approvals`) are explicitly marked as non-purgeable and exempt from cleanup.
- **Lock-Free Chunked Batching:** Database pruning uses primary-key-indexed batch chunks (`batchSize: 1000`, `yieldMs: 20`) via `RetentionService`, eliminating table lock escalation and transaction timeouts.
- **Background Orchestration:** Integrated into `apps/iot-gateway` via `RetentionScheduler` (default 24h interval) with overlap guard and structured JSON logging. Standalone operator execution enabled via `npm run db:cleanup` (`scripts/cleanup-retention.ts`).
<!-- TASK-0913 Reconciled: 2026-08-24 -->

---

## Direct EMQX Cloud Connectivity & Device Simulator Traceability Note (Reconciled 2026-08-26)

The following facts are verified in the traceability matrix regarding `TASK-0914` (Configure Direct EMQX Cloud Connectivity for Local IoT Gateway):
- **Implementation Status:** `TASK-0914` is implemented and verified (`apps/iot-gateway/src/__tests__/emqx-connectivity.test.ts` 7/7 passed, `apps/iot-gateway/src/__tests__/device-simulator.test.ts` 26/26 passed, `apps/iot-gateway/src/__tests__/broker-config.test.ts` 7/7 passed, `scripts/test-env.ts` 18/18 passed, secrets scan 0 findings).
- **Broker Topology:** Local development of `apps/iot-gateway` connects directly to EMQX Cloud over TLS (`mqtts://` port 8883 / `wss://` port 8084); Railway is not an MQTT proxy and Docker/Mosquitto is retained as an optional fallback only.
- **Topic & Identity Isolation:** Partitioned into isolated `agriculture/development/...` vs `agriculture/staging/...` namespaces with unique client IDs (`gateway-kebun-melon-dev-local-*` vs `gateway-kebun-melon-staging-*` vs `sim-${tankDeviceId}-${random}`).
- **Dynamic Simulator Identity:** `WATER_TANK_NODE` simulator resolves canonical target device ID at runtime via CLI (`--tank-device-id`, `--device-id`) or environment variables (`MQTT_TANK_DEVICE_ID`, `MQTT_DEVICE_ID`), eliminating hardcoded hardware IDs in source code. Exact topic `deviceId` and payload `deviceId` match is enforced.
- **Verification Scope:** Live development gateway, EMQX Cloud broker, and canonical development device live ingestion verified. Monitoring UI smoke testing was intentionally deferred/skipped. Staging deployment requires no update.
<!-- TASK-0914 Reconciled: 2026-08-26 -->

---

## Controls Loading Experience & Responsive Header Centering Traceability Note (Reconciled 2026-08-27)

The following facts are verified in the traceability matrix regarding `TASK-0807`, `TASK-0502`, `TASK-0306`, and `TASK-1004` (`/controls` Loading Stability & Header Centering):
- **Traceability Baseline:** Traced as UI regressions discovered during `TASK-1004` staging verification and resolved under `TASK-0807` (Faucet Control UI), `TASK-0502` (Telemetry Freshness & Presentation), and `TASK-0306` (Device Selector State).
- **Implementation Status:**
  - `TASK-0807`: `DONE` (reconciled with route loading shell `apps/web/app/controls/loading.tsx`, structured skeletons in `WaterTankMonitoringCard` & `FaucetHistoryTable`, and `useAuth()` hydration).
  - `TASK-0306`: `DONE` (reconciled with balanced 3-column CSS Grid in `TopAppBar` and centered dropdown overlay in `DeviceSelector`).
  - `TASK-1004`: `IN_PROGRESS` (Phase 10 staging infrastructure verification ongoing; release gate remains blocked).
- **Automated Verification:** Targeted loading suite `controls-loading-transition.test.tsx` (4/4 passed), `water-tank-monitoring-card.test.tsx` (6/6 passed), `device-selector-localization.test.tsx` (7/7 passed), full web suite (34 files, 257/257 passed), monorepo typecheck (0 errors across 4 workspaces), Next.js build (37/37 routes compiled), Playwright smoke tests (2/2 passed).
- **Manual Verification:** Authenticated browser testing verified immediate structural visibility, zero layout jumps, and symmetric 50% header centering across desktop, tablet, and mobile.
- **Pre-Commit Gate Status (Reconciled 2026-08-28):** All 5 pre-commit test commands verified **PASS** (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e` with 14/14 Playwright tests passed).
<!-- Controls Loading & Header Centering Traceability Reconciled: 2026-08-28 -->

---

## Verified Self-Email Change & Single Active Session Traceability Note (Reconciled 2026-08-29)

The following facts are verified in the traceability matrix regarding `TASK-0216` (Verified Self-Email Change) and `TASK-0217` (Single Active Session Enforcement and Profile Security UI):
- **Traceability Baseline:** Defined under `PRD-FR-024`, `PRD-FR-025`, `SEC-AUTH-006`, and `SEC-AUTH-007` to satisfy product requirements for self-service email updates, account/session concurrency security, and profile security interface reconciliation.
- **Task Readiness & Prioritization:**
  - `TASK-0216`: Status `DONE`, Priority `P1`. Governed by `DEC-AUTH-106`.
  - `TASK-0217`: Status `DONE`, Priority `P0` (Security-critical session enforcement). Governed by `DEC-AUTH-107` and `DEC-UIUX-102`.
- **Architectural Safeguards:**
  - `TASK-0216` enforces 100% authority of the current email until the new email is verified via 6-digit numeric CSPRNG code with 15-minute expiry. Emits structured non-sensitive audit metadata (`account.email.changed`) without logging raw plaintext old/new email strings.
  - `TASK-0217` enforces exactly 1 active session per user account, rejecting new valid logins with HTTP 409 Conflict (`ACTIVE_SESSION_EXISTS`) and preserving existing sessions. Prunes stale/expired sessions without blocking login. Removes misleading "Linked Devices" card from `/profile` and connects "Change Password" directly to existing `POST /api/v1/auth/change-password`.
- **Database, Staging & Deployment Implications:**
  - `TASK-0216` added migration `20260829170000_add_pending_email_to_email_verification_tokens` for nullable `pending_email` on `email_verification_tokens`. Applied and verified on DEV database; Supabase staging remains pending migration.
  - `TASK-0217` added migration `20260820000000_add_session_user_active_index` for composite index `sessions_user_active_idx` on `sessions(user_id, revoked_at, expires_at)`.
  - Railway web service will require redeployment following branch merge; IoT Gateway requires zero redeployment.
<!-- TASK-0216 and TASK-0217 Traceability Reconciled: 2026-08-30 -->

---

## Historical Monitoring Chart Visualization & Client Cache Traceability Note (Reconciled 2026-08-30)

The following facts are verified in the traceability matrix regarding `TASK-0504` (Implement Historical Charts) and `DEC-UIUX-104`:
- **Traceability Baseline:** Traced from `PRD-FR-028`, `DEC-MON-087`, `DEC-MON-088`, and `DEC-UIUX-104` to satisfy requirements for soil NPK multi-line visualization, instant range cache switching, decoupled readable X-axis tick generation, and application locale formatting without trailing punctuation.
- **Implementation Status:** `TASK-0504` is fully implemented and verified (`apps/web/test/unit/historical-charts.test.tsx` 18/18 passed, `soil-telemetry-ui.test.tsx` 7/7 passed, full web suite passed, typecheck 0 errors, Playwright visual range verification for 24h, 7d, 30d passed).
- **Core Architecture & UX Improvements:**
  - *NPK LineChart Visualization:* Soil NPK trend renders as a multi-line Recharts `LineChart` (Nitrogen `#0d631b`, Phosphorus `#884200`, Potassium `#476800`) with smooth curves and null-gap preservation (`connectNulls={false}`). Individual metrics render as AreaCharts.
  - *Client-Side 1-Hour Aggregation:* Raw telemetry is grouped and averaged into 1-hour intervals on the client side purely for visual smoothing, leaving backend telemetry ingestion and real-time streaming contracts unchanged.
  - *Instant Client-Side Cache Reuse:* Switching between 24h, 7d, and 30d presets checks in-memory `globalHistoryCache` before making network requests, rendering cached data instantly with `loading=false` and zero skeleton flashes.
  - *Range-Based Decoupled X-Axis Formatting (`getCustomXTicks`):* Separates displayed X-axis tick count from 1-hour data resolution: 24h displays 5–8 time ticks; 7d displays 4–5 well-spaced daily ticks to eliminate text overlap on mobile screens; 30d displays spaced date ticks across the month.
  - *Application Locale-Aware Formatting (`formatDayMonth`):* Date labels and tooltip headers follow `useLocale()` (`id` -> `20 Agu`, `en` -> `20 Aug`) with trailing commas and periods stripped.
<!-- TASK-0504 Traceability Reconciled: 2026-08-30 -->

---

## Faucet Controls UI Refinement & Lifecycle Regression Traceability Note (Reconciled 2026-09-01)

The following facts are verified in the traceability matrix regarding `TASK-0807` (Faucet Control UI Refinement), `TASK-0806` (Command Event State Machine), and `TASK-0408` (Device Simulator):
- **Traceability Baseline:** Traced from `PRD-FR-020`, `PRD-FR-021`, and `DEC-CTRL-090` to resolve user-observed discrepancies during manual verification of `/controls`.
- **Implementation Status:**
  - `TASK-0807`: `DONE` (Reconciled with physical valve state action guards: `CLOSED` disables dispensing presets and Close Valve; `OPEN` disables Open Valve; `UNKNOWN` enables all valid actions. Cleaned user-facing localization by removing redundant uppercase enum tokens `(CLOSED)`, `(COMPLETED)`, `(OPEN)`).
  - `TASK-0806`: `DONE` (Hardened with transactional terminal state protection in `addCommandEvent()` to prevent late non-terminal event insertion, and handled concurrent state transition errors gracefully in `FaucetEventProcessor`).
  - `TASK-0408`: `DONE` (Aligned simulator `sendFaucetProgress` to canonical QoS 1 and added realistic asynchronous actuation delays).
- **Append-Only Event Store Confirmation:** Verified that multiple `IN_PROGRESS` events occurring before `COMPLETED` represent valid intermediate progress milestones emitted by the device; only regressions occurring after terminal states are rejected.
- **Verification Summary:** All targeted unit suites passed (UI 27/27, DB repository 25/25, Gateway event processor 32/32, Simulator 31/31), web unit suites 288/288 passed, and monorepo static typecheck returned 0 errors.
<!-- Faucet Controls UI & Lifecycle Traceability Reconciled: 2026-09-01 -->


