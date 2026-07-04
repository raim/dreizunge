// unit-my-story.test.js
// v50: "my story" (hybrid, option i) — generate from the learner's learned vocabulary; the story
// reuses those words and the lessons reinforce them via the existing chainVocab/reinforce path.
// Headless scope: the PLUMBING only — client payload shaping (wrong-first, capped, right shape)
// and the server-side fromLearned sanitization + that both seams (story prompt, reinforce vocab)
// get populated. Prompt/story QUALITY needs live-model tuning and is out of scope here.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

function ext(src, name){
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('not found: ' + name);
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++){ if (src[i] === '{') d++; else if (src[i] === '}'){ d--; if (!d){ i++; break; } } }
  return src.slice(at, i);
}

// ── Client: myStoryPayload shapes the ledger slice (wrong-first, capped) ──────
const APP = { lang: 'de', srcLang: 'en', progress: {} };
const M = new Function('APP', 'stripFuri',
  [ext(html, '_learnedLedger'), ext(html, 'myStoryPayload')].join('\n') + '\nreturn { _learnedLedger, myStoryPayload };'
)(APP, s => String(s == null ? '' : s));

// Seed a ledger with varied seen/wrong counts.
const led = M._learnedLedger('de', 'en');
led.vocab['Katze'] = { source: 'cat', seen: 3, wrong: 0 };
led.vocab['Hund']  = { source: 'dog', seen: 5, wrong: 2 };   // most wrong
led.vocab['Vogel'] = { source: 'bird', seen: 1, wrong: 1 };
led.vocab['Fisch'] = { source: 'fish', seen: 9, wrong: 0 };  // most seen, no wrong

const payload = M.myStoryPayload('de', 'en');
assert.ok(payload && Array.isArray(payload.vocab), 'payload has a vocab array');
assert.strictEqual(payload.vocab.length, 4, 'all learned words included (under cap)');
// wrong-first ordering: Hund (wrong 2) before Vogel (wrong 1) before the wrong:0 words.
assert.strictEqual(payload.vocab[0].target, 'Hund', 'most-wrong word first');
assert.strictEqual(payload.vocab[1].target, 'Vogel', 'next-most-wrong second');
// among wrong:0, most-seen first → Fisch (9) before Katze (3)
assert.strictEqual(payload.vocab[2].target, 'Fisch', 'then most-seen of the rest');
// shape: only target/source/wrong exposed (no seen)
assert.deepStrictEqual(Object.keys(payload.vocab[0]).sort(), ['source', 'target', 'wrong'], 'payload item shape');
// cap is honoured
const many = M._learnedLedger('fr', 'en');
for (let i = 0; i < 100; i++) many.vocab['w' + i] = { source: 's' + i, seen: 1, wrong: 0 };
const capped = M.myStoryPayload('fr', 'en', 60);
assert.strictEqual(capped.vocab.length, 60, 'payload respects the cap');
// empty ledger → null
APP.lang = 'es';
assert.strictEqual(M.myStoryPayload('es', 'en'), null, 'no learned words → null payload');
console.log('  client myStoryPayload: wrong-first, capped, correct shape, null when empty: OK');

