-- Missing auth & session indexes
CREATE INDEX IF NOT EXISTS "sessions_user_active_idx" ON "sessions"("user_id", "revoked_at", "expires_at");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");

CREATE INDEX IF NOT EXISTS "user_roles_user_id_idx" ON "user_roles"("user_id");
CREATE INDEX IF NOT EXISTS "user_roles_user_id_revoked_at_idx" ON "user_roles"("user_id", "revoked_at");
CREATE INDEX IF NOT EXISTS "user_roles_role_id_idx" ON "user_roles"("role_id");

-- Missing foreign key covering indexes
CREATE INDEX IF NOT EXISTS "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");
CREATE INDEX IF NOT EXISTS "account_approvals_decided_by_user_id_idx" ON "account_approvals"("decided_by_user_id");
CREATE INDEX IF NOT EXISTS "user_device_access_device_id_idx" ON "user_device_access"("device_id");
CREATE INDEX IF NOT EXISTS "user_device_access_assigned_by_user_id_idx" ON "user_device_access"("assigned_by_user_id");
CREATE INDEX IF NOT EXISTS "user_preferences_default_device_id_idx" ON "user_preferences"("default_device_id");
CREATE INDEX IF NOT EXISTS "alert_acknowledgements_user_id_idx" ON "alert_acknowledgements"("acknowledged_by_user_id");
CREATE INDEX IF NOT EXISTS "alert_acknowledgements_alert_id_idx" ON "alert_acknowledgements"("alert_id");
CREATE INDEX IF NOT EXISTS "alerts_device_id_idx" ON "alerts"("device_id");
