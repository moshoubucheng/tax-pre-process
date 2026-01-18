-- Migration: Add admin_note field for on_hold messages
-- Run with: wrangler d1 execute tax-db --file=./src/db/migrations/005_add_admin_note.sql

-- Add admin_note column for admin to send message to client
ALTER TABLE transactions ADD COLUMN admin_note TEXT;
