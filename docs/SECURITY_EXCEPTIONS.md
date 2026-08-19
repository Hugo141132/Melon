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

---

## Monitoring and Device Security Exceptions Audit Note (Reconciled 2026-08-19)

The monitoring UUID and history regression fix (`TASK-0306`, `TASK-0501`, `TASK-0503`, `TASK-0504`) introduced zero new security exceptions, zero new secrets, and zero new dependencies:
- **Zero Security Exceptions:** All code changes adhere strictly to `SEC-OPS-001` (zero unapproved secrets) and `SEC-OPS-004` (zero unapproved high vulnerabilities).
- **Safe Identifier Scoping:** Dual UUID/canonical ID resolution in API routes preserves strict IDOR protection, role-based device assignment boundaries, and Admin canonical ID concealment.
- **Frontend Identity Scope:** Frontend monitoring state and hooks strictly use immutable database UUIDs (`devices.id`).

<!-- Reconciled for Manual Faucet Open/Close Control and Volume Presets -->
