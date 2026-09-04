# Frontend Codebase Audit: Kebun Melon

> **Task Reference:** `TASK-0001 — Confirm Existing Frontend Technology`
> **Audit Status:** Complete — Confirmed & Verified
> **Source of Truth Rule:** The existing frontend design and visual layout remain the visual source of truth.
>
> **Reconciliation Note (TASK-0914):** `TASK-0914` (EMQX Cloud direct connectivity) is a backend gateway and simulator hardening task (`Frontend impact: NONE`). Frontend UI layouts, components, charts, and styling are preserved without modification. Monitoring UI smoke testing was intentionally deferred/skipped during backend gateway verification.


---

## 1. Confirmed Technology Stack and Exact Versions

### Core Framework & Runtime
* **Framework**: Next.js `14.2.5` (App Router architecture, ES Modules via `next.config.mjs`) — *Confirmed in `package.json`*
* **Core Library**: React `^18.3.1` / React DOM `^18.3.1` — *Confirmed in `package.json`*
* **Language**: TypeScript `^5` (`strict: true` in `tsconfig.json`) — *Confirmed in `package.json` and `tsconfig.json`*
* **Runtime**: Node.js `v20.12.2` — *Confirmed via runtime inspection (`node -v`)*
* **Package Manager**: npm `10.5.0` (`package-lock.json` v3 lockfile) — *Confirmed via runtime inspection (`npm -v`)*

### Styling & Class Utilities (`package.json`)
* **Tailwind CSS**: `^3.4.1` — *Confirmed in `package.json` & `tailwind.config.ts`*
* **PostCSS / Autoprefixer**: `postcss` (`^8`), `autoprefixer` (`^10.0.1`) — *Confirmed in `postcss.config.mjs`*
* **Class Utilities**: `clsx` (`^2.1.1`), `tailwind-merge` (`^2.4.0`), `class-variance-authority` (`^0.7.0`) — *Confirmed in `package.json` & `lib/utils.ts`*

### UI Primitives & Iconography
* **Icon Library**: `lucide-react` (`^0.417.0`) — *Confirmed in `package.json`*
* **Radix UI Primitives (Installed)**:
  * `@radix-ui/react-slot` (`^1.1.0`)
  * `@radix-ui/react-tabs` (`^1.1.0`)
  * `@radix-ui/react-switch` (`^1.1.0`)
  * `@radix-ui/react-progress` (`^1.1.0`)
  * `@radix-ui/react-dialog` (`^1.1.1`)
  * `@radix-ui/react-label` (`^2.1.0`)

### Data Visualization
* **Recharts**: `recharts` (`^2.12.7`) — *Confirmed in `components/charts/NPKChart.tsx` and `components/charts/WaterNutrientChart.tsx`*

### Dev Dependencies & Code Quality
* `typescript` (`^5`)
* `@types/node` (`^20`), `@types/react` (`^18.3.5`), `@types/react-dom` (`^18.3.1`)
* `eslint` (`^8`), `eslint-config-next` (`14.2.5`) — *Confirmed in `.eslintrc.json`*

---

## 2. Build Tooling and Available Scripts

### Build System
* **CLI Engine**: Next.js CLI (`next`) — *Confirmed in `package.json`*

### Defined Scripts (`package.json`)
* `npm run dev`: Starts local development server (`next dev`)
* `npm run build`: Production build compilation (`next build`) — *Verified: Builds cleanly with 0 errors*
* `npm run start`: Runs compiled production server (`next start`)
* `npm run lint`: Executes Next.js ESLint checks (`next lint`) — *Verified: Passes cleanly with 0 warnings/errors*

### Additional Verification Commands
* `npx tsc --noEmit`: Strict TypeScript type checking — *Verified: Passes cleanly with 0 type errors*

---

## 3. Project Directory Structure

```text
Kebun-Melon/
├── .eslintrc.json              # ESLint configuration (extends next/core-web-vitals)
├── next.config.mjs             # Next.js configuration (remote image patterns)
├── postcss.config.mjs          # PostCSS configuration (Tailwind, Autoprefixer)
├── tailwind.config.ts          # Tailwind CSS design system tokens (Forest & Earthy palettes)
├── tsconfig.json               # TypeScript compiler configuration (strict mode, path aliases)
├── package.json                # Project manifest and dependencies
├── package-lock.json           # npm lockfile (v3)
├── kebun Melon-1.html          # Legacy single-file HTML prototype reference (146 KB)
├── docs/                       # Project documentation directory
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── DEVICE_COMMUNICATION.md
│   ├── FRONTEND_AUDIT.md       # (This file)
│   ├── I18N.md
│   ├── PRD.md
│   ├── RBAC.md
│   ├── SECURITY.md
│   ├── TESTING.md
│   ├── UI_UX.md
│   └── USER_FLOWS.md
├── lib/                        # Shared utility modules and constants
│   ├── constants.ts            # Mock sensor data, user profileee, routes, NPK ranges
│   └── utils.ts                # Classname helper (`cn` combining clsx + tailwind-merge)
├── components/                 # React component library
│   ├── charts/                 # Recharts data visualization wrappers
│   │   ├── NPKChart.tsx        # BarChart for Nitrogen, Fosfor, Kalium
│   │   └── WaterNutrientChart.tsx # AreaChart for EC and pH trends
│   ├── navigation/             # App shell navigation bars
│   │   ├── BottomNav.tsx       # Fixed bottom mobile navigation bar
│   │   └── TopAppBar.tsx       # Fixed top header bar
│   ├── layout/                 # (Empty directory)
│   └── ui/                     # (Empty directory)
└── app/                        # Next.js 14 App Router routes & layouts
    ├── globals.css             # Base styles, custom gauge keyframes, gradients, shadows
    ├── layout.tsx              # Root HTML layout, metadata, & viewport exports
    ├── page.tsx                # Dashboard / Beranda (Root page `/`)
    ├── (auth)/                 # Authentication route group
    │   ├── layout.tsx          # Auth layout wrapper
    │   ├── login/page.tsx      # Login page (`/login`)
    │   ├── register/page.tsx   # 2-Step Sign-up page (`/register`)
    │   └── forgot-password/page.tsx # Password reset page (`/forgot-password`)
    ├── air/                    # Water & Nutrisi page (`/air`)
    │   └── page.tsx
    ├── tanah/                  # NPK Soil page (`/tanah`)
    │   └── page.tsx
    ├── notifikasi/             # Notifications & Alerts page (`/notifikasi`)
    │   └── page.tsx
    ├── setting/             # Settings page (`/setting`)
    │   └── page.tsx
    └── profileee/                 # profileee & Security page (`/profileee`)
        └── page.tsx
```

