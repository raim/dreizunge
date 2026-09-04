// unit-inflection-label-normalise.test.js — v89_d.
//
// The FAILURE modes of `normaliseInflectionLabels`. The happy path and the wiring are covered
// behaviourally in e2e-inflection-label-lang.test.js, against the real server; this file drives the
// function directly with a scripted model so the replies a real one can actually produce — a short
// object, an empty value, two options collapsing onto one phrase, an array instead of an object,
// unparsable text, a cancel — are each exercised. None of them may lose an item or leave a lesson in
// a state validateInflectionsItems would have rejected.
//
// ⚠️ Extraction, not require(): server.js is a server, not a module. Same `new Function` technique
// unit-inflections.test.js already uses on this file's neighbours — but this function is `async`,
// so the slice must start at `async function`, not at `function`. Starting at the latter silently
// strips the keyword and every `await` inside becomes a syntax error at construction time.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
function extractAsync(name) {
  const at = src.indexOf('async function ' + name + '(');
  assert.ok(at >= 0, 'not found: async function ' + name);
  let depth = 0, i = src.indexOf('{', at);
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) { i++; break; } } }
  return src.slice(at, i);
}
const CANCELLED = 'CANCELLED';
// One factory per case, so a scripted reply cannot leak between them.
function build(reply) {
  const calls = [];
  const callLLMTranslation = async (sys, usr) => {
    calls.push({ sys, usr });
    const r = (typeof reply === 'function') ? reply(usr) : reply;
    if (r instanceof Error) throw r;
    return { text: r, promptTokens: 11, completionTokens: 22 };
  };
  const fn = new Function(
    'langName', 'PROMPTS', 'fillPrompt', 'callLLMTranslation', 'OLLAMA_TRANSLATION_MODEL',
    'jobStep', 'extractJSON', 'CANCELLED', 'console',
    extractAsync('normaliseInflectionLabels') + '\nreturn normaliseInflectionLabels;')(
    (c) => ({ nl: 'Dutch', de: 'German', en: 'English' })[c] || c,
    { inflectionLabels: { system: 'SYS {S}' } },
    (t, v) => String(t).replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? v[k] : '{' + k + '}')),
    callLLMTranslation,
    'fake-translate',
    () => {},
    (t) => JSON.parse(String(t)),           // the same "throw on garbage" contract extractJSON has
    CANCELLED,
    { log() {}, warn() {} },
  );
  return { fn, calls };
}
// Two items, the second with a NON-ZERO correct index — index 0 would let a bug that always
// re-derives formLabel from choices[0] pass by accident.
const items = () => ([
  { surfaceForm: 'blieben', lemma: 'bleiben', explanation: 'x', translation: 'y',
    formLabel: 'Verleden tijd', formChoices: ['Verleden tijd', 'Tegenwoordige tijd', 'Infinitief'], formCorrectIndex: 0 },
  { surfaceForm: 'war', lemma: 'sein', explanation: 'x', translation: 'y',
    formLabel: 'Verleden tijd, enkelvoud',
    formChoices: ['Tegenwoordige tijd, enkelvoud', 'Verleden tijd, enkelvoud'], formCorrectIndex: 1 },
]);
const echo = (prefix) => (usr) => {
  const inp = JSON.parse(usr), out = {};
  for (const k of Object.keys(inp)) out[k] = prefix + inp[k];
  return JSON.stringify(out);
};
// Every case must leave this true, whatever the reply was.
function assertIntact(out, where) {
  assert.strictEqual(out.length, 2, where + ': no item was ever dropped or added');
  for (const it of out) {
    assert.ok(Array.isArray(it.formChoices) && it.formChoices.length >= 2, where + ': choices survive');
    assert.ok(it.formChoices.every(c => typeof c === 'string' && c.trim()), where + ': every choice is a non-empty string');
    assert.strictEqual(it.formLabel, it.formChoices[it.formCorrectIndex],
      where + ': formLabel is still formChoices[formCorrectIndex] — the invariant validateInflectionsItems established');
    assert.strictEqual(new Set(it.formChoices.map(c => c.toLowerCase())).size, it.formChoices.length,
      where + ': the choices are still distinct — two identical options make the question unanswerable');
  }
}

