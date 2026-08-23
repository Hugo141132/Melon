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
- Meaning and unit of Battery (`BAT`). **RESOLVED** — `BAT` stands for Battery, incorporated into soil and water quality sensors (`DEC-MON-085`).
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
**Status:** `DONE`
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
**Status:** `DONE`
**Dependencies:** `TASK-0101`
**Completed:** 2026-07-29 — Configured strict TypeScript compiler flags (`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `forceConsistentCasingInFileNames`), package ESLint configs (`packages/contracts`, `packages/database`, `apps/iot-gateway`), fixed React Hook `useEffect` dependencies and unused imports/variables, added unified `check:quality` script in root `package.json`, and verified type checking, linting (0 errors/warnings), Prettier formatting, unit tests, and production build cleanly.

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
**Status:** `DONE`
**Dependencies:** `TASK-0101`
**Completed:** 2026-07-29 — Implemented Zod runtime environment variable schemas for web server (`apps/web/lib/env/server.ts`), web client (`apps/web/lib/env/client.ts`), and IoT gateway (`apps/iot-gateway/src/config/env.ts`). Configured startup validation CLI (`scripts/check-env.ts`), environment unit testing suite (`scripts/test-env.ts`), placeholder `.env.example` templates, secret redacting error handlers, and strict production checks (rejecting insecure `mqtt://` brokers and unapproved `ENABLE_FAUCET_CONTROL=true`). Verified 100% test pass rate via `npm run env:test` and `npm run env:check`.

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
**Status:** `DONE`
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
**Status:** `DONE`
**Dependencies:** `TASK-0104`, `TASK-0002`, `TASK-0105`

### Work

Implemented secure, explicit, one-time CLI first Owner provisioning workflow per `DEC-AUTH-006` (`npm run seed:owner` / `npm run db:test:seed-owner`).

Key Implementation Details:
- Enforces approved password policy directly from `docs/SECURITY.md` §8.2 (12+ chars, upper, lower, digit, special character).
- Uses PostgreSQL transaction-scoped advisory locking (`pg_advisory_xact_lock` with stable 64-bit BigInt `84736291106`) across `Serializable` transaction isolation for race-safe critical section execution.
- Checks existing `OWNER` assignments across ALL user account statuses (`ACTIVE`, `APPROVED`, `PENDING_APPROVAL`, `SUSPENDED`, `DEACTIVATED`) and rejects if any non-revoked `OWNER` role exists.
- Pre-checks canonical `OWNER` role existence in DB; fails non-zero with operator guidance if missing.
- Normalises email (`trim().toLowerCase()`) and checks email uniqueness against pre-existing users (handling mixed-case duplicate email attempts).
- Uses `@node-rs/argon2` for N-API compiled Argon2id password hashing and verification.
- Atomically creates 1 `User` (`ACTIVE`), 1 `UserRoleAssignment` (`OWNER`), 0 `ADMIN` assignments, 0 `AccountApproval` rows, and 1 system `AuditLog` entry (null actor, no secrets or DB URLs).
- Tested separate OS process concurrency race conditions with 2 simultaneous processes.

### Acceptance Criteria

- Public registration cannot create Owner.
- Owner credentials are not committed.
- Provisioning is auditable.
- Provisioning cannot accidentally run repeatedly.
- Owner account is `ACTIVE`.

---

## TASK-0107 — Configure Testing Foundation

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0101`
**Completed:** 2026-08-02 — Configured monorepo testing foundation with unified Vitest workspace (`vitest.workspace.ts`, `vitest.config.ts`), React Testing Library setup in `apps/web` with `jsdom` environment & `@testing-library/jest-dom`, isolated API route test helpers (`apps/web/test/helpers/api-test-helper.ts`), non-destructive PostgreSQL test isolation helpers (`packages/database/src/testing/db-test-helper.ts`), Playwright E2E smoke test setup using Microsoft Edge (`playwright.config.ts` with `channel: "msedge"`, `e2e/smoke.spec.ts`), isolated MQTT test context helpers (`apps/iot-gateway/src/testing/mqtt-test-helper.ts`), V8 coverage reporting, and strongly typed reusable test data factories (`packages/contracts/src/testing/factories.ts`). Verified all unit/integration tests passed across 42 test files, E2E smoke tests passed in Microsoft Edge, environment validation passed 12/12, ESLint & TypeScript passed with 0 errors, Prettier check passed, and Next.js production build succeeded.

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
**Status:** `DONE`
**Dependencies:** `TASK-0102`, `TASK-0107`
**Completed:** 2026-08-02 — Configured GitHub Actions CI pipeline (`.github/workflows/ci.yml`) triggering on pull requests and pushes to `main`. Configured Node.js 20 with `npm` dependency caching, code formatting check (`npm run format:check`), ESLint linting (`npm run lint`), TypeScript type checking (`npm run typecheck`), environment schema validation (`npm run env:check`), environment unit tests (`npm run env:test`), requirement traceability verification (`python scripts/validate-requirements.py`), Prisma client generation & schema validation (`npm run db:generate`, `npm run db:validate`), ephemeral PostgreSQL migration deployment (`npm run db:migrate:deploy`), high-severity dependency security scanning (`npm audit --audit-level=high`), hardcoded credential secret pattern scanning, Vitest unit & integration test coverage (`npm run test:coverage`), Next.js & Fastify production build verification (`npm run build`), bundled Chromium installation (`npx playwright install chromium --with-deps`), and headless Playwright E2E smoke tests (`npm run test:e2e`). Updated `playwright.config.ts` to dynamically use bundled `chromium` when `process.env.CI` is true while preserving `msedge` for local testing. Verified all 44 test suites (349 tests), ESLint, TypeScript, formatting, environment schema, and traceability scripts passed 100% locally.
- **2026-08-19 CI Hardening Reconciliation:** Hardened `.github/workflows/ci.yml` against runner package mirror stalls. Added workflow concurrency cancellation (`cancel-in-progress: true`), job-level 20-minute timeout ceiling, step-level timeouts (5 min for browser install, 7 min for E2E tests), Playwright `--only-shell` optimization to omit unused full Chrome for Testing downloads, and a bounded single-retry fallback for transient apt/network mirror errors. Preserved `TASK-0108` status as `DONE`.

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
**Status:** `DONE`
**Dependencies:** `TASK-0104`
**Completed:** 2026-07-28 — Implemented shared TypeScript domain contracts in `packages/contracts` and repository abstraction in `packages/database`.

### Work

Implemented:

- User entity domain models and contracts.
- Canonical account statuses (`PENDING_APPROVAL`, `APPROVED`, `ACTIVE`, `REJECTED`, `SUSPENDED`, `DEACTIVATED`).
- Password hash exclusion in runtime public DTO (`PublicSafeUserDto`).
- Independent role assignment representation (`UserRoleAssignmentDto`).
- User preference contracts.
- User repository abstraction (`UserRepository`).
- Email normalisation (`trim().toLowerCase()`).

### Acceptance Criteria

- Account statuses use canonical values.
- Password hash is never returned in public-safe DTOs.
- User role is stored independently.
- Public registration path / public input cannot directly set role or status.


---

## TASK-0202 — Implement Password Hashing

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0201`
**Completed:** 2026-07-29 — Extracted reusable pure password service (`packages/database/src/password-service.ts`) using `@node-rs/argon2` (Argon2id), implemented password policy validation per `docs/SECURITY.md` §8.2, refactored first-Owner provisioning, and added unit & integration tests.

### Work

- Use Argon2id via `@node-rs/argon2`.
- Configure secure parameters.
- Add password verification (`verifyPassword`).
- Add password-policy validation (`validatePasswordPolicy`).
- Refactor first-Owner provisioning (`provisionFirstOwner`) to consume reusable password service.

### Acceptance Criteria

- Plain passwords are never stored or logged.
- Hash verification tests pass.
- Unsupported weak hashing is not used.
- Registration and password-change tests pass.

---

## TASK-0203 — Implement Public Admin Registration

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0201`, `TASK-0202`
**Completed:** 2026-07-29 — Implemented public Admin registration via `registerAdminUser` and `POST /api/v1/auth/register` API endpoint. Forced `role = ADMIN` and `accountStatus = PENDING_APPROVAL`, added strict input validation rejecting privilege injection, email normalisation, Argon2id password hashing, structured audit logging (`ACCOUNT_REGISTER_ADMIN`), and complete unit test coverage.

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
**Status:** `DONE`
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
**Status:** `DONE`
**Dependencies:** `TASK-0203`, `TASK-0204`
**Completed:** 2026-07-29 — Implemented status view page (`apps/web/app/(auth)/status/page.tsx`) rendering status-specific UI for `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `SUSPENDED`, `DEACTIVATED`, and `EXPIRED`. Configured server session account-status revalidation (`GET /api/v1/auth/session`), safe logout/support actions, and unit tests.

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
**Status:** `DONE`
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
**Status:** `DONE`
**Dependencies:** `TASK-0206`, `TASK-0002`
**Completed:** 2026-07-29 — Implemented transactional Owner approval (`approvePendingAdmin`) in `UserRepository` (`packages/database`), created API route handler `POST /api/v1/approvals/[userId]/approve` (`apps/web`), added Owner approval action UI in `apps/web/app/approvals/page.tsx`, and added complete unit & Docker-backed PostgreSQL integration test coverage verifying status rechecks, conflict protection (`409 CONFLICT`), `AccountApproval` audit history insertion, `AuditLog` event recording (with secret redaction), and notification failure isolation.

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
**Status:** `DONE`
**Dependencies:** `TASK-0206`
**Completed:** 2026-07-29 — Implemented transactional Owner rejection (`rejectPendingAdmin`) in `UserRepository` (`packages/database`), created API route handler `POST /api/v1/approvals/[userId]/reject` (`apps/web`), updated Owner UI in `apps/web/app/approvals/page.tsx` with rejection action button and error/success states, and added unit test coverage verifying `401`, `403`, `404`, `409` conflict responses, audit log recording without secret exposure, and isolated post-commit notifications.

### Acceptance Criteria

- Only pending accounts may be rejected.
- Decision is transactional.
- Target becomes `REJECTED`.
- Decision is audited.
- Duplicate conflicting actions return conflict.

---

## TASK-0209 — Implement Authorisation Library

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0105`, `TASK-0204`
**Completed:** 2026-07-29 — Implemented server authorisation library (`apps/web/lib/auth/rbac.ts`) with session lookup (`requireSession`), active status revalidation (`requireActiveAccount`), role guards (`requireRole`), permission checks (`requirePermission`), profileee self/permission checks (`requireSelfOrPermission`), assigned device view access (`requireDeviceViewAccess`), and controllable device access (`requireDeviceControlAccess`) with strict `ENABLE_FAUCET_CONTROL` feature flag enforcement. Verified with 18 unit tests in `apps/web/lib/auth/__tests__/rbac.test.ts`.

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
**Status:** `DONE`
**Completed:** `2026-07-30`
**Dependencies:** `TASK-0209`

### Work

- Protect all required pages via Next.js Edge Middleware and server-side authorization guards.
- Protect all API routes using TASK-0209 `requireSession` and `requireRole` authorization helpers.
- Add Owner-only guards (`requireRole(session, UserRole.OWNER)`).
- Add session-expiry and revocation handling (`401 INVALID_SESSION` / automatic cookie clearance).

### Acceptance Criteria

- Direct URL access cannot bypass RBAC.
- Hidden frontend controls are not the only protection.
- Unauthenticated returns `401`.
- Authenticated but forbidden returns `403` or concealed `404`.

---

## TASK-0211 — Implement Self profileee

**Priority:** `P1`
**Status:** `DONE`
**Completed:** `2026-07-30`
**Dependencies:** `TASK-0204`, `TASK-0209`

### Work

Implement:

```text
GET /api/v1/me
PATCH /api/v1/me
```

### Acceptance Criteria

- Owner and Admin can read own profileee.
- Only allowlisted fields can be edited.
- Role and status injection fail.
- Changes are audited where required.

---

## TASK-0212 — Implement Owner User Management

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0209`

### Work

Implemented complete Owner User Management:
- Paginated user list & user details with strict Owner RBAC authorization (`account.read`, `account.update`, `account.suspend`, `account.activate`, `account.deactivate`).
- Admin listing excluding soft-deleted accounts by default.
- Permitted profileee editing strictly allowlisting `fullName` and `username` (`email` read-only).
- Account suspension (`POST /api/v1/users/{userId}/suspend`) and reactivation (`POST /api/v1/users/{userId}/activate`).
- Permanent account hard deletion (`DELETE /api/v1/users/{userId}`) for eligible ADMIN accounts (`ACTIVE`, `SUSPENDED`, `REJECTED`, `DEACTIVATED`, `APPROVED`), excluding `PENDING_APPROVAL` accounts (`409 CANNOT_DELETE_PENDING_APPROVAL`).
- OWNER account deletion protection (`403 FORBIDDEN_TARGET`).
- Transactional deletion of `users` row and all dependent records (`sessions`, `user_roles`, `user_preferences`, `user_device_access`, `account_approvals`, `faucet_commands`, `alert_acknowledgements`).
- Anonymization of historical audit log `actorUserId` to NULL and non-PII `account.deleted` audit log event creation.
- Checkbox + modal UX for account deletion on `/users` with double-submission protection and immediate local state removal.
- Filter cleanup on `/users` omitting `APPROVED` and `DEACTIVATED`.

### Acceptance Criteria

- Admin cannot call user management endpoints (`403 INSUFFICIENT_PERMISSION`).
- Immutable and secret fields cannot be edited (`email`, `role`, `accountStatus`, `passwordHash` strictly protected).
- Status changes and permanent deletion revoke all target active sessions.
- Account deletion executes transactional hard-delete of `users` row and account-owned dependent records, and logs non-PII `account.deleted` audit event.
- `PENDING_APPROVAL` accounts cannot be deleted directly (rejected with `409 CANNOT_DELETE_PENDING_APPROVAL`).
- `OWNER` accounts cannot be deleted or suspended (`403 FORBIDDEN_TARGET`).
- Actions are audited.

---

## TASK-0213 — Implement Password Recovery and Email Reset Flow

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0202`, `TASK-0204`, `TASK-0908`
**Completed:** 2026-08-17 — Implemented end-to-end password recovery and email reset flow with Resend per `DEC-AUTH-102` and server-side guest route guard per `DEC-AUTH-103`. Live Resend credential delivery, password reset completion, single-use token replay rejection, transactional session revocation, account-status preservation, server-side guest redirection with zero UI flash, focused test suites (67/67 tests passed), and the five reserved pre-commit checks (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`) verified and passed 100%.

