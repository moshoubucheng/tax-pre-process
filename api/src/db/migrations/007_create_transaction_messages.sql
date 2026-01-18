-- Migration: Create transaction_messages table for conversation history
-- This allows admin and client to have a dialogue about a transaction

CREATE TABLE IF NOT EXISTS transaction_messages (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK(role IN ('admin', 'client')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for fast lookup by transaction
CREATE INDEX idx_transaction_messages_transaction_id ON transaction_messages(transaction_id);
