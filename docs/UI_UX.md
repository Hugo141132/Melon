# UI/UX Specification

**Project:** Multi-Device Soil and Water Monitoring System
**Document:** `UI_UX.md`
**Status:** Draft for implementation
**Primary references:** Existing frontend source code and `FRONTEND_AUDIT.md`

---

## 1. Purpose

This document defines the user-interface and user-experience requirements for a web-based application that:

- monitors soil and water data from multiple ESP32/NodeMCU devices;
- displays current and historical readings;
- shows device connectivity, condition, and location;
- supports role-based access control;
- allows authorised users to issue faucet commands using three fixed volume presets;
- supports English and Bahasa Indonesia.

This document defines presentation and interaction behaviour. It does not define sensor calibration, measurement algorithms, firmware implementation, or hardware-level dispensing logic.

### 1.1 TASK-0914 Boundary & UI Status Note
`TASK-0914` (direct EMQX Cloud TLS connectivity for `apps/iot-gateway`) is a backend gateway and simulator hardening task (`Frontend impact: NONE`). The approved visual UI layouts, design tokens, and components remain unaltered. Monitoring UI smoke testing was intentionally deferred/skipped during backend gateway verification.

---


## 2. Source-of-Truth Hierarchy

When requirements conflict, use this priority order:

1. Security, authorisation, and safety requirements
2. Product requirements in `PRD.md`
3. Existing frontend source code
4. Findings in `FRONTEND_AUDIT.md`
5. This `UI_UX.md`
6. New implementation assumptions

The existing source code and `FRONTEND_AUDIT.md` are the visual source of truth for:

- colour palette;
- typography;
- spacing;
- border radius;
- shadows;
- icon style;
- navigation pattern;
- card design;
- responsive breakpoints;
- component conventions.

Do not redesign or replace the existing design system unless a documented requirement cannot be implemented with the current system.

---

## 3. UX Objectives

The application shall enable users to:

1. identify the selected site and device immediately;
2. understand device connectivity and data freshness at a glance;
3. scan current soil and water conditions without opening multiple pages;
4. compare readings over time;
5. distinguish normal, warning, critical, offline, and unknown conditions;
6. issue a faucet command with deliberate confirmation;
7. track command progress and final results;
8. use the application consistently in English or Bahasa Indonesia;
9. access only the pages, devices, and controls allowed by their permissions.

The interface shall prioritise clarity, traceability, and operational safety over decorative complexity.

---

## 4. User Roles and Interface Access

The application shall support two authenticated user roles:

* `OWNER`
* `ADMIN`

* the login page (`/login`);
* the create-account page (`/register`);
* the password-recovery page (`/forgot-password`);
* the password-reset page (`/reset-password`);
* the email-verification page (`/verify-email`).

Per `DEC-AUTH-103`, active authenticated users attempting to access these guest pages are immediately redirected server-side to `/` with zero UI flash. Users must log out or use an unauthenticated session before consuming a password reset or email verification link.

The `/forgot-password` and `/verify-email` pages feature clean minimalist layouts adhering to `Premium Minimal Ops` without decorative illustration frames. The `/verify-email` page extracts verification tokens from query parameters, executes StrictMode-safe in-flight deduplicated requests with settlement cache eviction, automatically redirects verified Admin applicants to `/status?status=PENDING_APPROVAL`, provides direct login prompts for Owners, and includes a public resend verification form with cooldown timers.

Monitoring, device, alert, control, user-management, audit-log, and settings interfaces shall only be accessible after successful authentication.

### 4.1 Owner

The Owner is the highest-authority user in the application.

An Owner may:

* view authorised sites and devices;
* view current soil and water readings;
* view device locations;
* view historical monitoring data;
* view device connection and operational status;
* view alerts;
* view faucet-command history;
* access faucet-control functions when the relevant control permission is granted;
* view their own profilee;
* edit their own profilee;
* view other users’ profilees;
* edit permitted fields in other users’ profilees;
* review pending Admin account registrations;
* approve or reject Admin account registrations;
* activate, suspend, or deactivate Admin accounts;
* assign users to authorised sites and devices;
* register and manage devices where permitted;
* view audit logs;
* acknowledge alerts where permitted.

Owner-only interface elements may include:

* pending-account approval lists;
* user-management pages;
* account-status controls;
* user-to-device assignment controls;
* audit-log pages;
* device-management controls.

The first Owner account shall not be created through the public Admin registration form.

### 4.2 Admin

An Admin is an operational user whose application access requires prior Owner approval.

An Admin may:

* create an account through the registration page;
* log in only after their account has been approved and activated by an Owner;
* view authorised sites and devices;
* view current soil and water readings;
* view device locations;
* view historical monitoring data;
* view device connection and operational status;
* view alerts within their authorised scope;
* view faucet-command history within their authorised scope;
* access faucet-control functions only when the relevant control permission is granted;
* acknowledge operational alerts when permitted;
* view their own profilee;
* edit their own permitted profilee fields;
* change their own password;
* change their own language preference.

An Admin shall not be able to:

* view another user’s private profilee-management page;
* edit another user’s profilee;
* approve or reject account registrations;
* activate, suspend, or deactivate another user;
* assign roles to another user;
* assign themselves additional permissions;
* promote themselves or another user to Owner;
* change another user’s device assignments;
* access Owner-only user-management controls;
* access Owner-only audit or account-approval interfaces unless explicitly permitted by a later product requirement.

### 4.3 Admin Account Approval States

A newly registered Admin shall not receive immediate access to the protected application.

The interface shall support the following account states:

* `PENDING_APPROVAL`
* `APPROVED`
* `ACTIVE`
* `REJECTED`
* `SUSPENDED`
* `DEACTIVATED`

After submitting the create-account form:

1. The Admin account shall be created with the `PENDING_APPROVAL` status.
2. The applicant shall not be able to access protected application pages.
3. The interface shall display an account-status message.
4. The registration shall appear in the Owner’s pending-approval interface.
5. The Owner shall be able to approve or reject the registration.
6. Approved accounts shall be activated according to the process defined in the product specification.
7. Rejected, suspended, or deactivated accounts shall remain unable to access protected pages.

The interface shall provide distinct messages for:

* registration successfully submitted;
* account awaiting approval;
* account approved;
* account rejected;
* account suspended;
* account deactivated.

These messages shall be available in English and Bahasa Indonesia.

### 4.4 profilee-Management Interface

The profilee interface shall adapt to the authenticated user’s permissions.

For an Owner:

* the interface may display a user directory;
* the interface may provide access to another user’s profilee;
* permitted profilee fields may be edited;
* account status may be managed;
* device access may be assigned where supported;
* approval history may be displayed.

