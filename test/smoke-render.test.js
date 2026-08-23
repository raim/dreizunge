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
const ROOT_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');   // for CSS-only assertions
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

const SAVED_LIST = JSON.stringify(store.topics.map(t => ({
  id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang, difficulty: t.difficulty,
  lessons: t.lessons, storyStyle: t.storyStyle, createdBy: t.createdBy,
  storyMeta: t.storyMeta, translationMeta: t.translationMeta, generationStats: t.generationStats,
})));
// Seeding is parameterised by chapter because §3 needs a chapter with a specific SHAPE (see the
// lock fixture below) rather than the richest one. Everything else still seeds the default topic.
const seedTopic = (t) => C.run(`
  APP.savedList = ${SAVED_LIST};
  APP.storylines = ${JSON.stringify(store.storylines || [])};
  APP.lessonData = ${JSON.stringify(t)};
  APP.lang = ${JSON.stringify(t.lang)};
  APP.srcLang = ${JSON.stringify(t.srcLang)};
  APP.info = { backend: 'none', canGenerate: false, version: 'smoke', coverageThreshold: 0.8 };
  APP.progress = APP.progress || {};
  APP.progress.completed = APP.progress.completed || {};
  APP.progress.solved = APP.progress.solved || {};
  true;
`, 'seed');
const seed = () => seedTopic(topic);

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
  // ── Below the pass mark: the branch that reads _belowThreshold (the TDZ site) ──
  //
  // The lock branch is only REACHABLE when the chapter has no in-chapter lesson left to offer, and
  // the corpus decides that. Two preconditions, and neither is a property of the richest chapter:
  //
  //   • no visible `mixed` lesson. For a mixed-driven set that is below target,
  //     `_firstUnfinishedLessonIdx` deliberately returns the mixed DRIVER (the v68.1 fix — without
  //     it a learner who had a done-flag on every lesson could never raise coverage again). That is
  //     correct behaviour, and it wins at index.html's `nextLessonIdx >= 0` branch, which sits
  //     ABOVE the `_belowThreshold` branch. Asserted in its own right below.
  //   • a non-empty coverage universe, or `cov.total > 0` fails and `_belowThreshold` stays false.
  //
  // So the fixture is chosen BY SHAPE and the search is asserted to have succeeded. This section
  // has been bitten by corpus drift twice now (see the v71_k note in the above-mark block below,
  // and again when lessons.json grew a mixed lesson into the picked chapter) — both times it went
  // quietly wrong rather than loudly, which is what the assertion below exists to stop.
  const _visibleMixed = (t) => (t.lessons || []).some(x => x && x.type === 'mixed' && !x._hidden);
  const _markAllDone = `
    APP.lessonData.coverageTarget = 0.9;
    APP.progress.solved[APP.lessonData.topic] = {};
    APP.progress.completed[APP.lessonData.topic] = {};
    (APP.lessonData.lessons || []).forEach(L => { if (L && L.id) APP.progress.completed[APP.lessonData.topic][L.id] = true; });`;

  let lockTopic = null;
  for (const cand of store.topics) {
    if ((cand.lessons || []).length < 2 || _visibleMixed(cand)) continue;
    seedTopic(cand);
    const ok = C.run(base + _markAllDone + `
      JSON.stringify({ total: topicCoverage().total, next: _firstUnfinishedLessonIdx(APP.lessonData) })`,
      'lock-probe');
    const r = JSON.parse(ok);
    if (r.total > 0 && r.next < 0) { lockTopic = cand; break; }
  }
  // The vacuity guard: without it this section silently becomes a no-op the next time the corpus
  // is replaced, exactly as it did here.
  assert.ok(lockTopic,
    'the corpus contains a non-mixed-driven chapter that can reach the below-pass-mark lock — ' +
    'without one this section proves nothing about the v71_d lock');
  console.log(`  lock fixture: "${lockTopic.topic}" (${(lockTopic.lessons || []).length} lessons, not mixed-driven)`);

  seedTopic(lockTopic);
  shouldNotThrow('showComplete (below pass mark)', base + _markAllDone + '\n    showComplete();');
  // v77_o (user ruling): below the mark Next is NEVER greyed — it LEADS to the work that raises the
  // mark. v71_d's principle is kept and is what this block now checks: Next means forward and never
  // silently becomes Repeat, and it is never a dead arrow. Asserted on the live card because the
  // whole point is what the learner can click, and this branch chain has produced three
  // user-reported dead ends already — a greyed arrow beside no route was the fourth.
  {
    const nx = C.document.getElementById('comp-next');
    assert.strictEqual(nx.disabled, false, 'below the pass mark, Next is NOT disabled');
    assert.ok(!nx.classList.contains('locked'), 'and not greyed');
    assert.ok(typeof nx.onclick === 'function', 'and it can be activated — it always leads somewhere');
    assert.notStrictEqual(C.document.getElementById('comp-repeat').style.display, 'none',
      'while Repeat is offered as its own button');
    assert.strictEqual(C.document.getElementById('comp-title').textContent, UI.en['complete.keep_going'],
      'the SAME card is reused, with "Keep going!" in place of "Lesson complete!"');
  }

  // The other side of the same branch chain, and the reason the fixture above has to be chosen by
  // shape: a MIXED-driven chapter below the mark must NOT lock. Its Next carries the learner back
  // into the mixed round, which is how coverage gets raised (v68.1). Guarding it here means a
  // future change that "fixes" the lock by making it unconditional fails loudly instead of
  // re-opening the dead end that fix closed. Skipped, with a note, if the corpus has no such
  // chapter — the assertion above already covers the case that matters most.
  {
    const mixedTopic = store.topics.find(t => (t.lessons || []).length >= 2 && _visibleMixed(t));
    if (!mixedTopic) console.log('  (no mixed-driven chapter in the corpus — mixed resume not exercised)');
    else {
      seedTopic(mixedTopic);
      const probe = JSON.parse(C.run(base + _markAllDone + `
        JSON.stringify({ total: topicCoverage().total, next: _firstUnfinishedLessonIdx(APP.lessonData) })`,
        'mixed-probe'));
      // Only meaningful while this chapter is genuinely below its mark; say so rather than assume.
      if (probe.total > 0) {
        seedTopic(mixedTopic);
        shouldNotThrow('showComplete (below mark, mixed-driven)', base + _markAllDone + '\n        showComplete();');
        const nx = C.document.getElementById('comp-next');
        assert.strictEqual(nx.disabled, false,
          'a mixed-driven chapter below the mark keeps Next live — it resumes the mixed round');
        assert.ok(!nx.classList.contains('locked'), 'and is not greyed');
        assert.ok(typeof nx.onclick === 'function', 'and is clickable');
        assert.ok(probe.next >= 0 && (mixedTopic.lessons[probe.next] || {}).type === 'mixed',
          'because resume points at the mixed driver, not at a lesson with a done-flag');
        assert.strictEqual(C.document.getElementById('comp-title').textContent, UI.en['complete.keep_going'],
          'while the card still says "Keep going!" — the mark is not met, only the route on differs');
        console.log(`  mixed-driven fixture: "${mixedTopic.topic}" — Next resumes lesson ${probe.next} (mixed), not locked`);
      } else console.log('  (mixed-driven chapter has an empty coverage universe — resume not exercised)');
    }
  }
  // …and the lock does not persist into the next completion rendered into the same DOM.
  seed();
  C.run(base + `
    APP.lessonData.coverageTarget = 0;
    APP.progress.solved[APP.lessonData.topic] = {};
    showComplete();`, 'above-mark');
  {
    const nx = C.document.getElementById('comp-next');
    // The claim under test is that the below-mark LOCK does not persist — `locked` is what that
    // branch sets, so that is what gets asserted. `disabled` was asserted here until v71_k and is
    // the wrong signal: the "nothing left to do" branch also disables Next, for an unrelated and
    // legitimate reason. Which of the two branches a corpus-picked chapter lands in depends on its
    // lesson content, so the old assertion failed the moment the corpus grew and this test started
    // picking a different storyline — it was testing the fixture, not the lock.
    assert.ok(!nx.classList.contains('locked'), 'at or above the mark, the below-mark lock is cleared');
    assert.strictEqual(C.document.getElementById('comp-title').textContent, UI.en['complete.title'],
      'and the card is no longer the "Keep going!" card');
  }
  // A drill's own card: its Next branch was the v69.2 dead end.
  seed();
  shouldNotThrow('showComplete (drill card)', base + `
    APP.lessonData.lessons[${lessonIdx}] = Object.assign({}, APP.lessonData.lessons[${lessonIdx}], { _drill: true });
    showComplete();`);
  // v71_k: the header line — the card's only route back once "← Back to story" is gone, so its
  // presence is asserted on the rendered card rather than in source. A drill hides it: its topic
  // is synthetic, so neither the storyline nor the chapter name means anything.
  assert.strictEqual(C.document.getElementById('comp-hdr').style.display, 'none',
    'a drill card shows no storyline header');
  seed();
  C.run(base + 'showComplete();', 'header');
  {
    const hdr = C.document.getElementById('comp-hdr');
    const ttl = C.document.getElementById('comp-hdr-title');
    assert.notStrictEqual(hdr.style.display, 'none', 'a normal card shows the header line');
    assert.ok(ttl.textContent && ttl.textContent.trim().length > 0, 'the header names where the learner is');
    assert.ok(ttl.title, 'and the link says where it goes');
  }
  // v71_k: finishing the LAST chapter of a storyline is the end of the story, not another chapter
  // completion. Driven through the real card, because the title is chosen inside the same branch
  // chain that produced three prior dead ends.
  seed();
  C.run(`(() => {
    const tp = APP.lessonData.topic;
    const entry = { id: 'sc1', topic: tp, lessons: APP.lessonData.lessons };
    APP.savedList = [entry];
    APP.storylines = [{ id: 'slDone', title: 'The Whole Thing', icon: '📕', chapters: ['sc1'] }];
    APP._slScreen = null;
    APP.progress.completed[tp] = {};
    (APP.lessonData.lessons || []).forEach(L => { if (L && L.id) APP.progress.completed[tp][L.id] = true; });
    APP.lessonData.coverageTarget = 0;
    APP.progress.solved[tp] = {};
  })()`, 'story-done-state');
  C.run(base + 'showComplete(true);', 'story-done');
  {
    assert.strictEqual(C.document.getElementById('comp-title').textContent, UI.en['complete.story_complete'],
      'the last chapter of a storyline ends the STORY, and the card says so');
    assert.ok(/The Whole Thing/.test(C.document.getElementById('comp-hdr-title').textContent),
      'and the header names the storyline it completed');
  }
  // An unfinished storyline must NOT claim the story is over — the guard against the title
  // becoming a celebration on every chapter card.
  seed();
  C.run(`(() => {
    const tp = APP.lessonData.topic;
    APP.savedList = [{ id: 'sc1', topic: tp, lessons: APP.lessonData.lessons },
                     { id: 'sc2', topic: tp + '-later', lessons: [{ id: 'zz', type: 'vocab' }], lessonCount: 1 }];
    APP.storylines = [{ id: 'slOpen', title: 'Half Told', icon: '📗', chapters: ['sc1', 'sc2'] }];
    APP._slScreen = null;
    APP.progress.completed[tp] = {};
    (APP.lessonData.lessons || []).forEach(L => { if (L && L.id) APP.progress.completed[tp][L.id] = true; });
    APP.lessonData.coverageTarget = 0;
    APP.progress.solved[tp] = {};
  })()`, 'story-open-state');
  C.run(base + 'showComplete(true);', 'story-open');
  assert.notStrictEqual(C.document.getElementById('comp-title').textContent, UI.en['complete.story_complete'],
    'a storyline with an unfinished chapter left does not announce the story is complete');
  seed();
  // Teacher sees extra panels (storyboard, stats).
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
  // v75_d: `order` must be among them whenever the fixture can produce one. Before v75_d the
  // builder dropped ordering at difficulty ≤ 1, and the fixture chapter IS difficulty 1 — so this
  // render path had never once been executed by the suite on a beginner chapter, which is exactly
  // where it now appears for the first time. Conditional on the fixture's SHAPE rather than
  // asserted flat, so a future corpus without multi-word sentences fails honestly instead of
  // spuriously; the condition is evaluated on the fixture the collection above actually ran over.
  {
    const orderable = C.run(`(APP.lessonData.lessons || []).some(L =>
      L && (L.type || 'standard') === 'standard' &&
      (L.sentences || []).some(s => s && (s.words || []).length > 1))`);
    if (orderable) {
      assert.ok(typeNames.includes('order'),
        'the fixture has multi-word sentences, so sentence ordering must be among the rendered ' +
        'types — v75_d allows it at difficulty 1 and this chapter is difficulty 1');
    }
  }
  console.log(`  renderEx: ${typeNames.length} exercise type(s) rendered without throwing (${typeNames.join(', ')}): OK`);
}

