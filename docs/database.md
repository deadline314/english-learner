# 資料庫文件

[← 返回首頁](./README.md) | [後端](./backend.md) | [API 參考](./api.md)

## 資料庫選型

| 服務 | 用途 | 免費額度 |
|------|------|---------|
| Cloudflare D1 | 主要關聯式資料 | 5M reads/day, 100K writes/day |
| Cloudflare KV | 短暫資料 (驗證碼/黑名單) | 100K reads/day, 1K writes/day |
| Cloudflare R2 | 物件儲存 (頭像) | 10M Class A, 10M Class B/month |

## Schema (13 表)

### users

| 欄位 | 型別 | 限制 | 說明 |
|------|------|------|------|
| id | TEXT | PK | UUID |
| email | TEXT | UNIQUE, NOT NULL | 信箱 |
| password_hash | TEXT | NOT NULL | PBKDF2 雜湊 (`salt:hash`) |
| display_name | TEXT | — | 顯示名稱 |
| avatar_key | TEXT | — | R2 物件 key |
| email_verified | INTEGER | DEFAULT 0 | 0/1 |
| created_at | INTEGER | NOT NULL | Unix timestamp (ms) |

### words

| 欄位 | 型別 | 限制 | 說明 |
|------|------|------|------|
| id | INTEGER | PK AUTOINCREMENT | — |
| word | TEXT | NOT NULL | 英文單字 |
| phonetic | TEXT | — | 音標 |
| pos | TEXT | — | 詞性 (noun/verb/adj...) |
| definition_zh | TEXT | NOT NULL | 中文釋義 |
| definition_en | TEXT | — | 英文釋義 |
| example_sentence | TEXT | — | 例句 |
| example_translation | TEXT | — | 例句中文翻譯 |
| etymology | TEXT | — | 字源/字根分析 |
| level | TEXT | DEFAULT 'B1' | CEFR 等級 |
| tags | TEXT | — | 標籤 (逗號分隔) |
| toeic_rank | INTEGER | — | TOEIC 重要度 |
| secondary_meaning_note | TEXT | — | 次要意義補充 |

### grammar_questions

| 欄位 | 型別 | 限制 | 說明 |
|------|------|------|------|
| id | INTEGER | PK AUTOINCREMENT | — |
| topic | TEXT | NOT NULL | 文法主題 |
| question | TEXT | NOT NULL | 題目 |
| options | TEXT | NOT NULL | JSON array (4選項) |
| correct_answer | INTEGER | NOT NULL | 正確選項 index (0-3) |
| explanation | TEXT | — | 解題說明 |
| level | TEXT | DEFAULT 'B1' | — |

### phrases

| 欄位 | 型別 | 限制 | 說明 |
|------|------|------|------|
| id | INTEGER | PK AUTOINCREMENT | — |
| phrase | TEXT | NOT NULL | 片語 |
| definition_zh | TEXT | NOT NULL | 中文釋義 |
| definition_en | TEXT | — | 英文釋義 |
| example_sentence | TEXT | — | 例句 |
| example_translation | TEXT | — | 翻譯 |
| category | TEXT | — | 分類 |
| level | TEXT | DEFAULT 'B1' | — |

### user_progress

| 欄位 | 型別 | 限制 | 說明 |
|------|------|------|------|
| id | INTEGER | PK AUTOINCREMENT | — |
| user_id | TEXT | NOT NULL | → users.id |
| item_type | TEXT | NOT NULL | 'word' / 'grammar' / 'phrase' |
| item_id | INTEGER | NOT NULL | → words/grammar_questions/phrases.id |
| srs_level | INTEGER | DEFAULT 0 | 0-7 |
| ease_factor | REAL | DEFAULT 2.5 | 容易度因子 |
| next_review_at | INTEGER | — | 下次複習 Unix timestamp (ms) |
| total_seen | INTEGER | DEFAULT 0 | 看過次數 |
| total_correct | INTEGER | DEFAULT 0 | 正確次數 |
| total_wrong | INTEGER | DEFAULT 0 | 錯誤次數 |
| last_seen_at | INTEGER | — | 最後看到時間 |
| created_at | INTEGER | NOT NULL | 建立時間 |

**UNIQUE**: `(user_id, item_type, item_id)`

### wrong_answers

| 欄位 | 型別 | 限制 | 說明 |
|------|------|------|------|
| id | INTEGER | PK AUTOINCREMENT | — |
| user_id | TEXT | NOT NULL | — |
| item_type | TEXT | NOT NULL | 'word' / 'grammar' / 'phrase' |
| item_id | INTEGER | NOT NULL | — |
| user_answer | TEXT | — | 使用者選的答案 |
| correct_answer | TEXT | — | 正確答案 |
| created_at | INTEGER | NOT NULL | — |
| mastered | INTEGER | DEFAULT 0 | 是否已掌握 |

### user_settings

