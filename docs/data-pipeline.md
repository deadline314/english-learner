# 資料管線

[← 返回首頁](./README.md) | [資料庫](./database.md) | [部署指南](./deployment.md)

## 概觀

```
JSON 資源 (resource/*.json)
     │
     ▼  scripts/gen_*.py (Claude API 生成)
     │
resource/*.json (詞彙/文法/片語)
     │
     ▼  scripts/gen_seed.py (彙整+去重+SQL)
     │
worker/src/db/seed.sql (~3MB)
     │
     ▼  scripts/split_seed.py (分割)
     │
worker/src/db/seed_parts/seed_000.sql ~ seed_043.sql
     │
     ▼  wrangler d1 execute --remote (逐個上傳)
     │
Cloudflare D1 Database
```

## Python 腳本一覽

### 詞彙生成腳本 (34 個)

| 腳本 | 來源 | 輸出 | 說明 |
|------|------|------|------|
| `gen_jk.py` | 內嵌資料 | `vocab_jk.json` | 國中 J/K 等級 |
| `gen_h.py` | 內嵌資料 | `vocab_h.json` | 高中等級 |
| `gen_i1.py` ~ `gen_i4.py` | 內嵌資料 | `vocab_i1.json` ~ `vocab_i4.json` | 中級 1-4 |
| `gen_l1.py` ~ `gen_l2.py` | 內嵌資料 | `vocab_l1.json` ~ `vocab_l2.json` | 進階 1-2 |
| `gen_m1.py` ~ `gen_m3.py` | 內嵌資料 | `vocab_m1.json` ~ `vocab_m2.json` | 高階 1-3 |
| `gen_vocab.py` | 內嵌資料 | `vocabulary.json` | B1 核心詞彙 |
| `gen_vocab_a.py` | 內嵌資料 | `vocabulary_a1.json` | A 系列 |
| `gen_vocab_a2.py` ~ `gen_vocab_a4.py` | 內嵌資料 | `vocabulary_a2.json` ~ `vocabulary_a4.json` | A 系列延伸 |
| `gen_vocab_c1.py` | 內嵌資料 | `vocabulary_c1.json` | C1 進階 |
| `gen_vocab_s1.py` ~ `gen_vocab_s3.py` | 內嵌資料 | — | 特殊主題 |

**腳本結構模板:**
```python
import anthropic, json

client = anthropic.Anthropic()
WORDS = [...]  # 內嵌 500-1000 單字列表

for batch in chunks(WORDS, 50):
    response = client.messages.create(
        model="claude-3-haiku-20240307",
        messages=[{
            "role": "user",
            "content": f"For each word, provide: phonetic, pos, definition_zh, ..."
        }]
    )
    results.extend(parse(response))

with open(f"resource/vocab_XX.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
```

### 核心管線腳本

#### gen_seed.py (248 行)

**功能:** 讀取所有 `resource/*.json`，去重，生成 `seed.sql`

**關鍵函式:**

| 函式 | 說明 |
|------|------|
| `build_word_map()` | 讀取所有 vocab JSON，以 word 為 key 去重，分離 phrase |
| `generate_words_sql(word_map)` | 生成 INSERT INTO words 語句 |
| `generate_phrases_sql(phrase_overflow)` | 生成 INSERT INTO phrases 語句 |
| `generate_grammar_sql()` | 讀取 grammar JSON 生成文法題 |
| `escape_sql(s)` | SQL 字串跳脫 (單引號) |

**單字 vs. 片語分類邏輯:**
```python
def build_word_map():
    word_map = {}
    phrase_overflow = []
    for filepath in json_files:
        for item in json.load(open(filepath)):
            word = item["word"].strip().lower()
            if " " in word:  # 含空格 → 視為片語
                phrase_overflow.append(item)
            else:
                word_map[word] = item  # 去重 (後者覆蓋)
    return word_map, phrase_overflow
```

