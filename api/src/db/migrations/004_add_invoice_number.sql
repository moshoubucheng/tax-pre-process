-- Migration: Add invoice_number column for インボイス制度 (Invoice System)
-- The T-Number format: T + 13 digits (e.g., T1234567890123)
-- This is required since October 2023 for consumption tax deduction

ALTER TABLE transactions ADD COLUMN invoice_number TEXT;

-- Index for searching by invoice number
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_number ON transactions(invoice_number);
