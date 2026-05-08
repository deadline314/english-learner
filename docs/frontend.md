# 前端文件

[← 返回首頁](./README.md) | [架構總覽](./architecture.md) | [API 參考](./api.md)

## 目錄結構

```
frontend/src/
├── main.tsx              # 入口：QueryClient + BrowserRouter + StrictMode
├── App.tsx               # 路由定義 + AnimatePresence + ProtectedRoute
├── index.css             # Tailwind + CSS 變數 (亮/暗主題)
├── img/logo.png          # Logo 原始檔
├── components/
│   ├── Layout.tsx        # 側邊欄導航 + 響應式佈局
│   ├── BookmarkStar.tsx  # 收藏星星切換元件
│   └── ui/Toaster.tsx    # 全域 Toast 通知
├── hooks/
│   ├── useTTS.ts         # TTS 語音播放 Hook
│   └── useKeyboardShortcuts.ts  # 鍵盤快捷鍵
├── lib/
│   ├── api.ts            # HTTP 客戶端 (get/post/patch/delete/upload)
│   ├── db.ts             # Dexie IndexedDB 離線快取
│   ├── session.ts        # localStorage 練習進度暫存
│   └── utils.ts          # cn() Tailwind class 合併
├── stores/
│   ├── auth.ts           # 認證狀態 (token, userId)
│   └── theme.ts          # 主題偏好 (light/dark/system)
└── pages/                # 16 個頁面
    ├── Login.tsx
    ├── Register.tsx
    ├── Verify.tsx
    ├── Onboarding.tsx
    ├── Dashboard.tsx
    ├── PracticeWord.tsx
    ├── PracticeGrammar.tsx
    ├── PracticePhrase.tsx
    ├── PracticeMixed.tsx
    ├── PracticeToeic.tsx
    ├── ReviewWrong.tsx
    ├── ReviewSeen.tsx
    ├── Bookmarks.tsx
    ├── Stats.tsx
    ├── WordList.tsx
    └── Settings.tsx
```

## 路由表

| 路徑 | 頁面 | 需登入 | 說明 |
|------|------|--------|------|
| `/login` | Login | ✗ | 登入頁 |
| `/register` | Register | ✗ | 註冊頁 |
| `/verify` | Verify | ✗ | 信箱驗證 (6碼OTP) |
| `/onboarding` | Onboarding | ✗ | 初始設定精靈 |
| `/` | Dashboard | ✓ | 首頁/儀表板 |
| `/practice/word` | PracticeWord | ✓ | 單字練習 |
| `/practice/grammar` | PracticeGrammar | ✓ | 文法練習 |
| `/practice/phrase` | PracticePhrase | ✓ | 片語練習 |
| `/practice/mixed` | PracticeMixed | ✓ | 綜合練習 |
| `/practice/toeic` | PracticeToeic | ✓ | TOEIC 精選 |
| `/review/wrong` | ReviewWrong | ✓ | 錯題本 |
| `/review/seen` | ReviewSeen | ✓ | 已看題目 |
| `/bookmarks` | Bookmarks | ✓ | 我的收藏 |
| `/stats` | Stats | ✓ | 學習統計 |
| `/words` | WordList | ✓ | 題庫總覽 |
| `/settings` | Settings | ✓ | 設定 |

## 核心組件

### Layout.tsx (113 行)

側邊欄導航，13 個導航項目：

```typescript
const navItems = [
  { path: '/', icon: LayoutDashboard, label: '首頁' },
  { path: '/words', icon: Library, label: '題庫總覽' },
  { path: '/practice/word', icon: BookOpen, label: '單字練習' },
  { path: '/practice/grammar', icon: PenTool, label: '文法練習' },
  { path: '/practice/phrase', icon: MessageSquare, label: '片語練習' },
  { path: '/practice/toeic', icon: Award, label: 'TOEIC 精選' },
  { path: '/practice/mixed', icon: Shuffle, label: '綜合練習' },
  { path: '/bookmarks', icon: Star, label: '我的收藏' },
  { path: '/review/wrong', icon: XCircle, label: '錯題本' },
  { path: '/review/seen', icon: Eye, label: '已看題目' },
  { path: '/stats', icon: BarChart3, label: '學習統計' },
  { path: '/settings', icon: Settings, label: '設定' },
]
```

### BookmarkStar.tsx (87 行)

可重用的收藏切換元件，支援 "seen" (琥珀色) 和 "wrong" (玫瑰色) 兩種類型。

## Hooks

### useTTS.ts (93 行)

| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `accent` | `'us' \| 'uk'` | `'us'` | 口音偏好 |
| `rate` | `number` | `1` | 語速 |
| `pitch` | `number` | `1` | 音調 |

