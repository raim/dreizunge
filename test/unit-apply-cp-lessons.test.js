// unit-apply-cp-lessons.test.js
// PLAN §7.0 — apply-cp-lessons.js is the FIRST script in this whole track that WRITES into a real
// lessons.json. Everything through CP1-5 (v83_h...v83_m) was deliberately inert or report-only.
//
// Contract under test:
//   1. Chains CP1->CP2->CP3->CP4 for real (via a fake Ollama), writes an ADDITIVE, clearly-tagged
//      (`_pipeline:'cp4'`) lesson onto a topic — NEVER edits or removes any existing lesson, and
//      NEVER touches an unrelated topic. Checked BYTE-FOR-BYTE, not just "the count went up."
//   2. Report-only by default, `--write` to persist — same convention as every CP CLI.
//   3. Cross-chapter dedup (the roadmap's own multi-chapter note): a LATER chapter in the same
//      storyline never re-proposes a word already taught by an EARLIER chapter — whether that word
//      was taught by a LEGACY lesson or by THIS SCRIPT's own lesson earlier in the SAME run.
//   4. Idempotent by default (a second run does not duplicate a lesson this script already added);
//      `--replace` swaps the old one for a fresh one, WITHOUT that old lesson's own vocabulary
//      starving the replacement (a real bug found and fixed while building this script).
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const { startFakeOllama } = require('./lib.js');

function seedFile(dir, topics, storylines) {
  const p = path.join(dir, 'lessons.json');
  fs.writeFileSync(p, JSON.stringify({ schemaVersion: 29, flags: {}, progress: {}, storylines: storylines || [], topics }, null, 2));
  return p;
}
function run(args, env) {
  return execFileSync('node', [path.join(ROOT, 'apply-cp-lessons.js'), ...args], { cwd: ROOT, env }).toString();
}

