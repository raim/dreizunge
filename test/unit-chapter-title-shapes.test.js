// unit-chapter-title-shapes.test.js — v89_t.
//
// From a user's server log:
//     Attempt 1/3: 0/1 titles came back named
//     Attempt 2/3: 0/1 titles came back named
//     Attempt 3/3: 0/1 titles came back named
//     Chapter-title post-pass failed: no usable titles after 3 attempts
// …and the chapter kept its raw 40-character placeholder ("Flexvervoer Welkom op de hub Domburg, St").
//
// ⚠️ The log DISTINGUISHES the two ways this can fail, which is what identified the cause without
// guessing: a reply that cannot be parsed at all logs "Attempt N failed: <reason>", while one that
// parses into the WRONG SHAPE logs "0/N titles came back named". The user's log shows the second —
// so the model's answer was well-formed JSON that the normaliser then read nothing out of.
//
// The shape: an array of bare STRINGS, `["Hub Domburg"]`. It parses at the first rung, and the
// normaliser then reads `.title` off a String and gets `undefined` for every chapter.
//
// Same class as `v77_x`'s pair-array finding, whose comment already states the lesson this file
// exists to keep: **a parse that succeeds into the wrong shape is worse than one that fails**,
// because the retry loop sees a well-formed answer and nothing reports it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const llm = require(path.join(ROOT, 'llm.js'));

// The real function, with only its ONE model call stubbed — the parsing rungs are the subject and
// are exercised exactly as they ship.
const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const at = src.indexOf('async function _generateChapterMetaOnce(');
assert.ok(at > -1, 'server.js defines _generateChapterMetaOnce');
let d = 0, i = src.indexOf('{', at);
for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
let REPLY = '';
const parse = new Function('_callLLM', 'OLLAMA_MODEL', 'stripRaw', 'extractArray', 'salvageArray',
  src.slice(at, i) + '\nreturn _generateChapterMetaOnce;')(
  async () => ({ text: REPLY }), 'fake', llm.stripRaw, llm.extractArray, llm.salvageArray);
const run = async (reply, n) => { REPLY = reply; return parse('sys', 'user', n); };
const named = (out) => out.filter(o => o.title).length;

async function main() {

// ── 1. ⚠️ THE REPORTED FAILURE: an array of bare strings ───────────────────────────────────────
{
  const out = await run('["Hub Domburg"]', 1);
  assert.strictEqual(named(out), 1,
    'an array of bare STRINGS now yields a named title — this is the reply that produced "0/1" three times');
  assert.strictEqual(out[0].title, 'Hub Domburg', 'and it is the title the model actually wrote');
  assert.strictEqual(out[0].emoji, '📖', 'with the default emoji, since a bare string carries none');

  // Not a one-chapter special case: the same shape must work for a whole storyline.
  const many = await run('["Eins","Zwei","Drei"]', 3);
  assert.strictEqual(named(many), 3, 'and for a multi-chapter set too');
  assert.deepStrictEqual(many.map(o => o.title), ['Eins', 'Zwei', 'Drei'], 'in order');

  // Mixed shapes in one reply — a real model is not consistent within a single answer.
  const mixed = await run('["Eins",{"title":"Zwei","emoji":"🌳"}]', 2);
  assert.strictEqual(named(mixed), 2, 'a reply mixing strings and objects is fully read');
  assert.strictEqual(mixed[1].emoji, '🌳', 'and an emoji that WAS supplied is kept');
}
console.log('  an array of bare strings is read (the reported failure), alone and mixed: OK');

// ── 2. A bare object, accepted only where it is unambiguous ────────────────────────────────────
// The most natural thing a model returns when asked for exactly ONE title. For n > 1 a single
// object genuinely IS a wrong-shaped answer, and must still fail so the retry can get a better one.
{
  const one = await run('{"title":"Hub Domburg","emoji":"🚌"}', 1);
  assert.strictEqual(named(one), 1, 'a bare object is accepted when exactly one title was asked for');
  assert.strictEqual(one[0].emoji, '🚌', 'keeping its emoji');

  await assert.rejects(() => run('{"title":"Hub Domburg"}', 2), /Expected a JSON array/,
    '⚠️ but NOT when two were asked for — one object cannot answer for two chapters, and swallowing ' +
    'it would deny the retry loop the chance to get a real answer');
}
console.log('  a bare object is accepted for one chapter and still refused for two: OK');

// ── 3. Every shape that already worked still works ─────────────────────────────────────────────
// Non-vacuity, and a regression guard on two earlier findings this parser already carries.
{
  assert.strictEqual(named(await run('[{"title":"A","emoji":"🚌"}]', 1)), 1, 'objects (the documented shape)');
  assert.strictEqual(named(await run('[["A","🚌"]]', 1)), 1, 'v77_x pair arrays');
  assert.strictEqual(named(await run('[["A","🚌"],["B","🌳"]]', 2)), 2, 'and multi-chapter pair arrays');
  assert.strictEqual(named(await run('```json\n[{"title":"A"}]\n```', 1)), 1, 'fenced JSON');
  assert.strictEqual(named(await run('Sure! [{"title":"A","emoji":"🚌"}]', 1)), 1, 'prose before the array');
  assert.strictEqual(named(await run('{"title":"A"}\n{"title":"B"}', 2)), 2, 'loose objects, one per line');
}
console.log('  objects, pair arrays, fenced and prose-wrapped replies all still parse: OK');

// ── 4. ⚠️ Genuinely unusable replies must STILL fail, or the retry loop is dead ────────────────
// The whole point of the three-attempt loop is that a bad answer gets another try. A parser that
// never fails would turn every bad answer into a silent empty title — which is the very defect
// §1 exists for, reintroduced from the other direction.
{
  for (const [reply, what] of [
    ['I could not think of any titles.', 'prose with no JSON at all'],
    ['[]', 'an empty array'],
    ['[""]', 'an array of empty strings'],
    ['[{"emoji":"🚌"}]', 'objects with an emoji but no title'],
  ]) {
    let out = null, threw = false;
    try { out = await run(reply, 1); } catch (_) { threw = true; }
    assert.ok(threw || named(out) === 0,
      `${what} must not produce a title out of nothing (got ${JSON.stringify(out)})`);
  }
}
console.log('  replies with no usable title still yield none, so the retry loop keeps its job: OK');

console.log('unit-chapter-title-shapes: ALL PASSED');
}
main().catch(e => { console.error(e); process.exit(1); });
