-- Pipeline tables for Level-4 auto-ingestion
-- Run in Supabase Dashboard > SQL Editor

-- Processed video log (dedup + audit trail)
CREATE TABLE IF NOT EXISTS pipeline_videos (
  id           BIGSERIAL PRIMARY KEY,
  video_id     TEXT UNIQUE NOT NULL,
  creator_id   TEXT NOT NULL,
  title        TEXT,
  status       TEXT DEFAULT 'done',   -- done | failed | skipped
  moments_count INT DEFAULT 0,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generated visits (mirrors visits.json rows)
CREATE TABLE IF NOT EXISTS creator_visits (
  id          BIGSERIAL PRIMARY KEY,
  creator_id  TEXT NOT NULL,
  video_id    TEXT,
  place       TEXT,
  city        TEXT,
  region      TEXT,
  spot        TEXT,
  views       INT DEFAULT 0,
  reason      TEXT,
  video_url   TEXT,
  uploaded    TEXT,
  confidence  TEXT DEFAULT 'ai-generated',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Moments within each visit
CREATE TABLE IF NOT EXISTS creator_moments (
  id          BIGSERIAL PRIMARY KEY,
  visit_id    BIGINT REFERENCES creator_visits(id) ON DELETE CASCADE,
  num         INT,
  type        TEXT,
  title       TEXT,
  description TEXT,
  place_name  TEXT,
  lat         REAL,
  lng         REAL,
  emotion     TEXT[],
  replay_cost TEXT,
  replay_tip  TEXT
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_visits_creator ON creator_visits(creator_id);
CREATE INDEX IF NOT EXISTS idx_moments_visit  ON creator_moments(visit_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_vid   ON pipeline_videos(video_id);

-- RLS: allow anon to read (so frontend can query Supabase directly later)
ALTER TABLE creator_visits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read visits"  ON creator_visits  FOR SELECT USING (true);
CREATE POLICY "public read moments" ON creator_moments FOR SELECT USING (true);
-- Writes only via service_role key (pipeline)
