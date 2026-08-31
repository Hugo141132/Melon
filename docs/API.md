# API Specification

## 1. Document Information

| Item | Description |
|---|---|
| Product | Web-Based Soil and Water Monitoring and Faucet Control System |
| Document | Application Programming Interface Specification |
| Version | 1.0 |
| Status | Proposed baseline API |
| API style | REST over HTTPS |
| Payload format | JSON |
| Authentication | HTTP-only secure session cookies (`HttpOnly`, `SameSite=Strict`, `Secure` in prod) |
| Related documents | `FRONTEND_AUDIT.md`, `UI_UX.md`, `PRD.md`, `RBAC.md`, `USER_FLOWS.md`, `I18N.md`, `DEVICE_COMMUNICATION.md`, `ARCHITECTURE.md`, `DATABASE.md` |

---

## 2. Purpose

This document defines the application API used by the web frontend, internal services, and monitoring hardware.

The API shall support:

- Login and logout.
- Admin registration.
- Owner approval and rejection.
- Owner and Admin profilee management.
- Device listing and device access.
- **Device Telemetry Ingestion (Soil and Water Quality via REST API over Wi-Fi)**.
- Current soil and water monitoring query endpoints.
- Historical telemetry.
- Device status.
- Faucet-control commands.
- Alerts.
- Audit logs.
- User preferences and language.
- Real-time update endpoints.
- Health and readiness checks.

Note: Water tank telemetry (volume & flow rate) is ingested separately via MQTT/EMQX through the IoT Gateway service, not through the REST API. Electrical monitoring (voltage, current, power) via INA219 is sent via REST over Wi-Fi.

### 2.1 TASK-0914 Architectural Reconciliation
REST Soil and Water Quality telemetry ingestion endpoints (`POST /api/v1/devices/{deviceId}/telemetry/soil` and `.../water`) remain unchanged by `TASK-0914`. Direct EMQX Cloud TLS connectivity applies exclusively to the MQTT reservoir telemetry and faucet-control boundary handled by `apps/iot-gateway`. REST API interfaces, endpoints, error responses, and `ENABLE_FAUCET_CONTROL=false` safety defaults remain untouched.

---

The API shall not expose:

- MQTT broker credentials.
- Device secrets.
- Raw password hashes.
- Private keys.
- Internal database credentials.
- Unauthorised user or device data.

---

## 3. API Principles

### 3.1 Server-Side Authorisation

Every protected endpoint shall validate:

1. Authentication.
2. Account status.
3. Role.
4. Required permission.
5. Target-resource access.
6. Device assignment, where applicable.
7. Request payload.
8. Current resource state.

Frontend visibility shall not replace API authorisation.

### 3.2 Stable Machine Contracts

The API shall use stable English field names and canonical enum values.

The API shall not translate:

- Property names.
- Error codes.
- Role codes.
- Account statuses.
- Device statuses.
- Monitoring statuses.
- Command statuses.
- Audit event keys.

The frontend shall translate display text according to `I18N.md`.

### 3.3 Resource Scoping

Every device-specific request shall be scoped to one canonical device.

An Admin shall not gain access by modifying:

- URL path parameters.
- Query parameters.
- Request body fields.
- Device IDs.
- User IDs.

### 3.4 Idempotency

Physical faucet-control creation shall support idempotency.

Duplicate client retries shall not create duplicate physical commands.

### 3.5 Pagination

List endpoints shall support bounded pagination.

### 3.6 Time Format

All API timestamps shall use ISO 8601.

Example:

```text
2026-07-27T13:45:00+07:00
```

### 3.7 Null Semantics

The API shall distinguish:

- `0`: valid zero value.
- `null`: unavailable value.
- Missing property: unsupported or omitted by contract.
- Empty collection: valid result with no records.

---

## 4. Base URL and Versioning

Recommended base path:

```text
/api/v1
```

Examples:

```text
/api/v1/auth/login
/api/v1/devices
/api/v1/devices/{deviceId}/monitoring/latest
```

Breaking changes shall require a new major API version.

Backward-compatible fields may be added within the same version.

---

## 5. Content Type

Requests and responses shall use:

```http
Content-Type: application/json
Accept: application/json
```

File export endpoints may use other content types when later approved.

---

## 6. Authentication Model

The final authentication mechanism is `TBD`.

Recommended options:

### Option A — Secure Cookie Session

Recommended for a web-only application.

Requirements:

- `HttpOnly`.
- `Secure` in production.
- Appropriate `SameSite`.
- CSRF protection where required.
- Server-side revocation.
- Session expiry.
- Account-status revalidation.

### Option B — Bearer Token

Use only when external clients or mobile applications require it.

Requirements:

```http
Authorization: Bearer <token>
```

Bearer tokens shall support revocation or short lifetimes.

### 6.1 Protected Access

Only accounts with:

```text
accountStatus = ACTIVE
```

shall access protected endpoints.

---

## 7. Standard Response Envelope

### 7.1 Success Response

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req-01JXYZ001"
  }
}
```

### 7.2 List Response

```json
{
  "success": true,
  "data": [],
  "meta": {
    "requestId": "req-01JXYZ001",
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 125,
      "totalPages": 7
    }
  }
}
```

### 7.3 Error Response

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not permitted to perform this action.",
    "details": {}
  },
  "meta": {
    "requestId": "req-01JXYZ001"
  }
}
```

The `message` is an optional safe fallback.

The frontend should primarily map `error.code` to a translation key.

---

## 8. Standard HTTP Status Codes

| Status | Meaning |
|---:|---|
| `200` | Successful read or update |
| `201` | Resource created |
| `202` | Request accepted for asynchronous processing |
| `204` | Successful action with no body |
| `400` | Invalid request |
| `401` | Missing or invalid authentication |
| `403` | Authenticated but not authorised |
| `404` | Resource unavailable or concealed |
| `409` | Conflict with current state |
| `422` | Domain validation failure |
| `429` | Rate limit exceeded |
| `500` | Unexpected server failure |
| `503` | Dependency unavailable |

---

## 9. Standard Error Codes

### 9.1 Authentication and Account

```text
UNAUTHENTICATED
INVALID_CREDENTIALS
SESSION_EXPIRED
ACCOUNT_PENDING_APPROVAL
ACCOUNT_APPROVED_NOT_ACTIVE
ACCOUNT_REJECTED
ACCOUNT_SUSPENDED
ACCOUNT_DEACTIVATED
EMAIL_NOT_VERIFIED
```

### 9.2 Authorisation

```text
FORBIDDEN
PERMISSION_DENIED
DEVICE_ACCESS_DENIED
OWNER_ONLY
```

### 9.3 Validation

```text
VALIDATION_ERROR
REQUIRED_FIELD
INVALID_EMAIL
DUPLICATE_EMAIL
PASSWORD_POLICY_FAILED
PASSWORD_MISMATCH
UNSUPPORTED_LOCALE
INVALID_DATE_RANGE
INVALID_DEVICE_ID
INVALID_PHASE
```

### 9.4 Devices and Monitoring

```text
DEVICE_NOT_FOUND
DEVICE_INACTIVE
DEVICE_OFFLINE
DEVICE_STATUS_UNKNOWN
NO_MONITORING_DATA
STALE_MONITORING_DATA
INVALID_MONITORING_DATA
```

### 9.5 Faucet Control

```text
CONTROL_PERMISSION_DENIED
DEVICE_NOT_CONTROLLABLE
ACTIVE_COMMAND_EXISTS
DUPLICATE_COMMAND
COMMAND_NOT_FOUND
COMMAND_STATE_CONFLICT
COMMAND_EXPIRED
COMMAND_TIMEOUT
COMMAND_FAILED
COMMAND_NOT_CANCELLABLE
```

### 9.6 Infrastructure

```text
DATABASE_UNAVAILABLE
GATEWAY_UNAVAILABLE
BROKER_UNAVAILABLE
SERVICE_UNAVAILABLE
INTERNAL_ERROR
```

---

# 10. Authentication Endpoints

## 10.1 Register Admin Account

```http
POST /api/v1/auth/register
```

**Authentication:** Public
**Permission:** `account.register`

Request:

```json
{
  "fullName": "Admin User",
  "email": "admin@example.com",
  "password": "secure-password",
  "passwordConfirmation": "secure-password",
  "preferredLocale": "id"
}
```

Server rules:

- Force role `ADMIN`.
- Force account status `PENDING_APPROVAL`.
- Ignore or reject client-supplied role.
- Ignore or reject client-supplied account status.
- Never create `OWNER`.
- Validate email uniqueness.
- Hash password securely.
- Generate 256-bit CSPRNG verification token and dispatch verification email via Resend (`DEC-AUTH-104` / `TASK-0214`).
- Record registration audit event.

Response:

```json
{
  "success": true,
  "data": {
    "userId": "9eea2fa7-9fb5-45bb-9aa5-d963f68252b3",
    "accountStatus": "PENDING_APPROVAL",
    "preferredLocale": "id"
  },
  "meta": {
    "requestId": "req-001"
  }
}
```

Possible errors:

```text
VALIDATION_ERROR
DUPLICATE_EMAIL
PASSWORD_POLICY_FAILED
RATE_LIMITED
```

---

## 10.2 Login

```http
POST /api/v1/auth/login
```

**Authentication:** Public

Request:

```json
{
  "email": "admin@example.com",
  "password": "secure-password"
}
```

