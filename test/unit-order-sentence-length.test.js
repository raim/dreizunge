// unit-order-sentence-length.test.js
// User request: "Sentence ordering lesson should only be triggered for short sentences, max 5
// words." — assembling a shuffled word bank into a sentence gets much harder as the sentence grows,
// so buildStandardExercises now only offers the `order` type for sentences with ≤5 words
// (`s.words.length`, the same per-sentence token count `mkOrder` itself trusts). Other sentence-
// derived types (`read_translate`) are untouched — this is about the ORDERING task specifically.
//
// Extraction harness mirrors unit-beginner-types.test.js's own: buildStandardExercises is pulled
// out of index.html and run standalone with stubbed globals, `pick(a,n)` returns the first n
// (deterministic — no shuffle to fight), so which sentences survive is exactly the filter's doing.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function ext(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing ' + name);
  const b = html.indexOf('{', at); let d = 0, i = b;
  for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
}

const vocab = Array.from({ length: 4 }, (_, i) => ({ target: 't' + i, source: 's' + i, pron: 'p' + i }));

function buildWith(sentences) {
  const lesson = { type: 'standard', vocab, sentences, difficulty: 2 };
  const APP = { lessonData: { topic: 'T', lang: 'de', srcLang: 'en', difficulty: 2, lessons: [lesson] },
    lang: 'de', muted: false, _teacherMode: false };
  const shuffle = (a) => a.slice();                 // identity → deterministic
  const pick = (a, n) => a.slice(0, n);
  const ttsVoiceAvailableFor = () => true;
  const _lessonIsDialect = () => false;
  const jaTokenize = (s) => String(s).split(/\s+/);
  const stripFuri = (s) => s;
  const fn = new Function('APP', 'shuffle', 'pick', 'ttsVoiceAvailableFor', '_lessonIsDialect',
    'jaTokenize', 'stripFuri',
    ext('buildStandardExercises') + '\nreturn buildStandardExercises;')(
    APP, shuffle, pick, ttsVoiceAvailableFor, _lessonIsDialect, jaTokenize, stripFuri);
  return fn(lesson, 0);
}

const words = (n, prefix) => Array.from({ length: n }, (_, i) => prefix + i);

// ── 1. A short sentence (≤5 words) is offered for ordering ───────────────────
{
  const s = { target: words(5, 'w').join(' '), source: 'five words', words: words(5, 'w') };
  const exs = buildWith([s]);
  const orders = exs.filter(e => e.type === 'order');
  assert.strictEqual(orders.length, 1, 'a 5-word sentence produces one order exercise');
  assert.strictEqual(orders[0].correct, words(5, 'w').join(' '), 'and it is built from that sentence');
}
console.log('  a 5-word sentence is offered for ordering: OK');

// ── 2. A longer sentence (>5 words) is EXCLUDED — the boundary case ──────────
{
  const s = { target: words(6, 'w').join(' '), source: 'six words', words: words(6, 'w') };
  const exs = buildWith([s]);
  assert.strictEqual(exs.filter(e => e.type === 'order').length, 0,
    'a 6-word sentence produces NO order exercise');
  // The sentence is still usable elsewhere — read_translate is untouched by this filter.
  assert.ok(exs.some(e => e.type === 'read_translate'),
    'the same sentence still reaches read_translate — only ordering is length-gated');
}
console.log('  a 6-word sentence is excluded from ordering, but not from other types: OK');

// ── 3. Mixed lesson: only the short sentence is picked, never a fallback to the long one ────
{
  const short = { target: words(3, 'a').join(' '), source: 'short', words: words(3, 'a') };
  const long  = { target: words(9, 'b').join(' '), source: 'long',  words: words(9, 'b') };
  const exs = buildWith([long, short]);   // long FIRST — pick(a,n) takes from the front, so a naive
                                           // unfiltered pick would choose the long one, not the short
  const orders = exs.filter(e => e.type === 'order');
  assert.strictEqual(orders.length, 1, 'exactly the one qualifying sentence produces an order exercise');
  assert.strictEqual(orders[0].correct, words(3, 'a').join(' '), 'and it is the SHORT sentence, not the long one first in the array');
}
console.log('  a mixed-length lesson orders only the short sentence, never the long one: OK');

// ── 4. All sentences too long: no order exercise at all, not a fallback ──────
{
  const s1 = { target: words(7, 'x').join(' '), source: 'l1', words: words(7, 'x') };
  const s2 = { target: words(8, 'y').join(' '), source: 'l2', words: words(8, 'y') };
  const exs = buildWith([s1, s2]);
  assert.strictEqual(exs.filter(e => e.type === 'order').length, 0,
    'no order exercise is built when every sentence is too long — never falls back to a long one');
}
console.log('  a lesson with only long sentences offers no ordering exercise at all: OK');

console.log('unit-order-sentence-length: ALL PASSED');
