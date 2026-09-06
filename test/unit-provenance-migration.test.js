// unit-provenance-migration.test.js
// v90_b (audit follow-up) — backfill-provenance.js is RUN, not read.
//
// Why this file exists. `unit-story-stamp` §8 ("the migration script's safety rails") and
// `unit-translation-stamp` §4 asserted this script entirely as SOURCE TEXT: the string
// `copyFileSync(FILE, FILE + '.bak')` appears, the string `dry run` appears, `function
// flagValue(flag, i)` is declared. The v90_b mutation audit replaced the bodies of
// `classifyOrigin`, `flagValue` and `stampTranslationMeta` with constants and every one of the 360
// checks stayed green — the script could have started mislabelling every story's origin, dropping a
// `--resolve`, and writing no translation stamps at all, and the suite would have said nothing.
//
// It is not dead code. It still takes `--write`, `--verify`, `--resolve`, `--assume` and
// `--set-model`, and its rails are what stand between a re-run and a corrupted `lessons.json`:
// a dry run by default, a `.bak` before saving, a refusal to write with unstamped topics or
// untagged model names, and a flag that cannot silently swallow the next flag as its value.
//
// ⚠️ It reads `path.join(__dirname, 'lessons.json')` — no env override — so the harness COPIES the
// script into a temp directory beside a synthetic store and runs it there. That is also why this is
// a separate file rather than two more blocks in the stamp tests: one harness, not two.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT_SRC = path.join(ROOT, 'backfill-provenance.js');

let caseNo = 0;
// Returns { code, out, err, store, bak } — `store` is the file as the script left it.
function run(topics, storylines, args = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `dz_mig_${process.pid}_${caseNo++}_`));
  fs.copyFileSync(SCRIPT_SRC, path.join(dir, 'backfill-provenance.js'));
  const file = path.join(dir, 'lessons.json');
  const before = JSON.stringify({ schemaVersion: 30, topics, storylines: storylines || [] }, null, 2);
  fs.writeFileSync(file, before);
  let code = 0, out = '', err = '';
  try {
    out = execFileSync(process.execPath, [path.join(dir, 'backfill-provenance.js'), ...args],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    code = e.status; out = String(e.stdout || ''); err = String(e.stderr || '');
  }
  const after = fs.readFileSync(file, 'utf8');
  const res = {
    code, out, err, before, after,
    unchanged: after === before,
    store: JSON.parse(after),
    bak: fs.existsSync(file + '.bak') ? fs.readFileSync(file + '.bak', 'utf8') : null,
  };
  fs.rmSync(dir, { recursive: true, force: true });   // ~20 runs per suite pass; do not litter /tmp
  return res;
}
const T = (over) => ({ id: 'tp_1', topic: 'A Topic', lang: 'it', srcLang: 'de', story: 'text', ...over });
const byId = (r, id) => r.store.topics.find(t => t.id === id);

// ── 1. Dry run is the default, and it means the file is not touched ──────────────
{
  const r = run([T({ generationStats: { model: 'qwen2.5:7b' } })]);
  assert.strictEqual(r.code, 0, 'a dry run succeeds');
  assert.ok(/dry run/.test(r.out), 'and says it was one');
  assert.ok(r.unchanged, 'the store is byte-identical after a run with no flags');
  assert.strictEqual(r.bak, null, 'and no .bak is made for a run that writes nothing');
  assert.ok(/storyMeta written\s*:\s*1/.test(r.out), 'while still REPORTING what it would do');
}