// ── 4c. The comprehension story panel (v71_s) ────────────────────────────────
// A learner cannot answer questions about a story they have not read, so the story is rendered
// with the question. Layout matters here and only a live DOM can see it: the panel must come AFTER
// the answer controls (choices, feedback, Check), which is the user's explicit call — a story of a
// few hundred words placed above them would push the buttons off a phone screen.
{
  seed();
  const built = C.run(`(() => {
    APP.lessonData.story = 'Die Katze sass im Baum.\\n\\nDas Haus war still.';
    APP.lessonData.lessons.push({ id: 'smk_comp', type: 'comprehension', questions: [
      { q: 'Wo sass die Katze?', choices: ['Im Baum','Im Haus','Im Wasser'], correctIndex: 0, why: 'x' } ] });
    const i = APP.lessonData.lessons.length - 1;
    const ex = (lessonTypeMeta('comprehension').build(APP.lessonData.lessons[i], i) || [])[0];
    if (!ex) return 'NO_EXERCISE';
    APP._teacherMode = true;          // teacher is exempt from the unlock gate → panel renders
    APP.cur = { lessonIdx: i, exercises: [ex], cur: 0, correct: 0, total: 0, mistakes: 0,
                hearts: 3, streak: 0, bestStreak: 0, answered: false, sel: null, placed: [], usedIdx: [] };
    renderEx();
    return 'OK';
  })();`, 'comp-panel');
  assert.strictEqual(built, 'OK', 'a comprehension exercise was built and rendered');
  const q = C.document.getElementById('ex-area').innerHTML;
  assert.ok(/id="ex-story-panel"/.test(q), 'the story panel is rendered on a comprehension question');
  assert.ok(/<details[^>]*\sopen/.test(q), 'and is open by default — on this question the text IS the material');
  assert.ok(/Die Katze sass im Baum/.test(q), 'the story text is actually present');
  // ORDER is the requirement: answer controls first, story last.
  const iChoices = q.indexOf('class="choices');   // comprehension renders `choices one-col`
  const iCheck   = q.indexOf('id="cbtn"');
  const iStory   = q.indexOf('id="ex-story-panel"');
  assert.ok(iChoices >= 0 && iCheck >= 0 && iStory >= 0, 'choices, Check button and story panel all present');
  assert.ok(iChoices < iStory, 'the answer choices come BEFORE the story');
  assert.ok(iCheck < iStory, 'and so does the Check button — the story never pushes it off-screen');
  // Paragraph structure survives, so a multi-paragraph story is readable.
  assert.ok((q.match(/<p dir="auto"/g) || []).length >= 2, 'blank lines become paragraphs');
  // A NON-comprehension question must not grow a story panel. Derived here rather than borrowed
  // from §4 — that block's locals are out of scope, and a self-contained negative is clearer.
  const negType = C.run(`(() => {
    const L = APP.lessonData.lessons[0];
    const ex = (lessonTypeMeta(L.type).build(L, 0) || [])[0];
    if (!ex) return 'NONE';
    APP.cur = { lessonIdx: 0, exercises: [ex], cur: 0, correct: 0, total: 0, mistakes: 0,
                hearts: 3, streak: 0, bestStreak: 0, answered: false, sel: null, placed: [], usedIdx: [] };
    renderEx();
    return ex.type;
  })();`, 'comp-panel-negative');
  assert.notStrictEqual(negType, 'NONE', 'a non-comprehension exercise was available for the negative check');
  // v80_s (user ruling, option 3): this used to assert a non-comprehension question shows NO story
  // panel. T0 asks for the text on ALL question cards, so the panel now appears everywhere — and
  // starts COLLAPSED where the story would give the answer away (word_forms 203/336, error_hunt
  // 44/47, synonyms 14/34, and the typed kinds, which leak the spelling).
  //
  // The CLAIM this negative protected is not dropped, it MOVED: the leak is now handled by the panel
  // being closed rather than absent. That half is pinned by `unit-story-panel-states` §5; what is
  // asserted here is the half this file can see — the panel renders, and the ORDER still holds, so
  // the story never pushes the answer controls off-screen.
  {
    const negHtml = C.document.getElementById('ex-area').innerHTML;
    assert.ok(/id="ex-story-panel"/.test(negHtml),
      `a ${negType} question now shows the story panel too (T0, ruled v80_s)`);
    const nStory = negHtml.indexOf('id="ex-story-panel"');
    const nCheck = negHtml.indexOf('id="cbtn"');
    assert.ok(nCheck >= 0 && nCheck < nStory,
      'and it still comes AFTER the Check button, so the answer controls stay reachable');
  }
  C.run('APP._teacherMode = false; true;');
  console.log('  renderEx: comprehension story panel renders below the answer controls: OK');
}

