# Cloudflare Workers 部署指南

## 前置準備

1. 安裝 Node.js 18+ 和 npm
2. 安裝 Wrangler CLI:
```bash
npm install -g wrangler
```
3. 登入 Cloudflare:
```bash
wrangler login
```

## 一、建立 Cloudflare 資源

### 1. 建立 D1 資料庫

```bash
wrangler d1 create english-learner-db
```

輸出會顯示 `database_id`，將其填入 `worker/wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "english-learner-db"
database_id = "你的-database-id"
```

### 2. 建立 KV Namespace

```bash
wrangler kv namespace create KV
```

將輸出的 `id` 填入 `worker/wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "KV"
id = "你的-kv-namespace-id"
```

### 3. 建立 R2 Bucket

```bash
wrangler r2 bucket create english-learner-avatars
```

### 4. 設定 Secrets

```bash
wrangler secret put JWT_SECRET
# 輸入一個強隨機字串 (建議 32+ 字元)

wrangler secret put RESEND_API_KEY
# 輸入你的 Resend API Key (https://resend.com 取得)
```

## 二、初始化資料庫

### 執行 Schema Migration

```bash
cd worker
npm run db:migrate:remote
```

### 插入種子資料

```bash
npm run db:seed:remote
```

## 三、建構與部署

### 安裝依賴

```bash
# 在專案根目錄
npm install
```

### 建構前端

```bash
cd frontend
npm run build
```

### 部署 Worker

```bash
cd worker
wrangler deploy
```

部署成功後會顯示 Worker URL，例如：
```
https://english-learner.你的帳號.workers.dev
```

## 四、自訂網域（可選）

1. 在 Cloudflare Dashboard → Workers & Pages → 你的 Worker
2. 點擊 "Custom Domains" → "Add Custom Domain"
3. 輸入你的網域（需先在 Cloudflare 管理 DNS）
4. 更新 `wrangler.toml` 中的 `FRONTEND_URL` 為你的正式網域

## 五、環境變數設定

在 `worker/wrangler.toml` 中設定公開變數:

```toml
[vars]
RESEND_FROM = "noreply@你的網域.com"
FRONTEND_URL = "https://你的正式網域"
```

## 六、本地開發

### 啟動前端 dev server

```bash
cd frontend
npm run dev
# 跑在 http://localhost:5173
```

### 啟動 Worker dev server

```bash
cd worker
npm run dev
# 跑在 http://localhost:8787
```

前端的 Vite 設定已配好 proxy，`/api/*` 會自動轉發到 Worker。

### 本地資料庫操作

```bash
cd worker
npm run db:migrate    # 本地 D1 執行 schema
npm run db:seed       # 本地 D1 插入種子資料
```

## 七、Free Plan 限制與最佳實踐

### Workers Free Plan 限制
- **10 萬 requests/天**（靜態資源走 CDN 不計入）
- **10ms CPU 時間**（所以用 PBKDF2 而非 bcrypt）
- **D1**: 5GB 儲存, 5M 行讀取/天, 100K 行寫入/天
- **KV**: 100K 讀取/天, 1K 寫入/天
- **R2**: 10GB 儲存, 10M Class A ops/月

### Request 節省策略
- 靜態資源（JS/CSS/HTML/圖片）由 CDN 提供，**不計入** Worker request
- 每次練習只用 2 個 request（載入題目 + 提交答案）
- Dashboard 所有資料一個 endpoint 返回
- TanStack Query 快取 5 分鐘
- IndexedDB 離線練習

### 預估每日使用量
- 登入: 1 request
- Dashboard: 1 request
- 練習 3 組 (word + grammar + phrase): 6 requests
- 設定/其他: 2-3 requests
- **每位活躍使用者每天約 10 requests**
- 10 萬/天 → 可支持約 **10,000 活躍使用者/天**

## 八、Resend 設定

1. 前往 https://resend.com 註冊
2. 取得 API Key
3. 設定寄件網域（需 DNS 驗證）
4. Free Plan: 每天 100 封, 每月 3000 封

## 九、故障排除

### Worker 部署失敗
```bash
wrangler deploy --dry-run --outdir=dist
# 檢查 build 輸出是否正常
```

### D1 查詢錯誤
```bash
wrangler d1 execute english-learner-db --remote --command "SELECT COUNT(*) FROM words;"
```

### 查看 Worker 日誌
```bash
wrangler tail
```

## 十、更新部署

```bash
# 在專案根目錄
cd frontend && npm run build && cd ../worker && wrangler deploy
```

或使用根目錄的快捷指令:
```bash
npm run deploy
```
