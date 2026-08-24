// unit-curriculum-lesson.test.js
// PLAN §7.0 CP4 (user: "continue", immediately after CP3 shipped at v83_j) — one lesson family
// (vocabulary meaning/form) through the EXISTING contract. Still never writes lessons.json — a NEW,
// PARALLEL emission route, the legacy generator is untouched.
//
// Contract under test:
//   1. `curriculum-lesson.js` is standalone (no server.js dependency) AND makes NO model call — CP2
//      already proposed lemma/sense, CP3 already decided what's worth teaching; this stage packages
//      already-derived facts into the EXISTING lesson shape, it does not judge meaning again.
//   2. `emitVocabLesson` produces the SAME object shape server.js's own generateOneLesson does
//      (id/type/title/desc/icon/vocab/sentences), plus the plan's own mandatory provenance fields
//      (sourceSpans/planReason/pipelineVersion) CP1-3 have carried all along.
//   3. `validateLessonShape` enforces the SAME structural floor generateOneLesson enforces on its
//      own model output — never throws, reports instead (errors vs. warnings).
//   4. THE STRONGEST claim — "validate it" — is proven at the layer where it's actually observable:
//      a CP4-emitted lesson is run through the REAL, UNMODIFIED client-side buildStandardExercises
//      (extracted straight from index.html, the same pattern unit-beginner-types.test.js already
//      uses) and produces REAL playable exercises, not just a shape that looks right on paper.
//   5. `build-curriculum-lesson.js` (the CLI) reads CP3's OWN curriculum-plan.json and NEVER writes
//      to it or to lessons.json — asserted behaviourally through the real CP1->CP2->CP3->CP4 pipeline.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const cl = require(path.join(ROOT, 'curriculum-lesson.js'));

