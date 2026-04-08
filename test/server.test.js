'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// We test the router directly against an in-memory style DB rather than
// spinning up the full server, because that gives full control over the
// rate-limit state and DB lifecycle.
const { openDb } = require('../db');
const { handle, _resetRate } = require('../router');

const TMP = path.join(__dirname, '_tmp_server');
let db;

test.beforeEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  db = openDb(path.join(TMP, 'test.db'));
  _resetRate();
  process.env.READDY_IP_SALT = 'test-salt';
  process.env.READDY_PUBLIC_URL = 'https://readdy.test';
});

test.afterEach(() => {
  if (db) db.close();
});

test.after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

// Tiny helper that pipes a fake request through `handle` and captures the response.
function call({ method, path: p, headers = {}, body = null, ip = '1.2.3.4' }) {
  return new Promise((resolve) => {
    const req = new (require('stream').Readable)({ read() {} });
    req.method = method;
    req.url = p;
    req.headers = { ...headers, 'x-forwarded-for': ip };
    req.socket = { remoteAddress: ip };
    if (body !== null) {
      req.push(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.push(null);

    const chunks = [];
    const res = {
      headers: {},
      statusCode: 200,
      headersSent: false,
      writeHead(status, headers) {
        this.statusCode = status;
        this.headers = headers;
        this.headersSent = true;
      },
      end(payload) {
        if (payload) chunks.push(Buffer.from(payload));
        resolve({
          status: this.statusCode,
          headers: this.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      },
      on() {},
    };

    handle(req, res, db).catch((err) => {
      resolve({ status: 500, headers: {}, body: String(err) });
    });
  });
}

// ─── GET / ───

test('GET / returns the homepage HTML', async () => {
  const r = await call({ method: 'GET', path: '/' });
  assert.equal(r.status, 200);
  assert.match(r.headers['Content-Type'], /text\/html/);
  assert.match(r.body, /readdy/);
  assert.match(r.body, /<textarea/);
});

// ─── POST /api/paste ───

test('POST /api/paste creates a paste and returns id + url', async () => {
  const r = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: '今天傍晚從台北車站走回家的路上' },
  });
  assert.equal(r.status, 200);
  const data = JSON.parse(r.body);
  assert.match(data.id, /^[a-hjkmnp-z2-9]{7}$/);
  // New behavior: url uses slug-id form when there is a title
  assert.equal(data.slug, '今天傍晚從台北車站走回家的路上');
  assert.equal(
    data.url,
    `https://readdy.test/${encodeURIComponent('今天傍晚從台北車站走回家的路上')}-${data.id}`
  );
});

test('POST /api/paste rejects wrong content-type with 415', async () => {
  const r = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'text/plain' },
    body: 'hello',
  });
  assert.equal(r.status, 415);
});

test('POST /api/paste rejects empty content with 400', async () => {
  const r = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: '' },
  });
  assert.equal(r.status, 400);
  assert.equal(JSON.parse(r.body).error, 'content empty');
});

test('POST /api/paste rejects whitespace-only content with 400', async () => {
  const r = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: '   \n\t  ' },
  });
  assert.equal(r.status, 400);
});

test('POST /api/paste rejects oversized content with 400', async () => {
  const r = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: 'a'.repeat(100001) },
  });
  assert.equal(r.status, 400);
});

test('POST /api/paste rejects invalid JSON with 400', async () => {
  const r = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: '{ this is not json',
  });
  assert.equal(r.status, 400);
});

test('POST /api/paste rate-limits the 6th request from same IP within a minute', async () => {
  for (let i = 0; i < 5; i++) {
    const r = await call({
      method: 'POST',
      path: '/api/paste',
      headers: { 'content-type': 'application/json' },
      body: { content: `req ${i}` },
      ip: '9.9.9.9',
    });
    assert.equal(r.status, 200, `request ${i + 1} should pass`);
  }
  const r6 = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: 'req 6' },
    ip: '9.9.9.9',
  });
  assert.equal(r6.status, 429);
});

// ─── GET /:id ───

test('GET /:slug-:id renders the reading page for an existing paste', async () => {
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: 'hello world' },
  });
  const { id, slug } = JSON.parse(create.body);

  const r = await call({ method: 'GET', path: `/${slug}-${id}` });
  assert.equal(r.status, 200);
  assert.match(r.headers['Content-Type'], /text\/html/);
  assert.match(r.body, /hello world/);
  assert.match(r.body, /#F4EDE0/i);
});

test('GET /:id with invalid id format returns 404', async () => {
  // Contains 'i' which is not in the alphabet
  const r = await call({ method: 'GET', path: '/aaaiabb' });
  assert.equal(r.status, 404);
  assert.match(r.body, /找不到/);
});

test('GET /:id with valid format but no record returns 404', async () => {
  const r = await call({ method: 'GET', path: '/aaaaaaa' });
  assert.equal(r.status, 404);
});

test('GET /:slug-:id escapes XSS in stored content', async () => {
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: '<script>alert(1)</script>' },
  });
  const { id, slug } = JSON.parse(create.body);

  const r = await call({ method: 'GET', path: `/${slug}-${id}` });
  assert.equal(r.body.includes('<script>alert(1)</script>'), false);
  assert.match(r.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('GET /:slug-:id round-trips multi-line Chinese content', async () => {
  const original = '今天傍晚從台北車站\n走回家的路上\n經過一家很小的書店';
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: original },
  });
  const { id, slug } = JSON.parse(create.body);

  const r = await call({ method: 'GET', path: `/${slug}-${id}` });
  // The escaped content (which is identical to the original here, no special chars) appears verbatim
  assert.match(r.body, /今天傍晚從台北車站/);
  assert.match(r.body, /走回家的路上/);
  assert.match(r.body, /經過一家很小的書店/);
});

