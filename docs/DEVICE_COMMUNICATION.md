# Device Communication Specification

## 1. Document Information

| Item | Description |
|---|---|
| Product | Web-Based Soil and Water Monitoring and Faucet Control System |
| Document | Device Communication Specification |
| Version | 1.0 |
| Status | Proposed baseline specification |
| Hardware | ESP32 / NodeMCU |
| Recommended protocol | MQTT 5.0 over TLS |
| Network connectivity | Wi-Fi with internet or private-network access |
| Related documents | `FRONTEND_AUDIT.md`, `UI_UX.md`, `PRD.md`, `RBAC.md`, `USER_FLOWS.md`, `I18N.md`, `SECURITY.md`, `DECISIONS.md` |

---

## 2. Purpose

This document defines the communication contract between:

- ESP32/NodeMCU devices.
- The MQTT broker.
- The IoT gateway or backend integration service.
- The web application backend.
- The authenticated web frontend.

The specification covers device identity, topic structure, telemetry messages, status messages, faucet-control commands, acknowledgements, security, reconnection, duplicate handling, validation, and failure behaviour.

The website is responsible for communication, monitoring, access control, command initiation, status presentation, and audit logging.

The separate hardware team remains responsible for:

- Sensor selection.
- Sensor calibration.
- Sensor measurement algorithms.
- Physical wiring.
- Valve or relay control.
- Flow measurement.
- Physical dispensing accuracy.
- Hardware safety implementation.
- ESP32/NodeMCU firmware internals.

This specification does not define how a sensor produces a measurement. It defines how the resulting measurement and device state are exchanged with the web system.

---

### 3. Architectural Boundary

The browser shall not communicate directly with an ESP32/NodeMCU device or publish directly to MQTT topics.

#### Path A — MQTT over TLS via Unified EMQX Cloud Broker (Soil & Water Quality Telemetry, TASK-0415 / TASK-0416 / DEC-DEV-035)

```text
Soil & Water Monitoring Equipment (ESP32)
[Soil Client ID: melon-esp32-tanah1 | Water Client ID: melon-esp32-air1]
    │
    │ MQTT over TLS (Port 8883)
    │ Soil Inbound Telemetry: melon/sensor-tanah/data-2424600050
    │ Soil AI Recommendation: melon/ai-tanah/rekomendasi-2424600050
    │ Water Inbound Telemetry: melon/sensor-air/data-2424600050
    │ Water AI Recommendation: melon/ai-air/rekomendasi-2424600050
    ▼
Unified EMQX Cloud Broker (Port 8883 TLS / 8084 WSS)
    │
    ▼
IoT Gateway (apps/iot-gateway — Unified EMQX Client / SoilWaterMqttAdapter)
    │
    ├── Resolve database device dynamically via MQTT Client ID (devices.client_id)
    ├── Dual payload normalization (canonical JSON envelope + flat abbreviated keys)
    ├── Persist telemetry to PostgreSQL database (soil_readings, water_readings)
    ├── Standardize EC values directly in µS/cm without multiplier conversion
    ├── Atomically update device lastSeenAt and connectionStatus: ONLINE
    └── Dispatch internal realtime webhook to Web Backend for SSE delivery
             │
             ▼
      Web Application
             │
             ▼
   Authenticated Frontend
```



### Path B — MQTT through Dedicated EMQX Cloud Broker (Water Tank Monitoring & Faucet Control, DEC-DEV-032)

```text
Water Tank Node (ESP32)
    │
    │ MQTT 5.0 over WSS / TLS (Canonical Hardware Topics, Port 8084, Path /mqtt)
    │ Telemetry Publish: irigasi/melon/sensor/volume
    │ Valve Actuation Subscribe: irigasi/melon/kontrol/valve
    │ Automation Setting Subscribe: irigasi/melon/setting/otomasi
    ▼
Dedicated EMQX Cloud Broker (wss://<cluster-host>:8084/mqtt)
    │
    ▼
IoT Gateway (apps/iot-gateway)
    │
    ├── Ingest telemetry directly from irigasi/melon/sensor/volume over WSS
    ├── Deterministically resolve single database WATER_TANK_NODE entity
    ├── Validate payload schema (numeric/JSON volume, finite >= 0)
    ├── Persist water tank telemetry to PostgreSQL database (reservoir_water_readings)
    ├── Dispatch valve/automation commands directly over MQTT (QoS 1, retain: false)
    └── Send live SSE updates to the web backend
             │
             ▼
      Web Application
             │
             ▼
   Authenticated Frontend
```

For monitoring:

```text
Device → MQTT Broker → IoT Gateway → Database / Live Update → Web UI
```

For faucet control:

```text
Web UI
→ Authenticated Backend Request
→ RBAC and Device-Access Validation
→ IoT Gateway
→ MQTT Broker
→ Selected Device
→ Acknowledgement / Result
→ IoT Gateway
→ Web UI
```

The web frontend shall never contain:

- MQTT broker administrator credentials.
- Device passwords.
- Private keys.
- Unrestricted publish permissions.
- Direct hardware-control secrets.

---

## 4. Protocol Decision

### 4.1 Recommended Protocol

The proposed baseline protocol is:

```text
MQTT 5.0 over TLS
```

Recommended secure port:

```text
8883
```

MQTT is recommended because the application requires:

- Multiple independently addressed devices.
- Device-to-server telemetry.
- Server-to-device commands.
- Low-overhead communication.
- Online and offline state reporting.
- Delivery acknowledgement.
- Reconnection after unstable Wi-Fi.
- Topic-level authorisation.
- Future expansion to additional devices and sites.

### 4.2 Decision Status

MQTT is the recommended application protocol, but final adoption requires confirmation that the hardware team can implement the agreed topic and payload contract.

Wi-Fi or internet connectivity alone is not an application protocol. It only provides the network path.

### 4.3 HTTP Alternative

HTTPS REST may be used only when MQTT cannot be supported.

If HTTPS REST is selected:

- Devices shall send telemetry to authenticated HTTPS endpoints.
- Devices shall poll or maintain another secure channel for commands.
- The same canonical payloads, identifiers, timestamps, validation, and idempotency rules in this document shall still apply.
- The final divergence shall be documented before implementation.

### 4.4 Protocol Version Compatibility

Preferred:

```text
MQTT 5.0
```

Allowed fallback:

```text
MQTT 3.1.1
```

When MQTT 3.1.1 is used, MQTT 5 features such as reason codes and message expiry properties shall be represented in the JSON payload or handled by the gateway.

### 4.5 Database Relocation & Rehearsal Impact (TASK-0916)

Operational preparation and local rehearsal for the Supabase PostgreSQL migration (Mumbai `ap-south-1` to Singapore `ap-southeast-1` colocation governed by `DEC-INF-095`) introduce **zero changes** to device communication protocols, MQTT 5.0/3.1.1 topic hierarchies, device identities, telemetry schemas, or REST ingestion endpoints.

- **Broker & Ingress Unaffected:** Direct TLS connectivity to EMQX Cloud (`apps/iot-gateway`) and REST ingestion endpoints (`POST /api/v1/devices/{deviceId}/telemetry/*`) continue operating as specified.
- **Latency Optimization:** Colocating database persistence in Singapore alongside target compute regions reduces query and transactional write round-trip latency from gateway and web backend services upon eventual cutover.
- **Pre-Cutover Command Freeze:** During planned live migration cutover, a write-freeze window will be enforced on faucet-control dispatch (`ENABLE_FAUCET_CONTROL=false` safety lock) to prevent in-flight command dispatch or partial state persistence across database instances.
- **Rehearsal Isolation:** Local restore rehearsals (validating 26 tables, 28 foreign keys, and snapshot parity) were executed completely isolated from live device traffic, with zero live device or broker connections.

---

## 5. Communication Components

### 5.1 ESP32 / NodeMCU Device

The device shall:

- Connect using a unique device identity.
- Publish only to its authorised telemetry, status, and acknowledgement topics.
- Subscribe only to its authorised command and configuration topics.
- Include a schema version in application messages.
- Include a unique message or command reference.
- Reconnect after network interruption.
- Prevent repeated execution of the same command.
- Report command acceptance and final result where supported.

### 5.2 MQTT Broker

The broker shall:

- Require authentication.
- Support encrypted connections in production and development (TLS over TCP `mqtts://` port 8883 or WebSocket `wss://` port 8084).
- Enforce topic-level publish and subscribe permissions.
- Reject anonymous production access.
- Support device Last Will and Testament.
- Expose operational metrics and logs.
- Permit revocation of a single device without affecting other devices.

#### 5.2.1 Broker Connectivity Architecture (Unified EMQX Topology, TASK-0415 / TASK-0416 / DEC-DEV-035)

The system consolidates all MQTT communication onto a single unified EMQX Cloud broker (`TASK-0415`, `TASK-0416`, `DEC-DEV-035`). The deprecated HiveMQ Cloud secondary broker fallback has been permanently retired from the gateway codebase.

- **Unified Primary Broker — EMQX Cloud:**
  - **Scope:** Handles all monitoring and actuation domains:
    - Water Tank Monitoring (`WATER_TANK_NODE`) and Faucet Control (`irigasi/melon/...`).
    - Soil Node ESP32 (`melon-esp32-tanah1`) and Water Quality Node ESP32 (`melon-esp32-air1`) (`melon/...`).
  - **Transport:** WebSocket Secure (`wss://<cluster-host>:8084/mqtt`) or TLS TCP (`mqtts://<cluster-host>:8883`).
  - **Topics:**
    - Reservoir telemetry (`irigasi/melon/sensor/volume`), valve actuation (`irigasi/melon/kontrol/valve`), automation setting (`irigasi/melon/setting/otomasi`).
    - Soil inbound (`melon/sensor-tanah/data-2424600050`), water inbound (`melon/sensor-air/data-2424600050`), outbound AI recommendations (`melon/ai-tanah/rekomendasi-2424600050`, `melon/ai-air/rekomendasi-2424600050`).
  - **Gateway Client:** Primary client connects once to EMQX; `SoilWaterMqttAdapter` binds unconditionally to this primary client (`apps/iot-gateway/src/app.ts`).
  - **Safety:** Obeying strict safety lock `ENABLE_FAUCET_CONTROL=false`.
- **Retirement of Secondary Broker Fallback (`TASK-0416` / `DEC-DEV-035`):**
  - Obsolete `SOIL_WATER_MQTT_*` environment variables have been removed from the IoT Gateway runtime.
  - No secondary MQTT client is instantiated.
  - Live probe confirmed 0 active client connections and 0 messages on legacy HiveMQ, verifying that hardware traffic has ceased on the fallback broker.
- **Client ID Collision Avoidance:** Gateway client uses static, non-colliding client ID (`MQTT_GATEWAY_CLIENT_ID=Test_Gateway` or `gateway-kebun-melon-dev-local-01` for primary EMQX). Hardware devices use MAC-derived or configured IDs (`melon-esp32-tanah1`, `melon-esp32-air1`, `water-tank-node-zi37gz`) and authenticate via `petanimelon` or `Test_Device`.
- **Staging Isolation:** Staging environments remain 100% isolated containerized deployments and are untouched by local development broker testing.
- **Broker ACL Policies & Scoping (`DEC-DEV-037`):**
  - **Hardware / AI Worker Credential (`petanimelon`):** Configured with explicit `Publish & Subscribe` (Allow) permissions on the 4 canonical soil & water quality topics:
    - `melon/sensor-tanah/data-2424600050`
    - `melon/sensor-air/data-2424600050`
    - `melon/ai-tanah/rekomendasi-2424600050`
    - `melon/ai-air/rekomendasi-2424600050`
    - *Rationale:* ESP32 hardware devices publish raw sensor readings, while the external ML worker process subscribes to sensor telemetry and publishes AI predictions. Since field devices and AI test scripts authenticate using `petanimelon`, granting bidirectional `Publish & Subscribe` on these 4 topics prevents broker rejection (`0x87 Not Authorized`). Topic permissions remain strictly scoped without wildcard (`#`) exposure.
  - **Backend Gateway Service (`Test_gateway`):** Confidential backend credential with Pub/Sub permissions across all monitored telemetry topics and command topics.
  - **Water Tank Device (`Test_Device`):** Authorized strictly to publish `irigasi/melon/sensor/volume` and subscribe to `irigasi/melon/kontrol/valve` and `irigasi/melon/setting/otomasi`.
- **Hardware Telemetry Ingress Normalization (`DEC-DEV-036`):**
  - `SoilWaterMqttAdapter` transparently normalizes real field ESP32 microcontroller payload variations:
    - **Soil Telemetry:** Supports top-level `"device": "soil-node-jvbkdbv"` and flat numeric metrics, alongside canonical envelope wrappers (`{ deviceId, soil: { ... } }`).
    - **Water Quality Telemetry:** Supports nested `"water": { ... }` object wrappers and alternative key identifiers (`"device_code"` or `"device"`), alongside flat camelCase envelopes.
  - **Zero-Bypass Device Validation:** The adapter extracts candidate device identifiers and rigorously queries PostgreSQL (`devices`). Any telemetry with an unmapped, unregistered, or inactive device ID is rejected immediately, preventing forged telemetry injection.


### 5.3 IoT Gateway


The gateway shall be a continuously running backend service.

It shall:

- Maintain the MQTT connection.
- Subscribe to authorised device topics.
- Validate payload structure.
- Reject unsupported schema versions.
- Associate messages with registered devices.
- Store valid telemetry.
- Track latest device status and last-seen time.
- Publish faucet commands.
- Track command lifecycle.
- Process duplicate, late, and out-of-order messages.
- Generate live web updates.
- Record integration and control audit events.
- Avoid exposing broker credentials to the browser.

### 5.4 Web Backend

The web backend shall:

- Authenticate the user.
- Enforce Owner and Admin RBAC.
- Verify device access.
- Validate requested faucet phase.
- Map the selected phase to the approved target volume.
- Create a unique command record.
- Submit the command to the IoT gateway.
- Return a stable command status to the frontend.

### 5.5 Web Frontend

The frontend shall:

- Request monitoring data through the authenticated backend.
- Never trust device state cached only in the browser.
- Display data timestamp and status.
- Show loading, stale, offline, invalid, and error states.
- Require explicit confirmation before faucet control.
- Display command status without claiming physical completion before a valid final acknowledgement.

---

## 6. Device Identity (DEV-ID-001)

Every device shall have a unique canonical identity.

Minimum identity fields:

| Field | Type | Required | Description |
|---|---|---:|---|
| `deviceId` | String | Yes | Unique external canonical hardware identifier (Owner-editable per `DEC-DEV-028`; internal DB UUID immutable) |
| `clientId` | String | No | Unique hardware MQTT Client ID used by physical device (e.g. `melon-esp32-tanah1`, `melon-esp32-air1`). Primary identity for MQTT dynamic device resolution (`TASK-0412`). Decouples physical hardware identity from database record to allow device replacement without code changes |
| `siteId` | String | Yes or TBD | Site, project, or location identifier |
| `deviceName` | String | No | User-facing device name stored by backend |
| `deviceType` | Enum | Yes | Device capability category |
| `firmwareVersion` | String | Recommended | Installed firmware version |
| `hardwareRevision` | String | Optional | Hardware revision |
| `schemaVersion` | String | Yes | Application payload schema version |

Recommended `deviceId` format:

```text
esp32-001
water-node-001
soil-node-001
```

Rules:

- `deviceId` shall not be translated.
- `deviceId` shall not contain personal information.
- `deviceId` is editable ONLY by the Owner (`DEC-DEV-028`).
- `deviceId` shall NOT be viewable or editable by Admin users across UI and API responses (`DEC-DEV-028` / `TASK-0305`). Admin responses return only user-facing device names and metadata.
- `clientId` (`devices.client_id`): MQTT Client ID is the primary identity source for resolving physical devices into database entities. The expected hardware client mapping:
  - `melon-esp32-tanah1` $\rightarrow$ `SOIL_NODE`
  - `melon-esp32-air1` $\rightarrow$ `WATER_QUALITY_NODE`
  Future physical device replacements are supported by updating `client_id` in the database registry with zero code changes.
