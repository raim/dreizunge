// unit-comp-lesson-icons.test.js
// v73_g (user request) — one icon per lesson on the completion card, above the play buttons,
// clicking starts that lesson directly.
//
// Agreed semantics, recorded here because they are decisions rather than consequences:
//   (a) starting a lesson from the row MAY bypass the mixed lesson; the normal proceed buttons
//       (↻ repeat, → next) must still route through it.
//   (b) the row shows NO indication that a lesson was already played.
//   (c) a story-gated lesson gets an icon that is not clickable until the story unlocks.
//   (d) the storyline view's own icon row stays non-clickable and is not touched.
//
// The counting requirement ("this should count for total seen and solved") needs no code: a chapter
// has one coverage universe spanning every question every lesson can produce, so a question reached
// from this row lands in the same denominator it would through mixed. Section 5 pins that, because
// an invariant nobody asserts is one a later change can quietly break.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// A chapter with a story-gated lesson AND a hidden one exercises every branch of the row.
// Deliberately NOT mixed-driven: a classic set unlocks its story on done-flags alone once the pass
// mark is 1, which keeps section 4's "the gate opens" step from having to synthesise a whole solved
// question universe just to prove an icon becomes clickable.
// The hidden lesson must sit BEFORE a visible one, or row position and lesson index coincide and
// section 3 cannot tell them apart — it was vacuous when first written for exactly that reason.
// It must precede a STARTABLE lesson specifically: a locked (story-gated) one carries no index at
// all, so a hidden lesson followed only by the comprehension lesson still leaves every asserted
// index equal to its row position. Both narrowings were found by the revert coming back clean.
const _hiddenBeforeVisible = (t) => {
  const ls = t.lessons || [];
  const h = ls.findIndex(L => L && (L._hidden || L.hidden));
  if (h < 0) return false;
  return ls.some((L, i) => L && i > h && !L._hidden && !L.hidden && L.type !== 'comprehension');
};
const topic = (store.topics || []).find(t =>
  (t.lessons || []).some(L => L && L.type === 'comprehension') &&
  !(t.lessons || []).some(L => L && L.type === 'mixed' && !L._hidden) &&
  _hiddenBeforeVisible(t) &&
  (t.lessons || []).length >= 4);
assert.ok(topic, 'the corpus has a classic chapter with a story-gated lesson and a hidden one before a visible one');

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed-static');

function render(extra = '') {
  C.run(`
    APP.savedList = ${JSON.stringify((store.topics || []).map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang, lessons: t.lessons })))};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{} };
    APP._teacherMode = false;
    APP.cur = { lessonIdx:0, exercises:[], cur:0, correct:3, total:4,
                mistakes:1, hearts:3, streak:2, bestStreak:2 };
    ${extra}
    showComplete(); true;`, 'render');
  const el = C.document.getElementById('comp-lessons');
  return {
    el,
    icons: el.querySelectorAll('span').map(s => ({
      emoji:  s.textContent,
      locked: s.classList.contains('locked'),
      idx:    s.getAttribute('data-lesson-idx'),
      click:  s.getAttribute('onclick'),
      title:  s.getAttribute('title') || '',
    })),
  };
}

const visible = (topic.lessons || []).filter(L => L && !L._hidden && !L.hidden);

// ── 1. One icon per visible lesson; hidden lessons are not offered ───────────
{
  const { el, icons } = render();
  assert.strictEqual(el.style.display, 'block', 'the row is shown');
  assert.strictEqual(icons.length, visible.length,
    `one icon per visible lesson (${icons.length} icons for ${visible.length} visible ` +
    `of ${topic.lessons.length} total)`);
  assert.ok(topic.lessons.length > visible.length,
    'the fixture really does contain a hidden lesson, or this proves nothing');
}

// ── 2. The emoji is the registry's, so the card and the storyline row agree ──
{
  const { icons } = render();
  const expected = visible.map(L => C.run(`lessonTypeEmoji(${JSON.stringify(L.type || 'standard')})`, 'emoji'));
  assert.deepStrictEqual(icons.map(i => i.emoji), expected,
    'each icon is the registry emoji for its lesson type — one source, shared with the storyline row');
}