For an Admin:

* the interface shall only provide access to the Admin’s own profilee;
* role and account-status fields shall be read-only;
* user-management navigation shall not be displayed;
* changing a route parameter or request identifier shall not expose another user’s profilee.

### 4.5 Monitoring and Faucet-Control Access

Monitoring access and faucet-control access shall be treated as separate permissions.

A user who can view device monitoring data shall not automatically receive permission to control the faucet.

Monitoring permissions may include:

* `device.read`
* `device.history.read`
* `device.location.read`
* `alert.read`

Faucet-control permissions may include:

* `device.control`
* `device.control`

The interface shall:

* display monitoring data only for authorised devices;
* hide or disable faucet controls when the user lacks control permission;
* disable faucet controls when the selected device is offline or unavailable;
* require explicit confirmation before submitting a faucet command;
* display command progress and results only for authorised devices;
* prevent users from controlling devices outside their assigned scope.

The final allocation of faucet-control permissions between Owner and Admin shall follow `PRD.md` and `RBAC.md`.

### 4.6 Permission-Based Rendering

The interface shall use permission checks rather than relying only on role names.

Relevant permissions include:

* `device.read`
* `device.history.read`
* `device.location.read`
* `device.control`
* `device.control`
* `device.manage`
* `alert.read`
* `alert.acknowledge`
* `audit.read`
* `user.profilee.read.self`
* `user.profilee.update.self`
* `user.manage`
* `user.account.approve`
* `user.account.reject`
* `user.account.suspend`
* `user.account.deactivate`
* `user.device.assign`
* `role.manage`

Default permission principles:

* self-profilee permissions may be granted to Owner and Admin;
* user-management permissions shall be restricted to Owner;
* account-approval permissions shall be restricted to Owner;
* device, monitoring, alert, and faucet-control permissions shall remain subject to the user’s authorised device scope;
* role-management permissions shall not permit an Admin to change their own role or privileges.

A control that the user cannot access should not be displayed as an enabled action.

Hiding, disabling, or removing an interface control is not a substitute for server-side authorisation. Every protected page, API request, profilee update, account-approval action, device-management action, and faucet-control command shall be independently authorised by the backend.


## 5. Information Architecture

Recommended primary navigation:

1. Dashboard
2. Devices
3. Monitoring
4. History
5. Alerts
6. Control Activity
7. Users and Roles — authorised users only
8. Settings

The final labels and route names shall follow the existing frontend conventions documented in `FRONTEND_AUDIT.md`.

### 5.1 Suggested Route Responsibilities

| Route | Responsibility |
|---|---|
| `/dashboard` | Operational overview for the selected device |
| `/devices` | Device list, filtering, status, and assignment visibility |
| `/devices/:deviceId` | Detailed monitoring for one device |
| `/history` | Historical readings and comparison |
| `/alerts` | Active and historical alerts |
| `/controls` | Faucet commands and execution history |
| `/users` | User and device-access management |
| `/roles` | Role and permission management |
| `/settings` | profilee, language, and application preferences |

Do not create duplicate pages where an existing route already satisfies the same responsibility.

---

## 6. Global Application Layout

The existing application shell shall be retained.

Expected regions:

- sidebar or primary navigation;
- top header;
- page title and contextual actions;
- site and device context;
- main content area;
- notification area;
- user controls.

### 6.1 Header Requirements

The header shall provide access to:

- current page title;
- selected site;
- selected device;
- global device status;
- last data update;
- alerts;
- user profilee menu.

On smaller screens, these controls may move into a compact menu or drawer, but device context and critical status must remain visible.

---

## 7. Multi-Device Context

The application supports multiple ESP32/NodeMCU devices. Devices are pre-provisioned in the database; in-app device creation ("Add Device") is removed (`DEC-DEV-027`).

### 7.1 Device Selector

The device selector shall display:

- device name (or localized system default name);
- canonical `deviceId` for Owner users only (strictly concealed from Admin users across all UI components and API responses per `DEC-DEV-028`);
- site or location;
- online, offline, warning, or unknown status;
- last-seen information where space permits.

The selector and `/devices` card list shall support:

- search;
- filtering by site;
- filtering by connectivity status;
- clear indication of the active device;
- keyboard navigation;
- an empty state when no device is assigned;
- role-appropriate presentation (`TASK-0305`): Owner users see canonical `deviceId` string badges alongside custom names; Admin users see only custom device names or localized default type labels (`Soil Sensor Node` / `Node Sensor Tanah`) with canonical `deviceId` strictly concealed.

### 7.1.1 Device Management Actions on `/devices` (`DEC-DEV-030`)

The `/devices` view governs device lifecycle operations strictly restricted to the `OWNER` role:
- **No In-App Device Creation**: The "Add Device" button and creation modal are removed (`DEC-DEV-027`).
- **No Device Deletion**: The "Delete Device" button and delete confirmation modal are removed (`DEC-DEV-030`) to prevent permanent data loss.
- **Deactivate Action**: Active devices display a "Deactivate" action. Clicking it opens a confirmation modal explaining that deactivation sets connection state to `INACTIVE` and blocks faucet control commands.
- **Reactivate Action**: Deactivated devices display an amber status badge and a prominent "Reactivate" button. Clicking it triggers an activation confirmation modal that restores the device to `ACTIVE` operational status via `POST /api/v1/devices/{deviceId}/activate`.

### 7.2 Device Context Persistence & Neutral Initial State

The selected device is retained in-memory during active application navigation.

**Removal of Previously/Last-Accessed Device History & Route-Scoped Rehydration**: The application shall NOT track, persist, or restore previously/last-accessed device history across logins or in persistent storage (e.g. `localStorage`, cookies, profilee preferences) (`DEC-DEV-029`). Device selection initializes in a neutral state (`selectedDevice = null`) on bare routes (`/`, `/sensor`, `/soil` without `?deviceId=`). Selection occurs strictly upon explicit user interaction in `/sensor` or the header `DeviceSelector`, synchronizing to the active route URL (`?deviceId=...`). Hard refresh (Ctrl+Shift+R) on a specific device route rehydrates that selection after validating against the server-authorized list. If access to the currently selected device is revoked or unassigned (or if an invalid ID is in the query), selection is cleared to `null` and a notice is displayed without silent fallback.

**History Protection**: This policy applies strictly to device selector persistence and does NOT affect telemetry history/charts (`TASK-0503`/`TASK-0504`), faucet-command history, device assignment/revocation history, status history, or audit logs (`DEC-DEV-029`).

A device selection shall not grant access to a device the user is not authorised to view.

### 7.3 No Device Selected

When no device is selected, display:

