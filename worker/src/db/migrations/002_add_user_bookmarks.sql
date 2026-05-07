CREATE TABLE IF NOT EXISTS user_bookmarks (
  user_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  bookmark_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_type, item_id, bookmark_type)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON user_bookmarks(user_id, bookmark_type);