### Work

- Added input validation schemas (`ForgotPasswordInputSchema`, `ResetPasswordInputSchema`) with strict object checking and audit events (`AUTH_PASSWORD_RESET_REQUESTED`, `AUTH_PASSWORD_RESET_COMPLETED`, `AUTH_PASSWORD_RESET_FAILED`) in `@kebun-melon/contracts`.
- Created `PasswordResetToken` database model in `packages/database/prisma/schema.prisma` and versioned SQL migration `packages/database/prisma/migrations/20260817000000_add_password_reset_tokens/migration.sql`.
- Implemented `createPasswordResetToken` and `resetPasswordWithToken` in `UserRepository` (`packages/database/src/user-repository.ts`):
  - Generates 256-bit (32 bytes) CSPRNG random tokens.
  - Computes and persists cryptographic SHA-256 hash in `password_reset_tokens.token_hash`. Raw token is never persisted in database, logged, or serialized.
  - Transactionally invalidates previous unused tokens for the requesting user.
  - Permits password recovery for any existing account with an email, while strictly preserving `accountStatus` (password reset never activates or changes account status; normal login access checks govern access).
  - Validates password complexity against policy (`validatePasswordPolicy`) and hashes with Argon2id (`@node-rs/argon2`).
  - Marks token used (`used_at = NOW()`), invalidates other tokens for the user, and transactionally revokes all active user sessions across devices (`session-service.ts` per `TASK-0908`).
  - Creates structured audit logs without sensitive tokens, URLs, or passwords.
- Implemented Resend email service (`apps/web/lib/email/resend.ts`) per `DEC-AUTH-102`:
  - Constructs reset URL strictly from server-configured environment (`APP_URL` / `NEXT_PUBLIC_APP_URL`), never trusting request `Host` headers.
  - Enforces strict production validation: requires explicit trusted HTTPS `APP_URL` (rejects `localhost`/`127.0.0.1`) and verified `RESEND_FROM_EMAIL` (rejects `onboarding@resend.dev`).
  - Awaits email delivery without fire-and-forget race conditions.
  - Redacts tokens and credentials from logs.
  - Provides bilingual email templates (Bahasa Indonesia and English) with plain text and clean HTML.
  - Safely simulates delivery in test and unconfigured environments.
- Implemented public API route handlers:
  - `POST /api/v1/auth/forgot-password`: strictly anti-enumeration returning generic HTTP 200 whether email exists or not, with cryptographic timing equalizers, rate-limited at approved 3 requests per minute (`RATE_LIMIT_FORGOT_PASSWORD_MAX = 3`).
  - `POST /api/v1/auth/reset-password`: single-use token verification, password policy check, password confirmation match, session revocation, rate-limited at approved 5 requests per minute (`RATE_LIMIT_RESET_PASSWORD_MAX = 5`). Token expiry is approved as 15 minutes (`AUTH_RESET_TOKEN_EXPIRY_MINUTES = 15`).
- Wired frontend UI:
  - Updated `apps/web/app/(auth)/forgot-password/page.tsx` as Server Component with `requireGuestSession` rendering `ForgotPasswordView` (clean minimalist layout without image frames, empty email input with neutral placeholder, 15:00 countdown timer matching token lifetime with disabled button state, `sessionStorage` cooldown persistence across page refreshes, and 5s auto-dismissing success toast).
  - Created `apps/web/app/(auth)/reset-password/page.tsx` as Server Component with `requireGuestSession` rendering `ResetPasswordView` adhering to `Premium Minimal Ops` (token extraction from query string, show/hide password toggles, client mismatch check, success screen linking to `/login`, invalid token state linking to `/forgot-password`, wrapped in Suspense, inaccessible while authenticated).
  - Implemented server-side guest route guard (`DEC-AUTH-103` / `apps/web/lib/auth/server-guest-guard.ts`) on `/login`, `/register`, `/forgot-password`, and `/reset-password` issuing immediate HTTP 307 redirects to `/` for active sessions with zero UI page flash, while allowing stale/fake sessions to render normally.
- Added bilingual translation keys to `messages/id.json` and `messages/en.json` (100% key and ICU placeholder parity verified via `npm run i18n:check`).
- Added comprehensive unit test coverage across contracts, database, email service, API routes, UI components, and server guest guard (67/67 tests passed 100%).
- Verified responsive layout and zero console errors via Playwright browser testing across desktop and mobile viewports.

### Acceptance Criteria

- [x] Anti-enumeration guarantee: `POST /api/v1/auth/forgot-password` unconditionally returns generic HTTP 200 without revealing account existence.
- [x] Raw reset tokens are high-entropy 256-bit CSPRNG strings and are NEVER stored in plaintext or logged.
- [x] Reset URLs are built solely from trusted server environment configuration, preventing Host Header injection attacks.
- [x] Single-use tokens cannot be reused or replayed after successful password reset.
- [x] Reset tokens expire according to configurable duration (`AUTH_RESET_TOKEN_EXPIRY_MINUTES`, default 15 minutes).
- [x] Password recovery is available for any existing account with an email, while password reset strictly preserves `accountStatus` (never auto-approves pending accounts).
- [x] Successful password reset transactionally revokes all active login sessions across devices (`TASK-0908`).
- [x] Email dispatch via Resend is explicitly awaited and handles failure gracefully.
- [x] Both Indonesian and English locales supported with 100% translation key parity.
- [x] Server-side guest route guards (`DEC-AUTH-103`) eliminate UI page flash on auth routes for active sessions.
- [x] `/forgot-password` UX includes clean input, neutral placeholder, 15:00 countdown timer, `sessionStorage` cooldown persistence, and 5s auto-dismiss toast.

---

## TASK-0214 — Implement Registration Email Verification

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0203`, `TASK-0204`, `TASK-0213`
**Completed:** 2026-08-22 — Redesigned email verification into a secure 6-digit verification code flow per user directive (`{ email, code }` with 15-minute expiry and `sha256(userId:code)` hashing), audited Resend email service and added exponential backoff retry with jitter for rate limits (429) and transient errors, updated verification email template with prominent 6-digit monospace code box, updated `/verify-email` UI with 6-digit code input, target email switcher, and 60-second resend cooldown timer, removed decorative illustration frame from `/reset-password`, and verified 100% test pass rate across 31 unit test suites (255/255 tests) and TypeScript typecheck (0 errors).

### Work

- Added `EmailVerificationToken` database model and versioned migration `20260817082153_add_email_verification_tokens/migration.sql`.
- Added nullable `emailVerifiedAt` timestamp field on `User` entity to track email verification independently of `accountStatus`.
- Implemented `createEmailVerificationToken` and `verifyEmailWithToken` / `verifyEmailWithCode` in `UserRepository` (`packages/database/src/user-repository.ts`):
  - Generates 6-digit numeric CSPRNG random codes (`100000` - `999999`).
  - Computes and stores SHA-256 hash `sha256(userId:code)` in `email_verification_tokens.token_hash` to prevent token collisions.
  - Transactionally invalidates previous unused verification tokens for the user.
  - Sets `emailVerifiedAt = NOW()` upon successful verification without mutating `accountStatus` (`ADMIN` remains `PENDING_APPROVAL`, `OWNER` remains `ACTIVE`).
  - Single-use and replay-safe token invalidation/deletion with 15-minute expiry.
  - Bounded exponential backoff retries (3 attempts) on Prisma `P2034` transaction write conflicts, returning `CONCURRENCY_CONFLICT` (HTTP 409) upon exhaustion.
  - Maps `P2025` record-not-found errors to `TOKEN_ALREADY_USED` (HTTP 400).
- Updated `loginUser` in `session-service.ts` to enforce email verification:
  - Throws `UnverifiedEmailError` (HTTP 403 `EMAIL_NOT_VERIFIED`) when an `OWNER` attempts to login without a verified email.
- Updated Owner approval queries (`getPendingApprovals`, `getPendingApprovalById`, `approvePendingAdmin`, and `rejectPendingAdmin`) to require `emailVerifiedAt IS NOT NULL` before a pending Admin can be approved or rejected (fixed 409 Reject bug caused by missing `emailVerifiedAt: true` projection in `tx.user.findUnique`).
- Unverified Admin accounts remain hidden from the Owner approval list (`/approvals`).
- Updated `registerAdminUser` / `POST /api/v1/auth/register` to dispatch 6-digit email verification code upon successful registration.
- Implemented public API route handlers:
  - `POST /api/v1/auth/verify-email`: validates `{ email, code }` (with backward-compatible `{ token }` fallback) and verifies email ownership without creating or returning a session.
  - `POST /api/v1/auth/resend-verification`: rate-limited (3 req/min) anti-enumeration endpoint with 15-minute code expiry.
- Implemented `/verify-email` page adhering to `Premium Minimal Ops`:
  - 6-digit numeric code input with monospace tracking.
  - Target email display and email switch action.
  - "Resend Code" action with 60-second cooldown timer persisted in `sessionStorage`.
  - In-flight Promise deduplication with immediate cache eviction upon settlement (`finally`).
  - Automatic redirect to `/status?status=PENDING_APPROVAL` for Admin applicants and login prompt for Owners.
  - Removed decorative illustration frames from `/verify-email` and `/reset-password`.
- Integrated server-side guest guard (`DEC-AUTH-103`) redirecting authenticated users visiting `/verify-email` to `/`.
- Added bilingual translation keys to `messages/id.json` and `messages/en.json` (100% key and placeholder parity).
- Extended Resend email service (`apps/web/lib/email/resend.ts`) with bounded exponential backoff retries for transient errors and rate limits (429), and updated bilingual verification code email templates (`sendVerificationEmail`).

### Acceptance Criteria

- [x] Independent verification state: `emailVerifiedAt` is decoupled from `accountStatus`.
- [x] Owner login gate: Unverified Owner accounts are blocked from logging in (HTTP 403 `EMAIL_NOT_VERIFIED`).
- [x] Admin approval and rejection gates: Unverified Admin applicants cannot be approved or rejected by Owner until email is verified (unverified returns 409 `INVALID_STATUS`).
- [x] Admin status preservation: Verified Admin accounts strictly remain `PENDING_APPROVAL` and redirect to `/status?status=PENDING_APPROVAL` until Owner approval.
- [x] Session-free verification: `POST /api/v1/auth/verify-email` strictly verifies email ownership without issuing authentication sessions.
- [x] Code security: Verification codes are 6-digit numeric CSPRNG strings, stored as scoped SHA-256 hashes (`userId:code`), expiring in 15 minutes, and single-use/replay-safe.
- [x] Rate limiting & Anti-enumeration: `POST /api/v1/auth/resend-verification` enforces 3/min rate limit and returns generic HTTP 200 without exposing account existence.
- [x] Resend reliability: Added exponential backoff retry with jitter up to 3 attempts for 429 rate limits, 5xx server errors, and network timeouts.
- [x] Concurrency & Deduplication: Handled Prisma `P2034` write conflict retries and React StrictMode in-flight request deduplication with settlement eviction.
- [x] Server-side guest guard: Authenticated users navigating to `/verify-email` and `/reset-password` are redirected to `/` with zero UI flash.
- [x] Auth UI compliance: Removed decorative illustration frames from `/reset-password` and `/verify-email` conforming to `Premium Minimal Ops`.
- [x] Full I18N support: Bilingual verification UI and email templates with 100% key parity across `id` and `en`.

---

## TASK-0215 — Centralized Authentication State Hydration

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0204`, `TASK-0208`, `DEC-AUTH-105`
**Completed:** 2026-08-22 — Implemented centralized authentication state hydration to eliminate delayed UI rendering and layout shifts across navigation and protected pages. Added React `AuthContext` (`AuthProvider` / `useAuth()`) in `@kebun-melon/web`, providing unified access to `{ user, role, isAuthenticated }`. Implemented `getSessionOrNull()` server helper in `lib/auth/rbac.ts` for safe, non-throwing session retrieval in `RootLayout` during SSR. Eliminated redundant client-side `useEffect` and `fetch('/api/v1/auth/session')` calls from `/`, `/setting`, `/profileee`, `TopAppBar`, and `Sidebar`. Refactored `Sidebar` and `TopAppBar` to consume `useAuth()` directly, removing unnecessary prop drilling. Refactored `/setting` and `/profileee` to instantaneously render user profileee identity and role-conditional menu items (`/users` and `/approvals` for `OWNER`) without loading spinners. Maintained strict server-side RBAC and route protection. Verified 100% test pass rate across 35 unit test suites (260/260 tests) and 14 E2E critical flows.

### Work

