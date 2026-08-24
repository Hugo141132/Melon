# @kebun-melon/database

Database schemas, Prisma client, database repositories, and lifecycle maintenance services for the Kebun Melon system.

## Telemetry Data Retention (`RetentionService`)

- Implements automated 90-day retention pruning for high-frequency raw telemetry (`soil_readings`, `water_readings`, `reservoir_water_readings`, `sensor_battery_readings`) and operational event logs (`device_status_events`, `integration_errors`) per `DEC-MON-048`.
- Strictly isolates and protects compliance/security records (`audit_logs`, `faucet_commands`, `faucet_command_events`, `account_approvals`) as non-purgeable (`SEC-DATA-004`).
- Chunked batch execution (`batchSize: 1000`, `yieldMs: 20`) prevents table locks and long transactions.

### Manual Cleanup CLI

Run data retention cleanup manually:

```bash
npm run db:cleanup
```
