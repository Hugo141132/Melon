# Product Requirements Document (PRD)

## 1. Document Information

| Item | Description |
|---|---|
| Product | Web-Based Soil and Water Monitoring and Faucet Control System |
| Document | Product Requirements Document |
| Version | 1.0 |
| Status | Initial specification |
| Primary users | Owner and Admin |
| Hardware context | ESP32/NodeMCU devices |
| Frontend reference | Existing frontend source code, `FRONTEND_AUDIT.md`, and `UI_UX.md` |
| Default language | Bahasa Indonesia (`id`) (Fallback: English / `en`) |
| Supported languages | English and Bahasa Indonesia |

---

## 2. Product Overview

The product is a web-based application used to monitor soil and water conditions from multiple ESP32/NodeMCU devices and to send water-faucet control commands to selected devices.

The website acts as the communication and management interface between authorised users and the hardware system. Sensor design, calibration, measurement logic, and physical hardware implementation are managed by a separate hardware team and are outside the scope of this product.

The application must preserve the existing frontend design. New pages, components, states, and workflows must follow the visual and interaction standards defined in `FRONTEND_AUDIT.md` and `UI_UX.md`.

---

## 3. Problem Statement

Users require a secure and centralised interface to:

- Monitor soil and water measurements from multiple field devices.
- Identify whether devices are online, offline, normal, warning, or critical.
- Review current and historical monitoring data.
- Select a device and issue a predefined water-faucet command.
- Manage user access through Owner and Admin roles.
- Prevent unapproved Admin accounts from accessing the website.
- Use the application in English or Bahasa Indonesia.

Without a centralised web application, monitoring data, device status, user access, and faucet-control activity cannot be managed consistently across multiple devices.

---

## 4. Product Objectives

The product shall:

1. Provide authenticated access to the monitoring system.
2. Support multiple ESP32/NodeMCU devices.
3. Display the latest soil and water data for a selected device.
4. Display current device connectivity and status.
5. store and present historical monitoring data.
6. Allow authorised users to send predefined faucet-control commands.
7. Record all faucet-control activity and outcomes.
8. Enforce Owner and Admin permissions.
9. Require Owner approval before a newly registered Admin can access the application.
10. Provide English and Bahasa Indonesia interface options.
11. Preserve the existing frontend design and reusable components.
12. Keep website functionality separate from hardware measurement implementation.

---

## 5. Target Users

### 5.1 Owner (PRD-FR-013)

The Owner is the highest-authority application user.

The Owner shall be able to:

- Log in to the application.
- View all devices that fall within the Owner's authorised scope.
- View current and historical monitoring data.
- Access faucet-control functions according to the final control policy.
- View and manage their own profilee.
- View and manage other users' profilees.
- Review pending Admin account registrations.
- Approve or reject Admin account registrations.
- Activate, suspend, or deactivate Admin accounts.
- Review user, device, monitoring, and control audit records.
- Access Owner-only user-management functions.

### 5.2 Admin (PRD-FR-014)

The Admin is an operational application user.

The Admin shall be able to:

- Create an account through the registration page.
- Access the website only after Owner approval.
- Log in after the account has been approved and activated.
- View devices assigned or made available to the Admin.
- View current and historical monitoring data.
- Access faucet-control functions according to the final control policy.
- View and edit only their own profilee.
- Change their own password and language preference.
- View their own relevant activity where supported.

The Admin shall not be able to:

- View another user's private profilee details unless explicitly exposed for operational purposes.
- Edit another user's profilee.
- Approve or reject account registrations.
- Activate, suspend, or deactivate other users.
- Assign roles to other users.
- Promote themselves or another user to Owner.
- Change Owner account details.

---

## 6. Authentication and Account Access

### 6.1 Access Restriction (PRD-FR-015)

The application shall not expose monitoring, device, control, history, alert, user, or settings pages to unauthenticated users.

Unauthenticated users shall only be able to access:

- Login page.
- Create-account page.
- Password-recovery pages (`/forgot-password`, `/reset-password`).
- Email-verification page (`/verify-email`).
- Account-status page (`/status`).
- Public health endpoints (`/health`, `/ready`).
- Public legal or help pages, if explicitly approved.

All protected routes shall verify authentication on the server side.

Hiding protected links in the frontend shall not be treated as sufficient access control.

### 6.2 Account Registration (PRD-FR-016)

The create-account page shall allow a prospective Admin to submit an account registration request.

The registration form shall collect at least:

- Full name.
- Email address.
- Username.
- Password.
- Password confirmation.

The system shall validate:

- Required fields.
- Email and username uniqueness.
- Password policy.
- Password confirmation.
- Valid data formats.

Upon successful submission, the system generates a 256-bit email verification token, dispatches a verification link via Resend (`DEC-AUTH-104` / `TASK-0214`), and redirects the applicant to the email verification instruction page.

### 6.3 Admin Approval Workflow (PRD-FR-017)

A newly registered Admin account shall not receive application access immediately.

The default Admin account lifecycle shall be:

```text
PENDING_APPROVAL (unverified, emailVerifiedAt = NULL)
→ PENDING_APPROVAL (verified, emailVerifiedAt = NOW())
→ ACTIVE (approved by Owner)
```

Alternative outcomes shall include:

```text
PENDING_APPROVAL (verified)
→ REJECTED (rejected by Owner)

ACTIVE
→ SUSPENDED

ACTIVE or SUSPENDED
→ DEACTIVATED
```

After registration:

1. The system shall create the Admin account with `PENDING_APPROVAL` status and `emailVerifiedAt = NULL`.
2. The system shall prevent the account from entering protected application pages or obtaining an authenticated session.
3. Unverified Admin accounts shall remain absent from the Owner's pending approval list (`/approvals`) and cannot be directly approved or rejected server-side (both return HTTP 409 `INVALID_STATUS`).
4. The Admin shall verify email ownership via the link sent to their email.
5. Verifying email ownership records `emailVerifiedAt = NOW()`, preserves `PENDING_APPROVAL` status, creates NO session, and redirects to `/status?status=PENDING_APPROVAL`.
6. Once verified, the Admin account becomes visible in the Owner's approval queue (`/approvals`).
7. The Owner shall be able to review the registration.
8. The Owner shall be able to approve or reject the verified registration.
9. When approved, the account status transitions to `ACTIVE`, and the Admin can log in.
10. When rejected, the account status transitions to `REJECTED`, and login remains blocked.
11. The system shall record the Owner, timestamp, decision, and optional decision note in `approval_history` and `audit_logs`.

### 6.4 Owner Account Provisioning (PRD-FR-018)

The initial Owner account is provisioned via CLI seed (`scripts/seed-owner.ts`).
- Created with `role = OWNER` and `accountStatus = ACTIVE`.
- Login and session issuance remain blocked server-side with `EMAIL_NOT_VERIFIED` (HTTP 403) until the Owner verifies email ownership (`emailVerifiedAt IS NOT NULL`).
- The provisioning process outputs a secure email verification link or dispatches verification via Resend.

### 6.5 Login Behaviour (PRD-FR-019)

The login page shall:

- Accept the configured login identifier (email).
- Accept a password.
- Display translated validation and authentication messages.
- Prevent access for invalid credentials.
- Prevent access with HTTP 403 `EMAIL_NOT_VERIFIED` for unverified accounts (`emailVerifiedAt IS NULL`).
- Prevent access for `PENDING_APPROVAL`, `REJECTED`, `SUSPENDED`, or `DEACTIVATED` accounts.
- Display an appropriate account-status message without exposing sensitive system information.
- Redirect an approved and active user to the appropriate authenticated landing page (`/`).
- Record successful and failed login attempts according to the security policy.

### 6.6 Password Recovery and Reset (PRD-FR-020)

The password recovery workflow shall:

- Provide self-service password recovery via email using the approved provider (Resend, `DEC-AUTH-102` / `TASK-0213`).
- Generate single-use 256-bit CSPRNG reset tokens valid for 15 minutes, persisting only SHA-256 hashes in `password_reset_tokens`.
- Enforce strict anti-enumeration on `POST /api/v1/auth/forgot-password` (generic 200 response with timing attack mitigation).
- Enforce rate limits: 3 requests/min for forgot password, 5 requests/min for reset password.
- Validate new passwords against password policy (min 8 chars, uppercase, lowercase, number, special char) and hash with Argon2id.
- Transactionally revoke all active user sessions upon successful password reset.
- Strictly preserve existing `accountStatus` (password reset never approves or activates pending accounts).
- Enforce server-side guest route guards (`DEC-AUTH-103`): active sessions visiting `/login`, `/register`, `/forgot-password`, `/reset-password`, or `/verify-email` are immediately redirected to `/` with zero UI flash.

### 6.7 Registration Email Verification (PRD-FR-039 / DEC-AUTH-104)

The registration email verification workflow shall:

- Provide mandatory email ownership verification for `OWNER` and `ADMIN` roles using Resend (`DEC-AUTH-104` / `TASK-0214`).
- Track email verification via an independent, nullable `emailVerifiedAt` timestamp on the `users` table, completely decoupled from `accountStatus`.
- Issue 256-bit CSPRNG verification tokens valid for 24 hours (`AUTH_VERIFY_TOKEN_EXPIRY_HOURS = 24`), storing only SHA-256 hashes in `email_verification_tokens`.
- Invalidate prior unused verification tokens for that user upon issuing a new token.
- Support `POST /api/v1/auth/verify-email`: verifies token, updates `emailVerifiedAt`, deletes token, and returns user status without creating an authentication session.
- Support `POST /api/v1/auth/resend-verification`: public endpoint with anti-enumeration (unconditional generic 200) and 3 req/min rate limit.
- Handle database concurrency safely: bounded exponential backoff retries (3 attempts) on Prisma `P2034` write conflicts, returning `CONCURRENCY_CONFLICT` (HTTP 409) on retry exhaustion and `TOKEN_ALREADY_USED` (HTTP 400) for consumed tokens.
- Handle frontend StrictMode/remount concurrency safely: token-keyed in-flight Promise deduplication with immediate cache eviction upon settlement (`finally`), ensuring single network requests while delivering navigation triggers to the active mount.
- Enforce server-side guest guard (`DEC-AUTH-103`): authenticated users navigating to `/verify-email` are redirected server-side to `/`.
- *Delivery & Testing Status*: Verification has been manually exercised using Resend test mode/test recipients and the Resend-provided verification link. We have not yet tested delivery to arbitrary real email recipients using a verified custom sending domain, because no such domain is currently configured. Real-mailbox deliverability is treated as pending deployment/infrastructure acceptance, not an application logic failure.

---

## 7. Product Scope

### 7.1 In Scope

The first product scope includes:

- Login.
- Admin account registration.
- Registration email ownership verification.
- Owner approval and rejection workflow.
- Owner and Admin role enforcement.
- Own-profilee management.
- Owner management of other users' profilees.
- Multi-device monitoring.
- Device selection.
- Device online and offline status.
- Current soil monitoring.
- Current water monitoring.
- Historical monitoring data.
- Alerts and status indicators.
- Faucet-control presets.
- Faucet-command confirmation.
- Faucet-command progress and result.
- Faucet-command activity history.
- Audit logging.
- English and Bahasa Indonesia.
- Responsive desktop, tablet, and mobile behaviour.
- Integration with the existing frontend source code.
- Communication between the web backend and the ESP32/NodeMCU integration layer.