- Created `apps/web/context/AuthContext.tsx` providing `AuthProvider` and `useAuth()` hook for managing hydrated `{ user, role, isAuthenticated }` state.
- Implemented `getSessionOrNull()` in `apps/web/lib/auth/rbac.ts` to safely retrieve and validate the active session token without throwing exceptions on unauthenticated/missing sessions.
- Updated `apps/web/app/layout.tsx` to retrieve the session during server rendering and wrap the application tree with `AuthProvider`.
- Refactored `apps/web/app/page.tsx` to consume `useAuth()` for user greeting and removed client-side fetch logic.
- Refactored `apps/web/components/navigation/TopAppBar.tsx` to consume `useAuth()` for avatar rendering and removed `user` prop drilling into `Sidebar`.
- Refactored `apps/web/components/navigation/Sidebar.tsx` to consume `useAuth()` directly for username formatting and role-based menu filtering (`/users` and `/approvals`).
- Refactored `apps/web/app/setting/page.tsx` to consume `useAuth()`, removing client-side session fetching, spinners, and latency.
- Refactored `apps/web/app/profileee/page.tsx` to consume `useAuth()`, eliminating blocking full-page loading spinners.
- Updated unit test suites `sidebar-navigation.test.tsx` and `device-selector-localization.test.tsx` with `AuthContext` mocks.
- Created `apps/web/test/unit/setting-page.test.tsx` to verify immediate hydration and role-based menu display on `/setting`.
- Created `apps/web/test/unit/profileee-page.test.tsx` to verify immediate hydration and I18N display on `/profileee`.

### Acceptance Criteria

- [x] Initial session is hydrated server-side in `RootLayout` with lightweight user/role metadata.
- [x] Zero UI flashing or delayed role recognition on initial page load across protected routes.
- [x] Redundant client-side calls to `/api/v1/auth/session` on mount removed from `/`, `/setting`, and `/profileee`.
- [x] `TopAppBar` and `Sidebar` consume `useAuth()` without prop-drilling.
- [x] `OWNER`-only menu items (`/users`, `/approvals`) on `/setting` and `Sidebar` render immediately based on hydrated role state.
- [x] Security architecture and server-side RBAC enforcement remain unaffected.
- [x] All unit tests pass (100% pass rate).

---

# 11. Phase 3 — Device Registry and Access

## TASK-0301 — Implement Site Model

**Priority:** `P2`
**Status:** `SUPERSEDED`
**Dependencies:** `TASK-0302`
**Completed:** 2026-08-02 — Superseded by single default site in device schema in `TASK-0302` (`DONE`); multi-site UI selector explicitly deferred to Phase 11 (`TASK-1105`) per `DEC-DEV-026`.

### Work

Implement sites if required for version 1.

### Acceptance Criteria

- Site code is unique.
- Devices may be scoped to a site.
- Site access integrates with Owner scope.

---

## TASK-0302 — Implement Device Registry

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0104`
**Completed:** 2026-08-23 — Reconciled and implemented Device Registry per `DEC-DEV-027`, `DEC-DEV-028`, and `DEC-DEV-030`:
- Removed all in-app/API device creation (`POST /api/v1/devices`, "Add Device" button/modal, creation DTOs/types, and `device.create` permission from `seed.ts` and `device-repository.ts` per `DEC-DEV-027`); existing pre-provisioned devices remain preserved in PostgreSQL database.
- Permanently eliminated hard device deletion (`DELETE /api/v1/devices/{deviceId}` and delete UI modal removed per `DEC-DEV-030`), preserving all historical relational telemetry, alerts, and audit logs.
- Implemented `POST /api/v1/devices/{deviceId}/activate` and `POST /api/v1/devices/{deviceId}/deactivate` backed by `activateDevice` and `deactivateDevice` in `DeviceRepository` with `device.activate` and `device.deactivate` Owner permissions.
- Pre-seeded canonical devices (`soil-node-001`, `water-quality-node-001`, and `water-tank-node-zi37gz`) immediately visible to Owner by default.
- Enforced internal database primary key UUID (`devices.id`) immutability, preserving all relational references (`user_device_access`, telemetry, commands, alerts) across external renames.
- Allowed Owner to update external canonical `deviceId` and `name` via `PATCH /api/v1/devices/{deviceId}` with canonical uniqueness enforcement (`DeviceConflictError` -> HTTP 409 `DUPLICATE_DEVICE_ID`).
- Enforced strict Admin canonical `deviceId` concealment across `GET /api/v1/devices`, `GET /api/v1/devices/{deviceId}`, and `/devices` UI cards via role-based projection (`DEC-DEV-028`).
- Strictly protected device secrets and credentials, preventing client overrides of server-controlled status/telemetry fields via `.strict()` schema stripping.
- Documented physical ESP32/NodeMCU firmware reconfiguration and EMQX broker credential/ACL synchronization following a rename as **TBD / BLOCKING** operational automation (`DEC-DEV-028`).
- Verified 100% test pass rate across unit test suites (`device-repository.test.ts` 12/12, `route.test.ts` 24/24), TypeScript typecheck (0 errors), Next.js production build (37/37 routes), and pre-commit quality gate (`npm run check:quality`).

### Work

Implement:

- Device identity (immutable DB UUID `id`, Owner-editable external `deviceId`).
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
- In-app device creation is removed (`DEC-DEV-027`).
- Canonical `deviceId` is editable by Owner and concealed from Admin (`DEC-DEV-028`).

---

## TASK-0303 — Implement Device Capabilities

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0302`
**Completed:** 2026-07-30 — Implemented typed device capabilities with single server-authoritative mapping source in `@kebun-melon/contracts`, runtime feature detection helper `supportsCapability`, MONITORING vs CONTROL capability categorization (`getCapabilityCategory`), atomic transaction reconciliation on device profileee (`deviceType`) update in `@kebun-melon/database`, controlled one-time DB reconciliation removing obsolete `RELAY_CONTROL` & `SOLENOID_VALVE_CONTROL` rows on `water-tank-node-ryd0at`, and read-only capability rendering under Monitoring and Control headers on `/devices` UI. Added unit and integration test coverage across contract, database, and frontend layers.

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
**Status:** `DONE`
**Dependencies:** `TASK-0302`, `TASK-0209`
**Completed:** 2026-07-31 — Implemented management of User ↔ Device assignment relationships. Owner can assign devices to Admin users and revoke assignments (`assignedBy`, `assignedAt`, `revokedAt`). Historical revoked rows are retained in PostgreSQL (`revokedAt IS NOT NULL`), and single active assignment per (user_id, device_id) is enforced by partial unique index `user_device_access_active_user_device_unique`. Active assigned devices display cleanly in the Owner management UI, with instant UI updates on revocation, and revoked devices immediately becoming available for reassignment. Added comprehensive unit and integration test coverage across contract, API, database repository, and frontend layers.

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
**Status:** `DONE`
**Dependencies:** `TASK-0304`
**Completed:** 2026-07-31 — Implemented authorised device listing and device detail access endpoints (`GET /api/v1/devices`, `GET /api/v1/devices/{deviceId}`). `OWNER` role receives global device visibility across all sites. `ADMIN` role receives strictly scoped device access filtered by active `UserDeviceAccess` assignments (`revokedAt === null`), with revoked or unassigned devices disappearing immediately and direct access attempts returning HTTP 403 `DEVICE_NOT_ASSIGNED`. Integrated dynamic `permissions` DTO (`canView`, `canControl`) on all returned device objects, dynamically evaluated using RBAC, active account status, device capabilities, and the `ENABLE_FAUCET_CONTROL` feature flag. Added comprehensive unit and integration test coverage across list filtering, detail authorization, permissions computation, and negative auth security rules.
**Reconciliation & Hardening (2026-08-18):** Reconciled endpoints per `DEC-DEV-027` and `DEC-DEV-028`:
- `GET /api/v1/devices` and `GET /api/v1/devices/{deviceId}` enforce role-based projection: canonical `deviceId` is included for Owner users and strictly concealed (omitted or masked) for Admin users (`DEC-DEV-028`) while preserving safe internal UUID `id`.
- `GET /api/v1/devices/{deviceId}` hardened with baseline permission check (`requirePermission(session, 'device.read')`) and active account enforcement prior to database lookup, eliminating device-existence leakage on non-active accounts.
- `PATCH /api/v1/devices/{deviceId}` verified for Owner-only updates to canonical `deviceId` string and user-facing `name` with duplicate rejection (HTTP 409 `DUPLICATE_DEVICE_ID`), while preserving immutable database UUID `devices.id` and relational foreign keys.
- Confirmed `POST /api/v1/devices` creation path remains completely removed (`DEC-DEV-027`).
- Verified query performance on Supabase staging DB: index-only scan on `user_device_access_active_user_device_unique` (`revokedAt IS NULL`), index scans on `devices_pkey` and `device_capabilities`, zero N+1 queries, zero performance regression, and zero schema/index changes required.
- Verified 100% test pass rate across 5 test suites (58/58 tests: 24/24 route tests, 10/10 repository tests, 7/7 contract tests, 6/6 page tests, 11/11 selector tests), Semgrep scan (0 findings), and TypeScript typecheck (0 errors).

### Work

Implement:

```text
GET /api/v1/devices
GET /api/v1/devices/{deviceId}
PATCH /api/v1/devices/{deviceId}
```

### Acceptance Criteria

- Admin sees only assigned devices.
- Owner sees devices within approved scope.
- Canonical `deviceId` is concealed from Admin users across all responses (`DEC-DEV-028`).
- Device permissions include `canView` and `canControl`.
- Device ID manipulation fails.

---

## TASK-0306 — Implement Device Selector

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0305`
**Completed:** 2026-07-31 — Implemented DeviceContext provider and DeviceSelector component in apps/web. Sourced authorised devices exclusively from GET /api/v1/devices, adhering strictly to OWNER global scope and ADMIN assigned device scope. Handled 6 core UI states: Loading (skeleton), 0 devices (empty state, metrics/controls disabled), 1 device (active badge), multiple devices (>1 dropdown with search and status filters), revoked access (notice banner and safe fallback), and API error. Implemented URL (?deviceId=...) and localStorage candidate validation against the server-authorised list to prevent client-side tampering. Integrated selector into TopAppBar and RootLayout. Added comprehensive unit and integration test coverage (apps/web/app/devices/test/selector.test.ts).
**Reconciliation Note (2026-08-18):** Reconciled component per `DEC-DEV-028` and `DEC-DEV-029`:
- Canonical `deviceId` in selector UI is displayed only for Owner users; Admin users see only user-facing device `name` or localized default label (`DEC-DEV-028`).
- Persistent restoration of previously/last-accessed device history across logins/persistent storage is REMOVED (`DEC-DEV-029`). Selection resolves into a neutral state (`selectedDevice = null`) on fresh bare routes (`/`, `/sensor`, `/soil` without `?deviceId=`).
- Device selection occurs strictly through explicit user interaction in `/sensor` or the header `DeviceSelector`, synchronizing to active route URL (`?deviceId=...`). Hard refresh (Ctrl+Shift+R) on a specific device route rehydrates that candidate after server-side validation against the fresh `GET /api/v1/devices` authorized list.
- If currently selected device access is revoked/unassigned, selection clears to `null` with a notice banner, without silent fallback.
- Handled loading skeleton states vs true empty lists on `/sensor`.
- Historical telemetry charts (`TASK-0503`/`TASK-0504`), faucet commands, assignments, status events, and audit logs remain 100% intact (`DEC-DEV-029`).

### Work

Frontend states:

- Loading.
- Neutral initial state (no device selected).
- One device.
- Multiple devices.
- No assigned devices.
- Revoked access.
- Error.

### Acceptance Criteria

- All device-specific panels use one selected device.
- Canonical `deviceId` is hidden from Admins in selector UI (`DEC-DEV-028`).
- Switching devices clears misleading prior values.
- Unauthorised devices cannot be selected through URL manipulation.
- Default selection resolves into a neutral state (`selectedDevice = null`) without auto-selection on fresh load/session (`DEC-DEV-029`).
- All telemetry, command, assignment, status, and audit history remain intact (`DEC-DEV-029`).

---

# 12. Phase 4 — IoT Gateway and Telemetry Ingestion

## TASK-0401 — Create IoT Gateway Service

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0101`, `TASK-0002`
**Completed:** 2026-07-31 — Implemented long-running IoT Gateway Fastify/TypeScript service in `apps/iot-gateway`. Integrated `GatewayMqttClient` supporting MQTT 5.0/3.1.1 fallback with TLS configuration, state tracking (`DISCONNECTED`, `CONNECTING`, `CONNECTED`, `RECONNECTING`, `ERROR`), and automatic exponential reconnect logic. Configured Zod environment validation (`apps/iot-gateway/src/config/env.ts`) and secret redaction (`redactSecrets`, `redactString`). Exposed `GET /health` (pass, uptime, timestamp) and `GET /ready` (real DB `prisma.$queryRaw` check + MQTT connection status). Created subsystem module scaffolds for topic router, message validator, telemetry processor, status processor, command publisher (`retain = false`), acknowledgement processor, and structured observability logger. Added unit test suites (`apps/iot-gateway/src/__tests__/`) verifying config validation, health/readiness, MQTT lifecycle, graceful shutdown, and secret redaction. Verified clean manual runtime testing.

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
**Status:** `DONE`
**Dependencies:** `TASK-0401`
**Completed:** 2026-07-31 — Configured local Eclipse Mosquitto MQTT broker via Docker Compose (`docker-compose.yml`), `docker/mosquitto/config/mosquitto.conf` (disabling anonymous access `allow_anonymous false`, configuring password & ACL files), `docker/mosquitto/config/acl.conf` (defining gateway `gateway_user` full access `readwrite agriculture/#`, per-device topic isolation for `device_esp32_001`, `device_node_002`, `unauthorized_device`, and dynamic patterns `%u`), and `scripts/generate-mqtt-pwfile.ts` (generating PBKDF2-SHA512 hashed credentials in `docker/mosquitto/config/pwfile`). Created verification script `scripts/test-mqtt-broker.ts` (`npm run mqtt:test`) and Vitest test suite (`apps/iot-gateway/src/__tests__/broker-config.test.ts`) covering anonymous rejection, valid login, cross-device ACL denial, gateway permissions, and non-retained faucet command policies. Verified 100% test pass rate.

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
**Status:** `DONE`
**Dependencies:** `TASK-0401`
**Completed:** 2026-07-31 — Implemented full MQTT topic parsing, structural validation, environment isolation, device-payload matching (`isTopicPayloadMatch`), wildcard rejection, and subscription topic pattern helpers (`getSubscriptionPattern`, `getCategorySubscriptionPattern`, `buildTopic`) per `docs/DEVICE_COMMUNICATION.md` §8. Added comprehensive unit test suite in `apps/iot-gateway/src/__tests__/topic-router.test.ts`.

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
**Status:** `DONE`
**Dependencies:** `TASK-0403`
**Completed:** 2026-08-01 — Extended MessageValidator scaffold (`apps/iot-gateway/src/validation/validator.ts`) to validate payload byte size limits (default 64 KB, returning `MESSAGE_TOO_LARGE`), JSON parsing (`INVALID_JSON`), non-null object payload (`INVALID_SCHEMA`), schemaVersion 1.0 (`UNSUPPORTED_SCHEMA_VERSION`), envelope fields (UUID messageId, deviceId, ISO timestamp, sequence), topic/payload device ID mismatch (`TOPIC_DEVICE_MISMATCH`), and recursive non-finite numeric checks (`INVALID_VALUE`). Added comprehensive unit test suite in `apps/iot-gateway/src/__tests__/message-validator.test.ts`.

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
**Status:** `DONE`
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
**Status:** `DONE`
**Dependencies:** `TASK-0404`, `TASK-0104`
**Completed:** 2026-08-10 — Implemented Water Quality Telemetry Ingestion contracts (`WaterTelemetryDataSchema`, `WaterTelemetryPayloadSchema`, `IngestWaterTelemetryInput`), database repository ingestion method (`ingestWaterReading`), and HTTPS REST API endpoint (`POST /api/v1/devices/[deviceId]/telemetry/water`). Strictly conformed to `DEC-DEV-020` and `DEC-MON-086`: `BAT` parameter is completely removed from soil and water-quality telemetry (`DEC-MON-086`, superseding `DEC-MON-085`); `latitude` and `longitude` are deleted parameters; Water Quality Telemetry uses REST API over Wi-Fi (`ph`, `tds`, `ec`, `status`), while reservoir `tankVolume` and `flowRate` remain on the MQTT/IoT Gateway path (`WATER_TANK_NODE`). Preserved explicit numeric zero (`0`) vs `null`, handled duplicate `messageId` idempotently (returning HTTP 200 with `isDuplicate: true`), and added unit test suites in `@kebun-melon/contracts`, `@kebun-melon/database`, and `web`.

