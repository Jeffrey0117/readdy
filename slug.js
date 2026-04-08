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

module.exports = { extractTitle, TITLE_MAX };
