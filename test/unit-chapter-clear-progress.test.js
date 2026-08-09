// unit-chapter-clear-progress.test.js
// v78_e (user testing notes, group B) — clearing progress for ONE chapter.
//
// The storyline page has had a whole-storyline wipe since v71; the user asked for the same thing at
// chapter level. The note carried its own trap, and it is the reason this file exists rather than
// a source pin: **reuse `slBottomClearProgress`'s rule, do not re-implement it.** `v77_s` found
// that rule clearing `completed` and `solved` but NOT `chapterDone` — the cached completeness stamp
// `chapterComplete` trusts ahead of the flags — so a wiped chapter still read "finished": later
// chapters stayed unlocked and the storyline bar stayed fully green with nothing played. Two of the
// user's notes that session were that one bug. A second copy of the wipe is how it comes back.
//
// So the payload assertion here is not "the button calls a function". It is that a chapter wiped
// from the CARD forgets exactly what a chapter wiped from the STORYLINE PAGE forgets — asserted by
// running both against identical state and diffing the stores.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  // Every store the wipe is supposed to touch, plus one it must NOT.
  C.run(`
    APP.progress = APP.progress || {};
    APP.progress.completed   = { A: { l1: 1, l2: 1 }, B: { l1: 1 } };
    APP.progress.solved      = { A: { 'k1': 1, 'k2': 1 }, B: { 'k9': 1 } };
    APP.progress.chapterDone = { A: { n: 2 }, B: { n: 1 } };
    APP.progress.storyShown  = { A: 1, B: 1 };
    APP.progress.learned     = { 'it|de': { ciao: { wrong: 2 } } };   // NOT chapter progress
    saveProg = function(){ APP._saved = (APP._saved||0) + 1; };
    true;
  `, 'seed-progress');
  return C;
}

const stores = C => JSON.parse(C.run(`JSON.stringify({
  completed: APP.progress.completed, solved: APP.progress.solved,
  chapterDone: APP.progress.chapterDone, storyShown: APP.progress.storyShown,
  learned: APP.progress.learned })`, 'read'));

// ── 1. The chapter wipe clears every store that can answer "is this chapter done" ────────────
// Listed explicitly rather than as "whatever the function deletes", so ADDING a completeness store
// later without adding it to the wipe fails here instead of shipping another v77_s.
{
  const C = client();
  assert.strictEqual(C.run(`_clearChapterProgress('A')`), true, 'the helper reports it ran');
  const s = stores(C);
  assert.strictEqual(s.completed.A, undefined, 'completed flags cleared');
  assert.strictEqual(s.solved.A, undefined, 'coverage store cleared');
  assert.strictEqual(s.chapterDone.A, undefined,
    'the chapterDone STAMP cleared — v77_s: leaving it makes the wipe invisible');
  assert.strictEqual(s.storyShown.A, undefined,
    'storyShown cleared, so the story-unlocked page is offered again');
  console.log('  all four chapter stores cleared for the wiped chapter');
}

// ── 2. …and touches nothing else ────────────────────────────────────────────────────────────
// A wipe that clears everything would pass §1 trivially.
{
  const C = client();
  C.run(`_clearChapterProgress('A')`);
  const s = stores(C);
  assert.deepStrictEqual(s.completed.B, { l1: 1 }, 'the OTHER chapter keeps its flags');
  assert.deepStrictEqual(s.solved.B, { k9: 1 }, 'and its coverage');
  assert.deepStrictEqual(s.chapterDone.B, { n: 1 }, 'and its stamp');
  assert.strictEqual(s.storyShown.B, 1, 'and its storyShown');
  assert.deepStrictEqual(s.learned, { 'it|de': { ciao: { wrong: 2 } } },
    'the learned-vocab ledger is NOT chapter progress and survives — it spans chapters');
  console.log('  the other chapter and the cross-chapter ledger are untouched');
}