- **Identity Flow & Payload Hardware Identity:**
  - Topic identifies the monitoring domain (e.g. soil vs water quality).
  - Payload explicitly contains the hardware identity (`clientId: "melon-esp32-tanah1"` or `clientId: "melon-esp32-air1"`). Normal MQTT subscribers do not assume broker connection metadata is available; identity is carried in the message payload.
  - Gateway resolves: `payload.clientId` $\rightarrow$ `devices.client_id` $\rightarrow$ canonical database device record.
  - **Strict Rejection of Unknown Hardware:** Payloads missing a hardware identifier are rejected (`MISSING_CLIENT_ID`). Payloads with unmapped or unknown `clientId` values are strictly rejected (`UNKNOWN_DEVICE_CLIENT_ID`). The gateway shall never silently assign unknown telemetry to an arbitrary active device.
  - Payloads with mismatched device types (e.g. water client on soil topic) or inactive account status are rejected.
- **Configurable Telemetry Topics:**
  - Soil Data Inbound (Gateway Subscribe / Node Publish): `SOIL_MQTT_PUB_TOPIC` (default: `melon/sensor-tanah/data-2424600050`)
  - Soil AI Recommendation Outbound (Gateway Publish / Node Subscribe): `SOIL_MQTT_SUB_TOPIC` (default: `melon/ai-tanah/rekomendasi-2424600050`, QoS 1)
  - Water Quality Data Inbound (Gateway Subscribe / Node Publish): `WATER_MQTT_PUB_TOPIC` (default: `melon/sensor-air/data-2424600050`)
  - Water Quality AI Recommendation Outbound (Gateway Publish / Node Subscribe): `WATER_MQTT_SUB_TOPIC` (default: `melon/ai-air/rekomendasi-2424600050`, QoS 1)
- **MQTT Credentials Separation & Explicit Device Configuration (`TASK-0412`):**
  - Gateway MQTT Client Credentials: `MQTT_BROKER_URL`, `MQTT_GATEWAY_CLIENT_ID`, `MQTT_GATEWAY_USERNAME`, `MQTT_GATEWAY_PASSWORD`.
  - ESP32 Soil Node Hardware Credentials: `SOIL_DEVICE_MQTT_CLIENT_ID` (`melon-esp32-tanah1`), `SOIL_DEVICE_MQTT_USERNAME`, `SOIL_DEVICE_MQTT_PASSWORD`.
  - ESP32 Water Quality Node Hardware Credentials: `WATER_DEVICE_MQTT_CLIENT_ID` (`melon-esp32-air1`), `WATER_DEVICE_MQTT_USERNAME`, `WATER_DEVICE_MQTT_PASSWORD`.
  - Gateway identity and physical hardware identity are strictly decoupled; gateway service (`Test_Gateway`) never simulates hardware devices using gateway client identity.
  - Device simulator (`scripts/device-simulator.ts`) connects as 3 distinct MQTT clients using their respective hardware identities (`melon-esp32-tanah1`, `melon-esp32-air1`, `sim-${tankId}-...`).
  - End-to-end live flow verified: `melon-esp32-air1` publishes to `melon/sensor-air/data-2424600050` over EMQX Cloud broker, IoT Gateway receives and dynamically resolves `melon-esp32-air1` $\rightarrow$ `devices.client_id` $\rightarrow$ `WATER_QUALITY_NODE`, persisting to `water_readings` with zero changes to staging.
- Internal database primary key UUID is immutable across all relational tables.
- A device shall not publish as another device.
- Device credentials shall be bound to the permitted `deviceId` or `clientId`.
- Topic authorisation shall prevent cross-device access.
- Deactivated devices (`accountStatus = 'DEACTIVATED'`) transition `connectionStatus` to `INACTIVE` and are rejected from executing new faucet commands. Reactivation resets `connectionStatus` to `UNKNOWN` until new communication is established (`DEC-DEV-030`).
- Operational and hardware procedures for reconciling physical ESP32/NodeMCU firmware configurations and EMQX broker credentials/ACLs following a `deviceId` rename are **TBD / BLOCKING** automation (`DEC-DEV-028`).


---

## 7. Device Capability Model (DEV-ID-002)

The system shall not assume that every ESP32 contains every sensor or actuator.

A device may declare one or more capabilities:

```text
SOIL_TELEMETRY
WATER_TELEMETRY
LOCATION
TANK_MONITORING
FAUCET_CONTROL
```

*Note:* `FLOW_MONITORING` is permanently removed per `DEC-MON-089` (`TASK-0410`). `BATTERY_MONITORING` is removed per `DEC-MON-086`.

Example:

```json
{
  "deviceId": "water-node-001",
  "capabilities": [
    "WATER_TELEMETRY",
    "LOCATION",
    "TANK_MONITORING",
    "FAUCET_CONTROL"
  ]
}
```

The frontend shall use the backend device record to determine which components are relevant.

Missing capabilities shall not be treated as sensor failure.

Whether capabilities are provisioned by the backend, published by the device, or both is `TBD`.

### 7.1 Protocol Routing & Device Capability Mapping

Communication protocol routing (`REST API over Wi-Fi` vs `MQTT over TLS through EMQX`) is deterministically resolved using a combination of `DeviceType` (`Device.deviceType`) and registered `DeviceCapability` entries (`DeviceCapability.capability`):

| DeviceType | Required / Registered Capability | Protocol / Transport | Destination / Ingress Boundary |
|---|---|---|---|
| `SOIL_NODE` | `SOIL_TELEMETRY` | REST API over Wi-Fi (HTTPS) | Web Backend REST Ingestion Endpoint |
| `WATER_QUALITY_NODE` | `WATER_TELEMETRY` | REST API over Wi-Fi (HTTPS) | Web Backend REST Ingestion Endpoint |
| `WATER_TANK_NODE` | `TANK_MONITORING` | MQTT 5.0 over TLS | EMQX Broker → IoT Gateway Service |
| `WATER_TANK_NODE` | `FAUCET_CONTROL` | MQTT 5.0 over TLS | EMQX Broker ← IoT Gateway Service |

Rules:
- Devices sending general soil and water quality telemetry use **REST API over Wi-Fi**.
- Devices with `TANK_MONITORING` or `FAUCET_CONTROL` capabilities connect via **MQTT 5.0 over TLS** to the **EMQX Broker** (`FLOW_MONITORING` deleted per `DEC-MON-089`).
- The existing `DeviceType` enum values (`SOIL_NODE`, `WATER_QUALITY_NODE`, `WATER_TANK_NODE`) are sufficient and unambiguous when evaluated together with registered device capabilities. No schema enum modification is required.

### 7.2 Device Capability Display & Irrigation Control Rules

To prevent operational confusion and ensure hardware safety:
- **Irrigation Valve Control (`FAUCET_CONTROL`):**
  - Appears **only** on supported controller/reservoir devices (`WATER_TANK_NODE`).
  - Soil monitoring devices (`SOIL_NODE`) and Water Quality monitoring devices (`WATER_QUALITY_NODE`) shall **strictly not display** irrigation control capability across the UI or accept faucet commands.
- **Monitoring vs Actuator Separation:**
  - Monitoring devices expose only passive sensing parameters (Soil NPK, temperature, moisture, pH, EC; Water pH, TDS, EC).
  - Actuation controls (`FAUCET_CONTROL`) are strictly segregated under "Control Capabilities" on controller devices.
- **Invariant Internal Canonical Values:**
  - Internal keys in database, API contracts, and MQTT payloads remain language-neutral and unchanged (`SOIL_TELEMETRY`, `WATER_TELEMETRY`, `TANK_MONITORING`, `FAUCET_CONTROL`).

### 7.3 Device Status Presentation & UI Mapping

To provide clear operational visibility without overwhelming operators with technical heartbeat nuances, the user-facing interface simplifies device status presentation to strictly three operational states:

| Canonical Internal Status | User-Facing English | User-Facing Bahasa Indonesia | UI Badge Presentation | Operational Meaning |
|---|---|---|---|---|
| `ONLINE` | **Connected** | **Terhubung** | Emerald pill (`border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`), pulsing dot | Device is actively communicating within the freshness threshold ($\le 60\text{s}$). |
| `OFFLINE` | **Disconnected** | **Terputus** | Muted zinc/amber pill (`border-zinc-500/20 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400`), static dot | Device has stopped communicating or missed heartbeat windows. |
| `STALE` | **Disconnected** | **Terputus** | Muted zinc/amber pill (`border-zinc-500/20 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400`), static dot | Telemetry timestamp exceeds freshness window ($> 60\text{s}$). |
| `UNKNOWN` | **Disconnected** | **Terputus** | Muted zinc/amber pill (`border-zinc-500/20 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400`), static dot | Device initial state upon reactivation or before first telemetry. |
| `INACTIVE` (or `accountStatus = 'DEACTIVATED'`) | **Inactive** | **Tidak Aktif** | Neutral gray pill (`border-zinc-500/20 bg-zinc-500/10 text-zinc-400`), static dot | Device has been administratively deactivated by the Owner. |

**Invariants:**
- Database schema and REST API contracts retain the canonical `DeviceConnectionStatus` enum: `ONLINE`, `OFFLINE`, `STALE`, `UNKNOWN`, `INACTIVE`.
- Client-side filtering maps:
  - `CONNECTED` $\to$ `device.connectionStatus === 'ONLINE'`
  - `DISCONNECTED` $\to$ `['OFFLINE', 'STALE', 'UNKNOWN'].includes(device.connectionStatus)`
  - `INACTIVE` $\to$ `device.connectionStatus === 'INACTIVE' || device.accountStatus === 'DEACTIVATED'`
- API query contracts remain strictly untouched (no custom non-canonical query enum strings passed to backend, preventing HTTP 422 `VALIDATION_ERROR`).

---

## 8. Topic Naming Convention

### 8.1 Topic Root (DEV-TOPIC-001)

Recommended topic root:

```text
agriculture/{environment}/{siteId}/{deviceId}
```

Example:

```text
agriculture/production/site-01/esp32-001
```

Allowed environment values:

```text
development
staging
production
```

Production and test devices shall not share the same topic namespace.

### 8.2 Required Topics (DEV-TOPIC-002)

```text
agriculture/{environment}/{siteId}/{deviceId}/telemetry/soil
agriculture/{environment}/{siteId}/{deviceId}/telemetry/water
agriculture/{environment}/{siteId}/{deviceId}/status
agriculture/{environment}/{siteId}/{deviceId}/heartbeat
agriculture/{environment}/{siteId}/{deviceId}/command/faucet
agriculture/{environment}/{siteId}/{deviceId}/ack/faucet
agriculture/{environment}/{siteId}/{deviceId}/event/faucet
agriculture/{environment}/{siteId}/{deviceId}/config
agriculture/{environment}/{siteId}/{deviceId}/ack/config
```

### 8.3 Topic Rules (DEV-TOPIC-003)

- Topic segments shall use lowercase where possible.
- Topics shall not contain translated text.
- Topics shall not contain user names or email addresses.
- Devices shall not subscribe using broad wildcards beyond their own scope.
- Faucet commands shall never be published to a broadcast topic.
- A command shall always target one specific device.
- Production commands shall not use retained MQTT messages.
- Topic structure changes require a versioned migration plan.

### 8.4 Hardware Team MQTT Reconciliation & Topic Mapping (TASK-0411)

#### 8.4.1 Hardware Team Proposed Parameters

The hardware team provided the following water-tank MQTT parameters:

```text
broker = broker.emqx.io
WebSocket TLS port = 8084 (wss://broker.emqx.io:8084/mqtt)
topicVolume = "irigasi/melon/sensor/volume"
topicValve = "irigasi/melon/kontrol/valve"
topicOtomasi = "irigasi/melon/setting/otomasi"
```

#### 8.4.2 Architectural & Security Conflict Analysis

1. **Public Broker vs Private Isolated Broker (`SEC-DEV-002`):**
   `broker.emqx.io` is EMQX's public, shared demo broker accessible to anyone globally without credentials or topic ACL isolation. Connecting production or staging workloads to a public broker violates mandatory tenant isolation and security policies, enabling malicious third parties to inspect telemetry or publish spoofed valve commands. The canonical platform requires dedicated EMQX Cloud Serverless or private Mosquitto brokers with username/password authentication, per-device ACLs, and strict TLS certificate verification.
2. **Missing Environment Isolation (`DEV-TOPIC-001`):**
   Hardware topics omit the `{environment}` namespace (`development`, `staging`, `production`). Deploying hardware with these topics will cause immediate crosstalk and data corruption across local development, staging containers, and production.
3. **Missing Site & Device Identity (`DEV-TOPIC-003`, `DEV-ID-001`):**
   The hardware topics are flat and omit `{siteId}` and `{deviceId}`.
   - *Telemetry Collision:* If more than one reservoir device connects, all devices publish to `irigasi/melon/sensor/volume`, causing race conditions and clobbering readings.
   - *Broadcast Control Hazard:* Publishing valve actuation commands to `irigasi/melon/kontrol/valve` acts as an unaddressed broadcast to every device subscribed. Faucet commands must strictly target exactly one device (`agriculture/{env}/{siteId}/{deviceId}/command/faucet`).
4. **Non-Canonical Categories & Language Constraints (`DEV-TOPIC-003`):**
   - Canonical reservoir telemetry is structured under `telemetry/reservoir`, whereas hardware uses `sensor/volume`.
   - Topics must be in English and lowercase without translated words (`kontrol` and `otomasi` violate `DEV-TOPIC-003`).
5. **Out-of-Scope Autonomous Actuation (`topicOtomasi`):**
   `irigasi/melon/setting/otomasi` suggests autonomous device-side automation rules. No autonomous physical actuation is supported or permitted in this release. All faucet commands require human initiation by an authenticated Owner or assigned Admin through backend RBAC, durable audit logging, and `ENABLE_FAUCET_CONTROL=false` safety locks.
6. **Missing Lifecycle & Feedback Channels:**
   The hardware proposal defines no topics for:
   - Device command acknowledgement (`ack/faucet` - `ACCEPTED` / `REJECTED`).
   - Physical execution progress and completion events (`event/faucet` - `IN_PROGRESS`, `COMPLETED`, `FAILED`).
   - Device availability and Last Will and Testament (`status` - `ONLINE`, `OFFLINE`).

#### 8.4.3 Permanent Hardware Contract & Maintained Ingress Mapping Boundary (DEC-DEV-031)

Per user-approved decision `DEC-DEV-031`, the hardware topic names are **PERMANENT** and must remain unchanged through production:
- `irigasi/melon/sensor/volume` (Telemetry: Reservoir water volume)
- `irigasi/melon/kontrol/valve` (Control: Faucet/valve actuation)
- `irigasi/melon/setting/otomasi` (Automation: Automated irrigation settings)

The hardware team is **NOT** required to rename these topics. The system adopts a strict boundary architecture:
- **Permanent External Contract:** ESP32 hardware devices publish/subscribe solely to the flat `irigasi/melon/...` topics.
- **Maintained Gateway Ingress Mapping Boundary:** The IoT Gateway (`apps/iot-gateway/src/mqtt/hardware-reconciliation.ts`) maintains a persistent bidirectional adapter translating between flat external topics and the internal canonical namespace (`agriculture/{environment}/{siteId}/{deviceId}/...`).
- **Canonical Internal Contracts Remain Immutable:** The core database schema, Prisma models, shared contracts (`@kebun-melon/contracts`), Web APIs, SSE streams, and frontend remain strictly bound to canonical multi-tenant routing.
- **Explicit Context Requirement & Isolation:** Ingress telemetry on `irigasi/melon/sensor/volume` is mapped to canonical `telemetry/reservoir` only when authenticated publisher identity (username/client certificate) maps deterministically to `{ environment, siteId, deviceId }`. Bare, unauthenticated, or unmapped messages are rejected fail-closed.
- **Anti-Republish Loop Protection:** The gateway checks ingress message origins to prevent infinite forwarding loops between external and internal topics.
- **Safety Lock Enforced:** Retaining `topicValve` and `topicOtomasi` names does NOT authorize activating them. `ENABLE_FAUCET_CONTROL=false` safety defaults remain active. All valve actuation requires backend RBAC, durable database command records, and audit logging.

#### 8.4.5 Direct 2-Tier Canonical Hardware MQTT Contract (DEC-DEV-032)

Per user-approved decision `DEC-DEV-032`, the system formally supersedes the intermediate re-publishing adapter boundary in favor of a direct 2-tier gateway architecture for the single water tank node:

1. **Canonical Topics for Water Tank Domain**:
   - `irigasi/melon/sensor/volume`: Ingested directly by `apps/iot-gateway` (`TelemetryProcessor`). Normalizes raw numeric, string, or JSON (`{ volume }`) values into `reservoir_water_readings`.
   - `irigasi/melon/kontrol/valve`: Dispatched directly by `apps/iot-gateway` (`CommandPublisher`) for manual valve commands (`OPEN` -> `"ON"`, `CLOSE` -> `"OFF"` with QoS 1, retain: false).
   - `irigasi/melon/setting/otomasi`: Dispatched directly by `apps/iot-gateway` (`CommandPublisher`) for automated dispensing commands (`DISPENSE` -> `{ mode: "AUTO", target_liter: n }` with QoS 1, retain: false).
2. **Retirement of Hierarchical Topics for Reservoir**:
   The multi-tenant topic hierarchy (`agriculture/{environment}/{siteId}/{deviceId}/...`) is formally retired for the reservoir domain, eliminating redundant serialization, intermediate broker hops, and loop-detection overhead.
3. **Deterministic Device Binding**:
   Because flat topics lack embedded device IDs, the gateway binds directly to the single active `WATER_TANK_NODE` in the database, resolved via `WATER_TANK_DEVICE_ID` environment configuration with database query fallback (`SELECT id, device_id FROM devices WHERE device_type = 'WATER_TANK_NODE' AND account_status = 'ACTIVE' LIMIT 1`).
4. **Safety & Security Invariants**:
   - `ENABLE_FAUCET_CONTROL=false` default safety lock remains strictly active.
   - Dual written sign-off (Project Owner + Hardware Lead) remains mandatory before physical control activation in production.
   - REST API flows for Soil Quality and Water Quality remain 100% untouched.
   - Database schema, user RBAC, session authentication, and transactional audit logging remain 100% unchanged.
5. **Automated Stale SENT Command Timeout Handling (`DEC-CTRL-094` / `TASK-0804`):**
   - Flat hardware topics (`irigasi/melon/kontrol/valve`) do not provide device acknowledgement channels (`ack/faucet`), and EMQX Cloud broker ACLs explicitly restrict the hardware credential (`Test_Device`) from publishing to arbitrary topics.
   - When commands are dispatched and marked `SENT`, if no ACK is received before the command reaches its expiry timestamp (`expiresAt`), the IoT Gateway's periodic sweeper (`CommandPublisher.sweepStaleSentCommands()`, running every 2,000ms) automatically transitions the command to terminal state `TIMEOUT` (`COMMAND_EXPIRED_TIMEOUT`).
   - This releases the single active command concurrency lock (`faucet_commands_one_active_per_device`), preventing permanent command lockouts while maintaining strict safe failure behavior (`physicalOutcome = 'UNKNOWN'`).

#### 8.4.4 Hardware Team Browser Prototype Security & Architectural Audit

The hardware team provided a client-side browser prototype demonstrating water-tank monitoring and valve actuation using Paho MQTT directly over WebSocket TLS (`wss://broker.emqx.io:8084/mqtt`).

The prototype:
- Subscribes to `irigasi/melon/sensor/volume`.
- Directly publishes primitive string commands (`"ON"` / `"OFF"`) to `irigasi/melon/kontrol/valve` with **QoS 0**.
- Publishes automation settings JSON (`{ mode: "AUTO", target_liter }`) to `irigasi/melon/setting/otomasi`.
- Contains references or potential topics for flow measurement (`irigasi/melon/sensor/debit`, `irigasi/melon/sensor/liter_keluar`).

An audit of this prototype against system specifications identifies the following mandatory findings:

1. **Direct Browser Valve Publishing is Incompatible with System Architecture (`ARCHITECTURE.md` §3.2, `SECURITY.md` §13):**
   - Direct browser-to-broker connections are strictly prohibited (`DEVICE_COMMUNICATION.md` §3).
   - In the prototype, any web visitor can open developer tools or click UI buttons to actuate physical valves with **zero authentication**, **zero role authorization**, and **zero device assignment verification**.
   - Direct publishing completely bypasses the server-side safety flag `ENABLE_FAUCET_CONTROL=false`, creating immediate physical hazard.
   - It bypasses PostgreSQL transaction durability: no audit log is created, no command record is queued, and no operator attribution is recorded.
   - It has no idempotency or replay protection: multiple button clicks or network retries will execute uncontrolled repeated actuations.
2. **Conflict with Completed Flow-Rate Removal (`TASK-0410`, `DEC-MON-089`):**
   - The parameters `flowRate`, `flow_rate`, `WATER_FLOW_RATE`, `m³/h`, and `Debit Air` were completely purged across database schemas, Prisma models, shared contracts, REST APIs, and UI cards in `TASK-0410`.
   - Reintroducing flow rate (`topicDebit`) or dispensed liters (`topicLiterKeluar`) as telemetry topics directly conflicts with approved architecture. Faucet dispensed volume is tracked solely per command lifecycle via `faucet_command_events.volume_dispensed_ml`.
3. **`topicOtomasi` Requires Formal Product Decision (`DECISION REQUIRED`):**
   - The platform currently has zero product specifications, database schemas, or permission matrices for autonomous irrigation scheduling or threshold watering.
   - Implementing automated actuation without backend RBAC, audit logging, and hardware fail-safe timeouts (`DEC-CTRL-090`) is unsafe and blocked pending a formal product decision in `docs/DECISIONS.md`.
4. **Missing QoS, Retain Policy, and Feedback Channels:**
   - **QoS 0 is Unacceptable for Actuators:** QoS 0 provides fire-and-forget delivery with no guarantee that the valve received the command. Canonical specification mandates **QoS 1** coupled with application `commandId` deduplication.
   - **Retain Flag:** Must be strictly `retain = false`.
   - **Missing Lifecycle Channels:** The prototype provides no topics for device acknowledgement (`ack/faucet` - `ACCEPTED` / `REJECTED`), execution events (`event/faucet` - `IN_PROGRESS`, `COMPLETED`, `FAILED`), or device availability (`status` - LWT).

#### 8.4.5 Actionable Technical Requirements for the Hardware Team (Preserving Permanent Topics)

While the topic names are permanent, the hardware team must satisfy the following operational requirements:

1. **Authoritative Exact Topic String & Whitespace Resolution:**
   - The permanent external MQTT topic strings are authoritatively confirmed with strictly **NO** leading or trailing whitespace:
     - `irigasi/melon/sensor/volume`
     - `irigasi/melon/kontrol/valve`
     - `irigasi/melon/setting/otomasi`
   - Topic naming and the trailing-space question are **RESOLVED** by user decision. No further firmware evidence is required to approve these names.
   - Any conflicting firmware or prototype literal (e.g. trailing space `"irigasi/melon/kontrol/valve "`) is an implementation defect/mismatch to report, not an unresolved naming decision.
   - The gateway rejects mismatched topics fail-closed. In accordance with system policy, the system will **NEVER** silently trim whitespace, subscribe to alternate variants, or require hardware to adopt `agriculture/...` topics. The internal gateway mapping boundary is permanently preserved.
2. **Confirmed Purpose vs Unconfirmed Payload Semantics:**
   - **`irigasi/melon/sensor/volume` (Confirmed: Tank water-volume telemetry):**
     - Sensor calibration must report calibrated Liters ($0 - 2200 \text{ L}$).
     - Structured JSON envelope must be used:
       ```json
       {
         "schemaVersion": "1.0",
         "messageId": "<uuid-or-unique-string>",
         "deviceId": "water-tank-node-zi37gz",
         "data": {
           "tankVolume": 1200,
           "status": "NORMAL"
         }
       }
       ```
   - **`irigasi/melon/kontrol/valve` (Confirmed: Valve OPEN/CLOSE commands):**
     - Confirmed behavioral intent is opening and closing the physical valve.
     - *Unconfirmed wire payload syntax:* does firmware parse primitive `"ON"`/`"OFF"`, `"OPEN"`/`"CLOSE"`, integer `1`/`0`, or structured JSON `{"commandId": "...", "action": "OPEN"}`?
     - *Unconfirmed command idempotency:* does firmware parse a unique `commandId` to prevent replay and duplicate execution under QoS 1?
     - *Unconfirmed feedback channel:* does the valve publish execution acknowledgements (`ack`) or completion events upon reaching terminal states?
   - **`irigasi/melon/setting/otomasi` (Confirmed: Irrigation):**
     - Confirmed functional purpose is irrigation.
     - *Unconfirmed operational semantics:* does the message configure persistent threshold settings, initiate a single target-volume dispensing cycle, or enable unmonitored autonomous scheduling?
     - *Unconfirmed parameters:* prototype uses `{ mode: "AUTO", target_liter }`. What modes exist besides `"AUTO"`? What are the units and precision of `target_liter`?
     - *Unconfirmed lifecycle:* how is an in-progress irrigation stopped or aborted over this topic? Does the device publish a completion event when `target_liter` is reached?
     - *Safety constraint:* This topic **MUST NOT** be equated with canonical `DISPENSE` or invent platform-level scheduling without formal backend approval.
3. **Device Isolation on Flat Control Topic (`irigasi/melon/kontrol/valve`):**
   - In MQTT, credentials alone do NOT prevent multiple subscribers on the same topic from receiving broadcast messages.
   - For future control actuation, one of the following 3 isolation strategies must be implemented:
     - **Option 1 (Firmware Payload Filtering - Recommended):** Command payload includes explicit `targetDeviceId`. The ESP32 firmware checks this field and ignores commands intended for other nodes.
     - **Option 2 (EMQX Mountpoints / Topic Rewriting):** The broker maps each client's credentials to a private virtual mountpoint while firmware uses un-prefixed topics.
     - **Option 3 (Single Actuator Per Environment):** Deploy strictly one physical valve actuator per environment.
4. **Valve Command Protocol & QoS (Platform Contract vs Unconfirmed Wire Format):**
   - In canonical platform architecture, discrete valve actions (`OPEN`, `CLOSE`) explicitly **forbid** `targetVolumeMl` / `phase` / `plantCount` (`CreateFaucetCommandInputSchema`), whereas `DISPENSE` operations require a positive `targetVolumeMl`.
   - Firmware must subscribe with **QoS 1** to `irigasi/melon/kontrol/valve`.
   - If/when valve control is activated via the gateway mapping boundary, the platform publishes structured JSON conforming to the action:
     - For discrete valve commands: `{"commandId": "...", "action": "OPEN" | "CLOSE"}` (strictly **omitting** `targetVolumeMl`).
     - For volume dispensing: `{"commandId": "...", "action": "DISPENSE", "targetVolumeMl": ...}`.
   - The hardware team must state whether firmware can parse this structured JSON or if firmware currently requires a specific wire format.
5. **Private Broker & TLS Authentication:**
   - ESP32 must connect to the private EMQX Cloud cluster (`mqtts://...:8883` or `wss://...:8084`) using dedicated username/password credentials. Public `broker.emqx.io` is strictly forbidden for production/staging.
6. **Fail-Safe Mechanism (`DEC-CTRL-090`):**
   - Firmware must enforce a hardware safety watchdog/timeout: if Wi-Fi or MQTT disconnects while the valve is open, the valve must automatically close.
7. **EMQX Dynamic Topic Creation vs Deployment Readiness:**
   - MQTT topics require **no advance creation** or static pre-registration in EMQX Cloud; topics are instantiated dynamically in the broker topic tree upon initial publication or subscription.
   - Dynamic broker topic creation must be clearly distinguished from deployment-level ACLs, client credentials, gateway subscriptions, and routing rules, whose production readiness must NOT be claimed without direct deployment verification.
   - Zero changes to EMQX Cloud broker configuration were made during `TASK-0411`.

#### 8.4.6 Dedicated EMQX Cloud Configuration & WSS Transport (DEC-DEV-032)

The system utilizes a dedicated, enterprise-grade EMQX Cloud deployment (Singapore `asia-southeast1`) as its single production MQTT broker:

1. **Dedicated Deployment Architecture:**
   - **Endpoint & Clustering:** Hosted on EMQX Cloud dedicated infrastructure (`he100b10.ala.asia-southeast1.emqxsl.com`).
   - **Environment-Based Configuration:** Broker URL, ports, credentials, and client identifiers are injected exclusively via environment variables (`MQTT_BROKER_URL`, `MQTT_GATEWAY_CLIENT_ID`, `MQTT_GATEWAY_USERNAME`, `MQTT_GATEWAY_PASSWORD`).
   - **Standard URL Format:**
     ```env
     MQTT_BROKER_URL=wss://he100b10.ala.asia-southeast1.emqxsl.com:8084/mqtt
     ```
   - **Prohibition of `broker.emqx.io`:** The public sandbox broker (`broker.emqx.io:8084`) is an unauthenticated, public testbed without SLA or security isolation. It is strictly **FORBIDDEN** from being used or documented as a production endpoint. Any reference to `broker.emqx.io` in earlier prototypes is classified strictly as an integration testbed, not production infrastructure.

2. **WSS (WebSocket Secure) Protocol Standard:**
   - **Transport:** WebSocket over TLS (`wss://`).
   - **Port:** `8084` (standard EMQX TLS WebSocket listener `ws:default`).
   - **Path:** `/mqtt`.
   - **Benefits:** Penetrates restrictive egress firewalls, proxies, and corporate networks seamlessly while maintaining end-to-end TLS encryption matching web application standards.

#### 8.4.7 MQTT Client Identity Separation & EMQX Access Control Lists (ACL)

To enforce least-privilege security and prevent cross-client interference, the system strictly separates client identities and enforces broker-level ACLs:

1. **Client Identity Separation Matrix:**

| Dimension | IoT Gateway Client | Hardware Device Client |
|---|---|---|
| **Role** | Ingestion & Command Dispatcher | Physical Reservoir Sensing & Actuation |
| **Username** | `Test_gateway` | `Test_Device` |
| **Client ID Convention** | `gateway-kebun-melon-<env>-<instance>` or `Test_Gateway` | `water-tank-node-<mac-or-unique>` |
| **Allowed Actions** | • **Subscribe:** Sensor telemetry (`irigasi/melon/sensor/volume`)<br>• **Publish:** Valve commands (`irigasi/melon/kontrol/valve`)<br>• **Publish:** Automation commands (`irigasi/melon/setting/otomasi`) | • **Publish:** Sensor volume (`irigasi/melon/sensor/volume`)<br>• **Subscribe:** Valve commands (`irigasi/melon/kontrol/valve`)<br>• **Subscribe:** Automation commands (`irigasi/melon/setting/otomasi`) |
| **Forbidden Actions** | • Direct physical valve manipulation without API mediation | • Publishing valve or automation commands<br>• Subscribing to telemetry of other nodes |
| **Credential Protection** | **CONFIDENTIAL:** Gateway credentials shall **NEVER** be shared with or embedded into hardware firmware. | Provisioned securely to hardware team out-of-band. |

2. **EMQX Broker ACL Policy Configuration:**

The EMQX Cloud broker enforces the following mandatory Access Control List (ACL) rules:

```text
# Rule 1: IoT Gateway Service (Full access to irrigation namespace)
User: Test_gateway
  - Action: Pub/Sub
  - Topic:  irigasi/melon/#
  - Effect: Allow

# Rule 2: Physical Water Tank Hardware Node (Least-privilege telemetry publish & command subscribe)
User: Test_Device
  - Action: Publish
  - Topic:  irigasi/melon/sensor/volume
  - Effect: Allow

  - Action: Subscribe
  - Topic:  irigasi/melon/kontrol/valve
  - Effect: Allow

  - Action: Subscribe
  - Topic:  irigasi/melon/setting/otomasi
  - Effect: Allow

# Rule 3: Default Deny Policy
User: *
  - Action: All
  - Topic:  #
  - Effect: Deny
```

3. **Production ACL Artifact & Automated Verification (TASK-0907):**
The authoritative ACL rules are version-controlled in `docker/emqx/acl.conf`.
Security compliance across all 6 criteria (anonymous disabled, TLS enabled, credential uniqueness, device topic isolation, gateway permissions, revoked device rejection) is verified automatically via:
```bash
npm run mqtt:verify:prod
```
and deterministically unit-tested via `apps/iot-gateway/src/__tests__/production-mqtt-security.test.ts`.

#### 8.4.8 Hardware Team Onboarding & Deployment Specification

