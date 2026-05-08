# 後端文件

[← 返回首頁](./README.md) | [API 參考](./api.md) | [資料庫](./database.md)

## 目錄結構

```
worker/src/
├── index.ts           # Hono 入口 + CORS + 路由掛載 + SPA fallback
├── routes/
│   ├── auth.ts        # 認證 (209 行)
│   ├── practice.ts    # 練習 (557 行)
│   ├── progress.ts    # 進度/複習 (287 行)
│   └── user.ts        # 使用者 (150 行)
├── services/
│   ├── auth.ts        # 密碼雜湊 + JWT (74 行)
│   └── srs.ts         # 間隔重複算法 (75 行)
├── middleware/
│   └── auth.ts        # JWT 驗證 + 限流 (30 行)
└── db/
    ├── schema.sql     # DDL (190 行, 13 表)
    ├── seed.sql       # 種子資料
    ├── seed_parts/    # 分割後的種子檔 (44 檔)
    └── migrations/    # 資料庫遷移
```

## 入口 (index.ts, 40 行)

```typescript
export interface Env {
  DB: D1Database
  KV: KVNamespace
  R2: R2Bucket
  ASSETS: Fetcher
  JWT_SECRET: string
  RESEND_API_KEY: string
  RESEND_FROM: string
  FRONTEND_URL: string
}
```

**全域中間件:**
- CORS: 允許所有 origin, 方法 `GET/POST/PATCH/DELETE/OPTIONS`, max-age 86400

**路由掛載:**
| 前綴 | 模組 |
|------|------|
| `/api/auth` | authRoutes |
| `/api/practice` | practiceRoutes |
| `/api/progress` | progressRoutes |
| `/api/user` | userRoutes |
| `/api/health` | 健康檢查 (inline) |
| `*` | ASSETS (SPA fallback) |

## 中間件 (middleware/auth.ts, 30 行)

### authMiddleware

1. 從 `Authorization: Bearer <token>` 取得 token
2. 檢查 KV 黑名單 (`blacklist:<token>`)
3. 使用 `jose` 驗證 JWT
4. 設定 `c.set('userId', sub)` 供後續使用
5. 失敗回傳 401

### rateLimiter(limit, windowSeconds)

```typescript
rateLimiter(5, 60)  // 每 60 秒最多 5 次
```

使用 KV 儲存計數，key: `rl:<IP>:<path>`

## 服務層

### auth.ts (74 行)

| 函式 | 說明 |
|------|------|
| `hashPassword(password)` | PBKDF2-SHA256, 100K iterations, 16-byte salt → `saltHex:hashHex` |
| `verifyPassword(password, stored)` | 解析 salt, 重新計算, 比對 |
| `createToken(userId, secret, expiresIn)` | JWT HS256, claim: `{ sub: userId }` |
| `verifyToken(token, secret)` | 驗證 JWT, 回傳 `sub` 或 null |
| `getAuthUser(c)` | 完整驗證流程 (Bearer → blacklist → JWT) |

### srs.ts (75 行) — SM-2 改良版

詳見 [資料庫 > SRS 演算法](./database.md#srs-演算法)

## 路由模組

### auth.ts (209 行)

| # | 方法 | 路徑 | 限流 | 說明 |
|---|------|------|------|------|
| 1 | POST | `/register` | 5/60s | 註冊 + 寄驗證碼 |
| 2 | POST | `/verify` | — | 6碼驗證 (最多5次嘗試) |
| 3 | POST | `/login` | 10/60s | 登入 + JWT (7d/30d) |
| 4 | POST | `/logout` | — | Token 加入 KV 黑名單 |
| 5 | POST | `/resend-code` | 3/60s | 重發驗證碼 |
| 6 | POST | `/forgot-password` | 3/300s | 寄重設連結 (1hr TTL) |
| 7 | POST | `/reset-password` | — | 重設密碼 |

**註冊流程:**
1. 檢查 email 唯一性
2. PBKDF2 雜湊密碼
3. INSERT users + user_settings + user_streaks
4. 生成 6 碼驗證碼，存入 KV (10min TTL)
5. 透過 Resend API 寄送驗證信

### practice.ts (557 行)

| # | 方法 | 路徑 | 說明 |
|---|------|------|------|
| 1 | GET | `/today` | 取得今日練習題目 (mode: word/grammar/phrase/mixed/toeic) |
| 2 | POST | `/submit` | 提交練習答案 + SRS 更新 + 連續天數 |
| 3 | GET | `/words` | 分頁瀏覽題庫 (100/頁) |
| 4 | POST | `/bookmark` | Toggle 收藏 |
| 5 | GET | `/bookmarks` | 取得收藏列表 |
| 6 | GET | `/bookmarks/status` | 檢查單項收藏狀態 |

**GET `/today` 各模式邏輯:**

| 模式 | 數量 | 來源 |
|------|------|------|
| word | 20 | due words (SRS) + random new |
| grammar | 20 | due + random new grammar_questions |
| phrase | 20 | due + random new phrases |
| mixed | 20 | 8 words + 6 grammar + 6 phrases (shuffle) |
| toeic | 20 | toeic_rank IS NOT NULL, ordered by rank |

**POST `/submit` 流程 (最核心的 endpoint):**
1. 依 itemType 分組 (word/grammar/phrase)
2. 批次查詢現有 progress
3. 對每個答案呼叫 `calculateSrs()`
4. 生成 UPDATE/INSERT statements
5. 記錄 wrong_answers
6. 更新 daily_activity (UPSERT)
7. 記錄 practice_sessions
8. 更新 user_streaks (連續天數邏輯)
9. 全部透過 `DB.batch()` 執行

### progress.ts (287 行)

| # | 方法 | 路徑 | 說明 |
|---|------|------|------|
| 1 | GET | `/dashboard` | 首頁資料 (10 平行查詢) |
| 2 | GET | `/wrong` | 錯題列表 (分頁/篩選/JOIN) |
| 3 | DELETE | `/wrong/clear/:type` | 清空指定類型錯題 |
| 4 | DELETE | `/seen/clear/:type` | 清空指定類型進度 |
| 5 | POST | `/wrong/:id/master` | 標記為已掌握 |
| 6 | DELETE | `/wrong/:id` | 刪除單筆錯題 |
| 7 | DELETE | `/seen/:type/:id` | 刪除單筆進度 |
| 8 | GET | `/seen` | 已看題目列表 |
| 9 | GET | `/stats` | 統計資料 |

**路由順序重要:** `clear` 路由必須在 `:id`/`:type/:id` 之前，否則 "clear" 會被當作參數匹配。

### user.ts (150 行)

| # | 方法 | 路徑 | 說明 |
|---|------|------|------|
| 1 | GET | `/me` | 取得使用者資料 + 設定 |
| 2 | PATCH | `/settings` | 更新設定 (UPSERT) |
| 3 | PATCH | `/profile` | 更新顯示名稱 |
| 4 | POST | `/avatar` | 上傳頭像 (R2, max 2MB) |
| 5 | GET | `/avatar/:key` | 取得頭像 (R2, cache 24hr) |
| 6 | POST | `/onboarding` | 初始設定 |

**Settings 允許欄位 (camelCase → snake_case):**
```
accent, theme, dailyGoal, interfaceLang, definitionLang,
showPhonetic, showEtymology, autoPlayAudio, keyboardShortcuts,
enabledQuestionTypes, level, learningGoal
```

相關文件：[API 參考](./api.md) | [資料庫](./database.md) | [部署指南](./deployment.md)