Successful response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "9eea2fa7-9fb5-45bb-9aa5-d963f68252b3",
      "fullName": "Admin User",
      "email": "admin@example.com",
      "role": "ADMIN",
      "accountStatus": "ACTIVE",
      "preferredLocale": "id"
    }
  },
  "meta": {
    "requestId": "req-002"
  }
}
```

Account-state and concurrency errors:

```text
ACCOUNT_PENDING_APPROVAL
ACCOUNT_APPROVED_NOT_ACTIVE
ACCOUNT_REJECTED
ACCOUNT_SUSPENDED
ACCOUNT_DEACTIVATED
EMAIL_NOT_VERIFIED
ACTIVE_SESSION_EXISTS (HTTP 409 Conflict - single active session policy per DEC-AUTH-107)
```

---

## 10.3 Logout

```http
POST /api/v1/auth/logout
```

**Authentication:** Required

Response:

```http
204 No Content
```

Error Responses:

```text
500 Internal Server Error (INTERNAL_ERROR - unexpected revocation or database failure)
```

Server actions:

- Extract session token from cookie store (or fallback header).
- Revoke or invalidate the current session in PostgreSQL (`revoked_at = NOW()`).
- Clear session cookie with `Max-Age=0`.
- Record `AUTH_LOGOUT` audit log.
- Unexpected failures fail closed and return standard `INTERNAL_ERROR` (500) rather than a false 204 success.

---

## 10.4 Get Session

```http
GET /api/v1/auth/session
```

**Authentication:** Optional or required depending on framework.

Response:

```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "user": {
      "id": "user-001",
      "role": "OWNER",
      "accountStatus": "ACTIVE",
      "preferredLocale": "en"
    }
  }
}
```

---

## 10.5 Change Own Password

```http
POST /api/v1/auth/change-password
```

**Authentication:** Required
**Permission:** `profilee.password.update.self`

Request:

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-secure-password",
  "newPasswordConfirmation": "new-secure-password"
}
```

Response:

```http
204 No Content
```

Open decisions & resolved policies:

- All active sessions are transactionally revoked across devices upon successful password reset (`DEC-AUTH-102` / `TASK-0213`).
- Password policy: Minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character with Argon2id hashing (`DEC-AUTH-102` / `TASK-0213`).
- Multi-factor authentication remains TBD.

---

## 10.6 Forgot Password (DEC-AUTH-102 / TASK-0213)

```http
POST /api/v1/auth/forgot-password
```

**Authentication:** Public
**Rate Limit:** 3 requests/minute (configurable via `RATE_LIMIT_FORGOT_PASSWORD_MAX`, default: 3)

Request:

```json
{
  "email": "user@example.com"
}
```

Response (HTTP 200 OK — strictly anti-enumeration):

```json
{
  "success": true,
  "message": "If an account exists with that email, a password reset link has been sent.",
  "meta": {
    "requestId": "req-1718000000000"
  }
}
```

Server rules:
- Unconditionally returns HTTP 200 with generic message whether user exists, is pending, is suspended, or does not exist.
- Never reveals user existence or returns user profilee metadata.
- Applies timing-mitigation equalizers to prevent side-channel timing enumeration of account existence.
- If user exists, generates a 256-bit CSPRNG token (valid for 15 minutes by default, configurable via `AUTH_RESET_TOKEN_EXPIRY_MINUTES`), persists SHA-256 hash in `password_reset_tokens`, and dispatches email via Resend (`sendPasswordResetEmail`).
- Reset link URL is constructed strictly from configured `APP_URL` / `NEXT_PUBLIC_APP_URL` (in production, explicit HTTPS URL is required).

Possible errors:
- `400 Bad Request`: `VALIDATION_ERROR` (invalid email or unrecognized fields)
- `429 Too Many Requests`: `TOO_MANY_REQUESTS` (rate limit exceeded)

---

## 10.7 Reset Password (DEC-AUTH-102 / TASK-0213)

```http
POST /api/v1/auth/reset-password
```

**Authentication:** Public / Reset Token
**Rate Limit:** 5 requests/minute (configurable via `RATE_LIMIT_RESET_PASSWORD_MAX`, default: 5)

Request:

```json
{
  "token": "4f9d2a6c8b1e...",
  "newPassword": "NewSecurePassword123!",
  "newPasswordConfirmation": "NewSecurePassword123!"
}
```

Response (HTTP 200 OK):

```json
{
  "success": true,
  "message": "Password has been successfully reset.",
  "data": {
    "user": {
      "id": "9eea2fa7-9fb5-45bb-9aa5-d963f68252b3",
      "email": "admin@example.com",
      "fullName": "Admin User"
    },
    "revokedSessionsCount": 2
  },
  "meta": {
    "requestId": "req-1718000000001"
  }
}
```

Server rules:
- Validates password complexity against policy (minimum 12 chars, uppercase, lowercase, numbers, special characters).
- Looks up token by SHA-256 hash in `password_reset_tokens`.
- Verifies token has not expired (token lifetime: 15 minutes, configurable via `AUTH_RESET_TOKEN_EXPIRY_MINUTES`) and has not been used (`used_at IS NULL`).
- Hashes new password with Argon2id and updates `users.password_hash`.
- Strictly preserves existing `accountStatus` (password reset NEVER activates or approves pending accounts; normal login guards control access).
- Marks token `used_at = NOW()` and invalidates other pending tokens for user.
- Revokes all active user sessions across devices (`session-service.ts` / `TASK-0908`).
- Emits structured audit log `auth.password_reset.completed`.

Possible errors:
- `400 Bad Request`: `VALIDATION_ERROR`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_ALREADY_USED`
- `422 Unprocessable Entity`: `WEAK_PASSWORD`, `PASSWORD_CONFIRMATION_MISMATCH`
- `429 Too Many Requests`: `TOO_MANY_REQUESTS`

---

## 10.8 Verify Email (DEC-AUTH-104 / TASK-0214)

```http
POST /api/v1/auth/verify-email
```

**Authentication:** Public / Verification Code or Token
**Rate Limit:** Standard public rate limit

Request (6-digit code flow - primary):

```json
{
  "email": "admin@example.com",
  "code": "849201"
}
```

Request (Legacy token flow - backward compatible):

```json
{
  "token": "a1b2c3d4e5f6..."
}
```

Response (HTTP 200 OK):

```json
{
  "success": true,
  "message": "Email address has been successfully verified.",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@example.com",
      "fullName": "Admin User",
      "accountStatus": "PENDING_APPROVAL",
      "emailVerifiedAt": "2026-08-22T08:00:00.000Z"
    }
  },
  "meta": {
    "requestId": "req-1718000000002"
  }
}
```

Server rules:
- Verifies code by SHA-256 hash `sha256(userId:code)` in `email_verification_tokens` (or token directly).
- Asserts code is unexpired (15-minute validity) and unconsumed.
- Sets `users.email_verified_at = NOW()` for the associated user account.
- Strictly preserves existing `accountStatus` (`ADMIN` accounts remain `PENDING_APPROVAL`, `OWNER` accounts remain `ACTIVE`).
- Strictly does NOT issue, create, or return an authentication session. Verification confirms ownership only; normal login remains a separate step.
- Deletes the token/code record upon successful verification.
- Handles Prisma `P2034` transaction write conflicts with bounded retries (3 attempts), returning `CONCURRENCY_CONFLICT` (HTTP 409) upon exhaustion.
- Returns `TOKEN_ALREADY_USED` (HTTP 400) if code was already used (`P2025` or user already verified).
- Emits structured audit log `account.email.verified`.

Frontend rules:
- Employs in-flight Promise map deduplication with immediate cache eviction on settlement (`finally`) to ensure exactly 1 network POST in React Strict Mode / remounts while delivering navigation triggers to the active mount.
- If `accountStatus === 'PENDING_APPROVAL'`, redirects to `/status?status=PENDING_APPROVAL`.
- Enforces server-side guest guard (`DEC-AUTH-103`), redirecting authenticated sessions on `/verify-email` to `/`.

Testing status:
- *Delivery & Testing Status*: Verification has been manually exercised using Resend test mode/test recipients and 6-digit code dispatch. We have not yet tested delivery to arbitrary real email recipients using a verified custom sending domain, because no such domain is currently configured. Real-mailbox deliverability is treated as pending deployment/infrastructure acceptance, not an application logic failure.

Possible errors:
- `400 Bad Request`: `VALIDATION_ERROR`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_ALREADY_USED`
- `409 Conflict`: `CONCURRENCY_CONFLICT`
- `429 Too Many Requests`: `TOO_MANY_REQUESTS`

---

## 10.9 Resend Email Verification (DEC-AUTH-104 / TASK-0214)

```http
POST /api/v1/auth/resend-verification
```

**Authentication:** Public
**Rate Limit:** 3 requests/minute (configurable via `RATE_LIMIT_RESEND_VERIFICATION_MAX`, default: 3)

Request:

```json
{
  "email": "admin@example.com"
}
```

Response (HTTP 200 OK — strictly anti-enumeration):

```json
{
  "success": true,
  "message": "If an unverified account exists with that email, a verification link has been sent.",
  "meta": {
    "requestId": "req-1718000000003"
  }
}
```

Server rules:
- Unconditionally returns HTTP 200 with generic message whether user exists, is already verified, or does not exist (anti-enumeration).
- Applies timing-mitigation equalizers to prevent side-channel timing attacks.
- If an account exists and `email_verified_at` is null, invalidates prior verification tokens, generates a new 6-digit verification code (valid for 15 minutes per `AUTH_VERIFY_TOKEN_EXPIRY_MINUTES = 15`), and dispatches bilingual verification email via Resend (`DEC-AUTH-104` / `TASK-0214`).

Possible errors:
- `400 Bad Request`: `VALIDATION_ERROR` (invalid email)
- `429 Too Many Requests`: `TOO_MANY_REQUESTS`

---

# 11. Current User Endpoints

## 11.1 Get Current User

```http
GET /api/v1/me
```

**Authentication:** Required
**Permission:** `profilee.self.read`

Response:

```json
{
  "success": true,
  "data": {
    "id": "user-001",
    "fullName": "Admin User",
    "email": "admin@example.com",
    "role": "ADMIN",
    "accountStatus": "ACTIVE",
    "preferredLocale": "id",
    "timezone": "Asia/Jakarta",
    "lastLoginAt": "2026-07-27T12:00:00+07:00",
    "createdAt": "2026-07-20T10:00:00+07:00",
    "updatedAt": "2026-07-27T12:00:00+07:00"
  }
}
```

