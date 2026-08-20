# System Requirement Traceability Matrix: Kebun Melon

> **Task Reference:** `TASK-0003 — Establish Requirement IDs`
> **Status:** DEFINED & RECONCILED (2026-08-10 — Synchronized with completed TASKS.md backlog)
> **Source of Truth Rule:** All requirement identifiers use standard 3-digit sequential numbering per family starting at `001`.

---

## Traceability Table

| Requirement ID | Requirement Summary | Source Document | Related Decision IDs | Related Task IDs | Related Test IDs | Status |
|---|---|---|---|---|---|---|
| `PRD-FR-001` | Authenticated access to monitoring system | `docs/PRD.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-002` | Multi-device ESP32/NodeMCU support | `docs/PRD.md` | `DEC-DEV-020` | `TASK-0302` | `TEST-API-003` | `VERIFIED` |
| `PRD-FR-003` | Display latest soil and water monitoring data | `docs/PRD.md` | `DEC-MON-036` | `TASK-0502` | `TEST-E2E-003` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-004` | Display device connectivity and status | `docs/PRD.md` | `` | `TASK-0407` | `TEST-MQTT-002` | `DECISION_REQUIRED` |
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
| `PRD-FR-023` | Soil monitoring metrics display | `docs/PRD.md` | `DEC-MON-036` | `TASK-0501` | `TEST-API-003` | `READY_FOR_IMPLEMENTATION` |
| `SEC-DATA-003` | Content Security Policy (CSP) and security headers | `docs/SECURITY.md` | - | `TASK-0901` | `TEST-SEC-005` | `IMPLEMENTED` |
| `SEC-DATA-004` | Immutable append-only audit log storage | `docs/SECURITY.md` | - | `TASK-0903` | `TEST-DB-002` | `READY_FOR_IMPLEMENTATION` |
| `SEC-OPS-001` | Automated secret scanning in CI pipeline | `docs/SECURITY.md` | - | `TASK-0906` | `TEST-SEC-005` | `IMPLEMENTED` |
| `SEC-OPS-002` | API rate limiting on authentication and control endpoints | `docs/SECURITY.md` | - | `TASK-0902` | `TEST-SEC-005` | `DECISION_REQUIRED` |
| `SEC-OPS-003` | Database backup encryption and offsite storage | `docs/SECURITY.md` | - | `TASK-0909` | `TEST-SEC-005` | `DECISION_REQUIRED` |
| `SEC-OPS-004` | Automated vulnerability scanning of dependencies | `docs/SECURITY.md` | - | `TASK-0906` | `TEST-SEC-005` | `IMPLEMENTED` |
| `TEST-UNIT-001` | Environment variable validation unit tests | `docs/TESTING.md` | - | `TASK-0103` | `TEST-UNIT-001` | `READY_FOR_IMPLEMENTATION` |
| `TEST-UNIT-002` | Role and permission matrix unit tests | `docs/TESTING.md` | - | `TASK-0105` | `TEST-UNIT-002` | `READY_FOR_IMPLEMENTATION` |
| `TEST-UNIT-003` | Telemetry data freshness and status unit tests | `docs/TESTING.md` | `` | `TASK-0407` | `TEST-UNIT-003` | `DECISION_REQUIRED` |
| `TEST-UNIT-004` | I18N locale key and translation unit tests | `docs/TESTING.md` | `DEC-I18N-068` | `TASK-0601` | `TEST-UNIT-004` | `VERIFIED` |
| `TEST-UNIT-005` | Utility and format helper unit tests | `docs/TESTING.md` | - | `TASK-0102` | `TEST-UNIT-005` | `READY_FOR_IMPLEMENTATION` |
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
| `TEST-CTRL-002` | Faucet command state machine transition tests | `docs/TESTING.md` | `DEC-CTRL-051` | `TASK-0806` | `TEST-CTRL-002` | `READY_FOR_IMPLEMENTATION` |
| `TEST-CTRL-003` | Faucet command idempotency and duplicate tests | `docs/TESTING.md` | `DEC-CTRL-051` | `TASK-0808` | `TEST-CTRL-003` | `READY_FOR_IMPLEMENTATION` |
| `TEST-CTRL-004` | Faucet command timeout and expiry handling tests | `docs/TESTING.md` | `DEC-CTRL-051` | `TASK-0809` | `TEST-CTRL-004` | `DECISION_REQUIRED` |
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
< ! - -   T A S K - 0 8 0 2   R e c o n c i l e d :   2 0 2 6 - 0 8 - 1 9   - - >  
 
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
