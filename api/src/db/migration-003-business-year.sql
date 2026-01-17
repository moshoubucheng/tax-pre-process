-- Business Year Migration
-- Run with: wrangler d1 execute tax-db --remote --file=./src/db/migration-003-business-year.sql

-- Add single kaigyo_doc_key column (replacing kaigyo_doc1-6)
ALTER TABLE company_documents ADD COLUMN kaigyo_doc_key TEXT;

-- Add business year columns
ALTER TABLE company_documents ADD COLUMN business_year_start TEXT;
ALTER TABLE company_documents ADD COLUMN business_year_end TEXT;
