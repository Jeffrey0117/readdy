'use strict';

const crypto = require('node:crypto');

// 31 characters, no 0/O/o, 1/I/i/l, deliberately ambiguity-free
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const ID_LENGTH = 7;
const ID_REGEX = /^[a-hjkmnp-z2-9]{7}$/;

function generateId() {
  // Use rejection sampling to avoid modulo bias.
  // 256 mod 31 = 8, so values 248..255 introduce bias — discard them.
  const out = [];
  while (out.length < ID_LENGTH) {
    const buf = crypto.randomBytes(ID_LENGTH * 2);
    for (const byte of buf) {
      if (byte >= 248) continue; // reject biased range
      out.push(ALPHABET[byte % ALPHABET.length]);
      if (out.length === ID_LENGTH) break;
    }
  }
  return out.join('');
}

module.exports = { generateId, ID_REGEX, ALPHABET, ID_LENGTH };
