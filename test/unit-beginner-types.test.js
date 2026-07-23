// unit-beginner-types.test.js
// v69.2 — beginner lessons restrict EXERCISE types (roadmap item, user 2026-07-14):
//   "In beginner mode, don't add lessons that require already knowing the word — only ones where
//    you pick a word from 4 options. And if listening mode is OFF, avoid lessons that require
//    already knowing the translation. Lessons with sound where you type the word you hear ARE fine."
// Implemented as a play-time policy in buildStandardExercises (where the exercise mix for a
// difficulty is chosen), because that is what actually decides what the learner is asked:
//   • `order` always drops at difficulty ≤ 1 — the shuffled word bank LOOKS like options, but
//     assembling a sentence is production and needs word order a beginner hasn't met;
//   • `listen_type` drops only when there is NO AUDIO (muted or voiceless): its muted render falls
//     back to type_translate ("show source, TYPE target") = recall production. With audio it stays,
//     exactly as the user allowed (transcription).
//   • Every 4-option MCQ survives in both audio states.
// Difficulty resolves lesson → topic → 2 (the same fallback the lesson list displays), so a
// beginner lesson inside a harder topic is still treated as beginner.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function ext(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing ' + name);
  const b = html.indexOf('{', at); let d = 0, i = b;
  for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
}

// Fixture sized so the FULL mix fits inside the builder's final .slice(0,12): 4 vocab + 2
// sentences yields exactly 12 (4 listen_mcq + 2 mcq_source_target + 2 order + 2 read_translate +
// 2 listen_type). With a larger fixture and the identity shuffle below, the slice would truncate
// the later types and the test would be asserting the cut, not the policy.
const vocab = Array.from({ length: 4 }, (_, i) => ({ target: 't' + i, source: 's' + i, pron: 'p' + i }));
const sentences = Array.from({ length: 2 }, (_, i) => ({
  target: 'aa' + i + ' bb' + i, source: 'src sentence ' + i, words: ['aa' + i, 'bb' + i],
}));

function buildWith({ difficulty, muted, voice }) {
  const lesson = { type: 'standard', vocab, sentences, ...(difficulty != null ? { difficulty } : {}) };
  const APP = {
    lessonData: { topic: 'T', lang: 'de', srcLang: 'en', difficulty: 2, lessons: [lesson] },
    lang: 'de', muted: !!muted, _teacherMode: false,
  };
  const shuffle = (a) => a.slice();                 // identity → deterministic
  const pick = (a, n) => a.slice(0, n);
  const ttsVoiceAvailableFor = () => !!voice;
  const _lessonIsDialect = () => false;
  const jaTokenize = (s) => String(s).split(/\s+/);
  const stripFuri = (s) => s;
  const fn = new Function('APP', 'shuffle', 'pick', 'ttsVoiceAvailableFor', '_lessonIsDialect',
    'jaTokenize', 'stripFuri',
    ext('buildStandardExercises') + '\nreturn buildStandardExercises;')(
    APP, shuffle, pick, ttsVoiceAvailableFor, _lessonIsDialect, jaTokenize, stripFuri);
  return new Set(fn(lesson, 0).map(e => e.type));
}

// ── 1. Beginner WITH audio: MCQs + listen-and-type; no sentence ordering ──────
{
  const types = buildWith({ difficulty: 1, muted: false, voice: true });
  assert.ok(!types.has('order'), 'beginner: sentence ordering is dropped (production, not a 4-option pick)');
  assert.ok(types.has('listen_type'), 'beginner + audio: "hear it, type it" stays (transcription — explicitly allowed)');
  for (const keep of ['listen_mcq', 'mcq_source_target', 'read_translate'])
    assert.ok(types.has(keep), `beginner keeps the 4-option type ${keep}`);
}
console.log('  beginner + audio: 4-option MCQs + listen-type kept, order dropped: OK');

// ── 2. Beginner with listening OFF (muted): the typed item goes too ───────────
{
  const muted = buildWith({ difficulty: 1, muted: true, voice: true });
  assert.ok(!muted.has('listen_type'),
    'beginner + muted: listen_type drops (its muted render is type_translate = recall production)');
  assert.ok(!muted.has('order'), 'order still dropped when muted');
  assert.ok(muted.has('mcq_source_target'), 'pick-from-four still available with sound off');
  // Same when the DEVICE has no voice (the other way listening is "off").
  const voiceless = buildWith({ difficulty: 1, muted: false, voice: false });
  assert.ok(!voiceless.has('listen_type') && !voiceless.has('listen_mcq'),
    'no voice: both audio types drop (v55_z) — including the typed one');
  assert.ok(voiceless.has('mcq_source_target'), 'voiceless beginners still get 4-option MCQs');
}
console.log('  beginner + listening off: typed item dropped, MCQs remain: OK');

// ── 3. Non-beginner is untouched (the policy is scoped to difficulty ≤ 1) ─────
{
  const inter = buildWith({ difficulty: 2, muted: false, voice: true });
  assert.ok(inter.has('order'), 'difficulty 2 keeps sentence ordering');
  assert.ok(inter.has('listen_type'), 'difficulty 2 keeps listen-type');
  const interMuted = buildWith({ difficulty: 2, muted: true, voice: true });
  assert.ok(interMuted.has('listen_type'), 'difficulty 2 keeps listen-type even when muted (unchanged behaviour)');
  const adv = buildWith({ difficulty: 3, muted: false, voice: true });
  assert.ok(adv.has('order'), 'difficulty 3 keeps sentence ordering');
}
console.log('  difficulty ≥ 2: exercise mix unchanged: OK');