- a clear instruction to select a device;
- an accessible device-selection action;
- no misleading zero values;
- no enabled faucet controls.

---

## 8. Dashboard Structure

The dashboard shall present information in this order:

1. Device context and connection status
2. Critical alerts or warnings
3. Soil monitoring summary
4. Water monitoring summary
5. Tank volume and flow rate
6. Faucet control
7. Historical trends
8. Device location
9. Recent activity

The exact grid shall adapt to the existing design and responsive breakpoints.

---

## 9. Device Status and Data Freshness

### 9.1 Connection Status

Supported internal statuses:

- `ONLINE`
- `OFFLINE`
- `DEGRADED`
- `UNKNOWN`

The displayed label shall be translated, but the internal value shall remain unchanged.

### 9.2 Last Update

Display the last successful telemetry timestamp.

Examples:

- “Updated 8 seconds ago”
- “Last update: 27 July 2026, 13:24”
- “No data received”

Relative time may be used for recent readings. Exact time shall be available through a tooltip, detail view, or secondary label.

### 9.3 Stale Data

Stale readings shall not appear identical to current readings.

When data exceeds the freshness threshold defined elsewhere:

- show a stale-data indicator;
- preserve the last known value;
- display its timestamp;
- avoid implying that the value is current;
- disable control actions when required by the control policy.

The UI shall not invent the freshness threshold.

---

## 10. Soil Monitoring

The soil section shall display:

- Nitrogen
- Phosphorus
- Potassium
- Soil temperature
- Soil moisture
- Soil pH
- Soil EC
- Soil status

### 10.1 Metric Card Content

Each metric card shall support:

- translated metric name;
- latest value;
- unit from the data contract;
- status or threshold indicator where available;
- last update;
- optional short-term trend;
- loading, no-data, stale, error, and offline states.

Do not hard-code units that have not been confirmed in the data contract.

### 10.2 NPK Presentation

Nitrogen, phosphorus, and potassium may be grouped in one NPK component when this matches the existing visual design.

The component shall still preserve separate:

- values;
- units;
- statuses;
- history series;
- accessibility labels.

### 10.3 Soil Status

The interface may display a derived soil status, but it shall not calculate or invent thresholds unless the approved specification explicitly assigns that responsibility to the frontend.

Supported display states:

- Normal
- Warning
- Critical
- Unknown

---

## 11. Water Monitoring

The water section shall display:

- Water pH
- Water TDS
- Water EC
- Water status
- Tank volume
- Water flow rate

### 11.1 Equipment Battery (BAT)

`BAT` (Battery) parameter is **REMOVED** from soil and water quality monitoring sensor nodes (`DEC-MON-086`, superseding `DEC-MON-085`). It shall not be rendered in soil or water quality dashboard cards.

### 11.2 Water Location

Latitude and longitude parameters are **DELETED** from water monitoring and shall not be rendered.

Where a map is included, it shall provide:

- a marker for the selected device;
- device name or ID;
- coordinates;
- last location update;
- an unavailable-location state;
- no fabricated position when coordinates are missing or invalid.

### 11.3 Tank Volume

The tank-volume component shall show:

- current volume;
- confirmed unit;
- tank capacity when available;
- percentage only when both volume and capacity are known;
- low-volume warning where provided by the backend;
- last update.

Do not calculate a percentage using an assumed tank capacity.

### 11.4 Flow Rate

The flow-rate component shall show:

- current flow rate;
- unit from the data contract;
- active or inactive indication;
- trend or recent history where useful;
- no-flow, unavailable, and invalid states.

### 11.5 Historical Telemetry Charts (`DEC-MON-088`, `DEC-UIUX-104`)

Historical charts render on domain detail pages (`/soil` and `/water`; legacy `/tanah` and `/air` return 404 Not Found):

- **NPK Trend Visualization:** Soil NPK trend renders as a multi-line Recharts `LineChart` featuring three distinct series: Nitrogen (`#0d631b`), Phosphorus (`#884200`), and Potassium (`#476800`) with smooth monotone curves, active hover dots, and null-gap preservation (`connectNulls={false}`). Individual metrics (Temperature, Moisture, pH, EC, TDS) render as AreaCharts with smooth gradient fills.
- **Client-Side Hourly Aggregation:** Historical readings are grouped and averaged into 1-hour intervals client-side purely for visualization stability and noise reduction. This does not alter backend telemetry ingestion or real-time streaming data contracts.
- **Instant Client-Side Cache Reuse:** Switching between range presets (24 Hours, 7 Days, 30 Days) reuses existing cached telemetry in memory, instantly recalculating and displaying charts with `loading=false` without skeleton flashes or redundant network requests.
- **Range-Based X-Axis Tick Formatting:** X-axis tick label density is decoupled from 1-hour data resolution to ensure clean readability across all device viewports:
  - **24 Hours:** Displays ~5–8 evenly spaced readable time ticks (e.g. `00:00`, `04:00`, `08:00`, `12:00`, `16:00`, `20:00`).
  - **7 Days:** Displays 4–5 well-spaced daily ticks (stepping every 2 days when > 4 days) to eliminate label crowding and text overlap on mobile screens while preserving all hourly data points.
  - **30 Days:** Displays ~5–7 cleanly spaced date ticks across the month.
- **Application Locale-Aware Formatting:** Date and time labels follow the application's active language via `useLocale()` (`formatDayMonth`):
  - **Indonesian (`id`):** e.g., `20 Agu`, `24 Agu`.
  - **English (`en`):** e.g., `20 Aug`, `24 Aug`.
  - All unwanted trailing commas and periods are stripped from axis ticks, raw data strings, and tooltip headers (`20 Agu`, not `20 Agu,`).
- **EC Display Unit:** Electrical Conductivity is stored in `mS/cm` and converted to `µS/cm` (×1000) for display.
- **Empty State:** Queries returning zero records display a translated no-data banner (HTTP 200), not zero values or a 404 error.

---

## 12. Faucet Control (`/controls` / TASK-0807)

Faucet control has physical consequences and is presented as a deliberate, safety-first workflow adhering to `Premium Minimal Ops`.

### 12.1 Presets & Plant Count Stepper

The interface provides three prominent Liter preset cards with secondary phase badges:

| Phase | Volume per Plant | Default Display (1 plant) | Formula |
|---|---|---|---|
| Phase 1 | 0.3 L / plant | 0.3 L | $0.3\text{ L} \times \text{plantCount}$ |
| Phase 2 | 1.0 L / plant | 1.0 L | $1.0\text{ L} \times \text{plantCount}$ |
| Phase 3 | 1.5 L / plant | 1.5 L | $1.5\text{ L} \times \text{plantCount}$ |

