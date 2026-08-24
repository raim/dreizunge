// unit-canonical-analysis.test.js
// PLAN §7.0 CP2 (user: "PLAN §7.0 CP2", asked for by name after CP1 shipped at v83_h) — analysis
// report: lemma/form/phrase/sense/frequency/script proposals, still REPORT-ONLY.
//
// Contract under test:
//   1. `canonical-analysis.js` is standalone — does not require server.js (which would bind an HTTP
//      port as a side effect) — but UNLIKE CP1, it IS model-in-the-loop (a real LLM call to propose
//      lemmas/forms/senses), via the same standalone llm.js server.js itself uses.
//   2. A token the model's reply never answers for becomes "unresolved" — a state DISTINCT from the
//      model answering "low" confidence — never silently dropped, never fabricated. This is the
//      plan's own "expose uncertainty/review rather than silently guessing" requirement, and it is
//      exercised through a REAL HTTP call to a scripted fake Ollama (rule 7: "a live model call
//      needs a live test"), not just by unit-testing the parser against a hand-written string.
//   3. Phrase proposals are validated against the REAL token list (contiguous, in-range) before
//      being kept; an invalid one is dropped and counted, never silently coerced into something valid.
//   4. frequency and script need NO model call — both are deterministic, computed locally.
//   5. Provenance is CP2-specific: unlike CP1's cp1Provenance, it carries a `model` field, because a
//      real LLM call produced the content it describes.
//   6. `build-canonical-analysis.js` (the CLI) reads CP1's OWN canonical-text.json (not lessons.json
//      directly) and never writes to either — asserted behaviourally, by running the real CLI
//      against a fake Ollama and diffing both files byte-for-byte before/after.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const ca = require(path.join(ROOT, 'canonical-analysis.js'));
const { startFakeOllama } = require('./lib.js');

