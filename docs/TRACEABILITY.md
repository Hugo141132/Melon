# System Requirement Traceability Matrix: Kebun Melon

> **Task Reference:** `TASK-0003 — Establish Requirement IDs`
> **Status:** DEFINED & RECONCILED (2026-07-27)
> **Source of Truth Rule:** All requirement identifiers use standard 3-digit sequential numbering per family starting at `001`.

---

## Traceability Table

| Requirement ID | Requirement Summary | Source Document | Related Decision IDs | Related Task IDs | Related Test IDs | Status |
|---|---|---|---|---|---|---|
| `PRD-FR-001` | Authenticated access to monitoring system | `docs/PRD.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-002` | Multi-device ESP32/NodeMCU support | `docs/PRD.md` | `DEC-DEV-020` | `TASK-0302` | `TEST-API-003` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-003` | Display latest soil and water monitoring data | `docs/PRD.md` | `DEC-MON-036` | `TASK-0502` | `TEST-E2E-003` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-004` | Display device connectivity and status | `docs/PRD.md` | `` | `TASK-0407` | `TEST-MQTT-002` | `DECISION_REQUIRED` |
| `PRD-FR-005` | Store and present historical monitoring data | `docs/PRD.md` | `DEC-MON-048` | `TASK-0503` | `TEST-API-004` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-006` | Send predefined faucet-control commands | `docs/PRD.md` | `DEC-CTRL-051` | `TASK-0803` | `TEST-CTRL-001` | `DECISION_REQUIRED` |
| `PRD-FR-007` | Record faucet-control activity and outcomes | `docs/PRD.md` | `DEC-CTRL-051` | `TASK-0802` | `TEST-DB-002` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-008` | Enforce Owner and Admin RBAC permissions | `docs/PRD.md` | `DEC-RBAC-015` | `TASK-0209` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-009` | Require Owner approval for new Admin registrations | `docs/PRD.md` | `DEC-AUTH-006` | `TASK-0203` | `TEST-E2E-002` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-010` | Provide English and Bahasa Indonesia UI | `docs/PRD.md` | `DEC-I18N-068` | `TASK-0603` | `TEST-E2E-004` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-011` | Preserve existing visual frontend design | `docs/PRD.md` | - | `TASK-0001` | `TEST-E2E-001` | `IMPLEMENTED` |
| `PRD-FR-012` | Separate website logic from hardware measurement implementation | `docs/PRD.md` | `DEC-DEV-020` | `TASK-0401` | `TEST-MQTT-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-013` | Owner role capabilities and management scope | `docs/PRD.md` | `DEC-RBAC-013` | `TASK-0212` | `TEST-SEC-002` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-014` | Admin role capabilities and scope limits | `docs/PRD.md` | `DEC-RBAC-015` | `TASK-0211` | `TEST-SEC-002` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-015` | Access restriction to authenticated users | `docs/PRD.md` | `DEC-AUTH-001` | `TASK-0210` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-016` | Admin account self-registration submission | `docs/PRD.md` | `DEC-AUTH-006` | `TASK-0203` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-017` | Admin approval workflow and account status transitions | `docs/PRD.md` | `DEC-AUTH-006` | `TASK-0207` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-018` | First Owner account seed provisioning | `docs/PRD.md` | `DEC-AUTH-006` | `TASK-0106` | `TEST-API-002` | `IMPLEMENTED` |
| `PRD-FR-019` | Login behavior and account-status validation | `docs/PRD.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-020` | Multi-device support and metadata tracking | `docs/PRD.md` | `DEC-DEV-020` | `TASK-0302` | `TEST-DB-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-021` | Device selector interface and context persistence | `docs/PRD.md` | - | `TASK-0306` | `TEST-E2E-003` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-022` | Device access scope enforcement | `docs/PRD.md` | `DEC-RBAC-016` | `TASK-0304` | `TEST-SEC-003` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-023` | Soil monitoring metrics display | `docs/PRD.md` | `DEC-MON-036` | `TASK-0501` | `TEST-API-003` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-024` | Water monitoring metrics display | `docs/PRD.md` | `DEC-MON-036` | `TASK-0501` | `TEST-API-003` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-025` | Canonical status values display | `docs/PRD.md` | - | `TASK-0501` | `TEST-UNIT-003` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-026` | Data freshness and stale data indication | `docs/PRD.md` | `` | `TASK-0407` | `TEST-UNIT-003` | `DECISION_REQUIRED` |
| `PRD-FR-027` | Dashboard monitoring refresh without full reload | `docs/PRD.md` | `DEC-INF-077` | `TASK-0505` | `TEST-E2E-003` | `DECISION_REQUIRED` |
| `PRD-FR-028` | Historical data query and chart display | `docs/PRD.md` | `DEC-MON-048` | `TASK-0503` | `TEST-API-004` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-029` | Faucet control preset phase volumes | `docs/PRD.md` | `DEC-CTRL-051` | `TASK-0802` | `TEST-CTRL-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-030` | Faucet control execution workflow | `docs/PRD.md` | `DEC-CTRL-051` | `TASK-0803` | `TEST-CTRL-002` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-031` | Server-side faucet control authorization check | `docs/PRD.md` | `DEC-RBAC-015` | `TASK-0803` | `TEST-SEC-004` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-032` | Faucet control safety states and prevention rules | `docs/PRD.md` | `DEC-CTRL-051` | `TASK-0801` | `TEST-CTRL-003` | `DECISION_REQUIRED` |
| `PRD-FR-033` | Faucet command audit record logging | `docs/PRD.md` | `DEC-CTRL-051` | `TASK-0802` | `TEST-DB-002` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-034` | System alerts and scope-filtered alert display | `docs/PRD.md` | - | `TASK-0701` | `TEST-API-005` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-035` | Exact application roles (OWNER and ADMIN) | `docs/PRD.md` | - | `TASK-0105` | `TEST-UNIT-002` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-036` | User profile management rules and scope | `docs/PRD.md` | - | `TASK-0211` | `TEST-SEC-002` | `READY_FOR_IMPLEMENTATION` |
| `PRD-FR-037` | Internationalisation locale support | `docs/PRD.md` | `DEC-I18N-068` | `TASK-0601` | `TEST-E2E-004` | `READY_FOR_IMPLEMENTATION` |
| `PRD-NFR-001` | Application security controls and baseline defenses | `docs/PRD.md` | `DEC-AUTH-001` | `TASK-0901` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-NFR-002` | Dashboard load and data query performance | `docs/PRD.md` | `` | `TASK-0503` | `TEST-API-004` | `DECISION_REQUIRED` |
| `PRD-NFR-003` | System reliability and fault-tolerant telemetry processing | `docs/PRD.md` | `DEC-DEV-020` | `TASK-0401` | `TEST-MQTT-003` | `READY_FOR_IMPLEMENTATION` |
| `PRD-NFR-004` | Accessibility compliance standards | `docs/PRD.md` | `` | `TASK-1006` | `TEST-E2E-005` | `DECISION_REQUIRED` |
| `PRD-NFR-005` | Maintainability and component structure reuse | `docs/PRD.md` | `DEC-INF-075` | `TASK-0102` | `TEST-UNIT-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-DATA-001` | Soil telemetry metrics data schema | `docs/PRD.md` | `DEC-MON-036` | `TASK-0405` | `TEST-MQTT-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-DATA-002` | Water telemetry metrics data schema | `docs/PRD.md` | `DEC-MON-036` | `TASK-0406` | `TEST-MQTT-001` | `DECISION_REQUIRED` |
| `PRD-DATA-005` | Reservoir water telemetry metrics data schema | `docs/PRD.md` | `DEC-MON-036` | `TASK-0408` | `TEST-MQTT-001` | `DECISION_REQUIRED` |
| `PRD-DATA-006` | Shared sensor/tool battery telemetry metrics data schema | `docs/PRD.md` | `DEC-MON-036` | `TASK-0409` | `TEST-MQTT-001` | `DECISION_REQUIRED` |
| `PRD-DATA-003` | Faucet preset target volume mappings | `docs/PRD.md` | `DEC-CTRL-051` | `TASK-0802` | `TEST-CTRL-001` | `READY_FOR_IMPLEMENTATION` |
| `PRD-DATA-004` | User account profile data schema | `docs/PRD.md` | - | `TASK-0201` | `TEST-DB-001` | `IMPLEMENTED` |
| `RBAC-ROLE-001` | OWNER role permissions and scope | `docs/RBAC.md` | `DEC-RBAC-013` | `TASK-0209` | `TEST-SEC-002` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-ROLE-002` | ADMIN role permissions and scope | `docs/RBAC.md` | `DEC-RBAC-015` | `TASK-0209` | `TEST-SEC-002` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-PERM-001` | Authentication required prior to authorisation | `docs/RBAC.md` | `DEC-AUTH-001` | `TASK-0209` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-PERM-002` | Mandatory server-side permission enforcement | `docs/RBAC.md` | - | `TASK-0210` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-PERM-003` | Least privilege default access configuration | `docs/RBAC.md` | - | `TASK-0209` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-PERM-004` | Explicit denial of unlisted actions | `docs/RBAC.md` | - | `TASK-0209` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-PERM-005` | Resource-level and object-level authorisation checks | `docs/RBAC.md` | - | `TASK-0209` | `TEST-SEC-002` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-PERM-006` | Stable untranslated internal permission keys | `docs/RBAC.md` | - | `TASK-0105` | `TEST-UNIT-002` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-PERM-007` | Auditing of RBAC and role modifications | `docs/RBAC.md` | - | `TASK-0903` | `TEST-DB-002` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-PERM-008` | Consolidated Role-Permission Matrix | `docs/RBAC.md` | `DEC-RBAC-015` | `TASK-0209` | `TEST-SEC-002` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-STATE-001` | PENDING_APPROVAL status access rules | `docs/RBAC.md` | `DEC-AUTH-006` | `TASK-0203` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-STATE-002` | APPROVED status access rules | `docs/RBAC.md` | - | `TASK-0207` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-STATE-003` | ACTIVE status access rules | `docs/RBAC.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-STATE-004` | REJECTED status access rules | `docs/RBAC.md` | - | `TASK-0208` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-STATE-005` | SUSPENDED status access rules | `docs/RBAC.md` | - | `TASK-0212` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-STATE-006` | DEACTIVATED status access rules | `docs/RBAC.md` | - | `TASK-0212` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-STATE-007` | Account status access matrix enforcement | `docs/RBAC.md` | - | `TASK-0204` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-DEV-001` | Mandatory per-device assignment model | `docs/RBAC.md` | `DEC-RBAC-016` | `TASK-0304` | `TEST-SEC-003` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-DEV-002` | Admin assigned device monitoring and control rule | `docs/RBAC.md` | `DEC-RBAC-015` | `TASK-0304` | `TEST-SEC-003` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-DEV-003` | Owner device access scope rule | `docs/RBAC.md` | `DEC-RBAC-013` | `TASK-0305` | `TEST-SEC-003` | `READY_FOR_IMPLEMENTATION` |
| `RBAC-DEV-004` | Instant effect on device access revocation | `docs/RBAC.md` | - | `TASK-0304` | `TEST-SEC-003` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-AUTH-001` | Unauthenticated visitor route redirection flow | `docs/USER_FLOWS.md` | `DEC-AUTH-001` | `TASK-0210` | `TEST-E2E-001` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-AUTH-002` | Admin account registration flow | `docs/USER_FLOWS.md` | `DEC-AUTH-006` | `TASK-0203` | `TEST-E2E-002` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-AUTH-003` | Registration validation error flow | `docs/USER_FLOWS.md` | - | `TASK-0203` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-AUTH-004` | Pending Admin account waiting approval flow | `docs/USER_FLOWS.md` | `DEC-AUTH-006` | `TASK-0204` | `TEST-E2E-002` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-AUTH-005` | Active user successful authentication flow | `docs/USER_FLOWS.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-E2E-001` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-AUTH-006` | Invalid credentials login failure flow | `docs/USER_FLOWS.md` | - | `TASK-0204` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-AUTH-007` | Suspended user login restriction flow | `docs/USER_FLOWS.md` | - | `TASK-0204` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-USER-001` | Owner views pending registration list flow | `docs/USER_FLOWS.md` | `DEC-AUTH-006` | `TASK-0206` | `TEST-E2E-002` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-USER-002` | Owner approves Admin registration flow | `docs/USER_FLOWS.md` | `DEC-AUTH-006` | `TASK-0207` | `TEST-E2E-002` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-USER-003` | Owner rejects Admin registration flow | `docs/USER_FLOWS.md` | - | `TASK-0208` | `TEST-E2E-002` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-USER-004` | Owner user management navigation flow | `docs/USER_FLOWS.md` | - | `TASK-0212` | `TEST-E2E-002` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-USER-005` | Owner suspends active Admin flow | `docs/USER_FLOWS.md` | - | `TASK-0212` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-USER-006` | User updates own profile information flow | `docs/USER_FLOWS.md` | - | `TASK-0211` | `TEST-E2E-001` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-DEV-001` | User selects device context flow | `docs/USER_FLOWS.md` | - | `TASK-0306` | `TEST-E2E-003` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-MON-001` | User views live monitoring telemetry flow | `docs/USER_FLOWS.md` | `DEC-MON-036` | `TASK-0502` | `TEST-E2E-003` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-MON-002` | User views historical monitoring charts flow | `docs/USER_FLOWS.md` | `DEC-MON-048` | `TASK-0504` | `TEST-E2E-003` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-CTRL-001` | User selects preset and confirms command flow | `docs/USER_FLOWS.md` | `DEC-CTRL-051` | `TASK-0807` | `TEST-CTRL-002` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-CTRL-002` | Faucet command execution and acknowledgment flow | `docs/USER_FLOWS.md` | `DEC-CTRL-051` | `TASK-0805` | `TEST-CTRL-002` | `READY_FOR_IMPLEMENTATION` |
| `FLOW-CTRL-003` | Faucet command timeout handling flow | `docs/USER_FLOWS.md` | `DEC-CTRL-051` | `TASK-0809` | `TEST-CTRL-004` | `DECISION_REQUIRED` |
| `FLOW-I18N-001` | User switches UI language flow | `docs/USER_FLOWS.md` | `DEC-I18N-068` | `TASK-0604` | `TEST-E2E-004` | `READY_FOR_IMPLEMENTATION` |
| `I18N-REQ-001` | Supported application locales (en and id) | `docs/I18N.md` | `DEC-I18N-068` | `TASK-0601` | `TEST-UNIT-004` | `READY_FOR_IMPLEMENTATION` |
| `I18N-REQ-002` | Default (id) and fallback (en) locale settings | `docs/I18N.md` | `DEC-I18N-068` | `TASK-0601` | `TEST-UNIT-004` | `READY_FOR_IMPLEMENTATION` |
| `I18N-REQ-003` | Locale selection resolution order | `docs/I18N.md` | `DEC-I18N-068` | `TASK-0604` | `TEST-UNIT-004` | `READY_FOR_IMPLEMENTATION` |
| `I18N-REQ-004` | Header language selector component | `docs/I18N.md` | - | `TASK-0603` | `TEST-E2E-004` | `READY_FOR_IMPLEMENTATION` |
| `I18N-REQ-005` | Authenticated user profile language persistence | `docs/I18N.md` | - | `TASK-0604` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `I18N-REQ-006` | Cookie-based locale routing without path pollution | `docs/I18N.md` | `DEC-I18N-068` | `TASK-0604` | `TEST-E2E-004` | `READY_FOR_IMPLEMENTATION` |
| `I18N-REQ-007` | Technical content and enums exempt from translation | `docs/I18N.md` | - | `TASK-0603` | `TEST-UNIT-004` | `READY_FOR_IMPLEMENTATION` |
| `I18N-REQ-008` | Locale-aware DateTime and number formatting | `docs/I18N.md` | `DEC-I18N-068` | `TASK-0603` | `TEST-UNIT-004` | `READY_FOR_IMPLEMENTATION` |
| `DEV-ID-001` | Unique canonical device identifier string | `docs/DEVICE_COMMUNICATION.md` | - | `TASK-0302` | `TEST-DB-001` | `READY_FOR_IMPLEMENTATION` |
| `DEV-ID-002` | Device capabilities flags and registration | `docs/DEVICE_COMMUNICATION.md` | - | `TASK-0303` | `TEST-DB-001` | `READY_FOR_IMPLEMENTATION` |
| `DEV-TOPIC-001` | MQTT topic hierarchy root definition | `docs/DEVICE_COMMUNICATION.md` | `DEC-DEV-020` | `TASK-0403` | `TEST-MQTT-001` | `READY_FOR_IMPLEMENTATION` |
| `DEV-TOPIC-002` | Standard MQTT topic structure rules | `docs/DEVICE_COMMUNICATION.md` | `DEC-DEV-020` | `TASK-0403` | `TEST-MQTT-001` | `READY_FOR_IMPLEMENTATION` |
| `DEV-TOPIC-003` | Per-device topic access isolation rules | `docs/DEVICE_COMMUNICATION.md` | `DEC-DEV-020` | `TASK-0403` | `TEST-MQTT-002` | `READY_FOR_IMPLEMENTATION` |
| `DEV-TEL-001` | Soil telemetry MQTT payload specification | `docs/DEVICE_COMMUNICATION.md` | `DEC-MON-036` | `TASK-0405` | `TEST-MQTT-001` | `READY_FOR_IMPLEMENTATION` |
| `DEV-TEL-002` | Water telemetry MQTT payload specification | `docs/DEVICE_COMMUNICATION.md` | `DEC-MON-036` | `TASK-0406` | `TEST-MQTT-001` | `DECISION_REQUIRED` |
| `DEV-TEL-003` | Telemetry payload ingestion processing rules | `docs/DEVICE_COMMUNICATION.md` | - | `TASK-0405` | `TEST-MQTT-003` | `READY_FOR_IMPLEMENTATION` |
| `DEV-STAT-001` | Device heartbeat MQTT payload specification | `docs/DEVICE_COMMUNICATION.md` | `` | `TASK-0407` | `TEST-MQTT-002` | `DECISION_REQUIRED` |
| `DEV-STAT-002` | MQTT Last Will and Testament (LWT) disconnect handling | `docs/DEVICE_COMMUNICATION.md` | `DEC-DEV-020` | `TASK-0407` | `TEST-MQTT-002` | `READY_FOR_IMPLEMENTATION` |
| `DEV-STAT-003` | Device offline and stale status calculation rules | `docs/DEVICE_COMMUNICATION.md` | `` | `TASK-0407` | `TEST-UNIT-003` | `DECISION_REQUIRED` |
| `DEV-CMD-001` | Faucet control command MQTT payload schema | `docs/DEVICE_COMMUNICATION.md` | `DEC-CTRL-051` | `TASK-0804` | `TEST-MQTT-004` | `READY_FOR_IMPLEMENTATION` |
| `DEV-CMD-002` | Maximum one active command per device rule | `docs/DEVICE_COMMUNICATION.md` | `DEC-CTRL-051` | `TASK-0803` | `TEST-CTRL-003` | `READY_FOR_IMPLEMENTATION` |
| `DEV-ACK-001` | Device command acknowledgment MQTT payload | `docs/DEVICE_COMMUNICATION.md` | `DEC-CTRL-051` | `TASK-0805` | `TEST-MQTT-004` | `READY_FOR_IMPLEMENTATION` |
| `DEV-ACK-002` | Device dispensing progress report MQTT payload | `docs/DEVICE_COMMUNICATION.md` | `DEC-CTRL-051` | `TASK-0806` | `TEST-MQTT-004` | `READY_FOR_IMPLEMENTATION` |
| `DEV-ACK-003` | Device dispensing completion MQTT event | `docs/DEVICE_COMMUNICATION.md` | `DEC-CTRL-051` | `TASK-0806` | `TEST-MQTT-004` | `READY_FOR_IMPLEMENTATION` |
| `DEV-ACK-004` | Device error or failure MQTT payload | `docs/DEVICE_COMMUNICATION.md` | `DEC-CTRL-051` | `TASK-0806` | `TEST-MQTT-004` | `READY_FOR_IMPLEMENTATION` |
| `DEV-SEC-001` | MQTT 5.0 over TLS protocol enforcement | `docs/DEVICE_COMMUNICATION.md` | `DEC-DEV-020` | `TASK-0401` | `TEST-SEC-004` | `READY_FOR_IMPLEMENTATION` |
| `DEV-SEC-002` | Per-device credentials and ACL isolation | `docs/DEVICE_COMMUNICATION.md` | `DEC-DEV-020` | `TASK-0402` | `TEST-SEC-004` | `READY_FOR_IMPLEMENTATION` |
| `ARCH-COMP-001` | Next.js Web Frontend component architecture | `docs/ARCHITECTURE.md` | `DEC-INF-075` | `TASK-0101` | `TEST-E2E-001` | `IMPLEMENTED` |
| `ARCH-COMP-002` | Web Backend API component architecture | `docs/ARCHITECTURE.md` | `DEC-INF-075` | `TASK-0101` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `ARCH-COMP-003` | IoT Gateway Service component architecture | `docs/ARCHITECTURE.md` | `DEC-DEV-020` | `TASK-0401` | `TEST-MQTT-001` | `READY_FOR_IMPLEMENTATION` |
| `ARCH-COMP-004` | PostgreSQL Database component architecture | `docs/ARCHITECTURE.md` | `DEC-INF-075` | `TASK-0104` | `TEST-DB-001` | `DEFINED` |
| `ARCH-COMP-005` | MQTT Broker component architecture | `docs/ARCHITECTURE.md` | `DEC-DEV-020` | `TASK-0402` | `TEST-MQTT-002` | `READY_FOR_IMPLEMENTATION` |
| `ARCH-FLOW-001` | Authentication and RBAC request architecture flow | `docs/ARCHITECTURE.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `ARCH-FLOW-002` | Telemetry ingestion architecture data flow | `docs/ARCHITECTURE.md` | `DEC-DEV-020` | `TASK-0405` | `TEST-MQTT-003` | `READY_FOR_IMPLEMENTATION` |
| `ARCH-FLOW-003` | Realtime telemetry streaming architecture flow | `docs/ARCHITECTURE.md` | `DEC-INF-077` | `TASK-0505` | `TEST-E2E-003` | `DECISION_REQUIRED` |
| `ARCH-FLOW-004` | Faucet command dispatch architecture flow | `docs/ARCHITECTURE.md` | `DEC-CTRL-051` | `TASK-0804` | `TEST-CTRL-002` | `READY_FOR_IMPLEMENTATION` |
| `ARCH-DEP-001` | npm monorepo workspace repository structure | `docs/ARCHITECTURE.md` | `DEC-INF-075` | `TASK-0101` | `TEST-UNIT-001` | `IMPLEMENTED` |
| `ARCH-DEP-002` | Multi-service container topology | `docs/ARCHITECTURE.md` | `DEC-INF-075` | `TASK-0101` | `TEST-E2E-001` | `READY_FOR_IMPLEMENTATION` |
| `ARCH-DEP-003` | Environment variable validation on application startup | `docs/ARCHITECTURE.md` | - | `TASK-0103` | `TEST-UNIT-001` | `READY_FOR_IMPLEMENTATION` |
| `DB-USER-001` | users table schema definition | `docs/DATABASE.md` | - | `TASK-0201` | `TEST-DB-001` | `IMPLEMENTED` |
| `DB-USER-002` | sessions table schema definition | `docs/DATABASE.md` | `DEC-AUTH-001` | `TASK-0201` | `TEST-DB-001` | `READY_FOR_IMPLEMENTATION` |
| `DB-USER-003` | approval_history table schema definition | `docs/DATABASE.md` | `DEC-AUTH-006` | `TASK-0207` | `TEST-DB-001` | `READY_FOR_IMPLEMENTATION` |
| `DB-USER-004` | roles and permissions tables schema definition | `docs/DATABASE.md` | - | `TASK-0105` | `TEST-DB-001` | `READY_FOR_IMPLEMENTATION` |
| `DB-DEV-001` | devices table schema definition | `docs/DATABASE.md` | `DEC-DEV-020` | `TASK-0302` | `TEST-DB-001` | `READY_FOR_IMPLEMENTATION` |
| `DB-DEV-002` | user_devices assignment table schema definition | `docs/DATABASE.md` | `DEC-RBAC-016` | `TASK-0304` | `TEST-DB-001` | `READY_FOR_IMPLEMENTATION` |
| `DB-DEV-003` | sites table schema definition | `docs/DATABASE.md` | `DEC-DEV-026` | `TASK-0301` | `TEST-DB-001` | `DEFERRED` |
| `DB-TEL-001` | soil_telemetry table schema definition | `docs/DATABASE.md` | `DEC-MON-036` | `TASK-0405` | `TEST-DB-001` | `VERIFIED` |
| `DB-TEL-002` | water_telemetry table schema definition | `docs/DATABASE.md` | `DEC-MON-036` | `TASK-0406` | `TEST-DB-001` | `VERIFIED` |
| `DB-TEL-003` | reservoir_water_telemetry table schema definition | `docs/DATABASE.md` | `DEC-MON-036` | `TASK-0408` | `TEST-DB-001` | `VERIFIED` |
| `DB-TEL-004` | sensor_battery_telemetry table schema definition | `docs/DATABASE.md` | `DEC-MON-036` | `TASK-0409` | `TEST-DB-001` | `VERIFIED` |
| `DB-CMD-001` | faucet_commands table schema definition | `docs/DATABASE.md` | `DEC-CTRL-051` | `TASK-0802` | `TEST-DB-002` | `READY_FOR_IMPLEMENTATION` |
| `DB-CMD-002` | faucet_command_events table schema definition | `docs/DATABASE.md` | `DEC-CTRL-051` | `TASK-0802` | `TEST-DB-002` | `READY_FOR_IMPLEMENTATION` |
| `DB-AUDIT-001` | audit_logs table schema definition | `docs/DATABASE.md` | - | `TASK-0903` | `TEST-DB-002` | `READY_FOR_IMPLEMENTATION` |
| `API-AUTH-001` | POST /api/v1/auth/register endpoint | `docs/API.md` | `DEC-AUTH-006` | `TASK-0203` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `API-AUTH-002` | POST /api/v1/auth/login endpoint | `docs/API.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `API-AUTH-003` | POST /api/v1/auth/logout endpoint | `docs/API.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `API-AUTH-004` | GET /api/v1/auth/session endpoint | `docs/API.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `API-USER-001` | GET /api/v1/me profile endpoint | `docs/API.md` | - | `TASK-0211` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `API-USER-002` | PATCH /api/v1/me profile update endpoint | `docs/API.md` | - | `TASK-0211` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `API-USER-003` | GET /api/v1/users list endpoint | `docs/API.md` | - | `TASK-0212` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `API-USER-004` | PATCH /api/v1/users/{userId} management endpoint | `docs/API.md` | - | `TASK-0212` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `API-USER-005` | POST /api/v1/approvals/{userId}/approve endpoint | `docs/API.md` | `DEC-AUTH-006` | `TASK-0207` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `API-USER-006` | POST /api/v1/approvals/{userId}/reject endpoint | `docs/API.md` | - | `TASK-0208` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `API-DEV-001` | GET /api/v1/devices list endpoint | `docs/API.md` | `DEC-RBAC-016` | `TASK-0305` | `TEST-API-003` | `READY_FOR_IMPLEMENTATION` |
| `API-DEV-002` | GET /api/v1/devices/{deviceId} detail endpoint | `docs/API.md` | `DEC-RBAC-016` | `TASK-0305` | `TEST-API-003` | `READY_FOR_IMPLEMENTATION` |
| `API-DEV-003` | POST /api/v1/devices creation endpoint | `docs/API.md` | - | `TASK-0302` | `TEST-API-003` | `READY_FOR_IMPLEMENTATION` |
| `API-DEV-004` | POST /api/v1/user-devices assignment endpoint | `docs/API.md` | `DEC-RBAC-016` | `TASK-0304` | `TEST-API-003` | `READY_FOR_IMPLEMENTATION` |
| `API-MON-001` | GET /api/v1/devices/{deviceId}/monitoring/latest endpoint | `docs/API.md` | `DEC-MON-036` | `TASK-0501` | `TEST-API-003` | `READY_FOR_IMPLEMENTATION` |
| `API-MON-002` | GET /api/v1/devices/{deviceId}/monitoring/history endpoint | `docs/API.md` | `DEC-MON-048` | `TASK-0503` | `TEST-API-004` | `READY_FOR_IMPLEMENTATION` |
| `API-MON-003` | GET /api/v1/devices/{deviceId}/monitoring/stream endpoint | `docs/API.md` | `DEC-INF-077` | `TASK-0505` | `TEST-API-003` | `DECISION_REQUIRED` |
| `API-CTRL-001` | POST /api/v1/devices/{deviceId}/faucet-commands endpoint | `docs/API.md` | `DEC-CTRL-051` | `TASK-0803` | `TEST-CTRL-002` | `DECISION_REQUIRED` |
| `API-CTRL-002` | GET /api/v1/faucet-commands/{commandId} status endpoint | `docs/API.md` | `DEC-CTRL-051` | `TASK-0803` | `TEST-CTRL-002` | `READY_FOR_IMPLEMENTATION` |
| `API-ALERT-001` | GET /api/v1/alerts endpoint | `docs/API.md` | - | `TASK-0701` | `TEST-API-005` | `READY_FOR_IMPLEMENTATION` |
| `API-ALERT-002` | PATCH /api/v1/alerts/{alertId}/ack endpoint | `docs/API.md` | - | `TASK-0704` | `TEST-API-005` | `DECISION_REQUIRED` |
| `API-AUDIT-001` | GET /api/v1/audit-logs endpoint | `docs/API.md` | - | `TASK-0903` | `TEST-API-005` | `READY_FOR_IMPLEMENTATION` |
| `API-ERR-001` | Standard JSON API error envelope format | `docs/API.md` | - | `TASK-0102` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `API-ERR-002` | Canonical error code mapping and HTTP status rules | `docs/API.md` | - | `TASK-0102` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `SEC-AUTH-001` | HTTP-only secure cookie session storage | `docs/SECURITY.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `SEC-AUTH-002` | Password hashing using Argon2id algorithm | `docs/SECURITY.md` | - | `TASK-0202` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `SEC-AUTH-003` | Public registration forbidden from creating Owner | `docs/SECURITY.md` | `DEC-AUTH-006` | `TASK-0203` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `SEC-AUTH-004` | CLI seed method for first Owner account creation | `docs/SECURITY.md` | `DEC-AUTH-006` | `TASK-0106` | `TEST-SEC-001` | `IMPLEMENTED` |
| `SEC-AUTH-005` | Session lifetime and idle timeout enforcement | `docs/SECURITY.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-SEC-001` | `READY_FOR_IMPLEMENTATION` |
| `SEC-RBAC-001` | Server-side authorization for all protected routes | `docs/SECURITY.md` | - | `TASK-0210` | `TEST-SEC-002` | `READY_FOR_IMPLEMENTATION` |
| `SEC-RBAC-002` | Device-level isolation and access boundary | `docs/SECURITY.md` | `DEC-RBAC-016` | `TASK-0304` | `TEST-SEC-003` | `READY_FOR_IMPLEMENTATION` |
| `SEC-RBAC-003` | Admin self-promotion and role edit restriction | `docs/SECURITY.md` | - | `TASK-0209` | `TEST-SEC-002` | `READY_FOR_IMPLEMENTATION` |
| `SEC-RBAC-004` | Immediate session revocation on account status change | `docs/SECURITY.md` | - | `TASK-0908` | `TEST-SEC-001` | `DECISION_REQUIRED` |
| `SEC-DEV-001` | MQTT 5.0 over TLS transport security | `docs/SECURITY.md` | `DEC-DEV-020` | `TASK-0401` | `TEST-SEC-004` | `READY_FOR_IMPLEMENTATION` |
| `SEC-DEV-002` | Per-device unique MQTT credentials | `docs/SECURITY.md` | `DEC-DEV-020` | `TASK-0402` | `TEST-SEC-004` | `READY_FOR_IMPLEMENTATION` |
| `SEC-DEV-003` | Per-device topic access control (ACL) enforcement | `docs/SECURITY.md` | `DEC-DEV-020` | `TASK-0402` | `TEST-SEC-004` | `READY_FOR_IMPLEMENTATION` |
| `SEC-DEV-004` | Browser forbidden from direct MQTT connection | `docs/SECURITY.md` | `DEC-DEV-020` | `TASK-0401` | `TEST-SEC-004` | `READY_FOR_IMPLEMENTATION` |
| `SEC-CTRL-001` | Single active command limit per physical device | `docs/SECURITY.md` | `DEC-CTRL-051` | `TASK-0803` | `TEST-CTRL-003` | `READY_FOR_IMPLEMENTATION` |
| `SEC-CTRL-002` | Automatic retries strictly forbidden for physical commands | `docs/SECURITY.md` | `DEC-CTRL-051` | `TASK-0803` | `TEST-CTRL-003` | `READY_FOR_IMPLEMENTATION` |
| `SEC-CTRL-003` | Default ENABLE_FAUCET_CONTROL=false environment flag | `docs/SECURITY.md` | `DEC-CTRL-067` | `TASK-0103` | `TEST-CTRL-005` | `READY_FOR_IMPLEMENTATION` |
| `SEC-CTRL-004` | Dual written sign-off required for production physical control | `docs/SECURITY.md` | `DEC-CTRL-067` | `TASK-1010` | `TEST-CTRL-005` | `DECISION_REQUIRED` |
| `SEC-CTRL-005` | Mandatory idempotency key on command creation | `docs/SECURITY.md` | `DEC-CTRL-051` | `TASK-0808` | `TEST-CTRL-003` | `READY_FOR_IMPLEMENTATION` |
| `SEC-CTRL-006` | Command timeout distinct from physical completion state | `docs/SECURITY.md` | `DEC-CTRL-051` | `TASK-0809` | `TEST-CTRL-004` | `READY_FOR_IMPLEMENTATION` |
| `SEC-DATA-001` | Passwords, hashes, and secrets redacted from logs | `docs/SECURITY.md` | - | `TASK-0903` | `TEST-SEC-005` | `READY_FOR_IMPLEMENTATION` |
| `SEC-DATA-002` | CSRF token protection and CORS allowlist enforcement | `docs/SECURITY.md` | - | `TASK-0901` | `TEST-SEC-005` | `READY_FOR_IMPLEMENTATION` |
| `SEC-DATA-003` | Content Security Policy (CSP) and security headers | `docs/SECURITY.md` | - | `TASK-0901` | `TEST-SEC-005` | `READY_FOR_IMPLEMENTATION` |
| `SEC-DATA-004` | Immutable append-only audit log storage | `docs/SECURITY.md` | - | `TASK-0903` | `TEST-DB-002` | `READY_FOR_IMPLEMENTATION` |
| `SEC-OPS-001` | Automated secret scanning in CI pipeline | `docs/SECURITY.md` | - | `TASK-0906` | `TEST-SEC-005` | `READY_FOR_IMPLEMENTATION` |
| `SEC-OPS-002` | API rate limiting on authentication and control endpoints | `docs/SECURITY.md` | - | `TASK-0902` | `TEST-SEC-005` | `DECISION_REQUIRED` |
| `SEC-OPS-003` | Database backup encryption and offsite storage | `docs/SECURITY.md` | - | `TASK-0909` | `TEST-SEC-005` | `DECISION_REQUIRED` |
| `SEC-OPS-004` | Automated vulnerability scanning of dependencies | `docs/SECURITY.md` | - | `TASK-0906` | `TEST-SEC-005` | `READY_FOR_IMPLEMENTATION` |
| `TEST-UNIT-001` | Environment variable validation unit tests | `docs/TESTING.md` | - | `TASK-0103` | `TEST-UNIT-001` | `READY_FOR_IMPLEMENTATION` |
| `TEST-UNIT-002` | Role and permission matrix unit tests | `docs/TESTING.md` | - | `TASK-0105` | `TEST-UNIT-002` | `READY_FOR_IMPLEMENTATION` |
| `TEST-UNIT-003` | Telemetry data freshness and status unit tests | `docs/TESTING.md` | `` | `TASK-0407` | `TEST-UNIT-003` | `DECISION_REQUIRED` |
| `TEST-UNIT-004` | I18N locale key and translation unit tests | `docs/TESTING.md` | `DEC-I18N-068` | `TASK-0601` | `TEST-UNIT-004` | `READY_FOR_IMPLEMENTATION` |
| `TEST-UNIT-005` | Utility and format helper unit tests | `docs/TESTING.md` | - | `TASK-0102` | `TEST-UNIT-005` | `READY_FOR_IMPLEMENTATION` |
| `TEST-API-001` | Authentication API endpoint integration tests | `docs/TESTING.md` | `DEC-AUTH-001` | `TASK-0204` | `TEST-API-001` | `READY_FOR_IMPLEMENTATION` |
| `TEST-API-002` | User and approval API integration tests | `docs/TESTING.md` | `DEC-AUTH-006` | `TASK-0207` | `TEST-API-002` | `READY_FOR_IMPLEMENTATION` |
| `TEST-API-003` | Device and monitoring API integration tests | `docs/TESTING.md` | `DEC-MON-036` | `TASK-0501` | `TEST-API-003` | `READY_FOR_IMPLEMENTATION` |
| `TEST-API-004` | Historical query API integration tests | `docs/TESTING.md` | `DEC-MON-048` | `TASK-0503` | `TEST-API-004` | `READY_FOR_IMPLEMENTATION` |
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
| `TEST-CTRL-001` | Preset volume mapping contract tests | `docs/TESTING.md` | `DEC-CTRL-051` | `TASK-0802` | `TEST-CTRL-001` | `READY_FOR_IMPLEMENTATION` |
| `TEST-CTRL-002` | Faucet command state machine transition tests | `docs/TESTING.md` | `DEC-CTRL-051` | `TASK-0806` | `TEST-CTRL-002` | `READY_FOR_IMPLEMENTATION` |
| `TEST-CTRL-003` | Faucet command idempotency and duplicate tests | `docs/TESTING.md` | `DEC-CTRL-051` | `TASK-0808` | `TEST-CTRL-003` | `READY_FOR_IMPLEMENTATION` |
| `TEST-CTRL-004` | Faucet command timeout and expiry handling tests | `docs/TESTING.md` | `DEC-CTRL-051` | `TASK-0809` | `TEST-CTRL-004` | `DECISION_REQUIRED` |
| `TEST-CTRL-005` | Faucet control feature flag and dual sign-off tests | `docs/TESTING.md` | `DEC-CTRL-067` | `TASK-0801` | `TEST-CTRL-005` | `READY_FOR_IMPLEMENTATION` |