---

## 4. Routing System and Current Route Structure

Routing is managed strictly by the Next.js App Router (`app/` directory).

| Route Path | File Location | Render Type | Current Page Purpose & Description |
|---|---|---|---|
| `/` | `app/page.tsx` | Server Component | **Dashboard (Beranda)**: Crop health score gauge (92/100), weather status card, soil & water bento summary cards, critical alert banner, quick sensor metrics. |
| `/login` | `app/(auth)/login/page.tsx` | Server Component | **Login**: Server-side guest guard wrapper rendering `LoginView`. Form with email/password inputs, show/hide password toggle, simulated loading state, link to password recovery. Immediate server-side redirect to `/` for active sessions. |
| `/register` | `app/(auth)/register/page.tsx` | Server Component | **Register (Daftar Lahan Baru)**: Server-side guest guard wrapper rendering `RegisterView`. 2-step onboarding flow. Step 1: Role selection & data input. Step 2: Verification notice & T&C agreement. Immediate server-side redirect to `/` for active sessions. |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | Server Component | **Forgot Password**: Server-side guest guard wrapper rendering `ForgotPasswordView`. Clean layout without decorative image, empty input with neutral placeholder, 15:00 countdown matching token lifetime, `sessionStorage` cooldown persistence, 5s auto-dismissing toast. Immediate server-side redirect to `/` for active sessions. |
| `/reset-password` | `app/(auth)/reset-password/page.tsx` | Server Component | **Reset Password**: Server-side guest guard wrapper rendering `ResetPasswordView`. Consumes raw token from query params, enforces password complexity, handles invalid/expired token banners, resets password via Argon2id. Inaccessible to active sessions. |
| `/verify-email` | `app/(auth)/verify-email/page.tsx` | Server Component | **Email Verification**: Server-side guest guard wrapper rendering `VerifyEmailView`. Clean layout without decorative image, token extraction from query params, StrictMode-safe in-flight request deduplication with settlement cache eviction, automatic redirect to `/status?status=PENDING_APPROVAL` for Admin applicants, success view for Owners, and public resend form with countdown cooldown. Inaccessible to active sessions. |
| `/soil` | `app/soil/page.tsx` | Client Component | **NPK Soil Monitoring (`/soil`)**: Real-time soil metrics, latest sensor status, historical telemetry chart (`NPKChart`, `HistoricalChartControls`), 24h default range, metric selection, raw pagination. |
| `/water` | `app/water/page.tsx` | Client Component | **Water Quality & Reservoir Monitoring (`/water`)**: Real-time water metrics (pH, TDS, EC converted to `µS/cm`), historical telemetry chart (`WaterNutrientChart`, `HistoricalChartControls`), reservoir tank & flow metrics, 3-phase faucet preset UI. |
| `/tanah` & `/air` | Legacy paths | Not Found | **Legacy Routes**: Superseded by canonical `/soil` and `/water` routes. Requests return 404 Not Found. |
| `/notifikasi` | `app/notifikasi/page.tsx` | Server Component | **Notifikasi**: Sensor alert cards categorized by severity (error/kritis, warning/peringatan), target range comparisons, resolved alerts log. |
| `/setting` | `app/setting/page.tsx` | Server Component | **setting**: Settings menu with user profileee header card, navigation links to profileee, Notifications, Sensor Config, and Support. |
| `/profileee` | `app/profileee/page.tsx` | Client Component | **profilee & Keamanan**: Editable user profileee form (Name, WhatsApp, Farm Name), security options, logout button, fixed save CTA with toast. |

---

## 5. Styling System and Design System Audit

### Design System Architecture
* **Framework**: Tailwind CSS v3 with extended theme in `tailwind.config.ts`.
* **Typography**: `Inter` font family (`font-sans`), with predefined MD3-style typography scales:
  * `display-lg` (32px / 40px), `display-lg-mobile` (28px / 36px)
  * `headline-lg` (32px), `headline-md` (24px), `headline-sm` (20px)
  * `label-xl` (20px), `label-md` (14px), `label-sm` (12px)
  * `body-lg` (18px / 28px), `body-md` (16px / 24px)

### Color Tokens (Dual Material Design 3 Palettes in `tailwind.config.ts`)
1. **Auth Theme Tokens (Forest Green & Lime)**:
   * `primary`: `#003527`, `primary-container`: `#064e3b`
   * `secondary`: `#476800`, `secondary-container`: `#bcf063`
   * `tertiary`: `#003623`, `surface`: `#f9f9ff`
