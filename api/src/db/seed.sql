-- Seed data for development
-- Run with: wrangler d1 execute tax-db --local --file=./src/db/seed.sql

-- Admin company (tax accountant office)
INSERT OR IGNORE INTO companies (id, name) VALUES
('comp_admin', '山田税理士事務所');

-- Test client company
INSERT OR IGNORE INTO companies (id, name) VALUES
('comp_test', '株式会社テスト商事');

-- Admin user (password: admin123)
-- Hash generated with: await crypto.subtle.digest('SHA-256', new TextEncoder().encode('admin123'))
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, company_id) VALUES
('user_admin', 'admin@example.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '山田太郎', 'admin', 'comp_admin');

-- Client user (password: client123)
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, company_id) VALUES
('user_client', 'client@example.com', '5e884898da28047d9191e80e3f0e1d9f5ef6b0e1c6c8b1dd8d0f8a7e6d5c4b3a', '田中花子', 'client', 'comp_test');

-- Sample transactions
INSERT OR IGNORE INTO transactions (id, company_id, uploaded_by, image_key, image_uploaded_at, transaction_date, amount, vendor_name, account_debit, tax_category, ai_confidence, status) VALUES
('txn_001', 'comp_test', 'user_client', 'receipts/2024/01/sample1.jpg', '2024-01-15T10:30:00Z', '2024-01-15', 1500, 'JR東日本', '旅費交通費', '課対仕入内10%', 95, 'confirmed'),
('txn_002', 'comp_test', 'user_client', 'receipts/2024/01/sample2.jpg', '2024-01-16T14:20:00Z', '2024-01-16', 3200, 'スターバックス', '会議費', '課対仕入内10%', 88, 'confirmed'),
('txn_003', 'comp_test', 'user_client', 'receipts/2024/01/sample3.jpg', '2024-01-17T09:15:00Z', '2024-01-17', 12800, '文具店', '消耗品費', '課対仕入内10%', 62, 'pending');
