// unit-drill.test.js
// v54 — "review my mistakes": LLM-free drill rounds built from the learned ledger.
//
// The ledger (`APP.progress.learned["lang|srcLang"]`) has tracked a per-word `wrong` count since
// v50, and nothing read it. A drill pulls those words straight into the existing exercise builders:
// no model call, no latency, works offline and in the static build.
//
// Design calls fixed by the roadmap and asserted here:
//   1. the lesson is EPHEMERAL — synthesized in memory, never written to lessons.json
//   2. solving runs the normal qid()/markSolved path, and re-learning walks `wrong` back down
// Everything must be ADDITIVE: a normal lesson's progression behaviour is unchanged.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function ext(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}
const constOf = (n) => (html.match(new RegExp(`const ${n}\\s*=\\s*([^;]+);`)) || [])[1];

const DRILL_SIZE = Number(constOf('DRILL_SIZE'));
const DRILL_MIN  = Number(constOf('DRILL_MIN'));
assert.ok(Number.isFinite(DRILL_SIZE) && Number.isFinite(DRILL_MIN), 'round size + floor are named constants');
assert.ok(DRILL_MIN >= 4, 'an MCQ needs 3 distractors + the answer, so the floor is at least 4');
assert.ok(DRILL_SIZE >= DRILL_MIN, 'a round is at least as big as the floor');

// ── Build the pure core against an injected APP ──────────────────────────────
function mkCore(ledgerVocab) {
  const APP = {
    lang: 'de', srcLang: 'en',
    progress: { learned: { 'de|en': { vocab: ledgerVocab, sentences: {} } } },
  };
  const t = (k) => k;
  const src = [ext(html, '_learnedLedger'), ext(html, 'drillCandidates'),
               ext(html, 'buildDrillLesson'), ext(html, 'drillAvailable')].join('\n');
  return new Function('APP', 't', 'DRILL_SIZE', 'DRILL_MIN',
    src + '\nreturn {drillCandidates, buildDrillLesson, drillAvailable};'
  )(APP, t, DRILL_SIZE, DRILL_MIN);
}
const v = (source, wrong, seen) => ({ source, wrong, seen });

// ── Selection: wrong words first, most-wrong first ───────────────────────────
{
  const core = mkCore({
    Hund:  v('dog', 3, 5),
    Katze: v('cat', 1, 9),
    Baum:  v('tree', 0, 20),
    Haus:  v('house', 2, 4),
    Buch:  v('book', 0, 7),
  });
  const got = core.drillCandidates('de', 'en', 5).map(x => x.target);
  assert.deepStrictEqual(got, ['Hund', 'Haus', 'Katze', 'Baum'],
    'wrong words first (3,2,1), then padding by most-seen — but only up to the MCQ floor of 4');
}

// ── Ties are deterministic, so the same ledger always yields the same round ───
{
  const led = { Alpha: v('a', 2, 3), Beta: v('b', 2, 3), Gamma: v('g', 2, 3), Delta: v('d', 2, 3) };
  const a = mkCore(led).drillCandidates('de', 'en', 4).map(x => x.target);
  const b = mkCore(led).drillCandidates('de', 'en', 4).map(x => x.target);
  assert.deepStrictEqual(a, b, 'stable ordering');
  assert.deepStrictEqual(a, ['Alpha', 'Beta', 'Delta', 'Gamma'], 'ties break on target, not insertion order');
}

