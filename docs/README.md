# English Learner 專案文件

> 智慧英語學習平台 — 完整前後端架構文件

## 文件索引

| 文件 | 說明 |
|------|------|
| [架構總覽](./architecture.md) | 技術棧、系統架構、Monorepo 結構、部署環境 |
| [前端](./frontend.md) | React 頁面、組件、Hooks、Stores、路由 |
| [後端](./backend.md) | Hono 路由、中間件、服務層 |
| [資料庫](./database.md) | D1 Schema（13 表）、SRS 演算法、索引 |
| [API 參考](./api.md) | 全部 29 個 API Endpoint 詳細規格 |
| [資料管線](./data-pipeline.md) | Python 腳本、JSON 資源、Seed 生成流程 |
| [部署指南](./deployment.md) | Cloudflare Workers 部署、D1/KV/R2 設定 |
| [功能清單](./features.md) | 所有功能模組與實作位置 |

## 快速概覽

- **前端**: React 18 + Vite + TypeScript + Tailwind CSS + Framer Motion
- **後端**: Cloudflare Workers + Hono Framework
- **資料庫**: Cloudflare D1 (SQLite) + KV + R2
- **認證**: PBKDF2 + JWT (HS256)
- **學習算法**: SM-2 間隔重複系統 (8 級)
- **域名**: https://english-learner.org
- **詞庫**: 3,270 單字 + 2,958 片語 + 2,000 文法題

## 專案結構

```
english-learner/
├── frontend/          # React SPA (Vite)
│   ├── src/
│   │   ├── pages/     # 16 頁面
│   │   ├── components/# UI 組件
│   │   ├── hooks/     # 自訂 Hooks
│   │   ├── stores/    # Zustand 狀態
│   │   └── lib/       # 工具函式庫
│   └── public/        # 靜態資源 (PWA)
├── worker/            # Cloudflare Worker
│   └── src/
│       ├── routes/    # 4 個路由模組
│       ├── services/  # 認證 + SRS
│       ├── middleware/# JWT 驗證 + 限流
│       └── db/        # Schema + Seed
├── shared/            # 共用 Zod Schemas
├── scripts/           # Python 資料生成腳本
└── resource/          # 詞彙 JSON 來源資料
```
