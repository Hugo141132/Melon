# Security Scanning Exception Governance Process

## 1. Purpose

This document defines the formal process for reviewing, approving, and documenting exceptions and false positives discovered during automated secret scanning and dependency vulnerability scanning in the CI/CD pipeline (`SEC-OPS-001` and `SEC-OPS-004`).

---

## 2. Policy Baseline

- **Zero-Unapproved-Secrets Policy (`SEC-OPS-001`):** No plaintext secret, private key, high-entropy credential, or production password shall be committed to the repository or included in build artifacts.
- **Zero-Unapproved-High-Vulnerability Policy (`SEC-OPS-004`):** Dependencies with `HIGH` or `CRITICAL` severity security advisories must be remediated immediately unless a formal exception is documented and approved.
- **Fail-Closed Default:** Scanning scripts run in CI block builds (`exit code 1`) upon detecting unapproved secrets or unapproved high/critical vulnerabilities.

---

## 3. Exception Criteria

An exception may be granted **only** under the following conditions:

1. **False Positive:** The scanner flagged a string or dependency pattern that is empirically confirmed not to be a secret or vulnerable code path (e.g. mock test constants, public documentation placeholders).
2. **Mitigated Vulnerability:** A dependency vulnerability exists in a sub-dependency, but the vulnerable code path is unused in our architecture, and no upstream patch is currently available.
3. **Compensating Control:** Temporary operational controls are active while a full fix or version upgrade is being prepared.

---

## 4. Review & Approval Workflow

1. **Identification:** The developer or CI log identifies a failed secret or dependency check.
2. **Investigation:** The developer inspects the flagged finding to determine if it is a true positive or false positive.
   - If **True Positive Secret**: Immediately revoke/rotate the secret and remove it from code history.
   - If **True Positive Dependency**: Upgrade the dependency (`npm update` or `npm audit fix`).
3. **Exception Request:** If an exception or false positive classification is warranted, submit a request specifying:
   - File path / Package name
   - Finding ID / Rule ID / CVE ID
   - Root cause justification
   - Risk assessment & compensating controls
   - Target remediation date
4. **Approval:** Security Owner or Technical Lead reviews and approves the exception entry.
5. **Registration:** Add the entry to `scripts/security-exceptions.json`.

---

## 5. Exception Schema (`scripts/security-exceptions.json`)

All exceptions must be recorded in `scripts/security-exceptions.json` using the following schema:

```json
{
  "secretExceptions": [
    {
      "id": "EXC-SEC-001",
      "pathPattern": "apps/web/test/unit/security-scanning.test.ts",
      "ruleId": "SIMULATED_TEST_SECRET",
      "reason": "Simulated secret patterns used strictly in unit tests for negative security scanner testing.",
      "approvedBy": "Security Team",
      "approvedDate": "2026-08-06",
      "expiresDate": "2027-08-06"
    }
  ],
  "dependencyExceptions": [
    {
      "id": "EXC-DEP-001",
      "packageName": "example-pkg",
      "advisoryId": "GHSA-xxxx-xxxx-xxxx",
      "reason": "Vulnerable feature is not used; upstream patch pending.",
      "approvedBy": "Security Team",
      "approvedDate": "2026-08-06",
      "expiresDate": "2026-09-06"
    }
  ]
}
```

---

## 6. Audit & Expiry

