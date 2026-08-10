<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# apps/web Agent Guidelines & Implementation State

This document specifies operational guidelines and system boundaries for coding agents modifying `apps/web`, synchronized with the backend backlog in `TASKS.md`.

---

## 1. Domain Telemetry Rules

- **Soil Monitoring (`SOIL_NODE`)**: Nitrogen, Phosphorus, Potassium (`mg/kg`), Temperature (`°C`), Moisture (`%`), pH (unitless), Electrical Conductivity (`mS/cm`), Battery (`BAT`, `%` or Volts), Soil Status.
- **Water Quality Monitoring (`WATER_QUALITY_NODE`)**: pH (unitless), TDS (`ppm`), EC (`mS/cm`), Battery (`BAT`, `%` or Volts), Water Status.
- **Battery Parameter (`BAT`)**: `BAT` stands for **Battery** (not "Water BAT"). It is incorporated directly into soil and water quality sensor nodes to monitor equipment power supply.
- **Deleted Parameters**: `latitude` and `longitude` are **DELETED** from Water Quality telemetry monitoring and shall not be displayed or processed.
- **Water Tank Monitoring (`WATER_TANK_NODE`)**: Tank Volume (`L`), Flow Rate (`m³/h`), Tank Status.

---

## 2. Authentication & Authorization Governance

- **Session Handling**: Cookie-based HTTP-only session management with Argon2id password hashing.
- **Account Status Enforcement**: Only `ACTIVE` users access protected routes. `PENDING_APPROVAL`, `REJECTED`, `SUSPENDED`, `DEACTIVATED` accounts are redirected to `/status`.
- **Server Guarding**: Route handlers and Server Actions must use authorization helpers from `@/lib/auth/rbac`:
  - `requireSession(request)`
  - `requireActiveAccount(session)`
  - `requireRole(session, role)`
  - `requirePermission(session, permission)`
  - `requireDeviceViewAccess(session, deviceId)`
  - `requireDeviceControlAccess(session, deviceId)`

---

## 3. Device Selector & Scope Management

- **Device Context (`DeviceContext.tsx`)**: Selected device must be maintained globally.
- **Device Switching**: Switching devices clears or invalidates stale telemetry state immediately.
- **Unassigned Devices**: Admins cannot select or view metrics/controls for unassigned devices (`403 FORBIDDEN`).

---

## 4. Realtime Telemetry & Dashboard

- **Realtime Transport**: Server-Sent Events (SSE) via `/api/v1/realtime/stream` streaming live telemetry updates after DB persistence.
- **Fallback Polling**: Automatic graceful fallback to periodic REST SWR polling when SSE disconnects.
- **Data Integrity**: `null` values represent unavailable telemetry; `0` represents a valid measured zero. Do not render `0` for missing metrics.

---

## 5. Faucet Control Safety Rules (Phase 8)

- **Preset Volume Mappings**:
  - Phase 1 → `300 mL`
  - Phase 2 → `1,000 mL`
  - Phase 3 → `1,500 mL`
- **Safety Flags**: Faucet control operations are strictly blocked when `ENABLE_FAUCET_CONTROL=false` is set in the environment.
- **User Flow**: User selects phase only → explicit confirmation modal required → server maps phase to target volume → persistent `QUEUED` record created with `idempotencyKey` → MQTT dispatch via IoT gateway.

---

## 6. UI Governance Records

- **TASK-0303 UI Governance**:
  - Impact: `MINOR`
  - Direction: `Premium Minimal Ops`
  - Palette: `UNCHANGED` (Kebun Melon standard design tokens)
  - Motion: `Card hover`, `Skeleton loading`
  - 21st.dev MCP: `NOT REQUIRED`
- **TASK-0807 UI Governance**:
  - Impact: `MINOR`
  - Direction: `Premium Minimal Ops`
  - Palette: `UNCHANGED`
  - Motion: `Modal`, `Button hover`, `KPI refresh`
- **TASK-1004 Staging Infrastructure**:
  - Web Hosting: Railway PaaS (`melon-monitor.up.railway.app`)
  - Database: Supabase PostgreSQL (`aws-0-ap-south-1.pooler.supabase.com:6543`)
  - MQTT Broker: EMQX Cloud Serverless (`wss://` TLS)
  - Safety Enforced: `ENABLE_FAUCET_CONTROL=false`
