'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { extractTitle } = require('../slug');

test('extractTitle returns first non-empty line trimmed', () => {
  assert.equal(extractTitle('hello world\nrest of content'), 'hello world');
});

test('extractTitle skips leading blank lines', () => {
  assert.equal(extractTitle('\n\n  first real line  \nmore'), 'first real line');
});

test('extractTitle truncates to 60 characters', () => {
  const long = 'a'.repeat(120);
  assert.equal(extractTitle(long).length, 60);
});

test('extractTitle returns empty string for whitespace-only content', () => {
  assert.equal(extractTitle('   \n\t\n   '), '');
});

test('extractTitle handles CRLF line endings', () => {
  assert.equal(extractTitle('windows line\r\nsecond'), 'windows line');
});

test('extractTitle handles single line with no newline', () => {
  assert.equal(extractTitle('just one line'), 'just one line');
});

test('extractTitle handles Chinese content', () => {
  assert.equal(extractTitle('今天傍晚從台北車站走回家\n第二段'), '今天傍晚從台北車站走回家');
});