// ── 4. Difficulty resolution: lesson → topic → default ────────────────────────
{
  // No lesson difficulty → the TOPIC's (2) applies → not beginner.
  const fromTopic = buildWith({ difficulty: null, muted: false, voice: true });
  assert.ok(fromTopic.has('order'), 'missing lesson difficulty falls back to the topic value');
  // The source states the fallback chain explicitly.
  const src = ext('buildStandardExercises');
  assert.ok(/const _diff = \(lesson && lesson\.difficulty\) \|\| \(d && d\.difficulty\) \|\| 2;/.test(src),
    'difficulty resolves lesson → topic → 2 (mirrors the lesson list display)');
  assert.ok(/_diff <= 1/.test(src), 'the policy is scoped to beginner difficulty');
}
console.log('  difficulty resolution lesson → topic → 2: OK');


// ── 5. v69.2c: rounds are coverage-aware; universe derivation stays EXACT ─────
// User-reported (third stuck report): a round was a RANDOM 12 of everything the lesson can ask, so
// replaying re-asked solved questions at random and coverage crawled (measured on the reported
// topic: a 29-question lesson needed 5+ perfect replays to reach 80%, while the drill can only
// ever cover wrong VOCAB words — never the sentence items). Rounds now prioritize unsolved
// questions (ratio 1: a review slot is a wasted question when closing a gap), and the universe
// enumeration sets APP._derivingUniverse so the builder returns its FULL set — otherwise the
// denominator would be derived from coverage-biased samples and could shrink.
{
  const src = ext('buildStandardExercises');
  assert.ok(/if \(APP\._derivingUniverse\) return _exs;/.test(src),
    'universe derivation gets the full, uncapped, unbiased set');
  assert.ok(/assembleCoverageRound\(_exs, 12, 1\)/.test(src),
    'a normal round is coverage-aware with an all-unsolved-first ratio');
  const uni = ext('_lessonQidUniverse');
  assert.ok(/APP\._derivingUniverse = true;/.test(uni) && /finally \{ APP\._derivingUniverse = _wasDeriving; \}/.test(uni),
    'the flag is set for the enumeration and always restored (nested-safe)');
  const asm = ext('assembleCoverageRound');
  assert.ok(/function assembleCoverageRound\(pool, size, unsolvedRatio\)/.test(asm),
    'the unsolved share is a parameter (mixed practice keeps its 0.7 blend)');
  assert.ok(/Math\.round\(N \* RATIO\)/.test(asm), 'the ratio actually drives the split');

  // Behavioral: with most questions solved, a round serves the UNSOLVED ones first. The fixture
  // must be able to build MORE than one round's worth (12) — otherwise every round is the whole
  // set and "leads with unsolved" is untestable. 8 vocab + 5 sentences at difficulty 2 builds ~20.
  const vocabN = Array.from({ length: 8 }, (_, i) => ({ target: 't' + i, source: 's' + i, pron: 'p' + i }));
  const sentN = Array.from({ length: 5 }, (_, i) => ({
    target: 'aa' + i + ' bb' + i, source: 'src ' + i, words: ['aa' + i, 'bb' + i] }));
  const lesson = { type: 'standard', difficulty: 2, vocab: vocabN, sentences: sentN };
  const APP = {
    lessonData: { topic: 'T', lang: 'de', srcLang: 'en', difficulty: 2, lessons: [lesson] },
    lang: 'de', muted: false, _teacherMode: false, progress: { solved: {} },
  };
  const shuffle = (a) => a.slice();
  const qid = (ex) => 'L:' + ex.type + ':' + (ex.target || ex.correct);
  const fn = new Function('APP', 'shuffle', 'pick', 'ttsVoiceAvailableFor', '_lessonIsDialect',
    'jaTokenize', 'stripFuri', 'qid',
    ext('_solvedMap') + '\n' + ext('assembleCoverageRound') + '\n' +
    ext('buildStandardExercises') + '\nreturn buildStandardExercises;')(
    APP, shuffle, (a, n) => a.slice(0, n), () => true, () => false,
    (x) => String(x).split(/\s+/), (x) => x, qid);

  APP._derivingUniverse = true;
  const buildable = fn(lesson, 0).length;
  APP._derivingUniverse = false;
  assert.ok(buildable > 12, `the fixture builds more than one round (${buildable}) — else this is untestable`);
  const first = fn(lesson, 0);
  assert.strictEqual(first.length, 12, 'a round is capped at 12');
  // Mark everything from the first round solved, then ask again: the new round must lead with
  // questions that were NOT in it (coverage-first), not re-serve the same set.
  const solved = APP.progress.solved['T'] = {};
  first.forEach(e => { solved[qid(e)] = 1; });
  const second = fn(lesson, 0);
  const reasked = second.filter(e => solved[qid(e)]).length;
  assert.ok(reasked < second.length,
    `a replay leads with unsolved questions (re-asked ${reasked}/${second.length})`);
}
console.log('  v69.2c: coverage-aware rounds + exact universe derivation: OK');

console.log('unit-beginner-types: ALL PASSED');
