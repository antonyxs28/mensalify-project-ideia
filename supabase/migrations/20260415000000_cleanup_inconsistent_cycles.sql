-- Migration: Clean up inconsistent billing cycles
-- Remove cycles with incorrect years (future cycles beyond reasonable timeframe)
-- This fixes cycles that were generated with wrong dates

BEGIN;

-- Remove cycles that are more than 6 months in the future
-- This catches cycles generated with current date instead of client creation date
DELETE FROM billing_cycles
WHERE reference_date > (now() + interval '6 months');

-- Remove cycles with invalid years (before 2000 or after 2100)
DELETE FROM billing_cycles
WHERE cycle_year < 2000 OR cycle_year > 2100;

COMMIT;