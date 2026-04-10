-- Migration: Add due_day field to clients table
-- This migration adds the due_day column for_day of month billing

BEGIN;

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS due_day INTEGER DEFAULT 5 CHECK (due_day >= 1 AND due_day <= 31);

COMMIT;