-- Migration: Add reference_date column to billing_cycles table
-- This is needed to track the month of each cycle accurately

BEGIN;

ALTER TABLE billing_cycles
ADD COLUMN IF NOT EXISTS reference_date DATE;

-- Populate reference_date from cycle_year and cycle_month where null
UPDATE billing_cycles
SET reference_date = make_date(cycle_year, cycle_month, 1)
WHERE reference_date IS NULL AND cycle_year IS NOT NULL AND cycle_month IS NOT NULL;

COMMIT;