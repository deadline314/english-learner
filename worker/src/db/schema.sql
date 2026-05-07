-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  email_verified INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- User Settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  accent TEXT DEFAULT 'us',
  theme TEXT DEFAULT 'system',
  daily_goal INTEGER DEFAULT 20,
  interface_lang TEXT DEFAULT 'zh-TW',
  definition_lang TEXT DEFAULT 'both',
  show_phonetic INTEGER DEFAULT 1,
  show_etymology INTEGER DEFAULT 1,
  auto_play_audio INTEGER DEFAULT 0,
  keyboard_shortcuts INTEGER DEFAULT 1,
  level TEXT DEFAULT 'intermediate',
  learning_goal TEXT DEFAULT 'exam'
);

-- User Streaks
CREATE TABLE IF NOT EXISTS user_streaks (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date TEXT,
  total_days INTEGER DEFAULT 0
);

-- Words
CREATE TABLE IF NOT EXISTS words (
  word_id INTEGER PRIMARY KEY,
  word TEXT NOT NULL,
  phonetic TEXT,
  part_of_speech TEXT,
  definitions_json TEXT NOT NULL,
  analysis_json TEXT,
  collocation TEXT,
  examples_json TEXT,
  word_family_json TEXT,
  secondary_meaning_note TEXT,
  difficulty INTEGER DEFAULT 3,
  frequency_rank INTEGER
);
CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);
CREATE INDEX IF NOT EXISTS idx_words_difficulty ON words(difficulty);
CREATE INDEX IF NOT EXISTS idx_words_frequency ON words(frequency_rank);

-- Grammar Topics
CREATE TABLE IF NOT EXISTS grammar_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  level INTEGER DEFAULT 3,
  explanation_md TEXT
);

-- Grammar Questions
CREATE TABLE IF NOT EXISTS grammar_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER REFERENCES grammar_topics(id),
  question_type TEXT NOT NULL,
  question TEXT NOT NULL,
  options_json TEXT,
  correct_answer TEXT NOT NULL,
  explanation TEXT
);
CREATE INDEX IF NOT EXISTS idx_grammar_questions_topic ON grammar_questions(topic_id);

-- Phrases
CREATE TABLE IF NOT EXISTS phrases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phrase TEXT NOT NULL,
  meaning_zh TEXT,
  meaning_en TEXT,
  examples_json TEXT,
  category TEXT
);
CREATE INDEX IF NOT EXISTS idx_phrases_category ON phrases(category);

-- User Word Progress (SRS)
CREATE TABLE IF NOT EXISTS user_word_progress (
  user_id TEXT NOT NULL,
  word_id INTEGER NOT NULL,
  srs_level INTEGER DEFAULT 0,
  ease_factor REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 0,
  next_review_at INTEGER NOT NULL,
  total_seen INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_wrong INTEGER DEFAULT 0,
  last_seen_at INTEGER,
  last_result INTEGER,
  PRIMARY KEY (user_id, word_id)
);
CREATE INDEX IF NOT EXISTS idx_uwp_review ON user_word_progress(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_uwp_srs ON user_word_progress(user_id, srs_level);

-- User Grammar Progress
CREATE TABLE IF NOT EXISTS user_grammar_progress (
  user_id TEXT NOT NULL,
  question_id INTEGER NOT NULL,
  srs_level INTEGER DEFAULT 0,
  ease_factor REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 0,
  next_review_at INTEGER NOT NULL,
  total_seen INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_wrong INTEGER DEFAULT 0,
  last_seen_at INTEGER,
  last_result INTEGER,
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_ugp_review ON user_grammar_progress(user_id, next_review_at);

-- User Phrase Progress
CREATE TABLE IF NOT EXISTS user_phrase_progress (
  user_id TEXT NOT NULL,
  phrase_id INTEGER NOT NULL,
  srs_level INTEGER DEFAULT 0,
  ease_factor REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 0,
  next_review_at INTEGER NOT NULL,
  total_seen INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_wrong INTEGER DEFAULT 0,
  last_seen_at INTEGER,
  last_result INTEGER,
  PRIMARY KEY (user_id, phrase_id)
);
CREATE INDEX IF NOT EXISTS idx_upp_review ON user_phrase_progress(user_id, next_review_at);

-- Practice Sessions
CREATE TABLE IF NOT EXISTS practice_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  mode TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  total_questions INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON practice_sessions(user_id, started_at DESC);

-- Wrong Answers
CREATE TABLE IF NOT EXISTS wrong_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  user_answer TEXT,
  correct_answer TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  mastered INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_wrong_user ON wrong_answers(user_id, mastered, created_at DESC);

-- Daily Activity (for heatmap/stats)
CREATE TABLE IF NOT EXISTS daily_activity (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  questions_answered INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
