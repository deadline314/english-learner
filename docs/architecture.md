# 架構總覽

[← 返回首頁](./README.md)

## 技術棧

| 層級 | 技術 | 用途 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | UI 渲染 |
| 建構工具 | Vite 5 | 開發伺服器 + 打包 |
| 樣式 | Tailwind CSS 3.4 + CSS Variables | 響應式設計 + 主題切換 |
| 動畫 | Framer Motion | 頁面轉場 + 微互動 |
| 狀態管理 | Zustand (persist) | 全域狀態 (auth, theme) |
| 伺服器狀態 | TanStack Query v5 | API 快取 + 自動重新取得 |
| 圖表 | Recharts | 學習統計視覺化 |
| 離線支援 | Dexie (IndexedDB) + Service Worker | PWA + 離線快取 |
| 路由 | React Router v6 | 巢狀路由 + 受保護路由 |
| 圖標 | Lucide React | SVG 圖標庫 |
| 後端框架 | Hono | Cloudflare Workers 路由 |
| 資料庫 | Cloudflare D1 (SQLite) | 主要資料儲存 |
| 鍵值存儲 | Cloudflare KV | 驗證碼/Token 黑名單/限流 |
| 物件存儲 | Cloudflare R2 | 使用者頭像 |
| 認證 | PBKDF2 (Web Crypto) + JWT (jose) | 密碼雜湊 + 會話管理 |
| 郵件 | Resend API | 驗證碼/重設密碼郵件 |
| TTS | Web Speech API | 單字/片語發音 |
| 學習算法 | SM-2 (改良版) | 間隔重複排程 |

## Monorepo 結構

使用 npm workspaces 管理三個套件：

```json
// package.json
{
  "workspaces": ["frontend", "worker", "shared"]
}
```

| 套件 | 路徑 | 說明 |
|------|------|------|
| frontend | `frontend/` | React SPA，建構產物在 `frontend/dist/` |
| worker | `worker/` | Cloudflare Worker API + 靜態資源服務 |
| shared | `shared/` | 共用的 Zod schemas 和 TypeScript 型別 |

## 請求流程

```
瀏覽器 → Cloudflare CDN → Worker
                              ├── /api/* → Hono 路由處理
                              │   ├── auth middleware (JWT 驗證)
                              │   ├── D1 (SQLite 查詢)
                              │   ├── KV (快取/限流)
                              │   └── R2 (頭像存取)
                              └── /* → ASSETS binding (SPA 靜態資源)
```

## 環境配置

### Worker 綁定 (`wrangler.toml`)

| 綁定 | 類型 | 名稱/ID |
|------|------|---------|
| `DB` | D1 Database | `english-learner-db` |
| `KV` | KV Namespace | `bfd85108ecc9455da88fedda0a3e58ce` |
| `R2` | R2 Bucket | `english-learner-avatars` |
| `ASSETS` | Static Assets | `../frontend/dist` |

### 環境變數

| 變數 | 說明 | 設定方式 |
|------|------|---------|
| `RESEND_FROM` | 寄件人信箱 | `wrangler.toml` [vars] |
| `FRONTEND_URL` | 前端網址 | `wrangler.toml` [vars] |
| `JWT_SECRET` | JWT 簽名密鑰 | `wrangler secret put` |
| `RESEND_API_KEY` | Resend API 金鑰 | `wrangler secret put` |

### 自訂域名

| 域名 | 用途 |
|------|------|
| `english-learner.org` | 主要網域 |
| `www.english-learner.org` | WWW 重導向 |

## Vite 設定

```typescript
// frontend/vite.config.ts
{
  resolve: {
    alias: {
      '@': './src',
      '@shared': '../shared'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['framer-motion', 'lucide-react', 'recharts'],
          'data-vendor': ['@tanstack/react-query', 'zustand', 'dexie', 'zod']
        }
      }
    }
  },
  server: {
    proxy: { '/api': 'http://localhost:8787' }
  }
}
```

## 建構產物大小

| Chunk | 大小 | Gzip |
|-------|------|------|
| `index-*.js` | ~186 KB | ~42 KB |
| `react-vendor-*.js` | ~165 KB | ~54 KB |
| `ui-vendor-*.js` | ~550 KB | ~154 KB |
| `data-vendor-*.js` | ~46 KB | ~14 KB |
| `index-*.css` | ~47 KB | ~8 KB |

相關文件：[前端](./frontend.md) | [後端](./backend.md) | [部署指南](./deployment.md)