// ── Client wiring: doGenerate sends fromLearned and not __my__ as continuedFrom ──
assert.ok(/const myStory = \(contVal==='__my__'\)/.test(html), 'doGenerate detects the __my__ sentinel');
assert.ok(/myStoryPayload\(APP\.lang, APP\.srcLang\)/.test(html), 'doGenerate builds the payload from the ledger');
assert.ok(/continuedFrom: myStory \? null :/.test(html), 'my-story does NOT send __my__ as continuedFrom');
assert.ok(/if\(myStory && myStoryData\) body\.fromLearned=myStoryData/.test(html), 'my-story sets body.fromLearned');
assert.ok(/nCh>1 && !useStory && !myStory/.test(html), 'my-story routes through single-generate, not the book path');
// (b) my-story now SENDS the vocab-mode selector value (reinforce/extend/neutral), like continue.
assert.ok(/vocabMode: \(myStory \|\| _contSelVal\) \? \(document\.getElementById\('vocab-mode-select'\)/.test(html),
  'my-story sends the vocab-mode selector value (not suppressed)');
console.log('  client doGenerate wiring: sends fromLearned + vocabMode, single-generate path: OK');

// ── Server: /api/generate sanitizes fromLearned (caps, string coercion) ──────
assert.ok(/fromLearned: \(fromLearned && Array\.isArray\(fromLearned\.vocab\)/.test(server),
  'handler guards fromLearned shape');
const sanitize = new Function('fromLearned', `
  return (fromLearned && Array.isArray(fromLearned.vocab) && fromLearned.vocab.length)
    ? { vocab: fromLearned.vocab.slice(0, 60)
        .map(w => ({ target: String(w && w.target || '').slice(0, 80),
                     source: String(w && w.source || '').slice(0, 120),
                     wrong: Math.max(0, Math.min(999, parseInt(w && w.wrong, 10) || 0)) }))
        .filter(w => w.target) }
    : null;`);
const dirty = { vocab: [
  { target: 'x'.repeat(200), source: 'y'.repeat(200), wrong: 999999 },
  { target: '', source: 'skipme', wrong: 1 },              // empty target → filtered
  { target: 'ok', wrong: -5 },                              // negative wrong → 0
  ...Array.from({ length: 100 }, (_, i) => ({ target: 't' + i, source: 's' + i, wrong: 0 })),
] };
const clean = sanitize(dirty);
assert.ok(clean.vocab.length <= 60, 'server caps to 60 items');
assert.strictEqual(clean.vocab[0].target.length, 80, 'target truncated to 80 chars');
assert.strictEqual(clean.vocab[0].source.length, 120, 'source truncated to 120 chars');
assert.strictEqual(clean.vocab[0].wrong, 999, 'wrong clamped to 999');
assert.ok(clean.vocab.every(w => w.target), 'empty-target items filtered out');
assert.ok(clean.vocab.some(w => w.wrong === 0), 'negative wrong coerced to 0');
assert.strictEqual(sanitize(null), null, 'null fromLearned → null');
assert.strictEqual(sanitize({ vocab: [] }), null, 'empty vocab → null');
console.log('  server fromLearned sanitize: caps, truncates, clamps, filters: OK');

// ── Server: both seams reference fromLearned; my-story RESPECTS the vocab mode (b) ──
assert.ok(/reuses as many of these words the learner already knows/.test(server),
  'story seam (reinforce/neutral) seeds the prompt from learned words');
assert.ok(/Give extra attention to words the learner found difficult/.test(server),
  'story seam biases toward wrong-answered words');
assert.ok(/introduce some NEW vocabulary so they learn a little more/.test(server),
  'story seam has an EXTEND variant that introduces new vocabulary');
assert.ok(/const _myMode = \(vocabMode === 'extend' \|\| vocabMode === 'neutral'\) \? vocabMode : 'reinforce'/.test(server),
  'story seam resolves the my-story vocab mode (default reinforce)');
// Lesson seam: honour an explicit vocabMode, defaulting to reinforce; neutral → no chain hint.
assert.ok(/_hasLearnedVocab\s*\n?\s*\? \(vocabMode \|\| 'reinforce'\)/.test(server),
  'lesson seam honours an explicit vocabMode for my-story (default reinforce)');
assert.ok(/_hasLearnedVocab && _vocabMode !== 'neutral'\)/.test(server),
  'lesson seam: neutral mode sends no chain-vocab hint');
assert.ok(/sort\(\(a, b\) => \(b\.wrong \|\| 0\) - \(a\.wrong \|\| 0\)\)/.test(server),
  'lesson seam orders reinforce vocab most-wrong-first');
assert.ok(/parentId, fromLearned } = userOpts/.test(server), 'generate() destructures fromLearned');
console.log('  server seams: story-seed + mode-respecting (reinforce/extend/neutral) wiring: OK');

// ── Server: topic-less my-story synthesizes a topic (no throw) ───────────────
assert.ok(/_hasLearned\s*\?[\s\S]*?My review/.test(server), 'topic-less my-story synthesizes a review topic');
assert.ok(/const topicKey = resolvedTopic\.toLowerCase\(\)/.test(server),
  'topicKey uses resolvedTopic (not topic.trim) so topic-less my-story does not throw');
assert.ok(/generate\(resolvedTopic,/.test(server), 'generate() is called with resolvedTopic');
console.log('  server topic-less my-story: synthesized topic, no unconditional topic.trim(): OK');

console.log('unit-my-story: ALL PASSED');
