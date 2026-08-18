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

The architecture provides two distinct ingress paths based on monitoring domain:

### Path A — REST API over Wi-Fi (Soil & Water Quality Telemetry)

```text
Soil and Water Monitoring Equipment
    │
    │ HTTPS / REST API over Wi-Fi
    ▼
Backend Ingestion Boundary (Web Backend)
    │
    ├── Validate payload schema & device authentication
    ├── Persist telemetry to PostgreSQL database
    └── Stream live updates to authenticated web frontend
```

### Path B — MQTT through EMQX Broker (Water Tank Monitoring & Faucet Control)

```text
Water Tank Monitoring & Control Equipment
    │
    │ MQTT 5.0 over TLS
    ▼
EMQX MQTT Broker
    │
    ▼
IoT Gateway / Integration Service
    │
    ├── Validate message schema & topic permissions
    ├── Persist water tank telemetry to PostgreSQL database
    ├── Publish faucet control commands & process acknowledgements
    └── Send live updates to the web backend
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
- Support encrypted connections in production.
- Enforce topic-level publish and subscribe permissions.
- Reject anonymous production access.
- Support device Last Will and Testament.
- Expose operational metrics and logs.
- Permit revocation of a single device without affecting other devices.

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
- Internal database primary key UUID is immutable across all relational tables.
- A device shall not publish as another device.
- Device credentials shall be bound to the permitted `deviceId`.
- Topic authorisation shall prevent cross-device access.
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
FLOW_MONITORING
FAUCET_CONTROL
BATTERY_MONITORING
```

Example:

```json
{
  "deviceId": "water-node-001",
  "capabilities": [
    "WATER_TELEMETRY",
    "LOCATION",
    "TANK_MONITORING",
    "FLOW_MONITORING",
    "FAUCET_CONTROL",
    "BATTERY_MONITORING"
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
| `WATER_TANK_NODE` | `TANK_MONITORING` / `FLOW_MONITORING` | MQTT 5.0 over TLS | EMQX Broker → IoT Gateway Service |
| `WATER_TANK_NODE` | `FAUCET_CONTROL` | MQTT 5.0 over TLS | EMQX Broker ← IoT Gateway Service |

Rules:
- Devices sending general soil and water quality telemetry use **REST API over Wi-Fi**.
- Devices with `TANK_MONITORING`, `FLOW_MONITORING`, or `FAUCET_CONTROL` capabilities connect via **MQTT 5.0 over TLS** to the **EMQX Broker**.
- The existing `DeviceType` enum values (`SOIL_NODE`, `WATER_QUALITY_NODE`, `WATER_TANK_NODE`) are sufficient and unambiguous when evaluated together with registered device capabilities. No schema enum modification is required.

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
    "ec": 1.42,
    "status": "NORMAL"
  }
}
```

### 13.1 Soil Fields

| Field | Type | Required | Unit |
|---|---|---:|---|
| `nitrogen` | Number or null | Yes when capability exists | `TBD` |
| `phosphorus` | Number or null | Yes when capability exists | `TBD` |
| `potassium` | Number or null | Yes when capability exists | `TBD` |
| `temperature` | Number or null | Yes when capability exists | `TBD` |
| `moisture` | Number or null | Yes when capability exists | `TBD` |
| `ph` | Number or null | Yes when capability exists | Unitless |
| `ec` | Number or null | Yes when capability exists | `mS/cm` (UI display converts to `µS/cm`) |
| `status` | Canonical enum | Recommended | Defined by external status rules |

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
    "ec": 0.84,
    "status": "NORMAL"
  }
}
```

### 14.1 Reservoir-Water Telemetry Payload (Proposed Domain)

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
    "flowRate": 2.3,
    "status": "NORMAL"
  }
}
```

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

## 18. Faucet Command Contract

Topic:

```text
agriculture/{environment}/{siteId}/{deviceId}/command/faucet
```

The server shall map phase to volume.

Approved presets:

| Phase | Target volume |
|---|---:|
| `1` | `300 mL` |
| `2` | `1,000 mL` |
| `3` | `1,500 mL` |

Recommended command payload:

```json
{
  "schemaVersion": "1.0",
  "commandId": "cmd-01JXYZ123",
  "deviceId": "water-node-001",
  "siteId": "site-01",
  "action": "DISPENSE",
  "phase": 2,
  "targetVolumeMl": 1000,
  "requestedAt": "2026-07-27T13:45:00+07:00",
  "expiresAt": "2026-07-27T13:45:30+07:00"
}
```

### 18.1 Required Command Fields

| Field | Type | Required | Description |
|---|---|---:|---|
| `schemaVersion` | String | Yes | Contract version |
| `commandId` | String | Yes | Globally unique command identifier |
| `deviceId` | String | Yes | Target device |
| `siteId` | String | Recommended | Target site |
| `action` | Enum | Yes | `DISPENSE` |
| `phase` | Integer | Yes | `1`, `2`, or `3` |
| `targetVolumeMl` | Integer | Yes | Server-mapped volume |
| `requestedAt` | ISO 8601 | Yes | Backend request time |
| `expiresAt` | ISO 8601 | Yes | Latest acceptable start time |

### 18.2 Command Rules

- The browser shall not choose an arbitrary volume.
- The backend shall map the phase to the target volume.
- The command shall target exactly one device.
- The command shall not be retained.
- The command shall expire.
- The device shall reject unsupported phases.
- The device shall reject an expired command.
- The device shall not execute the same `commandId` twice.
- User identity and role shall be stored in the backend audit record and need not be exposed to the device.
- A new retry that may trigger physical action shall use an explicitly managed retry policy.

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

`actualVolumeMl` is optional and shall be sent only when the hardware contract supports it.

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
CANCEL
STOP
```

A cancel or stop payload shall reference the original command:

```json
{
  "schemaVersion": "1.0",
  "commandId": "cmd-stop-0001",
  "deviceId": "water-node-001",
  "action": "STOP",
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
11. Exact units for N, P, K, temperature, moisture, EC, TDS, battery, tank volume, and flow rate.
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
