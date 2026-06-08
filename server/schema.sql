-- Run this SQL in your PostgreSQL database to set up the schema.
-- You can run it with: psql $DATABASE_URL -f schema.sql
-- Or paste into Supabase / Neon SQL editor.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid  TEXT UNIQUE NOT NULL,
  email         TEXT,
  display_name  TEXT,
  photo_url     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS designs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Untitled Design',
  canvas_json   JSONB DEFAULT '{}',
  thumbnail_url TEXT,
  width         INT NOT NULL DEFAULT 1200,
  height        INT NOT NULL DEFAULT 800,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cloudinary_url      TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  file_type           TEXT,
  original_filename   TEXT,
  bytes               INT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER designs_updated_at
  BEFORE UPDATE ON designs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_designs_user_id ON designs(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);

ALTER TABLE assets
ADD COLUMN duration INT;

ALTER TABLE assets
ADD COLUMN resource_type TEXT;