// ── 2. --write makes the .bak from the PRE-run bytes, then saves ─────────────────
{
  const r = run([T({ generationStats: { model: 'qwen2.5:7b' } })], [], ['--write']);
  assert.strictEqual(r.code, 0, '--write succeeds');
  assert.ok(!r.unchanged, 'the store is rewritten');
  assert.strictEqual(r.bak, r.before,
    'the .bak holds the ORIGINAL bytes — a backup taken after the write would be worthless');
  assert.strictEqual(byId(r, 'tp_1').storyMeta.model, 'qwen2.5:7b', 'and the stamp landed');
  assert.strictEqual(byId(r, 'tp_1').storyMeta.source, 'generationStats.model[0]',
    'recording WHERE the value came from, which is the whole point of the stamp');
  assert.strictEqual(byId(r, 'tp_1').storyMeta.backfilled, true, 'marked as backfilled, not as a live write');
}

// ── 3. classifyOrigin decides from the data, and the decisions differ ────────────
{
  const r = run([
    T({ id: 'tp_up',   userStory: true }),                                  // in a sourceFile storyline
    T({ id: 'tp_paste', userStory: true }),                                 // no storyline
    T({ id: 'tp_dia',  _dialect: true, generationStats: { model: 'qwen2.5:7b' } }),
    T({ id: 'tp_gen',  storyPrompt: 'Write a story about frogs.', generationStats: { model: 'qwen2.5:7b' } }),
    T({ id: 'tp_unk' }),                                                     // a story and nothing else
  ], [{ id: 'sl_up', chapters: ['tp_up'], sourceFile: 'Article.pdf' }], ['--write']);

  assert.strictEqual(byId(r, 'tp_up').storyMeta.origin, 'file-upload',
    'a user story inside a sourceFile storyline is an upload');
  assert.strictEqual(byId(r, 'tp_up').storyMeta.sourceFile, 'Article.pdf',
    'and the file it came from is carried onto the stamp');
  assert.strictEqual(byId(r, 'tp_paste').storyMeta.origin, 'user-pasted',
    'the same user story with no storyline was pasted, not uploaded');
  assert.ok(!byId(r, 'tp_paste').storyMeta.sourceFile, 'and has no file to name');
  assert.strictEqual(byId(r, 'tp_dia').storyMeta.origin, 'dialect-rewrite', 'a dialect rewrite is its own origin');
  assert.strictEqual(byId(r, 'tp_gen').storyMeta.origin, 'generated', 'a real story prompt means generated');
  assert.strictEqual(byId(r, 'tp_unk').storyMeta.origin, 'unknown',
    "a story with no record says 'unknown' rather than guessing");
  assert.strictEqual(byId(r, 'tp_unk').storyMeta.model, '(unknown)', 'and names no model');

  // non-vacuity: five topics must not have collapsed onto one label
  const origins = new Set(r.store.topics.map(t => t.storyMeta.origin));
  assert.strictEqual(origins.size, 5, 'the five origins are distinguishable (this file cannot pass on a constant)');

  // a user story is never credited to a model
  assert.strictEqual(byId(r, 'tp_up').storyMeta.model, '(user-provided)',
    'no model wrote an uploaded story, and recording one would be a lie');
}