// ── 1. Standalone module: no server.js dependency, no model call ─────────────
{
  const modSrc = fs.readFileSync(path.join(ROOT, 'curriculum-lesson.js'), 'utf8');
  assert.ok(!/require\(['"]\.\/server\.js['"]\)/.test(modSrc),
    'curriculum-lesson.js does NOT require server.js — that would bind an HTTP port as a side effect');
  assert.ok(!/require\(['"]\.\/llm\.js['"]\)/.test(modSrc),
    'curriculum-lesson.js makes NO model call of its own — it packages CP2/CP3\'s already-derived facts');
  assert.ok(!modSrc.includes('http.createServer') && !modSrc.includes('.listen('), 'no server-binding code exists in the module');
}
console.log('  curriculum-lesson.js: standalone, no server.js dependency, no model call of its own: OK');

function fixturePlan(n) {
  n = n || 4;
  const words = ['Haus', 'Katze', 'Baum', 'Hund', 'Wasser', 'Buch', 'Tag', 'Nacht', 'Sonne', 'Mond'];
  const senses = ['house', 'cat', 'tree', 'dog', 'water', 'book', 'day', 'night', 'sun', 'moon'];
  return {
    chapterId: 'tp_fix', lang: 'de',
    concepts: Array.from({ length: n }, (_, i) => ({
      type: 'vocab', lemma: words[i], sense: senses[i], conceptId: 'tp_fix:concept:vocab:' + words[i],
      sourceSpans: ['tp_fix:s0:t' + i], planReason: `appears ${i + 1} time(s) in this sample`, order: i,
    })),
  };
}

// ── 2. emitVocabLesson: correct shape, capped, provenance carried forward ─────
{
  const lesson = cl.emitVocabLesson(fixturePlan(10), { lessonNum: 3 });
  assert.strictEqual(lesson.id, 3);
  assert.strictEqual(lesson.type, 'standard');
  assert.strictEqual(lesson.vocab.length, 8, 'capped at 8 — the SAME cap generateOneLesson applies to a model\'s own vocab list, for parity');
  assert.strictEqual(lesson.vocab[0].target, 'Haus'); assert.strictEqual(lesson.vocab[0].source, 'house');
  assert.strictEqual(lesson.vocab[0].conceptId, 'tp_fix:concept:vocab:Haus', 'each vocab item traces back to the exact CP3 concept it came from');
  assert.strictEqual(lesson.vocab[0].lemma, 'Haus', 'lemma is ALWAYS carried on the vocab item, even a concept with no separate surface field (where target falls back to the lemma too — see the register-consistency case below for when surface differs from lemma)');

  // v83_p: target is the SURFACE form (what the learner actually sees), not the dictionary lemma —
  // a real user report found the two mismatched in register ("kommen"/infinitive paired against
  // "venne"/past tense) one stage downstream of here. `lemma` is carried as ITS OWN field.
  const registerPlan = { chapterId: 'tp_reg', concepts: [
    { type: 'vocab', lemma: 'kommen', surface: 'kam', sense: 'came', conceptId: 'tp_reg:concept:vocab:kommen', sourceSpans: [], planReason: 'x' },
  ] };
  const registerLesson = cl.emitVocabLesson(registerPlan);
  assert.strictEqual(registerLesson.vocab[0].target, 'kam', 'target is the SURFACE form ("kam"), not the lemma ("kommen") — register-matched to the sense');
  assert.strictEqual(registerLesson.vocab[0].source, 'came', 'source stays the contextual sense, same tense as the target');
  assert.strictEqual(registerLesson.vocab[0].lemma, 'kommen', 'the dictionary lemma is still carried, as its own separate field — not lost, just not what is SHOWN as the primary word');
  assert.deepStrictEqual(lesson.sentences, [], 'sentences are deliberately empty at this stage — no new model call was made to translate one');
  assert.deepStrictEqual(lesson.skillLinks, [], 'skillLinks deliberately unresolved — real skill-registry integration is a later decision, not invented here');
  assert.strictEqual(lesson.sourceSpans.length, 8, 'sourceSpans carries every emitted concept\'s own real tokenIds forward');
  assert.strictEqual(lesson.planReason.length, 8, 'planReason is carried forward per concept, from CP3');
  assert.strictEqual(lesson.pipelineVersion, cl.CP4_PIPELINE_VERSION);
  assert.strictEqual(lesson.provenance.stage, 'CP4');
  assert.ok(!('model' in lesson.provenance), 'CP4 provenance carries NO model field — no LLM call happened at this stage, same reasoning as CP1/CP3');

  const custom = cl.emitVocabLesson(fixturePlan(4), { maxItems: 2, title: 'Custom', desc: 'D' });
  assert.strictEqual(custom.vocab.length, 2, 'maxItems is respected when smaller than the default');
  assert.strictEqual(custom.title, 'Custom'); assert.strictEqual(custom.desc, 'D');

  assert.throws(() => cl.emitVocabLesson(null), /chapterId is required/);
  assert.throws(() => cl.emitVocabLesson({ chapterId: 'x', concepts: [{ type: 'phrase', lemma: 'p' }] }), /no vocab concepts to teach/,
    'a plan with only PHRASE concepts (no vocab) refuses rather than emitting an empty vocab lesson');
}
console.log('  emitVocabLesson: correct shape, capped at 8 for parity with generateOneLesson, provenance/sourceSpans/planReason carried forward, empty-plan refused: OK');

// ── 3. validateLessonShape: same structural floor as generateOneLesson, reports rather than throws ──
{
  const good = cl.emitVocabLesson(fixturePlan(4));
  const v = cl.validateLessonShape(good);
  assert.strictEqual(v.valid, true); assert.deepStrictEqual(v.errors, []);

  const empty = cl.validateLessonShape({ vocab: [], sentences: [] });
  assert.strictEqual(empty.valid, false);
  assert.ok(empty.errors.some(e => /non-empty array/.test(e)));

  const dup = cl.validateLessonShape({ vocab: [{ target: 'Haus', source: 'house' }, { target: 'haus', source: 'HOUSE' }], sentences: [] });
  assert.strictEqual(dup.valid, false, 'a case-insensitive duplicate target is a real error, not silently tolerated');
  assert.ok(dup.errors.some(e => /duplicate target/.test(e)));

  const blank = cl.validateLessonShape({ vocab: [{ target: '', source: 'house' }], sentences: [] });
  assert.ok(blank.errors.some(e => /target is empty/.test(e)));

  // Identical source/target is an ADVISORY warning, not a hard failure (server.js's own leniency
  // for close language pairs depends on a table this module deliberately does not duplicate).
  const identical = cl.validateLessonShape({
    vocab: [{ target: 'Pizza', source: 'Pizza' }, { target: 'Pasta', source: 'Pasta' }, { target: 'Cafe', source: 'Cafe' }],
    sentences: [],
  });
  assert.strictEqual(identical.valid, true, 'identical source/target alone does not fail validation — it is reported, not judged');
  assert.strictEqual(identical.warnings.length, 1);
  assert.ok(identical.identicalRatio === 1);

  const noSentencesArray = cl.validateLessonShape({ vocab: [{ target: 'a', source: 'b' }] });
  assert.strictEqual(noSentencesArray.valid, false, 'sentences must be an array (even if empty) — missing entirely is a real error');

  assert.doesNotThrow(() => cl.validateLessonShape(null), 'validateLessonShape never throws, even on garbage input — it reports');
  assert.strictEqual(cl.validateLessonShape(null).valid, false);
}
console.log('  validateLessonShape: same structural floor as generateOneLesson (dedup/non-empty), identical-ratio is advisory not blocking, never throws: OK');

// ── 4. THE key claim: a CP4-emitted lesson builds REAL exercises through the UNMODIFIED client ──
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  function ext(name) {
    const at = html.indexOf('function ' + name + '(');
    assert.ok(at >= 0, 'missing ' + name + ' in index.html');
    const b = html.indexOf('{', at); let d = 0, i = b;
    for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
    return html.slice(at, i);
  }
  const lesson = cl.emitVocabLesson(fixturePlan(4), { lessonNum: 1 });
  const APP = { lessonData: { topic: 'T', lang: 'de', srcLang: 'en', difficulty: 2, lessons: [lesson] }, lang: 'de', muted: true, _teacherMode: false };
  const shuffle = a => a.slice();
  const pick = (a, n) => a.slice(0, n);
  const ttsVoiceAvailableFor = () => false;
  const _lessonIsDialect = () => false;
  const jaTokenize = s => String(s).split(/\s+/);
  const stripFuri = s => s;
  const build = new Function('APP', 'shuffle', 'pick', 'ttsVoiceAvailableFor', '_lessonIsDialect', 'jaTokenize', 'stripFuri',
    ext('buildStandardExercises') + '\nreturn buildStandardExercises;')(APP, shuffle, pick, ttsVoiceAvailableFor, _lessonIsDialect, jaTokenize, stripFuri);
  const exercises = build(lesson, 0);
  assert.ok(Array.isArray(exercises) && exercises.length > 0, 'the REAL, unmodified client builds at least one exercise from a CP4-emitted lesson — this is what "validate it" actually proves');
  exercises.forEach(ex => {
    assert.ok(ex.type, 'every built exercise has a real exercise type');
    assert.ok(ex.target && ex.source, 'every built exercise carries the real target/source text CP4 emitted, not placeholders');
  });
  const targets = new Set(lesson.vocab.map(v => v.target));
  assert.ok(exercises.every(ex => targets.has(ex.target) || targets.has(ex.correct)),
    'every exercise traces back to a vocab item CP4 actually emitted — nothing was invented by the builder');
}
console.log('  a CP4-emitted lesson builds REAL playable exercises through the UNMODIFIED client buildStandardExercises: OK (the actual "validate it" proof)');

// ── 5. build-curriculum-lesson.js: full CP1->CP2->CP3->CP4 pipeline, never writes anyone else's store ──
(async () => {
  const { startFakeOllama } = require('./lib.js');
  const fake = await startFakeOllama();
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-cli-'));
  const ctOut = path.join(scratchDir, 'canonical-text.json');
  const caOut = path.join(scratchDir, 'canonical-analysis.json');
  const cpOut = path.join(scratchDir, 'curriculum-plan.json');
  const clOut = path.join(scratchDir, 'curriculum-lesson.json');
  try {
    const cliSrc = fs.readFileSync(path.join(ROOT, 'build-curriculum-lesson.js'), 'utf8');
    assert.ok(!/fs\.writeFileSync\(\s*(LESSONS|CURRICULUM_PLAN|IN)\b/.test(cliSrc),
      'no write call in the CLI source targets its own input or the lessons store');
    assert.ok(!cliSrc.includes("require('./server.js')") && !cliSrc.includes('require("./server.js")'),
      'the CLI itself does not require server.js either');

    execFileSync('node', [path.join(ROOT, 'build-canonical-text.js'), '--limit', '1', '--write', '--out', ctOut], { cwd: ROOT });
    execFileSync('node', [path.join(ROOT, 'build-canonical-analysis.js'), '--limit', '1', '--in', ctOut, '--write', '--out', caOut], {
      cwd: ROOT, env: { ...process.env, OLLAMA_HOST: 'http://127.0.0.1:' + fake.port, OLLAMA_MODEL: 'fake' },
    });
    execFileSync('node', [path.join(ROOT, 'build-curriculum-plan.js'), '--in', caOut, '--write', '--out', cpOut], { cwd: ROOT });

    const beforeLessons = fs.readFileSync(path.join(ROOT, 'lessons.json'));
    const beforePlan = fs.readFileSync(cpOut);
    execFileSync('node', [path.join(ROOT, 'build-curriculum-lesson.js'), '--in', cpOut, '--out', clOut], { cwd: ROOT });
    assert.ok(!fs.existsSync(clOut), 'report-only really writes nothing, not even to the scratch path');
    execFileSync('node', [path.join(ROOT, 'build-curriculum-lesson.js'), '--in', cpOut, '--write', '--out', clOut], { cwd: ROOT });
    const afterLessons = fs.readFileSync(path.join(ROOT, 'lessons.json'));
    const afterPlan = fs.readFileSync(cpOut);
    assert.ok(beforeLessons.equals(afterLessons), 'the REAL, committed lessons.json is completely untouched — CP4 is a PARALLEL route, not a replacement');
    assert.ok(beforePlan.equals(afterPlan), 'CP4\'s own input (CP3\'s curriculum-plan.json) is untouched after a --write run');

    const out = JSON.parse(fs.readFileSync(clOut, 'utf8'));
    assert.strictEqual(out.chapterCount, 1);
    const chapterResult = Object.values(out.chapters)[0];
    assert.strictEqual(chapterResult.lessons.length, 1);
    assert.ok(chapterResult.validation.valid, 'a real, full-pipeline-produced lesson passes its own validation');
    console.log('  build-curriculum-lesson.js: full CP1->CP2->CP3->CP4 pipeline, lessons.json and curriculum-plan.json both provably untouched: OK');
  } finally {
    fake.child.kill();
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }

  console.log('unit-curriculum-lesson: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
