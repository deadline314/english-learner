# 部署指南

[← 返回首頁](./README.md) | [架構總覽](./architecture.md)

## 前置需求

| 工具 | 版本 | 用途 |
|------|------|------|
| Node.js | ≥18 | 前端建構、wrangler CLI |
| npm | ≥9 | 套件管理 |
| wrangler | ≥3.0 | Cloudflare CLI |
| Python | ≥3.10 | 資料生成腳本 (可選) |

## Cloudflare 帳號設定

### 1. 啟用所需服務

- Workers: 自動啟用
- D1: 自動啟用
- KV: 自動啟用
- R2: 需手動在 Dashboard 啟用

### 2. 取得 Account ID

Dashboard → Workers & Pages → 右側 Account ID

### 3. 建立 API Token

Dashboard → My Profile → API Tokens → Create Token

**必要權限:**
| 權限 | 範圍 |
|------|------|
| Workers Scripts: Edit | Account |
| Workers KV Storage: Edit | Account |
| D1: Edit | Account |
| Workers R2 Storage: Edit | Account |

## 資源建立

### D1 Database

```bash
npx wrangler d1 create english-learner-db
# 記下 database_id 輸出值
```

### KV Namespace

```bash
npx wrangler kv namespace create ENGLISH_LEARNER_KV
# 記下 id 輸出值
```

### R2 Bucket

```bash
npx wrangler r2 bucket create english-learner-avatars
```

## 配置 wrangler.toml

```toml
name = "english-learner"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
account_id = "YOUR_ACCOUNT_ID"
workers_dev = false

[assets]
directory = "../frontend/dist"
html_handling = "drop-trailing-slash"
not_found_handling = "single-page-application"

[vars]
RESEND_FROM = "verify@your-domain.com"
FRONTEND_URL = "https://english-learner.org"

[[d1_databases]]
binding = "DB"
database_name = "english-learner-db"
database_id = "YOUR_D1_ID"

[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_ID"

[[r2_buckets]]
binding = "R2"
bucket_name = "english-learner-avatars"
```

## Secrets 設定

```bash
export CLOUDFLARE_API_TOKEN="your-api-token"

npx wrangler secret put JWT_SECRET
# 輸入: 隨機 32+ 字元的字串

npx wrangler secret put RESEND_API_KEY
# 輸入: Resend Dashboard 取得的 API key
```

## 資料庫初始化

### Schema

```bash
cd worker
npx wrangler d1 execute english-learner-db --remote \
  --file=src/db/schema.sql --yes
```

### Seed Data

```bash
# 先確保 seed_parts 已生成
cd scripts && python gen_seed.py && python split_seed.py && cd ../worker

for i in $(seq -w 0 043); do
  echo "Executing seed_${i}.sql..."
  npx wrangler d1 execute english-learner-db --remote \
    --file=src/db/seed_parts/seed_${i}.sql --yes
done
```

## 建構與部署

### 完整部署流程

```bash
# 1. 安裝依賴
npm install

# 2. 建構前端
cd frontend && npm run build && cd ..

# 3. 部署 Worker
cd worker && npx wrangler deploy
```

### 快速重新部署 (僅前端)

```bash
cd frontend && npm run build && cd ../worker && npx wrangler deploy
```

## 自訂域名

### Workers Routes 設定

Dashboard → Workers & Pages → english-learner → Settings → Domains & Routes

| 類型 | 值 |
|------|-----|
| Custom Domain | `english-learner.org` |
| Custom Domain | `www.english-learner.org` |

### DNS 設定

Dashboard → DNS → english-learner.org

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | 192.0.2.1 | ✓ (Proxied) |
| CNAME | www | english-learner.org | ✓ (Proxied) |

### SSL/TLS

Dashboard → SSL/TLS → Overview → **Full (strict)**

## Resend (郵件) 設定

1. 註冊 https://resend.com
2. 新增 Domain → 依指示設定 DNS (SPF, DKIM, DMARC)
3. 取得 API Key → 設為 Worker Secret
4. `RESEND_FROM` 使用已驗證的域名信箱

## 監控與除錯

### Worker Logs

```bash
npx wrangler tail  # 即時串流 Worker logs
```

### D1 查詢

```bash
npx wrangler d1 execute english-learner-db --remote \
  --command="SELECT COUNT(*) FROM words;" --yes
```

### KV 操作

```bash
npx wrangler kv key list --namespace-id=YOUR_KV_ID
npx wrangler kv key get "verify:user@email.com" --namespace-id=YOUR_KV_ID
```

## 免費額度管理

| 服務 | 免費額度 | 建議 |
|------|---------|------|
| Workers | 100K req/day | SPA 路由 + API 共用單一 Worker |
| D1 | 5M reads, 100K writes/day | batch() 合併查詢 |
| KV | 100K reads, 1K writes/day | 僅用於短暫資料 |
| R2 | 10M Class A, 10M Class B/month | 頭像 + Cache-Control |

**請求最佳化策略:**
1. SPA 使用 `html_handling: single-page-application` (無需額外 API 請求)
2. Dashboard 用 `DB.batch()` 合併 10 個查詢為 1 次
3. Practice submit 用 `DB.batch()` 批次更新
4. Frontend `staleTime` 設定減少重複請求
5. Avatar 設定 `Cache-Control: max-age=86400`

## 常見問題

### wrangler login 失敗
- 使用 `CLOUDFLARE_API_TOKEN` 環境變數替代互動式登入
- 確保 token 有足夠權限 (見上方)

### 部署後 404
- 檢查 `[assets]` 的 `directory` 路徑是否正確
- 確認 `not_found_handling = "single-page-application"` 已設定
- 確認前端已 build (`frontend/dist/` 存在)

### D1 transaction 過大
- 使用 `split_seed.py` 分割 (≤500 語句/檔)
- 加 `--yes` flag 避免手動確認

### R2 上傳失敗
- 確認 R2 已在 Dashboard 啟用
- 檢查 bucket name 與 wrangler.toml 一致

相關文件：[架構總覽](./architecture.md) | [資料管線](./data-pipeline.md)