---

## 11.2 Update Current User profilee

```http
PATCH /api/v1/me
```

**Authentication:** Required
**Permission:** `profilee.self.update`

Request:

```json
{
  "fullName": "Updated Name"
}
```

The server shall reject self-updates to:

- Role.
- Account status.
- Device assignments.
- Approval metadata.
- Immutable IDs.

Response:

```json
{
  "success": true,
  "data": {
    "id": "user-001",
    "fullName": "Updated Name",
    "email": "admin@example.com",
    "role": "ADMIN",
    "accountStatus": "ACTIVE"
  }
}
```

---

## 11.3 Update Current User Preferences

```http
PATCH /api/v1/me/preferences
```

**Authentication:** Required
**Permission:** `settings.self.update`, `language.self.update`

Request:

```json
{
  "preferredLocale": "id",
  "timezone": "Asia/Jakarta",
  "defaultDeviceId": "device-001"
}
```

Rules:

- `preferredLocale` must be `en` or `id`.
- `defaultDeviceId` must be accessible to the user.
- Locale changes shall not change permissions.

Response:

```json
{
  "success": true,
  "data": {
    "preferredLocale": "id",
    "timezone": "Asia/Jakarta",
    "defaultDeviceId": "device-001"
  }
}
```

---

## 11.4 Request Email Change

```http
POST /api/v1/me/email/request
```

**Authentication:** Required
**Permission:** `profilee.self.update`

Request:

```json
{
  "newEmail": "newadmin@example.com",
  "currentPassword": "current-secure-password"
}
```

Server rules:
- Requires active authenticated session.
- Verifies `currentPassword` against caller account.
- Normalizes `newEmail` (`trim().toLowerCase()`).
- Rejects request if `newEmail` matches caller's existing authoritative email (`SAME_EMAIL`).
- Validates that `newEmail` is not already taken by another user (`DUPLICATE_EMAIL`).
- Generates a 6-digit numeric CSPRNG verification code (`100000`–`999999`) with 15-minute expiry (`AUTH_VERIFY_TOKEN_EXPIRY_MINUTES = 15`).
- Persists user-and-target-scoped hash `sha256(userId:newEmail:code)` in `email_verification_tokens.token_hash` and candidate email in `email_verification_tokens.pending_email`.
- Dispatches verification email strictly to `newEmail` via Resend (`sendWithRetry`).
- Existing user email remains 100% authoritative for all system access until verification.
- Enforces rate limit of 3 req/min (`RATE_LIMIT_EMAIL_CHANGE_REQUEST_MAX = 3`).

Response:

```json
{
  "success": true,
  "data": {
    "status": "VERIFICATION_CODE_SENT",
    "expiresAt": "2026-08-29T17:49:38.000Z"
  }
}
```

Possible errors:
- `400 Bad Request`: `VALIDATION_ERROR`, `SAME_EMAIL`
- `401 Unauthorized`: `UNAUTHORIZED`, `INVALID_CREDENTIALS`
- `409 Conflict`: `DUPLICATE_EMAIL`
- `429 Too Many Requests`: `RATE_LIMITED`

---

## 11.5 Verify Email Change

```http
POST /api/v1/me/email/verify
```

**Authentication:** Required
**Permission:** `profilee.self.update`

Request:

```json
{
  "code": "482910"
}
```

Server rules:
- Requires active authenticated session.
- Locates active `email_verification_tokens` record matching `userId` and `pending_email IS NOT NULL` where `token_hash = sha256(userId:pending_email:code)`.
- Validates code has not expired (`expiresAt > NOW()`).
- In an atomic transaction:
  - Re-verifies candidate email uniqueness.
  - Updates `users.email = pending_email` and `users.emailVerifiedAt = NOW()`.
  - Deletes the consumed verification token.
  - Emits structured audit log `account.email.changed` with strictly non-sensitive metadata (actor ID, target ID, action string; NO raw old/new plaintext emails).
- Preserves current active session in-memory without forced logout.
- Enforces rate limit of 5 req/min (`RATE_LIMIT_EMAIL_CHANGE_VERIFY_MAX = 5`).

Response:

```json
{
  "success": true,
  "data": {
    "email": "newadmin@example.com",
    "emailVerifiedAt": "2026-08-29T17:35:00.000Z"
  }
}
```

Possible errors:
- `400 Bad Request`: `INVALID_VERIFICATION_CODE`, `TOKEN_EXPIRED`, `NO_PENDING_EMAIL_CHANGE`
- `401 Unauthorized`: `UNAUTHORIZED`
- `409 Conflict`: `DUPLICATE_EMAIL`, `CONCURRENCY_CONFLICT`
- `429 Too Many Requests`: `RATE_LIMITED`

---

# 12. User Management Endpoints

All endpoints in this section are Owner-only unless explicitly stated.

## 12.1 List Users

```http
GET /api/v1/users
```

**Authentication:** Required
**Permission:** `profilee.other.read`

Query parameters:

```text
page
pageSize
role
accountStatus
search
sort
```

Example:

```http
GET /api/v1/users?page=1&pageSize=20&role=ADMIN&accountStatus=ACTIVE
```

Response item:

```json
{
  "id": "user-002",
  "fullName": "Admin Two",
  "email": "admin2@example.com",
  "role": "ADMIN",
  "accountStatus": "ACTIVE",
  "preferredLocale": "id",
  "lastLoginAt": "2026-07-27T09:00:00+07:00",
  "createdAt": "2026-07-22T10:00:00+07:00"
}
```

---

## 12.2 Get User

```http
GET /api/v1/users/{userId}
```

**Authentication:** Required
**Permission:** `profilee.other.read`

Response:

```json
{
  "success": true,
  "data": {
    "id": "user-002",
    "fullName": "Admin Two",
    "email": "admin2@example.com",
    "role": "ADMIN",
    "accountStatus": "ACTIVE",
    "preferredLocale": "id",
    "deviceAssignments": [
      {
        "deviceId": "water-node-001",
        "deviceName": "Water Node 1",
        "canView": true,
        "canControl": false
      }
    ]
  }
}
```

---

## 12.3 Update Another User

```http
PATCH /api/v1/users/{userId}
```

**Authentication:** Required
**Permission:** `profilee.other.update`

Request:

```json
{
  "fullName": "Updated Admin Name",
  "email": "updated@example.com"
}
```

Role and account-status changes shall use dedicated endpoints.

---

## 12.4 Suspend User

```http
POST /api/v1/users/{userId}/suspend
```

**Authentication:** Required
**Permission:** `account.suspend`

Request:

```json
{
  "reason": "Temporary access restriction"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "userId": "user-002",
    "accountStatus": "SUSPENDED",
    "suspendedAt": "2026-07-27T14:00:00+07:00"
  }
}
```

The server shall revoke or restrict active sessions.

---

## 12.5 Activate User

```http
POST /api/v1/users/{userId}/activate
```

**Authentication:** Required
**Permission:** `account.activate`

Status: `TBD`, depending on the final `APPROVED` and `ACTIVE` workflow.

---

## 12.6 Permanent Delete User Account

```http
DELETE /api/v1/users/{userId}
```

**Authentication:** Required
**Permission:** `account.deactivate` (or `account.delete`)

**Rules:**
- Owner-only endpoint.
- Target must be an `ADMIN` account in `ACTIVE`, `SUSPENDED`, `REJECTED`, `DEACTIVATED`, or legacy `APPROVED` status.
- Deletion of `PENDING_APPROVAL` accounts is rejected with `409 CANNOT_DELETE_PENDING_APPROVAL`. (Pending accounts must be processed via the approval workflow).
- Deletion of `OWNER` accounts or self-deletion is strictly forbidden (`403 FORBIDDEN_TARGET`).
- Transactionally deletes all dependent records (`sessions`, `user_roles`, `user_preferences`, `user_device_access`, `account_approvals`, `faucet_commands`), anonymizes `actorUserId` in `audit_logs`, logs an `account.deleted` audit event, and hard-deletes the `users` database row.

Request:

```json
{
  "reason": "Account no longer required"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "deletedUserId": "user-002"
  },
  "meta": {
    "requestId": "req-01JXYZ001"
  }
}
```

---

## 12.7 Change User Role

```http
PATCH /api/v1/users/{userId}/role
```

**Authentication:** Required
**Permission:** `account.role.update`

Request:

```json
{
  "role": "ADMIN"
}
```

Rules:

- Public registration cannot call this endpoint.
- An Admin cannot change any role.
- Additional Owner creation policy is `TBD`.
- The API shall reject unsupported roles.

---

# 13. Approval Endpoints

## 13.1 List Pending Registrations

```http
GET /api/v1/approvals/pending
```

**Authentication:** Required
**Permission:** `account.approve` or `account.reject`

Query parameters:

```text
page
pageSize
search
sort
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "userId": "user-pending-001",
      "fullName": "Pending Admin",
      "email": "pending@example.com",
      "accountStatus": "PENDING_APPROVAL",
      "createdAt": "2026-07-27T10:00:00+07:00"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 1,
      "totalPages": 1
    }
  }
}
```

---

## 13.2 Get Pending Registration

```http
GET /api/v1/approvals/{userId}
```

**Authentication:** Required
**Permission:** `account.approve` or `account.reject`

---

## 13.3 Approve Registration

```http
POST /api/v1/approvals/{userId}/approve
```

**Authentication:** Required
**Permission:** `account.approve`

Request:

```json
{
  "decisionNote": "Approved for monitoring access"
}
```

Server behaviour:

1. Verify target user exists and `accountStatus` is `PENDING_APPROVAL`.
2. Verify target user has verified email ownership (`emailVerifiedAt` is not null per `DEC-AUTH-104`).
3. Prevent duplicate/conflicting decisions.
4. Update to `APPROVED` or `ACTIVE`.
4. Insert approval history.
5. Insert audit log.
6. Commit transaction.
7. Send notification after commit.

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-pending-001",
      "fullName": "Pending Admin",
      "email": "pending@example.com",
      "accountStatus": "APPROVED",
      "roles": ["ADMIN"],
      "createdAt": "2026-07-27T10:00:00.000Z",
      "updatedAt": "2026-07-29T14:10:00.000Z"
    },
    "approvalRecordId": "approval-uuid-001"
  },
  "meta": {
    "requestId": "req-001"
  }
}
```

Possible errors:

```text
UNAUTHENTICATED
FORBIDDEN
USER_NOT_FOUND
CONFLICT
VALIDATION_ERROR
INTERNAL_ERROR
```

---

## 13.4 Reject Registration

```http
POST /api/v1/approvals/{userId}/reject
```

**Authentication:** Required
**Permission:** `account.reject`

Request:

```json
{
  "decisionNote": "Registration could not be verified"
}
```

Server behaviour:

1. Verify target user exists and `accountStatus` is `PENDING_APPROVAL`.
2. Verify target user has verified email ownership (`emailVerifiedAt` is not null, selected via `emailVerifiedAt: true` projection per `DEC-AUTH-104`). Unverified targets return HTTP 409 `INVALID_STATUS`.
3. Prevent duplicate or conflicting decisions.
4. Update `accountStatus` to `REJECTED`.
5. Insert approval history record in `approval_history`.
6. Insert audit log (`account.rejected`).
7. Commit transaction.

Response (HTTP 200 OK):

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-pending-001",
      "fullName": "Pending Admin",
      "email": "pending@example.com",
      "accountStatus": "REJECTED",
      "roles": ["ADMIN"]
    },
    "approvalRecordId": "approval-uuid-002"
  },
  "meta": {
    "requestId": "req-002"
  }
}
```

Possible errors:
- `400 Bad Request`: `VALIDATION_ERROR`
- `401 Unauthorized`: `UNAUTHENTICATED`
- `403 Forbidden`: `FORBIDDEN`
- `404 Not Found`: `USER_NOT_FOUND`
- `409 Conflict`: `INVALID_STATUS` (target user is unverified or already approved/rejected)

---

# 14. Device Endpoints

## 14.1 List Authorised Devices

```http
GET /api/v1/devices
```

**Authentication:** Required
**Permission:** `device.read`

The server shall return only authorised devices.

Role-based response filtering (`DEC-DEV-028`):
- For `OWNER`: All fields including the canonical `deviceId` string are returned.
- For `ADMIN`: The canonical `deviceId` field is strictly concealed (omitted or masked). Admin users only see user-facing device `name` and status metadata.

Query parameters:

```text
page (integer >= 1, default 1)
pageSize (integer 1..100, default 20)
siteId (UUID)
deviceType (SOIL_NODE | WATER_QUALITY_NODE | WATER_TANK_NODE)
connectionStatus (ONLINE | OFFLINE | STALE | UNKNOWN | INACTIVE)
accountStatus (ACTIVE | INACTIVE | DEACTIVATED)
search (string)
sort (field:asc | field:desc, default createdAt:desc)
```

Error responses:
- `401 Unauthorized`: `UNAUTHENTICATED`, `INVALID_SESSION`
- `403 Forbidden`: `ACCOUNT_NOT_ACTIVE`, `INSUFFICIENT_PERMISSION`
- `422 Unprocessable Entity`: `VALIDATION_ERROR` (e.g. invalid page/pageSize bounds)
- `500 Internal Server Error`: `INTERNAL_ERROR`

Response item (Owner view):

```json
{
  "id": "device-db-uuid",
  "deviceId": "water-node-001",
  "name": "Water Node 1",
  "siteId": "site-01",
  "deviceType": "WATER_TANK_NODE",
  "connectionStatus": "ONLINE",
  "accountStatus": "ACTIVE",
  "lastSeenAt": "2026-07-27T14:15:00+07:00",
  "firmwareVersion": "1.0.0",
  "capabilities": [
    "WATER_TELEMETRY",
    "LOCATION",
    "TANK_MONITORING",
    "FLOW_MONITORING",
    "FAUCET_CONTROL"
  ],
  "permissions": {
    "canView": true,
    "canControl": false
  }
}
```

Response item (Admin view — `deviceId` concealed per `DEC-DEV-028`):

```json
{
  "id": "device-db-uuid",
  "name": "Water Node 1",
  "siteId": "site-01",
  "deviceType": "WATER_TANK_NODE",
  "connectionStatus": "ONLINE",
  "accountStatus": "ACTIVE",
  "lastSeenAt": "2026-07-27T14:15:00+07:00",
  "firmwareVersion": "1.0.0",
  "capabilities": [
    "WATER_TELEMETRY",
    "LOCATION",
    "TANK_MONITORING",
    "FLOW_MONITORING",
    "FAUCET_CONTROL"
  ],
  "permissions": {
    "canView": true,
    "canControl": false
  }
}
```

---

## 14.2 Get Device

```http
GET /api/v1/devices/{deviceId}
```

**Authentication:** Required
**Permission:** `device.read` (Active account status and baseline permission verified before DB lookup to prevent existence probing)
**Resource check:** Device access required (Owner: global scope; Admin: actively assigned via `UserDeviceAccess` where `revokedAt IS NULL`)
**Lookup identifier:** Accepts canonical `deviceId` string or internal database UUID (`devices.id`)
**Role filtering:** Canonical `deviceId` is returned for Owner; strictly concealed for Admin (`DEC-DEV-028`). Safe internal database UUID `id` is always retained.

Error responses:
- `401 Unauthorized`: `UNAUTHENTICATED`, `INVALID_SESSION`
- `403 Forbidden`: `ACCOUNT_NOT_ACTIVE`, `DEVICE_NOT_ASSIGNED` (unassigned or revoked Admin access / IDOR attempt)
- `404 Not Found`: `DEVICE_NOT_FOUND`
- `500 Internal Server Error`: `INTERNAL_ERROR`

---

## 14.3 Create Device (REMOVED)

```http
POST /api/v1/devices
```

**Status:** `REMOVED / SUPERSEDED` per `DEC-DEV-027`
**Description:** In-app and API-based device creation is removed. Devices cannot be registered through the application UI or REST API. Pre-existing devices remain in the database, and new device provisioning is managed out-of-band via database seeding/administrative scripts.

---

## 14.4 Update Device

```http
PATCH /api/v1/devices/{deviceId}
```

**Authentication:** Required
**Permission:** `device.update` (Owner only; Admins denied per `DEC-DEV-028`)
**Status:** `APPROVED` (`DEC-DEV-028`)

Request body:

```json
{
  "deviceId": "water-node-002-renamed",
  "name": "Water Node 2 Renamed",
  "siteId": "site-01"
}
```

Rules:
- The internal database primary key UUID (`devices.id`) is immutable and never updated.
- The Owner may update the canonical `deviceId` string and user-facing `name`.
- Renaming `deviceId` preserves all relational foreign keys (`devices.id` references).
- Physical ESP32/NodeMCU firmware reconfiguration and EMQX broker credential/ACL synchronization following a `deviceId` rename are operational workflows marked as **TBD / BLOCKING** automation (`DEC-DEV-028`).

---

## 14.5 Deactivate Device

```http
POST /api/v1/devices/{deviceId}/deactivate
```

**Authentication:** Required
**Permission:** `device.deactivate` (Owner only)
**Description:** Deactivates an active device, setting `accountStatus = 'DEACTIVATED'`, `connectionStatus = 'INACTIVE'`, populating `deactivatedAt = NOW()`, and preventing faucet commands.

Response:

```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-1111-1111-111111111111",
    "deviceId": "water-node-001",
    "accountStatus": "DEACTIVATED",
    "connectionStatus": "INACTIVE"
  },
  "meta": { "requestId": "req-1724400000000" }
}
```

---

## 14.6 Activate Device

```http
POST /api/v1/devices/{deviceId}/activate
```

**Authentication:** Required
**Permission:** `device.activate` (Owner only; `DEC-DEV-030`)
**Description:** Reactivates a deactivated device, restoring `accountStatus = 'ACTIVE'`, resetting `connectionStatus = 'UNKNOWN'`, and clearing `deactivatedAt = NULL`.

Response:

```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-1111-1111-111111111111",
    "deviceId": "water-node-001",
    "accountStatus": "ACTIVE",
    "connectionStatus": "UNKNOWN"
  },
  "meta": { "requestId": "req-1724400000000" }
}
```

---

## 14.7 List Device Capabilities

```http
GET /api/v1/devices/{deviceId}/capabilities
```

**Authentication:** Required
**Permission:** `device.read`

---

## 14.8 Delete Device

```http
DELETE /api/v1/devices/{deviceId}
```

**Status:** `REMOVED / FORBIDDEN` per `DEC-DEV-030`
**Description:** Hard deletion of devices is permanently removed to prevent catastrophic relational data loss across telemetry, audit trails, commands, and access assignments. Device lifecycle must be managed exclusively via Deactivation and Reactivation.

---

# 15. Device Assignment Endpoints

## 15.1 List User Device Assignments

```http
GET /api/v1/users/{userId}/devices
```

**Authentication:** Required
**Permission:** `device.assign` or `profilee.other.read`

---

## 15.2 Assign Device to Admin

```http
POST /api/v1/users/{userId}/devices
```

**Authentication:** Required
**Permission:** `device.assign`

Request:

```json
{
  "deviceId": "water-node-001",
  "canView": true,
  "canControl": false
}
```

Rules:

- Target must be an Admin.
- Device must be within Owner scope.
- `canControl` shall remain separate from `canView`.
- Duplicate active assignment shall return existing assignment or conflict.

Response:

