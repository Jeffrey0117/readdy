# Readdy

> Beautiful pure-text reading links — paste once, read anywhere.

[繁體中文](./README.zh-TW.md) · **English**

[![Live](https://img.shields.io/badge/live-readdy.isnowfriend.com-c8743c?style=flat-square)](https://readdy.isnowfriend.com)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#license)

Readdy turns plain text into a clean, sharable reading page. Paste your draft, blog post, journal entry, or notes, and you get a 7‑character short URL. Open it on any device — phone, tablet, or desktop — and the text is rendered with the same warm-tone serif typography, optimised line height, and reading width that look good on every screen.

The motivation is simple: long-form text usually looks beautiful on a Mac and ugly everywhere else. Readdy is the smallest possible service that fixes that.

## Features

- **One-step publishing** — paste text, get a permanent short URL.
- **Consistent typography** — warm serif design tuned for long reading sessions, identical across devices.
- **Zero JavaScript on the reader page** — pure SSR HTML, fast on any network.
- **Privacy by design** — no accounts, no tracking, IPs are hashed before being rate-limited.
- **Tiny surface area** — single Node process, single SQLite file, no build step.

## Live Demo

**[https://readdy.isnowfriend.com](https://readdy.isnowfriend.com)**

## Quick Start

```bash
git clone https://github.com/Jeffrey0117/readdy.git
cd readdy
npm install
cp .env.example .env        # then edit .env and set READDY_IP_SALT
npm start
```

The server listens on `http://localhost:4022/` by default. Override with `PORT=...`.

## API

### `POST /api/paste`

Create a new paste.

```http
POST /api/paste
Content-Type: application/json

{ "content": "your plain text here" }
```

**Response**

```json
{ "id": "5cap34j", "url": "http://localhost:4022/5cap34j" }
```

**Limits**

| Constraint | Value |
|---|---|
| Min content length | 1 character |
| Max content length | 100,000 characters |
| Rate limit | 5 pastes / minute / hashed IP |

### `GET /:id`

Render the paste as a reading page. Returns `404` for unknown or malformed IDs.

## Tests

```bash
npm test
```

The suite uses Node's built-in `node:test` runner — no test framework dependency. 59 tests cover ID generation, the SQLite layer, paste validation, page rendering, the router, and full HTTP integration including XSS escaping and rate limiting.

## Architecture

```
┌──────────────┐    ┌──────────┐    ┌────────────┐    ┌─────────────┐
│  HTTP (raw)  │ ─> │  router  │ ─> │   paste    │ ─> │  SQLite     │
│  server.js   │    │ router.js│    │  paste.js  │    │  (db.js)    │
└──────────────┘    └──────────┘    └────────────┘    └─────────────┘
                          │
                          v
                    ┌──────────┐
                    │  pages   │  ← inline HTML templates
                    │ pages.js │
                    └──────────┘
```

| Concern | Choice | Rationale |
|---|---|---|
| HTTP server | Node built-in `http` | Zero dependencies, full control |
| Storage | `better-sqlite3` (WAL) | Single file, synchronous, fast |
| Templates | Inline tagged strings | No template engine, no build step |
| ID space | 7 chars × 31-symbol alphabet | ~28 billion IDs, no `0/O/1/I/l` ambiguity |
| Rate limiting | In-memory + SHA-256 hashed IP | No Redis dependency, no PII at rest |

## Project Layout

```
readdy/
├── server.js        HTTP entry, graceful shutdown
├── router.js        Method + path → handler dispatch
├── paste.js         Paste create / fetch / validation
├── pages.js         Homepage, reading page, 404 (HTML)
├── id.js            7-char short ID generator (rejection sampling)
├── db.js            SQLite wrapper (better-sqlite3)
├── test/            node:test integration + unit tests
└── data/readdy.db   SQLite store (created on first run)
```

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `4022` | HTTP listen port |
| `READDY_IP_SALT` | *(required)* | Salt for SHA-256 hashing of client IPs (rate limiting) |
| `READDY_DB_PATH` | `data/readdy.db` | SQLite database path |

## Deployment

Readdy is deployed and managed by [CloudPipe](https://github.com/Jeffrey0117/CloudPipe), which handles git pull, PM2 process management, Cloudflare Tunnel routing, blue-green zero-downtime deploys, and gateway/MCP exposure.

The CloudPipe gateway exposes one tool:

```
readdy_create_paste({ content: string })
```

Any other CloudPipe sub-project, MCP client, or Telegram bot can create pastes through the gateway without talking to Readdy directly.

## License

MIT © Jeffrey0117
