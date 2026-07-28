-- Initial PostgreSQL Migration for Kebun Melon System
-- TASK-0104: Database Schema and Migrations
-- Provider: PostgreSQL

-- CreateEnums
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN');
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'DEACTIVATED');
CREATE TYPE "DeviceType" AS ENUM ('SOIL_NODE', 'WATER_NODE', 'COMBINED_NODE');
CREATE TYPE "DeviceAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DEACTIVATED');
CREATE TYPE "DeviceConnectionStatus" AS ENUM ('ONLINE', 'OFFLINE', 'STALE', 'UNKNOWN', 'INACTIVE');
CREATE TYPE "FaucetCommandStatus" AS ENUM ('QUEUED', 'SENT', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'EXPIRED');
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable: users
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "username" VARCHAR(100),
    "password_hash" TEXT NOT NULL,
    "account_status" "AccountStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "email_verified_at" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "suspended_at" TIMESTAMPTZ,
    "deactivated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: roles
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" "UserRole" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: permissions
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_roles
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by_user_id" UUID,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: role_permissions
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: account_approvals
CREATE TABLE "account_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "applicant_user_id" UUID NOT NULL,
    "decision" VARCHAR(30) NOT NULL,
    "previous_status" VARCHAR(40) NOT NULL,
    "new_status" VARCHAR(40) NOT NULL,
    "decided_by_user_id" UUID NOT NULL,
    "decision_note" TEXT,
    "decided_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sites
CREATE TABLE "sites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "site_code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable: devices
CREATE TABLE "devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" VARCHAR(150) NOT NULL,
    "site_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "device_type" "DeviceType" NOT NULL,
    "account_status" "DeviceAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "connection_status" "DeviceConnectionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "firmware_version" VARCHAR(100),
    "hardware_revision" VARCHAR(100),
    "schema_version" VARCHAR(30),
    "last_seen_at" TIMESTAMPTZ,
    "last_message_at" TIMESTAMPTZ,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivated_at" TIMESTAMPTZ,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable: device_capabilities
CREATE TABLE "device_capabilities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID NOT NULL,
    "capability" VARCHAR(80) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "source" VARCHAR(30),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_device_access
CREATE TABLE "user_device_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "assigned_by_user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_device_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable: device_status_events
CREATE TABLE "device_status_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "reason_code" VARCHAR(80),
    "recorded_at" TIMESTAMPTZ,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message_id" VARCHAR(150),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: soil_readings
CREATE TABLE "soil_readings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID NOT NULL,
    "message_id" VARCHAR(150) NOT NULL,
    "sequence_number" BIGINT,
    "schema_version" VARCHAR(30) NOT NULL,
    "recorded_at" TIMESTAMPTZ,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nitrogen" DECIMAL,
    "phosphorus" DECIMAL,
    "potassium" DECIMAL,
    "temperature" DECIMAL,
    "moisture" DECIMAL,
    "ph" DECIMAL,
    "ec" DECIMAL,
    "status" VARCHAR(30),
    "validation_status" VARCHAR(30) NOT NULL DEFAULT 'VALID',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soil_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: water_readings
CREATE TABLE "water_readings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID NOT NULL,
    "message_id" VARCHAR(150) NOT NULL,
    "sequence_number" BIGINT,
    "schema_version" VARCHAR(30) NOT NULL,
    "recorded_at" TIMESTAMPTZ,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ph" DECIMAL,
    "tds" DECIMAL,
    "ec" DECIMAL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "status" VARCHAR(30),
    "validation_status" VARCHAR(30) NOT NULL DEFAULT 'VALID',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: reservoir_water_readings
CREATE TABLE "reservoir_water_readings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID NOT NULL,
    "message_id" VARCHAR(150) NOT NULL,
    "sequence_number" BIGINT,
    "schema_version" VARCHAR(30) NOT NULL,
    "recorded_at" TIMESTAMPTZ,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tank_volume" DECIMAL,
    "flow_rate" DECIMAL,
    "status" VARCHAR(30),
    "validation_status" VARCHAR(30) NOT NULL DEFAULT 'VALID',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservoir_water_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sensor_battery_readings
CREATE TABLE "sensor_battery_readings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID NOT NULL,
    "message_id" VARCHAR(150) NOT NULL,
    "sequence_number" BIGINT,
    "schema_version" VARCHAR(30) NOT NULL,
    "recorded_at" TIMESTAMPTZ,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "battery_level" DECIMAL,
    "status" VARCHAR(30),
    "validation_status" VARCHAR(30) NOT NULL DEFAULT 'VALID',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_battery_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: faucet_commands