### Work

Process (Water Quality Telemetry over REST API per `DEC-DEV-020`):

```text
ph
tds
ec
status
```

*Note on Stale Backlog Text & BAT Removal Resolution:* In accordance with document precedence (`docs/DECISIONS.md` §2.3 `DEC-DEV-020` & `DEC-MON-086`), `battery` (`BAT`), `latitude`, and `longitude` are deleted parameters and are omitted from water quality telemetry. Reservoir `tankVolume` and `flowRate` belong exclusively to Reservoir Water Telemetry on the MQTT/IoT Gateway path (`WATER_TANK_NODE`, `TASK-0404`).

### Acceptance Criteria

- Obsolete coordinate parameters (`latitude`/`longitude`) and `BAT` parameter are not reintroduced (`DEC-MON-086`).
- Missing values are not converted to zero.
- Duplicate message IDs are idempotent.

---

## TASK-0407 — Implement Heartbeat and Device Status

**Priority:** `P0`
**Status:** `DEFERRED`
**Dependencies:** `TASK-0404`
**Blocked Reason:** Deferred from the current release. Operational parameters (offline/stale threshold minutes) are not available yet (`DEC-DEV-030`).

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
**Status:** `DONE`
**Dependencies:** `TASK-0402`, `TASK-0404`, `TASK-0405`
**Completed:** 2026-08-11 — Implemented multi-device operational simulator in `scripts/device-simulator.ts` and unit test suite in `apps/iot-gateway/src/__tests__/device-simulator.test.ts`. Configured REST API ingestion (Soil & Water telemetry per `DEC-DEV-020`, `DEC-MON-086`), MQTT Reservoir Telemetry (`WATER_TANK_NODE`), Faucet Command ACK, Progress, Completion, Failure lifecycle, duplicate/invalid/out-of-order payloads, and disconnect/reconnect cycles. Explicitly reported `TASK-0407` (heartbeat thresholds) and `TASK-0809` (command timeouts) as  BLOCKED (timeout values unresolved) due to TBD numeric values.
**Notes:** Adapted to simulate available Soil Telemetry (REST per `TASK-0405`), Water Tank (`WATER_TANK_NODE`) Telemetry (MQTT per `DEC-DEV-020`), and Faucet Command Acknowledgements, while ignoring blocked water quality & heartbeat payloads until unblocked.

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
**Status:** `DONE`
**Dependencies:** `TASK-0401`
**Completed:** 2026-08-01 — Implemented broker-agnostic `GatewayMetricsCollector` in `apps/iot-gateway/src/observability/metrics.ts` tracking broker connection states, message counters (valid, invalid, duplicate, unknown device attempts), telemetry ingestion latency statistics, active device counts, and command status. Enhanced `logger.ts` LogMeta for correlation IDs (`correlationId`, `messageId`, `commandId`, `deviceId`, `ingestionId`, `requestId`) and automated secret redaction. Integrated metric recording into `GatewayMqttClient` and `CommandPublisher`. Preserved existing `/health` and `/ready` routes without changes or unspec'd public endpoints. Added unit test suite `apps/iot-gateway/src/__tests__/metrics.test.ts`. Verified 88/88 test pass rate, lint, diff-check, and status.

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
**Status:** `DONE`
**Dependencies:** `TASK-0405`, `TASK-0305`
**Completed:** 2026-08-05 — Implemented latest monitoring endpoints (`GET /api/v1/devices/[deviceId]/monitoring/latest`, `GET /api/v1/devices/[deviceId]/monitoring/soil/latest`, `GET /api/v1/devices/[deviceId]/monitoring/water/latest`) serving soil, water quality, and reservoir metrics with RBAC access verification and zero/null semantics preserved.
**Reconciliation & Hardening (2026-08-19):** Reconciled route handlers and data access layers to accept both canonical string `deviceId` and immutable database primary key `devices.id` UUID in route params. Hardened RBAC checks (`requireDeviceViewAccess`) and repository lookup to transparently resolve device identity across both identifier forms. Preserved strict Admin canonical `deviceId` concealment (`DEC-DEV-028`). Added unit test coverage for UUID-based querying with 100% pass rate.

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
- Dual identifier resolution (UUID and canonical `deviceId`) is supported.

---

