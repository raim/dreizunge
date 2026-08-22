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
  let maxPerBuild = 0;         // v81_d: the most questions about the word held by ONE built round
  const perBuild = [];         // v81_e: every build's distinct key set, so CO-OCCURRENCE RATE is
                               // measurable — "it happened once" is not a strong enough precondition
  let sampled = 0;
  for (let i = 0; i < (builds || 4); i++) {
    const C = open(topic, {});
    if (C.run(`tapWord(${JSON.stringify(word)})`) !== true) continue;
    const got = JSON.parse(C.run(`(function(){
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
    })()`));
    const distinct = [...new Set(got)];
    if (distinct.length > maxPerBuild) maxPerBuild = distinct.length;
    perBuild.push(distinct);
    sampled++;
    distinct.forEach(k => seen.add(k));
  }
  // ⚠️ v81_e: pick the pair that co-occurs MOST OFTEN, and report how often.
  //
  // v81_d already required a pair seen together ONCE — and that was still not enough. A pair that
  // co-occurs in 1 build of 8 passes selection and then has to turn up again within §4's sample; at
  // that rate it misses often enough to show up as roughly 1 failure in 20 whole-file runs, which is
  // exactly what was measured. The precondition §4 needs is not "these two can co-occur" but "these
  // two co-occur OFTEN ENOUGH that a bounded sample will see it", so the rate is what gets chosen on.
  let pair = null, pairCo = 0;
  const all = [...seen];
  for (let a = 0; a < all.length; a++) {
    for (let b = a + 1; b < all.length; b++) {
      const co = perBuild.filter(d => d.includes(all[a]) && d.includes(all[b])).length;
      if (co > pairCo) { pairCo = co; pair = [all[a], all[b]]; }
    }
  }
  return { keys: all, maxPerBuild, pair, pairCo, sampled };
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
  // ⚠️ v81_d: the accept test is CO-OCCURRENCE IN ONE BUILD, not the union across builds — this is
  // the SEVENTH flake in this file and the sixth of a kind (the prompt's habit 4: every previous
  // failure was the TEST being wrong about correct behaviour, and so is this one).
  //
  // The union threshold (`keys.length >= 2`) accepted a word whose two questions are never ASKED
  // TOGETHER, because `buildExercises` samples. §4 then marks all-but-one key solved and needs a
  // single run holding a solved AND an unsolved question — impossible for such a word however many
  // taps it takes, so its non-vacuity assertion fired. Measured at 1 failure in 40 runs, and
  // **identically 1 in 40 on the pre-`v81_d` client**, so this is pre-existing and not a symptom of
  // the denominator change. Both failures picked the same weak fixture, "le silence".
  //
  // Selection is also non-deterministic in its own right — the sampled fixture differed run to run
  // ("Stille vor dem Winter" vs "Vittoria Ingannevole") — so the precondition has to be a PROPERTY
  // the chosen fixture is verified to have, not a hope about which chapter the loop reaches.
  // 8 builds rather than 4, because co-occurrence is rarer than presence.
  const obs = observedKeys(t, w, 8);
  const keys = obs.keys;
  const cand = { t, w, n: keys.length, keys, maxPerBuild: obs.maxPerBuild, pair: obs.pair,
                 pairCo: obs.pairCo, sampled: obs.sampled };
  // Keep the BEST fixture seen, not the first acceptable one: selection is itself sampled, so
  // "first past the post" is how a weak fixture kept winning. Stop early only on a strong one.
  if (!FIX || cand.pairCo > FIX.pairCo || (!FIX.keys.length && cand.keys.length)) FIX = cand;
  if (FIX.pairCo >= 4) break;                    // half of 8 builds: strong enough, stop looking
}
assert.ok(FIX, 'the corpus has a chapter whose story contains a taught word with questions');
console.log(`  fixture: "${FIX.t.topic}" — tapping "${FIX.w}" (${FIX.n} question(s), pair co-occurs in ${FIX.pairCo}/${FIX.sampled} builds)`);
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
  // v81_d: the fixture is now chosen for CO-OCCURRENCE (see the sweep), and the solved set is built
  // around the pair actually seen together — marking "all keys but the last" could leave the unsolved
  // key in a question that never shares a round with a solved one, which is how this section flaked.
  const all = FIX.keys;
  assert.ok(all.length >= 2,
    `the fixture word needs >= 2 distinct real questions to put the preference to a choice (${all.length})`);
  // ⚠️ The precondition is a RATE, not a possibility (v81_e). `pairCo/sampled` is how often the two
  // questions were actually asked together during selection; §4 then samples 30 rounds, so the
  // chance of never seeing the choice is about (1 - rate)^30. At the 1-in-8 rate that v81_d's
  // "seen together at least once" rule accepted, that is ~2%, which showed up as roughly 1 failure
  // in 20 whole-file runs. Requiring 2 of 8 puts it near 1e-4, and the sweep now keeps the BEST
  // fixture rather than the first acceptable one.
  assert.ok(FIX.pair && FIX.pairCo >= 2,
    `the fixture word's two questions must co-occur in a REASONABLE SHARE of builds, or a bounded ` +
    `sample will sometimes never present the choice (pairCo=${FIX.pairCo}/${FIX.sampled})`);
  const unsolvedKey = FIX.pair[1];
  const solved = {};
  all.filter(k => k !== unsolvedKey).forEach(k => { solved[k] = 1; });

  // 30 builds, and deliberately NOT stopping early once a choice has been seen: every extra tap is
  // another chance for the preference assertion inside the loop to catch a real violation, and that
  // assertion is the point of the section — the non-vacuity count is only its precondition.
  // `buildExercises` samples, so a fixed 10 was a coin-flip on the weaker fixtures — measured at
  // 1 failure in 40 whole-file runs, on the pre-v81_d client as well as this one.
  for (let i = 0; i < 30; i++) {
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


// ── 7. ⚠️ v81_e / §T7 — THE WIRING, AND THE REPAIR ROUTE ─────────────────
// Two claims §8/§9 of `unit-word-progress` deliberately do NOT make, because assertions on each half
// prove nothing about the join (rule, v71_u):
//   (a) the WRONG-ANSWER PATH in `check()` calls `markWrong` — that file calls it directly;
//   (b) a demoted word is REPAIRABLE BY TAPPING, i.e. the tap prefers the question that demoted it.
// Without (b) the amber is a dead end: every question of the word reads as solved, so the tap would
// pick arbitrarily and the learner could not get back to the one they failed.
{
  // Answer the CURRENT question wrongly through the real `check()`. Returns the qid it was about,
  // or '' when the exercise is not a shape this helper can drive.
  const answerWrong = (C) => C.run(`(function(){
    var Cur = APP.cur, ex = Cur.exercises[Cur.cur], lid = (APP.lessonData.lessons[Cur.lessonIdx]||{}).id;
    var k = null; try { k = qid(ex, lid); } catch(e) { return ''; }
    if (!k) return '';
    var btns = [].slice.call(document.querySelectorAll('.choice'));
    if (btns.length) {
      var pick = btns[0];
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim() !== String(ex.correct)) { pick = btns[i]; break; }
      }
      if (pick.textContent.trim() === String(ex.correct)) return '';   // no wrong option to choose
      pickChoice(btns.indexOf(pick), pick);
      if (!APP.cur.answered) check();
      return APP.cur.answered ? k : '';
    }
    var ti = document.getElementById('type-in');
    if (ti) { ti.value = 'zzz-not-the-answer'; check(); return APP.cur.answered ? k : ''; }
    return '';
  })()`);

  let drove = 0, retapped = 0;
  // ⚠️ ACCUMULATED over builds, not asserted on one. `startLesson` rebuilds a SAMPLED round, so the
  // question just failed is not guaranteed to be in the next one — the re-tap can only be required
  // to find it SOMETIMES (v80_t: buildExercises is non-deterministic in CONTENT).
  for (let attempt = 0; attempt < 14; attempt++) {
    const C = open(FIX.t, {});
    // Solve everything the CHAPTER can ask, not just this word's observed keys — a word is graded
    // through vocab and sentence sources too, so seeding `FIX.keys` alone leaves it short and the
    // "all its other questions are already right" precondition this section needs is not met.
    C.run(`(function(){
      var d = APP.lessonData, m = _solvedMap(d.topic);
      (d.lessons||[]).forEach(function(L,i){
        if (!L || L.id == null) return;
        try { _lessonQidUniverse(i).forEach(function(k){ m[k] = 1; }); } catch(e) {}
        try { _lessonItemUniverse(i).forEach(function(k){ m[k] = 1; }); } catch(e) {}
      });
    })(); true;`, 'solve-all');
    if (C.run(`tapWord(${JSON.stringify(FIX.w)})`) !== true) continue;
    // ⚠️ Land on a question that is one of THIS WORD'S OWN candidates before answering it wrongly.
    // `tapWord` may legitimately land on a question matched to the word by TEXT rather than by key,
    // and the checks below are about a candidate — so answering "whatever came up" made the
    // non-vacuity assertion a coin-flip (measured: it held 3 to 9 times out of 14, and sometimes 0,
    // which surfaced as roughly 1 failure in 10). Same lesson as §4: the precondition has to be a
    // property the run is STEERED to have, not one it is hoped to have.
    const positioned = C.run(`(function(){
      var d = APP.lessonData, Cur = APP.cur, lid = (d.lessons[Cur.lessonIdx]||{}).id;
      var keys = {};
      _wordQuestions(d, ${JSON.stringify(FIX.w)}).forEach(function(c){ keys[c.key] = 1; });
      for (var i = 0; i < (Cur.exercises||[]).length; i++) {
        var k = null; try { k = qid(Cur.exercises[i], lid); } catch(e) {}
        if (k && keys[k]) { Cur.cur = i; return true; }
      }
      return false;
    })()`);
    if (!positioned) continue;            // this build holds none of them — try another
    C.run(`renderEx(); true;`);
    const key = answerWrong(C);
    if (!key) continue;                          // not a drivable shape; another build may be
    drove++;

    // (a) the wiring: `check()` wrote the demotion store.
    assert.strictEqual(C.run(`!!_wrongMap(APP.lessonData.topic)[${JSON.stringify(key)}]`), true,
      'a wrong answer through check() records the question in the demotion store');
    // NOTE: the DEMOTION itself is not asserted here, deliberately. `FIX.keys` are the questions a
    // built round matched to this word by qid OR BY TEXT, which is a broader set than the ones
    // `_wordProgress` GRADES the word on — so "answered a key in FIX.keys wrongly" does not imply
    // "this word must leave green", and asserting it would fail on a correct product. The demotion
    // rule is asserted in `unit-word-progress` §8, on a word chosen for being graded on the key.

    // (b) the repair route, asserted where it is DETERMINISTIC: the failed question re-enters the
    // pool `tapWord` prefers. `_wordQuestions` is the collector that pool is filtered from, so a
    // candidate carrying `solved:true, wrong:true` is precisely "already right once, but needs work
    // again" — the state that makes an amber word repairable.
    //
    // ⚠️ The END-TO-END landing is NOT asserted here, and the reason is measured rather than
    // assumed. `startLesson` rebuilds a SAMPLED round, so a round that holds the failed question
    // ALONGSIDE another question about the same word — the only shape in which the preference is put
    // to a choice — turned up in roughly 1 of 14 attempts. An assertion that rare is a coin-flip, and
    // an earlier version of it passed under BOTH mutations of the rule simply because the failed
    // question often happens to be first in the rebuilt run (v70_f: passing for the wrong reason).
    const cand = JSON.parse(C.run(`JSON.stringify(
      _wordQuestions(APP.lessonData, ${JSON.stringify(FIX.w)})
        .filter(function(c){ return c.key === ${JSON.stringify(key)}; })[0] || null)`));
    if (cand) {
      retapped++;
      assert.strictEqual(cand.wrong, true,
        'the failed question is flagged as needing work again, so it re-enters the pool tapWord prefers');
      assert.strictEqual(cand.solved, true,
        'and it is still SOLVED — §T7 reading 1 does not un-solve anything, it only re-prioritises');
    }
    assert.strictEqual(C.run(`tapWord(${JSON.stringify(FIX.w)})`), true,
      'the word is still tappable after a wrong answer — a word that cannot be re-entered is a dead end');
  }
  assert.ok(drove > 0,
    'non-vacuity: at least one built round offered a question this helper could answer WRONGLY — ' +
    'without that, neither the wiring nor the repair route was exercised');
  assert.ok(retapped > 0,
    'non-vacuity: the failed question was one of the word\'s own candidates, so the flag above was ' +
    'actually checked on something');
  console.log(`  §T7: check() records the wrong answer; it re-enters the tap pool (${retapped}/${drove})`);
}


// ── 8. ⚠️ v81_f — A QUESTION-LESS WORD STILL OPENS ITS LESSON ────────────
// USER RULING: route the tap into the lesson that TEACHES the word (the alternative considered was
// to stop painting such words tappable).
//
// 26.1% of highlighted words (181 of 693) had no question at all — conjugation infinitives and
// word-form distractors reach the story panel through `_storyWordSources` carrying no probes — so
// `tapWord` returned false and the tap did nothing.
{
  // A word the panel marks that has NO question anywhere, whose teaching lesson IS startable.
  const pick = (() => {
    for (const t of store.topics) {
      if (!(t.lessons || []).length || !String(t.story || '').trim()) continue;
      const C = open(t, {});
      const w = C.run(`(function(){
        var d = APP.lessonData, seen = {};
        var marked = _storyExtraWords(d);
        for (var i = 0; i < marked.length; i++) {
          var w = marked[i], k = _hlKey(stripFuri(String(w)));
          if (!k || seen[k]) continue; seen[k] = 1;
          if (_wordQuestions(d, w).length) continue;      // has questions — not this section's case
          if (!_wordLessons(d, w).length) continue;       // taught only by a HIDDEN lesson (see below)
          return w;
        }
        return '';
      })()`);
      if (w) return { t, w };
    }
    return null;
  })();
  // Guard the guard against going vacuous on new data.
  assert.ok(pick, 'the corpus has a marked word with NO question whose teaching lesson is startable');

  const C = open(pick.t, {});
  assert.strictEqual(C.run(`_wordQuestions(APP.lessonData, ${JSON.stringify(pick.w)}).length`), 0,
    'precondition: this word really has no question to offer');
  assert.strictEqual(C.run(`tapWord(${JSON.stringify(pick.w)})`), true,
    'tapping a question-less word STARTS ITS TEACHING LESSON rather than doing nothing');
  assert.strictEqual(C.run(`APP._shown`), 'lesson-screen',
    'and the learner is actually taken to a lesson screen');
  const li = C.run(`APP.cur.lessonIdx`);
  assert.ok(C.run(`_wordLessons(APP.lessonData, ${JSON.stringify(pick.w)})`).includes(li),
    'the lesson opened is one that TEACHES the word, not an arbitrary one');
  console.log(`  a question-less word opens its teaching lesson ("${pick.w}", lesson ${li})`);

  // ── v81_h — AND A HIDDEN LESSON'S WORDS ARE NOT ON THE PANEL AT ALL ────
  // ⚠️ RE-ANCHORED at v81_h, and this time the CLAIM changed, not just the mechanism (rule 29).
  //
  // At `v81_f` this asserted that a MARKED word taught only by a hidden lesson still reports
  // failure — 79 of the 181 dead taps were exactly that. `v81_h` (user ruling) removed the category:
  // `_storyWordSources` no longer walks hidden lessons, so such a word is never marked in the first
  // place. The old assertion could not be repaired by adjusting it — its fixture stopped existing,
  // which is the honest signal that the claim itself moved.
  //
  // The replacement is stronger and states the new rule directly: the panel must not mark a word
  // whose only teaching lesson is hidden, and tapping one must still refuse if it is reached by any
  // other route. Both are asserted, because the first is the ruling and the second is the guard that
  // survives if the highlighting is ever reworked again.
  {
    // Found from the RAW lesson data, deliberately not through `_storyWordSources` — that is the
    // function under test, and searching with it is how the v81_f version of this block disarmed
    // itself under mutation.
    const hid = (() => {
      for (const t of store.topics) {
        if (!(t.lessons || []).some(L => L && L._hidden)) continue;
        const C2 = open(t, {});
        // user-follow-up fix (this session): a vocab TARGET now also matches its own split tokens
        // (_vocabTargetMatchesKey — "die Regierung" reaches a tap on bare "Regierung"), so an OPEN
        // lesson's article+noun vocab entry can legitimately cover a word a hidden lesson ALSO
        // teaches via a different field (.words/.verbs). The picker below must know that too, or it
        // can flag a word as "hidden-only" that a real tap now correctly (and safely) resolves
        // through the open lesson's vocab instead — not a gate failure, a stale fixture (rule 29).
        const w = C2.run(`(function(){
          var d = APP.lessonData;
          var openWords = {}, hidWords = [];
          (d.lessons||[]).forEach(function(L){
            if (!L) return;
            var plain = [], vocabTargets = [];
            ((L.words)||[]).forEach(function(x){ if (x && x.base) plain.push(x.base); });
            ((L.vocab)||[]).forEach(function(v){ if (v && v.target) vocabTargets.push(v.target); });
            ((L.verbs)||[]).forEach(function(v){ if (v && v.infinitive) plain.push(v.infinitive); });
            plain.forEach(function(x){
              var k = _hlKey(stripFuri(String(x)));
              if (!k) return;
              if (L._hidden) hidWords.push([k, x]); else openWords[k] = 1;
            });
            vocabTargets.forEach(function(x){
              var k = _hlKey(stripFuri(String(x)));
              if (!k) return;
              if (L._hidden) { hidWords.push([k, x]); return; }
              openWords[k] = 1;
              // Same split-token equivalence _vocabTargetMatchesKey applies for a real tap.
              String(x).trim().split(/\\s+/).filter(Boolean).forEach(function(t){
                var tk = _hlKey(stripFuri(t));
                if (tk) openWords[tk] = 1;
              });
            });
          });
          for (var i = 0; i < hidWords.length; i++) {
            if (!openWords[hidWords[i][0]]) return hidWords[i][1];
          }
          return '';
        })()`);
        if (w) return { t, w, C: C2 };
      }
      return null;
    })();
    assert.ok(hid, 'the corpus has a word taught ONLY by a hidden lesson — 44 hidden lessons across ' +
      '32 topics at this cut, 26 of them still carrying vocab, so without one this proves nothing');

    const marked = hid.C.run(`(function(){
      var want = _hlKey(stripFuri(${JSON.stringify(hid.w)}));
      return _storyExtraWords(APP.lessonData).some(function(x){ return _hlKey(stripFuri(String(x))) === want; });
    })()`);
    assert.strictEqual(marked, false,
      'the story panel does NOT mark a word whose only teaching lesson is hidden — a re-created ' +
      'chapter\'s superseded vocab is not something the learner is being taught');
    assert.strictEqual(hid.C.run(`tapWord(${JSON.stringify(hid.w)})`), false,
      'and tapping it still refuses, so no route can open a lesson the learner is not meant to see');
    // The carve-out is `!L._hidden || APP._teacherMode`, matching the shape of the rule everywhere
    // else rather than introducing a second, stricter one — so a teacher reviewing what they hid
    // still sees it. Asserted because mutation showed nothing else held it: making the exclusion
    // unconditional passed the whole suite.
    const inTeacher = hid.C.run(`(function(){
      APP._teacherMode = true;
      var want = _hlKey(stripFuri(${JSON.stringify(hid.w)}));
      var hit = _storyExtraWords(APP.lessonData).some(function(x){ return _hlKey(stripFuri(String(x))) === want; });
      APP._teacherMode = false;
      return hit;
    })()`);
    assert.strictEqual(inTeacher, true,
      'but TEACHER MODE still shows it — the hidden rule is a learner-visibility rule everywhere ' +
      'else in the client, and this walk must not invent a stricter one');
    console.log(`  a hidden lesson's words are neither marked nor tappable, but a teacher sees them ("${hid.w}")`);
  }
}

// ── What this does NOT establish (rule 34) ───────────────────────────────
// • No click is dispatched through the DOM; `tapWord` is called directly. The onclick attribute is
//   asserted to exist (§6) but not exercised — a device pass is owed.
// • T0's "after answering, the next question is a randomly chosen DIFFERENT word" is NOT built. The
//   run continues in its own order, which is the §T5.2 ruling working as intended; if the user wants
//   the word-hopping behaviour, that is a further change.
// • ⚠️ §7's REPAIR-ROUTE assertion covers the VOCAB candidate pass only. Removing the `wrong` flag
//   from `_wordQuestions`' vocab pass fails it; removing it from the PROBE pass does not, because
//   this fixture's word is graded through vocab. The probe half of that flag is unguarded here.
// • ⚠️ §7 does NOT assert that the tap LANDS on the failed question end to end. Measured: a rebuilt
//   round holds the failed question alongside another question about the same word in roughly 1 of
//   14 attempts, so an assertion on it is a coin-flip — and an earlier version passed under BOTH
//   mutations of the rule, because the failed question is often simply first in the rebuilt run.
//   What is asserted is the deterministic half: the failed question re-enters the preferred pool.
// • ⚠️ MUTATION COVERAGE IS UNEVEN, and stating it beats implying otherwise. Disabling the
//   entry-point scan is caught 6/6; dropping the scan's unsolved preference 5/6; dropping the
//   POOL-level unsolved preference only 1/6 — because the scan compensates for a bad pool pick, so
//   the pool's remaining job is choosing WHICH LESSON when a word is taught in several, and this
//   fixture's word is taught in one. That part of the rule is effectively unguarded here.
console.log('unit-tap-word: ALL PASSED');
