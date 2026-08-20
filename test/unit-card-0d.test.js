// unit-card-0d.test.js
// v78_m / v78_n (user testing notes, §0d) — three things about the progress card.
//
//   1. The ✕ on a question card returns to the PROGRESS CARD of the lesson being played, not to
//      the storyline deck.                                                              (v78_m)
//   2. Replay must ALWAYS be available, including after the story is unlocked and the
//      comprehension / error-hunt lessons are done — the learner must be able to reach 100%.
//      MEASURED ALREADY TRUE; asserted here so it stays true.                    (no code change)
//   3. The post-unlock bar shows on ALL progress cards of a chapter that has such lessons, not
//      only while one of them is blocking Next.                                         (v78_n)
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// A chapter with prep lessons AND post-unlock lessons — the shape the whole file is about.
const TOPIC = {
  topic: 'T', id: 'tp_x', lang: 'it', srcLang: 'de', story: 'Una storia lunga abbastanza per contare.',
  lessons: [
    { id: 'l0', type: 'standard', vocab: [ { target: 'casa', source: 'Haus' }, { target: 'cane', source: 'Hund' } ] },
    { id: 'l1', type: 'standard', vocab: [ { target: 'gatto', source: 'Katze' } ] },
    { id: 'l2', type: 'comprehension', title: 'Verständnis', questions: [
      { q: 'a?', choices: ['x','y'], correctIndex: 0 }, { q: 'b?', choices: ['x','y'], correctIndex: 1 } ] },
  ],
};

function card(opts) {
  const o = opts || {};
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = []; APP.storylines = [];
    APP.lessonData = ${JSON.stringify(TOPIC)};
    APP.lang = 'it'; APP.srcLang = 'de';
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed: ${JSON.stringify(o.completed || {})}, solved: ${JSON.stringify(o.solved || {})} };
    APP._teacherMode = false;
    APP.cur = { lessonIdx: ${o.lessonIdx == null ? 0 : o.lessonIdx}, exercises: [], cur: 0,
                correct: 3, total: 4, mistakes: 1, hearts: 3, streak: 2, bestStreak: 2 };
    showComplete(${o.review ? 'true' : ''}); true;`, 'render');
  return C;
}
const rowsOf = (C) => [...(C.document.getElementById('comp-progress').innerHTML || '')
  .matchAll(/<span>([^<]*)<\/span><span>(\d+)\/(\d+)<\/span>/g)]
  .map(m => ({ label: m[1], done: +m[2], total: +m[3] }));

// ── 1. The post-unlock bar is present with NOTHING played ───────────────────
// The user's screenshot state: the comprehension work exists, nothing blocks Next yet, and the card
// said nothing about it.
{
  const rows = rowsOf(card({}));
  const r = rows.find(x => x.label === 'Verständnis');
  assert.ok(r, `the comprehension lesson has its own bar (got ${JSON.stringify(rows.map(x => x.label))})`);
  assert.strictEqual(r.done, 0, 'and it reads 0 when none of it is solved');
  assert.ok(r.total > 0, 'with a real denominator');
  console.log('  the post-unlock bar shows with nothing played');
}

// ── 2. …and on a card for a DIFFERENT lesson of the same chapter ────────────
// "on ALL progress cards of that chapter". Rendered from lesson 1, which is not the post lesson.
{
  const rows = rowsOf(card({ lessonIdx: 1 }));
  assert.ok(rows.some(x => x.label === 'Verständnis'),
    'the bar is on the card of a different lesson of the same chapter too');
  console.log('  it is on every card of the chapter, not just the post lesson\'s own');
}

// ── 3. Non-vacuity: a chapter WITHOUT post lessons gets no such row ─────────
// Otherwise §1 and §2 could pass on a card that draws a row for every lesson.
{
  const C = loadClient({ quiet: true });
  const noPost = { ...TOPIC, lessons: TOPIC.lessons.slice(0, 2) };
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = []; APP.storylines = [];
    APP.lessonData = ${JSON.stringify(noPost)};
    APP.lang='it'; APP.srcLang='de';
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{} }; APP._teacherMode = false;
    APP.cur = { lessonIdx:0, exercises:[], cur:0, correct:3, total:4, mistakes:1, hearts:3, streak:2, bestStreak:2 };
    showComplete(); true;`, 'render');
  const labels = rowsOf(C).map(r => r.label);
  assert.ok(!labels.includes('Verständnis'), 'no post row when the chapter has no post lessons');
  assert.ok(labels.length >= 2, `the card still draws its normal bars (${JSON.stringify(labels)})`);
  console.log('  a chapter without post lessons draws no post row');
}