// ── 4. stampTranslationMeta: four records, four different truthful answers ───────
{
  const r = run([
    T({ id: 'tp_utr', userTranslation: 'meine Übersetzung' }),
    T({ id: 'tp_tr',  generationStats: { model: 'a:1', models: { story: 'a:1', translation: 'tg:12b', lessons: 'a:1' } } }),
    T({ id: 'tp_same', generationStats: { model: 'a:1', models: { story: 'a:1', translation: null, lessons: 'a:1' } } }),
    T({ id: 'tp_single', generationStats: { model: 'a:1' } }),   // single-model label, no `models`
    T({ id: 'tp_norec' }),                                        // a story and no record at all
    // already stamped (so the story path skips it) and holding no story at all
    { id: 'tp_nostory', topic: 'No Story', lang: 'it', srcLang: 'de',
      storyMeta: { model: 'x', source: 'already stamped', origin: 'unknown' } },
  ], [], ['--write']);

  assert.strictEqual(byId(r, 'tp_utr').translationMeta.origin, 'user-provided', 'a supplied translation is recorded as such');
  assert.strictEqual(byId(r, 'tp_utr').translationMeta.model, '(user-provided)', 'and credited to no model');
  assert.strictEqual(byId(r, 'tp_tr').translationMeta.model, 'tg:12b', 'a recorded translation model is used');
  assert.strictEqual(byId(r, 'tp_tr').translationMeta.origin, 'generated');
  assert.strictEqual(byId(r, 'tp_same').translationMeta.origin, 'skipped-same-model',
    'an explicit null is a POSITIVE record that no separate pass ran');
  assert.strictEqual(byId(r, 'tp_same').translationMeta.model, '(none)');
  // ⚠️ Order matters and is easy to get wrong: the story path backfills `generationStats.models`
  // from a single-model label BEFORE the translation stamp runs, so this row is 'a:1' — a recorded
  // value — not '(unknown)'. Pinning it here because it is exactly the case a reader mis-predicts.
  assert.strictEqual(byId(r, 'tp_single').translationMeta.model, 'a:1',
    'a single-model label backfills models.translation first, and the stamp then uses it');
  assert.strictEqual(byId(r, 'tp_single').generationStats.modelsSource,
    'backfill:generationStats.model (single-model label)', 'and that backfill is marked as its own');
  assert.strictEqual(byId(r, 'tp_norec').translationMeta.model, '(unknown)',
    'no record at all → unknown, which is the truthful answer');
  assert.ok(!byId(r, 'tp_nostory').translationMeta,
    'a topic with no story gets NO translation stamp — absent, not invented');

  const trOrigins = new Set(r.store.topics.filter(t => t.translationMeta).map(t => t.translationMeta.origin));
  assert.strictEqual(trOrigins.size, 4, 'the four translation origins are distinguishable');
}

// ── 5. Idempotent: a re-run neither re-derives nor rewrites ──────────────────────
{
  const first = run([T({ generationStats: { model: 'qwen2.5:7b' } })], [], ['--write']);
  // feed the script its own output
  const again = run(first.store.topics, first.store.storylines, ['--write']);
  assert.strictEqual(again.code, 0, 'a second run succeeds');
  assert.ok(/nothing to do — already up to date/.test(again.out), 'and says there was nothing to do');
  assert.ok(again.unchanged, 'leaving the file untouched rather than reformatting it');
  assert.strictEqual(again.bak, null, 'and taking no backup of an unchanged file');

  // and it never re-derives a model it already wrote, even from different evidence
  const kept = run([T({ storyMeta: { model: 'HAND-SET', source: 'user-asserted', origin: 'generated' },
                        generationStats: { model: 'qwen2.5:7b' } })], [], ['--write']);
  assert.strictEqual(byId(kept, 'tp_1').storyMeta.model, 'HAND-SET',
    'an existing stamp is never overwritten from the record');
}

// ── 6. A flag cannot silently swallow the next flag as its value ─────────────────
// The rail flagValue() exists for: on a data migration a quietly-dropped --resolve looks exactly
// like one that was never needed, and the file is written either way.
{
  const store = [T({ generationStats: { model: 'qwen' } })];
  const swallowed = run(store, [], ['--resolve', '--write']);
  assert.strictEqual(swallowed.code, 2, '--resolve followed by another flag exits 2, not 0');
  assert.ok(/--resolve needs a value/.test(swallowed.err), 'and says which flag was malformed');
  assert.ok(swallowed.unchanged, '⚠️ and NOTHING is written — the run stops before the store is touched');

  const trailing = run(store, [], ['--write', '--resolve']);
  assert.strictEqual(trailing.code, 2, 'a trailing --resolve with no value exits 2');
  assert.ok(trailing.unchanged, 'and writes nothing');

  const noEq = run(store, [], ['--resolve', 'justaname', '--write']);
  assert.strictEqual(noEq.code, 2, '--resolve without <from>=<to> exits 2');

  const badSet = run(store, [], ['--set-model', 'no-equals-sign', '--write']);
  assert.strictEqual(badSet.code, 2, '--set-model without <topic>=<model> exits 2');

  const missingAssume = run(store, [], ['--assume', '--write']);
  assert.strictEqual(missingAssume.code, 2, '--assume with no value exits 2 as well');
}