**JSON 檔讀取順序 (priority, 後載入者覆蓋):**
1. `vocabulary.json`, `vocabulary_a1.json` ~ `vocabulary_a4.json`
2. `vocabulary_c1.json`
3. `vocab_jk.json`, `vocab_h.json`
4. `vocab_i1.json` ~ `vocab_i4.json`
5. `vocab_l1.json` ~ `vocab_l2.json`
6. `vocab_m1.json` ~ `vocab_m2.json`

#### split_seed.py (45 行)

**功能:** 將 `seed.sql` 分割為 ≤500 語句的檔案

```python
MAX_STATEMENTS_PER_FILE = 500

statements = seed_sql.split(";\n")
for i, chunk in enumerate(chunks(statements, MAX_STATEMENTS_PER_FILE)):
    with open(f"seed_parts/seed_{i:03d}.sql", "w") as f:
        f.write(";\n".join(chunk) + ";")
```

**輸出:** `worker/src/db/seed_parts/seed_000.sql` ~ `seed_043.sql` (44 檔)

## 資源檔 (resource/)

### JSON 格式

#### 詞彙 (vocabulary*.json, vocab*.json)

```json
[
  {
    "word": "abandon",
    "phonetic": "/əˈbæn.dən/",
    "pos": "verb",
    "definition_zh": "放棄；遺棄",
    "definition_en": "to leave completely and finally",
    "example_sentence": "They abandoned the sinking ship.",
    "example_translation": "他們放棄了正在下沉的船。",
    "etymology": "Old French 'a bandon' (under one's control)",
    "level": "B1",
    "tags": "formal,academic",
    "secondary_meaning_note": "n. 放縱，放任"
  }
]
```

#### 文法 (grammar_questions in vocabulary.json)

```json
{
  "topic": "Present Perfect",
  "question": "I ___ (live) here for ten years.",
  "options": ["have lived", "lived", "am living", "was living"],
  "correct_answer": 0,
  "explanation": "Present perfect for duration with 'for'",
  "level": "B1"
}
```

### PDF 資源 (僅供參考)

| 檔案 | 內容 |
|------|------|
| `A2單字表.pdf` | A2 等級單字表 (來源參考) |
| `B1單字表.pdf` | B1 等級單字表 |
| `多益單字表.pdf` | TOEIC 常見單字 |

### 其他資源

| 檔案 | 內容 |
|------|------|
| `常見字尾.md` | 英文常見字尾整理 (教學參考) |

## 執行方式

### 生成新詞彙

```bash
# 需要 ANTHROPIC_API_KEY 環境變數
cd scripts
python gen_vocab_c1.py  # 生成 C1 詞彙
```

### 重建 seed

```bash
cd scripts
python gen_seed.py        # 輸出 worker/src/db/seed.sql
python split_seed.py      # 分割為 seed_parts/

cd ../worker
for i in $(seq -w 0 043); do
  npx wrangler d1 execute english-learner-db --remote \
    --file=src/db/seed_parts/seed_${i}.sql --yes
done
```

### 清空資料重建

```bash
cd worker
npx wrangler d1 execute english-learner-db --remote \
  --command="DELETE FROM words; DELETE FROM phrases; DELETE FROM grammar_questions;" --yes

# 然後重新執行 seed
```

## 資料統計

| 來源 | 單字數 | 去重後 |
|------|--------|--------|
| vocabulary.json | ~200 | ~200 |
| vocabulary_a1~a4.json | ~1200 | ~1100 |
| vocabulary_c1.json | ~300 | ~280 |
| vocab_jk.json | ~600 | ~550 |
| vocab_h.json | ~400 | ~350 |
| vocab_i1~i4.json | ~1200 | ~1000 |
| vocab_l1~l2.json | ~400 | ~350 |
| vocab_m1~m2.json | ~600 | ~440 |
| **合計** | **~4900** | **~3270** (去重+分類後) |

| 類型 | 最終入庫 |
|------|---------|
| 單字 (words) | ~3,270 |
| 片語 (phrases) | ~2,958 |
| 文法題 (grammar_questions) | ~2,000 |

相關文件：[資料庫](./database.md) | [部署指南](./deployment.md)