- **Plant Count Stepper**: Dedicated numerical input and minus/plus buttons ($\text{integer} \ge 1$) with live calculation preview (`0.3 L × 3 tanaman = 0.9 L total air`).
- **Manual Actions**: Dedicated "Buka Keran (OPEN)" and "Tutup Keran (CLOSE)" buttons.

### 12.2 Authoritative Physical State Badge

Displays the authoritative physical valve status at the header:
- **`OPEN`** (Emerald badge, pulsing dot): Valve confirmed open from completed `OPEN` action.
- **`CLOSED`** (Slate badge): Valve confirmed closed from completed `CLOSE` action.
- **`UNKNOWN`** (Amber badge): Active command in progress, completed `DISPENSE` (uninstrumented valve), or failed/timeout state.

### 12.3 Control Availability & Safety Gating

Controls are disabled with a clear notice banner when:
- user lacks `device.control.dispense`;
- feature flag `ENABLE_FAUCET_CONTROL` is `false`;
- no device is selected;
- selected device is offline or not a `WATER_TANK_NODE`;
- an active command (`QUEUED`, `SENT`, `ACKNOWLEDGED`, `IN_PROGRESS`) is in progress.

### 12.4 Confirmation Dialogs

Clicking a preset or manual action opens a dedicated modal dialog:
- **Dispense Confirmation**: Displays device name, phase, plant count, volume per plant, and calculated total Liters.
- **Manual Open/Close Confirmation**: Displays explicit valve operation safety warnings.
- Dispatches pure HTTP header `Idempotency-Key` upon user confirmation.

### 12.5 Command Lifecycle & Status Polling

- Active commands display in `FaucetStatusCard` with live polling indicator.
- Polling occurs every 2,500ms strictly during active states (`QUEUED`, `SENT`, `ACKNOWLEDGED`, `IN_PROGRESS`).
- Polling terminates immediately upon reaching any terminal state (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `EXPIRED`).
- Zero blind retries: Failed or timed-out commands require conscious user re-confirmation.

### 12.6 Responsive Layout

- **Mobile (390px)**: Single-column stack, touch targets $\ge 40\text{px}$, zero horizontal overflow.
- **Tablet (768px)**: 2-column layout balancing preset grid and status card.
- **Desktop (1280px+)**: Full responsive grid with paginated history table.

---

## 13. Alerts and Notifications

Alerts may include:

- device offline;
- stale data;
- abnormal soil status;
- abnormal water status;
- low battery;
- low tank volume;
- command failure;
- command timeout;
- access denied.

### 13.1 Alert Severity

Supported severities:

- Info
- Warning
- Critical

Severity shall not rely on colour alone. Use text, iconography, and accessible labels.

### 13.2 Toasts

Use transient toasts for:

- preference saved;
- command submitted;
- alert acknowledged;
- non-blocking errors.

Do not use a toast as the only record of a faucet command. Control activity shall also appear in persistent history.

### 13.3 Navigation Notification Badge (TASK-0705)

The sidebar navigation item for Alerts (`/notifikasi`) renders a dynamic status badge:
- **Badge Content**: Displays the live integer count of unacknowledged critical alerts (`status === 'OPEN'` and `severity === 'CRITICAL'`).
- **Visual Presentation**: Styled using the design system's red error token (`bg-app-error text-white text-[9px] font-bold`) positioned top-right on the Bell icon.
- **Suppression Rules**: The badge is completely hidden when the open critical alert count is zero or when the session is unauthenticated.
- **Immediate Synchronization**: When an alert is acknowledged in `/notifikasi`, a browser event (`melon:alert-updated`) triggers an instant refetch so the sidebar badge decrements immediately without requiring a page reload.

---

## 14. Historical Data and Charts

Historical views shall support:

- device selection;
- metric selection;
- time-range selection;
- translated labels;
- locale-aware timestamps;
- loading and no-data states;
- accessible tabular alternatives where appropriate.

Recommended time ranges may include:

- recent;
- today;
- last 24 hours;
- last 7 days;
- last 30 days;
- custom range.

Exact ranges shall follow `PRD.md`.

### 14.1 Chart Rules

Charts shall:

- identify metric and unit;
- show clear axes;
- avoid visually implying continuity across missing data;
- distinguish stale or missing intervals where supported;
- avoid excessive simultaneous series;
- display exact values through tooltips or data tables;
- remain readable on mobile.

---

## 15. Internationalisation and Language Switching

### 15.1 Supported Locales

Initial locales:

- English — `en`
- Bahasa Indonesia — `id`

Default locale:
- `id` (Bahasa Indonesia)

Fallback locale:
- `en` (English)

### 15.2 Language Selector Placement & Initial Gate UX

1. **Mandatory Initial Language Gate**:
   - For an unauthenticated visitor with **no valid persisted locale cookie**, show a small centered mandatory language-selection gate before rendering login, register, or account-status UI.
   - Gate options: `English` (`en`) and `Bahasa Indonesia` (`id`).
   - Prompt text must be concise bilingual/language-neutral (`Select Language / Pilih Bahasa`).
   - If a valid locale cookie already exists, **skip the gate** and render the requested page directly.

2. **Subsequent Language Changes**:
   - Available exclusively from the **Settings** page (`/settings`).
   - Must **NOT** be placed in the application header, user menu, login/register forms, or mobile navigation.

Language names shall be displayed as:

- English
- Bahasa Indonesia

### 15.3 Language-Switching Behaviour

The user shall be able to change language from Settings without signing out.

After selection:

1. visible interface text updates;
2. the HTML `lang` attribute updates;
3. the preference is persisted (cookie for unauthenticated, user profilee for authenticated);
4. current route and device context are preserved;
5. RBAC, device assignment, and permissions remain completely unchanged.

### 15.4 Content That Must Be Translated

Translate:

- navigation;
- page titles;
- buttons;
- forms;
- validation messages;
- loading and empty states;
- error messages;
- status labels;
- alert text;
- confirmation dialogs;
- command progress and results;
- table headings;
- chart labels;
- accessibility labels;
- audit log presentations.

All user-facing UI text elements have been migrated to `next-intl` translation keys across all auth and protected views (`TASK-0603`). The mandatory initial language gate, Settings modal language switcher (`SettingsLocaleSwitcher` on `/setting`), `/settings` redirect, default device label localization, and responsive mobile selector centering have been implemented and verified (`TASK-0604`).

### 15.5 Content That Must Not Be Translated

Do not translate:

- device IDs;
- sensor IDs;
- MQTT topics;
- API field names;
- database enum values;
- command IDs;
- user-entered device names;
- measurement values;
- standard abbreviations such as N, P, K, pH, EC, and TDS.

