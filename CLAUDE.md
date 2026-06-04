# Readdy

Beautiful pure-text reading links — paste plain text, get a 7-char short URL, read anywhere with consistent warm-serif typography.

## Stack

- Node.js (>=18), plain JavaScript, CommonJS (`'use strict'`)
- HTTP: Node built-in `node:http` (no Express / framework)
- Storage: `better-sqlite3` (synchronous, WAL mode) — single file at `data/readdy.db`
- Templates: inline HTML tagged strings in `pages.js` (no template engine, no build step)
- Tests: Node built-in `node:test` runner (no test framework dependency)
- Deploy: PM2 + CloudPipe (Cloudflare Tunnel, blue-green deploys)

## Directory structure

```
readdy/
  server.js          ← HTTP entry; createServer, error wrapper, graceful shutdown (SIGINT/SIGTERM)
  router.js          ← method+path dispatch, rate limiter, IP hashing, JSON body reader, URL builders
  paste.js           ← validate / createPaste / fetchPaste (with retry on ID collision)
  pages.js           ← renderHomepage / renderReading / renderNotFound (HTML)
  id.js              ← 7-char short ID generator (rejection sampling, ambiguity-free alphabet)
  slug.js            ← extractTitle / makeSlug / parseSlugUrl (slug-id URLs, Unicode/CJK aware)
  db.js              ← SQLite open + schema + idempotent migration
  test/              ← node:test unit + HTTP integration tests (*.test.js)
  data/readdy.db     ← SQLite store (created on first run)
  .pm2-ecosystem.json← PM2 production config
```

## Key concepts

- **Request flow**: `server.js` → `router.handle(req, res, db)` → `paste`/`pages` → `db`. Router catches errors, returns 500 JSON.
- **Routes**: `GET /` homepage · `POST /api/paste` create · `GET /:id` and `GET /:slug-:id` reading page · everything else → 404.
- **Slug URLs**: title is the first non-empty line (max 60 chars). Bare `/:id` for a titled paste 301-redirects to `/:slug-:id`. `parseSlugUrl` parses both forms; slug is Unicode-aware (`\p{L}\p{N}`, covers CJK).
- **Short IDs**: 7 chars from a 31-symbol alphabet (`abcdefghjkmnpqrstuvwxyz23456789`, no `0/O/1/I/l`). Rejection sampling (discard bytes ≥248) avoids modulo bias. ~28B IDs. Collisions retried up to 5× on insert.
- **Validation** (`paste.validate`): content must be a non-empty (after trim) string ≤ 100,000 chars. Body JSON capped at 200 KB.
- **Rate limiting**: in-memory sliding window, 5 pastes / 60s per hashed IP. `_resetRate()` exposed for tests.
- **Privacy**: client IP (from `X-Forwarded-For` first hop, else socket) is SHA-256 hashed with `READDY_IP_SALT`, truncated to 32 chars, stored as `ip_hash`. No raw PII at rest.
- **views side-effect**: `fetchPaste` increments `views` and returns `null` if no row. On create, router re-fetches for the title then resets `views = 0` to undo that increment.
- **DB**: WAL journal mode, `busy_timeout = 5000`. Schema created with `CREATE TABLE IF NOT EXISTS`; `migrate()` idempotently adds the `title` column for older DBs.

## Commands

```bash
npm install        # installs better-sqlite3 (native build via prebuild)
npm start          # node server.js — listens on http://localhost:4022
npm test           # node --test test/*.test.js
```

## Configuration (env vars)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `4022` | HTTP listen port |
| `READDY_PUBLIC_URL` | `http://localhost:$PORT` | Base URL used in returned paste links |
| `READDY_IP_SALT` | `unsalted-dev` (set in prod!) | Salt for SHA-256 IP hashing |
| `READDY_DB_PATH` | `data/readdy.db` | SQLite path (note: `server.js` currently hardcodes `data/readdy.db` via `__dirname`) |

## Coding rules

- CommonJS modules, `'use strict'` at top of every file.
- No web framework and no build step — keep dependencies minimal (currently only `better-sqlite3`).
- Use prepared statements for all SQL.
- Escape user content when rendering HTML (XSS-tested in the suite).
- Tests use only `node:test` / `node:assert` — do not add a test framework.
