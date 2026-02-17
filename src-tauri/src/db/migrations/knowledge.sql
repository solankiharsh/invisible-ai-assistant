-- Knowledge items (auto-indexed from conversations and transcriptions)
CREATE TABLE IF NOT EXISTS knowledge_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('conversation', 'transcription', 'page')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  source_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Embeddings for semantic search (stored as JSON array of floats)
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE
);

-- Tags (auto-generated and manual)
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  is_auto INTEGER DEFAULT 0
);

-- Item-tag relationships
CREATE TABLE IF NOT EXISTS item_tags (
  item_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (item_id, tag_id),
  FOREIGN KEY (item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Projects for manual organization
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Project-item relationships
CREATE TABLE IF NOT EXISTS project_items (
  project_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  PRIMARY KEY (project_id, item_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE
);

-- Pages (Notion-like documents from conversations)
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  source_item_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (source_item_id) REFERENCES knowledge_items(id)
);

-- Indexes for knowledge_items
CREATE INDEX IF NOT EXISTS idx_knowledge_items_type ON knowledge_items(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_updated_at ON knowledge_items(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_source_id ON knowledge_items(source_id);

-- Index for embeddings lookups
CREATE INDEX IF NOT EXISTS idx_embeddings_item_id ON embeddings(item_id);

-- Index for item_tags
CREATE INDEX IF NOT EXISTS idx_item_tags_tag_id ON item_tags(tag_id);

-- Index for project_items
CREATE INDEX IF NOT EXISTS idx_project_items_item_id ON project_items(item_id);

-- Full-text search virtual table (standalone; app will sync on insert/update/delete)
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  title,
  content,
  summary,
  content='knowledge_items',
  content_rowid='rowid'
);

-- Triggers to keep knowledge_fts in sync with knowledge_items
CREATE TRIGGER IF NOT EXISTS knowledge_fts_insert AFTER INSERT ON knowledge_items BEGIN
  INSERT INTO knowledge_fts(rowid, title, content, summary)
  VALUES (NEW.rowid, NEW.title, NEW.content, NEW.summary);
END;
CREATE TRIGGER IF NOT EXISTS knowledge_fts_delete AFTER DELETE ON knowledge_items BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content, summary)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.summary);
END;
CREATE TRIGGER IF NOT EXISTS knowledge_fts_update AFTER UPDATE ON knowledge_items BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content, summary)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.summary);
  INSERT INTO knowledge_fts(rowid, title, content, summary)
  VALUES (NEW.rowid, NEW.title, NEW.content, NEW.summary);
END;
