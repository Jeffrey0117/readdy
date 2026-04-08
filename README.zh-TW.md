# Readdy

> 把純文字變成漂亮的閱讀連結 — 貼一次，到處都好看。

**繁體中文** · [English](./README.md)

[![Live](https://img.shields.io/badge/live-readdy.isnowfriend.com-c8743c?style=flat-square)](https://readdy.isnowfriend.com)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#授權)

Readdy 把一段純文字變成乾淨、可分享的閱讀頁。貼上你的草稿、文章、日記或筆記，得到一個 7 個字元的短網址。任何裝置打開 — 手機、平板、桌面 — 都會看到一致的暖色襯線字體、舒服的行高與閱讀寬度。

動機很單純：長文在 Mac 上通常很美,在其他地方常常很醜。Readdy 是用最小的服務把這件事修好。

## 功能特色

- **一步發佈** — 貼上文字,得到永久短網址。
- **一致的排版** — 為長時間閱讀調整過的暖色襯線設計,所有裝置完全一致。
- **閱讀頁零 JavaScript** — 純 SSR HTML,任何網路下都很快。
- **天生隱私** — 不需註冊,沒有追蹤,IP 在做 rate limit 前就先 hash 掉。
- **極小的表面積** — 單一 Node process,單一 SQLite 檔,沒有 build 步驟。

## 線上展示

**[https://readdy.isnowfriend.com](https://readdy.isnowfriend.com)**

## 快速開始

```bash
git clone https://github.com/Jeffrey0117/readdy.git
cd readdy
npm install
cp .env.example .env        # 編輯 .env,設定 READDY_IP_SALT
npm start
```

預設會在 `http://localhost:4022/` 啟動,可用 `PORT=...` 覆寫。

## API

### `POST /api/paste`

建立一份新的 paste。

```http
POST /api/paste
Content-Type: application/json

{ "content": "你的純文字內容" }
```

**回應**

```json
{ "id": "5cap34j", "url": "http://localhost:4022/5cap34j" }
```

**限制**

| 項目 | 數值 |
|---|---|
| 最短內容 | 1 字元 |
| 最長內容 | 100,000 字元 |
| 速率限制 | 每個 hashed IP 每分鐘 5 次 |

### `GET /:id`

把該 paste 渲染成閱讀頁。未知或格式錯誤的 ID 會回 `404`。

## 測試

```bash
npm test
```

測試使用 Node 內建的 `node:test` runner — 不依賴任何測試框架。59 個測試涵蓋短網址產生、SQLite 層、paste 驗證、頁面渲染、router,以及完整的 HTTP 整合測試(包含 XSS escape 與 rate limit)。

## 架構

```
┌──────────────┐    ┌──────────┐    ┌────────────┐    ┌─────────────┐
│  HTTP (raw)  │ ─> │  router  │ ─> │   paste    │ ─> │  SQLite     │
│  server.js   │    │ router.js│    │  paste.js  │    │  (db.js)    │
└──────────────┘    └──────────┘    └────────────┘    └─────────────┘
                          │
                          v
                    ┌──────────┐
                    │  pages   │  ← 內嵌 HTML 模板
                    │ pages.js │
                    └──────────┘
```

| 面向 | 選擇 | 理由 |
|---|---|---|
| HTTP 伺服器 | Node 內建 `http` | 零依賴,完全可控 |
| 儲存 | `better-sqlite3` (WAL) | 單檔,同步,夠快 |
| 模板 | 內嵌 tagged string | 不需模板引擎,沒有 build |
| 短網址空間 | 7 字元 × 31 字母表 | 約 280 億組,無 `0/O/1/I/l` 歧義 |
| Rate limit | 記憶體 + SHA-256 hashed IP | 不需 Redis,不留任何個資 |

## 專案結構

```
readdy/
├── server.js        HTTP 入口、graceful shutdown
├── router.js        Method + path → handler 派發
├── paste.js         Paste 建立 / 取得 / 驗證
├── pages.js         首頁、閱讀頁、404 (HTML)
├── id.js            7 字元短網址產生器 (rejection sampling)
├── db.js            SQLite 包裝 (better-sqlite3)
├── test/            node:test 整合 + 單元測試
└── data/readdy.db   SQLite 資料庫 (首次啟動時建立)
```

## 環境變數

| 變數 | 預設 | 用途 |
|---|---|---|
| `PORT` | `4022` | HTTP 監聽 port |
| `READDY_IP_SALT` | *(必填)* | Client IP 做 SHA-256 hash 的 salt (rate limit 用) |
| `READDY_DB_PATH` | `data/readdy.db` | SQLite 資料庫路徑 |

## 部署

Readdy 由 [CloudPipe](https://github.com/Jeffrey0117/CloudPipe) 部署與管理。CloudPipe 負責 git pull、PM2 進程管理、Cloudflare Tunnel 路由、blue-green 零停機部署,以及對 gateway / MCP 的曝光。

CloudPipe gateway 對外暴露一個工具:

```
readdy_create_paste({ content: string })
```

任何 CloudPipe 子專案、MCP client、或 Telegram bot 都可以透過 gateway 建立 paste,完全不需要直接和 Readdy 對話。

## 授權

MIT © Jeffrey0117
