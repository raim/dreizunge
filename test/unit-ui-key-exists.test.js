// unit-ui-key-exists.test.js
// v75_b — every literal key the client passes to t() must exist in ui.json's `en`.
//
// Why this exists. Three keys reached a release referring to nothing:
//   • `complete.words_solved` and `form.finish_mixed` — added to index.html in session 28, never
//     added to ui.json. The chapter-vocabulary panel rendered the literal text
//     "complete.words_solved", and the lesson-type form rendered "form.finish_mixed".
//   • `common.cancel` — never existed at all. Written as `t('common.cancel') || 'Cancel'`, which
//     looks like a safety net and is not: t() returns the KEY on a miss, and a key is truthy.
//
// Only ONE of the three was caught, and only because unit-story-unlocked-card happened to pin that
// label's English text. Nothing swept the surface, so a key with no assertion behind it was
// invisible — and the v75 `ui.json` came back from the offline translate pass predating two of
// them, which is the documented hazard ("a returning file may predate recent releases") with
// nothing standing behind it.
//
// This is deliberately a SURFACE check, not a spot check: it is the absence of one that let these
// through. It runs against `en` only. Other languages are ALLOWED to be missing keys — that is the
// normal state between a release and the offline translate pass, and `t()` falls back through
// English by design (v71_q: never assert a dropped key absent).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib-dom');

const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
assert.ok(ui.en && Object.keys(ui.en).length > 100, 'ui.json has an `en` table to check against');

// Only COMPLETE literal calls: t('a.b') or t("a.b"), where the closing quote is followed by the
// end of the argument list or another argument. A concatenated key — t('gen.vocab_mode_' + mode),
// t('prov.' + src) — is built at runtime and its full spelling is not knowable from source, so
// matching it would report a bare prefix as missing. Those are out of scope by construction.
const CALL_RE = /\bt\(\s*(['"])([^'"]+)\1\s*[),]/g;

// v88_f (item AP): CALL_RE above sees only a key that is the WHOLE argument. A CONDITIONAL call —
// `t(auto ? 'form.image_review_save' : 'form.image_review_confirm')` — matches neither branch, so
// both keys were invisible to this sweep. Found by mutation while renaming the comic branch: putting
// a since-deleted key inside such a ternary left this file GREEN. There are six such sites in the
// client (twelve keys), including two this very rename edited, so the gap was live, not theoretical.
//
// This second pass scans the argument list of every `t(` call for KEY-SHAPED string literals
// (`section.name`, the shape every ui.json key has). Deliberately bounded to the call's own
// parentheses and deliberately NOT trying to understand expressions: a concatenated key stays out of
// scope for the same reason CALL_RE excludes it — its full spelling is not knowable from source.
const KEYISH = /(['"])([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)\1/gi;
function condKeys(src) {
  const out = [];
  for (let i = src.indexOf('t('); i >= 0; i = src.indexOf('t(', i + 1)) {
    // `t(` must be a real call, not the tail of an identifier like `format(` or `insert(`.
    if (i > 0 && /[\w$.]/.test(src[i - 1])) continue;
    let depth = 0, j = i + 1;
    for (; j < src.length && j < i + 400; j++) {
      const c = src[j];
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (!depth) break; }
      else if (c === '\n') break;          // a call that spans lines is left to CALL_RE
    }
    if (depth !== 0) continue;
    const arg = src.slice(i + 2, j);
    if (!arg.includes('?')) continue;      // only the conditional shape CALL_RE cannot see
    for (const m of arg.matchAll(KEYISH)) out.push(m[2]);
  }
  return out;
}

const FILES = ['index.html', 'lesson-editor.html'];
const found = new Map();          // key -> Set(file)
let condFound = 0;
for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of src.matchAll(CALL_RE)) {
    if (!found.has(m[2])) found.set(m[2], new Set());
    found.get(m[2]).add(f);
  }
  for (const k of condKeys(src)) {
    condFound++;
    if (!found.has(k)) found.set(k, new Set());
    found.get(k).add(f);
  }
}
// Non-vacuity for the SECOND pass specifically — the first pass's own check below cannot show that
// this one is still finding anything, and a silently-empty second pass is exactly the regression it
// was added to prevent.
assert.ok(condFound >= 8,
  `the conditional-call sweep found ${condFound} keys; the client carries at least a dozen across ` +
  'six ternary t() sites, so a much smaller number means this second pass stopped matching');

// ── Non-vacuity ─────────────────────────────────────────────────────────────────────────────
// Evaluated on the data the assertion actually runs against (`found`), not on the source text it
// was derived from: if the regex stopped matching — a refactor renames t(), the client is minified,
// the quoting style changes — the sweep below would pass over an empty set and prove nothing.
assert.ok(found.size > 300,
  `the sweep found ${found.size} literal t() keys; well under the ~490 the client carries means ` +
  `the call pattern stopped matching and this file is no longer checking anything`);
// And it must be reading the file where the regressions actually happened.
assert.ok([...found.values()].some(s => s.has('index.html')),
  'index.html contributes keys — the client is in scope');

// ── The sweep ───────────────────────────────────────────────────────────────────────────────
const missing = [...found.keys()].filter(k => ui.en[k] === undefined).sort();
assert.deepStrictEqual(missing, [],
  'every key the client asks t() for exists in ui.json `en` — a missing one renders its own name ' +
  'to the learner:\n  ' + missing.map(k => `${k}  (${[...found.get(k)].join(', ')})`).join('\n  '));

// ── The dead-fallback shape that hid `common.cancel` ────────────────────────────────────────
// `t('x') || 'literal'` can never take the second branch, so it silently documents a fallback the
// code does not have. Pinned as a SHAPE, not as the one key that did it — pinning `common.cancel`
// would pin the defect's own spelling and pass the moment someone writes the same mistake with a
// different key.
{
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dead = [...src.matchAll(/\bt\(\s*(['"])([^'"]+)\1\s*\)\s*\|\|\s*['"]/g)].map(m => m[2]);
  assert.deepStrictEqual(dead, [],
    'no t() call is guarded by `|| "fallback"` — t() returns the key on a miss, which is truthy, ' +
    'so the fallback is unreachable and the miss shows as raw key text: ' + dead.join(', '));
}

console.log(`  ${found.size} literal t() keys across ${FILES.length} client file(s): all present in ui.json en`);
console.log('  no unreachable `t(...) || "fallback"` shapes');
console.log('unit-ui-key-exists: ALL PASSED');
