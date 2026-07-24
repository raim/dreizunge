// smoke-render.test.js
// v69_k — EXECUTE the client's render paths against real corpus data.
//
// Motivation, stated plainly: two runtime errors reached the user through a fully green suite.
//   • v68.1 — `showComplete` read `_belowThreshold` above its `let`: a temporal-dead-zone
//     ReferenceError that crashed EVERY completion card. The learner froze on the last question.
//   • v69_i — `_renderStorylineScreen` referenced `sl`, which exists there only as an arrow
//     parameter: "sl is not defined" on EVERY storyline open.
// Both were in render paths. Both passed every source-level assertion, because a regex over source
// cannot see scope or execution order. Only running the code finds them.
//
// This suite therefore calls the four render entry points with fixtures built from the SHIPPED
// lessons.json — a real topic, real lessons, real storyline — and fails if any of them throws.
// It asserts that output was produced, not what the output looks like: the goal is to catch
// crashes and undefined references, not to freeze the markup.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
// Pick a chapter that belongs to a storyline and has several lesson types — the richest path.
const storyline = (store.storylines || []).find(sl => (sl.chapters || []).length >= 2 && sl.storyboard) 
              || (store.storylines || []).find(sl => (sl.chapters || []).length >= 2);
assert.ok(storyline, 'the corpus has a multi-chapter storyline to exercise');
const chapters = storyline.chapters.map(id => store.topics.find(t => t.id === id)).filter(Boolean);
assert.ok(chapters.length >= 2, 'its chapters resolve');
const topic = chapters.find(t => (t.lessons || []).length >= 2) || chapters[0];

// Shared sandbox: loading the 640KB engine per case would dominate the runtime, and the render
// functions are independent of each other.
const C = loadClient({ quiet: true });
// The engine normally gets these from init() (fetches languages.json / ui.json) — suppressed here,
// so the harness supplies them. This is fixture setup, not a shim around a defect: the client
// reads LANGS/UI_STRINGS as plain data.
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed-static');

const seed = () => C.run(`
  APP.savedList = ${JSON.stringify(store.topics.map(t => ({
    id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang, difficulty: t.difficulty,
    lessons: t.lessons, storyStyle: t.storyStyle, createdBy: t.createdBy,
    storyMeta: t.storyMeta, translationMeta: t.translationMeta, generationStats: t.generationStats,
  })))};
  APP.storylines = ${JSON.stringify(store.storylines || [])};
  APP.lessonData = ${JSON.stringify(topic)};
  APP.lang = ${JSON.stringify(topic.lang)};
  APP.srcLang = ${JSON.stringify(topic.srcLang)};
  APP.info = { backend: 'none', canGenerate: false, version: 'smoke', coverageThreshold: 0.8 };
  APP.progress = APP.progress || {};
  APP.progress.completed = APP.progress.completed || {};
  APP.progress.solved = APP.progress.solved || {};
  true;
`, 'seed');

function shouldNotThrow(label, code) {
  try { C.run(code, label); }
  catch (e) { assert.fail(`${label} threw: ${e && e.message}\n${(e && e.stack || '').split('\n').slice(0, 4).join('\n')}`); }
}

// ── 1. The lesson-set page (buildPath) ───────────────────────────────────────
// Also the mount point for the v69_i chapter pass-mark control.
{
  seed();
  shouldNotThrow('buildPath (learner)', 'buildPath();');
  // buildPath appends nodes into #lesson-path rather than assigning innerHTML.
  assert.ok(C.document.getElementById('lesson-path').children.length > 0,
    'buildPath rendered lesson nodes into the chain');
  // Teacher mode takes different branches (edit rows, the pass-mark control).
  seed();
  shouldNotThrow('buildPath (teacher)', 'APP._teacherMode = true; APP.info.canGenerate = true; buildPath();');
  assert.ok(C.document.getElementById('ls-passmark').innerHTML.includes('pm-input-topic'),
    'the chapter pass-mark control renders for a teacher');
  C.run('APP._teacherMode = false; APP.info.canGenerate = false;');
}
console.log('  buildPath: learner + teacher render without throwing: OK');

// ── 2. The storyline screen (the v69_i crash) ────────────────────────────────
{
  seed();
  const topics = chapters.map(t => t.topic);
  shouldNotThrow('_renderStorylineScreen',
    `_renderStorylineScreen(${JSON.stringify(storyline.id)}, '', ${JSON.stringify(topics)});`);
  assert.ok(C.document.getElementById('sl-screen-body').innerHTML.length > 0, 'the storyline body rendered');
  // Teacher: the storyline pass-mark control is the exact code that shipped broken in v69_i.
  seed();
  shouldNotThrow('_renderStorylineScreen (teacher)',
    `APP._teacherMode = true; APP.info.canGenerate = true;
     _renderStorylineScreen(${JSON.stringify(storyline.id)}, '', ${JSON.stringify(topics)});`);
  assert.ok(C.document.getElementById('sl-passmark').innerHTML.includes('pm-input-storyline'),
    'the storyline pass-mark control renders for a teacher');
  // An unresolvable chain id must not throw either (the null guard added with the fix).
  seed();
  shouldNotThrow('_renderStorylineScreen (unknown chain)',
    `_renderStorylineScreen('sl_does_not_exist', '', ${JSON.stringify(topics)});`);
  C.run('APP._teacherMode = false; APP.info.canGenerate = false;');
}
console.log('  _renderStorylineScreen: real + teacher + unresolvable chain: OK');