回傳：`{ speak, stop, isSpeaking, voices, hasVoices }`

語音優先順序：Google > Microsoft > 其他，根據 accent 選擇 en-US 或 en-GB。

### useKeyboardShortcuts.ts (24 行)

```typescript
useKeyboardShortcuts(
  { '1': () => selectOption(0), '2': () => selectOption(1), ... },
  enabled  // boolean
)
```

忽略 INPUT/TEXTAREA/contentEditable 元素內的按鍵事件。

## Stores (Zustand)

### auth.ts

```typescript
interface AuthState {
  token: string | null
  userId: string | null
  setAuth: (token: string, userId: string) => void
  logout: () => void
}
```

使用 `persist` 中間件，localStorage key: `auth-storage`

### theme.ts

```typescript
type Theme = 'light' | 'dark' | 'system'
interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}
```

localStorage key: `theme-storage`

## Lib

### api.ts (100 行)

```typescript
class ApiClient {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body?: any): Promise<T>
  patch<T>(path: string, body: any): Promise<T>
  delete<T>(path: string): Promise<T>
  upload<T>(path: string, formData: FormData): Promise<T>
}
```

- 自動附加 `Bearer` token
- 401 回應自動登出並重導向
- 拋出 `ApiError` 包含 `status` 和 `data`

### session.ts (37 行)

```typescript
interface SavedSession {
  sessionId: string
  items: any[]
  currentIndex: number
  answers: any[]
  mode: string
  savedAt: number  // 1 小時過期
}
```

## 頁面詳細

### Dashboard.tsx (361 行)

| 區塊 | 說明 |
|------|------|
| ProgressRing | SVG 動畫進度環 (每日完成度) |
| StreakBadge | 連續天數徽章 |
| 練習卡片 x3 | Vocabulary/Grammar/Phrases (Due/New 數量) |
| WeeklyHeatmap | 7天活動熱力圖 |
| Recent Mistakes | 最近5筆錯題 |

API: `GET /progress/dashboard`  
Query: `['dashboard']`, `refetchOnMount: 'always'`

### PracticeWord.tsx (643 行) — 最複雜的頁面

**題型 (QuestionType):**
| 題型 | 說明 |
|------|------|
| `zh-to-en` | 中文 → 選英文 |
| `en-to-zh` | 英文 → 選中文 |
| `fill-blank` | 填空題 (從例句挖空) |
| `listen` | 聽力題 (自動播放TTS) |
| `secondary-meaning` | 次要意義 (有 secondary_meaning_note 時觸發) |

**鍵盤快捷鍵:**
- `1-4`: 選擇選項
- `Space`: 下一題
- `P`: 播放發音

**功能:**
- 練習進度 localStorage 暫存 (離開後可繼續)
- 從 user settings 載入/同步啟用的題型
- 錯誤回饋顯示選錯選項的意義
- 完成後 confetti 動畫 (>80% 正確率)

### Settings.tsx (471 行)

**設定區塊:**
| 區塊 | 設定項目 |
|------|---------|
| Profile | 頭像上傳、顯示名稱、Email |
| Learning | 每日目標 (5-100)、釋義語言、音標、字源 |
| Question Types | 啟用/停用練習題型 |
| Audio | 口音 US/UK、答題後自動播放 |
| Interface | 主題 (亮/暗/系統)、鍵盤快捷鍵 |
| Advanced | 匯出資料、刪除帳號 |

所有設定變更使用 500ms debounce 自動儲存。

### ReviewWrong.tsx (461 行)

**功能:**
- Tab 切換 (Word/Grammar/Phrase)
- 篩選 (All/Unmastered/Mastered)
- 分頁
- 收藏 (星星按鈕)
- 標記為已掌握
- 單筆刪除 (確認彈窗)
- 全部清空 (確認彈窗)
- TTS 播放 (獨立動畫追蹤)
- 重新練習按鈕

### ReviewSeen.tsx (451 行)

**功能:**
- SRS Level 篩選 (0-7)
- 掌握度統計 (Beginner/Learning/Familiar/Mastered)
- 收藏、刪除、清空
- Next review 時間顯示
- Seen/Correct/Wrong 次數

### Stats.tsx (362 行)

**圖表:**
| 圖表 | 類型 | 說明 |
|------|------|------|
| 每日活動 | LineChart | 30天答題數 + 正確數 |
| 題型分布 | PieChart | Word/Grammar/Phrase 比例 |
| SRS 等級 | BarChart | Level 0-7 分布 |
| 活動熱力圖 | Custom Grid | 90天活躍度 |
| 最難單字 | Table | Top 10 錯誤率最高 |

相關文件：[API 參考](./api.md) | [後端](./backend.md) | [資料庫](./database.md)