- All exceptions expire after a maximum of **12 months** (or shorter if specified).
- Expired exceptions will cause automated scanners to resume blocking build execution.
- `scripts/security-exceptions.json` is checked by automated tests during CI execution.
- **TASK-0603 Audit:** Confirmed zero secret exceptions and zero dependency exceptions introduced.
- **TASK-0604 Audit:** Confirmed zero secret exceptions and zero dependency exceptions introduced.
- **TASK-0703 Audit:** Confirmed zero secret exceptions and zero dependency exceptions introduced.
- **TASK-0704 Audit:** Confirmed zero secret exceptions and zero dependency exceptions introduced.
- **TASK-0904 Audit:** Confirmed zero secret exceptions and zero dependency exceptions introduced.
- **TASK-0905 Audit:** Confirmed zero secret exceptions and zero dependency exceptions introduced.
- **TASK-0213 Audit:** Confirmed zero secret exceptions and zero dependency exceptions introduced; Resend API key and password reset tokens adhere strictly to zero-plaintext policy with environment validation and SHA-256 token hashing.
- **TASK-0214 Audit:** Confirmed zero secret exceptions and zero dependency exceptions introduced; email verification tokens adhere strictly to zero-plaintext policy with 256-bit CSPRNG generation, SHA-256 token hashing in `email_verification_tokens`, and secure transactional deletion upon consumption.
- **TASK-0305 Audit:** Confirmed zero secret exceptions and zero dependency exceptions introduced; authorised device endpoints enforce role-based projection concealing `deviceId` from Admins, active-assignment database scoping, and IDOR prevention with zero security exceptions.
- **TASK-0504 / Monitoring Reconciliation Audit (2026-08-19):** Confirmed zero secret exceptions and zero dependency exceptions introduced; monitoring history and latest endpoints enforce server-side authentication, RBAC authorization, and Admin canonical ID concealment with zero security exceptions.
- **TASK-0805 Audit (2026-08-20):** Confirmed zero secret exceptions and zero dependency exceptions introduced; device acknowledgement processing enforces strict QoS 1 schema validation, stored action assertions, and idempotent duplicate handling without security exceptions.
- **TASK-0806 Audit (2026-08-20):** Confirmed zero secret exceptions and zero dependency exceptions introduced; command event state machine enforces strict QoS 1 schema validation, stored action assertions, physical state mapping, and idempotent duplicate handling without security exceptions.
- **TASK-0807 Audit (2026-08-20):** Confirmed zero secret exceptions and zero dependency exceptions introduced; Faucet Control UI dispatches commands using pure HTTP `Idempotency-Key` header, enforces server-derived volumes, restricts manual actions to modal confirmation, and executes 2.5s status polling strictly during active states with zero blind retries.
- **TASK-0302 / Device Lifecycle Audit (2026-08-23):** Confirmed zero secret exceptions and zero dependency exceptions introduced; device activation and deactivation endpoints enforce strict Owner RBAC authorization (`device.activate` / `device.deactivate`), eliminate hard deletion, and log audit events with zero security exceptions.
- **TASK-0914 Audit (2026-08-26):** Confirmed zero secret exceptions and zero dependency exceptions introduced; direct EMQX Cloud TLS connectivity and dynamic simulator identity strictly adhere to `SEC-OPS-001` (zero unapproved secrets) with runtime credential parsing, strict log redaction, and no hardcoded canonical hardware identities in source code.
- **Controls Loading & Header Centering Audit (2026-08-27):** Confirmed zero secret exceptions and zero dependency exceptions introduced; route loading shell, structural skeletons, and header CSS grid layout enforce presentation safety and zero fabricated sensor data with zero security exceptions.

---

## Direct EMQX Cloud Connectivity & Simulator Security Exceptions Audit Note (Reconciled 2026-08-26)

The verified implementation of `TASK-0914` (`apps/iot-gateway` and simulation scripts direct EMQX Cloud TLS connectivity) introduced zero new security exceptions, zero new secrets, and zero new dependencies:
- **Zero Security Exceptions:** Adheres strictly to `SEC-OPS-001` (zero unapproved secrets) and `SEC-OPS-004` (zero unapproved high vulnerabilities).
- **Environment Isolation:** Topics strictly partitioned into `agriculture/development/...` vs `agriculture/staging/...`, preventing crosstalk on shared broker clusters.
- **Runtime Secret Isolation:** Broker credentials, TLS certs, and user tokens are loaded exclusively via environment variables with zero code tracking. Error messages and health checks strictly redact secrets.
- **Dynamic Identity Security:** Device simulator resolves canonical target IDs dynamically via CLI/env without hardcoded hardware IDs in source code; exact topic and payload `deviceId` parity prevents spoofing vectors.
<!-- TASK-0914 Reconciled: 2026-08-26 -->


## Monitoring and Device Security Exceptions Audit Note (Reconciled 2026-08-19)

