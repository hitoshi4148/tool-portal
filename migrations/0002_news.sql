-- ポータル「ニュース」用。既存の PESTICIDES_DB に足す。

CREATE TABLE IF NOT EXISTS news_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL,
  original_url TEXT NOT NULL UNIQUE,
  published_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_items_published ON news_items (published_at);

CREATE TABLE IF NOT EXISTS news_fetch_state (
  source_key TEXT PRIMARY KEY,
  fetched_on TEXT NOT NULL
);
