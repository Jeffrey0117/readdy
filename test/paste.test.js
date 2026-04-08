'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openDb } = require('../db');
const { validate, createPaste, fetchPaste, MAX_LEN } = require('../paste');

const TMP = path.join(__dirname, '_tmp_paste');
let db;

test.beforeEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  db = openDb(path.join(TMP, 'test.db'));
});

test.afterEach(() => {
  if (db) db.close();
});

test.after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

// ─── validate ───

test('validate rejects missing content', () => {
  const r = validate({});
  assert.equal(r.ok, false);
  assert.equal(r.error, 'content required');
});

test('validate rejects non-string content', () => {
  const r = validate({ content: 123 });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'content required');
});

test('validate rejects empty string', () => {
  const r = validate({ content: '' });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'content empty');
});

test('validate rejects whitespace-only string', () => {
  const r = validate({ content: '   \n\t  ' });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'content empty');
});

test('validate rejects oversized content', () => {
  const r = validate({ content: 'a'.repeat(MAX_LEN + 1) });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'content too long');
});

test('validate accepts normal content', () => {
  const r = validate({ content: '今天傍晚從台北車站走回家的路上' });
  assert.equal(r.ok, true);
});

test('MAX_LEN is 100000', () => {
  assert.equal(MAX_LEN, 100000);
});

// ─── createPaste / fetchPaste ───

test('createPaste stores and returns an id', () => {
  const id = createPaste(db, '一段測試文字', 'hash123');
  assert.equal(typeof id, 'string');
  assert.equal(id.length, 7);
});

test('fetchPaste returns null for missing id', () => {
  const r = fetchPaste(db, 'aaaaaaa');
  assert.equal(r, null);
});

test('createPaste then fetchPaste round-trips content exactly', () => {
  const original = '今天傍晚從台北車站\n走回家的路上';
  const id = createPaste(db, original, 'hash123');
  const fetched = fetchPaste(db, id);
  assert.equal(fetched.content, original);
});

test('fetchPaste increments views', () => {
  const id = createPaste(db, 'hello', 'hash123');
  const r1 = fetchPaste(db, id);
  const r2 = fetchPaste(db, id);
  const r3 = fetchPaste(db, id);
  assert.equal(r1.views, 1);
  assert.equal(r2.views, 2);
  assert.equal(r3.views, 3);
});

test('createPaste sets created_at to a recent timestamp', () => {
  const before = Date.now();
  const id = createPaste(db, 'hello', 'hash123');
  const after = Date.now();
  const r = fetchPaste(db, id);
  assert.ok(r.created_at >= before);
  assert.ok(r.created_at <= after);
});

test('createPaste stores ip_hash', () => {
  const id = createPaste(db, 'hello', 'specific_hash_value');
  const row = db.prepare('SELECT ip_hash FROM pastes WHERE id = ?').get(id);
  assert.equal(row.ip_hash, 'specific_hash_value');
});

test('db migration adds title column to pre-existing pastes table without it', () => {
  // Build a fresh DB that has the OLD schema (no title column)
  const oldDbPath = path.join(TMP, 'old.db');
  const Database = require('better-sqlite3');
  const oldDb = new Database(oldDbPath);
  oldDb.exec(`
    CREATE TABLE pastes (
      id          TEXT PRIMARY KEY,
      content     TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      views       INTEGER NOT NULL DEFAULT 0,
      ip_hash     TEXT
    );
  `);
  oldDb.prepare('INSERT INTO pastes (id, content, created_at) VALUES (?, ?, ?)').run('legacyy', 'old content', 1000);
  oldDb.close();

  // Now open it through openDb — should add the title column
  const migrated = openDb(oldDbPath);
  const cols = migrated.prepare("PRAGMA table_info(pastes)").all();
  const colNames = cols.map((c) => c.name);
  assert.ok(colNames.includes('title'), 'title column should exist after migration');

  // Existing row should still be there with title = NULL
  const row = migrated.prepare('SELECT id, content, title FROM pastes WHERE id = ?').get('legacyy');
  assert.equal(row.content, 'old content');
  assert.equal(row.title, null);
  migrated.close();
});
