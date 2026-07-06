// unit-dialect-examples.test.js
// M1.5: opt-in AI example sentences for dialect words. The generation itself needs Ollama (verified
// live), but the pure logic is testable headlessly: reply parsing (D:/G: lines), the guardrail that
// rejects a sentence not containing the target word, and that aiGenerated dialect items get FULL QC
// (both sides) rather than sourceOnly (because the model authored them, so the dialect side is not
// ground truth).
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
// The function is `async function generateDialectExample(...)`.
function extAsync(src, n) {
  const at = src.indexOf('async function ' + n + '(');
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);   // keep the `async` keyword — the body uses await
}

// ── generateDialectExample: parse + guardrail, with callLLMTranslation stubbed ──
async function run(reply, word, gloss) {
  const stubs = {
    langName: x => (x === 'de' ? 'German' : x),
    callLLMTranslation: async () => ({ text: reply }),
  };
  const fn = new Function(...Object.keys(stubs), extAsync(server, 'generateDialectExample') + '\nreturn generateDialectExample;')(...Object.values(stubs));
  return fn(word, gloss, [{ target: 'Gitsche', source: 'Mädchen' }, { target: 'heint', source: 'heute' }], 'de');
}

(async () => {
  // Well-formed reply containing the word → parsed pair.
  let r = await run('D: Heint hon i a Gitsche gsegn.\nG: Heute habe ich ein Mädchen gesehen.', 'Gitsche', 'Mädchen');
  assert.ok(r && r.target === 'Heint hon i a Gitsche gsegn.', 'dialect sentence parsed from D: line');
  assert.strictEqual(r.source, 'Heute habe ich ein Mädchen gesehen.', 'gloss parsed from G: line');
  console.log('  parses D:/G: reply into {target, source}: OK');

  // Guardrail: sentence that does NOT contain the target word → rejected.
  r = await run('D: Heint is a scheena Tog.\nG: Heute ist ein schöner Tag.', 'Gitsche', 'Mädchen');
  assert.strictEqual(r, null, 'sentence missing the target word is rejected (off-target)');
  console.log('  guardrail: rejects a sentence that omits the target word: OK');

  // Malformed reply (missing G:) → null, no crash.
  r = await run('D: Heint hon i a Gitsche gsegn.', 'Gitsche', 'Mädchen');
  assert.strictEqual(r, null, 'missing gloss line → null');
  // Empty reply → null.
  r = await run('', 'Gitsche', 'Mädchen');
  assert.strictEqual(r, null, 'empty reply → null');
  console.log('  malformed/empty replies → null (no crash): OK');

  // slash-variant word: guardrail uses the first token before a slash/space.
  r = await run('D: I tua di tschoppen.\nG: Ich stopfe dich voll.', 'tschoppen/einetschoppen', 'reinstopfen');
  assert.ok(r && /tschoppen/.test(r.target), 'slash-variant word matches on its first token');
  console.log('  slash-variant target matches on first token: OK');

  // ── QC routing: aiGenerated dialect item → full pair QC, not sourceOnly ──
  assert.ok(/&& !item\.aiGenerated\)/.test(server),
    'QC routes _dialect items to sourceOnly ONLY when not aiGenerated');
  assert.ok(/the model authored those, so the dialect side is[\s\S]*?NOT ground truth/.test(server),
    'comment documents why aiGenerated dialect gets full QC');
  console.log('  QC routing: aiGenerated dialect examples get full (both-side) QC: OK');

  // ── Endpoint marks items aiGenerated + needsReview + review-gated lesson ──
  assert.ok(/url\.pathname === '\/api\/dialect-examples'/.test(server), 'dialect-examples endpoint exists');
  assert.ok(/aiGenerated: true, needsReview: true/.test(server), 'generated sentences marked aiGenerated + needsReview');
  assert.ok(/_aiExamples: true, needsReview: true/.test(server), 'the AI-examples lesson is marked for review');
  assert.ok(/if \(!topic\._dialect\) return json\(res, 400/.test(server), 'endpoint refuses non-dialect topics');
  console.log('  endpoint: opt-in, marks aiGenerated + needsReview, review-gated lesson: OK');

  console.log('unit-dialect-examples: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });

// ── M2 gate (story generation requires human curation) ───────────────────────
const server2 = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
assert.ok(/url\.pathname === '\/api\/dialect-curate'/.test(server2), 'curation endpoint exists');
assert.ok(/url\.pathname === '\/api\/dialect-story'/.test(server2), 'story endpoint exists');
assert.ok(/if \(!topic\._dialect\.curated\)[\s\S]*?return json\(res, 403/.test(server2),
  'story generation is refused (403) unless the dialect is curated');
assert.ok(/if \(!hasSample\) return json\(res, 400/.test(server2),
  'curation is refused unless there is reviewable AI sample output');
assert.ok(/write a SHORT, simple story in a regional dialect/.test(server2),
  'the dialect story generator uses a constrained few-shot prompt');
assert.ok(/aiGenerated = true;[\s\S]*?needsReview: true/.test(server2) || /_dialect\.aiStory = \{[\s\S]*?needsReview: true/.test(server2),
  'a generated story is marked aiGenerated + needsReview (not trusted)');
console.log('  M2 gate: curate + story endpoints, 403 without curation, sample required, marked: OK');