CREATE TABLE "faucet_commands" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "command_id" VARCHAR(150) NOT NULL,
    "device_id" UUID NOT NULL,
    "initiated_by_user_id" UUID NOT NULL,
    "initiated_by_role" "UserRole" NOT NULL,
    "phase" SMALLINT NOT NULL,
    "target_volume_ml" INTEGER NOT NULL,
    "actual_volume_ml" DECIMAL,
    "status" "FaucetCommandStatus" NOT NULL DEFAULT 'QUEUED',
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queued_at" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "acknowledged_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "failed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "failure_reason_code" VARCHAR(100),
    "idempotency_key" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faucet_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable: faucet_command_events
CREATE TABLE "faucet_command_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "faucet_command_id" UUID NOT NULL,
    "event_status" VARCHAR(40) NOT NULL,
    "message_id" VARCHAR(150),
    "reason_code" VARCHAR(100),
    "actual_volume_ml" DECIMAL,
    "recorded_at" TIMESTAMPTZ,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faucet_command_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: alerts
CREATE TABLE "alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID,
    "user_id" UUID,
    "alert_type" VARCHAR(80) NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "source_type" VARCHAR(50) NOT NULL,
    "source_id" UUID,
    "title_key" VARCHAR(150),
    "message_key" VARCHAR(150),
    "message_params" JSONB,
    "opened_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: alert_acknowledgements
CREATE TABLE "alert_acknowledgements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "alert_id" UUID NOT NULL,
    "acknowledged_by_user_id" UUID NOT NULL,
    "note" TEXT,
    "acknowledged_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_preferences
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "preferred_locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "timezone" VARCHAR(100) DEFAULT 'Asia/Jakarta',
    "default_device_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sessions
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "last_seen_at" TIMESTAMPTZ,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: audit_logs
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_key" VARCHAR(150) NOT NULL,
    "actor_user_id" UUID,
    "actor_role" "UserRole",
    "target_type" VARCHAR(80),
    "target_id" UUID,
    "result" VARCHAR(30) NOT NULL,
    "previous_values" JSONB,
    "new_values" JSONB,
    "metadata" JSONB,
    "request_id" VARCHAR(150),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: integration_errors
CREATE TABLE "integration_errors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID,
    "message_id" VARCHAR(150),
    "topic" TEXT,
    "error_code" VARCHAR(100) NOT NULL,
    "error_details" JSONB,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_errors_pkey" PRIMARY KEY ("id")
);

-- Unique Indexes
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");
CREATE UNIQUE INDEX "sites_site_code_key" ON "sites"("site_code");
CREATE UNIQUE INDEX "devices_device_id_key" ON "devices"("device_id");
CREATE UNIQUE INDEX "device_capabilities_device_id_capability_key" ON "device_capabilities"("device_id", "capability");
CREATE UNIQUE INDEX "soil_readings_message_unique" ON "soil_readings"("device_id", "message_id");
CREATE UNIQUE INDEX "water_readings_message_unique" ON "water_readings"("device_id", "message_id");
CREATE UNIQUE INDEX "reservoir_water_readings_message_unique" ON "reservoir_water_readings"("device_id", "message_id");
CREATE UNIQUE INDEX "sensor_battery_readings_message_unique" ON "sensor_battery_readings"("device_id", "message_id");
CREATE UNIQUE INDEX "faucet_commands_command_id_key" ON "faucet_commands"("command_id");
CREATE UNIQUE INDEX "faucet_commands_idempotency_key_key" ON "faucet_commands"("idempotency_key");
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");
CREATE UNIQUE INDEX "sessions_session_token_hash_key" ON "sessions"("session_token_hash");

-- Partial Unique Index: Max 1 active faucet command per device
CREATE UNIQUE INDEX "faucet_commands_one_active_per_device" ON "faucet_commands"("device_id") WHERE "status" IN ('QUEUED', 'SENT', 'ACKNOWLEDGED', 'IN_PROGRESS');

-- Check Constraints: Faucet Phase vs Target Volume Mapping
ALTER TABLE "faucet_commands" ADD CONSTRAINT "faucet_commands_phase_volume_check" CHECK (
    ("phase" = 1 AND "target_volume_ml" = 300) OR
    ("phase" = 2 AND "target_volume_ml" = 1000) OR
    ("phase" = 3 AND "target_volume_ml" = 1500)
);