### 7.2 Out of Scope

Unless added through a later approved requirement, the following are outside the website scope:

- Sensor manufacturing.
- Sensor calibration.
- Sensor measurement algorithms.
- ESP32 firmware implementation.
- Physical valve or relay design.
- Tank construction.
- Water-pressure engineering.
- Determination of agronomic thresholds.
- Determination of chemical thresholds.
- Hardware maintenance procedures.
- Automatic irrigation decisions based on sensor values.
- Billing or subscription management.
- Public access without login.
- Native Android or iOS applications.
- Changing the existing visual identity without approval.

---

## 8. Device Requirements

### 8.1 Multi-Device Support (PRD-FR-020)

The system shall support multiple ESP32/NodeMCU devices.

Each device record shall support:

- Internal database primary key: immutable UUID (`id`).
- External canonical device ID: unique string (`deviceId`), editable only by Owner (`DEC-DEV-028`).
- Device name (`name`).
- Device type (`deviceType`).
- Site or location association: single primary site in v1.
- Current connection status.
- Last-seen timestamp.
- Firmware version, if supplied.
- Latitude and longitude, if supplied.
- Active or inactive state.
- Created and updated timestamps.

Device provisioning and identity rules:

- **No In-App Device Creation**: Devices cannot be created from `/devices` or through the application UI/API. The Add Device requirement is removed (`DEC-DEV-027`). Existing devices remain provisioned in the database.
- **Owner-Only Canonical `deviceId` Edit**: The Owner may update the external canonical `deviceId` string and `name`. The internal database UUID remains immutable to safeguard relational integrity (`DEC-DEV-028`).
- **Strict Admin `deviceId` Concealment**: Admin users MUST NOT view or edit the external canonical `deviceId` in any UI component or API response. Admins only see the user-facing device name (`name`) or localized system default name (`DEC-DEV-028`).
- **Hardware/Broker Rename Reconciliation**: Physical ESP32/NodeMCU firmware reconfiguration and EMQX broker credential/ACL synchronization following a `deviceId` rename are operational workflows marked as **TBD / BLOCKING** automation (`DEC-DEV-028`).

### 8.2 Device Selection (PRD-FR-021)

The authenticated interface shall provide a device selector when more than one device is available.

The system shall:

- Display only devices the user is authorised to access.
- Clearly display the selected device name for all users, and canonical `deviceId` for Owner users only (concealed from Admins per `DEC-DEV-028`).
- Resolve device selection fresh per session/load in a neutral initial state (`selectedDevice = null`) on bare routes (`/`, `/sensor`, `/soil` without `?deviceId=`). No device is automatically selected on fresh login or load; selection occurs only via explicit user action in the `/sensor` cards or header `DeviceSelector` (`DEC-DEV-029`).
- **Route-Scoped Selection Rehydration & Removal of Historical Persistence**: The system shall NOT track, persist, or restore historical last-accessed device state across logins or in persistent storage (e.g. `localStorage`, cookies, profilee preferences) (`DEC-DEV-029`). Once explicitly selected, selection is active in-memory and reflected in the route URL (`?deviceId=...`), rehydrating upon hard refresh on that device route after validating against the server-authorized list.
- **History Scope Protection**: Telemetry historical charts (`TASK-0503`/`TASK-0504`), faucet-command history, device assignment/revocation history, status history, and audit history remain 100% intact (`DEC-DEV-029`).
- Prevent data from different devices from being mixed.
- Display an empty state when no devices are assigned or available.
- Display a clear state when the selected device is inactive or offline.

### 8.3 Device Access Scope (PRD-FR-022)

The system shall support device-level access rules:

- All Owners see all devices in the global scope; Admins see only assigned devices (`revokedAt IS NULL`).
- Device assignment is mandatory for Admin access; unassigned devices are completely hidden and inaccessible to Admins.
- Authorised device API endpoints (`GET /api/v1/devices`, `GET /api/v1/devices/{deviceId}`) enforce server-side scoping and role-based DTO projections (`DEC-DEV-028` / `TASK-0305`). Canonical `deviceId` is strictly concealed from Admin users across all JSON payloads, returning safe internal UUID `id` and dynamic `permissions` (`canView`, `canControl`).
- The device detail endpoint strictly enforces active account verification and `device.read` permission checks before database lookup to prevent device-existence probing.
- Admins cannot self-assign or reassign devices.

---

## 9. Monitoring Requirements

### 9.1 Soil Monitoring (PRD-FR-023 / PRD-DATA-001)

For the selected device, the application shall support display of:

- Soil nitrogen.
- Soil phosphorus.
- Soil potassium.
- Soil temperature.
- Soil moisture.
- Soil pH.
- Soil EC.
- Soil status.

For each available metric, the interface shall support:

- Current value.
- Unit supplied by the agreed data contract.
- Measurement timestamp.
- Latest update time.
- Normal, warning, critical, unavailable, or invalid display state where applicable.
- Historical view where data is stored.
- Loading, empty, offline, stale, and error states.

The website shall not invent sensor units or valid ranges. Units and ranges shall be obtained from the agreed integration contract.

### 9.2 Water Monitoring (PRD-FR-024 / PRD-DATA-002)

For the selected device, the application shall support display of water quality parameters:

- Water pH.
- Water TDS.
- Water EC.
- Water status.

### 9.3 Water Tank Monitoring (PRD-FR-038 / PRD-DATA-005)

For the selected device, water tank monitoring is a distinct domain supporting:

- Water tank volume (canonical unit: L).
- Water flow rate (canonical unit: m³/h).
- Water tank status.
- Control capabilities: Solenoid Valve (irrigation control actuator) and Relay (ON/OFF switch).

Water tank monitoring is separate from general water-quality monitoring.

### 9.4 Device Electrical / INA219 Power Monitoring (PRD-FR-039 / PRD-DATA-006)

The application supports electrical monitoring via INA219 sensors (monitoring voltage, current, and power consumption):

- System electrical consumption / power status.
- Timestamp of electrical reading.

INA219 electrical monitoring tracks system electrical consumption as device health/power telemetry. It is not classified as a battery percentage or primary agronomic monitoring parameter. Water tank monitoring does not use the `BAT` parameter.

### 9.5 Status Values (PRD-FR-025)

Internal status values shall remain language-neutral.

Suggested canonical values include:

```text
NORMAL
WARNING
CRITICAL
UNKNOWN
UNAVAILABLE
```

The frontend shall translate status labels for display.

Translated labels shall not be stored as canonical database or API values.

### 9.4 Data Freshness (PRD-FR-026)

The system shall display the timestamp of the latest received data.

The system shall distinguish between:

- Current data.
- Stale data.
- No data.
- Invalid data.
- Offline device.

The exact stale-data threshold is TBD.

### 9.5 Monitoring Refresh (PRD-FR-027)

The dashboard shall update monitoring information without requiring a full page reload.

The final update method and interval are TBD and shall be defined in the architecture and communication specifications.

---

## 10. Historical Data Requirements (PRD-FR-028)

The system shall store historical monitoring data when supplied by the device integration layer.

Users shall be able to:

- Select a device.
- Select one or more monitoring metrics.
- Select a date or date range.
- View data in charts or tables.
- Identify gaps in received data.
- View timestamps in the active locale and user timezone.
- Distinguish missing data from zero values.
- View the latest available value.

The following are TBD:

- Data-retention period.
- Maximum date range per query.
- Aggregation intervals.
- Export functionality.
- Raw-data download permissions.
- Long-term archival policy.

Historical data shall remain isolated by device.

---

## 11. Faucet-Control Requirements

### 11.1 Presets & Actions (PRD-FR-029 / PRD-DATA-003 / TASK-0807)

The system shall provide the following faucet-control actions and presets on `/controls`:

#### A. Predefined Dispensing Presets (`DISPENSE`)

| Phase | Volume per Plant | Default Total (1 plant) | Calculation Formula |
|---|---|---|---|
| Phase 1 | 300 mL (UI 0.3 L) | 0.3 L | $300\text{ mL} \times \text{plantCount}$ |
| Phase 2 | 1,000 mL (UI 1.0 L) | 1.0 L | $1,000\text{ mL} \times \text{plantCount}$ |
| Phase 3 | 1,500 mL (UI 1.5 L) | 1.5 L | $1,500\text{ mL} \times \text{plantCount}$ |

- **Plant Count Multiplier**: The UI provides an interactive stepper ($\text{integer} \ge 1$, default 1) with live preview calculation ($\text{Volume/plant} \times \text{Count} = \text{Total Liters}$).
- **Server Authority**: The backend computes canonical integer `targetVolumeMl` directly from `phase` and `plantCount`; client-supplied volume authority is rejected.

#### B. Manual Valve Actions (`OPEN` / `CLOSE`)

- Direct manual valve actuation (`OPEN` / `CLOSE`) without phase or volume parameters.
- Protected by distinct action-aware confirmation modals.

#### C. Authoritative Physical State Indication

- Displays authoritative valve physical state: `OPEN` (emerald), `CLOSED` (slate), or `UNKNOWN` (amber).
- Derived exclusively from terminal completed commands: `COMPLETED OPEN` $\rightarrow$ `OPEN`, `COMPLETED CLOSE` $\rightarrow$ `CLOSED`, while active commands, failures, and `DISPENSE` completions strictly present `UNKNOWN`.

### 11.2 Control Workflow (PRD-FR-030 / TASK-0807)

The faucet-control workflow shall:

1. Require an authenticated and authorised user session with `device.control.dispense` permission and `ENABLE_FAUCET_CONTROL=true`.
2. Require selection of a specific, online `WATER_TANK_NODE` device.
3. Present the selected action, phase, plant count, and calculated total volume in Liters.
4. Require explicit user confirmation in a dedicated action-aware modal.
5. Submit the command to `POST /api/v1/devices/{deviceId}/faucet-commands` transmitting a unique `Idempotency-Key` HTTP header.
6. Display active command status card with dynamic Liters/action formatting and live polling indicator.
7. Poll command status every 2.5 seconds strictly during active lifecycle states (`QUEUED`, `SENT`, `ACKNOWLEDGED`, `IN_PROGRESS`).
8. Terminate polling immediately upon reaching any terminal state (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `EXPIRED`) with zero blind retries.
9. Record all command activity in the paginated faucet history table and audit log.

Suggested internal command statuses include:

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

### 11.3 Control Permissions (PRD-FR-031)

Faucet-control access shall be protected by explicit permission checks.

The final role matrix for control is defined by `DEC-RBAC-015` and enforced via `device.control` permission.

At minimum:

- The system shall not infer control permission merely because a user can view monitoring data.
- Every control request shall be authorised on the server.
- The command shall be linked to the initiating user and selected device.
- An Admin shall not gain control over devices outside their authorised scope.
- The Owner shall have control access only where allowed by the final device and control policy.

### 11.4 Control Safety States (PRD-FR-032)

The interface shall prevent or reject control when:

- The user lacks permission.
- No device is selected.
- The selected device is offline.
- The selected device is inactive.
- A conflicting active command exists, if concurrent commands are prohibited.
- The command payload is invalid.
- The command has expired.
- The integration service is unavailable.
- Required device state is unknown.

The following are TBD:

- Whether a user can cancel an active command.
- Whether an emergency-stop control is available.
- Whether two users may submit commands to the same device concurrently.
- Command timeout duration.
- Command retry policy.
- Minimum tank-volume rule.
- Actual-volume tolerance.
- Hardware acknowledgement sequence.

### 11.5 Control Audit Record (PRD-FR-033)

Each faucet command shall record at least:

- Command ID.
- Device ID.
- User ID.
- User role at command time.
- Phase.
- Target volume.
- Actual volume, if supplied.
- Command status.
- Requested timestamp.
- Sent timestamp.
- Acknowledged timestamp, if available.
- Completed timestamp, if available.
- Failure reason, if available.
- Manual Open/Close details, if available.

---

## 12. Alerts and Notifications (PRD-FR-034)

The application shall support alerts related to monitoring, device state, account approval, and control activity where configured.

Potential alert categories include:

- Device offline.
- Stale monitoring data.
- Invalid monitoring payload.
- Soil warning or critical status.
- Water warning or critical status.
- Low battery.
- Low tank volume.
- Faucet-command failure.
- Faucet-command timeout.
- New Admin registration awaiting approval.
- Admin registration approved or rejected.
- Account suspended or deactivated.

Exact thresholds and notification channels are TBD.

The system shall not invent soil or water alert thresholds.

The Owner shall be able to view pending approval alerts.

An Admin shall only view alerts within the Admin's authorised scope.

---

## 13. RBAC Requirements

### 13.1 Roles (PRD-FR-035)

The first version shall support exactly these application roles:

```text
OWNER
ADMIN
```

Additional roles shall not be introduced without a documented requirement change.

### 13.2 Permission Principles

The system shall:

- Enforce permissions on the server.
- Use least-privilege defaults.
- Separate monitoring permissions from control permissions.
- Support device-level access restrictions.
- Record role and permission changes.
- Prevent privilege escalation through frontend manipulation.
- Prevent Admin users from managing other users.
- Prevent Admin users from changing their own role.
- Prevent Admin users from approving pending accounts.

### 13.3 Baseline Role Matrix

| Capability | Owner | Admin |
|---|---:|---:|
| Log in when active | Yes | Yes |
| Create Admin account request | Not required | Yes |
| Approve Admin account | Yes | No |
| Reject Admin account | Yes | No |
| View own profilee | Yes | Yes |
| Edit own profilee | Yes | Yes |
| View other users' profilees | Yes | No |
| Edit other users' profilees | Yes | No |
| Suspend or deactivate Admin | Yes | No |
| Change another user's role | Owner-controlled, subject to policy | No |
| View authorised devices | Yes | Yes |
| View current monitoring data | Yes | Yes |
| View historical monitoring data | Yes | Yes |
| View alerts | Yes | Yes, within scope |
| Access faucet control | Yes | Yes, for assigned devices |
| View audit logs | Yes | Limited or TBD |
| Manage language preference | Yes | Yes |

### 13.4 profilee Management (PRD-FR-036 / PRD-DATA-004)

The Owner shall be able to manage other users' profilees.

Owner profilee-management actions may include:

- View profilee.
- Edit permitted profilee fields.
- Change account status.
- Reset or initiate password reset: TBD.
- Assign device access.
- Change role where permitted.
- Review approval history.
- Review account activity.

The Admin shall only be able to manage their own profilee.

The Admin shall not be able to:

- Open another user's profilee-management page.
- Submit profilee changes for another user.
- Modify user identifiers through API manipulation.
- View Owner-only account-management data.

---

## 14. User profilee Requirements

Each user profilee shall support at least:

- User ID.
- Full name.
- Email address or username.
- Role.
- Account status.
- Preferred language.
- Created timestamp.
- Updated timestamp.
- Last login timestamp, if enabled.

Additional profilee fields are TBD.

Users shall be able to change their own:

- Full name, subject to validation.
- Preferred language.
- Password.
- Other approved personal fields.

Role and account status shall not be editable by Admin users.

---

## 15. Internationalisation Requirements (PRD-FR-037)

The application shall initially support:

- English (`en`).
- Bahasa Indonesia (`id`).

The system shall:

- Provide a mandatory centered initial language-selection gate for unauthenticated visitors without a valid persisted locale cookie (`English` → `en`, `Bahasa Indonesia` → `id`).
- Provide a language selector in Settings (`/settings`) for post-entry language changes (not in the application header, user menu, login forms, or mobile nav).
- Apply the selected language without requiring the user to sign out.
- Persist preference (cookie for unauthenticated, user profilee for authenticated).
- Use `en` (English) as the defined fallback language when keys are missing or invalid.
- Translate navigation, forms, validation, statuses, alerts, account approval messages, monitoring labels, control messages, tables, and accessibility labels.
- Update the HTML language attribute.
- Format dates, times, and numbers according to the active locale where appropriate.
- Keep API field names, MQTT topics, device IDs, database keys, and canonical enum values untranslated.
- Preserve technical abbreviations such as pH, EC, TDS, N, P, and K.

The default language is `id` (Bahasa Indonesia) and fallback language is `en` (English). UI text across all views is wired to `next-intl` translation keys (`TASK-0603`), with the mandatory initial language gate and Settings locale change flow fully implemented and verified (`TASK-0604`).

---

## 16. UI and UX Requirements

The existing frontend source code is the authoritative visual reference.

The implementation shall:

- Preserve the current design system.
- Reuse existing components where practical.
- Avoid replacing the colour palette, typography, spacing, and layout without approval.
- Support desktop, tablet, and mobile layouts.
- Provide clear device-selection context.
- Show loading, empty, offline, stale, warning, critical, success, and error states.
- Use confirmation before sending faucet-control commands.
- Prevent repeated accidental submissions.
- Provide clear success and failure feedback.
- Keep the language selector accessible on supported layouts.
- Hide or disable actions the current user cannot perform, while still enforcing server-side authorisation.
- Ensure Owner-only user-management pages are not shown to Admin users.

---

## 17. API and Data Contract Principles

Detailed endpoint and payload definitions shall be documented separately in `API.md` and the device communication specification.

At product level:

- The browser shall communicate with an authenticated backend.
- The browser shall not store device secrets.
- The browser shall not publish directly to unrestricted device topics.
- API property names shall remain stable across languages.
- Every device payload shall include or be associated with a unique device ID.
- Every measurement shall include or be associated with a timestamp.
- Invalid payloads shall not silently overwrite valid data.
- Faucet commands shall use unique command IDs.
- Account approval decisions shall use immutable audit records.
- Sensitive fields shall not be returned to unauthorised users.

The final device communication protocol is TBD, with MQTT as the current recommended option.

---

## 18. Non-Functional Requirements

### 18.1 Security (PRD-NFR-001)

The system shall:

- Use secure password hashing.
- Use secure authenticated sessions.
- Protect against unauthorised route access.
- Validate all external input.
- Enforce RBAC on the server.
- Protect device and broker credentials.
- Use encrypted transport in production.
- Record security-relevant events.
- Rate-limit authentication and sensitive control endpoints.
- Prevent duplicate faucet-command execution where possible.
- Support role selection on public registration (`/register`):
  - Allow selecting `OWNER` if no Owner account currently exists in the system (created directly as `ACTIVE`).
  - Once an Owner exists, grey out/disable `OWNER` selection and require all subsequent public registrations to be `ADMIN` (created as `PENDING_APPROVAL`).
- Server-side concurrency protection guarantees `number of valid first Owner registrations <= 1`.
- Prevent inactive or unapproved accounts from accessing protected pages.

### 18.2 Performance (PRD-NFR-002)

The application shall:

- Load the primary authenticated dashboard within an acceptable target under normal conditions.
- Update monitoring data without a full-page refresh.
- Support multiple devices without mixing device state.
- Avoid downloading unnecessary historical data.
- Paginate or aggregate large histories.

Exact performance targets are TBD.

### 18.3 Reliability (PRD-NFR-003)

The system shall:

- Handle temporary network interruption.
- Display offline or stale states accurately.
- Avoid treating missing data as zero.
- Preserve confirmed historical records.
- Record command failures and timeouts.
- Avoid duplicate approval actions.
- Prevent a rejected or suspended account from regaining access through an old session.

### 18.4 Accessibility (PRD-NFR-004)

The application shall:

- Support keyboard navigation.
- Use accessible labels.
- Use sufficient contrast.
- Expose status changes to assistive technologies where practical.
- Translate accessibility labels.
- Avoid communicating status using colour alone.

### 18.5 Maintainability (PRD-NFR-005)

The application shall:

- Use a documented component structure.
- Reuse existing design components.
- Keep monitoring, user-management, authorisation, and device-integration logic separated.
- Store canonical enums rather than translated values.
- Maintain test coverage for authentication, approval, RBAC, monitoring, and control workflows.
- Update documentation when requirements change.

---

## 19. Audit Logging

The system shall record audit events for at least:

- Account registration.
- Account approval.
- Account rejection.
- Account suspension.
- Account deactivation.
- profilee changes by an Owner.
- profilee changes by the user.
- Role changes.
- Device access changes.
- Login success.
- Login failure, subject to security policy.
- Faucet-control request.
- Faucet-command status changes.
- Alert acknowledgement.
- Security-sensitive configuration changes.

Audit records shall include:

- Actor user ID.
- Actor role.
- Action.
- Target type.
- Target ID.
- Timestamp.
- Result.
- Relevant metadata.
- Source information where permitted.

Audit records shall not expose passwords, session tokens, or device secrets.

---

## 20. Assumptions and Dependencies

Current assumptions:

1. ESP32/NodeMCU hardware is developed and managed by a separate team.
2. The hardware team will provide a stable integration contract.
3. The existing frontend source code is available and functional enough to extend.
4. The application will support multiple devices.
5. All protected product functionality requires authentication.
6. Admin self-registration requires Owner approval.
7. The system will initially support Owner and Admin roles only.
8. English and Bahasa Indonesia are the initial interface languages.
9. Sensor thresholds, units, and measurement rules will be supplied externally.
10. The hosting environment is still under discussion.
11. The final device communication protocol is not yet formally approved.
12. Device access may need to be restricted per user, site, or organisation.

Dependencies:

- Hardware team payload specification.
- Device identity and credential model.
- Hosting and deployment decision.
- Database decision.
- Authentication and email or notification provider.
- Frontend framework identified in `FRONTEND_AUDIT.md`.
- Approved API and MQTT or other communication contracts.
- Approved alert thresholds.
- Approved faucet-control authorisation policy.

---

## 21. Acceptance Criteria

### 21.1 Authentication

- An unauthenticated visitor cannot open protected pages.
- An active Owner can log in.
- An approved and active Admin can log in.
- A pending Admin cannot open protected pages.
- A rejected, suspended, or deactivated Admin cannot open protected pages.
- Protected API endpoints reject unauthenticated requests.

### 21.2 Registration and Approval