2. **App Theme Tokens (Earthy Agricultural Palette)**:
   * `app-primary`: `#0d631b`, `app-primary-container`: `#2e7d32`
   * `app-secondary`: `#79564b`, `app-secondary-container`: `#fed0c1`
   * `app-tertiary`: `#884200`, `app-tertiary-container`: `#ad5600`
   * `app-surface`: `#f9f9f9`, `app-surface-container-lowest`: `#ffffff`
   * `app-error`: `#ba1a1a`, `app-error-container`: `#ffdad6`

### Custom CSS & Gauges (`app/globals.css`)
* `.bento-shape`: 2rem border radius for bento grid cards.
* `.gauge-container`, `.gauge-fill`, `.ec-gauge-track`, `.ec-gauge-fill`: Half-circle SVG-like SVG/CSS gauge masks.
* `.ph-gradient`: Multi-stop linear gradient (`#ef4444` -> `#fbbf24` -> `#22c55e` -> `#3b82f6` -> `#6366f1`).
* `.gauge-bar-gradient`: Multi-stop nutrient gradient (`#ba1a1a` -> `#0d631b` -> `#ad5600`).
* `.soft-elevation`, `.soft-elevation-lg`: Custom soft box shadows (`rgba(121, 86, 75, 0.08)` / `0.12`).
* `.switch`, `.slider`: Custom iOS-style toggle switch implementation.

---

## 6. Detailed Technical Audit Findings (36 Audit Points)

### 1. Frontend Framework & Exact Version
Next.js `14.2.5` (App Router), React `^18.3.1`, React DOM `^18.3.1`. Verified in `package.json`.

### 2. Runtime and Package Manager Versions
Node.js `v20.12.2`, npm `10.5.0` (`package-lock.json` lockfileVersion 3). Verified via CLI.

### 3. Build Tool and Available Scripts
Next.js CLI engine. Scripts: `dev`, `build`, `start`, `lint`. `npm run build` compiles clean static/SSR artifacts without errors.

### 4. Routing System & Structure
Next.js 14 App Router (`app/`). 9 pages across root, `(auth)`, `/air`, `/tanah`, `/notifikasi`, `/setting`, `/profileee`.

### 5. Styling System
Tailwind CSS `^3.4.1`, PostCSS `^8`, Autoprefixer `^10.0.1`, `clsx` (`^2.1.1`), `tailwind-merge` (`^2.4.0`), `cva` (`^0.7.0`), custom CSS utilities in `app/globals.css`.

### 6. Design System & Component Libraries
Tailwind tokens in `tailwind.config.ts`, Lucide icons (`lucide-react` `^0.417.0`), Radix UI primitives installed (slot, tabs, switch, progress, dialog, label).

### 7. State-Management Approach
Local React `useState` only. No global store (Zustand, Redux, Context API) currently implemented.

### 8. Server-State and Data-Fetching Approach
Static client mock data imported from `lib/constants.ts`. No TanStack Query, SWR, Axios, or `fetch` wrappers.

### 9. Form and Validation Libraries
Native HTML inputs managed with local React `useState`. No React Hook Form, Zod, Yup, or Formik installed.

### 10. Existing Authentication and Session Implementation
Simulated client-side `useState` form submission handlers in `/login`, `/register`, `/forgot-password`. No HTTP endpoints, password hashing, JWT/session tokens, cookies, or server-side auth checks exist.

### 11. Existing Role or Permission Logic
Static profileee string `"Pemilik Lahan"` in `USER_profileeE` constant (`lib/constants.ts`). No RBAC middleware, role checking functions, or permission guards exist in the application code.

### 12. Current API Integrations
0 active API endpoints or HTTP calls. The entire application operates on static mock objects in `lib/constants.ts`.

### 13. Chart Libraries
`recharts` (`^2.12.7`) used in `components/charts/NPKChart.tsx` (BarChart) and `components/charts/WaterNutrientChart.tsx` (AreaChart). Custom half-circle CSS/SVG gauge meters.

### 14. Map or Geolocation Libraries
None installed. Location is represented as text `"Kebun Melon"` with a `MapPin` icon.

### 15. Internationalisation (I18N) Support

`next-intl` infrastructure installed and configured in `@kebun-melon/web` (`TASK-0601`). All 17 approved translation namespaces (`common`, `auth`, `navigation`, `dashboard`, `devices`, `soil`, `water`, `history`, `faucet`, `alerts`, `users`, `approvals`, `profileee`, `settings`, `validation`, `errors`, `accessibility`) plus preserved `system` created in `messages/id.json` and `messages/en.json` (`TASK-0602`). Hard-coded user-facing text across all authentication pages, protected dashboard and sensor views, historical charts, faucet control panels, and shell navigation migrated to `next-intl` translation hooks (`TASK-0603`) with 100% key parity, ICU placeholder consistency, technical abbreviation preservation, and comprehensive unit test verification. Mandatory initial language gate (`Select Language / Pilih Bahasa`), accessible Settings language modal switcher (`SettingsLocaleSwitcher` on `/setting`), `/settings` permanent redirect, presentation-layer system default device label localization, and responsive mobile selector layout completed and verified (`TASK-0604`).

### 16. Existing Database or ORM Integration
None. No database driver, ORM (Prisma/Drizzle), or persistence layer exists in the repository.

### 17. Environment-Variable Usage
None. No `.env` or `process.env` references exist.

### 18. Project Directory Structure
Standard Next.js App Router workspace with `app/`, `components/`, `lib/`, `docs/`, and legacy `kebun Melon-1.html`.

