-- Tax Pre-Process Database Schema
-- Run with: wrangler d1 execute tax-db --file=./src/db/schema.sql

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'client')),
    company_id TEXT REFERENCES companies(id),
    created_at TEXT DEFAULT (datetime('now'))
);

-- Transactions table (receipts/invoices)
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id),
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    image_key TEXT NOT NULL,
    image_uploaded_at TEXT NOT NULL,
    transaction_date TEXT,
    amount INTEGER,
    vendor_name TEXT,
    account_debit TEXT,
    account_credit TEXT DEFAULT '現金',
    tax_category TEXT,
    ai_confidence INTEGER,
    ai_raw_response TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
    created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_company ON transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
