// unit-card-errors.test.js
// v77_b: `showComplete` carried seven `catch(_) {}` blocks. A throw in any of them left the card
// half-rendered — the pass-mark gate, the header, the storyboard, the icon row, the action row —
// with the whole suite green, because nothing observable threw. Session 30 hit this exact shape in
// server.js: a ReferenceError swallowed by its own catch dropped every error-hunt lesson silently,
// and was caught only because a test asserted the RESULT rather than the call.
//
// Two affordances, neither of which changes behaviour by default:
//   _cardErrors()           -> what THIS render swallowed (reset per render)
//   APP._cardStrict = true  -> rethrow at the site instead of swallowing
//
// This file asserts the LEDGER WORKS by breaking a real collaborator and watching it be recorded —
// it does not assert on the source text of showComplete. §5 is the one structural check, and it is
// about the ABSENCE of a construct rather than the presence of a phrasing.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const usable = t => (t.story || '').length > 200 && (t.lessons || []).length >= 3;
const TOPIC = store.topics.find(usable);
assert.ok(TOPIC, 'the corpus offers a chapter with a story and >=3 lessons');

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
       APP.storylines = ${JSON.stringify(store.storylines || [])}; true;`, 'seed-static');
C.run(`var _origStoryboard = _renderCompStoryboard; true;`, 'save-original');

function seed(o) {
  o = o || {};
  C.run(`
    APP.lessonData = ${JSON.stringify(TOPIC)};
    APP.lang = ${JSON.stringify(TOPIC.lang)}; APP.srcLang = ${JSON.stringify(TOPIC.srcLang)};
    APP._teacherMode = ${!!o.teacher}; APP._cardStrict = ${!!o.strict};
    APP.info = { backend:'none', canGenerate:false, version:'test', coverageThreshold: 1 };
    APP.progress = { completed: {}, solved: {}, learned: {} };
    APP.cur = { lessonIdx: 0, correct: 1, total: 1, mistakes: 0, bestStreak: 1, flagCount: 0,
                exercises: [], ${o.review ? '_review: true,' : ''} cur: 0 };
    true;`, 'seed');
}
const ledger = () => JSON.parse(C.run(`JSON.stringify(_cardErrors())`));
const breakStoryboard = () =>
  C.run(`_renderCompStoryboard = function(){ throw new Error('injected: storyboard'); }; true;`);
const restore = () => C.run(`_renderCompStoryboard = _origStoryboard; true;`);

// ── 1. A clean render swallows nothing ──────────────────────────────────────
// Load-bearing as the non-vacuity floor for §2: if the ledger were already non-empty here, §2's
// "the injected error was recorded" would pass for the wrong reason (session-28 rule 3).
{
  restore();
  seed();
  C.run(`showComplete();`, 'clean-render');
  const errs = ledger();
  assert.strictEqual(errs.length, 0,
    'a clean completion card swallows nothing (got: ' + JSON.stringify(errs) + ')');
  console.log('  clean render: _cardErrors() empty');
}

// ── 2. A throw inside a wrapped block is RECORDED, and still swallowed ──────
// Both halves matter. Recorded = the blind spot is gone. Still swallowed = default behaviour is
// unchanged, so this release cannot itself break a card that renders today.
{
  restore();
  seed();
  breakStoryboard();
  let escaped = null;
  try { C.run(`showComplete();`, 'broken-render'); } catch (e) { escaped = e.message; }
  assert.strictEqual(escaped, null,
    'by default the catch still swallows — showComplete does not throw');
  const errs = ledger();
  assert.strictEqual(errs.length, 1, 'exactly one site recorded, got ' + JSON.stringify(errs));
  assert.strictEqual(errs[0].where, 'storyboard', 'the ledger NAMES the site that threw');
  assert.ok(/injected: storyboard/.test(errs[0].msg), 'the ledger carries the real message');
  console.log('  injected throw: recorded as "' + errs[0].where + '", card still rendered');
}

// ── 3. Strict mode rethrows at the site ────────────────────────────────────
{
  restore();
  seed({ strict: true });
  breakStoryboard();
  let escaped = null;
  try { C.run(`showComplete();`, 'strict-render'); } catch (e) { escaped = e.message; }
  assert.ok(escaped && /injected: storyboard/.test(escaped),
    'APP._cardStrict makes the throw escape instead of being swallowed (got: ' + escaped + ')');
  console.log('  strict mode: throw escapes showComplete');
}

// ── 4. The ledger is PER-RENDER, not cumulative ────────────────────────────
// Without this, "assert the ledger is empty" would be a claim about the whole session and would go
// stale the moment any earlier render dirtied it.
{
  restore();
  seed();
  C.run(`showComplete();`, 'clean-again');
  assert.strictEqual(ledger().length, 0,
    'a clean render after a dirty one reads empty — the ledger describes THIS card');
  console.log('  ledger resets per render');
}

// ── 5. No empty catch survives in showComplete ─────────────────────────────
// Structural, not a phrasing pin: it asserts a CONSTRUCT is absent, so it cannot be defeated by
// rewording and it keeps working as the rework moves this code around. The whole point of v77_b is
// that a silent catch here is invisible, so a new one must not slip back in.
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const lines = html.split('\n');
  const start = lines.findIndex(l => l.startsWith('function showComplete(review){'));
  assert.ok(start >= 0, 'showComplete is found in the client');
  let depth = 0, started = false, end = -1;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') depth--;
    }
    if (started && depth === 0) { end = i; break; }
  }
  assert.ok(end > start, 'showComplete has a balanced body');
  const body = lines.slice(start, end + 1).join('\n');
  // Every catch in showComplete either REPORTS to the ledger or HANDLES its error in place by
  // assigning a fallback (`_done = false`, `_ok = false`, …). What must never exist again is a
  // catch with an EMPTY body — that is the silent failure v77_b was written to end, and it is the
  // claim asserted above.
  //
  // v77_l: this used to assert `_cardNote` appeared at least SEVEN times, which was rule 30 in
  // miniature — a hard-coded COUNT of a repeated element, pinning the fixture rather than the
  // claim. Retiring v74_l's hide-list deleted one instrumented block and the assertion failed
  // although nothing was wrong. Counting is left to the log line; the invariant is the empty-body
  // check, which cannot go stale as the rework moves this code around.
  const empties = body.match(/catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g) || [];
  assert.strictEqual(empties.length, 0,
    'no silent catch survives in showComplete (found ' + empties.length + ')');
  const noted = body.match(/_cardNote\(/g) || [];
  assert.ok(noted.length > 0,
    'the ledger is still wired into showComplete at all (found ' + noted.length + ' call sites)');
  console.log('  showComplete: 0 empty catches, ' + noted.length + ' instrumented sites, ' +
              (end - start + 1) + ' lines');
}

console.log('unit-card-errors: ALL PASSED');
