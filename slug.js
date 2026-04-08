'use strict';

const TITLE_MAX = 60;

function extractTitle(content) {
  if (typeof content !== 'string') return '';
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed.slice(0, TITLE_MAX);
    }
  }
  return '';
}

function makeSlug(title) {
  if (typeof title !== 'string') return '';
  return title
    .toLowerCase()
    // Replace anything that is not letter / number / underscore with a hyphen.
    // \p{L} = any Unicode letter (covers CJK), \p{N} = any number.
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = { extractTitle, makeSlug, TITLE_MAX };
