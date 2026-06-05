'use strict';

/**
 * Selfize client — the reusable data layer for parasite apps (寄生獸線路).
 *
 * Drop this file into any app you're converting to a stateless parasite, swap
 * its local-SQLite calls for these methods, and the app stores its data in your
 * own Selfize REST DB (selfize.isnowfriend.com) instead of an ephemeral local
 * file — so it builds (no native better-sqlite3) and runs stateless on Render.
 *
 * Config via env (set on the parasite host):
 *   SELFIZE_URL    e.g. https://selfize.isnowfriend.com
 *   SELFIZE_TOKEN  the admin bearer token
 *
 * Uses global fetch (Node >= 18). All methods are async.
 */

function makeSelfize(opts = {}) {
  const base = (opts.url || process.env.SELFIZE_URL || '').replace(/\/+$/, '');
  const token = opts.token || process.env.SELFIZE_TOKEN || '';
  if (!base) throw new Error('selfize: SELFIZE_URL not set');

  async function call(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* non-json */ }
    return { status: res.status, ok: res.ok, data };
  }

  return {
    raw: call,

    /** Idempotent: create the collection if it doesn't exist. */
    async ensureCollection(name, schema = [], rules) {
      const got = await call('GET', `/api/collections/${name}`);
      if (got.status === 200) return got.data;
      const body = { name, schema };
      if (rules) body.rules = rules;
      const created = await call('POST', '/api/collections', body);
      if (!created.ok) {
        // Selfize collection-mgmt endpoints can 401 even for the admin token; the
        // /records endpoints still work AND auto-create the collection on write.
        // So this is NON-FATAL — warn and let records ops proceed (no crash on boot).
        console.warn(`selfize: ensureCollection ${name} skipped (${created.status}) — records ops auto-create`);
        return null;
      }
      return created.data;
    },

    /** List records. query = raw query string e.g. "pid=eq.abc&limit=1". Returns { items, total }. */
    async list(col, query = '') {
      const r = await call('GET', `/api/collections/${col}/records${query ? '?' + query : ''}`);
      return r.data || { items: [], total: 0 };
    },

    /** Get one record by Selfize id (or null if 404). */
    async get(col, id) {
      const r = await call('GET', `/api/collections/${col}/records/${id}`);
      return r.status === 200 ? r.data : null;
    },

    /** Create a record. Returns the created record (with its UUID id). */
    async create(col, fields) {
      const r = await call('POST', `/api/collections/${col}/records`, fields);
      if (!r.ok) throw new Error(`selfize: create record in ${col} failed (${r.status}): ${JSON.stringify(r.data)}`);
      return r.data;
    },

    /** Patch a record by id. Returns the updated record. */
    async update(col, id, patch) {
      const r = await call('PATCH', `/api/collections/${col}/records/${id}`, patch);
      if (!r.ok) throw new Error(`selfize: update record ${id} in ${col} failed (${r.status})`);
      return r.data;
    },

    /** Delete a record by id. */
    async remove(col, id) {
      const r = await call('DELETE', `/api/collections/${col}/records/${id}`);
      return r.ok || r.status === 404;
    },

    /** Find one record by a field value (exact). Returns the record or null. */
    async findOne(col, field, value) {
      const r = await this.list(col, `${field}=eq.${encodeURIComponent(value)}&limit=1`);
      return (r.items && r.items[0]) || null;
    },
  };
}

module.exports = { makeSelfize };
