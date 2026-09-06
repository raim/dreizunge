// unit-te-popover-save.test.js — v89_ah.
//
// User report: "editing text analysis individually didn't work, save had no effect."
//
// ⚠️ It was never a logic error. The Save button's inline handler was SYNTACTICALLY BROKEN in the
// markup: `JSON.stringify` emits DOUBLE quotes and was interpolated straight into a double-quoted
// onclick attribute, so the browser parsed
//
//     onclick="_teSaveCorrection(" tp_178…",0,0,"riesenfrei")"=""
//
// — the handler truncated to `_teSaveCorrection(`, throwing SyntaxError on every click, and the rest
// became a garbage attribute name. Nothing was ever sent.
//
// ⚠️⚠️ AND IT SURVIVED A FULL TEST SUITE, because every existing test calls `_teSaveCorrection(...)`
// DIRECTLY. Driving the function proves nothing about the button that is supposed to call it —
// `v89_x` learned exactly this and it happened again. So this file asserts on the RENDERED
// ATTRIBUTE, parsed the way a browser parses it, not on the function's behaviour.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP._teacherMode = true;
    APP.lang='de'; APP.srcLang='en';
    TOASTS = []; showToast = function(m){ TOASTS.push(m); };
    _teCacheStore()['tp_X'] = { status:'ready', data:{ sentences:[{ text:'Dank ihr riesenfrei ist', tokens:[] }] } };
    true;`, 'seed');
  return C;
}
// The popover's markup for one token, as the real renderer produces it.
function popHtml(C, surface) {
  C.run(`(function(){
      var html = _teTokenMarkHtml({lemma:'l',form:'f',sense:'s',confidence:'high'},
        ${JSON.stringify(surface)}, {chapterId:'tp_X', si:0}, 0);
      document.body.innerHTML = html;
      _teShowWordPopover({clientX:5,clientY:5,stopPropagation:function(){}}, document.querySelector('mark'));
    })(); true;`, 'open');
  return C.run(`_teWordPopEl ? _teWordPopEl.innerHTML : ''`);
}
// ⚠️ Read through the PARSED DOM, not with a regex over raw markup. `getAttribute` decodes HTML
// entities exactly as a browser does — `&quot;` comes back as `"` — which is the form the browser
// actually hands to the JS parser, and therefore the only form worth asserting on. A regex over the
// source would see the escaped text and could not tell a working handler from a broken one.
function saveHandler(C) {
  return C.run(`(function(){
    if (!_teWordPopEl) return '';
    var bs = [].slice.call(_teWordPopEl.querySelectorAll('button'));
    var b = bs.filter(function(x){ return (x.getAttribute('onclick')||'').indexOf('_teSaveCorrection') > -1; })[0];
    return b ? b.getAttribute('onclick') : '';
  })()`);
}

// ── 1. ⚠️ The rendered onclick is a WELL-FORMED attribute ───────────────────────────────────────
{
  const C = client();
  popHtml(C, 'riesenfrei');
  const m = [saveHandler(C)];
  assert.ok(m[0], 'the Save button has an onclick attribute');
  // ⚠️ This is the assertion the bug would fail. A browser reads a double-quoted attribute up to the
  // NEXT double quote — so an unescaped JSON.stringify inside it truncates the handler to
  // `_teSaveCorrection(`. The attribute must contain the WHOLE call, closing paren included.
  const handler = m[0];
  assert.ok(/^_teSaveCorrection\(/.test(handler), 'it calls the save function');
  assert.ok(/\)$/.test(handler),
    `⚠️ the handler is COMPLETE, not truncated at the first quote — got ${JSON.stringify(handler)}. ` +
    'A truncated handler throws SyntaxError on click and sends nothing, which is exactly the ' +
    'reported "save had no effect".');
  // And it parses as JavaScript. This is the real claim: the browser must be able to RUN it.
  assert.doesNotThrow(() => new Function('_teSaveCorrection', handler),
    `the handler is valid JS: ${JSON.stringify(handler)}`);
  // The arguments really are the correction key, not stringified junk — captured by running the
  // handler with the function replaced by a recorder.
  let captured = null;
  new Function('_teSaveCorrection', handler)((...a) => { captured = a; });
  assert.deepStrictEqual(captured, ['tp_X', 0, 0, 'riesenfrei'],
    'and it passes the chapter id, sentence index, occurrence and surface');
}
console.log('  the Save button renders a complete, parseable onclick with the right arguments: OK');

