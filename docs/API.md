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
- Owner and Admin profile management.
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

Note: Reservoir-water telemetry (volume & flow rate) is ingested separately via MQTT/EMQX through the IoT Gateway service, not through the REST API. Shared sensor battery (`BAT`) is sent via REST over Wi-Fi (exact REST payload field placement `TBD`).

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

Account-state errors:

```text
ACCOUNT_PENDING_APPROVAL
ACCOUNT_APPROVED_NOT_ACTIVE
ACCOUNT_REJECTED
ACCOUNT_SUSPENDED
ACCOUNT_DEACTIVATED
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

Server actions:

- Revoke or invalidate the current session.
- Record logout where configured.

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
**Permission:** `profile.password.update.self`

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

Open decisions:

- Whether all sessions are revoked after password change.
- Password policy.
- Multi-factor authentication.

---

## 10.6 Forgot Password

```http
POST /api/v1/auth/forgot-password
```

**Authentication:** Public  
**Status:** `TBD`

Request:

```json
{
  "email": "admin@example.com"
}
```

Response shall not reveal whether the account exists.

---

## 10.7 Reset Password

```http
POST /api/v1/auth/reset-password
```

**Authentication:** Reset token  
**Status:** `TBD`

Request:

```json
{
  "token": "reset-token",
  "newPassword": "new-secure-password",
  "newPasswordConfirmation": "new-secure-password"
}
```

---

# 11. Current User Endpoints

## 11.1 Get Current User

```http
GET /api/v1/me
```

**Authentication:** Required  
**Permission:** `profile.self.read`

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

## 11.2 Update Current User Profile

```http
PATCH /api/v1/me
```

**Authentication:** Required  
**Permission:** `profile.self.update`

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

# 12. User Management Endpoints

All endpoints in this section are Owner-only unless explicitly stated.

## 12.1 List Users

```http
GET /api/v1/users
```

**Authentication:** Required  
**Permission:** `profile.other.read`

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
**Permission:** `profile.other.read`

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
**Permission:** `profile.other.update`

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

## 12.6 Deactivate User

```http
POST /api/v1/users/{userId}/deactivate
```

**Authentication:** Required  
**Permission:** `account.deactivate`

Request:

```json
{
  "reason": "Account no longer required"
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

1. Verify current status is `PENDING_APPROVAL`.
2. Prevent duplicate/conflicting decisions.
3. Update to `APPROVED` or `ACTIVE`.
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

Response status:

```text
REJECTED
```

---

# 14. Device Endpoints

## 14.1 List Authorised Devices

```http
GET /api/v1/devices
```

**Authentication:** Required  
**Permission:** `device.read`

The server shall return only authorised devices.

Query parameters:

```text
page
pageSize
siteId
deviceType
connectionStatus
search
```

Response item:

```json
{
  "id": "device-db-uuid",
  "deviceId": "water-node-001",
  "name": "Water Node 1",
  "siteId": "site-01",
  "deviceType": "WATER_NODE",
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
**Permission:** `device.read`  
**Resource check:** Device access required

---

## 14.3 Create Device

```http
POST /api/v1/devices
```

**Authentication:** Required  
**Permission:** `device.create`  
**Status:** `TBD`

Request:

```json
{
  "deviceId": "water-node-002",
  "name": "Water Node 2",
  "siteId": "site-01",
  "deviceType": "WATER_NODE",
  "capabilities": [
    "WATER_TELEMETRY",
    "FAUCET_CONTROL"
  ]
}
```

Device credentials shall not be returned through normal device listing endpoints.

---

## 14.4 Update Device

```http
PATCH /api/v1/devices/{deviceId}
```

**Authentication:** Required  
**Permission:** `device.update`  
**Status:** `TBD`

---

## 14.5 Deactivate Device

```http
POST /api/v1/devices/{deviceId}/deactivate
```

**Authentication:** Required  
**Permission:** `device.deactivate`

The system shall prevent new faucet commands after deactivation.

---

## 14.6 List Device Capabilities

```http
GET /api/v1/devices/{deviceId}/capabilities
```

**Authentication:** Required  
**Permission:** `device.read`

---

# 15. Device Assignment Endpoints

## 15.1 List User Device Assignments

```http
GET /api/v1/users/{userId}/devices
```

**Authentication:** Required  
**Permission:** `device.assign` or `profile.other.read`

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

**Resource check:** Device access required

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
      "battery": 82,
      "latitude": -6.2001,
      "longitude": 106.8168,
      "status": "NORMAL",
      "tankVolume": 75.0,
      "flowRate": 2.3,
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

---

## 16.3 Get Latest Water Reading

```http
GET /api/v1/devices/{deviceId}/monitoring/water/latest
```

**Authentication:** Required  
**Permission:** `monitoring.current.read`

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

## 17.1 Get Soil History

```http
GET /api/v1/devices/{deviceId}/monitoring/soil/history
```

**Authentication:** Required  
**Permission:** `monitoring.history.read`

Query parameters:

```text
from
to
metrics
interval
page
pageSize
```

Example:

```http
GET /api/v1/devices/water-node-001/monitoring/soil/history?from=2026-07-01T00:00:00%2B07:00&to=2026-07-27T23:59:59%2B07:00&metrics=nitrogen,ph,moisture&interval=hour
```

Response:

```json
{
  "success": true,
  "data": {
    "deviceId": "soil-node-001",
    "from": "2026-07-01T00:00:00+07:00",
    "to": "2026-07-27T23:59:59+07:00",
    "interval": "hour",
    "series": [
      {
        "timestamp": "2026-07-27T14:00:00+07:00",
        "nitrogen": 45.2,
        "ph": 6.5,
        "moisture": 67.3
      }
    ]
  }
}
```

Missing intervals shall remain absent or use `null`, not zero.

---

## 17.2 Get Water History

```http
GET /api/v1/devices/{deviceId}/monitoring/water/history
```

Same requirements as soil history.

Supported metrics may include:

```text
ph
tds
ec
battery
latitude
longitude
tankVolume
flowRate
```

---

## 17.3 Get Combined History

```http
GET /api/v1/devices/{deviceId}/monitoring/history
```

Status: Optional.

Use only when the frontend benefits from one combined endpoint.

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
  "phase": 2
}
```

The client shall not send arbitrary target volume as authoritative.

Server mapping:

```text
1 → 300 mL
2 → 1,000 mL
3 → 1,500 mL
```

Server validation:

1. Active session.
2. Active account.
3. Control permission.
4. Device assignment.
5. Device capability `FAUCET_CONTROL`.
6. Device is active.
7. Device is online and controllable.
8. Valid phase.
9. No prohibited active command.
10. Valid idempotency key.

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
    "phase": 2,
    "targetVolumeMl": 1000,
    "status": "QUEUED",
    "requestedAt": "2026-07-27T14:30:00+07:00",
    "expiresAt": "2026-07-27T14:30:30+07:00"
  }
}
```

Possible errors:

```text
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

