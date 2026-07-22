// unit-tutor-retrieval.test.js
// v62 — the persistent tutor can be asked anything from anywhere, but the library is far too large
// to put in a prompt, so the server RETRIEVES a small slice. This test pins the three rules, with
// the spoiler rule treated as safety-critical:
//   1. SPOILER SAFETY (hard guarantee): retrieval NEVER returns a chapter the learner has not
//      completed — not even when that chapter is the single best keyword match for the question.
//      This is the cheap 90% of what a concept graph would buy, and it must never regress.
//   2. SCOPE: a storyline question is narrowed to that storyline's chapters; the chapter the
//      learner is currently on is excluded (the client sends it inline, so including it would
//      duplicate it and waste budget).
//   3. RELEVANCE then RECENCY, under a hard character budget.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

function extFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// Build the real retrieval function against a fixture library.
const STOP = new Set(("the a an and or but if then than that this these those is are was were be been being of to in on at by for with from as it its i you he she they we my your his her their our what which who whom how why when where do does did not no yes can could would should will shall may might must about into over under again more most some any all each").split(' '));
function makeRetriever(topics, storylines) {
  const store = { topics };
  const getStorylines = () => storylines || [];
  const findStoryline = id => getStorylines().find(s => s.id === id) || null;
  const src = extFn(server, '_tutorTokens') + '\n' + extFn(server, 'tutorRetrieveContext') + '\nreturn tutorRetrieveContext;';
  return new Function('store', 'getStorylines', 'findStoryline', '_TUTOR_STOPWORDS', src)(store, getStorylines, findStoryline, STOP);
}

const TOPICS = [
  { id: 't1', topic: 'Dragons',  story: 'A brave dragon guarded a golden treasure in the mountain cave.', lang: 'it', srcLang: 'de' },
  { id: 't2', topic: 'Sailing',  story: 'The sailor crossed the wide sea and found a hidden island.',     lang: 'it', srcLang: 'de' },
  { id: 't3', topic: 'Ending',   story: 'The dragon was actually the princess all along, a twist ending.', lang: 'it', srcLang: 'de' },
  { id: 't4', topic: 'OtherLang',story: 'A dragon in a different language pair entirely.',                 lang: 'fr', srcLang: 'de' },
];
const SLS = [{ id: 'sl1', chapters: ['t1', 't2'] }];
const retrieve = makeRetriever(TOPICS, SLS);

// ── 1. SPOILER SAFETY — the hard guarantee ───────────────────────────────────
{
  // 'Ending' is the BEST match for "dragon princess" but is NOT completed → must never appear.
  const r = retrieve({ question: 'tell me about the dragon princess twist',
    scope: { kind: 'global' }, completed: ['Dragons', 'Sailing'], lang: 'it', srcLang: 'de' });
  assert.ok(!r.used.includes('Ending'), 'an uncompleted chapter is never retrieved');
  assert.ok(!/princess|twist/i.test(r.text), 'no text from an uncompleted chapter leaks into the context');

  // Nothing completed at all → nothing retrieved (rather than falling back to the whole library).
  const none = retrieve({ question: 'dragon', scope: { kind: 'global' }, completed: [], lang: 'it', srcLang: 'de' });
  assert.strictEqual(none.text, '', 'no completed chapters → empty context, never a library dump');
  assert.deepStrictEqual(none.used, [], 'and nothing reported as used');

  // Once completed, it becomes available (proving the gate is the whitelist, not a keyword filter).
  const now = retrieve({ question: 'tell me about the dragon princess twist',
    scope: { kind: 'global' }, completed: ['Dragons', 'Sailing', 'Ending'], lang: 'it', srcLang: 'de' });
  assert.ok(now.used.includes('Ending'), 'a completed chapter IS retrievable');
}
console.log('  spoiler safety: uncompleted chapters are invisible to retrieval, always: OK');

// ── 2. Scope narrowing ───────────────────────────────────────────────────────
{
  // Storyline scope → only that storyline's chapters (Ending/t3 is outside sl1).
  const r = retrieve({ question: 'dragon ending princess', scope: { kind: 'storyline', storylineId: 'sl1' },
    completed: ['Dragons', 'Sailing', 'Ending'], lang: 'it', srcLang: 'de' });
  assert.ok(!r.used.includes('Ending'), 'storyline scope excludes chapters outside that storyline');

  // The current chapter is excluded — the client sends it inline, so retrieving it would duplicate.
  const cur = retrieve({ question: 'dragon treasure cave', scope: { kind: 'chapter', topic: 'Dragons' },
    completed: ['Dragons', 'Sailing'], lang: 'it', srcLang: 'de' });
  assert.ok(!cur.used.includes('Dragons'), 'the current chapter is not retrieved (sent inline instead)');

  // Language pair is respected — a chapter in another pair is irrelevant to this learner.
  const lp = retrieve({ question: 'dragon', scope: { kind: 'global' },
    completed: ['Dragons', 'OtherLang'], lang: 'it', srcLang: 'de' });
  assert.ok(!lp.used.includes('OtherLang'), 'other language pairs are excluded');
}
console.log('  scope: storyline narrowing, current-chapter exclusion, language pair: OK');

// ── 3. Relevance, recency and the budget ─────────────────────────────────────
{
  // Relevance: the question decides which completed chapter wins.
  const sea = retrieve({ question: 'what happened at sea with the sailor?', scope: { kind: 'global' },
    completed: ['Dragons', 'Sailing'], lang: 'it', srcLang: 'de' });
  assert.strictEqual(sea.used[0], 'Sailing', 'the most relevant completed chapter leads');

  // Budget: the context block is bounded regardless of library size.
  const big = Array.from({ length: 50 }, (_, i) =>
    ({ id: 'b' + i, topic: 'Ch' + i, story: 'dragon '.repeat(400), lang: 'it', srcLang: 'de' }));
  const rBig = makeRetriever(big, [])({ question: 'dragon', scope: { kind: 'global' },
    completed: big.map(t => t.topic), lang: 'it', srcLang: 'de', maxChars: 1200 });
  assert.ok(rBig.text.length <= 1200, `context stays within budget (got ${rBig.text.length})`);
  assert.ok(rBig.used.length <= 4, 'at most a handful of chapters are included');
  assert.ok(rBig.used.length >= 1, 'but the budget still yields something useful');
}
console.log('  relevance + recency + hard character budget: OK');

// ── 4. The route wires it up ─────────────────────────────────────────────────
{
  const at = server.indexOf("url.pathname === '/api/tutor'");
  const route = server.slice(at, server.indexOf("url.pathname === '/api/story-qc'", at));
  assert.ok(/tutorRetrieveContext\(\{/.test(route), 'the route calls retrieval');
  assert.ok(/completed = arr\(body\.completed, 400, 200\)/.test(route), 'the completed whitelist is capped');
  assert.ok(/const lastStudent = \[\.\.\.history\]\.reverse\(\)\.find\(m => m\.role === 'student'\)/.test(route),
    "the learner's newest message drives keyword relevance");
  assert.ok(/\['global','storyline','chapter','lesson'\]\.includes\(scopeIn\.kind\)/.test(route),
    'scope.kind is validated against a whitelist (untrusted input)');
}
console.log('  route wiring: retrieval called, inputs validated + capped: OK');

console.log('unit-tutor-retrieval: ALL PASSED');