| 欄位 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| user_id | TEXT | PK | — |
| accent | TEXT | `'us'` | 口音偏好 |
| theme | TEXT | `'system'` | 主題 |
| daily_goal | INTEGER | `20` | 每日目標題數 |
| interface_lang | TEXT | `'zh-TW'` | 介面語言 |
| definition_lang | TEXT | `'zh'` | 釋義語言 |
| show_phonetic | INTEGER | `1` | 顯示音標 |
| show_etymology | INTEGER | `1` | 顯示字源 |
| auto_play_audio | INTEGER | `0` | 自動播放 |
| keyboard_shortcuts | INTEGER | `1` | 鍵盤快捷鍵 |
| enabled_question_types | TEXT | `'zh-to-en,en-to-zh,fill-blank,listen'` | 啟用題型 |
| level | TEXT | `'B1'` | 使用者等級 |
| learning_goal | TEXT | `'general'` | 學習目標 |

### user_streaks

| 欄位 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| user_id | TEXT | PK | — |
| current_streak | INTEGER | `0` | 目前連續天數 |
| longest_streak | INTEGER | `0` | 最長連續天數 |
| last_practice_date | TEXT | — | YYYY-MM-DD |

### daily_activity

| 欄位 | 型別 | 限制 | 說明 |
|------|------|------|------|
| user_id | TEXT | NOT NULL | — |
| date | TEXT | NOT NULL | YYYY-MM-DD |
| total_questions | INTEGER | DEFAULT 0 | 今日總題數 |
| correct_answers | INTEGER | DEFAULT 0 | 今日正確數 |

**PRIMARY KEY**: `(user_id, date)`

### practice_sessions

| 欄位 | 型別 | 限制 | 說明 |
|------|------|------|------|
| id | INTEGER | PK AUTOINCREMENT | — |
| user_id | TEXT | NOT NULL | — |
| mode | TEXT | NOT NULL | practice mode |
| total_questions | INTEGER | NOT NULL | — |
| correct_answers | INTEGER | NOT NULL | — |
| duration_seconds | INTEGER | — | 花費秒數 |
| created_at | INTEGER | NOT NULL | — |

### user_bookmarks

| 欄位 | 型別 | 限制 | 說明 |
|------|------|------|------|
| user_id | TEXT | NOT NULL | — |
| item_type | TEXT | NOT NULL | 'word' / 'grammar' / 'phrase' |
| item_id | INTEGER | NOT NULL | — |
| bookmark_type | TEXT | NOT NULL | 'seen' / 'wrong' |
| created_at | INTEGER | NOT NULL | — |

**PRIMARY KEY**: `(user_id, item_type, item_id, bookmark_type)`

### email_verification (僅 KV)

| Key | TTL | Value |
|-----|-----|-------|
| `verify:<email>` | 10 min | JSON `{ code, attempts }` |
| `reset:<token>` | 1 hr | `userId` |
| `blacklist:<jwt>` | 7-30 days | `'1'` |
| `rl:<ip>:<path>` | window s | count |

## SRS 演算法

檔案：`worker/src/services/srs.ts`

### 等級與間隔

| Level | 間隔 (分鐘) | 間隔 (人話) |
|-------|-------------|------------|
| 0 → 1 | 0 | 立即 |
| 1 → 2 | 60 | 1 小時 |
| 2 → 3 | 360 | 6 小時 |
| 3 → 4 | 1440 | 1 天 |
| 4 → 5 | 4320 | 3 天 |
| 5 → 6 | 10080 | 7 天 |
| 6 → 7 | 20160 | 14 天 |
| 7 (max) | 43200 | 30 天 |

### 計算函式

```typescript
function calculateSrs(
  correct: boolean,
  currentLevel: number,
  easeFactor: number
): { newLevel: number; newEase: number; nextReviewAt: number }
```

**答對:**
- level +1 (最高 7)
- ease +0.1 (最高 3.0)
- 下次複習 = now + intervals[newLevel] × ease × 60000 (ms)

**答錯:**
- level 回到 0
- ease -0.2 (最低 1.3)
- 下次複習 = now (立即可複習)

## 索引

```sql
CREATE INDEX idx_user_progress_user ON user_progress(user_id);
CREATE INDEX idx_user_progress_review ON user_progress(user_id, next_review_at);
CREATE INDEX idx_user_progress_item ON user_progress(user_id, item_type, item_id);
CREATE INDEX idx_wrong_answers_user ON wrong_answers(user_id, item_type);
CREATE INDEX idx_daily_activity_user ON daily_activity(user_id, date);
```

## 資料量

| 表 | 筆數 | 說明 |
|----|------|------|
| words | ~3,270 | A1-C1 全等級 |
| grammar_questions | ~2,000 | 100 主題 |
| phrases | ~2,958 | 日常 + 商業 |

相關文件：[資料管線](./data-pipeline.md) | [後端](./backend.md)
