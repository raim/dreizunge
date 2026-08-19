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
      rows.push({ w: w, n: r.n, ok: r.ok, state: _wordState(r),
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
      assert.strictEqual(row.n, row.ex.n + row.vo.n, `${row.w}: per-source counts sum to the total`);
      assert.strictEqual(row.ok, row.ex.ok + row.vo.ok, `${row.w}: per-source solved sum to the total`);
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

// ── What this does NOT establish (rule 34) ───────────────────────────────
// • It does not paint anything. `_wordState` returns the three states TRACK T will render; no caller
//   uses `partial` yet, and `§T5.4` was ruled ACCEPT, so the red-heavy screen ships as-is.
// • The equivalence with the pre-refactor implementation was established by CAPTURE AND DIFF over 59
//   real chapter/user pairs at the time of the change (sets identical on all 118 outputs), not by
//   this file — a captured baseline would rot on the next data drop.
console.log('unit-word-progress: ALL PASSED');
