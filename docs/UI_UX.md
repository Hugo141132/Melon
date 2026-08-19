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
* view their own profile;
* edit their own profile;
* view other users’ profiles;
* edit permitted fields in other users’ profiles;
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
* view their own profile;
* edit their own permitted profile fields;
* change their own password;
* change their own language preference.

An Admin shall not be able to:

* view another user’s private profile-management page;
* edit another user’s profile;
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

### 4.4 Profile-Management Interface

The profile interface shall adapt to the authenticated user’s permissions.

For an Owner:

* the interface may display a user directory;
* the interface may provide access to another user’s profile;
* permitted profile fields may be edited;
* account status may be managed;
* device access may be assigned where supported;
* approval history may be displayed.

For an Admin:

* the interface shall only provide access to the Admin’s own profile;
* role and account-status fields shall be read-only;
* user-management navigation shall not be displayed;
* changing a route parameter or request identifier shall not expose another user’s profile.

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
* `user.profile.read.self`
* `user.profile.update.self`
* `user.manage`
* `user.account.approve`
* `user.account.reject`
* `user.account.suspend`
* `user.account.deactivate`
* `user.device.assign`
* `role.manage`

Default permission principles:

* self-profile permissions may be granted to Owner and Admin;
* user-management permissions shall be restricted to Owner;
* account-approval permissions shall be restricted to Owner;
* device, monitoring, alert, and faucet-control permissions shall remain subject to the user’s authorised device scope;
* role-management permissions shall not permit an Admin to change their own role or privileges.

A control that the user cannot access should not be displayed as an enabled action.

Hiding, disabling, or removing an interface control is not a substitute for server-side authorisation. Every protected page, API request, profile update, account-approval action, device-management action, and faucet-control command shall be independently authorised by the backend.


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
| `/settings` | Profile, language, and application preferences |

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
- user profile menu.

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

### 7.2 Device Context Persistence & Neutral Initial State

The selected device is retained in-memory during active application navigation.

**Removal of Previously/Last-Accessed Device History & Route-Scoped Rehydration**: The application shall NOT track, persist, or restore previously/last-accessed device history across logins or in persistent storage (e.g. `localStorage`, cookies, profile preferences) (`DEC-DEV-029`). Device selection initializes in a neutral state (`selectedDevice = null`) on bare routes (`/`, `/sensor`, `/soil` without `?deviceId=`). Selection occurs strictly upon explicit user interaction in `/sensor` or the header `DeviceSelector`, synchronizing to the active route URL (`?deviceId=...`). Hard refresh (Ctrl+Shift+R) on a specific device route rehydrates that selection after validating against the server-authorized list. If access to the currently selected device is revoked or unassigned (or if an invalid ID is in the query), selection is cleared to `null` and a notice is displayed without silent fallback.

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

### 11.5 Historical Telemetry Charts (`DEC-MON-088`)

Historical charts render on domain detail pages (`/soil` and `/water`; legacy `/tanah` and `/air` return 404 Not Found):

- **Chart Controls:** Metric toggle chips, date range selector (24-hour default, 31-day max range), and pagination controls.
- **Null Value Representation:** Missing values render as visual gaps (`connectNulls={false}`).
- **EC Display Unit:** Electrical Conductivity is stored in `mS/cm` and converted to `µS/cm` (×1000) for display.
- **Empty State:** Queries returning zero records display a translated no-data banner (HTTP 200), not zero values or a 404 error.
- **Localization:** Timestamps are formatted using Indonesian locale (`id-ID`).

---

## 12. Faucet Control

Faucet control has physical consequences and shall be presented as a deliberate workflow rather than an instantaneous decorative button.

### 12.1 Presets

The interface shall provide:

| Phase | Target volume |
|---|---:|
| Phase 1 | 0.3 L |
| Phase 2 | 1 L |
| Phase 3 | 1.5 L |

The volume shall be displayed more prominently than the phase label.

### 12.2 Control Availability

Controls shall be disabled when:

- the user lacks `device.control`;
- no device is selected;
- the selected device is offline;
- device data is too stale under the approved policy;
- another incompatible command is active;
- the backend reports that control is unavailable;
- the session is invalid;
- a required safety condition is not satisfied.

The disabled state shall explain why the action is unavailable.

### 12.3 Confirmation Dialog

Selecting a phase shall open a confirmation dialog.

The dialog shall display:

- selected device;
- site or location;
- selected phase;
- target volume;
- current device status;
- available tank volume when supplied;
- clear Cancel and Confirm actions.

Recommended confirmation text:

> Confirm dispensing 1 L from the selected device.

Do not use vague confirmation text such as “Are you sure?”

### 12.4 Command Lifecycle

Supported internal command statuses:

- `QUEUED`
- `SENT`
- `ACKNOWLEDGED`
- `IN_PROGRESS`
- `COMPLETED`
- `FAILED`
- `CANCEL_REQUESTED`
- `CANCELLED`
- `TIMEOUT`
- `REJECTED`

The UI shall translate labels without changing internal values.

### 12.5 Progress Presentation

When progress data is available, show:

- actual dispensed volume;
- target volume;
- progress percentage;
- elapsed time;
- Stop action for authorised users.

When progress data is unavailable, show a state-based progress indicator rather than fabricating a percentage.

### 12.6 Completion State

For a completed command, display:

- target volume;
- actual volume;
- start time;
- completion time;
- initiating user where authorised;
- command ID in detailed or audit views.

### 12.7 Failure State

For failed, rejected, or timed-out commands, display:

- clear status;
- user-safe reason;
- recommended next action where known;
- retry option only when the backend permits it;
- no automatic repeat execution.

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
3. the preference is persisted (cookie for unauthenticated, user profile for authenticated);
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

All user-facing UI text elements have been migrated to `next-intl` translation keys across all auth and protected views (`TASK-0603`). The mandatory initial language gate, Settings modal language switcher (`SettingsLocaleSwitcher` on `/pengaturan`), `/settings` redirect, default device label localization, and responsive mobile selector centering have been implemented and verified (`TASK-0604`).

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
- **Physical Confirmation Boundary:** The UI continues to await downstream device event processing (`TASK-0805`/`TASK-0806`) before displaying confirmed completion, preventing misleading early completion states.
<!-- TASK-0804 Reconciled: 2026-08-20 -->
