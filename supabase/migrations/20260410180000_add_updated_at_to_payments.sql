-- =====================================================
-- Migration: Add updated_at to payments table
-- Fixes: "record new has no field updated_at"
-- =====================================================

BEGIN;

-- Add updated_at column to payments (matches billing_cycles schema)
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

COMMIT;