The monitoring UUID and history regression fix (`TASK-0306`, `TASK-0501`, `TASK-0503`, `TASK-0504`) introduced zero new security exceptions, zero new secrets, and zero new dependencies:
- **Zero Security Exceptions:** All code changes adhere strictly to `SEC-OPS-001` (zero unapproved secrets) and `SEC-OPS-004` (zero unapproved high vulnerabilities).
- **Safe Identifier Scoping:** Dual UUID/canonical ID resolution in API routes preserves strict IDOR protection, role-based device assignment boundaries, and Admin canonical ID concealment.
- **Frontend Identity Scope:** Frontend monitoring state and hooks strictly use immutable database UUIDs (`devices.id`).

<!-- Reconciled for Manual Faucet Open/Close Control and Volume Presets -->
< ! - -   T A S K - 0 8 0 2   R e c o n c i l e d :   2 0 2 6 - 0 8 - 1 9   - - >

---

## Gateway Command Publishing Security Exceptions Audit Note (Reconciled 2026-08-20)

The verified implementation of `TASK-0804` (`CommandPublisher` in `@kebun-melon/iot-gateway`) introduced zero new security exceptions, zero new secrets, and zero new dependencies:
- **Zero Security Exceptions:** Adheres strictly to `SEC-OPS-001` (zero unapproved secrets) and `SEC-OPS-004` (zero unapproved high vulnerabilities).
- **Zero In-Code Secrets:** MQTT broker credentials and TLS certificates are loaded exclusively via validated runtime environment configuration.
- **Payload Sanitization:** Manual `OPEN`/`CLOSE` commands cleanly omit `phase`, `plantCount`, and `targetVolumeMl` parameters.
<!-- TASK-0804 Reconciled: 2026-08-20 -->

---

## Device Acknowledgement Processing Security Exceptions Audit Note (Reconciled 2026-08-20)

The verified implementation of `TASK-0805` (`AcknowledgementProcessor` in `@kebun-melon/iot-gateway`) introduced zero new security exceptions, zero new secrets, and zero new dependencies:
- **Zero Security Exceptions:** Adheres strictly to `SEC-OPS-001` (zero unapproved secrets) and `SEC-OPS-004` (zero unapproved high vulnerabilities).
- **Topic & Payload Security:** Enforces strict QoS 1 topic validation against `agriculture/{environment}/{siteId}/{deviceId}/ack/faucet`, asserting topic/payload `deviceId` parity and `WATER_TANK_NODE` device type scoping.
- **Action Assertion & Non-Regression:** Validates persisted command actions against `[DISPENSE, OPEN, CLOSE]`, handles duplicate `messageId` occurrences idempotently without redundant writes, and ignores non-`SENT` / out-of-order ACKs safely without exception bypasses.
<!-- TASK-0805 Reconciled: 2026-08-20 -->

---

## Device Execution Event State Machine Security Exceptions Audit Note (Reconciled 2026-08-20)

The verified implementation of `TASK-0806` (`FaucetEventProcessor` in `@kebun-melon/iot-gateway`) introduced zero new security exceptions, zero new secrets, and zero new dependencies:
- **Zero Security Exceptions:** Adheres strictly to `SEC-OPS-001` (zero unapproved secrets) and `SEC-OPS-004` (zero unapproved high vulnerabilities).
- **Topic & Payload Security:** Enforces strict QoS 1 topic validation against `agriculture/{environment}/{siteId}/{deviceId}/event/faucet`, asserting topic/payload `deviceId` parity and `WATER_TANK_NODE` device type scoping.
- **Physical State Integrity:** Prevents false claims of closed valve positions following dispense cycles by mapping `COMPLETED DISPENSE` to `physicalState: 'UNKNOWN'`.
- **Terminal Immutability & Idempotency:** Commands in terminal statuses ignore incoming events without modification; duplicate `messageId` events are ignored without invoking redundant writes.
<!-- TASK-0806 Reconciled: 2026-08-20 -->

---

## Faucet Control UI Security Exceptions Audit Note (Reconciled 2026-08-20)

