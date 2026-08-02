// Unit tests for the synonyms context-sentence helper (server). Extracts the real
// _wfNorm / _synSplitSentences / findContextSentence from server.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
function extract(name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'not found: ' + name);
  const braceStart = src.indexOf('{', at);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) { i++; break; } } }
  return src.slice(at, i);
}
// v72_a: _synSplitSentences now delegates to the shared _sentenceSplit (one rule per question),
// so the extraction has to pull that in too. Parity with the client copy is asserted in
// unit-sentence-segmentation.test.js.
const { _synSplitSentences, findContextSentence } = new Function(
  extract('_wfNorm') + '\n' + extract('_sentenceSplit') + '\n' + extract('_synSplitSentences') + '\n' + extract('findContextSentence') +
  '\nreturn { _synSplitSentences, findContextSentence };')();

const story = 'Das Haus war klein und alt. Sieben rannte schnell zur Tür. Die Katze schlief.';

// Splitting
const sents = _synSplitSentences(story);
assert.strictEqual(sents.length, 3, 'splits into 3 sentences');
assert.ok(sents[0].startsWith('Das Haus'), 'first sentence intact');

// Whole-word match, case-insensitive, punctuation-insensitive.
assert.strictEqual(findContextSentence('klein', [sents]), 'Das Haus war klein und alt.');
assert.strictEqual(findContextSentence('Schnell', [sents]), 'Sieben rannte schnell zur Tür.');
assert.strictEqual(findContextSentence('Katze', [sents]), 'Die Katze schlief.');
console.log('  finds the right sentence: OK');

// No false positive on a substring (klein should not match "kleinlich").
const story2 = _synSplitSentences('Er ist kleinlich gewesen.');
assert.strictEqual(findContextSentence('klein', [story2]), '', 'substring is not a whole-word match');
console.log('  whole-word only (no substring hits): OK');

// Pool order: prefers the first pool, falls back to the second.
const a = _synSplitSentences('Nur Vokabeln hier.');
const b = _synSplitSentences('Das Wort taucht hier auf.');
assert.strictEqual(findContextSentence('Wort', [a, b]), 'Das Wort taucht hier auf.', 'falls back to second pool');
assert.strictEqual(findContextSentence('fehlt', [a, b]), '', 'absent word -> empty');
console.log('  pool fallback + absent word: OK');


// ── v72_d: the model's own context sentence, verified before it is trusted ────────
// generateSynonyms now sends the STORY (not eight extracted keywords) and asks the model to quote
// the sentence it chose the synonyms against. That only helps if the quote is real: a model asked
// to copy text will paraphrase, translate, merge two sentences, or invent one. An invented sentence
// would be worse than the server-picked one it replaces, so it is checked rather than trusted.
{
  const { verbatimStorySentence } = new Function(
    extract('_wfNorm') + '\n' + extract('verbatimStorySentence') +
    '\nreturn { verbatimStorySentence };')();

  const STORY = 'Das Haus war klein und alt.\nSieben rannte schnell zur Tür.\nDie Katze schlief.';

  // Accepted: an exact quote containing the base word.
  assert.strictEqual(verbatimStorySentence('Das Haus war klein und alt.', 'Haus', STORY),
    'Das Haus war klein und alt.', 'an exact quote is kept');
  // Whitespace is normalised on both sides — the model will not reproduce the story's line wrapping.
  assert.strictEqual(verbatimStorySentence('Das  Haus   war klein und alt.', 'Haus', STORY),
    'Das Haus war klein und alt.', 'whitespace differences do not reject a real quote');

  // Rejected, one failure mode per line. Each returns '' so the caller falls back to its own search.
  assert.strictEqual(verbatimStorySentence('Das Haus war sehr klein.', 'Haus', STORY), '',
    'a PARAPHRASE is rejected');
  assert.strictEqual(verbatimStorySentence('The house was small and old.', 'Haus', STORY), '',
    'a TRANSLATION is rejected');
  assert.strictEqual(verbatimStorySentence('Das Haus war klein und alt. Die Katze schlief.', 'Haus', STORY), '',
    'two sentences JOINED across a line break are rejected');
  assert.strictEqual(verbatimStorySentence('Das Haus war klein …', 'Haus', STORY), '',
    'a TRUNCATED quote with an ellipsis is rejected');
  assert.strictEqual(verbatimStorySentence('Der Hund bellte laut.', 'Hund', STORY), '',
    'an INVENTED sentence is rejected');

  // Quoted correctly, but useless as context: it does not contain the base word.
  assert.strictEqual(verbatimStorySentence('Die Katze schlief.', 'Haus', STORY), '',
    'a real quote that does not contain the base word is rejected too');
  // Whole-word, so a substring hit is not enough (the same rule findContextSentence uses).
  assert.strictEqual(verbatimStorySentence('Sieben rannte schnell zur Tür.', 'schnel', STORY), '',
    'a partial word does not count as containing the base');

  // Degenerate input never throws and never fabricates.
  for (const [c, b, st] of [[null, 'Haus', STORY], ['', 'Haus', STORY], ['Das Haus war klein und alt.', '', STORY],
                            ['Das Haus war klein und alt.', 'Haus', ''], [undefined, undefined, undefined]])
    assert.strictEqual(verbatimStorySentence(c, b, st), '', 'degenerate input returns empty');

  console.log('  model-quoted context sentence: exact quotes kept, 6 failure modes rejected: OK');
}


