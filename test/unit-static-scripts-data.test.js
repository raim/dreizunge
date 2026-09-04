// unit-static-scripts-data.test.js — v89_q.
//
// The static build BAKES scripts.json in as `window.SCRIPTS_DATA` and its `init()` never called
// `loadScripts()` — the function whose whole first line exists to pick that up. So the module-level
// `SCRIPTS_DATA` stayed `{}` in every published build, `scriptsForLang()` returned `[]`, and the
// LLM-FREE ALPHABET COURSE could not be offered at all: `scriptsUsedInLessonSet()` had nothing to
// offer from. A pure client-side feature, no backend needed, data already shipped, one missing wire.
// Same shape as the `_storyTapInit` gap `v86_h` found.
//
// ⚠️ This file asserts BEHAVIOUR against the BUILT artefact (`docs/index.html`), not source text.
// The sibling `unit-static-story-tap-parity.test.js` checks that the call APPEARS in the built
// `init()`; that is necessary and not sufficient — it cannot see whether the data actually lands.
// The bug here was invisible to every source-level check in the suite, because both halves (the
// baked data, the loader) were individually present and correct.
'use strict';
const assert = require('assert');
const { loadClient } = require('./lib-dom');

// ── 1. The data really is baked, and the loader really does pick it up ─────────────────────────
{
  const C = loadClient({ quiet: true, file: 'docs/index.html' });

  // The two halves that were each fine on their own.
  const baked = C.run(`window.SCRIPTS_DATA ? Object.keys(window.SCRIPTS_DATA).length : 0`);
  assert.ok(baked > 5, `scripts.json is baked into the static bundle (got ${baked} keys)`);
  assert.strictEqual(C.run(`typeof loadScripts`), 'function', 'and the loader is present in the bundle');

  // ⚠️ THE REGRESSION ITSELF: before the loader runs, the module-level table is empty. This is the
  // state every published build shipped in, and it is what makes the assertion below meaningful
  // rather than tautological — the data being present did NOT mean it was in use.
  assert.strictEqual(C.run(`Object.keys(SCRIPTS_DATA).length`), 0,
    'a fresh bundle starts with an EMPTY module-level SCRIPTS_DATA — the baked copy is not it');
  // JSON round-tripped: an array built inside the sandbox carries THAT context's Array.prototype,
  // which deepStrictEqual compares. A standing harness trap, hit twice in this line alone.
  const arr = (expr) => JSON.parse(C.run('JSON.stringify(' + expr + ')'));
  assert.deepStrictEqual(arr(`scriptsForLang('ja')`), [],
    'and every reader sees nothing until the loader has run');

  C.run(`loadScripts(); true;`);

  assert.ok(C.run(`Object.keys(SCRIPTS_DATA).length`) > 5,
    'after loadScripts() the module-level table carries the baked data');
  assert.deepStrictEqual(arr(`scriptsForLang('ja')`), ['hiragana', 'katakana'],
    'and scriptsForLang resolves a digraphic language from it');
  assert.deepStrictEqual(arr(`scriptsForLang('ru')`), ['cyrillic'], 'and a single-script one');
  // (`hasScriptChoice` is deliberately NOT probed: it is not present in the static bundle at all —
  // build-static.js drops it with the generation-side code that is its only caller. Checked, not
  // assumed; asserting on it here would have been a test of the builder's exclusions, not of this.)
}
console.log('  the baked scripts data is inert until loadScripts() runs, and complete afterwards: OK');

// ── 2. ⚠️ The user-visible consequence: the alphabet course can be OFFERED ─────────────────────
// This is the assertion that actually matters. `scriptsUsedInLessonSet` is what decides whether a
// learner is ever shown the script course, and with an empty table it returns nothing for every
// language pair in the corpus — which is what "the course cannot be reached in a published build"
// means concretely.
{
  const C = loadClient({ quiet: true, file: 'docs/index.html' });
  const d = { lang: 'ja', srcLang: 'en', topic: 'T', story: 'これはテストです。', lessons: [] };
  const probe = `scriptsUsedInLessonSet(${JSON.stringify(d)})`;

  const arr = (expr) => JSON.parse(C.run('JSON.stringify(' + expr + ')'));
  const before = arr(probe);
  assert.deepStrictEqual(before, [],
    'THE REGRESSION: with the table empty, a Japanese lesson set offers NO script course at all');

  C.run(`loadScripts(); true;`);
  const after = arr(probe);
  assert.ok(Array.isArray(after) && after.length > 0,
    `and once the data is loaded it offers one (got ${JSON.stringify(after)})`);
  assert.ok(after.some(n => n === 'hiragana' || n === 'katakana'),
    `specifically the scripts the target language actually uses (got ${JSON.stringify(after)})`);
}
console.log('  a Japanese lesson set offers no script course on an empty table, and does once loaded: OK');

// ── 3. The built init() actually calls it ──────────────────────────────────────────────────────
// §1 and §2 prove the MECHANISM; this proves the WIRE. Both are needed: the mechanism worked
// perfectly all along, and the bug was only ever the missing call.
{
  const fs = require('fs');
  const path = require('path');
  const docs = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
  const at = docs.indexOf('async function init(');
  assert.ok(at > -1, 'the built page defines init()');
  let depth = 0, i = docs.indexOf('{', at), end = i;
  for (; i < docs.length; i++) {
    const c = docs[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) { end = i + 1; break; } }
  }
  const body = docs.slice(at, end);
  // ⚠️ Matched on the AWAITED CALL, not on the bare name. The init carries a comment explaining why
  // the call is there, and that comment necessarily mentions the function — so a bare-name regex
  // matched the COMMENT and the mutation check below stayed green with the call deleted. That is
  // this repo's standing rule twice over: assert on the delimited value, and do not let a comment
  // near a source-scanned pattern spell the pattern. Found by the mutation, not by review.
  const CALL = /await loadScripts\(\);/;
  assert.ok(CALL.test(body),
    "the static build's own init() must AWAIT loadScripts() — the data is baked in and inert without it");
  // Ordering: it has to run before anything that reads the table. loadLanguages() is its sibling and
  // the established anchor for "boot-time baked data", so being adjacent to it is the check.
  assert.ok(body.indexOf('await loadScripts();') > body.indexOf('await loadLanguages();'),
    'and it runs after loadLanguages(), where the other baked table is loaded');
  const mutated = body.replace(CALL, '');
  assert.notStrictEqual(mutated, body, 'mutation check: the call is present in the form this guard expects');
  assert.ok(!CALL.test(mutated), 'sanity: removing the CALL makes the assertion above fail');
}
console.log('  the built init() calls loadScripts(), after loadLanguages(): OK');

console.log('unit-static-scripts-data: ALL PASSED');
