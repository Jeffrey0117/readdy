'use strict';

const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS pastes (
    id          TEXT PRIMARY KEY,
    content     TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    views       INTEGER NOT NULL DEFAULT 0,
    ip_hash     TEXT,
    title       TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_pastes_created ON pastes(created_at);
`;

function migrate(db) {
  // Idempotent: add columns that older databases might be missing.
  // Catch the "duplicate column name" error and ignore it.
  try {
    db.exec('ALTER TABLE pastes ADD COLUMN title TEXT');
  } catch (err) {
    if (!/duplicate column name/i.test(err.message)) throw err;
  }
}

function openDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

module.exports = { openDb };
