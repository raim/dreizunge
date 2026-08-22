// unit-unspaced-scripts-parity.test.js
// v82_c — the client's `_UNSPACED_SCRIPTS` (index.html, driving `_highlightVocabHtml`'s matching
// since v73_d/v78_k) and the server's `UNSPACED_SCRIPTS_RE` (server.js, driving the "whole word"
// checks in validateWordFormsItems and validateInflectionsItems) must stay the SAME set of scripts —
// this is the "one rule per question" pattern unit-sentence-segmentation.test.js already established
// for `_sentenceSplit`, applied to the newer duplicate.
//
// Why this matters concretely: without the carve-out, a genuinely correct Japanese surfaceForm
// sitting between two other kana/kanji characters — i.e. anywhere except right next to punctuation —
// fails the SPACED-script boundary check ("flanked by a non-letter") no matter how right the model
// was, because Japanese has no whitespace to flank it with. §3/§4 reproduce that exact failure mode
// and confirm the fix.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

function extractConst(src, name) {
  const re = new RegExp('const ' + name + '\\s*=\\s*(/.*/[a-z]*);');
  const m = re.exec(src);
  assert.ok(m, 'missing const ' + name);
  return m[1];
}

// ── 1. Parity: same pattern text, different names (server's is more explicitly named) ───────────
{
  const clientPattern = extractConst(html, '_UNSPACED_SCRIPTS');
  const serverPattern = extractConst(server, 'UNSPACED_SCRIPTS_RE');
  assert.strictEqual(clientPattern, serverPattern,
    '_UNSPACED_SCRIPTS (client) and UNSPACED_SCRIPTS_RE (server) must be the byte-identical regex ' +
    'literal — if this fails, one copy was edited alone and the highlighter and the validators now ' +
    'disagree about which scripts have no whitespace between words');
  console.log('  client _UNSPACED_SCRIPTS / server UNSPACED_SCRIPTS_RE: byte-identical pattern: OK');
}

// ── 2. Behavioural: the set actually covers what it claims to, and nothing else ──────────────────
{
  const re = new Function('return ' + extractConst(server, 'UNSPACED_SCRIPTS_RE'))();
  const shouldMatch = { Han: '漢', Hiragana: 'ひ', Katakana: 'カ', Thai: 'ก', Lao: 'ກ', Khmer: 'ក', Myanmar: 'က' };
  const shouldNot = { Latin: 'a', Cyrillic: 'б', Greek: 'α', Devanagari: 'क', Hebrew: 'א', Arabic: 'ا', Hangul: '가' };
  for (const [script, ch] of Object.entries(shouldMatch)) assert.ok(re.test(ch), `${script} ("${ch}") is unspaced`);
  for (const [script, ch] of Object.entries(shouldNot)) assert.ok(!re.test(ch), `${script} ("${ch}") is spaced — must NOT match`);
  console.log('  covers exactly Han/Hiragana/Katakana/Thai/Lao/Khmer/Myanmar, nothing else: OK');
}

