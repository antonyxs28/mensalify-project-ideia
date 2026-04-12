-- Mensalify Database Schema (Updated)
-- Run this SQL in your Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- PROFILES TABLE
-- Stores additional user profile information
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- CLIENTS TABLE
-- Stores client information for subscription management
-- =====================================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  monthly_price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  billing_start_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  billing_type VARCHAR(20) DEFAULT 'monthly'
    CHECK (billing_type IN ('monthly', 'weekly', 'yearly')),
  number_of_cycles INTEGER,
  due_day INTEGER DEFAULT 5 CHECK (due_day >= 1 AND due_day <= 31),
  total_installments INTEGER DEFAULT 1 CHECK (total_installments >= 1)
);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);

-- =====================================================
-- BILLING CYCLES TABLE
-- Tracks billing cycles per client (year/month)
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

CREATE INDEX IF NOT EXISTS idx_billing_cycles_client_id ON billing_cycles(client_id);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_status ON billing_cycles(status);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_year_month ON billing_cycles(cycle_year, cycle_month);

-- =====================================================
-- PAYMENTS TABLE
-- Tracks payment status for each client per month
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  month DATE NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  billing_cycle_id UUID REFERENCES billing_cycles(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) DEFAULT 0,
  UNIQUE(client_id, month)
);

CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- CLIENTS POLICIES
CREATE POLICY "Users can view their own clients"
  ON clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clients"
  ON clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients"
  ON clients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients"
  ON clients FOR DELETE
  USING (auth.uid() = user_id);

-- BILLING CYCLES POLICIES
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

-- PAYMENTS POLICIES
CREATE POLICY "Users can view payments for their clients"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = payments.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert payments for their clients"
  ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = payments.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update payments for their clients"
  ON payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = payments.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete payments for their clients"
  ON payments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = payments.client_id
      AND clients.user_id = auth.uid()
    )
  );