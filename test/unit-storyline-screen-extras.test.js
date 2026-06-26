// v47 minor #3 — storyline-screen per-chapter "lesson types" dropdown. lessonSetTypes(s)
// returns the distinct lesson types in a saved topic's lesson-sets, in first-seen order,
// treating a missing type as 'standard' (lessonTypeMeta's fallback). Pure; this guards the
// data the dropdown renders (the dropdown UI itself is browser-verify-owed).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extract(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing fn ' + name);
  const bs = html.indexOf('{', at);
  let d = 0, i = bs;
  for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
}
const { lessonSetTypes } = new Function(extract('lessonSetTypes') + '\nreturn { lessonSetTypes };')();

// empty / missing
assert.deepStrictEqual(lessonSetTypes(null), [], 'null -> []');
assert.deepStrictEqual(lessonSetTypes({}), [], 'no lessons -> []');
assert.deepStrictEqual(lessonSetTypes({ lessons: [] }), [], 'empty lessons -> []');

// distinct, first-seen order preserved
assert.deepStrictEqual(
  lessonSetTypes({ lessons: [{ type: 'vocab' }, { type: 'grammar' }, { type: 'vocab' }, { type: 'word_forms' }] }),
  ['vocab', 'grammar', 'word_forms'], 'dedup keeps first-seen order');

// missing type -> 'standard'
assert.deepStrictEqual(lessonSetTypes({ lessons: [{}, { type: 'synonyms' }] }), ['standard', 'synonyms'],
  'missing type counts as standard');
assert.deepStrictEqual(lessonSetTypes({ lessons: [{ type: 'standard' }, {}] }), ['standard'],
  'explicit standard and missing collapse together');

// live mode: prefer the precomputed lessonTypes the /api/lessons list provides (the list
// payload strips the full lessons[]), falling back to lessons[] for the static build.
assert.deepStrictEqual(lessonSetTypes({ lessonTypes: ['vocab', 'grammar'] }), ['vocab', 'grammar'],
  'prefers precomputed lessonTypes (live)');
assert.deepStrictEqual(lessonSetTypes({ lessonTypes: ['math'], lessons: [{ type: 'vocab' }] }), ['math'],
  'lessonTypes wins over lessons[] when both present');
assert.deepStrictEqual(lessonSetTypes({ lessonTypes: [] }), [], 'empty lessonTypes array is respected');

console.log('  lessonSetTypes: distinct/order/empty/standard-fallback + live lessonTypes: OK');

// The /api/lessons list payload must carry lessonTypes (so live mode has the data).
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
assert.ok(/lessonTypes:\s*\(\(\)\s*=>\s*\{/.test(server), '/api/lessons should emit a lessonTypes array');

// Wiring guards (cheap structural checks; UI behaviour is browser-owed):
// #1 storyline-screen QC button reuses qcRun({storylineId}); #3 dropdown is rendered per card.
assert.ok(/qcBtn\.onclick = \(\) => qcRun\(\{ storylineId: chainId \}, qcBtn\)/.test(html),
  'storyline-screen QC button should call qcRun({storylineId})');
assert.ok(/id="sl-screen-qc-btn"/.test(html), 'sl-screen-qc-btn must exist in the header');
assert.ok(/out \+= _lessonTypesDropdownHtml\(s\);/.test(html), 'chapter card should append the lesson-types dropdown');
console.log('  storyline-screen QC button + per-card dropdown wired: OK');

console.log('unit-storyline-screen-extras: ALL PASSED');
