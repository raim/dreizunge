// unit-qc-ambiguous-options.test.js — v89_v.
//
// "The wrong answer is also correct." `v89_u` measured the generation-prompt approach and it did
// nothing (3/3 defective before, 3/3 after), because the source text itself supplied the synonym
// pair. Asking a model to JUDGE a finished lesson is a different question from asking it to avoid
// the problem while writing one — so the check moved into QC, where a human is already reviewing.
//
// ⚠️ User ruling: "implement that an explicit QC run catches it, but don't do on default. it is a
// very rare case." Section 1 is that ruling; everything else is the parser's refusal to invent.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const llm = require(path.join(ROOT, 'llm.js'));

// The real checker, with only its model call stubbed.
const at = server.indexOf('async function qcCheckAmbiguousOptions(');
assert.ok(at > -1, 'server.js defines qcCheckAmbiguousOptions');
let d = 0, i = server.indexOf('{', at);
for (; i < server.length; i++) { if (server[i] === '{') d++; else if (server[i] === '}') { d--; if (!d) { i++; break; } } }
let REPLY = '[]', CALLS = 0;
const check = new Function('callLLMAnswerCheck', 'langName', 'PROMPTS', 'fillPrompt', 'stripRaw', 'extractArray',
  server.slice(at, i) + '\nreturn qcCheckAmbiguousOptions;')(
  async () => { CALLS++; return { text: REPLY }; },
  (c) => ({ nl: 'Dutch', de: 'German' })[c] || c,
  JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8')),
  (t, v) => String(t).replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? v[k] : '{' + k + '}')),
  llm.stripRaw, llm.extractArray);

// The user's own lesson, which is what this whole thread is about.
const ROWS = [
  { target: 'gratis',    source: 'kostenlos' },
  { target: 'kosteloos', source: 'umsonst' },
  { target: 'bord',      source: 'Schild' },
  { target: 'tafel',     source: 'Tisch' },
];
const run = async (reply, rows) => { REPLY = reply; return check(rows || ROWS, 'nl', 'de'); };