- A prospective Admin can submit a valid registration request.
- The new account is created with `PENDING_APPROVAL` status.
- The applicant cannot access protected pages while pending.
- An Owner can view pending registrations.
- An Owner can approve a pending Admin.
- An Owner can reject a pending Admin.
- The decision records the acting Owner and timestamp.
- An Admin cannot approve or reject another account.
- A user cannot register themselves as Owner through the public form.

### 21.3 profilee and RBAC

- An Owner can view and edit another user's permitted profilee fields.
- An Admin can view and edit only their own profilee.
- An Admin cannot access another user's profilee-management endpoint by changing a URL or request payload.
- An Admin cannot change their own role or account status.
- Owner-only pages and endpoints reject Admin access.
- Permission behaviour remains the same in English and Bahasa Indonesia.

### 21.4 Multi-Device Monitoring

- A user can view only authorised devices.
- Selecting a device updates all monitoring components to that device.
- Soil and water data from different devices are not mixed.
- Offline, stale, invalid, loading, empty, and error states are displayed.
- Historical data queries remain scoped to the selected device.

### 21.5 Faucet Control

- A control command requires login.
- A control command requires explicit permission.
- A control command is linked to one device.
- Phase 1 sends a 300 mL target.
- Phase 2 sends a 1,000 mL target.
- Phase 3 sends a 1,500 mL target.
- The user must confirm before command submission.
- The system assigns a unique command ID.
- The interface displays the command result or timeout.
- The system records the initiating user, device, phase, target volume, and status.
- Users cannot control devices outside their authorised scope.

### 21.6 Internationalisation

- A user can switch between English and Bahasa Indonesia.
- The selected language persists after refresh.
- User-facing validation and account-status messages are translated.
- API field names and canonical status values do not change with language.
- Device IDs and technical abbreviations remain unchanged.

### 21.7 Existing Frontend Preservation

- Existing reusable components are used where appropriate.
- New pages follow the existing design system.
- New functionality does not introduce an unapproved visual redesign.
- Responsive behaviour remains functional on desktop, tablet, and mobile.

---

## 22. Open Decisions

The following decisions must be resolved before their related implementation is considered complete:

1. Exact frontend framework and version.
2. Final backend framework.
3. Final database and ORM.
4. Final hosting environment.
5. Final device communication protocol.
6. MQTT broker choice, if MQTT is approved.
7. Exact sensor units.
8. ~~Meaning and unit of `Water BAT`.~~ **RESOLVED** — `BAT` parameter is removed completely from soil and water quality monitoring (`DEC-MON-086`, superseding `DEC-MON-085`).
9. Data update interval.
10. Stale-data threshold.
11. Historical-data retention period.
12. Historical aggregation intervals.
13. Alert thresholds.
14. Notification channels.
15. Device assignment model.
16. Default selected-device behaviour.
17. Whether Owners see all devices automatically.
18. Whether Admins can control faucets.
19. Whether Owners can control faucets.
20. Whether active commands can be cancelled.
21. Whether an emergency-stop control is required.
22. Whether concurrent commands are allowed.
23. Command timeout and retry rules.
24. Account-approval notification method.
25. First Owner provisioning process.
26. Password-recovery process.
27. Default and fallback language (Resolved: default `id`, fallback `en`).
28. Whether Owner approval immediately activates the Admin.
29. Whether an approved Admin must verify email before activation.
30. Exact profilee fields.
31. Audit-log retention period.
32. Export and reporting requirements.

---

## 23. Conflicts and Gaps Found

1. The communication medium is described as internet or Wi-Fi, but the application protocol has not yet been formally selected. Wi-Fi is connectivity, not a complete message contract.
2. Monitoring access is confirmed for Owner and Admin, but faucet-control permissions for each role are not yet confirmed.
3. Multi-device support is confirmed, but device ownership and assignment rules are not yet defined.
4. ~~`Water BAT` is listed as a monitored value.~~ **RESOLVED** — `BAT` parameter is removed from soil and water quality monitoring (`DEC-MON-086`, superseding `DEC-MON-085`).
5. Soil and water statuses are required, but thresholds and calculation ownership are not yet defined.
6. Historical monitoring is expected, but retention and aggregation rules are not yet defined.
7. Owner approval is required for Admin access, but the approval notification and activation process are not yet defined.
8. The first Owner account creation method is not yet defined.
9. English and Bahasa Indonesia are required, but the default and fallback locale are not yet confirmed.
10. The existing frontend design is the visual source of truth, but it must be verified that it includes all required authentication, approval, device, monitoring, control, status, and responsive states.

---

## Monitoring and Device Requirements Implementation Note (Reconciled 2026-08-19)

The following facts are verified in the product implementation regarding device selection, routing, and monitoring resolution (`TASK-0306`, `TASK-0501`, `TASK-0503`, `TASK-0504`):
- **Frontend Device Selection Identity:** Selected device identity is anchored strictly to immutable database primary key `devices.id` UUIDs across all monitoring surfaces.
- **Bare Route Neutrality & Canonical Paths:** Bare monitoring views (`/`, `/sensor`, `/soil`, `/water`) start in a neutral state with no automatic first-device selection. Canonical monitoring pages are `/soil` and `/water`; legacy `/tanah` and `/air` routes return 404.
- **Dynamic Rehydration & Access Revocation:** Hard page refreshes with `?deviceId=<UUID>` safely rehydrate only after validating server authorization. Revoked or invalid device identifiers reset selection to `null` with a clear user alert.
- **Monitoring API Dual Identifier Support:** Backend endpoints resolve telemetry queries using either internal UUID or external canonical `deviceId` strings.
- **Admin Concealment & Scoping:** Admin canonical `deviceId` concealment (`DEC-DEV-028`) and assignment isolation (`revokedAt IS NULL`) remain strictly enforced across UI and API layers.
- **Empty Historical Data Handling:** Historical monitoring queries with zero telemetry records return HTTP 200 with an empty series array and valid pagination metadata, preventing false errors or fabricated values.
< ! - -   T A S K - 0 8 0 2   R e c o n c i l e d :   2 0 2 6 - 0 8 - 1 9   - - >  
 
