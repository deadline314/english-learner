-- Migration: Add secondary_meaning_note column to words table
ALTER TABLE words ADD COLUMN secondary_meaning_note TEXT;
