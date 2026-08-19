// unit-tap-word.test.js
// v80_t — TRACK T step 3: tapping a word in the story enters the LESSON FLOW.
//
// `§T5.2`, ruled: *"tapping a word should enter the usual lesson flow, including questions that are
// not reachable by tapping, and we keep the play buttons."* So this is a way IN to the existing
// runner, not a parallel one-question mode — which is why there is no new round machinery. `tapWord`
// resolves the word to a (lesson, question), calls `startLesson`, and moves `C.cur` to that question.
// `§0h` (`v80_p`) is what makes the second half safe: entering at question N is an ordinary position
// in a run, not a special state.
//
// T0 also asks that revisiting a word PREFER questions not yet solved. §4 pins that.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons }));

function open(topic, solved) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:1 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP.progress.solved[${JSON.stringify(topic.topic)}] = ${JSON.stringify(solved || {})};
    APP._teacherMode = false; APP.muted = true;
    APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    show = function(id){ APP._shown = id; };
    speak = function(){}; saveProg = function(){};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    true;`, 'open');
  return C;
}

// The real questions a word reaches, unioned over several builds. `buildExercises` is not
// deterministic in CONTENT — the set of questions differs run to run — so a single build both
// understates the total and makes any fixture chosen from it unstable. Every earlier version of this
// file failed intermittently for that reason, always on correct product behaviour.
function observedKeys(topic, word, builds) {
  const seen = new Set();
  for (let i = 0; i < (builds || 4); i++) {
    const C = open(topic, {});
    if (C.run(`tapWord(${JSON.stringify(word)})`) !== true) continue;
    JSON.parse(C.run(`(function(){
      var d = APP.lessonData, C2 = APP.cur, want = _hlKey(stripFuri(${JSON.stringify(word)}));
      var lid = (d.lessons[C2.lessonIdx]||{}).id;
      var keys = {}; _wordQuestions(d, ${JSON.stringify(word)}).forEach(function(c){ keys[c.key]=1; });
      var out = [];
      (C2.exercises||[]).forEach(function(ex){
        if (!ex) return;
        var k = null; try { k = qid(ex, lid); } catch(e) {}
        if (!k) return;
        var byText = [ex.target, ex.correct, ex.base, ex.infinitive].filter(Boolean)
          .some(function(x){ return _hlKey(stripFuri(String(x))) === want; });
        if (keys[k] || byText) out.push(k);
      });
      return JSON.stringify(out);
    })()`)).forEach(k => seen.add(k));
  }
  return [...seen];
}

// A chapter whose story actually contains a taught word — otherwise nothing is tappable and the
// fixture proves nothing. Swept, not pinned.
//
// ⚠️ It prefers a word with SEVERAL questions. The first version took the first word that worked and
// landed on one with a single question, so §4 — T0's "prefer questions not yet solved", the whole
// point of the preference rule — printed "case not exercised" and the rule shipped unguarded. A
// fixture that skips the hardest section is worse than no fixture.
let FIX = null;
for (const t of store.topics) {
  if (!(t.story || '').trim() || !(t.lessons || []).length) continue;
  const C = open(t, {});
  const w = C.run(`(function(){
    var d = APP.lessonData, low = String(d.story||'').toLowerCase();
    var all = _storyWordSources(d).map(function(s){return s.word;})
      .concat((d.lessons||[]).flatMap(function(L){ return (L && L.vocab || []).map(function(v){ return v && v.target; }); }))
      .filter(Boolean);
    for (var i=0;i<all.length;i++){
      if (low.indexOf(String(all[i]).toLowerCase()) >= 0 && _wordQuestions(d, all[i]).length) return all[i];
    }
    return '';
  })()`);
  if (!w) continue;
  const keys = observedKeys(t, w, 4);
  if (keys.length >= 2) { FIX = { t, w, n: keys.length, keys }; break; }   // ideal: exercises §4
  if (!FIX && keys.length >= 1) FIX = { t, w, n: keys.length, keys };      // fallback
}
assert.ok(FIX, 'the corpus has a chapter whose story contains a taught word with questions');
console.log(`  fixture: "${FIX.t.topic}" — tapping "${FIX.w}" (${FIX.n} question(s))`);
assert.ok(FIX.n >= 1, 'the fixture word has at least one real question in a built run');

// ── 1. A tap starts a real run, positioned on a question about that word ──
// Accumulated over several taps rather than asserted on one. The contract is conditional — land on
// the word's question WHEN the run contains one, else enter at the top rather than do nothing — and
// `buildExercises` varies its content run to run, so a single tap can legitimately produce a run
// with none. Asserting on one run made this fail on correct behaviour.
{
  const C0 = open(FIX.t, {});
  assert.strictEqual(C0.run(`(APP.cur && APP.cur.exercises || []).length`), 0,
    'non-vaciuty: no run is in progress before a tap');

  let started = 0, hadOne = 0;
  for (let i = 0; i < 8; i++) {
    const C = open(FIX.t, {});
    if (C.run(`tapWord(${JSON.stringify(FIX.w)})`) !== true) continue;
    started++;
    assert.ok(C.run(`APP.cur && (APP.cur.exercises||[]).length > 0`), 'a real run was built');
    assert.strictEqual(C.run(`APP._shown`), 'lesson-screen', 'and the question screen is showing');
    const r = JSON.parse(C.run(`(function(){
      var d = APP.lessonData, C2 = APP.cur, want = _hlKey(stripFuri(${JSON.stringify(FIX.w)}));
      var lid = (d.lessons[C2.lessonIdx]||{}).id;
      var keys = {}; _wordQuestions(d, ${JSON.stringify(FIX.w)}).forEach(function(c){ keys[c.key]=1; });
      var isMine = function(ex){
        if (!ex) return false;
        var k = null; try { k = qid(ex, lid); } catch(e) {}
        if (k && keys[k]) return true;
        return [ex.target, ex.correct, ex.base, ex.infinitive].filter(Boolean)
          .some(function(x){ return _hlKey(stripFuri(String(x))) === want; });
      };
      return JSON.stringify({ runHasOne: (C2.exercises||[]).some(isMine),
                              landedIsMine: isMine(C2.exercises[C2.cur]) });
    })()`));
    if (r.runHasOne) {
      hadOne++;
      assert.ok(r.landedIsMine,
        'the run contained a question about the tapped word but the tap did not land on it');
    }
  }
  assert.ok(started > 0, 'non-vacuity: taps started runs');
  assert.ok(hadOne > 0,
    'non-vacuity: at least one run contained a question about the word — otherwise the assertion ' +
    'above never fired and this section proved nothing');
  console.log(`  a tap lands on that word's question (${hadOne}/${started} runs contained one)`);
}

