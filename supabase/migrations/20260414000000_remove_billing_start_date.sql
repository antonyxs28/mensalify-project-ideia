-- Migration: Remove billing_start_date and standardize created_at
-- This migration removes the dual source of truth issue by eliminating billing_start_date
-- and ensuring created_at is always present and used as the single source of truth

BEGIN;

-- Drop the trigger that depends on billing_start_date
DROP TRIGGER IF EXISTS trg_client_billing_cycles ON clients;
DROP FUNCTION IF EXISTS auto_generate_billing_cycles();

-- Remove the problematic billing_start_date column
ALTER TABLE clients
DROP COLUMN IF EXISTS billing_start_date;

-- Ensure created_at is NOT NULL and has a default
ALTER TABLE clients
ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE clients
ALTER COLUMN created_at SET DEFAULT now();

COMMIT;