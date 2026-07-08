// unit-qc-dispatch.test.js
// Headless coverage for the QC expansion to synonyms + word_forms (Plan C). The LLM calls
// themselves need Ollama and are verified live; here we test the pure parsing helper
// (_qcParseOkOrSug) and that _runQc dispatches each lesson type to the right checker and writes
// item.qc in the shape the editor renders. Checkers are stubbed so no backend is needed.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function ext(src, n) {
  const at = src.indexOf('function ' + n + '(');
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── _qcParseOkOrSug ──────────────────────────────────────────────────────────
const parse = new Function(ext(server, '_qcParseOkOrSug') + '\nreturn _qcParseOkOrSug;')();
assert.deepStrictEqual(parse('OK'), { ok: true }, 'plain OK');
assert.deepStrictEqual(parse('  ok. '), { ok: true }, 'OK with punctuation/space');
assert.deepStrictEqual(parse(''), { ok: true }, 'empty → ok (no spurious flag)');
assert.deepStrictEqual(parse('FIX: option 2 should be correct'), { ok: false, sug: 'option 2 should be correct' }, 'strips FIX label');
assert.deepStrictEqual(parse('Suggestion - the gloss should be "dog"'), { ok: false, sug: 'the gloss should be "dog"' }, 'strips Suggestion label');
const long = parse('x'.repeat(500));
assert.ok(!long.ok && long.sug.length === 300, 'suggestion truncated to 300 chars');
console.log('  _qcParseOkOrSug: OK detection, label strip, truncation: OK');

// ── _runQc dispatch by lesson type ───────────────────────────────────────────
// Rebuild _runQc with all of its free identifiers stubbed. We make each checker return a
// deterministic "not ok" so we can assert which items received item.qc, proving dispatch.
const calls = { pair: 0, cloze: 0, synset: 0 };
const stubs = {
  langName: x => x,
  OLLAMA_TRANSLATION_MODEL: 'stub',
  OLLAMA_QC_MODEL: 'qc-stub',
  jobStep: () => {}, jobDone: () => {},
  upsert: () => {},
  _qcStripFuri: t => t,
  _qcLessonUserFlagged: () => true,
  qcCheckPair: async () => { calls.pair++; return { ok: false, field: 'source', sug: 'pair-fix' }; },
  qcCheckDialectPair: async () => { calls.dialect = (calls.dialect||0)+1; return { ok: false, field: 'source', sug: 'dialect-fix' }; },
  qcCheckCloze: async () => { calls.cloze++; return { ok: false, sug: 'cloze-fix' }; },
  qcCheckSynonymSet: async () => { calls.synset++; return { ok: false, sug: 'syn-fix' }; },
  _lessonHasOpenQcFlag: (ls) => {
    const arrays = [ls.vocab, ls.sentences, ls.items, ls.words, ls.grammar, ls.conjugations];
    return arrays.some(a => Array.isArray(a) && a.some(x => x && x.qc));
  },
};
const runQc = new Function(...Object.keys(stubs), 'async ' + ext(server, '_runQc') + '\nreturn _runQc;')(...Object.values(stubs));

const topics = [{
  id: 't1', topic: 'T', lang: 'ar', srcLang: 'en',
  lessons: [
    { type: 'standard', vocab: [{ target: 'قطة', source: 'cat' }], sentences: [{ target: 'س', source: 'x' }] },
    { type: 'word_forms', items: [{ sentence: 'a ___ b', choices: ['x', 'y'], correctIndex: 0, translation: 'tt' }] },
    { type: 'synonyms', words: [{ base: 'قطة', gloss: 'cat', synonyms: [{ w: 'هر', g: 'cat' }] }] },
    { type: 'intro_script', letters: [{ ch: 'غ', translit: 'gh' }] },
    { type: 'grammar', grammar: [{ target: 'Übung', source: 'exercise', article: 'die', plural: 'Übungen' }] },
    { type: 'conjugation', conjugations: [{ infinitive: 'watch', source: '見る', tense: 'present', forms: [{ pronoun: 'I', form: 'watch' }] }] },
    { type: 'math', numbers: [1, 2, 3] },
    { type: 'error_hunt', corruptedStory: 'x', correctStory: 'y' },
    { type: 'mixed' },
    { type: 'standard', _dialect: true, vocab: [{ target: 'bleckfüeßet', source: 'barfuß', _dialect: true }] },
  ],
}];

