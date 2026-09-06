// unit-ui-keys-live.test.js — v89_an.
//
// User: "are all untranslated entries still used? Do we have a lot of repeated or redundant
// entries?" The audit found 29 keys with no reference in product code — 957 translated entries
// across 33 languages, all of it work the user does BY HAND — and they were removed.
//
// ⚠️⚠️ THE POINT OF THIS FILE IS THE DETECTOR, NOT THE LIST. Finding a key "unused" is easy to get
// wrong in the direction that costs the most, and two of the three ways were hit during the audit:
//
//   • 'prefix' + var   — `_sbSchemeLabel` builds `'storyboard.scheme_' + name`. A literal-only
//                        search called all five scheme names dead. (Caught before deleting.)
//   • var + '_suffix'  — `_synQ` builds `t(key + '_n')`, and because `_synN` is the number of
//                        correct words that suffixed key is the string shown MOST of the time; the
//                        un-suffixed one is the count==0 fallback. A prefix-only detector called the
//                        PRIMARY string dead. **The user caught this one**, by asking for the
//                        synonym plurals to be checked before deletion rather than after.
//   • grep's `.`       — verifying with `grep -c "app.tagline"` matches `app-tagline`, and
//                        `qc.accept` matches `qc.accepted`. A key must be matched as a whole
//                        QUOTED string, never as a substring.
//
// So this file re-runs the detector on every cut and fails on a NEW unreferenced key — and pins all
// three blind spots with live examples, so a future tightening cannot quietly reintroduce one.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const en = ui.en || {};
const prod = ['index.html', 'server.js', 'build-static.js']
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

// ⚠️ A whole QUOTED string. Substring matching is what made the first verification pass wrong.
const quoted = (k, hay) => new RegExp("['\"`]" + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"`]").test(hay);
const prefixes = new Set();
for (const m of prod.matchAll(/['"`]([a-zA-Z0-9_.]+)['"`]\s*\+/g)) prefixes.add(m[1]);
for (const m of prod.matchAll(/`([a-zA-Z0-9_.]+)\$\{/g)) prefixes.add(m[1]);
const suffixes = new Set();
for (const m of prod.matchAll(/\w+\s*\+\s*['"`](_[a-zA-Z0-9_]+)['"`]/g)) suffixes.add(m[1]);

const reachable = k =>
     quoted(k, prod)
  || [...prefixes].some(p => p && k !== p && k.startsWith(p))
  || [...suffixes].some(sf => k.endsWith(sf) && quoted(k.slice(0, -sf.length), prod));

// ── 1. ⚠️ The three blind spots, pinned with LIVE examples ──────────────────────────────────────
// Asserted before the sweep, because if the detector is wrong the sweep's result means nothing.
{
  assert.ok(quoted('app.motto', prod), "(control) a plain literal key is found");
  // prefix: t(k) where k = 'storyboard.scheme_' + name
  assert.ok(reachable('storyboard.scheme_classic'),
    "⚠️ a key built as 'prefix' + var is reachable — five scheme names were nearly deleted this way");
  assert.ok(!quoted('storyboard.scheme_classic', prod),
    '(and it is genuinely NOT a literal, so the prefix rule is what saved it — not a coincidence)');
  // suffix: t(key + '_n')
  assert.ok(reachable('ex.syn.q_synonyms_n'),
    "⚠️ a key built as var + '_suffix' is reachable — this is the string the synonym prompt shows " +
    'MOST of the time, and a prefix-only detector called it dead');
  assert.ok(!quoted('ex.syn.q_synonyms_n', prod), '(also not a literal — the suffix rule is doing the work)');
  // substring: the mistake that made the first verification pass wrong.
  assert.ok(!quoted('app.tagline', prod),
    "⚠️ 'app.tagline' is NOT referenced — it only LOOKS referenced to a substring search, which " +
    "matches 'app-tagline'. Whole-quoted-string matching is the rule.");
}
console.log('  the detector handles prefix, suffix and substring — all three pinned live: OK');

// ── 2. No unreferenced key regrows ──────────────────────────────────────────────────────────────
// ⚠️ Three keys are HELD deliberately: a TEST still names each, so deleting them means re-scoping
// that assertion, which the user chose not to bundle with a bulk removal. Named, with the reason —
// an unexplained exemption is how a real finding hides in a green test.
const HELD = {
  'form.image_scene_ph':       'v89_z merged the two review boxes; unit-comic-title-field still names it (0/32 translated)',
  'form.image_review_confirm': "v88_c split the review card's two modes; unit-comic-review-card names it",
  'sl.recreate_btn':           'unit-storyline-edit-menu names it',
};
{
  const dead = Object.keys(en).filter(k => !reachable(k) && !(k in HELD));
  assert.deepStrictEqual(dead, [],
    'these ui.json keys are not referenced anywhere in product code: ' + dead.join(', ') +
    '. Every one is work the user does BY HAND in 32 languages, so remove it — or add it to HELD ' +
    'with the reason it must stay.');
  // Non-vacuity: HELD must not rot into a dumping ground of keys that ARE now used.
  for (const [k, why] of Object.entries(HELD)) {
    assert.ok(k in en, `HELD key ${k} still exists (${why})`);
    assert.ok(!reachable(k), `HELD key ${k} is still unreferenced — if it is used again, drop it from HELD`);
  }
}
console.log(`  no unreferenced key regrew (${Object.keys(en).length} keys, ${Object.keys(HELD).length} held): OK`);

// ── 3. Every language carries the same key SET, minus what is untranslated ──────────────────────
// ⚠️ A deletion has to reach all 33 languages. A key left behind in one is invisible — nothing reads
// it — but it is exactly the debris that makes the next audit's numbers wrong.
{
  const langs = Object.keys(ui).filter(k => k !== 'en' && k !== '_comment');
  const strays = [];
  for (const L of langs)
    for (const k of Object.keys(ui[L] || {}))
      if (!(k in en)) strays.push(`${L}:${k}`);
  assert.deepStrictEqual(strays.slice(0, 12), [],
    'these translations have no `en` key, so nothing can ever read them: ' + strays.join(', '));
}
console.log('  no language carries a key `en` does not have: OK');

console.log('unit-ui-keys-live: ALL PASSED');
