// E0: every generator stamps lesson._genMeta via buildGenMeta, so all flows (add-lesson,
// topic gen, book import, storyline recreate) carry generation metadata.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function extract(name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'not found: ' + name);
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}
const { buildGenMeta, genReasonHist } = new Function(
  "const OLLAMA_LESSON_MODEL='default-model';\n" + extract('buildGenMeta') + '\n' + extract('genReasonHist') +
  '\nreturn { buildGenMeta, genReasonHist };')();

// genReasonHist aggregates a validator's rejected[] into reason->count.
assert.deepStrictEqual(genReasonHist([{ reasons: ['a', 'b'] }, { reasons: ['a'] }]), { a: 2, b: 1 });
assert.deepStrictEqual(genReasonHist([]), {});
assert.deepStrictEqual(genReasonHist(null), {});
assert.deepStrictEqual(genReasonHist([{}]), {});
console.log('  genReasonHist: OK');

// buildGenMeta: full + defaults. v53_d: `model` is REQUIRED. It used to default to the lesson
// model, which silently mis-stamps any caller on another role (story / translation / procedural).
// Every real call site happened to match the default, so nothing was recorded wrong — but the trap
// was one copy-paste away from writing permanent, wrong provenance into lessons.json.
const full = buildGenMeta({ type: 'word_forms', model: 'default-model', t0: Date.now() - 5, attempts: 2, valid: 3, rejected: 1,
  rejectReasons: { dup: 1 }, promptTokens: 10, completionTokens: 20 });
assert.strictEqual(full.type, 'word_forms');
assert.strictEqual(full.model, 'default-model');
assert.strictEqual(full.attempts, 2);
assert.strictEqual(full.valid, 3);
assert.strictEqual(full.rejected, 1);
assert.deepStrictEqual(full.rejectReasons, { dup: 1 });
assert.strictEqual(full.promptTokens, 10);
assert.ok(Number.isInteger(full.ms) && full.ms >= 0, 'ms computed from t0');
assert.ok(typeof full.at === 'string', 'at timestamp');

// Omitting the model is now a hard error, not a silent default.
assert.throws(() => buildGenMeta({ type: 'standard' }), /`model` is required/, 'model must be passed');
assert.throws(() => buildGenMeta({}), /`model` is required/, 'no silent default');
assert.throws(() => buildGenMeta(), /`model` is required/, 'no args → throws');

const def = buildGenMeta({ model: 'default-model' });
assert.strictEqual(def.model, 'default-model');
assert.strictEqual(def.attempts, null);
assert.strictEqual(def.valid, null);
assert.strictEqual(def.rejected, 0);
assert.strictEqual(def.rejectReasons, null);
assert.strictEqual(def.ms, null, 'ms null without t0');
// Sentinels for the non-LLM / non-generated paths.
for (const sentinel of ['(procedural)', '(user-provided)', '(unknown)']) {
  assert.strictEqual(buildGenMeta({ model: sentinel }).model, sentinel, `${sentinel} sentinel accepted`);
}

// Every buildGenMeta call site in server.js must name a model.
const _server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const _calls = _server.match(/buildGenMeta\(\{[^}]*/g) || [];
assert.ok(_calls.length >= 10, `buildGenMeta call sites found (${_calls.length})`);
_calls.forEach(c => assert.ok(/model:/.test(c),
  `call site names a model — found: ${c.slice(0, 70).replace(/\n/g, ' ')}`));
console.log('  buildGenMeta full + defaults: OK');

// Every generator stamps _genMeta (so no flow ships an unannotated lesson).
const stamps = (src.match(/_genMeta: buildGenMeta\(/g) || []).length;
assert.ok(stamps >= 8, `expected >=8 generator _genMeta stamps, found ${stamps}`);
for (const g of ['generateOneLesson', 'generateErrorHunt', 'generateGrammar', 'generateWordForms',
                 'generateSynonyms', 'generateConjugation', 'generateMath', 'generateMathLLM']) {
  assert.ok(/_genMeta: buildGenMeta\(/.test(extract(g)), `${g} must stamp _genMeta`);
}
console.log('  all 8 generators stamp _genMeta: OK');
console.log('unit-genmeta: ALL PASSED');