### 15.6 Locale Formatting

Locale may affect:

- date formatting;
- time formatting;
- decimal separators;
- thousands separators;
- relative-time labels.

Locale shall not silently convert measurement units.

### 15.7 Translation Fallback

If a translation is missing:

1. use the English value;
2. never expose the raw translation key;
3. log missing keys in development;
4. keep the page usable.

---

## 16. Component States

Every data-bearing component shall support applicable states from this matrix:

| State | Required behaviour |
|---|---|
| Loading | Show skeleton or existing loading pattern |
| Success | Show value, unit, timestamp, and status |
| Empty | State that no data is available |
| Offline | Preserve last known value with offline indication |
| Stale | Show value with stale warning and timestamp |
| Invalid | Do not display malformed data as valid |
| Error | Explain failure and provide recovery where possible |
| Forbidden | Do not expose restricted data |
| Disabled | Explain why an action is unavailable |

Do not display `0` as a fallback for missing sensor data.

---

## 17. Responsive Behaviour

The application shall support desktop, tablet, and mobile layouts using the breakpoints already defined in the existing frontend.

### 17.1 Desktop

- persistent navigation where already used;
- multi-column metric layout;
- charts may appear side by side;
- device context remains visible;
- control activity may use a table.

### 17.2 Tablet

- collapsible navigation;
- reduced column count;
- charts may stack;
- control actions remain touch-friendly.

### 17.3 Mobile

- drawer or compact navigation;
- single-column primary content;
- horizontally scrollable data tables only when unavoidable;
- full-width primary actions;
- sticky device context or accessible equivalent;
- confirmation dialogs sized for small screens;
- no hidden critical status solely due to limited width.

---

## 18. Accessibility

Target WCAG 2.2 AA where practical.

Requirements:

- complete keyboard navigation;
- visible focus styles;
- semantic headings;
- labelled inputs and controls;
- accessible dialogs with focus trapping;
- translated screen-reader labels;
- status communicated through text, not colour alone;
- sufficient text contrast;
- touch targets appropriate for mobile use;
- reduced-motion preference respected;
- charts supplemented with accessible summaries or tables where needed.

The language selector shall have an accessible name and expose the active language.

---

## 19. Content and Terminology

Use concise operational language.

Preferred examples:

- “Device offline”
- “No recent data”
- “Dispensing in progress”
- “Command timed out”
- “Select a device”
- “You do not have permission to control this device”

Avoid:

- unexplained technical errors;
- inconsistent synonyms for the same status;
- raw backend messages;
- ambiguous actions such as “Run” or “Process” for dispensing.

Maintain a terminology glossary in the internationalisation specification when translations are added.

---

## 20. Design-System Preservation

Implementation shall:

- reuse existing layout primitives;
- reuse existing cards, dialogs, badges, tables, and form controls;
- extend existing variants before introducing duplicate components;
- preserve existing design tokens;
- avoid adding an unrelated component library without an architectural decision;
- avoid hard-coded colours when design tokens exist;
- avoid inline styles when the current codebase uses a structured styling method;
- preserve dark or light modes already identified in `FRONTEND_AUDIT.md`.

When a required component does not exist, create it in the same visual and technical conventions as the current codebase.

---

## 21. Frontend Security Boundaries

The frontend shall not:

- contain MQTT broker credentials;
- publish directly to device-control topics;
- make authorisation decisions solely in the browser;
- expose unauthorised devices through hidden UI data;
- trust client-provided role or permission values;
- automatically repeat faucet commands after network errors;
- treat a submitted command as completed before acknowledgement.

All physical control actions shall pass through an authenticated backend.

---

## 22. Performance and Feedback

The UI should:

- render the application shell promptly;
- use skeleton states for delayed data;
- avoid refreshing the entire page for telemetry updates;
- update only affected components;
- debounce search and non-critical filters;
- preserve the selected device during transient refreshes;
- avoid chart re-rendering for unrelated changes;
- provide immediate acknowledgement that a command request was submitted without falsely reporting success.

Performance targets shall be defined in `SYSTEM_REQUIREMENTS.md` or `PRD.md`, not invented here.

---

## 23. Analytics and Audit Visibility

Where enabled by product policy, the application may record:

- page or feature usage;
- language changes;
- device selection;
- alert acknowledgement;
- faucet confirmation;
- faucet manual open/close.

Do not record sensor secrets, credentials, or unnecessary personal information.

Control history shall clearly distinguish:

- who requested the command;
- which device received it;
- selected phase and volume;
- command result;
- relevant timestamps.

---

## 24. Acceptance Criteria

### 24.1 General

- Existing visual identity is preserved.
- New components follow existing design conventions.
- A user can identify the selected device and status on every monitoring page.
- Missing data is never presented as zero.
- Offline and stale states are visually distinct.
- Restricted content is not shown to unauthorised users.

### 24.2 Monitoring

- All required soil metrics can be displayed.
- All required water metrics can be displayed.
- Units originate from the approved data contract.
- Current values include freshness information.
- Historical charts support device and time context.
- Location is not fabricated when coordinates are unavailable.

### 24.3 Faucet Control

- Only authorised users can access active faucet controls.
- Phase 1 displays 0.3 L.
- Phase 2 displays 1 L.
- Phase 3 displays 1.5 L.
- A confirmation step is required.
- The selected device and target volume are visible before confirmation.
- Command submission, progress, completion, rejection, failure, manual open/close, and timeout have distinct states.
- Duplicate submission is prevented while the initial request is being processed.
- Failed network requests do not automatically repeat physical commands.

### 24.4 Internationalisation

- English and Bahasa Indonesia are selectable.
- Language changes do not require sign-out.
- The selected language persists.
- Navigation, validation, statuses, alerts, and faucet-control text are translated.
- Missing translations fall back to English.
- Raw translation keys are not displayed.
- Device IDs, API fields, MQTT topics, and internal enum values remain unchanged.
- RBAC behaviour is identical in every language.

### 24.5 Accessibility and Responsive Design

- Critical workflows are keyboard accessible.
- Dialogs manage focus correctly.
- Status does not rely on colour alone.
- The main monitoring and control workflows remain usable on mobile.
- The language settings remain accessible in Settings on all supported screen sizes.

---

## 25. Frontend Visual Design Governance and Motion System

This section defines the canonical UI design directions, color governance rules, motion/micro-interaction library, motion semantics, task-level declaration requirements, and 21st.dev MCP usage rules for all frontend implementation work.

### 25.1 Mandatory Primary UI Design Directions

Whenever a task intentionally modifies the visual frontend UI, the implementation must select exactly ONE primary approved UI design direction from this controlled list:

1. `Premium Minimal Ops`: High-contrast operational hierarchy, clean typography, precise grid alignment, restrained micro-interactions, dark-mode prioritized.
2. `Soft Bento Dashboard`: Structured grid container cards, soft subtle borders, high scannability, clear visual separation between telemetry domains.
3. `Swiss Data Minimalism`: Strict typographic scale, grid alignment, heavy contrast emphasis on telemetry metrics, minimal decorative accents.
4. `Soft Glass Layers`: Modern subtle backdrop blurs, layered depth card surfaces, sleek operational badges, dark theme visual polish.
5. `Neo-Industrial Monitoring`: High-density data grid layout, operational status emphasis, vivid status indicators, industrial utility aesthetics.
6. `Editorial Analytics`: Elegant metric callouts, spacious layout rhythm, structured report typography, clean analytical visual emphasis.

**Rules:**
- A task does NOT need to use all six directions.
- Select the ONE primary direction that best suits the page/task.
- Do not arbitrarily combine multiple visual paradigms.
- Small supporting characteristics from the existing application may remain, but the selected direction should guide any new visual work.
- Existing implemented pages do not need to be retroactively redesigned solely to satisfy this rule.

### 25.2 Mandatory Color Governance

The existing Kebun Melon color template and design tokens are authoritative (`FRONTEND_AUDIT.md` & `globals.css`).

Frontend work MUST NOT:
- replace the current palette;
- rebrand the application;
- introduce a competing primary color system;
- change the established color template merely because another design style was selected.

Selecting a UI direction changes visual/layout treatment, NOT the established brand color palette. Existing project color tokens must be reused wherever practical.

### 25.3 Approved Motion & Micro-Interaction Library

When visual frontend work is performed, select only the motion effects genuinely relevant to the task from this controlled list of twelve approved motion effects:

1. `Page enter`: Subtle initial content entrance.
2. `Card hover`: Small elevation/translation emphasis, not dramatic movement.
3. `Button hover`: Clear interactive affordance and scale/brightness feedback.
4. `Sidebar selection`: Subtle active-state movement or indicator transition.
5. `Dropdown`: Short open/close fade/slide transition.
6. `Modal`: Controlled fade/scale entrance and exit.
7. `KPI refresh`: Subtle value/state update indication only when KPI data actually refreshes.
8. `Chart loading`: Loading transition/skeleton while chart data is unresolved.
9. `New event`: Temporary emphasis for genuinely newly arrived monitoring events.
10. `Healthy status`: Restrained status feedback; avoid constant distracting pulsing.
11. `Critical alert`: Attention-prioritized animation only for genuinely critical conditions.
12. `Skeleton loading`: Temporary content placeholder while data is loading.

**Rules:**
- A task does NOT need to use all motion effects.
- Do not add animation merely to satisfy the list.
- The selected effects must correspond to actual UI behavior on that page.
- Do not use critical, healthy, or new-event animations for static decorative purposes.

### 25.4 Motion Quality and Performance Standards

All selected motion effects must satisfy the following operational standards:
- **Lightweight & Subtle**: Short duration (150ms-300ms), smooth easing curves (`cubic-bezier(0.4, 0, 0.2, 1)`).
- **Performant**: Animate GPU-accelerated properties (`opacity`, `transform`, `scale`). Avoid continuous repaints, heavy blur animation, or broad layout shifts.
- **Accessible**: Respect `prefers-reduced-motion` media query by disabling non-essential transitions for users with motion sensitivity.
- **Functionally Meaningful**: Provide immediate visual feedback for user interactions or telemetry state changes without causing operational distraction.

### 25.5 Task-Level Frontend Declaration Standard

For every future task involving visual frontend changes, the agent must explicitly declare before or during implementation:

```text
Frontend impact:
- NONE
- MINOR
- MATERIAL REDESIGN

Selected UI direction:
<exactly one approved design direction>

Existing color template:
UNCHANGED

Selected motion effects:
<relevant subset of the 12 approved motion effects>

21st.dev MCP:
REQUIRED / NOT REQUIRED

Reason:
<short justification>
```

If `Frontend impact = NONE`, selecting a UI direction or motion set is not required.

### 25.6 21st.dev MCP Governance

Use 21st.dev MCP BEFORE implementation when frontend work requires a `MATERIAL REDESIGN`, including:
- substantial page composition change;
- major dashboard layout;
- new significant component system;
- major cards/tables redesign;
- substantial modal/form redesign;
- major visual UX restructuring.

21st.dev MCP is **NOT REQUIRED** for:
- minor API wiring;
- data binding;
- text changes;
- small state indicators;
- small additions using existing components;
- bug fixes that preserve the established layout.

Do not redesign a page merely to justify using 21st.dev MCP.

### 25.7 TASK-0303 Governance Record

`TASK-0303` frontend implementation record:
- **Frontend impact:** `MINOR`
- **Selected UI direction:** `Premium Minimal Ops`
- **Existing color template:** `UNCHANGED`
- **Selected motion effects:** `Card hover`, `Skeleton loading`
- **21st.dev MCP:** `NOT REQUIRED`
- **Reason:** Read-only device capability display added to `/devices` page reusing existing card layouts and skeleton loading states without altering overall page composition.

---

## 26. Audit-Specific Items to Verify

The following items shall be copied from or checked against `FRONTEND_AUDIT.md` before implementation begins:

- [ ] Current framework and version
- [ ] Current route structure
- [ ] Existing application-shell components
- [ ] Existing metric-card component
- [ ] Existing chart component or library
- [ ] Existing map component or library
- [ ] Existing dialog and toast patterns
- [ ] Existing form library
- [ ] Existing icon library
- [ ] Existing design tokens
- [ ] Current responsive breakpoints
- [ ] Existing dark/light mode behaviour
- [ ] Current internationalisation support
- [ ] Hard-coded user-facing strings
- [ ] Existing mock-data locations
- [ ] Existing authentication and permission guards
- [ ] Components suitable for reuse
- [ ] Components that require refactoring
- [ ] Accessibility defects requiring correction

Do not guess these values. Use the audit and source code.

---

## 27. Out of Scope

This document does not define:

- sensor selection;
- sensor calibration;
- measurement accuracy;
- ESP32 firmware architecture;
- MQTT topic payloads;
- command acknowledgement protocol;
- database schema;
- backend API contracts;
- threshold algorithms;
- tank-capacity calculation;
- flow-meter logic;
- deployment topology.

These belong in the corresponding product, communication, API, database, and architecture documents.

---

## 28. Related Documents

This specification should be used with:

- `FRONTEND_AUDIT.md`
- `PRD.md`
- `I18N.md`
- `USER_FLOWS.md`
- `RBAC.md`
- `DEVICE_COMMUNICATION.md`
- `API.md`
- `DATABASE.md`
- `ARCHITECTURE.md`
- `SECURITY.md`
- `TESTING.md`
- `TASKS.md`
- `AGENTS.md`

---

## 29. Implementation Principle

The existing frontend is not merely a visual reference to imitate. It is an implementation asset to preserve and extend.

New monitoring, multi-device, RBAC, language-switching, alert, and faucet-control functionality shall be integrated through reusable components and explicit state handling without replacing stable existing UI unnecessarily.

---

## Monitoring and Device UI/UX Implementation Note (Reconciled 2026-08-19)

The following facts are verified in the frontend UI/UX implementation regarding device selection, routing, and telemetry charts (`TASK-0306`, `TASK-0501`, `TASK-0503`, `TASK-0504`):
- **Frontend Device Selection Identity:** Consistently uses immutable database primary key `devices.id` UUID across URL parameters (`?deviceId=<UUID>`), Context state, and API data fetching hooks.
- **Bare Route Neutrality:** Bare routes (`/`, `/sensor`, `/soil`, `/water`) render in a neutral state with no auto-selection of the first device.
- **Dynamic Rehydration & Access Revocation:** Hard refresh (Ctrl+Shift+R) with `?deviceId=<UUID>` safely rehydrates selection after server validation; revoked device IDs trigger a safe selection reset to `null` with a user notice.
- **Admin Canonical Concealment:** Monospace canonical `deviceId` string rendering is displayed exclusively for Owner users; Admin users see only device names and types per `DEC-DEV-028`.
- **Canonical Routing:** Canonical monitoring routes are `/soil` and `/water`; legacy `/air` and `/tanah` routes return 404 Not Found.
- **Zero UI Redesign:** No new visual styles or UI redesigns were introduced; existing color palette (`globals.css`) and `Premium Minimal Ops` direction remain authoritative.
- **Historical Chart State Handling:** Zero-record history responses (HTTP 200) cleanly render empty chart states without erroneous 404 alerts or fabricated graph lines.
< ! - -   T A S K - 0 8 0 2   R e c o n c i l e d :   2 0 2 6 - 0 8 - 1 9   - - >  
 
---

## Gateway Command Publishing UI/UX Implementation Note (Reconciled 2026-08-20)

The verified implementation of `TASK-0804` (`CommandPublisher` in `@kebun-melon/iot-gateway`) operates strictly in the gateway backend with zero UI changes or visual regressions:
- **Design Tokens Unchanged:** Retains `Premium Minimal Ops` UI aesthetic and existing color palette without modification.
- **Client Presentation Decoupling:** Browser displays preset volumes (e.g. 0.3 L) while backend stores integer mL; the gateway publisher faithfully dispatches the stored canonical `targetVolumeMl` integer.
- **Physical Confirmation Boundary:** The UI continues to await downstream device event processing (`TASK-0806`) before displaying confirmed completion, preventing misleading early completion states.
<!-- TASK-0804 Reconciled: 2026-08-20 -->

---

## Device Acknowledgement Processing UI/UX Implementation Note (Reconciled 2026-08-20)

The verified implementation of `TASK-0805` (`AcknowledgementProcessor` in `@kebun-melon/iot-gateway`) operates strictly in the gateway backend with zero UI changes or visual regressions:
- **Zero Frontend Changes:** Frontend impact is strictly `NONE`. All UI layouts, components, and interactions remain untouched.
- **Design Tokens Unchanged:** Reuses approved `Premium Minimal Ops` tokens and color palette without alterations.
- **State Visualization Safety:** Device ACKs transition command status to `ACKNOWLEDGED` (or `FAILED`). The UI does not display `COMPLETED` or claim confirmed valve closure until physical completion events are received (`TASK-0806`).
<!-- TASK-0805 Reconciled: 2026-08-20 -->

---

## Device Execution Event State Machine UI/UX Implementation Note (Reconciled 2026-08-20)

The verified implementation of `TASK-0806` (`FaucetEventProcessor` in `@kebun-melon/iot-gateway`) operates strictly in the gateway backend with zero UI changes or visual regressions:
- **Zero Frontend Changes:** Frontend impact is strictly `NONE`. All UI layouts, components, and interactions remain untouched.
- **Design Tokens Unchanged:** Reuses approved `Premium Minimal Ops` tokens and color palette without alterations.
- **Physical State Visualization Safety:** The UI reflects verified physical valve state only from confirmed execution events (`COMPLETED OPEN` → `OPEN`, `COMPLETED CLOSE` → `CLOSED`, `COMPLETED DISPENSE` → `UNKNOWN`). No valve closed state is fabricated upon dispense completion.
<!-- TASK-0806 Reconciled: 2026-08-20 -->

---

## Centralized Authentication State Hydration UI/UX Implementation Note (Reconciled 2026-08-22)

The verified implementation of `TASK-0215` (Centralized Authentication State Hydration) enhances the user interface experience while strictly respecting design governance:
- **Design Tokens Unchanged:** Reuses approved `Premium Minimal Ops` tokens, layout hierarchy, and color palette without modifications.
- **Elimination of Layout Shifts & Flashes:** Initial authentication and role state are available immediately upon server-render hydration, eliminating client-side delays, role-checking layout shifts, and loading spinners on `/setting`, the dashboard (`/`), `TopAppBar`, and `Sidebar`.
- **Instant Role-Gated Rendering:** `OWNER`-specific navigation and settings items (`/users` and `/approvals`) render instantly without progressive popping or delayed entry.
<!-- TASK-0215 Reconciled: 2026-08-22 -->

---

## Live Soil and Water Monitoring UI/UX Implementation Note (Reconciled 2026-08-23)