### 19. Reusable Layouts and Components
* Navigation: `BottomNav.tsx`, `TopAppBar.tsx`.
* Charts: `NPKChart.tsx`, `WaterNutrientChart.tsx`.
* Page-level sub-components: `HealthScoreGauge`, `MetricCard`, `ECGauge`, `PHBar`, `NPKMeter`, `AlertCard`, `SettingItem`, `PasswordStrengthMeter`.

### 20. Existing Soil-Monitoring Components
Canonical `/soil` page (`app/soil/page.tsx`), `components/charts/NPKChart.tsx`, `components/charts/HistoricalChartControls.tsx`, `hooks/useHistoricalMonitoring.ts`. Telemetry parameters present: Nitrogen, Phosphorus, Potassium (`mg/kg`), Temperature (`°C`), Moisture (`%RH`), pH, EC (`µS/cm`), and derived Soil status. `NPKChart` renders NPK trend as a multi-line Recharts `LineChart` (Nitrogen `#0d631b`, Phosphorus `#884200`, Potassium `#476800`) and individual metrics as AreaCharts. Utilizes 1-hour client-side grouping, instant client caching across range presets (24h, 7d, 30d), range-based X-axis tick generation (`getCustomXTicks`), and application locale formatting without trailing punctuation (`DEC-UIUX-104`).

### 21. Existing Water-Monitoring Components
Canonical `/water` page (`app/water/page.tsx`), `components/charts/WaterNutrientChart.tsx`, `components/charts/HistoricalChartControls.tsx`, `hooks/useHistoricalMonitoring.ts`. Telemetry parameters present: EC (`µS/cm`), pH, TDS (`ppm`), and Water status. `WaterNutrientChart` renders historical nutrient curves with smooth gradients, range-based X-axis tick generation, and instant client cache switching. Note: `BAT` (Battery) parameter is removed from soil & water quality nodes (`DEC-MON-086`, superseding `DEC-MON-085`). Latitude and Longitude parameters are deleted.

### 22. Existing Device-Selection Components
None. Current UI assumes a single farm view without device picker, multi-device list, or `deviceId` context.

### 23. Faucet-Control Components (`/controls` / TASK-0807)
Completed and verified under `TASK-0807`. Dedicated `/controls` page hosting modular components:
* `FaucetControlPanel`: Root controller coordinating context, modal states, and HTTP `Idempotency-Key` header dispatch.
* `FaucetPresetSelector`: 3-phase Liter presets (0.3 L, 1.0 L, 1.5 L), `plantCount` stepper ($\ge 1$) with live total volume calculation preview (`0.3 L × 3 tanaman = 0.9 L`), manual `OPEN`/`CLOSE` buttons, and authoritative physical state badge (`OPEN`, `CLOSED`, `UNKNOWN`).
* `FaucetConfirmationModal`: Action-aware modal dialog for `DISPENSE` and manual `OPEN`/`CLOSE` with device details and operation warnings.
* `FaucetStatusCard`: Active command tracker executing 2,500ms status polling strictly during active states (`QUEUED`, `SENT`, `ACKNOWLEDGED`, `IN_PROGRESS`) and immediate termination upon terminal states.
* `FaucetHistoryTable`: Paginated execution history table with status badges and action-aware details.

### 24. Existing User-Management or Approval Components
`/setting` settings page has Owner summary card, `/register` has a 2-step registration form for sign-up input. No Owner approval dashboard, pending queue, user list, or account status controls exist.

### 25. Existing Tests and Test Frameworks
None. No test runner (Jest, Vitest, Playwright, Cypress) or test files exist in the repository.

### 26. Existing Linting, Formatting, and Type-Checking Configuration
ESLint `^8` with `eslint-config-next` (`14.2.5`), strict TypeScript `^5` (`tsconfig.json`). Type checking (`npx tsc --noEmit`) and linting (`npm run lint`) both pass with 0 errors. No Prettier config or pre-commit hooks.

### 27. Existing Docker, Deployment, or Infrastructure Configuration
None. No `Dockerfile`, `docker-compose.yml`, or CI/CD deployment files exist.

### 28. Current Technical Debt
1. 100% hardcoded mock data in `lib/constants.ts`.
2. Unused Radix UI dependencies (`@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-switch`, `@radix-ui/react-progress`).
3. External image dependencies (`i.pinimg.com`, `lh3.googleusercontent.com`).
4. Duplicate gauge/card styling inline rather than modular components in `components/ui`.
5. Empty directories `components/layout` and `components/ui`.
6. Root-level legacy HTML prototype file `kebun Melon-1.html` (146 KB).
7. Missing multi-device switcher/selection UI.
8. Missing `Water BAT`, Latitude, and Longitude telemetry displays.
9. Missing loading skeletons, empty states, offline indicators, and error boundaries.

### 29. Security Concerns
1. Unprotected client auth forms (no server auth, hashing, or session validation).
2. Missing server-side RBAC middleware and route guards.
3. Permissive remote image domain rules in `next.config.mjs` (`i.pinimg.com`, `lh3.googleusercontent.com`, `images.unsplash.com`).
4. Faucet control controls rendered without role/permission checks.

### 30. Accessibility Concerns
1. Interactive UI elements (gauges, presets, switchers) lack ARIA attributes (`aria-label`, `aria-selected`, `aria-expanded`).
2. Input fields rely on placeholder text without explicit `<label>` tags or `aria-describedby` error bindings.
3. Potential low contrast ratios on custom earthy container color combinations.

### 31. Responsive-Design Concerns
1. App is mobile-first (`max-w-md` / `max-w-2xl`), rendering as a centered narrow mobile frame on desktop viewports.
2. Bottom navigation bar (80px height) can overlap page content on short viewports without adequate `pb-24` padding.

