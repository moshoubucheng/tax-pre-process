-- Migration: Add description field and on_hold status to transactions
-- Run with: wrangler d1 execute tax-db --file=./src/db/migrations/004_add_description_and_on_hold.sql

-- Add description column for client notes/usage explanation
ALTER TABLE transactions ADD COLUMN description TEXT;

-- Note: SQLite doesn't support modifying CHECK constraints directly
-- The status field already accepts 'on_hold' if we update via API
-- The CHECK constraint in schema.sql should be updated for new databases