// ── 2. It is the USUAL flow — the whole lesson is there ──────────────────
// §T5.2's point: tapping is a way in, not a one-question mode. The run must contain the lesson's
// other questions too, including ones no word tap could reach.
{
  const C = open(FIX.t, {});
  C.run(`tapWord(${JSON.stringify(FIX.w)}); true;`);
  const n = C.run(`(APP.cur.exercises||[]).length`);
  const li = C.run(`APP.cur.lessonIdx`);
  const full = C.run(`(function(){ var C2=APP.cur; var save=C2.cur;
    startLesson(${'APP.cur.lessonIdx'}); var m=(APP.cur.exercises||[]).length; return m; })()`);
  assert.ok(n > 1, `the run holds the whole lesson, not one question (${n})`);
  assert.strictEqual(n, full, 'and it is exactly the run startLesson would have built anyway');
  assert.ok(li >= 0, 'a real lesson index was chosen');
  console.log(`  the tap enters the usual flow (${n} questions, lesson ${li})`);
}

// ── 3. §0h still applies — back-navigation works from where the tap landed ──
{
  const C = open(FIX.t, {});
  C.run(`tapWord(${JSON.stringify(FIX.w)}); true;`);
  const at = C.run(`APP.cur.cur`);
  if (at > 0) {
    C.run(`qPrev(); true;`);
    assert.strictEqual(C.run(`APP.cur.cur`), at - 1, 'Back works from a tapped entry point');
    assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(_cardErrors())`)), [],
      'and renders the earlier question cleanly');
  }
  assert.strictEqual(C.run(`Array.isArray(APP.cur.ans)`), true,
    'the §0h answer ledger exists on a tap-started run, like any other');
  console.log('  §0h back-navigation works from a tapped entry point');
}

// ── 4. ⚠️ Unsolved questions are PREFERRED — T0 says so explicitly ───────
// Asserted WITHIN each run, which is the only sound way: `buildExercises` is not deterministic in
// CONTENT, not merely in order, so the set of questions about a word differs from one run to the
// next. Two earlier versions of this section assumed otherwise — one marked probe keys solved
// (probes can name questions no run holds), the other required the fixture to yield two real
// questions every time — and both failed intermittently on correct product behaviour.
//
// The invariant that does hold: after a tap, if the run it built contains an unsolved question about
// the word, the one it landed on must not be a solved one.
{
  let taps = 0, withChoice = 0;
  // The solved set comes from the FIXTURE's observed keys, gathered by the same multi-build union
  // the sweep used to choose it — so selection and precondition cannot disagree, which is what made
  // this section flaky before.
  const all = FIX.keys;
  assert.ok(all.length >= 2,
    `the fixture word needs >= 2 distinct real questions to put the preference to a choice (${all.length})`);
  const solved = {};
  all.slice(0, all.length - 1).forEach(k => { solved[k] = 1; });

  for (let i = 0; i < 10; i++) {
    const C = open(FIX.t, solved);
    if (C.run(`tapWord(${JSON.stringify(FIX.w)})`) !== true) continue;
    taps++;
    const r = JSON.parse(C.run(`(function(){
      var d = APP.lessonData, C2 = APP.cur, want = _hlKey(stripFuri(${JSON.stringify(FIX.w)}));
      var lid = (d.lessons[C2.lessonIdx]||{}).id, m = _solvedMap(d.topic) || {};
      var keys = {}; _wordQuestions(d, ${JSON.stringify(FIX.w)}).forEach(function(c){ keys[c.key]=1; });
      var mine = [];
      (C2.exercises||[]).forEach(function(ex, i){
        if (!ex) return;
        var k = null; try { k = qid(ex, lid); } catch(e) {}
        if (!k) return;
        var byText = [ex.target, ex.correct, ex.base, ex.infinitive].filter(Boolean)
          .some(function(x){ return _hlKey(stripFuri(String(x))) === want; });
        if (keys[k] || byText) mine.push({ i: i, k: k, solved: !!m[k] });
      });
      var landedK = null; try { landedK = qid(C2.exercises[C2.cur], lid); } catch(e) {}
      return JSON.stringify({ mine: mine, at: C2.cur, landedSolved: !!(landedK && m[landedK]) });
    })()`));
    const hasUnsolved = r.mine.some(x => !x.solved);
    const hasSolved = r.mine.some(x => x.solved);
    if (hasUnsolved && hasSolved) withChoice++;
    if (hasUnsolved) {
      assert.ok(!r.landedSolved,
        `tap ${i}: landed on a SOLVED question while this run held an unsolved one ` +
        `(${JSON.stringify(r.mine)})`);
    }
  }
  assert.ok(taps > 0, 'non-vacuity: at least one tap started a run');
  assert.ok(withChoice > 0,
    'non-vacuity: at least one run held BOTH a solved and an unsolved question about the word — ' +
    'without that the preference rule was never actually put to a choice');
  console.log(`  unsolved questions are preferred (${taps} taps, ${withChoice} with a real choice)`);
}

// ── 5. An unknown word does nothing, and says so ─────────────────────────
// A tap with no visible effect is the worst outcome; the caller needs to know it can fall back.
{
  const C = open(FIX.t, {});
  assert.strictEqual(C.run(`tapWord('zzzz-not-a-word-in-this-story')`), false,
    'tapping a word with no questions returns false rather than silently doing nothing');
  assert.strictEqual(C.run(`(APP.cur && APP.cur.exercises || []).length`), 0, 'and starts no run');
  console.log('  an unknown word reports failure instead of failing silently');
}

// ── 6. Marks are tappable ONLY on the TRACK T panel ──────────────────────
// The storyline and progress-card callers pass no state map; making their text tappable would offer
// a run there is no lesson context to start.
{
  const C = open(FIX.t, {});
  const plain = C.run(`_highlightVocabHtml('the cat sat', ['cat'], [])`);
  const track = C.run(`_highlightVocabHtml('the cat sat', ['cat'], [], new Map([[_hlKey('cat'),'red']]))`);
  assert.ok(!/wp-tap|onclick/.test(plain), 'the two-shade callers emit inert marks');
  assert.ok(/wp-tap/.test(track) && /tapWord/.test(track), 'the TRACK T panel emits tappable marks');
  console.log('  only the TRACK T panel makes words tappable');
}

// ── What this does NOT establish (rule 34) ───────────────────────────────
// • No click is dispatched through the DOM; `tapWord` is called directly. The onclick attribute is
//   asserted to exist (§6) but not exercised — a device pass is owed.
// • T0's "after answering, the next question is a randomly chosen DIFFERENT word" is NOT built. The
//   run continues in its own order, which is the §T5.2 ruling working as intended; if the user wants
//   the word-hopping behaviour, that is a further change.
// • ⚠️ MUTATION COVERAGE IS UNEVEN, and stating it beats implying otherwise. Disabling the
//   entry-point scan is caught 6/6; dropping the scan's unsolved preference 5/6; dropping the
//   POOL-level unsolved preference only 1/6 — because the scan compensates for a bad pool pick, so
//   the pool's remaining job is choosing WHICH LESSON when a word is taught in several, and this
//   fixture's word is taught in one. That part of the rule is effectively unguarded here.
console.log('unit-tap-word: ALL PASSED');
