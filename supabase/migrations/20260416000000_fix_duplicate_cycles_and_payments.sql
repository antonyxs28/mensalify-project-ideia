-- Migration: Fix duplicate billing cycles and recalculate paid_amount from individual payments
-- This migration ensures:
-- 1. Each billing cycle has unique (client_id, cycle_year, cycle_month)
-- 2. paid_amount is recalculated from SUM(payments.amount) for each cycle

BEGIN;

-- Step 1: Delete duplicate cycles, keeping the one with highest paid_amount or latest id
-- First, identify cycles to delete (duplicates with lower paid_amount or older id)
DELETE FROM billing_cycles
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id,
      client_id,
      cycle_year,
      cycle_month,
      paid_amount,
      ROW_NUMBER() OVER (
        PARTITION BY client_id, cycle_year, cycle_month 
        ORDER BY paid_amount DESC, id DESC
      ) as rn
    FROM billing_cycles
  ) sub
  WHERE rn > 1
);

-- Step 2: Recalculate paid_amount from individual payments for each cycle
UPDATE billing_cycles bc
SET 
  paid_amount = COALESCE(
    (
      SELECT SUM(p.amount)
      FROM payments p
      WHERE p.billing_cycle_id = bc.id
    ), 0
  ),
  status = (
    CASE 
      WHEN COALESCE(
        (
          SELECT SUM(p.amount)
          FROM payments p
          WHERE p.billing_cycle_id = bc.id
        ), 0
      ) >= bc.expected_amount THEN 'paid'
      WHEN COALESCE(
        (
          SELECT SUM(p.amount)
          FROM payments p
          WHERE p.billing_cycle_id = bc.id
        ), 0
      ) > 0 THEN 'partial'
      ELSE 'pending'
    END
  ),
  updated_at = NOW()
WHERE TRUE;

-- Step 3: Fix payment records that have billing_cycle_id = null
-- Update them to reference the correct cycle if possible
UPDATE payments p
SET billing_cycle_id = (
  SELECT bc.id FROM billing_cycles bc
  WHERE bc.client_id = p.client_id
    AND bc.cycle_year = EXTRACT(YEAR FROM p.month::DATE)::INT
    AND bc.cycle_month = EXTRACT(MONTH FROM p.month::DATE)::INT
  ORDER BY bc.id
  LIMIT 1
)
WHERE p.billing_cycle_id IS NULL;

COMMIT;