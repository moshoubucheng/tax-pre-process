-- Migration: Add transaction type and tax_rate columns
-- Supports Income (売上) vs Expense (経費) transactions

-- Add type column: 'expense' or 'income'
ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income'));

-- Add tax_rate column: 8 or 10 (percent)
ALTER TABLE transactions ADD COLUMN tax_rate INTEGER DEFAULT 10;

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
