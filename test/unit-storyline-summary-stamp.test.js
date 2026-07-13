// unit-storyline-summary-stamp.test.js
// v53_c: the "Storyline summary generation" console block printed Chapters + Lang but NOT the model,
// and the summary was persisted as a bare string with no record of which model wrote it — unlike
// every lesson, which carries `_genMeta`. Storyline title generation and the chapter-title post-pass
// already logged their model; the summary was the odd one out.
// Guards: the console block names the model, the function returns {text, meta}, both call sites
// destructure it (a silent stringify would put "[object Object]" into a user-visible field), and the
// HTTP route still returns a plain string so the client contract is unchanged.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

function ext(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

const body = ext(server, 'generateStorylineSummary');

// 1. The console block names the model, like the two sibling pipelines already do.
assert.ok(/Chapters\s*:.*Model:\s*\$\{OLLAMA_MODEL\}/.test(body),
  'the Storyline summary console block prints the model it used');
assert.ok(/── Storyline title generation/.test(server) && /Model\s*:\s*\$\{OLLAMA_MODEL\}/.test(server),
  'storyline title generation still logs its model');
assert.ok(/Chapter-title post-pass/.test(server), 'chapter-title post-pass block still present');

// 2. It returns a stamped object, built by the same helper the lesson generators use.
assert.ok(/buildGenMeta\(\{[\s\S]*type: 'storyline_summary'/.test(body),
  'the summary is stamped via buildGenMeta, like every lesson generator');
assert.ok(/return \{ text: summary, meta \}/.test(body), 'returns {text, meta}');
assert.ok(/model: OLLAMA_MODEL/.test(body), 'stamps the STORY model (not the lesson model default)');

// v53_d: buildGenMeta no longer defaults the model at all — it throws. The summary must still name
// the STORY model explicitly (it is not a lesson), which the assertion above checks.
const meta = ext(server, 'buildGenMeta');
assert.ok(/`model` is required/.test(meta), 'buildGenMeta rejects a missing model rather than defaulting');
assert.ok(!/model: o\.model \|\| OLLAMA_LESSON_MODEL/.test(meta), 'the silent lesson-model default is gone');

// 3. Every call site destructures. A bare `const summary = await generateStorylineSummary(...)`
//    would assign the OBJECT to sl.summary and render "[object Object]" to the user.
const calls = server.match(/^.*await generateStorylineSummary\(.*$/gm) || [];
assert.strictEqual(calls.length, 2, `both call sites found (got ${calls.length})`);
calls.forEach(c => assert.ok(/\{ text: summary, meta: summaryMeta \}/.test(c),
  `call site destructures {text, meta} — found: ${c.trim()}`));

// 4. Both call sites persist the stamp beside the summary.
const persists = server.match(/sl\.summary = summary;\s*sl\.summaryMeta = summaryMeta;/g) || [];
assert.strictEqual(persists.length, 2, 'both call sites persist sl.summaryMeta');
assert.ok(!/sl\.summary = summary; upsertStoryline/.test(server), 'no call site stores the summary without its stamp');

// 5. The HTTP route still hands the client a plain string.
assert.ok(/return json\(res, 200, \{ summary \}\);/.test(server),
  '/api/storyline-retitle still returns a plain string summary (client contract unchanged)');

console.log('  storyline summary: model logged, stamped via buildGenMeta, both call sites updated: OK');
console.log('unit-storyline-summary-stamp: ALL PASSED');