### 32. Files and Visual Components That Must Be Preserved
* Visual styling system: `app/globals.css`, `tailwind.config.ts`.
* Route structures: `app/page.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/forgot-password/page.tsx`, `app/air/page.tsx`, `app/tanah/page.tsx`, `app/notifikasi/page.tsx`, `app/setting/page.tsx`, `app/profileee/page.tsx`.
* Navigation components: `components/navigation/BottomNav.tsx`, `components/navigation/TopAppBar.tsx`.
* Visualization components: `components/charts/NPKChart.tsx`, `components/charts/WaterNutrientChart.tsx`.

### 33. Conflicts Between Current Codebase and Proposed Specifications
* **Auth & RBAC (`RBAC.md` / `PRD.md`)**: Docs specify `OWNER` / `ADMIN` roles, public registration creating `ADMIN` (`PENDING_APPROVAL`), and Owner approval. Codebase has a static profileee with no server auth or approval UI.
* **Device Access (`DEVICE_COMMUNICATION.md`)**: Docs require multi-device support, `deviceId` scoping, MQTT gateway, and telemetry fields (`Water BAT`, Lat, Long). Codebase has single-farm mock view with no device picker or battery/GPS fields.
* **Internationalisation (`I18N.md`)**: Docs require dual `en` and `id` language support. Codebase is 100% hardcoded Indonesian.
* **GIS & Mapping (`PRD.md`)**: Docs specify map visualization. Codebase displays text `"Kebun Melon"`.
* **Testing (`TESTING.md`)**: Docs require unit, integration, and E2E suites. Codebase has zero test setup.

### 34. Dependencies That Are Obsolete, Duplicated, Unused, or Risky
* **Unused Dependencies**: `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-switch`, `@radix-ui/react-progress` are installed in `package.json` but custom CSS/HTML is used instead.
* **Risky Dependencies**: External image domain configurations in `next.config.mjs`.

### 35. Tasks in `TASKS.md` Eligible to Become `READY`
* `TASK-0101` — Establish Repository Structure (Dependencies: `TASK-0001` complete)
* `TASK-0102` — Configure TypeScript and Code Quality (Dependencies: `TASK-0101`)
* `TASK-0103` — Configure Environment Validation (Dependencies: None)
* `TASK-0003` — Establish Requirement IDs (Dependencies: None)

### 36. Tasks That Must Remain `BLOCKED`
* `TASK-0002` — Resolve Release-Blocking Product Decisions (BLOCKED by pending product decisions listed in `TASK-0002`).
* All downstream tasks dependent on `TASK-0002` or unresolved backend/auth/physical control decisions (e.g. `TASK-0201`, `TASK-0801`, `TASK-0806`, `TASK-0809`, etc.).

---

## 7. Confirmed vs. Assumptions vs. TBD Summary

| Category | Finding | Status |
|---|---|---|
| Framework & Version | Next.js 14.2.5, React 18.3.1, TypeScript 5 (Strict) | **Confirmed** |
| Runtime & Tools | Node.js v20.12.2, npm 10.5.0, ESLint 8 | **Confirmed** |
| Build & Lint | `npm run build`, `npm run lint`, `npx tsc --noEmit` pass with 0 errors | **Confirmed** |
| Auth & RBAC | Simulated UI state only, no server-side auth/RBAC | **Confirmed** |
| API & IoT | 100% static mock data (`lib/constants.ts`), no HTTP/MQTT | **Confirmed** |
| Tests | No unit, integration, or E2E tests installed | **Confirmed** |
| `BAT` Parameter Meaning | Resolved via `DEC-MON-086` (`BAT` removed from soil & water quality nodes) | **Resolved** |
| Release Decisions | Product decisions in `TASK-0002` unresolved | **BLOCKED / TBD** |

---

## 8. Current Frontend/Backend Reconciliation Status (TASK-0210 Sync)

The following reconciliation reflects the state of frontend integration against backend capabilities implemented up through **TASK-0210**:

| Frontend Surface | Backend Capability Status | Categorization | Integration & User-Facing Behaviour |
|---|---|---|---|
| `/login` | `POST /api/v1/auth/login` implemented | **Category A: Integrated** | Submits credentials, sets HTTP-only cookie, handles validation errors, pending approval redirect to `/status`, and respects `redirect` query parameter. Wrapped in `<Suspense>`. |
| `/register` | `GET /api/v1/auth/register/capabilities` & `POST /api/v1/auth/register` | **Category A: Integrated** | 2-Step Registration Flow: Step 1 checks `/capabilities` and renders role selection (OWNER enabled if 0 owners, greyed out if Owner exists; ADMIN always enabled). Step 2 collects user details. Submits `role`, `fullName`, `email`, `password`. Creates `OWNER` directly as `ACTIVE` (redirects to `/login?registered=owner`) or `ADMIN` as `PENDING_APPROVAL` (redirects to `/status?reason=PENDING_APPROVAL`). Server enforces atomic concurrency lock. |
| `/status` | `GET /api/v1/auth/session` & account status guards | **Category A: Integrated** | Revalidates account status via `/api/v1/auth/session`, renders pending/rejected/suspended/deactivated states, provides Logout/Refresh actions. |
| App Shell Middleware & Guarding | `middleware.ts` Edge Guard | **Category A: Integrated** | Guards protected pages & `/api/v1/approvals/*`. Redirects unauthenticated page requests to `/login?redirect=<path>` and returns `401 UNAUTHENTICATED` for API requests. |
| Logout Action (`/profileee` & `/status`) | `POST /api/v1/auth/logout` implemented | **Category A: Integrated** | Connected to real `POST /api/v1/auth/logout` endpoint in both `/profileee` and `/status` pages, revoking database session and clearing HTTP-only cookie. |
| `/approvals` | `/api/v1/approvals/*` endpoints implemented | **Category A: Integrated** | Fetches real pending Admin list with search and pagination, fetches user details, executes real `approve` and `reject` actions with decision notes. |
| `/setting` Role Awareness | `GET /api/v1/auth/session` & RBAC | **Category A: Integrated** | Fetches authenticated session. Conditionally displays the **Persetujuan Admin** (`/approvals`) card link ONLY when `role === 'OWNER'`. Hidden for `ADMIN`. |
| Dashboard (`/`) Telemetry | IoT/Telemetry API not implemented yet | **Category C: Deferred** | Telemetry endpoints are deferred to subsequent IoT tasks (TASK-0400+). Dashboard telemetry UI remains static until backend endpoints exist. |
| `/soil` & `/water` Detail Pages | Telemetry APIs (`TASK-0501`–`TASK-0504`) integrated | **Category A: Integrated** | Canonical routes `/soil` and `/water` render live telemetry (`TASK-0501`/`TASK-0502`), historical telemetry query endpoints (`TASK-0503`), and historical chart components (`TASK-0504`). Legacy `/tanah` and `/air` routes return 404 Not Found. |
| `/devices` & Device Selection | `GET /api/v1/devices`, `GET /api/v1/devices/{deviceId}`, `PATCH /api/v1/devices/{deviceId}` (`TASK-0302`/`TASK-0305`) | **Category A: Integrated** | Authorised devices sourced exclusively from `GET /api/v1/devices`. Owner receives global device visibility with canonical `deviceId` string badges and edit modal (`PATCH`). Admin visibility is strictly scoped to active assignments (`revokedAt === null`) with canonical `deviceId` strictly concealed across UI cards and selector dropdown. "Add Device" modal and `POST /api/v1/devices` are completely removed (`DEC-DEV-027`). |

---

## Monitoring and Device Frontend Integration Note (Reconciled 2026-08-19)

The following facts are verified in the frontend codebase regarding device selection, monitoring, and telemetry queries (`TASK-0306`, `TASK-0501`, `TASK-0503`, `TASK-0504`):
- **Frontend Identity Consumption:** Frontend device state (`DeviceContext`), page hooks (`useHistoricalMonitoring`), and child components consistently use immutable database primary key `devices.id` UUID as the selected device identity (`selectedDevice?.id || selectedDevice?.deviceId || null`).
- **Bare Route Neutrality:** Bare routes (`/`, `/sensor`, `/soil`, `/water`) initialize in a neutral state (`selectedDevice = null`) without auto-selecting the first device.
- **Route-Scoped Selection & Rehydration:** Active device selection syncs with URL parameters (`?deviceId=<UUID>`). On hard refresh, the selection safely rehydrates after revalidating against the server-authorized device list (`GET /api/v1/devices`).
- **Safety on Access Revocation:** If access to the currently selected device is revoked or nonexistent, the selection is cleared to `null` with a visible user banner.
- **Admin Canonical ID Concealment:** Monospace canonical `deviceId` rendering is displayed exclusively for Owner users; Admin users see only device names and types per `DEC-DEV-028`.
- **Canonical vs. Legacy Routes:** Canonical monitoring pages are `/soil` and `/water`; legacy `/air` and `/tanah` routes explicitly return 404 Not Found.
- **Historical Chart Error & Empty State Handling:** Zero-record telemetry responses (`{ series: [], pagination: { totalRecords: 0 } }`) render clean empty states rather than error banners or fake zero graphs.

<!-- Reconciled for Manual Faucet Open/Close Control and Volume Presets -->
< ! - -   T A S K - 0 8 0 2   R e c o n c i l e d :   2 0 2 6 - 0 8 - 1 9   - - >  
 
---

## Gateway Command Publishing Frontend Audit Note (Reconciled 2026-08-20)

The following facts are verified regarding the relationship between the web frontend and `TASK-0804` (`CommandPublisher` in `@kebun-melon/iot-gateway`):
- **Backend-Mediated Control:** Web frontend never establishes direct connections or publishes commands directly to the MQTT broker. Faucet controls created via `/api/v1/devices/{deviceId}/faucet-commands` enter PostgreSQL as `QUEUED`.
- **Publisher Passthrough:** The gateway command publisher safely polls `QUEUED` records and transmits canonical `targetVolumeMl` for `DISPENSE` (or clean `OPEN`/`CLOSE` payloads) over MQTT without altering frontend UI presentation or volume input bindings.
- **Visual Design & Safety:** Frontend preserves existing `Premium Minimal Ops` design tokens and awaits confirmed downstream device execution events before claiming physical outcome completion.
<!-- TASK-0804 Reconciled: 2026-08-20 -->

---

## Device Acknowledgement Processing Frontend Audit Note (Reconciled 2026-08-20)

The following facts are verified regarding the frontend boundary for `TASK-0805` (`AcknowledgementProcessor` in `@kebun-melon/iot-gateway`):
- **Zero Frontend Changes:** `TASK-0805` is entirely implemented within the backend IoT Gateway with zero UI modifications, zero design changes, and zero component updates (`Frontend impact: NONE`).
- **State Integrity:** Command status in the frontend UI reflects `ACKNOWLEDGED` (or `FAILED`) based on verified backend transitions, without prematurely displaying completion or inferring physical valve state.
- **Design Token & Aesthetic Preservation:** All frontend components retain approved `Premium Minimal Ops` visual tokens and color palettes unchanged.
<!-- TASK-0805 Reconciled: 2026-08-20 -->

