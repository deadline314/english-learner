# 功能清單

[← 返回首頁](./README.md) | [前端](./frontend.md) | [後端](./backend.md)

## 認證系統

| 功能 | 前端 | 後端 | 說明 |
|------|------|------|------|
| Email 註冊 | `Login.tsx`, `Register.tsx` | `routes/auth.ts` L1-65 | PBKDF2 雜湊 + 6碼 OTP |
| Email 驗證 | `Verify.tsx` | `routes/auth.ts` L67-100 | KV 存驗證碼 (10min TTL) |
| 登入 | `Login.tsx` | `routes/auth.ts` L102-140 | JWT 7d/30d |
| 登出 | Layout sidebar | `routes/auth.ts` L142-155 | Token 黑名單 |
| 忘記密碼 | `Login.tsx` (link) | `routes/auth.ts` L170-209 | Reset token via email |
| 限流保護 | — | `middleware/auth.ts` | KV sliding window |

## 練習系統

| 功能 | 頁面 | 說明 |
|------|------|------|
| 單字練習 | `PracticeWord.tsx` | 5 種題型，鍵盤快捷鍵，TTS |
| 文法練習 | `PracticeGrammar.tsx` | 4 選 1，解題說明 |
| 片語練習 | `PracticePhrase.tsx` | 類似單字練習 |
| 綜合練習 | `PracticeMixed.tsx` | 8 word + 6 grammar + 6 phrase |
| TOEIC 精選 | `PracticeToeic.tsx` | 依 toeic_rank 排序 |
| 進度暫存 | `lib/session.ts` | localStorage, 1hr 過期 |
| 題型選擇 | `Settings.tsx` + `PracticeWord.tsx` | 持久化至 user_settings |

### 題型詳細

| 題型 ID | 顯示名稱 | 題幹 | 選項 | TTS |
|---------|---------|------|------|-----|
| `zh-to-en` | 中文 → English | 中文釋義 | 4 個英文字 | 答後顯示 |
| `en-to-zh` | English → 中文 | 英文單字 | 4 個中文釋義 | 可播放 |
| `fill-blank` | 填空題 | 例句 (挖空) | 4 個單字 | 可播放 |
| `listen` | 聽力題 | 自動播放發音 | 4 個中文釋義 | 自動播放 |
| `secondary-meaning` | 次要意義 | 單字 + 「非主要意義」 | 4 個選項 | 可播放 |

## 複習系統

| 功能 | 頁面 | API |
|------|------|-----|
| 錯題本 | `ReviewWrong.tsx` | `GET /progress/wrong` |
| 已看題目 | `ReviewSeen.tsx` | `GET /progress/seen` |
| 收藏 (星星) | `BookmarkStar.tsx` | `POST /practice/bookmark` |
| 單筆刪除 | ReviewWrong/Seen | `DELETE /progress/wrong/:id`, `DELETE /progress/seen/:type/:id` |
| 全部清空 | ReviewWrong/Seen | `DELETE /progress/wrong/clear/:type`, `DELETE /progress/seen/clear/:type` |
| 標記已掌握 | ReviewWrong | `POST /progress/wrong/:id/master` |
| 我的收藏 | `Bookmarks.tsx` | `GET /practice/bookmarks` |

## 間隔重複 (SRS)

| 功能 | 位置 | 說明 |
|------|------|------|
| SM-2 算法 | `worker/src/services/srs.ts` | 8 級, ease factor |
| Due 計算 | `routes/progress.ts` Dashboard | `next_review_at <= now` |
| 即時回饋 | Level 0 interval = 0 min | 答對立即變 Due |
| 漸增間隔 | Level 1-7 | 1hr → 30 days |

## TTS (語音朗讀)

| 功能 | 位置 | 說明 |
|------|------|------|
| 語音播放 | `hooks/useTTS.ts` | Web Speech API |
| 口音選擇 | user_settings.accent | US (en-US) / UK (en-GB) |
| 語音優先順序 | useTTS 內部 | Google > Microsoft > 其他 |
| 聽力題自動播放 | PracticeWord.tsx | questionType === 'listen' |
| 中→英 隱藏 | PracticeWord.tsx | 答題前不顯示 TTS 按鈕 |
| 獨立動畫追蹤 | ReviewWrong/Seen | speakingId 狀態 |
| 鍵盤快捷鍵 | P 鍵 | useKeyboardShortcuts |

## 使用者設定

| 設定 | 型別 | 預設值 | 影響 |
|------|------|--------|------|
| accent | us/uk | us | TTS 口音 |
| theme | light/dark/system | system | 介面主題 |
| dailyGoal | 5-100 | 20 | Dashboard 進度環 |
| interfaceLang | zh-TW/en | zh-TW | UI 語言 |
| definitionLang | zh/en/both | zh | 釋義顯示 |
| showPhonetic | boolean | true | 音標顯示 |
| showEtymology | boolean | true | 字源顯示 |
| autoPlayAudio | boolean | false | 答對後自動播放 |
| keyboardShortcuts | boolean | true | 1-4/Space/P |
| enabledQuestionTypes | string | all 4 types | 練習時使用的題型 |
| level | A1-C1 | B1 | 難度篩選 |
| learningGoal | string | general | 學習目標 |

## UI/UX 特色

| 功能 | 技術 | 說明 |
|------|------|------|
| 頁面轉場動畫 | Framer Motion AnimatePresence | fade + slide |
| 卡片 stagger | Framer Motion variants | 依序出現 |
| 暗色主題 | CSS Variables + Tailwind dark: | 漸變背景 |
| Progress Ring | SVG 動畫 | Dashboard 每日進度 |
| Confetti | Canvas 動畫 | 練習完成 (>80%) |
| Toast 通知 | Toaster.tsx | 操作回饋 |
| 確認彈窗 | AnimatePresence + backdrop | 刪除/清空確認 |
| PWA | manifest.json + Service Worker | 離線存取 |
| 多尺寸 Logo | 48/96/192/512 px PNG | PWA + Favicon |
| 響應式佈局 | Tailwind breakpoints | 桌面側邊欄, 行動底部導航 |

## 資料瀏覽

| 功能 | 頁面 | 說明 |
|------|------|------|
| 題庫總覽 | `WordList.tsx` | 分頁 (100/頁) + 搜尋 + 等級篩選 |
| 學習統計 | `Stats.tsx` | 5 種圖表 + 最難單字 |
| 儀表板 | `Dashboard.tsx` | Due/New 數量 + 熱力圖 + 連續天數 |

## 效能最佳化

| 策略 | 位置 | 說明 |
|------|------|------|
| Code Splitting | vite.config.ts manualChunks | react/ui/data 分離 |
| DB Batch | practice.ts submit | 單次 API 呼叫, batch SQL |
| Query Cache | TanStack Query staleTime | 減少重複請求 |
| Offline Cache | Dexie (IndexedDB) | PWA 離線支援 |
| Image Cache | R2 + Cache-Control 24hr | 頭像快取 |
| SPA Fallback | wrangler.toml assets config | 無額外請求 |
| D1 Batch Query | progress.ts dashboard | 10 queries in 1 batch |

相關文件：[前端](./frontend.md) | [後端](./backend.md) | [資料庫](./database.md)