// ── v72_e: an antonym-only word must still be PLAYABLE ───────────────────────────
// The prompt now says [] beats a doubtful synonym, and the server keeps an entry that has either
// relation. Both are pointless if the client cannot build an exercise from one, so this checks the
// third link in the chain rather than assuming it. buildSynonymsExercises makes one select-all per
// relation and returns null for the empty one.
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  function ext(src, name) {
    const at = src.indexOf('function ' + name + '(');
    assert.ok(at >= 0, 'missing ' + name);
    const b = src.indexOf('{', at); let d = 0, i = b;
    for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
    return src.slice(at, i);
  }
  const { buildSynonymsExercises } = new Function(
    'function shuffle(a){ return a.slice(); }\n' + ext(html, 'buildSynonymsExercises') +
    '\nreturn { buildSynonymsExercises };')();

  const lesson = { words: [
    { base: 'gleich', gloss: 'same', sentence: 'Die Katze und das Haus blieben gleich.',
      synonyms: [], antonyms: [{ w: 'anders', g: 'different' }], homophones: [] },
    { base: 'Haus', gloss: 'house', sentence: 'Das Haus war klein.',
      synonyms: [{ w: 'Gebäude', g: 'building' }], antonyms: [], homophones: [] },
  ] };
  const exs = buildSynonymsExercises(lesson);

  const forGleich = exs.filter(e => e.base === 'gleich');
  assert.strictEqual(forGleich.length, 1, 'an antonym-only word yields exactly ONE exercise');
  assert.strictEqual(forGleich[0].mode, 'antonyms', 'and it is the antonyms one');
  assert.deepStrictEqual(forGleich[0].correct, ['anders'], 'with the antonym as the answer');
  assert.ok(forGleich[0].choices.length > 1, 'and at least one wrong option to choose against');
  assert.ok(forGleich[0].choices.includes('anders'), 'the correct word survives the choice slice');

  // The mirror case, so the assertion above is not just describing whatever the builder happens to do.
  const forHaus = exs.filter(e => e.base === 'Haus');
  assert.strictEqual(forHaus.length, 1, 'a synonym-only word likewise yields exactly one');
  assert.strictEqual(forHaus[0].mode, 'synonyms', 'and it is the synonyms one');

  // A word with NEITHER relation produces nothing rather than an unanswerable exercise.
  const none = buildSynonymsExercises({ words: [
    { base: 'x', gloss: 'x', synonyms: [], antonyms: [], homophones: [] },
    { base: 'y', gloss: 'y', synonyms: [{ w: 'z', g: 'z' }], antonyms: [], homophones: [] },
  ] });
  assert.strictEqual(none.filter(e => e.base === 'x').length, 0,
    'a word with neither relation yields no exercise');
  console.log('  antonym-only and synonym-only words are both playable: OK');
}

console.log('unit-syn-context: ALL PASSED');