// ── 3. The completion card (the v68.1 TDZ crash) ─────────────────────────────
{
  const lessonIdx = 0;
  const base = `
    APP.cur = { lessonIdx: ${lessonIdx}, exercises: [], cur: 0, correct: 3, total: 4,
                mistakes: 1, hearts: 3, streak: 2, bestStreak: 2 };
  `;
  seed();
  shouldNotThrow('showComplete (fresh)', base + 'showComplete();');
  assert.ok(C.document.getElementById('comp-next').textContent !== undefined, 'the completion card was wired');
  // Review mode — the branch loadSaved uses for an already-complete chapter.
  seed();
  shouldNotThrow('showComplete (review)', base + 'showComplete(true);');
  // Below the pass mark: the branch that reads _belowThreshold (the TDZ site) and wires the drill.
  seed();
  shouldNotThrow('showComplete (below pass mark)', base + `
    APP.lessonData.coverageTarget = 0.9;
    APP.progress.solved[APP.lessonData.topic] = {};
    showComplete();`);
  // A drill's own card: its Next branch was the v69.2 dead end.
  seed();
  shouldNotThrow('showComplete (drill card)', base + `
    APP.lessonData.lessons[${lessonIdx}] = Object.assign({}, APP.lessonData.lessons[${lessonIdx}], { _drill: true });
    showComplete();`);
  // Teacher sees extra panels (storyboard, stats).
  seed();
  shouldNotThrow('showComplete (teacher)', base + 'APP._teacherMode = true; APP.info.canGenerate = true; showComplete();');
  C.run('APP._teacherMode = false; APP.info.canGenerate = false;');
}
console.log('  showComplete: fresh, review, below-mark, drill card, teacher: OK');

// ── 4. The question card (renderEx) across every exercise type ───────────────
// Covers the v69_i qWord() highlighting on every question string that takes a {word}.
{
  seed();
  // Collect one exercise PER TYPE in a single derivation and keep the objects. Re-deriving and
  // searching for a type would be flaky: builders sample and cap at 12, so a type present in one
  // round can be absent from the next.
  const collected = JSON.parse(C.run(`
    (() => {
      const out = {};
      (APP.lessonData.lessons || []).forEach((L, i) => {
        let exs = [];
        try { exs = lessonTypeMeta(L.type).build(L, i) || []; } catch (e) { return; }
        exs.forEach(ex => { if (ex && ex.type && !out[ex.type]) out[ex.type] = { i, ex }; });
      });
      return JSON.stringify(out);
    })()
  `, 'collect-types'));
  const typeNames = Object.keys(collected);
  assert.ok(typeNames.length >= 2, `the fixture yields several exercise types (got ${typeNames.join(',')})`);
  for (const type of typeNames) {
    const { i, ex } = collected[type];
    seed();
    shouldNotThrow(`renderEx(${type})`, `(() => {
      APP.cur = { lessonIdx: ${i}, exercises: [${JSON.stringify(ex)}], cur: 0, correct: 0, total: 0,
                  mistakes: 0, hearts: 3, streak: 0, bestStreak: 0, answered: false, sel: null,
                  placed: [], usedIdx: [] };
      renderEx();
    })();`);
    const q = C.document.getElementById('ex-area').innerHTML;
    assert.ok(q && q.length > 0, `renderEx(${type}) produced markup`);
    // The v69_i highlight must survive for every question that names a word.
    if (/\{word\}/.test(JSON.stringify(UI.en[`ex.${type}.q`] || ''))) {
      assert.ok(/class="q-word"/.test(q), `renderEx(${type}) highlights the asked-about word`);
    }
  }
  console.log(`  renderEx: ${typeNames.length} exercise type(s) rendered without throwing (${typeNames.join(', ')}): OK`);
}

// ── 5. Muted / no-voice, the other render branch ─────────────────────────────
{
  seed();
  shouldNotThrow('renderEx (muted)', `(() => {
    APP.muted = true;
    const L = APP.lessonData.lessons[0];
    const exs = lessonTypeMeta(L.type).build(L, 0) || [];
    APP.cur = { lessonIdx: 0, exercises: exs.slice(0, 1), cur: 0, correct: 0, total: 0, mistakes: 0,
                hearts: 3, streak: 0, bestStreak: 0, answered: false, sel: null, placed: [], usedIdx: [] };
    renderEx();
  })();`);
}
console.log('  renderEx: muted branch: OK');

// ── 6. Nothing was logged as an error while rendering ────────────────────────
{
  const noisy = C.calls.errors.filter(e => !/favicon|voices/i.test(e));
  assert.strictEqual(noisy.length, 0, `render paths logged console.error:\n${noisy.slice(0, 5).join('\n')}`);
}
console.log('  no console.error emitted during any render: OK');

console.log('smoke-render: ALL PASSED');