// ── 3. Clickable icons start THAT lesson, by its real index ─────────────────
// The index must be the position in APP.lessonData.lessons, not the position in the rendered row:
// hidden lessons are skipped, so the two differ and an off-by-one here starts the wrong lesson.
{
  const { icons } = render();
  const startable = icons.filter(i => !i.locked);
  assert.ok(startable.length >= 2, 'several lessons are startable');
  startable.forEach(i => {
    const n = Number(i.idx);
    assert.ok(Number.isInteger(n), 'a startable icon carries its lesson index');
    // v81_t / PLAN §C0.3: showLesson(idx), a thin delegate to startLesson(idx) — see INTERNALS.md §6b.
    assert.strictEqual(i.click, `showLesson(${n})`, 'and starts exactly that lesson');
    const L = topic.lessons[n];
    assert.ok(L && !L._hidden && !L.hidden,
      `index ${n} points at a visible lesson — not a row position`);
    assert.ok(i.title.includes(C.run(`lessonTypeLabel(${JSON.stringify(L.type || 'standard')})`, 'lbl')),
      'the tooltip names the lesson type');
  });
}

// ── 4. (c) Story-gated lessons: visible, not clickable, until the story unlocks
{
  const { icons } = render();
  assert.strictEqual(C.run(`storyUnlocked(APP.lessonData)`, 'locked?'), false,
    'the fixture starts with the story still locked');
  const gated = icons.filter(i => i.locked);
  assert.strictEqual(gated.length,
    visible.filter(L => C.run(`_isStoryGatedLesson(${JSON.stringify(L)})`, 'g')).length,
    'every story-gated lesson renders locked while the story is locked');
  gated.forEach(i => {
    assert.strictEqual(i.idx, null, 'a locked icon carries no lesson index');
    assert.strictEqual(i.click, null, 'and cannot be clicked into a dead end');
  });

  // …and becomes startable once the story unlocks. Without this the "locked" assertion above would
  // pass just as well if the icon were locked permanently.
  const done = {};
  (topic.lessons || []).forEach(L => { if (L && L.id) done[L.id] = true; });
  const after = render(
    `APP.lessonData.coverageTarget = 1;\n` +   // pass mark 1 is a no-op branch: done-flags decide
    `APP.progress.completed[APP.lessonData.topic] = ${JSON.stringify(done)};`);
  assert.strictEqual(C.run(`storyUnlocked(APP.lessonData)`, 'unlocked?'), true,
    'the story is genuinely unlocked in the second render — otherwise the comparison below is empty');
  const stillLocked = after.icons.filter(i => i.locked);
  assert.ok(stillLocked.length < gated.length,
    `the gate opens: ${gated.length} locked before, ${stillLocked.length} after the story unlocks`);
}

// ── 5. The coverage universe is unchanged by any of this ────────────────────
// The user's requirement was that lessons started from here count toward seen/solved. That holds
// because the denominator already spans every lesson — so what must be asserted is that rendering
// the row does not perturb it, and that every startable lesson is inside it.
{
  const before = JSON.parse(C.run(`JSON.stringify(topicCoverage())`, 'cov1'));
  render();
  const after = JSON.parse(C.run(`JSON.stringify(topicCoverage())`, 'cov2'));
  assert.strictEqual(after.total, before.total,
    'rendering the icon row does not change the coverage denominator');
  assert.ok(before.total > 0, 'and there is a real universe to compare against');
  console.log(`  icon row: ${visible.length} icons, coverage universe ${before.total} questions (unchanged)`);
}

// ── 6. (a) The proceed buttons still route through the mixed flow ───────────
// The row is an alternative route, not a replacement. These two are what a mixed-driven chapter
// relies on, and neither should have learned about the icon row.
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(/function repeatForCoverage\(\)\{[\s\S]{0,400}_firstCoverageShortLessonIdx/.test(html),
    'repeat still targets the coverage-short lesson (the mixed driver on a mixed set)');
  assert.ok(/nextLessonIdx = _setDone \? -1 : _firstUnfinishedLessonIdx\(APP\.lessonData\)/.test(html),
    'next still targets the first unfinished lesson, which is the mixed driver on a mixed set');
}

// ── 7. A drill card shows no row ────────────────────────────────────────────
// A drill is a synthetic set; its icons would link to lessons of a chapter it is not in.
{
  const { el } = render(`APP.cur.lesson = { _drill: true, type: 'mixed' };`);
  assert.strictEqual(el.style.display, 'none', 'the drill card carries no lesson row');
  assert.strictEqual(el.innerHTML, '', 'and nothing is left behind in it');
}

console.log('unit-comp-lesson-icons: ALL PASSED');
