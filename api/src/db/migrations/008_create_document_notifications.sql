-- Migration: Create document_notifications table for admin notifications
-- This allows the admin to see notifications when clients upload files or submit documents

CREATE TABLE IF NOT EXISTS document_notifications (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('submitted', 'file_uploaded')),
  field_name TEXT,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for fast lookup by read status and creation date
CREATE INDEX idx_doc_notif_is_read ON document_notifications(is_read);
CREATE INDEX idx_doc_notif_created_at ON document_notifications(created_at DESC);
