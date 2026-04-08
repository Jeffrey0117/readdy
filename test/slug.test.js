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

const { makeSlug } = require('../slug');

test('makeSlug lowercases ASCII', () => {
  assert.equal(makeSlug('Hello World'), 'hello-world');
});

test('makeSlug replaces whitespace runs with single hyphen', () => {
  assert.equal(makeSlug('a   b\tc'), 'a-b-c');
});

test('makeSlug strips punctuation', () => {
  assert.equal(makeSlug('Hello, World!'), 'hello-world');
});

test('makeSlug collapses multiple hyphens', () => {
  assert.equal(makeSlug('a -- b -- c'), 'a-b-c');
});

test('makeSlug trims leading and trailing hyphens', () => {
  assert.equal(makeSlug('  --hello--  '), 'hello');
});

test('makeSlug keeps CJK characters intact', () => {
  assert.equal(makeSlug('今天傍晚從台北車站走回家'), '今天傍晚從台北車站走回家');
});

test('makeSlug joins CJK and ASCII with hyphen on whitespace', () => {
  assert.equal(makeSlug('今天 hello world'), '今天-hello-world');
});

test('makeSlug returns empty string for empty input', () => {
  assert.equal(makeSlug(''), '');
});

test('makeSlug returns empty string for punctuation-only input', () => {
  assert.equal(makeSlug('!!! ??? ...'), '');
});

const { parseSlugUrl } = require('../slug');

test('parseSlugUrl extracts id from bare /:id', () => {
  assert.deepEqual(parseSlugUrl('/abcdefg'), { slug: null, id: 'abcdefg' });
});

test('parseSlugUrl extracts id from /:slug-:id (ascii slug)', () => {
  assert.deepEqual(parseSlugUrl('/hello-world-abcdefg'), { slug: 'hello-world', id: 'abcdefg' });
});

test('parseSlugUrl extracts id from /:slug-:id (cjk slug)', () => {
  assert.deepEqual(
    parseSlugUrl('/今天傍晚從台北車站走回家-abcdefg'),
    { slug: '今天傍晚從台北車站走回家', id: 'abcdefg' }
  );
});

test('parseSlugUrl returns nulls for malformed url (no leading slash)', () => {
  assert.deepEqual(parseSlugUrl('abcdefg'), { slug: null, id: null });
});

test('parseSlugUrl returns nulls when id portion has invalid characters', () => {
  // 'i' is not in the alphabet
  assert.deepEqual(parseSlugUrl('/hello-abciefg'), { slug: null, id: null });
});

test('parseSlugUrl returns nulls when id portion is wrong length', () => {
  assert.deepEqual(parseSlugUrl('/hello-abcde'), { slug: null, id: null });
});

test('parseSlugUrl returns nulls for /', () => {
  assert.deepEqual(parseSlugUrl('/'), { slug: null, id: null });
});

test('parseSlugUrl handles slug containing hyphens', () => {
  assert.deepEqual(parseSlugUrl('/a-b-c-d-abcdefg'), { slug: 'a-b-c-d', id: 'abcdefg' });
});
