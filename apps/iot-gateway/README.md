# @kebun-melon/iot-gateway

Long-running IoT Gateway service responsible for MQTT 5.0 broker communication, telemetry ingestion, faucet command orchestration, and background database retention scheduling.

## Environment Variables

| Variable                | Type      | Default                 | Description                                         |
| ----------------------- | --------- | ----------------------- | --------------------------------------------------- |
| `PORT`                  | `number`  | `3001`                  | Gateway HTTP server port                            |
| `HOST`                  | `string`  | `0.0.0.0`               | Server host binding                                 |
| `MQTT_BROKER_URL`       | `string`  | `mqtt://localhost:1883` | MQTT Broker URL                                     |
| `RETENTION_ENABLED`     | `boolean` | `true`                  | Enables/disables automated telemetry data retention |
| `RETENTION_RAW_DAYS`    | `number`  | `90`                    | Raw telemetry retention TTL in days (`DEC-MON-048`) |
| `RETENTION_BATCH_SIZE`  | `number`  | `1000`                  | Chunk batch size for lock-free deletions            |
| `RETENTION_INTERVAL_MS` | `number`  | `86400000`              | Maintenance runner period (24 hours)                |

## Background Maintenance (`RetentionScheduler`)

- Automatically runs telemetry lifecycle maintenance on a 24-hour cycle.
- Executes chunked purging for approved telemetry tables (`soil_readings`, `water_readings`, `reservoir_water_readings`, `sensor_battery_readings`, `device_status_events`, `integration_errors`).
- Excludes and preserves `audit_logs`, `faucet_commands`, and `account_approvals`.
