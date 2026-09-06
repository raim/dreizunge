// unit-savedlist-projection.test.js — v90_a.
//
// ⚠️ THE FOURTH-TIME PROBLEM. `/api/lessons` does not return topics; it returns a WHITELIST
// PROJECTION of them. The STATIC build ships whole topics and gets every field for free. So a field
// the client needs but the projection omits **works in the static build and is silently dead live**
// — no error, no empty state, just a feature that quietly does nothing on the real server.
//
// It has happened four times, and the projection's own comments record three of them in place:
//   v74_i  `lessonCount` counted hidden lessons — live said 3 where static said 2
//   v79_n  same class again
//   v89_y  `_titleFailed` — the badge read it from APP.savedList
//   v89_aj `source` — the provenance line read it from APP.savedList
//
// A scan at the v90_a cut found NO current violation (three shapes checked: variables bound from
// savedList, the byTopic/byName maps built from it, and inline `.find(…)?.field`). But absence is not
// decidable statically — the client reads properties off short-named locals — so this file does not
// try to prove it. **It makes the next new field a DECISION instead of an accident**: every key any
// topic carries must either ride in the projection or be listed below as deliberately static-only.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));

// ── The projection, read from its own source ────────────────────────────────────────────────────
// Bounded by the `lessonCount:` line the projection's own comments anchor on, then out to the end of
// the enclosing object literal by brace matching — not a fixed window, which is how an earlier
// audit in this project misread three routes.
const anchor = server.indexOf('lessonCount: (l.lessons || [])');
assert.ok(anchor > -1, 'the savedList projection is where it was — if it moved, re-anchor this guard');
// ⚠️ Walk BACKWARD balancing braces to the ENCLOSING literal. `lastIndexOf('{', anchor)` finds the
// nearest brace before the anchor, which is an inner one (`(l.lessons || [])`'s own neighbours), and
// the parse then covered a fragment. The extractor's own non-vacuity check below caught that.
let open = anchor, d = 0;
for (let i = anchor; i >= 0; i--) {
  const c = server[i];
  if (c === '}') d++;
  else if (c === '{') { if (!d) { open = i; break; } d--; }
}
d = 0; let end = open;
for (let i = open; i < server.length; i++) {
  if (server[i] === '{') d++;
  else if (server[i] === '}') { d--; if (!d) { end = i; break; } }
}
const proj = server.slice(open, end + 1);
const shipped = new Set();
for (const m of proj.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)) shipped.add(m[1]);
assert.ok(shipped.has('lessonCount') && shipped.has('topic') && shipped.has('id'),
  'the extractor found real projection fields (if this fires, the parse is broken and everything ' +
  'below is vacuous)');

// ── Fields DELIBERATELY not projected ───────────────────────────────────────────────────────────
// ⚠️ Each needs a REASON. An unexplained entry here is how the fifth instance would hide: the guard
// would be green and the field would be invisible live, which is exactly the failure it exists for.
const STATIC_ONLY = {
  // Bulk content — the client fetches a chapter in full when it opens one. Shipping these on every
  // load would add megabytes to a response fetched on every page view.
  story: 'the story text itself — fetched per chapter; collectChainStory exists server-side because this is absent',
  aiStory: 'the pre-edit story, for the error-hunt diff — chapter-level only',
  storyTranslation: 'per-chapter, fetched with the chapter',
  storyGloss: 'per-chapter',
  comicPanels: 'panel images are data URLs — comicPanelCount rides instead, which is what renderers branch on',
  // Generation provenance and prompts — authoring detail, never rendered from a list row.
  storyPrompt: 'the prompt that produced the story — authoring detail',
  userPrompt: 'what the user typed to generate this — authoring input, never rendered from a list row',
  userStory: 'a pasted source story, often kilobytes — read when the chapter is opened',
  userTopic: 'the topic the user asked for, before any auto-title — authoring input',
  userTranslation: 'a user-supplied translation — read with the chapter',
  userDialect: 'the dialect the user asked for — authoring input',
  storyTopic: 'the topic the generator settled on — authoring provenance',
  storyStyle: 'the writing style used — authoring input, reread by add-lesson server-side',
  lessonFormat: 'the format this chapter was generated in — read when generating, not when listing',
  storyMeta: 'generation metadata; sourceFile is lifted OUT of it into the projection',
  translationMeta: 'generation metadata', repairStats: 'generation metadata',
  aiGenerated: 'generation metadata', _dialect: 'generation metadata', script: 'generation metadata',
  srcScript: 'generation metadata', storyLang: 'generation metadata',
  coverageTarget: 'per-chapter setting, read when the chapter is open',
  // QC bookkeeping — the list shows storyQcPending, computed in the projection from these.
  storyQcAt: 'QC bookkeeping — storyQcPending is what the list needs',
  storyQcBy: 'QC bookkeeping', storyQcCheckedAt: 'QC bookkeeping', storyQcCheckedBy: 'QC bookkeeping',
  storyQcProposal: 'the pending proposal itself, read when the chapter is open',
  ratings: 'per-question ratings, read with the chapter',
  exportedAt: 'export bookkeeping', exportedFlags: 'export bookkeeping',
};