// ─── unknown routes ───

test('unknown route returns 404', async () => {
  const r = await call({ method: 'GET', path: '/some/random/path' });
  assert.equal(r.status, 404);
});

// ─── slug URLs ───

test('POST /api/paste returns id, slug, and url with slug form', async () => {
  const r = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: '今天傍晚從台北車站走回家\n第二段內容' },
  });
  assert.equal(r.status, 200);
  const data = JSON.parse(r.body);
  assert.match(data.id, /^[a-hjkmnp-z2-9]{7}$/);
  assert.equal(data.slug, '今天傍晚從台北車站走回家');
  assert.equal(data.url, `https://readdy.test/${encodeURIComponent('今天傍晚從台北車站走回家')}-${data.id}`);
});

test('GET /:slug-:id (ascii) renders the reading page', async () => {
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: 'hello world\nsecond line' },
  });
  const { id } = JSON.parse(create.body);

  const r = await call({ method: 'GET', path: `/hello-world-${id}` });
  assert.equal(r.status, 200);
  assert.match(r.body, /hello world/);
});

test('GET /:id with title returns 301 redirect to slug URL', async () => {
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: 'hello world\nsecond line' },
  });
  const { id } = JSON.parse(create.body);

  const r = await call({ method: 'GET', path: `/${id}` });
  assert.equal(r.status, 301);
  assert.equal(r.headers.Location, `/hello-world-${id}`);
});

test('GET /:id for legacy paste with NULL title returns 200 directly', async () => {
  // Insert directly into the DB to simulate legacy data
  // id must match ID_REGEX (no l/i/o/0/1)
  db.prepare('INSERT INTO pastes (id, content, created_at, views, ip_hash, title) VALUES (?, ?, ?, 0, ?, NULL)')
    .run('aaaaaaa', 'old paste content', 1000, 'h');

  const r = await call({ method: 'GET', path: '/aaaaaaa' });
  assert.equal(r.status, 200);
  assert.match(r.body, /old paste content/);
});

test('GET /wrong-slug-:id still renders correctly (slug is cosmetic)', async () => {
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: 'real title\nbody' },
  });
  const { id } = JSON.parse(create.body);

  const r = await call({ method: 'GET', path: `/totally-wrong-slug-${id}` });
  assert.equal(r.status, 200);
  assert.match(r.body, /real title/);
});

test('GET with malformed slug URL returns 404', async () => {
  const r = await call({ method: 'GET', path: '/hello-toolong12345' });
  assert.equal(r.status, 404);
});

// ─── reading page UI (toolbar / theme / word count) ───

test('reading page contains the toolbar markup', async () => {
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: 'hello world\nbody text' },
  });
  const { id, slug } = JSON.parse(create.body);
  const r = await call({ method: 'GET', path: `/${slug}-${id}` });
  assert.equal(r.status, 200);
  assert.match(r.body, /id="readdy-toolbar"/);
  assert.match(r.body, /readdy-toggle/);
});

test('reading page contains FOUC-prevention inline script', async () => {
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: 'hello world\nbody text' },
  });
  const { id, slug } = JSON.parse(create.body);
  const r = await call({ method: 'GET', path: `/${slug}-${id}` });
  assert.match(r.body, /readdy\.theme/);
  assert.match(r.body, /readdy\.size/);
  assert.match(r.body, /readdy\.font/);
});

test('reading page footer shows word count for ASCII content', async () => {
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: 'hello world goodbye' },
  });
  const { id, slug } = JSON.parse(create.body);
  const r = await call({ method: 'GET', path: `/${slug}-${id}` });
  // 'helloworldgoodbye' = 17 chars after stripping whitespace
  assert.match(r.body, /17 字/);
});

test('reading page footer shows word count for CJK content', async () => {
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: '今天傍晚從台北車站走回家' },
  });
  const { id, slug } = JSON.parse(create.body);
  const r = await call({ method: 'GET', path: `/${slug}-${id}` });
  // 12 CJK chars
  assert.match(r.body, /12 字/);
});

test('reading page uses CSS variables for theming', async () => {
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: 'hello world\nbody' },
  });
  const { id, slug } = JSON.parse(create.body);
  const r = await call({ method: 'GET', path: `/${slug}-${id}` });
  assert.match(r.body, /--bg:/);
  assert.match(r.body, /--fg:/);
  assert.match(r.body, /\[data-theme="dark"\]/);
});

test('reading page uses wider desktop max-width (880px)', async () => {
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: 'hello world\nbody' },
  });
  const { id, slug } = JSON.parse(create.body);
  const r = await call({ method: 'GET', path: `/${slug}-${id}` });
  assert.match(r.body, /max-width:\s*880px/);
});

test('reading page defaults to smaller font on mobile via media query', async () => {
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: 'hello world\nbody' },
  });
  const { id, slug } = JSON.parse(create.body);
  const r = await call({ method: 'GET', path: `/${slug}-${id}` });
  // Mobile media query should override --font-size to 16px
  assert.match(r.body, /@media\s*\(max-width:\s*600px\)[\s\S]*?--font-size:\s*16px/);
});
