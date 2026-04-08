'use strict';

const { generateId } = require('./id');
const { extractTitle } = require('./slug');

const MAX_LEN = 100000;
const MAX_RETRIES = 5;

function validate(body) {
  if (!body || typeof body.content !== 'string') {
    return { ok: false, error: 'content required' };
  }
  if (body.content.length === 0) {
    return { ok: false, error: 'content empty' };
  }
  if (body.content.trim().length === 0) {
    return { ok: false, error: 'content empty' };
  }
  if (body.content.length > MAX_LEN) {
    return { ok: false, error: 'content too long' };
  }
  return { ok: true };
}

function createPaste(db, content, ipHash) {
  const insert = db.prepare(
    'INSERT INTO pastes (id, content, title, created_at, views, ip_hash) VALUES (?, ?, ?, ?, 0, ?)'
  );
  const now = Date.now();
  const title = extractTitle(content);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const id = generateId();
    try {
      insert.run(id, content, title, now, ipHash || null);
      return id;
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') continue;
      throw err;
    }
  }
  throw new Error('failed to allocate unique id after retries');
}

function fetchPaste(db, id) {
  const update = db.prepare('UPDATE pastes SET views = views + 1 WHERE id = ?');
  const select = db.prepare('SELECT id, content, title, created_at, views FROM pastes WHERE id = ?');

  const result = update.run(id);
  if (result.changes === 0) return null;
  return select.get(id);
}

module.exports = { validate, createPaste, fetchPaste, MAX_LEN };
