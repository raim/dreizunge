// unit-static-gen-btn-hidden.test.js — v81_x.
//
// PLAN §C5 stage 2 (v81_w) added a "Generate new" button to the LIBRARY screen
// (`lib-generate-new-btn`) as the entry point into the new `#generation-screen`. In the static
// build that screen is entirely disabled — `gen-area` hidden, a warning overlay in its place — so a
// visible "Generate new" button on the library screen led somewhere with nothing usable on it. The
// fix (`build-static.js`'s `renderPill()`) hides the button itself.
//
// Same pattern as unit-static-selectlang-tts.test.js: assert against the WINNING definition in the
// BUILT docs/index.html, not the builder's string array — docs/index.html carries two `renderPill`
// definitions (the live one, copied in wholesale, then the static override), and the later one
// wins in a browser.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const docs = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');

const last = docs.lastIndexOf('function renderPill(');
assert.ok(last > -1, 'the built static page defines renderPill');
let d = 0, i = docs.indexOf('{', last), end = i;
for (; i < docs.length; i++) {
  const c = docs[i];
  if (c === '{') d++;
  else if (c === '}') { d--; if (!d) { end = i + 1; break; } }
}
const winning = docs.slice(last, end);

assert.ok(/lib-generate-new-btn/.test(winning),
  'the renderPill that WINS in docs/index.html must reference lib-generate-new-btn at all');
assert.ok(/getElementById\('lib-generate-new-btn'\)[\s\S]{0,60}style\.display\s*=\s*'none'/.test(winning),
  "THE REGRESSION: the winning renderPill must hide lib-generate-new-btn — otherwise the static " +
  "build's library screen shows a \"Generate new\" button that opens a screen with nothing usable " +
  "on it (generation is fully disabled in static mode)");
console.log('  the winning renderPill in docs/index.html hides lib-generate-new-btn: OK');

// ── mutation check on the source it comes from, not just a regex match ─────
// Confirms the assertion above would actually catch the button being left visible, rather than
// matching something unrelated to the button's own display state.
{
  const mutated = winning.replace(
    /getElementById\('lib-generate-new-btn'\);\s*\n\s*if \(_libGenBtn\) _libGenBtn\.style\.display = 'none';/,
    "getElementById('lib-generate-new-btn');"
  );
  assert.notStrictEqual(mutated, winning, 'the mutation must actually remove the hiding line — if ' +
    'this fires, the regex above no longer matches the real source and the guard is vacuous');
  assert.ok(!/getElementById\('lib-generate-new-btn'\)[\s\S]{0,60}style\.display\s*=\s*'none'/.test(mutated),
    'sanity: with the hiding line removed, the main assertion pattern must NOT match');
}
console.log('  mutation check: removing the hide line makes the guard fail: OK');

console.log('unit-static-gen-btn-hidden: ALL PASSED');