The verified implementation of `TASK-0502` (Live Soil and Water Monitoring UI Data Binding & Telemetry Freshness) reconciles live sensor presentation with strict UI/UX governance:
- **Design Tokens & Visual Pattern Preserved:** Adheres strictly to `Premium Minimal Ops`. All 7 soil metrics (Nitrogen, Phosphorus, Potassium, Temperature, Moisture, pH, EC) use the unified `SoilMetricMeter` card pattern with matching typography, padding, color tokens, and gauge styling.
- **Zero Mock Telemetry / Zero Invented Values:** Removed all mock fallback datasets (`NPK_TREND_DATA`, `EC_TREND_DATA`) from charts (`NPKChart`, `WaterNutrientChart`). Empty historical responses render localized empty notices (`Tidak ada data riwayat untuk rentang waktu ini.`) without fake graph lines.
- **Stale Telemetry Suppression:** When data is marked stale (`isStale: true` or `connectionStatus: STALE`), numerical sensor values are suppressed and rendered as `'-'` with `0%` gauge fills. Active status quotes are hidden, and a prominent amber Stale Alert Banner (`Update: Real-Time: Kedaluwarsa`) is displayed while preserving `lastSeenAt`/`recordedAt` timestamps.
- **Clean Parameter Naming:** Soil parameter labels in Indonesian and English dictionaries use clean, non-redundant titles without "Soil" / "Tanah" prefixes (`Nitrogen`, `Fosfor` / `Phosphorus`, `Kalium` / `Potassium`, `Suhu` / `Temperature`, `Kelembapan` / `Moisture`, `pH`, `EC`).
- **Agreed Units:** NPK (`mg/kg`), pH (*no unit*), Moisture (`%RH`), Temperature (`°C`), EC (`µS/cm`), TDS (`ppm`).
<!-- TASK-0502 Reconciled: 2026-08-23 -->

---

## Controls Loading Structural Skeletons & Responsive Header Centering UI/UX Note (Reconciled 2026-08-27)

The verified implementation of `TASK-0807`, `TASK-0502`, and `TASK-0306` (`/controls` Loading & Header Layout Stabilization on 2026-08-27) reconciles visual stability and layout symmetry:
- **Frontend Impact:** `MINOR`
- **Selected UI Direction:** `Premium Minimal Ops` (authoritative brand color palette and tokens UNCHANGED)
- **Selected Motion Effects:** `Skeleton loading`, `Dropdown`
- **21st.dev MCP:** `NOT REQUIRED`
- **Structural Loading Skeletons:** Replaced the generic single-box placeholder with a structured layout shell (`apps/web/app/controls/loading.tsx`) and granular component skeletons in `WaterTankMonitoringCard` and `FaucetHistoryTable`. The visual structure (Header card, 2-column metric cards for Tank Volume and Flow Rate, controls panel, and 4-row history table) is visible immediately upon navigation, eliminating layout shifting.
- **Header CSS Grid Alignment:** Refactored `TopAppBar` to a balanced 3-column CSS Grid (`grid grid-cols-[1fr_auto_1fr] items-center px-4 h-14`), constraining start and end columns to identical `1fr` widths and centering `DeviceSelector` at the exact 50% horizontal center of the header on desktop, tablet, and mobile.
<!-- Controls Loading & Header Centering UI/UX Reconciled: 2026-08-27 -->

---

## Profile Security Management and Verified Email Change UI/UX Note (DEC-UIUX-102 / TASK-0216 / TASK-0217)

The profile management interface (`/profile`) is reconciled to provide secure, production-grade account management conforming to strict frontend governance:
- **Frontend Impact:** `MINOR`
- **Selected UI Direction:** `Premium Minimal Ops` (authoritative brand color palette and tokens UNCHANGED)
- **Selected Motion Effects:** `Modal`, `Button hover`, `Skeleton loading`
- **21st.dev MCP:** `NOT REQUIRED` (reuses existing design tokens, form components, and modal dialog primitives)
- **Removal of Linked Devices:** The misleading "Linked Devices" card (`USER_PROFILE.devicesCount: 3`) is permanently removed, eliminating confusion with physical IoT monitoring nodes.
- **Account & Session Security Section:** Replaced with a clean, operational "Account & Session Security" card displaying:
  - Single active session status (*"Sesi Aktif: 1 Perangkat"* / *"Active Session: 1 Device"*).
  - Email verification status badge (*"Terverifikasi"* / *"Verified"*).
  - Last password modification metadata where available.
  - Unapproved client PII (IP address and User-Agent) is strictly omitted from the display.
- **Change Password Modal:** The "Change Password" action triggers an accessible modal dialog submitting to `POST /api/v1/auth/change-password` with `{ currentPassword, newPassword, newPasswordConfirmation }`. Validations display inline, and successful completion (HTTP 204) triggers a clean redirect to `/login?message=PASSWORD_CHANGED`.
- **Change Email Modal:** A 2-step modal flow:
  - Step 1: Current password confirmation and candidate email input.
  - Step 2: 6-digit numeric verification code input with 60-second cooldown timer persisted in `sessionStorage`.
  - Upon successful verification, active `AuthContext` is synchronized immediately without requiring full-page reload or re-login.
- **Accessibility & Touch Targets:** Form inputs and action buttons enforce standard 44px minimum touch targets, proper ARIA labels (`aria-labelledby`, `aria-describedby`), and clear focus rings.
<!-- Profile Security UI/UX Reconciled: 2026-08-29 -->

---

## Faucet Controls Physical-State Action Guards and Clean Status Presentation UI/UX Note (Reconciled 2026-09-01)

The faucet control interface (`/controls`) has been refined to enforce physical-state-aware action guards and clean localized status presentation adhering strictly to design governance:
- **Frontend Impact:** `MINOR`
- **Selected UI Direction:** `Premium Minimal Ops` (authoritative brand color palette and design tokens UNCHANGED)
- **Selected Motion Effects:** `Card hover`, `Button hover`, `Modal`
- **21st.dev MCP:** `NOT REQUIRED` (reuses existing control panel cards, stepper inputs, and modal dialog primitives)
- **Physical Valve State Action Enablement:**
  - When authoritative physical state is `CLOSED`: "Start Dispensing" preset cards (0.3 L, 1 L, 1.5 L), plant count stepper buttons (`-`, input, `+`), and "Close Valve" manual action are disabled. Only "Open Valve" remains enabled.
  - When authoritative physical state is `OPEN`: "Open Valve" is disabled (cannot re-open an already open valve). "Start Dispensing" presets and "Close Valve" remain enabled.
  - When authoritative physical state is `UNKNOWN`: All valid actions remain enabled (subject to global device connectivity and permissions).
- **Elimination of Redundant Enum Suffixes:**
  - Removed parenthetical uppercase enum concatenations (e.g., `(CLOSED)`, `(COMPLETED)`, `(OPEN)`, `(DISPENSE)`) from all user-facing UI elements, badges, headers, and history tables.
  - User-facing status labels present clean localized text (e.g., `Completed`, `Closed`, `Open`, `In Progress`, `Queued`, `Sent`, `Acknowledged`, `Failed`, `Timed Out`, `Expired` / `Selesai`, `Tertutup`, `Terbuka`, `Sedang berjalan`, `Menunggu antrean`, `Terkirim`, `Diterima perangkat`, `Gagal`, `Waktu habis`, `Kedaluwarsa`) across both English and Indonesian with 100% key parity.
<!-- Faucet Controls Physical-State Action Guards UI/UX Reconciled: 2026-09-01 -->

