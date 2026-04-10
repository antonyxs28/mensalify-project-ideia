-- =====================================================
-- Migration: Add trigger to auto-generate billing cycles on client creation/update
-- Fixes: Billing cycles not appearing because they were never created
-- =====================================================

BEGIN;

-- Create function to generate billing cycles for a client
CREATE OR REPLACE FUNCTION auto_generate_billing_cycles()
RETURNS TRIGGER AS $$
DECLARE
  v_billing_start_date DATE;
  v_monthly_price NUMERIC(10, 2);
BEGIN
  -- Only process if billing_start_date is set
  IF NEW.billing_start_date IS NOT NULL THEN
    v_billing_start_date := NEW.billing_start_date;
    v_monthly_price := COALESCE(NEW.monthly_price, 0);
    
    -- Skip if no price or not active
    IF v_monthly_price <= 0 OR COALESCE(NEW.is_active, TRUE) = FALSE THEN
      RETURN NEW;
    END IF;

    -- Generate cycles from billing_start_date to current month
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
      NEW.id,
      EXTRACT(YEAR FROM gs)::INTEGER,
      EXTRACT(MONTH FROM gs)::INTEGER,
      (
        DATE_TRUNC('month', gs)
        + INTERVAL '1 month'
        + INTERVAL '4 days'
      )::DATE,
      v_monthly_price,
      0,
      'pending'
    FROM generate_series(
      v_billing_start_date,
      DATE_TRUNC('month', CURRENT_DATE),
      INTERVAL '1 month'
    ) AS gs
    ON CONFLICT (client_id, cycle_year, cycle_month) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_client_billing_cycles ON clients;

-- Create trigger
CREATE TRIGGER trg_client_billing_cycles
AFTER INSERT OR UPDATE OF billing_start_date, monthly_price, is_active
ON clients
FOR EACH ROW
EXECUTE FUNCTION auto_generate_billing_cycles();

COMMIT;