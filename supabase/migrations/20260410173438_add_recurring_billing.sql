-- =====================================================
-- Migration: Add Recurring Billing System (FIXED)
-- =====================================================

BEGIN;

-- =====================================================
-- 0. Extensions (IMPORTANT FIX)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. Add billing fields to clients table
-- =====================================================
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS billing_start_date DATE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- =====================================================
-- 2. Create billing_cycles table
-- =====================================================
CREATE TABLE IF NOT EXISTS billing_cycles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  cycle_year INTEGER NOT NULL,
  cycle_month INTEGER NOT NULL,
  due_date DATE NOT NULL,
  expected_amount NUMERIC(10, 2) NOT NULL,
  paid_amount NUMERIC(10, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue', 'partial')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(client_id, cycle_year, cycle_month)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_cycles_client_id 
ON billing_cycles(client_id);

CREATE INDEX IF NOT EXISTS idx_billing_cycles_status 
ON billing_cycles(status);

CREATE INDEX IF NOT EXISTS idx_billing_cycles_year_month 
ON billing_cycles(cycle_year, cycle_month);

-- =====================================================
-- 3. Extend payments table
-- =====================================================
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS billing_cycle_id UUID 
REFERENCES billing_cycles(id) ON DELETE SET NULL,

ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) DEFAULT 0;

-- =====================================================
-- 4. Function: calculate due date
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_due_date(p_cycle_date DATE)
RETURNS DATE AS $$
BEGIN
  RETURN DATE_TRUNC('month', p_cycle_date)
    + INTERVAL '1 month'
    + INTERVAL '4 days';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 5. Function: create billing cycle
-- =====================================================
CREATE OR REPLACE FUNCTION create_billing_cycle(
  p_client_id UUID,
  p_cycle_year INTEGER,
  p_cycle_month INTEGER
)
RETURNS UUID AS $$
DECLARE
  v_cycle_date DATE;
  v_due_date DATE;
  v_expected_amount NUMERIC(10, 2);
  v_cycle_id UUID;
BEGIN
  v_cycle_date := MAKE_DATE(p_cycle_year, p_cycle_month, 1);
  v_due_date := calculate_due_date(v_cycle_date);

  SELECT monthly_price INTO v_expected_amount
  FROM clients WHERE id = p_client_id;

  INSERT INTO billing_cycles (
    client_id,
    cycle_year,
    cycle_month,
    due_date,
    expected_amount
  )
  VALUES (
    p_client_id,
    p_cycle_year,
    p_cycle_month,
    v_due_date,
    v_expected_amount
  )
  ON CONFLICT (client_id, cycle_year, cycle_month) DO NOTHING
  RETURNING id INTO v_cycle_id;

  RETURN v_cycle_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Trigger: handle payment insert
-- =====================================================
CREATE OR REPLACE FUNCTION handle_payment_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_month DATE;
BEGIN
  v_payment_month := DATE_TRUNC('month', NEW.month)::DATE;

  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_insert ON payments;

CREATE TRIGGER trg_payment_insert
BEFORE INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION handle_payment_insert();

-- =====================================================
-- 7. Trigger: update cycle after payment
-- =====================================================
CREATE OR REPLACE FUNCTION update_cycle_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_expected_amount NUMERIC(10, 2);
  v_paid_amount NUMERIC(10, 2);
  v_due_date DATE;
  v_new_status VARCHAR(20);
BEGIN
  IF NEW.billing_cycle_id IS NOT NULL THEN

    SELECT expected_amount, paid_amount, due_date
    INTO v_expected_amount, v_paid_amount, v_due_date
    FROM billing_cycles
    WHERE id = NEW.billing_cycle_id;

    v_paid_amount := v_paid_amount + COALESCE(NEW.amount, 0);

    IF v_paid_amount >= v_expected_amount THEN
      v_new_status := 'paid';
    ELSIF v_paid_amount > 0 THEN
      v_new_status := 'partial';
    ELSE
      v_new_status := 'pending';
    END IF;

    IF v_new_status != 'paid' AND CURRENT_DATE > v_due_date THEN
      v_new_status := 'overdue';
    END IF;

    UPDATE billing_cycles
    SET paid_amount = v_paid_amount,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = NEW.billing_cycle_id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_update ON payments;

CREATE TRIGGER trg_payment_update
AFTER INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION update_cycle_on_payment();

-- =====================================================
-- 8. RLS (Security)
-- =====================================================
ALTER TABLE billing_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view billing cycles for their clients"
ON billing_cycles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = billing_cycles.client_id
    AND clients.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert billing cycles for their clients"
ON billing_cycles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = billing_cycles.client_id
    AND clients.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update billing cycles for their clients"
ON billing_cycles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = billing_cycles.client_id
    AND clients.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete billing cycles for their clients"
ON billing_cycles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = billing_cycles.client_id
    AND clients.user_id = auth.uid()
  )
);

COMMIT;