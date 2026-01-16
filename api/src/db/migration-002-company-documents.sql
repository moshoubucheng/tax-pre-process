-- Company Documents Migration
-- Run with: wrangler d1 execute tax-db --remote --file=./src/db/migration-002-company-documents.sql

-- Company documents/info table
CREATE TABLE IF NOT EXISTS company_documents (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id),

    -- PDF uploads (stored as R2 keys)
    tohon_key TEXT,                    -- 謄本
    teikan_key TEXT,                   -- 定款
    zairyu_card_key TEXT,              -- 社長和家族在留カード
    juminhyo_key TEXT,                 -- 住民票（带マイナンバー）
    kaigyo_doc1_key TEXT,              -- 開業申請書類1
    kaigyo_doc2_key TEXT,              -- 開業申請書類2
    kaigyo_doc3_key TEXT,              -- 開業申請書類3
    kaigyo_doc4_key TEXT,              -- 開業申請書類4
    kaigyo_doc5_key TEXT,              -- 開業申請書類5
    kaigyo_doc6_key TEXT,              -- 開業申請書類6

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

    -- Status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed')),
    confirmed_by TEXT REFERENCES users(id),
    confirmed_at TEXT,

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for company lookup
CREATE INDEX IF NOT EXISTS idx_company_documents_company ON company_documents(company_id);
