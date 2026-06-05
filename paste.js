'use strict';

const { generateId } = require('./id');
const { extractTitle } = require('./slug');

const MAX_LEN = 100000;

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

// Create a paste in Selfize. Returns the short public id (pid).
async function createPaste(db, content, ipHash) {
  const pid = generateId();
  const title = extractTitle(content);
  await db.sf.create(db.collection, {
    pid,
    content,
    title,
    created: Date.now(),
    views: 0,
    ip_hash: ipHash || null,
  });
  return pid;
}

// Fetch a paste by its short id, bump views, and return a row-shaped object
// (or null). The view increment is fire-and-forget so reads stay fast.
async function fetchPaste(db, pid) {
  const rec = await db.sf.findOne(db.collection, 'pid', pid);
  if (!rec) return null;
  const views = (rec.views || 0) + 1;
  db.sf.update(db.collection, rec.id, { views }).catch(() => {});
  return {
    id: rec.pid,
    content: rec.content,
    title: rec.title,
    created_at: rec.created,
    views,
  };
}

module.exports = { validate, createPaste, fetchPaste, MAX_LEN };