```json
{
  "success": true,
  "data": {
    "userId": "user-002",
    "deviceId": "water-node-001",
    "canView": true,
    "canControl": false,
    "assignedAt": "2026-07-27T14:20:00+07:00"
  }
}
```

---

## 15.3 Update Device Assignment

```http
PATCH /api/v1/users/{userId}/devices/{deviceId}
```

**Authentication:** Required
**Permission:** `device.assign`

Request:

```json
{
  "canView": true,
  "canControl": true
}
```

Final control-assignment policy remains `TBD`.

---

## 15.4 Remove Device Assignment

```http
DELETE /api/v1/users/{userId}/devices/{deviceId}
```

**Authentication:** Required
**Permission:** `device.unassign`

Recommended response:

```http
204 No Content
```

The database should soft-revoke the assignment.

---

# 16. Current Monitoring Endpoints

## 16.1 Get Latest Monitoring Snapshot

```http
GET /api/v1/devices/{deviceId}/monitoring/latest
```

**Authentication:** Required
**Permissions:**

```text
device.read
monitoring.current.read
```

**Resource check:** Device access required (Owner: global scope; Admin: actively assigned device)
**Lookup identifier:** Accepts internal database UUID (`devices.id`) or external canonical string (`deviceId`). Role-based device visibility and Admin concealment rules apply (`DEC-DEV-028`).

Response:

```json
{
  "success": true,
  "data": {
    "device": {
      "deviceId": "combined-node-001",
      "name": "Field Device 1",
      "connectionStatus": "ONLINE",
      "lastSeenAt": "2026-07-27T14:25:00+07:00"
    },
    "soil": {
      "recordedAt": "2026-07-27T14:24:30+07:00",
      "receivedAt": "2026-07-27T14:24:31+07:00",
      "nitrogen": 45.2,
      "phosphorus": 21.8,
      "potassium": 73.1,
      "temperature": 28.4,
      "moisture": 67.3,
      "ph": 6.5,
      "ec": 1.42,
      "status": "NORMAL",
      "freshness": "CURRENT"
    },
    "water": {
      "recordedAt": "2026-07-27T14:24:30+07:00",
      "receivedAt": "2026-07-27T14:24:31+07:00",
      "ph": 7.1,
      "tds": 420,
      "ec": 0.84,
      "status": "NORMAL",
      "freshness": "CURRENT"
    }
  }
}
```

Possible freshness values:

```text
CURRENT
STALE
EMPTY
INVALID
UNAVAILABLE
```

---

## 16.2 Get Latest Soil Reading

```http
GET /api/v1/devices/{deviceId}/monitoring/soil/latest
```

**Authentication:** Required
**Permission:** `monitoring.current.read`
**Lookup identifier:** Accepts internal database UUID (`devices.id`) or external canonical string (`deviceId`). Role-based device visibility and Admin concealment rules apply (`DEC-DEV-028`).

---

## 16.3 Get Latest Water Reading

```http
GET /api/v1/devices/{deviceId}/monitoring/water/latest
```

**Authentication:** Required
**Permission:** `monitoring.current.read`
**Lookup identifier:** Accepts internal database UUID (`devices.id`) or external canonical string (`deviceId`). Role-based device visibility and Admin concealment rules apply (`DEC-DEV-028`).

---

## 16.4 Get Device Status

```http
GET /api/v1/devices/{deviceId}/status
```

**Authentication:** Required
**Permission:** `device.read`

Response:

```json
{
  "success": true,
  "data": {
    "deviceId": "water-node-001",
    "connectionStatus": "OFFLINE",
    "reasonCode": "HEARTBEAT_TIMEOUT",
    "lastSeenAt": "2026-07-27T14:00:00+07:00"
  }
}
```

---

# 17. Historical Monitoring Endpoints

> **Approved Rules (`DEC-MON-087`, `DEC-MON-048`, & `DEC-UIUX-104`):**
> - **Default Range:** Last 24 hours (`from` defaults to `now - 24 hours`, `to` defaults to `now`).
> - **Maximum Range:** 31 days (`to - from <= 31 days`). Range > 31 days returns HTTP 400 (`DATE_RANGE_EXCEEDED`).
> - **Data Retention Guarantee:** Raw telemetry is retained for 90 days (`DEC-MON-048` / `TASK-0913`), ensuring all allowable queries within the 31-day window are fully preserved and performant.
> - **Pagination:** Default `pageSize = 20`, Maximum `pageSize = 100`. `pageSize > 100` returns HTTP 400 (`VALIDATION_ERROR`). Default `page = 1`.
> - **Raw Bounded Query Contract:** API endpoints return raw bounded historical telemetry series without server-side downsampling. Client-side grouping (e.g. 1-hour interval bucket aggregation per `DEC-UIUX-104`) is executed purely at the presentation layer for chart visualization stability.
> - **Telemetry Isolation:** Water-quality history (`ph`, `tds`, `ec`) is separate from reservoir telemetry (`tankVolume`, `flowRate`).
> - **Identifier Resolution:** `{deviceId}` parameter accepts both canonical string `deviceId` (e.g. `soil-node-001`) and database UUID `id`.
> - **Empty History Response:** Queries matching zero records return HTTP `200 OK` with an empty `series: []` array and `totalRecords: 0`, NOT a 404 error or fabricated zero records.
> - **EC Unit Contract:** EC telemetry values in API contracts are stored and transmitted in source units (`mS/cm`). The web UI converts values to `µS/cm` (×1000) for presentation.

## 17.1 Get Soil History

```http
GET /api/v1/devices/{deviceId}/monitoring/soil/history
```

**Authentication:** Required
**Permission:** `monitoring.history.read`

Query parameters:

```text
from (ISO 8601 string, optional, default: now - 24h)
to (ISO 8601 string, optional, default: now)
metrics (comma-separated string, optional)
page (integer, optional, default: 1)
pageSize (integer, optional, default: 20, max: 100)
```

Example:

```http
GET /api/v1/devices/soil-node-001/monitoring/soil/history?from=2026-08-01T00:00:00Z&to=2026-08-02T00:00:00Z&metrics=nitrogen,ph,moisture&page=1&pageSize=20
```

Response:

```json
{
  "success": true,
  "data": {
    "deviceId": "soil-node-001",
    "from": "2026-08-01T00:00:00.000Z",
    "to": "2026-08-02T00:00:00.000Z",
    "series": [
      {
        "timestamp": "2026-08-01T14:00:00.000Z",
        "nitrogen": 45.2,
        "ph": 6.5,
        "moisture": 67.3
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalRecords": 1,
      "totalPages": 1
    }
  }
}
```

Missing intervals shall remain absent or use `null`, not zero.

---

## 17.2 Get Water History

```http
GET /api/v1/devices/{deviceId}/monitoring/water/history
```

Same requirements and pagination rules as soil history.

Supported metrics for water-quality:

```text
ph
tds
ec
```

---

## 17.3 Get Combined History

```http
GET /api/v1/devices/{deviceId}/monitoring/history
```

**Status:** Removed / Unused (`DEC-MON-087`).
Domain telemetry endpoints (`/soil/history` and `/water/history`) are used independently. Combined history endpoint is not provided.

---

## 17.4 Export Monitoring Data

```http
GET /api/v1/devices/{deviceId}/monitoring/export
```

**Authentication:** Required
**Permission:** `monitoring.export`
**Status:** `TBD`

Query:

```text
from
to
type
format
```

Possible format:

```text
csv
```

Exported canonical values and locale policy remain `TBD`.

---

# 18. Faucet Command Endpoints (API-CTRL-001..API-CTRL-002)

## 18.1 Create Faucet Command

```http
POST /api/v1/devices/{deviceId}/faucet-commands
```

**Authentication:** Required
**Permission:** `device.control.dispense`
**Resource check:** Device access and `canControl`

Required header:

```http
Idempotency-Key: 8cc305b7-2867-4f76-af05-e6859776429e
```

Request:

```json
{
  "action": "DISPENSE",
  "phase": 2,
  "plantCount": 1
}
```

Header:
```http
Idempotency-Key: cmd-9c8f50c6-835d-4a54-b876-b481658a50c6
```

The client shall not send arbitrary target volume as authoritative.

Server mapping for DISPENSE:

```text
Target Volume = (Phase Preset) × (Plant Count)
1 → 300 mL * plantCount
2 → 1,000 mL * plantCount
3 → 1,500 mL * plantCount
```

If `action` is `OPEN` or `CLOSE`, `phase` and `plantCount` must be omitted/null.

Server validation:

1. Active session.
2. Active account.
3. Control permission (`device.control.dispense`).
4. Feature flag enabled (`ENABLE_FAUCET_CONTROL=true`).
5. Device assignment.
6. Device capability `FAUCET_CONTROL`.
7. Device is active.
8. Device is online and controllable.
9. Valid phase and plantCount for DISPENSE, or strictly null for OPEN/CLOSE (`TASK-0802`).
10. No prohibited active command.
11. Valid `Idempotency-Key` header.

Successful response:

```http
202 Accepted
```

```json
{
  "success": true,
  "data": {
    "commandId": "cmd-01JXYZ123",
    "deviceId": "water-node-001",
    "action": "DISPENSE",
    "phase": 2,
    "plantCount": 1,
    "targetVolumeMl": 1000,
    "status": "QUEUED",
    "requestedAt": "2026-07-27T14:30:00+07:00",
    "expiresAt": "2026-07-27T14:30:30+07:00"
  }
}
```

Possible errors:

```text
VALIDATION_ERROR
CONTROL_PERMISSION_DENIED
DEVICE_ACCESS_DENIED
DEVICE_OFFLINE
DEVICE_NOT_CONTROLLABLE
ACTIVE_COMMAND_EXISTS
INVALID_PHASE
DUPLICATE_COMMAND
GATEWAY_UNAVAILABLE
```

---

## 18.2 List Faucet Commands for Device

```http
GET /api/v1/devices/{deviceId}/faucet-commands
```

**Authentication:** Required
**Permission:** `device.control.history.read`

