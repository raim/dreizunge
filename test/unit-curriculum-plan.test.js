// unit-curriculum-plan.test.js
// PLAN §7.0 CP3 (user: "ok for CP3", asked for by name immediately after CP2 shipped at v83_i) —
// proposed curriculum plan, still REPORT-ONLY.
//
// Contract under test:
//   1. `curriculum-plan.js` is standalone (no server.js dependency) AND makes NO model call of its
//      own — it is a deterministic transform of CP2's already-model-derived output, aggregating and
//      ordering facts CP2 established rather than proposing new ones.
//   2. Concepts are aggregated PER LEMMA (vocab) / PER PHRASE STRING (phrase) across every sentence
//      in a chapter — a lemma occurring five times is ONE concept with frequency 5, not five.
//   3. `suitableFamilies` and `planReason` are derived from EVIDENCE already in the CP2 record
//      (multiple distinct forms, a "verb" form string, a low-confidence occurrence) — never guessed.
//   4. Prerequisites: a phrase concept depends on the vocab concepts (if proposed) covering its own
//      constituent tokens' lemmas — "teach the parts before the whole" — and ORDERING respects that
//      even when raw frequency alone would sort the phrase first.
//   5. `compareWithExistingLessons` is READ-ONLY against a lessons.json topic's already-generated
//      lessons — never writes anything, and is exercised behaviourally through the real CLI too.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const cp3 = require(path.join(ROOT, 'curriculum-plan.js'));

