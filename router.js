'use strict';

const crypto = require('node:crypto');
const { validate, createPaste, fetchPaste } = require('./paste');
const { renderHomepage, renderReading, renderNotFound } = require('./pages');
const { ID_REGEX } = require('./id');
const { makeSlug, parseSlugUrl } = require('./slug');

// ─── helpers ───

function html(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function redirect(res, location) {
  res.writeHead(301, {
    Location: location,
    'Cache-Control': 'no-store',
  });
  res.end();
}

function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        if (!text) return resolve({});
        resolve(JSON.parse(text));
      } catch {
        reject(Object.assign(new Error('invalid json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket.remoteAddress || '0.0.0.0';
}

function hashIp(ip, salt) {
  return crypto.createHash('sha256').update(ip + ':' + salt).digest('hex').slice(0, 32);
}

// ─── rate limiter (in-memory) ───

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 5;
const buckets = new Map();

function checkRate(ipHash) {
  const now = Date.now();
  const arr = (buckets.get(ipHash) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) {
    buckets.set(ipHash, arr);
    return false;
  }
  arr.push(now);
  buckets.set(ipHash, arr);
  return true;
}

function _resetRate() { buckets.clear(); } // exposed for tests

// ─── public URL builder ───

function publicUrl() {
  return process.env.READDY_PUBLIC_URL || `http://localhost:${process.env.PORT || 4022}`;
}

function buildPasteUrl(slug, id) {
  if (slug) {
    return `${publicUrl()}/${encodeURIComponent(slug)}-${id}`;
  }
  return `${publicUrl()}/${id}`;
}

// ─── handlers ───

async function handle(req, res, db) {
  const url = new URL(req.url, 'http://x');
  const method = req.method;
  const pathname = decodeURIComponent(url.pathname);

  // GET /
  if (method === 'GET' && pathname === '/') {
    return html(res, 200, renderHomepage());
  }

  // POST /api/paste
  if (method === 'POST' && pathname === '/api/paste') {
    const ct = req.headers['content-type'] || '';
    if (!ct.toLowerCase().includes('application/json')) {
      return json(res, 415, { error: 'expected application/json' });
    }

    const ip = clientIp(req);
    const salt = process.env.READDY_IP_SALT || 'unsalted-dev';
    const ipHash = hashIp(ip, salt);

    if (!checkRate(ipHash)) {
      return json(res, 429, { error: 'too many requests, slow down' });
    }

    let body;
    try {
      body = await readJsonBody(req, 200000); // 200 KB hard cap (content max 100k chars)
    } catch (err) {
      return json(res, err.status || 400, { error: err.message });
    }

    const v = validate(body);
    if (!v.ok) return json(res, 400, { error: v.error });

    const id = createPaste(db, body.content, ipHash);
    // Re-fetch to get the title that was just stored.
    const row = fetchPaste(db, id);
    // Undo the views++ side effect since we just created it.
    db.prepare('UPDATE pastes SET views = 0 WHERE id = ?').run(id);
    const slug = makeSlug(row.title || '');

    return json(res, 200, {
      id,
      slug,
      url: buildPasteUrl(slug, id),
    });
  }

  // GET /:id  or  GET /:slug-:id
  if (method === 'GET') {
    const parsed = parseSlugUrl(pathname);
    if (parsed.id) {
      const row = fetchPaste(db, parsed.id);
      if (!row) return html(res, 404, renderNotFound());

      // Bare-id URL with a titled paste → redirect to slug form
      if (parsed.slug === null && row.title && row.title.length > 0) {
        const slug = makeSlug(row.title);
        if (slug) {
          return redirect(res, `/${encodeURIComponent(slug)}-${row.id}`);
        }
      }

      return html(res, 200, renderReading(row));
    }
  }

  // Anything else
  return html(res, 404, renderNotFound());
}

module.exports = { handle, _resetRate };
