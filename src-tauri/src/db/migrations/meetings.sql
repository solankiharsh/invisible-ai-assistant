-- Meeting records (auto-saved from audio capture sessions)
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  transcript TEXT NOT NULL DEFAULT '',
  summary TEXT,
  notes TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER DEFAULT 0,
  participants TEXT,
  calendar_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('recording', 'processing', 'completed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes for meetings
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_calendar_event ON meetings(calendar_event_id);
