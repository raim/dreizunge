// unit-static-story-tap-parity.test.js — v86_h.
//
// User-reported: "In static/index.html progress cards, not all text interaction features work,
// e.g. we can't click on the summary or un-highlighted text in chapter story fields to proceed
// (like next button)." Root cause: `_storyTapInit()` (mobile follow-up — a tap on plain story text
// advances, same as clicking Next) is wired from the REGULAR init() (index.html), which lives inside
// the `@static-exclude-start`/`@static-exclude-end` region build-static.js drops entirely for the
// static build. build-static.js supplies its OWN replacement `init()` — and that replacement never
// called `_storyTapInit()` at all, so the click-to-advance LISTENER was simply never attached in the
// static build, even though `_storyTapInit`/`_storyTapMaybeAdvance` themselves are defined AFTER the
// exclude-end marker and so ARE present and correct in the static bundle. A missing wire-up, not a
// missing function.
//
// Same pattern as unit-static-gen-btn-hidden.test.js: assert against the BUILT docs/index.html's
// own `init()` (there is exactly ONE definition, unlike renderPill's two — no "winning" ambiguity
// here, but checking the built artifact still confirms the actual shipped bundle, not just the
// builder's own template-literal source).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const docs = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');

const at = docs.indexOf('async function init(');
assert.ok(at > -1, 'the built static page defines init()');
let d = 0, i = docs.indexOf('{', at), end = i;
for (; i < docs.length; i++) {
  const c = docs[i];
  if (c === '{') d++;
  else if (c === '}') { d--; if (!d) { end = i + 1; break; } }
}
const body = docs.slice(at, end);

assert.ok(/_storyTapInit\(\)/.test(body),
  "THE REGRESSION: the static build's own init() must call _storyTapInit() — otherwise tapping " +
  "plain story text/summary to advance (the mobile follow-up) is silently dead in the static build, " +
  "even though the function itself is present");
console.log('  the static build\'s own init() wires _storyTapInit(): OK');

// _storySelInit (select text -> ASK THE TUTOR, PLAN §12) is correctly STILL absent from the static
// init — that feature genuinely needs a live backend, unlike tap-to-advance, which is pure
// client-side navigation. Asserted explicitly so a future "just add everything" fix doesn't
// accidentally wire up a feature that would silently no-op (or worse, show a broken tutor widget)
// with no backend behind it.
assert.ok(!/_storySelInit\(\)/.test(body),
  '_storySelInit (needs a live backend) is deliberately NOT wired into the static init — only ' +
  'add it if the static build genuinely gains tutor support');
console.log('  _storySelInit (backend-dependent) is correctly still absent from the static init: OK');

// ── mutation check: confirms the assertion would actually catch the call being removed ────────────
{
  const mutated = body.replace(/try \{ _storyTapInit\(\); \} catch \(_\) \{\}/, '');
  assert.notStrictEqual(mutated, body,
    'the mutation must actually remove the call — if this fires, the regex above no longer matches ' +
    'the real source and the guard is vacuous');
  assert.ok(!/_storyTapInit\(\)/.test(mutated), 'sanity: with the call removed, the main assertion must NOT match');
}
console.log('  mutation check: removing the _storyTapInit() call makes the guard fail: OK');

console.log('unit-static-story-tap-parity: ALL PASSED');
