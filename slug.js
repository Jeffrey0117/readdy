'use strict';

const { ID_REGEX } = require('./id');
const SLUG_ID_REGEX = /^(.+)-([a-hjkmnp-z2-9]{7})$/;

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

function parseSlugUrl(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) {
    return { slug: null, id: null };
  }
  const rest = pathname.slice(1);
  if (rest.length === 0) return { slug: null, id: null };

  // Bare id case: matches ID_REGEX exactly
  if (ID_REGEX.test(rest)) {
    return { slug: null, id: rest };
  }

  // /:slug-:id case
  const m = rest.match(SLUG_ID_REGEX);
  if (m) {
    return { slug: m[1], id: m[2] };
  }

  return { slug: null, id: null };
}

module.exports = { extractTitle, makeSlug, parseSlugUrl, TITLE_MAX };
