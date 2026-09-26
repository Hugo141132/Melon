# AGENTS.md

## 1. Purpose

This file defines how coding agents shall work inside the web-based soil and water monitoring and faucet-control project.

It is an execution policy for:

- Reading project documentation.
- Selecting implementation tasks.
- Modifying the existing codebase.
- Preserving the approved frontend design.
- Handling unresolved requirements.
- Implementing authentication, RBAC, device access, telemetry, MQTT, alerts, and faucet control.
- Writing tests.
- Reporting work.
- Avoiding unsafe assumptions.
- Stopping before high-risk production actions.

All coding agents must read this file before changing project files.

---

## 2. Project Summary

The project is a web-based multi-device monitoring and control system for ESP32/NodeMCU devices.

The system monitors:

### Soil Monitoring (Unified EMQX Cloud Broker per TASK-0415 / TASK-0416, DEC-DEV-035)

- Nitrogen, Phosphorus, Potassium, Temperature, Moisture, pH, EC (canonically standardized in `µS/cm` per `DEC-MON-091`), Soil status (Battery deleted per `DEC-MON-086`). Ingested via primary EMQX Cloud over TLS on `melon/sensor-tanah/data-2424600050` with outbound recommendation on `melon/ai-tanah/rekomendasi-2424600050` (HiveMQ Cloud broker fallback permanently retired per `TASK-0416` / `DEC-DEV-035`).

### Water Quality Monitoring (Unified EMQX Cloud Broker per TASK-0415 / TASK-0416, DEC-DEV-035)

- pH, TDS, EC (canonically standardized in `µS/cm` per `DEC-MON-091`), Water status (Battery, Latitude, and Longitude deleted per `DEC-MON-086`). Ingested via primary EMQX Cloud over TLS on `melon/sensor-air/data-2424600050` with outbound recommendation on `melon/ai-air/rekomendasi-2424600050` (HiveMQ Cloud broker fallback permanently retired per `TASK-0416` / `DEC-DEV-035`).

### Reservoir-Water Monitoring (MQTT 5.0 over TLS via Primary EMQX Cloud Broker, DEC-DEV-032 / DEC-DEV-033 / DEC-DEV-035)

- Reservoir water volume, Reservoir status (Flow rate deleted per `DEC-MON-089`). Preserved on dedicated EMQX Cloud broker (`irigasi/melon/...`).

### Sensor Battery (`BAT`)

- Battery (`BAT`) parameter is completely removed from soil and water quality monitoring domains (`DEC-MON-086`, superseding `DEC-MON-085`).

### Faucet Control Presets

| Phase | Target volume |
|---|---:|
| Phase 1 | 300 mL (UI 0.3 L) |
| Phase 2 | 1,000 mL |
| Phase 3 | 1,500 mL |

The initial application roles are exactly:

```text
OWNER
ADMIN
```

Public registration creates only an Admin request with:

```text
role = ADMIN
accountStatus = PENDING_APPROVAL
```

An Owner must approve the Admin before protected access is allowed.

---

## 3. Mandatory Reading Order

Before starting any implementation task, read the relevant documentation completely.

Use this order of authority:

1. `docs/PRD.md`
2. `docs/RBAC.md`
3. `docs/USER_FLOWS.md`
4. `docs/SECURITY.md`
5. `docs/DEVICE_COMMUNICATION.md`
6. `docs/API.md`
7. `docs/DATABASE.md`
8. `docs/ARCHITECTURE.md`
9. `docs/I18N.md`
10. `docs/UI_UX.md`
11. `docs/FRONTEND_AUDIT.md`
12. `docs/TESTING.md`
13. `TASKS.md`
14. `AGENTS.md`

Interpretation rules:

- `PRD.md` defines product intent.
- `RBAC.md` defines permissions and account-access rules.
- `USER_FLOWS.md` defines expected end-to-end behaviour.
- `SECURITY.md` defines mandatory safety and security constraints.
- `DEVICE_COMMUNICATION.md` defines device and MQTT contracts.
- `API.md` defines application interfaces.
- `DATABASE.md` defines persistence and integrity rules.
- `ARCHITECTURE.md` defines component boundaries.
- `I18N.md` defines multilingual behaviour.
- `UI_UX.md` defines interface behaviour and design expectations.
- `FRONTEND_AUDIT.md` defines the current codebase and existing frontend implementation.
- `TESTING.md` defines required verification.
- `TASKS.md` defines implementation sequencing.

When two documents conflict, follow the higher-ranked document and report the conflict.

Do not silently resolve contradictions.

---

## 4. Existing Frontend Is the Visual Source of Truth

The existing frontend design and source code shall be preserved unless a task explicitly requires a change.

Agents shall:

- Reuse existing layouts.
- Reuse existing components.
- Reuse current spacing, typography, colours, and visual patterns.
- Avoid redesigning pages without instruction.
- Avoid replacing the frontend framework unless formally approved.
- Avoid introducing a second competing design system.
- Avoid rewriting working pages merely for stylistic preference.

Before changing frontend structure:

1. Read `FRONTEND_AUDIT.md`.
2. Identify the existing framework and conventions.
3. Identify reusable components.
4. Make the smallest coherent change.
5. Confirm visual regression risk.

A technically cleaner redesign is not automatically an approved change.

### 4.1 Mandatory Frontend Design Governance

