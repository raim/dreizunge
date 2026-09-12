// unit-static-applyuistrings.test.js — v91_e.
//
// ⚠️ THE BUG THIS EXISTS FOR, AND WHY NOTHING CAUGHT IT FOR SEVERAL RELEASES.
//
// User: "in static docs/index.html the ui selection in settings has an empty dropdown menu."
//
// `_syncPillTitle` was defined INSIDE the `@static-exclude` region while `applyUIStrings` — which is
// NOT excluded — calls it (added at `v90_w`). So the published build threw
// `ReferenceError: _syncPillTitle is not defined` from inside `applyUIStrings`, **aborting it
// part-way**: every `_setText`/`_setAttr` after that line was silently skipped. The empty dropdown
// was only the visible symptom — it is filled near the END of that function, well past the throw.
//
// ⚠️⚠️ THE POINT OF THIS FILE IS THE CLASS, NOT THE INSTANCE. Fourteen `unit-static-*` guards
// existed and not one RAN the built artefact's own string pass, so a dangling reference inside the
// single function that translates the entire UI was invisible to all of them. `check-inline.js`
// parses the bundle and proves it is syntactically valid — a ReferenceError is not a syntax error.
// This is the fourth time the "`build-static.js` / exclude-region" split has shipped a call to a
// function the published bundle does not contain (`v87_k`, `v88_w`, `v90_j`, now this).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const STATIC = path.join(ROOT, 'docs', 'index.html');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

assert.ok(fs.existsSync(STATIC), 'docs/index.html exists — run `node build-static.js` first');

// The PUBLISHED bundle, not index.html. `loadClient({file})` is the v76_k seam that exists for
// exactly this: "build-static.js carries its own copies, so a claim proved against index.html says
// nothing about the published build."
function staticClient() {
  const C = loadClient({ file: STATIC, quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = APP.info || {}; APP.info.backend = 'none'; APP.info.canGenerate = false;
    APP.lang = 'it'; APP.srcLang = 'de'; APP.uiLang = 'de';
    true;`, 'seed');
  return C;
}

// ── 1. ⭐ applyUIStrings RUNS TO COMPLETION in the published build ────────────────────────────
// The whole defect in one assertion. A ReferenceError anywhere inside it aborts the rest.
{
  const C = staticClient();
  const err = C.run(`(function(){ try { applyUIStrings(); return ''; }
                                  catch(e){ return String(e && e.message || e); } })()`, 'run');
  assert.strictEqual(err, '',
    `⚠️ applyUIStrings() THREW in the published build: ${err}. Everything after the throwing line — ` +
    'most of the UI\'s strings — is silently skipped. The usual cause is a function defined inside ' +
    'the @static-exclude region and called from outside it; move the function below ' +
    '@static-exclude-end rather than teaching build-static.js a copy.');
}
console.log('  applyUIStrings() runs to completion in the published build, without throwing: OK');

// ── 2. It reaches the END — proved by the LAST thing it writes ────────────────────────────────
// ⚠️ Non-vacuity §1 alone cannot give: a function can "not throw" and still return early.
//
// ⚠️ HARNESS LIMIT, and it is why this does not assert on the dropdown itself. `lib-dom` never
// builds `<option>` children — `src-lang-select.options.length` is **0** there even though the real
// browser has 34 — so the dropdown's own count is simply not observable in this harness, in either
// direction. Asserting it would be a check that can never pass, which is worse than no check.
// The dropdown WAS verified in a real browser against the built file at the v91_e cut: 0 options
// before the fix, 33 after. Here we assert the thing that proves the same claim — that execution
// reaches the TAIL of applyUIStrings, past the line that used to throw — using a write the harness
// does support.
{
  const C = staticClient();
  const before = C.run(`(document.getElementById('user-story-clear-btn')||{}).textContent||''`, 'b');
  assert.strictEqual(before, '', 'non-vacuity: the element starts empty, so a later value came from this call');
  C.run(`applyUIStrings(); true;`, 'apply');
  const after = C.run(`(document.getElementById('user-story-clear-btn')||{}).textContent||''`, 'a');
  assert.strictEqual(after, '✕ ' + UI.en['form.clear_text'],
    '⚠️ applyUIStrings must reach its LAST writes. `user-story-clear-btn` is set on the final lines, ' +
    'after the call that used to throw — an empty value here means the string pass aborted part-way ' +
    'again, which is what left the Settings dropdown empty in the published build.');
}
console.log('  applyUIStrings reaches its final writes — the tail past the old throw point runs: OK');

// ── 3. The specific dangling reference, named ─────────────────────────────────────────────────
// ⚠️ Kept as its own check even though §1 subsumes it: §1 says "something threw", this says WHAT,
// and a future reader hitting §1 should not have to re-derive the mechanism from scratch.
{
  const C = staticClient();
  assert.strictEqual(C.run(`typeof _syncPillTitle`, 'sp'), 'function',
    '_syncPillTitle is defined in the published bundle — applyUIStrings calls it, and #bpill calls ' +
    'it from markup that travels into docs/, so BOTH are broken when it is excluded');
}
console.log('  _syncPillTitle — the function that was excluded while still being called — is present: OK');

// ── 4. GENERALISED: nothing applyUIStrings calls may be MISSING from the published bundle ─────
// ⚠️ The instance above is the fourth of its class, so guard the CLASS — but precisely, not by
// scanning call sites with a regex. A first attempt did that and produced false positives from
// inside string literals (`Array.from(`), which would have made this file untrustworthy.
//
// Both sides are exact here instead: the set of `function NAME(` DECLARED in index.html minus the
// set declared in docs/index.html is exactly what the static build drops; intersecting that with
// the names appearing in applyUIStrings' own source is exactly the dangling-reference set for the
// one function whose failure takes the whole UI's strings down with it.
{
  const liveHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const decls = (src) => new Set([...src.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]));
  const staticHtml = fs.readFileSync(STATIC, 'utf8');
  const dropped = [...decls(liveHtml)].filter(n => !decls(staticHtml).has(n));
  assert.ok(dropped.length > 5,
    `non-vacuity: the static build really does drop functions (${dropped.length}) — if this ever ` +
    'reaches zero the comparison has broken, not the build');

  const C = staticClient();
  const fnSrc = String(C.run(`String(applyUIStrings)`, 'src'));
  const danglers = dropped.filter(n => new RegExp('(?<![\\w.$])' + n + '\\s*\\(').test(fnSrc));
  assert.deepStrictEqual(danglers, [],
    `⚠️ applyUIStrings calls ${danglers.join(', ')}, which the PUBLISHED bundle does not define — a ` +
    'ReferenceError at runtime that aborts the rest of the UI string pass. Move the function below ' +
    '@static-exclude-end and call it from both builds; do NOT teach build-static.js a second copy.');
}
console.log('  no function applyUIStrings calls is dropped by the static build: OK');

console.log('unit-static-applyuistrings: ALL PASSED');
