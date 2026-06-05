'use strict';

const { makeSelfize } = require('./selfize-client');

const COLLECTION = process.env.SELFIZE_COLLECTION || 'pastes';

// Returns a lightweight "db" handle backed by Selfize (a remote SQLite REST API)
// instead of a local SQLite file — so this app is STATELESS and builds without
// the native better-sqlite3 module, ready to run on a free host (Render).
// Config via env: SELFIZE_URL, SELFIZE_TOKEN.
async function openDb() {
  const sf = makeSelfize();
  await sf.ensureCollection(
    COLLECTION,
    [
      { name: 'pid', type: 'text' },
      { name: 'content', type: 'text' },
      { name: 'title', type: 'text' },
      { name: 'created', type: 'number' },
      { name: 'views', type: 'number' },
      { name: 'ip_hash', type: 'text' },
    ],
    { read: 'admin', create: 'admin', update: 'admin', delete: 'admin' }
  );
  return { sf, collection: COLLECTION, close() {} };
}

module.exports = { openDb };