// ── 3/4. The actual bug, reproduced and fixed, against the real validators ───────────────────────
function extractFn(name) {
  const at = server.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing fn ' + name);
  const b = server.indexOf('{', at);
  let d = 0, i = b;
  for (; i < server.length; i++) { const c = server[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return server.slice(at, i);
}
const { validateInflectionsItems, validateWordFormsItems } = new Function(
  extractConst(server, 'UNSPACED_SCRIPTS_RE').replace(/^/, 'const UNSPACED_SCRIPTS_RE = ') + ';\n' +
  extractFn('_inflNorm') + '\n' + extractFn('validateInflectionsItems') + '\n' +
  extractFn('_wfNorm') + '\n' + extractFn('validateWordFormsItems') + '\n' +
  'return { validateInflectionsItems, validateWordFormsItems };')();

// A real Japanese sentence: 走った ("ran", past tense of 走る "to run") sits between で and 。 —
// で is itself a letter-script character (a kana particle), not punctuation, so the OLD spaced-script
// boundary check (flanked by a non-letter) could never match here. This is the exact shape of a
// correct mid-sentence Japanese surfaceForm.
const JA_STORY = '彼は公園で走った。とても楽しかった。';
const JA_SENTENCE = '彼は公園で走った。';

{
  const good = {
    sentence: JA_SENTENCE, surfaceForm: '走った', lemma: '走る',
    lemmaChoices: ['走る', '歩く', '食べる'], lemmaCorrectIndex: 0,
    formLabel: 'past tense', formChoices: ['past tense', 'present tense', 'negative'], formCorrectIndex: 0,
    translation: 'He ran in the park. It was very fun.',
  };
  const r = validateInflectionsItems([good], JA_STORY);
  assert.strictEqual(r.valid.length, 1,
    `a genuinely correct Japanese surfaceForm not touching punctuation must pass — rejected: ${JSON.stringify(r.rejected)}`);
  assert.strictEqual(r.valid[0].surfaceForm, '走った');
  console.log('  validateInflectionsItems accepts a correct mid-sentence Japanese surfaceForm: OK');
}

{
  // word_forms: the SALVAGE-2 auto-blank path must also find and blank a mid-run Japanese word.
  const item = {
    sentence: JA_SENTENCE, translation: 'He ran in the park.',
    choices: ['走った', '走る', '走らない'], correctIndex: 0,
  };
  const r = validateWordFormsItems([item], JA_STORY);
  assert.strictEqual(r.valid.length, 1,
    `word_forms must salvage a mid-run Japanese answer into a blank — rejected: ${JSON.stringify(r.rejected)}`);
  assert.ok(/_{3,}/.test(r.valid[0].sentence), 'a blank was inserted');
  assert.ok(!r.valid[0].sentence.includes('走った'), 'the answer itself was blanked out, not left in place');
  assert.ok(r.valid[0].sentence.includes('彼は公園で') && r.valid[0].sentence.includes('。'),
    `the surrounding text survives untouched — got "${r.valid[0].sentence}"`);
  console.log('  validateWordFormsItems auto-blanks a mid-run Japanese answer: OK');
}

// ── 5. Mutation check: WITHOUT the carve-out, this exact case is rejected ─────────────────────────
// Non-vacuity — proves §3/§4 are actually exercising the fix, not passing for an unrelated reason.
// Rebuilds both validators with UNSPACED_SCRIPTS_RE forced to match nothing (i.e. the pre-fix world).
{
  const { validateInflectionsItems: oldInfl, validateWordFormsItems: oldWf } = new Function(
    'const UNSPACED_SCRIPTS_RE = /$^/;\n' +   // matches nothing — simulates "before this fix"
    extractFn('_inflNorm') + '\n' + extractFn('validateInflectionsItems') + '\n' +
    extractFn('_wfNorm') + '\n' + extractFn('validateWordFormsItems') + '\n' +
    'return { validateInflectionsItems, validateWordFormsItems };')();
  const good = {
    sentence: JA_SENTENCE, surfaceForm: '走った', lemma: '走る',
    lemmaChoices: ['走る', '歩く', '食べる'], lemmaCorrectIndex: 0,
    formLabel: 'past tense', formChoices: ['past tense', 'present tense', 'negative'], formCorrectIndex: 0,
    translation: 'He ran in the park. It was very fun.',
  };
  const r = oldInfl([good], JA_STORY);
  assert.strictEqual(r.valid.length, 0, 'without the carve-out, the SAME correct item is wrongly rejected — confirms the fix is load-bearing');
  assert.ok(r.rejected[0].reasons.includes('surfaceForm not found as a whole word in sentence'));
  console.log('  mutation check: without the carve-out this exact case fails, confirming the guard is load-bearing: OK');
}

console.log('unit-unspaced-scripts-parity: ALL PASSED');
