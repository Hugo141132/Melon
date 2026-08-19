-- Migration for TASK-0802 Faucet Command Database Model

-- 1. Add new columns
ALTER TABLE "faucet_commands" ADD COLUMN "action" VARCHAR(30) NOT NULL DEFAULT 'DISPENSE';
ALTER TABLE "faucet_commands" ADD COLUMN "plant_count" INTEGER;

-- 2. Make phase and target_volume_ml nullable
ALTER TABLE "faucet_commands" ALTER COLUMN "phase" DROP NOT NULL;
ALTER TABLE "faucet_commands" ALTER COLUMN "target_volume_ml" DROP NOT NULL;

-- 3. Backfill plant_count for existing DISPENSE commands
UPDATE "faucet_commands" SET "plant_count" = 1 WHERE "action" = 'DISPENSE';

-- 4. Drop legacy phase-volume check constraint superseded by action check
ALTER TABLE "faucet_commands" DROP CONSTRAINT IF EXISTS "faucet_commands_phase_volume_check";

-- 5. Enforce exact rules for DISPENSE, OPEN, and CLOSE
ALTER TABLE "faucet_commands" ADD CONSTRAINT "faucet_commands_action_check" 
CHECK (
  (
    action = 'DISPENSE' 
    AND phase IS NOT NULL 
    AND plant_count IS NOT NULL 
    AND plant_count >= 1 
    AND target_volume_ml IS NOT NULL 
    AND target_volume_ml = (CASE phase WHEN 1 THEN 300 WHEN 2 THEN 1000 WHEN 3 THEN 1500 ELSE -1 END) * plant_count
  )
  OR
  (
    action IN ('OPEN', 'CLOSE') 
    AND phase IS NULL 
    AND plant_count IS NULL 
    AND target_volume_ml IS NULL
  )
);
