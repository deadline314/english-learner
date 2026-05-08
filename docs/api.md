# API 參考

[← 返回首頁](./README.md) | [前端](./frontend.md) | [後端](./backend.md)

## 基本資訊

| 項目 | 值 |
|------|----|
| Base URL | `https://english-learner.org/api` |
| Content-Type | `application/json` |
| 認證 | `Authorization: Bearer <jwt>` |
| 限流 | KV-based sliding window |

## 錯誤回應格式

```json
{
  "error": "Error message in English",
  "details": "Optional details"
}
```

| HTTP 狀態 | 說明 |
|-----------|------|
| 400 | 請求格式錯誤 |
| 401 | 未認證/Token 無效 |
| 404 | 資源不存在 |
| 429 | 請求過於頻繁 |
| 500 | 伺服器錯誤 |

---

## Auth Routes (`/api/auth`)

### POST `/register`

**限流:** 5 requests / 60s

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "User Name"
}
```

**Response:** `201`
```json
{
  "message": "Verification code sent",
  "userId": "uuid"
}
```

---

### POST `/verify`

**Request:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response:** `200`
```json
{
  "token": "jwt-string",
  "userId": "uuid"
}
```

**行為:** 驗證成功後自動登入 (回傳 JWT)

---

### POST `/login`

**限流:** 10 requests / 60s

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "rememberMe": true
}
```

**Response:** `200`
```json
{
  "token": "jwt-string",
  "userId": "uuid",
  "displayName": "User",
  "avatarUrl": "/api/user/avatar/key"
}
```

**有效期:** rememberMe=true → 30天, false → 7天

---

### POST `/logout`

**需認證:** ✓

**行為:** 將 token 加入 KV 黑名單 (TTL = token 剩餘有效期)

---

### POST `/resend-code`

**限流:** 3 requests / 60s

**Request:**
```json
{ "email": "user@example.com" }
```

---

### POST `/forgot-password`

**限流:** 3 requests / 300s

**Request:**
```json
{ "email": "user@example.com" }
```

**行為:** 寄送含 reset token 的連結 (1hr TTL)

---

### POST `/reset-password`

**Request:**
```json
{
  "token": "reset-token",
  "password": "newPassword123"
}
```

---

## Practice Routes (`/api/practice`)

### GET `/today`

**需認證:** ✓

**Query Parameters:**
| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| mode | string | ✓ | word/grammar/phrase/mixed/toeic |
| count | number | ✗ | 題數 (預設 20) |
| types | string | ✗ | 題型 (逗號分隔, 僅 mode=word) |

**Response:** `200`
```json
{
  "items": [
    {
      "id": 42,
      "type": "word",
      "word": "abandon",
      "phonetic": "/əˈbæn.dən/",
      "pos": "verb",
      "definitionZh": "放棄",
      "definitionEn": "to leave behind",
      "exampleSentence": "They abandoned the project.",
      "exampleTranslation": "他們放棄了這個計畫。",
      "etymology": "ab- (away) + bandon (control)",
      "secondaryMeaningNote": "也可指被遺棄的建築物",
      "options": ["放棄", "擁抱", "延遲", "確認"],
      "questionType": "en-to-zh"
    }
  ],
  "total": 20,
  "due": 5,
  "new": 15
}
```

**Options 生成邏輯:**
- `en-to-zh`: 4 個中文釋義 (1正確 + 3隨機同等級)
- `zh-to-en`: 4 個英文單字
- `fill-blank`: 4 個單字 (例句中挖空)
- `listen`: 同 en-to-zh (自動播放 TTS)
- `secondary-meaning`: 特殊意義選項

---

### POST `/submit`

**需認證:** ✓

**Request:**
```json
{
  "mode": "word",
  "answers": [
    {
      "itemId": 42,
      "itemType": "word",
      "correct": true,
      "questionType": "en-to-zh",
      "userAnswer": "放棄",
      "timeTaken": 3200
    }
  ],
  "totalTime": 120
}
```

**Response:** `200`
```json
{
  "message": "Submitted",
  "correct": 18,
  "wrong": 2,
  "streak": { "current": 5, "longest": 12 }
}
```

**副作用:**
1. 更新 user_progress (SRS level + next_review_at)
2. 記錄 wrong_answers (答錯時)
3. UPSERT daily_activity
4. 記錄 practice_sessions
5. 更新 user_streaks

---

### GET `/words`

**需認證:** ✓

**Query Parameters:**
| 參數 | 型別 | 預設 | 說明 |
|------|------|------|------|
| page | number | 1 | 頁碼 |
| limit | number | 100 | 每頁筆數 |
| search | string | — | 模糊搜尋 (word/definition_zh) |
| level | string | — | 篩選等級 |

**Response:** `200`
```json
{
  "items": [...],
  "total": 3270,
  "page": 1,
  "totalPages": 33
}
```

---

### POST `/bookmark`

**需認證:** ✓

**Request:**
```json
{
  "itemType": "word",
  "itemId": 42,
  "bookmarkType": "wrong"
}
```

**行為:** Toggle — 已存在則刪除，不存在則新增

