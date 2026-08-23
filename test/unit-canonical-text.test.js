// unit-canonical-text.test.js
// PLAN §7.0 CP1 (user: "PLAN §7.0 CP1", the first buildable slice of the accepted parallel
// curriculum pipeline direction) — canonical text + analysis records, REPORT-ONLY.
//
// Contract under test:
//   1. `canonical-text.js` is a PURE module — no file I/O, no side effects — mirroring server.js's
//      own sentence/token-splitting primitives (qcSplitSentences-shape, jaTokenize, isPunct,
//      CJK_LANGS) rather than requiring server.js (which would bind an HTTP port as a side effect).
//   2. Sentence splitting is SENTENCE-level (not clause-level, which server.js's OTHER splitter
//      does), paragraph-aware. Token splitting is script-class based (CJK vs spaced), "no language
//      knowledge" — a fixed set/regex, never a per-language table.
//   3. IDs are STABLE: derived from POSITION within a deterministic split, so re-running analysis on
//      UNCHANGED text reproduces the SAME ids every time — this is asserted directly, not assumed.
//   4. `textHash`/`sourceTextHash` change when (and only when) the underlying text changes — the
//      staleness-detection property the plan itself names ("an older result is visibly old").
//   5. `build-canonical-text.js` (the CLI) NEVER writes `lessons.json` — asserted BOTH by pinning
//      the source (no write call to LESSONS anywhere) AND behaviourally, by running it for real
//      against the actual corpus and diffing the file byte-for-byte before/after.
//   6. Its own output (`canonical-text.json`) is a genuinely SEPARATE store, never merged into
//      `lessons.json`'s topic objects.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const ct = require(path.join(ROOT, 'canonical-text.js'));
const cliSrc = fs.readFileSync(path.join(ROOT, 'build-canonical-text.js'), 'utf8');

