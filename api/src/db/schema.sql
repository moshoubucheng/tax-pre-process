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
    type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
    transaction_date TEXT,
    amount INTEGER,
    vendor_name TEXT,
    account_debit TEXT,
    account_credit TEXT DEFAULT '現金',
    tax_category TEXT,
    tax_rate INTEGER DEFAULT 10,
    invoice_number TEXT,
    description TEXT,
    admin_note TEXT,
    ai_confidence INTEGER,
    ai_raw_response TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'on_hold')),
    created_at TEXT DEFAULT (datetime('now'))
);

-- Transaction messages for admin-client dialogue
CREATE TABLE IF NOT EXISTS transaction_messages (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK(role IN ('admin', 'client')),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Company documents/info table
CREATE TABLE IF NOT EXISTS company_documents (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id),

    -- PDF uploads (stored as R2 keys)
    tohon_key TEXT,                    -- 謄本
    teikan_key TEXT,                   -- 定款
    zairyu_card_key TEXT,              -- 社長和家族在留カード
    juminhyo_key TEXT,                 -- 住民票（带マイナンバー）
    kaigyo_doc_key TEXT,               -- 開業申請書類

    -- Text fields
    shacho_phone TEXT,                 -- 社长联络电话
    shacho_name_reading TEXT,          -- 社长名字日语发音
    kazoku_name_reading TEXT,          -- 家族名字日语发音
    kazoku_info TEXT,                  -- 家族名字，读音，是否有收入（JSON格式）
    shacho_income TEXT,                -- 社长收入
    kazoku_income TEXT,                -- 家族收入
    salary_start_date TEXT,            -- 什么时间开始发工资
    kousei_nenkin TEXT,                -- 厚生年金（什么时候开始缴）
    kokuzei_info TEXT,                 -- 国税信息和密码
    chihouzei_info TEXT,               -- 地方税信息和密码

    -- Business year
    business_year_start TEXT,          -- 事業年度開始月
    business_year_end TEXT,            -- 事業年度終了月

    -- Settlement status
    settlement_confirmed INTEGER DEFAULT 0,
    settlement_confirmed_at TEXT,
    settlement_confirmed_by TEXT,

    -- Document status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed')),
    confirmed_by TEXT REFERENCES users(id),
    confirmed_at TEXT,

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_company ON transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_number ON transactions(invoice_number);
CREATE INDEX IF NOT EXISTS idx_transaction_messages_transaction_id ON transaction_messages(transaction_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_company ON company_documents(company_id);
