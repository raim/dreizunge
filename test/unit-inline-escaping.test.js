// unit-inline-escaping.test.js
// Bug: storyline "read story" (and "continue story") buttons interpolated a chapter title straight
// into an inline onclick with apostrophe-only escaping. A title containing " \ or a newline produced
// `Uncaught SyntaxError: missing ) after argument list` and the click silently did nothing. Fixes:
// (a) toggleSavedStory no longer takes the title inline — it reads data-topic from the element;
// (b) continueFromLesson uses escJsAttr, a value-preserving JS-string-in-attribute escaper.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function ext(src, n){ const at=src.indexOf('function '+n+'('); const b=src.indexOf('{',at); let d=0,i=b;
  for(;i<src.length;i++){ if(src[i]==='{')d++; else if(src[i]==='}'){ d--; if(!d){ i++; break; } } } return src.slice(at,i); }

// 1. The read-story handler no longer passes the title inline (the source of the crash).
assert.ok(/toggleSavedStory\('\$\{sid\}'\)/.test(html),
  'toggleSavedStory is called with only the sanitized id, not the raw title');
assert.ok(!/toggleSavedStory\('\$\{sid\}','\$\{s\.topic/.test(html),
  'the old inline-title toggleSavedStory call is gone');
assert.ok(/if\(topic==null\) topic=body\.dataset\.topic/.test(html),
  'toggleSavedStory falls back to reading the topic from data-topic');

// 2. continueFromLesson uses escJsAttr.
assert.ok(/continueFromLesson\('\$\{escJsAttr\(s\.id\|\|s\.topic\)\}'/.test(html),
  'continueFromLesson (saved item) uses escJsAttr');
assert.ok(/continueFromLesson\('\$\{escJsAttr\(d\.id\|\|d\.topic\)\}'/.test(html),
  'continueFromLesson (lesson card) uses escJsAttr');
assert.ok(!/\.topic\.replace\(\/'\/g/.test(html),
  'the old apostrophe-only .topic.replace escaping is fully removed');

// 3. escJsAttr is value-preserving and produces a parseable handler for hostile titles.
const escJsAttr = new Function(ext(html, 'escJsAttr') + '\nreturn escJsAttr;')();
const hostile = ["O'Brien's tale", 'She said "hi"', 'back\\slash', 'a\nb', '<script>', 'Café & Co', 'plain'];
for (const title of hostile) {
  // build the inline attribute, HTML-decode it the way the browser would, then JS-parse it.
  const attrVal = `cb('${escJsAttr(title)}')`.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  let got, ok = true;
  try { new Function('cb', attrVal)((x) => { got = x; }); } catch (_) { ok = false; }
  assert.ok(ok, `handler for ${JSON.stringify(title)} parses (no SyntaxError)`);
  assert.strictEqual(got, title, `handler for ${JSON.stringify(title)} preserves the value`);
}
console.log('  inline onclick escaping (read-story / continue): parseable + value-preserving: OK');
console.log('unit-inline-escaping: ALL PASSED');