This section provides the authoritative operational guide for the hardware engineering team to configure the ESP32 Water Tank Node firmware:

1. **Connection Parameters:**
   - **Host / Endpoint:** `he100b10.ala.asia-southeast1.emqxsl.com` *(obtain exact active cluster endpoint from Project Owner)*
   - **Protocol:** `WSS` (WebSocket Secure over TLS)
   - **Port:** `8084`
   - **Path:** `/mqtt`
   - **Full Connection URI:** `wss://<cluster-host>:8084/mqtt`
   - **TLS Verification:** Enabled (server-authenticated using public root CAs, e.g. Let's Encrypt / ISRG Root X1)

2. **Authentication & Identity:**
   - **Username:** `Test_Device`
   - **Password:** *(Supplied securely out-of-band by Project Owner; never committed to git)*
   - **Client ID Format:** `water-tank-node-<mac-address>` (e.g. `water-tank-node-30AEA4070FE0`). Must be unique across all connections to prevent broker connection eviction.
   - **Clean Session:** `true` (recommended for standard operational state).
   - **Keep Alive:** `60` seconds.

3. **Topic & Payload Contracts:**

| Function | Canonical Topic | Direction | QoS | Retain | Wire Payload Format |
|---|---|---|:---:|:---:|---|
| **Volume Telemetry** | `irigasi/melon/sensor/volume` | Device $\rightarrow$ Broker | 0 or 1 | `false` | Raw number (`"125.5"` or `125.5`) or JSON: `{"volume": 125.5}` |
| **Manual Valve** | `irigasi/melon/kontrol/valve` | Broker $\rightarrow$ Device | 1 | `false` | String: `"ON"` (Open valve) or `"OFF"` (Close valve) |
| **Automation** | `irigasi/melon/setting/otomasi` | Broker $\rightarrow$ Device | 1 | `false` | JSON: `{"mode": "AUTO", "target_liter": 1.5}` |

4. **Firmware Safety Mandatory Requirements:**
   - **Watchdog / Disconnect Auto-Close:** If Wi-Fi or MQTT connection drops while the valve is open, the ESP32 firmware **MUST** automatically close the valve within 5 seconds to prevent tank overflow or flooding.
   - **Single-Node Invariant:** Production deployment operates strictly with **one** physical water tank node.
   - **Zero Retain:** Hardware shall never publish with `retain: true`.

#### 8.4.9 Temporary Development & Integration Testbed (`broker.emqx.io:8084`)

For initial hardware bench-testing and integration verification prior to production onboarding, the development environment supports temporary verification against EMQX's public testbed:

1. **Development Testbed Parameters:**
   - **Endpoint:** `wss://broker.emqx.io:8084/mqtt`
   - **Protocol:** `WSS` (WebSocket Secure over TLS)
   - **Port:** `8084`
   - **Path:** `/mqtt`
   - **Authentication:** Anonymous (no username or password required)
   - **Client ID:** Any unique development string (e.g. `dev-node-<mac-or-random>`)
   - **Clean Session:** `true`

2. **Supported Wire Payload Contracts:**
   - **Volume Telemetry (`irigasi/melon/sensor/volume`):**
     - Primitive numeric string: `"145.8"`
     - Structured JSON envelope: `{"volume": 145.8}` or `{"tankVolume": 145.8}`
     - Valid range: $0 \le \text{volume} \le 100,000 \text{ L}$ (calibrated Liters)
   - **Valve Actuation (`irigasi/melon/kontrol/valve`):**
     - `"ON"` (Open valve)
     - `"OFF"` (Close valve)
     - QoS 1, Retain `false`
   - **Automated Dispensing (`irigasi/melon/setting/otomasi`):**
     - `{"mode": "AUTO", "target_liter": 1.5}`
     - QoS 1, Retain `false`

3. **Automated Verification Runner:**
   Developers can verify connectivity, round-trip pub/sub, canonical telemetry reception, gateway normalization via `HardwareMqttAdapter`, and command translation/safety locks with:
   ```bash
   npm run mqtt:verify:hw
   ```

4. **Security Invariants & Production Transition:**
   - `broker.emqx.io` is strictly an unauthenticated development sandbox and is **NEVER** permitted in production or staging environments.
   - The IoT Gateway retains its server-side safety flag `ENABLE_FAUCET_CONTROL=false`, rejecting physical actuation attempts until formally activated.
   - Before deploying hardware to production, the hardware team must switch firmware configuration from `broker.emqx.io:8084` to the dedicated EMQX Cloud cluster (`he100b10.ala.asia-southeast1.emqxsl.com:8084`), configure credentials (`Test_Device`), and adhere to the broker ACLs specified in §8.4.7–8.4.8.

#### 8.4.10 End-to-End Telemetry Pipeline, Freshness Lifecycle & UI Reconciliation

During development verification with live hardware transmissions on `irigasi/melon/sensor/volume`, the end-to-end telemetry and freshness lifecycle was fully reconciled across backend, API, and frontend presentation tiers.

##### 1. End-to-End Telemetry Pipeline Architecture

```text
[ Physical Sensor Node ] (ESP32 / NodeMCU)
       │
       │ MQTT Publish (WSS, Port 8084, QoS 0/1)
       ▼ Topic: irigasi/melon/sensor/volume
[ EMQX MQTT Broker ] (broker.emqx.io in Dev / Dedicated EMQX Cloud in Prod)
       │
       │ WSS Subscription
       ▼ Topic: irigasi/melon/sensor/volume
[ IoT Gateway ] (apps/iot-gateway)
       │ • HardwareMqttAdapter: Normalize primitive/JSON volume, range check (0-100,000 L)
       │ • TelemetryProcessor: Deduplicate, validate schema, resolve target device entity
       ▼
[ PostgreSQL Database ] (Supabase DEV / Staging / Production)
       │ • Atomic INSERT into reservoir_water_readings (tank_volume, recorded_at, received_at)
       │ • Atomic UPDATE devices SET connection_status = 'ONLINE', last_seen_at = now()
       ▼
[ Web Application Backend & API ] (apps/web)
       │ • GET /api/v1/devices/[deviceId]/monitoring/latest & /water/latest
       │ • GET /api/v1/devices & GET /api/v1/devices/[deviceId]
       │ • Freshness calculation: now() - lastSeenAt > 60s ? 'STALE' : 'ONLINE'
       ▼
[ Authenticated Frontend Web UI ] (apps/web)
       │ • useLatestMonitoring: SWR / interval polling + realtime webhook updates
       │ • DeviceContext: In-memory device state synchronized via updateDeviceStatus
       │ • WaterTankMonitoringCard & MonitoringDashboard: Unified indicator + volume placeholder
       │ • DeviceSelector, FaucetPresetSelector & FaucetConfirmationModal: Aligned status dots
```

##### 2. Root Causes Discovered

1. **Hardware Value Mismatch Clarification:**
   - Initial hardware team reports indicated water volume changes were not appearing on the web dashboard.
   - In-depth investigation proved that the web was correctly displaying persisted telemetry records from the database. The perceived mismatch was caused by hardware transmission intervals and sensor polling states, with zero data loss or translation corruption in the gateway or database.
2. **Missing Time-Based Stale Detection:**
   - In the database, `devices.connection_status` remained statically `ONLINE` after physical hardware stopped publishing or went offline.
   - Without dynamic time-based decay, offline devices falsely appeared active, and the last known telemetry value remained displayed indefinitely.
3. **UI Component Status Inconsistency:**
   - `WaterTankMonitoringCard` evaluated freshness dynamically from the monitoring endpoint snapshot (`isStale`).
   - `DeviceSelector`, `FaucetPresetSelector`, and `FaucetConfirmationModal` consumed `selectedDevice.connectionStatus` cached from the initial device list (`GET /api/v1/devices`), causing conflicting UI indicators (e.g. emerald "ONLINE" dot while the card displayed an amber "Data Kedaluwarsa" notice).
4. **Misleading Volume Display:**
   - Both `WaterTankMonitoringCard` and `MonitoringDashboard` continued rendering the last known numeric volume (e.g. `7.93 L`) even when telemetry was stale or offline, which could lead operators to make incorrect water availability assumptions.

##### 3. Implemented Fixes

1. **Authoritative 60-Second Stale Threshold:**
   - Defined `TELEMETRY_STALE_THRESHOLD_MS = 60 * 1000` (60 seconds) in `apps/web/lib/constants.ts` as the single system-wide threshold for telemetry freshness.
2. **Dynamic STALE Status Calculation:**
   - Updated monitoring routes (`/monitoring/latest`, `/water/latest`, `/soil/latest`) and device routes (`GET /api/v1/devices`, `GET /api/v1/devices/[deviceId]`) to calculate `effectiveStatus = 'STALE'` when `now - lastSeenAt > 60s` for active nodes.
   - Preserves the database as an immutable source of telemetry facts without performing premature database update writes.
3. **DeviceContext In-Memory Synchronization:**
   - Added `updateDeviceStatus` to `DeviceContext`.
   - Updated `useLatestMonitoring` to synchronize telemetry freshness with in-memory device state, dynamically updating `selectedDevice.connectionStatus` and the authorized devices list while strictly preserving true `OFFLINE` and `INACTIVE` database states.
4. **Unified Connection Status Indicator Language:**
   - Standardized semantic status indicators across all components (`DeviceSelector`, `WaterTankMonitoringCard`, `MonitoringDashboard`, `FaucetPresetSelector`, `FaucetConfirmationModal`):
     - `ONLINE`: Emerald pulsing dot (`bg-emerald-500`)
     - `STALE`: Amber dot (`bg-amber-500`) and amber badge (`bg-amber-50 text-amber-700 border-amber-200`)
     - `OFFLINE`: Rose dot (`bg-rose-500`)
5. **Volume Value Hiding & Placeholder Rendering:**
   - **ONLINE:** Renders live water volume formatted to 2 decimal places (`formatMetricValue(volumeVal, 2)`), matching hardware sensor precision.
   - **STALE / OFFLINE:** Hides numeric volume, displays placeholder (`— L` in `WaterTankMonitoringCard`, `- L` in `MonitoringDashboard`), and sets progress gauge bar to `0%`, while keeping the amber Stale Alert notice and `lastSeen` timestamp visible.
6. **Automatic Online Restoration:**
   - When hardware resumes publishing and fresh telemetry arrives ($< 60\text{s}$), the system automatically transitions back to `ONLINE`, clears stale banners, and restores live volume rendering across all UI elements.
7. **Frontend Presentation Normalization (DEC-DEV-034 / DEC-UIUX-106, Reconciled 2026-09-19):**
   - While backend services, gateway decay logic, and database persistence retain the authoritative 60-second telemetry freshness calculation (`TELEMETRY_STALE_THRESHOLD_MS = 60000`) and internal `STALE` status evaluation, the authenticated frontend web application normalizes user-facing connection presentation strictly into two operational states:
     - **Connected** (`Terhubung`): for `ONLINE` active telemetry connection (emerald dot `bg-emerald-500`).
     - **Disconnected** (`Terputus`): for `OFFLINE`, `STALE`, missing heartbeat, or unavailable device states (rose dot `bg-rose-500`).
   - The user-facing term `"Stale"` / `"Data Usang"` is strictly not exposed in connection badges, selector lists, dots, or dropdown filter tabs. Quick status filter tabs in `DeviceSelector` strictly offer `All` / `Connected` / `Disconnected`, where `Disconnected` filters both `OFFLINE` and `STALE` nodes.

##### 4. Verification Evidence & Preserved Invariants

- **Automated Unit Tests:** 100% pass across all unit test suites (`water-tank-monitoring-card.test.tsx` 11/11, `monitoring-dashboard.test.tsx` 8/8, `latest.test.ts` 16/16, full telemetry suites 53/53 passed).
- **Monorepo Typecheck:** `npm run typecheck` returned 0 errors across all 4 packages (`@kebun-melon/iot-gateway`, `@kebun-melon/web`, `@kebun-melon/contracts`, `@kebun-melon/database`).
- **Manual Verification:** Verified in browser that stale simulation displays synchronized amber indicators and volume placeholders, and automatically recovers to `ONLINE` upon receiving fresh telemetry.
- **Preserved Project Constraints:**
  - Inbound MQTT telemetry subscription and normalization logic remain unchanged.
  - Hardware payload format processing remains unchanged.
  - Staging environment remains completely untouched.
  - Dedicated production EMQX Cloud broker remains completely untouched.
  - No environment files (`.env`) were modified.

---

## 9. MQTT Quality of Service

Recommended MQTT QoS:

| Message category | QoS | Rationale |
|---|---:|---|
| High-frequency telemetry | `0` or `1` | Depends on data-loss tolerance |
| Device status | `1` | Status should reach the gateway |
| Heartbeat | `0` or `1` | Frequent and replaceable |
| Faucet command | `1` | At-least-once delivery |
| Faucet acknowledgement | `1` | Command state must be tracked |
| Faucet progress event | `0` or `1` | Final result must not rely only on progress |
| Configuration | `1` | Configuration delivery must be tracked |
| Configuration acknowledgement | `1` | Required for confirmation |

Recommended initial choice:

- Telemetry: QoS `1` when sampling frequency and broker capacity permit it.
- Faucet command: QoS `1`.
- Faucet acknowledgement: QoS `1`.

### 9.1 Duplicate Implication

QoS `1` provides at-least-once delivery and may deliver duplicates.

Therefore:

- Every message shall contain a unique identifier.
- Every faucet command shall contain a unique `commandId`.
- The gateway shall process duplicate telemetry idempotently.
- The device shall not execute the same `commandId` more than once.
- A duplicate command shall return the existing known state rather than start another dispensing operation.

MQTT QoS shall not be treated as a substitute for application-level idempotency.

---

## 10. Retained Messages

Recommended retained-message policy:

| Message | Retained |
|---|---:|
| Faucet command | No |
| Faucet acknowledgement | No |
| Faucet progress event | No |
| High-frequency telemetry | No by default |
| Device availability/status | Yes, where safe |
| Device capability/config snapshot | Yes, where appropriate |

Rules:

- A faucet command shall never be retained.
- A newly connected device shall never execute an old retained command.
- Retained status shall include a timestamp.
- Retained telemetry, if later enabled, shall be clearly treated as last known data rather than automatically current.
- The backend shall still apply stale-data rules to retained messages.

---

## 11. Last Will and Testament (DEV-STAT-002)

Each device should configure an MQTT Last Will and Testament.

Recommended will topic:

```text
agriculture/{environment}/{siteId}/{deviceId}/status
```

Recommended will payload:

```json
{
  "schemaVersion": "1.0",
  "deviceId": "esp32-001",
  "status": "OFFLINE",
  "reason": "CONNECTION_LOST"
}
```

Recommended will settings:

```text
QoS: 1
Retained: true
```

After a successful connection, the device shall publish:

```json
{
  "schemaVersion": "1.0",
  "deviceId": "esp32-001",
  "status": "ONLINE",
  "firmwareVersion": "1.0.0",
  "recordedAt": "2026-07-27T13:45:00+07:00"
}
```

The gateway shall not rely solely on Last Will. It shall also calculate last-seen and stale state from heartbeat or telemetry timing.

---

## 12. Common Message Envelope

All application messages should contain a common envelope.

Recommended fields:

| Field | Type | Required | Description |
|---|---|---:|---|
| `schemaVersion` | String | Yes | Payload schema version |
| `messageId` | String | Yes | Unique message identifier |
| `deviceId` | String | Yes | Canonical device ID |
| `siteId` | String | Recommended | Site identifier |
| `sequence` | Integer | Recommended | Monotonic device sequence number |
| `recordedAt` | ISO 8601 String | Recommended | Device measurement time |
| `sentAt` | ISO 8601 String | Optional | Device publish time |
| `firmwareVersion` | String | Optional | Device firmware |
| `data` | Object | Yes | Message-specific payload |

Example:

```json
{
  "schemaVersion": "1.0",
  "messageId": "msg-01JXYZ001",
  "deviceId": "esp32-001",
  "siteId": "site-01",
  "sequence": 10342,
  "recordedAt": "2026-07-27T13:45:00+07:00",
  "sentAt": "2026-07-27T13:45:01+07:00",
  "firmwareVersion": "1.0.0",
  "data": {}
}
```

### 12.1 Server-Generated Metadata

The gateway shall add server metadata when processing a message:

```text
receivedAt
brokerTopic
validationStatus
ingestionId
```

`receivedAt` shall use the server clock and be treated as the authoritative receipt time.

### 12.2 Device Clock Reliability

A device timestamp may be inaccurate when:

- Network time is unavailable.
- The device has rebooted.
- The device clock has drifted.

The system shall store both `recordedAt` and `receivedAt` where available.

The final clock synchronisation method is `TBD`.

---

## 13. Soil Telemetry Payload

Topic:

```text
agriculture/{environment}/{siteId}/{deviceId}/telemetry/soil
```

Recommended payload:

```json
{
  "schemaVersion": "1.0",
  "messageId": "msg-soil-000001",
  "deviceId": "soil-node-001",
  "siteId": "site-01",
  "sequence": 301,
  "recordedAt": "2026-07-27T13:45:00+07:00",
  "data": {
    "nitrogen": 45.2,
    "phosphorus": 21.8,
    "potassium": 73.1,
    "temperature": 28.4,
    "moisture": 67.3,
    "ph": 6.5,
    "ec": 1420,
    "status": "NORMAL"
  }
}
```

### 13.1 Soil Fields

| Field | Type | Required | Canonical Unit | UI Display Unit | Parameter Description |
|---|---|---:|---|---|---|
| `nitrogen` | Number or null | Yes when capability exists | `mg/kg` | `mg/kg` | Soil Nitrogen (N) content |
| `phosphorus` | Number or null | Yes when capability exists | `mg/kg` | `mg/kg` | Soil Phosphorus (P) content |
| `potassium` | Number or null | Yes when capability exists | `mg/kg` | `mg/kg` | Soil Potassium (K) content |
| `temperature` | Number or null | Yes when capability exists | `°C` | `°C` | Soil temperature |
| `moisture` | Number or null | Yes when capability exists | `%` | `%` | Volumetric soil moisture percentage |
| `ph` | Number or null | Yes when capability exists | `pH` | `pH` | Soil pH acidity / alkalinity scale (unitless) |
| `ec` | Number or null | Yes when capability exists | `µS/cm` | `µS/cm` | Soil Electrical Conductivity |
| `status` | Canonical enum | Recommended | None | None | Defined by external status rules |

Allowed provisional soil status values:

```text
NORMAL
WARNING
CRITICAL
UNKNOWN
UNAVAILABLE
INVALID
```

The gateway shall not invent a soil status when the source or approved backend rule does not provide one.

---

## 14. Water Telemetry Payload

Topic:

```text
agriculture/{environment}/{siteId}/{deviceId}/telemetry/water
```

Recommended payload (Water-Quality monitoring domain):

```json
{
  "schemaVersion": "1.0",
  "messageId": "msg-water-000001",
  "deviceId": "water-node-001",
  "siteId": "site-01",
  "sequence": 902,
  "recordedAt": "2026-07-27T13:45:00+07:00",
  "data": {
    "ph": 7.1,
    "tds": 420,
    "ec": 450,
    "status": "NORMAL"
  }
}
```

### 14.1 Water Quality Fields

| Field | Type | Required | Canonical Unit | UI Display Unit | Parameter Description |
|---|---|---:|---|---|---|
| `ph` | Number or null | Yes when capability exists | `pH` | `pH` | Water pH acidity / alkalinity scale (unitless) |
| `tds` | Number or null | Yes when capability exists | `ppm` | `ppm` | Total Dissolved Solids |
| `ec` | Number or null | Yes when capability exists | `µS/cm` | `µS/cm` | Water Electrical Conductivity |
| `status` | Canonical enum | Recommended | None | None | Defined by external status rules |

---

### 14.2 Reservoir-Water Telemetry Payload (Proposed Domain)

Topic:

```text
agriculture/{environment}/{siteId}/{deviceId}/telemetry/reservoir
```

Recommended payload:

```json
{
  "schemaVersion": "1.0",
  "messageId": "msg-reservoir-000001",
  "deviceId": "water-node-001",
  "siteId": "site-01",
  "sequence": 903,
  "recordedAt": "2026-07-27T13:45:00+07:00",
  "data": {
    "tankVolume": 75.0,
    "status": "NORMAL"
  }
}
```

> **Note (`DEC-MON-089` / `TASK-0410`):** `flowRate` parameter is deleted from water-tank telemetry. The IoT Gateway validates and strips legacy `flowRate` fields for backward compatibility with older physical firmware or simulators.


### 14.2 Shared Sensor/Tool Battery Telemetry Payload (Proposed Domain)

Topic:

```text
agriculture/{environment}/{siteId}/{deviceId}/telemetry/battery
```

Recommended payload:

```json
{
  "schemaVersion": "1.0",
  "messageId": "msg-bat-000001",
  "deviceId": "esp32-001",
  "siteId": "site-01",
  "sequence": 904,
  "recordedAt": "2026-07-27T13:45:00+07:00",
  "data": {
    "battery": 82,
    "status": "NORMAL"
  }
}
```

### 14.1 Water Fields

| Field | Type | Required | Unit |
|---|---|---:|---|
| `ph` | Number or null | Yes when capability exists | Unitless |
| `tds` | Number or null | Yes when capability exists | `TBD` |
| `ec` | Number or null | Yes when capability exists | `TBD` |
| `battery` | Number or null | DELETED | Deleted parameter (`DEC-MON-086`) |
| `latitude` | Number or null | DELETED | Deleted parameter |
| `longitude` | Number or null | DELETED | Deleted parameter |
| `status` | Canonical enum | Recommended | Defined by external status rules |

Allowed provisional water status values:

```text
NORMAL
WARNING
CRITICAL
UNKNOWN
UNAVAILABLE
INVALID
```

The `battery` (`BAT`) parameter is removed completely from soil and water quality monitoring (`DEC-MON-086`, superseding `DEC-MON-085`).

---

## 15. Null, Missing, and Invalid Values

The following meanings shall remain distinct:

| Representation | Meaning |
|---|---|
| Numeric `0` | A valid measured zero |
| `null` | Measurement unavailable for this message |
| Missing field | Field not supported or payload invalid, depending on schema |
| `INVALID` status | Value received but rejected by approved validation |
| No message | Device has not sent data |

Rules:

- The gateway shall not convert missing values into zero.
- The frontend shall not display `0` for unavailable data.
- Required-field absence shall produce a validation event.
- Optional capability fields may be absent.
- `NaN`, infinity, and non-numeric strings shall be rejected.
- Validation ranges and units shall be supplied by the hardware or domain team.

---

## 16. Heartbeat Message

Topic:

```text
agriculture/{environment}/{siteId}/{deviceId}/heartbeat
```

Recommended payload:

```json
{
  "schemaVersion": "1.0",
  "messageId": "heartbeat-000301",
  "deviceId": "esp32-001",
  "siteId": "site-01",
  "sequence": 301,
  "recordedAt": "2026-07-27T13:45:00+07:00",
  "data": {
    "uptimeSeconds": 58200,
    "wifiRssi": -61,
    "freeHeapBytes": 118240
  }
}
```

All diagnostic fields are optional.

The exact heartbeat interval is `TBD`.

The gateway shall use heartbeat and telemetry receipt times to determine:

```text
ONLINE
OFFLINE
STALE
UNKNOWN
```

---

## 17. Device Status Message

Topic:

```text
agriculture/{environment}/{siteId}/{deviceId}/status
```

Recommended payload:

```json
{
  "schemaVersion": "1.0",
  "messageId": "status-000012",
  "deviceId": "esp32-001",
  "siteId": "site-01",
  "recordedAt": "2026-07-27T13:45:00+07:00",
  "data": {
    "status": "ONLINE",
    "reason": "CONNECTED",
    "firmwareVersion": "1.0.0",
    "capabilities": [
      "SOIL_TELEMETRY",
      "WATER_TELEMETRY"
    ]
  }
}
```

Recommended canonical connection statuses:

```text
ONLINE
OFFLINE
STALE
UNKNOWN
INACTIVE
```

Recommended reason codes:

```text
CONNECTED
CONNECTION_LOST
HEARTBEAT_TIMEOUT
DEVICE_DISABLED
REBOOTED
UNKNOWN_REASON
```

Translated status text shall not be sent through MQTT.

---

## 18. Faucet Command Contract (UI/API Compatibility / TASK-0807)

Topic:

```text
agriculture/{environment}/{siteId}/{deviceId}/command/faucet
```

The server maps phase and plant count to volume for dispensing, or passes discrete manual valve commands.

Approved presets and actions:

| Action | Phase | Volume per Plant | Target Volume Calculation |
|---|---|---|---|
| `DISPENSE` | `1` | `300 mL` (UI 0.3 L) | $300\text{ mL} \times \text{plantCount}$ |
| `DISPENSE` | `2` | `1,000 mL` (UI 1.0 L) | $1,000\text{ mL} \times \text{plantCount}$ |
| `DISPENSE` | `3` | `1,500 mL` (UI 1.5 L) | $1,500\text{ mL} \times \text{plantCount}$ |
| `OPEN` | `null` | `null` | `null` (Manual continuous open) |
| `CLOSE` | `null` | `null` | `null` (Manual continuous close) |

Example `DISPENSE` payload (3 plants @ Phase 1 = 900 mL):

```json
{
  "schemaVersion": "1.0",
  "commandId": "cmd-01JXYZ123",
  "deviceId": "water-node-001",
  "siteId": "site-01",
  "action": "DISPENSE",
  "phase": 1,
  "plantCount": 3,
  "targetVolumeMl": 900,
  "requestedAt": "2026-07-27T13:45:00+07:00",
  "expiresAt": "2026-07-27T13:50:00+07:00"
}
```

Example manual `OPEN` payload:

```json
{
  "schemaVersion": "1.0",
  "commandId": "cmd-01JXYZ124",
  "deviceId": "water-node-001",
  "siteId": "site-01",
  "action": "OPEN",
  "requestedAt": "2026-07-27T13:45:00+07:00",
  "expiresAt": "2026-07-27T13:50:00+07:00"
}
```

### 18.1 Required Command Fields

| Field | Type | Required | Description |
|---|---|---:|---|
| `schemaVersion` | String | Yes | Contract version (`1.0`) |
| `commandId` | String | Yes | Globally unique command identifier (`cmd-<uuid>`) |
| `deviceId` | String | Yes | Target canonical device ID |
| `siteId` | String | Recommended | Target site identifier |
| `action` | Enum | Yes | `DISPENSE`, `OPEN`, or `CLOSE` |
| `phase` | Integer | Conditional | Required for `DISPENSE` (`1`, `2`, `3`); `null` for `OPEN`/`CLOSE` |
| `plantCount` | Integer | Conditional | Required for `DISPENSE` ($\ge 1$); `null` for `OPEN`/`CLOSE` |
| `targetVolumeMl` | Integer | Conditional | Server-calculated integer volume for `DISPENSE`; `null` for `OPEN`/`CLOSE` |
| `requestedAt` | ISO 8601 | Yes | Backend request timestamp |
| `expiresAt` | ISO 8601 | Yes | 5-minute expiration deadline |

### 18.2 Command & UI Integration Rules

- The UI dispatches commands to the backend via `POST /api/v1/devices/{deviceId}/faucet-commands` using pure HTTP `Idempotency-Key` header.
- The server maintains exclusive volume authority: `targetVolumeMl` is calculated on the server and verified against `faucet_commands_action_check`.
- Physical MQTT publication and ACK/event processing are handled asynchronously by `CommandPublisher`, `AcknowledgementProcessor`, and `FaucetEventProcessor` in `apps/iot-gateway`.
- `TASK-0807` establishes and verifies UI/API compatibility only; end-to-end physical hardware validation remains under `TASK-0811`.

---

## 19. Faucet Acknowledgement Contract

Topic:

```text
agriculture/{environment}/{siteId}/{deviceId}/ack/faucet
```

The device shall acknowledge whether a command is accepted or rejected.

Recommended accepted acknowledgement:

```json
{
  "schemaVersion": "1.0",
  "messageId": "ack-000001",
  "commandId": "cmd-01JXYZ123",
  "deviceId": "water-node-001",
  "recordedAt": "2026-07-27T13:45:02+07:00",
  "data": {
    "status": "ACKNOWLEDGED",
    "accepted": true
  }
}
```

Recommended rejection acknowledgement:

```json
{
  "schemaVersion": "1.0",
  "messageId": "ack-000002",
  "commandId": "cmd-01JXYZ123",
  "deviceId": "water-node-001",
  "recordedAt": "2026-07-27T13:45:02+07:00",
  "data": {
    "status": "REJECTED",
    "accepted": false,
    "reasonCode": "DEVICE_BUSY"
  }
}
```

Recommended rejection reason codes:

```text
INVALID_COMMAND
INVALID_PHASE
EXPIRED_COMMAND
DUPLICATE_COMMAND
DEVICE_BUSY
DEVICE_NOT_READY
INSUFFICIENT_WATER
CONTROL_DISABLED
UNSUPPORTED_ACTION
INTERNAL_ERROR
```

A reason code shall be canonical and untranslated.

`INSUFFICIENT_WATER` shall be used only when the hardware or approved backend rule can determine that condition.

---

## 20. Faucet Event and Final Result Contract

Topic:

```text
agriculture/{environment}/{siteId}/{deviceId}/event/faucet
```

### 20.1 In-Progress Event

```json
{
  "schemaVersion": "1.0",
  "messageId": "event-000010",
  "commandId": "cmd-01JXYZ123",
  "deviceId": "water-node-001",
  "recordedAt": "2026-07-27T13:45:05+07:00",
  "data": {
    "status": "IN_PROGRESS",
    "actualVolumeMl": 642
  }
}
```

`actualVolumeMl` is optional and applies to `DISPENSE` operations when supported by hardware flow measurement. For `OPEN` and `CLOSE` commands, volume measurement is not applicable to valve state tracking and is not recorded in the command record.

### 20.2 Completed Event

```json
{
  "schemaVersion": "1.0",
  "messageId": "event-000011",
  "commandId": "cmd-01JXYZ123",
  "deviceId": "water-node-001",
  "recordedAt": "2026-07-27T13:45:18+07:00",
  "data": {
    "status": "COMPLETED",
    "targetVolumeMl": 1000,
    "actualVolumeMl": 1008
  }
}
```

- For `DISPENSE`: `targetVolumeMl` matches the command volume if provided; `actualVolumeMl` is an optional non-negative integer representing measured dispensed volume.
- For `OPEN` and `CLOSE`: Volume fields are not applicable to valve positioning and are not stored in the command record (stored as `null` / `undefined`).

### 20.3 Failed Event

```json
{
  "schemaVersion": "1.0",
  "messageId": "event-000012",
  "commandId": "cmd-01JXYZ123",
  "deviceId": "water-node-001",
  "recordedAt": "2026-07-27T13:45:12+07:00",
  "data": {
    "status": "FAILED",
    "reasonCode": "FLOW_NOT_DETECTED"
  }
}
```

Provisional event statuses:

```text
IN_PROGRESS
COMPLETED
FAILED
CANCELLED
STOPPED
```

The final reason-code list shall be agreed with the hardware team.

The web application shall not report `COMPLETED` solely because the command was sent or acknowledged.

### 20.4 Authoritative Physical Faucet State Determination

Physical faucet state shall be derived strictly from verified execution event outcomes according to the command's persisted action:

| Command Action | Event Status | Authoritative Physical State | Rationale |
|---|---|---|---|
| `OPEN` | `COMPLETED` | `OPEN` | Valve confirmed opened by device execution event. |
| `CLOSE` | `COMPLETED` | `CLOSED` | Valve confirmed closed by device execution event. |
| `DISPENSE` | `COMPLETED` | `UNKNOWN` | Dispensing volume completed; valve closure shall NOT be assumed without direct physical confirmation. |
| *Any* | `FAILED` / `IN_PROGRESS` / timeout / uncertain | `UNKNOWN` | Physical outcome cannot be authoritatively guaranteed. |

Rules:
- Physical state is NEVER inferred from API creation/acceptance, MQTT command publication, or command acknowledgement (ACK).
- Only verified final execution events from the physical device determine authoritative physical state.

---

## 21. Command Lifecycle

The backend command state model shall support:

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

Recommended transitions:

```text
QUEUED
→ SENT
→ ACKNOWLEDGED
→ IN_PROGRESS
→ COMPLETED
```

Alternative final transitions:

```text
QUEUED → FAILED
SENT → TIMEOUT
SENT → EXPIRED
ACKNOWLEDGED → FAILED
IN_PROGRESS → FAILED
IN_PROGRESS → TIMEOUT
IN_PROGRESS → CANCELLED
```

Rules:

- Invalid transitions shall be rejected or flagged.
- Duplicate status messages shall be idempotent.
- Out-of-order messages shall not silently move a final command backwards.
- Final states shall not normally return to non-final states.
- Late events after timeout shall be stored and reconciled according to the final policy.
- The final physical state shall be shown as unknown when communication cannot confirm it.

---

## 22. Command Cancellation and Stop

Cancellation or emergency stop support is `TBD`.

If supported, separate command actions shall be used:

```text
OPEN
CLOSE
```

A cancel or stop payload shall reference the original command:

```json
{
  "schemaVersion": "1.0",
  "commandId": "cmd-stop-0001",
  "deviceId": "water-node-001",
  "action": "CLOSE",
  "targetCommandId": "cmd-01JXYZ123",
  "requestedAt": "2026-07-27T13:45:08+07:00",
  "expiresAt": "2026-07-27T13:45:18+07:00"
}
```

The UI shall not claim that dispensing stopped until the device confirms the final state.

---

## 23. Configuration Messages

Topic:

```text
agriculture/{environment}/{siteId}/{deviceId}/config
```

Configuration messages may support:

- Telemetry interval.
- Heartbeat interval.
- Device display configuration.
- Supported schema version.
- Other approved operational settings.

Configuration shall not be used to define undocumented sensor calibration or physical safety limits.

Configuration requirements are `TBD`.

Every configuration message shall:

- Have a unique configuration ID.
- Be versioned.
- Have an expiry time where relevant.
- Require acknowledgement.
- Be authorised and audited.
- Avoid retained secrets.

---

## 24. Telemetry Frequency

The telemetry publishing interval is `TBD`.

It shall be decided using:

- Hardware capability.
- Power consumption.
- Network bandwidth.
- Required dashboard freshness.
- Historical storage volume.
- Operational needs.

The frontend refresh behaviour shall not force the device to publish more frequently than the agreed hardware interval.

The gateway may push new readings to the web UI as they arrive.

---

## 25. Reconnection Behaviour

Devices shall automatically reconnect after Wi-Fi or broker interruption.

Recommended reconnection strategy:

1. Detect disconnected state.
2. Avoid tight reconnect loops.
3. Use exponential backoff with jitter.
4. Reconnect to Wi-Fi.
5. Reconnect to the MQTT broker.
6. Re-establish the authorised session.
7. Publish `ONLINE` status.
8. Resume subscriptions.
9. Resume telemetry.
10. Reconcile pending command state where supported.

The exact minimum and maximum backoff values are `TBD`.

### 25.1 Boot Behaviour

After startup, the device should:

1. Load secure configuration.
2. Connect to Wi-Fi.
3. Synchronise time where possible.
4. Connect to the broker.
5. Publish online status and capabilities.
6. Subscribe to its command topics.
7. Begin telemetry and heartbeat publication.
8. Report reboot reason where supported.

---

## 26. Offline Buffering

Offline telemetry buffering is recommended when device storage permits it.

Buffered messages shall include:

- Original `recordedAt`.
- Unique `messageId`.
- Sequence number.
- Original measurement values.
- A flag or metadata indicating delayed transmission where needed.

The gateway shall distinguish delayed historical telemetry from current live telemetry.

The following are `TBD`:

- Maximum buffered records.
- Storage medium.
- Data-loss policy when the buffer is full.
- Maximum accepted delayed-data age.
- Whether command messages are ever buffered.

Faucet commands shall not be blindly buffered for later execution after long disconnection.

An expired command shall never execute after reconnect.

---

## 27. Message Ordering

MQTT preserves ordering within a single connection and topic under specific conditions, but the application shall not assume perfect global ordering.

The system shall use:

- `sequence`.
- `messageId`.
- `recordedAt`.
- `receivedAt`.

The gateway shall:

- Detect duplicate messages.
- Flag sequence gaps.
- Accept delayed telemetry according to policy.
- Prevent old status messages from overwriting newer state.
- Prevent old command events from reverting final command state.

---

## 28. Idempotency

### 28.1 Telemetry

The gateway shall use `messageId` and device identity to avoid duplicate storage.

Recommended uniqueness:

```text
(deviceId, messageId)
```

Sequence numbers may supplement but shall not replace message IDs because a sequence may reset after firmware changes or device reset unless explicitly designed otherwise.

### 28.2 Faucet Commands

The device shall persist or remember recently processed `commandId` values for a defined period.

On duplicate receipt, the device shall:

- Not execute the physical action again.
- Publish the latest known acknowledgement or final status.
- Use reason code `DUPLICATE_COMMAND` if appropriate.

The command-ID retention period is `TBD`.

---

## 29. Payload Validation

The gateway shall validate:

- Topic structure.
- Device identity.
- Schema version.
- Required fields.
- Data types.
- Message size.
- Timestamp syntax.
- Enum values.
- Numeric validity.
- Device-topic consistency.
- Command-device consistency.

The gateway shall reject:

- Unknown device identities.
- A device publishing to another device's topic.
- Unsupported schema versions.
- Invalid JSON.
- Oversized messages.
- `NaN` or infinite numeric values.
- Invalid coordinates.
- Invalid command states.
- Unknown command references.

Validation failures shall not silently overwrite valid stored data.

---

## 30. Message Size

Payloads shall remain compact.

The maximum application message size is `TBD`.

Recommended initial target:

```text
Less than 16 KB per message
```

Large binary files, firmware images, photographs, and logs shall not be transmitted through ordinary telemetry topics.

Firmware update design is outside this document.

---

## 31. Security Requirements

### 31.1 Transport Security

Production communication shall use TLS.

Plain MQTT on port `1883` may be used only in isolated local development environments.

Production shall not allow anonymous broker access.

### 31.2 Device Authentication

Each device shall have unique credentials.

Minimum acceptable approach:

```text
Unique client ID
Unique username
Unique strong password
```

Preferred production approach:

```text
Unique client certificate
Mutual TLS
Topic-level ACL
```

### 31.3 Topic Authorisation

Example permissions for `water-node-001`:

```text
ALLOW publish:
agriculture/production/site-01/water-node-001/telemetry/#
agriculture/production/site-01/water-node-001/status
agriculture/production/site-01/water-node-001/heartbeat
agriculture/production/site-01/water-node-001/ack/#
agriculture/production/site-01/water-node-001/event/#

ALLOW subscribe:
agriculture/production/site-01/water-node-001/command/#
agriculture/production/site-01/water-node-001/config

DENY:
all other topics
```

### 31.4 Secret Management

Device secrets shall not be:

- Committed to public source code.
- Shared by all devices.
- Displayed in the web frontend.
- Stored in browser local storage.
- Included in telemetry.
- Written to normal application logs.

### 31.5 Credential Revocation

The system shall support revoking one device credential without affecting all devices.

### 31.6 Replay Protection

Replay risk shall be reduced through:

- Unique command IDs.
- Command expiry.
- Device identity.
- TLS.
- Duplicate-command memory.
- Valid state transitions.
- Optional signed commands if required by threat assessment.

### 31.7 Web RBAC Boundary

Owner and Admin permissions are enforced by the web backend.

The MQTT broker shall authenticate devices and services, not human web roles.

A human user's control permission shall be checked before the gateway publishes a command.

---

## 32. Device Provisioning

A secure provisioning process shall create:

- Device registry record.
- Unique device ID.
- Site assignment.
- Capability list.
- Broker credentials or certificate.
- Topic ACL.
- Initial active/inactive state.

The first provisioning method is `TBD`.

Possible methods:

- Secure manufacturing provisioning.
- Technician setup portal.
- Serial provisioning tool.
- QR-assisted onboarding.
- Manual administrator process.

Admin users shall not provision devices unless explicitly allowed by `RBAC.md`.

---

## 33. Device Deactivation

When a device is deactivated:

- New telemetry may be rejected or quarantined.
- New faucet commands shall not be sent.
- Existing credentials should be revoked or disabled.
- Historical data shall remain available according to access policy.
- The action shall be audited.
- The frontend shall show `INACTIVE`.

The exact credential-revocation automation is `TBD`.

---

## 34. Schema Versioning

Every payload shall include:

```text
schemaVersion
```

Initial version:

```text
1.0
```

Rules:

- Backward-compatible additions may use a minor version.
- Breaking field changes require a new major version.
- The gateway shall support explicitly approved versions.
- Unsupported versions shall be rejected with an integration event.
- Topic versioning may be introduced only when payload versioning is insufficient.
- The web frontend shall consume normalised backend data rather than device-specific payload variants.

---

## 35. Gateway Normalisation

The IoT gateway shall normalise device messages into the application's canonical internal model.

Normalisation may include:

- Field-name mapping.
- Unit conversion only when explicitly approved.
- Canonical timestamp handling.
- Status mapping.
- Capability mapping.
- Validation metadata.

The gateway shall not perform undocumented calibration or infer scientific values.

Raw payload retention for troubleshooting is `TBD` and must consider storage, privacy, and security.

---

## 36. Live Web Updates

The gateway or web backend may provide live updates using:

- Server-Sent Events, recommended for one-way dashboard updates.
- WebSocket, when bidirectional session communication is required.
- Polling, as a fallback.

Live update channels shall:

- Require an authenticated web session.
- Apply RBAC and device-access filtering.
- Stop sending data after access revocation.
- Never expose MQTT credentials.
- Never expose other users' device data.

The live web transport shall be finalised in `ARCHITECTURE.md`.

---

## 37. Error and Reason Codes

Canonical integration error codes may include:

```text
INVALID_JSON
INVALID_SCHEMA
UNSUPPORTED_SCHEMA_VERSION
UNKNOWN_DEVICE
TOPIC_DEVICE_MISMATCH
INVALID_TIMESTAMP
INVALID_VALUE
MESSAGE_TOO_LARGE
DUPLICATE_MESSAGE
SEQUENCE_GAP
DEVICE_OFFLINE
BROKER_UNAVAILABLE
COMMAND_EXPIRED
COMMAND_REJECTED
COMMAND_TIMEOUT
COMMAND_STATE_CONFLICT
```

The web frontend shall translate these codes according to `I18N.md` (implemented via `next-intl` keys, `TASK-0603`).

Device payloads and logs shall retain canonical codes.

---

## 38. Observability and Logging

The gateway shall provide metrics and logs for:

- Connected devices.
- Disconnected devices.
- Messages received.
- Invalid messages.
- Duplicate messages.
- Telemetry ingestion latency.
- Broker reconnects.
- Commands published.
- Acknowledgements received.
- Command timeouts.
- Command failures.
- Unknown-device attempts.

Logs shall not contain:

- Device passwords.
- Private keys.
- Broker administrator credentials.
- Human passwords.
- Session tokens.
- Full sensitive payloads when not required.

Correlation identifiers shall include:

- `messageId`.
- `commandId`.
- `deviceId`.
- Gateway ingestion ID.

---

## 39. Data Persistence Expectations

The system shall persist:

- Valid telemetry.
- Device last-seen time.
- Device status changes.
- Faucet commands.
- Faucet acknowledgements.
- Faucet final events.
- Validation failures where operationally useful.
- Device credential status metadata, not raw secrets.
- Audit events.

The exact database schema shall be defined in `DATABASE.md`.

---

## 40. Broker Recommendation

### Development

Recommended:

```text
Eclipse Mosquitto
```

Suitable for:

- Local development.
- Hardware integration testing.
- Prototype deployment.
- Automated tests.

### Production Candidate

Recommended:

```text
EMQX
```

Suitable for:

- Multi-device management.
- Topic-level authorisation.
- Operational dashboard.
- TLS and certificate support.
- Future scaling.

The application shall remain broker-independent at the MQTT protocol and payload level.

The final broker selection is `TBD`.

---

## 41. Testing Requirements

### 41.1 Contract Tests

Test:

- Valid soil payload.
- Valid water payload.
- Missing required field.
- Invalid JSON.
- Unsupported schema.
- Invalid enum.
- Invalid coordinate.
- Null measurement.
- Duplicate message.
- Sequence gap.

### 41.2 Connectivity Tests

Test:

- Initial connection.
- Wi-Fi interruption.
- Broker interruption.
- Automatic reconnect.
- Last Will offline state.
- Online state after reconnect.
- Credential rejection.
- Revoked device.

### 41.3 Security Tests

Test:

- Device publishes to another device's topic.
- Device subscribes to another device's commands.
- Anonymous broker access.
- Expired certificate or password.
- Replayed faucet command.
- Retained faucet command.
- Browser attempts direct broker control.
- Unauthorised Admin attempts control.

### 41.4 Faucet Command Tests

Test:

- Phase 1 maps to `300 mL`.
- Phase 2 maps to `1,000 mL`.
- Phase 3 maps to `1,500 mL`.
- Invalid phase rejected.
- Duplicate command executed once.
- Expired command rejected.
- Offline device command rejected.
- Busy device rejection.
- Acknowledged command.
- Completed command.
- Failed command.
- Timeout.
- Late acknowledgement.
- Out-of-order event.
- Cancellation or stop, if supported.

### 41.5 Load and Reliability Tests

Test:

- Multiple devices publishing simultaneously.
- Sustained telemetry load.
- Gateway restart.
- Broker restart.
- Database delay.
- Live-web subscriber disconnect.
- Message backlog.
- Offline buffer upload.

---

## 42. Acceptance Criteria

This specification is satisfied when:

1. Every device has a unique identity.
2. Production device communication uses authenticated encrypted transport.
3. Topic ACLs isolate devices.
4. The browser has no device or broker credentials.
5. Multiple devices can publish without mixing data.
6. Soil telemetry supports all required soil fields.
7. Water telemetry supports all required water fields.
8. Missing values are not converted to zero.
9. Every message contains a schema version.
10. Every telemetry message has a unique message ID.
11. Device last-seen and connection state are tracked.
12. Last Will reports unexpected disconnection.
13. Faucet commands target one device.
14. Phase-to-volume mapping is enforced by the backend.
15. Faucet commands are not retained.
16. Every faucet command has a unique command ID.
17. Duplicate commands do not cause repeated execution.
18. Expired commands do not execute.
19. Device acknowledgement is linked to the command ID.
20. The UI does not claim completion before a final completion event.
21. Timeout is distinguishable from confirmed failure or completion.
22. Canonical payload fields and statuses remain untranslated.
23. Invalid payloads do not overwrite valid data.
24. Device access revocation prevents new web commands.
25. Logs exclude credentials and secrets.
26. Contract, connectivity, security, and control tests pass.

---

## 43. Open Decisions

1. Final adoption of MQTT.
2. MQTT 5.0 versus MQTT 3.1.1 fallback requirements.
3. Final broker selection.
4. Production certificate versus username/password authentication.
5. Site and environment topic structure.
6. Device capability source.
7. Exact telemetry interval.
8. Heartbeat interval.
9. Offline threshold.
10. Stale-data threshold.
11. Exact units for N, P, K, temperature, moisture, EC, TDS, battery, and tank volume (flow rate deleted per `DEC-MON-089`).
12. ~~Final meaning of `Water BAT`.~~ **RESOLVED** — `BAT` parameter is completely removed from soil and water quality monitoring domains (`DEC-MON-086`, superseding `DEC-MON-085`).
13. Device clock synchronisation.
14. Maximum message size.
15. Offline telemetry buffer size.
16. Delayed telemetry acceptance period.
17. Raw payload retention.
18. Command acknowledgement timeout.
19. Command completion timeout.
20. Retry policy.
21. Late acknowledgement reconciliation.
22. Concurrent faucet command policy.
23. Cancellation support.
24. Emergency-stop support.
25. Final hardware reason codes.
26. Actual-volume progress support.
27. Command-ID retention period on the device.
28. Configuration-message scope.
29. Device provisioning method.
30. Credential rotation and revocation process.
31. Live web update transport.
32. Whether retained latest telemetry is needed.
33. Whether one physical device sends both soil and water data or separate nodes are used.

---

## 44. Conflicts and Gaps Found

1. Wi-Fi/internet connectivity is confirmed, but the final application protocol has not been formally approved.
2. MQTT is the recommended protocol, but hardware-team support must be confirmed.
3. Multiple devices are required, but the site and device-assignment model remains unresolved.
4. The exact units for several measurements are not documented.
5. ~~`Water BAT` remains ambiguous.~~ **RESOLVED** — `BAT` parameter is completely removed from soil and water quality monitoring domains (`DEC-MON-086`, superseding `DEC-MON-085`).
6. Device online, offline, and stale thresholds are unresolved.
7. Faucet volumes are confirmed, but timeout, cancellation, concurrency, retry, and late-acknowledgement rules remain unresolved.
8. The user-role control matrix remains `TBD` in `RBAC.md`.
9. The hardware team must confirm whether progress and actual dispensed volume can be reported.
10. The existing frontend shall consume normalised backend data and must not be coupled directly to raw device payload variants.

---

## 45. Authentication Scope & Device Protocol Independence

`TASK-0214` (Mandatory Registration Email Verification & Approvals Integrity) operates exclusively within the user authentication, registration, Resend email dispatch, and Owner approval domains. `TASK-0214` does not modify ESP32, NodeMCU, REST telemetry ingestion, MQTT 5.0 over TLS, broker topic ACLs, or device-gateway communication contracts.

---

## Monitoring Reconciliation & Device Protocol Independence (Reconciled 2026-08-19)

The monitoring UUID and history regression fix (`TASK-0306`, `TASK-0501`, `TASK-0503`, `TASK-0504`) operates strictly within application API routing, frontend state hooks, and database telemetry repository lookups.
- **Zero Device Protocol Impact:** No changes were made to ESP32/NodeMCU firmware contracts, REST telemetry ingestion (`/api/v1/devices/{deviceId}/telemetry/*`), MQTT 5.0 over TLS contracts, topic structures, broker ACLs, or gateway message parsers.
- **Frontend Device Selection:** Frontend state and page hooks consistently consume immutable database primary key `devices.id` UUIDs.
- **Dual Identifier Ingestion & Lookup:** The application layer seamlessly resolves immutable UUIDs and canonical `deviceId` strings across monitoring queries without requiring physical hardware reconfiguration.
< ! - -   T A S K - 0 8 0 2   R e c o n c i l e d :   2 0 2 6 - 0 8 - 1 9   - - >  
 
---

## Gateway Command Publishing Implementation Note (Reconciled 2026-08-20; Stale SENT Timeout Reconciled 2026-09-23)

The following facts are supported by the verified implementation of `TASK-0804` (`CommandPublisher` in `@kebun-melon/iot-gateway`):
- **Topic Routing & QoS:** Commands are published to canonical topics `agriculture/{environment}/{siteId}/{deviceId}/command/faucet` or direct hardware topics `irigasi/melon/kontrol/valve` (per `DEC-DEV-032`) with QoS 1 and `retain=false`.
- **Target Device Scope:** Command publishing is restricted to verified `WATER_TANK_NODE` devices with `accountStatus = ACTIVE` and valid non-empty `siteId`.
- **Payload Schema Conformance:**
  - `DISPENSE`: Transmits `schemaVersion: '1.0'`, `commandId`, `deviceId`, `siteId`, `action: 'DISPENSE'`, valid `phase`, `plantCount >= 1`, persisted integer `targetVolumeMl` (no publisher-side recalculation), `requestedAt`, and `expiresAt`.
  - `OPEN` / `CLOSE`: Transmits clean manual action payload omitting `phase`, `plantCount`, and `targetVolumeMl` (or `"ON"` / `"OFF"` strings on direct hardware topics).
- **State Progression & Stale SENT Timeout Sweep (`DEC-CTRL-094`):**
  - Atomically transitions database status from `QUEUED` to `SENT` only after broker confirms publication. Expired commands are marked `EXPIRED` without transmission. Disconnected/failed broker states keep commands `QUEUED` with zero false `SENT` marks.
  - Active `SENT` commands whose `expiresAt` has passed without receiving an ACK are automatically swept by `sweepStaleSentCommands()` every 2,000ms to terminal state `TIMEOUT` (`COMMAND_EXPIRED_TIMEOUT`), safely releasing the device concurrency lock (`faucet_commands_one_active_per_device`) and emitting realtime SSE updates.
<!-- TASK-0804 Reconciled: 2026-09-23 -->

---

## Device Acknowledgement Processing Protocol Implementation Note (Reconciled 2026-08-20)

The following facts are supported by the verified device communication implementation of `TASK-0805` (`AcknowledgementProcessor` in `@kebun-melon/iot-gateway`):
- **Canonical Topic Routing & QoS:** Subscribes to `agriculture/{environment}/{siteId}/{deviceId}/ack/faucet` with QoS 1.
- **Payload Schema Conformance:** Validates payloads against `FaucetAcknowledgementPayloadSchema`: `schemaVersion: '1.0'`, `messageId`, `commandId`, `deviceId`, optional `recordedAt`, and `data: { status: 'ACKNOWLEDGED' | 'REJECTED', accepted: boolean, reasonCode?: string }`.
- **Command Action Resolution:** Identifies target commands strictly via `commandId` and `deviceId` without embedding or requiring an action field in the MQTT ACK payload. Verifies stored action is one of `DISPENSE`, `OPEN`, or `CLOSE`.
- **Device & Topic Isolation:** Enforces `WATER_TANK_NODE` device type scoping, ensuring topic `deviceId` matches payload `deviceId` and resolved internal device UUID.
- **State Progression & Failure Handling:** Accepted ACKs transition `SENT` → `ACKNOWLEDGED` (never `COMPLETED`). Rejected ACKs transition `SENT` → `FAILED` with canonical reason codes (`DEVICE_BUSY`, `UNSUPPORTED_ACTION`, `DEVICE_NOT_READY`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`) and generate failure alerts.
- **Idempotency & Late Event Safety:** Duplicate `messageId` occurrences are handled idempotently; late, non-`SENT`, or out-of-order ACKs are ignored without state regression.
<!-- TASK-0805 Reconciled: 2026-08-20 -->

---

## Device Execution Event State Machine Protocol Implementation Note (Reconciled 2026-08-20)

The following facts are supported by the verified device communication implementation of `TASK-0806` (`FaucetEventProcessor` in `@kebun-melon/iot-gateway`):
- **Canonical Topic Routing & QoS:** Subscribes to `agriculture/{environment}/{siteId}/{deviceId}/event/faucet` with QoS 1.
- **Payload Schema Conformance:** Validates payloads against `FaucetEventPayloadSchema`: `schemaVersion: '1.0'`, `messageId`, `commandId`, `deviceId`, optional `recordedAt`, and `data: { status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED', targetVolumeMl?: number, actualVolumeMl?: number, reasonCode?: string }`.
- **Command Action & Device Isolation:** Identifies target commands strictly via `commandId` and `deviceId` without requiring an action field in the payload. Validates the persisted action against `[DISPENSE, OPEN, CLOSE]` and enforces `WATER_TANK_NODE` device type scoping and topic `siteId` matching.
- **Authoritative Physical Faucet State Mapping:**
  - `COMPLETED OPEN` → `OPEN`
  - `COMPLETED CLOSE` → `CLOSED`
  - `COMPLETED DISPENSE` → `UNKNOWN` (valve closure is never assumed without direct physical confirmation)
  - `FAILED` / `IN_PROGRESS` / timeout / uncertain → `UNKNOWN`
  - Physical state is NEVER inferred from API creation, MQTT publication, or command ACKs.
- **Volume Handling Rules:** `DISPENSE` validates target volume parity if provided and tracks non-negative `actualVolumeMl`. `OPEN` and `CLOSE` treat volume measurement as non-applicable and store `null`/`undefined` on the command record.
- **Lifecycle Progression & Guarding:** Enforces `ACKNOWLEDGED` → `IN_PROGRESS` → `COMPLETED` and `ACKNOWLEDGED`/`IN_PROGRESS` → `FAILED`. Terminal states (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `EXPIRED`) are immutable and ignore late events. Duplicate `messageId` occurrences are handled idempotently without redundant writes.
- **Alert Dispatching:** Dispatches `CommandFailureAlert` for `FAILED` execution events linking device, command, and `physicalOutcome: 'UNKNOWN'`.
<!-- TASK-0806 Reconciled: 2026-08-20 -->

---

## 46. Centralized Authentication State Hydration & Device Protocol Independence

`TASK-0215` (Centralized Authentication State Hydration) operates exclusively within the Next.js frontend presentation layer and server-side layout session hydration. It does not modify ESP32, NodeMCU, REST telemetry ingestion, MQTT 5.0 over TLS, broker topic ACLs, or device-gateway communication contracts. Device selection and telemetry streams remain completely decoupled from root authentication hydration.
<!-- TASK-0215 Reconciled: 2026-08-22 -->

---

## 47. Controls Loading Experience & Header Centering Device Protocol Independence

The verified implementation of `TASK-0807`, `TASK-0502`, and `TASK-0306` (`/controls` Loading & Header Layout Stabilization on 2026-08-27) operates strictly within the Next.js App Router presentation layer, component skeleton rendering, and CSS Grid layout.
- **Zero Protocol Impact:** No modifications were made to ESP32/NodeMCU firmware contracts, REST telemetry ingestion (`/api/v1/devices/{deviceId}/telemetry/*`), MQTT 5.0 over TLS topics, QoS levels, broker ACLs, or device-gateway payload schemas.
- **Authoritative Physical Faucet State Invariant:** The presentation layer continues to strictly consume the authoritative physical state machine (`OPEN`, `CLOSED`, `UNKNOWN`) derived from verified device execution events (`TASK-0806`), with zero fabricated state or assumed valve positions during loading.
<!-- Controls Loading & Header Centering Device Communication Reconciled: 2026-08-27 -->

---

## 48. Account Sessions & Profile Security Device Protocol Independence (Reconciled 2026-08-29)

> **Task Reference:** `TASK-0216` (Verified Self-Email Change), `TASK-0217` (Single Active Session Enforcement & Profile Security UI)
> **Governing Decisions:** `DEC-AUTH-106`, `DEC-AUTH-107`, `DEC-UIUX-102`

The approved authentication, single-session concurrency, and profile security specifications operate strictly within the human user identity and browser session boundary:
- **Zero Device Protocol & MQTT Impact:** No modifications are introduced to ESP32/NodeMCU firmware contracts, Wi-Fi REST telemetry ingestion, MQTT 5.0 over TLS protocols, QoS levels, broker topic ACLs, or device payload schemas.
- **Strict Domain Separation (IoT Nodes vs. User Browser Sessions):** The removal of the misleading "Linked Devices" card from `/profile` (`DEC-UIUX-102`) eliminates conceptual ambiguity between user client browser sessions and agricultural IoT hardware devices (`SOIL_NODE`, `WATER_QUALITY_NODE`, `WATER_TANK_NODE`).
- **Device Authorization Invariance:** Single active session enforcement on user accounts (`DEC-AUTH-107`) and verified email updates (`DEC-AUTH-106`) do not alter device RBAC access scopes (`user_device_access`), telemetry stream subscription boundaries, or physical faucet actuator safety controls.
<!-- Account Sessions vs IoT Devices Reconciled: 2026-08-29 -->

---

## 49. Faucet Execution Event QoS & Simulator Protocol Alignment (Reconciled 2026-09-01)

The following communication contracts are reinforced and verified for faucet command event processing (`TASK-0806`, `TASK-0408`):
- **Canonical Topic Routing & QoS 1 Parity:** Execution events published to `agriculture/{environment}/{siteId}/{deviceId}/event/faucet` require QoS 1 for all statuses (`IN_PROGRESS`, `COMPLETED`, `FAILED`). The device simulator (`scripts/device-simulator.ts`) is aligned to publish `IN_PROGRESS` with QoS 1, eliminating transport-level delivery discrepancy.
- **Physical Actuation Timing & Lifecycle Simulation:** Hardware simulations introduce realistic asynchronous actuation delays (e.g., 300ms post-ACK, 500ms post-progress) to accurately model physical valve movement and liquid flow, preventing packet bursts and network interleaving.
- **Append-Only Progress Event Delivery:** Devices may emit periodic intermediate `IN_PROGRESS` telemetry events during active execution. The gateway event processor appends these milestone events without regressing state, and enforces terminal state immutability once `COMPLETED` or `FAILED` is reached.
<!-- Faucet Execution Event QoS Reconciled: 2026-09-01 -->



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

## 50. Operational Overview Dashboard & Fleet Aggregation Note (TASK-0506 / Reconciled 2026-09-02)

The operational dashboard (`/` and `/dashboard`) maintains complete separation from IoT device communication boundaries:
- **Presentation-Layer Fleet Aggregation:** Node connection counts (`Total`, `Online`, `Offline/Stale`) are aggregated in-memory from `DeviceContext` (`GET /api/v1/devices`), eliminating duplicate SSE subscriptions or MQTT stream overhead on the overview homepage.
- **Dedicated Telemetry Routes:** Live telemetry streaming and historical charts remain strictly encapsulated in dedicated domain pages (`/sensor`, `/soil`, `/water`, `/controls`).
- **Zero Firmware or Broker Impact:** `TASK-0506` introduced zero modifications to ESP32/NodeMCU firmware contracts, REST ingestion endpoints, MQTT 5.0 TLS topics, QoS policies, or gateway schemas.
<!-- TASK-0506 Device Communication Reconciled: 2026-09-02 -->

---

## 51. Authentication Performance & Session Recovery Device Protocol Independence (DEC-AUTH-108 / Reconciled 2026-09-05)

The login transaction performance optimization, same-client session recovery, and `AuthContext` SSR hydration stabilization (`DEC-AUTH-108`) operate strictly within the human user identity and browser session boundary:
- **Zero IoT Firmware & Protocol Impact:** No modifications are introduced to ESP32/NodeMCU firmware contracts, REST telemetry ingestion routes (`/api/v1/devices/{deviceId}/telemetry/*`), MQTT 5.0 over TLS brokers, topic trees (`agriculture/{environment}/{siteId}/...`), QoS policies, or gateway schemas.
- **Strict Boundary Decoupling:** Human user browser sessions (`session_token`) and session transaction optimizations are completely isolated from machine-to-machine authentication (`INTERNAL_SERVICE_TOKEN`) and hardware device authentication.
- **Actuator Safety Invariant:** Enhancing user session performance and database round-trip efficiency does not alter physical valve state mapping (`OPEN`, `CLOSED`, `UNKNOWN`), command idempotency, or safety gates governing faucet operations.
<!-- Authentication Performance & Session Recovery Device Protocol Independence Reconciled: 2026-09-05 -->

---

## 52. Database Regional Colocation, Internal Token Rotation & Telemetry Ingestion Verification (TASK-0916 / Reconciled 2026-09-08)

The Singapore Dev and Staging database cutovers (`TASK-0916`) reinforce backend messaging integrity and regional infrastructure colocation:
- **Regional Colocation with EMQX Cloud:** Co-locating database persistence in AWS Singapore (`ap-southeast-1`) with the EMQX Cloud MQTT broker (`asia-southeast1`) reduces WAN round-trip latency for IoT Gateway persistence operations from ~240ms down to sub-50ms within the region.
- **Machine-to-Machine Token Isolation:** `INTERNAL_SERVICE_TOKEN` is securely configured across environments (32-byte CSPRNG on Dev; independent 48-byte token on Staging). Verified machine-to-machine authentication: Gateway probe `/internal/v1/ready` rejects unauthorized calls (HTTP 401) and validates with the active token (HTTP 200); Web internal publish webhook (`POST /api/v1/internal/realtime/publish`) verifies Bearer authentication (HTTP 200).
- **REST Telemetry Ingestion & Atomicity:**
  - **Dev:** Verified real ingestion via `POST /api/v1/devices/soil-node-jvbkdbv/telemetry/soil` with 3 synthetic writes (`soil_readings` count 0 $\rightarrow$ 3), atomically updating device `last_seen_at` and `last_message_at` timestamps.
  - **Staging:** Verified real ingestion via `POST /api/v1/devices/soil-node-biuc2f/telemetry/soil` (`soil_readings` count 0 $\rightarrow$ 3: cutover `676f7aca`, pre-fix diagnostic `965f54cf`, and coordinated live `d319dd56-821c-47b8-a56e-4012cd26f4f4` at `2026-09-08 16:06:10.106 UTC`), atomically updating device `soil-node-biuc2f` timestamps in `public.devices`.
- **Real-Time Subscriber SSE Verification:** Realtime event dispatch via internal webhook was verified on both environments (HTTP 200). Remediated in-route event publishing in telemetry endpoints and bound event-hub globally. On Dev, subscriber client receipt was verified with stream closed cleanly; on Staging, live authenticated browser EventSource receipt was confirmed correlating 100% with reading `d319dd56-821c-47b8-a56e-4012cd26f4f4` (`cutover-staging-telemetry-1788883569374`, Gate 5 PASS). Technical cutover is complete (`DONE`).
- **Protocol & Actuator Invariance:** Zero changes to ESP32/NodeMCU firmware contracts, MQTT 5.0 TLS topics, QoS policies, or gateway schemas. `ENABLE_FAUCET_CONTROL=false` strictly enforced across all services; `public.faucet_commands` remains strictly 0. Full details in [`docs/SUPABASE_MIGRATION_RUNBOOK.md`](file:///c:/Users/Puroh/Documents/Melon/docs/SUPABASE_MIGRATION_RUNBOOK.md).
<!-- TASK-0916 Device Communication Reconciled: 2026-09-08 -->

---

## 53. Outbound AI Recommendation MQTT Publishing Pipeline (TASK-0413 / DEC-MON-090 / Reconciled 2026-09-18)

This section defines the outbound MQTT recommendation publishing pipeline for dispatching verified ML agronomic guidance to field microcontrollers:

### 1. Topic Structure & MQTT QoS
- **Soil AI Recommendation Topic:** `melon/ai-tanah/rekomendasi-2424600050`
- **Water Quality AI Recommendation Topic:** `melon/ai-air/rekomendasi-2424600050`
- **Broker Scheme:** Unified EMQX Broker via TLS (Port 8883 / Port 8084 WSS).
- **Quality of Service (QoS):** QoS 1 (At least once delivery).
- **Retain Flag:** `false` (Prevents stale recommendations from being delivered to newly connected microcontrollers).

### 2. Ingestion Trigger & Debounce Flow
1. Field ESP32 nodes publish raw telemetry to `melon/sensor-tanah/data-2424600050` or `melon/sensor-air/data-2424600050`.
2. `SoilWaterMqttAdapter` in `apps/iot-gateway` ingests and persists raw readings to `soil_readings` or `water_readings` non-blockingly.
3. An asynchronous background task schedules an external prediction query with a configurable debounce delay (`EXTERNAL_ML_DEBOUNCE_MS`, default 1500ms pending confirmed pipeline latency).
4. Device resolution queries Melon's `device_external_mappings` via `DeviceRepository.getActiveExternalDeviceId` (fail-closed in production if no active mapping exists).
5. The worker queries `ExternalPredictionClient` with `{ forceRefresh: true }` and timeout `EXTERNAL_ML_TIMEOUT_MS`.
6. Stale predictions (older than `EXTERNAL_ML_MAX_STALENESS_SECONDS`, default 300s) and duplicate predictions (`lastPublishedPredictionId`) are suppressed.
7. The resulting prediction is packaged via `buildOutboundRecommendationPayload` (masking external identifiers to canonical Melon `deviceId`) and dispatched with QoS 1 and `retain: false`.

### 3. Hybrid Wire Payload Contract
```json
{
  "messageId": "rec-soil-37c2718e-4a67-4f6c-b34e-00a295847e3a",
  "predictionId": "37c2718e-4a67-4f6c-b34e-00a295847e3a",
  "clientId": "melon-esp32-tanah1",
  "deviceId": "soil-node-jvbkdbv",
  "timestamp": "2026-09-18T00:33:06.431288+00:00",
  "domain": "SOIL",
  "status": "NORMAL",
  "predictedClass": "optimal",
  "confidence": 0.905,
  "actions": {
    "module": "soil",
    "classification": "optimal",
    "summary": "Kondisi tanah baik. Pertahankan pola perawatan.",
    "issues": [],
    "farmer_action": []
  },
  "farmerAction": [
    "Pertahankan jadwal penyiraman dan pemupukan saat ini.",
    "Lakukan pemantauan rutin parameter tanah setiap hari."
  ],
  "issues": [],
  "summary": "Kondisi tanah baik. Pertahankan pola perawatan.",
  "modelVersion": "v1.0.0"
}
```

#### Water Quality Example (Diagnostic Issues & Actions)
```json
{
  "messageId": "rec-water-5ae55235-98ea-46b5-926f-45a9096ae5c4",
  "predictionId": "5ae55235-98ea-46b5-926f-45a9096ae5c4",
  "clientId": "melon-esp32-air1",
  "deviceId": "water-quality-node-quiua",
  "timestamp": "2026-09-18T01:43:44.798075+00:00",
  "domain": "WATER",
  "status": "CRITICAL",
  "predictedClass": "kritis",
  "confidence": 0.895,
  "actions": {
    "module": "water",
    "classification": "kritis",
    "summary": "Ditemukan 2 masalah kualitas air.",
    "issues": [
      {
        "parameter": "EC air",
        "value": 5.8,
        "problem": "Kandungan garam/nutrisi terlalu tinggi",
        "impact": "Dapat menyebabkan tanaman stres"
      },
      {
        "parameter": "TDS air",
        "value": 4900,
        "problem": "Zat terlarut terlalu tinggi",
        "impact": "Risiko akar sulit menyerap air"
      }
    ],
    "farmer_action": [
      "Kurangi konsentrasi pupuk nutrisi",
      "Tambahkan air bersih untuk pengenceran"
    ]
  },
  "farmerAction": [
    "Kurangi konsentrasi pupuk nutrisi",
    "Tambahkan air bersih untuk pengenceran"
  ],
  "issues": [
    {
      "parameter": "EC air",
      "value": 5.8,
      "problem": "Kandungan garam/nutrisi terlalu tinggi",
      "impact": "Dapat menyebabkan tanaman stres"
    },
    {
      "parameter": "TDS air",
      "value": 4900,
      "problem": "Zat terlarut terlalu tinggi",
      "impact": "Risiko akar sulit menyerap air"
    }
  ],
  "summary": "Ditemukan 2 masalah kualitas air.",
  "modelVersion": "v1.0.0"
}
```

### 4. Actuator Safety Invariant
- Outbound AI recommendations are **strictly informational and advisory**.
- Under `ENABLE_FAUCET_CONTROL=false`, receiving an alert or critical classification shall **never** trigger automatic faucet actuation, valve opening/closing, or dispensing commands (`DEC-CTRL-051`, `DEC-CTRL-067`).

### 5. Multi-Channel Dissemination & Dashboard Presentation (TASK-0413 Phase D / Reconciled 2026-09-19)
Agronomic recommendations produced by the external ML pipeline are disseminated concurrently across two complementary channels:
1. **Field Hardware Channel (MQTT):** Outbound payloads published to `melon/ai-tanah/rekomendasi-*` and `melon/ai-air/rekomendasi-*` over EMQX with **QoS 1** and **`retain: false`** for local microcontroller display/receipt.
2. **Operator Dashboard Channel (Web UI):** Consumed via `GET /api/v1/devices/[deviceId]/predictions/latest` by the `useLatestPrediction` hook and rendered on `/soil` and `/water` using `RecommendationCard`.
   - **Visual States:** Loading skeleton (`aria-busy="true"`), Empty (`Belum Ada Rekomendasi`), Populated (with classification pill badges and action checklists), and Stale/Offline notice banner.
   - **Safety Guard:** Both channels strictly obey `DEC-MON-090` / `DEC-CTRL-051` (`ENABLE_FAUCET_CONTROL=false`). Recommendations are purely advisory and cannot trigger automatic pump, valve, or dispensing operations.

### 6. Audited ML Classification Thresholds & Agronomic Standards Matrix (TASK-0413 / Reconciled 2026-09-19)

Field telemetry published to MQTT topics (`melon/sensor-tanah/data-*` and `melon/sensor-air/data-*`) is analyzed against the following two-sided agronomic standards authored by the SmartTani ML team (`agronomic_standards_v1.json` / `BaseRuleClassifier.php`):

#### A. Soil Monitoring Standards

| Parameter | Telemetry Key | Unit | Critical Low | Warning Low | Optimal (Good) | Warning High | Critical High | Important Parameter |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **pH** | `ph` | pH | $\le 5.49$ | $5.50 - 5.99$ | **$6.00 - 6.80$** | $6.81 - 7.50$ | $> 7.50$ | **Yes** |
| **Moisture** | `moisture` | % | $< 45.0$ | $45.0 - 59.99$ | **$60.0 - 80.0$** | $80.01 - 90.0$ | $> 90.0$ | **Yes** |
| **Temperature** | `temperature` | °C | $< 20.0$ | $20.0 - 23.99$ | **$24.0 - 32.0$** | $32.01 - 38.0$ | $> 38.0$ | No |
| **EC** | `ec` | µS/cm | — | $< 800$ | **$800 - 2500$** | $2500.01 - 5000$ | $> 5000$ | **Yes** |
| **Nitrogen** | `nitrogen` | mg/kg | $< 25.0$ | $25.0 - 44.99$ | **$45.0 - 80.0$** | $80.01 - 120.0$ | $> 120.0$ | No |
| **Phosphorus** | `phosphorus` | mg/kg | $< 25.0$ | $25.0 - 44.99$ | **$45.0 - 80.0$** | $80.01 - 120.0$ | $> 120.0$ | No |
| **Potassium** | `potassium` | mg/kg | $< 35.0$ | $35.0 - 59.99$ | **$60.0 - 160.0$** | $160.01 - 250.0$ | $> 250.0$ | No |

#### B. Water Quality Monitoring Standards

| Parameter | Telemetry Key | Unit | Critical Low | Warning Low | Optimal (Good) | Warning High | Critical High | Important Parameter |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **pH** | `ph` | pH | $< 5.00$ | $5.00 - 5.49$ | **$5.50 - 6.50$** | $6.51 - 7.00$ | $> 7.00$ | **Yes** |
| **EC** | `ec` | µS/cm | — | — | **$0 - 500$** | $500.01 - 1500$ | $> 1500$ | **Yes** |
| **TDS** | `tds` | ppm | — | — | **$0 - 500$** | $500.01 - 1000$ | $> 1000$ | No |

#### C. Outbound Recommendation Triggers
- **Critical Trigger (`kritis`):** Any critical excursion on an important parameter (`ph`, `ec`, `moisture` for soil; `ph`, `ec` for water) forces overall status to `kritis`. Outbound MQTT recommendation publishes emergency mitigation steps (e.g. diluting nutrient solution, adjusting pH).
- **Warning Trigger (`waspada` / `warning`):** Parameter excursions into warning bands or total weighted risk $> 30$. Outbound MQTT recommendation publishes corrective monitoring advisories.
- **Optimal Trigger (`baik` / `optimal`):** All parameters within optimal bounds. Outbound MQTT recommendation confirms good conditions.

---

### 7. Dual MQTT Broker Architecture, EC Standardization & Hardware Verification Status (TASK-0414)

#### 7.1 Dual Broker Topology & Parameter Matrix

The platform implements a lightweight dual-broker MQTT architecture in `apps/iot-gateway` to accommodate hardware vendor topology without global broker replacements:

| Feature / Scope | Primary Broker (EMQX Cloud) | Secondary Broker (HiveMQ Cloud) |
|---|---|---|
| **Domain Responsibility** | Water Tank Node (`WATER_TANK_NODE`) & Faucet Control | Soil Node (`SOIL_NODE`) & Water Quality Node (`WATER_QUALITY_NODE`) |
| **Broker URL** | `wss://<cluster-host>:8084/mqtt` / TLS 8883 | `mqtts://217c0d73f9b648c09a5741c80dbb80df.s1.eu.hivemq.cloud:8883` |
| **Port & Encryption** | 8084 (WSS) / 8883 (TLS) | 8883 (TLS 1.2+ with SNI mandatory) |
| **Gateway Client ID** | `gateway-kebun-melon-dev-local-01` | `melon-gateway-soil-water` |
| **Hardware Client IDs** | `water-tank-node-zi37gz` | Soil: `melon-esp32-tanah1`<br>Water: `melon-esp32-air1` |
| **Inbound Telemetry** | `irigasi/melon/sensor/volume` | Soil: `melon/sensor-tanah/data-2424600050`<br>Water: `melon/sensor-air/data-2424600050` |
| **Outbound Topics** | `irigasi/melon/kontrol/valve`<br>`irigasi/melon/setting/otomasi` | Soil AI: `melon/ai-tanah/rekomendasi-2424600050`<br>Water AI: `melon/ai-air/rekomendasi-2424600050` |
| **Gateway Health Probe** | `/ready` -> `emqx.connected: true` | `/ready` -> `hivemq.connected: true` |

#### 7.2 Canonical EC Unit Standardization (`DEC-MON-091`)

Electrical Conductivity (EC) across the entire platform is standardized directly in **`µS/cm`**:
- **Database & Prisma:** Persisted directly as `µS/cm` in `soil_readings.ec` and `water_readings.ec`.
- **API Contracts:** Serialized directly as `µS/cm` without multiplier conversions.
- **Frontend Presentation:** Visualized directly as `µS/cm` in `MonitoringDashboard.tsx`, `useHistoricalMonitoring.ts`, `NPKChart`, and `WaterNutrientChart`. Legacy `mS/cm` assumptions and UI `×1000` multiplier hacks are completely eliminated.
- **Simulator & ML Classification:** Simulator emits `µS/cm` values; SmartTani classification rules evaluate `µS/cm` thresholds natively (Soil optimal: 800–2500 µS/cm; Water optimal: 0–500 µS/cm).

#### 7.3 Verification Results (Software Pipeline)

1. **HiveMQ Connection:** Verified active connection over TLS port 8883 using Node.js TLS stack.
2. **EMQX Connection:** Preserved existing EMQX client connection for Water Tank and Faucet Control.
3. **Gateway Probes:** `/health` and `/ready` report both brokers connected and healthy simultaneously.
4. **Dynamic Device Resolution:**
   - Inbound `melon-esp32-tanah1` resolves dynamically to `soil-node-jvbkdbv` (`SOIL_NODE`, `ACTIVE`).
   - Inbound `melon-esp32-air1` resolves dynamically to `water-quality-node-quiua` (`WATER_QUALITY_NODE`, `ACTIVE`).
5. **Synthetic Telemetry Ingestion:** Injected synthetic MQTT test packets on both topics; verified persistence into PostgreSQL `soil_readings` and `water_readings`, connection status set to `ONLINE`, and test fixtures safely purged.
6. **Environment Safety:** Staging environment and staging database remained 100% untouched.

#### 7.4 Physical ESP32 Hardware Status (Pending Firmware Inspection)

- **Status:** **`PENDING_HARDWARE_FIRMWARE_LOGS`**
- **Observed State:** While the software pipeline, gateway subscriptions, database mapping, and UI display are operational, real telemetry from the physical ESP32 devices has **not** been observed on the HiveMQ Cloud broker.
- **Available Hardware Context:** The hardware team provided MQTT parameters only (broker hostname, port 8883, credentials, client IDs, topics). Firmware source code (`.ino` / `.cpp`) and serial runtime logs were not provided.
- **Required Firmware Audit Items for Hardware Team:**
  1. **Transport Layer:** Must use `WiFiClientSecure` with `espClient.setInsecure()` (or ISRG Root X1 CA). Plaintext `WiFiClient` fails on HiveMQ port 8883 with `rc = -2`.
  2. **Hostname Format:** Bare string `"217c0d73f9b648c09a5741c80dbb80df.s1.eu.hivemq.cloud"` in `client.setServer()`. Prefixing `mqtts://` causes DNS resolution failure.
  3. **Buffer Limit:** Default `PubSubClient` buffer is 128 bytes. Telemetry JSON payloads exceed 140 bytes; calling `client.setBufferSize(512)` in `setup()` is mandatory to prevent silent publish drops.
  4. **Payload Mapping:** Published JSON must include top-level `"clientId": "melon-esp32-tanah1"` or `"melon-esp32-air1"`.
  5. **Serial Monitor Logging:** Capture ESP32 serial output at 115200 baud showing `client.state()` on failure and `client.publish()` return boolean.

<!-- Dual MQTT Broker Architecture Reconciled: 2026-09-19 -->