// ── Padding fills the DISTRACTOR POOL, never the quiz ────────────────────────
// v54_b: padding used to widen `vocab`, so a single mistake was buried among seven known words —
// "review my mistakes" quizzed mostly words the learner had never got wrong. Now the pool is padded
// only to the MCQ floor, and only the mistakes are asked.
{
  const core = mkCore({
    Hund: v('dog', 1, 2), Katze: v('cat', 1, 2),
    Baum: v('tree', 0, 9), Buch: v('book', 0, 8), Auto: v('car', 0, 7), Tisch: v('table', 0, 6),
  });
  const pool = core.drillCandidates('de', 'en', DRILL_SIZE);
  assert.strictEqual(pool.length, DRILL_MIN, 'pool is padded to the MCQ floor and no further');
  assert.deepStrictEqual(pool.slice(0, 2).map(x => x.target), ['Hund', 'Katze'], 'mistakes lead');
  assert.ok(pool.slice(2).every(x => x.wrong === 0), 'the rest is padding');

  const lesson = core.buildDrillLesson('de', 'en');
  assert.ok(lesson, 'a 2-mistake ledger still builds a playable round');
  assert.deepStrictEqual(lesson.vocab.map(x => x.target), ['Hund', 'Katze'], 'ONLY the mistakes are quizzed');
  assert.strictEqual(lesson._distractors.length, DRILL_MIN, 'the pool carries the padding');
  assert.ok(lesson._distractors.some(x => x.target === 'Baum'), 'padding lives in the pool');

  // A single mistake still yields a playable round: 1 quizzed word, 3 distractors.
  const one = mkCore({ Hund: v('dog', 1, 3), Baum: v('tree', 0, 9), Buch: v('book', 0, 8), Auto: v('car', 0, 7) });
  const l1 = one.buildDrillLesson('de', 'en');
  assert.deepStrictEqual(l1.vocab.map(x => x.target), ['Hund'], 'one mistake → one quizzed word');
  assert.strictEqual(l1._distractors.length, DRILL_MIN, 'padded to exactly the MCQ floor');

  // Enough mistakes → no padding at all.
  const many = mkCore({ A: v('a', 5, 1), B: v('b', 4, 1), C: v('c', 3, 1), D: v('d', 2, 1), Z: v('z', 0, 99) });
  const lm = many.buildDrillLesson('de', 'en');
  assert.strictEqual(lm.vocab.length, 4, 'all four mistakes quizzed');
  assert.strictEqual(lm._distractors.length, 4, 'no padding needed');
  assert.ok(!lm._distractors.some(x => x.target === 'Z'), 'known words are not dragged in unnecessarily');
}

// ── Refusals ─────────────────────────────────────────────────────────────────
{
  // Nothing wrong → nothing to review. A drill is not a re-run of known vocabulary.
  const noMistakes = mkCore({ A: v('a', 0, 3), B: v('b', 0, 3), C: v('c', 0, 3), D: v('d', 0, 3) });
  assert.strictEqual(noMistakes.buildDrillLesson('de', 'en'), null, 'no wrong words → no drill');
  assert.strictEqual(noMistakes.drillAvailable('de', 'en'), false, 'and the button stays hidden');

  // Too few usable words → an MCQ has no distractors, even though there ARE mistakes.
  const tooFew = mkCore({ A: v('a', 2, 3), B: v('b', 1, 3), C: v('c', 0, 3) });
  assert.strictEqual(tooFew.buildDrillLesson('de', 'en'), null, `pool below ${DRILL_MIN} → no drill`);

  // A word with no gloss cannot be quizzed in either direction.
  const noGloss = mkCore({ A: v('', 5, 3), B: v('b', 1, 3), C: v('c', 0, 3), D: v('d', 0, 3), E: v('e', 0, 3) });
  const cands = noGloss.drillCandidates('de', 'en', 8);
  assert.ok(!cands.some(x => x.target === 'A'), 'a word with no source gloss is skipped');
  assert.ok(cands.every(x => x.target && x.source), 'every candidate has both sides');

  // An empty / unknown pair must not throw.
  assert.strictEqual(mkCore({}).buildDrillLesson('de', 'en'), null, 'empty ledger → null, no throw');
  assert.strictEqual(mkCore({}).drillAvailable('xx', 'yy'), false, 'unknown pair → false, no throw');
}

// ── Synthesis: the shape the standard builder expects, and nothing more ──────
{
  const core = mkCore({ A: v('a', 3, 1), B: v('b', 2, 1), C: v('c', 1, 1), D: v('d', 0, 9), E: v('e', 0, 8) });
  const lesson = core.buildDrillLesson('de', 'en');
  assert.strictEqual(lesson.type, 'standard', 'plays through the existing standard builder');
  assert.strictEqual(lesson._drill, true, 'flagged so the progression gates can see it');
  assert.strictEqual(lesson.id, 'drill', 'stable id → stable qids across repeated drills');
  assert.deepStrictEqual(lesson.sentences, [], 'no sentences: the ledger holds words');
  [...lesson.vocab, ...lesson._distractors].forEach(x => assert.deepStrictEqual(Object.keys(x).sort(), ['source', 'target'],
    'vocab/pool carry only what the builder needs (no wrong/seen leakage into the lesson)'));
  assert.strictEqual(new Set(lesson.vocab.map(x => x.target)).size, lesson.vocab.length, 'no duplicate words');
  assert.ok(lesson.vocab.every(q => lesson._distractors.some(p => p.target === q.target)),
    'every quizzed word is also in the pool (so it can serve as a distractor for the others)');
  // The builder must actually consult the pool, or padding would be pointless.
  assert.ok(/const allV = lesson\._distractors \|\| lesson\.vocab \|\| \[\];/.test(html),
    'buildStandardExercises draws distractors from _distractors when present');
}