Query parameters:

```text
page
pageSize
status
from
to
initiatedBy
```

---

## 18.3 Get Faucet Command

```http
GET /api/v1/devices/{deviceId}/faucet-commands/{commandId}
```

**Authentication:** Required
**Permission:** `device.control.history.read`

Response:

```json
{
  "success": true,
  "data": {
    "commandId": "cmd-01JXYZ123",
    "deviceId": "water-node-001",
    "phase": 2,
    "targetVolumeMl": 1000,
    "actualVolumeMl": 1008,
    "status": "COMPLETED",
    "initiatedBy": {
      "userId": "user-002",
      "role": "ADMIN"
    },
    "requestedAt": "2026-07-27T14:30:00+07:00",
    "sentAt": "2026-07-27T14:30:01+07:00",
    "acknowledgedAt": "2026-07-27T14:30:02+07:00",
    "completedAt": "2026-07-27T14:30:18+07:00"
  }
}
```

---

## 18.4 Get Faucet Command Events

```http
GET /api/v1/devices/{deviceId}/faucet-commands/{commandId}/events
```

**Authentication:** Required
**Permission:** `device.control.history.read`

---

## 18.5 Manual OPEN Faucet Command

```http
POST /api/v1/devices/{deviceId}/faucet-commands/{commandId}/cancel
```

**Authentication:** Required
**Permission:** `device.control`
**Status:** `TBD`

Request:

```json
{
  "reason": "User requested cancellation"
}
```

The API shall not report `CANCELLED` until the device or gateway confirms the final state.

---

## 18.6 Manual CLOSE Faucet Command

```http
POST /api/v1/devices/{deviceId}/faucet-commands/{commandId}/stop
```

**Authentication:** Required
**Permission:** `device.control`
**Status:** `TBD`

This endpoint is reserved for explicit stop or emergency-stop behaviour if supported.

---

# 19. Alert Endpoints (API-ALERT-001..API-ALERT-002)

## 19.1 List Alerts

```http
GET /api/v1/alerts
```

**Authentication:** Required
**Permission:** `alert.read`

The server shall return only alerts within the user's scope.

Query parameters:

```text
page
pageSize
deviceId
severity
status
alertType
from
to
```

Response item:

```json
{
  "id": "alert-001",
  "deviceId": "water-node-001",
  "alertType": "DEVICE_OFFLINE",
  "severity": "CRITICAL",
  "status": "OPEN",
  "titleKey": "alerts.deviceOffline.title",
  "messageKey": "alerts.deviceOffline.message",
  "messageParams": {
    "deviceName": "Water Node 1"
  },
  "openedAt": "2026-07-27T14:00:00+07:00"
}
```

The frontend shall translate `titleKey` and `messageKey`.

---

## 19.2 Get Alert

```http
GET /api/v1/alerts/{alertId}
```

**Authentication:** Required
**Permission:** `alert.read`

---

## 19.3 Acknowledge Alert

```http
POST /api/v1/alerts/{alertId}/acknowledge
```

**Authentication:** Required
**Permission:** `alert.acknowledge`

Request:

```json
{
  "note": "Checked by field operator"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "alertId": "alert-001",
    "status": "ACKNOWLEDGED",
    "acknowledgedAt": "2026-07-27T14:40:00+07:00"
  }
}
```

Admin acknowledgement permission is permitted for assigned devices in accordance with `RBAC.md`.

---

# 20. Audit Endpoints (API-AUDIT-001)

## 20.1 List Audit Logs

```http
GET /api/v1/audit-logs
```

**Authentication:** Required
**Permission:** `audit.read`

Query parameters:

```text
page
pageSize
eventKey
actorUserId
targetType
targetId
result
from
to
```

Response item:

```json
{
  "id": "audit-001",
  "eventKey": "account.approved",
  "actorUserId": "owner-001",
  "actorRole": "OWNER",
  "targetType": "USER",
  "targetId": "user-002",
  "result": "SUCCESS",
  "createdAt": "2026-07-27T14:10:00+07:00",
  "metadata": {}
}
```

Audit logs shall not expose:

- Passwords.
- Password hashes.
- Session tokens.
- Device credentials.
- Private keys.

---

## 20.2 Get Audit Log

```http
GET /api/v1/audit-logs/{auditId}
```

**Authentication:** Required
**Permission:** `audit.read`

---

## 20.3 Export Audit Logs

```http
GET /api/v1/audit-logs/export
```

**Authentication:** Required
**Permission:** `audit.export`
**Status:** `TBD`

---

# 21. Site Endpoints

Sites are recommended but remain optional for version 1.

## 21.1 List Sites

```http
GET /api/v1/sites
```

**Authentication:** Required
**Permission:** `device.read`

---

## 21.2 Get Site

```http
GET /api/v1/sites/{siteId}
```

---

## 21.3 Create Site

```http
POST /api/v1/sites
```

**Permission:** `settings.system.update` or dedicated permission
**Status:** `TBD`

---

# 22. Real-Time Endpoints

## 22.1 Monitoring Event Stream

Recommended SSE endpoint:

```http
GET /api/v1/realtime/stream
```

**Authentication:** Required

Optional query parameters:

```text
deviceId
channels
```

Example:

```http
GET /api/v1/realtime/stream?deviceId=water-node-001&channels=telemetry,status,alerts,commands
```

Supported event names:

```text
telemetry.soil.updated
telemetry.water.updated
device.status.updated
alert.created
alert.updated
faucet.command.updated
access.revoked
session.expired
```

Example SSE event:

```text
event: faucet.command.updated
data: {"commandId":"cmd-01JXYZ123","deviceId":"water-node-001","status":"IN_PROGRESS"}
```

Security rules:

- Validate session before connection.
- Verify device access.
- Filter every outgoing event.
- Terminate stream after session expiry.
- Stop events after access revocation.
- Do not expose MQTT topics or credentials.

The final live-update transport remains `TBD`.

---

# 23. Internal Gateway API

If the IoT gateway runs as a separate service, internal endpoints may be used.

These endpoints shall not be publicly accessible.

## 23.1 Submit Device Command

```http
POST /internal/v1/device-commands
```

Request:

```json
{
  "commandId": "cmd-01JXYZ123",
  "deviceId": "water-node-001",
  "action": "DISPENSE",
  "phase": 2,
  "plantCount": 1,
  "targetVolumeMl": 1000,
  "requestedAt": "2026-07-27T14:30:00+07:00",
  "expiresAt": "2026-07-27T14:30:30+07:00"
}
```

The internal service shall verify caller identity.

## 23.2 Gateway Health

```http
GET /internal/v1/health
Authorization: Bearer <INTERNAL_SERVICE_TOKEN>
```

Response:

```json
{
  "status": "ok"
}
```

## 23.3 Gateway Readiness

```http
GET /internal/v1/ready
Authorization: Bearer <INTERNAL_SERVICE_TOKEN>
```

Response:

```json
{
  "status": "ready",
  "dependencies": {
    "database": "up",
    "broker": "up"
  }
}
```

Web readiness probes query `GET /internal/v1/ready` over internal HTTP(S) via `INTERNAL_GATEWAY_URL` using `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>` with default timeout `INTERNAL_GATEWAY_TIMEOUT_MS=2000` per `DEC-INF-078`. Caller identity is validated via the bearer token.

---

# 24. Health Endpoints

## 24.1 Liveness

```http
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

Liveness should not fail merely because an external dependency is temporarily unavailable.

## 24.2 Readiness

```http
GET /ready
```

Response:

```json
{
  "status": "ready",
  "dependencies": {
    "database": "up",
    "gateway": "up",
    "broker": "up"
  }
}
```

Readiness determines whether the service can safely receive traffic.

---

# 25. Pagination

Recommended parameters:

```text
page
pageSize
```

Defaults:

```text
page = 1
pageSize = 20
```

Maximum page size:

```text
TBD
```

Recommended maximum:

```text
100
```

Response:

```json
{
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 125,
    "totalPages": 7
  }
}
```

Cursor pagination may be introduced for high-volume telemetry and audit logs.

---

# 26. Sorting and Filtering

Sorting format:

```text
sort=createdAt:desc
```

Allowed fields shall be endpoint-specific.

The server shall reject arbitrary database column names.

Search parameters shall be bounded and sanitised.

---

# 27. Rate Limiting

Rate limiting shall apply to:

- Login.
- Registration.
- Forgot password.
- Password reset.
- Approval actions.
- Faucet-control creation.
- Faucet cancel/stop.
- Audit export.
- Historical exports.

Exact limits remain `TBD`.

Faucet-control endpoints require stricter rate and duplicate protection than monitoring reads.

---

# 28. Idempotency

## 28.1 Required Endpoints

Idempotency is required for:

```text
POST /devices/{deviceId}/faucet-commands
```

It is recommended for:

- Account approval.
- Account rejection.
- Device assignment.
- Alert acknowledgement.

## 28.2 Header

```http
Idempotency-Key: <unique-key>
```

Rules:

- The server stores the key with request identity and result.
- The same key with the same payload returns the existing result.
- The same key with a different payload returns `409 Conflict`.
- Keys expire according to a retention policy.

---

# 29. Concurrency Control

The API should use optimistic or transactional concurrency for:

- Account approval.
- Account rejection.
- User status changes.
- Device assignments.
- Faucet command creation.
- Alert acknowledgement.

Possible mechanisms:

- Database row locks.
- Version fields.
- State comparison in transaction.
- Unique partial indexes.

---

# 30. Caching

Read endpoints may use safe caching.

Protected API responses shall not be cached publicly.

Recommended headers:

```http
Cache-Control: private, no-store
```

for:

- Authentication.
- User profilees.
- Approvals.
- Faucet commands.
- Audit logs.

Monitoring reads may use short private caching when consistent with freshness requirements.

---

# 31. Localisation Rules

The API shall:

- Return canonical enums.
- Return stable error codes.
- Return ISO timestamps.
- Return raw numeric values.
- Return translation keys where content is system-defined.
- Store and return the user's locale preference.

The API shall not:

- Translate property names.
- Translate MQTT fields.
- Translate role codes.
- Translate statuses.
- Format numeric values as locale strings.
- Format dates as user-facing text.

Example:

Correct:

```json
{
  "status": "COMPLETED",
  "targetVolumeMl": 1000
}
```

Incorrect:

```json
{
  "status": "Selesai",
  "targetVolumeMl": "1.000 mL"
}
```

---

# 32. Security Requirements

The API shall:

- Require HTTPS in production.
- Use secure authentication.
- Enforce server-side RBAC.
- Enforce device-level access.
- Validate every request.
- Use parameterised queries or ORM.
- Protect against CSRF where cookie sessions are used.
- Protect against brute-force login.
- Protect against mass assignment.
- Prevent role injection.
- Prevent status injection.
- Prevent object-level authorisation bypass.
- Redact secrets from logs.
- Use secure headers.
- Limit request body size.
- Reject unsupported content types.
- Generate request correlation IDs.

---

# 33. Mass-Assignment Protection

The server shall explicitly select editable fields.

For example, `PATCH /me` shall accept:

```text
fullName
```

and reject:

```text
role
accountStatus
deviceAssignments
passwordHash
createdAt
```

The server shall not map request bodies directly onto database entities.

---

# 34. Request Validation

Validation shall cover:

- Required fields.
- Types.
- String length.
- Enum membership.
- Date syntax.
- Date range.
- Coordinate ranges.
- Pagination bounds.
- Supported locale.
- Device existence.
- Device access.
- Command state.

Validation failures shall use machine-readable details:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "fields": {
        "email": "INVALID_EMAIL"
      }
    }
  }
}
```

