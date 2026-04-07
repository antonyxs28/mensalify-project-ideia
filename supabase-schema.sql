-- Mensalify Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Trigger for new user registration
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
  email TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('basico', 'intermediario', 'premium')),
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);

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
  UNIQUE(client_id, month)
);

-- Index for faster queries by client
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
-- Index for faster queries by month
CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
-- Users can only view and update their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- CLIENTS POLICIES
-- Users can only see their own clients
CREATE POLICY "Users can view their own clients"
  ON clients FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own clients
CREATE POLICY "Users can insert their own clients"
  ON clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own clients
CREATE POLICY "Users can update their own clients"
  ON clients FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own clients
CREATE POLICY "Users can delete their own clients"
  ON clients FOR DELETE
  USING (auth.uid() = user_id);

-- PAYMENTS POLICIES
-- Users can only see payments for their own clients
CREATE POLICY "Users can view payments for their clients"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = payments.client_id
      AND clients.user_id = auth.uid()
    )
  );

-- Users can insert payments for their clients
CREATE POLICY "Users can insert payments for their clients"
  ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = payments.client_id
      AND clients.user_id = auth.uid()
    )
  );

-- Users can update payments for their clients
CREATE POLICY "Users can update payments for their clients"
  ON payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = payments.client_id
      AND clients.user_id = auth.uid()
    )
  );

-- Users can delete payments for their clients
CREATE POLICY "Users can delete payments for their clients"
  ON payments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = payments.client_id
      AND clients.user_id = auth.uid()
    )
  );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get current month's payment status for a client
CREATE OR REPLACE FUNCTION get_client_month_status(client_uuid UUID)
RETURNS TABLE(month DATE, paid BOOLEAN, paid_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.month,
    p.paid,
    p.paid_at
  FROM payments p
  WHERE p.client_id = client_uuid
  AND p.month = date_trunc('month', CURRENT_DATE)::DATE
  AND p.month = date_trunc('month', CURRENT_DATE + interval '1 month' - interval '1 day')::DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all payments for a client
CREATE OR REPLACE FUNCTION get_client_payments(client_uuid UUID)
RETURNS TABLE(
  id UUID,
  month DATE,
  paid BOOLEAN,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.month,
    p.paid,
    p.paid_at,
    p.created_at
  FROM payments p
  WHERE p.client_id = client_uuid
  ORDER BY p.month DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