// ── Re-learning walks `wrong` back down — but only inside a drill ────────────
{
  function record(lesson, wrongTargets, ledger) {
    const APP = { lang: 'de', srcLang: 'en', lessonData: { lang: 'de', srcLang: 'en' },
                  progress: { learned: { 'de|en': { vocab: ledger, sentences: {} } } }, cur: {} };
    const fn = new Function('APP', 'saveProg', 'stripFuri',
      ext(html, '_learnedLedger') + '\n' + ext(html, 'recordLearnedFromLesson') + '\nreturn recordLearnedFromLesson;'
    )(APP, () => {}, (s) => s);
    fn(lesson, wrongTargets);
    return APP.progress.learned['de|en'].vocab;
  }
  const drill  = { _drill: true, vocab: [{ target: 'Hund', source: 'dog' }, { target: 'Katze', source: 'cat' }] };
  const normal = { vocab: [{ target: 'Hund', source: 'dog' }, { target: 'Katze', source: 'cat' }] };

  let led = { Hund: v('dog', 3, 5), Katze: v('cat', 1, 5) };
  led = record(drill, new Set(['Katze']), led);
  assert.strictEqual(led.Hund.wrong, 2, 'drilled + correct → wrong count decremented');
  assert.strictEqual(led.Katze.wrong, 2, 'drilled + wrong again → incremented');
  assert.strictEqual(led.Hund.seen, 6, 'seen still increments');

  led = { Hund: v('dog', 3, 5), Katze: v('cat', 1, 5) };
  led = record(normal, new Set(['Katze']), led);
  assert.strictEqual(led.Hund.wrong, 3, 'a NORMAL lesson never decays wrong counts (additive)');
  assert.strictEqual(led.Katze.wrong, 2, 'and still increments on a mistake');

  led = record(drill, new Set(), { Hund: v('dog', 0, 1) });
  assert.strictEqual(led.Hund.wrong, 0, 'wrong never goes negative');
}

// ── Integration: the synthesized lesson actually PLAYS through the real builder ──────
// The point of `type:'standard'` is that no new exercise machinery is needed. Prove it, rather than
// trusting the shape: run the real buildStandardExercises over a real drill lesson.
{
  const APP = {
    lang: 'de', srcLang: 'en',
    progress: { learned: { 'de|en': { vocab: {
      Hund: v('dog', 3, 5), Haus: v('house', 2, 4), Katze: v('cat', 1, 9),
      Baum: v('tree', 0, 20), Buch: v('book', 0, 7), Auto: v('car', 0, 6),
    }, sentences: {} } } },
  };
  const core = new Function('APP', 't', 'DRILL_SIZE', 'DRILL_MIN',
    [ext(html, '_learnedLedger'), ext(html, 'drillCandidates'), ext(html, 'buildDrillLesson')].join('\n') +
    '\nreturn buildDrillLesson;')(APP, (k) => k, DRILL_SIZE, DRILL_MIN);
  const lesson = core('de', 'en');
  APP.lessonData = { topic: '__drill__', lang: 'de', srcLang: 'en', lessons: [lesson] };
  APP.cur = { lessonIdx: 0 };

  const shuffle = (a) => a.slice();                       // identity → deterministic
  const build = new Function('APP', 'shuffle', 'jaTokenize', 'pick',
    ext(html, 'buildStandardExercises') + '\nreturn buildStandardExercises;'
  )(APP, shuffle, () => [], new Function('shuffle', ext(html, 'pick') + '\nreturn pick;')(shuffle));

  const exs = build(lesson, 0);
  assert.ok(exs.length >= lesson.vocab.length, `a full round of exercises (${exs.length} from ${lesson.vocab.length} words)`);
  exs.forEach(e => {
    assert.ok(e.type, 'each exercise has a type');
    if (e.choices) {
      assert.ok(e.choices.includes(e.correct), `answerable: correct is among the choices (${e.type})`);
      assert.strictEqual(new Set(e.choices).size, e.choices.length, `no duplicate choices (${e.type})`);
      assert.ok(e.choices.length >= 4, `MCQ has distractors (${e.type})`);
    }
  });
  // The wrong words must actually be QUIZZED — that is the whole difference from "my story",
  // which only weaves them in as context.
  const quizzed = new Set(exs.map(e => e.target || e.correct));
  ['Hund', 'Haus', 'Katze'].forEach(w => assert.ok(quizzed.has(w), `the wrong word "${w}" is quizzed`));

  // Design call 2: the normal qid() path. Stable across rebuilds → repeated drills reuse solved ids.
  const qidFn = new Function('APP', 'stripFuri',
    [ext(html, '_qidCanonical'), ext(html, '_qidHash'), ext(html, 'qid')].join('\n') + '\nreturn qid;'
  )(APP, (s) => s);
  const ids1 = exs.map(e => qidFn(e, 'drill'));
  const ids2 = build(lesson, 0).map(e => qidFn(e, 'drill'));
  assert.ok(ids1.every(Boolean), 'every drill exercise produces a qid (so markSolved can record it)');
  assert.deepStrictEqual(ids1, ids2, 'qids are stable across rebuilds of the same round');
  assert.ok(ids1.every(id => id.startsWith('drill:')), 'qids are namespaced by the drill lesson id');
}

