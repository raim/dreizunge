// unit-error-hunt-rtl.test.js
// Bug: the error-hunt story containers rendered LTR even for Arabic content, because the
// .eh-wrap (play), .aeh-wrap (AI error hunt play), and #eh-diff (editor) containers had no
// dir="auto". Content-aware direction must be on each so RTL text flows right-to-left.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.ok(/class="eh-wrap" id="eh-wrap" dir="auto"/.test(html),
  'error-hunt play container (.eh-wrap) has dir="auto"');
assert.ok(/class="aeh-wrap" id="aeh-wrap" dir="auto"/.test(html),
  'AI error-hunt play container (.aeh-wrap) has dir="auto"');
assert.ok(/id="eh-diff-\$\{li\}" dir="auto"/.test(html),
  'error-hunt editor diff container (#eh-diff) has dir="auto"');

// guard against regressing to a dir-less container
assert.ok(!/class="eh-wrap" id="eh-wrap">/.test(html), 'eh-wrap is never emitted without dir');
assert.ok(!/class="aeh-wrap" id="aeh-wrap">/.test(html), 'aeh-wrap is never emitted without dir');

console.log('  error-hunt containers (play, AI-play, editor diff) are content-aware RTL: OK');
console.log('unit-error-hunt-rtl: ALL PASSED');
