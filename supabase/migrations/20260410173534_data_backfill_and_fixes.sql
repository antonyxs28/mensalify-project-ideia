-- =====================================================
-- Migration 002: Data Backfill & Fixes (FINAL FIX)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Ensure billing_start_date exists
-- =====================================================
UPDATE clients 
SET billing_start_date = DATE_TRUNC('month', created_at)::DATE
WHERE billing_start_date IS NULL;

-- =====================================================
-- 2. Seed billing_cycles
-- =====================================================
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
    DATE_TRUNC('month', COALESCE(c.billing_start_date, c.created_at)),
    DATE_TRUNC('month', CURRENT_DATE),
    INTERVAL '1 month'
) AS gs;

-- =====================================================
-- 3. Payments: ensure default amount
-- =====================================================
ALTER TABLE payments 
ALTER COLUMN amount SET DEFAULT 0;

-- =====================================================
-- 4. FIXED: Migrate existing paid payments
-- =====================================================

UPDATE payments p
SET 
    billing_cycle_id = bc.id,
    amount = COALESCE(p.amount, c.monthly_price)
FROM clients c
JOIN billing_cycles bc 
    ON bc.client_id = c.id
WHERE 
    p.client_id = c.id
    AND p.paid = true
    AND p.billing_cycle_id IS NULL
    AND bc.cycle_year = EXTRACT(YEAR FROM p.month::DATE)::INTEGER
    AND bc.cycle_month = EXTRACT(MONTH FROM p.month::DATE)::INTEGER;

-- =====================================================
-- 5. Update billing_cycles status
-- =====================================================
UPDATE billing_cycles bc
SET 
    paid_amount = COALESCE(p.total_paid, 0),
    status = CASE 
        WHEN COALESCE(p.total_paid, 0) >= bc.expected_amount THEN 'paid'
        WHEN CURRENT_DATE > bc.due_date THEN 'overdue'
        WHEN COALESCE(p.total_paid, 0) > 0 THEN 'partial'
        ELSE 'pending'
    END
FROM (
    SELECT billing_cycle_id, SUM(amount) AS total_paid
    FROM payments
    GROUP BY billing_cycle_id
) p
WHERE bc.id = p.billing_cycle_id;

-- =====================================================
-- 6. Index
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_payments_billing_cycle_id 
ON payments(billing_cycle_id);

-- =====================================================
-- 7. Function: recalculate cycle status
-- =====================================================
CREATE OR REPLACE FUNCTION recalculate_cycle_status(p_cycle_id UUID)
RETURNS VOID AS $$
DECLARE
    v_expected NUMERIC(10, 2);
    v_paid NUMERIC(10, 2);
    v_due DATE;
    v_status VARCHAR(20);
BEGIN
    SELECT expected_amount, paid_amount, due_date
    INTO v_expected, v_paid, v_due
    FROM billing_cycles
    WHERE id = p_cycle_id;

    IF v_paid >= v_expected THEN
        v_status := 'paid';
    ELSIF v_paid > 0 THEN
        v_status := CASE 
            WHEN CURRENT_DATE > v_due THEN 'overdue'
            ELSE 'partial'
        END;
    ELSE
        v_status := CASE 
            WHEN CURRENT_DATE > v_due THEN 'overdue'
            ELSE 'pending'
        END;
    END IF;

    UPDATE billing_cycles
    SET status = v_status,
        updated_at = NOW()
    WHERE id = p_cycle_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. Function: generate client cycles
-- =====================================================
CREATE OR REPLACE FUNCTION generate_client_cycles(
    p_client_id UUID,
    p_up_to_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_start_date DATE;
    v_monthly_price NUMERIC(10, 2);
    v_count INTEGER := 0;
BEGIN
    SELECT billing_start_date, monthly_price
    INTO v_start_date, v_monthly_price
    FROM clients
    WHERE id = p_client_id;

    IF v_start_date IS NULL OR v_monthly_price IS NULL THEN
        RETURN 0;
    END IF;

    INSERT INTO billing_cycles (
        client_id,
        cycle_year,
        cycle_month,
        due_date,
        expected_amount
    )
    SELECT 
        p_client_id,
        EXTRACT(YEAR FROM gs)::INTEGER,
        EXTRACT(MONTH FROM gs)::INTEGER,
        (
            DATE_TRUNC('month', gs)
            + INTERVAL '1 month'
            + INTERVAL '4 days'
        )::DATE,
        v_monthly_price
    FROM generate_series(
        v_start_date,
        p_up_to_date,
        INTERVAL '1 month'
    ) gs
    ON CONFLICT (client_id, cycle_year, cycle_month) DO NOTHING;

    SELECT COUNT(*) INTO v_count
    FROM billing_cycles
    WHERE client_id = p_client_id;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;