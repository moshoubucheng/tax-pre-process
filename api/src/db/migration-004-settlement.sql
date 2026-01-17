-- Settlement Status Migration
-- Run with: wrangler d1 execute tax-db --remote --file=./src/db/migration-004-settlement.sql

-- Add settlement confirmation fields
ALTER TABLE company_documents ADD COLUMN settlement_confirmed INTEGER DEFAULT 0;
ALTER TABLE company_documents ADD COLUMN settlement_confirmed_at TEXT;
ALTER TABLE company_documents ADD COLUMN settlement_confirmed_by TEXT;
