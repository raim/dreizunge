// unit-exercise-qid-unique.test.js
// v73_i — a built round must never contain two exercises with the same qid.
//
// The qid IS the definition of "a distinct question": `lessonId:type:hash(canonical content)`, and
// the coverage universe is keyed by it. So two exercises sharing a qid are one question asked
// twice, which can only ever be counted once. The learner sees a literally identical question
// repeated inside a single round.
//
// Found from a duplicate grammar item — tp_131653303 holds `dream ← Traum` and `dream ← Träume`,
// the second being the German plural emitted as if it were a new noun (its `gender:"c"`, common
// gender, does not exist in German). But it is NOT a grammar-only problem, and not only a
// data-quality one:
//   • Measured before the fix: 41 duplicate exercises across 17 lessons and 8 exercise types,
//     `syn_select` largest at 14, then `mcq_plural` at 9.
//   • Some duplicates are legitimate data. `der Angestellte` / `die Angestellte` are two real
//     nouns sharing a plural, so "what is the plural of Angestellte?" is genuinely ONE question
//     however good the generating model is.
// The fix therefore lives in the builder, not in QC: deciding that `Träume` should be `Traum`
// needs German, but noticing that a round asks one question twice needs nothing.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const C = loadClient({ quiet: true });
C.run(`APP.savedList = ${JSON.stringify((store.topics || []).map(x =>
  ({ id: x.id, topic: x.topic, lang: x.lang, srcLang: x.srcLang, lessons: x.lessons })))}; true;`, 'seed');

// qid resolution must match the product's: a mixed lesson pools exercises from EARLIER lessons,
// which carry `_srcLessonIdx` and key on that lesson's id. Keying them all on the current lesson
// collapses genuinely different questions into one — which produced a phantom 97-duplicate reading
// while measuring this, before the keying was corrected.
const QID = `qid(x, (x && x._srcLessonIdx != null) ? null : APP.lessonData.lessons[IDX].id)`;

function roundsFor(topic) {
  C.run(`APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{} }; APP._teacherMode = false;
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse(); true;`, 'topic');
  const out = [];
  const ls = topic.lessons || [];
  for (let i = 0; i < ls.length; i++) {
    let rows;
    try {
      rows = JSON.parse(C.run(`(function(){ APP._derivingUniverse = true; APP.cur.lessonIdx = ${i};
        const e = buildExercises(${i}); APP._derivingUniverse = false;
        return JSON.stringify((e || []).map(x => ({ type: x.type, target: x.target,
          qid: ${QID.replace('IDX', String(i))} }))); })()`, 'build'));
    } catch (_) { continue; }
    if (rows.length) out.push({ idx: i, lesson: ls[i], rows });
  }
  return out;
}

// ── 1. The reported chapter ─────────────────────────────────────────────────
// The v70_n rule: assert against the data that produced the report.
{
  const t = (store.topics || []).find(x => x.id === 'tp_131653303');
  if (t) {
    const g = (t.lessons || []).find(L => L && L.type === 'grammar');
    const dupTargets = (g && g.grammar || []).map(x => String(x.target || '').trim().toLowerCase())
      .filter((v, i, a) => a.indexOf(v) !== i);
    // Guard the guard: if the corpus is repaired, this section must say so rather than pass empty.
    assert.ok(dupTargets.length > 0,
      'tp_131653303 still carries the duplicate grammar target this test was written for');
    const rounds = roundsFor(t);
    const grammarRound = rounds.find(r => r.lesson && r.lesson.type === 'grammar');
    assert.ok(grammarRound, 'its grammar lesson builds a round');
    const qids = grammarRound.rows.map(r => r.qid).filter(Boolean);
    assert.strictEqual(new Set(qids).size, qids.length,
      `the grammar round asks each question once (${qids.length} exercises, ` +
      `${new Set(qids).size} distinct) — before v73_i this was 15 exercises for 13 qids`);
    const dreams = grammarRound.rows.filter(r => r.target === 'dream');
    assert.strictEqual(new Set(dreams.map(r => r.type)).size, dreams.length,
      'and the duplicate item no longer yields two identical plural questions');
  }
}

// ── 2. Corpus-wide: the invariant holds everywhere ──────────────────────────
{
  let lessons = 0, exercises = 0;
  const offenders = [];
  for (const t of store.topics || []) {
    for (const r of roundsFor(t)) {
      lessons++; exercises += r.rows.length;
      const qids = r.rows.map(x => x.qid).filter(Boolean);
      const seen = new Set(), dup = [];
      for (const q of qids) { if (seen.has(q)) dup.push(q); else seen.add(q); }
      if (dup.length) offenders.push(`${t.lang}<-${t.srcLang} ${t.id} lesson[${r.idx}] ${dup.length} dup`);
    }
  }
  assert.ok(lessons > 500, `the corpus really builds rounds to check (${lessons})`);
  assert.deepStrictEqual(offenders.slice(0, 6), [],
    'no lesson in the corpus builds two exercises with the same qid');
  console.log(`  ${lessons} rounds, ${exercises} exercises, every qid distinct within its round`);
}

// ── 3. A mixed lesson's pooled exercises are NOT collapsed ──────────────────
// The dedup must not treat the same vocabulary pair drawn from two DIFFERENT lessons as one
// question: their qids differ by lessonId and the coverage universe counts them separately.
//
// The discriminating measurement, and it took two tries to get right. Comparing lesson ids inside
// the qids proved nothing — the test computes those itself, so it could not see how the BUILDER
// keyed them, and the assertion passed with the builder mis-keyed. What distinguishes the two is
// whether an exercise SURVIVED: if the builder keys pooled exercises on the mixed lesson, every
// pooled pair that shares canonical content collapses to one and the round comes back shorter.
// Measured over the corpus, 18 mixed rounds would lose exercises that way, the worst 28 → 21.
{
  const survivors = [];
  for (const t of store.topics || []) {
    const mi = (t.lessons || []).findIndex(L => L && L.type === 'mixed' && !L._hidden);
    if (mi < 0) continue;
    const round = roundsFor(t).find(r => r.idx === mi);
    if (!round || !round.rows.length) continue;
    // What a lesson-id-keyed dedup would have collapsed to: strip each qid's lessonId prefix.
    const miskeyed = new Set(round.rows.map(r => String(r.qid || '').split(':').slice(1).join(':')));
    if (round.rows.length > miskeyed.size) {
      survivors.push({ id: t.id, kept: round.rows.length, wouldKeep: miskeyed.size });
    }
  }
  assert.ok(survivors.length > 0,
    'the corpus contains a mixed round pooling the same question from two different lessons — ' +
    'without one, this section cannot tell correct keying from incorrect');
  const worst = survivors.sort((a, b) => (b.kept - b.wouldKeep) - (a.kept - a.wouldKeep))[0];
  console.log(`  mixed pooling preserved in ${survivors.length} round(s); worst case keeps ` +
              `${worst.kept} where lesson-keyed dedup would keep ${worst.wouldKeep}`);
}

console.log('unit-exercise-qid-unique: ALL PASSED');