// ── 1. Standalone module: no server.js dependency, no model call ─────────────
{
  const modSrc = fs.readFileSync(path.join(ROOT, 'curriculum-plan.js'), 'utf8');
  assert.ok(!/require\(['"]\.\/server\.js['"]\)/.test(modSrc),
    'curriculum-plan.js does NOT require server.js — that would bind an HTTP port as a side effect');
  assert.ok(!/require\(['"]\.\/llm\.js['"]\)/.test(modSrc),
    'curriculum-plan.js makes NO model call of its own — it aggregates CP2\'s already-derived facts, unlike CP2 itself');
  assert.ok(!modSrc.includes('http.createServer') && !modSrc.includes('.listen('), 'no server-binding code exists in the module');
}
console.log('  curriculum-plan.js: standalone, no server.js dependency, no model call of its own: OK');

// A small, hand-built CP2-shaped fixture reused across several sections below: two vocab lemmas
// (one recurring in TWO different forms, one recurring but always the same form, one appearing
// once) and one phrase spanning the first sentence's two vocab tokens.
function fixtureChapter() {
  return {
    chapterId: 'tp_fix', lang: 'de',
    sentences: [
      { sentenceId: 'tp_fix:s0', tokens: [
          { tokenId: 'tp_fix:s0:t0', lemma: 'nehmen', form: 'verb, inf.', sense: 'to take', confidence: 'high' },
          { tokenId: 'tp_fix:s0:t1', lemma: 'Sorge', form: 'noun', sense: 'care', confidence: 'high' },
        ], phrases: [
          { tokenIds: ['tp_fix:s0:t0', 'tp_fix:s0:t1'], lemma: 'sich kümmern um', gloss: 'to take care of', confidence: 'high' },
        ] },
      { sentenceId: 'tp_fix:s1', tokens: [
          { tokenId: 'tp_fix:s1:t0', lemma: 'nehmen', form: 'verb, 3sg pres.', sense: 'takes', confidence: 'low' },
          { tokenId: 'tp_fix:s1:t1', lemma: 'Haus', form: 'noun', sense: 'house', confidence: 'high' },
          { tokenId: 'tp_fix:s1:t2', lemma: null, form: null, sense: null, confidence: 'unresolved' },
        ], phrases: [] },
    ],
  };
}

// ── 2. extractVocabConcepts: aggregated per lemma, not per occurrence ─────────
{
  const concepts = cp3.extractVocabConcepts(fixtureChapter());
  assert.strictEqual(concepts.length, 3, 'THREE distinct lemmas (nehmen, Sorge, Haus) — the unresolved token contributes no concept');
  const nehmen = concepts.find(c => c.lemma === 'nehmen');
  assert.strictEqual(nehmen.frequency, 2, 'two occurrences of the same lemma aggregate into ONE concept with frequency 2, not two concepts');
  assert.deepStrictEqual(nehmen.sourceSpans, ['tp_fix:s0:t0', 'tp_fix:s1:t0'], 'sourceSpans lists every occurrence\'s real tokenId');
  assert.strictEqual(nehmen.sense, 'to take', 'the HIGH-confidence occurrence\'s sense is preferred over the low-confidence one');
  assert.strictEqual(nehmen.confidence, 'low', 'ANY low-confidence occurrence pulls the whole concept\'s confidence down — nothing is silently averaged away');
  const sorge = concepts.find(c => c.lemma === 'Sorge');
  assert.strictEqual(sorge.confidence, 'high', 'a lemma with only high-confidence occurrences stays high');
}
console.log('  extractVocabConcepts: aggregated per lemma, sourceSpans complete, confidence rolls up conservatively (any low pulls the whole concept down): OK');

// ── 3. suitableFamilies / planReason: evidence-derived, not guessed ──────────
{
  const concepts = cp3.extractVocabConcepts(fixtureChapter());
  const nehmen = concepts.find(c => c.lemma === 'nehmen');
  assert.deepStrictEqual(nehmen.suitableFamilies, ['standard', 'word_forms', 'inflections', 'conjugation'],
    'TWO distinct forms triggers word_forms/inflections; a "verb" form string triggers conjugation — both are evidence in the record, not a guess');
  assert.ok(/2 distinct forms/.test(nehmen.planReason) && /low-confidence/.test(nehmen.planReason),
    'planReason names the SPECIFIC evidence (distinct forms, low-confidence occurrence), not a generic label');
  const haus = concepts.find(c => c.lemma === 'Haus');
  assert.deepStrictEqual(haus.suitableFamilies, ['standard'], 'a single-form noun with no verb evidence gets ONLY the plain vocab family — no guessed grammar/conjugation family');
}
console.log('  suitableFamilies/planReason: derived from evidence already in the CP2 record, never guessed beyond it: OK');

// ── 4. Phrase concepts + prerequisites: "teach the parts before the whole" ───
{
  const chapter = fixtureChapter();
  const vocabConcepts = cp3.extractVocabConcepts(chapter);
  const phraseConcepts = cp3.extractPhraseConcepts(chapter);
  assert.strictEqual(phraseConcepts.length, 1);
  const phrase = phraseConcepts[0];
  assert.strictEqual(phrase.lemma, 'sich kümmern um');
  assert.strictEqual(phrase.sense, 'to take care of', 'a phrase concept\'s sense is the model\'s own gloss');
  cp3.linkPhrasePrerequisites(vocabConcepts, phraseConcepts, chapter);
  const nehmenId = vocabConcepts.find(c => c.lemma === 'nehmen').conceptId;
  const sorgeId = vocabConcepts.find(c => c.lemma === 'Sorge').conceptId;
  assert.deepStrictEqual(new Set(phrase.prerequisites), new Set([nehmenId, sorgeId]),
    'the phrase\'s prerequisites are EXACTLY the vocab concepts covering its own constituent tokens\' lemmas');
}
console.log('  extractPhraseConcepts + linkPhrasePrerequisites: phrase concepts carry the model\'s gloss, prerequisites resolve to the real constituent vocab concept ids: OK');

// ── 5. orderConcepts: frequency/position order, but prerequisites ALWAYS come first ──
{
  // A phrase with frequency 5 and a constituent vocab word with frequency only 1 — raw frequency
  // order would put the phrase FIRST, but it must never be taught before its own component word.
  const highFreqPhrase = { conceptId: 'p1', type: 'phrase', frequency: 5, firstSentenceIdx: 0, prerequisites: ['v1'] };
  const lowFreqVocab = { conceptId: 'v1', type: 'vocab', frequency: 1, firstSentenceIdx: 3, prerequisites: [] };
  const unrelated = { conceptId: 'v2', type: 'vocab', frequency: 3, firstSentenceIdx: 1, prerequisites: [] };
  const ordered = cp3.orderConcepts([highFreqPhrase, lowFreqVocab, unrelated]);
  const posOf = id => ordered.findIndex(c => c.conceptId === id);
  assert.ok(posOf('v1') < posOf('p1'), 'the prerequisite (v1) is placed BEFORE its dependent (p1) even though p1 has far higher raw frequency');
  assert.deepStrictEqual(ordered.map(c => c.order), [0, 1, 2], 'order is a dense, 0-based index matching final position');
  // Non-vacuity: with NO prerequisite edges, order falls back to pure frequency-desc / position-asc.
  const plain = cp3.orderConcepts([
    { conceptId: 'a', frequency: 1, firstSentenceIdx: 0, prerequisites: [] },
    { conceptId: 'b', frequency: 3, firstSentenceIdx: 5, prerequisites: [] },
  ]);
  assert.deepStrictEqual(plain.map(c => c.conceptId), ['b', 'a'], 'with no prerequisites at all, higher frequency sorts first, exactly as CP1/CP2\'s own deterministic-by-construction style');
}
console.log('  orderConcepts: prerequisites are NEVER violated even against a large frequency advantage; falls back to plain frequency order otherwise: OK');

// ── 6. compareWithExistingLessons: read-only comparison against real lessons.json shape ──
{
  const vocabConcepts = [{ lemma: 'Haus' }, { lemma: 'Sorge' }, { lemma: 'nehmen' }];
  const topic = { lessons: [{ vocab: [{ target: 'Haus' }, { target: 'Baum' }] }, { vocab: [{ target: 'sorge' }] }] };
  const cmp = cp3.compareWithExistingLessons(vocabConcepts, topic);
  assert.strictEqual(cmp.proposedCount, 3);
  assert.strictEqual(cmp.coveredByExisting, 2, 'Haus and Sorge (case-insensitively) are already taught; nehmen is not');
  assert.deepStrictEqual(cmp.notCoveredByExisting, ['nehmen']);
  assert.deepStrictEqual(cmp.existingNotProposed, ['baum'], 'an existing vocab item CP3 never proposed shows up as a gap in the OTHER direction too');
  // Non-vacuity: no topic at all degrades to "nothing covered", not a throw.
  const empty = cp3.compareWithExistingLessons(vocabConcepts, null);
  assert.strictEqual(empty.coveredByExisting, 0);
}
console.log('  compareWithExistingLessons: case-insensitive, reports the gap in BOTH directions, degrades safely with no topic: OK');

// ── 7. buildCurriculumPlan: wires everything together, CP3-specific provenance ──
{
  const plan = cp3.buildCurriculumPlan(fixtureChapter(), { existingTopic: { lessons: [{ vocab: [{ target: 'Haus' }] }] } });
  assert.strictEqual(plan.chapterId, 'tp_fix');
  assert.strictEqual(plan.conceptCount, 4, '3 vocab + 1 phrase');
  assert.ok(plan.comparison, 'the comparison step ran because an existingTopic was supplied');
  assert.strictEqual(plan.provenance.stage, 'CP3');
  assert.strictEqual(plan.provenance.pipelineVersion, cp3.CP3_PIPELINE_VERSION);
  assert.ok(!('model' in plan.provenance), 'CP3 provenance carries NO model field — unlike CP2, no LLM call happened at this stage, same reasoning as CP1');
  assert.throws(() => cp3.buildCurriculumPlan(null), /chapterId is required/);
  assert.throws(() => cp3.buildCurriculumPlan({}), /chapterId is required/);
  // Without an existingTopic, no comparison is attempted at all (not an empty one — a caller can
  // tell "we didn't check" apart from "we checked and found zero overlap").
  const noCompare = cp3.buildCurriculumPlan(fixtureChapter());
  assert.ok(!('comparison' in noCompare), 'no existingTopic -> no comparison field at all, not a vacuous empty one');
}
console.log('  buildCurriculumPlan: end-to-end wiring correct, CP3-specific provenance (no model field), required fields enforced: OK');

// ── 8. build-curriculum-plan.js: CLI never writes canonical-analysis.json or lessons.json ──
// Full pipeline, chained for real: CP1 -> CP2 (via a fake Ollama, since CP2 alone needs a model
// call) -> CP3. Everything routed through --in/--out to scratch paths so this test never touches
// the real committed corpus files.
(async () => {
  const { startFakeOllama } = require('./lib.js');
  const fake = await startFakeOllama();
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp3-cli-'));
  const ctOut = path.join(scratchDir, 'canonical-text.json');
  const caOut = path.join(scratchDir, 'canonical-analysis.json');
  const cpOut = path.join(scratchDir, 'curriculum-plan.json');
  try {
    const cliSrc = fs.readFileSync(path.join(ROOT, 'build-curriculum-plan.js'), 'utf8');
    assert.ok(!/fs\.writeFileSync\(\s*(LESSONS|LESSONS_IN|CANONICAL_ANALYSIS|IN)\b/.test(cliSrc),
      'no write call in the CLI source targets its own inputs (canonical-analysis.json or lessons.json)');

    execFileSync('node', [path.join(ROOT, 'build-canonical-text.js'), '--limit', '1', '--write', '--out', ctOut], { cwd: ROOT });
    execFileSync('node', [path.join(ROOT, 'build-canonical-analysis.js'), '--limit', '1', '--in', ctOut, '--write', '--out', caOut], {
      cwd: ROOT, env: { ...process.env, OLLAMA_HOST: 'http://127.0.0.1:' + fake.port, OLLAMA_MODEL: 'fake' },
    });

    const beforeLessons = fs.readFileSync(path.join(ROOT, 'lessons.json'));
    const beforeCA = fs.readFileSync(caOut);   // CP3's OWN input — must survive being read
    execFileSync('node', [path.join(ROOT, 'build-curriculum-plan.js'), '--in', caOut, '--out', cpOut], { cwd: ROOT });
    assert.ok(!fs.existsSync(cpOut), 'report-only really writes nothing, not even to the scratch path');
    execFileSync('node', [path.join(ROOT, 'build-curriculum-plan.js'), '--in', caOut, '--write', '--out', cpOut], { cwd: ROOT });
    const afterLessons = fs.readFileSync(path.join(ROOT, 'lessons.json'));
    const afterCA = fs.readFileSync(caOut);
    assert.ok(beforeLessons.equals(afterLessons), 'the REAL, committed lessons.json is untouched — CP3 only ever READS it, for the comparison step');
    assert.ok(beforeCA.equals(afterCA), 'CP3\'s own input (CP2\'s canonical-analysis.json) is untouched after a --write run');

    const out = JSON.parse(fs.readFileSync(cpOut, 'utf8'));
    assert.strictEqual(out.chapterCount, 1);
    const plan = Object.values(out.chapters)[0];
    assert.ok(plan.conceptCount > 0, 'a real analysed chapter produces at least one concept');
    assert.ok(plan.comparison, 'the DEFAULT --lessons path (the real committed lessons.json) was used since --lessons was not overridden, so the comparison step ran');
    console.log('  build-curriculum-plan.js: full CP1->CP2->CP3 pipeline, real lessons.json read-only and provably untouched: OK');
  } finally {
    fake.child.kill();
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }

  console.log('unit-curriculum-plan: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
