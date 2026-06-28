// B-phase-4: the /api/lessons/add-lesson handler dispatches lessonFormat -> generator
// through the ADD_LESSON_GENERATORS registry, not a hand-kept if/else chain. Each entry is
// a thin adapter over one context object. This test evaluates the registry literal with
// recording stub generators and asserts every fmt maps to the right generator with the
// right argument shape — including the grammar/conjugation/error_hunt/math paths the e2e
// suite doesn't exercise directly.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

// Pull out the registry literal. Arrows defer name resolution to call time, so we inject
// recording stubs for the generator names and call each adapter.
const lit = src.slice(src.indexOf('const ADD_LESSON_GENERATORS = {'),
  src.indexOf('};', src.indexOf('const ADD_LESSON_GENERATORS = {')) + 2);
assert.ok(lit.startsWith('const ADD_LESSON_GENERATORS'), 'registry literal not found');

const genNames = ['generateOneLesson','generateErrorHunt','generateGrammar','generateConjugation',
  'generateSynonyms','generateWordForms','generateMathLLM','generateMath','generateIntroScript'];
const calls = [];
const stubs = genNames.map(n => `function ${n}(){ __calls.push({ fn:'${n}', args:[].slice.call(arguments) }); return {lesson:{},_stub:'${n}'}; }`).join('\n');
const { ADD_LESSON_GENERATORS } = new Function('__calls',
  stubs + '\n' + lit + '\nreturn { ADD_LESSON_GENERATORS };')(calls);

// A context object with distinguishable values so we can assert the argument mapping.
const ctx = {
  lang:'de', srcLang:'en', topicName:'My Topic', story:'the story', diff:2, jobId:'job1',
  chainVocab:{ words:[{target:'w'}], nouns:[], verbs:[] },
  standardOpts:{ tag:'STD' }, sharedGenOpts:{ tag:'SHARED' },
  addMathInstr:null, addMathOps:['+'],
};
function callOf(fmt){ calls.length = 0; ADD_LESSON_GENERATORS[fmt](ctx); assert.strictEqual(calls.length, 1, `${fmt} must call exactly one generator`); return calls[0]; }

// 1) Every fmt is present and maps to the expected generator + args.
let c = callOf('standard');
assert.strictEqual(c.fn, 'generateOneLesson');
assert.deepStrictEqual(c.args, ['de','en','My Topic',1,1,[],'the story',2,'job1',{tag:'STD'}], 'standard arg shape');

c = callOf('error_hunt');
assert.strictEqual(c.fn, 'generateErrorHunt');
assert.deepStrictEqual(c.args, ['the story','de',2,'job1',[{target:'w'}]], 'error_hunt arg shape (chainVocab.words)');

for (const [fmt, fn] of [['grammar','generateGrammar'],['conjugation','generateConjugation'],['synonyms','generateSynonyms'],['word_forms','generateWordForms']]) {
  c = callOf(fmt);
  assert.strictEqual(c.fn, fn, `${fmt} -> ${fn}`);
  assert.deepStrictEqual(c.args, ['My Topic','de','en',2,'job1',{tag:'SHARED'}], `${fmt} arg shape (sharedGenOpts)`);
}

// 2) math forks on addMathInstr (procedural vs LLM), same as the old branch.
c = callOf('math');                              // addMathInstr null -> procedural
assert.strictEqual(c.fn, 'generateMath');
assert.deepStrictEqual(c.args, ['the story',2,['+']], 'procedural math arg shape (addMathOps)');
ctx.addMathInstr = 'sum to 100';
c = callOf('math');                              // instruction present -> LLM
assert.strictEqual(c.fn, 'generateMathLLM');
assert.deepStrictEqual(c.args, ['de','en',2,'sum to 100','job1'], 'LLM math arg shape');
ctx.addMathInstr = null;

// intro_script: procedural + story-independent, keyed on the target lang + optional script.
ctx.introScript = null;
c = callOf('intro_script');
assert.strictEqual(c.fn, 'generateIntroScript');
assert.deepStrictEqual(c.args, ['de', { script: null }], 'intro_script arg shape (lang, {script})');

// 3) Exactly the expected fmt set — nothing dropped, nothing extra.
assert.deepStrictEqual(Object.keys(ADD_LESSON_GENERATORS).sort(),
  ['conjugation','error_hunt','grammar','intro_script','math','standard','synonyms','word_forms'],
  'registry fmt set');
console.log('  every fmt maps to the right generator with the right args: OK');

// 4) The handler dispatches via the registry, and the old if-chain + unsupported-throw wire up.
const handler = src.slice(src.indexOf("url.pathname === '/api/lessons/add-lesson'"),
  src.indexOf('/api/storyline/recreate-lessons'));
assert.ok(/const genFn = ADD_LESSON_GENERATORS\[fmt\];/.test(handler), 'handler should look up the registry');
assert.ok(/result = await genFn\(genCtx\);/.test(handler), 'handler should call the looked-up generator');
assert.ok(/if \(!genFn\) throw new Error\(`Unsupported lessonFormat: \$\{fmt\}`\)/.test(handler), 'unknown fmt still throws');
assert.ok(!/if \(fmt === 'standard'\)/.test(handler), 'old fmt if-chain must be gone');
assert.ok(!/else if \(fmt === 'word_forms'\)/.test(handler), 'old word_forms branch must be gone');
console.log('  add-lesson handler is a thin registry dispatch: OK');

console.log('unit-add-lesson-registry: ALL PASSED');
