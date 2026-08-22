// unit-storyline-title-auto.test.js
// v80_l — PLAN §9c: a NEW book must get a generated title; an EXISTING one must keep its own.
//
// User report: generating a multi-chapter German→French storyline logged
// `Storyline title: keeping existing "ein eichhoernchen trifft ein murmeltier — 1"` and the title
// had to be written by hand.
//
// Cause: `upsertStoryline` seeds `title: chain[0]` — the FIRST CHAPTER'S TOPIC NAME, auto-numbering
// suffix and all — when the storyline record is created, which happens EARLIER IN THE SAME FLOW than
// the title post-pass. So by the time the `v78_r` guard asked "is there a title?", there always was
// one, and the `generateStorylineTitle` branch was unreachable for every storyline created that way.
// The title was not skipped because the book was a continuation; it was skipped because a
// PLACEHOLDER looked like an author's work.
//
// ⚠️ The v78_r ruling is NOT weakened — that was explicit in the diagnosis. An authored title is
// still never overwritten. What changed is that the guard can now tell the two apart, via
// `titleAuto`, set at the seed and cleared the moment a real title is written or the user edits one.
//
// BOTH halves are asserted here. A fix that only proved "new books get a title" would re-open
// v78_r, which is the ruling that motivated the guard in the first place.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// ── 1. Both seed sites mark the placeholder ───────────────────────────────
// There are two — the fork branch and the plain new-storyline branch. Fixing one and not the other
// is the obvious way for this to half-work, and it would only show on forks.
{
  const seeds = [...src.matchAll(/upsertStoryline\(\{ id: slId, title: chain\[0\][^}]*\}/g)].map(m => m[0]);
  assert.strictEqual(seeds.length, 2,
    'both storyline-creation sites still seed title: chain[0] — found ' + seeds.length);
  for (const s of seeds) {
    assert.ok(/titleAuto:\s*true/.test(s),
      'a seed site does not mark its placeholder, so the title post-pass cannot tell it from an ' +
      'authored title: ' + s.slice(0, 120));
  }
  console.log('  both seed sites mark the placeholder');
}

// ── 2. The guard reads the flag ───────────────────────────────────────────
{
  const at = src.indexOf('Storyline title: keeping existing');
  assert.ok(at > 0, 'the v78_r keep-existing branch is still there');
  const guard = src.slice(src.lastIndexOf('if (_slPre', at), at);
  assert.ok(/!_slPre\.titleAuto/.test(guard),
    'the keep-existing guard must also require the title NOT be a placeholder: ' + guard.trim());
  assert.ok(/String\(_slPre\.title \|\| ''\)\.trim\(\)/.test(guard),
    'and must still require a non-empty title — the v78_r ruling, unweakened');
  console.log('  the guard distinguishes placeholder from authored');
}

// ── 3. ⚠️ THE OTHER HALF — every authoring path CLEARS the flag ───────────
// Without this the fix breaks v78_r from the other side: a book the user names by hand would be
// retitled by the post-pass the next time a chapter was added.
{
  // (a) the generated title itself
  const gen = src.slice(src.indexOf("addTokenUsage(sl, _mTok, 'retitle'); sl.title = title;"));
  assert.ok(/sl\.titleAuto = false/.test(gen.slice(0, 400)),
    'writing a generated title must clear titleAuto, or the post-pass runs again next chapter');
  // (b) the user's edit through POST /api/storylines
  const patch = src.slice(src.indexOf('if (title     !== undefined)'));
  assert.ok(/patch\.titleAuto = false/.test(patch.slice(0, 200)),
    "a user-typed title must clear titleAuto — it is authored by definition");
  // (c) the explicit retitle endpoint
  const re = src.slice(src.indexOf("if (sc === 'title' || sc === 'all')"));
  assert.ok(/sl\.titleAuto = false/.test(re.slice(0, 500)),
    'the storyline-retitle endpoint must clear titleAuto too');
  console.log('  all three authoring paths clear the flag');
}

// ── 4. Legacy storylines are treated as AUTHORED ──────────────────────────
// A book created before this flag existed has no `titleAuto` at all. `!undefined` is true, so it
// reads as authored and keeps its title — the safe direction, and the one that preserves v78_r for
// every book already on disk. Asserted against the real corpus so it is not just a claim about JS.
//
// v82_e: scoped to LEGACY storylines specifically (no `titleAuto` at all), not "every storyline on
// disk" — a real storyline created live during that session's own verification (`sl_379498431`,
// "Die zwei Ziegen") is the corpus's first to carry `titleAuto: true`, and correctly so: its title
// pass had not (yet) run, which is the FEATURE working, not a regression of the legacy guarantee
// this section actually checks. A storyline WITH the flag is exactly the case sections 1-3 already
// cover via the mechanism itself; this section is about the ones the mechanism never touches.
{
  const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
  const sls = store.storylines || [];
  assert.ok(sls.length, 'non-vacuity: the corpus has storylines');
  const titled = sls.filter(s => String(s.title || '').trim()).length;
  assert.strictEqual(titled, sls.length, 'every existing storyline has a title');
  const legacy = sls.filter(s => s.titleAuto === undefined);
  const flagged = sls.filter(s => s.titleAuto !== undefined);
  assert.ok(legacy.length > 0, 'non-vacuity: the corpus still has legacy (pre-flag) storylines');
  // Every LEGACY storyline would be left alone under the new guard.
  const wouldKeep = legacy.filter(s => String(s.title || '').trim() && !s.titleAuto).length;
  assert.strictEqual(wouldKeep, legacy.length,
    'every LEGACY storyline already on disk would KEEP its title under the new guard — ' +
    `${legacy.length - wouldKeep} would not`);
  console.log(`  all ${legacy.length} legacy storylines keep their titles (${flagged.length} carry ` +
    `the new flag: ${flagged.map(s => s.id).join(', ')})`);
}

// ── 5. Summary is untouched — this is a title-only bug ────────────────────
// The diagnosis checked this rather than assuming it: the same _slPre2 pattern guards the storyline
// SUMMARY, but `summary` is never seeded by upsertStoryline, so that guard already works.
{
  const seeds = [...src.matchAll(/upsertStoryline\(\{ id: slId[^}]*\}/g)].map(m => m[0]);
  for (const s of seeds) {
    assert.ok(!/summary:/.test(s),
      'upsertStoryline must not seed a summary — if it starts to, the summary guard acquires the ' +
      'same bug and needs the same flag: ' + s.slice(0, 120));
  }
  console.log('  no summary is seeded, so the summary guard is still sound');
}

// ── What this does NOT establish (rule 34) ────────────────────────────────
// • It does not run a generation. Whether `generateStorylineTitle` returns a GOOD title needs a live
//   model; what is asserted here is that it is now REACHED, which is the bug that was diagnosed.
// • A storyline created before v80_l keeps its placeholder title forever unless retitled by hand.
//   That is deliberate — retitling existing books is the v78_r ruling's exact prohibition.
console.log('unit-storyline-title-auto: ALL PASSED');
