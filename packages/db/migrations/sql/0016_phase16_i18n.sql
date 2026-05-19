-- Phase 16: i18n columns on messages.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS translated_body text,
  ADD COLUMN IF NOT EXISTS translated_to text;

-- Helpful for "messages in language X" filters later.
CREATE INDEX IF NOT EXISTS messages_language_idx
  ON messages (tenant_id, language)
  WHERE language IS NOT NULL;