async function main() {

// ── 1. ⚠️ OFF unless explicitly asked for ──────────────────────────────────────────────────────
{
  // ⚠️ v91_a: RE-SCOPED, not weakened. This pinned `checkAmbiguous = false } = opts;` — the CLOSING
  // BRACE included — so it broke the moment `v91_a` added another option after it and the
  // destructuring wrapped onto a second line. The claim is about the DEFAULT, not the line break.
  assert.ok(/checkAmbiguous\s*=\s*false\b/.test(server),
    '_runQc defaults checkAmbiguous to FALSE — an ordinary sweep must never pay for this');
  assert.ok(/const \{[^}]*\bcheckAmbiguous\b[^}]*\}\s*=\s*opts;/.test(server),
    'and it is still read off _runQc\'s own opts, not from somewhere else');
  assert.ok(/if \(checkAmbiguous && _lessonQcRan/.test(server),
    'and the pass is gated on it');
  // The client sends it only on the deliberate gesture, and an explicit scope value still wins.
  assert.ok(/const checkAmbiguous = \(scope && scope\.checkAmbiguous !== undefined\) \? !!scope\.checkAmbiguous : force;/.test(client),
    'the client ties it to the shift-click force gesture, with an explicit scope value overriding');
  assert.ok(/checkAmbiguous: !!checkAmbiguous/.test(server), 'and the route threads it through');

  // ⚠️ Its own flag bucket. _check CLEARS whatever flag exists for the model it writes under, so
  // sharing the plain QC key would wipe every translation flag that model had raised.
  assert.ok(/const QC_AMBIGUOUS_BY = /.test(server), 'the pass writes under its own `by` key');
  assert.ok(/'ambiguous', QC_AMBIGUOUS_BY,/.test(server),
    'and passes it to _check as the `by` argument — the parameter that selects the flag bucket');

  // ⚠️ The ROLE is part of the contract, and it was measured. On the user's own lesson the QC-role
  // model returned [] twice — it catches nothing — while the answer-check role's default found the
  // pair twice and stayed silent twice on a clean control. Pinned so a future "use the QC model,
  // it's a QC check" tidy-up has to argue with the measurement.
  assert.ok(/await callLLMAnswerCheck\(fillPrompt\(PROMPTS\.qcAmbiguousOptions\.system/.test(server),
    'the checker uses the ANSWER-CHECK role, which was measured to find this and the QC role was not');
  assert.ok(!/callLLMQC\(fillPrompt\(PROMPTS\.qcAmbiguousOptions/.test(server),
    'and not the QC role');
  assert.ok(!/qcCheckAmbiguousOptions\([^)]*\)[\s\S]{0,200}OLLAMA_QC_MODEL\)/.test(server),
    'it never writes under the plain QC model key, which would clear the translation flags');
}
console.log('  off by default, on only for the deliberate run, and in its own flag bucket: OK');

// ── 2. A real finding is mapped back to the right two items ────────────────────────────────────
{
  CALLS = 0;
  const out = await run('[{"a":1,"b":2,"why":"beide bedeuten dasselbe"}]');
  assert.strictEqual(CALLS, 1, 'ONE model call for the whole lesson, not one per pair');
  assert.deepStrictEqual(out.map(p => [p.a, p.b]), [[0, 1]],
    '1-based in the prompt (a model counts from 1 reliably), 0-based in the result');
  assert.strictEqual(out[0].why, 'beide bedeuten dasselbe', 'the reason travels for the curator to read');
}
console.log('  a reported pair maps to the right items, from one call per lesson: OK');

// ── 3. ⚠️ It refuses to invent. Every bad index is DROPPED, never clamped ──────────────────────
// Clamping would attach a real-sounding finding to an item nobody judged — the same harm as a false
// positive but harder to spot, because the note reads plausibly.
{
  for (const [reply, what] of [
    ['[{"a":1,"b":99}]',      'an index past the end'],
    ['[{"a":0,"b":1}]',       'a 0 (there is no item 0 in 1-based numbering)'],
    ['[{"a":2,"b":2}]',       'a pair with itself'],
    ['[{"a":"x","b":"y"}]',   'non-numeric indices'],
    ['[{"b":2}]',             'a missing index'],
    ['[null,{"a":1,"b":2}]',  'a null entry alongside a good one'],
  ]) {
    const out = await run(reply);
    const bad = out.filter(p => !(Number.isInteger(p.a) && Number.isInteger(p.b) && p.a !== p.b
                                 && p.a >= 0 && p.b >= 0 && p.a < ROWS.length && p.b < ROWS.length));
    assert.strictEqual(bad.length, 0, `${what}: nothing invalid survives (got ${JSON.stringify(out)})`);
  }
  // The last case must still keep its GOOD entry — dropping the whole reply would be over-correction.
  const mixed = await run('[null,{"a":1,"b":2}]');
  assert.deepStrictEqual(mixed.map(p => [p.a, p.b]), [[0, 1]], 'a good pair beside a bad one survives');
}
console.log('  invalid indices are dropped rather than clamped, and a good pair beside them survives: OK');

// ── 4. Silence is the normal answer, and every unusable reply is silence ───────────────────────
// ⚠️ The asymmetry that makes this safe to run at all: a missed pair costs a rare confusing
// question; a false one sends a curator to break a lesson that was correct.
{
  for (const [reply, what] of [
    ['[]', 'the expected answer for most lessons'],
    ['I could not find any.', 'prose'],
    ['', 'an empty reply'],
    ['{"a":1,"b":2}', 'an object instead of an array'],
    ['not json', 'garbage'],
  ]) {
    assert.deepStrictEqual(await run(reply), [], `${what} yields no findings`);
  }
  // And a lesson too small to have a pair never reaches the model at all.
  CALLS = 0;
  assert.deepStrictEqual(await run('[{"a":1,"b":2}]', [ROWS[0]]), [], 'a one-item lesson has no pair to check');
  assert.strictEqual(CALLS, 0, 'and costs no model call');
}
console.log('  [] is the normal answer, unusable replies are silent, and a 1-item lesson costs nothing: OK');

console.log('unit-qc-ambiguous-options: ALL PASSED');
}
main().catch(e => { console.error(e); process.exit(1); });