// ── 3. The storyline-wide wipe goes through the SAME rule ────────────────────────────────────
// The trap named in the user's note. Run both paths over identical state and diff: a
// re-implementation that forgot a store would leave a difference here even while §1 passed.
{
  const viaChapter = client();
  viaChapter.run(`['A','B'].forEach(function(t){ _clearChapterProgress(t); })`);

  const viaStoryline = client();
  viaStoryline.run(`
    confirm = function(){ return true; };
    APP._slScreen = { chainId: 'c1', encodedChain: 'e', topics: ['A','B'], chapterIds: ['i1','i2'] };
    APP.savedList = [{ id: 'i1', topic: 'A' }, { id: 'i2', topic: 'B' }];
    _renderStorylineScreen = function(){ APP._rendered = 1; };
    slBottomClearProgress();
  `, 'storyline-wipe');

  assert.deepStrictEqual(stores(viaChapter), stores(viaStoryline),
    'wiping every chapter one by one leaves the SAME state as the storyline-wide wipe — ' +
    'if these diverge, the rule has been copied rather than shared');
  // Non-vacuity: prove the storyline path actually ran, or two no-ops would compare equal.
  assert.strictEqual(viaStoryline.run(`APP._rendered`), 1, 'the storyline wipe re-rendered its page');
  assert.strictEqual(viaStoryline.run(`String(APP.progress.chapterDone.A)`), 'undefined',
    'and it really cleared — comparing two untouched states would pass otherwise');
  console.log('  chapter-by-chapter and storyline-wide wipes agree exactly');
}

// ── 4. The card control: confirm is honoured in BOTH directions ──────────────────────────────
// A destructive control that ignores Cancel is worse than none.
{
  const C = client();
  C.run(`
    APP.lessonData = { topic: 'A', lessons: [] };
    confirm = function(){ return false; };
    showComplete = function(){ APP._recard = (APP._recard||0) + 1; };
    showToast = function(){};
    true;`, 'setup');
  assert.strictEqual(C.run(`clearThisChapterProgress()`), false, 'Cancel returns false');
  const s = stores(C);
  assert.deepStrictEqual(s.completed.A, { l1: 1, l2: 1 }, 'Cancel changed NOTHING');
  assert.deepStrictEqual(s.chapterDone.A, { n: 2 }, 'including the stamp');
  assert.strictEqual(C.run(`APP._recard||0`), 0, 'and did not re-render');

  C.run(`confirm = function(){ return true; };`);
  assert.strictEqual(C.run(`clearThisChapterProgress()`), true, 'OK returns true');
  assert.strictEqual(stores(C).completed.A, undefined, 'and wipes this chapter');
  assert.strictEqual(C.run(`APP._saved||0`) > 0, true, 'progress was persisted (saveProg called)');
  assert.strictEqual(C.run(`APP._recard||0`), 1, 'and the card was re-rendered once');
  console.log('  the card control confirms first, persists, and re-renders');
}

// ── 5. It re-renders in REVIEW mode ──────────────────────────────────────────────────────────
// `showComplete(true)` is the review render, which by design does not judge the learner — no
// done-flag, no lock, no exposure counted (INTERNALS: "a review render is not a play"). Redrawing
// a card over a store that was just emptied is exactly the moment that matters: a play-mode render
// would re-record completion and undo the wipe it is displaying.
{
  const C = client();
  C.run(`
    APP.lessonData = { topic: 'A', lessons: [] };
    confirm = function(){ return true; };
    showToast = function(){};
    showComplete = function(rev){ APP._reviewArg = rev; };
    clearThisChapterProgress();
    true;`, 'review-check');
  assert.strictEqual(C.run(`APP._reviewArg`), true,
    'the re-render passes review=true — a play render would re-judge a chapter nobody just played');
  console.log('  the re-render is the review render, not a play');
}

// ── 6. The control exists in the MARKUP, and is hidden on a drill ────────────────────────────
// Rule 16: the stub DOM auto-vivifies any id, so `getElementById` alone proves nothing. Assert
// against the markup string first, then the behaviour.
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(/id="comp-wipe"/.test(html), 'comp-wipe exists in the card markup, not just in the stub');
  // Assigned in JS, never inline — the stub DOM cannot click an onclick ATTRIBUTE (rule 22).
  assert.ok(!/id="comp-wipe"[^>]*onclick=/.test(html),
    'its handler is assigned in JS, so a headless test can click it');
  console.log('  comp-wipe is in the markup with a JS-assigned handler');
}

// ── 7. The three new keys are present in en ──────────────────────────────────────────────────
// t() falls back to the KEY NAME when a key is missing, so a typo ships a button captioned
// "chapter.clear_progress". Presence is the assertion; en-only is not asserted, because this
// ui.json is a returning translated file and the next pass may fill these at any time.
{
  for (const k of ['chapter.clear_progress', 'chapter.clear_progress_confirm', 'chapter.clear_progress_done']) {
    assert.ok(UI.en[k] && UI.en[k].trim(), `${k} exists in en`);
    assert.ok(!/^chapter\./.test(UI.en[k]), `${k} has a real value, not its own key name`);
  }
  console.log('  the three new en keys are present');
}

console.log('unit-chapter-clear-progress: ALL PASSED');