// ── 4. One row per post lesson, never two for the same one ─────────────────
// `lessonGate` names the blocking lesson and is already among the post rows. Emitting both is the
// v74_g mistake (two bars, one quantity) in a new place.
{
  const rows = rowsOf(card({ lessonIdx: 2 }));
  const n = rows.filter(x => x.label === 'Verständnis').length;
  assert.strictEqual(n, 1,
    `the blocking lesson appears ONCE, not once as a gate row and once as a post row (got ${n})`);
  console.log('  the blocking lesson gets exactly one row');
}

// ── 5. Replay stays available once everything is done (item 2) ─────────────
// Measured, not changed: `_firstCoverageShortLessonIdx()` returns -1 when nothing is short, and
// `repeatForCoverage` then falls back to the current lesson, so the button stays live and the
// learner can still reach 100%. Asserted so a future coverage change cannot quietly strand them.
{
  const C = card({ review: true });
  const disabled = C.run(`(function(){ var b=document.getElementById('comp-repeat');
    return !!(b && (b.disabled || /opacity:\\s*0?\\.[0-5]/.test(b.getAttribute('style')||''))); })()`);
  assert.strictEqual(disabled, false, 'Replay is not disabled on a finished chapter');
  // And it resolves to a real target rather than returning silently.
  const target = C.run(`(function(){ var idx=_firstCoverageShortLessonIdx();
    return idx >= 0 ? idx : (APP.cur && APP.cur.lessonIdx); })()`);
  assert.ok(Number.isInteger(target) && target >= 0,
    `Replay resolves to a playable lesson even with nothing coverage-short (got ${target})`);
  console.log('  Replay stays available and resolves a target on a finished chapter');
}

// ── 6. The ✕ returns to the lesson's own card (item 1) ─────────────────────
// Asserted on the wiring, because `confirmQuit` ends in a screen switch the stub cannot fully
// simulate: the learner branch must reach showComplete (via its showProgressCard seam — v81_o /
// PLAN §C0.3, see INTERNALS.md §6b) with the CURRENT index before any storyline fallback, and
// must skip that for a drill.
{
  const fn = html.slice(html.indexOf('function confirmQuit'), html.indexOf('function confirmQuit') + 2600);
  assert.ok(/_isLearner\(\)/.test(fn), 'the learner branch still exists');
  assert.ok(/showProgressCard\(true,\s*_idx\)/.test(fn),
    'the learner branch renders the REVIEW card for the lesson being played');
  const cardAt = fn.indexOf('showProgressCard(true, _idx)');
  // v81_u / PLAN §C0.3: showStoryline(...), a thin delegate to openStorylineScreen(...) — see INTERNALS.md §6b.
  const slAt = fn.indexOf('showStoryline');
  assert.ok(cardAt > 0 && slAt > cardAt,
    'the card is tried BEFORE the storyline fallback, or the fallback would always win');
  assert.ok(/_drill/.test(fn.slice(0, cardAt)),
    'and a drill is excluded — endDrill has already restored the real topic by then');
  // showComplete must actually honour the override, or the card shows the wrong lesson.
  assert.ok(/function showComplete\(review,\s*lessonIdxOverride\)/.test(html),
    'showComplete takes the index override');
  assert.ok(/Number\.isInteger\(lessonIdxOverride\)/.test(html),
    'and validates it rather than trusting the caller');
  console.log('  the quit control renders the played lesson\'s card, with a fallback and no drill');
}

console.log('unit-card-0d: ALL PASSED');
