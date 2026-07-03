// unit-order-rtl.test.js
// Bug (v49): sentence-ordering (tOrder) and glyph-ordering banks rendered LTR for an
// en→ar topic opened from the library. Root cause: html.tgt-rtl (which drives
// `.sbox,.wbank{direction:rtl}`) is toggled in updateDocDir() off APP.lang — the FORM
// selection — and goLessonSet() synced only APP.srcLang, never APP.lang, and never
// called updateDocDir(). Fix: goLessonSet syncs the target render context + re-keys
// the flags; _restoreFormLang re-keys them on return; tOrder's containers carry
// dir="auto" as a content-resolved fallback (parity with tGlyphOrder).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// 1) goLessonSet syncs APP.lang to the opened lesson and refreshes direction flags.
const goLessonSet = html.slice(html.indexOf('async function goLessonSet('),
                               html.indexOf('function goLandingClean('));
assert.ok(goLessonSet.length > 0, 'goLessonSet body found before goLandingClean');
assert.ok(/APP\.lang\s*=\s*APP\.lessonData\.lang/.test(goLessonSet),
  'goLessonSet syncs APP.lang (render context) to the opened lesson');
assert.ok(/updateDocDir\(\)/.test(goLessonSet),
  'goLessonSet calls updateDocDir() so tgt-rtl follows the opened lesson');
assert.ok(!/APP\.formLang\s*=/.test(goLessonSet),
  'goLessonSet never touches the form snapshot (APP.formLang)');

// 2) _restoreFormLang re-keys the flags after restoring the form context (a target-only
//    override would otherwise leave a stale tgt-rtl when the source did not change).
const restore = html.slice(html.indexOf('async function _restoreFormLang('),
                           html.indexOf('async function goLanding('));
assert.ok(/updateDocDir\(\)/.test(restore),
  '_restoreFormLang calls updateDocDir() unconditionally');

// 3) tOrder containers are content-aware (dir="auto"), matching tGlyphOrder.
assert.ok(/class="sbox" id="sbox" dir="auto"/.test(html),
  'word-order sentence box (.sbox) carries dir="auto"');
assert.ok(!/<div class="wbank">/.test(html),
  'no word bank (.wbank) is emitted without dir');

// 4) The primary switch stays: tgt-rtl CSS flows the containers RTL.
assert.ok(/html\.tgt-rtl \.sbox,html\.tgt-rtl \.wbank\{direction:rtl\}/.test(html),
  'html.tgt-rtl still flows .sbox/.wbank RTL (primary switch)');

console.log('  order-exercise RTL: lesson-keyed tgt-rtl + dir="auto" containers: OK');
console.log('unit-order-rtl: ALL PASSED');
