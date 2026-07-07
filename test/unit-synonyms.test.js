// Unit tests for buildSynonymsExercises: each relation becomes a MULTI-SELECT
// "select all" exercise — ALL synonyms (or all antonyms) are correct, mixed with
// distractors that are never valid answers for that relation; the base word's context
// sentence (if any) is shown. Randomness-agnostic.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// renderEx now dispatches via the exercise-renderer registry (B-phase-2), not an if-chain.
assert.ok(/syn_select:\s*\(ex\)\s*=>\s*tSynSelect\(ex\)/.test(html), 'EX_RENDERERS missing syn_select -> tSynSelect');
assert.ok(html.includes('function tSynSelect'), 'tSynSelect renderer missing');
assert.ok(html.includes('function synToggle'), 'synToggle (multi-select toggle) missing');
console.log('  wiring present: OK');

function extract(name) {
  const at = html.indexOf('function ' + name + '(');
  const braceStart = html.indexOf('{', at);
  let depth = 0, i = braceStart;
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (!depth) { i++; break; } } }
  return html.slice(at, i);
}
const { buildSynonymsExercises } = new Function('shuffle',
  extract('buildSynonymsExercises') + '\nreturn { buildSynonymsExercises };')(a => a.slice());

const lesson = { type: 'synonyms', words: [
  { base: 'klein', gloss: 'small', sentence: 'Das Haus war klein und alt.',
    synonyms: [{ w: 'winzig', g: 'tiny' }, { w: 'gering', g: 'slight' }],
    antonyms: [{ w: 'groß', g: 'big' }, { w: 'riesig', g: 'huge' }],
    homophones: [] },
  { base: 'schnell', gloss: 'fast', sentence: '',
    synonyms: [{ w: 'rasch', g: 'quick' }],
    antonyms: [{ w: 'langsam', g: 'slow' }, { w: 'träge', g: 'sluggish' }, { w: 'gemächlich', g: 'leisurely' }],
    homophones: [] },
] };

for (let iter = 0; iter < 25; iter++) {
  const exs = buildSynonymsExercises(lesson);
  assert.ok(exs.length >= 2, 'builds synonym + antonym exercises');
  for (const e of exs) {
    assert.strictEqual(e.type, 'syn_select');
    assert.ok(e.mode === 'synonyms' || e.mode === 'antonyms', 'mode set');
    assert.ok(Array.isArray(e.correct) && e.correct.length >= 1, 'correct is a non-empty array');
    const g = lesson.words.find(w => w.base === e.base);
    const valid = (e.mode === 'synonyms' ? g.synonyms : g.antonyms).map(x => x.w.toLowerCase());
    // ALL valid answers for the relation are marked correct (select-all).
    assert.strictEqual(new Set(e.correct.map(c => c.toLowerCase())).size, valid.length, 'all ' + e.mode + ' included as correct');
    e.correct.forEach(c => assert.ok(valid.includes(c.toLowerCase()), '"' + c + '" is a real ' + e.mode.slice(0, -1)));
    // Every correct word appears in the grid.
    e.correct.forEach(c => assert.ok(e.choices.some(x => x.toLowerCase() === c.toLowerCase()), 'correct "' + c + '" present in choices'));
    // At least one distractor, distinct choices, base excluded, distractors not valid answers.
    assert.ok(e.choices.length > e.correct.length, 'has at least one distractor');
    assert.strictEqual(new Set(e.choices.map(c => c.toLowerCase())).size, e.choices.length, 'choices distinct');
    const correctLc = new Set(e.correct.map(c => c.toLowerCase()));
    for (const c of e.choices) {
      if (correctLc.has(c.toLowerCase())) continue;
      assert.ok(!valid.includes(c.toLowerCase()), 'distractor "' + c + '" must not be a valid ' + e.mode);
      assert.ok(c.toLowerCase() !== e.base.toLowerCase(), 'base not a choice');
    }
  }
}
console.log('  multi-select: all answers correct, valid distractors: OK');

// Context sentence passes through (present for klein, empty for schnell).
const exs = buildSynonymsExercises(lesson);
const kleinEx = exs.find(e => e.base === 'klein');
assert.ok(kleinEx && kleinEx.sentence === 'Das Haus war klein und alt.', 'context sentence carried');
console.log('  context sentence carried: OK');

// The solution reveal shows each correct word's EXACT translation (gloss) from the lesson data.
assert.ok(html.includes('function synRevealHtml'), 'synRevealHtml helper missing');
// Both reveal sites (correct + wrong) route syn_select through the helper, not a bare join.
assert.ok(/ex\.type==='syn_select' \? synRevealHtml\(ex\)/.test(html), 'correct-reveal uses synRevealHtml');
assert.ok(/_wrongCorrect = ex\.type==='syn_select' \? synRevealHtml\(ex\)/.test(html), 'wrong-reveal uses synRevealHtml');

const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const { buildSynonymsExercises: build2, synRevealHtml } = new Function('shuffle', 'escHtml',
  extract('buildSynonymsExercises') + '\n' + extract('synRevealHtml') +
  '\nreturn { buildSynonymsExercises, synRevealHtml };')(a => a.slice(), escHtml);

for (const e of build2(lesson)) {
  const g = lesson.words.find(w => w.base === e.base);
  const srcArr = (e.mode === 'synonyms' ? g.synonyms : g.antonyms);
  // glossMap maps each correct word (lowercased) → its exact authored gloss.
  assert.ok(e.glossMap && typeof e.glossMap === 'object', e.mode + ' exercise carries a glossMap');
  for (const { w, g: gloss } of srcArr) {
    assert.strictEqual(e.glossMap[w.toLowerCase()], gloss, `glossMap["${w.toLowerCase()}"] === "${gloss}"`);
  }
  // The reveal HTML pairs every correct word with its exact translation.
  const revealHtml = synRevealHtml(e);
  for (const { w, g: gloss } of srcArr) {
    assert.ok(revealHtml.includes(escHtml(w)), `reveal shows the word "${w}"`);
    assert.ok(revealHtml.includes(escHtml(gloss)), `reveal shows the exact translation "${gloss}" for "${w}"`);
  }
}
// Graceful fallback: a word with no gloss reveals just the word (no dangling separator).
{
  const noGloss = { type: 'synonyms', words: [{ base: 'x', gloss: '', sentence: '',
    synonyms: [{ w: 'alpha', g: '' }], antonyms: [{ w: 'omega', g: 'the end' }], homophones: [] }] };
  const ex = build2(noGloss).find(e => e.mode === 'synonyms');
  const rev = synRevealHtml(ex);
  assert.ok(rev.includes('alpha') && !rev.includes('—'), 'no-gloss word reveals plainly, no dangling dash');
}
console.log('  reveal shows exact per-word translations (+ graceful fallback): OK');

console.log('unit-synonyms: ALL PASSED');
