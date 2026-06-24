// B-phase-2: renderEx dispatches an exercise to its HTML builder through the
// per-exercise-type registry (EX_RENDERERS[ex.type]), not a hand-kept if/else chain.
// This registry is keyed by EXERCISE type (mcq_target_source, word_form, …) — distinct
// from LESSON_TYPE_META, which is keyed by LESSON type (standard, grammar, …).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Pull out the EX_RENDERERS object literal and evaluate it. The arrows reference renderer
// functions that don't exist in this sandbox; arrows only resolve those names when CALLED,
// so we inject recording stubs and call through them to verify each type -> renderer wire.
const lit = src.slice(src.indexOf('const EX_RENDERERS = {'), src.indexOf('function renderEx('));
assert.ok(lit.includes('const EX_RENDERERS = {'), 'EX_RENDERERS literal not found before renderEx');

// type -> the renderer name it must dispatch to (the contract this registry encodes).
const expected = {
  mcq_target_source: 'tMcqIE',
  mcq_source_target: 'tMcqEI',
  listen_mcq:        'tLMcq',
  listen_type:       'tLType',
  order:             'tOrder',
  read_translate:    'tRead',
  math_order:        'tMathOrder',
  math_calc:         'tMathCalc',
  math_latex:        'tMathLatex',
  word_form:         'tWordForm',
  syn_select:        'tSynSelect',
  mcq_article:       'tMcqArticle',
  mcq_plural:        'tMcqPlural',
  type_plural:       'tTypePlural',
  mcq_conjugation:   'tMcqConjugation',
  type_conjugation:  'tTypeConjugation',
};
const rendererNames = [...new Set(Object.values(expected))];

// Build the registry with each renderer name bound to a stub that records its own name,
// so calling EX_RENDERERS[type](ex) tells us which renderer the arrow targets.
const calls = [];
const stubArgs = rendererNames.map(n => `function ${n}(ex){ __calls.push('${n}'); return 'html:${n}'; }`).join('\n');
const { EX_RENDERERS } = new Function('__calls',
  stubArgs + '\n' + lit + '\nreturn { EX_RENDERERS };')(calls);

// Every entry is a function, and every expected type is present (nothing dropped).
for (const [type, renderer] of Object.entries(expected)) {
  assert.strictEqual(typeof EX_RENDERERS[type], 'function', `EX_RENDERERS.${type} missing/not a function`);
  calls.length = 0;
  const out = EX_RENDERERS[type]({ type });
  assert.deepStrictEqual(calls, [renderer], `EX_RENDERERS.${type} must dispatch to ${renderer}`);
  assert.strictEqual(out, 'html:' + renderer, `EX_RENDERERS.${type} must return its renderer's html`);
}
// No surprise extra keys beyond the known contract.
assert.deepStrictEqual(Object.keys(EX_RENDERERS).sort(), Object.keys(expected).sort(),
  'EX_RENDERERS keys must match the expected exercise-type set exactly');
console.log('  registry maps every exercise type to its renderer: OK');

// renderEx is a thin registry lookup, and the old if-chain is gone.
const reBody = src.slice(src.indexOf('function renderEx('), src.indexOf('function tWordForm('));
assert.ok(/const _exRender = EX_RENDERERS\[ex\.type\];/.test(reBody), 'renderEx should look up EX_RENDERERS[ex.type]');
assert.ok(/if\(_exRender\) html=_exRender\(ex\);/.test(reBody), 'renderEx should call the looked-up renderer');
assert.ok(!/else if\(ex\.type==='mcq_target_source'\)/.test(reBody), 'old mcq_target_source if-branch must be gone');
assert.ok(!/else if\(ex\.type==='word_form'\)/.test(reBody), 'old word_form if-branch must be gone');
assert.ok(!/else if\(ex\.type==='syn_select'\)/.test(reBody), 'old syn_select if-branch must be gone');
console.log('  renderEx is a thin registry lookup: OK');

// Static-slice rule: EX_RENDERERS (used at play time, reachable in the static build) must
// be defined AFTER function buildPath( or build-static.js drops it and static throws.
assert.ok(src.indexOf('const EX_RENDERERS = {') > src.indexOf('function buildPath('),
  'EX_RENDERERS must be defined after buildPath() to survive the static slice');
console.log('  EX_RENDERERS is inside the static slice: OK');

console.log('unit-renderex-registry: ALL PASSED');
