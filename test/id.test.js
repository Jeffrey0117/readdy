'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateId, ID_REGEX, ALPHABET } = require('../id');

test('alphabet has exactly 31 characters', () => {
  assert.equal(ALPHABET.length, 31);
});

test('alphabet excludes ambiguous characters', () => {
  for (const c of '0OoIiLl1') {
    assert.equal(ALPHABET.includes(c), false, `alphabet must not contain ${c}`);
  }
});

test('generateId returns a 7-character string', () => {
  const id = generateId();
  assert.equal(typeof id, 'string');
  assert.equal(id.length, 7);
});

test('generateId only uses characters from the alphabet', () => {
  for (let i = 0; i < 1000; i++) {
    const id = generateId();
    for (const c of id) {
      assert.equal(ALPHABET.includes(c), true, `id ${id} contains illegal char ${c}`);
    }
  }
});

test('ID_REGEX matches generated IDs', () => {
  for (let i = 0; i < 1000; i++) {
    const id = generateId();
    assert.match(id, ID_REGEX);
  }
});

test('ID_REGEX rejects ambiguous characters', () => {
  assert.doesNotMatch('iiiiiii', ID_REGEX);
  assert.doesNotMatch('lllllll', ID_REGEX);
  assert.doesNotMatch('ooooooo', ID_REGEX);
  assert.doesNotMatch('1111111', ID_REGEX);
  assert.doesNotMatch('0000000', ID_REGEX);
});

test('ID_REGEX rejects wrong length', () => {
  assert.doesNotMatch('abcdef', ID_REGEX);   // 6
  assert.doesNotMatch('abcdefgh', ID_REGEX); // 8
});

test('generateId produces highly unique values', () => {
  const seen = new Set();
  for (let i = 0; i < 10000; i++) {
    seen.add(generateId());
  }
  // 10000 ids out of 31^7 ≈ 27 billion → collisions essentially impossible
  assert.equal(seen.size, 10000);
});
