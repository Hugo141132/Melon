# Frontend Codebase Audit: Kebun Melon

> **Task Reference:** `TASK-0001 — Confirm Existing Frontend Technology`  
> **Audit Status:** Complete — Confirmed & Verified  
> **Source of Truth Rule:** The existing frontend design and visual layout remain the visual source of truth.

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
│   ├── constants.ts            # Mock sensor data, user profile, routes, NPK ranges
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
    ├── pengaturan/             # Settings page (`/pengaturan`)
    │   └── page.tsx
    └── profil/                 # Profile & Security page (`/profil`)
        └── page.tsx
```

---

## 4. Routing System and Current Route Structure

Routing is managed strictly by the Next.js App Router (`app/` directory).

| Route Path | File Location | Render Type | Current Page Purpose & Description |
|---|---|---|---|
| `/` | `app/page.tsx` | Server Component | **Dashboard (Beranda)**: Crop health score gauge (92/100), weather status card, soil & water bento summary cards, critical alert banner, quick sensor metrics. |
| `/login` | `app/(auth)/login/page.tsx` | Client Component | **Login**: Form with email/password inputs, show/hide password toggle, simulated loading state, link to password recovery. |
| `/register` | `app/(auth)/register/page.tsx` | Client Component | **Register (Daftar Lahan Baru)**: 2-step onboarding flow. Step 1: Email, WhatsApp, Password strength meter. Step 2: Verification notice & T&C agreement. |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | Client Component | **Forgot Password**: Email recovery input, submit button, floating success toast. |
| `/tanah` | `app/tanah/page.tsx` | Client Component | **NPK Soil (Lahan)**: Soil nutrient overview, 3 NPK meter cards (N: 145 mg/kg, P: 42 mg/kg, K: 198 mg/kg), 7-day NPK trend bar chart, fertilizing recommendations. |
| `/air` | `app/air/page.tsx` | Client Component | **Water & Nutrisi (Air)**: EC gauge (1.8 mS/cm), pH bar (6.2), TDS metric (920 ppm), Tank Volume bar (450/600L), Flow Rate (12.5 m³/h), 24h trend chart, 3-phase irrigation preset selector, valve toggle button. |
| `/notifikasi` | `app/notifikasi/page.tsx` | Server Component | **Notifikasi**: Sensor alert cards categorized by severity (error/kritis, warning/peringatan), target range comparisons, resolved alerts log. |
| `/pengaturan` | `app/pengaturan/page.tsx` | Server Component | **Pengaturan**: Settings menu with user profile header card, navigation links to Profile, Notifications, Sensor Config, and Support. |
| `/profil` | `app/profil/page.tsx` | Client Component | **Profil & Keamanan**: Editable user profile form (Name, WhatsApp, Farm Name), security options, logout button, fixed save CTA with toast. |

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
Next.js 14 App Router (`app/`). 9 pages across root, `(auth)`, `/air`, `/tanah`, `/notifikasi`, `/pengaturan`, `/profil`.

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
Static profile string `"Pemilik Lahan"` in `USER_PROFILE` constant (`lib/constants.ts`). No RBAC middleware, role checking functions, or permission guards exist in the application code.

### 12. Current API Integrations
0 active API endpoints or HTTP calls. The entire application operates on static mock objects in `lib/constants.ts`.

### 13. Chart Libraries
`recharts` (`^2.12.7`) used in `components/charts/NPKChart.tsx` (BarChart) and `components/charts/WaterNutrientChart.tsx` (AreaChart). Custom half-circle CSS/SVG gauge meters.

### 14. Map or Geolocation Libraries
None installed. Location is represented as text `"Kebun Melon"` with a `MapPin` icon.

### 15. Internationalisation (I18N) Support
Hardcoded Indonesian strings (`id`) throughout all pages. No translation keys or i18n library (e.g. `next-intl`, `react-i18next`) installed.

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
`app/tanah/page.tsx`, `components/charts/NPKChart.tsx`, inline `NPKMeter` cards. Telemetry values present: N (145 mg/kg), P (42 mg/kg), K (198 mg/kg), Soil status ("Optimal"). Temp, Moisture, pH, EC are rendered on dashboard (`app/page.tsx`).

### 21. Existing Water-Monitoring Components
`app/air/page.tsx`, `components/charts/WaterNutrientChart.tsx`, inline `ECGauge` (1.8 mS/cm), `PHBar` (6.2), TDS metric (920 ppm), Tank Volume progress bar (450/600L), Flow Rate metric (12.5 L/min). Water fields missing/TBD in UI: `Water BAT` (battery value), Latitude, Longitude.

### 22. Existing Device-Selection Components
None. Current UI assumes a single farm view without device picker, multi-device list, or `deviceId` context.

### 23. Existing Faucet-Control Components
3-phase preset volume selector (Phase 1: 300mL, Phase 2: 1,000mL, Phase 3: 1,500mL) and valve toggle button in `app/air/page.tsx`. Operates strictly with local mock state; physical control is disabled.

### 24. Existing User-Management or Approval Components
`/pengaturan` settings page has Owner summary card, `/register` has a 2-step registration form for sign-up input. No Owner approval dashboard, pending queue, user list, or account status controls exist.

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
* Route structures: `app/page.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/forgot-password/page.tsx`, `app/air/page.tsx`, `app/tanah/page.tsx`, `app/notifikasi/page.tsx`, `app/pengaturan/page.tsx`, `app/profil/page.tsx`.
* Navigation components: `components/navigation/BottomNav.tsx`, `components/navigation/TopAppBar.tsx`.
* Visualization components: `components/charts/NPKChart.tsx`, `components/charts/WaterNutrientChart.tsx`.

### 33. Conflicts Between Current Codebase and Proposed Specifications
* **Auth & RBAC (`RBAC.md` / `PRD.md`)**: Docs specify `OWNER` / `ADMIN` roles, public registration creating `ADMIN` (`PENDING_APPROVAL`), and Owner approval. Codebase has a static profile with no server auth or approval UI.
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
* All downstream tasks dependent on `TASK-0002` or unresolved backend/auth/physical control decisions (e.g. `TASK-0201`, `TASK-0801` to `TASK-0806`, etc.).

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
| `Water BAT` Meaning | Field definition and units unresolved | **TBD** |
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
| Logout Action (`/profil` & `/status`) | `POST /api/v1/auth/logout` implemented | **Category A: Integrated** | Connected to real `POST /api/v1/auth/logout` endpoint in both `/profil` and `/status` pages, revoking database session and clearing HTTP-only cookie. |
| `/approvals` | `/api/v1/approvals/*` endpoints implemented | **Category A: Integrated** | Fetches real pending Admin list with search and pagination, fetches user details, executes real `approve` and `reject` actions with decision notes. |
| `/pengaturan` Role Awareness | `GET /api/v1/auth/session` & RBAC | **Category A: Integrated** | Fetches authenticated session. Conditionally displays the **Persetujuan Admin** (`/approvals`) card link ONLY when `role === 'OWNER'`. Hidden for `ADMIN`. |
| Dashboard (`/`) Telemetry | IoT/Telemetry API not implemented yet | **Category C: Deferred** | Telemetry endpoints are deferred to subsequent IoT tasks (TASK-0400+). Dashboard telemetry UI remains static until backend endpoints exist. |
| `/tanah` & `/air` Detail Pages | Telemetry & Faucet Control APIs not implemented | **Category C: Deferred** | Physical faucet control and sensor telemetry APIs are deferred per TASK backlog sequencing. Physical control remains safely disabled. |