// ── 4b. A wrong TYPED answer renders the letter-by-letter diff (v71_c) ───────
// check() is a render path: it writes feedback HTML and touches the input element. The unit test
// covers the alignment; this covers the wiring — that check() actually reaches typedDiffHtml, and
// that the branch it lives in still runs for all three typed types without throwing.
{
  const typed = ['listen_type', 'type_plural', 'type_conjugation'];
  for (const type of typed) {
    seed();
    shouldNotThrow(`check(${type}, wrong)`, `(() => {
      APP.cur = { lessonIdx: 0, exercises: [{ type: ${JSON.stringify(type)}, correct: 'Haus',
                  target: 'Haus', source: 'house', pronoun: 'er' }], cur: 0, correct: 0, total: 0,
                  mistakes: 0, hearts: 3, streak: 0, bestStreak: 0, answered: false, sel: null,
                  placed: [], usedIdx: [] };
      document.getElementById('type-in').value = 'hause';
      check();
    })();`);
    const fb = C.document.getElementById('fb').innerHTML;
    assert.ok(/typed-diff/.test(fb), `check(${type}) shows the letter diff for a wrong typed answer`);
    assert.ok(/class="dc bad"/.test(fb), `check(${type}) marks the offending character`);
  }
  // A correct answer must NOT show a diff — there is nothing to point at.
  seed();
  C.run(`
    APP.cur = { lessonIdx: 0, exercises: [{ type: 'listen_type', correct: 'Haus', target: 'Haus' }],
                cur: 0, correct: 0, total: 0, mistakes: 0, hearts: 3, streak: 0, bestStreak: 0,
                answered: false, sel: null, placed: [], usedIdx: [] };
    document.getElementById('type-in').value = 'haus';
    check();`, 'check-correct');
  assert.ok(!/typed-diff/.test(C.document.getElementById('fb').innerHTML),
    'a correct answer (case-insensitive) shows no diff');
  // A non-typed type keeps the plain correct answer.
  seed();
  C.run(`
    APP.cur = { lessonIdx: 0, exercises: [{ type: 'mcq_target_source', correct: 'Haus', target: 'Haus' }],
                cur: 0, correct: 0, total: 0, mistakes: 0, hearts: 3, streak: 0, bestStreak: 0,
                answered: false, sel: 'Baum', placed: [], usedIdx: [] };
    check();`, 'check-mcq');
  const mcqFb = C.document.getElementById('fb').innerHTML;
  assert.ok(!/typed-diff/.test(mcqFb) && /Haus/.test(mcqFb), 'a multiple-choice answer still shows the plain answer');
  console.log('  check(): typed diff on 3 typed types, absent when correct and for non-typed types: OK');
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


// ── 7. The teacher dashboard (v69_n) ─────────────────────────────────────────
// Rendered from live endpoint data, so the panels are exercised directly with representative
// payloads: a learner with hard words, a student flag, a story flag, and the empty state.
{
  seed();
  shouldNotThrow('teacher dashboard (populated)', `(() => {
    const learners = [{ username: 'anna', lastSeen: '2026-07-24T10:00:00.000Z',
      chaptersCompleted: 3, chaptersStarted: 7, wordsLearned: 214,
      hardestWords: [{ word: 'grandine', wrong: 4 }, { word: 'nube', wrong: 2 }] }];
    const flags = [
      { kind: 'item', topicId: 'tp_1', topic: 'Ch', lessonId: '1', target: 'il campo',
        source: 'das Feld', comment: 'wrong article', correct: 'il campo', mode: 'student',
        at: '2026-07-24T09:00:00.000Z' },
      { kind: 'story', topic: 'Ch', type: 'story', mode: 'teacher', at: '2026-07-23T09:00:00.000Z' },
    ];
    document.getElementById('td-body').innerHTML =
      _tdLearnersHtml(learners) + _tdFlagsHtml(flags, { student: 1, teacher: 1 });
  })();`);
  const out = C.document.getElementById('td-body').innerHTML;
  assert.ok(/anna/.test(out), 'the learner row rendered');
  assert.ok(/grandine/.test(out), 'their hardest words rendered');
  assert.ok(/wrong article/.test(out), 'the flag comment rendered');
  assert.ok(out.indexOf('wrong article') < out.indexOf('story'), 'the student report leads');

  // The empty state must render too — that is what a fresh install shows.
  seed();
  shouldNotThrow('teacher dashboard (empty)',
    `document.getElementById('td-body').innerHTML = _tdLearnersHtml([]) + _tdFlagsHtml([], {});`);
  assert.ok(C.document.getElementById('td-body').innerHTML.length > 0, 'the empty state rendered');

  // v69_r (user report: clicking Learners opened an empty page). The whole open path must always
  // leave SOMETHING in the body — a backend notice, an error, or the panels — never blank.
  seed();
  C.run(`APP.info = { canGenerate: false };`);   // static build / no backend
  shouldNotThrow('teacher dashboard (no backend)', `openTeacherDashboard();`);
  {
    const b = C.document.getElementById('td-body').innerHTML;
    assert.ok(b && b.length > 0, 'the no-backend case shows a notice, not a blank screen');
    assert.ok(/backend/i.test(b), 'and the notice explains why');
  }
}
console.log('  teacher dashboard: populated + empty states render: OK');

// ── 8. The account modal + TLS banner (v70_b) ────────────────────────────────
// A render path, so it gets executed rather than only asserted from source: the banner is read
// off APP.info at open time, and openAccount() also touches half a dozen elements around it.
{
  seed();
  C.run(`APP.info = { canGenerate: true, insecureTransport: true }; APP.learner = null;`);
  shouldNotThrow('account modal (insecure, signed out)', `openAccount();`);
  {
    const w = C.document.getElementById('acct-tls-warn');
    assert.ok(w.style.display !== 'none', 'the banner is shown over plain HTTP off loopback');
    assert.ok(w.textContent && w.textContent.length > 20, 'and it carries real text, not an empty box');
  }

  // Loopback / TLS: the banner must be absent, not merely quiet. A warning that appears when it
  // does not apply trains people to ignore it.
  seed();
  C.run(`APP.info = { canGenerate: true, insecureTransport: false }; APP.learner = null;`);
  shouldNotThrow('account modal (secure, signed out)', `openAccount();`);
  assert.strictEqual(C.document.getElementById('acct-tls-warn').style.display, 'none',
    'no banner when the connection is secure or local');

  // Signed in, the password is no longer in play but the SESSION COOKIE still crosses the wire on
  // every request — so the warning still belongs here.
  seed();
  C.run(`APP.info = { canGenerate: true, insecureTransport: true }; APP.learner = 'anna';`);
  shouldNotThrow('account modal (insecure, signed in)', `openAccount();`);
  assert.ok(C.document.getElementById('acct-tls-warn').style.display !== 'none',
    'the banner also shows while signed in (the session cookie is still in the clear)');

  // Missing flag (an older server, or the static build) must not throw or false-positive.
  seed();
  C.run(`APP.info = { canGenerate: true }; APP.learner = null;`);
  shouldNotThrow('account modal (flag absent)', `openAccount();`);
  assert.strictEqual(C.document.getElementById('acct-tls-warn').style.display, 'none',
    'an absent flag is treated as "no warning", not as insecure');
}
console.log('  account modal: TLS banner shown/hidden across 4 states: OK');

// ── 9. Crossword play mode (v70_d) ───────────────────────────────────────────
// Executed, not asserted from source: the render builds a grid of inputs from live layout output,
// and the credit path reaches markSolved() through qid(). Both are exactly the kind of thing a
// source-level assertion cannot see.
{
  seed();
  // A vocab lesson with enough crossable words. Index 0 of the fixture topic is replaced so the
  // rest of the harness state stays as the other sections left it.
  C.run(`
    APP.lessonData.lessons[0] = { id:'cw-lesson', type:'standard', vocab:[
      {target:'HAUS', source:'house'}, {target:'HUND', source:'dog'},
      {target:'SONNE', source:'sun'},  {target:'NACHT', source:'night'},
      {target:'STERN', source:'star'}, {target:'BAUM', source:'tree'} ] };
    // Swapping a lesson's CONTENT invalidates the coverage universe — the app does this in
    // _postLessonEdit and on loading a set, and the cache is keyed on topic|lessonIdx so it cannot
    // notice the swap by itself. The fixture must do the same or _crosswordCreditable checks the
    // new lesson's qids against the OLD lesson's universe and credits nothing. (Latent since the
    // cache was added; surfaced by v71_f, which made buildExercises populate the cache too.)
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    true;`);

  assert.strictEqual(C.run(`_crosswordAvailable(APP.lessonData.lessons[0])`), true,
    'a vocab lesson with crossable words offers a crossword');
  assert.strictEqual(C.run(`_crosswordAvailable({type:'standard', vocab:[{target:'你好',source:'hi'}]})`), false,
    'a lesson with no crossable words does not');
  // v70_j: availability is CONTENT-based, not type-based — that is what let mixed, synonyms and
  // word-form lessons work. A real error-hunt lesson carries no vocabulary and so is excluded by
  // content; a contrived one that did carry vocabulary would legitimately be offered.
  assert.strictEqual(C.run(`_crosswordAvailable({type:'error_hunt'}, 0)`), false,
    'a lesson contributing no words of its own is not offered');

  shouldNotThrow('openCrossword', `openCrossword(0);`);
  assert.notStrictEqual(C.document.getElementById('cw-modal').style.display, 'none', 'the modal opened');
  // The stub DOM does not parse innerHTML (querySelectorAll always returns []), so assert against
  // the markup the render produced. getElementById DOES persist stubs, which is what makes the
  // solve path below executable.
  const html = C.document.getElementById('cw-body').innerHTML;
  const inputs = (html.match(/<input /g) || []).length;
  assert.ok(inputs >= 10, `the grid rendered inputs (got ${inputs})`);
  assert.ok(/Across/.test(html) && /Down/.test(html), 'both clue lists rendered');

  // Solve one entry by typing its letters, then check. This exercises the read-back, the lock,
  // the re-render and the credit path in one go.
  const res = C.run(`(function(){
    const S = APP._cw, e = S.grid.entries[0];
    for (let i=0;i<e.len;i++){
      const r = e.row + (e.dir==='down'?i:0), c = e.col + (e.dir==='across'?i:0);
      document.getElementById('cw-'+r+','+c).value = e.answer[i];
    }
    return checkCrossword();
  })()`);
  assert.strictEqual(res.solved, 1, 'the completed entry was recognised');
  assert.strictEqual(C.run(`Object.keys(APP._cw.done).length`), 1, 'and locked');

  // Coverage moved through the lesson's OWN question, not a new one — the point of the design.
  assert.ok(res.credited >= 1, 'solving credited at least one existing lesson question');
  const credited = C.run(`(function(){
    const ans = APP._cw.grid.entries[0].answer;
    return _crosswordCreditable(ans).map(x => x.type);
  })()`);
  assert.deepStrictEqual([...new Set(credited)], ['mcq_source_target'],
    'only the written source→target question is credited — audio types are not demonstrated');

  // DETERMINISTIC guard against crediting-by-rebuild. build() samples: it emits a round, not the
  // full question set, and a different subset each call. So a rebuild-based credit path makes only
  // SOME words creditable, and which ones changes per call — a bug that passes a single-word check
  // roughly half the time. Requiring every word to be creditable, and the answer to be stable
  // across repeated calls, catches it every run.
  const perWord = C.run(`(function(){
    return APP.lessonData.lessons[0].vocab.map(v => ({
      w: v.target, n: _crosswordCreditable(v.target.toUpperCase()).length }));
  })()`);
  // NB: values crossing the vm boundary belong to another realm, so deepStrictEqual against a
  // local [] fails on prototype identity even when the contents match. Compare lengths.
  const uncreditable = [...perWord].filter(x => x.n === 0).map(x => x.w);
  assert.strictEqual(uncreditable.length, 0,
    `every word must be creditable, not a sampled subset (missing: ${uncreditable.join(', ')})`);

  const stable = C.run(`(function(){
    const out = [];
    for (let i=0;i<5;i++) out.push(_crosswordCreditable('HAUS').map(x=>x.type).join(','));
    return out;
  })()`);
  assert.strictEqual(new Set([...stable]).size, 1, 'the credit target is stable across repeated calls');

  // A wrong answer must not credit anything.
  const before = C.run(`Object.keys(APP._cw.done).length`);
  C.run(`(function(){
    const S = APP._cw, e = S.grid.entries[1];
    for (let i=0;i<e.len;i++){
      const r = e.row + (e.dir==='down'?i:0), c = e.col + (e.dir==='across'?i:0);
      document.getElementById('cw-'+r+','+c).value = 'Z';
    }
    return true;
  })()`);
  const bad = C.run(`checkCrossword();`);
  assert.strictEqual(bad.solved, 0, 'a wrong entry is not accepted');
  assert.strictEqual(C.run(`Object.keys(APP._cw.done).length`), before, 'and nothing new locks');

  // ── v70_f UX: letters persist, cells are judged, reveal does not credit ───
  // The pre-v70_f render rebuilt the grid from markup with no `value`, so Check wiped every
  // letter the learner had typed — including the ones that were right.
  {
    const persisted = C.run(`(function(){
      const S = APP._cw, e = S.grid.entries[2];
      const k0 = e.row + ',' + e.col;
      document.getElementById('cw-' + k0).value = e.answer[0];   // one correct letter
      const k1 = (e.row + (e.dir==='down'?1:0)) + ',' + (e.col + (e.dir==='across'?1:0));
      document.getElementById('cw-' + k1).value = 'Z';           // one wrong letter
      const res = checkCrossword();
      return { typed0: S.typed[k0], typed1: S.typed[k1], m0: S.mark[k0], m1: S.mark[k1],
               dom0: document.getElementById('cw-' + k0).value, wrong: res.wrong };
    })()`);
    assert.strictEqual(persisted.typed0, C.run(`APP._cw.grid.entries[2].answer[0]`),
      'a correct letter survives Check');
    assert.strictEqual(persisted.typed1, 'Z', 'a wrong letter survives Check too — not erased');
    assert.strictEqual(persisted.m0, 'ok', 'the correct letter is marked green');
    assert.strictEqual(persisted.m1, 'bad', 'the wrong letter is marked red');
    assert.ok(persisted.wrong >= 1, 'the wrong count is reported');
    assert.ok(persisted.dom0, 'and the re-rendered input carries the value attribute');
    const html = C.document.getElementById('cw-body').innerHTML;
    assert.ok(/value="/.test(html), 'the rendered grid writes typed letters back into value=');
    assert.ok(/#ffe3e3/.test(html) && /#d8f5d8/.test(html), 'red and green cells both rendered');
  }

  // Retyping a judged cell clears its mark — stale red on a changed letter would mislead.
  {
    const cleared = C.run(`(function(){
      const S = APP._cw, e = S.grid.entries[2];
      const k1 = (e.row + (e.dir==='down'?1:0)) + ',' + (e.col + (e.dir==='across'?1:0));
      document.getElementById('cw-' + k1).value = 'Q';
      cwInput(k1);
      return S.mark[k1];
    })()`);
    assert.strictEqual(cleared, undefined, 'editing a cell clears its previous verdict');
  }

  // Auto-advance must not throw on a DOM with no focus() — the stub has none.
  shouldNotThrow('cwInput advance at grid edge', `(function(){
    const S = APP._cw, e = S.grid.entries[0];
    const kEnd = (e.row + (e.dir==='down'?e.len-1:0)) + ',' + (e.col + (e.dir==='across'?e.len-1:0));
    document.getElementById('cw-'+kEnd).value = 'A'; cwInput(kEnd); return true; })()`);

  // Reveal fills everything, but credits nothing — and a later Check cannot launder it.
  {
    const before = C.run(`_lessonQidUniverse(0).size && Object.keys(APP.progress.solved[APP.lessonData.topic]||{}).length`);
    const rev = C.run(`(function(){
      const n = solveCrossword();
      const after = checkCrossword();
      return { n, revealed: APP._cw.revealed, credited: after.credited,
               filled: Object.keys(APP._cw.typed).length, done: Object.keys(APP._cw.done).length };
    })()`);
    assert.ok(rev.n >= 3, 'reveal reports how many entries it filled');
    assert.strictEqual(rev.revealed, true, 'the revealed flag latches');
    assert.strictEqual(rev.credited, 0, 'a Check after reveal credits nothing');
    assert.strictEqual(rev.done, C.run(`APP._cw.grid.entries.length`), 'every entry is marked done');
    assert.ok(rev.filled > 0, 'the grid is filled with the solution');

    // The assertion above is nearly vacuous on its own — solveCrossword() marks every entry done,
    // and checkCrossword() skips done entries, so nothing would credit regardless. Test the latch
    // itself: an entry solved by hand AFTER a reveal must still credit nothing.
    const laundered = C.run(`(function(){
      const S = APP._cw, e = S.grid.entries[0];
      delete S.done[0];                     // pretend this entry was never revealed
      // Write through the DOM, not S.typed: checkCrossword() syncs from the inputs first, and the
      // stub DOM does not re-create them from innerHTML the way a browser does, so stale stub
      // values would otherwise overwrite anything set directly on the state.
      for (let i=0;i<e.len;i++){
        const k = (e.row + (e.dir==='down'?i:0)) + ',' + (e.col + (e.dir==='across'?i:0));
        document.getElementById('cw-' + k).value = e.answer[i];
      }
      return checkCrossword();
    })()`);
    assert.strictEqual(laundered.solved, 1, 'the entry was accepted as solved');
    assert.strictEqual(laundered.credited, 0,
      'but a revealed puzzle credits nothing, even for an entry completed afterwards');
    const after = C.run(`Object.keys(APP.progress.solved[APP.lessonData.topic]||{}).length`);
    assert.ok(after >= before, 'no coverage was lost');
  }

  // ── v70_h: attempts vary, options steer the pool, keys navigate, auto-check ─
  {
    // A new attempt must produce a DIFFERENT puzzle — that is the whole point of regenerate, and
    // the reason the fixed per-lesson seed was wrong once the crossword became a "way up": a
    // learner who replayed got the identical grid they had already solved, crediting nothing.
    C.run(`APP._cwOpts = { count: 5, src: 'lesson', preferWrong: false }; openCrossword(0, 0); true;`);
    const a = C.run(`JSON.stringify(APP._cw.grid.entries.map(e => e.answer + e.row + e.col + e.dir))`);
    C.run(`regenerateCrossword();`);
    const b = C.run(`JSON.stringify(APP._cw.grid.entries.map(e => e.answer + e.row + e.col + e.dir))`);
    assert.notStrictEqual(a, b, 'regenerate produces a different puzzle');
    assert.strictEqual(C.run(`APP._cw.attempt`), 1, 'the attempt counter advanced');

    // ...but an attempt is stable while it is on screen: re-deriving it must not re-roll.
    const c1 = C.run(`JSON.stringify(_crosswordFor(0, 3).entries.map(e => e.answer + e.row + e.col))`);
    const c2 = C.run(`JSON.stringify(_crosswordFor(0, 3).entries.map(e => e.answer + e.row + e.col))`);
    assert.strictEqual(c1, c2, 'a given attempt is deterministic');

    // Word count is honoured (bounded below by the minimum a grid needs).
    C.run(`setCrosswordOpt('count', 5);`);
    assert.ok(C.run(`APP._cw.grid.entries.length`) <= 5, 'the word-count option caps the puzzle');

    // Source options change the candidate pool.
    const poolLesson = C.run(`_crosswordPool(0, { count:8, src:'lesson', preferWrong:false }).length`);
    const poolTopic  = C.run(`_crosswordPool(0, { count:8, src:'topic',  preferWrong:false }).length`);
    assert.ok(poolTopic >= poolLesson, 'the topic pool includes at least this lesson\'s words');

    // The cross-storyline pool reads the learner ledger, not the loaded topic.
    C.run(`
      APP.progress.learned = {};
      const led = _learnedLedger(APP.lessonData.lang, APP.lessonData.srcLang);
      led.vocab['FENSTER'] = { source:'window', wrong:3, seen:5 };
      led.vocab['TISCH']   = { source:'table',  wrong:0, seen:9 };
      true;`);
    const poolAll = C.run(`_crosswordPool(0, { count:8, src:'all', preferWrong:false }).map(p => p.answer)`);
    assert.ok([...poolAll].includes('FENSTER'), 'the "everything learned" pool draws from the ledger');

    // "Favour words I got wrong" must actually put mistakes first.
    const preferred = C.run(`_crosswordSelect(
      _crosswordPool(0, { count:8, src:'all', preferWrong:true }),
      { count:2, src:'all', preferWrong:true }, 'seed-x').map(p => p.answer)`);
    assert.strictEqual([...preferred][0], 'FENSTER', 'the most-wrong word is selected first');

    // Keyboard navigation must not throw where focus() does not exist, and Backspace must clear.
    C.run(`APP._cwOpts = { count: 8, src: 'lesson', preferWrong: false }; openCrossword(0, 0); true;`);
    const cleared = C.run(`(function(){
      const S = APP._cw, e = S.grid.entries[0], k = e.row + ',' + e.col;
      document.getElementById('cw-' + k).value = 'X'; cwInput(k);
      cwKey(k, { key:'Backspace', preventDefault(){} });
      return { v: document.getElementById('cw-' + k).value, typed: S.typed[k] };
    })()`);
    assert.strictEqual(cleared.v, '', 'Backspace clears the current cell');
    assert.strictEqual(cleared.typed, undefined, 'and drops it from state');
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
      shouldNotThrow('cwKey ' + key, `(function(){
        const S = APP._cw, e = S.grid.entries[0];
        cwKey(e.row + ',' + e.col, { key: ${JSON.stringify(key)}, preventDefault(){} }); return true; })()`);
    assert.strictEqual(C.run(`(function(){
      const S = APP._cw, e = S.grid.entries[0];
      cwKey(e.row + ',' + e.col, { key:'ArrowDown', preventDefault(){} });
      return S.dir; })()`), 'down', 'a vertical arrow switches the typing direction');

    // Filling every cell auto-checks, without the Check button being pressed.
    const auto = C.run(`(function(){
      openCrossword(0, 0);
      const S = APP._cw;
      const keys = [...S.owner.keys()];
      keys.forEach((k, i) => {
        document.getElementById('cw-' + k).value = S.sol.get(k);
        if (i < keys.length - 1) { S.typed[k] = S.sol.get(k); }
      });
      cwInput(keys[keys.length - 1]);          // the final letter triggers the check
      return { done: Object.keys(S.done).length, entries: S.grid.entries.length };
    })()`);
    assert.strictEqual(auto.done, auto.entries, 'filling the last cell auto-checks and solves every entry');
  }

  // ── v70_i: mixed lessons, synonyms and word forms ────────────────────────
  {
    // THE REPORTED BUG: a mixed lesson owns no vocab of its own, so the crossword vanished for
    // exactly the lesson a mixed-driven set resumes into after a Repeat. It must pool from the
    // earlier visible non-mixed siblings it draws from.
    seed();
    C.run(`
      APP.lessonData.lessons = [
        { id:'v1', type:'standard', vocab:[
          {target:'HAUS', source:'house'}, {target:'HUND', source:'dog'},
          {target:'SONNE', source:'sun'},  {target:'NACHT', source:'night'} ] },
        { id:'mx', type:'mixed', perType:{} } ];
      APP._teacherMode = false;
      APP.cur = { lessonIdx:1, correct:1, total:1, mistakes:0, bestStreak:1, flagCount:0, exercises:[] };
      true;`);
    assert.strictEqual(C.run(`_crosswordAvailable(APP.lessonData.lessons[1], 1)`), true,
      'a mixed lesson offers a crossword drawn from its source lessons');
    assert.strictEqual(C.run(`_crosswordAvailable(APP.lessonData.lessons[1], 0)`), false,
      'but only from lessons EARLIER than it — a mixed lesson at index 0 pools nothing');
    shouldNotThrow('showComplete (mixed lesson)', `showComplete();`);
    assert.strictEqual(C.document.getElementById('comp-crossword').style.display, '',
      'and the completion screen offers it after a mixed lesson');
    shouldNotThrow('openCrossword on a mixed lesson', `openCrossword(1, 0);`);
    assert.ok(C.run(`APP._cw.grid.entries.length`) >= 3, 'the mixed puzzle has entries');
    C.run(`closeCrossword();`);

    // Synonyms lessons contribute base←gloss and each synonym←its gloss.
    const synPairs = C.run(`_crosswordLessonPairs({ type:'synonyms', words:[
      { base:'previsioni', gloss:'forecasts', synonyms:[{w:'prognosi', g:'prognoses'}] } ] }, 0)
      .map(p => p.answer + '←' + p.clue)`);
    assert.ok([...synPairs].includes('previsioni←forecasts'), 'the base word and its gloss');
    assert.ok([...synPairs].includes('prognosi←prognoses'), 'and each synonym with its own gloss');

    // word_forms contribute the correct choice, clued by the blanked sentence.
    const wfPairs = C.run(`_crosswordLessonPairs({ type:'word_forms', items:[
      { sentence:'il fronte ha ___ le Marche', choices:['raggiunto','raggiunge'], correctIndex:0 } ] }, 0)
      .map(p => p.answer + '←' + p.clue)`);
    assert.deepStrictEqual([...wfPairs], ['raggiunto←il fronte ha ___ le Marche'],
      'the correct form, clued by its own sentence');
    // A malformed item must be skipped, not throw.
    assert.strictEqual(C.run(`_crosswordLessonPairs({ type:'word_forms', items:[
      { sentence:'x', choices:['a'], correctIndex:5 }, null ] }, 0).length`), 0,
      'items with an out-of-range correctIndex are skipped');

    // Crediting: a word_form entry credits its own question (same canonical), synonyms do not.
    seed();
    C.run(`
      // A DISTINCT topic name: _lessonQidUniverse caches on topic|lessonIdx and returns the cached
      // set without re-deriving, so reusing the fixture's topic here would hand back the universe
      // an earlier scenario built for index 0. Real usage never swaps a lesson's content under a
      // fixed topic+index; only a test does.
      APP.lessonData.topic = 'cw-wordforms-scenario';
      APP.lessonData.lessons = [{ id:'wf', type:'word_forms', items:[
        { sentence:'il fronte ha ___ le Marche', choices:['raggiunto','raggiunge','raggiungera'], correctIndex:0 } ] }];
      APP.progress.solved[APP.lessonData.topic] = {};
      true;`);
    const wfCredit = C.run(`_crosswordCreditable('RAGGIUNTO').map(x => x.type)`);
    assert.deepStrictEqual([...wfCredit], ['word_form'],
      'a word-form answer credits the word_form question it was clued from');
  }

  // ── v70_j: thin lesson tops up from earlier lessons ──────────────────────
  // Reproduces the reported topic exactly: a word-rich hidden lesson, an error-hunt, and a visible
  // lesson whose vocabulary is quizzed WITH the article ("der Hund") and so is all two-word
  // phrases. Before this, the only lesson a learner could see offered no crossword at all.
  {
    seed();
    C.run(`
      APP.lessonData.topic = 'cw-topup-scenario';
      APP.lessonData.lessons = [
        { id:'l0', type:'standard', _hidden:true, vocab:[
          {target:'HAUS',source:'house'}, {target:'HUND',source:'dog'}, {target:'SONNE',source:'sun'},
          {target:'NACHT',source:'night'}, {target:'STERN',source:'star'}, {target:'BAUM',source:'tree'},
          {target:'BUCH',source:'book'},   {target:'MAUS',source:'mouse'} ] },
        { id:'l1', type:'ai_error_hunt', _hidden:true },
        { id:'l2', type:'standard', vocab:[
          {target:'der Hund', source:'the dog'}, {target:'die Sonne', source:'the sun'},
          {target:'das Buch', source:'the book'}, {target:'KATZE', source:'cat'} ] } ];
      APP._cwOpts = { count: 8, src: 'lesson', preferWrong: false };
      APP._teacherMode = true;
      true;`);

    // The lesson's own words: only KATZE is crossable, so it cannot fill a grid alone.
    assert.strictEqual(C.run(`_crosswordDistinct(_crosswordLessonPairs(APP.lessonData.lessons[2], 2))`), 1,
      'article+noun phrases are not crossable — the lesson has one usable word');
    assert.strictEqual(C.run(`_crosswordAvailable(APP.lessonData.lessons[2], 2)`), true,
      'but it is offered anyway, topped up from earlier lessons');

    // The error-hunt lesson contributes nothing of its own and must stay excluded — otherwise the
    // top-up would offer a crossword on every lesson in the topic.
    assert.strictEqual(C.run(`_crosswordAvailable(APP.lessonData.lessons[1], 1)`), false,
      'a lesson contributing no words of its own is still not offered');

    // The puzzle actually builds, flags that it was topped up, and keeps the lesson's own word.
    C.run(`openCrossword(2, 0);`);
    assert.ok(C.run(`APP._cw.grid.entries.length`) >= 3, 'a grid was built for the thin lesson');
    assert.strictEqual(C.run(`APP._cw.grid.topped`), true, 'and it reports that it was topped up');
    // The pool keeps non-crossable entries (they are filtered during selection), so compare the
    // CROSSABLE order: the lesson's own word must precede the topped-up ones.
    const answers = C.run(`_crosswordEffectivePool(2, { count:8, src:'lesson', preferWrong:false })
      .pool.filter(p => _crosswordUsable(p.answer)).map(p => p.answer)`);
    assert.strictEqual([...answers][0], 'KATZE', "the lesson's own word comes first in the pool");
    assert.ok([...answers].includes('HAUS'), 'and earlier lessons fill the rest');
    C.run(`closeCrossword();`);

    // A lesson that can stand alone must NOT be topped up — otherwise every puzzle would drift
    // into earlier vocabulary the learner did not ask for.
    assert.strictEqual(C.run(`_crosswordEffectivePool(0, { count:8, src:'lesson', preferWrong:false }).topped`), false,
      'a word-rich lesson is not topped up');
  }

  shouldNotThrow('closeCrossword', `closeCrossword();`);
  assert.strictEqual(C.document.getElementById('cw-modal').style.display, 'none', 'the modal closed');
  assert.strictEqual(C.run(`APP._cw`), null, 'and the session state is cleared');

  // Too few crossable words: opening must decline gracefully rather than render an empty grid.
  C.run(`APP.lessonData.lessons[0] = { id:'cw-thin', type:'standard', vocab:[{target:'HAUS',source:'house'}] }; true;`);
  shouldNotThrow('openCrossword (too few words)', `openCrossword(0);`);
  assert.strictEqual(C.document.getElementById('cw-modal').style.display, 'none',
    'the modal does not open when there is no puzzle to make');
  // ── The LEARNER entry point (v70_e) ───────────────────────────────────────
  // The lesson-node button is unreachable for students: learners skip the lesson-set page
  // entirely (v60 learner nav), so a crossword offered only there can never be opened by the
  // people it is for. The completion screen is where learners actually land.
  seed();
  C.run(`
    APP.lessonData.lessons[0] = { id:'cw-lesson', type:'standard', vocab:[
      {target:'HAUS', source:'house'}, {target:'HUND', source:'dog'},
      {target:'SONNE', source:'sun'},  {target:'NACHT', source:'night'},
      {target:'STERN', source:'star'}, {target:'BAUM', source:'tree'} ] };
    APP._teacherMode = false;
    APP.cur = { lessonIdx:0, correct:1, total:1, mistakes:0, bestStreak:1, flagCount:0, exercises:[] };
    true;`);
  // v75_c: this section is about an ORDINARY completion card. `seed()` does not reset
  // APP.progress — it preserves what is there — and the §3 lock probe above marks every lesson of
  // its fixture complete, keyed by TOPIC NAME. When the corpus drifted so that the lock fixture and
  // the default topic became the same chapter, that completion leaked in here: rendering the card
  // marks `cw-lesson` done, which with the leaked siblings completed the chapter, the story counted
  // as unlocked, and v74_l CORRECTLY hid the crossword — so this assertion started failing against
  // working code. Clear the leak, and then say out loud which card was rendered.
  //
  // Checked AFTER showComplete, not before: rendering the card marks the lesson done, so the
  // unlock state that decides v74_l's branch is the state the render LEAVES, not the one it found.
  // Asserted before the reset was added this passed, which made it no guard at all.
  C.run(`APP.progress.completed[APP.lessonData.topic] = {};
         APP.progress.solved[APP.lessonData.topic] = {}; true;`);
  shouldNotThrow('showComplete (learner, crossword available)', `showComplete();`);
  assert.strictEqual(C.run(`storyUnlocked(APP.lessonData)`), false,
    'the card just rendered is an ordinary completion card, NOT the story-unlocked card — v74_l ' +
    'strips that one back to Next and would hide the crossword for a reason unrelated to this ' +
    'assertion, turning the check below into a test of a rule unit-story-unlocked-card already owns');
  assert.strictEqual(C.document.getElementById('comp-crossword').style.display, '',
    'a LEARNER is offered the crossword on the completion screen');

  // ── v70_g: icons + tooltips, one row ─────────────────────────────────────
  // An icon with no accessible name is unusable with a screen reader and unguessable otherwise,
  // so every action button must carry both a title and an aria-label.
  for (const id of ['comp-crossword', 'comp-next']) {
    const b = C.document.getElementById(id);
    assert.ok(b.textContent && b.textContent.length <= 3, `${id} shows an icon, not a text label`);
    assert.ok(b.title && b.title.length > 2, `${id} keeps its former label as a tooltip`);
    assert.ok(b.getAttribute('aria-label'), `${id} has an accessible name`);
  }
  assert.strictEqual(C.document.getElementById('comp-crossword').textContent, '🔠',
    'crossword uses the letter-grid icon (🧩 is the word_forms lesson type)');

  // Above the pass mark with a next lesson: the primary action is forward.
  assert.strictEqual(C.document.getElementById('comp-next').textContent, '→',
    'Next is an arrow when there is progress to make');

  // Below the pass mark with nothing left to play, the primary action becomes REPEAT, not Next —
  // the learner has not earned forward movement, and the row offers the ways up.
  // NB: below-mark with a lesson still to play keeps the arrow, deliberately. That branch carries
  // real progress (v69.2), and turning it into a repeat would recreate the dead end that fix
  // removed. So the scenario here is a SINGLE completed lesson: no next lesson, coverage short.
  seed();
  C.run(`
    APP.lessonData.lessons = [{ id:'cw-solo', type:'standard', vocab:[
      {target:'HAUS', source:'house'}, {target:'HUND', source:'dog'},
      {target:'SONNE', source:'sun'},  {target:'NACHT', source:'night'},
      {target:'STERN', source:'star'}, {target:'BAUM', source:'tree'} ] }];
    APP._teacherMode = false;
    APP.info.coverageThreshold = 0.99;
    APP.progress.solved[APP.lessonData.topic] = {};
    APP.progress.completed[APP.lessonData.topic] = { 'cw-solo': true };
    APP.cur = { lessonIdx:0, correct:1, total:1, mistakes:0, bestStreak:1, flagCount:0, exercises:[] };
    true;`);
  shouldNotThrow('showComplete (stuck below pass mark)', `showComplete();`);
  assert.ok(C.run(`_firstCoverageShortLessonIdx() >= 0`), 'the scenario really is replayable');
  {
    // v77_o (user ruling): Next is LIVE here and leads to the coverage-short lesson — which in this
    // scenario is the only work left, so forward and "the way up" are now the SAME move. The v69.2
    // guarantee this scenario exists for is unchanged and is what the assertions below check: the
    // learner must never be left on this card with no route up. Next is now itself such a route.
    const nx = C.document.getElementById('comp-next');
    assert.strictEqual(nx.disabled, false, 'below the mark, Next is live rather than locked (v77_o)');
    assert.ok(typeof nx.onclick === 'function', 'and has a destination');
    // It must lead INTO the work, not out of the chapter: clicking starts a lesson.
    C.run(`APP._startedIdx = null; APP._leftChapter = null;
           var _os = startLesson; startLesson = function(i){ APP._startedIdx = i; return true; };
           loadSaved = function(x){ APP._leftChapter = String(x); };
           document.getElementById('comp-next').onclick();
           startLesson = _os; true;`);
    assert.strictEqual(C.run(`APP._leftChapter`), null,
      'Next below the mark does not carry the learner out of the chapter');
    assert.ok(C.run(`APP._startedIdx`) >= 0,
      'it starts the lesson that still has coverage to gain');
    // THE v69.2 RULE: at least one LIVE way up is offered. v71_h: buttons are always present now,
    // so "a route up" means present AND enabled — a greyed button is not a route. This is the
    // assertion that must never soften.
    const rp = C.document.getElementById('comp-repeat');
    const cw = C.document.getElementById('comp-crossword');
    const db = C.document.getElementById('comp-drill');
    const live = b => b.style.display !== 'none' && !b.disabled;
    const routes = [rp, cw, db].filter(live);
    assert.ok(routes.length >= 1, 'the learner is not dead-ended — at least one LIVE route to the pass mark is offered');
    assert.ok(live(rp), 'replaying is a live route, since the scenario is replayable');
    assert.ok(live(cw), 'the crossword is a live route to the pass mark');
  }

  // v71_h: the no-duplicate-icon rule now checks LIVE buttons. Every action button is always
  // present, so comparing all four would trivially collide (two greyed buttons are fine); what must
  // never happen is two ENABLED buttons wearing the same icon.
  {
    const icons = ['comp-repeat', 'comp-drill', 'comp-crossword', 'comp-next']
      .map(id => C.document.getElementById(id))
      .filter(b => b && b.style.display !== 'none' && !b.disabled)
      .map(b => b.textContent);
    assert.strictEqual(new Set(icons).size, icons.length,
      `no two LIVE action buttons share an icon (got ${icons.join(' ')})`);
  }

  // And it hides when the lesson cannot make a puzzle, rather than opening an empty grid.
  seed();
  C.run(`
    APP.lessonData.lessons[0] = { id:'cw-none', type:'standard', vocab:[{target:'你好', source:'hi'}] };
    APP._teacherMode = false;
    APP.cur = { lessonIdx:0, correct:1, total:1, mistakes:0, bestStreak:1, flagCount:0, exercises:[] };
    true;`);
  // v71_h: it is greyed (present but disabled), not removed, so the button row is consistent.
  shouldNotThrow('showComplete (no puzzle possible)', `showComplete();`);
  {
    const cw = C.document.getElementById('comp-crossword');
    assert.notStrictEqual(cw.style.display, 'none', 'the crossword button is still present (v71_h)');
    assert.strictEqual(cw.disabled, true, 'but greyed and disabled when the lesson has no crossable words');
    assert.ok(cw.classList.contains('disabled'), 'and carries the disabled class');
  }
}
console.log('  crossword: availability, render, solve+credit, reject, close, learner entry: OK');

{
  // ── v70_l: repeat + drill stay available on a FINISHED lesson ────────────
  // The reported case: every lesson meets its own mark but the STORYLINE mark is higher, so the
  // story never unlocks — and the completion card offered no way back in, because the buttons were
  // gated on being below the lesson-level threshold.
  seed();
  C.run(`
    APP.lessonData.topic = 'cw-finished-scenario';
    APP.lessonData.lessons = [{ id:'fin', type:'standard', vocab:[
      {target:'HAUS', source:'house'}, {target:'HUND', source:'dog'},
      {target:'SONNE', source:'sun'},  {target:'NACHT', source:'night'} ] }];
    APP._teacherMode = false;
    // Lesson-level coverage SATISFIED — the user's case is precisely this: the lesson mark is met,
    // so the replay branch never runs, even though coverage is incomplete and the storyline mark is
    // higher. The per-topic override must be cleared too: coverageTarget takes precedence over the
    // global threshold, and the fixture topic carries whatever the bundled data happens to set.
    delete APP.lessonData.coverageTarget;
    APP.storylines = [];
    APP.info.coverageThreshold = 0;
    APP.progress.completed[APP.lessonData.topic] = { fin: true };
    APP.cur = { lessonIdx:0, correct:4, total:4, mistakes:0, bestStreak:4, flagCount:0, exercises:[] };
    true;`);
  // The mechanism: showComplete's replay branch requires _belowThreshold. With the lesson-level
  // mark satisfied, that branch never runs — so before v70_l the learner got no replay affordance
  // at all, even though coverage was still incomplete and the storyline mark was higher.
  assert.ok(C.run(`_firstCoverageShortLessonIdx()`) >= 0,
    'coverage is still incomplete (so replaying CAN raise it)');
  shouldNotThrow('showComplete (finished lesson)', `showComplete();`);
  assert.notStrictEqual(C.document.getElementById('comp-next').textContent, '↻',
    'the primary action is NOT the repeat here — that branch is gated on being below the mark');
  const rp = C.document.getElementById('comp-repeat');
  assert.notStrictEqual(rp.style.display, 'none',
    'a finished lesson still offers Repeat — the only way to raise coverage toward a higher storyline mark');
  assert.strictEqual(rp.textContent, '↻', 'and it is the repeat icon');
  assert.ok(rp.getAttribute('aria-label'), 'with an accessible name');
  shouldNotThrow('repeatForCoverage', `repeatForCoverage();`);

  // ── v70_l: the crossword highlights the entries under the cursor ─────────
  seed();
  C.run(`
    APP.lessonData.lessons[0] = { id:'cw-hl', type:'standard', vocab:[
      {target:'HAUS', source:'house'}, {target:'HUND', source:'dog'},
      {target:'SONNE', source:'sun'},  {target:'NACHT', source:'night'},
      {target:'STERN', source:'star'}, {target:'BAUM', source:'tree'} ] };
    APP._cwOpts = { count: 8, src: 'lesson', preferWrong: false };
    openCrossword(0, 0); true;`);
  // Read state defensively so a regression fails as a NAMED assertion rather than as a TypeError
  // thrown inside the sandbox — the latter tells whoever hits it far less.
  const hl = C.run(`(function(){
    const S = APP._cw, e = S.grid.entries[0], k = e.row + ',' + e.col;
    cwFocus(k);
    const cell = document.getElementById('cw-' + k);
    const active = S.active ? [...S.active] : null;
    const other = active ? [...S.owner.keys()].find(x => !(S.owner.get(x) || []).some(ei => S.active.has(ei))) : null;
    return { cur: S.cur || null, active, curBg: cell.style.background,
             otherBg: other ? document.getElementById('cw-' + other).style.background : null };
  })()`);
  assert.ok(hl.cur, 'the focused cell is tracked (cwFocus records the cursor)');
  assert.ok(hl.active, 'cwFocus computes the active entry set');
  assert.ok([...hl.active].length >= 1, 'at least one entry is active under the cursor');
  assert.notStrictEqual(hl.curBg, 'var(--white)', 'the cursor cell is tinted');
  if (hl.otherBg !== null)
    assert.strictEqual(hl.otherBg, 'var(--white)', 'a cell outside the active entries is not tinted');

  // A verdict must win over the highlight: a wrong letter stays red under the cursor.
  const verdict = C.run(`(function(){
    const S = APP._cw, e = S.grid.entries[0], k = e.row + ',' + e.col;
    S.mark[k] = 'bad'; _paintCell(k);
    return document.getElementById('cw-' + k).style.background;
  })()`);
  assert.strictEqual(verdict, '#ffe3e3', 'a wrong letter stays red even under the cursor highlight');

  // ── v71_j: the clue bar keeps a fixed footprint so the grid never jumps ───
  // User-reported: moving on and off a square shared by an across and a down word changed the bar
  // from hidden→1 line→2 lines, shifting the whole grid twice. The bar must now stay in the layout
  // at a constant height in ALL three states.
  {
    const bar = () => C.run(`(function(){
      const n = document.getElementById('cw-clue-now');
      return { display: n.style.display, minHeight: n.style.minHeight,
               lines: (n.innerHTML.match(/<div/g) || []).length,
               empty: /crossword\\.pick_cell|Pick a square/.test(n.innerHTML) };})()`);
    // (a) a square owned by ONE entry
    const single = C.run(`(function(){
      const S = APP._cw;
      const k = [...S.owner.keys()].find(x => (S.owner.get(x) || []).length === 1);
      if (k) cwFocus(k); return k || null; })()`);
    // (b) a shared square (across + down) — the case that used to add a second line
    const shared = C.run(`(function(){
      const S = APP._cw;
      const k = [...S.owner.keys()].find(x => (S.owner.get(x) || []).length >= 2);
      if (k) cwFocus(k); return k || null; })()`);
    const atShared = shared ? bar() : null;
    if (single) { C.run(`cwFocus(${JSON.stringify(single)});`); }
    const atSingle = single ? bar() : null;

    // The reserved height lives in the markup's inline style, which the stub DOM does not parse
    // back onto element.style — so the height itself is asserted at the source, while the
    // never-hidden behaviour (the part that actually moved the grid) is asserted live.
    assert.ok(/id="cw-clue-now"[^>]*min-height:[\d.]+em/.test(ROOT_HTML),
      'the clue bar reserves a fixed min-height in the markup');
    assert.ok(!/id="cw-clue-now"[^>]*display:none/.test(ROOT_HTML),
      'and no longer starts hidden');
    [['single-owner square', atSingle], ['shared square', atShared]].forEach(([label, st]) => {
      if (!st) return;
      assert.notStrictEqual(st.display, 'none', `${label}: the clue bar stays in the layout`);
    });
    if (atSingle && atShared) {
      assert.ok(atShared.lines >= atSingle.lines,
        'a shared square shows at least as many clue lines (both fit the reserved height)');
    }
    // (c) no active entry at all — an empty state, still not hidden
    C.run(`(function(){ const S = APP._cw; S.cur = null; _cwHighlight(); })();`);
    const atNone = bar();
    assert.notStrictEqual(atNone.display, 'none', 'with no square selected the bar is still in the layout');
    assert.ok(atNone.empty, 'and shows a placeholder rather than collapsing');
    const reserved = (ROOT_HTML.match(/id="cw-clue-now"[^>]*min-height:([\d.]+em)/) || [])[1];
    console.log(`  crossword clue bar: reserves ${reserved}, never hidden (single/shared/none)`);
  }
  C.run(`closeCrossword();`);
}
console.log('  repeat on finished lessons + crossword cursor highlight: OK');

{
  // ── v70_o: user-reported crossword UX ────────────────────────────────────
  seed();
  C.run(`
    APP.lessonData.lessons[0] = { id:'cw-ux', type:'standard', vocab:[
      {target:'HAUS', source:'house'}, {target:'HUND', source:'dog'},
      {target:'SONNE', source:'sun'},  {target:'NACHT', source:'night'},
      {target:'STERN', source:'star'}, {target:'BAUM', source:'tree'} ] };
    APP._cwOpts = { count: 8, src: 'lesson', preferWrong: false };
    openCrossword(0, 0); true;`);

  // The clue being answered is shown above the grid, not only highlighted in the list.
  C.run(`(function(){ const S = APP._cw, e = S.grid.entries[0]; cwFocus(e.row + ',' + e.col); return 1; })()`);
  const body = C.document.getElementById('cw-body').innerHTML;
  assert.ok(/cw-clue-now/.test(body), 'the active clue container is rendered above the grid');
  const nowEl = C.document.getElementById('cw-clue-now');
  assert.notStrictEqual(nowEl.style.display, 'none', 'and it is shown once the cursor is in an entry');
  assert.ok(/<b>/.test(nowEl.innerHTML), 'carrying the clue for the entry under the cursor');

  // Typing must step PAST letters a crossing word already supplied.
  const skipped = C.run(`(function(){
    const S = APP._cw, e = S.grid.entries[0];
    const k0 = e.row + ',' + e.col;
    const k1 = (e.row + (e.dir==='down'?1:0)) + ',' + (e.col + (e.dir==='across'?1:0));
    const k2 = (e.row + (e.dir==='down'?2:0)) + ',' + (e.col + (e.dir==='across'?2:0));
    if (!S.owner.has(k2)) return { skip:'n/a' };
    S.typed[k1] = 'X';
    S.cur = k0; S.dir = e.dir;
    document.getElementById('cw-' + k0).value = e.answer[0];
    cwInput(k0);
    return { skip: S.cur, k2: k2 };
  })()`);
  if (skipped.skip !== 'n/a')
    assert.strictEqual(skipped.skip, skipped.k2,
      'the cursor skips a cell already filled by a crossing word');

  // Solving everything turns the green Check into Done, which closes.
  const done = C.run(`(function(){
    openCrossword(0, 0);
    const S = APP._cw;
    for (const [k, letter] of S.sol) document.getElementById('cw-' + k).value = letter;
    checkCrossword();
    const btn = document.getElementById('cw-check-btn');
    return { allDone: Object.keys(S.done).length === S.grid.entries.length,
             title: btn.title, isClose: btn.onclick === closeCrossword };
  })()`);
  assert.strictEqual(done.allDone, true, 'every entry solved');
  assert.strictEqual(done.isClose, true, 'the primary button becomes Done and closes the puzzle');
  assert.ok(done.title, 'and keeps a tooltip');

  // Reopening resets it — a stale Done would close a fresh puzzle instantly.
  assert.strictEqual(C.run(`(function(){
    openCrossword(0, 1);
    return document.getElementById('cw-check-btn').onclick === checkCrossword;
  })()`), true, 'a fresh puzzle resets the button to Check');

  // Mobile layout is CSS-only, so a stub DOM cannot observe it. Pin the specific regression
  // instead: `justify-content:center` on the modal pushed content wider than the viewport off BOTH
  // sides, leaving part of the grid unreachable on a phone. Centring is done with margin:auto now.
  {
    const modal = ROOT_HTML.match(/<div id="cw-modal"[^>]*>/);
    assert.ok(modal, 'the crossword modal exists');
    assert.ok(!/justify-content:center/.test(modal[0]),
      'the modal does not centre with justify-content (that clips wide grids off-screen on mobile)');
    assert.ok(/overflow:auto/.test(modal[0]), 'and it scrolls rather than clipping');
  }
  shouldNotThrow('closeCrossword scrolls back', `closeCrossword();`);
  console.log('  v70_o: active clue, skip-filled advance, Done button, reset on reopen: OK');
}


{
  // ── v70_m: synonym context is trimmed to the sentence holding the word ───
  const long = 'Oggi il programma di ricerca è più pluralista. La selezione naturale agisce sui '
             + 'fenotipi. Le mutazioni sono soltanto una delle sorgenti di variazione.';
  assert.strictEqual(C.run(`_synContext(${JSON.stringify(long)}, 'selezione')`),
    'La selezione naturale agisce sui fenotipi.',
    'the context is the one sentence containing the base word');
  assert.strictEqual(C.run(`_synContext(${JSON.stringify(long)}, 'mutazioni')`),
    'Le mutazioni sono soltanto una delle sorgenti di variazione.',
    'and it follows the word, not a fixed position');
  // No match: the first sentence beats an arbitrary paragraph.
  assert.strictEqual(C.run(`_synContext(${JSON.stringify(long)}, 'inesistente')`),
    'Oggi il programma di ricerca è più pluralista.', 'falls back to the first sentence');
  // A single sentence is returned whole, not re-cut.
  assert.strictEqual(C.run(`_synContext('Le previsioni sono buone.', 'previsioni')`),
    'Le previsioni sono buone.', 'a single sentence passes through');
  assert.strictEqual(C.run(`_synContext('', 'x')`), '', 'empty context stays empty');
  assert.strictEqual(C.run(`_synContext(null, null)`), '', 'null is handled');
  // The stored lesson must NOT be rewritten — trimming is a render-time decision.
  const rendered = C.run(`(function(){
    const ex = { type:'syn_select', mode:'synonyms', base:'selezione', gloss:'g',
                 sentence:${JSON.stringify(long)}, choices:['a','b'], correct:['a'] };
    const html = tSynSelect(ex);
    return { html: String(html), stored: ex.sentence };
  })()`);
  // The RENDER must use the trimmed context — testing _synContext alone would pass even if
  // tSynSelect still printed the whole paragraph.
  assert.ok(/La selezione naturale agisce sui fenotipi\./.test(rendered.html.replace(/<[^>]*>/g, '')),
    'the rendered card shows the trimmed sentence');
  assert.ok(!/programma di ricerca/.test(rendered.html.replace(/<[^>]*>/g, '')),
    'and not the rest of the paragraph');
  assert.strictEqual(rendered.stored, long, 'rendering does not mutate the stored context');
  console.log('  synonym context trimmed at render, stored data untouched: OK');

  // ── v70_n: a single ENORMOUS sentence must also be clamped ───────────────
  // v70_m trimmed to the sentence containing the word — which changed nothing for the ten worst
  // contexts in the corpus, because each is ONE sentence: 135-word Italian academic prose, and
  // Arabic passages that use ، ؛ : rather than a full stop at all. Sentence splitting cannot help
  // there; the window around the word is what does.
  {
    const huge = 'Oggi il programma di ricerca evoluzionistico è più pluralista, perché prevede una '
      + 'molteplicità di fattori e di fenomeni, le sorgenti di variazione non sono soltanto le '
      + 'mutazioni genetiche, ma anche quelle epigenetiche e quelle dovute al trasferimento '
      + 'genico orizzontale, mentre la selezione naturale classica si integra alla selezione '
      + 'sessuale e alla selezione di gruppo, con esiti che restano oggetto di discussione';
    assert.ok(huge.split(/\s+/).length > 50, 'the fixture really is one long sentence');
    const out = C.run(`_synContext(${JSON.stringify(huge)}, 'selezione')`);
    const n = out.split(/\s+/).filter(Boolean).length;
    assert.ok(n <= 30, `a huge single sentence is clamped (got ${n} words)`);
    assert.ok(/selezione/.test(out), 'and the clamped window still contains the word');
    assert.ok(/…/.test(out), 'elision is marked so the learner knows it is an excerpt');

    // Arabic: no full stops at all, so sentence splitting alone would return the whole passage.
    const ar = 'وقد يقال الزم ذا العقل وذا الكرم، واسترسل إليهما، وإياك ومفارقتهما؛ واصحب الصاحب '
      + 'إذا كان عاقلاً كريماً أو عاقلاً غير كريمٍ، فالعاقل الكريم كاملٌ، والعاقل غير الكريم أصحبه، '
      + 'وإن كان غير محمود الخليقة، وأحذر من سوء أخلاقه وانتفع بعقله، والكريم غير العاقل أصحبه';
    const arOut = C.run(`_synContext(${JSON.stringify(ar)}, 'العقل')`);
    assert.ok(arOut.split(/\s+/).filter(Boolean).length <= 30,
      'Arabic prose without full stops is clamped too');
    assert.ok(/العقل/.test(arOut), 'and keeps the word it is illustrating');

    // A short context is returned untouched — no stray ellipses on normal cards.
    const shortCtx = C.run(`_synContext('Le previsioni sono buone.', 'previsioni')`);
    assert.ok(!/…/.test(shortCtx), 'a short context gets no elision marks');
    console.log(`  long single sentences clamped (it + ar), short ones untouched: OK`);
  }

}



// ── 12. (was: completion-card storyboard framing, v71_k) ─────────────────────
// PLAN §C0.4 (user ruling, v81_q): `_renderCompStoryboard`, the function this section drove
// directly, is DELETED — a caller search found none anywhere (the card slot has held the chapter
// icon row since v80_z, and the storyline page embeds the raw storyboard SVG directly, unframed,
// never through this renderer). See INTERNALS.md §6b and roadmap_v81.md's v81_q entry.

// ── 13. Card layout: header bar, row order, pass mark (v71_m) ────────────────
// The card is meant to read as another view of the STORYLINE PAGE. Asserted on the rendered card
// and on the markup order, because "the same header, then the board, then the chapter bars, then
// the verdict" is a claim about sequence that no per-element check would catch.
{
  // `base` is block-scoped to the showComplete section above; this section needs its own.
  // A stray auto-advance timer scheduled by an earlier section can fire mid-run and call renderEx;
  // with an EMPTY exercise list that indexes undefined and takes the whole file down. One dummy
  // exercise makes a late renderEx harmless without changing what this section asserts.
  const base13 = `APP.cur = { lessonIdx: 0, cur: 0, correct: 3, total: 4,
    exercises: [{ type:'mcq_source_target', source:'dog', target:'Hund', correct:'Hund', choices:['Hund','Katze'] }],
    mistakes: 1, hearts: 3, streak: 2, bestStreak: 2 };`;
  seed();
  C.run(`(() => {
    const tp = APP.lessonData.topic;
    APP.savedList = [{ id: 'ha', topic: tp, lessons: APP.lessonData.lessons },
                     { id: 'hb', topic: tp + '-2', lessons: [{ id: 'z', type: 'vocab' }], lessonCount: 1 }];
    APP.storylines = [{ id: 'slH', title: 'Header Story', icon: '📘', chapters: ['ha', 'hb'] }];
    APP._slScreen = null;
    APP.progress.completed[tp] = {};
    (APP.lessonData.lessons || []).forEach(L => { if (L && L.id) APP.progress.completed[tp][L.id] = { correct: 3, total: 4 }; });
  })()`, 'hdr-state');
  C.run(base13 + 'showComplete(true);' + ` APP.cur.exercises=[{ type:'mcq_source_target', source:'dog', target:'Hund', correct:'Hund', choices:['Hund','Katze'] }]; APP.cur.cur=0;`, 'hdr-card');

  // The header carries the storyline progress bar, filled by the shared helper.
  const bar = C.document.getElementById('comp-hdr-prog-bar');
  const txt = C.document.getElementById('comp-hdr-prog-txt');
  assert.ok(/^\d+%$/.test(bar.style.width || ''), 'the header progress bar is filled with a percentage');
  // ⚠️ RE-ANCHORED at v81_g (rule 29: when a pin breaks, ask whether the CLAIM changed or only the
  // MECHANISM). This asserted `!== '0%'` — "reflects the work already done, not a flat zero" — which
  // was true only because `pct` counted UNLOCKED chapters, so the bar was non-zero on any deck
  // whether or not a chapter had been finished. `v81_g` made the bar mean COMPLETION (user ruling),
  // and this fixture flags lesson progress WITHOUT seeding the solved store, so `chapterComplete` —
  // the coverage-aware rule — correctly reports nothing finished. A flat zero is now the honest
  // answer here, and the old assertion was pinning the defect.
  //
  // The CLAIM this section makes is that the card is another view of the STORYLINE PAGE, so that is
  // what is asserted: the header bar carries exactly what the shared helper computes. It cannot
  // drift from the storyline screen, and it cannot be a hardcoded zero either.
  const _shared = C.run(`(function(){
    var m = {}; (APP.savedList||[]).forEach(function(t){ if (t && t.id) m[t.id] = t; });
    var sl = (APP.storylines||[])[0] || { chapters: [] };
    return _slProgressStats(sl.chapters || [], m).pct;
  })()`);
  assert.strictEqual(bar.style.width, _shared + '%',
    'the header bar carries exactly the shared helper\'s percentage — the card is another view of ' +
    'the storyline page, not a second opinion');
  assert.ok(/\d+\/\d+/.test(txt.textContent || ''), 'with the same done/total label as the storyline page');

  // A solo chapter has no storyline to be a fraction of — the bar hides rather than showing 0%.
  seed();
  C.run(`APP.savedList = []; APP.storylines = []; APP._slScreen = null;`, 'solo-state');
  C.run(base13 + 'showComplete(true);' + ` APP.cur.exercises=[{ type:'mcq_source_target', source:'dog', target:'Hund', correct:'Hund', choices:['Hund','Katze'] }]; APP.cur.cur=0;`, 'solo-card');
  assert.strictEqual(C.document.getElementById('comp-hdr-prog-txt').style.display, 'none',
    'a chapter with no storyline hides the progress label instead of claiming 0%');

  // Row order, read off the markup. v77_l (roadmap §0d): THE STORY TEXT IS THE FOCUS OF ATTENTION,
  // so the card now runs header → verdict → THE STORY → its words → storyboard → bars → icons →
  // actions. The machinery that used to sit above the text is all below it.
  //
  // This is the claim §0d exists for, so it is asserted as an order rather than as "the story is
  // present somewhere": a later edit that quietly floats the bars back above the text is exactly
  // the regression worth catching, and only order catches it.
  // v77_m (user): the card mirrors the STORYLINE PAGE — title+bar, storyboard, chapter-wise bars,
  // then the story and its vocabulary, then the icons and buttons — so moving between the two
  // screens jumps in neither width nor row order. §0d's principle is unchanged and is asserted
  // separately below: the story still precedes the icons and the action row.
  // v77_n (user): the verdict line moved to the BOTTOM, below the play buttons — it is a verdict on
  // what just happened, not a heading for what follows, and putting it first pushed the storyboard
  // and the bars down so the card no longer opened the way the storyline page does.
  // v80_y (user): the progress BARS moved to the BOTTOM, below the play buttons. Under TRACK T the
  // STORY is the progress display and leads the card; the bars are the numeric backup and no longer
  // compete with it for the top. `comp-progress` therefore sits after `comp-lessons` now, not before
  // `comp-story-panel`. The §0d principle this row order encodes is UNCHANGED and still asserted
  // below: the story precedes the icons and the action row.
  // v80_z: `comp-storyboard` now holds the CHAPTER ICON row and moved down with it — below the
  // story and vocabulary, just above the lesson-type buttons. The id is historical (renaming it
  // would touch 82 client and 12 test references); what it holds changed, and so did its place.
  // v81_b (user): the progress bars moved below the ACTION row too, so the chapter-icon,
  // lesson-icon and play-button rows are contiguous — the bars are the numeric footnote and sit
  // last. The §0d principle is unchanged and still asserted below.
  // user (progress-card redesign): SUPERSEDES the single tail-to-head chain this used to assert.
  // `comp-storyboard`/`comp-lessons`/`comp-actions`/`comp-progress` are no longer part of the
  // scrolling page at all — they moved into `#comp-nav-modal`, a popup reached via the ☰ button in
  // the story panel's own header row (`_syncCompHdrNav`'s comment explains the duplicated
  // back/next pair). Asserting their position relative to `comp-title` is no longer a meaningful
  // claim: the two are never on screen "at the same time" the way rows in one scrolling page are.
  // Split in two: the MAIN page's own order (still "the story leads, the verdict is last" — §0d's
  // principle, now expressed over a shorter page), and the popup's OWN internal order (unchanged
  // from before the redesign, just relocated as a whole). §0d's load-bearing half — the story
  // precedes the actions — still holds in absolute source position and is asserted on its own,
  // exactly as before.
  const MAIN_ROWS = ['comp-hdr', 'comp-story-panel', 'comp-vocab', 'comp-title'];
  const mainOrder = MAIN_ROWS.map(id => ROOT_HTML.indexOf('id="' + id + '"'));
  mainOrder.forEach((at, i) => assert.ok(at > 0, `${MAIN_ROWS[i]} exists`));
  for (let i = 1; i < mainOrder.length; i++) {
    assert.ok(mainOrder[i] > mainOrder[i - 1],
      `the story leads the scrolling page: ${MAIN_ROWS[i]} must come after ${MAIN_ROWS[i - 1]}`);
  }
  const POPUP_ROWS = ['comp-storyboard', 'comp-lessons', 'comp-actions', 'comp-progress'];
  const popupOrder = POPUP_ROWS.map(id => ROOT_HTML.indexOf('id="' + id + '"'));
  popupOrder.forEach((at, i) => assert.ok(at > 0, `${POPUP_ROWS[i]} exists`));
  for (let i = 1; i < popupOrder.length; i++) {
    assert.ok(popupOrder[i] > popupOrder[i - 1],
      `inside the nav popup: ${POPUP_ROWS[i]} must come after ${POPUP_ROWS[i - 1]}`);
  }
  // The load-bearing half, stated on its own so a failure names the principle rather than a pair.
  assert.ok(ROOT_HTML.indexOf('id="comp-story-panel"') < ROOT_HTML.indexOf('id="comp-actions"'),
    'the story text comes BEFORE the action buttons (§0d) — still true with the actions in a popup');
  // user (progress-card redesign): SUPERSEDES this v77_n comparison specifically. `comp-actions`
  // now lives inside the popup, which the MAIN_ROWS chain above already established comes AFTER
  // `comp-title` in source position — so this line's old claim ("title after actions") is now
  // backwards by construction, not by regression: title is the last row of the scrolling PAGE,
  // popup content is a separate overlay entirely. MAIN_ROWS already covers "title is last on the
  // page an unopened card shows"; nothing here needs comparing title against popup-only ids anymore.
  // The card screens must STRETCH their children, or the header renders as a narrow pill instead of
  // the storyline page's full-width bar however faithfully its markup is copied (v77_n).
  assert.ok(/\.card-screen\{[^}]*align-items:stretch/.test(ROOT_HTML),
    'card screens stretch their children so the header spans the column');
  assert.ok(ROOT_HTML.indexOf('id="comp-story-panel"') < ROOT_HTML.indexOf('id="comp-lessons"'),
    'the story text comes BEFORE the lesson icons (§0d)');

  // The storyline fraction appears ONCE: in the header, not again in the body.
  const body = C.document.getElementById('comp-progress').innerHTML || '';
  assert.ok(!new RegExp(UI.en['complete.story_progress'].split(' ')[0]).test(body)
            || !/Header Story/.test(body),
    'the along-the-storyline row is not repeated in the card body');
}
  // v71_p: the card must be the same COLUMN as the storyline page, not merely carry the same
  // header. Asserted on the CSS numbers because the symptom (a storyboard that renders smaller
  // than the identical board on the storyline page) is a rendering effect no headless check sees.
  //
  // v77_k widened this from the completion card to the WHOLE walk. The cap moved off
  // `#complete-screen` onto a shared `.card-screen` class, and the four pages added in
  // v77_f..v77_j had no width rule at all — so entering a lesson jumped the column width and the
  // title line moved. The claim is no longer "the result card matches" but "EVERY page of the walk
  // matches", which is why this asserts the class exists, resolves to the storyline's width, and
  // is actually worn by all five screens. A page that forgets the class is the regression.
  {
    const grab = (sel) => (ROOT_HTML.match(new RegExp(sel.replace(/[.#]/g, '\\$&') + '\\{([^}]*)\\}')) || [])[1] || '';
    const sl = grab('.sl-screen'), card = grab('.card-screen');
    const width = (css) => (css.match(/max-width:(\d+)px/) || [])[1];
    assert.ok(width(sl), 'the storyline page declares a max-width');
    assert.strictEqual(width(card), width(sl),
      'every page of the progress-card walk shares the storyline page\'s column width');
    // v80_e: 'unlocked-screen' is DELETED — the next-chapter-unlocked card was merged into the
    // entry card ('summary-screen'), which now serves every chapter. Four pages, not five.
    const CARD_SCREENS = ['complete-screen', 'summary-screen',
                          'unlockstory-screen', 'finished-screen'];
    assert.ok(!/<div id="unlocked-screen"/.test(ROOT_HTML),
      'the merged-away next-chapter-unlocked card has not come back under its old id');
    for (const id of CARD_SCREENS) {
      const tag = (ROOT_HTML.match(new RegExp('<div id="' + id + '"[^>]*>')) || [])[0] || '';
      assert.ok(tag, `${id} exists in the markup`);
      assert.ok(/class="[^"]*\bcard-screen\b/.test(tag),
        `${id} wears .card-screen — no width jump when entering or leaving it`);
    }
    // v77_q (user): EVERY progress card carries the SAME header as the storyline page — title row,
    // storyline progress bar, fraction — and a storyboard directly under it. Four of the five had
    // only the title row, so the header changed shape as the learner moved through the walk. The
    // parts are asserted per card because a missing bar is invisible otherwise: the card still
    // renders, it just quietly stops matching the page.
    // v80_e: 'unl' is gone — that card was merged into 'sum', which now starts every chapter.
    for (const pre of ['comp', 'sum', 'us', 'fin']) {
      for (const part of ['-hdr', '-hdr-title', '-hdr-home', '-hdr-prog-bar', '-hdr-prog-txt', '-storyboard']) {
        assert.ok(ROOT_HTML.includes('id="' + pre + part + '"'),
          `${pre}${part} exists — every card header is the storyline page's header`);
      }
      // The header sits ABOVE the storyboard on every card, as on the storyline page.
      assert.ok(ROOT_HTML.indexOf('id="' + pre + '-hdr"') < ROOT_HTML.indexOf('id="' + pre + '-storyboard"'),
        `${pre}: the storyboard sits directly under the header`);
    }
    // One renderer fills all four, so they cannot drift apart again.
    assert.ok(/function _cardHeader\(/.test(ROOT_HTML),
      'a single _cardHeader fills every card header');

    // Same inset as the storyline body, or the 540px column would hold a differently-indented
    // title line and the jump would simply move inward.
    const inset = (css) => (css.match(/padding:([^;]*)/) || [])[1];
    assert.strictEqual(inset(grab('.comp-body')), inset(grab('.sl-screen-body')),
      'and the same inner padding, so the title line lands in the same place');
    assert.ok(/padding:0 0 40px/.test(card),
      'and the cards have no outer horizontal padding, so their headers are full-bleed like the page');
    assert.ok(/\.comp-body\{padding:12px 16px 0\}/.test(ROOT_HTML),
      'the inset lives on a body that mirrors .sl-screen-body');
    assert.ok(ROOT_HTML.indexOf('class="comp-body"') > ROOT_HTML.indexOf('id="comp-hdr"'),
      'the header sits OUTSIDE that body — it is full-bleed on the storyline page too');
  }
console.log('  completion card: storyline header bar, row order, no duplicated story row: OK');

console.log('smoke-render: ALL PASSED');
