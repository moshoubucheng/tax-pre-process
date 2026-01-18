-- Migration: Update status constraint to include on_hold
-- SQLite doesn't support ALTER CHECK constraint, so we need to recreate the table

-- Step 1: Create new table with updated constraint
CREATE TABLE transactions_new (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  image_key TEXT NOT NULL,
  image_uploaded_at TEXT NOT NULL,
  transaction_date TEXT,
  amount INTEGER,
  vendor_name TEXT,
  account_debit TEXT,
  account_credit TEXT NOT NULL DEFAULT '現金',
  tax_category TEXT,
  ai_confidence INTEGER,
  ai_raw_response TEXT,
  description TEXT,
  admin_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'on_hold')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 2: Copy data from old table
INSERT INTO transactions_new SELECT
  id, company_id, uploaded_by, image_key, image_uploaded_at,
  transaction_date, amount, vendor_name, account_debit, account_credit,
  tax_category, ai_confidence, ai_raw_response, description, admin_note,
  status, created_at
FROM transactions;

-- Step 3: Drop old table
DROP TABLE transactions;

-- Step 4: Rename new table
ALTER TABLE transactions_new RENAME TO transactions;