## TASK-0502 — Implement Monitoring Dashboard

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0501`, `TASK-0306`
**Completed:** 2026-08-05 — Implemented full multi-device monitoring dashboard with domain route partitioning (`/soil` for soil metrics, `/water` for water quality metrics, `/controls` for reservoir water tank metrics & faucet controls, and `/sensor` overview), centered top-bar `DeviceSelector` with automatic route prefetching and device restoration from `DeviceContext`/`sessionStorage`/`localStorage`, dynamic user display name without hardcoded fallbacks, neutral `Pengguna` account placeholder during loading/unauthenticated states, preserving existing design aesthetic and responsive layout, with full unit test coverage and quality verification.

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
**Status:** `DONE`
**Dependencies:** `TASK-0405`
**Completed:** 2026-08-11 — Implemented Historical Query API endpoints (`GET /api/v1/devices/[deviceId]/monitoring/soil/history` and `GET /api/v1/devices/[deviceId]/monitoring/water/history`) adhering to `DEC-MON-087` (default range: last 24h, max range: 31 days, default `pageSize`: 20, max `pageSize`: 100). Enforced RBAC and device access authorization, preserved null/missing values without zero-coercion, separated water-quality telemetry from reservoir data, omitted combined-history endpoint, and utilized indexed database queries (`soil_readings_device_received_idx` and `water_readings_device_received_idx`). Updated unit and integration test coverage across contract, database, and API layers.
**Reconciliation & Hardening (2026-08-19):** Reconciled historical route handlers and `TelemetryRepository` to accept both canonical `deviceId` and immutable database UUID `devices.id`. Verified queries returning zero records return HTTP 200 `{ series: [], pagination: { ... } }`, avoiding false 404 errors per `DEC-MON-087`. Added targeted unit test suites with 100% pass rate.

### Work

Implement bounded history for soil and water.

### Acceptance Criteria

- Date range is validated.
- Device access is enforced.
- Missing intervals remain missing or null.
- Zero-record queries return HTTP 200 with empty series, not 404 (`DEC-MON-087`).
- Pagination or aggregation prevents unbounded queries.
- Indexes are used.
- Dual identifier resolution (UUID and canonical `deviceId`) is supported.

---

## TASK-0504 — Implement Historical Charts

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0503`
**Completed:** 2026-08-12 — Implemented historical monitoring chart components and data fetching layer (`useHistoricalMonitoring` hook, `HistoricalChartControls`, `NPKChart`, `WaterNutrientChart`) on canonical `/soil` and `/water` routes (legacy `/tanah` and `/air` return 404 Not Found). Enforced `DEC-MON-087` & `DEC-MON-088` date-range validation (default 24h, max 31 days) and raw pagination item concatenation (`pageSize=100`, page 1..N). Preserved `null` values as visual gaps (`connectNulls={false}`), handled empty history with HTTP 200 and no-data UI (no fake zeros or 404s), synchronized `DeviceSelector` context across routes, resolved canonical string `deviceId` and database UUID lookups, converted stored `mS/cm` EC values to `µS/cm` for display, applied Indonesian localization (`id-ID`) for timestamps and UI text, and supported responsive mobile layouts (360px–430px). Verified 100% pass across targeted unit tests (`apps/web/test/unit/historical-charts.test.tsx`), authenticated Playwright OWNER/ADMIN E2E testing, full pre-commit verification suite (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`), and 17-file specification document reconciliation.
**Reconciliation Note (2026-08-19):** Reconciled `useHistoricalMonitoring` hook and sensor domain pages (`/soil`, `/water`) to consistently pass immutable database UUID `devices.id` in `activeDeviceId`. Verified clean empty state rendering on HTTP 200 empty responses without erroneous 404 banners.

### Work

Implement bounded historical chart visualization.

### Acceptance Criteria

- Metrics can be selected.
- Date range can be changed.
- Missing values are represented accurately.
- Chart text is localised.
- Mobile layout remains usable.

---

## TASK-0505 — Implement Realtime Monitoring Stream

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0401`, `TASK-0501`
**Completed:** Implemented in-memory Server-Sent Events (SSE) streaming route `GET /api/v1/realtime/stream` and `RealtimeEventHub` (`apps/web/lib/realtime/event-hub.ts`) per `DEC-INF-077` and `DEC-DEV-020`. Enforced initial session authentication (`requireSession`), active account revalidation (`requireActiveAccount`), target device view access authorization (`requireDeviceViewAccess`), and event filtering by `deviceId` and `channels`. Integrated `verifyStreamSessionActive` in heartbeat loop to emit `session.expired` and terminate stream on session expiry/revocation (completing `TASK-0908`), and rechecked device access to emit `access.revoked` and terminate stream on device unassignment. Added `useRealtimeMonitoring` hook (`apps/web/hooks/use-realtime-monitoring.ts`) with automatic fallback to polling. Verified 100% test pass rate across unit test suite (`apps/web/test/unit/realtime-stream.test.ts`).

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
**Status:** `DONE`
**Dependencies:** `TASK-0001`
**Notes:** `next-intl` approved for Next.js App Router per `DEC-I18N-068`. Default `id`, fallback `en`, non-prefixed cookie strategy (`locale`).

### Work

Configure `next-intl` infrastructure for `@kebun-melon/web`:

- Configure locales `id` (default) and `en` (fallback).
- Configure non-prefixed cookie routing strategy (`locale`).
- Create `i18n/request.ts` request configuration.
- Support Server Components and Client Components.
- Handle missing translation keys safely without throwing or exposing raw keys.
- Create minimal bootstrap message files to verify configuration.

### Acceptance Criteria

- `en` and `id` are configured.
- Default (`id`) and fallback (`en`) locales are enforced.
- Non-prefixed cookie resolution is active.
- Safe missing key handling falls back to `en` message without exposing raw keys.
- Server and client rendering are supported.

---

## TASK-0602 — Create Translation Namespaces

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0601`
**Completed:** 2026-08-13 — Created complete translation namespaces for `id` (Bahasa Indonesia) and `en` (English) per `docs/I18N.md` §10-§17.

### Work

Created the 17 approved translation namespaces across `apps/web/messages/id.json` and `apps/web/messages/en.json`:

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
profileee
settings
validation
errors
accessibility
```

Key Implementation Details:
- Preserved existing TASK-0601 `system` namespace and infrastructure (`request.ts`, `config.ts`, `middleware.ts`).
- Enforced 100% recursive key set parity between `id.json` and `en.json`.
- Provided real, non-empty Bahasa Indonesia and English translations matching product terminology from `docs/I18N.md`.
- Enforced matching ICU/next-intl interpolation placeholders (`{time}`, `{count}`, `{volume}`, `{name}`, `{metric}`, `{message}`, `{deviceId}`, `{deviceName}`) between locales.
- Preserved canonical technical abbreviations untranslated (`N`, `P`, `K`, `pH`, `EC`, `TDS`, `ESP32`, `NodeMCU`, `MQTT`, `API`, `RBAC`, `mL`, `L`, `°C`, `%`).
- Omitted soil/water quality `BAT` parameter per `DEC-MON-086`.
- Added targeted Vitest unit test suite in `apps/web/test/unit/i18n-namespaces.test.ts` verifying 100% key parity, namespace presence, non-empty values, placeholder equivalence, and technical term preservation (7/7 tests passed).
- Verified `npx tsc --noEmit` cleanly passed with 0 errors and `npx prettier` code formatting verified.
- User manually executed and verified reserved pre-commit suite (`npm run check:quality`). Hard-coded component UI text replacement remains TASK-0603; language gate and settings UI selector belong to TASK-0604.

### Acceptance Criteria

- Key sets match between locales.
- No empty required translation exists.
- Interpolation placeholders are consistent.

---

## TASK-0603 — Replace Hard-Coded UI Text

**Priority:** `P1`
**Status:** `DONE`
**Completed:** 2026-08-14 — Replaced hard-coded user-facing text across all auth and protected routes using `next-intl` translation hooks with 100% key parity across `messages/id.json` and `messages/en.json`. Enforced presentation-layer translation while keeping API, database, MQTT, and RBAC values canonical and untranslated. Verified 100% pass rate across 15 unit test suites (107/107 tests passed), clean TypeScript typecheck (`tsc --noEmit` 0 errors), Next.js production build (`31/31` static pages), Playwright browser verification on `/login` and `/register`, and verified user-reported completion of all 5 reserved pre-commit checks (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`).
**Dependencies:** `TASK-0602`
**Frontend Impact:** `MINOR`
**Selected UI Direction:** `Premium Minimal Ops`
**Existing Color Template:** `UNCHANGED`
**Selected Motion Effects:** `None`
**21st.dev MCP:** `NOT REQUIRED`

### Work

- Conducted exhaustive literal sweeps and replaced hard-coded user-facing text with `next-intl` translation keys across all auth and protected pages:
  - Auth routes: `/(auth)/login`, `/(auth)/register`, `/(auth)/status`, `/(auth)/forgot-password`
  - Core navigation: `Sidebar.tsx`, `TopAppBar.tsx`, `DeviceSelector.tsx`
  - Protected views: `/` (`MonitoringDashboard.tsx`), `/sensor`, `/soil`, `/water` (`WaterTankMonitoringCard.tsx`), `/controls` (`FaucetControlPanel.tsx`, `FaucetPresetSelector.tsx`, `FaucetConfirmationModal.tsx`, `FaucetStatusCard.tsx`, `FaucetHistoryTable.tsx`), `/devices`, `/users`, `/approvals`, `/setting`, `/profileee`, `/notifikasi`
  - Historical telemetry charts & controls: `NPKChart.tsx`, `WaterNutrientChart.tsx`, `HistoricalChartControls.tsx`
- Enforced 100% key parity across `messages/id.json` and `messages/en.json` (all 17 namespaces + `system`).
- Preserved internal untranslated canonical values (API enums, database fields, MQTT topics, audit keys, hardware types, raw measurements, and unit symbols: `N`, `P`, `K`, `pH`, `EC`, `TDS`, `ESP32`, `NodeMCU`, `MQTT`, `mL`, `L`, `°C`, `m³/h`, `ppm`, `µS/cm`).
- Preserved `BAT` parameter removal per `DEC-MON-086`.
- Maintained request-scoped `i18n/request.ts` configuration compatible with default Next.js 16 Turbopack build and dev execution.
- Verified all 15 targeted unit test suites (107/107 tests passed) via Vitest.
- User personally executed and confirmed all 5 reserved pre-commit checks (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`).

### Acceptance Criteria

- [x] Authentication and protected pages are translated.
- [x] Status badges are translated at presentation time.
- [x] Canonical API values remain unchanged.
- [x] Accessibility labels are translated.
- [x] Key sets match between locales (100% parity).
- [x] Interpolation placeholders are consistent.


---

## TASK-0604 — Implement Mandatory Initial Language Gate & Settings Locale Change Flow

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0601`, `TASK-0602`, `TASK-0603`, `TASK-0211`
**Implementation Summary:** Implemented mandatory initial language gate (`Select Language / Pilih Bahasa`, English -> `en`, Bahasa Indonesia -> `id`) on `(auth)/layout.tsx` for visitors without valid `locale` cookie. Implemented authenticated language modal selector on `/setting` (`SettingsLocaleSwitcher`) with accessible dialog pattern adhering to `Premium Minimal Ops` (clear active indicator, localized error handling, preserved route & device context), backed by `PATCH /api/v1/me/preferences` with strict Zod validation (`UserPreferenceUpdateInputSchema`), `language.self.update` RBAC check, database persistence with audit logging, and `/settings` Next.js permanent redirect. Fixed system default device display labels (`Node Sensor Tanah` <-> `Soil Sensor Node`, `Node Kualitas Air` <-> `Water Quality Node`, `Node Tangki Air` <-> `Water Tank Node`) in presentation layer while preserving custom names, device IDs, and canonical enums. Responsive mobile selector centering and dropdown viewport bounding enforced across 360px, 390px, 430px, and desktop viewports. Verified 100% test pass rate across 18 unit test suites (136/136 tests), 0 type errors, 32/32 static build routes, and Playwright verification across desktop and mobile with 0 console errors.

### Acceptance Criteria

- [x] Mandatory initial language gate (`English` → `en`, `Bahasa Indonesia` → `id`) rendered for unauthenticated visitors without a valid persisted locale cookie.
- [x] Unauthenticated preference persists in non-prefixed cookie (`locale`).
- [x] Gate is skipped when a valid locale cookie already exists.
- [x] Post-gate language changes available exclusively on the Settings page (`/settings`).
- [x] Authenticated preference persists in user profileee (`preferredLocale`).
- [x] Page refresh retains active locale.
- [x] Locale change does not alter device selection, canonical values, or RBAC.

---

## TASK-0605 — Add Translation Completeness Checks

**Priority:** `P1`
**Status:** `DONE`
**Completed:** 2026-08-14 — Implemented translation completeness and parity checker in `scripts/check-translations.ts` and automated test suite in `apps/web/test/unit/i18n-completeness.test.ts`. Configured `i18n:check` in `package.json` (`check:quality`) and `.github/workflows/ci.yml`. Enforced detection of missing keys, extra keys, empty values, placeholder mismatches, duplicate JSON keys, and raw untranslated translation keys.
**Dependencies:** `TASK-0602`, `TASK-0108`

### Acceptance Criteria

CI detects:

- [x] Missing keys.
- [x] Extra keys.
- [x] Empty values.
- [x] Placeholder mismatches.
- [x] Duplicate JSON keys.
- [x] Raw translation keys.

---

# 15. Phase 7 — Alerts and State Management

## TASK-0701 — Implement Alert Model and API

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0104`, `TASK-0304`
**Completed:** 2026-08-02 — Implemented Alert DTO contracts, Zod schemas, AlertRepository with OWNER global scope and ADMIN device assignment scoping, and REST API endpoints (GET /api/v1/alerts and GET /api/v1/alerts/[alertId]) with full RBAC, filtering, pagination, standard error envelopes, and test coverage across contract, repository, and API routes.


### Work

Implement:

- Alert list.
- Alert detail.
- Scope filtering.
- Canonical type and severity.
- Translation key

---

## TASK-0702 — Implement Device Offline and Stale Alerts

**Priority:** `P1`
**Status:** `DEFERRED`
**Dependencies:** `TASK-0407`
**Blocked Reason:** Deferred from the current release along with TASK-0407.

### Acceptance Criteria

- Approved thresholds are used.
- Duplicate alert floods are prevented.
- Reconnection or fresh data resolves or updates alerts according to policy.

---

## TASK-0703 — Implement Command Failure and Timeout Alerts

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0806`
**Completed:** 2026-08-14 — Implemented distinct alert types for physical faucet command failures (`COMMAND_FAILED`) and timeouts (`COMMAND_TIMEOUT`) in `@kebun-melon/contracts`. Implemented centralized, idempotent alert creation in `AlertRepository` (`createCommandFailureAlert`, `createCommandTimeoutAlert`) linking device UUID (`deviceId`) and faucet command UUID (`sourceId`, `sourceType: 'faucet_command'`). Guaranteed that command timeouts record `physicalOutcome: 'UNKNOWN'` without claiming known physical completion. Integrated failure alert creation into IoT Gateway `AcknowledgementProcessor` (rejected ACKs) and `FaucetEventProcessor` (`FAILED` execution events). Added full English and Indonesian translation keys (`commandFailedTitle`, `commandFailedMessage`, `commandTimeoutTitle`, `commandTimeoutMessage`) with ICU placeholders (`{commandId}`, `{deviceName}`, `{reason}`) and verified 100% key/placeholder parity. Preserved task boundaries keeping automated timeout scheduling/durations blocked under `TASK-0809` without inventing thresholds. Verified 100% test pass rate across targeted test suites and user-verified pre-commit suite.

### Acceptance Criteria

- [x] Failure and timeout are distinct.
- [x] Alert links to device and command.
- [x] Timeout does not claim known physical state.

---

## TASK-0704 — Implement Alert Acknowledgement

**Priority:** `P2`
**Status:** `DONE`
**Dependencies:** `TASK-0701`
**Completed:** 2026-08-15 — Implemented alert acknowledgement contracts (`AcknowledgeAlertInputSchema`, `AlertAcknowledgementDto`), database transactional acknowledgement in `AlertRepository` (`acknowledgeAlert`), `POST /api/v1/alerts/{alertId}/acknowledge` API route handler with RBAC enforcement (`alert.acknowledge` for OWNER global scope, ADMIN assigned-device scope), audit logging (`alert.acknowledged`), and frontend `/notifikasi` page wiring with `Premium Minimal Ops` modal for optional operator notes. Preserved alerts without deletion, supported duplicate acknowledgement safety, and synchronized English/Indonesian localization. Authenticated manual verification passed for Owner and Admin access scopes.

### Acceptance Criteria

- [x] Permission is checked.
- [x] Device scope is checked.
- [x] Acknowledgement is audited.
- [x] Alert is not deleted.

---

## TASK-0705 — Connect Sidebar Notification Badge to Live Alert API

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0701`, `TASK-0704`
**Completed:** 2026-08-23 — Replaced static mock `ALERTS` filter in `Sidebar.tsx` with dynamic live backend alert data using lightweight client hook `useAlertBadge`. Hook queries canonical `GET /api/v1/alerts?status=OPEN&severity=CRITICAL` when authenticated. Subscribed to custom event `melon:alert-updated` emitted on successful alert acknowledgement in `/notifikasi` page (`page.tsx`) to guarantee instant badge count updates without full page reloads. Preserved `Premium Minimal Ops` layout, badge positioning, and `bg-app-error` styling tokens. Added comprehensive unit test suite in `apps/web/test/unit/sidebar-navigation.test.tsx` verifying dynamic count rendering, zero-count badge suppression, unauthenticated handling, and reactive event synchronization.

### Acceptance Criteria

- [x] Sidebar notification badge uses live backend alert data (`GET /api/v1/alerts`).
- [x] Canonical `AlertSeverity.CRITICAL` and `AlertStatus.OPEN` are used for critical error badge count.
- [x] Zero critical alerts or unauthenticated sessions hide badge.
- [x] Acknowledging alerts on `/notifikasi` immediately updates the sidebar badge count.
- [x] Existing UI design, tokens, and navigation layout are preserved unchanged.
- [x] Unit tests added and passing.

---

## 16. Phase 8 — Faucet Control

## TASK-0801 — Finalise Faucet Permission Matrix

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0002`
**Completed:** 2026-08-02 — Faucet permission matrix finalized and documented in `RBAC.md` §4.4 and `SECURITY.md` §5 per `DEC-RBAC-015` (`Active ADMIN + assigned device access = faucet-control permission`) and `DEC-CTRL-051` (`Faucet Safety Rules & Idempotency`). Reconciled per `DEC-CTRL-090` and `DEC-CTRL-091` (`device.control` standard permission).

### Work

Document:

- Owner control permission.
- Admin control permission.
- Per-device `canControl`.
- Manual Open/Close control.
- Emergency stop.
- Concurrent command policy.

### Acceptance Criteria

- `RBAC.md`, `API.md`, `SECURITY.md`, and tests are updated.
- No control feature proceeds using assumptions.

---

## TASK-0802 — Implement Faucet Command Database Model

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0104`
**Historical Completion:** 2026-08-02 — Implemented initial FaucetCommand & FaucetCommandEvent contracts, server-side phase-volume mapping (Phase 1: 300mL, Phase 2: 1000mL, Phase 3: 1500mL), raw SQL migration for partial unique message_id index on faucet_command_events, FaucetCommandRepository with state transition safeguards, idempotency checks, active command concurrency checks, and complete test suite.
**Revision Completion (2026-08-19):** Implemented database schema migration `20260819000000_task_0802_faucet_command_action` adding `action` (`DISPENSE`, `OPEN`, `CLOSE`) and `plant_count` (integer >= 1) columns, dropping the obsolete legacy check constraint `faucet_commands_phase_volume_check` to eliminate volume calculation conflicts with multi-plant dispense commands and null manual action fields, backfilling existing records with `action = 'DISPENSE'` and `plant_count = 1`, and establishing the multi-column check constraint `faucet_commands_action_check`. Reconciled server-derived volume calculations (`targetVolumeMl = mapPhaseToVolume(phase) * plantCount` for Phase 1: 300 mL, Phase 2: 1000 mL, Phase 3: 1500 mL) rejecting client-supplied target volume authority. Updated Zod schemas and TypeScript types in `@kebun-melon/contracts`. Updated `FaucetCommandRepository` in `@kebun-melon/database` with transactional state transition safeguards, idempotency deduplication, and active command concurrency protection. Verified with 100% test pass rate across contracts and database test suites, and completed local PostgreSQL 18 performance smoke test.

### Acceptance Criteria

- `plant_count` column (integer, minimum 1) is supported in database model and Zod contracts for `DISPENSE`.
- `action` supports `DISPENSE`, `OPEN`, and `CLOSE`.
- `OPEN` and `CLOSE` do not require `phase`, `plant_count`, or `target_volume_ml`.
- Phase-volume check constraint and server-side calculation rules exist.
- Command ID is unique.
- Idempotency key is unique.
- Command events are append-only.
- Final states cannot regress silently.

---

## TASK-0803 — Implement Faucet Command API

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0802`, `TASK-0304`
**Historical Completion:** 2026-08-02 — Implemented POST /api/v1/devices/{deviceId}/faucet-commands, GET /api/v1/devices/{deviceId}/faucet-commands, and GET /api/v1/devices/{deviceId}/faucet-commands/{commandId} REST API endpoints with active session authentication (`requireSession`), active account revalidation (`requireActiveAccount`), RBAC permissions (`device.control`), ENABLE_FAUCET_CONTROL feature flag guard, device assignment scoping, FAUCET_CONTROL capability validation, device active & ONLINE state checks, server-side phase-to-volume mapping, idempotency key handling, max 1 active command per device conflict enforcement, durable QUEUED persistence, atomic AuditLog recording, paginated history filtering, and 100% test coverage.
**Revision Completion (2026-08-20):** Implemented POST /api/v1/devices/{deviceId}/faucet-commands endpoint revision supporting `DISPENSE`, `OPEN`, and `CLOSE` actions. Enforced mandatory integer `plantCount >= 1` for `DISPENSE`, and strict rejection of `phase`, `plantCount`, and `targetVolumeMl` for `OPEN`/`CLOSE`. Server exclusively calculates `targetVolumeMl = presetVolumeMl * plantCount`; browser target volume authority is rejected. Enforced `VALIDATION_ERROR` as canonical error for payload violations without creating new error codes. Preserved active session, active account, RBAC (`device.control`), device capability, active device, idempotency, and concurrency protections. Verified 100% test pass rate across route handlers and Zod contracts.

### Work

Implement / Update:

```text
POST /devices/{deviceId}/faucet-commands
```

### Acceptance Criteria

- Active session required.
- Active account required.
- Control permission (`device.control`) required.
- Device access required.
- Device capability required.
- Device online/controllable required.
- `plantCount` required for `DISPENSE`, integer >= 1.
- Target volume calculation is strictly server-side (`presetVolumeMl * plantCount`). Browser never supplies authoritative target volume.
- `OPEN` and `CLOSE` actions supported without `phase`, `plantCount`, or `targetVolumeMl`.
- Command is persisted before publication.
- Idempotency is enforced.
- Response starts as `QUEUED`.

---

## TASK-0804 — Implement Gateway Command Publisher

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0401`, `TASK-0803`
**Historical Completion:** 2026-08-03 — Implemented `CommandPublisher` in `@kebun-melon/iot-gateway` to publish eligible, unexpired `QUEUED` faucet commands for `WATER_TANK_NODE` devices over MQTT (QoS 1, retain = false). Enforced target device type validation, phase/volume mapping, dynamic canonical topic routing (`agriculture/{environment}/{siteId}/{deviceId}/command/faucet`), payload formatting, and atomic DB state transition to `SENT` with `FaucetCommandEvent` creation. Fixed `.env` loading and non-UUID `commandId` detail API query handling.
**Revision Note (2026-08-20):** Status set to `DONE`. Verified duplicate logic removed for `targetVolumeMl` recalculation, allowing persistent pass-through. Added dedicated testing and formatting for `OPEN` / `CLOSE` payloads ensuring they carry NO fabricated volume or phase attributes. Confirmed 100% path coverage for publisher command routing (10/10 publisher unit tests, 42/42 gateway contract tests). Completed safe local simulated performance sanity tests on mocked/in-memory infrastructure (1,000 direct calls ~68.3 ops/s with p95 20.08 ms, 500 burst commands ~67.0 cmds/s, 2,000 soak commands ~66.7 cmds/s with zero memory leak and safe reconnect recovery). All 17 project docs fully reconciled.

### Acceptance Criteria

- Command targets one device. [VERIFIED]
- Command is not retained (retain = false, QoS 1). [VERIFIED]
- Multiplied `targetVolumeMl` published for `DISPENSE` via persisted database pass-through. [VERIFIED]
- Dedicated `OPEN` and `CLOSE` payload schema published for manual control (omitting phase, plantCount, volume). [VERIFIED]
- Expiry is included. [VERIFIED]
- Publication result updates status to `SENT`. [VERIFIED]
- Failed publish does not appear as sent (remains `QUEUED`). [VERIFIED]

---

## TASK-0805 — Implement Device Acknowledgement Processing

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0804`
**Historical Completion:** 2026-08-03 — Implemented `AcknowledgementProcessor` in `@kebun-melon/iot-gateway` to subscribe to canonical faucet ACK topics (`agriculture/{environment}/{siteId}/{deviceId}/ack/faucet`, QoS 1). Validated topic/payload deviceId matching, resolved external device ID to internal device UUID, and enforced `WATER_TANK_NODE` device type scope. Executed strict `SENT` → `ACKNOWLEDGED` (for accepted ACKs) and `SENT` → `FAILED` (for rejected ACKs with canonical reasonCode) state transitions with `FaucetCommandEvent` audit creation.
**Revision Completion (2026-08-20):** Revalidated and hardened `AcknowledgementProcessor` in `@kebun-melon/iot-gateway` (`apps/iot-gateway/src/acknowledgements/processor.ts`) to handle command ACKs across all supported faucet command actions (`DISPENSE`, `OPEN`, and `CLOSE`). Maintained strict adherence to the authoritative ACK contract identifying commands via `commandId` and `deviceId` without fabricating an action field in the MQTT ACK payload. Enforced persisted command action validation against `[DISPENSE, OPEN, CLOSE]`, rejecting unsupported/unknown actions (`success: false`). Enforced strict state transitions where accepted ACKs only transition `SENT` → `ACKNOWLEDGED` (guaranteeing status never transitions to `COMPLETED` and never infers physical state), and rejected ACKs transition `SENT` → `FAILED` with canonical `reasonCode` and `CommandFailureAlert` generation. Handled duplicate `messageId` idempotently and safely ignored non-`SENT` / out-of-order ACKs without state regression. Verified 100% test pass rate across 25 unit tests (`apps/iot-gateway/src/__tests__/acknowledgement-processor.test.ts`), 195/195 IoT Gateway tests, Semgrep security scan (0 findings), and workspace typecheck (0 errors).

### Acceptance Criteria

- [x] Acknowledgement links to command and device.
- [x] Unknown command is rejected or logged.
- [x] Duplicate acknowledgement is idempotent.
- [x] Rejection reason is canonical.
- [x] `ACKNOWLEDGED` does not become `COMPLETED`.
- [x] Covers `DISPENSE`, `OPEN`, and `CLOSE` command acknowledgements.

---

## TASK-0806 — Implement Command Event State Machine

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0805`
**Historical Completion:** 2026-08-03 — Implemented `FaucetEventProcessor` in `@kebun-melon/iot-gateway` (`apps/iot-gateway/src/events/processor.ts`) to subscribe to canonical faucet execution event topics (`agriculture/{environment}/{siteId}/{deviceId}/event/faucet`, QoS 1). Validated topic/payload deviceId matching, resolved external device ID to internal device UUID, and enforced `WATER_TANK_NODE` device type scope. Executed strict `ACKNOWLEDGED` → `IN_PROGRESS` → `COMPLETED` and `ACKNOWLEDGED`/`IN_PROGRESS` → `FAILED` state transitions with `FaucetCommandEvent` audit creation and `actualVolumeMl` / `reasonCode` tracking.
**Revision Completion (2026-08-20):** Updated `FaucetEventProcessor` in `@kebun-melon/iot-gateway` (`apps/iot-gateway/src/events/processor.ts`) to handle execution events across all supported faucet command actions (`DISPENSE`, `OPEN`, and `CLOSE`). Implemented authoritative physical state determination: `COMPLETED OPEN` → `OPEN`, `COMPLETED CLOSE` → `CLOSED`, `COMPLETED DISPENSE` → `UNKNOWN` (strictly avoiding assuming closed valve), and failed/uncertain/in-progress → `UNKNOWN`. Enforced persisted command action validation against `[DISPENSE, OPEN, CLOSE]`. Enforced contract-consistent volume rules: `DISPENSE` validates non-negative `actualVolumeMl` and target volume match if provided; `OPEN` and `CLOSE` treat volume measurement as non-applicable and store `null`/`undefined` in the command record without failing execution confirmations. Guaranteed terminal-state immutability (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `EXPIRED`), duplicate `messageId` idempotency, progress event appending, and `CommandFailureAlert` dispatching on `FAILED` events. Verified 100% test pass rate across 32 unit tests (`apps/iot-gateway/src/__tests__/faucet-event-processor.test.ts`), full 212-test IoT Gateway test suite, 934-test workspace suite, Semgrep security scan (0 findings), and TypeScript typecheck (0 errors).

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

- [x] Invalid transitions are rejected or flagged.
- [x] Final states do not regress.
- [x] Late events follow approved reconciliation.
- [x] Timeout remains distinct from failure and completion.
- [x] Physical state confirmation (`OPEN`, `CLOSED`, `UNKNOWN`) tracked accurately.
- [x] Events are audited.
- [x] Covers `DISPENSE`, `OPEN`, and `CLOSE` execution events.
- [x] Volume handling conforms to action type (`DISPENSE` stores measured volume; `OPEN`/`CLOSE` do not store command volume).

---

## TASK-0807 — Implement Faucet Control UI

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0803`, `TASK-0806`
**Historical Completion:** 2026-08-03 — Built Faucet Control UI (/controls page, FaucetPresetSelector, FaucetConfirmationModal, FaucetStatusCard, FaucetHistoryTable) with Phase 1/2/3 preset volumes (300/1000/1500 mL), explicit confirmation modal, permission/feature flag/offline/active-command disabled state handling, active-only status polling, timeline display, and execution history.
**Revision Completion (2026-08-20):** Implemented and verified complete Faucet Control UI revision on `/controls` adhering to `Premium Minimal Ops` UI standards:
- Preset volume display in Liters: Phase 1 = `0.3 L / tanaman`, Phase 2 = `1 L / tanaman`, Phase 3 = `1.5 L / tanaman`.
- `plantCount` integer input with stepper buttons (minimum 1, default 1) and live calculation preview (`preset.volumeL × plantCount = totalVolumeL`).
- Browser-side total calculation preview while strictly preserving server-side authority for final validation and execution.
- Confirmation modal with action-aware layouts: for `DISPENSE` displaying device name, site location, phase, water per plant (L), plant count, total water (L), and safety warnings; for manual `OPEN` and `CLOSE` displaying device name, site, action title, safety description, and status.
- Manual `OPEN` and `CLOSE` valve controls wired to `POST /api/v1/devices/{deviceId}/faucet-commands` with action `OPEN` | `CLOSE` without fabricating volume or phase parameters.
- Idempotency integration: client dispatches unique `cmd-<uuid>` via HTTP header `Idempotency-Key` without arbitrary JSON body injection.
- Authoritative physical faucet state presentation (`OPEN`, `CLOSED`, `UNKNOWN`) strictly mapped from the TASK-0806 state machine: `COMPLETED OPEN` → `OPEN`, `COMPLETED CLOSE` → `CLOSED`, `COMPLETED DISPENSE` → `UNKNOWN`, active/failed/timeout/uncertain → `UNKNOWN`. Never inferred physical state from API submission, publication, or ACK.
- Status Polling: `FaucetStatusCard` executes 2,500ms status polling strictly during active states (`QUEUED`, `SENT`, `ACKNOWLEDGED`, `IN_PROGRESS`) and terminates immediately upon terminal states or unmount with zero blind retries.
- Full disabled and warning state handling for null device, unauthenticated/unauthorized users (`device.control.dispense`), disabled feature flag (`ENABLE_FAUCET_CONTROL=false`), offline devices (`OFFLINE`/`INACTIVE`), and active command in progress.
- 100% Indonesian and English translation key parity with matching ICU placeholders.
- Verified 100% test pass rate across 24 unit tests (`apps/web/test/unit/faucet-control-ui.test.tsx`), workspace TypeScript typecheck (0 errors), Semgrep scan (0 findings), and Next.js production build.

### Acceptance Criteria

- [x] User selects phase and provides `plantCount` (integer >= 1).
- [x] UI displays volume presets in Liters (`0.3 L`, `1 L`, `1.5 L`).
- [x] Browser calculates client-side preview, but server strictly validates and computes authoritative target volume.
- [x] Confirmation modal displays: device, phase, volume per plant (L), plant count, total water (L), and device warnings.
- [x] Manual `OPEN` and `CLOSE` controls available for authorised users.
- [x] Device name and status are shown.
- [x] Permission denied is handled.
- [x] Offline and busy states are handled.
- [x] Physical state is displayed as `OPEN`, `CLOSED`, or `UNKNOWN`.
- [x] Queue, progress, completion, failure, and timeout states exist.
- [x] Completion is not shown prematurely.

---

## TASK-0808 — Implement Duplicate Command Protection

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0803`, `TASK-0804`, `TASK-0805`
**Historical Completion:** 2026-08-04 — Enhanced `createCommand` in `FaucetCommandRepository` (`@kebun-melon/database`) to perform idempotency checks and max-1 active command checks transactionally, re-querying by `idempotencyKey` on Prisma `P2002` unique constraint error to gracefully return the existing command for identical concurrent/replay requests, or raise `FaucetCommandConflictError` (`409 DUPLICATE_COMMAND_CONFLICT`) for conflicting parameter reuses. Preserved single `QUEUED` event and single command creation during race conditions with zero duplicate MQTT publications.
**Revision Completion (2026-08-20):** Revalidated duplicate command protection for `DISPENSE` with `plantCount` multiplier and `OPEN` / `CLOSE` actions. Confirmed existing `createCommand` idempotency logic in `FaucetCommandRepository` is correct for all three action types. Implemented specific semantic duplicate protection to reject different idempotency keys that share the exact physical intent on the same device, emitting a distinct `Duplicate command` conflict message without inferring state tracking. The transactional idempotency key check compares `deviceId`, `action`, `phase ?? null`, and `plantCount ?? null`, which correctly handles `OPEN`/`CLOSE` (null phase/plantCount) and `DISPENSE` with arbitrary `plantCount`. Added 7 targeted unit tests to `packages/database/src/__tests__/faucet-command-repository.test.ts` covering: DISPENSE+plantCount conflict, DISPENSE multi-plant network retry, OPEN idempotent re-submission, OPEN→CLOSE cross-action conflict, CLOSE idempotent re-submission, P2002 race recovery for OPEN, P2002 race recovery for CLOSE. Verified 21/21 database unit tests and 31/31 API route tests pass with zero regressions across full workspace test suite.
**Performance Verification (2026-08-20):** Executed a non-credentialed integration load test simulating heavy concurrent duplicate dispatches. Validated sequential retry (~400ms cached return) and 50 concurrent duplicate requests. Exactly 1 command record was successfully persisted per unique `idempotencyKey`, with 0 duplicates generated.
**Remaining Limitation:** Under extreme concurrency, overlapping duplicate requests may encounter database transaction write conflicts (`P2034` / `PrismaClientKnownRequestError`) due to transaction locking semantics. These safely reject the request without creating duplicate records or bypassing idempotency guarantees. Fixing this millisecond-level race condition via database locking is out of scope for this task.

### Acceptance Criteria

- [x] Same idempotency key and payload returns existing command.
- [x] Same key with different payload returns conflict.
- [x] Different idempotency key but same active physical intent on the same device is explicitly rejected as duplicate.
- [x] MQTT duplicate delivery executes once (DB-layer guard prevents duplicate QUEUED inserts).
- [x] Device simulator confirms duplicate protection (TASK-0408 simulator enforces unique idempotency keys per command dispatch).
- [x] Tests cover network retry (P2002 race recovery for DISPENSE, OPEN, and CLOSE).

---

## TASK-0809 — Implement Command Timeout Processor

**Priority:** `P0`
**Status:** `DEFERRED`
**Dependencies:** `TASK-0806`
**Blocked Reason:** Deferred from the current release. Command timeout durations are not available yet (`DEC-CTRL-092`). The system currently handles uncertain physical states securely as `UNKNOWN`.

### Acceptance Criteria

- Approved acknowledgement and completion timeouts are used.
- Timeout event is stored.
- UI receives timeout.
- No blind physical retry occurs.
- Late acknowledgement follows approved policy.

---

## TASK-0810 — Implement Manual Faucet Open/Close Control

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0803`, `TASK-0804`, `TASK-0806`, `TASK-0807`
**Completed:** 2026-08-21 — Implemented and verified discrete manual faucet `OPEN` and `CLOSE` valve control across Web backend API (`POST /api/v1/devices/{deviceId}/faucet-commands`), `@kebun-melon/contracts` (Zod schemas, action DTOs, and specific `AuditEventKey` enums `faucet.command.open.created` / `faucet.command.close.created`), `@kebun-melon/database` (`FaucetCommandRepository` transactional creation with audit trail and duplicate protection), IoT Gateway (`CommandPublisher` MQTT QoS 1 publish omitting fabricated volume/phase attributes; `AcknowledgementProcessor` and `FaucetEventProcessor` mapping physical state `COMPLETED OPEN` → `OPEN`, `COMPLETED CLOSE` → `CLOSED`, `COMPLETED DISPENSE` → `UNKNOWN`), and Web UI (`/controls` with action-aware `FaucetConfirmationModal`, disabled states for offline/busy/unauthorized, and authoritative physical badge presentation in `FaucetStatusCard`). Preserved `ENABLE_FAUCET_CONTROL=false` safety default. Verified 100% test pass rate across targeted test suites (32/32 tests), full faucet suites (114/114 tests), workspace test suite (102 test files, 955/955 tests), workspace typecheck (`tsc --noEmit` 0 errors), linting (0 errors), and security scanning (0 hardcoded secrets, 0 unapproved advisories).
**Remaining Blocked Policy:** Fail-safe behavior for an OPEN faucet after browser/network/gateway/device loss remains an explicit UNRESOLVED/BLOCKING decision (`DEC-CTRL-090`) for physical production activation; software safely isolates this uncertainty by mapping all uncertain/active states to `UNKNOWN`.

### Acceptance Criteria

- [x] Authenticated backend only (`requireSession`, `requireActiveAccount`).
- [x] RBAC validation (`device.control`).
- [x] Feature flag guard (`ENABLE_FAUCET_CONTROL`).
- [x] Device active & ONLINE / controllable checks.
- [x] Idempotency is enforced.
- [x] MQTT command published with QoS 1, retain = false.
- [x] Device acknowledgement and final execution confirmation tracked.
- [x] Audit trail recorded (`faucet.command.open.created`, `faucet.command.close.created`).
- [x] UI represents distinct `OPEN`, `CLOSED`, and `UNKNOWN` states.
- [x] Timeout and network uncertainty are NEVER presented as confirmed `OPEN` or `CLOSED`.
- [x] English and Indonesian localization and accessibility texts complete.
- [x] Hardware/HIL validation scenarios defined.
- [x] Fail-safe behavior upon connection loss documented as blocking decision (`DEC-CTRL-090`).

---

## TASK-0811 — Hardware-in-the-Loop Control Validation

**Priority:** `P0`
**Status:** `BLOCKED`
**Dependencies:** `TASK-0807`, `TASK-0810`, hardware readiness

### Work

Test each phase repeatedly with measured output, including `plantCount` multiplier dispensing and manual `OPEN`/`CLOSE` operations.

### Acceptance Criteria

- Device receives one command.
- Correct phase and `plantCount` are reported.
- Target and actual volume are recorded in integer mL.
- Manual `OPEN` and `CLOSE` operations verified on physical hardware.
- Duplicate command does not repeat dispensing.
- Timeout and disconnect behaviour are documented.
- Hardware-team tolerance is met.
- Production control remains disabled until approved.

---

# 17. Phase 9 — Security and Observability

## TASK-0901 — Implement Security Headers

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0204`
**Completed:** 2026-08-05 — Configured security HTTP response headers across Next.js web application (`apps/web/next.config.mjs`) and Fastify IoT Gateway (`apps/iot-gateway/src/app.ts`), enforcing Content-Security-Policy (CSP), X-Content-Type-Options (nosniff), Referrer-Policy, Permissions-Policy, X-Frame-Options (DENY) / frame-ancestors ('none'), and conditional Strict-Transport-Security (HSTS, max-age 2 years with preload) strictly for production environments (omitted on localhost/dev). Added comprehensive unit and integration test suites in `apps/web/test/unit/security-headers.test.ts` and `apps/iot-gateway/src/__tests__/security-headers.test.ts`. Updated requirement `SEC-DATA-003` in `docs/TRACEABILITY.md`.

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
**Status:** `DONE`
**Dependencies:** `TASK-0204`, `TASK-0002`
**Notes:** Sliding window rate limiting designed in `SECURITY.md` §4 with environment-configurable limits. Note: Revalidation required for `DISPENSE` (with `plantCount`), `OPEN`, and `CLOSE` command actions during Phase 8 API revision.

### Work

Apply to:

- Login.
- Registration.
- Password reset.
- Approval actions.
- Faucet commands (`DISPENSE`, `OPEN`, `CLOSE`).
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
**Status:** `DONE`
**Dependencies:** `TASK-0104`
**Completed:** 2026-08-05 — Implemented append-only Audit Logging per `DB-AUDIT-001`, `SEC-LOG-001`, and `API-AUDIT-001`. Created `AuditEventKey` enums, `AuditLogDto` schemas, and `redactSecrets` recursive sanitization helper in `@kebun-melon/contracts`. Created `AuditRepository` in `@kebun-melon/database` supporting atomic `createAuditLog`, paginated `findAuditLogs`, and `findAuditLogById` with strictly zero edit/delete capabilities exposed. Added `recordAuditEvent` and `logAuthorizationDenial` server helpers in `apps/web/lib/audit/audit-service.ts`. Created `GET /api/v1/audit-logs` and `GET /api/v1/audit-logs/{auditId}` API endpoints guarded by active session authentication and `audit.read` permission (`OWNER` role). Added unit and integration test coverage across contracts, database repository, and Web API routes.
**Revision Note (2026-08-19):** Audit logging framework is complete. Note: Revalidation required for new command action audit events (`faucet.command.dispense.created`, `faucet.command.open.created`, `faucet.command.close.created`) during Phase 8 API revision.

### Acceptance Criteria

- Required events are captured.
- Audit rows are append-only through normal APIs.
- Passwords, tokens, and secrets are redacted.
- Actor, target, result, and request ID are stored.

---


## TASK-0904 — Implement Structured Application Logging

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0103`
**Completed:** 2026-08-15 — Implemented centralized structured application logging across monorepo (`packages/contracts`, `apps/web`, `apps/iot-gateway`). Defined `LogLevel`, `LogMeta`, `StructuredLogRecord`, and `formatLogRecord` in `@kebun-melon/contracts`. Configured `LOG_LEVEL` environment variable validation with default `info`. Created `apps/web/lib/observability/logger.ts` and upgraded `apps/iot-gateway/src/observability/logger.ts` with structured JSON output, level threshold filtering, correlation IDs, child context propagation, and recursive secret redaction (`SECURITY.md` §20.2). Replaced unformatted `console.*` calls in Web API error handlers. Added unit test suites with 100% pass rate. Verified passing full pre-commit suite and targeted tests.

### Acceptance Criteria

- [x] JSON or structured format.
- [x] Correlation IDs.
- [x] Environment and service name.
- [x] No secrets.
- [x] Log levels are configurable.

---

## TASK-0905 — Implement Health and Readiness Checks

**Priority:** `P1`
**Status:** `DONE`
**Dependencies:** `TASK-0104`, `TASK-0401`
**Completed:** 2026-08-15 — Implemented canonical health and readiness endpoints across `@kebun-melon/contracts`, `@kebun-melon/web`, and `@kebun-melon/iot-gateway` per `docs/API.md` §23, §24 and `DEC-INF-078`. Defined `LivenessResponseDto` and `ReadinessResponseDto` in `@kebun-melon/contracts`. Implemented public `GET /health` (liveness independent of dependencies) and public `GET /ready` (readiness probing PostgreSQL and IoT Gateway) in `@kebun-melon/web`. Implemented `GET /internal/v1/health` and `GET /internal/v1/ready` (guarded by mandatory `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>`) in `@kebun-melon/iot-gateway` probing PostgreSQL and MQTT broker. Enforced strict environment validation in production/staging (`INTERNAL_GATEWAY_URL` and `INTERNAL_SERVICE_TOKEN`), approved 2000ms default probe timeout (`INTERNAL_GATEWAY_TIMEOUT_MS`), and verified zero credential or stack trace leakage in responses and logs across all failure modes. Verified passing full pre-commit suite and targeted tests.

### Acceptance Criteria

- [x] Web liveness is independent from temporary dependency failure.
- [x] Readiness checks database and gateway.
- [x] Gateway readiness checks broker and database.
- [x] No credentials are returned.

---

## TASK-0906 — Implement Secret Scanning and Dependency Scanning

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0108`, `TASK-0912`
**Completed:** 2026-08-06 — Reconciled workspace dependencies by upgrading stale `vitest` references in `apps/iot-gateway` and `packages/contracts` from `^1.6.0` to `^4.1.10`. Regenerated lockfile cleanly with 0 high/0 critical unapproved security advisories. Verified secret scan (`npm run scan:secrets`), dependency scan (`npm run scan:deps`), environment security unit tests (`npm run env:test`), TypeScript typecheck (`npm run typecheck`), ESLint (`npm run lint`), 69 test files (548/548 tests) via Vitest (`npm run test`), and Next.js production build (`npm run build`).
**Progress:** — Implemented automated secret scanning (`scripts/scan-secrets.ts`) and dependency vulnerability scanning (`scripts/check-dependencies.ts`) per `SEC-OPS-001` and `SEC-OPS-004`. Upgraded Next.js to safe 14.2.35 version and applied npm overrides for fast-uri (3.1.5) and postcss (^8.5.18). Implemented Fastify header tab character rejection workaround in apps/iot-gateway/src/app.ts. Configured GitHub Actions CI pipeline (`.github/workflows/ci.yml`) and governance process (`docs/SECURITY_EXCEPTIONS.md`). Exceptions set to PENDING_USER_APPROVAL.

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
**Status:** `DONE`
**Dependencies:** `TASK-0204`, `TASK-0505`
**Completed:** Implemented session revocation mechanisms across account lifecycle states (SUSPENDED, DEACTIVATED, REJECTED), transactional password updates (`changeUserPassword`), HTTP endpoint `POST /api/v1/auth/change-password`, database helper `verifyStreamSessionActive`, immediate device access revocation on authorization checks (`requireDeviceViewAccess`), and live-stream closing on session expiry/revocation (`GET /api/v1/realtime/stream` SSE route in `TASK-0505`). Added `ACCOUNT_PASSWORD_CHANGED` audit log event key and verified 100% test pass rate across unit test suites (`packages/database/test/session-revocation.unit.test.ts`, `apps/web/test/unit/session-revocation.test.ts`, `apps/web/test/unit/realtime-stream.test.ts`).


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

## TASK-0910 — Fastify Framework Major Version Upgrade (v5.x)

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0401`
**Completed:** Upgraded Fastify in `apps/iot-gateway` from `^4.28.1` to `^5.11.2` (`5.11.2` resolved in lockfile). Updated `setErrorHandler` in `apps/iot-gateway/src/app.ts` for Fastify v5 `unknown` error type safety. Verified Fastify v5 native resolution of `GHSA-jx2c-rxcm-jvmq` (header tab character validation bypass) and `GHSA-c96f-x56v-gq3h` (`find-my-way` HTTP2 DDoS advisory), and removed resolved security exceptions `EXC-DEP-001` and `EXC-DEP-002` from `scripts/security-exceptions.json`. Verified all 12 test files (128/128 tests) pass in `apps/iot-gateway`, monorepo typecheck passes with 0 errors across all workspaces, build compiles cleanly, dependency scan confirms 0 Fastify advisories, Prettier formatting passes, and runtime `/health` (HTTP 200) and `/ready` (HTTP 503 DEGRADED) smoke tests succeed. Full `npm run check:quality` command exits with code 1 solely due to remaining TASK-0912 `vitest`/`vite` advisories.

### Acceptance Criteria

- Upgrade Fastify in `apps/iot-gateway` from v4.28.1 to v5.x.
- Resolve transitive `fastify`, `find-my-way`, `@fastify/ajv-compiler`, and `@fastify/fast-json-stringify-compiler` advisories (`GHSA-jx2c-rxcm-jvmq`, `GHSA-c96f-x56v-gq3h`).
- Update route registrations, hooks, and error handlers for Fastify v5 API breaking changes.
- Verify all gateway unit, integration, and security header tests pass.

---

## TASK-0911 — Next.js Framework Major Version Upgrade (v15.x / v16.x)

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0104`
**Completed:** Upgraded Next.js in `apps/web` from `14.2.35` to `16.3.0`, React to `19.0.0`, React DOM to `19.0.0`, `@testing-library/react` to `16.2.0`, `eslint-config-next` to `16.3.0`, and `eslint` to `9.20.0`. Added root package overrides for React 19 monorepo deduplication. Migrated `cookies()` and dynamic route params (`props: { params: Promise<{ ... }> }`) across all 22 route handlers and auth helpers. Migrated to ESLint 9 flat config (`apps/web/eslint.config.mjs`) using native TypeScript parser and `@next/eslint-plugin-next`. Updated `next.config.mjs` for Next 16 `serverExternalPackages`. Updated unit tests to pass `params` as `Promise.resolve(...)`. Resolved all 8 Next.js security advisories (`GHSA-h25m-26qc-wcjf`, `GHSA-q4gf-8mx6-v5v3`, `GHSA-8h8q-6873-q5fj`, `GHSA-c4j6-fc7j-m34r`, `GHSA-36qx-fr4f-26g5`, `GHSA-m99w-x7hq-7vfj`, `GHSA-89xv-2m56-2m9x`, `GHSA-p9j2-gv94-2wf4`) and `glob` advisory (`GHSA-5j98-mcp5-4vw2`), and removed resolved exceptions `EXC-DEP-003` through `EXC-DEP-011` from `scripts/security-exceptions.json`. Verified 36/36 test files (281/281 tests) pass, typecheck passes with 0 errors, ESLint 9 linting passes, secret scanning passes, and Next.js 16 production build compiles 30 static pages and 22 dynamic route handlers.

### Acceptance Criteria

- Upgrade Next.js in `apps/web` from v14.2.35 to v15.x/v16.x.
- Resolve App Router framework advisories requiring major version bump (`GHSA-h25m-26qc-wcjf`, `GHSA-q4gf-8mx6-v5v3`, `GHSA-8h8q-6873-q5fj`, `GHSA-c4j6-fc7j-m34r`, `GHSA-36qx-fr4f-26g5`, `GHSA-m99w-x7hq-7vfj`, `GHSA-89xv-2m56-2m9x`, `GHSA-p9j2-gv94-2wf4`, `GHSA-5j98-mcp5-4vw2`).
- Update React peer dependencies and ESLint 9 / Next 16 flat configuration.
- Verify all web unit, component, integration, and Playwright E2E tests pass.

---

## TASK-0912 — Vitest and Vite Major Version Upgrade (v4.x / v6.x)

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** `TASK-0108`

### Acceptance Criteria

- Upgrade Vitest and Vite dev test dependencies across monorepo (`vitest` v1.6.0 $\rightarrow$ v4.1.10, `vite` v5.4.1 $\rightarrow$ v6.4.3).
- Resolve `GHSA-5xrq-8626-4rwp` and `GHSA-fx2h-pf6j-xcff` advisories.
- Update test configuration and coverage reporter integration.
- Verify all unit, component, and integration test suites execute cleanly.

**Completed:** Upgraded `vitest` to `4.1.10`, `@vitest/coverage-v8` to `4.1.10`, `vite` override to `6.4.3`, and `@vitejs/plugin-react` to `4.4.0`. Migrated Vitest v4 configuration files to `.mts`, removed deprecated `poolOptions`, set top-level `pool: 'forks'`, `maxWorkers: 1`, `isolate: true`, and `environmentMatchGlobs`. Removed temporary security exceptions `EXC-DEP-012` and `EXC-DEP-013`. Verified 100% test suite pass (54/54 files, 461 tests), typecheck, linting, secret scanner (0 hardcoded secrets), dependency scanner (0 high/0 critical advisories, 0 exceptions), and production build.

---

# 18. Phase 10 — Verification and Release

## TASK-1001 — Complete Unit Test Suite

**Priority:** `P0`
**Status:** `DONE`
**Dependencies:** Implementation tasks
**Completed:** 2026-08-21 — Verified and completed monorepo unit test coverage across all 8 mandatory acceptance domains. Hardened branch coverage in `@kebun-melon/contracts` (`device-capabilities.test.ts` for unknown device types, `logging.test.ts` for unrecognized log levels falling back to `info`, and `user.test.ts` for `toPublicSafeUserDto` handling `userRoles: undefined` and deduplicating active role assignments). Executed full Vitest suite (`npm run test`) achieving 100% pass rate across 102 test files (958/958 tests passed) and >99.6% line coverage in `@kebun-melon/contracts`. Validated zero regressions across `packages/database`, `apps/iot-gateway`, and `apps/web`. Passed pre-commit quality gate (`npm run check:quality`: TypeScript `typecheck`, ESLint, Prettier format, `i18n:check`, secret scanner, dependency scanner, and Next.js production build).

### Acceptance Criteria

Critical unit coverage includes:

- [x] Account-status decision.
- [x] Permission checks.
- [x] Device access.
- [x] Telemetry validation.
- [x] Phase mapping.
- [x] Command transition.
- [x] Idempotency.
- [x] Locale validation.

---

## TASK-1002 — Complete API Integration Tests

**Priority:** `P0`
**Status:** `BACKLOG`
**Dependencies:** `TASK-0803`, `TASK-0810`
**Historical Completion:** `2026-08-07` — Initial API integration test suites completed for authentication, RBAC, devices, telemetry, and initial faucet commands.
**Revision Note (2026-08-19):** Status set to `BACKLOG` (pending Phase 8 API revisions). Requires test suite updates and revalidation against the new API contract (`plantCount` multiplier, server-side target volume calculation, arbitrary target volume rejection, and manual `OPEN`/`CLOSE` endpoints).

### Acceptance Criteria

- Authentication matrix passes.
- RBAC matrix passes.
- Device isolation passes.
- Monitoring schema passes.
- Faucet `DISPENSE` with `plantCount` multiplier passes.
- Manual `OPEN` and `CLOSE` command endpoints pass.
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
**Status:** `IN_PROGRESS`
**Dependencies:** Core UI, APIs, and Staging Infrastructure
**Infrastructure Provisioned:**
- Staging Web: `https://melon-monitor.up.railway.app`
- Staging Gateway: `https://iot-melon-g4t3.up.railway.app/`
- Staging Database: Supabase PostgreSQL (`scqrbtfilmttqrutynyo`) via Supavisor Pooler (`aws-0-ap-south-1.pooler.supabase.com:6543`)
- Staging Broker: EMQX Cloud Serverless (`wss://` TLS active, per-device topic ACLs)
- Safety Configuration: `ENABLE_FAUCET_CONTROL=false` strictly enforced

Required flows status:

- [x] Admin registration (Flow 1 — PASS)
- [x] Owner approval (Flow 2 — PASS)
- [x] Active Admin login (Flow 3 — PASS)
- [x] Device assignment (Flow 4 — PASS)
- [x] Monitoring (Flow 5 — PASS)
- [x] History (Flow 6 — PASS)
- [x] Language switch (Flow 7 — PASS under Phase 6 `TASK-0604`)
- [ ] Faucet command with plantCount multiplier (Flow 8 — SAFELY BLOCKED by `ENABLE_FAUCET_CONTROL=false`; previous tests do not validate new contract)
- [ ] Manual OPEN/CLOSE command (Flow 9 — SAFELY BLOCKED by `ENABLE_FAUCET_CONTROL=false`; previous tests do not validate new contract)
- [ ] Command failure & timeout alerts (Flow 10 — SAFELY BLOCKED by `ENABLE_FAUCET_CONTROL=false`)
- [x] Session expiry (Flow 11 — PASS)
- [x] Access revocation (Flow 12 — PASS)

### Acceptance Criteria

- Staging infrastructure provisioned and `/ready` verified.
- Critical flows tested against staging.
- Screenshots or test traces retained.
- Failures block final production release.

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

## Sprint 3 — profileees and Devices

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
- `TASK-0810`
- `TASK-0811`

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
TASK-0810 Manual faucet open/close control
TASK-0907 Production MQTT security
TASK-0908 Session revocation
TASK-0909 Backup and restore
TASK-1010 Production release
```

---

# 24. Release Blockers

The first production release is blocked until:

1. Staging infrastructure is provisioned and operational (`TASK-1004`).
2. UAT scenarios are executed and approved by stakeholders (`TASK-1008`).
3. Security exception governance process is completed and approved (`TASK-0906`).
4. Production readiness review is signed off (`TASK-1009`).
5. Hardware-in-the-loop validation is complete (`TASK-0811`).
6. Dual-role sign-off for physical faucet control is recorded (`TASK-1010`).

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
13. ~~Manual Open/Close control.~~ **RESOLVED** — OPEN/CLOSE actions approved per `DEC-CTRL-090`. Open faucet fail-safe behavior upon connection loss remains TBD.
14. Timeout values (ACK, completion, expiry). **TBD** — see `docs/DECISIONS.md` §3.
15. Late-event reconciliation. **TBD.**
16. MQTT broker (production choice). **TBD.**
17. ~~Device authentication method.~~ **RESOLVED** — per-device username/password + ACLs (`DEC-DEV-020`).
18. Telemetry intervals. **TBD** — see `docs/DECISIONS.md` §3.
19. Offline and stale thresholds. **TBD** — see `docs/DECISIONS.md` §3.
20. ~~Measurement units.~~ **RESOLVED** — confirmed in `DEC-MON-036` through `DEC-MON-050`.
21. ~~`Water BAT` meaning and unit.~~ **RESOLVED** — `BAT` stands for Battery, incorporated into soil and water quality sensors (`DEC-MON-085`).
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
5. ~~`Water BAT` meaning and unit.~~ **Resolved** — `BAT` stands for Battery, incorporated into soil and water quality sensors (`DEC-MON-085`).
6. Device freshness thresholds (offline and stale) remain undefined — see `docs/DECISIONS.md` §3.
7. ~~The production broker and device credential strategy remain unresolved.~~ **Resolved** — MQTT 5.0 over TLS, per-device credentials, per-device ACLs (`DEC-DEV-020`). Production broker vendor still TBD.
8. Command concurrency approved. Cancellation, stop, timeout values, and late-event handling remain TBD.
9. Performance and capacity targets remain provisional — see `docs/DECISIONS.md` §3.
10. Production physical control shall remain disabled until hardware-in-the-loop testing and explicit dual sign-off are complete.
11. **New (reconciliation):** ORM selection is unresolved. Neither Prisma nor Drizzle is installed. User must select one before `TASK-0104`.
12. **New (reconciliation):** TASKS.md Sections 25 and 26 had stale entries listing resolved decisions as still open. Updated above.
13. **New (reconciliation):** Previous DECISIONS.md Table 4 used incorrect task titles and IDs not matching TASKS.md. Corrected in DECISIONS.md revision.
14. **New (reconciliation):** Previous DECISIONS.md Table 4 marked TASK-0102 and TASK-0103 as READY despite depending on an unstarted TASK-0101. Corrected to BACKLOG.

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
< ! - -   T A S K - 0 8 0 2   R e c o n c i l e d :   2 0 2 6 - 0 8 - 1 9   - - > 
 
 