---

## Device Execution Event State Machine Frontend Audit Note (Reconciled 2026-08-20)

The following facts are verified regarding the frontend boundary for `TASK-0806` (`FaucetEventProcessor` in `@kebun-melon/iot-gateway`):
- **Zero Frontend Changes:** `TASK-0806` is implemented entirely within the backend IoT Gateway (`Frontend impact: NONE`). Zero UI modifications, redesigns, or component changes were introduced.
- **Physical State Integrity:** The frontend does not infer physical valve state from command creation or acknowledgement; physical state confirmation (`OPEN`, `CLOSED`, `UNKNOWN`) is derived strictly from confirmed device execution events processed on the backend.
- **Design Token & Aesthetic Preservation:** All dashboard, sensor, and control pages continue to adhere strictly to `Premium Minimal Ops` with established color tokens and motion standards.
<!-- TASK-0806 Reconciled: 2026-08-20 -->

---

## Centralized Authentication State Hydration Frontend Audit Note (Reconciled 2026-08-22)

The following facts are verified regarding the frontend architecture of `TASK-0215` (Centralized Authentication State Hydration):
- **React Context Hydration:** Added `apps/web/context/AuthContext.tsx` providing `{ user, role, isAuthenticated }` to all client components via `useAuth()`.
- **RootLayout SSR Hydration:** `RootLayout` (`apps/web/app/layout.tsx`) retrieves session metadata during initial server-side rendering via `getSessionOrNull()` and passes it to `AuthProvider`, eliminating layout shifts and role-checking delays.
- **Component Refactoring:**
  - `apps/web/app/page.tsx` (Dashboard): Removed client-side `useEffect` and `fetch('/api/v1/auth/session')`, consuming `useAuth()` directly.
  - `apps/web/app/setting/page.tsx` (Settings): Removed client-side `useEffect` session fetch and loading spinner, using `useAuth()` for instant profileee display and role-gated menu rendering (`/users` and `/approvals` for `OWNER`).
  - `apps/web/components/navigation/TopAppBar.tsx`: Removed `user` prop drilling; consumes `useAuth()` directly.
  - `apps/web/components/navigation/Sidebar.tsx`: Removed `userRole` and `userName` props; consumes `useAuth()` directly for role-based navigation filtering.
- **Design Governance:** Preserves `Premium Minimal Ops` aesthetic and established color palette with zero visual regression.
<!-- TASK-0215 Reconciled: 2026-08-22 -->

---

## Controls Loading & Header Alignment Frontend Audit Note (Reconciled 2026-08-27)

The following frontend components were audited and reconciled for `TASK-0807`, `TASK-0502`, and `TASK-0306`:
- **`apps/web/app/controls/loading.tsx` [NEW]:** Route-level loading shell rendering the complete structural page layout for Next.js App Router streaming.
- **`apps/web/components/monitoring/WaterTankMonitoringCard.tsx` [AUDITED]:** Refactored from a generic single box to structured 2-column metric cards (Tank Volume & Flow Rate) with matching borders, heights, and gauge shapes.
- **`apps/web/components/controls/FaucetControlPanel.tsx` [AUDITED]:** Refactored to consume centralized `useAuth()` directly and retain stable skeleton state during initial device resolution.
- **`apps/web/components/controls/FaucetHistoryTable.tsx` [AUDITED]:** Added `isLoading` state rendering structured table skeleton rows matching loaded table column widths.
- **`apps/web/components/navigation/TopAppBar.tsx` [AUDITED]:** Refactored layout to a balanced 3-column CSS Grid (`grid grid-cols-[1fr_auto_1fr] items-center px-4 h-14`), constraining start and end items to equal `1fr` widths and guaranteeing exact 50% horizontal center alignment for `DeviceSelector`.
- **`apps/web/components/navigation/DeviceSelector.tsx` [AUDITED]:** Positioned dropdown menu and alert overlays symmetrically below the trigger (`left-1/2 -translate-x-1/2`) with viewport clamping (`max-w-[calc(100vw-2rem)]`).
- **`apps/web/components/navigation/Sidebar.tsx` [AUDITED]:** Hardened `currentPath` derivation with fallback to empty string when `pathname` is null.
<!-- Controls Loading & Header Centering Frontend Audit Reconciled: 2026-08-27 -->

---

## Profile Management & Security UI Frontend Audit Note (Reconciled 2026-08-29)

> **Associated Tasks:** `TASK-0217` (P0, DONE), `TASK-0216` (P1, READY)
> **Governing Decisions:** `DEC-AUTH-106`, `DEC-AUTH-107`, `DEC-UIUX-102`

The following frontend changes are audited and verified for `TASK-0217` (Profile Management & Security UI):
- **Removal of Linked Devices Card:** The misleading "Linked Devices" card has been permanently removed from `/profile` (`apps/web/app/profile/page.tsx`), eliminating confusion with physical ESP32 monitoring nodes.
- **Account & Session Security Section:** Implemented an operational security section displaying single active session status and email verification status badge (`Terverifikasi` / `Verified`). Client IP and User-Agent are omitted in accordance with privacy and scope constraints.
- **PasswordChangeModal Component (`apps/web/app/profile/PasswordChangeModal.tsx`) [NEW]:** Accessible modal dialog wired directly to `POST /api/v1/auth/change-password`. Upon successful password change (HTTP 204), all active sessions are revoked and the user is redirected to `/login?message=PASSWORD_CHANGED`.
- **Logout Path Hardening:** `handleLogout` in `/profile` and `/(auth)/status` explicitly sends `credentials: 'same-origin'` to `POST /api/v1/auth/logout`.
- **Approved Future Frontend Scope (`TASK-0216`):**
  - **Change Email Modal:** Implement a 2-step modal dialog for current password confirmation + new email entry, followed by 6-digit numeric verification code entry with 60-second cooldown timer.