// ── 2. ⚠️ A surface containing a QUOTE must not break it either ─────────────────────────────────
// The reported word had no quotes of its own, which is why nothing looked wrong in the source. A
// word that does have one is the same bug with a different trigger — and German/English text has
// plenty of apostrophes.
{
  const C = client();
  popHtml(C, `d'accord"x`);
  const h = saveHandler(C);
  assert.ok(h, 'still has an onclick');
  let captured = null;
  assert.doesNotThrow(() => new Function('_teSaveCorrection', h)((...a) => { captured = a; }),
    'a surface containing a quote and an apostrophe still yields a runnable handler');
  assert.strictEqual(captured && captured[3], `d'accord"x`,
    'and the surface arrives intact — escaping must be value-preserving, not lossy');
}
console.log('  a surface containing quotes survives intact: OK');

// ── 3. ⚠️ A save that cannot find its fields REFUSES, rather than clearing ──────────────────────
// Three empty strings is the route's documented CLEAR gesture. So a save whose inputs are missing
// would DELETE the correction instead of failing — which is what the old dismiss handler caused,
// and why the symptom was "no effect" rather than an error.
{
  const C = client();
  popHtml(C, 'riesenfrei');
  C.run(`SENT = null;
    fetch = async function(u,o){ SENT = { url:u, body: JSON.parse(o.body) };
      return { ok:true, status:200, json: async () => ({ ok:true, shadow:{ sentences:[] } }) }; };
    _teCloseWordPop();                      // the fields are gone, as after an accidental dismiss
    _teSaveCorrection('tp_X', 0, 0, 'riesenfrei'); true;`, 'save-without-fields');
  assert.strictEqual(C.run(`SENT`), null,
    '⚠️ no request is sent at all when the editor fields are missing — sending three empty strings ' +
    'would be read by the route as CLEAR and would DELETE the curator\'s correction');
  assert.ok(JSON.parse(C.run(`JSON.stringify(TOASTS)`)).length > 0, 'and the user is told');
}
console.log('  a save with no fields refuses instead of silently deleting the correction: OK');

// ── 4. The dismiss no longer fires on clicks INSIDE the popover ─────────────────────────────────
// lib-dom's addEventListener is a no-op, so the handler cannot be dispatched here — this asserts on
// the SOURCE, and the real-browser behaviour was verified separately (click into a field: survives;
// click outside: dismisses).
{
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = src.indexOf('function _teShowWordPopover');
  const body = src.slice(at, src.indexOf('\n}', src.indexOf('_teWordPopOff = ', at)));
  assert.ok(/pop\.contains\(e\.target\)/.test(body),
    '⚠️ the outside-click dismiss tests containment first. Without it the FIRST click into a field ' +
    'removes the popover — which is what made the editable half unusable after v88_ad added it.');
  assert.ok(!/\{ once: true \}\), 0\);\s*\n\}/.test(body),
    'and it is no longer the fire-on-any-click {once:true} handler');
  assert.ok(/'Escape'/.test(body), 'Escape closes it too');
  const closeAt = src.indexOf('function _teCloseWordPop');
  const closeBody = src.slice(closeAt, src.indexOf('\n}', closeAt));
  assert.ok(/_teWordPopOff/.test(closeBody),
    'and closing removes the listeners it installed — they are no longer self-removing');
}
console.log('  the dismiss checks containment, and its listeners are torn down with the node: OK');

console.log('unit-te-popover-save: ALL PASSED');