-- Performance Indexes
CREATE INDEX "users_account_status_idx" ON "users"("account_status");
CREATE INDEX "users_created_at_idx" ON "users"("created_at" DESC);
CREATE INDEX "account_approvals_applicant_idx" ON "account_approvals"("applicant_user_id", "decided_at" DESC);
CREATE INDEX "devices_site_idx" ON "devices"("site_id");
CREATE INDEX "devices_connection_status_idx" ON "devices"("connection_status");
CREATE INDEX "devices_last_seen_idx" ON "devices"("last_seen_at" DESC);
CREATE INDEX "device_status_events_device_time_idx" ON "device_status_events"("device_id", "received_at" DESC);
CREATE INDEX "soil_readings_device_recorded_idx" ON "soil_readings"("device_id", "recorded_at" DESC);
CREATE INDEX "soil_readings_device_received_idx" ON "soil_readings"("device_id", "received_at" DESC);
CREATE INDEX "soil_readings_status_idx" ON "soil_readings"("device_id", "status", "recorded_at" DESC);
CREATE INDEX "water_readings_device_recorded_idx" ON "water_readings"("device_id", "recorded_at" DESC);
CREATE INDEX "water_readings_device_received_idx" ON "water_readings"("device_id", "received_at" DESC);
CREATE INDEX "water_readings_status_idx" ON "water_readings"("device_id", "status", "recorded_at" DESC);
CREATE INDEX "reservoir_water_readings_device_recorded_idx" ON "reservoir_water_readings"("device_id", "recorded_at" DESC);
CREATE INDEX "reservoir_water_readings_device_received_idx" ON "reservoir_water_readings"("device_id", "received_at" DESC);
CREATE INDEX "reservoir_water_readings_status_idx" ON "reservoir_water_readings"("device_id", "status", "recorded_at" DESC);
CREATE INDEX "sensor_battery_readings_device_recorded_idx" ON "sensor_battery_readings"("device_id", "recorded_at" DESC);
CREATE INDEX "sensor_battery_readings_device_received_idx" ON "sensor_battery_readings"("device_id", "received_at" DESC);
CREATE INDEX "sensor_battery_readings_status_idx" ON "sensor_battery_readings"("device_id", "status", "recorded_at" DESC);
CREATE INDEX "faucet_commands_device_time_idx" ON "faucet_commands"("device_id", "requested_at" DESC);
CREATE INDEX "faucet_commands_user_time_idx" ON "faucet_commands"("initiated_by_user_id", "requested_at" DESC);
CREATE INDEX "faucet_commands_status_idx" ON "faucet_commands"("status", "requested_at" DESC);
CREATE INDEX "faucet_command_events_command_time_idx" ON "faucet_command_events"("faucet_command_id", "received_at" ASC);
CREATE INDEX "audit_logs_actor_time_idx" ON "audit_logs"("actor_user_id", "created_at" DESC);
CREATE INDEX "audit_logs_target_time_idx" ON "audit_logs"("target_type", "target_id", "created_at" DESC);
CREATE INDEX "audit_logs_event_time_idx" ON "audit_logs"("event_key", "created_at" DESC);

-- Foreign Key Constraints
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "account_approvals" ADD CONSTRAINT "account_approvals_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "account_approvals" ADD CONSTRAINT "account_approvals_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "devices" ADD CONSTRAINT "devices_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "device_capabilities" ADD CONSTRAINT "device_capabilities_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_device_access" ADD CONSTRAINT "user_device_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_device_access" ADD CONSTRAINT "user_device_access_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_device_access" ADD CONSTRAINT "user_device_access_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "device_status_events" ADD CONSTRAINT "device_status_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "soil_readings" ADD CONSTRAINT "soil_readings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "water_readings" ADD CONSTRAINT "water_readings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservoir_water_readings" ADD CONSTRAINT "reservoir_water_readings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sensor_battery_readings" ADD CONSTRAINT "sensor_battery_readings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "faucet_commands" ADD CONSTRAINT "faucet_commands_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "faucet_commands" ADD CONSTRAINT "faucet_commands_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "faucet_command_events" ADD CONSTRAINT "faucet_command_events_faucet_command_id_fkey" FOREIGN KEY ("faucet_command_id") REFERENCES "faucet_commands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "alerts" ADD CONSTRAINT "alerts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alert_acknowledgements" ADD CONSTRAINT "alert_acknowledgements_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_acknowledgements" ADD CONSTRAINT "alert_acknowledgements_acknowledged_by_user_id_fkey" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_default_device_id_fkey" FOREIGN KEY ("default_device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