// ── 1. Standalone module: no server.js dependency ─────────────────────────────
{
  const modSrc = fs.readFileSync(path.join(ROOT, 'canonical-analysis.js'), 'utf8');
  assert.ok(!/require\(['"]\.\/server\.js['"]\)/.test(modSrc),
    'canonical-analysis.js does NOT require server.js — that would bind an HTTP port as a side effect of loading an offline analysis module');
  assert.ok(!modSrc.includes('http.createServer') && !modSrc.includes('.listen('),
    'no server-binding code exists in the module itself');
  // Unlike CP1, this module DOES need a real model call — verify it goes through the shared,
  // already-standalone llm.js (the same one server.js itself requires), not a second HTTP client.
  assert.ok(/require\(['"]\.\/llm\.js['"]\)/.test(modSrc), 'the model call goes through the shared llm.js, not a bespoke HTTP client');
}
console.log('  canonical-analysis.js: standalone, no server.js dependency, model calls via shared llm.js: OK');

// ── 2. Prompt construction: language names, 0-based indices, no re-derived tokenisation ──
{
  const tokens = [{ tokenId: 't0', idx: 0, text: 'Katze' }, { tokenId: 't1', idx: 1, text: 'schläft' }];
  const { sys, user } = ca.buildAnalysisPrompt('Katze schläft', tokens, 'German', 'English');
  assert.ok(sys.includes('German') && sys.includes('English'), 'both the target and source language NAMES appear in the system prompt');
  assert.ok(/lemma/.test(sys) && /form/.test(sys) && /sense/.test(sys) && /confidence/.test(sys) && /phrases/.test(sys),
    'the prompt asks for every field the plan names: lemma, form, sense, confidence, phrases');
  const parsedUser = JSON.parse(user);
  assert.deepStrictEqual(parsedUser.tokens, [{ i: 0, surface: 'Katze' }, { i: 1, surface: 'schläft' }],
    'the model is given the REAL token list with 0-based indices — asked to annotate, not re-tokenise');
}
console.log('  buildAnalysisPrompt: language names + full token list + every required field named: OK');

// ── 3. Reply parsing: resolved / low-confidence / unresolved, never dropped or fabricated ──
{
  const tokens = [
    { tokenId: 't0', idx: 0, text: 'Katze' },
    { tokenId: 't1', idx: 1, text: 'schläft' },
    { tokenId: 't2', idx: 2, text: 'heute' },
  ];
  const reply = JSON.stringify({
    tokens: [
      { i: 0, lemma: 'Katze', form: 'noun, fem. sg.', sense: 'the animal', confidence: 'high' },
      { i: 1, lemma: 'schlafen', form: 'verb, 3sg pres.', sense: 'is asleep', confidence: 'low' },
      // index 2 ("heute") is DELIBERATELY missing from the model's reply.
    ],
    phrases: [],
  });
  const r = ca.parseAnalysisReply(reply, tokens);
  assert.strictEqual(r.tokens.length, 3, 'every REAL token gets a result — the reply never determines how many come back');
  assert.strictEqual(r.tokens[0].lemma, 'Katze'); assert.strictEqual(r.tokens[0].confidence, 'high');
  assert.strictEqual(r.tokens[1].lemma, 'schlafen'); assert.strictEqual(r.tokens[1].confidence, 'low');
  assert.strictEqual(r.tokens[2].lemma, null, 'a token the model never answered for is NOT fabricated a lemma');
  assert.strictEqual(r.tokens[2].confidence, 'unresolved', '"unresolved" (never answered) is a state DISTINCT from "low" (answered, unsure)');
  assert.strictEqual(r.tokens.every(t => t.reviewed === false), true, 'nothing is pre-marked reviewed — that is a later stage\'s job');

  // Malformed JSON degrades the SAME way for every token, rather than throwing.
  const broken = ca.parseAnalysisReply('not json at all', tokens);
  assert.strictEqual(broken.tokens.length, 3);
  assert.ok(broken.tokens.every(t => t.confidence === 'unresolved'), 'an unparseable reply leaves every token unresolved, not a crash');
}
console.log('  parseAnalysisReply: resolved/low/unresolved distinguished, missing tokens never dropped or fabricated, malformed replies degrade safely: OK');

// ── 4. Phrase validation: kept when in-range and contiguous, dropped and counted otherwise ──
{
  const tokens = [
    { tokenId: 't0', idx: 0, text: 'take' }, { tokenId: 't1', idx: 1, text: 'care' }, { tokenId: 't2', idx: 2, text: 'of' },
  ];
  const reply = JSON.stringify({
    tokens: [],
    phrases: [
      { start: 0, end: 2, lemma: 'take care of', gloss: 'to look after', confidence: 'high' },   // valid
      { start: 1, end: 5, lemma: 'bogus', gloss: 'out of range', confidence: 'high' },            // end beyond the token list
      { start: 2, end: 0, lemma: 'backwards', gloss: 'end before start', confidence: 'high' },    // end < start
      { start: 'x', end: 1, lemma: 'not integers', gloss: 'n/a', confidence: 'high' },            // non-integer
    ],
  });
  const r = ca.parseAnalysisReply(reply, tokens);
  assert.strictEqual(r.phrases.length, 1, 'only the one genuinely valid phrase survives');
  assert.deepStrictEqual(r.phrases[0].tokenIds, ['t0', 't1', 't2'], 'a valid phrase carries the REAL tokenIds of every token it spans');
  assert.strictEqual(r.phrases[0].lemma, 'take care of');
  assert.strictEqual(r.phrasesDropped, 3, 'the three invalid phrases are counted as dropped, not silently coerced into something valid');
}
console.log('  phrase validation: in-range contiguous spans kept with real tokenIds, invalid ones dropped and counted: OK');

// ── 5. computeFrequency: deterministic, sample-scoped, language-separated ─────
{
  const chapters = [
    { lang: 'de', sentences: [{ tokens: [{ lemma: 'Haus' }, { lemma: 'Katze' }, { lemma: null }] }] },
    { lang: 'de', sentences: [{ tokens: [{ lemma: 'Haus' }] }] },
    { lang: 'en', sentences: [{ tokens: [{ lemma: 'Haus' }] }] },   // same STRING, different language
  ];
  const freq = ca.computeFrequency(chapters);
  assert.strictEqual(freq['de::Haus'], 2, 'the same lemma across two chapters accumulates');
  assert.strictEqual(freq['de::Katze'], 1);
  assert.strictEqual(freq['en::Haus'], 1, 'the SAME surface string in a different language is counted separately, not merged');
  assert.strictEqual(Object.keys(freq).length, 3, 'a null lemma (unresolved token) contributes nothing to count');
}
console.log('  computeFrequency: deterministic, no model call, language-separated, unresolved tokens excluded: OK');

// ── 6. scriptsForLangCP2: deterministic per-language lookup, sensible default ──
{
  assert.deepStrictEqual(ca.scriptsForLangCP2('ja'), ['hiragana', 'katakana'], 'a real multi-script language returns both scripts, from scripts.json — the same source server.js reads');
  assert.deepStrictEqual(ca.scriptsForLangCP2('ru'), ['cyrillic']);
  assert.deepStrictEqual(ca.scriptsForLangCP2('de'), ['latin'], 'a language scripts.json has no special entry for defaults to latin, not an empty/undefined value');
  assert.deepStrictEqual(ca.scriptsForLangCP2('zz-not-a-real-lang'), ['latin'], 'an unknown code degrades to the same default rather than throwing');
}
console.log('  scriptsForLangCP2: deterministic, no model call, sensible default for unlisted languages: OK');

// ── 7. Provenance: CP2-specific shape, DOES carry a model field (unlike CP1) ──
{
  const p = ca.cp2Provenance({ chapterId: 'tp_x', model: 'qwen2.5:7b' });
  assert.strictEqual(p.stage, 'CP2');
  assert.strictEqual(p.pipelineVersion, ca.CP2_PIPELINE_VERSION);
  assert.strictEqual(p.producedBy, 'canonical-analysis.js');
  assert.ok(p.at && !isNaN(Date.parse(p.at)), 'a real, parseable timestamp');
  assert.strictEqual(p.model, 'qwen2.5:7b', 'CP2 provenance DOES record which model produced it — a real LLM call happened, unlike CP1');
}
console.log('  cp2Provenance: CP2-specific shape, model field present (a real call happened, unlike CP1): OK');

// ── 8. LIVE model call: analyzeSentence talks to a REAL (fake) Ollama over HTTP ──
// Rule 7: "a live model call needs a live test, not a plausible prompt." Runs in a CHILD PROCESS so
// OLLAMA_HOST (read once, at require time, by llm.js) points at the fake BEFORE canonical-analysis.js
// is ever loaded — the same reason unit-meta-source-heal.test.js spawns its own `node -e` subprocess
// rather than mutating process.env in-place after this file's own (real) llm.js has already loaded.
(async () => {
  const fake = await startFakeOllama();
  try {
    const scriptPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cp2-live-')), 'run.js');
    fs.writeFileSync(scriptPath, `
      process.env.OLLAMA_HOST = 'http://127.0.0.1:${fake.port}';
      const { analyzeSentence } = require(${JSON.stringify(path.join(ROOT, 'canonical-analysis.js'))});
      const sentenceRec = {
        sentenceId: 'ch1:s0', text: 'Katze ZZZOMIT',
        tokens: [
          { tokenId: 'ch1:s0:t0', idx: 0, text: 'Katze' },
          { tokenId: 'ch1:s0:t1', idx: 1, text: 'ZZZOMIT' },
        ],
      };
      analyzeSentence('fake', sentenceRec, { langName: 'German', srcLangName: 'English' })
        .then(r => { process.stdout.write(JSON.stringify(r)); })
        .catch(e => { console.error(e); process.exit(1); });
    `);
    const out = execFileSync(process.execPath, [scriptPath], { cwd: ROOT, timeout: 20000 });
    const result = JSON.parse(out.toString());
    assert.strictEqual(result.tokens.length, 2, 'both tokens present in the result, even the one the fake never answered for');
    assert.strictEqual(result.tokens[0].lemma, 'katze', 'the answered token resolves from a REAL HTTP reply, not a mocked function');
    assert.strictEqual(result.tokens[0].confidence, 'high');
    assert.strictEqual(result.tokens[1].lemma, null, 'the token the fake model omits is NOT fabricated');
    assert.strictEqual(result.tokens[1].confidence, 'unresolved', 'missing-from-the-reply is provably distinct from "low", over a REAL network round trip');
    assert.strictEqual(result.phrases.length, 1, 'the fake also proposes one phrase spanning both tokens');
    assert.strictEqual(result.provenance.model, 'fake', 'CP2 provenance records WHICH model produced this');
    console.log('  live model call via fake Ollama: resolved/unresolved distinction holds over a real HTTP round trip: OK');
  } finally {
    fake.child.kill();
  }

  // ── 9. build-canonical-analysis.js: reads CP1's own store, never writes canonical-text.json or lessons.json ──
  const fake2 = await startFakeOllama();
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp2-cli-'));
  const scratchOut = path.join(scratchDir, 'canonical-analysis.json');
  try {
    const cliSrc = fs.readFileSync(path.join(ROOT, 'build-canonical-analysis.js'), 'utf8');
    assert.ok(!/fs\.writeFileSync\(\s*(LESSONS|CANONICAL_TEXT|IN)\b/.test(cliSrc),
      'no write call in the CLI source targets its own input file or the lessons store');

    const beforeCT = fs.readFileSync(path.join(ROOT, 'canonical-text.json'));
    const beforeLessons = fs.readFileSync(path.join(ROOT, 'lessons.json'));
    const env = { ...process.env, OLLAMA_HOST: 'http://127.0.0.1:' + fake2.port, OLLAMA_MODEL: 'fake' };

    execFileSync('node', [path.join(ROOT, 'build-canonical-analysis.js'), '--limit', '1', '--out', scratchOut], { cwd: ROOT, env, timeout: 30000 });
    assert.ok(!fs.existsSync(scratchOut), 'report-only really writes nothing, not even to the scratch path');

    execFileSync('node', [path.join(ROOT, 'build-canonical-analysis.js'), '--limit', '1', '--write', '--out', scratchOut], { cwd: ROOT, env, timeout: 30000 });
    const afterCT = fs.readFileSync(path.join(ROOT, 'canonical-text.json'));
    const afterLessons = fs.readFileSync(path.join(ROOT, 'lessons.json'));
    assert.ok(beforeCT.equals(afterCT), 'canonical-text.json (CP1\'s own store, CP2\'s INPUT) is byte-identical after a --write run');
    assert.ok(beforeLessons.equals(afterLessons), 'lessons.json is untouched — CP2 is exactly as report-only as CP1');

    const out = JSON.parse(fs.readFileSync(scratchOut, 'utf8'));
    assert.strictEqual(out.chapterCount, 1);
    assert.strictEqual(out.model, 'fake', 'the output records which model produced it');
    const someChapterId = Object.keys(out.chapters)[0];
    const ctStore = JSON.parse(fs.readFileSync(path.join(ROOT, 'canonical-text.json'), 'utf8'));
    assert.ok(ctStore.chapters[someChapterId], 'the analysed chapterId really does correspond to a real CP1 chapter — cross-referenced, not a coincidence');
    assert.ok(typeof out.lemmaFrequency === 'object' && Object.keys(out.lemmaFrequency).length > 0,
      'a real analysis run produces a non-empty frequency map');

    // Non-vacuity for the "unresolved never dropped" contract, exercised through the FULL CLI path
    // this time, not just the direct function call in §8.
    const anySentence = Object.values(out.chapters)[0].sentences[0];
    const firstToken = ctStore.chapters[someChapterId].sentences[0].tokens[0];
    assert.strictEqual(anySentence.tokens[0].tokenId, firstToken.tokenId, 'CP2\'s token records line up 1:1 with CP1\'s own token ids — no re-tokenisation happened');
  } finally {
    fake2.child.kill();
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }
  console.log('  build-canonical-analysis.js: reads CP1\'s store, canonical-text.json and lessons.json both provably untouched: OK');

  // ── 10. think:false is actually sent on the wire (v83_o) ─────────────────────
  // A real user run against a REAL reasoning-capable model (qwen3.6:35b-a3b) failed with "Ollama
  // returned empty response" — the exact, previously-diagnosed v71_o failure mode server.js's own
  // OLLAMA_THINK table already solved for its own structured-JSON roles, which analyzeSentence had
  // never adopted. The fake-Ollama harness cannot SIMULATE a reasoning model (it has no concept of
  // one), so this section checks the one thing it CAN prove: the actual HTTP request body genuinely
  // carries think:false, via fake-ollama.js's own request logging — not by reading the source and
  // trusting the argument was wired through correctly.
  {
    // fake-ollama.js reads FAKE_LOG from its OWN process.env at startup — set via startFakeOllama's
    // own `logPath` argument (it spawns the fake as a child with that env var already set), not by
    // setting FAKE_LOG inside the script that calls analyzeSentence.
    const logPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cp2-think-')), 'chat.jsonl');
    const fake4 = await startFakeOllama(logPath);
    try {
      const scriptPath = path.join(path.dirname(logPath), 'run.js');
      fs.writeFileSync(scriptPath, `
        process.env.OLLAMA_HOST = 'http://127.0.0.1:${fake4.port}';
        const { analyzeSentence } = require(${JSON.stringify(path.join(ROOT, 'canonical-analysis.js'))});
        const sentenceRec = { sentenceId: 's0', text: 'Katze schläft',
          tokens: [ { tokenId: 't0', idx: 0, text: 'Katze' }, { tokenId: 't1', idx: 1, text: 'schläft' } ] };
        analyzeSentence('fake', sentenceRec, { langName: 'German', srcLangName: 'English' })
          .then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
      `);
      execFileSync(process.execPath, [scriptPath], { cwd: ROOT, timeout: 20000 });
      const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
      assert.strictEqual(lines.length, 1, 'exactly one model call was made for one sentence');
      assert.strictEqual(lines[0].opts.think, false,
        `analyzeSentence must send think:false on the wire — this is the exact fix for the real "Ollama returned empty response" failure a live qwen3.6:35b-a3b run hit (got opts.think=${lines[0].opts.think})`);
    } finally {
      fake4.child.kill();
      fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
    }
  }
  console.log('  analyzeSentence sends think:false on the wire — the real fix for a reasoning model\'s empty-response failure, checked at the HTTP layer: OK');

  console.log('unit-canonical-analysis: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
