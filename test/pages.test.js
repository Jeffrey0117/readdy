'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml, renderHomepage, renderReading, renderNotFound } = require('../pages');

// ─── escapeHtml ───

test('escapeHtml escapes < and >', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
});

test('escapeHtml escapes &', () => {
  assert.equal(escapeHtml('A & B'), 'A &amp; B');
});

test('escapeHtml escapes double quotes', () => {
  assert.equal(escapeHtml('he said "hi"'), 'he said &quot;hi&quot;');
});

test('escapeHtml escapes single quotes', () => {
  assert.equal(escapeHtml("it's"), 'it&#39;s');
});

test('escapeHtml escapes ampersand FIRST (not double-escape)', () => {
  // If & were escaped after <, we would get &amp;lt; — we want &lt;
  assert.equal(escapeHtml('<&>'), '&lt;&amp;&gt;');
});

test('escapeHtml leaves plain Chinese text untouched', () => {
  assert.equal(escapeHtml('今天傍晚從台北車站'), '今天傍晚從台北車站');
});

test('escapeHtml leaves newlines untouched', () => {
  assert.equal(escapeHtml('a\nb'), 'a\nb');
});

// ─── renderHomepage ───

test('renderHomepage returns a complete HTML document', () => {
  const html = renderHomepage();
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<\/html>\s*$/);
});

test('renderHomepage includes the readdy title', () => {
  const html = renderHomepage();
  assert.match(html, />readdy</);
});

test('renderHomepage includes a textarea', () => {
  const html = renderHomepage();
  assert.match(html, /<textarea/);
});

test('renderHomepage links to Google Fonts Noto Serif TC', () => {
  const html = renderHomepage();
  assert.match(html, /Noto\+Serif\+TC/);
});

// ─── renderReading ───

test('renderReading returns a complete HTML document', () => {
  const html = renderReading({
    id: 'k7p2qra',
    content: 'hello world',
    created_at: 1707000000000,
  });
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<\/html>\s*$/);
});

test('renderReading escapes script tags in content', () => {
  const html = renderReading({
    id: 'k7p2qra',
    content: '<script>alert(1)</script>',
    created_at: 1707000000000,
  });
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('renderReading preserves newlines in escaped content', () => {
  const html = renderReading({
    id: 'k7p2qra',
    content: 'line one\nline two',
    created_at: 1707000000000,
  });
  // pre-wrap means raw \n inside the element is fine
  assert.match(html, /line one\nline two/);
});

test('renderReading uses warm-tone CSS values from spec', () => {
  const html = renderReading({
    id: 'k7p2qra',
    content: 'hi',
    created_at: 1707000000000,
  });
  assert.match(html, /#F4EDE0/i);
  assert.match(html, /#3a2f1f/i);
  assert.match(html, /Noto Serif TC/);
  assert.match(html, /19px/);
});

test('renderReading includes white-space: pre-wrap', () => {
  const html = renderReading({
    id: 'k7p2qra',
    content: 'hi',
    created_at: 1707000000000,
  });
  assert.match(html, /pre-wrap/);
});

test('renderReading footer shows word count without date', () => {
  const html = renderReading({
    id: 'k7p2qra',
    content: 'hi',
    created_at: new Date('2026-04-07T00:00:00Z').getTime(),
  });
  assert.match(html, /readdy/);
  assert.doesNotMatch(html, /2026/);
});

// ─── renderNotFound ───

test('renderNotFound returns a complete HTML document', () => {
  const html = renderNotFound();
  assert.match(html, /^<!DOCTYPE html>/);
});

test('renderNotFound shows the not-found message', () => {
  const html = renderNotFound();
  assert.match(html, /這份文字找不到了/);
});

test('renderNotFound includes link back to homepage', () => {
  const html = renderNotFound();
  assert.match(html, /href="\/"/);
});
