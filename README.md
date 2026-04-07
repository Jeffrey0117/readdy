# Readdy

Paste plain text → get a short URL → open it on any device → see the same beautiful warm-tone serif typography. A CloudPipe sub-project.

## Quick start

```bash
npm install
cp .env.example .env
# edit .env, set READDY_IP_SALT
npm start
```

Open `http://localhost:4022/`.

## Tests

```bash
npm test
```

## Architecture

- Built-in Node `http` module (no Express, no framework)
- `better-sqlite3` for storage (WAL mode)
- Two HTML pages served as inline template strings
- 7-character short IDs from a 31-character ambiguity-free alphabet
- Rate limited to 5 paste creations per minute per hashed IP

## Files

- `server.js` — HTTP entry + shutdown
- `router.js` — Method+path → handler dispatch
- `pages.js` — HTML templates (homepage / reading / 404)
- `paste.js` — Paste create/fetch + validation
- `id.js` — Short ID generation
- `db.js` — SQLite wrapper

## Deployment

Deployed by CloudPipe via `git pull && pm2 restart readdy`. No build step.
