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
  shouldNotThrow('showComplete (learner, crossword available)', `showComplete();`);
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
    const nx = C.document.getElementById('comp-next');
    assert.strictEqual(nx.textContent, '↻', 'below the mark with nothing left to play, the primary action is REPEAT');
    assert.ok(nx.title && nx.title !== '→', 'the repeat button keeps a tooltip');
    // The crossword is one of the ways up and must be offered here.
    assert.strictEqual(C.document.getElementById('comp-crossword').style.display, '',
      'the crossword is offered as a route to the pass mark');
    // And the drill must never appear both as the primary action and as its own button.
    const db = C.document.getElementById('comp-drill');
    if (nx.textContent === '🎯') assert.strictEqual(db.style.display, 'none', 'the drill is not offered twice');
  }

  // The no-duplicate rule, tested directly rather than left to a scenario that may not arise:
  // whenever the primary action IS the drill, the standalone drill button must be hidden.
  {
    const dup = C.run(`(function(){
      const src = document.getElementById('comp-next');
      return /!_nextIsDrill && \\(_teacher \\|\\| _belowThreshold\\)/.test(String(showComplete));
    })()`);
    assert.strictEqual(dup, true, 'drill visibility is gated on the primary action not already being the drill');
  }

  // And it hides when the lesson cannot make a puzzle, rather than opening an empty grid.
  seed();
  C.run(`
    APP.lessonData.lessons[0] = { id:'cw-none', type:'standard', vocab:[{target:'你好', source:'hi'}] };
    APP._teacherMode = false;
    APP.cur = { lessonIdx:0, correct:1, total:1, mistakes:0, bestStreak:1, flagCount:0, exercises:[] };
    true;`);
  shouldNotThrow('showComplete (no puzzle possible)', `showComplete();`);
  assert.strictEqual(C.document.getElementById('comp-crossword').style.display, 'none',
    'hidden when the lesson has no crossable words');
}
console.log('  crossword: availability, render, solve+credit, reject, close, learner entry: OK');

console.log('smoke-render: ALL PASSED');
