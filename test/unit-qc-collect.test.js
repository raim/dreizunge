// v52_g collect-and-compare: _runQc collects each QC model's verdict PER MODEL in item.qcByModel,
// so different models can be compared on the same item. A model overwrites only its own entry; a
// model that now says OK drops only its own flag; item.qc stays as the primary (backward compat).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function ext(name) {
  const at = src.indexOf('async function ' + name + '(');
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}
function build(qcModel, pairRes) {
  const stubs = {
    OLLAMA_QC_MODEL: qcModel, jobStep: () => {}, jobDone: () => {}, upsert: () => {},
    // v59 meter deps (accounting covered by unit-token-usage.test.js)
    meterLLMTokens: async (fn) => ({ result: await fn(), tokens: { promptTokens: 0, completionTokens: 0 } }),
    addTokenUsage: () => {},
    _qcStripFuri: t => t, _qcLessonUserFlagged: () => true,
    qcCheckPair: async () => pairRes, qcCheckDialectPair: async () => ({ ok: true }),
    qcCheckCloze: async () => ({ ok: true }), qcCheckSynonymSet: async () => ({ ok: true }),
    _lessonHasOpenQcFlag: (ls) => [ls.vocab, ls.sentences].some(a => Array.isArray(a) && a.some(x => x && x.qc)),
  };
  return new Function(...Object.keys(stubs), ext('_runQc') + '\nreturn _runQc;')(...Object.values(stubs));
}
const topics = [{ id: 't', topic: 'T', lang: 'lb', srcLang: 'de',
  lessons: [{ type: 'standard', vocab: [{ target: 'Haus', source: 'Haus' }], sentences: [] }] }];
const opts = { lessonIdx: null, onlyFlagged: false };
const v = () => topics[0].lessons[0].vocab[0];

(async () => {
  // Model A (qwen) flags it.
  await build('qwen', { ok: false, field: 'source', sug: 'qwen-fix' })('j', topics, opts);
  assert.deepStrictEqual(Object.keys(v().qcByModel), ['qwen'], 'qwen verdict collected');
  assert.strictEqual(v().qc.by, 'qwen', 'primary = qwen');

  // Model B (translategemma) also flags it — both are kept.
  await build('translategemma', { ok: false, field: 'source', sug: 'tg-fix' })('j', topics, opts);
  assert.deepStrictEqual(Object.keys(v().qcByModel).sort(), ['qwen', 'translategemma'], 'both models collected');
  assert.strictEqual(v().qcByModel.qwen.sug, 'qwen-fix', 'qwen suggestion preserved');
  assert.strictEqual(v().qcByModel.translategemma.sug, 'tg-fix', 'translategemma suggestion recorded');
  assert.strictEqual(v().qc.by, 'translategemma', 'primary = latest (translategemma)');

  // A model overwrites only its OWN entry on re-flag.
  await build('qwen', { ok: false, field: 'source', sug: 'qwen-fix-v2' })('j', topics, opts);
  assert.strictEqual(v().qcByModel.qwen.sug, 'qwen-fix-v2', 'qwen re-flag overwrites its own entry');
  assert.strictEqual(v().qcByModel.translategemma.sug, 'tg-fix', 'other model untouched by qwen re-flag');

  // qwen now says OK → drops ONLY qwen, keeps translategemma; primary falls back to translategemma.
  await build('qwen', { ok: true })('j', topics, opts);
  assert.deepStrictEqual(Object.keys(v().qcByModel), ['translategemma'], 'qwen OK dropped only qwen');
  assert.strictEqual(v().qc.by, 'translategemma', 'primary fell back to the remaining model');

  // translategemma also OK → item fully cleared.
  await build('translategemma', { ok: true })('j', topics, opts);
  assert.ok(!v().qc && !v().qcByModel, 'both OK → qc + qcByModel gone');

  // Migration: an old single flag with a `by` but no qcByModel is folded in, not lost.
  delete topics[0].lessons[0].qcAt; delete topics[0].lessons[0].qcBy;   // (a content edit clears the stamp)
  v().qc = { sug: 'legacy', field: 'source', at: 'x', by: 'legacy-model' };
  await build('translategemma', { ok: false, field: 'source', sug: 'tg-new' })('j', topics, opts);
  assert.deepStrictEqual(Object.keys(v().qcByModel).sort(), ['legacy-model', 'translategemma'], 'old single flag migrated + new one added');

  console.log('unit-qc-collect: ALL PASSED');
})();