---

### GET `/bookmarks`

**需認證:** ✓

**Query Parameters:**
| 參數 | 型別 | 說明 |
|------|------|------|
| type | string | wrong/seen |
| itemType | string | word/grammar/phrase |

---

### GET `/bookmarks/status`

**需認證:** ✓

**Query:** `?itemType=word&itemId=42&bookmarkType=wrong`

**Response:** `{ "bookmarked": true }`

---

## Progress Routes (`/api/progress`)

### GET `/dashboard`

**需認證:** ✓

**Response:** `200`
```json
{
  "vocabulary": { "due": 5, "new": 2154, "total": 3270, "mastered": 102 },
  "grammar": { "due": 0, "new": 16, "total": 2000, "mastered": 0 },
  "phrases": { "due": 3, "new": 201, "total": 2958, "mastered": 45 },
  "streak": { "current": 5, "longest": 12 },
  "today": { "questions": 40, "correct": 35, "goal": 20 },
  "weeklyActivity": [
    { "date": "2026-05-05", "questions": 25, "correct": 22 },
    ...
  ],
  "recentMistakes": [...]
}
```

**平行查詢 (10 statements via D1 batch):**
1. due words count
2. new words count
3. due grammar count
4. new grammar count
5. due phrases count
6. new phrases count
7. today's activity
8. user_streaks
9. 7-day activity
10. last 5 wrong answers

---

### GET `/wrong`

**Query:** `?type=word&filter=all&page=1&limit=20`

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "itemType": "word",
      "itemId": 42,
      "word": "abandon",
      "phonetic": "/əˈbæn.dən/",
      "definitions": "放棄",
      "userAnswer": "擁抱",
      "correctAnswer": "放棄",
      "mastered": 0,
      "createdAt": 1715126400
    }
  ],
  "total": 15
}
```

---

### DELETE `/wrong/clear/:type`

清空特定類型全部錯題 (word/grammar/phrase)

---

### DELETE `/seen/clear/:type`

清空特定類型全部進度

---

### POST `/wrong/:id/master`

標記錯題為已掌握 (mastered = 1)

---

### DELETE `/wrong/:id`

刪除單筆錯題記錄

---

### DELETE `/seen/:type/:id`

刪除單筆進度記錄 (user_progress)

---

### GET `/seen`

**Query:** `?type=word&page=1&limit=20`

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "itemType": "word",
      "itemId": 42,
      "word": "abandon",
      "phonetic": "/əˈbæn.dən/",
      "definitions": "放棄",
      "srsLevel": 3,
      "totalSeen": 8,
      "totalCorrect": 6,
      "totalWrong": 2,
      "nextReviewAt": 1715212800000,
      "lastSeenAt": 1715126400000
    }
  ],
  "total": 150
}
```

---

### GET `/stats`

**Response:**
```json
{
  "dailyActivity": [{ "date": "2026-05-01", "questions": 20, "correct": 18 }, ...],
  "typeDistribution": { "word": 450, "grammar": 200, "phrase": 350 },
  "srsDistribution": [0, 12, 25, 38, 15, 8, 4, 2],
  "hardestWords": [{ "word": "ubiquitous", "wrongRate": 0.75 }, ...],
  "totalStats": { "totalQuestions": 1000, "totalCorrect": 850, "accuracy": 0.85 }
}
```

---

## User Routes (`/api/user`)

### GET `/me`

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "displayName": "User",
  "avatarUrl": "/api/user/avatar/key",
  "settings": {
    "accent": "us",
    "theme": "dark",
    "dailyGoal": 20,
    "interfaceLang": "zh-TW",
    "definitionLang": "zh",
    "showPhonetic": true,
    "showEtymology": true,
    "autoPlayAudio": false,
    "keyboardShortcuts": true,
    "enabledQuestionTypes": "zh-to-en,en-to-zh,fill-blank,listen",
    "level": "B1",
    "learningGoal": "general"
  }
}
```

---

### PATCH `/settings`

**Request (partial):**
```json
{
  "accent": "uk",
  "dailyGoal": 30,
  "enabledQuestionTypes": "zh-to-en,en-to-zh"
}
```

**行為:** UPSERT — 若 user_settings 不存在則 INSERT

---

### PATCH `/profile`

**Request:**
```json
{ "displayName": "New Name" }
```

---

### POST `/avatar`

**Content-Type:** `multipart/form-data`

**Body:** FormData with `file` field (max 2MB, image/*)

**Response:**
```json
{ "avatarUrl": "/api/user/avatar/uuid-filename.jpg" }
```

---

### GET `/avatar/:key`

**Response:** Binary image with `Cache-Control: public, max-age=86400`

---

### POST `/onboarding`

**Request:**
```json
{
  "level": "B1",
  "learningGoal": "toeic",
  "dailyGoal": 30,
  "accent": "us"
}
```

---

## Health Check

### GET `/api/health`

**Response:** `200`
```json
{ "status": "ok", "timestamp": 1715126400000 }
```

相關文件：[前端](./frontend.md) | [後端](./backend.md) | [資料庫](./database.md)
