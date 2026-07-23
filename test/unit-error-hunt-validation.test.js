// unit-error-hunt-validation.test.js
// v69_g — the error-hunt generator must VERIFY what the exercise needs, and retry when the model
// misbehaves. Reported failure: "Add-lesson error: Error-hunt: model returned identical story with
// no changes" — a reasoning model echoed the story back and the single-shot generator gave up,
// failing the whole add-lesson.
//
// Two defects, one report:
//   • NO RETRY. Every other generator retries; this one made a single call and threw.
//   • VALIDATION TOO WEAK. It only checked "not empty" and "not byte-identical", so a model that
//     changed ONE word, or rephrased the whole text, produced an unplayable lesson that passed.
//     The client pairs tokens BY POSITION, so the corrupted story must keep the same word count and
//     differ in a sane number of single words — exactly what the prompt already demands.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

function ext(name) {
  const at = server.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing ' + name);
  const b = server.indexOf('{', at); let d = 0, i = b;
  for (; i < server.length; i++) { const c = server[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return server.slice(at, i);
}

// ── 1. errorHuntChanges: what the exercise actually needs ────────────────────
{
  const changes = new Function(ext('errorHuntChanges') + '\nreturn errorHuntChanges;')();
  const story = 'Es war einmal ein Test in einem grossen Haus am Meer.';

  let r = changes(story, story);
  assert.ok(r.aligned && r.changed === 0, 'an identical story reports zero changes');

  // The intended shape: same word count, a few words altered in place.
  r = changes(story, 'Es war eiinmal ein Test in einem grosssen Haus am Meer.');
  assert.ok(r.aligned, 'in-place substitutions stay aligned');
  assert.strictEqual(r.changed, 2, 'and are counted exactly');

  // Rephrasing breaks positional pairing — the exercise would be nonsense.
  r = changes(story, 'Es war einmal ein Test in einem sehr grossen Haus am Meer.');
  assert.ok(!r.aligned, 'an inserted word is detected as rephrasing');
  r = changes(story, 'Es war einmal ein Test.');
  assert.ok(!r.aligned, 'a truncated story is detected');

  // Whitespace-only differences must not count as corruption.
  r = changes(story, story.replace(/ /g, '  '));
  assert.ok(r.aligned && r.changed === 0, 'respacing alone is not a change');
  assert.ok(!changes('', 'anything').aligned, 'an empty original is never aligned');
}
console.log('  errorHuntChanges: alignment + change count, respacing ignored: OK');

// ── 2. The requested error count has ONE source ──────────────────────────────
{
  const counts = new Function(ext('errorHuntCounts') + '\nreturn errorHuntCounts;')();
  assert.deepStrictEqual(counts(1), { nSpell: 3, nGrammar: 2 }, 'difficulty 1');
  assert.deepStrictEqual(counts(2), { nSpell: 3, nGrammar: 3 }, 'difficulty 2');
  assert.deepStrictEqual(counts(3), { nSpell: 4, nGrammar: 3 }, 'difficulty 3');
  // The prompt builder must use the same helper, or validation would police a different number
  // than was requested and reject good output.
  assert.ok(/const \{ nSpell, nGrammar \} = errorHuntCounts\(difficulty\);/.test(ext('sysErrorHunt')),
    'sysErrorHunt derives its numbers from errorHuntCounts');
  assert.ok(/const \{ nSpell, nGrammar \} = errorHuntCounts\(difficulty\);/.test(ext('generateErrorHunt')),
    'the generator validates against the same numbers it asked for');
}
console.log('  requested error counts shared by prompt and validator: OK');

// ── 3. The retry loop and its escalating feedback ────────────────────────────
{
  const gen = ext('generateErrorHunt');
  assert.ok(/for \(let attempt = 1; attempt <= ATTEMPTS; attempt\+\+\)/.test(gen), 'the generator retries');
  assert.ok(/YOUR PREVIOUS ATTEMPT WAS REJECTED/.test(gen), 'each retry tells the model what was wrong');
  // Every rejection reason must be specific — "try again" teaches the model nothing.
  for (const phrase of [
    'completely unchanged',            // echo — the reported failure
    'rephrased',                       // word count changed
    'too few',                         // under-corrupted
    'far more than',                   // over-corrupted / rewritten
    'much shorter than the story',     // truncated
  ]) assert.ok(gen.includes(phrase), `rejection feedback covers: ${phrase}`);

  // A band, not an exact count: models rarely hit the number exactly and a slightly light lesson is
  // still a good exercise, but a rewrite is not.
  assert.ok(/const minChanges = Math\.max\(2, Math\.ceil\(wanted \/ 2\)\);/.test(gen), 'a lower bound is enforced');
  assert.ok(/const maxChanges = wanted \* 2 \+ 2;/.test(gen), 'an upper bound catches rewrites');

  // Transport failures are not something a retry PROMPT can fix — they rethrow on the last attempt.
  assert.ok(/if \(attempt === ATTEMPTS\) throw e;/.test(gen), 'a transport error is not swallowed');
  // Tokens are accumulated across attempts: retries cost real money and must be metered.
  assert.ok(/promptTokens \+= r\.promptTokens \|\| 0; completionTokens \+= r\.completionTokens \|\| 0;/.test(gen),
    'token usage accumulates across attempts');
  // The final error must tell the user what to do, not just what failed.
  assert.ok(/Try a different model, or generate this lesson at a lower difficulty/.test(gen),
    'the final error is actionable');
}
console.log('  retry loop: escalating specific feedback, bounds, metering, actionable failure: OK');

// ── 4. The fake backend models this generator ────────────────────────────────
// It previously had no branch, so the request fell through to the vocab default and returned JSON —
// which the old weak validation stored as the "corrupted story". The e2e passed on a broken lesson.
{
  const fake = fs.readFileSync(path.join(ROOT, 'test', 'fake-ollama.js'), 'utf8');
  assert.ok(/corrupted version by introducing exactly/.test(fake), 'the fake recognises the error-hunt prompt');
  assert.ok(/kind = 'error_hunt'/.test(fake), 'and answers as that kind');
  // Simulate its transformation and check the result would pass the server's validation.
  const story = 'Es war einmal ein Test in einem grossen Haus am Meer.';
  const corrupted = story.split(/(\s+)/).map(tok => {
    if (/^\s+$/.test(tok) || tok.length < 4) return tok;
    return tok.slice(0, 2) + tok[1] + tok.slice(2);
  }).join('');
  const changes = new Function(ext('errorHuntChanges') + '\nreturn errorHuntChanges;')();
  const r = changes(story, corrupted);
  assert.ok(r.aligned, 'the fake keeps the word count (positional diff still works)');
  assert.ok(r.changed >= 2, `the fake corrupts enough words (${r.changed})`);
  assert.notStrictEqual(corrupted, story, 'and the result is not identical');
}
console.log('  fake backend produces a genuinely playable corruption: OK');

console.log('unit-error-hunt-validation: ALL PASSED');
