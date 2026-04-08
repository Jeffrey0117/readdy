'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openDb } = require('../db');

const TMP = path.join(__dirname, '_tmp_db');

test.beforeEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
});

test.after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('openDb creates the database file and pastes table', () => {
  const dbPath = path.join(TMP, 'test.db');
  const db = openDb(dbPath);
  assert.equal(fs.existsSync(dbPath), true);
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pastes'").get();
  assert.equal(row.name, 'pastes');
  db.close();
});

test('openDb is idempotent', () => {
  const dbPath = path.join(TMP, 'test.db');
  const db1 = openDb(dbPath);
  db1.close();
  const db2 = openDb(dbPath);
  // Should not throw, should still have the table
  const row = db2.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pastes'").get();
  assert.equal(row.name, 'pastes');
  db2.close();
});

test('pastes table has the expected columns', () => {
  const db = openDb(path.join(TMP, 'test.db'));
  const cols = db.prepare("PRAGMA table_info(pastes)").all();
  const names = cols.map((c) => c.name).sort();
  assert.deepEqual(names, ['content', 'created_at', 'id', 'ip_hash', 'title', 'views']);
  db.close();
});

test('id column is the primary key', () => {
  const db = openDb(path.join(TMP, 'test.db'));
  const cols = db.prepare("PRAGMA table_info(pastes)").all();
  const idCol = cols.find((c) => c.name === 'id');
  assert.equal(idCol.pk, 1);
  db.close();
});
