-- =====================================================
-- Migration: Backfill billing_cycles for existing clients
-- Fixes: Generate cycles for clients that existed before the trigger was added
-- =====================================================

BEGIN;

-- Generate billing cycles for all active clients that don't have cycles yet
INSERT INTO billing_cycles (
  client_id,
  cycle_year,
  cycle_month,
  due_date,
  expected_amount,
  paid_amount,
  status
)
SELECT 
  c.id,
  EXTRACT(YEAR FROM gs)::INTEGER,
  EXTRACT(MONTH FROM gs)::INTEGER,
  (
    DATE_TRUNC('month', gs)
    + INTERVAL '1 month'
    + INTERVAL '4 days'
  )::DATE,
  c.monthly_price,
  0,
  'pending'
FROM clients c
CROSS JOIN generate_series(
  COALESCE(c.billing_start_date, DATE_TRUNC('month', c.created_at)),
  DATE_TRUNC('month', CURRENT_DATE),
  INTERVAL '1 month'
) AS gs
WHERE c.is_active IS NOT FALSE
  AND c.monthly_price > 0
ON CONFLICT (client_id, cycle_year, cycle_month) DO NOTHING;

COMMIT;