(async () => {
  await runQc('job1', topics, { lessonIdx: null, onlyFlagged: false });
  const L = topics[0].lessons;
  // standard(2) + grammar(1) + conjugation(1) all route to qcCheckPair
  assert.strictEqual(calls.pair, 4, 'pair checker ran on vocab + sentence + grammar + conjugation');
  assert.ok(L[0].vocab[0].qc && L[0].vocab[0].qc.sug === 'pair-fix', 'vocab got qc');
  // The QC result is stamped with the model that produced it (the active QC role).
  assert.strictEqual(L[0].vocab[0].qc.by, 'qc-stub', 'qc result stamps the QC model in .by');
  assert.ok(L[0].sentences[0].qc, 'sentence got qc');
  // word_forms → cloze checker on items
  assert.strictEqual(calls.cloze, 1, 'cloze checker ran once');
  assert.ok(L[1].items[0].qc && L[1].items[0].qc.sug === 'cloze-fix', 'word_forms item got qc');
  // synonyms → synset checker on words
  assert.strictEqual(calls.synset, 1, 'synset checker ran once');
  assert.ok(L[2].words[0].qc && L[2].words[0].qc.sug === 'syn-fix', 'synonyms entry got qc');
  // intro_script → never checked by the LLM
  assert.ok(!L[3].letters[0].qc, 'intro_script letters are not LLM-QC’d');
  // grammar → pair checker on the grammar entry (v49 expansion)
  assert.ok(L[4].grammar[0].qc && L[4].grammar[0].qc.sug === 'pair-fix', 'grammar entry got qc');
  // conjugation → pair checker on the infinitive/source (v49 expansion)
  assert.ok(L[5].conjugations[0].qc && L[5].conjugations[0].qc.sug === 'pair-fix', 'conjugation entry got qc');
  // math / error_hunt / mixed → out of scope, nothing checked, nothing stamped
  assert.ok(!('qcAt' in L[6]) && !('qcAt' in L[7]) && !('qcAt' in L[8]),
    'math/error_hunt/mixed are neither checked nor stamped');
  // qc shape the editor expects: { sug, field, at }
  assert.ok(L[1].items[0].qc.field && L[1].items[0].qc.at, 'qc has field + timestamp');
  // dialect lesson (_dialect) → sourceOnly dialect checker, NOT the standard pair checker.
  assert.strictEqual(calls.dialect || 0, 1, 'dialect vocab routed to qcCheckDialectPair');
  assert.ok(L[9].vocab[0].qc && L[9].vocab[0].qc.sug === 'dialect-fix', 'dialect vocab got the dialect-checker flag');
  assert.strictEqual(L[9].vocab[0].qc.field, 'source', 'dialect QC can only ever flag the source (never the dialect token)');
  assert.strictEqual(calls.pair, 4, 'dialect item did NOT go to the standard pair checker (still 4)');
  console.log('  _runQc dispatch: dialect lesson → sourceOnly dialect checker (target never touched): OK');

  // ── Seam: flagged-only QC must see per-item userFlag on items (word_forms) and words (synonyms) ──
  const flaggedFn = new Function('getFlags', ext(server, '_qcLessonUserFlagged') + '\nreturn _qcLessonUserFlagged;')(() => ({}));
  assert.strictEqual(flaggedFn({}, { type: 'word_forms', items: [{ sentence: 'a ___ b', userFlag: { comment: 'x' } }] }), true,
    'flagged word_forms item is detected in onlyFlagged mode');
  assert.strictEqual(flaggedFn({}, { type: 'synonyms', words: [{ base: 'x', userFlag: { comment: 'y' } }] }), true,
    'flagged synonyms entry is detected in onlyFlagged mode');
  assert.strictEqual(flaggedFn({}, { type: 'grammar', grammar: [{ target: 'x', userFlag: { comment: 'g' } }] }), true,
    'flagged grammar entry is detected in onlyFlagged mode');
  assert.strictEqual(flaggedFn({}, { type: 'conjugation', conjugations: [{ infinitive: 'x', userFlag: { comment: 'c' } }] }), true,
    'flagged conjugation entry is detected in onlyFlagged mode');
  assert.strictEqual(flaggedFn({}, { type: 'word_forms', items: [{ sentence: 'a ___ b' }] }), false,
    'unflagged word_forms lesson is not picked up');
  console.log('  flagged-only QC detects per-item flags on items/words/grammar/conjugation: OK');

  console.log('unit-qc-dispatch: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
