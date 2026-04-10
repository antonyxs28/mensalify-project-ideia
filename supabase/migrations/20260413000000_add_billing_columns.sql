-- Migration: Add all billing columns needed for the billing system

BEGIN;

-- Add total_installments to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS total_installments INTEGER DEFAULT 1 CHECK (total_installments >= 1);

-- Add reference_date to billing_cycles table (optional, for tracking the month)
ALTER TABLE billing_cycles
ADD COLUMN IF NOT EXISTS reference_date DATE;

-- Update existing cycles to have proper reference_date
UPDATE billing_cycles
SET reference_date = make_date(cycle_year, cycle_month, 1)
WHERE reference_date IS NULL;

COMMIT;