---

# 35. OpenAPI Documentation

The implementation should generate an OpenAPI 3.1 document.

Recommended route:

```http
GET /api/openapi.json
```

Interactive API documentation may be available only in development or protected internal environments.

The OpenAPI document shall describe:

- Schemas.
- Parameters.
- Responses.
- Authentication.
- Error codes.
- Permissions.
- Idempotency headers.

---

# 36. API Testing Requirements

## 36.1 Authentication Tests

- Successful Owner login.
- Successful active Admin login.
- Pending Admin denied.
- Rejected Admin denied.
- Suspended Admin denied.
- Deactivated Admin denied.
- Invalid credentials.
- Session expiry.
- Logout revokes session.

## 36.2 RBAC Tests

- Owner can approve Admin.
- Admin cannot approve Admin.
- Owner can edit another user.
- Admin cannot edit another user.
- Admin cannot change own role.
- Admin cannot change own account status.
- Device access is enforced.
- Language change does not affect permissions.

## 36.3 Device Tests

- List only authorised devices.
- Unauthorised device ID denied.
- Inactive device blocks control.
- Device assignment and revocation work.
- Admin cannot self-assign.

## 36.4 Monitoring Tests

- Latest soil reading.
- Latest water reading.
- Empty monitoring data.
- Null values remain null.
- Zero values remain zero.
- Historical range validation.
- Device history isolation.
- Stale data representation.

## 36.5 Faucet Tests

- Phase 1 maps to 300 mL.
- Phase 2 maps to 1,000 mL.
- Phase 3 maps to 1,500 mL.
- Arbitrary target volume ignored or rejected.
- Missing permission denied.
- Unauthorised device denied.
- Offline device rejected.
- Duplicate idempotency key returns existing command.
- Same key with different payload returns conflict.
- Completed, failed, and timeout states returned correctly.

## 36.6 Alert Tests

- User sees only scoped alerts.
- Owner acknowledgement.
- Admin acknowledgement according to policy.
- Duplicate acknowledgement conflict or idempotent response.

## 36.7 Security Tests

- Object-level authorisation bypass.
- Role injection.
- Account-status injection.
- SQL injection.
- CSRF.
- Brute-force login.
- Oversized request.
- Unsupported content type.
- Sensitive error leakage.

---

# 37. API Acceptance Criteria

The API is accepted when:

1. All protected endpoints require authentication.
2. Only `ACTIVE` accounts access protected resources.
3. Public registration creates only pending Admin accounts.
4. Owner approval and rejection are transactional.
5. Admins cannot manage other users.
6. Device-level access is enforced.
7. Monitoring and control permissions remain separate.
8. Device lists are scoped to the authenticated user.
9. Monitoring responses preserve null and zero semantics.
10. Historical queries are bounded.
11. Faucet phases map to fixed server-side volumes.
12. Faucet command creation is idempotent.
13. The API does not expose MQTT credentials.
14. The API does not return translated canonical values (frontend presentation translation is decoupled via `next-intl` namespaces, `TASK-0603`).
15. Error codes are stable and machine-readable.
16. Request validation rejects unsupported fields.
17. High-risk operations create audit records.
18. Real-time streams are authenticated and filtered.
19. OpenAPI documentation is generated.
20. Authentication, RBAC, monitoring, control, and security tests pass.

---

# 38. Open Decisions

1. Cookie session versus bearer token.
2. Authentication library.
3. Password policy.
4. Forgot-password workflow.
5. Email verification.
6. `APPROVED` versus `ACTIVE`.
7. Multiple Owner policy.
8. Device creation permissions.
9. Device update permissions.
10. Owner device scope.
11. Admin faucet-control permission.
12. Admin alert acknowledgement.
13. Export permissions.
14. Maximum page size.
15. Historical query limits.
16. Realtime transport.
17. ~~Web-to-gateway communication method.~~ **RESOLVED** — Internal HTTP probe via `INTERNAL_GATEWAY_URL` with `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>` and default 2000ms timeout (`DEC-INF-078`, `TASK-0905`).
18. Rate limits.
19. Idempotency retention.
20. Command concurrency.
21. Cancel and stop support.
22. Audit export.
23. Site endpoints.
24. Locale default and fallback.
25. API documentation visibility.
26. External client support.
27. API token support.
28. Version deprecation policy.

---

# 39. Conflicts and Gaps Found

1. The final authentication mechanism is not selected.
2. The activation workflow after Owner approval remains unresolved.
3. Faucet-control permissions for Owner and Admin are not final.
4. ~~Admin alert acknowledgement is unresolved.~~ **RESOLVED** — Admin alert acknowledgement is permitted for assigned devices (`alert.acknowledge`) per `RBAC.md`.
5. Device-management permissions are unresolved.
6. Historical export and retention rules are not final.
7. The real-time transport is not final.
8. ~~The gateway integration method is not final.~~ **RESOLVED** — Web-to-gateway internal health and readiness probe protocol defined and implemented per `DEC-INF-078` (`TASK-0905`).
9. Command cancellation and stop behaviour remain unresolved.
10. ~~`Water BAT` semantics.~~ **RESOLVED** — `BAT` parameter is removed completely from soil and water quality monitoring (`DEC-MON-086`, superseding `DEC-MON-085`).

---

## Monitoring and API Implementation Note (Reconciled 2026-08-19)

The following facts are supported by the current implementation regarding device selection, routing, and monitoring resolution (`TASK-0306`, `TASK-0501`, `TASK-0503`, `TASK-0504`):
- **Frontend Selection/Context/URL:** Consistently uses immutable `devices.id` UUID in route params (`?deviceId=<UUID>`), navigation state, and monitoring fetch hooks.
- **Bare Routes:** Remain neutral with no auto-selection (`/`, `/sensor`, `/soil`, `/water`). Canonical routes are `/soil` and `/water` (legacy `/air` and `/tanah` routes return 404).
- **Identifier Resolution:** Monitoring API endpoints (`/monitoring/latest`, `/monitoring/soil/latest`, `/monitoring/water/latest`, `/monitoring/soil/history`, `/monitoring/water/history`) support transparent lookup by both internal database UUID and external canonical `deviceId` string.
- **Rehydration:** Valid `?deviceId=<UUID>` rehydrates after server authorization validation on hard refresh.
- **Invalid/Revoked IDs:** Clear selection safely to `null` with a notice banner.
- **Admin Privacy:** Admin canonical `deviceId` concealment remains strictly enforced.
- **Empty History Semantics:** Historical telemetry queries with zero records matching date filters return HTTP 200 with `{ series: [], pagination: { page: 1, pageSize: 20, totalRecords: 0, totalPages: 1 } }`, never HTTP 404 or fabricated data.
<!-- TASK-0802 Reconciled: 2026-08-19 -->

---

## Faucet Command Publishing and API Implementation Note (Reconciled 2026-08-20)

The following facts are supported by the verified implementation of `TASK-0804` (`CommandPublisher` in `@kebun-melon/iot-gateway`):
- **Status:** `DONE`.
- **Persisted Volume Passthrough:** For `DISPENSE` actions, the gateway publisher directly transmits the canonical `targetVolumeMl` integer persisted during `TASK-0803` API command creation without recalculating or modifying the value.
- **Payload Schema Conformance:** `DISPENSE` payloads carry valid `phase`, `plantCount >= 1`, and `targetVolumeMl`. `OPEN` and `CLOSE` command payloads omit `phase`, `plantCount`, and `targetVolumeMl` without fabricating placeholder values.
- **State Transition Integrity:** Only eligible unexpired `QUEUED` commands transition to `SENT` upon confirmed broker publication (QoS 1, `retain=false`). Failed publications remain `QUEUED` and are never marked `SENT`. Expired commands transition to `EXPIRED` without publishing.
- **Downstream Decoupling:** Downstream state machine tasks (`TASK-0806`) remain untouched.
<!-- TASK-0804 Reconciled: 2026-08-20 -->

---

## Device Acknowledgement Processing Implementation Note (Reconciled 2026-08-20)