- **Visual Governance:** Conforms strictly to `Premium Minimal Ops`, motion effects `Modal` and `Button hover`, with color tokens `UNCHANGED`.
<!-- Profile Security Frontend Audit Reconciled: 2026-08-29 -->


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

## Operational Overview Dashboard Frontend Audit Note (TASK-0506 / Reconciled 2026-09-02)

The following frontend components were created, refactored, and audited for `TASK-0506`:
- **`apps/web/components/dashboard/DashboardView.tsx` [NEW]:**
  - Unified operational overview component rendered cleanly on both `/` (`apps/web/app/page.tsx`) and `/dashboard` (`apps/web/app/dashboard/page.tsx`).
  - Implements vertical Bento hierarchy: Top Hero Overview card with greeting (`Selamat Datang, [Name]`), localized date, and 3 node summary cards (`Total Perangkat`, `Terhubung` in solid green `#0d631b`, `Terputus / Stale`).
  - Renders the full-width `WeatherCard` in a dedicated section below the hero.
- **`apps/web/components/dashboard/WeatherCard.tsx` [NEW]:**
  - Self-contained environmental weather card bound to `FIXED_WEATHER_LOCATION` (`latitude: -7.172934`, `longitude: 113.2257627`, location name: `"King Agrowisata"`).
  - Fetches Open-Meteo REST API on mount with 15-minute periodic auto-refresh and manual refresh button.
  - Features smooth skeleton loading state (`weather-skeleton`), current temperature with "feels like" metric, localized condition badge, and 3-column metric cards with subtle semantic tints (Air Humidity in soft green, Wind Speed in subtle olive/neutral, UV Index in subtle warm amber).
- **Component Pruning & Clutter Elimination:**
  - Removed synthetic 92/100 health score component.
  - Removed portal-like overview sections (`SystemSnapshot`, `QuickActions`, duplicate domain cards) from the root dashboard.
- **Zero Emoji Compliance:** All icon representations use Lucide SVG components with zero unicode emoji characters.
<!-- TASK-0506 Frontend Audit Reconciled: 2026-09-02 -->
 
---

## Devices Route Loading & Auth Optimization Frontend Audit Note (Reconciled 2026-09-04)

The following frontend components were created, refactored, and audited for the `/devices` route optimization:
- **`apps/web/app/devices/loading.tsx` [NEW]:**
  - Route-level loading skeleton matching the exact structural layout of `/devices`.
  - Integrates `TopAppBar`, header skeleton (`Cpu` icon and pulsing title/subtitle), search/filter control skeletons, and a 4-card device grid skeleton in `bg-app-surface text-app-on-surface min-h-dvh pb-24`.
  - Replaces blank white transitions with a seamless, flicker-free skeleton during App Router streaming and client route transitions.
- **`apps/web/app/devices/page.tsx` [AUDITED & OPTIMIZED]:**
  - Removed redundant client-side `fetch('/api/v1/auth/session')`, `currentUserRole` state, and `authLoading` state.
  - Replaced blocking full-page session spinner (`tAuth('checkingSession')`) with centralized `useAuth()` hook hydrated from SSR (`const { role } = useAuth(); const isOwner = role === 'OWNER';`).
  - Device list fetching (`fetchDevices(1)`) now triggers immediately upon component mount without waiting for client session roundtrips.
  - Retained strict Admin canonical `deviceId` concealment (`DEC-DEV-028`) and Owner-only action controls.
<!-- Devices Loading & Auth Frontend Audit Reconciled: 2026-09-04 -->

---

## Users Route Loading & Auth Optimization Frontend Audit Note (Reconciled 2026-09-04)

The following frontend components were created, refactored, and audited for the `/users` route optimization:
- **`apps/web/app/users/loading.tsx` [NEW]:**
  - Route-level loading skeleton matching the exact structural layout of `/users`.
  - Integrates `TopAppBar`, header skeleton (`Users` icon and pulsing title/subtitle), search and role/status filter skeletons, and a 5-row user table card skeleton in `bg-app-surface text-app-on-surface min-h-dvh pb-24`.
  - Replaces blank white transitions with a seamless, flicker-free skeleton during App Router streaming and client route transitions.
- **`apps/web/app/users/page.tsx` [AUDITED & OPTIMIZED]:**
  - Removed redundant client-side `fetch('/api/v1/auth/session')`, `currentUserRole` state, and `authLoading` state.
  - Replaced blocking full-page session spinner (`tAuth('checkingSession')`) with centralized `useAuth()` hook hydrated from SSR (`const { role } = useAuth(); const isOwner = role === 'OWNER';`).
  - Resolved identifier shadowing by renaming user map variable `isOwner` to `isTargetOwner`.
  - User list fetching (`fetchUsers(1)`) now triggers immediately upon mount for Owner users without waiting for client session roundtrips.
  - Non-owner users immediately render the 403 Forbidden screen (`Akses Terbatas (403 Forbidden)`) without lingering spinners, backed by strict Next.js route middleware and server-side RBAC guards (`requireRole(['OWNER'])`).
<!-- Users Loading & Auth Frontend Audit Reconciled: 2026-09-04 -->