---

## Faucet Control Requirements Implementation Note (Reconciled 2026-08-20)

The following facts are verified in the product implementation regarding `TASK-0804` (`CommandPublisher` in `@kebun-melon/iot-gateway`):
- **Server-Mediated Publishing:** The web client creates persisted commands via backend API; the gateway command publisher pulls unexpired `QUEUED` records and transmits them to the MQTT broker without client-direct broker access.
- **Dispense Volume & Phase:** For `DISPENSE` commands, the publisher passes through the server-calculated canonical `targetVolumeMl` integer persisted in the database (supporting preset volumes multiplied by `plantCount >= 1`), with zero gateway-level volume recomputation.
- **Manual Control Actions:** For manual `OPEN` and `CLOSE` commands, `phase`, `plantCount`, and `targetVolumeMl` are strictly omitted from payloads.
- **State Integrity:** Commands transition to `SENT` only after MQTT publication succeeds. Failed or disconnected publishes remain `QUEUED`. Expired commands transition to `EXPIRED` without physical transmission.
<!-- TASK-0804 Reconciled: 2026-08-20 -->

---

## Faucet Command Acknowledgement Requirements Implementation Note (Reconciled 2026-08-20)

The following facts are verified in the product implementation regarding `TASK-0805` (`AcknowledgementProcessor` in `@kebun-melon/iot-gateway`):
- **Requirement Fulfillment (PRD-FR-006 / PRD-FR-007):** Revalidates and processes device ACKs for `DISPENSE`, `OPEN`, and `CLOSE` commands over QoS 1 MQTT topics (`agriculture/{environment}/{siteId}/{deviceId}/ack/faucet`).
- **Command Linking & Validation:** Correctly links incoming ACKs to persisted commands via `commandId` and device identity, asserting stored action validity.
- **State Progression:** Accepted ACKs transition `SENT` → `ACKNOWLEDGED` without premature completion. Rejected ACKs transition `SENT` → `FAILED` with canonical reason codes and generate audit failure alerts.
- **Idempotency:** Repeated duplicate `messageId` occurrences are handled idempotently with zero duplicate database writes or state regression.
- **Downstream Boundaries:** Execution event state machine transitions (`TASK-0806`), physical outcome verification, and timeout handling (`TASK-0809`) remain decoupled.
<!-- TASK-0805 Reconciled: 2026-08-20 -->

---

## Faucet Command Execution State Machine Requirements Implementation Note (Reconciled 2026-08-20)

The following facts are verified in the product implementation regarding `TASK-0806` (`FaucetEventProcessor` in `@kebun-melon/iot-gateway`):
- **Requirement Fulfillment (PRD-FR-030 / PRD-FR-033):** Subscribes to device execution events (`agriculture/{environment}/{siteId}/{deviceId}/event/faucet`, QoS 1) and enforces the full command lifecycle (`ACKNOWLEDGED` → `IN_PROGRESS` → `COMPLETED` / `FAILED`).
- **Supported Actions:** Handles execution events for `DISPENSE`, `OPEN`, and `CLOSE` commands.
- **Authoritative Physical State:**
  - `COMPLETED OPEN` → `OPEN` (valve physically confirmed open)
  - `COMPLETED CLOSE` → `CLOSED` (valve physically confirmed closed)
  - `COMPLETED DISPENSE` → `UNKNOWN` (dispense completed; valve closure is not assumed without direct physical confirmation)
  - `FAILED` / `IN_PROGRESS` / timeout / uncertain → `UNKNOWN`
  - Physical state is NEVER inferred from API creation, MQTT publication, or command ACKs.
- **Volume Handling Rules:** `DISPENSE` validates target volume parity if provided and tracks non-negative `actualVolumeMl`. `OPEN` and `CLOSE` treat volume measurement as non-applicable and store `null`/`undefined` in the command record.
- **Idempotency & Terminal Immutability:** Duplicate `messageId` occurrences are handled idempotently without redundant writes; terminal commands (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `EXPIRED`) ignore late events without state regression.
- **Alert Dispatching:** Dispatches `CommandFailureAlert` for `FAILED` execution events linking device, command, and `physicalOutcome: 'UNKNOWN'`.
<!-- TASK-0806 Reconciled: 2026-08-20 -->

---

## Centralized Authentication State Hydration Implementation Note (Reconciled 2026-08-22)

The following facts are verified in the product implementation regarding `TASK-0215` (Centralized Authentication State Hydration):
- **Requirement Fulfillment (PRD-FR-015):** The root server layout hydrates authentication and user metadata (`user`, `role`, `isAuthenticated`) via `AuthContext` on initial render.
- **Immediate Role-Based UI Rendering:** UI elements requiring role awareness (`Sidebar` navigation, `/setting` owner menus, top bar greeting and profilee) render immediately upon page mount without layout shift or loading spinners.
- **Client-Side Request Optimization:** Redundant client-side API requests to `/api/v1/auth/session` on page mount have been removed from the dashboard and settings pages.
- **Security & Authorization Baseline:** All protected backend endpoints (`/api/v1/*`) and server actions remain strictly guarded with server-side authorization (`requireSession`, `requireRole`, `requirePermission`).
<!-- TASK-0215 Reconciled: 2026-08-22 -->