The following facts are supported by the verified implementation of `TASK-0805` (`AcknowledgementProcessor` in `@kebun-melon/iot-gateway`):
- **Status:** `DONE`.
- **Authoritative Contract Compliance:** MQTT ACK payloads (`agriculture/{environment}/{siteId}/{deviceId}/ack/faucet`, QoS 1) identify commands strictly through `commandId` and device identity (`deviceId`) without fabricating an action field in the payload.
- **Persisted Command Action Validation:** Before applying state changes, the processor retrieves the persisted command and verifies its stored action is one of `DISPENSE`, `OPEN`, or `CLOSE`, safely rejecting unsupported actions.
- **State Transition Guard:** Accepted ACKs transition `SENT` → `ACKNOWLEDGED` only. Status is never transitioned to `COMPLETED` and physical state is never inferred during ACK processing. Rejected ACKs transition `SENT` → `FAILED` with canonical `reasonCode` and generate `CommandFailureAlert`.
- **Idempotency & Isolation:** Duplicate `messageId` occurrences are handled idempotently against stored event history; non-`SENT` / late / out-of-order ACKs are ignored without state regression; and `WATER_TANK_NODE` device type scoping is enforced.
- **Boundaries & Governance:** No schema migration, permission changes, UI redesign, or new security exceptions were introduced.
- **Targeted Automated Verification:**
  - ACK processor targeted unit tests (`apps/iot-gateway/src/__tests__/acknowledgement-processor.test.ts`): **25/25 tests passed (100%)**.
  - Full IoT Gateway test suites: **16 files, 195/195 tests passed (100%)**.
  - Contracts and database suites: **26 files, 228/228 tests passed (100%)**.
  - Monorepo static typecheck (`npm run typecheck`): **0 errors**.
  - Semgrep SAST security scan: **0 findings, 0 errors**.
- **Local In-Memory Performance Microbenchmark:**
  - Sequential (1,000 unique ACKs): 3,979.0 ACKs/sec, p50: 0.087 ms, p95: 0.297 ms, p99: 2.151 ms, 0 errors, 0 state regressions.
  - Burst (500 concurrent ACKs): 7,579.7 ACKs/sec, p50: 56.555 ms, p95: 63.893 ms, p99: 64.786 ms, 0 errors.
  - Repeated Duplicate (1,000 duplicate `messageId` ACKs): 5,887.7 ACKs/sec, p50: 0.048 ms, 0 redundant DB writes.
  - Short Soak (2,000 ACKs across 4 batches): 4,453.1 ACKs/sec, p50: 0.047 ms, stable heap (+1.10 MB).
  - *Note: These figures represent in-memory microbenchmarks of processor logic and do not measure full broker/database network system capacity.*
- **Staging / Credential Boundary:** Live MQTT over TLS and physical hardware end-to-end verification remains credential/manual dependent and is not claimed complete.
- **Downstream Decoupling:** Downstream command event state machine transitions (`TASK-0806`), duplicate command protection (`TASK-0808`), and timeout processing (`TASK-0809`) remain decoupled.
<!-- TASK-0805 Reconciled: 2026-08-20 -->

---

## Command Event State Machine Implementation Note (Reconciled 2026-08-20)

The following facts are supported by the verified implementation of `TASK-0806` (`FaucetEventProcessor` in `@kebun-melon/iot-gateway`):
- **Status:** `DONE`.
- **Command Event Processing:** Subscribes to canonical faucet execution event topics (`agriculture/{environment}/{siteId}/{deviceId}/event/faucet`, QoS 1). Resolves commands via `commandId` and `deviceId` and validates the persisted action is one of `DISPENSE`, `OPEN`, or `CLOSE`.
- **State Machine Transitions:** Enforces `ACKNOWLEDGED` → `IN_PROGRESS` → `COMPLETED`, and `ACKNOWLEDGED`/`IN_PROGRESS` → `FAILED`. Terminal states (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `EXPIRED`) are strictly immutable and ignore late events without regression.
- **Authoritative Physical Faucet State:** Derived strictly from verified final execution events:
  - `COMPLETED OPEN` → `OPEN`
  - `COMPLETED CLOSE` → `CLOSED`
  - `COMPLETED DISPENSE` → `UNKNOWN` (valve closure is never assumed without direct physical confirmation)
  - `FAILED` / `IN_PROGRESS` / timeout / uncertain → `UNKNOWN`
  - Physical state is NEVER inferred from API acceptance, publication, or ACK.
- **Volume Handling Rules:** `DISPENSE` validates target volume parity if provided and tracks non-negative `actualVolumeMl`. `OPEN` and `CLOSE` treat volume measurement as non-applicable and store `null`/`undefined` in the command record.
- **Duplicate Idempotency:** Duplicate `messageId` events are matched against stored event history and safely ignored without invoking database writes.
- **Alert Dispatching:** Generates `CommandFailureAlert` on `FAILED` execution events linking device, command, and `physicalOutcome: 'UNKNOWN'`.
- **Targeted Automated Verification:**
  - Targeted unit tests (`apps/iot-gateway/src/__tests__/faucet-event-processor.test.ts`, `apps/iot-gateway/src/__tests__/device-simulator.test.ts`): **55/55 tests passed (100%)**.
  - Full IoT Gateway test suites: **16 files, 210/210 tests passed (100%)**.
  - Monorepo static typecheck (`npm run typecheck`): **0 errors**.
- **Local In-Memory Performance Sanity Benchmark:**
  - Evaluated 7,500 events across 4 scenarios (1,000 sequential: 4,609 ops/s, 500 burst: 4,178 ops/s, 1,000 duplicate: 7,334 ops/s, 5,000 soak: 3,422 ops/s).
  - Safety invariants verified: 0 state regressions, 0 terminal mutations, 0 duplicate redundant writes, 0 unexpected errors, heap delta +7.02 MB.
  - Performance targets remain TBD; results serve solely as an in-memory logic benchmark.
- **Testing Boundaries:** Live local faucet MQTT E2E was not completed because the local Mosquitto test fixture lacks a matching `WATER_TANK_NODE` credential/ACL identity; live MQTT TLS and HIL validation remain reserved for manual execution with staging credentials.
<!-- TASK-0806 Reconciled: 2026-08-20 -->

### `TASK-0808` Duplicate Command Protection Implementation Summary

- **Semantic Duplicate Detection:** Added explicit logic to `createCommand` to detect duplicate physical intent (e.g. issuing two `DISPENSE` commands with the same parameters on the same device, or two `OPEN` commands).
- **Concurrency Rejection:** Retains strict "max 1 active command per device" check. Concurrent commands with identical intent correctly yield an HTTP 409 Conflict with a specific `Duplicate command` message, instead of the generic concurrency rejection.
- **Idempotency Adherence:** Strict idempotency checks retained. Exact identical keys and payloads return the existing command; same key but different payloads yield 409 Conflict.
- **Scope Limit:** Fixing the underlying millisecond-level race condition by changing database isolation or adding unique indices remains out of scope, per the decoupled nature of these checks.
- **Verification:** Supported by robust test suites covering `FaucetCommandRepository` (21 unit tests) and API routing logic (31 unit tests), ensuring the correct status codes and conflict behavior across all actions.

<!-- TASK-0808 Reconciled: 2026-08-20 -->

---

## Centralized Authentication State Hydration API Note (Reconciled 2026-08-22)

The following facts are supported by the verified implementation of `TASK-0215` (Centralized Authentication State Hydration):
- **Server Component Session Helper:** Created `getSessionOrNull()` in `apps/web/lib/auth/rbac.ts` allowing Server Components (specifically `RootLayout`) to retrieve the authenticated session (`AuthenticatedUserSession`) during SSR without throwing 401 exceptions.
- **Client Session Endpoint Optimization:** Redundant client-side calls to `GET /api/v1/auth/session` on page component mounts have been eliminated, as the root layout hydrates session state directly via `AuthContext`.
- **API Security Unchanged:** The `GET /api/v1/auth/session` endpoint remains available and functional for client-initiated session verification if needed. All protected REST endpoints continue to enforce strict server-side authentication and authorization.
<!-- TASK-0215 Reconciled: 2026-08-22 -->

---

## Controls Loading Experience & Header Alignment API Note (Reconciled 2026-08-27)

The verified implementation of `TASK-0807`, `TASK-0502`, and `TASK-0306` (`/controls` Loading & Header Layout Stabilization on 2026-08-27) operates strictly within frontend presentation components:
- **Client Request Optimization:** `FaucetControlPanel` consumes centralized `useAuth()`, eliminating redundant client-side `GET /api/v1/auth/session` calls upon mounting `/controls`.
- **API Contracts Unchanged:** Zero modifications were made to REST API route signatures, request schemas, response formats, idempotency headers, or status codes across `/api/v1/devices/*`, `/api/v1/monitoring/*`, or `/api/v1/auth/*`.
<!-- Controls Loading & Header Centering API Reconciled: 2026-08-27 -->

---

## Faucet Command Lifecycle Regression & Event Append API Note (Reconciled 2026-09-01)

The following facts are supported by the verified implementation of the Faucet Command Lifecycle regression hardening (`TASK-0806`, `TASK-0807`):
- **API Contracts Unchanged:** REST endpoints `GET /api/v1/devices/{deviceId}/faucet-commands` and `GET /api/v1/devices/{deviceId}/faucet-commands/{commandId}` retain exact JSON schemas, pagination formats, and status codes.
- **Append-Only Event Store Integrity:** The `events` array in `FaucetCommandDto` returns the ordered history of lifecycle milestones. Multiple `IN_PROGRESS` events prior to `COMPLETED` represent intermediate progress milestones (e.g. incremental volume telemetry) and are valid.
- **Terminal State Immuntability:** Non-terminal progress events arriving after the command reaches a terminal status (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `EXPIRED`) are strictly rejected at the database repository and ignored by the gateway event processor, ensuring the returned `events` array never exhibits post-completion state regression.
<!-- Faucet Command Lifecycle Regression API Reconciled: 2026-09-01 -->