// ── 7. It refuses to write on evidence it does not have ──────────────────────────
{
  const untagged = run([T({ generationStats: { model: 'qwen' } })], [], ['--write']);
  assert.strictEqual(untagged.code, 1, 'an untagged model name refuses the write');
  assert.ok(/refusing to write with untagged model names/.test(untagged.err), 'and says why');
  assert.ok(untagged.unchanged, 'leaving the store alone');

  const resolved = run([T({ generationStats: { model: 'qwen' } })], [], ['--resolve', 'qwen=qwen:7b', '--write']);
  assert.strictEqual(resolved.code, 0, '…and --resolve unblocks it');
  assert.strictEqual(byId(resolved, 'tp_1').storyMeta.model, 'qwen:7b', 'with the resolved tag');
  assert.ok(/user-asserted tag/.test(byId(resolved, 'tp_1').storyMeta.source),
    'marked as user-asserted, never as a value the record supplied');

  const unstamped = run([
    T({ id: 'tp_ok', generationStats: { model: 'qwen2.5:7b' } }),
    { id: 'tp_none', topic: 'No Story', lang: 'it', srcLang: 'de' },   // no story, no record
  ], [], ['--write']);
  assert.strictEqual(unstamped.code, 1, 'an unstampable topic refuses the write');
  assert.ok(/refusing to write while topics are unstamped/.test(unstamped.err), 'and says why');
  assert.ok(unstamped.unchanged,
    '⚠️ ALL-OR-NOTHING: the stampable topic is not saved either, so a refused run leaves one state, not two');
}

// ── 8. --set-model is a user assertion and is labelled as one ────────────────────
{
  const r = run([T({ id: 'tp_1', topic: 'Glossary Rewrite' })], [], ['--set-model', 'tp_1=tg:4b', '--write']);
  assert.strictEqual(byId(r, 'tp_1').storyMeta.model, 'tg:4b', 'the asserted model is used');
  assert.strictEqual(byId(r, 'tp_1').storyMeta.source, 'user-asserted (--set-model)',
    'and can never be mistaken for something the record said');
  const byName = run([T({ id: 'tp_1', topic: 'Glossary Rewrite' })], [], ['--set-model', 'Glossary Rewrite=tg:4b', '--write']);
  assert.strictEqual(byId(byName, 'tp_1').storyMeta.model, 'tg:4b', 'addressable by topic name as well as id');
}

// ── 9. --verify does not treat its own output as evidence ────────────────────────
// A --resolve'd tag can never equal the untagged label, so counting backfilled rows would report a
// false mismatch on every run after the backfill.
{
  const ownOutput = run([T({ id: 'tp_b',
    generationStats: { model: 'qwen', models: { story: 'qwen:7b', translation: 'qwen:7b', lessons: 'qwen:7b' },
                       modelsSource: 'backfill:generationStats.model (single-model label)' } })], [], ['--verify']);
  assert.strictEqual(ownOutput.code, 0, 'a backfilled row that "mismatches" its own label is not a failure');
  assert.ok(/ignored 1 backfilled row/.test(ownOutput.out), 'and it says how many it ignored');

  const real = run([T({ id: 'tp_r',
    generationStats: { model: 'qwen2.5:7b', models: { story: 'SOMETHING-ELSE', translation: 'x', lessons: 'x' } } })], [], ['--verify']);
  assert.strictEqual(real.code, 1, 'a genuine mismatch in a RECORDED row still fails');
  assert.ok(/MISMATCH/.test(real.err), 'and is reported');
}

console.log('  backfill-provenance.js: dry run, .bak, refusals, flag rails, origins, translation stamps — RUN: OK');
console.log('unit-provenance-migration: ALL PASSED');