// ── 1. Every stored field is projected, or deliberately not ─────────────────────────────────────
{
  const seen = new Set();
  for (const t of store.topics || []) for (const k of Object.keys(t)) seen.add(k);
  assert.ok(seen.size > 25, `the corpus exercises a real field set (${seen.size})`);
  const unaccounted = [...seen].filter(k => !shipped.has(k) && !(k in STATIC_ONLY)).sort();
  assert.deepStrictEqual(unaccounted, [],
    '⚠️ these topic fields are neither in the savedList projection nor listed as deliberately ' +
    'static-only: ' + unaccounted.join(', ') + '. A field the client reads from APP.savedList but ' +
    'that is missing here WORKS IN THE STATIC BUILD AND IS SILENTLY DEAD LIVE — it has happened ' +
    'four times (v74_i, v79_n, v89_y, v89_aj). Either add it to the projection, or add it to ' +
    'STATIC_ONLY with the reason it does not need to travel.');
}
console.log('  every stored topic field is projected or deliberately static-only: OK');

// ── 2. ⚠️ STATIC_ONLY must not rot ──────────────────────────────────────────────────────────────
// A name left here after the field starts being projected would quietly excuse the NEXT field of
// the same name. And an entry for a field no topic carries any more is dead weight that makes the
// list look more considered than it is.
{
  const both = Object.keys(STATIC_ONLY).filter(k => shipped.has(k));
  assert.deepStrictEqual(both, [],
    'these are BOTH projected and listed as static-only, so the list no longer describes reality: ' +
    both.join(', '));
  for (const [k, why] of Object.entries(STATIC_ONLY))
    assert.ok(typeof why === 'string' && why.trim().length > 8,
      `STATIC_ONLY.${k} needs a real reason — an unexplained entry is how the fifth instance hides`);
}
console.log('  the static-only list is disjoint from the projection and every entry gives a reason: OK');

// ── 3. The four fields the past bugs were about are IN the projection ───────────────────────────
// Named individually, because each cost a release and a regression on any of them is the same bug
// a fifth time.
{
  for (const [field, rel] of [['lessonCount', 'v74_i'], ['_titleFailed', 'v89_y'],
                              ['source', 'v89_aj'], ['comicPanelCount', 'the comic-thumb split']]) {
    assert.ok(shipped.has(field),
      `${field} rides in the projection (${rel}) — without it the feature works statically and is dead live`);
  }
  // ⚠️ Non-vacuity for §1: the projection must NOT ship everything, or "unaccounted is empty" would
  // be true for a trivial reason.
  assert.ok(!shipped.has('story'),
    'the projection genuinely omits things (story is not in it) — so §1 is a real constraint');
}
console.log('  the four fields that caused past releases still ride, and the projection is still a filter: OK');

console.log('unit-savedlist-projection: ALL PASSED');