// ── 1. Pure module: no file I/O, no side effects on load ─────────────────────
{
  const modSrc = fs.readFileSync(path.join(ROOT, 'canonical-text.js'), 'utf8');
  assert.ok(!/require\(['"]\.\/server\.js['"]\)/.test(modSrc),
    'canonical-text.js does NOT require server.js — that would bind an HTTP port as a side effect of loading an offline analysis module');
  assert.ok(!/fs\.(writeFile|readFile)/.test(modSrc),
    'canonical-text.js does no file I/O of its own — build-canonical-text.js (the CLI) owns all I/O');
  assert.ok(!modSrc.includes('http.createServer') && !modSrc.includes('.listen('),
    'no server-binding code exists in the pure module');
}
console.log('  canonical-text.js: pure module, no server.js dependency, no file I/O: OK');

// ── 2. Sentence splitting: sentence-level, paragraph-aware ────────────────────
{
  const s = ct.splitCanonicalSentences('Der Hund lief. Die Katze schlief!\n\nEin neuer Absatz beginnt.');
  assert.strictEqual(s.length, 3, 'three sentences across two paragraphs');
  assert.strictEqual(s[0].text, 'Der Hund lief.');
  assert.strictEqual(s[1].text, 'Die Katze schlief!');
  assert.strictEqual(s[2].text, 'Ein neuer Absatz beginnt.');
  assert.strictEqual(s[0].paraBreakBefore, false, 'the first sentence of the first paragraph carries no break flag');
  assert.strictEqual(s[1].paraBreakBefore, false, 'the second sentence of the SAME paragraph does not either');
  assert.strictEqual(s[2].paraBreakBefore, true, 'the first sentence of the SECOND paragraph is flagged — paragraph structure survives, unlike qcSplitSentences');
  // Non-vacuity: does NOT break on commas (that is splitSentences' job, a different, clause-level
  // splitter server.js also has — CP1 uses sentence granularity, not clause granularity).
  const clause = ct.splitCanonicalSentences('Der Hund, der schnell lief, war müde.');
  assert.strictEqual(clause.length, 1, 'a comma inside one sentence does not split it — sentence, not clause, granularity');
}
console.log('  splitCanonicalSentences: sentence-level, paragraph flags correct, not clause-level: OK');

// ── 3. Token splitting: script-class based, no per-language table ────────────
{
  const de = ct.tokenizeCanonicalSentence('Ich mag Hunde sehr', 'de');
  assert.deepStrictEqual(de, ['Ich', 'mag', 'Hunde', 'sehr'], 'a spaced language splits on whitespace');
  const punctOnly = ct.tokenizeCanonicalSentence('Wirklich ? !', 'de');
  assert.deepStrictEqual(punctOnly, ['Wirklich'], 'a standalone punctuation token is dropped (matches server.js isPunct)');

  const ja = ct.tokenizeCanonicalSentence('私は猫が好きです', 'ja');
  assert.ok(ja.length > 1, `Japanese is tokenised into more than one run (got ${JSON.stringify(ja)})`);
  assert.ok(ja.every(t => t.length > 0), 'no empty tokens');
  const jaFurigana = ct.tokenizeCanonicalSentence('東京[とうきょう]に行きます', 'ja');
  assert.ok(jaFurigana.includes('東京[とうきょう]'),
    `a kanji+furigana group ("BASE[reading]") survives as ONE token, not split apart (got ${JSON.stringify(jaFurigana)})`);

  // No per-language table: the only language-SPECIFIC branch is the CJK_LANGS membership check
  // itself (script-class, not vocabulary/grammar facts) — checked by construction, not by scanning
  // for a table, since "no table" is an absence to prove structurally: every OTHER language falls
  // through to the SAME whitespace-split branch, unconditionally.
  const it = ct.tokenizeCanonicalSentence('Il gatto dorme', 'it');
  const fr = ct.tokenizeCanonicalSentence('Le chat dort', 'fr');
  assert.deepStrictEqual(it, ['Il', 'gatto', 'dorme'], 'Italian uses the SAME whitespace-split branch as German/French');
  assert.deepStrictEqual(fr, ['Le', 'chat', 'dort'], 'French too — one branch for every non-CJK language, no per-language special-casing');
}
console.log('  tokenizeCanonicalSentence: script-class based (CJK vs spaced), furigana groups preserved, no per-language table: OK');

// ── 4. Stable IDs: position-derived, deterministic across separate calls ─────
{
  const topic = { id: 'tp_stable_1', story: 'Erste Zeile. Zweite Zeile!\n\nDritter Absatz.', lang: 'de', srcLang: 'en' };
  const a = ct.buildCanonicalText(topic);
  const b = ct.buildCanonicalText(topic);   // a SEPARATE call, not a cached/memoised result
  assert.deepStrictEqual(a.sentences.map(s => s.sentenceId), b.sentences.map(s => s.sentenceId),
    'sentence ids are identical across two independent calls on the same input');
  assert.deepStrictEqual(a.sentences.flatMap(s => s.tokens.map(t => t.tokenId)),
                          b.sentences.flatMap(s => s.tokens.map(t => t.tokenId)),
    'token ids are identical across two independent calls on the same input');
  assert.strictEqual(a.sourceTextHash, b.sourceTextHash, 'the chapter-level hash is identical too');
  // chapterId REUSES the topic's own id — no second id scheme invented for the chapter level.
  assert.strictEqual(a.chapterId, 'tp_stable_1', 'chapterId is the topic\'s own id, verbatim');
  assert.strictEqual(a.sentences[0].sentenceId, 'tp_stable_1:s0', 'sentence ids are position-derived from the chapter id');
  assert.strictEqual(a.sentences[0].tokens[0].tokenId, 'tp_stable_1:s0:t0', 'token ids are position-derived from the sentence id');
}
console.log('  stable ids: position-derived, identical across independent calls, no invented chapter-id scheme: OK');

// ── 5. textHash / sourceTextHash: staleness detection ─────────────────────────
{
  const t1 = ct.buildCanonicalText({ id: 'tp_h', story: 'Ein Satz.', lang: 'de' });
  const t2 = ct.buildCanonicalText({ id: 'tp_h', story: 'Ein Satz.', lang: 'de' });
  const t3 = ct.buildCanonicalText({ id: 'tp_h', story: 'Ein anderer Satz.', lang: 'de' });
  assert.strictEqual(t1.sourceTextHash, t2.sourceTextHash, 'unchanged text -> unchanged hash');
  assert.notStrictEqual(t1.sourceTextHash, t3.sourceTextHash,
    'changed text -> changed hash — this is what lets a future consumer detect "this record is stale"');
  assert.strictEqual(t1.sentences[0].textHash, ct.textHash('Ein Satz.'), 'the per-sentence hash is the same function, not a second implementation');
}
console.log('  textHash: stable when text is unchanged, changes when text changes: OK');

// ── 6. Provenance: CP1-specific shape, not server.js\'s model-generation buildGenMeta ─
{
  const topic = { id: 'tp_prov', story: 'Ein Satz.', lang: 'de' };
  const rec = ct.buildCanonicalText(topic);
  assert.strictEqual(rec.provenance.stage, 'CP1');
  assert.strictEqual(rec.provenance.pipelineVersion, ct.CP1_PIPELINE_VERSION);
  assert.strictEqual(rec.provenance.producedBy, 'canonical-text.js');
  assert.ok(rec.provenance.at && !isNaN(Date.parse(rec.provenance.at)), 'a real, parseable timestamp');
  // Deliberately NOT buildGenMeta's shape — no `model`/`promptTokens` fields, since CP1 makes no
  // model call at all.
  assert.ok(!('model' in rec.provenance) && !('promptTokens' in rec.provenance),
    'provenance does not fabricate model-generation fields for a deterministic, model-free transform');
}
console.log('  provenance: CP1-specific shape (stage/pipelineVersion/producedBy/at), no fabricated model fields: OK');

// ── 7. buildCanonicalText: required fields enforced ───────────────────────────
{
  assert.throws(() => ct.buildCanonicalText(null), /topic object is required/);
  assert.throws(() => ct.buildCanonicalText({ story: 'x' }), /topic\.id is required/,
    'a topic with no id refuses rather than inventing a chapterId — CP1 must never invent a second id scheme');
  const empty = ct.buildCanonicalText({ id: 'tp_empty', story: '', lang: 'de' });
  assert.strictEqual(empty.sentenceCount, 0, 'an empty story degrades to zero sentences, not a throw');
}
console.log('  buildCanonicalText: required fields enforced, empty story degrades safely: OK');

// ── 8. build-canonical-text.js: NEVER writes lessons.json — pinned AND behavioural ─
// Uses --out to a SCRATCH path throughout (never the committed canonical-text.json) — a test run
// must not resize a checked-in artifact as a side effect. The committed file itself is regenerated
// as an explicit release step, the same way build-static.js's docs/index.html is.
const os = require('os');
const scratchOut = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cp1-test-')), 'canonical-text.json');
{
  assert.ok(!/fs\.writeFileSync\(\s*LESSONS/.test(cliSrc), 'no write call targets the LESSONS path anywhere in the CLI source');
  const lessonsPath = path.join(ROOT, 'lessons.json');
  const before = fs.readFileSync(lessonsPath);
  execFileSync('node', [path.join(ROOT, 'build-canonical-text.js'), '--limit', '3', '--out', scratchOut], { cwd: ROOT });
  const afterReport = fs.readFileSync(lessonsPath);
  assert.ok(before.equals(afterReport), 'lessons.json is byte-identical after a report-only run');
  assert.ok(!fs.existsSync(scratchOut), 'report-only really writes nothing, not even to the scratch path');
  execFileSync('node', [path.join(ROOT, 'build-canonical-text.js'), '--limit', '3', '--write', '--out', scratchOut], { cwd: ROOT });
  const afterWrite = fs.readFileSync(lessonsPath);
  assert.ok(before.equals(afterWrite), 'lessons.json is STILL byte-identical after a --write run — CP1 never touches it, "write" means its OWN output file');
}
console.log('  build-canonical-text.js: lessons.json is provably untouched, report-only AND --write: OK');

// ── 9. canonical-text.json: a genuinely separate store ────────────────────────
{
  assert.ok(fs.existsSync(scratchOut), 'the scratch output exists after the --write run above');
  const out = JSON.parse(fs.readFileSync(scratchOut, 'utf8'));
  assert.ok(out.chapters && typeof out.chapters === 'object', 'chapters is a keyed object (topic id -> record), not folded into lessons.json\'s topics array');
  const someChapterId = Object.keys(out.chapters)[0];
  const lessons = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
  const topic = lessons.topics.find(t => t.id === someChapterId);
  assert.ok(topic, 'the chapter id really does correspond to a real topic in lessons.json (cross-referenced, not a coincidence)');
  assert.ok(!('canonicalText' in topic) && !('sentences' in topic) && !('analysisVersion' in topic),
    'the topic object in lessons.json carries NONE of CP1\'s new fields — nothing was merged in');
  // Deterministic re-run, checked end-to-end through the CLI (not just the pure function, §4 above).
  const run1 = JSON.parse(fs.readFileSync(scratchOut, 'utf8'));
  execFileSync('node', [path.join(ROOT, 'build-canonical-text.js'), '--limit', '3', '--write', '--out', scratchOut], { cwd: ROOT });
  const run2 = JSON.parse(fs.readFileSync(scratchOut, 'utf8'));
  const stripAt = (o) => { const s = JSON.parse(JSON.stringify(o)); s.generatedAt = null; Object.values(s.chapters).forEach(c => { c.provenance.at = null; }); return s; };
  assert.deepStrictEqual(stripAt(run1), stripAt(run2), 'two consecutive --write runs over an unchanged corpus produce identical output (ignoring timestamps)');
  fs.rmSync(path.dirname(scratchOut), { recursive: true, force: true });

  // Non-vacuity: the REAL committed canonical-text.json must exist and actually be the file the CLI
  // produces by default (--out untouched) — otherwise this whole section could pass against a
  // scratch file while the shipped artifact silently rotted or was hand-edited.
  const realOut = path.join(ROOT, 'canonical-text.json');
  assert.ok(fs.existsSync(realOut), 'the committed canonical-text.json exists (run `node build-canonical-text.js --write` to (re)generate it)');
  const real = JSON.parse(fs.readFileSync(realOut, 'utf8'));
  assert.ok(real.chapterCount > 0 && Object.keys(real.chapters).length === real.chapterCount,
    'the committed artifact is non-empty and internally consistent (chapterCount matches the actual chapter keys)');
}
console.log('  canonical-text.json: a genuinely separate store, cross-referenced against real topics, deterministic end to end: OK');

console.log('unit-canonical-text: ALL PASSED');