async function main() {

// ── 1. The srcLang gate: English, empty, and an empty item list never call the model ───────────
{
  for (const [srcLang, what] of [['en', 'English'], ['', 'empty'], [null, 'null']]) {
    const { fn, calls } = build(echo('DE '));
    const inp = items();
    const r = await fn(inp, srcLang, null);
    assert.strictEqual(calls.length, 0, `${what} srcLang makes no model call at all`);
    assert.strictEqual(r.items, inp, `${what} srcLang returns the SAME array, untouched`);
    assert.strictEqual(r.ran, false, `${what} srcLang reports ran:false`);
    assert.strictEqual(r.tokens.promptTokens, 0, `${what} srcLang costs no tokens`);
  }
  const { fn: f2, calls: c2 } = build(echo('DE '));
  assert.strictEqual((await f2([], 'de', null)).ran, false, 'an empty item list makes no call');
  assert.strictEqual(c2.length, 0, 'and really no call');
  // An item with no choices at all cannot be normalised and must not produce an empty request.
  const { fn: f3, calls: c3 } = build(echo('DE '));
  const noChoices = [{ surfaceForm: 'x', formChoices: [], formCorrectIndex: -1, formLabel: '' }];
  assert.strictEqual((await f3(noChoices, 'de', null)).ran, false, 'items with no choices make no call');
  assert.strictEqual(c3.length, 0, 'and really no call');
}
console.log('  the srcLang gate and the empty cases never reach the model: OK');

// ── 2. Happy path: positional substitution, formLabel re-derived at its own index ──────────────
{
  const { fn, calls } = build(echo('DE '));
  const r = await fn(items(), 'de', null);
  assert.strictEqual(calls.length, 1, 'ONE call for the whole lesson, not one per item or per label');
  assert.strictEqual(Object.keys(JSON.parse(calls[0].usr)).length, 5, 'all five labels in that one request');
  assert.ok(/German/.test(calls[0].sys), 'the system prompt was filled with the SOURCE language name');
  assert.strictEqual(r.normalised, 2, 'both items normalised');
  assert.deepStrictEqual(r.items[0].formChoices, ['DE Verleden tijd', 'DE Tegenwoordige tijd', 'DE Infinitief'],
    'each key landed on the choice it was sent for');
  assert.strictEqual(r.items[1].formLabel, 'DE Verleden tijd, enkelvoud',
    'formLabel comes from the NON-ZERO correct index, not from the first choice');
  assert.deepStrictEqual(r.tokens, { promptTokens: 11, completionTokens: 22 }, 'the call is accounted for');
  assertIntact(r.items, 'happy path');
}
console.log('  a complete reply is applied positionally and formLabel is re-derived at its own index: OK');

// ── 3. A partial reply degrades PER ITEM, never per lesson ─────────────────────────────────────
// A lesson with one repaired item and one untouched is strictly better than two untouched ones, and
// an item's options are only ever compared with each other — so the unit of fallback is the item.
{
  // Keys 0,1,2 belong to item 0; keys 3,4 to item 1. Drop one of item 1's.
  const { fn } = build((usr) => {
    const inp = JSON.parse(usr), out = {};
    for (const k of Object.keys(inp)) if (k !== '4') out[k] = 'DE ' + inp[k];
    return JSON.stringify(out);
  });
  const r = await fn(items(), 'de', null);
  assert.strictEqual(r.normalised, 1, 'exactly one item was normalised');
  assert.ok(r.items[0].formChoices.every(c => c.startsWith('DE ')), 'the complete item WAS normalised');
  assert.deepStrictEqual(r.items[1].formChoices, items()[1].formChoices,
    'the item with a missing key kept its ORIGINALS — not a half-translated mixture');
  assertIntact(r.items, 'missing key');

  // An empty / whitespace-only value is the same failure wearing different clothes.
  for (const bad of ['', '   ', 42, null]) {
    const { fn: f } = build((usr) => {
      const inp = JSON.parse(usr), out = {};
      for (const k of Object.keys(inp)) out[k] = (k === '3') ? bad : 'DE ' + inp[k];
      return JSON.stringify(out);
    });
    const rr = await f(items(), 'de', null);
    assert.strictEqual(rr.normalised, 1, `a ${JSON.stringify(bad)} value falls back for its own item only`);
    assert.deepStrictEqual(rr.items[1].formChoices, items()[1].formChoices, `and keeps that item's originals`);
    assertIntact(rr.items, 'bad value ' + JSON.stringify(bad));
  }
}
console.log('  a missing or empty value falls back for its OWN item, leaving the others normalised: OK');

// ── 4. ⚠️ Two options collapsing onto one phrase is the failure that would break the exercise ───
// formChoices IS the multiple-choice list. Two options that translate to the same {S} phrase make
// the question unanswerable — worse than leaving it in the wrong language.
{
  const { fn } = build((usr) => {
    const inp = JSON.parse(usr), out = {};
    // Item 1's two options both become "Vergangenheit".
    for (const k of Object.keys(inp)) out[k] = (k === '3' || k === '4') ? 'Vergangenheit' : 'DE ' + inp[k];
    return JSON.stringify(out);
  });
  const r = await fn(items(), 'de', null);
  assert.strictEqual(r.normalised, 1, 'the collapsing item was NOT normalised');
  assert.deepStrictEqual(r.items[1].formChoices, items()[1].formChoices, 'it kept its originals');
  assertIntact(r.items, 'collapsed duplicates');

  // Non-vacuity: the same phrase reused ACROSS items is fine — options are only ever compared with
  // their own siblings, and a real lesson repeats labels between items constantly.
  const { fn: f2 } = build((usr) => {
    const inp = JSON.parse(usr), out = {};
    for (const k of Object.keys(inp)) out[k] = (k === '0' || k === '3') ? 'Vergangenheit' : 'DE ' + inp[k];
    return JSON.stringify(out);
  });
  const r2 = await f2(items(), 'de', null);
  assert.strictEqual(r2.normalised, 2, 'a phrase shared BETWEEN items blocks nothing');
  assert.strictEqual(r2.items[0].formLabel, 'Vergangenheit', 'and formLabel follows it');
  assertIntact(r2.items, 'cross-item duplicate');
}
console.log('  two options collapsing onto one phrase falls back; the same phrase across items does not: OK');

// ── 5. A reply of the wrong SHAPE, or none at all, keeps everything — and still bills the call ──
{
  for (const [reply, what] of [
    ['[1,2,3]', 'an array'],
    ['"just a string"', 'a bare string'],
    ['null', 'null'],
    ['not json at all', 'unparsable text'],
  ]) {
    const { fn, calls } = build(reply);
    const inp = items();
    const r = await fn(inp, 'de', null);
    assert.strictEqual(calls.length, 1, `${what}: the call was made`);
    assert.strictEqual(r.normalised, 0, `${what}: nothing was normalised`);
    assert.deepStrictEqual(r.items, inp, `${what}: every item kept its originals`);
    assert.deepStrictEqual(r.tokens, { promptTokens: 11, completionTokens: 22 },
      `${what}: the tokens are STILL reported — a failed pass that bills nothing hides its own cost from _genMeta`);
    assertIntact(r.items, what);
  }
  // ⚠️ An ARRAY needs its own case, and this one was WRITTEN because the first mutation run said so.
  // `'[1,2,3]'` above did NOT distinguish the `Array.isArray` guard: with the guard removed, indexing
  // an array by "0","1","2" yields NUMBERS, every value fails the string check, and every item falls
  // back anyway — the same visible outcome, so the mutation stayed green. An array of the RIGHT
  // STRINGS is the reply that tells the two apart: without the guard it would be applied as though
  // the "same keys" contract had been met, which is precisely the contract this pass depends on.
  {
    const { fn } = build((usr) => JSON.stringify(Object.values(JSON.parse(usr)).map(v => 'DE ' + v)));
    const inp = items();
    const r = await fn(inp, 'de', null);
    assert.strictEqual(r.normalised, 0,
      'an ARRAY of plausible strings is still not the agreed shape — a reply keyed by position by ' +
      'accident must not be treated as a reply keyed by the keys we sent');
    assert.deepStrictEqual(r.items, inp, 'and every item keeps its originals');
    assertIntact(r.items, 'array of strings');
  }

  // A thrown transport error is the same: keep everything, report the zero-token attempt.
  const { fn } = build(new Error('connection reset'));
  const inp = items();
  const r = await fn(inp, 'de', null);
  assert.deepStrictEqual(r.items, inp, 'a thrown error keeps every item');
  assert.strictEqual(r.ran, false, 'and reports ran:false');
}
console.log('  a wrong-shaped, unparsable or failed reply keeps every item and still reports its cost: OK');

// ── 6. A cancel is re-thrown, not swallowed as "the pass failed" ───────────────────────────────
// item AU (v88_z): a cancelled job must stop, not quietly finish generating the lesson.
{
  const { fn } = build(new Error(CANCELLED));
  await assert.rejects(() => fn(items(), 'de', null), (e) => String(e.message) === CANCELLED,
    'CANCELLED propagates out of the pass instead of being caught as an ordinary failure');
}
console.log('  a cancel is re-thrown, not swallowed: OK');

console.log('unit-inflection-label-normalise: ALL PASSED');
}
main().catch(e => { console.error(e); process.exit(1); });
