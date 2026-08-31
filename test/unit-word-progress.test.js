// unit-word-progress.test.js
// v80_q — TRACK T step 1: per-word PROGRESS, not per-word yes/no.
//
// `_solvedExtraWords` and `_solvedTargetWords` each answered "has this word been solved at all?" and
// returned a SET. TRACK T needs the fraction: a word is RED when none of its questions is solved and
// GREEN when all of them are (`§T5.1`, ruled: ALL — a word carries a mean of 1.70 questions and
// 53.6% carry exactly one). A set cannot express the middle. `_wordProgress` is now the ONE
// collector and both originals are thin wrappers over it.
//
// ⚠️ THE DISCRIMINATING SECTION IS §3, and it exists because the first version of this refactor was
// WRONG in exactly that way: it kept one counter per word, merging the two sources, so solving a
// `word_forms` question about a word marked it solved on the VOCAB side too. Caught by capturing
// both functions' output over 59 real chapter/user pairs before the change and diffing after —
// `_solvedTargetWords` had grown by 11 words. Sets are now identical on all 118 captured outputs.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const learners = JSON.parse(fs.readFileSync(path.join(ROOT, 'learners.json'), 'utf8'));
const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons }));
const byName = new Map(store.topics.map(t => [t.topic, t]));

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
  APP.savedList = ${JSON.stringify(SAVED)};
  APP.storylines = ${JSON.stringify(store.storylines || [])};
  APP.info = { backend:'none', canGenerate:false, coverageThreshold:1 };
  APP._teacherMode = false; saveProg = function(){}; true;`);

// Load a chapter with a real learner's solved map, and report everything at once.
function look(topic, sMap) {
  return JSON.parse(C.run(`(function(){
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP.progress.solved[${JSON.stringify(topic.topic)}] = ${JSON.stringify(sMap || {})};
    APP.lessonData = ${JSON.stringify(topic)};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    var d = APP.lessonData, prog = _wordProgress(d), rows = [];
    prog.forEach(function(r, w){
      rows.push({ w: w, n: r.n, ok: r.ok, state: _wordState(r), bySrc: r.bySrc,
                  ex: r.bySrc.extra, vo: r.bySrc.vocab });
    });
    return JSON.stringify({ rows: rows,
      extra: _solvedExtraWords(d), target: _solvedTargetWords(d) });
  })()`));
}

// Real learner histories, so the invariants are checked against data the app actually produced.
const CASES = [];
for (const u of Object.values(learners.users || {})) {
  const solved = ((u.state || {}).progress || {}).solved || {};
  for (const [name, sMap] of Object.entries(solved)) {
    const t = byName.get(name);
    if (t && (t.lessons || []).length && sMap && Object.keys(sMap).length) CASES.push({ t, sMap });
  }
}
assert.ok(CASES.length >= 10, `non-vacuity: real learner histories to check against (${CASES.length})`);

// ── 1. The counting invariants hold everywhere ───────────────────────────
{
  let words = 0, green = 0, partial = 0, red = 0;
  for (const c of CASES) {
    const r = look(c.t, c.sMap);
    for (const row of r.rows) {
      words++;
      assert.ok(row.n > 0, `${row.w}: a tracked word has at least one question`);
      assert.ok(row.ok <= row.n, `${row.w}: solved (${row.ok}) cannot exceed total (${row.n})`);
      // v80_v added a third source (sentences), so the sum is over ALL buckets, not two. Written as
      // a sum over the object rather than a fixed list, so a fourth source cannot silently break it.
      const sumN = Object.values(row.bySrc).reduce((a, b) => a + b.n, 0);
      const sumOk = Object.values(row.bySrc).reduce((a, b) => a + b.ok, 0);
      assert.strictEqual(row.n, sumN, `${row.w}: per-source counts sum to the total`);
      assert.strictEqual(row.ok, sumOk, `${row.w}: per-source solved sum to the total`);
      const want = row.ok === 0 ? 'red' : row.ok >= row.n ? 'green' : 'partial';
      assert.strictEqual(row.state, want, `${row.w}: _wordState matches ${row.ok}/${row.n}`);
      if (row.state === 'green') green++; else if (row.state === 'partial') partial++; else red++;
    }
  }
  assert.ok(words > 100, `non-vacuity: enough words to mean something (${words})`);
  assert.ok(green > 0 && red > 0, 'non-vacuity: BOTH green and red occur — otherwise the states are untested');
  assert.ok(partial > 0, 'non-vacuity: PARTIAL occurs, which is the state a Set could not express');
  console.log(`  invariants hold over ${words} words (${green} green, ${partial} partial, ${red} red)`);
}

// ── 2. The wrappers agree with the collector ─────────────────────────────
{
  for (const c of CASES.slice(0, 20)) {
    const r = look(c.t, c.sMap);
    const wantExtra = r.rows.filter(x => x.ex.ok > 0).map(x => x.w).sort();
    const wantVocab = r.rows.filter(x => x.vo.ok > 0).map(x => x.w).sort();
    assert.deepStrictEqual([...r.extra].sort(), wantExtra,
      `${c.t.topic}: _solvedExtraWords is exactly the words with a solved EXTRA question`);
    assert.deepStrictEqual([...r.target].sort(), wantVocab,
      `${c.t.topic}: _solvedTargetWords is exactly the words with a solved VOCAB question`);
  }
  console.log('  both wrappers agree with the collector');
}

// ── 3. ⚠️ THE DISCRIMINATOR — the two sources must not contaminate ───────
// A word solved ONLY through an extra source must not appear in _solvedTargetWords, and vice versa.
// This is the bug the first version of the refactor had; without this section it would have shipped.
{
  let checked = 0;
  for (const c of CASES) {
    const r = look(c.t, c.sMap);
    const tset = new Set(r.target), eset = new Set(r.extra);
    for (const row of r.rows) {
      if (row.ex.ok > 0 && row.vo.ok === 0) {
        assert.ok(!tset.has(row.w),
          `${row.w}: solved only via an extra source, must NOT count as a solved VOCAB word`);
        checked++;
      }
      if (row.vo.ok > 0 && row.ex.ok === 0) {
        assert.ok(!eset.has(row.w),
          `${row.w}: solved only via vocab, must NOT count as a solved EXTRA word`);
        checked++;
      }
    }
  }
  assert.ok(checked > 0,
    'non-vacuity: the corpus actually contains words solved through one source only — without ' +
    'any, this section would pass on a rule that merges them');
  console.log(`  the two sources do not contaminate each other (${checked} one-sided words)`);
}

// ── 4. Ordering is deterministic, longest first ──────────────────────────
// `_highlightVocabHtml` matches in this order so a short word cannot match inside a longer one.
// `b.length - a.length` alone is not a total order, so ties used to fall out of Set insertion order.
{
  const c = CASES.find(x => look(x.t, x.sMap).target.length >= 3) || CASES[0];
  const r1 = look(c.t, c.sMap), r2 = look(c.t, c.sMap);
  assert.deepStrictEqual(r1.target, r2.target, 'the same input gives the same order twice');
  for (const list of [r1.target, r1.extra]) {
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i - 1].length >= list[i].length, 'sorted longest-first: ' + JSON.stringify(list));
      if (list[i - 1].length === list[i].length) {
        assert.ok(list[i - 1] <= list[i], 'equal lengths are tie-broken by text, not by insertion');
      }
    }
  }
  console.log('  ordering is longest-first and deterministic');
}

// ── 5. An untouched chapter is all RED, and states nothing green ─────────
{
  const c = CASES[0];
  const r = look(c.t, {});
  assert.ok(r.rows.length > 0, 'non-vacuity: the chapter tracks words at all');
  assert.ok(r.rows.every(x => x.state === 'red'), 'with no history every word is RED');
  assert.strictEqual(r.extra.length, 0, 'and no extra word reads as solved');
  assert.strictEqual(r.target.length, 0, 'and no vocab word reads as solved');
  console.log('  an untouched chapter is entirely red');
}

// ── 6. ⚠️ v81_d — A WORD IS GRADED ONLY ON QUESTIONS A ROUND CAN BUILD ────
// User-reported: *"some words are impossible to turn green; clicking on them always brings the same
// question and doesn't turn it green."*
//
// `_storyWordSources` declares the question SPACE, not what the builders emit. Measured over 25
// chapters / 473 words (`build_history/probe_word_green_v81c.js`): only 60.8% of declared probe keys
// were buildable — `type_conjugation` 0 of 210 (since `v78_i` it is a FALLBACK for a form with no
// MCQ distractors, which occurs nowhere in this corpus), `syn_select` 142 of 192 (the `antonyms`
// mode is declared whether or not the lesson has antonyms), `type_plural` 4 of 8. A word charged
// with such a key could never reach `ok === n`. Standing rule `v71_s` in a new place: a denominator
// counting questions the round will never ask can never be satisfied.
//
// The claim is asserted at the level it lives: SOLVE EVERYTHING THE LESSON CAN ASK, and the word
// must be GREEN. Seeded through `_lessonQidUniverse` — the same converged universe the product
// filters with and coverage counts against — so this drives the rule, not a copy of it.
{
  // A chapter carrying the defect: at least one word declaring a probe key OUTSIDE the universe.
  // Chosen by measurement rather than by name, so a data drop moves the choice instead of breaking.
  const pick = (() => {
    for (const t of store.topics) {
      if (!(t.lessons || []).length || !String(t.story || '').trim()) continue;
      const r = JSON.parse(C.run(`(function(){
        APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
        APP.lessonData = ${JSON.stringify(t)};
        if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
        var d = APP.lessonData, uni = {}, outside = 0, inside = 0;
        (d.lessons||[]).forEach(function(L,i){
          if (!L || L.id == null) return;
          try { uni[String(L.id)] = _lessonQidUniverse(i); } catch(_) {}
        });
        _storyWordSources(d).forEach(function(s){
          (s.probes||[]).forEach(function(p){
            var k = null; try { k = qid(p, s.lessonId); } catch(_) {}
            if (!k) return;
            var U = uni[String(s.lessonId)];
            if (U && U.has(k)) inside++; else outside++;
          });
        });
        return JSON.stringify({ outside: outside, inside: inside });
      })();`));
      if (r.outside > 0 && r.inside > 0) return t;
    }
    return null;
  })();
  // Guard the guard against going vacuous on new data (rule: a section that only means something
  // when the corpus contains a case must assert the case was found). If generation ever stops
  // declaring unbuildable probes this must FAIL LOUDLY so the filter can be reconsidered, not
  // quietly stop testing anything.
  assert.ok(pick, 'the corpus contains a chapter declaring probe keys OUTSIDE the buildable universe ' +
    '— without one this section exercises nothing');

  // Solve exactly what the lesson can ASK, and nothing else.
  const r = JSON.parse(C.run(`(function(){
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP.lessonData = ${JSON.stringify(pick)};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    var d = APP.lessonData, m = _solvedMap(d.topic);
    (d.lessons||[]).forEach(function(L,i){
      if (!L || L.id == null) return;
      try { _lessonQidUniverse(i).forEach(function(k){ m[k] = 1; }); } catch(_) {}
      try { _lessonItemUniverse(i).forEach(function(k){ m[k] = 1; }); } catch(_) {}
    });
    var rows = [];
    _wordProgress(d).forEach(function(rec, w){ rows.push({ w: w, n: rec.n, ok: rec.ok,
      state: _wordState(rec), extra: rec.bySrc.extra.n }); });
    return JSON.stringify({ rows: rows });
  })();`));

  const fromProbes = r.rows.filter(x => x.extra > 0);
  assert.ok(fromProbes.length > 0,
    'non-vacuity: this chapter grades words through the PROBE sources, which is where the defect was');
  const notGreen = fromProbes.filter(x => x.state !== 'green');
  assert.deepStrictEqual(notGreen.map(x => `${x.w} ${x.ok}/${x.n}`), [],
    'every probe-graded word is GREEN once everything the lesson can ask has been answered — ' +
    'a word left short is being graded on a question no round can build');
  console.log(`  answering all buildable questions greens every probe-graded word (${fromProbes.length} words)`);
}

// ── 7. ⚠️ THE FILTER MUST STAY SILENT ON ANY OTHER CHAPTER ───────────────
// `_lessonQidUniverse(i)` indexes into **`APP.lessonData`** and ignores the `d` handed to
// `_wordProgress`, so for a different chapter it derives the wrong lesson or returns an EMPTY set —
// and an empty set used as a filter removes every question. `_renderChainStory` grades one chapter
// at a time across a whole chain (`v74_n`), so this is a live path: the first version of `v81_d`
// blanked the darker shade there, and `unit-story-highlight-sources` §4 caught it.
//
// Asserted here as well as there because that file finds it INCIDENTALLY, through a fixture topic,
// and a trap this quiet deserves a guard that names it.
{
  const withProbes = store.topics.find(t => (t.lessons || []).length &&
    JSON.parse(C.run(`(function(){
      APP.lessonData = ${JSON.stringify(t)};
      if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
      return JSON.stringify(_storyWordSources(APP.lessonData)
        .filter(function(s){ return (s.probes||[]).length; }).length);
    })();`)) > 0);
  assert.ok(withProbes, 'non-vacuity: a chapter whose words carry probes at all');
  const other = store.topics.find(t => t !== withProbes && (t.lessons || []).length);
  assert.ok(other, 'non-vacuity: a second, different chapter to leave open');

  const n = JSON.parse(C.run(`(function(){
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    // The OPEN chapter is a different one — the state _renderChainStory renders a chain in.
    APP.lessonData = ${JSON.stringify(other)};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    var foreign = ${JSON.stringify(withProbes)};
    var graded = 0;
    _wordProgress(foreign).forEach(function(rec){ graded += rec.bySrc.extra.n; });
    return JSON.stringify(graded);
  })();`));
  assert.ok(n > 0,
    'a chapter that is NOT the open one is still graded through its probe sources — the universe ' +
    'filter must fail OPEN there, because it cannot be derived for a chapter it cannot index');
  console.log(`  a foreign chapter keeps its probe grading (${n} graded questions), filter silent`);
}

// ── 8. ⚠️ v81_e / §T7 — A WRONG ANSWER TAKES A WORD OUT OF GREEN ─────────
// User ruling: **HIGHLIGHT ONLY**. *"A wrongly answered question on a vocab that had been answered
// correctly should also decrease the solved counter."* — but the SOLVED STORE is not touched; the
// demotion lives in a parallel `wrong` map and surfaces only through `_wordState`.
//
// The wrong answer is recorded by calling the PRODUCT's `markWrong` on a real exercise lifted from a
// round the product built, not by writing the store by hand — seeding a store the way the product
// does not is how the v76 coverage question came to measure nothing (rule 17).
{
  const found = JSON.parse(C.run(`(function(){
    for (var ti = 0; ti < APP.savedList.length; ti++) {
      var t = APP.savedList[ti];
      if (!t || !(t.lessons||[]).length || !String(t.story||'').trim()) continue;
      APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{}, wrong:{} };
      APP.lessonData = t;
      if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
      var d = APP.lessonData, m = _solvedMap(d.topic);
      (d.lessons||[]).forEach(function(L,i){
        if (!L || L.id == null) return;
        try { _lessonQidUniverse(i).forEach(function(k){ m[k] = 1; }); } catch(e) {}
        try { _lessonItemUniverse(i).forEach(function(k){ m[k] = 1; }); } catch(e) {}
      });
      var words = [];
      _wordProgress(d).forEach(function(rec, w){
        if (rec.bySrc.extra.n >= 1 && _wordState(rec) === 'green') words.push(w);
      });
      for (var wi = 0; wi < words.length; wi++) {
        var w = words[wi], cands = _wordQuestions(d, w);
        if (!cands.length) continue;
        for (var b = 0; b < 6; b++) {
          if (tapWord(w) !== true) continue;
          var Cur = APP.cur, lid = (d.lessons[Cur.lessonIdx]||{}).id;
          for (var i = 0; i < (Cur.exercises||[]).length; i++) {
            var k = null; try { k = qid(Cur.exercises[i], lid); } catch(e) {}
            if (k && cands.some(function(c){ return c.key === k; })) {
              // ⚠️ VERIFY the candidate before returning it (v87_o). Being a question
              // _wordQuestions knows about is NOT the same as being one _wordProgress GRADES:
              // the two derive their key sets differently, so a word can own a question whose
              // wrongness never reaches its state. The section below then marks it wrong and asserts
              // the word leaves green — which silently became untrue when the corpus grew (the
              // user's own server writes to lessons.json between runs), failing on correct code.
              // So: try it here, keep it only if the demotion actually happens, and CLEAN UP so the
              // real run below still starts from a green, un-demoted word.
              var _st = function(){ var s = null; _wordProgress(d).forEach(function(rec, x){ if (x === w) s = _wordState(rec); }); return s; };
              if (_st() !== 'green') continue;
              markWrong(Cur.exercises[i]);
              var _after = _st();
              try { delete _wrongMap(d.topic)[k]; } catch(e) {}
              if (_after === 'green') continue;   // this question does not grade the word — keep looking
              return JSON.stringify({ topic: d.topic, word: w, key: k });
            }
          }
        }
      }
    }
    return 'null';
  })();`));
  // Guard the guard against going vacuous on new data: without such a word this proves nothing.
  assert.ok(found,
    'the corpus has a fully-solved, probe-graded word with a question in a built round WHOSE ' +
    'wrongness actually grades the word — verified in the sweep, not assumed of the first match');

  const r = JSON.parse(C.run(`(function(){
    var d = APP.lessonData, w = ${JSON.stringify((found||{}).word)}, KEY = ${JSON.stringify((found||{}).key)};
    var st = function(){ var s = null; _wordProgress(d).forEach(function(rec, x){ if (x === w) s = _wordState(rec); }); return s; };
    var gate = function(){ return _wordGateFraction(d); };
    var ex = null, Cur = APP.cur, lid = (d.lessons[Cur.lessonIdx]||{}).id;
    for (var i = 0; i < (Cur.exercises||[]).length; i++) {
      var k = null; try { k = qid(Cur.exercises[i], lid); } catch(e) {}
      if (k === KEY) { ex = Cur.exercises[i]; break; }
    }
    if (!ex) return JSON.stringify({ err: 'the built run no longer holds that question' });
    var before = { state: st(), gate: gate() };
    var wroteKey = markWrong(ex);
    var after = { state: st(), gate: gate() };
    markSolved(ex);                              // answering it right again
    var repaired = { state: st(), gate: gate() };
    return JSON.stringify({ before: before, after: after, repaired: repaired, wroteKey: wroteKey,
      stillSolved: !!_solvedMap(d.topic)[KEY],
      wrongCleared: !_wrongMap(d.topic)[KEY] });
  })();`));
  assert.ok(!r.err, r.err || '');

  assert.strictEqual(r.before.state, 'green', 'precondition: the word starts GREEN');
  assert.strictEqual(r.wroteKey, found.key, 'markWrong recorded the question the learner got wrong');
  assert.strictEqual(r.after.state, 'partial',
    'a wrong answer takes the word out of green — and to PARTIAL, not red: the learner HAS solved ' +
    'these questions, and red would claim otherwise');
  assert.strictEqual(r.repaired.state, 'green',
    'answering it correctly again restores green — the demotion must be repairable, or the feature ' +
    'only ever takes colour away');
  assert.strictEqual(r.wrongCleared, true, 'and the correct answer clears the wrong-map entry');

  // ── 9. ⚠️ THE CONTAINMENT THE RULING TURNS ON ───────────────────────────
  // `§T7` offered two readings and the user chose HIGHLIGHT ONLY. The entire difference is that the
  // solved store — and everything reading it: coverage, the pass mark, `setComplete`,
  // `chapterComplete`, `storyUnlocked`, both resume scans — keeps its current meaning.
  // `_wordGateFraction` is the sharpest test available headlessly, because it is the one GATE that
  // reads `_wordProgress` directly (`ok >= n`) and would therefore inherit the demotion if it had
  // been written into `n`/`ok` instead of into a separate counter.
  // **If this assertion ever fails, reading 1 has silently become reading 2.**
  assert.strictEqual(r.after.gate, r.before.gate,
    'THE WORD GATE IS UNAFFECTED by a wrong answer — §T7 reading 1 is HIGHLIGHT ONLY, so a mistake ' +
    'must never be able to re-lock a story (reading 2 is mastery decay, PLAN §9b/D2, and is NOT ruled)');
  assert.strictEqual(r.stillSolved, true,
    'and the solved store is still MONOTONIC — the question stays solved; only the colour moved');
  console.log('  a wrong answer demotes green -> partial, repairably, and no gate can see it');
}

// ── What this does NOT establish (rule 34) ───────────────────────────────
// • It does not paint anything. `_wordState` returns the three states TRACK T renders; this file
//   asserts the RULE, and `unit-story-highlight-sources` asserts the markup.
// • §8 calls `markWrong` directly. That the WRONG-ANSWER PATH in `check()` calls it is a wiring
//   claim and is asserted in `unit-tap-word` — assertions on each half prove nothing about the join.
// • The equivalence with the pre-refactor implementation was established by CAPTURE AND DIFF over 59
//   real chapter/user pairs at the time of the change (sets identical on all 118 outputs), not by
//   this file — a captured baseline would rot on the next data drop.
console.log('unit-word-progress: ALL PASSED');
