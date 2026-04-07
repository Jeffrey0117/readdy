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
  assert.equal(data.url, `https://readdy.test/${data.id}`);
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

test('GET /:id renders the reading page for an existing paste', async () => {
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: 'hello world' },
  });
  const { id } = JSON.parse(create.body);

  const r = await call({ method: 'GET', path: `/${id}` });
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

test('GET /:id escapes XSS in stored content', async () => {
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: '<script>alert(1)</script>' },
  });
  const { id } = JSON.parse(create.body);

  const r = await call({ method: 'GET', path: `/${id}` });
  assert.equal(r.body.includes('<script>alert(1)</script>'), false);
  assert.match(r.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('GET /:id round-trips multi-line Chinese content', async () => {
  const original = '今天傍晚從台北車站\n走回家的路上\n經過一家很小的書店';
  const create = await call({
    method: 'POST',
    path: '/api/paste',
    headers: { 'content-type': 'application/json' },
    body: { content: original },
  });
  const { id } = JSON.parse(create.body);

  const r = await call({ method: 'GET', path: `/${id}` });
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
