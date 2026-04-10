-- =====================================================
-- Migration: Add billing configuration fields to clients
-- =====================================================

BEGIN;

-- Add billing configuration columns to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) DEFAULT 'monthly'
  CHECK (billing_type IN ('monthly', 'weekly', 'yearly')),
ADD COLUMN IF NOT EXISTS number_of_cycles INTEGER;

COMMIT;