// ── Ephemeral: the drill must not leak into topic progress ───────────────────
assert.ok(/const DRILL_TOPIC = '__drill__';/.test(html), 'the drill uses a synthetic topic key');
assert.ok(/if\(!C\._review && !C\.isErrorHunt && !lesson\._drill\)\{/.test(html),
  'showComplete records no topic completion for a drill (or a v60.1 review render)');
assert.ok(/if\(lesson&&!C\.isErrorHunt&&!lesson\._drill&&C\.total>0\)\{/.test(html),
  'confirmQuit does not record topic completion for a drill');
assert.ok(/APP\._drillPrev = prev;/.test(html), 'startDrill stashes the real topic');
assert.ok(/const prev = APP\._drillPrev \|\| APP\.lessonData;/.test(html),
  're-drilling from a drill result card does not stash the drill as the real topic');
assert.ok(/function endDrill\(\)\{[\s\S]*APP\.lessonData = APP\._drillPrev;[\s\S]*delete APP\._drillPrev;/.test(html),
  'endDrill restores the real topic');
// v54_b — THE choke point. `showComplete` REASSIGNS compNext.onclick, so the inline
// onclick="afterComplete()" never fires on the finish path: restoring only there was dead code, and
// the ephemeral drill leaked into the UI as a fake "__drill__" lesson set. Every exit (Continue, the
// completion nav buttons, confirmQuit) funnels through goLessonSet(), so it restores there.
const goLS = ext(html, 'goLessonSet');
assert.ok(/endDrill\(\);/.test(goLS), 'goLessonSet restores the real topic — the one guard that matters');
assert.ok(goLS.indexOf('endDrill()') < goLS.indexOf('APP.lessonData'),
  'endDrill runs BEFORE goLessonSet reads APP.lessonData');
// showComplete reassigns the handler, so an assertion that afterComplete calls endDrill proves nothing.
assert.ok(/compNext\.onclick = \(\) =>/.test(html), 'showComplete does reassign the Next handler');
// v60: the teacher-only nav pills are hidden for a drill (and for learners entirely). The clean
// learner card has just Next + Back; a drill hides Back too (it returns via Next/afterComplete).
assert.ok(/if \(_teacher && !lesson\._drill\) \{/.test(html),
  'the completion nav pills show only for a teacher on a non-drill card (v60)');
assert.ok(/_compNav\.innerHTML = '';\s*\n\s*_compNav\.style\.display = 'none';/.test(html),
  'the nav pills are cleared+hidden otherwise (learner card, or a drill)');
assert.ok(/backBtn\.style\.display = lesson\._drill \? 'none' : ''/.test(html),
  'Back-to-story is hidden for a drill (v60)');
// afterComplete (a drill's Next) restores the real topic then returns to the story.
const afterC = ext(html, 'afterComplete');
assert.ok(/endDrill\(\);/.test(afterC) && /compBackToStory\(\)/.test(afterC),
  'afterComplete restores the real topic and returns to the story');
// Nothing writes the drill into the saved lesson set.
assert.ok(!/lessons\.push\(drill\)/.test(html) && !/upsert\(.*drill/.test(html),
  'the drill is never appended to a saved topic');

// ── v54_c: `_wrongTargets` is PER ROUND, not per session ─────────────────────
// It was created lazily on the first wrong answer and never cleared, so it accumulated across every
// lesson played. `recordLearnedFromLesson` tests `wrongTargets.has(target)`, and that test WINS over
// the drill's decrement (`else if(lesson._drill)`). So drilling a word you had missed earlier in the
// session INCREMENTED its wrong count instead of walking it down: the drill could never clear a
// mistake, and every attempt inflated it further. Single-call tests all passed; only a SEQUENCE of
// rounds sharing one `APP.cur` exposes it.
{
  assert.ok(/delete C\._wrongTargets;/.test(ext(html, 'startLesson')),
    'startLesson clears the per-round wrong-target set');

  const APP = { lang: 'de', srcLang: 'en', lessonData: { lang: 'de', srcLang: 'en' },
                progress: { learned: {} }, cur: {} };
  const rec = new Function('APP', 'saveProg', 'stripFuri',
    ext(html, '_learnedLedger') + '\n' + ext(html, 'recordLearnedFromLesson') + '\nreturn recordLearnedFromLesson;'
  )(APP, () => {}, (s) => s);
  const C = APP.cur;
  const led = () => APP.progress.learned['de|en'].vocab;
  const startRound = () => { delete C._wrongTargets; };   // exactly what startLesson now does

  startRound(); C._wrongTargets = new Set(['Hund']);
  rec({ type: 'standard', vocab: [{ target: 'Hund', source: 'dog' }, { target: 'Katze', source: 'cat' }] }, C._wrongTargets);
  assert.strictEqual(led().Hund.wrong, 1, 'a mistake is recorded');

  // A later round answered perfectly must not re-mark the earlier mistake.
  startRound();
  rec({ type: 'mixed' }, C._wrongTargets);
  assert.strictEqual(led().Hund.wrong, 1, 'a clean mixed round does not re-mark an earlier mistake');
  assert.strictEqual(led().Katze.wrong, 0, 'and never invents one');

  // The drill, answered correctly, walks it down. This is the assertion that failed before the fix.
  startRound();
  rec({ type: 'standard', _drill: true, vocab: [{ target: 'Hund', source: 'dog' }] }, C._wrongTargets);
  assert.strictEqual(led().Hund.wrong, 0, 'drilling a word correctly clears it (decrement beats a stale set)');

  // …and getting it wrong in the drill puts it back.
  startRound(); C._wrongTargets = new Set(['Hund']);
  rec({ type: 'standard', _drill: true, vocab: [{ target: 'Hund', source: 'dog' }] }, C._wrongTargets);
  assert.strictEqual(led().Hund.wrong, 1, 'a fresh mistake in the drill re-marks it');
}

// ── The entry point exists and is labelled from ui.json (en-only, per protocol) ──
assert.ok(/id="comp-drill"[^>]*onclick="startDrill\(\)"/.test(html), 'result card carries the drill button');
assert.ok(/style="display:none/.test(html.match(/<button[^>]*id="comp-drill"[^>]*>/)[0]),
  'the button is hidden until availability is computed');
assert.ok(/_db\.style\.display = \(\(_teacher \|\| _belowThreshold\) && drillAvailable\(_l, _s\)\) \? '' : 'none';/.test(html),
  'drill shows for a teacher OR a below-threshold learner, when a round can be built (v60.8)');
// Anchor on the CALL, not the bare name: showComplete's own comments mention
// recordLearnedFromLesson, so indexOf() on the name matched a comment — a guard that only looked
// like one, and it passed a mutation that moved the block above the ledger update.
const showC = ext(html, 'showComplete');
const _recordCall = showC.indexOf('recordLearnedFromLesson(lesson, C._wrongTargets)');
const _drillCall  = showC.indexOf('drillAvailable(');
assert.ok(_recordCall > 0 && _drillCall > 0, 'both calls live inside showComplete');
assert.ok(_recordCall < _drillCall,
  "availability is computed AFTER the ledger update, so this round's mistakes count");

const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
for (const k of ['drill.title', 'drill.desc', 'drill.cta', 'drill.empty']) {
  assert.ok(ui.en[k], `ui.json en has ${k}`);
}
// NOTE: this used to assert the drill keys were en-ONLY, as a reminder that they were owed a
// TranslateGemma pass. The user ran that pass (2026-07-16) and they are now translated into 26+
// languages, so the assertion was asserting a temporary state and has been dropped — the durable
// invariant is just that the en source key exists. Don't re-add an en-only check for new keys:
// pending-translation debt belongs in the roadmap/notes, not in a test that fails on success.

console.log(`  drill: size=${DRILL_SIZE} floor=${DRILL_MIN}; wrong-first + padding, deterministic, refuses when unbuildable`);
console.log('  ephemeral (no topic completion, restores on exit); re-learning decrements only inside a drill');
console.log('unit-drill: ALL PASSED');