The verified implementation of `TASK-0807` (Faucet Control UI on `/controls` in `@kebun-melon/web`) introduced zero new security exceptions, zero new secrets, and zero new dependencies:
- **Zero Security Exceptions:** Adheres strictly to `SEC-OPS-001` (zero unapproved secrets) and `SEC-OPS-004` (zero unapproved high vulnerabilities).
- **Idempotency & Header Isolation:** `Idempotency-Key` is transmitted purely via standard HTTP request headers without polluting request payload bodies.
- **Volume Authority:** UI respects server-derived volume calculations, sending only `phase` and integer `plantCount >= 1`.
- **Physical State Safety:** Physical valve state strictly mapped to `OPEN`, `CLOSED`, or `UNKNOWN` without false claims of closed positions after dispensing.
- **Zero Blind Retries:** Polling is read-only `GET` status polling without automatic retries upon failure or timeout.
<!-- TASK-0807 Reconciled: 2026-08-20 -->

---

## Centralized Authentication State Hydration Security Exceptions Audit Note (Reconciled 2026-08-22)

The verified implementation of `TASK-0215` (`AuthContext` and RootLayout SSR Hydration) introduced zero new security exceptions, zero new secrets, and zero new dependencies:
- **Zero Security Exceptions:** Adheres strictly to `SEC-OPS-001` (zero unapproved secrets) and `SEC-OPS-004` (zero unapproved high vulnerabilities).
- **Session Data Minimization:** Context state carries only safe, non-sensitive session metadata (`id`, `fullName`, `email`, `accountStatus`, `activeRoles`). No session tokens or credentials are held in client context or stored in `localStorage`/`sessionStorage`.
- **Server Authorization Primacy:** Hydrated client state is strictly for UI rendering; server-side RBAC guards remain authoritative on all routes and actions.
<!-- TASK-0215 Reconciled: 2026-08-22 -->

---

## Controls Loading & Header Device Selector Security Exceptions Audit Note (Reconciled 2026-08-27)

The verified implementation of `TASK-0807`, `TASK-0502`, and `TASK-0306` (`/controls` Loading & Header Layout Stabilization) introduced zero new security exceptions, zero new secrets, and zero new dependencies:
- **Zero Security Exceptions:** Adheres strictly to `SEC-OPS-001` (zero unapproved secrets) and `SEC-OPS-004` (zero unapproved high vulnerabilities).
- **Data Freshness & Integrity:** Structural skeletons present stable layouts without displaying fabricated telemetry or assumed physical actuator positions.
- **Unmodified Security Baseline:** `scripts/security-exceptions.json` remains completely unmodified and zero exceptions are registered.
<!-- Controls Loading & Header Centering Security Exceptions Reconciled: 2026-08-27 -->

---

## Profile Security & Single Active Session Exceptions Note (Reconciled 2026-08-30)

> **Policy Confirmation:** `ZERO SECURITY EXCEPTIONS INTRODUCED`
> **Associated Tasks:** `TASK-0217` (P0, DONE), `TASK-0216` (P1, DONE)
> **Governing Decisions:** `DEC-AUTH-106`, `DEC-AUTH-107`, `DEC-UIUX-102`

The approved specifications for single active session enforcement (`TASK-0217`) and verified self-email change (`TASK-0216`) introduce zero security exceptions and require zero entries in `scripts/security-exceptions.json`:
- **Single Active Session Security (`DEC-AUTH-107`):** Eliminates multi-session credential sharing risks by enforcing a strict 1-session limit per account. Concurrency is guarded atomically in a PostgreSQL transaction, rejecting conflicting logins with HTTP 409 Conflict without exception bypasses.
- **Verified Email Change Security (`DEC-AUTH-106`):** Adheres strictly to `SEC-AUTH-006` and `SEC-AUTH-007`. Re-authenticates user via current password, generates 6-digit CSPRNG verification codes with 15-minute expiry, stores tokens strictly as SHA-256 hashes, maintains authority of existing email until confirmed, and omits raw email strings from audit logs (`account.email.changed`).
- **Profile UI Privacy (`DEC-UIUX-102`):** Removes misleading "Linked Devices" and omits unapproved client PII (IP address and User-Agent) from frontend display. Change Password consumes existing endpoint with full session revocation.
- **Scanning Governance:** Zero exceptions to `SEC-OPS-001` (zero unapproved secrets) or `SEC-OPS-004` (zero unapproved high vulnerabilities). `scripts/security-exceptions.json` remains completely empty and unmodified.
<!-- Single Active Session & Email Change Security Exceptions Reconciled: 2026-08-30 -->


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