## 18.5 Cancel Faucet Command

```http
POST /api/v1/devices/{deviceId}/faucet-commands/{commandId}/cancel
```

**Authentication:** Required  
**Permission:** `device.control.cancel`  
**Status:** `TBD`

Request:

```json
{
  "reason": "User requested cancellation"
}
```

The API shall not report `CANCELLED` until the device or gateway confirms the final state.

---

## 18.6 Stop Faucet Command

```http
POST /api/v1/devices/{deviceId}/faucet-commands/{commandId}/stop
```

**Authentication:** Required  
**Permission:** `device.control.stop`  
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

Admin acknowledgement permission remains `TBD`.

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
  "targetVolumeMl": 1000,
  "requestedAt": "2026-07-27T14:30:00+07:00",
  "expiresAt": "2026-07-27T14:30:30+07:00"
}
```

The internal service shall verify caller identity.

## 23.2 Gateway Health

```http
GET /internal/v1/health
```

## 23.3 Gateway Readiness

```http
GET /internal/v1/ready
```

The exact web-to-gateway communication method remains `TBD`.

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
- User profiles.
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
14. The API does not return translated canonical values.
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
17. Web-to-gateway communication method.
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
4. Admin alert acknowledgement is unresolved.
5. Device-management permissions are unresolved.
6. Historical export and retention rules are not final.
7. The real-time transport is not final.
8. The gateway integration method is not final.
9. Command cancellation and stop behaviour remain unresolved.
10. Exact sensor units and `Water BAT` semantics remain outside this API contract until confirmed.