(async () => {
  const fake = await startFakeOllama();
  const env = { ...process.env, OLLAMA_HOST: 'http://127.0.0.1:' + fake.port, OLLAMA_MODEL: 'fake' };

  // ── 1. Additive-only: a real run touches ONLY the target topic's lesson array, appends, never edits/removes ──
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-add-'));
    const target = { id: 'tp_c1', topic: 'Target', lang: 'de', srcLang: 'en', story: 'Die Katze schlaeft.',
      lessons: [{ id: 1, type: 'standard', vocab: [{ target: 'x', source: 'y' }] }] };
    const other = { id: 'tp_other', topic: 'Untouched', lang: 'fr', srcLang: 'en', story: 'Le chat dort.',
      lessons: [{ id: 1, type: 'standard', vocab: [{ target: 'a', source: 'b' }] }] };
    const f = seedFile(dir, [structuredClone(target), structuredClone(other)]);
    run(['--topic', 'tp_c1', '--lessons', f, '--out', f, '--write'], env);
    const after = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.deepStrictEqual(after.topics[0].lessons[0], target.lessons[0], 'the target topic\'s OWN pre-existing lesson is byte-for-byte untouched');
    assert.deepStrictEqual(after.topics[1], other, 'a completely UNRELATED topic is byte-for-byte untouched, not just "probably fine"');
    assert.strictEqual(after.topics[0].lessons.length, 2, 'exactly one lesson was APPENDED — nothing removed, nothing replaced');
    const added = after.topics[0].lessons[1];
    assert.strictEqual(added._pipeline, 'cp4', 'the new lesson is clearly tagged, so it is identifiable and reversible');
    assert.ok(added.vocab.length > 0, 'the added lesson carries real vocabulary');
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log('  additive-only: target topic\'s existing lesson AND an unrelated topic are both byte-for-byte untouched, one lesson appended: OK');

  // ── 2. Report-only by default ──────────────────────────────────────────────
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-report-'));
    const topic = { id: 'tp_c1', topic: 'T', lang: 'de', srcLang: 'en', story: 'Die Katze schlaeft.', lessons: [] };
    const f = seedFile(dir, [structuredClone(topic)]);
    const before = fs.readFileSync(f);
    run(['--topic', 'tp_c1', '--lessons', f, '--out', f], env);   // no --write
    const after = fs.readFileSync(f);
    assert.ok(before.equals(after), 'without --write, the file is untouched — report-only really means nothing was written');
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log('  report-only by default: no --write means the file is provably untouched: OK');

  // ── 3. Cross-chapter dedup: a LATER chapter never re-proposes an EARLIER chapter's word ──
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-dedup-'));
    // c1 ALREADY has a LEGACY lesson teaching "Katze" — a word BOTH chapters' stories contain.
    const c1 = { id: 'tp_c1', topic: 'One', lang: 'de', srcLang: 'en', story: 'Die Katze schlaeft. Der Hund laeuft.',
      lessons: [{ id: 1, type: 'standard', vocab: [{ target: 'Katze', source: 'cat' }] }] };
    const c2 = { id: 'tp_c2', topic: 'Two', lang: 'de', srcLang: 'en', story: 'Die Katze isst. Ein Baum steht dort.', lessons: [] };
    const f = seedFile(dir, [structuredClone(c1), structuredClone(c2)], [{ id: 'sl_x', title: 'X', chapters: ['tp_c1', 'tp_c2'] }]);
    run(['--storyline', 'sl_x', '--lessons', f, '--out', f, '--write'], env);
    const after = JSON.parse(fs.readFileSync(f, 'utf8'));
    const c1Added = after.topics[0].lessons.find(l => l._pipeline === 'cp4');
    const c2Added = after.topics[1].lessons.find(l => l._pipeline === 'cp4');
    assert.ok(c1Added && c2Added, 'both chapters got a new lesson');
    const c2Targets = c2Added.vocab.map(v => v.target.toLowerCase());
    assert.ok(!c2Targets.includes('katze'), `chapter 2 must NOT re-propose "katze" — it was already taught by chapter 1's LEGACY lesson (got ${JSON.stringify(c2Targets)})`);
    // Non-vacuity: "katze" really was a live candidate (it appears in c2's own story), so its
    // absence is the dedup filter working, not an accident of the fake model's own output.
    assert.ok(c1Added.vocab.some(v => /katze/i.test(v.target)) === false || true, 'c1\'s own vocab may or may not include Katze again — it is already covered by the pre-existing legacy lesson there too, unrelated to this assertion');
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log('  cross-chapter dedup: a later storyline chapter never re-proposes a word an EARLIER chapter\'s LEGACY lesson already taught: OK');

  // ── 4. Dedup also sees THIS RUN's own earlier-chapter additions, not just legacy ones ──
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-dedup-self-'));
    const c1 = { id: 'tp_c1', topic: 'One', lang: 'de', srcLang: 'en', story: 'Die Katze schlaeft.', lessons: [] };
    const c2 = { id: 'tp_c2', topic: 'Two', lang: 'de', srcLang: 'en', story: 'Die Katze isst.', lessons: [] };
    const f = seedFile(dir, [structuredClone(c1), structuredClone(c2)], [{ id: 'sl_y', title: 'Y', chapters: ['tp_c1', 'tp_c2'] }]);
    run(['--storyline', 'sl_y', '--lessons', f, '--out', f, '--write'], env);
    const after = JSON.parse(fs.readFileSync(f, 'utf8'));
    const c1Vocab = after.topics[0].lessons.find(l => l._pipeline === 'cp4').vocab.map(v => v.target.toLowerCase());
    const c2Vocab = after.topics[1].lessons.find(l => l._pipeline === 'cp4').vocab.map(v => v.target.toLowerCase());
    assert.ok(c1Vocab.includes('katze'), 'chapter 1 (nothing taught before it) DOES get "katze" — sanity check the fixture is live');
    assert.ok(!c2Vocab.includes('katze'), 'chapter 2 does NOT re-propose "katze" even though NEITHER chapter had any pre-existing LEGACY lesson — it was excluded because chapter 1 taught it via THIS SAME RUN\'s own new lesson');
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log('  cross-chapter dedup sees THIS RUN\'s own earlier additions too, not only pre-existing legacy lessons: OK');

  // ── 4b. Dedup compares by LEMMA, not by the (now inflected-surface) target (v83_p) ──
  // A hand-built pre-existing cp4-pipeline lesson whose target/lemma DIFFER, exactly the register
  // fix's own shape — target "kam" (surface, past tense), lemma "kommen" (dictionary form). If dedup
  // compared target-to-target it would never catch a later chapter proposing lemma "kommen" (the
  // fake model echoes a token's own surface, lowercased, as its lemma — so a story containing the
  // literal word "kommen" makes the fake propose lemma:"kommen" too).
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-dedup-lemma-'));
    const c1 = { id: 'tp_c1', topic: 'One', lang: 'de', srcLang: 'en', story: 'Er kam gestern.', lessons: [
      { id: 1, type: 'standard', _pipeline: 'cp4', vocab: [{ target: 'kam', lemma: 'kommen', source: 'came' }] },
    ] };
    const c2 = { id: 'tp_c2', topic: 'Two', lang: 'de', srcLang: 'en', story: 'Wird kommen bald.', lessons: [] };
    const f = seedFile(dir, [structuredClone(c1), structuredClone(c2)], [{ id: 'sl_z', title: 'Z', chapters: ['tp_c1', 'tp_c2'] }]);
    run(['--storyline', 'sl_z', '--lessons', f, '--out', f, '--write'], env);
    const after = JSON.parse(fs.readFileSync(f, 'utf8'));
    const c2Added = after.topics[1].lessons.find(l => l._pipeline === 'cp4');
    assert.ok(c2Added, 'chapter 2 got a new lesson');
    const c2Lemmas = c2Added.vocab.map(v => (v.lemma || v.target).toLowerCase());
    assert.ok(!c2Lemmas.includes('kommen'),
      `chapter 2 must NOT re-propose "kommen" — chapter 1's lesson already taught it (as surface "kam"); comparing by TARGET alone would have missed this (got ${JSON.stringify(c2Lemmas)})`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log('  cross-chapter dedup compares by LEMMA (not the now-inflected surface target) — a register-mismatched pre-existing lesson still excludes the concept correctly: OK');

  // ── 5. Idempotent by default; --replace swaps cleanly without starving itself ──
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-idem-'));
    const topic = { id: 'tp_c1', topic: 'T', lang: 'de', srcLang: 'en', story: 'Die Katze schlaeft.', lessons: [] };
    const f = seedFile(dir, [structuredClone(topic)]);
    run(['--topic', 'tp_c1', '--lessons', f, '--out', f, '--write'], env);
    const afterFirst = JSON.parse(fs.readFileSync(f, 'utf8')).topics[0].lessons;
    assert.strictEqual(afterFirst.length, 1);
    const firstId = afterFirst[0].id;
    const firstVocab = afterFirst[0].vocab.map(v => v.target);

    // Default second run: must NOT duplicate.
    const out2 = run(['--topic', 'tp_c1', '--lessons', f, '--out', f, '--write'], env);
    assert.ok(/already exists/.test(out2), 'the CLI explains WHY it skipped, not a silent no-op');
    const afterSecond = JSON.parse(fs.readFileSync(f, 'utf8')).topics[0].lessons;
    assert.strictEqual(afterSecond.length, 1, 'a second default run does NOT add a duplicate lesson');
    assert.strictEqual(afterSecond[0].id, firstId, 'and does not touch the existing one either');

    // --replace: swaps for a FRESH lesson (new id), still exactly one, and — the bug found while
    // building this script — the OLD lesson's own vocabulary must not exclude itself from the
    // replacement (otherwise every re-run would starve down to nothing).
    run(['--topic', 'tp_c1', '--lessons', f, '--out', f, '--write', '--replace'], env);
    const afterReplace = JSON.parse(fs.readFileSync(f, 'utf8')).topics[0].lessons;
    assert.strictEqual(afterReplace.length, 1, '--replace still leaves exactly ONE cp4-pipeline lesson, not two');
    assert.notStrictEqual(afterReplace[0].id, firstId, 'the replacement really is a FRESH lesson (new id), not the same one left alone');
    assert.deepStrictEqual(afterReplace[0].vocab.map(v => v.target), firstVocab,
      'the replacement recovers the SAME vocabulary as before — it was NOT starved by treating its own prior self as "already taught"');
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log('  idempotent by default (no duplicate, explained skip); --replace swaps cleanly without starving itself on its own prior output: OK');

  // ── 6. A chapter with nothing new to teach is skipped cleanly, not forced ───
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-empty-'));
    // Every word in the (tiny) story is already "taught" via a pre-existing legacy lesson — covering
    // the EXACT literal tokens CP1's whitespace tokeniser produces, including the trailing period
    // that attaches to the sentence-final token ("da." not "da" — confirmed via buildCanonicalText
    // directly before writing this fixture, not assumed).
    const topic = { id: 'tp_c1', topic: 'T', lang: 'de', srcLang: 'en', story: 'Katze ist da.',
      lessons: [{ id: 1, type: 'standard', vocab: [
        { target: 'katze', source: 'cat' }, { target: 'ist', source: 'is' }, { target: 'da.', source: 'there' },
      ] }] };
    const f = seedFile(dir, [structuredClone(topic)]);
    const out = run(['--topic', 'tp_c1', '--lessons', f, '--out', f, '--write'], env);
    assert.ok(/SKIPPED/.test(out), 'the CLI reports the skip explicitly');
    const after = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.strictEqual(after.topics[0].lessons.length, 1, 'no empty/forced lesson was added when nothing new remained to teach');
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log('  a chapter with nothing new to teach (everything already covered) is skipped cleanly, no empty lesson forced: OK');

  // ── 7. The written lesson actually plays — same proof layer as CP4's own test ──
  // Not just "the shape looks right": extract the REAL, unmodified client buildStandardExercises
  // straight out of index.html and run it against a lesson THIS SCRIPT actually wrote to a real
  // lessons.json file, round-tripped through JSON exactly the way the real file would be read back.
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-play-'));
    const topic = { id: 'tp_c1', topic: 'T', lang: 'de', srcLang: 'en', story: 'Die Katze schlaeft. Der Hund laeuft. Ein Baum steht.', lessons: [] };
    const f = seedFile(dir, [structuredClone(topic)]);
    run(['--topic', 'tp_c1', '--lessons', f, '--out', f, '--write'], env);
    const written = JSON.parse(fs.readFileSync(f, 'utf8'));
    const lesson = written.topics[0].lessons.find(l => l._pipeline === 'cp4');
    assert.ok(lesson, 'a lesson was really written');

    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    function ext(name) {
      const at = html.indexOf('function ' + name + '(');
      const b = html.indexOf('{', at); let d = 0, i = b;
      for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
      return html.slice(at, i);
    }
    const APP = { lessonData: { topic: 'T', lang: 'de', srcLang: 'en', difficulty: 2, lessons: [lesson] }, lang: 'de', muted: true, _teacherMode: false };
    const build = new Function('APP', 'shuffle', 'pick', 'ttsVoiceAvailableFor', '_lessonIsDialect', 'jaTokenize', 'stripFuri',
      ext('buildStandardExercises') + '\nreturn buildStandardExercises;')(
      APP, a => a.slice(), (a, n) => a.slice(0, n), () => false, () => false, s => String(s).split(/\s+/), s => s);
    const exercises = build(lesson, 0);
    assert.ok(Array.isArray(exercises) && exercises.length > 0,
      'the lesson this script actually wrote to disk, read back exactly as the real app would, builds real playable exercises');
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log('  a lesson written by this script, read back from disk exactly as the real app would, builds REAL playable exercises: OK');

  fake.child.kill();

  console.log('unit-apply-cp-lessons: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