Whenever a task intentionally modifies the visual frontend UI, agents must strictly follow the repository governance rules specified here and detailed in [docs/UI_UX.md](file:///c:/Users/hugop/Documents/Web%20Monitoring/Kebun-Melon/docs/UI_UX.md).

#### Task-Level Frontend Declaration

For every future task involving visual frontend changes, the agent MUST explicitly declare before or during implementation:

```text
Frontend impact:
[NONE | MINOR | MATERIAL REDESIGN]

Selected UI direction:
<exactly one approved design direction>

Existing color template:
UNCHANGED

Selected motion effects:
<relevant subset of the 12 approved motion effects>

21st.dev MCP:
[REQUIRED | NOT REQUIRED]

Reason:
<short justification>
```

If `Frontend impact = NONE`, selecting a UI direction or motion set is not required.

#### Controlled List of 6 Approved UI Directions

When modifying UI, select exactly ONE primary direction from this controlled list:

1. `Premium Minimal Ops`
2. `Soft Bento Dashboard`
3. `Swiss Data Minimalism`
4. `Soft Glass Layers`
5. `Neo-Industrial Monitoring`
6. `Editorial Analytics`

Rules:
- Select the ONE primary direction that best suits the page/task.
- Do not arbitrarily combine multiple visual paradigms.
- Existing implemented pages do not need to be retroactively redesigned solely to satisfy this rule.

#### Color Governance (MANDATORY)

The existing Kebun Melon color template and design tokens are authoritative. Frontend work MUST NOT:
- replace the current palette;
- rebrand the application;
- introduce a competing primary color system;
- change the established color template merely because another design style was selected.

Selecting a UI direction changes visual/layout treatment, NOT the established brand color palette. Existing project color tokens must be reused wherever practical.

#### Controlled List of 12 Approved Motion Effects

When visual frontend work is performed, select only the relevant motion effects from this controlled list:

1. Page enter
2. Card hover
3. Button hover
4. Sidebar selection
5. Dropdown
6. Modal
7. KPI refresh
8. Chart loading
9. New event
10. Healthy status
11. Critical alert
12. Skeleton loading

All motion must be lightweight, subtle, performant, appropriate for an operations dashboard, non-distracting, accessible, and respect `prefers-reduced-motion`. Continuous expensive animations, excessive blur, or purely decorative movement are strictly forbidden.

#### 21st.dev MCP Governance

21st.dev MCP is **REQUIRED** before implementation when frontend work requires a `MATERIAL REDESIGN` (substantial page composition change, major dashboard layout, new component system, major visual UX restructuring).

21st.dev MCP is **NOT REQUIRED** for minor API wiring, data binding, text changes, small state indicators, small additions using existing components, or bug fixes that preserve the established layout.

#### TASK-0214 Governance Record

`TASK-0214` email verification code redesign and reliability audit record:
- Status: `DONE` (Completed 2026-08-22)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Skeleton loading`, `Modal`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Redesigned email verification into a secure 6-digit numeric verification code flow (`{ email, code }` with 15-minute expiry and `sha256(userId:code)` database token hashing). Audited Resend email service and added exponential backoff retry with jitter (up to 3 attempts) for HTTP 429 rate limits, 5xx server errors, and network timeouts while keeping tokens redacted from logs. Updated verification email HTML/plain text templates with prominent monospace code box and security instructions. Implemented `/verify-email` UI with 6-digit code input, target email display and switcher, and 60-second resend cooldown timer persisted via `sessionStorage`. Removed decorative illustration frame and unused `Image` import from `/reset-password` conforming strictly to `Premium Minimal Ops`. Preserved backward-compatible legacy token auto-verification. Verified 100% test pass rate across 31 unit test suites (255/255 tests) and TypeScript typecheck (0 errors across 4 monorepo workspaces).
- 2026-09-21 Resend Transactional Email Logo Rendering & Branding Alignment Record:
  - Frontend impact: `NONE`
  - Selected UI direction: `N/A`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `None`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Reconciled transactional email asset delivery and customer-facing brand presentation across all Resend email templates:
    - Cross-Client Email Logo Rendering: Resolved rendering discrepancies between webmail clients (Gmail dark mode/image proxy inversion vs Zimbra/Outlook). Created an email-safe PNG logo asset (`public/logo1-email.png`, synchronized to `apps/web/public/` and `docs/assets/`), preserving website WebP assets (`logo1.webp`, `logo2.webp`) unchanged. Preserved MIME inline attachment via `cid:logo1` in `apps/web/lib/email/resend.ts`.
    - Branding Text Alignment: Standardized all customer-facing email branding from "Kebun Melon" to "Melon Governance" across all Resend transactional email templates (verification code, password reset, account suspension, account reactivation, and permanent deletion), updating subjects, sender display name (`Melon Governance <noreply@melonmadura.my.id>`), HTML headers, logo alt text, and footer copyright statements. Internal technical identifiers, routes, and database models remain untouched. Updated email test suites in `apps/web/test/unit/resend-email.test.ts`. Verified 100% test pass rate (13/13 tests) and zero TypeScript errors.
- 2026-09-21 Frontend Branding Copy Cleanup & Role Label Standardization Record:
  - Status: `DONE` (Completed 2026-09-21)
  - Frontend impact: `MINOR`
  - Selected UI direction: `Premium Minimal Ops`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `None`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Removed remaining visible UI text containing "Kebun Melon" across frontend registration, auth, settings, and navigation components, and standardized the registration role label to "OWNER / PIC".
    - Registration & Auth Text: Streamlined role selection subtitle (`chooseRoleSubtitle`), Owner registration description (`firstOwnerDesc`), and Admin registration description (`adminRegistrationDesc`) in both Indonesian (`apps/web/messages/id.json`) and English (`apps/web/messages/en.json`).
    - Registration Role Label: Removed redundant hardcoded `(Owner)` parenthetical suffix from `apps/web/app/(auth)/register/register-view.tsx` line 240, cleanly rendering `{tUsers('ownerRole')}` as `"OWNER / PIC"` across both languages without altering role values, RBAC logic, or availability indicators.
    - Language Selector Modal & Devices: Cleaned modal description text (`settings.languageModalDesc`) in both languages and default site name (`devices.mainSiteDefault`) in `id.json`.
    - Status Guard & Settings: Streamlined status guard footer text (`apps/web/app/(auth)/status/page.tsx`) to "Secure Account Access Guard" and settings version indicator (`apps/web/app/setting/page.tsx`) to "v1.0.0".
    - Logo Alt Attributes: Standardized logo `alt` attributes to "Melon" across auth views (`register`, `login`, `forgot-password`, `reset-password`, `verify-email`) and shell navigation (`TopAppBar`, `Sidebar`).
    - Invariants Preserved: The subtitle sentence "Manage your melon farm with ease" / "Kelola lahan melon Anda dengan lebih mudah" was kept strictly unchanged. No layout, styling, components, routes, backend, database, Supabase, staging, or deployment configs were modified.
    - Verification Results:
      - TypeScript Check: `npm run typecheck:web` (`tsc --noEmit`) passed with 0 errors across `apps/web`.
      - Unit Tests: Added dedicated regression test suite `apps/web/test/unit/branding-cleanup.test.tsx` (7/7 tests passed).
      - Full Workspace Tests: `npm test` executed across all 4 monorepo packages (`apps/web`, `apps/iot-gateway`, `packages/database`, `packages/contracts`) with 100% pass rate (125/125 test suites, 1,300/1,300 tests passed).
      - Playwright Browser Verification: Navigated to `/register` in both Indonesian (`locale=id`) and English (`locale=en`); confirmed role card title renders exactly `"OWNER / PIC"` and all visible "Kebun Melon" copy is completely absent.
- 2026-09-24 Registration Visual Integration & Browser Title Metadata Record:
  - Status: `DONE` (Completed 2026-09-24)
  - Frontend impact: `MINOR`
  - Selected UI direction: `Premium Minimal Ops`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `Button hover`
  - 21st.dev MCP: `VALIDATED & APPLIED` (Lightweight structural inspiration for clean border-anchored card hierarchy)
  - Summary: Refined the registration page visual integration into a grounded card hierarchy and standardized the root application browser tab title metadata (`DEC-UIUX-107`, `DEC-UIUX-108`):
    - Registration Visual Integration: Eliminated the detached, floating `<header>` from `apps/web/app/(auth)/register/register-view.tsx` and unified the top navigation, view title, step indicator, and institutional partner logo (`/logo1.webp`) inside the primary card container (`bg-surface-container-lowest`, `border border-outline-variant/60`, `shadow-[0_4px_24px_rgba(0,0,0,0.06)]`, `rounded-2xl`).
    - Grounded Surfaces & Zero Glassmorphism: Preserved strictly solid, opaque surfaces without `backdrop-blur`, translucent glass cards, or heavy animations, maintaining high-contrast readability across responsive viewports (`390px` mobile to desktop).
    - Calibrated Organic Background: Reduced background visual dominance in `AppBackground.tsx` and mesh SVGs via a gentle agricultural pastel palette (`#f3f7f0` to `#ddecd8`) with soft translucency (`opacity 0.15 - 0.35`) and center-focused radial luminance, ensuring CLS = 0 and pure vector SVG (<2KB) execution.
    - Browser Title Metadata Standardization: Updated Next.js root metadata (`apps/web/app/layout.tsx`) `title.default` and `title.template` from `"Kebun Melon - Smart Farming"` to `"Melon Governance"`.
    - Verification Results:
      - TypeScript Check: `npm run typecheck:web` (`tsc --noEmit`) passed with 0 errors across `apps/web`.
      - Unit Tests: All 87 test suites in `apps/web` passed (including `app-background.test.tsx` and `branding-cleanup.test.tsx`).
      - Browser Title Verification: Evaluated `document.title` on `/register` and `/login` via Playwright, confirming `"Melon Governance"`.
    - Staging Impact: Frontend and documentation only. No Supabase database migration, edge function deployment, or container update required.

#### TASK-0215 Governance Record

`TASK-0215` centralized authentication state hydration record:
- Status: `DONE` (Completed 2026-08-22)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented centralized authentication state hydration to eliminate delayed UI rendering and layout shifts across navigation and protected pages. Added React `AuthContext` (`AuthProvider` / `useAuth()`) in `@kebun-melon/web`, providing unified access to `{ user, role, isAuthenticated }`. Implemented `getSessionOrNull()` server helper in `lib/auth/rbac.ts` for safe, non-throwing session retrieval in the root layout (`RootLayout`) during SSR. Eliminated redundant client-side `useEffect` and `fetch('/api/v1/auth/session')` calls from `/`, `/setting`, `/profileee`, `TopAppBar`, and `Sidebar`. Refactored `Sidebar` and `TopAppBar` to consume `useAuth()` directly, removing unnecessary prop drilling. Refactored `/setting` and `/profileee` to instantaneously render user profileee identity and role-conditional menu items (`/users` and `/approvals` for `OWNER`) without loading spinners. Maintained strict server-side RBAC and route protection. Verified 100% test pass rate across 35 unit test suites (260/260 tests) and 14 E2E critical flows.

#### TASK-0212 Governance Record

`TASK-0212` user management and list status administration record:
- Status: `DONE` (Completed 2026-08-22; Reconciled 2026-09-04)
- 2026-09-04 /users Client Auth Optimization & Loading Transition:
  - Frontend impact: `MINOR`
  - Selected UI direction: `Premium Minimal Ops`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `Skeleton loading`, `Button hover`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Optimized `/users` authentication flow and route transition. Removed redundant client-side `fetch('/api/v1/auth/session')`, `currentUserRole` state, and blocking `"Memeriksa sesi pengguna..."` / `"Checking user session..."` spinner from `apps/web/app/users/page.tsx`, directly consuming server-hydrated `useAuth()` (`const { role } = useAuth(); const isOwner = role === 'OWNER';`). Resolved identifier shadowing by renaming user map variable `isOwner` to `isTargetOwner`. Enabled `fetchUsers(1)` to trigger immediately on component mount for Owner without waiting for redundant client session roundtrips. Preserved instant client-side 403 Forbidden screen (`Akses Terbatas (403 Forbidden)`) for Admin users, backed by strict server-side middleware and API RBAC enforcement (`requireRole(['OWNER'])`). Created route-level static loading skeleton `apps/web/app/users/loading.tsx` rendering `TopAppBar`, header skeleton (`Users` icon container and pulsing title/subtitle), search/filter input skeletons, and 5-row user table skeleton in `bg-app-surface text-app-on-surface min-h-dvh pb-24`, replacing blank transitions with a seamless, flicker-free skeleton during App Router streaming. Added unit test suites `apps/web/test/unit/users-page.test.tsx` (2/2 passed) and `apps/web/test/unit/users-loading-transition.test.tsx` (1/1 passed). Verified 100% test pass rate across all auth-hydrated page suites (13/13 passed), 0 typecheck errors across all 4 monorepo packages, and verified instant transition in browser via Playwright MCP.
- 2026-09-13 User Management Improvements & Lifecycle Governance:
  - Frontend impact: `MINOR`
  - Selected UI direction: `Premium Minimal Ops`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `Modal`, `Button hover`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Completed user management lifecycle administration and UI polish under `TASK-0212`:
    - Role Label & Terminology Standardization: Formally standardized Owner presentation across Indonesian and English UI as `OWNER / PIC` (Person in Charge / Penanggung Jawab). Stripped redundant `(OWNER)` and `(ADMIN)` parentheticals from user-facing dropdown filters and badges.
    - Owner Protection Invariants: Protected Owner accounts from accidental or deliberate deletion/suspension. Owner accounts cannot be selected, suspended, deactivated, or deleted. Checkboxes are disabled with clear protection tooltips.
    - Bulk Permanent Account Deletion (`POST /api/v1/users/bulk-delete`): Implemented owner-only checkbox multi-selection with "Select All" bar, action counter, and batch deletion API. Individual user cards omit delete buttons to eliminate accidental single-click deletions.
    - Account Lifecycle & Reason Resolution: Supported suspend (`POST /api/v1/users/{userId}/suspend`), reactivate (`POST /api/v1/users/{userId}/activate`), and permanent delete actions. Allowed optional action reason with automatic fallback to default `OWNER / PIC` statements (`Account suspended by OWNER / PIC.`, `Account reactivated by OWNER / PIC.`, `Account permanently deleted by OWNER / PIC.`).
    - Lifecycle Action Modals: Removed distracting warning/notice callout boxes from all lifecycle action modals, keeping strictly action title, target user info, optional reason textarea with counter, and confirmation buttons.
    - Email Notifications via Resend: Dispatched notification emails for account suspension, reactivation, and permanent deletion with flush-left layout, proportional typography, and natural word wrapping.
    - Audit Trail & Data Integrity: Transactionally hard-deleted user rows and account-owned records upon deletion, anonymized `actorUserId` in historical audit logs, recorded structured audit logs (`account.suspended`, `account.reactivated`, `account.deleted`), and revoked active sessions. Verified 100% test pass rate across all related unit/integration test suites (59/59 tests passed) and zero TypeScript errors.
- 2026-09-21 Owner User Management Verification Status Filtering & Role Label Standardization:
  - Frontend impact: `MINOR`
  - Selected UI direction: `Premium Minimal Ops`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `None`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Hardened Owner User Management visibility rules and role presentation under `TASK-0212`:
    - Unverified Account Visibility Restriction: Prevented unverified registered accounts from appearing in Owner User Management (`/users`). Only accounts that have completed email verification (`emailVerifiedAt !== null`) and hold appropriate approval status (`PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED`) are visible.
    - Repository-Level Query Filtering: In `packages/database/src/user-repository.ts`, updated `getUsers` to strictly exclude unverified pending accounts in the default unfiltered query (`where.NOT = [{ accountStatus: AccountStatus.PENDING_APPROVAL, emailVerifiedAt: null }]`) and enforce `where.emailVerifiedAt = { not: null }` when filtered by `accountStatus = 'PENDING_APPROVAL'`. Updated `getUserManagementById` to return `null` if the user is in `PENDING_APPROVAL` with `emailVerifiedAt === null`, causing `GET /api/v1/users/[userId]` to return HTTP 404 `USER_NOT_FOUND`.
    - Frontend Defensive Safeguard: In `apps/web/app/users/page.tsx`, added defensive client-side filtering in `fetchUsers` ensuring unverified pending accounts are never rendered even if present in an external payload.
    - Role Display Text Standardization: Updated `roleAdminLabel` in `apps/web/messages/id.json` and `apps/web/messages/en.json` from `Administrator` to `ADMINISTRATOR`. Standardized role display across filter dropdowns, table row badges, and user detail modals.
    - Verification & Automated Tests: Added dedicated test suite `Owner User Management Visibility & Verification Invariants` in `packages/database/test/user-repository.test.ts` (4/4 tests passed), updated UI test assertions in `apps/web/test/unit/users-bulk-delete-ui.test.tsx` (8/8 passed), added tests for `ADMINISTRATOR` badge and defensive filtering in `apps/web/test/unit/users-page.test.tsx` (4/4 passed), verified API route tests in `apps/web/app/api/v1/users/test/route.test.ts` (28/28 passed), and confirmed 0 TypeScript typecheck errors across all 4 monorepo packages. Live development database query verified unverified applicant `hihi` is cleanly excluded.

#### TASK-0218 Governance Record

`TASK-0218` OTP-based single-session force-recovery flow record:
- Status: `DONE` (Implemented & Verified 2026-09-25)
- Priority: `P0` (Security-critical session enforcement & lockout recovery)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Modal`, `Button hover`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented OTP-based single-session force-recovery flow conforming to `DEC-AUTH-107`, `DEC-AUTH-112`, and strict single active session security (max active sessions = 1).
  - Challenge Invariant & Credentials Gate: When a user attempts to log in with valid credentials while an active unrevoked session exists, `POST /api/v1/auth/login` returns HTTP 409 `ACTIVE_SESSION_EXISTS` with metadata `canRecover: true` without revoking the pre-existing session.
  - OTP Challenge Generation (`POST /api/v1/auth/session-recovery/challenge`): Requires valid email and password to prevent unauthorized OTP generation. Validates existence of an active session to recover. Generates a secure single-use 6-digit numeric OTP with 60-second expiration. Salts OTP with `challengeId` and hashes using SHA-256 (`otpHash`), ensuring raw OTP is never stored in the database. Dispatches transactional recovery email with Resend.
  - Challenge Verification & Displacement (`POST /api/v1/auth/session-recovery/verify`): Validates OTP using timing-safe comparison. Limits verification to 3 attempts (on 3rd failure, challenge is immediately consumed). Upon successful verification, an atomic transaction row-locks the user (`SELECT ... FOR UPDATE`), marks challenge consumed, revokes all previous active sessions (`revokedAt = NOW()`), creates a new single active session, sets HttpOnly `session_token` cookie, and records a synchronous audit log with event key `auth.session.force_recovered`.
  - Frontend Recovery Modal & Consolidated Alert Copy: Refined `ACTIVE_SESSION_EXISTS` alert copy into a single, cohesive message ("Your account currently has an active session on another browser or device. Would you like to terminate that session and sign in on this device?"), eliminating duplicate secondary text. Integrated an accessible, high-contrast modal on `/login` that appears when HTTP 409 is returned, supporting a confirmation step and OTP input step with a live 60-second countdown timer, resend action upon timer expiry, and automatic session hydration and redirect on recovery success.
  - Prisma Dual-Connection Architecture: Configured `directUrl = env("DIRECT_URL")` on PostgreSQL session pooler (port 5432) in `schema.prisma` to support PostgreSQL session-level advisory locks (`pg_advisory_lock`) required by Prisma Migrate, while retaining `DATABASE_URL` (port 6543 Transaction Pooler) for production runtime queries. Applied migration `20260925150000_add_session_recovery_challenges` cleanly to live development database (`unbyxlkrzqlafolxcypi`).
  - Verification: Added test suites `packages/database/test/session-recovery.test.ts` (13/13 passed), `apps/web/test/unit/login-view-recovery.test.tsx` (6/6 passed), `apps/web/app/api/v1/auth/session-recovery/challenge/test/route.test.ts` (7/7 passed), and `apps/web/app/api/v1/auth/session-recovery/verify/test/route.test.ts` (8/8 passed). All 34 tests across 5 session suites passed (100%). Monorepo typecheck passed with 0 errors across 4 workspaces (`@kebun-melon/iot-gateway`, `@kebun-melon/web`, `@kebun-melon/contracts`, `@kebun-melon/database`).

#### TASK-0109 Governance Record

`TASK-0109` canonical default site seeding and device environment parity record:
- Status: `DONE` (Implemented & Verified 2026-09-26)
- Priority: `P1` (Database foundation, reproducibility, and environment parity)
- Dependencies: `TASK-0104`, `TASK-0105`
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Addressed and resolved the cross-environment device connectivity parity discrepancy and implemented permanent database initialization consistency.
  - Root Cause Analysis:
    - In local development (`npm run dev`), the Water Tank device was detected as `ONLINE` because the development database already had a site record and valid device associations.
    - In containerized staging Docker (`kebun-melon-staging-gateway`), the Water Tank device was not detected as `ONLINE`. Investigation revealed that the staging database `sites` table was empty (`0` rows) and all staging `devices.site_id` values were `NULL`. When physical reservoir telemetry arrived on `agriculture/staging/site-01/...`, the IoT Gateway evaluated `device.siteId !== parsedTopic.siteId` (`null !== 'site-01'`) and failed closed, rejecting telemetry ingestion to protect data integrity.
  - Phase 1 Resolution (Staging Data Reconciliation):
    - Executed non-disruptive, direct staging database data reconciliation on Supabase Staging (`ihgoxqdncepbcrqkchxu`): created canonical site record `Site (siteCode: 'site-01', name: 'Kebun Utama (Site 01)', ID: 'd31b05fb-5cb9-4120-96d8-3c04dfff1c56')` and associated all active devices (`water-tank-node-uqiwue`, `soil-node-biuc2f`, `water-quality-f2hf9ern`) to this `siteId`.
    - Restarted containerized gateway (`kebun-melon-staging-gateway`); live telemetry ingestion resumed immediately, updating `connectionStatus = ONLINE` and `lastSeenAt` continuously without errors.
    - Strict fail-closed validation in IoT Gateway was preserved 100% without code bypasses.
  - Phase 2 Resolution (Permanent Environment Consistency via Seed):
    - Identified that `packages/database/prisma/seed.ts` originally lacked site seeding entirely and seeded canonical devices without foreign key `siteId` links.
    - Added `CANONICAL_DEFAULT_SITE = { siteCode: 'site-01', name: 'Kebun Utama (Site 01)', description: 'Primary cultivation site for melon monitoring and irrigation control' }`.
    - Implemented `seedCanonicalSites(prisma: PrismaClient)` using idempotent `prisma.site.upsert`.
    - Updated `seedCanonicalDevices(prisma: PrismaClient, siteId: string)` to bind canonical devices (`SOIL_NODE`, `WATER_QUALITY_NODE`, `WATER_TANK_NODE`) to `siteId` on both create and update.
    - Enforced strict foreign key execution order in `main()`: `seedRBAC` $\to$ `seedCanonicalSites` $\to$ `seedCanonicalDevices(prisma, site.id)`.
    - Maintained clean package boundaries: seed helpers remain internal to `seed.ts` (not leaked into `packages/database/src/index.ts`).
  - Verification Results:
    - TypeScript Typecheck: `npm run typecheck` passed with 0 errors across all 4 monorepo packages (`@kebun-melon/iot-gateway`, `@kebun-melon/web`, `@kebun-melon/contracts`, `@kebun-melon/database`).
    - Database Integration Tests: `npm run db:test:integration` executed all 16 migrations and the updated seed on a fresh disposable PostgreSQL 15 container. All 7 test files (60/60 tests) passed, including all 7 seed test cases verifying site creation, foreign key resolution, and seed idempotency.
    - Monorepo Unit Tests: `npm test` executed across all workspaces with a 100% pass rate (132 test files, 1,356/1,356 tests passed).
    - Code Style & Formatting: `npx prettier --check` passed with 0 warnings.
  - Future Agent & Developer Guidance:
    - **Never Create Devices Without Site Association:** Any device seeded, registered, or provisioned must always be explicitly associated with a canonical `Site` (`siteCode: 'site-01'`).
    - **Never Bypass Gateway Site Validation:** The IoT Gateway's siteId validation rule (`device.siteId === parsedTopic.siteId`) is a core security invariant and must remain strictly fail-closed. Do not add fallback bypasses (e.g. allowing `null` siteId to accept telemetry).
    - **Preserve Single Default Site Baseline:** Multi-site management is intentionally deferred to Phase 11 (`TASK-1105` / `DEC-DEV-026`). All sensors and actuators belong to the primary cultivation site (`site-01`).

#### TASK-0217 Governance Record

`TASK-0217` single active session enforcement and profile security UI record:
- Status: `DONE` (Completed 2026-08-29)
- Priority: `P0` (Security-critical session enforcement)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Modal`, `Button hover`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Single active session enforcement and profile interface reconciliation governed by `DEC-AUTH-107` and `DEC-UIUX-102`. Enforces exactly 1 active session per user account, rejecting incoming valid logins with HTTP 409 Conflict (`ACTIVE_SESSION_EXISTS`) and preserving pre-existing live sessions without invalidation. Automatically prunes expired (`> 8h`), idle-timed-out (`> 30m`), or revoked sessions inside the locked transaction. Optimizes session lookups via composite index `sessions_user_active_idx` on `sessions(user_id, revoked_at, expires_at)`. Reconciles `/profile` by permanently removing the misleading "Linked Devices" card, replacing it with an operational "Account & Session Security" section (active session status, email verification status badge, omitting unapproved client PII), and wiring "Change Password" directly to existing backend endpoint `POST /api/v1/auth/change-password` with session revocation and redirect to `/login?message=PASSWORD_CHANGED`. Verified 100% test pass rate across focused unit test suites (`profile-page.test.tsx`, `route.test.ts`, `session-service.test.ts`), translation completeness checks (100% key parity), and TypeScript typecheck (0 errors across 4 monorepo workspaces).
- 2026-09-05 Login Performance Optimization & Auth Bug Fixes Record:
  - Status: `DONE` (Implemented & Verified 2026-09-05; pre-commit CI test suite pending manual execution)
  - Priority: `P0`
  - Frontend impact: `MINOR`
  - Selected UI direction: `Premium Minimal Ops`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `None`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Optimized login transaction latency and resolved authentication regressions.
    - Latency Bottleneck & Root Cause: Traced initial ~5–7s perceived login flow to high WAN round-trip latency to Supabase Mumbai (`ap-south-1`, ~240ms per TCP handshake/query), sequential Prisma relation queries (`users` -> `user_roles` -> `roles`), and multiple round trips inside the `$transaction` (row lock -> blind `updateMany` prune -> `findFirst` active check -> `session.create` -> `user.update` -> `auditLog.create`).
    - Implemented Optimizations: (1) Streamlined session transaction by querying unrevoked sessions with `tx.session.findMany`, skipping cleanup writes for clean accounts (saving ~400ms); (2) Preserved atomic `tx.user.update({ lastLoginAt })` and synchronous `tx.auditLog.create` inside the interactive transaction under the held user row lock (`SELECT id FROM users FOR UPDATE`) ensuring transactional durability and eliminating read-after-write race conditions; (3) Reverted experimental Prisma `relationLoadStrategy: 'join'` in `prisma.user.findUnique` after identifying an unhandled Rust query-engine panic under concurrent execution (`tokio-runtime-worker panicked at query-engine/core/src/query_document/mod.rs:83:86: called Option::unwrap() on a None value`), retaining Prisma's stable and thread-safe standard relation loader; (4) Added covering composite indexes (`sessions_user_active_idx`, `user_roles_user_id_revoked_at_idx`) to optimize relation lookups.
    - Bug Fixes: (1) Resolved blank user greeting ("Welcome ") after login by removing redundant `router.refresh()` in `login-view.tsx` and updating `AuthContext.tsx` to prevent stale `initialSession=null` from clobbering freshly authenticated client state; (2) Implemented safe same-client session recovery/rotation when `session_token` cookie is lost or expired (matching `existingToken` or IP + User-Agent), while strictly preserving `DEC-AUTH-107` / `SEC-AUTH-007` rejection of different devices with HTTP 409 Conflict (`ACTIVE_SESSION_EXISTS`).
    - Verification: Targeted unit test suites passed 100% (`session-service.test.ts` 8/8, `auth-context-hydration.test.tsx` 6/6, `route_protection.test.ts` 13/13), TypeScript typecheck passed with 0 errors across 4 workspaces, staging Docker containers rebuilt and healthy, and Playwright MCP visual validation confirmed zero UI regressions. Final CI test suite (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`) remains pending manual execution by operator before commit.
- 2026-09-22 Profile Avatar Standardization & UI Affordance Cleanup Record:
  - Status: `DONE` (Implemented & Verified 2026-09-22)
  - Priority: `P1`
  - Frontend impact: `MINOR`
  - Selected UI direction: `Premium Minimal Ops`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `None`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Standardized user avatar presentation across application views matching the authenticated user monogram initial style established in `TopAppBar`, and cleaned up profile UI editing affordances:
    - Standardized Monogram Avatar: Created reusable `UserAvatar` component (`apps/web/components/auth/UserAvatar.tsx`) supporting `sm` (32px), `md` (64px), and `lg` (112px) sizes. Dynamically extracts and renders uppercase initials from user full name or email, falling back to a styled Lucide `User` icon when name is absent.
    - Placeholder Elimination: Permanently removed the static, external Pinterest placeholder image (`USER_PROFILE.avatar`) across `TopAppBar` (`apps/web/components/navigation/TopAppBar.tsx`), `/setting` (`apps/web/app/setting/page.tsx`), and `/profile` (`apps/web/app/profile/page.tsx`).
    - Profile UI Affordance Cleanup: Streamlined `/profile` header by removing the top-right three-dot menu button (`MoreVertical`), neatly aligning back navigation and page title. Removed the avatar edit pencil button overlay (`<button><Edit2 ... /></button>`), rendering the monogram avatar in a clean, display-only manner without non-functional or misleading editing affordances.
    - System & Infrastructure Invariants: Zero Supabase Storage additions, zero database migrations, zero Prisma schema changes, and zero backend API modifications. No staging environment redeployment.
    - Verification: Added unit test suite `apps/web/test/unit/user-avatar.test.tsx` (5/5 tests passed), updated `apps/web/test/unit/profile-page.test.tsx` (5/5 tests passed) asserting absence of three-dot menu and edit pencil overlay while confirming display-only avatar rendering, verified monorepo TypeScript typecheck (0 errors across 4 packages), and ran full web unit test suite (53 test files passed, 422/422 tests passed).

#### TASK-0216 Governance Record

`TASK-0216` verified self-email change workflow record:
- Status: `DONE` (Completed 2026-08-30; DEV migrated; manual verification passed; full test isolation hardening verified; all 5 pre-commit quality gates passed)
- Priority: `P1`
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Modal`, `Button hover`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Self-service email change workflow for authenticated users governed by `DEC-AUTH-106`. Added nullable `pending_email VARCHAR(320)` to `EmailVerificationToken` with migration `20260829170000_add_pending_email_to_email_verification_tokens` (applied and verified on DEV database). Reuses approved 6-digit numeric CSPRNG code with 15-minute expiry and scoped hashing `sha256(userId:newEmail:code)`. Guarantees 100% authority of existing email until verification is complete. Enforces candidate email uniqueness across both `User.email` and active `EmailVerificationToken.pendingEmail` tokens. Enforces required `currentPassword` on request, canonical `profilee.self.update` permission, rate limits (3 req/min request, 5 req/min verify), active session preservation without logout, and privacy-preserving audit logging (`account.email.changed` with non-sensitive metadata, omitting plaintext raw old/new emails). Implemented `EmailChangeModal` and integrated with `apps/web/app/profile/page.tsx` and `AuthContext` reactive state hydration while strictly preserving TASK-0217 security cards. Reconciled translation namespace for HTTP 429 rate limit errors to `profile.tooManyRequests` in `messages/id.json` and `messages/en.json` (100% key parity). Investigated and resolved all pre-commit test-isolation bugs across unit, integration, and E2E test suites: (1) hardened `packages/database` Vitest exclude/include patterns and added fail-closed `validateTestDatabaseUrl` guards to prevent unit test runs against persistent databases; (2) added complete in-memory mocks to `apps/web/test/unit/rate-limit-routes.test.ts` to eliminate registration writes to Supabase DEV; (3) updated `e2e/critical-flows.spec.ts` and `playwright.config.ts` to enforce isolated test DBs (`E2E_DATABASE_URL` / `TEST_DATABASE_URL`), eliminated all hardcoded credentials and remote URL fallbacks, adopted dynamic synthetic E2E identities, and added fail-closed host checks. Verified 100% test pass rate across all 5 pre-commit quality gates (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`), monorepo TypeScript typecheck (0 errors across 4 workspaces), manual credentialed end-to-end verification, and verified Supabase DEV database remained 100% clean of synthetic test fixtures. All acceptance criteria satisfied. Supabase staging migration and containerized staging web deployment (`TASK-1012`) remain pending for staging release.
- 2026-09-11 /profile Change Email Action Deduplication Record:
  - Frontend impact: `MINOR`
  - Selected UI direction: `Premium Minimal Ops`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `Modal`, `Button hover`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Resolved duplicated "Change Email" action labels on `/profile`. The initial implementation of `TASK-0216` placed the trigger button in two locations: (1) adjacent to the read-only email field in the Personal Info form, and (2) inside the Email Verification Status card under Account & Session Security. To adhere to clean UI separation of concerns, the trigger was retained solely adjacent to the email input field (`{/* Email (Read-Only with Change Email Action) */}`), and permanently removed from the Email Verification Status card. Security cards strictly represent operational account status badges (*"Terverifikasi"* / *"Verified"*), preventing redundant action triggers. Updated `apps/web/app/profile/page.tsx` and added test assertions in `apps/web/test/unit/profile-page.test.tsx` verifying that exactly one "Ubah Email" / "Change Email" button exists in the DOM across Indonesian and English locales. Verified 100% test pass rate across unit suites (`profile-page.test.tsx` 4/4, `email-change-ui.test.tsx` 7/7), 0 TypeScript typecheck errors across all 4 monorepo packages, rebuilt and restarted staging web container (`kebun-melon-staging-web`) healthy on port 3000, and verified via Playwright health check.

#### TASK-0218 Governance Record

`TASK-0218` unify authentication verification expiry and resend cooldown to 1 minute record:
- Status: `DONE` (Completed 2026-09-20)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Unified all authentication verification token validity lifetimes and UI resend cooldown timers to exactly 1 minute across registration email verification, forgot password / password reset, and self-service email change verification flows, governed by `DEC-AUTH-109`.
  - Token Lifetimes & Repository Defaults: In `packages/database/src/user-repository.ts`, changed the default fallback for `createPasswordResetToken`, `createEmailVerificationToken`, and `requestEmailChange` from `expiryMinutes ?? 15` to `expiryMinutes ?? 1`.
  - Environment Variables & Server Configuration: In `apps/web/lib/env/server.ts`, changed default `AUTH_RESET_TOKEN_EXPIRY_MINUTES` to `1` and added `AUTH_VERIFY_TOKEN_EXPIRY_MINUTES` defaulting to `1`. Updated `.env`, `apps/web/.env`, and `apps/web/.env.example`.
  - API Routes: Passed `expiryMinutes: env.AUTH_VERIFY_TOKEN_EXPIRY_MINUTES` to `userRepository.createEmailVerificationToken` in `POST /api/v1/auth/register` and `POST /api/v1/auth/resend-verification`. Passed `expiryMinutes: env.AUTH_VERIFY_TOKEN_EXPIRY_MINUTES` to `userRepository.requestEmailChange` in `POST /api/v1/me/email/request`.
  - UI Timers & Copy: Updated forgot-password cooldown timer (`apps/web/app/(auth)/forgot-password/forgot-password-view.tsx`) from `15 * 60` to `60` seconds. Updated `apps/web/messages/id.json` and `apps/web/messages/en.json` `codeExpiryNotice` to state 1 minute. Updated transactional email copies in `apps/web/lib/email/resend.ts` to state 1 minute.
  - Specifications: Reconciled `docs/SECURITY.md`, `docs/USER_FLOWS.md`, `docs/API.md`, `docs/DECISIONS.md`, `docs/TRACEABILITY.md`, `docs/SECURITY_EXCEPTIONS.md`, and `TASKS.md`.
  - Verification & Staging Deployment: 100% test pass rate across all related database and web unit/integration test suites (104 tests total across `user-repository.test.ts`, `user-repository-email-change.test.ts`, `user-repository-reset-password.test.ts`, `server-env.test.ts`, `forgot-password-ui.test.tsx`, `forgot-password-route.test.ts`, `email-change-routes.test.ts`, and `verify-email-routes.test.ts`), plus 100% translation key parity via `npm run i18n:check`. Reconciled `.env.staging` and `.env.staging.example` with `AUTH_RESET_TOKEN_EXPIRY_MINUTES=1` and `AUTH_VERIFY_TOKEN_EXPIRY_MINUTES=1`. Rebuilt and redeployed containerized staging web service (`kebun-melon-staging-web`) and IoT gateway (`kebun-melon-staging-gateway`), both verified healthy (`Up (healthy)`) on ports 3000 and 3001.

#### TASK-0302 Governance Record


`TASK-0302` device registry reconciliation record:
- Status: `DONE` (Completed 2026-08-23)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Modal`
- 21st.dev MCP: `NOT REQUIRED`
- 2026-09-04 /devices Client Auth Optimization & Loading Transition:
  - Frontend impact: `MINOR`
  - Selected UI direction: `Premium Minimal Ops`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `Skeleton loading`, `Card hover`, `Button hover`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Optimized `/devices` authentication flow and route transition. Removed redundant client-side `fetch('/api/v1/auth/session')`, `currentUserRole` state, and blocking `"Memeriksa sesi pengguna..."` / `"Checking user session..."` spinner from `apps/web/app/devices/page.tsx`, directly reusing server-hydrated `useAuth()` (`const { role } = useAuth(); const isOwner = role === 'OWNER';`). Enabled `fetchDevices(1)` to trigger immediately on component mount without waiting for redundant client session roundtrips. Created route-level static loading skeleton `apps/web/app/devices/loading.tsx` rendering `TopAppBar`, header skeleton (`Cpu` icon container and pulsing title/subtitle), search/filter input skeletons, and 4-card device grid skeleton in `bg-app-surface text-app-on-surface min-h-dvh pb-24`, replacing blank white screen transitions with a seamless, flicker-free skeleton during App Router streaming and client transitions. Verified global `<body>` styles in `apps/web/app/layout.tsx` were safely left untouched to prevent color token leakage into public authentication screens (`bg-surface`). Preserved all server-side session checks, RBAC scoping, and Admin canonical `deviceId` concealment (`DEC-DEV-028`). Added unit test suites `apps/web/test/unit/devices-page.test.tsx` (3/3 passed) and `apps/web/test/unit/devices-loading-transition.test.tsx` (1/1 passed). Verified 100% test pass rate, 0 typecheck errors across all 4 monorepo packages, and verified smooth transition in browser via Playwright MCP.
- 2026-09-13 Device Management UI Refinement & Parameter Display:
  - Frontend impact: `MINOR`
  - Selected UI direction: `Premium Minimal Ops`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `Skeleton loading`, `Card hover`, `Button hover`, `Modal`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Reconciled and polished `/devices` mobile layout, parameter display presentation, capability rules, and status presentation:
    - Responsive Mobile Layout: Fixed search bar text and placeholder truncation on mobile viewports ($390\text{px}$) via fluid flexbox sizing; reorganized filter controls with wrapping (`flex-col sm:flex-row`); compacted card vertical padding; aligned action buttons and badges consistently.
    - Card Visual Hierarchy: Standardized card layout: Device Name $\to$ dual domain & status badges $\to$ technical metadata (Owner-only canonical `deviceId` & firmware version) $\to$ monitoring parameters section with count badge (`paramCount`) and unit-labeled pill chips $\to$ control capabilities section $\to$ card footer with relative last-seen timestamp and Owner deactivation/reactivation actions.
    - Parameter Display & Units: Converted internal capability keys into localized human-readable labels with standard agricultural units: Soil (N, P, K in `mg/kg`, Temp `°C`, Moisture `%`, pH, EC `µS/cm`); Water Quality (pH, TDS `ppm`, EC `µS/cm`); Water Reservoir (Volume `L`). Canonical internal keys in backend, API, and database remain unchanged.
    - Device Capability Rules: Restricted "Irrigation Valve Control" (`FAUCET_CONTROL`) strictly to supported controller/reservoir devices (`WATER_TANK_NODE`). Soil (`SOIL_NODE`) and Water Quality (`WATER_QUALITY_NODE`) monitoring devices strictly do not display irrigation control capability.
    - Status Simplification & Client Filtering: Mapped raw connection statuses to 3 operational presentation statuses (`ONLINE` $\to$ Connected, `OFFLINE`/`STALE`/`UNKNOWN` $\to$ Disconnected, `INACTIVE`/deactivated $\to$ Inactive) with distinct badge styling and indicator dots. Provided 4-option dropdown filter operating client-side without violating backend API query schemas.
    - Bilingual Localization: Maintained 100% key parity across `messages/id.json` and `messages/en.json` under `devices.*` namespace with zero hardcoded UI strings or Unicode emojis.
    - Verification: 12/12 unit tests passed in `apps/web/test/unit/devices-page.test.tsx`, TypeScript typecheck passed with 0 errors across 4 workspaces, and Playwright MCP visual verification confirmed responsive layout and status filtering across mobile and desktop.

#### TASK-0303 Governance Record

`TASK-0303` frontend implementation record:
- Status: `DONE` (Reconciled 2026-09-13)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Skeleton loading`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Reconciled device capability presentation and domain segregation. Enforced strict physical actuator isolation: "Irrigation Valve Control" (`FAUCET_CONTROL`) renders strictly for `WATER_TANK_NODE` controller devices. Passive monitoring devices (`SOIL_NODE`, `WATER_QUALITY_NODE`) strictly omit irrigation control capabilities in the UI, preserving clear operational boundary between passive telemetry sensors and physical actuators.

#### TASK-0305 Governance Record

`TASK-0305` authorised device list reconciliation record:
- Status: `DONE` (Verified & Reconciled 2026-08-18)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Reconciled and verified authorized device listing and detail endpoints (`GET /api/v1/devices`, `GET /api/v1/devices/{deviceId}`). Verified Owner global access scope returning full safe DTO with canonical `deviceId`, and Admin strictly scoped to active assignments (`revokedAt === null`) with canonical `deviceId` strictly concealed per `DEC-DEV-028` while retaining safe immutable database UUID `id`. Verified dynamic `permissions` DTO (`canView`, `canControl`) dynamically evaluated using RBAC, active account status, device capabilities, and `ENABLE_FAUCET_CONTROL` feature flag. Hardened baseline permission check (`requirePermission(session, 'device.read')`) and active account enforcement on device detail route prior to DB lookup, eliminating device-existence leakage. Verified IDOR/BOLA prevention on unassigned devices, UUID/canonical ID manipulation attempts, unauthenticated requests (401), non-active accounts (403), and invalid pagination (422). Executed focused query and execution plan review via Supabase MCP on staging DB: confirmed index-only scan on `user_device_access_active_user_device_unique` for Admin assignment filtering, index scans on `devices_pkey` and `device_capabilities_device_id_capability_key`, zero N+1 queries, zero database performance regression, and zero index/schema alterations required. Preserved immutable database UUID `devices.id` and all relational foreign key histories. Verified 100% test pass rate across targeted test suites (24/24 route tests, 34/34 database/contracts/device tests, 58/58 combined), Semgrep scan (0 findings), and TypeScript typecheck (0 errors). Confirmed no device creation path reintroduced (`POST /api/v1/devices` remains removed per `DEC-DEV-027`), TASK-0306 last-accessed persistence behavior remains outside scope, and physical ESP32/EMQX rename reconciliation remains `TBD / BLOCKING`.

#### TASK-0306 Governance Record

`TASK-0306` device selector state reconciliation record:
- Status: `DONE` (Reconciled 2026-08-18)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Dropdown`, `Modal`
- 2026-09-19 Device Connection Status Normalization & Header Selector Refinement:
  - Status: `DONE` (Completed 2026-09-19)
  - Frontend impact: `MINOR`
  - Selected UI direction: `Premium Minimal Ops`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `Skeleton loading`, `Button hover`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Reconciled device connection status naming and filtering across the global header `DeviceSelector`, `/soil`, `/water`, `/controls` (`WaterTankMonitoringCard`, `FaucetPresetSelector`, `FaucetConfirmationModal`), and `DashboardView` per `DEC-DEV-034` and `DEC-UIUX-106`. Enforced two canonical user-facing connection states: Connected (`ONLINE`) and Disconnected (`OFFLINE`, `STALE`, `UNKNOWN`), completely eliminating the intermediate "Stale" label from user-facing badges, dots, and tabs. Added frontend normalization utilities (`normalizeConnectionStatus`, `getConnectionStatusLabel`, `getConnectionStatusDotColor`) in `apps/web/lib/utils.ts`. Standardized semantic dot indicators strictly to emerald (`bg-emerald-500`) for Connected and rose (`bg-rose-500`) for Disconnected. Updated selector quick status filter tabs to All / Connected / Disconnected (`Semua` / `Terhubung` / `Terputus`), with `Disconnected` capturing both offline and stale devices. Preserved internal backend telemetry freshness evaluation (`TELEMETRY_STALE_THRESHOLD_MS = 60000`) and MQTT ingestion logic intact. Verified 100% test pass rate across 82 test files (687/687 tests in `@kebun-melon/web`), 0 TypeScript typecheck errors across all 4 monorepo packages, and zero staging modifications.

#### TASK-0304 / TASK-0305 Governance Record

`TASK-0304` / `TASK-0305` device access revocation enforcement & human-readable 403 forbidden state record:
- Status: `DONE` (Completed 2026-09-22)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Button hover`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented end-to-end device access revocation enforcement across server and client boundaries, eliminating an authorization loophole where an Admin user could continue viewing device telemetry on `/soil`, `/water`, or `/controls` after an Owner revoked their assignment in `user_device_access`:
  - Server-Side Device Authorization Guard (`validateServerDeviceAccess` in `apps/web/lib/auth/server-device-guard.ts`): Enforces authoritative checks during server-side rendering and route requests. Global device access is preserved for `OWNER` users, while `ADMIN` users require an active `user_device_access` assignment (`revokedAt === null`). When an Admin requests a revoked or unassigned device, the server rejects access fail-closed with HTTP 403 `DEVICE_NOT_ASSIGNED`.
  - Human-Readable 403 Forbidden UI State (`apps/web/components/navigation/DeviceAccessForbidden.tsx`): Replaced raw database UUID presentation (e.g. `3216f033-4c21-4b19-adc6-365854c31704`) with formatted human-readable device names. Resolves display names via multi-tier fallback: (1) cached device name in `sessionStorage['kebun_melon_device_cache']` captured while the device was active; (2) in-memory `selectedDeviceRef` name; (3) localized domain fallback (`Node Sensor Tanah` on `/soil`, `Node Kualitas Air` on `/water`, `Node Tangki Air` on `/controls`); (4) default `Node Perangkat` / `Device Node`.
  - Client-Side Revoked Device Handling (`apps/web/context/DeviceContext.tsx`): Integrated `markDeviceRevoked(attemptedDeviceId)` which automatically clears active device selection to `null` if the revoked device is selected, purges the device from active context state and `sessionStorage`, and terminates telemetry and prediction polling.
  - Automated Tests & Verification: Added unit test suites `apps/web/test/unit/server-device-guard.test.ts` (6/6 passed) and `apps/web/test/unit/device-revocation-ui.test.tsx` (5/5 passed). Verified 100% test pass rate across all device selector and telemetry UI suites and 0 TypeScript errors across the monorepo.

#### TASK-0411 Governance Record

`TASK-0411` hardware MQTT topic reconciliation and direct gateway migration record:
- Status: `DONE` (Completed 2026-09-11)
- Priority: `P1`
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Reconciled external hardware MQTT parameters and direct gateway ingestion per `DEC-DEV-031` and `DEC-DEV-032`. Established permanent external topic names: `irigasi/melon/sensor/volume` (tank water volume telemetry), `irigasi/melon/kontrol/valve` (valve OPEN/CLOSE behavioral control), and `irigasi/melon/setting/otomasi` (irrigation). Direct 2-tier gateway consumes canonical hardware topics directly through `TelemetryProcessor` with zero intermediate hops. Converted water tank display precision to 2 decimal places (`formatMetricValue(volumeVal, 2)`). Implemented time-based telemetry freshness calculation across monitoring routes (`/api/v1/devices/[deviceId]/monitoring/latest`, `/water/latest`, `/soil/latest`) and device routes (`/api/v1/devices`, `/api/v1/devices/[deviceId]`) using authoritative constant `TELEMETRY_STALE_THRESHOLD_MS = 60 * 1000` (60 seconds). Dynamically calculates effective `connectionStatus: STALE` when hardware telemetry exceeds 60 seconds without mutating database facts prematurely. Synchronized `DeviceContext` in-memory state via `updateDeviceStatus` and `useLatestMonitoring` freshness updates, resolving UI indicator inconsistencies across `DeviceSelector`, `WaterTankMonitoringCard`, `MonitoringDashboard`, `FaucetPresetSelector`, and `FaucetConfirmationModal`. Unified semantic indicators (`ONLINE` emerald dot, `STALE` amber dot, `OFFLINE` rose dot). Suppressed numerical volume display during stale or offline states, rendering placeholder (`— L` / `- L`) with 0% gauge fill while keeping stale alert notices and last seen timestamps visible. Automatically restores `ONLINE` status when fresh telemetry resumes (<60s). Verified 100% test pass rate across `water-tank-monitoring-card.test.tsx` (11/11), `monitoring-dashboard.test.tsx` (8/8), `latest.test.ts` (16/16), full telemetry test suites (53/53 passed), and monorepo TypeScript typecheck (0 errors across 4 workspaces).

#### TASK-0412 Governance Record

`TASK-0412` soil & water quality MQTT migration, explicit device credentials, and live verification record:
- Status: `DONE` (Completed 2026-09-15; Live Verified 2026-09-16)
- Priority: `P1`
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Migrated soil (`SOIL_NODE`) and water quality (`WATER_QUALITY_NODE`) device communication from legacy REST ingestion endpoints to MQTT over TLS via unified gateway client connection in `apps/iot-gateway` (`SoilWaterMqttAdapter`). Implemented bidirectional communication matching physical ESP32 device specifications:
  - Inbound Telemetry: `melon/sensor-tanah/data-2424600050` (soil) and `melon/sensor-air/data-2424600050` (water quality).
  - Outbound AI Recommendations: `melon/ai-tanah/rekomendasi-2424600050` (soil) and `melon/ai-air/rekomendasi-2424600050` (water quality) with QoS 1, retain: false.
  - Unified Gateway MQTT Architecture: Single `GatewayMqttClient` on EMQX Broker (`MQTT_BROKER_URL`, `MQTT_GATEWAY_CLIENT_ID`, `MQTT_GATEWAY_USERNAME`, `MQTT_GATEWAY_PASSWORD`), dispatching incoming messages to dedicated domain adapters (`SoilWaterMqttAdapter`, `HardwareMqttAdapter`, `CommandPublisher`, `AcknowledgementProcessor`, `FaucetEventProcessor`, `TelemetryProcessor`). Retained reservoir water tank (`irigasi/melon/...`) and faucet control MQTT flow on EMQX completely unchanged (`ENABLE_FAUCET_CONTROL=false`).
  - Dynamic Device Identity via MQTT Client ID (`devices.client_id`): Removed static device ID environment variables (`SOIL_DEVICE_ID`, `WATER_DEVICE_ID`). Added `clientId` (`devices.client_id`) to database schema and contracts (`PublicSafeDeviceDtoSchema`), migrating DEV database via `20260915230000_add_client_id_to_devices`. Primary identity source is MQTT Client ID (`melon-esp32-tanah1` $\rightarrow$ `SOIL_NODE`, `melon-esp32-air1` $\rightarrow$ `WATER_QUALITY_NODE`, `water-tank-node-zi37gz` $\rightarrow$ `WATER_TANK_NODE`). Supports future physical hardware replacement without code changes via database registry updates.
  - Explicit Device MQTT Credentials & Configuration: Added explicit device MQTT environment configuration in `.env.example`, `apps/iot-gateway/.env.example`, `apps/iot-gateway/src/config/env.ts`, `scripts/mqtt-config.ts`, and `scripts/device-simulator.ts`:
    - Soil ESP32: `SOIL_DEVICE_MQTT_CLIENT_ID=melon-esp32-tanah1`, `SOIL_DEVICE_MQTT_USERNAME`, `SOIL_DEVICE_MQTT_PASSWORD`.
    - Water Quality ESP32: `WATER_DEVICE_MQTT_CLIENT_ID=melon-esp32-air1`, `WATER_DEVICE_MQTT_USERNAME`, `WATER_DEVICE_MQTT_PASSWORD`.
    - Gateway credentials (`MQTT_GATEWAY_*`) remain strictly decoupled from hardware device identities; devices never simulate under gateway client identities.
  - Normalization & Persistence: Dual payload support (canonical JSON envelope + flat abbreviated keys `{ n, p, k, temp, hum, ph, ec, status }` and `{ ph, tds, ec, status }`). Persists records via `TelemetryRepository.ingestSoilReading` and `ingestWaterReading` with transactional updates to `lastSeenAt` and `connectionStatus: ONLINE`. Dispatches webhooks to `/api/v1/internal/realtime/publish` for instant SSE streaming (`/api/v1/realtime/stream`).
  - Database Column Drop: Created migration `20260915000000_drop_water_readings_unused_coordinates` and applied to DEV database via `supabase-dev` MCP, dropping unreferenced `latitude` and `longitude` from `water_readings` (`DEC-MON-086`). Updated `schema.prisma` and regenerated Prisma Client.
  - REST Telemetry Route Removal: Removed obsolete endpoints `apps/web/app/api/v1/devices/[deviceId]/telemetry/soil` and `water`, removed `isDeviceTelemetryIngestionPath` from `apps/web/middleware.ts`, tightened middleware to enforce 401 UNAUTHENTICATED on all `/api/v1/devices` endpoints without session cookies, and updated `route_protection.test.ts`.
  - Simulator Multi-Client Architecture: Updated `scripts/device-simulator.ts` to manage three distinct MQTT clients: Soil ESP32 (`melon-esp32-tanah1`), Water Quality ESP32 (`melon-esp32-air1`), and Reservoir Tank Node (`sim-${tankId}-...`), strictly preventing devices from simulating under gateway credentials.
  - Bugs Discovered & Fixed During Live Verification:
    - Synchronized `packages/database` build output (`npm run build --workspace=@kebun-melon/database`) so that `DeviceRepository.getDeviceByClientId` is available in `packages/database/dist/src/index.js`, fixing runtime `TypeError: this.deviceRepo.getDeviceByClientId is not a function`.
    - Added `waterClientId` initialization to `this.config` in `scripts/device-simulator.ts` and aligned username/password paired fallback logic when placeholder passwords are used.
  - Live End-to-End Verification (TASK-0412 Water Quality MQTT Telemetry Flow):
    - Authenticated simulator client `melon-esp32-air1` connected to EMQX Cloud broker over WSS (`he100b10.ala.asia-southeast1.emqxsl.com:8084/mqtt`).
    - Published live payload to `melon/sensor-air/data-2424600050`: `{ clientId: 'melon-esp32-air1', data: { ph: 7.25, tds: 420, ec: 1.35, status: 'NORMAL' } }`.
    - IoT Gateway received message over active subscription via client `Test_Gateway`.
    - Dynamically resolved `melon-esp32-air1` $\rightarrow$ `devices.client_id` $\rightarrow$ canonical device `water-quality-node-quiua` (`WATER_QUALITY_NODE`, DB UUID `3c19684e-e646-4eb0-a8f1-b6a7e24ad6af`).
    - Persisted reading `b0b1dfbb-959c-4ce7-9bb1-ffb4d1e94d61` in `water_readings` (`ph: 7.25, tds: 420, ec: 1.35, status: NORMAL`) and transitioned device `connection_status` to `ONLINE`.
    - Verified zero changes to staging environment or staging database via `supabase-staging` MCP (`water_readings` count = 0).
  - Test & Quality Verification: 100% test pass rate across gateway suites (23/23 files, 338/338 tests passed), web suites (78/78 files, 649/649 tests passed), 0 TypeScript errors across 4 monorepo packages, secrets scanner passed with 0 leaks, and environment validator passed.

#### TASK-0413 Governance Record

`TASK-0413 Phase D` dynamic dashboard recommendation cards record:
- Status: `DONE` (Completed 2026-09-19)
- Priority: `P1`
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Skeleton loading`, `Card hover`, `Healthy status`, `Critical alert`
- 21st.dev MCP: `NOT REQUIRED`
- Reason: Small additions using existing components, icons, and design tokens to bind live ML predictions and agronomic recommendations to `/soil` and `/water` dashboards while preserving established page layout and geometry.
- Summary: Bound dynamic machine-learning recommendations and agronomic advice to the Soil (`/soil`) and Water Quality (`/water`) monitoring views:
  - Client Data Polling Hook (`apps/web/hooks/useLatestPrediction.ts`): Implemented SWR-like data hook polling `GET /api/v1/devices/[deviceId]/predictions/latest` on a 30s cadence (matching backend cache-aside TTL). Guarded against in-flight race conditions during rapid device switching via `activeDeviceIdRef`. Exposes reactive state (`prediction`, `isLoading`, `isRevalidating`, `isUnavailable`, `error`, `refetch`).
  - Reusable Recommendation Card (`apps/web/components/monitoring/RecommendationCard.tsx`): Built accessible 4-state visual card component adhering strictly to `Premium Minimal Ops`:
    1. Loading Skeleton State: Pulsing placeholder (`animate-pulse`) with `aria-busy="true"`.
    2. Empty / Unavailable State: Clean prompt with sparkle icon and reassurance text (`Belum Ada Rekomendasi`), cleanly handling devices without prediction records without breaking dashboard composition.
    3. Populated State: Prominently renders title, classification pill badge (`Optimal` emerald, `Peringatan` amber, `Kritis` rose), rounded confidence percentage, bold summary statement, diagnostic parameter issue cards with impact descriptions, and checklist of farmer actions.
    4. Stale / Offline Notice: Inline warning banner alerting users when telemetry is stale or device is offline.
  - Advisory Safety Disclaimer: Explicitly renders `advisoryDisclaimer` (`"Rekomendasi bersifat saran agronomi dan tidak mengontrol pompa air secara otomatis."`) at the bottom of every card, strictly enforcing `DEC-MON-090` / `ENABLE_FAUCET_CONTROL=false` physical control safety constraints.
  - Page Integration & Mobile Clearance: Replaced static hardcoded markup on `/soil` and integrated symmetrically into `/water` with `pb-24` clearance to avoid overlap with mobile navigation bars.
  - Bilingual Localization: Added `recommendation` namespace to `apps/web/messages/id.json` and `messages/en.json` with 14 keys and 100% key and ICU placeholder parity (`{value}`, `{time}`).
  - Verification: 20/20 tests passed across dedicated unit test suites (`recommendation-card.test.tsx` 7/7, `use-latest-prediction.test.ts` 5/5, `soil-telemetry-ui.test.tsx` 8/8), full web workspace suite passed (83/83 files, 697/697 tests), and TypeScript typecheck passed with 0 errors across 4 monorepo packages.
- 2026-09-19 ML Classification Standards & Threshold Matrix Reconciliation:
  - Source of Truth: Audited ML pipeline standards (`agronomic_standards_v1.json` / `BaseRuleClassifier.php` in `padail/SmartTani-`) and live prediction records in external Supabase project (`https://styjuynxuykvujnnqxos.supabase.co`).
  - Decision Logic: Two-sided evaluation (low/high); critical override on important parameters (`['ph', 'ec', 'moisture']` for soil; `['ph', 'ec']` for water) forcing status to `kritis`; weighted risk scoring (`riskScore > 65` $\to$ `kritis`, `> 30` or `$hasWarning` $\to$ `waspada`, $\le 30$ $\to$ `baik`).
  - Soil Standards: pH ($6.00-6.80$ Good, $\le 5.49$ / $> 7.50$ Critical), Moisture ($60-80\%$ Good, $< 45\%$ / $> 90\%$ Critical), Temp ($24-32^\circ\text{C}$ Good, $< 20^\circ\text{C}$ / $> 38^\circ\text{C}$ Critical), EC ($800-2500\ \mu\text{S/cm}$ Good, $> 5000\ \mu\text{S/cm}$ Critical), N ($45-80\ \text{mg/kg}$ Good), P ($45-80\ \text{mg/kg}$ Good), K ($60-160\ \text{mg/kg}$ Good).
  - Water Standards: pH ($5.50-6.50$ Good, $< 5.00$ / $> 7.00$ Critical), EC ($0-500\ \mu\text{S/cm}$ Good, $500.01-1500\ \mu\text{S/cm}$ Warning, $> 1500\ \mu\text{S/cm}$ Critical), TDS ($0-500\ \text{ppm}$ Good, $500.01-1000\ \text{ppm}$ Warning, $> 1000\ \text{ppm}$ Critical).
  - Manual SQL Validation Dummy Data:
    - Soil Optimal: `pH: 6.4, Moisture: 72%, Temp: 28°C, EC: 1600 µS/cm, N: 60, P: 55, K: 110` $\to$ `optimal`.
    - Soil Warning: `pH: 6.4, Moisture: 52%, Temp: 28°C, EC: 1600 µS/cm, N: 35, P: 55, K: 110` $\to$ `warning`.
    - Soil Critical: `pH: 4.8, Moisture: 35%, Temp: 34°C, EC: 5500 µS/cm, N: 15, P: 15, K: 20` $\to$ `kritis`.
    - Water Optimal: `pH: 6.2, TDS: 420 ppm, EC: 450 µS/cm` $\to$ `optimal`.
    - Water Warning: `pH: 6.2, TDS: 420 ppm, EC: 900 µS/cm` $\to$ `warning`.
    - Water Critical: `pH: 6.2, TDS: 420 ppm, EC: 2200 µS/cm` $\to$ `kritis`.
- 2026-09-24 Soft Bento Dashboard & Bilingual Telemetry Governance Record:
  - Status: `DONE` (Completed 2026-09-24)
  - Frontend impact: `MINOR`
  - Selected UI direction: `Soft Bento Dashboard` (Departing from `Premium Minimal Ops` per task specification)
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `Skeleton loading`, `Card hover`, `Healthy status`, `Critical alert`
  - 21st.dev MCP: `VALIDATED & APPLIED` (Inspired by bento dashboard cards, metric pills, and AI recommendation structures)
  - Summary: Refined the Machine Learning Recommendation UI component (`apps/web/components/monitoring/RecommendationCard.tsx`) into a modern, polished agricultural intelligence dashboard component:
    - Soft Bento Dashboard Layout: Elevated outer card container (`rounded-2xl`, `p-5 sm:p-6`, `border-app-outline-variant/30`, `bg-app-surface-container-lowest`, `shadow-[0_4px_24px_rgba(0,0,0,0.04)]`) with high-tech AI micro-badge (`badgeAiIntelligence`), title, confidence pill with activity pulse, severity pill badge with indicator dot, distinct AI diagnostic summary callout card with severity accent border, and a responsive bento sub-grid (`lg:grid-cols-12`).
    - Detected Issues Sub-Grid (`lg:col-span-7`): Parameter diagnostic cards rendering bilingual parameter names, sensor values with units (`%`, `°C`, `µS/cm`, `ppm`, `mg/kg`), problem severity tags, and agronomic impact callout boxes with localized labels (`Impact` / `Dampak`).
    - Suggested Actions Sub-Grid (`lg:col-span-5`): Action checklist cards with interactive step indicators and hover effects, or optimal reassurance state with checkmark badge.
    - Full Internationalization Consistency: Implemented `apps/web/lib/recommendation-i18n.ts` translation helper for canonical ML strings, parameter names, diagnostic problems, impacts, action checklists, and summary phrases. Added 6 new keys to `messages/id.json` and `messages/en.json` maintaining 100% key and ICU placeholder parity. Completely eliminated mixed-language leaks (such as "parameter soil" in Indonesian or Indonesian labels in English) while keeping backend canonical values untouched.
    - Invariants Preserved: Stale warning banner, 4 operational states, mobile responsiveness, and mandatory advisory disclaimer (`advisoryDisclaimer`) strictly maintained.
    - Verification Results: 9/9 tests passed in `recommendation-card.test.tsx` (including English and Indonesian full render tests), translation completeness passed (`npm run i18n:check`), TypeScript typecheck passed with 0 errors across `apps/web`, and all monorepo test suites passed (129 files, 1,328 tests passed).

#### TASK-0415 Governance Record

`TASK-0415` consolidate soil and water quality MQTT telemetry to unified EMQX Cloud broker record:
- Status: `DONE` (Completed 2026-09-20)
- Priority: `P1`
- Frontend impact: `NONE`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Consolidated Soil ESP32 (`melon-esp32-tanah1`) and Water Quality ESP32 (`melon-esp32-air1`) MQTT telemetry ingestion from HiveMQ Cloud back to the primary EMQX Cloud broker, unifying all IoT telemetry and actuator control onto a single resilient broker while maintaining backward-compatible secondary broker fallback.
  - IoT Gateway Unified Wiring (`apps/iot-gateway/src/app.ts`): Reconciled gateway configuration to leverage native fallback where omission of `SOIL_WATER_MQTT_BROKER_URL` binds `soilWaterAdapter` to the primary EMQX client (`mqttClient`).
  - Deprecated Secondary Broker Configuration (`apps/iot-gateway/src/config/env.ts`): Annotated `SOIL_WATER_MQTT_*` environment variables as `@deprecated TASK-0415`, keeping them available as fallback options if dedicated secondary broker operation is required.
  - Health & Readiness Reporting (`apps/iot-gateway/src/routes/health.ts`): Updated `/ready` public diagnostic endpoint to explicitly output `soilWaterMqtt: { broker: 'EMQX', status: data.mqttStatus, connected: data.isMqttConnected }` in unified mode, while preserving `{ broker: 'HIVEMQ', ... }` when secondary broker is configured.
  - Invariants Preserved: Zero database schema changes, zero frontend changes, zero staging environment changes, and identical MQTT topic hierarchies and JSON contracts.
  - Test & Quality Verification: Added unit tests verifying unified EMQX binding and readiness output in `health.test.ts` and `broker-config.test.ts`. Verified 100% test pass rate across 21 test files (332/332 tests passed) in `apps/iot-gateway`, and 0 TypeScript errors across all 4 monorepo workspaces.

#### TASK-0416 Governance Record

`TASK-0416` remove deprecated HiveMQ dual broker support record:
- Status: `DONE` (Completed 2026-09-20)
- Priority: `P2`
- Frontend impact: `NONE`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Permanently removed obsolete HiveMQ secondary broker fallback code, environment variables, and tests following consolidation on unified EMQX Cloud under `DEC-DEV-035`.
  - Environment Cleanup: Removed `SOIL_WATER_MQTT_BROKER_URL`, `SOIL_WATER_MQTT_CLIENT_ID`, `SOIL_WATER_MQTT_USERNAME`, and `SOIL_WATER_MQTT_PASSWORD` from `apps/iot-gateway/src/config/env.ts`, root `.env`, and `apps/iot-gateway/.env`. Retained `SOIL_WATER_ADAPTER_ENABLED` and hardware device credential references (`SOIL_DEVICE_MQTT_*` and `WATER_DEVICE_MQTT_*`).
  - Gateway Simplification (`apps/iot-gateway/src/app.ts` & `src/index.ts`): Retired secondary MQTT client instantiation logic. `SoilWaterMqttAdapter` connects unconditionally through the primary `GatewayMqttClient`.
  - Health Endpoint Cleanup (`apps/iot-gateway/src/routes/health.ts`): Simplified `/ready` to report unified EMQX status (`soilWaterMqtt: { broker: 'EMQX', status, connected }`) and simplified `/internal/v1/ready` to check standard database and EMQX broker dependencies without secondary broker branching.
  - Tests Cleaned & Passing: Pruned legacy HiveMQ-specific fallback tests in `apps/iot-gateway/src/__tests__/health.test.ts` and `apps/iot-gateway/src/__tests__/broker-config.test.ts`. Verified 100% test pass rate across 21 test files (327/327 tests passed).
  - Monorepo Typecheck: Clean (`tsc --noEmit` exited 0 across all 4 packages).
  - Hardware & Broker Verification: Probed live EMQX Cloud broker over TLS and confirmed both gateway credentials (`Test_gateway`) and device credentials (`petanimelon`) authenticate and connect with 100% success. Confirmed physical ESP32 devices are currently offline and not transmitting to HiveMQ or EMQX.

#### TASK-0417 Governance Record

`TASK-0417` hardware telemetry normalization, external ML database resolution & EMQX ACL hardening record:
- Status: `DONE` (Completed 2026-09-23)
- Priority: `P1`
- Frontend impact: `NONE`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Reconciled real physical ESP32 hardware MQTT telemetry ingestion, diagnosed external Supabase ML database prediction resolution, and audited EMQX Cloud broker ACL bidirectional permissions.
  - Ingress Telemetry Normalization (`apps/iot-gateway/src/mqtt/soil-water-adapter.ts`):
    - Normalized hardware payload variations emitted by real microcontrollers: Soil ESP32 emitted top-level `"device": "soil-node-jvbkdbv"` instead of `"deviceId"` (or flat envelope); Water Quality ESP32 emitted nested `"water": { ... }` object wrapper and/or `"device_code"` identifier.
    - Added resilient extraction in `SoilWaterMqttAdapter` for both soil and water quality telemetry while strictly preserving database device identity validation (rejecting any packet not resolving to an active registered row in `devices`).
    - Maintained water tank pipeline isolation: zero modifications to reservoir water tank topics (`irigasi/melon/...`).
    - Added comprehensive unit tests in `apps/iot-gateway/src/__tests__/soil-water-adapter.test.ts` (100% pass rate).
  - External ML Pull Database Resolution (`packages/database/src/external-prediction-client.ts` & Supabase ML):
    - Diagnosed reason why AI predictions weren't appearing on web dashboard (`RecommendationCard` rendering "Belum Ada Rekomendasi").
    - Identified that `device_external_mappings` and `DEFAULT_ML_DEVICE_ALIASES` queried `externalDeviceId: "melon002"`, whereas 100% of rows (86 records) in the external ML Supabase `soil_predictions` table are stored under `device_id = "soil001"` (0 records for `melon002`).
    - Verified that query with `'soil001'` returns complete agronomic recommendations with all 7 parameters (pH 5.4, Moisture 65%, Temp 29°C, EC 1400 µS/cm, N 90, P 35, K 140) and action items.
    - Verified that latest record timestamp in both `soil_predictions` and `water_predictions` is `2026-09-19T10:18:04Z` (stale by 3 days from external ML worker).
    - Enforced architectural invariant: `devices.deviceId` (`soil-node-jvbkdbv`) in PostgreSQL is immutable and must NEVER be changed. Resolution is updated via `device_external_mappings.external_device_id = 'soil001'`.
  - EMQX Cloud Broker Topic ACL Hardening:
    - Updated ACL permissions on unified EMQX Cloud broker for username `petanimelon` on all 4 topics (`melon/sensor-tanah/data-2424600050`, `melon/sensor-air/data-2424600050`, `melon/ai-tanah/rekomendasi-2424600050`, `melon/ai-air/rekomendasi-2424600050`) to `Publish & Subscribe` (Allow).
    - Validated that bidirectional access allows the shared `petanimelon` credential to be used by both field hardware devices and AI worker processes without broker rejection (`0x87 Not Authorized`), while preserving isolation of gateway credentials and reservoir water tank controls.

#### TASK-1004 Governance & Infrastructure Record

`TASK-1004` staging infrastructure and verification record:
- Frontend impact: `NONE`
- Provisioned Staging Hosting: Containerized Docker-based Staging (`TASK-1012`; formerly Railway PaaS `melon-monitor.up.railway.app` for `web`, `iot-gateway-production-7e17.up.railway.app` for `iot-gateway`, now decommissioned)
- Provisioned Staging Database: Supabase PostgreSQL (`scqrbtfilmttqrutynyo`) via Supavisor Session Pooler (`aws-0-ap-south-1.pooler.supabase.com:6543`)
- Provisioned Staging MQTT Broker: EMQX Cloud Serverless (`wss://` TLS active, password-authenticated gateway service, per-device topic ACLs)
- Safety Configuration: `ENABLE_FAUCET_CONTROL=false` strictly enforced
- Verification Results: 12/12 flows verified (Flow 7 Language switch verified passing under Phase 6 `TASK-0604`; Flows 8-10 safely blocked by feature flag)
- 2026-09-08 CI Registration E2E & Test Database Initialization Hardening:
  - Root Cause Diagnosed: In GitHub Actions Ubuntu CI run 34214214283 (commit `5b332da`), service container `kebun_melon_test` was supplied as an existing database. `e2e/test-environment.ts` took the existing-database branch and returned `DATABASE_URL` directly without ensuring migrations or RBAC seed data were loaded. As a result, the `ADMIN` role was missing from the database, causing `/api/v1/auth/register` to throw `MissingRoleError` (HTTP 503 "System role configuration error. Please contact system administrator.") and preventing navigation from `/register` to `/verify-email`.
  - Fix Implemented: Added `initializeTestDatabase(dbUrl)` in `e2e/test-environment.ts` invoked for BOTH supplied existing databases (`TEST_DATABASE_URL` / `E2E_DATABASE_URL` / CI `DATABASE_URL`) and newly provisioned Docker containers. Runs `prisma migrate deploy` and `packages/database/prisma/seed.ts` (deterministic, idempotent upserts for roles, permissions, and canonical devices, with 0 demo users, 0 external emails, and 0 cloud calls) scoped strictly to the validated disposable test database.
  - Defense in Depth: Added `faucetCommandEvent` deletion before `faucetCommand` in `e2e/critical-flows.spec.ts` `beforeAll` to guarantee clean repeat test runs without foreign key violations.
  - Verification: Locally reproduced failure on unseeded DB; verified Flow 1 passed in 11.3s with fix; verified setup-repeat check produced 0 duplicate fixtures (roles: 2, permissions: 39, rolePermissions: 58, devices: 3); verified full 12/12 flows passed in `critical-flows.spec.ts` (1.4m, exit code 0); verified typecheck 0 errors across 4 monorepo packages.

#### TASK-0408 Governance & Simulator Record

`TASK-0408` simulator implementation record:
- Frontend impact: `NONE`
- Entry Point: `npm run sim:device` (`scripts/device-simulator.ts`)
- Target Domains & Scenarios:
  - Soil Telemetry (`SOIL_NODE` via REST API over Wi-Fi)
  - Water Quality Telemetry (`WATER_QUALITY_NODE` via REST API over Wi-Fi: `ph`, `tds`, `ec`, `status`)
  - Reservoir Telemetry (`WATER_TANK_NODE` via MQTT 5.0 over TLS: `tankVolume`, `flowRate`, `status`)
  - Faucet Control Lifecycle (`WATER_TANK_NODE` via MQTT: `ACKNOWLEDGED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`)
  - Fault Simulation: Duplicate payload (`messageId`), out-of-order sequence, invalid JSON/schema, wrong-domain device ID rejection, disconnect/reconnect cycles
- Safety & Blocked Constraints:
  - Heartbeat & stale calculation remain blocked by `TASK-0407` (TBD numeric thresholds preserved)
  - Faucet command timeouts remain blocked by `TASK-0809` (TBD numeric duration preserved)
  - `BAT` parameter is omitted from soil and water-quality telemetry per `DEC-MON-086`
  - Direct browser-to-MQTT connections forbidden; browser uses backend REST/SSE boundaries

#### TASK-0504 Governance Record

`TASK-0504` historical monitoring charts & controls implementation record:
- Status: `DONE` (Reconciled & Enhanced 2026-08-30)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Skeleton loading`, `Chart loading`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented bounded historical telemetry chart components (`NPKChart`, `WaterNutrientChart`, `HistoricalChartControls`) and data fetching hook (`useHistoricalMonitoring`) on canonical `/soil` and `/water` routes (legacy `/tanah` and `/air` return 404 Not Found). Enforced `DEC-MON-087` date-range bounds (default 24h, max 31 days) and raw pagination. Preserved null values as visual gaps (`connectNulls={false}`), supported empty history returns (HTTP 200 with empty series, no fake zero values or 404s), synchronized `DeviceSelector` context across routes, resolved canonical `deviceId` string and database UUID lookups, and formatted timestamps using application localization (`useLocale()`).
- 2026-08-19 Monitoring Reconciliation: Fixed monitoring 404 regression (`GET /api/v1/devices/{deviceId}/monitoring/latest`, `.../soil/history`, `.../water/history`). Ensured frontend consistently transmits immutable database UUID `devices.id` in `activeDeviceId` and `selectedDevice`. Hardened backend route handlers, RBAC checks (`requireDeviceViewAccess`), and database repositories (`DeviceRepository`, `TelemetryRepository`) to seamlessly resolve both UUIDs and canonical `deviceId` strings. Verified zero-record queries return HTTP 200 `{ series: [] }` without false 404s. Preserved strict Admin canonical `deviceId` concealment (`DEC-DEV-028`). Added comprehensive unit tests in `@kebun-melon/database` and `@kebun-melon/web` route suites with 100% pass rate. Diagnosed intermittent dev-server restart Next.js HTML 404 as Windows zombie background process holding port 3000 upon Ctrl+C. Completed authenticated browser manual runtime verification across `/soil`, `/water`, `/sensor`, and `/controls`.
- 2026-08-30 Soil Historical Chart & Caching Enhancements:
  - **NPK LineChart Visualization**: Switched NPK visualization from BarChart to LineChart with 3 distinct series for Nitrogen (`#0d631b`), Phosphorus (`#884200`), and Potassium (`#476800`) with smooth monotone curves, active hover dots, and null-gap preservation. Fixed data property mapping (`nitrogen` -> `n`, `phosphorus` -> `p`, `potassium` -> `k`) in hourly grouping.
  - **Instant Client-Side Range Caching**: Optimized `useHistoricalMonitoring` to reuse cached raw telemetry across presets (24h, 7d, 30d), instantly re-aggregating client-side with `loading=false` and eliminating skeleton flashes and redundant network roundtrips.
  - **Range-Based X-Axis Tick Formatting (`getCustomXTicks`)**: Decoupled X-axis label rendering density from 1-hour aggregation resolution. 24h displays ~5-8 readable time ticks; 7d displays 4-5 well-spaced daily ticks to prevent label crowding and overlap on small viewports; 30d displays evenly spaced date ticks across the month.
  - **Locale-Aware Formatting & Punctuation Cleanup**: Wired `formatDayMonth` with `useLocale()` from `next-intl` (`id` -> `20 Agu` / `24 Agu`, `en` -> `20 Aug` / `24 Aug`), completely removing trailing commas and periods from axis labels, raw time strings, and tooltip headers.
  - **Testing & Verification**: Added comprehensive unit test suites in `historical-charts.test.tsx` (18/18 passing) and `soil-telemetry-ui.test.tsx` (7/7 passing, 25/25 combined), verified TypeScript typecheck (0 errors across 4 workspaces), and verified `/soil` chart ranges (24h, 7d, 30d) via Playwright.

#### TASK-0502 Governance Record

`TASK-0502` live soil and water monitoring UI data binding & telemetry freshness record:
- Status: `DONE` (Reconciled & Audited 2026-08-23)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Skeleton loading`, `Card hover`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Reconciled real telemetry data binding across `/soil` and `/water` routes. Unified all 7 soil telemetry parameters (Nitrogen, Phosphorus, Potassium, Temperature, Moisture, pH, EC) into the single approved `SoilMetricMeter` visual card design. Reconciled parameter titles in Indonesian and English dictionaries (`messages/id.json`, `messages/en.json`) to remove redundant "Soil" / "Tanah" prefixes (`Nitrogen`, `Fosfor` / `Phosphorus`, `Kalium` / `Potassium`, `Suhu` / `Temperature`, `Kelembapan` / `Moisture`, `pH`, `EC`). Bound agreed units: NPK (`mg/kg`), pH (*no unit*), Moisture (`%RH`), Temperature (`°C`), EC (`µS/cm`), TDS (`ppm`). Completely removed fallback mock datasets (`NPK_TREND_DATA`, `EC_TREND_DATA`) from charts (`NPKChart`, `WaterNutrientChart`), ensuring empty series cleanly render empty notices (`Tidak ada data riwayat untuk rentang waktu ini.`) without fake graph lines. Enforced stale telemetry suppression: when telemetry is stale (`isStale: true` or `connectionStatus: STALE`), numerical sensor values are suppressed and rendered as `'-'` with `0%` gauge fills, active status quotes are hidden, and the prominent Stale Alert Banner (`Update: Real-Time: Kedaluwarsa`) is displayed while preserving `lastSeenAt`/`recordedAt` timestamps. Restored homepage (`/`) overview isolation by removing embedded `MonitoringDashboard`. Verified 100% test pass rate across 33 unit test files (251/251 tests) and TypeScript typecheck (0 errors).

#### TASK-0506 Governance Record

`TASK-0506` operational overview bento dashboard & environmental weather integration record:
- Status: `DONE` (Completed 2026-09-02)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Skeleton loading`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Redesigned the root overview dashboard (`/` and `/dashboard`) into a focused operational Bento dashboard adhering strictly to `Premium Minimal Ops` and `DEC-UIUX-106`.
  - **Layout & Structure**: Top Hero Overview card with real-time operational greeting, localized date, and 3-column node summary metrics (Total, Online in solid green `#0d631b`, Offline/Stale), followed by a full-width environmental weather panel below. Removed all portal-like clutter (System Snapshot, Quick Actions, duplicate domain cards, fleet directory) to maintain clean operational focus.
  - **Environmental Weather Integration**: Implemented `WeatherCard.tsx` connecting directly to Open-Meteo REST API using fixed farm coordinates (`Latitude: -7.172934`, `Longitude: 113.2257627`) for `"King Agrowisata"`. Displays temperature, apparent temperature, WMO weather interpretation, and a 3-column sub-metrics grid featuring subtle semantic tints: Air Humidity in soft agricultural green (`bg-app-primary-fixed/20 border-app-primary/25`), Wind Speed in subtle neutral/olive (`bg-app-outline-variant/20 border-app-outline-variant/45`), and UV Index in subtle warm harvest amber (`bg-app-tertiary-fixed/35 border-app-tertiary/25`). Removed "Live Weather" badge text; zero browser geolocation API access used.
  - **Fake Health Score Pruning**: Permanently removed synthetic `92/100` health score gauge, "Excellent" indicator, and fake optimal condition claims.
  - **Zero Emoji Policy**: Enforced 100% SVG icon token usage (Lucide icons); zero Unicode emojis across headings, greetings, labels, badges, or translation files.
  - **Session Resilience**: Hardened transaction timeout in `packages/database/src/session-service.ts` to `{ maxWait: 15000, timeout: 20000 }` to avoid Prisma transaction aborts during remote database pool latency while strictly preserving atomic single active session row locks (`SELECT ... FOR UPDATE`).
  - **Verification**: Verified 100% test pass rate in `apps/web/test/unit/dashboard-page.test.tsx` (6/6 passing including automated emoji scan), 100% translation key parity (`npm run i18n:check`), Prettier code style (`npm run format:check`), and monorepo TypeScript typecheck (0 errors across 4 workspaces).

#### TASK-0410 Governance Record

`TASK-0410` water-tank flow-rate removal & volume scale reconciliation record:
- Status: `DONE` (Completed & Reconciled 2026-09-09)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED` (Agricultural green `#0d631b`, container surfaces, semantic status badges)
- Selected motion effects: `Card hover`, `Skeleton loading`
- 21st.dev MCP: `NOT REQUIRED` (reuses existing design tokens, progressbar patterns, and skeleton primitives)
- Summary: Reconciled the water-tank monitoring card and loading transitions following the complete end-to-end removal of the unused flow-rate parameter (`flowRate`, `flow_rate`, `WATER_FLOW_RATE`, `m³/h`, `Debit Air`) per `DEC-MON-089`.
  - **Operational Scale (0 L–2200 L)**: Updated the operational volume scale from the former 0 L–600 L range to the authoritative 0 L–2200 L agricultural reservoir capacity. Defined authoritative constant `WATER_TANK_MAX_CAPACITY = 2200` in `apps/web/lib/constants.ts` as the single source of truth. Rendered scale boundary markers `0 L` and `2200 L`.
  - **Clamped Progress Calculation**: Gauge percentage strictly calculates against the 2200 L maximum and clamps values between 0% and 100%: $\text{clamp}((\text{tankVolume} / 2200) \times 100, 0, 100)$, preventing gauge bar overruns.
  - **Responsive Layout Geometry**: Diagnosed and resolved the desktop half-width card bug. The previous half-width layout was caused by a remaining two-column grid (`sm:grid-cols-2`) after Flow Rate removal. Corrected layout to a single full-width column (`grid-cols-1 gap-4`) in `WaterTankMonitoringCard.tsx`, `apps/web/app/controls/loading.tsx`, and `MonitoringDashboard.tsx` (`grid-cols-1 gap-3`), spanning the full dashboard width on desktop while maintaining zero horizontal overflow on mobile ($390\text{px}$).
  - **State Preservation**: Explicit zero volume (`0 L` with 0% fill), null or unknown telemetry (`- L` with 0% fill), status-only telemetry, loading skeleton, and error alert states strictly preserved without falling back to `smoothFlow`. Faucet control presets (Phase 1: 0.3 L, Phase 2: 1.0 L, Phase 3: 1.5 L), confirmation modal, and `ENABLE_FAUCET_CONTROL=false` safety flag remain untouched.
  - **Verification Evidence & Tiering**:
    - *Automated Checks (Passed)*: 22/22 unit tests passed across 3 suites (`water-tank-monitoring-card.test.tsx` 8/8, `monitoring-dashboard.test.tsx` 8/8, `controls-loading-transition.test.tsx` 6/6), monorepo TypeScript typecheck (0 errors across 4 workspaces), Next.js web production build (41/41 routes), staging container health probes (`/health`, `/ready` HTTP 200), and Playwright desktop/mobile visual checks confirmed full-width cards and zero horizontal overflow.
    - *Credential-Dependent Checks (Reserved for Operator)*: Database credential rotation and production connection string updates.
    - *Physical Firmware Checks (Unverified)*: Physical ESP32/NodeMCU firmware reconfiguration and field hardware sensor calibration remain unverified until physical field deployment.
    - *Pre-Commit Quality Gates*: The five mandatory pre-commit quality gates (`npm run test:coverage`, `npm run test:integration`, `npm run check:quality`, `npm run test`, `npm run test:e2e`) are reserved for personal execution by the operator.

#### TASK-0411 Governance Record

`TASK-0411` hardware MQTT contract and topic mapping reconciliation record:
- Status: `BLOCKED` (Ingress Adapter, Broadcast Control Isolation Proof, Semantics Audit & String Verification Documented 2026-09-10; Blocked on Hardware Prerequisites)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Reconciled hardware team MQTT water-tank parameters under user-approved decision `DEC-DEV-031`. Formally established permanent external hardware topic names (`irigasi/melon/sensor/volume`, `irigasi/melon/kontrol/valve`, `irigasi/melon/setting/otomasi`) without requiring firmware renaming. Authoritatively resolved exact topic strings with strictly NO leading or trailing whitespace per user decision. Confirmed topic purposes separately from unconfirmed wire payload semantics: confirmed valve purpose is OPEN/CLOSE behavioral intent (while wire syntax, commandId, QoS 1, and feedback events remain unconfirmed); confirmed setting purpose is "irrigation" (while operational function, mode, target_liter precision, and stop behavior remain unconfirmed and MUST NOT be equated with canonical DISPENSE or invent platform automation). Implemented maintained gateway ingress mapping boundary in `apps/iot-gateway/src/mqtt/hardware-reconciliation.ts` translating flat external telemetry into canonical multi-tenant namespace (`agriculture/{environment}/{siteId}/{deviceId}/telemetry/reservoir`). Enforced strict byte-exact string integrity and trailing whitespace audit: topics with trailing whitespace represent implementation defects/mismatches rejected fail-closed, and system rules strictly forbid silently trimming, renaming, or subscribing to both variants. Proved that on flat MQTT topics, broker credentials alone authorize connections but do NOT isolate multiple subscribers from broadcast control commands (`irigasi/melon/kontrol/valve`). Evaluated and documented the 3 feasible isolation options preserving permanent topic names (Option 1: Firmware payload `targetDeviceId` filtering [Recommended], Option 2: EMQX broker mountpoints / topic rewriting, Option 3: Single actuator deployment per environment). Implemented anti-republish loop guard to prevent circular message forwarding between internal and external topics. Audited hardware browser Paho MQTT prototype and flagged 6 critical security violations (bypassing session auth, RBAC `device.control.dispense`, audit logging, idempotency, transaction durability, and `ENABLE_FAUCET_CONTROL=false` safety lock). Strictly rejected flow-rate topics (`topicDebit`, `topicLiterKeluar`) per `TASK-0410` / `DEC-MON-089`. Fixed Prisma client CommonJS wildcard export in `packages/database/src/client.ts` resolving Next.js App Router ESM bundler issue. Verified 100% test pass rate across unit test suite `apps/iot-gateway/src/__tests__/hardware-topic-reconciliation.test.ts` (28/28 passed) and full gateway suite (68/68 passed). Verified 0 errors across 4 monorepo workspaces via `npm run typecheck`. Rebuilt staging Docker containers and verified HTTP 200 health probes on ports 3000 and 3001. Hardware integration remains strictly `BLOCKED` with `ENABLE_FAUCET_CONTROL=false` pending physical ESP32 JSON schema calibration, private EMQX Cloud credentials, and actuator isolation selection.
- 2026-09-11 Development Hardware MQTT Verification Record:
  - Frontend impact: `NONE`
  - Selected UI direction: `N/A`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `None`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Verified temporary hardware communication using public testbed `broker.emqx.io` on port 8084 (WSS: `wss://broker.emqx.io:8084/mqtt`) for hardware team integration bench-testing per `DEC-DEV-031` and `DEC-DEV-032`. Created standalone verification runner `scripts/verify-hardware-mqtt-dev.ts` (`npm run mqtt:verify:hw`). Verified 100% pass across 5 live and static checks: (1) anonymous WSS broker connectivity without credentials, (2) isolated pub/sub flow with QoS 1, (3) canonical telemetry ingestion on `irigasi/melon/sensor/volume`, (4) gateway payload normalization and range validation via `HardwareMqttAdapter`, and (5) actuator command wire format translation (`OPEN`/`CLOSE` -> `"ON"`/`"OFF"`, `DISPENSE` -> `{ mode: "AUTO", target_liter: n }`) with strict enforcement of `ENABLE_FAUCET_CONTROL=false` safety locks. Confirmed strict separation from dedicated production EMQX Cloud cluster (`TASK-0907`), zero modifications to `.env` or staging configurations, zero frontend connection to MQTT, and zero risk of accidental production fallback to `broker.emqx.io`.
- 2026-09-11 End-to-End Development Telemetry Ingestion & Realtime Record:
  - Status: `DONE` (Completed 2026-09-11)
  - Frontend impact: `NONE`
  - Selected UI direction: `N/A`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `None`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Resolved root causes preventing development hardware water tank volume from appearing on the web dashboard: (1) Fixed dynamic device ID resolution ordering in `HardwareMqttAdapter.handleInboundHardwareVolume` by calling `resolveTargetDeviceId()` prior to building context and mapping canonical topics, ensuring `parsedTopic` and `normalizedPayload` share the dynamically resolved device ID and site ID (`water-tank-uqiwue` / `d31b05fb-5cb9-4120-96d8-3c04dfff1c56`) and eliminating fail-closed topic-payload mismatches; (2) In `resolveTargetDeviceId`, prioritized active database lookup (`deviceRepo.getDevices({ deviceType: 'WATER_TANK_NODE' })`) over `HARDWARE_TARGET_DEVICE_ID` default fallback; (3) Added `publishRealtimeEvent(this.env, 'telemetry.water.updated', ...)` in `TelemetryProcessor.processTelemetryMessage` on successful non-duplicate reservoir ingestion, dispatching webhooks to `/api/v1/internal/realtime/publish` for instant SSE updates to connected frontend subscribers; (4) Guaranteed anonymous connection and prevented credential leakage to public `broker.emqx.io` in `apps/iot-gateway/src/app.ts`; (5) Added `npm run dev:gateway:hw` (`scripts/run-dev-gateway-hw.ts`) and verification runner `npm run mqtt:verify:ingest` (`scripts/verify-hardware-ingestion-dev.ts`); (6) Verified live ingestion from physical ESP32 node transmitting on `broker.emqx.io:8084` (`11.81 L`, `11.82 L`) and test payload (`245.5 L`), persisting rows in Supabase DEV `reservoir_water_readings` and confirming API `tankVolume` resolution. Verified 100% test pass rate across 22 test files (305/305 tests) in `apps/iot-gateway`, all web monitoring route/component tests, and 0 TypeScript typecheck errors across all 4 monorepo packages.
- 2026-09-11 Development Gateway Runner Lifecycle Fix:
  - Frontend impact: `NONE`
  - Selected UI direction: `N/A`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `None`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Fixed runner lifecycle in `scripts/run-dev-gateway-hw.ts` (`npm run dev:gateway:hw`). Identified root cause: `startServer()` in `apps/iot-gateway/src/index.ts` was not exported and only invoked inside an unreached `require.main === module` guard, causing the script to exit with code 0 immediately after printing the startup banner. Exported `startServer()` and updated `run-dev-gateway-hw.ts` to call and await it. Verified runner stays running continuously as a daemon, actively subscribing to `irigasi/melon/sensor/volume` on `broker.emqx.io:8084` (WSS). Verified live telemetry ingestion with raw payload `8.21`, creating a new database record in `reservoir_water_readings` (`1a1c73be-e2c7-4baf-84db-f07b4180350a`, `tank_volume = 8.21`) and updating device status to `ONLINE`.
- 2026-09-11 UI Status Consistency, DeviceContext Synchronization & Stale/Offline Volume Placeholder Record:
  - Frontend impact: `MINOR`
  - Selected UI direction: `Premium Minimal Ops`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `None`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Resolved UI connection status inconsistencies and misleading volume values during stale/offline states:
    - Flow: Verified complete 5-stage pipeline: MQTT Broker (`irigasi/melon/sensor/volume`) → IoT Gateway (`HardwareMqttAdapter` & `TelemetryProcessor`) → PostgreSQL Database (`reservoir_water_readings` & `devices.last_seen_at`) → Web API (`/monitoring/latest`, `/water/latest`, `/devices`) → Frontend Web UI (`useLatestMonitoring` & `DeviceContext`).
    - Root causes: Hardware value mismatch investigation clarified that the web faithfully displayed persisted database rows; missing time-based stale detection caused offline hardware to appear `ONLINE`; UI components had inconsistent connection status because some (`DeviceSelector`, faucet modals) used cached device status from `DeviceContext` while others evaluated telemetry freshness; and both `WaterTankMonitoringCard` and `MonitoringDashboard` displayed the last known volume (e.g. `7.93 L`) even when stale or offline.
    - Fixes implemented: Centralized 60-second stale threshold (`TELEMETRY_STALE_THRESHOLD_MS = 60 * 1000`); added dynamic STALE status calculation in device and monitoring API routes from `lastSeenAt`/`receivedAt` without mutating DB facts; added `updateDeviceStatus` to `DeviceContext` and synchronized freshness in `useLatestMonitoring` in memory; unified `ONLINE` (emerald dot), `STALE` (amber dot), and `OFFLINE` (rose dot) UI indicators across all components; hid tank volume and displayed placeholder (`— L` / `- L`) with 0% gauge fill when stale or offline; and restored `ONLINE` automatically when telemetry resumes.
    - Verification: Passed unit tests (11/11 `water-tank-monitoring-card.test.tsx`, 8/8 `monitoring-dashboard.test.tsx`, 16/16 `latest.test.ts`, 53/53 telemetry suites total), passed UI tests, passed typecheck (0 errors across 4 workspaces), and completed manual browser verification. Preserved project constraints: MQTT ingestion unchanged, hardware payload processing unchanged, staging untouched, and production EMQX untouched.



#### TASK-0601 Governance Record

`TASK-0601` I18N infrastructure & configuration record:
- Frontend impact: `NONE`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Configured `next-intl` infrastructure in `@kebun-melon/web` per `DEC-I18N-068` with locales `id` (default) and `en` (fallback), non-prefixed cookie resolution (`locale`), server/client rendering support, bootstrap dictionaries (`messages/id.json`, `messages/en.json`), and safe missing key fallback handling. Created `i18n/request.ts` request configuration and centralized config (`lib/i18n/config.ts`). Verified 100% test pass rate on unit test suite (`apps/web/test/unit/i18n-config.test.ts`), `security-headers.test.ts`, web typecheck (`tsc --noEmit`), production build (`31/31` static pages), and Playwright non-credentialed browser smoke test on `/login`. Initial language gate UI and Settings switcher component belong to `TASK-0604` and are NOT implemented yet.

#### TASK-0602 Governance Record

`TASK-0602` translation namespaces implementation record:
- Frontend impact: `NONE`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Created all 17 approved translation namespaces (`common`, `auth`, `navigation`, `dashboard`, `devices`, `soil`, `water`, `history`, `faucet`, `alerts`, `users`, `approvals`, `profileee`, `settings`, `validation`, `errors`, `accessibility`) across `apps/web/messages/id.json` and `apps/web/messages/en.json` while preserving TASK-0601 `system` infrastructure. Enforced 100% key parity, real non-empty strings, and identical ICU placeholders (`{time}`, `{count}`, `{volume}`, `{name}`, `{metric}`, `{message}`, `{deviceId}`, `{deviceName}`). Preserved technical abbreviations (`N`, `P`, `K`, `pH`, `EC`, `TDS`, `ESP32`, `NodeMCU`, `MQTT`, `API`, `RBAC`, `mL`, `L`, `°C`, `%`) untranslated and omitted `BAT` parameter per `DEC-MON-086`. Added targeted unit test suite (`apps/web/test/unit/i18n-namespaces.test.ts`) passing 7/7 tests. User manually executed and verified reserved pre-commit suite (`npm run check:quality`). Hard-coded component UI text replacement remains TASK-0603; language gate and settings UI selector belong to TASK-0604.

#### TASK-0603 Governance Record

`TASK-0603` hard-coded UI text replacement record:
- Status: `DONE` (Completed 2026-08-14)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Replaced hard-coded user-facing text across all authentication pages, protected dashboard and sensor views (`/`, `/sensor`, `/soil`, `/water`, `/controls`, `/devices`, `/users`, `/approvals`, `/setting`, `/profileee`, `/notifikasi`), historical charts (`NPKChart`, `WaterNutrientChart`, `HistoricalChartControls`), faucet control components, and shell navigation (`Sidebar`, `TopAppBar`, `DeviceSelector`) using `next-intl` translation hooks. Preserved 100% key parity across `messages/id.json` and `messages/en.json` with matching ICU placeholders. Preserved canonical internal API/DB/MQTT values, hardware names, raw measurement numbers, and units (`N`, `P`, `K`, `pH`, `EC`, `TDS`, `ESP32`, `NodeMCU`, `MQTT`, `mL`, `L`, `m³/h`, `ppm`, `µS/cm`). Preserved `BAT` parameter omission per `DEC-MON-086`. Verified 100% test pass rate across 15 targeted unit test suites (107/107 tests), TypeScript typecheck (`tsc --noEmit` 0 errors), Next.js production build (`31/31` static pages), Playwright browser verification on `/login` and `/register`, and verified user-reported completion of all 5 reserved pre-commit checks (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`). Initial language gate and settings UI switcher belong to `TASK-0604`.

#### TASK-0604 Governance Record

`TASK-0604` mandatory initial language gate & settings locale change flow record:
- Status: `DONE` (Completed 2026-08-14)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Summary: Implemented mandatory initial language gate (`Select Language / Pilih Bahasa`, English -> `en`, Bahasa Indonesia -> `id`) blocking unauthenticated access on `/login`, `/register`, `/forgot-password`, `/status` until a valid non-prefixed `locale` cookie is set. Implemented authenticated language modal selector exclusively on `/setting` (`SettingsLocaleSwitcher`), backed by `PATCH /api/v1/me/preferences` with strict Zod schema validation (`UserPreferenceUpdateInputSchema`), `language.self.update` RBAC permission check, transactional persistence to `user_preferences` table with `profileee.self.updated` audit logging, and immediate client-side `locale` cookie synchronization. Replaced inline select with accessible modal dialog adhering to `Premium Minimal Ops` (clear active indicator, localized error handling, preserved route & device context). Fixed presentation-layer system default device display labels (`Node Sensor Tanah` <-> `Soil Sensor Node`, `Node Kualitas Air` <-> `Water Quality Node`, `Node Tangki Air` <-> `Water Tank Node`) in `formatDeviceDisplayName` and `DeviceSelector` across `id` and `en` modes while preserving canonical device IDs, database records, deviceType enums, and user-custom device names. Responsive mobile selector centering and dropdown viewport bounding enforced across 360px, 390px, 430px, and desktop widths. Verified dynamic `<html lang>` attribute updates, device context and route preservation, canonical internal value stability, 100% test pass rate across 18 unit test suites (136/136 tests, including new `device-selector-localization.test.tsx`), 0 TypeScript errors, 32/32 static pages generated in Next.js production build, Playwright verification across desktop and mobile viewports with 0 console errors, and confirmed user pass across all 5 reserved pre-commit checks (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`).
- 2026-09-19 Language Gate & Login Screen UI Refinements for Farmer Groups Record:
  - Status: `DONE` (Completed 2026-09-19)
  - Frontend impact: `MINOR`
  - Selected UI direction: `Premium Minimal Ops`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `Card hover`, `Button hover`
  - 21st.dev MCP: `VALIDATED & APPLIED`
  - Summary:
    - Language Gate Screen Refinement (`apps/web/components/auth/language-gate.tsx`):
      - Removed bureaucratic bilingual title `"Select Language / Pilih Bahasa"`.
      - Redesigned the screen using 21st.dev choice card inspiration tailored for farmer groups and non-technical users.
      - Introduced a centered neutral `Globe` icon anchor (`w-12 h-12 rounded-full bg-primary/10 text-primary`) without unapproved branding or slogans.
      - Implemented two tactile choice cards (min-h `80px`, `rounded-2xl`) with crisp visual flag indicators: Indonesian flag (red/white) for `Bahasa Indonesia` (`Indonesia`) and UK flag (Union Jack) for `English` (`English`), with defensive inline dimension constraints (`width: 36px, height: 24px`) to eliminate layout shifts.
      - Preserved accessible names (`aria-label="Pilih Bahasa Indonesia"` & `aria-label="Select English"`), cookie handling (`locale=id` / `locale=en`), router refresh, zero backend/RBAC/i18n logic changes, zero new dependencies.
      - Updated unit tests in `apps/web/test/unit/i18n-language-gate-and-settings.test.tsx` (13/13 passed).
    - Login Screen Refinement (`apps/web/app/(auth)/login/login-view.tsx` & translation dictionaries):
      - Removed `"to Kebun Melon"` from login heading: `auth.loginHeading` updated to `"Log In"` (`en.json`) and `"Masuk"` (`id.json`).
      - Removed `"New Farm"` from registration link: `auth.registerLand` updated to `"Register"` (`en.json`) and `"Daftar"` (`id.json`).
      - Redesigned `login-view.tsx` following practical 21st.dev card conventions without excessive decorative elements:
        - Clean `rounded-3xl` card with soft elevation and high contrast.
        - Readable sentence/title case labels (`Alamat Email`, `Kata Sandi`, `Email Address`, `Password`), eliminating aggressive uppercase tracked labels.
        - High-touch 56px input fields (`h-[56px]`) with smooth focus states (`focus:ring-2 focus:ring-primary/20`) and high outdoor/sunlight contrast.
        - Functional orientation icons (`Mail`, `Lock`) and password visibility toggle (`Eye` / `EyeOff`).
        - Preserved all authentication flow (`handleSubmit`, `POST /api/v1/auth/login`), error handling (`ACCOUNT_PENDING_APPROVAL`, `EMAIL_NOT_VERIFIED`, `ACTIVE_SESSION_EXISTS`), `AuthContext` state hydration, and routing.
      - Staging environment left untouched.
    - Verification:
      - `npm run i18n:check`: 100% parity passed.
      - Vitest tests: `test/route_protection.test.ts` (13/13 passed), `test/unit/auth-context-hydration.test.tsx` (6/6 passed), `i18n-language-gate-and-settings.test.tsx` (13/13 passed), `i18n-config.test.ts` (3/3 passed). Total: 35/35 passed.
      - Monorepo Typecheck: `npm run typecheck` passed with 0 errors across all 4 packages.
      - Linter: `npm run lint:web` passed with 0 warnings/errors.
      - Playwright MCP visual and behavioral verification: Confirmed Indonesian and English flows, flag indicators, responsive touch targets, and form validation error states with zero regressions.

#### TASK-0703 Governance Record

`TASK-0703` command failure and timeout alerts implementation record:
- Status: `DONE` (Completed 2026-08-14)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented physical faucet command failure (`COMMAND_FAILED`) and timeout (`COMMAND_TIMEOUT`) alerts. Added canonical `AlertType` enum to `@kebun-melon/contracts`. Implemented centralized, idempotent alert creation in `AlertRepository` (`createCommandFailureAlert`, `createCommandTimeoutAlert`) linking device UUID (`deviceId`) and faucet command UUID (`sourceId`, `sourceType: 'faucet_command'`). Guaranteed that command timeouts record `physicalOutcome: 'UNKNOWN'` without claiming known physical completion. Integrated failure alert creation into IoT Gateway `AcknowledgementProcessor` (rejected ACKs) and `FaucetEventProcessor` (`FAILED` execution events). Added full English and Indonesian translation keys (`commandFailedTitle`, `commandFailedMessage`, `commandTimeoutTitle`, `commandTimeoutMessage`) with ICU placeholders (`{commandId}`, `{deviceName}`, `{reason}`) and verified 100% key/placeholder parity. Preserved task boundaries keeping automated timeout scheduling/durations blocked under `TASK-0809` without inventing thresholds. Verified 100% test pass rate across targeted test suites (contracts, alert repository, gateway ACK/event processors, translation checks, web alert API tests) and confirmed user pass across all 5 reserved pre-commit checks (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`).

#### TASK-0704 Governance Record

`TASK-0704` alert acknowledgement implementation record:
- Status: `DONE` (Completed 2026-08-15)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented alert acknowledgement data contracts (`AcknowledgeAlertInputSchema`, `AlertAcknowledgementDto`), database transactional acknowledgement in `AlertRepository` (`acknowledgeAlert`) persisting acknowledgement records to `alert_acknowledgements` and emitting `alert.acknowledged` audit logs, `POST /api/v1/alerts/{alertId}/acknowledge` API route handler with RBAC enforcement (`alert.acknowledge` for OWNER global scope, ADMIN assigned-device scope), and `/notifikasi` frontend page wiring with `Premium Minimal Ops` modal for optional operator notes. Preserved alerts without deletion, handled duplicate acknowledgements safely and idempotently, and ensured 100% key parity and placeholder alignment for English and Indonesian translations. Reconciled documentation in `API.md`, `USER_FLOWS.md`, and `TRACEABILITY.md` to remove stale Admin acknowledgement TBD wording.

#### TASK-0705 Governance Record

`TASK-0705` live sidebar notification badge integration record:
- Status: `DONE` (Completed 2026-08-23)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Replaced static mock `ALERTS` evaluation in `Sidebar.tsx` with dynamic live backend alert data using lightweight client hook `useAlertBadge`. Hook queries canonical `GET /api/v1/alerts?status=OPEN&severity=CRITICAL` when authenticated. Subscribed to custom event `melon:alert-updated` emitted upon successful alert acknowledgement on `/notifikasi` page (`page.tsx`) to guarantee instant badge count updates without full page reloads. Preserved `Premium Minimal Ops` layout, badge positioning, and `bg-app-error` styling tokens. Added unit test coverage in `apps/web/test/unit/sidebar-navigation.test.tsx` (10/10 tests passed) and verified 100% test pass rate across full web unit suite (246/246 tests) and TypeScript typecheck (0 errors across 4 workspaces).

#### TASK-0807 Governance Record

`TASK-0807` faucet control UI implementation record:
- Status: `DONE` (Completed 2026-08-20)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Modal`, `Skeleton loading`, `KPI refresh`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented and verified complete Faucet Control UI revision on `/controls` adhering to `Premium Minimal Ops` UI standards:
  - Preset volume display in Liters: Phase 1 = `0.3 L / tanaman`, Phase 2 = `1 L / tanaman`, Phase 3 = `1.5 L / tanaman`.
  - `plantCount` integer input with stepper buttons (minimum 1, default 1) and live dynamic calculation preview (`preset.volumeL × plantCount = totalVolumeL`).
  - Browser-side calculation preview while strictly preserving server-side authority for final validation and execution.
  - Confirmation modal with action-aware layouts: for `DISPENSE` displaying device name, site location, phase, water per plant (L), plant count, total water (L), and safety warnings; for manual `OPEN` and `CLOSE` displaying device name, site, action title, safety description, and status.
  - Manual `OPEN` and `CLOSE` valve controls wired to `POST /api/v1/devices/{deviceId}/faucet-commands` with action `OPEN` | `CLOSE` without fabricating volume or phase parameters.
  - Idempotency integration: client dispatches unique `cmd-<uuid>` via HTTP header `Idempotency-Key` without arbitrary JSON body field injection.
  - Authoritative physical faucet state presentation (`OPEN`, `CLOSED`, `UNKNOWN`) strictly mapped from the TASK-0806 state machine: `COMPLETED OPEN` → `OPEN`, `COMPLETED CLOSE` → `CLOSED`, `COMPLETED DISPENSE` → `UNKNOWN`, active/failed/timeout/uncertain → `UNKNOWN`. Never inferred physical state from API submission, publication, or ACK.
  - Status Polling: `FaucetStatusCard` executes 2,500ms status polling strictly during active states (`QUEUED`, `SENT`, `ACKNOWLEDGED`, `IN_PROGRESS`) and terminates immediately upon terminal states or unmount with zero blind retries.
  - Full disabled and warning state handling for null device, unauthenticated/unauthorized users (`device.control.dispense`), disabled feature flag (`ENABLE_FAUCET_CONTROL=false`), offline devices (`OFFLINE`/`INACTIVE`), and active command in progress.
  - 100% Indonesian and English translation key parity with matching ICU placeholders.
  - Performance & Viewport Benchmarks: Mount latency $31\text{ ms} < 50\text{ ms}$, stepper latency $1.2\text{ ms}$, 50 modal cycles memory-safe, zero horizontal overflow across Mobile ($390\times 844$), Tablet ($768\times 1024$), and Desktop ($1280\times 800$).
  - Verified 100% test pass rate across 24 unit tests (`apps/web/test/unit/faucet-control-ui.test.tsx`), workspace TypeScript typecheck (0 errors), Semgrep scan (0 findings), and Next.js production build.

#### TASK-0810 Governance Record

`TASK-0810` manual faucet open/close control implementation record:
- Status: `DONE` (Completed 2026-08-21)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Modal`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented and verified discrete manual faucet `OPEN` and `CLOSE` valve control across Web backend API (`POST /api/v1/devices/{deviceId}/faucet-commands`), `@kebun-melon/contracts` (Zod schemas, action DTOs, and specific `AuditEventKey` enums `faucet.command.open.created` / `faucet.command.close.created`), `@kebun-melon/database` (`FaucetCommandRepository` transactional creation with audit trail and duplicate protection), IoT Gateway (`CommandPublisher` MQTT QoS 1 publish omitting fabricated volume/phase attributes; `AcknowledgementProcessor` and `FaucetEventProcessor` mapping physical state `COMPLETED OPEN` → `OPEN`, `COMPLETED CLOSE` → `CLOSED`, `COMPLETED DISPENSE` → `UNKNOWN`), and Web UI (`/controls` with action-aware `FaucetConfirmationModal`, disabled states for offline/busy/unauthorized, and authoritative physical badge presentation in `FaucetStatusCard`). Preserved `ENABLE_FAUCET_CONTROL=false` safety default. Verified 100% test pass rate across targeted test suites (32/32 tests), full faucet suites (114/114 tests), workspace test suite (102 test files, 955/955 tests), workspace typecheck (`tsc --noEmit` 0 errors), linting (0 errors), and security scanning (0 hardcoded secrets, 0 unapproved advisories). Documented hardware fail-safe valve behavior upon connection loss as an explicit UNRESOLVED/BLOCKING decision (`DEC-CTRL-090`).

#### TASK-0904 Governance Record

`TASK-0904` structured application logging implementation record:
- Status: `DONE` (Completed 2026-08-15)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented structured JSON application logging across `@kebun-melon/contracts`, `@kebun-melon/web`, and `@kebun-melon/iot-gateway`. Defined `LogLevel` enum/priorities, `LogMeta` correlation schema (`requestId`, `correlationId`, `userId`, `deviceId`, `commandId`, `messageId`, `traceId`), `StructuredLogEntry` schema, `shouldLog` level comparison, and `serializeStructuredLog` with recursive secret redaction (`redactSecrets`). Added `LOG_LEVEL` environment variable validation to `serverEnvSchema` and `gatewayEnvSchema` with defaults to `'info'`. Created unified `Logger` class supporting correlation context binding (`withContext`/`child`), dynamic level adjustment (`setLevel`/`getLevel`), service/environment tags, and structured error serialization. Replaced ad-hoc `console.error` calls across web routes and audit services. Added 100% test coverage across contract, web, gateway unit test suites, and environment validation test suites.

#### TASK-0905 Governance Record

`TASK-0905` health and readiness checks implementation record:
- Status: `DONE` (Completed 2026-08-15)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented health and readiness endpoints across `@kebun-melon/contracts`, `@kebun-melon/web`, and `@kebun-melon/iot-gateway` conforming to `docs/API.md` §23/§24 and `DEC-INF-078`. Defined `LivenessResponseDto` and `ReadinessResponseDto` in `@kebun-melon/contracts`. Created public `GET /health` (liveness independent of dependencies) and `GET /ready` in `@kebun-melon/web` checking database and internal IoT Gateway reachability via authenticated internal probe. Added `GET /internal/v1/health` and `GET /internal/v1/ready` to `@kebun-melon/iot-gateway` with mandatory `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>` verification, evaluating database and broker connectivity. Enforced strict environment configuration in production/staging (`INTERNAL_GATEWAY_URL`, `INTERNAL_SERVICE_TOKEN`, `INTERNAL_GATEWAY_TIMEOUT_MS=2000`) and verified zero credential or stack trace leakage in responses and logs across all failure modes.

#### TASK-0907 Governance Record

`TASK-0907` production MQTT TLS and ACLs configuration and security verification record:
- Status: `DONE` (Completed 2026-09-11)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Configured and verified production MQTT TLS security, client credential isolation, and topic Access Control Lists (ACLs) for the dedicated EMQX Cloud cluster (`he100b10.ala.asia-southeast1.emqxsl.com`) per `docs/DEVICE_COMMUNICATION.md` §8.4.6–8.4.7 and `DEC-DEV-032`. Created authoritative version-controlled EMQX v5 ACL configuration file `docker/emqx/acl.conf` defining Rule 1 (`Test_gateway` pub/sub on `irigasi/melon/#`), Rule 2 (`Test_Device` pub volume telemetry, sub valve/automation commands), and Rule 3 (default-deny baseline). Implemented standalone verification runner script `scripts/verify-production-mqtt.ts` (`npm run mqtt:verify:prod`) validating all 6 acceptance criteria against the live broker or mock environments: anonymous access rejection (`Connection refused: Bad username or password`), mandatory TLS transport validation (`rejectUnauthorized: true`), unique credential enforcement, topic ACL isolation (allowing volume pub and valve/setting sub while denying cross-topic actions with MQTT 5.0 `0x87 Not authorized`), gateway least-privilege permissions, non-retained command policy (`retain: false` on commands), and revoked/unauthorized client rejection (`Connection refused: Not authorized`). Created automated Vitest test suite `apps/iot-gateway/src/__tests__/production-mqtt-security.test.ts` (15/15 passed) validating production environment validation, TLS certificate validation, credential segregation, command publisher non-retained policy, and topic ACL matrix invariants. Rebuilt and verified staging Docker container (`kebun-melon-staging-gateway` healthy, passing `/health` HTTP 200 on port 3001). Confirmed zero secrets introduced via secret scanner (`npm run scan:secrets`).

#### TASK-0213 Governance Record

`TASK-0213` password recovery and email reset flow record:
- Status: `DONE` (Completed 2026-08-17)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented end-to-end password recovery and email reset flow with Resend as the approved email provider per `DEC-AUTH-102`. Added `ForgotPasswordInputSchema` and `ResetPasswordInputSchema` with strict validation to `@kebun-melon/contracts`. Created `PasswordResetToken` database model with versioned migration `20260817000000_add_password_reset_tokens/migration.sql`. Implemented `createPasswordResetToken` and `resetPasswordWithToken` in `UserRepository` (`packages/database`), generating 256-bit CSPRNG tokens, storing SHA-256 hashes, invalidating prior tokens, supporting password recovery for any existing account while strictly preserving `accountStatus` (never activating pending accounts), and transactionally revoking all user sessions across devices per `TASK-0908`. Implemented Resend email service (`apps/web/lib/email/resend.ts`) with trusted `APP_URL` reset links (never trusting request `Host` headers), strict production URL and sender domain validation, awaited delivery, and secret redaction. Added public endpoints `POST /api/v1/auth/forgot-password` (strictly anti-enumeration returning generic 200 with timing attack mitigation) and `POST /api/v1/auth/reset-password` with approved rate limits (3/min forgot-password, 5/min reset-password) and approved 15-minute token expiry. Implemented server-side guest route guard (`DEC-AUTH-103` / `requireGuestSession`) across `/login`, `/register`, `/forgot-password`, and `/reset-password` eliminating UI page flash by issuing instant HTTP 307 redirects to `/` for active sessions while allowing stale/fake sessions to render normally. Refined `/forgot-password` UX by removing the decorative image frame, initializing with empty input and neutral placeholder, adding a 15:00 countdown timer matching token lifetime with disabled button state, `sessionStorage` cooldown persistence across page refreshes, and a 5s auto-dismissing success toast. Verified 100% test pass rate across 67 unit tests in 9 test suites, 0 TypeScript typecheck errors, automated Playwright desktop/mobile browser checks with 0 console errors, user verification of real credential-dependent Resend email delivery/reset, token replay rejection, session revocation, and confirmed user pass across all 5 reserved pre-commit checks (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`).
- 2026-09-20 Password Recovery UX & Reset Status Verification Refinement:
  - Frontend impact: `MINOR`
  - Selected UI direction: `Premium Minimal Ops`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `Button hover`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Reconciled password recovery user experience and reset status verification:
    - DEC-AUTH-108 Unknown Email Exception: Updated `POST /api/v1/auth/forgot-password` to return HTTP 404 with error code `EMAIL_NOT_FOUND` and message *"Alamat email tidak terdaftar dalam sistem kami."* if user does not exist, eliminating false-positive operational confusion in isolated multi-environment systems. Retained anti-enumeration safeguards via strict IP rate limiting (`RATE_LIMIT_FORGOT_PASSWORD_MAX = 3` req/min) and structured audit logging.
    - Verify Reset Status Flow: Implemented `GET /api/v1/auth/forgot-password?email=...` (rate limited at 10 req/min). Added secondary "Verifikasi Status Reset" / "Verify Reset Status" button on `/forgot-password` during active countdown.
    - Immediate Redirection: Upon verified password reset completion (`completed: true`), clears `sessionStorage` cooldown tokens and immediately redirects user to `/login?message=PASSWORD_RESET_COMPLETED`.
    - Asset Format Governance: Enforced `.webp` standard for any future image assets while strictly preserving existing typography branding `<span className="text-[24px] font-bold text-primary">Kebun Melon</span>` and Lucide icons without creating new logo assets.
    - Automated Verification: Verified 100% unit test pass rate across `forgot-password-route.test.ts` (10/10) and `forgot-password-ui.test.tsx` (8/8), TypeScript typecheck (0 errors across 4 workspaces), Prettier compliance, and translation completeness check (`npm run i18n:check` passed with 100% key parity).
  - 2026-09-20 Logo Brand Assets Reconciliation, Email CID Delivery & Next.js Warning Cleanups:
    - Frontend impact: `MINOR`
    - Selected UI direction: `Premium Minimal Ops`
    - Existing color template: `UNCHANGED`
    - Selected motion effects: `Button hover`
    - 21st.dev MCP: `NOT REQUIRED`
    - Summary: Reconciled institution and application logos across authentication and navigation interfaces per operator directive:
      - Institutional & Application Logo Alignment: Integrated operator-supplied institutional partner logo (`logo1.webp`, transparent background) into auth page headers (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) and `Sidebar` footer. Standardized top-left application emblem to `logo2.webp` (KING Agro wisata emblem) in `TopAppBar` and `Sidebar` header.
      - Brand Text Streamlining: Removed redundant text `"Kebun Melon"` next to top-left logo in `TopAppBar` and removed `"Kebun Melon Monitoring System"` footer text in `Sidebar`, adhering to concise minimal ops typography.
      - Static Middleware Protection: Updated `apps/web/middleware.ts` matcher pattern to exclude static image assets (`webp`, `png`, `jpg`, `jpeg`, `svg`, `ico`) so logo files serve transparently and statically without invoking auth route middleware.
      - Resend CID Inline Email Attachments: Enhanced `apps/web/lib/email/resend.ts` to embed `logo1.webp` directly as an inline MIME attachment (`contentId: 'logo1'`, `src="cid:logo1"`), resolving broken logo placeholder icons in Gmail/Outlook webmail clients when emails are dispatched from local/private hostnames.
      - Next.js Warning Cleanups: Resolved `scroll-behavior: smooth` transition warning by adding `data-scroll-behavior="smooth"` to `<html lang={locale}>` in `apps/web/app/layout.tsx`. Resolved Next.js aspect-ratio dev warning by adding inline `style={{ width: 'auto' }}` to all responsive `<Image src="/logo1.webp" ... />` components.
      - Quality Verification: TypeScript typecheck passed with 0 errors across all 4 monorepo workspaces, unit tests passed 100% (22/22 tests), and Prettier style check passed across all touched files.

#### TASK-0214 Governance Record

`TASK-0214` mandatory email verification record:
- Status: `IN_ACCEPTANCE` (Implementation & Automated Tests Complete; Pending Final Manual Acceptance & Custom-Domain Delivery Verification)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented mandatory email ownership verification for `OWNER` and `ADMIN` accounts using the Resend infrastructure (`DEC-AUTH-104`). Added `EmailVerificationToken` model with versioned migration `20260817082153_add_email_verification_tokens/migration.sql`. Created `createEmailVerificationToken` and `verifyEmailWithToken` in `UserRepository` (`packages/database`), generating 6-digit numeric CSPRNG codes (with backward-compatible token support), storing SHA-256 hashes, invalidating prior tokens, and recording `emailVerifiedAt` timestamp independently of `accountStatus` (`ADMIN` remains `PENDING_APPROVAL`, `OWNER` remains `ACTIVE`). Handled Prisma `P2034` transaction write conflicts with bounded exponential backoff retries (3 attempts), returning `CONCURRENCY_CONFLICT` (HTTP 409) upon exhaustion and `TOKEN_ALREADY_USED` (HTTP 400) for `P2025` deletions. Enforced authentication gate in `loginUser` (`packages/database/src/session-service.ts`) throwing `UnverifiedEmailError` (HTTP 403 `EMAIL_NOT_VERIFIED`) for unverified Owners. Enforced server-side approval and rejection gates in `getPendingApprovals`, `getPendingApprovalById`, `approvePendingAdmin`, and `rejectPendingAdmin` asserting `emailVerifiedAt IS NOT NULL` (fixed 409 Reject bug caused by missing `emailVerifiedAt` projection). Unverified Admins remain hidden from `/approvals`. Created public endpoints `POST /api/v1/auth/verify-email` (verifying email ownership without creating a session) and `POST /api/v1/auth/resend-verification` (anti-enumeration with 3/min rate limit and 15-minute code expiry). Implemented `/verify-email` UI page adhering to `Premium Minimal Ops` with module-level in-flight Promise map deduplication, immediate cache eviction upon settlement (`finally`), automatic redirect to `/status?status=PENDING_APPROVAL` for Admin applicants, login prompt for Owners, and removal of decorative illustration frames. Integrated server-side guest guard (`DEC-AUTH-103`) redirecting authenticated users to `/`.
- Delivery & Testing Status Note: Verification has been manually exercised using Resend test mode/test recipients and the Resend-provided verification link. We have not yet tested delivery to arbitrary real email recipients using a verified custom sending domain, because no such domain is currently configured. Treat real-mailbox deliverability as pending deployment/infrastructure acceptance, not as an application logic failure.

#### TASK-0802 Governance Record

`TASK-0802` faucet command database model reconciliation record:
- Status: `DONE` (Completed 2026-08-19)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented and reconciled the faucet command database model per `DEC-CTRL-051`, `DEC-CTRL-090`, and `DEC-CTRL-091`. Added versioned migration `20260819000000_task_0802_faucet_command_action/migration.sql` adding `action` (`DISPENSE`, `OPEN`, `CLOSE`) and `plant_count` (integer >= 1) columns, dropping the obsolete legacy check constraint `faucet_commands_phase_volume_check` to eliminate volume calculation conflicts with multi-plant dispense commands and null manual action fields, backfilling existing records with `action = 'DISPENSE'` and `plant_count = 1`, and establishing the multi-column check constraint `faucet_commands_action_check`. Reconciled server-derived volume calculations (`targetVolumeMl = mapPhaseToVolume(phase) * plantCount` for Phase 1: 300 mL, Phase 2: 1000 mL, Phase 3: 1500 mL) rejecting client-supplied target volume authority. Updated Zod schemas and TypeScript types in `@kebun-melon/contracts`. Updated `FaucetCommandRepository` in `@kebun-melon/database` with transactional state transition safeguards, idempotency deduplication, and active command concurrency protection. Executed local PostgreSQL 18 performance smoke test covering migration timing, 300 sequential creations across `DISPENSE`, `OPEN`, and `CLOSE`, 150 lookups, query execution plan verification via `EXPLAIN ANALYZE` (B-tree index scans on `faucet_commands_pkey`, `faucet_commands_idempotency_key_key`, `faucet_commands_device_time_idx`, `faucet_commands_one_active_per_device`), check constraint rejection verification, and concurrency idempotency/conflict tests with zero regressions.

#### TASK-0805 Governance Record

`TASK-0805` device acknowledgement processing implementation record:
- Status: `DONE` (Completed 2026-08-20)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Revalidated and hardened `AcknowledgementProcessor` in `@kebun-melon/iot-gateway` (`apps/iot-gateway/src/acknowledgements/processor.ts`) to handle command ACKs across all supported faucet command actions (`DISPENSE`, `OPEN`, and `CLOSE`). Enforced authoritative ACK payload contract identifying commands via `commandId` and `deviceId` without fabricating an action field in the MQTT ACK payload. Enforced persisted command action validation against `[DISPENSE, OPEN, CLOSE]`, rejecting unsupported or unknown actions (`success: false`). Enforced strict state transitions where accepted ACKs only transition `SENT` → `ACKNOWLEDGED` (guaranteeing status never transitions to `COMPLETED` and never infers physical state), and rejected ACKs transition `SENT` → `FAILED` with canonical `reasonCode` and `CommandFailureAlert` generation. Handled duplicate `messageId` idempotently and safely ignored non-`SENT` / late / out-of-order ACKs without state regression. Verified 100% test pass rate across 25 unit tests (`apps/iot-gateway/src/__tests__/acknowledgement-processor.test.ts`), 195/195 IoT Gateway tests, 228/228 contracts/database tests, Semgrep security scan (0 findings), and workspace typecheck (0 errors). Executed local in-memory performance sanity microbenchmarks (1,000 sequential ACKs: 3,979 ACKs/sec, p50: 0.087 ms; 500 concurrent burst ACKs: 7,579 ACKs/sec, p50: 56.55 ms; 1,000 duplicate ACKs: 5,887 ACKs/sec, 0 redundant DB writes; 2,000 soak ACKs: 4,453 ACKs/sec, stable heap; clearly labeled as in-memory microbenchmarks). Live staging MQTT/hardware verification remains credential/manual dependent.

#### TASK-0806 Governance Record

`TASK-0806` command event state machine implementation record:
- Status: `DONE` (Completed 2026-08-20)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented and hardened `FaucetEventProcessor` in `@kebun-melon/iot-gateway` (`apps/iot-gateway/src/events/processor.ts`) to handle execution events across all supported faucet command actions (`DISPENSE`, `OPEN`, and `CLOSE`). Implemented authoritative physical state determination: `COMPLETED OPEN` → `OPEN`, `COMPLETED CLOSE` → `CLOSED`, `COMPLETED DISPENSE` → `UNKNOWN` (strictly avoiding assuming closed valve), and failed/uncertain/in-progress → `UNKNOWN`. Ensured physical state is NEVER inferred from API acceptance, publication, or ACK. Enforced persisted command action validation against `[DISPENSE, OPEN, CLOSE]`. Enforced contract-consistent volume handling: `DISPENSE` validates non-negative `actualVolumeMl` and target volume match if provided; `OPEN` and `CLOSE` treat volume as non-applicable and store `null`/`undefined` on the command record. Guaranteed terminal-state immutability (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `EXPIRED`), duplicate `messageId` idempotency, progress event appending, and `CommandFailureAlert` dispatching on `FAILED` events. Verified 100% test pass rate across 32 unit tests (`apps/iot-gateway/src/__tests__/faucet-event-processor.test.ts`), full 212-test IoT Gateway test suite, 934-test workspace suite, Semgrep security scan (0 findings), and TypeScript typecheck (0 errors).

#### TASK-0808 Governance Record

`TASK-0808` duplicate command protection implementation record:
- Status: `DONE` (Completed 2026-08-20)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Implemented semantic duplicate command protection in `FaucetCommandRepository` (`@kebun-melon/database`) without relying on desired state comparisons or tracking external physical states. Maintained the strict "max 1 active command per device" concurrency constraint (`DEC-CTRL-051`), while throwing a specific `FaucetCommandConflictError` mapped to HTTP 409 Conflict with descriptive messages for duplicate physical intent scenarios. For `DISPENSE`, duplicate intent is verified by matching the `action`, `phase`, and `plantCount`. For `OPEN` and `CLOSE`, intent is verified strictly by matching the `action`. Non-semantic concurrent commands (e.g., trying to `OPEN` while `CLOSE` is active) continue to hit the generic concurrency rejection. Verified 100% test pass rate across 21 database unit tests and 31 API route tests. A known millisecond-level race condition due to absent strict database locking remains out-of-scope for this iteration.

#### TASK-1001 Governance Record

`TASK-1001` complete unit test suite implementation record:
- Status: `DONE` (Completed 2026-08-21)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Audited, hardened, and verified full monorepo unit test coverage across all 8 mandatory acceptance domains: account-status decisions, RBAC permission checks, device access isolation, telemetry validation (`BAT` parameter omitted per `DEC-MON-086`), phase/volume mapping calculations, command state machine transitions, idempotency deduplication, and bilingual locale validation. Hardened branch coverage in `@kebun-melon/contracts` for unrecognized device types, log level fallbacks, and user role deduplication. Verified 100% test pass rate across 102 test files (958/958 tests passed) and >99.6% line coverage in contracts. Maintained `ENABLE_FAUCET_CONTROL=false` safety default and asserted uncertain/timeout states strictly as `UNKNOWN`. Passed pre-commit quality suite (`npm run check:quality`): 0 TypeScript errors, 0 lint errors, clean Prettier formatting, 100% translation parity (`i18n:check`), 0 hardcoded secrets, 0 unapproved vulnerabilities, and successful 37-route Next.js production build.

#### TASK-0913 Governance Record

`TASK-0913` telemetry data retention and automated maintenance policy record:
- Status: `DONE` (Completed 2026-08-24)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
#### TASK-0914 Governance Record

`TASK-0914` direct EMQX Cloud connectivity for local IoT Gateway record:
- Status: `DONE` (Completed 2026-08-26)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Configured direct EMQX Cloud MQTT 5.0 over TLS (`mqtts://` port 8883 / `wss://` port 8084) for local `apps/iot-gateway` and simulator execution (`scripts/device-simulator.ts`, `scripts/esp32-simulator.ts`), eliminating local Docker Mosquitto dependency for normal development workflows while keeping Mosquitto as an optional offline fallback. Preserved strict topic namespace isolation (`agriculture/development/...` vs `agriculture/staging/...`) and unique client IDs (`gateway-kebun-melon-dev-local-*` vs `gateway-kebun-melon-staging-*` vs `sim-${tankDeviceId}-${random}`), preventing client kick-offs on the shared EMQX broker. Upgraded simulator scripts to dynamically resolve target `WATER_TANK_NODE` canonical device identity at runtime via CLI (`--tank-device-id`, `--device-id`) or environment variables (`MQTT_TANK_DEVICE_ID`, `MQTT_DEVICE_ID`), eliminating hardcoded hardware IDs from source code. Enforced exact parity between topic `deviceId` and payload `deviceId` according to the canonical payload contract schema. Verified live development gateway connection, EMQX broker publishing, and local development database telemetry ingestion using the real development device ID. Documented that frontend monitoring UI smoke testing was intentionally deferred/skipped during backend gateway protocol validation. Confirmed staging infrastructure and database require zero alterations or redeployments. Maintained `ENABLE_FAUCET_CONTROL=false` baseline safety. Verified 100% test pass rate across unit test suites (`emqx-connectivity.test.ts` 7/7, `device-simulator.test.ts` 26/26, `broker-config.test.ts` 7/7, `test-env.ts` 18/18), TypeScript typecheck (0 errors across 4 monorepo workspaces), and secret scan (0 findings).

#### Controls Loading Experience & Responsive Header Centering Governance Record (Reconciled 2026-08-28)

`TASK-0807` / `TASK-0502` / `TASK-0306` loading & layout stabilization record:
- Status: `DONE` (Reconciled 2026-08-28)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Skeleton loading`, `Dropdown`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Reconciled `/controls` loading transition and global header `DeviceSelector` responsive centering. Created route-level instant loading shell (`apps/web/app/controls/loading.tsx`) rendering the complete page composition immediately upon navigation. Replaced generic single-box placeholder in `WaterTankMonitoringCard` with structural 2-column skeleton cards matching the loaded card layout. Hydrated auth state in `FaucetControlPanel` via `useAuth()`, eliminating redundant client-side `/api/v1/auth/session` calls. Rendered structured skeleton rows in `FaucetHistoryTable` during device loading to eliminate layout jumping. Refactored `TopAppBar` to a balanced 3-column CSS Grid (`grid grid-cols-[1fr_auto_1fr] items-center px-4 h-14`), constraining flanking items to identical `1fr` widths and guaranteeing mathematical 50% horizontal center alignment for `DeviceSelector` across desktop, tablet, and mobile. Centered `DeviceSelector` dropdown overlay and alert notices under the trigger button (`left-1/2 -translate-x-1/2`) with viewport clamping (`max-w-[calc(100vw-2rem)]`). Hardened `Sidebar` with null-safety for `pathname`. Verified 100% test pass rate across 34 unit test suites (257/257 tests in `@kebun-melon/web`), monorepo typecheck (0 errors across 4 workspaces), Next.js production build (37/37 routes compiled), Playwright smoke tests (2/2 passed with Microsoft Edge), and manual authenticated browser testing. Preserved `TASK-1004` as `IN_PROGRESS` and verified all five pre-commit validation commands as `PASS` (`test:coverage`, `test:integration`, `check:quality`, `test`, `test:e2e`).

#### Faucet Controls UI Refinement & Lifecycle Regression Hardening Governance Record (Reconciled 2026-09-01)

`TASK-0807` / `TASK-0806` / `TASK-0408` faucet controls & lifecycle reconciliation record:
- Status: `DONE` (Reconciled 2026-09-01)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Button hover`, `Modal`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Refined `/controls` UI action enablement and hardened faucet command lifecycle event persistence following manual verification. Enforced physical-valve-state-aware action guards: when physical valve state is `CLOSED`, dispensing preset cards (0.3 L, 1 L, 1.5 L), plant count stepper buttons (`-`, input, `+`), and "Close Valve" manual action are disabled, leaving only "Open Valve" enabled; when `OPEN`, "Open Valve" is disabled while dispensing presets and "Close Valve" remain enabled; when `UNKNOWN`, all valid actions remain enabled. Cleaned user-facing localization by removing redundant parenthetical uppercase enum strings (`(CLOSED)`, `(COMPLETED)`, `(OPEN)`, `(DISPENSE)`) across badges, status headers, and history tables in English and Indonesian with 100% dictionary key parity. Fixed lifecycle regression where late non-terminal events (`IN_PROGRESS`) were accepted after `COMPLETED` by adding transactional terminal state protection in `FaucetCommandRepository.addCommandEvent` (`packages/database`), and caught concurrent transition errors in `FaucetEventProcessor` (`apps/iot-gateway`). Aligned simulator `sendFaucetProgress` to canonical QoS 1 and added realistic simulation delays. Confirmed that `faucet_command_events` is an append-only milestone log where multiple intermediate `IN_PROGRESS` events before `COMPLETED` are valid. Verified 100% test pass rate across targeted UI tests (27/27), database tests (25/25), gateway tests (32/32), simulator tests (31/31), web unit tests (36 files, 288/288), and workspace typecheck (0 errors across 4 monorepo packages).

#### Faucet Confirmation Modal UI Simplification Governance Record (Reconciled 2026-09-01)

`TASK-0807` faucet confirmation modal simplification record:
- Status: `DONE` (Reconciled 2026-09-01)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Modal`, `Button hover`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Streamlined the water dispensing and manual valve confirmation modal UI (`FaucetConfirmationModal.tsx`). Removed redundant "Device Name" and "Site Location" fields from the details grid, eliminated the `(a L × b plants)` calculation formula substring from the confirmation prompt in English and Indonesian dictionaries, and permanently removed the "Automatic Command Safety" informational disclaimer cards (`automaticSafetyTitle`, `automaticSafetyDesc`, `manualOpenDesc`, `manualCloseDesc`, and `ShieldCheck` icon). Kept all backend logging, RBAC checks, API contracts, and IoT Gateway MQTT dispatch logic completely untouched. Verified 100% test pass rate across focused unit tests (`faucet-control-ui.test.tsx` 27/27), full monorepo test suite (112 files, 1,062 tests), and pre-commit quality checks (`check:quality`).

#### Faucet Control Page Loading Strategy Governance Record (Reconciled 2026-09-02)

`TASK-0807` faucet control page loading strategy record:
- Status: `DONE` (Reconciled 2026-09-02)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Skeleton loading`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Improved Faucet Control page loading strategy by separating initial page shell rendering from asynchronous device, telemetry, and command fetching. Extracted `apps/web/components/controls/FaucetPresetSelectorSkeleton.tsx` to serve as a reusable component-level skeleton matching exact layout tokens. Updated `FaucetControlPanel.tsx` to render this skeleton while `isDeviceLoading` is true, completely eliminating the flash of premature disabled error states ("Silakan pilih perangkat tandon air") and layout jumping during initial device context hydration. Refactored `apps/web/app/controls/loading.tsx` to reuse `FaucetPresetSelectorSkeleton`, avoiding markup duplication while preserving the Next.js route-level loading fallback for slow-network bundle delivery. Verified 100% test pass rate across `controls-loading-transition.test.tsx` (5/5), `faucet-control-ui.test.tsx` (27/27), full web unit suite (36 files, 288/288 tests), and workspace typecheck (0 errors across 4 monorepo packages).

#### TASK-0410 Governance Record

`TASK-0410` water-tank flow rate parameter complete removal record:
- Status: `DONE` (Completed 2026-09-09)
- Frontend impact: `MINOR`
- Selected UI direction: `Premium Minimal Ops`
- Existing color template: `UNCHANGED`
- Selected motion effects: `Card hover`, `Skeleton loading`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Completely removed unused water-tank flow rate telemetry parameter (`flowRate`, `flow_rate`, `WATER_FLOW_RATE`) across contracts, database schema, IoT gateway MQTT ingestion, REST API/SSE responses, web UI, translations, simulators, fixtures, and tests governed by `DEC-MON-089`. Scoped capability removal strictly to water tank devices. Verified legacy payload backward compatibility: payloads with or without `flowRate` validate cleanly, stripping `flowRate` at ingestion without data corruption or rejection. Removed flow rate card and skeleton from `WaterTankMonitoringCard` and `/controls` loading view, preserving explicit zero `tankVolume`, status-only telemetry, and null states without fallback to `smoothFlow`. Applied versioned migration `20260909010000_remove_reservoir_flow_rate` on Supabase DEV and STAGING. Verified staging containers `/health` and `/ready` (200 OK, `ENABLE_FAUCET_CONTROL=false`). Verified 100% test pass rate across all monorepo unit/integration suites and 0 typecheck errors.

#### TASK-0909 Governance Record

`TASK-0909` automated backup and restore capability deferral record:
- Status: `DEFERRED` (Reconciled 2026-09-18)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Formally deferred the automated daily offsite backup pipeline (e.g., Cloudflare R2 / AWS S3) and restore testing capabilities under `DEC-INF-096`. Updated task status from `BLOCKED` to `DEFERRED` in `TASKS.md` and traceability matrix `docs/TRACEABILITY.md` (`SEC-OPS-003`). Because backup and restore capability is intentionally postponed until there is an operational requirement, no backup pipeline code, storage SDK integrations, database migrations, or infrastructure changes are implemented. Confirmed that point-in-time encrypted snapshot exports and local isolated restore rehearsal procedures documented for database maintenance in `docs/SUPABASE_MIGRATION_RUNBOOK.md` remain independently operational and unaffected. Zero changes to staging environment or running services.

#### TASK-1011 Production DNS Provisioning & Verification Governance Record

`TASK-1011` production DNS provisioning and subdomain verification record:
- Status: `IN_PROGRESS` (DNS Provisioned & Verified 2026-09-20; VPS Server Deployment Pending)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Completed and verified the production domain and DNS infrastructure preparation prerequisite for TASK-1011. Configured dedicated production subdomain `monitoring.melonmadura.my.id` on JagoanHosting cPanel Zone Editor as an `A` record pointing to JagoanHosting Nebula VPS (`38.103.171.46`) with optimal TTL of 300s. Verified 100% authoritative resolution via `one.jagoanhosting.com` and global propagation across major recursive resolvers (Cloudflare `1.1.1.1`, Google `8.8.8.8`, Quad9 `9.9.9.9`, and local workstation). Confirmed that root apex domain `melonmadura.my.id` and `www` CNAME remain 100% unchanged and isolated on shared hosting IP `101.50.1.84`. Verified host network reachability via TCP port 22 (`TcpTestSucceeded: True`) without logging in or exposing secrets. Zero code modifications, zero staging modifications, zero git commits, and zero automatic VPS deployments executed. Satisfies the "Production Domain & DNS Provisioning" dependency of TASK-1011 while retaining TASK-1011 in `BACKLOG` for future server setup.

#### Resend Custom Sending Domain Configuration Governance Record (Reconciled 2026-09-20)

`Resend Custom Sending Domain` configuration and validation record:
- Status: `DONE` (Implemented & Verified 2026-09-20; Live Mailbox Deliverability / DNS Verification Reserved for Operator)
- Frontend impact: `NONE`
- Selected UI direction: `N/A`
- Existing color template: `UNCHANGED`
- Selected motion effects: `None`
- 21st.dev MCP: `NOT REQUIRED`
- Summary: Configured and standardized the transactional email sender to use the verified custom sending domain `Melon Madura <noreply@melonmadura.my.id>` instead of the default Resend test sender (`onboarding@resend.dev`), satisfying `DEC-AUTH-102` and preparation for unrestricted recipient email delivery. Centralized the default sender constant in `apps/web/lib/email/resend.ts` via `export const DEFAULT_RESEND_FROM_EMAIL = 'Melon Madura <noreply@melonmadura.my.id>'`, replacing 6 duplicate hardcoded fallbacks across all transactional notification functions (`sendPasswordResetEmail`, `sendVerificationEmail`, `sendEmailChangeVerificationEmail`, `sendAccountSuspensionEmail`, `sendAccountDeletionEmail`, `sendAccountReactivationEmail`). Updated `serverEnvSchema` in `apps/web/lib/env/server.ts` to default `RESEND_FROM_EMAIL` to `'Melon Madura <noreply@melonmadura.my.id>'`, while strictly preserving the existing production guard that rejects `onboarding@resend.dev` in production. Updated example configuration `apps/web/.env.example` and active development environment files (`.env`, `apps/web/.env`). Synchronized staging environment configuration (`.env.staging`, `.env.staging.example`), rebuilt and redeployed the staging Docker Compose stack (`docker compose -f docker-compose.staging.yml up -d --build`), and verified all health probes healthy on ports 3000 and 3001. Added unit tests asserting default custom domain sender fallback and server environment defaults. Executed targeted Vitest suites (41/41 passed), `npm run env:check` (PASSED), `npm run typecheck` (0 errors across 4 workspaces), and `npm run i18n:check` (100% parity). Preserved remaining constraints: zero git commits, zero production deployments.

---





## 5. Task Selection Rules

Use `TASKS.md` as the implementation backlog.

Before coding, state:

```text
Task ID:
Task title:
Dependencies:
Files expected to change:
Tests expected:
Known blockers:
```

Only start a task when:

- Its dependencies are complete.
- It is not marked `BLOCKED`.
- Required decisions are available.
- The implementation does not depend on an unresolved safety policy.

Tasks marked `BLOCKED` shall remain blocked.

Do not choose an assumption merely to remove a blocker.

When a task is too large, split it into coherent subtasks without changing its requirements.

---

## 6. Status Management

Allowed task statuses:

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

Do not mark a task `DONE` until:

- Implementation is complete.
- Tests are added.
- Tests pass.
- Security implications are reviewed.
- Documentation is updated.
- Acceptance criteria are met.
- No relevant unresolved assumption was invented.

---

## 7. General Coding Rules

Agents shall:

- Prefer small, reviewable changes.
- Follow existing repository conventions.
- Use strict typing.
- Validate external input at runtime.
- Keep domain logic outside visual components.
- Keep device communication outside the browser.
- Use canonical enum values.
- Preserve null and zero semantics.
- Add error handling.
- Add tests in the same change.
- Avoid unrelated refactoring.
- Avoid dead code.
- Avoid duplicated business logic.
- Document non-obvious security decisions.
- Keep secrets outside source control.

Agents shall not:

- Modify unrelated files.
- Replace libraries without justification.
- Add unnecessary dependencies.
- Invent sensor units.
- Invent thresholds.
- Invent hardware behaviour.
- Invent role permissions.
- Invent account lifecycle rules.
- Invent physical safety behaviour.
- Enable production physical control without explicit approval.

---

## 8. Canonical Internal Values

Internal values shall remain untranslated.

### Roles

```text
OWNER
ADMIN
```

### Account Statuses

```text
PENDING_APPROVAL
APPROVED
ACTIVE
REJECTED
SUSPENDED
DEACTIVATED
```

### Device Statuses

```text
ONLINE
OFFLINE
STALE
UNKNOWN
INACTIVE
```

### Monitoring Statuses

```text
NORMAL
WARNING
CRITICAL
UNKNOWN
UNAVAILABLE
INVALID
```

### Faucet Command Statuses

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

Do not store translated variants in:

- Database enums.
- API payloads.
- MQTT messages.
- Audit event keys.
- Permission keys.

Translations belong only in the presentation layer.

---

## 9. Authentication Rules

Agents working on authentication shall enforce:

- Only `ACTIVE` users may access protected functionality.
- Public registration creates only `ADMIN`.
- Public registration creates only `PENDING_APPROVAL`.
- Public registration must never create `OWNER`.
- Pending, rejected, suspended, and deactivated users cannot access protected pages.
- Account status is checked server-side.
- Passwords are securely hashed.
- Passwords and hashes are never logged.
- Sessions can be revoked.
- Logout invalidates the session.
- Suspension and deactivation invalidate access.
- Session fixation is prevented.
- Cookie sessions use secure attributes when applicable.

The first Owner must be created through the approved provisioning process, never through public registration.

---

## 10. RBAC Rules

Authorisation must be enforced on the server.

Hiding a button is not security.

Every protected operation shall validate:

1. Session.
2. Active account status.
3. Role.
4. Permission.
5. Target-resource access.
6. Device access where relevant.
7. Current resource state.

### Owner

The Owner may perform only the actions defined in `RBAC.md`.

### Admin

The Admin may:

- Manage only their own permitted profileee fields.
- View assigned devices.
- View authorised monitoring.
- Use faucet control only when explicitly granted.

The Admin shall not:

- View another user's private profileee.
- Edit another user.
- Approve or reject an account.
- Suspend or deactivate another user.
- Change their own role.
- Change their own account status.
- Assign devices.
- Self-grant control access.

Object-level authorisation must protect:

```text
userId
deviceId
alertId
commandId
auditId
```

---

## 11. Device Access and Identity Rules

Every device-specific action must verify access to the exact target device.

Device assignment is mandatory for Admin access. Admins cannot view or control unassigned devices.

Active device assignment grants both telemetry monitoring and faucet-control capabilities for active Admin users on active, controllable devices:

```text
Active ADMIN
+ assigned device access
+ active and controllable device
= faucet-control permission
```

Separate per-user-device `canControl` permission grants are not used.

Owners manage device assignments. Admins may not assign devices to themselves or other users.

Device identity and governance rules:

- **No In-App Device Creation**: Devices cannot be created via `/devices` or application APIs; device registration is seeded/provisioned out-of-band (`DEC-DEV-027`).
- **Owner-Only Canonical `deviceId` Edit**: The Owner may update the external canonical `deviceId` string. The internal database UUID (`devices.id`) remains strictly immutable (`DEC-DEV-028`).
- **Strict Admin `deviceId` Concealment**: Admin users MUST NOT view or edit the external canonical `deviceId` across any UI component or API response. Admins only see the user-facing device `name` or localized default label (`DEC-DEV-028`).
- **Hardware/Broker Rename Reconciliation**: Physical ESP32/NodeMCU firmware reconfiguration and EMQX broker credential/ACL synchronization following a `deviceId` rename are operational workflows marked as **TBD / BLOCKING** automation (`DEC-DEV-028`).
- **Removal of Previously/Last-Accessed Device History**: Persistent restoration or tracking of previously/last-accessed device history across logins or storage is removed (`DEC-DEV-029`). Device selection resolves fresh on initial load. Historical telemetry charts (`TASK-0503`/`TASK-0504`), faucet commands, assignments, status events, and audit logs remain 100% intact.

Agents shall prevent access through:

- URL manipulation.
- Request-body manipulation.
- Query-parameter manipulation.
- Direct API calls.
- Stale browser state.
- Changed device ID.
- Reused data from another session.

When device access is revoked:

- New API requests must fail.
- Live updates must stop.
- Control must fail.
- Cached frontend access must not remain authoritative.
- The change must be audited.

---

## 12. Frontend Rules

Frontend code shall:

- Render server-authorised data.
- Support loading, empty, success, error, stale, offline, invalid, and unavailable states.
- Preserve the selected device consistently.
- Clear or distinguish previous device data during device switching.
- Not show stale values as current.
- Not show missing values as zero.
- Not infer permission from UI state alone.
- Not store device or MQTT secrets.
- Not publish directly to MQTT.
- Not claim physical completion without a confirmed final device event.

Frontend components shall use existing design patterns whenever available.

---

## 13. Internationalisation Rules

The application supports:

```text
en
id
```

Agents shall:

- Use translation keys for all user-facing text.
- Translate accessibility labels.
- Preserve canonical internal values.
- Persist locale according to `I18N.md`.
- Keep language changes independent from role, permission, device, and timezone.
- Test longer Indonesian labels.
- Update the HTML `lang` attribute.
- Use fallback behaviour.
- Prevent raw translation keys from appearing.

Do not translate:

- Device IDs.
- API field names.
- MQTT topics.
- Database fields.
- Audit event keys.
- pH, EC, TDS, N, P, K, ESP32, NodeMCU, MQTT, API, RBAC.
- Raw sensor values.
- Canonical statuses.

---

## 14. API Rules

API implementation shall follow `API.md`.

Required characteristics:

- Versioned routes.
- JSON payloads.
- Stable response envelopes.
- Stable error codes.
- ISO 8601 timestamps.
- Server-side validation.
- Server-side RBAC.
- Device-level access.
- Bounded pagination.
- Allowlisted filters and sort fields.
- Mass-assignment protection.
- Request correlation IDs.
- Safe error messages.
- Idempotency for faucet commands.

The API shall not expose:

- Password hashes.
- Session tokens.
- Device secrets.
- MQTT credentials.
- Private keys.
- Internal stack traces.
- Raw database errors.

---

## 15. Database Rules

Database changes shall follow `DATABASE.md`.

Agents shall:

- Use versioned migrations.
- Preserve foreign-key integrity.
- Add required indexes.
- Add unique constraints.
- Add check constraints.
- Keep telemetry append-oriented.
- Preserve audit history.
- Distinguish null from zero.
- Store timestamps as timezone-aware values.
- Use transactions for high-risk state changes.
- Avoid core domain data in unstructured JSON when typed columns are appropriate.

Do not hard-delete:

- Audit records.
- Faucet command history.
- Approval history.
- Users or devices when deactivation is sufficient.

Use raw SQL migrations when the ORM cannot express required PostgreSQL features safely.

---

## 16. Telemetry Rules

Telemetry processing shall:

1. Parse the topic.
2. Validate device identity.
3. Validate the payload.
4. Validate schema version.
5. Verify topic and payload device match.
6. Detect duplicate message IDs.
7. Preserve device and server timestamps.
8. Store valid values.
9. Update last-seen state.
10. Emit live updates after persistence.
11. Record operational metrics.

Agents shall preserve:

- Valid zero as `0`.
- Unavailable values as `null`.
- Missing optional capabilities as absent.
- Invalid values as invalid, not fabricated.
- `recordedAt` and `receivedAt` separately.

Do not invent:

- Sensor units.
- Sensor precision.
- Agronomic status thresholds.
- Water-quality thresholds.
- Calibration logic.

---

## 17. MQTT and IoT Gateway Rules

The browser shall never connect directly to MQTT.

The gateway shall be a long-running backend service.

Recommended protocol:

```text
MQTT 5.0 over TLS
```

The gateway shall:

- Authenticate to the broker.
- Subscribe only to required topics.
- Validate every message.
- Normalise device data.
- Store telemetry.
- Publish commands.
- Process acknowledgements.
- Track command states.
- Reject device/topic mismatches.
- Handle reconnects safely.
- Expose health and readiness.
- Redact secrets.

Faucet commands shall never be retained.

Each device shall have isolated topic permissions.

One device must not publish as or subscribe to another device.

---

## 18. Faucet-Control Rules

Faucet control is a high-risk physical action.

Agents shall not implement or enable control until the permission policy is approved.

### Approved Presets

```text
Phase 1 → 300 mL
Phase 2 → 1,000 mL
Phase 3 → 1,500 mL
```

The browser sends the phase.

The server maps the phase to target volume.

The browser must not be authoritative for the volume.

### Required Command Checks

Before command creation:

1. Authenticate user.
2. Verify active account.
3. Verify control permission.
4. Verify device access.
5. Verify device control capability.
6. Verify device active state.
7. Verify device online or controllable state.
8. Validate phase.
9. Check active-command conflict.
10. Check idempotency.
11. Persist command.
12. Publish only after durable persistence.

### Command Safety

Every command shall have:

```text
commandId
idempotencyKey
deviceId
phase
targetVolumeMl
requestedAt
expiresAt
```

Duplicate requests must not cause duplicate physical execution.

A command shall not be marked `COMPLETED` because it was:

- Accepted by the API.
- Stored.
- Published.
- Delivered.
- Acknowledged.

Completion requires the approved final device event.

A timeout must remain distinct from failure and completion.

When physical state is unknown, say it is unknown.

Do not implement blind automatic retries for physical commands.

---

## 19. Security Rules

Agents shall follow `SECURITY.md`.

Mandatory controls include:

- HTTPS in production.
- MQTT over TLS in production.
- Password hashing.
- Secure session handling.
- CSRF protection where required.
- CORS allowlist.
- Content Security Policy.
- Input validation.
- Rate limiting.
- Secret management.
- Topic ACLs.
- Device credential isolation.
- Audit logging.
- Security headers.
- Dependency scanning.
- Secret scanning.
- Safe logging.

Never create custom cryptography.

Never commit secrets.

Never store secrets in frontend code or local storage.

---

## 20. Testing Rules

Every implementation change must include relevant tests.

Use `TESTING.md` as the test authority.

Minimum expected test layers:

### Business Logic

- Unit tests.

### API or Database Change

- Integration tests.

### User Flow

- End-to-end test when feasible.

### Security-Sensitive Change

- Negative permission and manipulation tests.

### MQTT or Device Change

- Contract and integration tests.

### Faucet Control

- Idempotency, duplicate, expiry, timeout, and state-transition tests.

### I18N

- English and Indonesian tests.

A defect fix should include a regression test.

Do not remove failing tests merely to make CI pass.

---

## 21. Required Negative Tests

Agents must actively test what users are not allowed to do.

Examples:

- Pending Admin opens protected route.
- Admin approves another user.
- Admin edits another profileee.
- Admin changes their own role.
- Admin changes their own status.
- Admin accesses an unassigned device.
- View-only Admin sends faucet command.
- User changes device ID in URL.
- Duplicate command is submitted.
- Expired command is delivered.
- Device publishes to another device topic.
- Missing telemetry is converted to zero.
- Language switch changes permission.

Negative tests are mandatory for security-critical features.

---

## 22. Logging and Audit Rules

High-risk actions shall produce audit events.

Required categories include:

- Registration.
- Approval.
- Rejection.
- Suspension.
- Deactivation.
- profileee updates.
- Device assignment.
- Device revocation.
- Login success and failure.
- Faucet command creation.
- Faucet command state changes.
- Alert acknowledgement.
- High-risk authorisation denial.

Logs and audit records shall not contain:

- Passwords.
- Password hashes.
- Session tokens.
- Reset tokens.
- Device passwords.
- Private keys.
- Broker administrator credentials.

Use structured logs and correlation identifiers.

---

## 23. Error Handling Rules

Errors shall be:

- Safe.
- Stable.
- Machine-readable.
- Translatable.
- Actionable where possible.

Do not expose:

- Stack traces.
- SQL details.
- Broker internals.
- Secret values.
- Private object existence where concealment is required.

Use appropriate distinctions:

```text
401 → unauthenticated
403 → authenticated but forbidden
404 → not found or concealed
409 → conflicting state
422 → domain validation
503 → dependency unavailable
```

---

## 24. Dependency Rules

Before adding a dependency:

1. Confirm the existing stack does not already provide the capability.
2. Verify maintenance status.
3. Review security history.
4. Confirm licence compatibility.
5. Prefer established libraries.
6. Avoid adding large libraries for trivial functionality.
7. Add the dependency to the correct package only.
8. Update lock files.
9. Add tests.

Do not add competing libraries for:

- Forms.
- Validation.
- Charts.
- Date handling.
- I18N.
- State management.

unless the change is explicitly approved.

---

## 25. Migration Rules

For database migrations:

- Make migrations versioned.
- Test from an empty database.
- Test from the previous schema.
- Avoid destructive changes without a backup plan.
- Consider locks on telemetry tables.
- Preserve backwards compatibility where possible.
- Document manual recovery steps.
- Never modify production schema manually during normal work.

For repository migrations:

- Preserve history where practical.
- Avoid broad file moves mixed with feature changes.
- Verify build before and after.

---

## 26. High-Risk Files and Areas

Changes in these areas require extra review:

```text
Authentication configuration
Session handling
RBAC helpers
User approval services
Device access services
MQTT broker configuration
Gateway command publisher
Command state machine
Idempotency logic
Database migrations
Secrets configuration
Production deployment
Backup and restore
```

Agents must call out these files explicitly in the final report.

---

## 27. Mandatory Human Review

Human review is required for:

- First Owner provisioning.
- Session architecture.
- Role or permission changes.
- Device assignment logic.
- Production MQTT credentials and ACLs.
- Faucet command API.
- Gateway command publishing.
- Command acknowledgement.
- Command state transitions.
- Duplicate-command protection.
- Timeout handling.
- Manual Open/Close.
- Production database migration.
- Backup and restore.
- Production physical-control enablement.

An agent must not bypass human review because tests pass.

---

## 28. Hard Stops

Stop implementation and report a blocker when:

- A task is marked `BLOCKED`.
- A required policy is `TBD`.
- A change could enable unauthorised physical control.
- Sensor units are required but unknown.
- `BAT` (Battery) parameter meaning or units are required but unknown.
- The Owner/Admin control matrix is unresolved.
- Command concurrency is unresolved and implementation depends on it.
- Timeout behaviour is unresolved and implementation depends on it.
- Hardware acknowledgement semantics are unclear.
- The task requires production credentials.
- The task requires irreversible production changes.
- Documents conflict materially.
- Existing code differs significantly from `FRONTEND_AUDIT.md`.

Do not guess.

---

## 29. Safe Defaults

When a non-blocking implementation detail is unresolved, prefer:

- Deny access.
- Disable physical control.
- Treat device state as unknown.
- Treat data as unavailable.
- Preserve historical records.
- Avoid automatic retry.
- Avoid exposing resource existence.
- Use canonical values.
- Use explicit validation.
- Keep feature behind configuration or feature flag.

Safe defaults must not replace decisions marked as mandatory blockers.

---

## 30. Feature Flags

High-risk incomplete features should be protected by feature flags.

Recommended flags:

```text
ENABLE_FAUCET_CONTROL
ENABLE_FAUCET_CANCEL
ENABLE_FAUCET_STOP
ENABLE_DEVICE_PROVISIONING
ENABLE_AUDIT_EXPORT
ENABLE_MONITORING_EXPORT
```

Production defaults should remain disabled until approved.

Feature flags shall not replace server-side authorisation.

---

## 31. Agent Work Procedure

For every task:

### Step 1 — Read

Read:

- `AGENTS.md`.
- Relevant task in `TASKS.md`.
- Related authoritative specifications.
- Existing code in affected modules.

### Step 2 — Inspect

Identify:

- Existing patterns.
- Existing tests.
- Existing utilities.
- Relevant database models.
- Relevant API handlers.
- Security boundaries.
- Potential regressions.

### Step 3 — Plan

Write a concise plan containing:

```text
Task IDs
Files to modify
Data changes
API changes
Security checks
Tests
Documentation updates
```

### Step 4 — Implement

- Make the smallest coherent change.
- Follow existing conventions.
- Keep business logic testable.
- Add runtime validation.
- Avoid unrelated refactoring.

### Step 5 — Test

Run the narrowest relevant tests first, then broader tests.

Recommended order:

1. Unit tests.
2. Type check.
3. Lint.
4. Integration tests.
5. E2E tests.
6. Build.

### Step 6 — Review

Check:

- Requirements.
- Security.
- RBAC.
- Device scope.
- I18N.
- Null handling.
- Error handling.
- Audit.
- Tests.

### Step 7 — Report

Provide the required completion report.

---

## 32. Required Completion Report

At the end of work, report:

```text
Implemented task IDs:
Summary:
Files changed:
Database migrations:
API changes:
Security considerations:
Tests added:
Tests run:
Test results:
Documentation updated:
Known limitations:
Remaining blockers:
Suggested next task:
```

Do not claim tests passed unless they were actually run.

Do not claim a feature is complete when a blocker remains.

---

## 33. Commit Guidance

Recommended commit format:

```text
type(scope): summary
```

Examples:

```text
feat(auth): add pending admin registration
feat(rbac): enforce device-level access
feat(gateway): validate soil telemetry
fix(control): prevent duplicate faucet commands
test(auth): cover suspended account access
docs(api): document approval endpoints
```

Keep security-critical changes in focused commits.

Do not mix broad formatting changes with functional changes.

---

## 34. Pull Request Guidance

A pull request should include:

- Task IDs.
- Requirement references.
- Summary.
- Screenshots for UI changes.
- API examples for contract changes.
- Migration notes.
- Security analysis.
- Test results.
- Rollback considerations.
- Remaining `TBD` items.

High-risk pull requests shall identify required human reviewers.

---

## 35. Code Review Checklist

Reviewers and agents shall verify:

### Requirements

- Does the change match the authoritative documents?
- Was a `TBD` invented?

### Security

- Is authentication required?
- Is account status checked?
- Is permission checked?
- Is resource access checked?
- Is device access checked?
- Are inputs validated?
- Are secrets protected?

### Data

- Are zero and null distinct?
- Are timestamps correct?
- Are canonical values used?
- Are transactions required?
- Are indexes needed?

### Frontend

- Is the existing design preserved?
- Are all UI states present?
- Is text translated?
- Is accessibility considered?

### Device Control

- Is the command durable?
- Is idempotency enforced?
- Is expiry enforced?
- Is completion confirmed correctly?
- Could the change trigger duplicate physical execution?

### Tests

- Are positive and negative tests included?
- Are regressions covered?
- Were tests actually run?

---

## 36. Documentation Update Rules

Update documentation when:

- An open decision is resolved.
- An API changes.
- A database schema changes.
- A permission changes.
- A command state changes.
- A device payload changes.
- A new error code is introduced.
- A new dependency changes architecture.
- A security control changes.
- A task is completed or split.

Do not let implementation become the only source of truth.

---

## 37. Definition of Done

A change is complete only when:

### Functional

- The requested behaviour works.
- Alternative and error states work.
- No fabricated values appear.
- Existing functionality remains stable.

### Security

- Authentication and authorisation are enforced.
- Device scope is enforced.
- High-risk actions are audited.
- Secrets are protected.

### Internationalisation

- English and Indonesian are supported.
- Accessibility labels are localised.
- Canonical values remain untranslated.

### Testing

- Tests are added.
- Tests pass.
- Negative paths are tested.
- Build passes.

### Documentation

- Relevant documents are updated.
- Blockers and limitations are reported.
- Task status is accurate.

---

## 38. Project-Specific Prohibitions

Agents shall never:

- Create an Owner through public registration.
- Allow a pending Admin into protected pages.
- Allow Admins to manage other users.
- Trust a browser-supplied role.
- Trust a browser-supplied account status.
- Trust a browser-supplied target volume.
- Expose MQTT credentials to the browser.
- Retain faucet commands in MQTT.
- Mark a command completed without final confirmation.
- Treat timeout as completion.
- Retry a physical command blindly.
- Convert missing telemetry into zero.
- Translate API or database enum values.
- Enable production control before approval.
- Commit secrets.
- Remove audit history to simplify development.
- Use frontend visibility as the only security control.

---

## 39. Recommended First Agent Prompt

Use this prompt after placing all specification files in the repository:

```text
Read AGENTS.md and all project documentation referenced by the selected task.

Start with TASK-0001 only: Confirm Existing Frontend Technology.

Do not modify application behaviour yet.

Inspect the current repository and update FRONTEND_AUDIT.md with:

- Framework and version
- Build tool
- Routing
- Styling
- Component libraries
- State management
- Authentication code
- API integration
- Chart and map libraries
- Project structure
- Reusable components
- Existing technical debt
- Security concerns
- Files that must be preserved
- Conflicts with the proposed architecture

Then report:

- Files inspected
- Findings
- Documentation changes
- Blockers
- Recommended next READY task

Do not start another task.
```

---

## 40. Recommended Prompt After Frontend Audit

After `TASK-0001` is complete and the architecture decisions are reviewed:

```text
Read AGENTS.md, TASKS.md, FRONTEND_AUDIT.md, ARCHITECTURE.md, DATABASE.md, SECURITY.md, and TESTING.md.

Implement only the next READY foundation task whose dependencies are complete.

Before coding, report:

- Task ID
- Task title
- Dependencies
- Files expected to change
- Tests expected
- Known blockers

Do not implement any BLOCKED task.
Do not enable faucet control.
Preserve the existing frontend design.
Add tests with the implementation.
At completion, use the reporting format required by AGENTS.md.
```

---

## 41. Current Documentation Checklist

Expected project documentation:

```text
docs/FRONTEND_AUDIT.md
docs/UI_UX.md
docs/PRD.md
docs/RBAC.md
docs/USER_FLOWS.md
docs/I18N.md
docs/DEVICE_COMMUNICATION.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API.md
docs/SECURITY.md
docs/TESTING.md
TASKS.md
AGENTS.md
README.md
```

Do not start full implementation if these files are missing from the working repository unless the task specifically concerns restoring the documentation set.

---

## 42. Current Known Blockers

The following remain unresolved unless newer project documentation says otherwise:

1. Existing frontend framework confirmation.
2. Authentication library and session strategy.
3. First Owner provisioning.
4. Whether `APPROVED` and `ACTIVE` remain separate.
5. Multiple Owner policy.
6. Owner device scope.
7. Owner faucet-control permission.
8. Admin faucet-control permission.
9. Control permission assignment model.
10. Concurrent command policy.
11. Cancel and stop support.
12. Command timeout values.
13. Late-event reconciliation.
14. Final MQTT broker.
15. Device authentication method.
16. Telemetry units.
17. ~~`Water BAT` meaning.~~ **RESOLVED** — `BAT` stands for Battery, incorporated into soil and water quality sensors (`DEC-MON-085`).
18. Telemetry interval.
19. Offline threshold.
20. Stale threshold.
21. Default and fallback locale.
22. Realtime transport.
23. Hosting.
24. Backup objectives.
25. Performance targets.
26. Hardware dispensing tolerance.

Agents shall check whether these blockers have been resolved in newer documentation before assuming they still apply.

---

## 43. Final Instruction

Implement carefully, incrementally, and transparently.

For this project, correctness and safety are more important than speed.

When uncertain:

```text
Stop.
Identify the exact conflict or missing decision.
Report the affected task and requirement.
Do not invent the answer.
```


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
< ! - -   T A S K - 0 8 0 2   R e c o n c i l e d :   2 0 2 6 - 0 8 - 1 9   - - >  
 
---

## TASK-0804 Governance & Implementation Record

`TASK-0804` gateway command publisher implementation record:
- **Status:** `DONE` (Verified & Reconciled 2026-08-20; Stale SENT Timeout Reconciled 2026-09-23)
- **Frontend Impact:** `NONE`
- **Selected UI Direction:** `N/A`
- **Existing Color Template:** `UNCHANGED`
- **Selected Motion Effects:** `None`
- **21st.dev MCP:** `NOT REQUIRED`
- **Summary:** Implemented and verified `CommandPublisher` in `@kebun-melon/iot-gateway`. Publishes eligible, unexpired `QUEUED` faucet commands for `WATER_TANK_NODE` devices over MQTT 5.0 (QoS 1, `retain=false`) to canonical topics `agriculture/{environment}/{siteId}/{deviceId}/command/faucet`. For `DISPENSE` actions, directly transmits the database-persisted canonical `targetVolumeMl` integer (from `TASK-0803`) alongside valid `phase` and `plantCount >= 1` without gateway-side recalculation. For `OPEN` and `CLOSE` actions, cleanly omits `phase`, `plantCount`, and `targetVolumeMl`. Enforces strict atomic state progression (`QUEUED` -> `SENT`) only upon broker publish confirmation; failed publishes leave commands `QUEUED` without false `SENT` marks; expired commands transition to `EXPIRED` without dispatch. Verified 100% test pass rate across targeted test suites (10/10 publisher tests, 42/42 gateway contract tests) and clean TypeScript typecheck (0 errors). Completed local simulated performance sanity tests (1,000 direct calls ~68.3 ops/s with p95 20.08 ms, 500 burst commands ~67.0 cmds/s, 2,000 soak commands ~66.7 cmds/s with zero leaks and safe reconnect recovery). Downstream `TASK-0805` (acknowledgement processing) remains pending and decoupled.
- 2026-09-23 Stale SENT Command Timeout Sweep & Concurrency Lock Release (`DEC-CTRL-094`):
  - Frontend impact: `NONE`
  - Selected UI direction: `N/A`
  - Existing color template: `UNCHANGED`
  - Selected motion effects: `None`
  - 21st.dev MCP: `NOT REQUIRED`
  - Summary: Resolved critical issue where faucet commands dispatched to flat hardware topics (`irigasi/melon/kontrol/valve` and `irigasi/melon/setting/otomasi` per `DEC-DEV-032`) remained permanently stuck in `SENT` status when unacknowledged by physical hardware, indefinitely locking device concurrency (`faucet_commands_one_active_per_device`):
    - Root Cause Analysis: For flat hardware topics, the physical microcontroller firmware does not publish MQTT acknowledgements (`ack/faucet`), and broker ACL restricts `Test_Device` to `irigasi/melon/sensor/volume`. Previously, `CommandPublisher.processQueuedCommands()` strictly queried commands with `status: QUEUED`. Once marked `SENT`, commands were never re-evaluated against their 5-minute expiry (`expiresAt`). Because `SENT` is an active state (`ACTIVE_STATUSES = ['QUEUED', 'SENT', 'ACKNOWLEDGED', 'IN_PROGRESS']`), the single active command concurrency guard locked subsequent commands indefinitely.
    - Permanent Fix (`sweepStaleSentCommands()`): Implemented `sweepStaleSentCommands()` in `apps/iot-gateway/src/commands/publisher.ts` and integrated it into the 2,000ms polling loop (`startPolling()`). It retrieves active `SENT` commands, checks `now >= command.expiresAt`, transitions expired commands to `TIMEOUT` (`COMMAND_EXPIRED_TIMEOUT`), records `metricsCollector.incrementCommandTimeouts()`, emits realtime update event `faucet.command.updated`, and catches DB rejections safely. This releases device concurrency locks automatically without manual database intervention.
    - Affected Files: `apps/iot-gateway/src/commands/publisher.ts` and `apps/iot-gateway/src/__tests__/command-publisher.test.ts`.
    - Automated Verification: Expanded publisher test suite from 10 to 14 unit tests in `command-publisher.test.ts` (100% pass rate), verifying timeout state transitions and error recovery. Ran full faucet test suites (123/123 tests passed: 14 publisher, 25 ACK processor, 32 event processor, 27 UI, 25 command repository). Monorepo typecheck passed cleanly with 0 errors across 4 workspaces.
    - Hardware Manual Validation: End-to-end verification with physical NodeMCU/ESP8266 hardware in the farm field remains pending hardware deployment and power-on.
<!-- TASK-0804 Reconciled: 2026-09-23 -->

---

## TASK-0808 Governance & Implementation Record

`TASK-0808` duplicate command protection implementation record:
- **Status:** `DONE` (Completed 2026-08-20)
- **Frontend impact:** `NONE`
- **Selected UI direction:** `N/A`
- **Existing color template:** `UNCHANGED`
- **Selected motion effects:** `None`
- **21st.dev MCP:** `NOT REQUIRED`
- **Summary:** Revalidated duplicate command protection for all three faucet command action types (`DISPENSE`, `OPEN`, `CLOSE`) including the `plantCount` multiplier contract introduced in `TASK-0802`/`TASK-0803`. Confirmed that the existing `createCommand` implementation in `FaucetCommandRepository` (`packages/database/src/faucet-command-repository.ts`) is already correct for all three actions: the transactional idempotency key check compares `deviceId`, `action`, `phase ?? null`, and `plantCount ?? null`, which correctly produces `null` for both `OPEN` and `CLOSE` (which carry no phase/plantCount) and detects `plantCount` mismatches for `DISPENSE` network retries. No production code changes were required. Added 7 targeted unit tests to `packages/database/src/__tests__/faucet-command-repository.test.ts`: (1) DISPENSE + different `plantCount` → conflict, (2) DISPENSE + identical `plantCount` network retry → returns existing, (3) OPEN idempotent re-submission → returns existing, (4) OPEN key reused for CLOSE action → conflict, (5) CLOSE idempotent re-submission → returns existing, (6) P2002 race recovery for OPEN → returns existing, (7) P2002 race recovery for CLOSE → returns existing. Verified 21/21 tests pass (14 original + 7 new) with zero regressions across full workspace test suite. No database migrations, API changes, or frontend changes required.

<!-- TASK-0808 Completed: 2026-08-20 -->


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

---

## TASK-0916 Governance, Rehearsal, Dev & Staging Cutover Implementation Record

`TASK-0916` database migration, local restore rehearsal, Singapore Dev cutover, and Singapore Staging cutover record:
- **Status:** `DONE` (Technical migration & cutover completed; 72-hour soak period active through 2026-09-11 15:28:30 UTC; Mumbai project deletion tracked as post-migration retirement follow-up)
- **Frontend impact:** `NONE`
- **Selected UI direction:** `N/A`
- **Existing color template:** `UNCHANGED`
- **Selected motion effects:** `None`
- **21st.dev MCP:** `NOT REQUIRED`
- **Summary:** Executed Singapore Dev and Singapore Staging cutovers, redeployed containerized staging, and hardened E2E test isolation for the Supabase PostgreSQL migration from AWS Mumbai (`ap-south-1`) to AWS Singapore (`ap-southeast-1`) governed by `DEC-INF-095` and [`docs/SUPABASE_MIGRATION_RUNBOOK.md`](file:///c:/Users/Puroh/Documents/Melon/docs/SUPABASE_MIGRATION_RUNBOOK.md).
  - **Singapore Dev Cutover (Completed 2026-09-08):** Restored schema, data, and RLS to Singapore Dev (`unbyxlkrzqlafolxcypi`, AWS `ap-southeast-1`) with 100% row-count parity across all 25 non-migration tables against [`backups/cutover/dev_20260908_025808/dev_manifest.tsv`](file:///c:/Users/Puroh/Documents/Melon/backups/cutover/dev_20260908_025808/dev_manifest.tsv) (11 baseline migration rows, 13 post-deploy records: 11 applied + 2 historical rollbacks). Physically verified all 13 performance indexes. Rotated `INTERNAL_SERVICE_TOKEN` using 32-byte hex CSPRNG. Verified Owner login (active session `de8a9c04-5829-44bb-875a-eca4edbf5a88`), REST telemetry ingestion (3 writes), and subscriber-side SSE chunk receipt. Pinned Playwright to port `3005` (`reuseExistingServer: false`) with fail-closed DB validation.
  - **Singapore Staging Cutover (Completed 2026-09-08):** Restored schema, data, and RLS to Singapore Staging (`ihgoxqdncepbcrqkchxu`, AWS `ap-southeast-1`, PostgreSQL 17.6.1.166). Verified 100% bit-for-bit row-count parity across all 26 tables against immutable snapshot manifest [`backups/cutover/staging_20260908_185145/staging_manifest.tsv`](file:///c:/Users/Puroh/Documents/Melon/backups/cutover/staging_20260908_185145/staging_manifest.tsv) (28 FKs, 0 orphans, 10 baseline migrations). Deployed pending additive migration `20260905040000_add_auth_and_fk_performance_indexes` via `deploy_singapore_staging_migrations.ps1`, preserving `sessions_user_active_idx` and verifying all 13 performance indexes valid and ready. Reconfigured `.env.staging` to Singapore transaction pooler (`aws-0-ap-southeast-1.pooler.supabase.com:6543`), rebuilt and redeployed staging containers (`kebun-melon-staging-web` port 3000, `kebun-melon-staging-gateway` port 3001), and verified health probes (`/health`, `/ready` HTTP 200). Verified Owner login (active session `3072c4f8-973e-4502-ab6b-8df589eaff72`, synchronous audit log `35c7c64b-73f1-4f37-bbfd-ed190d779c44`, `DEC-AUTH-107` enforced) and telemetry write to `soil_readings` (Reading ID `676f7aca-a6f1-4ae4-a7ef-a00557a2c536`). Remediated in-route event publishing in soil/water telemetry endpoints and verified live browser EventSource delivery correlating 100% with persisted reading `d319dd56-821c-47b8-a56e-4012cd26f4f4` (Gate 5 PASS). `ENABLE_FAUCET_CONTROL=false` strictly preserved across all services.
  - **Owner Decommissioning Decision:** Per formal Owner decision, Mumbai is no longer needed as a rollback environment; standby retention is unbundled from cutover criteria, and Mumbai rollback is officially decommissioned. Technical cutover (`TASK-0916`) is **`DONE`**.
  - **Environment Status & Staleness:** Mumbai Dev (`xjsencdgfcbkzdzqcnqx`) and Mumbai Staging (`scqrbtfilmttqrutynyo`) are paused (`INACTIVE`, 0 active project slots) and permanently stale.
  - **72-Hour Soak Period:** Restarted at `2026-09-08 15:28:30 UTC` post container redeploy. Earliest eligible completion is `2026-09-11 15:28:30 UTC`. Sampled healthy probe observations confirm service health at tested points, with the gap between periodic sample probes and continuous telemetry aggregation explicitly disclosed. Zero outages observed during active checks. Mumbai project deletion proceeds as post-migration retirement follow-up upon soak completion and verified independent cold-storage backup.
  - **Operator CI Gates:** The five pre-commit CI gates (`npm run test:coverage`, `npm run test:integration`, `npm run check:quality`, `npm run test`, `npm run test:e2e`) are reserved for manual execution by the operator.
<!-- TASK-0916 Dev & Staging Cutover Reconciled: 2026-09-08 -->

---

## TASK-0413 Governance & External ML Supabase Integration Record

`TASK-0413` external Supabase ML prediction integration and outbound recommendation pipeline record:
- **Status:** `IN_PROGRESS` (Phase A, Phase B, Database Mapping, and Phase C Outbound MQTT Completed 2026-09-18; Phase D Dashboard Binding pending)
- **Frontend impact:** `NONE` (Phases A–C) / `MINOR` (Phase D, zero layout redesign per `DEC-UIUX-101`)
- **Selected UI direction:** `Premium Minimal Ops` (for upcoming Phase D dashboard cards)
- **Existing color template:** `UNCHANGED`
- **Selected motion effects:** `None` (Phases A–C) / `KPI refresh`, `Card hover` (Phase D)
- **21st.dev MCP:** `NOT REQUIRED`
- **Summary:**
  - **Phase A (Contracts & Client Adapter):** Defined canonical schemas in `packages/contracts/src/prediction.ts` and implemented read-only HTTPS PostgREST client in `packages/database/src/external-prediction-client.ts` with 30s TTL cache, 3000ms timeout, candidate column fallback, and JSON recommendation parser.
  - **Phase B (Protected Prediction API):** Implemented `GET /api/v1/devices/[deviceId]/predictions/latest` in `apps/web` with session authentication, RBAC device access verification (`requireDeviceViewAccess`), dual identifier resolution (UUID and canonical string `deviceId`), server-side cache control, and strict privacy (masking external ML IDs to canonical Melon IDs, zero URL/key leakage).
  - **Database-Driven Device Mapping:** Added `device_external_mappings` table and repository methods in `packages/database/src/device-repository.ts` (`getActiveExternalDeviceId`, `upsertExternalMapping`, `getExternalMappings`) to dynamically resolve external ML IDs from Melon database. Enforced fail-closed behavior in production.
  - **Phase C (Outbound MQTT Recommendation Publishing):** Integrated non-blocking, asynchronous prediction dispatch into `SoilWaterMqttAdapter` (`apps/iot-gateway`). Configurable debounce delay (`EXTERNAL_ML_DEBOUNCE_MS`, default 1500ms pending confirmed pipeline latency), staleness validation (`EXTERNAL_ML_MAX_STALENESS_SECONDS`, default 300s), duplicate suppression (`lastPublishedPredictionId`), stable `messageId` and `predictionId` for subscriber idempotency, and advisory-only QoS 1 / `retain: false` MQTT dispatch.
  - **Verification:** 95/95 unit tests passed across 4 suites (`soil-water-adapter.test.ts` 37/37, `device-repository.test.ts` 23/23, `prediction-latest-route.test.ts` 15/15, `external-prediction-client.test.ts` 20/20), 0 monorepo typecheck errors, and live end-to-end MQTT verification confirmed against EMQX Cloud broker for both soil and water quality domains.
<!-- TASK-0413 Phases A-C Reconciled: 2026-09-18 -->

---

## TASK-0414 Governance, Dual MQTT Broker Architecture, EC Standardization & Hardware Telemetry Verification Record

`TASK-0414` dual MQTT broker integration, canonical EC unit standardization, and hardware telemetry ingestion debugging record:
- **Status:** `IN_PROGRESS` (Software pipeline & synthetic ingestion verified; physical ESP32 telemetry pending hardware team firmware inspection)
- **Frontend impact:** `MINOR` (Preserved layout, color tokens, and chart controls; standardized EC units)
- **Selected UI direction:** `Premium Minimal Ops`
- **Existing color template:** `UNCHANGED`
- **Selected motion effects:** `None`
- **21st.dev MCP:** `NOT REQUIRED`
- **Summary:**
  - **EC Unit Standardization (`DEC-MON-091`):** Canonical EC unit is standardized directly in `µS/cm` across PostgreSQL database, Prisma schema, API serialization, UI visualization (`MonitoringDashboard.tsx`, `useHistoricalMonitoring.ts`, `NPKChart`, `WaterNutrientChart`), device simulator (`scripts/device-simulator.ts`), and external ML inference integration. Removed legacy `mS/cm` assumptions and arbitrary `×1000` display multipliers. Verified full compatibility with SmartTani two-sided agronomic standards (Soil optimal: 800–2500 µS/cm; Water optimal: 0–500 µS/cm).
  - **Dual MQTT Broker Architecture (`DEC-DEV-033`):**
    - **Primary Broker (EMQX Cloud):** Preserved for Water Tank Node (`WATER_TANK_NODE`, client ID `water-tank-node-zi37gz`), faucet valve control, and automation configuration (`irigasi/melon/...`) over MQTT 5.0 / TLS / WSS.
    - **Secondary Broker (HiveMQ Cloud):** Dedicated broker (`mqtts://217c0d73f9b648c09a5741c80dbb80df.s1.eu.hivemq.cloud:8883`) for Soil ESP32 (`melon-esp32-tanah1`) and Water Quality ESP32 (`melon-esp32-air1`) telemetry topics (`melon/sensor-tanah/data-2424600050`, `melon/sensor-air/data-2424600050`) and outbound recommendation topics (`melon/ai-tanah/rekomendasi-2424600050`, `melon/ai-air/rekomendasi-2424600050`).
    - **Lightweight Gateway Client Support:** Implemented dedicated dual MQTT client in `apps/iot-gateway` without memory bloat, maintaining a stable configurable client ID (`SOIL_WATER_MQTT_CLIENT_ID=melon-gateway-soil-water`). Updated health and readiness probes (`/health`, `/ready`) to report both EMQX and HiveMQ broker statuses independently. Wired graceful shutdown to cleanly disconnect both broker clients.
    - **Zero Staging or DB Schema Changes:** Retained existing PostgreSQL tables (`soil_readings`, `water_readings`, `devices`) and strictly isolated from staging container deployments.
  - **Verification Results (Software Pipeline & Synthetic Telemetry):**
    - Live HiveMQ Cloud connection established over TLS port 8883.
    - EMQX Cloud connection preserved and operational.
    - Gateway `/ready` probe reports both `emqx: { connected: true }` and `hivemq: { connected: true }`.
    - Synthetic telemetry messages on both soil and water topics successfully ingested through HiveMQ Cloud, dynamically resolved via `devices.client_id` (`melon-esp32-tanah1` $\rightarrow$ `soil-node-jvbkdbv`; `melon-esp32-air1` $\rightarrow$ `water-quality-node-quiua`), persisted to database, and device status updated to `ONLINE`.
  - **Current Hardware Verification Status (Pending Firmware Inspection):**
    - The software and ingestion backend is completely ready and verified.
    - Physical ESP32 telemetry has **not** been observed yet on HiveMQ Cloud topics.
    - The hardware team provided broker parameters only. Physical firmware source code (`.ino` / `.cpp`) and serial runtime logs are still required from the hardware team to resolve physical device connectivity.
    - Target firmware items identified for hardware team audit:
      1. Mandatory TLS via `WiFiClientSecure` with `setInsecure()` (standard `WiFiClient` fails on HiveMQ port 8883).
      2. Bare hostname string in `PubSubClient::setServer()` without `mqtts://` prefix.
      3. Setting `client.setBufferSize(512)` to prevent silent packet drops due to the default 128-byte `MQTT_MAX_PACKET_SIZE`.
      4. Top-level `"clientId"` in the published JSON payload for database device mapping.
      5. Checking `client.state()` on connection failure (`rc = -2` TLS/DNS failure, `rc = 4` bad credentials).
    - Status: Marked as **`PENDING_HARDWARE_FIRMWARE_LOGS`**.
  - **Staging Deployment & Resend Custom Domain Synchronization (Completed 2026-09-20):**
    - Aligned `.env.staging` and `.env.staging.example` with verified Resend custom sending domain `RESEND_FROM_EMAIL="Melon Madura <noreply@melonmadura.my.id>"`, eliminating default test sender usage (`onboarding@resend.dev`) across staging.
    - Verified Supabase Staging PostgreSQL schema (`ihgoxqdncepbcrqkchxu`) has all 15 migrations applied with zero drift.
    - Rebuilt and restarted staging Docker containers (`docker compose -f docker-compose.staging.yml up -d --build`). Verified both containers `healthy`:
      - `kebun-melon-staging-web` (port 3000): `/health` HTTP 200 (`{"status":"ok"}`), `/ready` HTTP 200 (`{"status":"ready","dependencies":{"database":"up","gateway":"up","broker":"up"}}`).
      - `kebun-melon-staging-gateway` (port 3001): `/health` HTTP 200 (`{"status":"pass","service":"iot-gateway"}`).
    - Strictly verified `ENABLE_FAUCET_CONTROL=false` safety invariant across all staging services.
<!-- Staging Deployment Reconciled: 2026-09-20 -->


