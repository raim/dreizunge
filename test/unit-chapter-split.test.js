// unit-chapter-split.test.js
// v71_b: the model decides chapter boundaries; it never touches the text.
//
// User request: "offer an option via LLM, where the LLM decides chapters, similar to the current
// PDF cleaning option. Cleaning could be an optional prompt added to the main prompt."
//
// The contract is deliberately stronger than textCleanup's. There the model returns TEXT and the
// server must PROVE afterwards that it only deleted (cleanTextChanges). Here the model returns
// paragraph NUMBERS and titles, and the chapters are reassembled from the caller's own paragraphs,
// so altered text is not merely detected — it cannot be expressed. These tests pin that property:
// whatever the model answers, the words that come out are the words that went in.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

function extract(name) {
  const at = server.indexOf('function ' + name + '(');
  assert.ok(at > -1, `server.js defines ${name}()`);
  const b = server.indexOf('{', at); let d = 0, i = b;
  for (; i < server.length; i++) { if (server[i] === '{') d++; else if (server[i] === '}') { d--; if (!d) { i++; break; } } }
  return server.slice(at, i);
}
const M = new Function(extract('assembleChapters') + extract('chapterSplitProblem') +
  '\nreturn { assembleChapters, chapterSplitProblem };')();

const P = n => Array.from({ length: n }, (_, i) => `Absatz ${i + 1} mit etwas Text darin.`);
const words = s => String(s).split(/\s+/).filter(Boolean).length;

// ── 1. Grouping: paragraphs land in the chapter that claims them ─────────────
{
  const paras = P(6);
  const ch = M.assembleChapters(paras, [{ start: 1, title: 'Eins' }, { start: 4, title: 'Zwei' }], []);
  assert.strictEqual(ch.length, 2, 'two cut points make two chapters');
  assert.strictEqual(ch[0].title, 'Eins');
  assert.ok(ch[0].text.includes('Absatz 1') && ch[0].text.includes('Absatz 3'), 'chapter 1 spans 1..3');
  assert.ok(!ch[0].text.includes('Absatz 4'), 'and stops before the next cut');
  assert.ok(ch[1].text.includes('Absatz 4') && ch[1].text.includes('Absatz 6'), 'chapter 2 runs to the end');
  assert.strictEqual(ch[0].wordCount, words(ch[0].text), 'word counts are computed, not trusted');
}

// ── 2. THE property: text out === text in, whatever the model says ───────────
// The model is given no way to write text, so no answer can change a word. Checked against a
// deliberately awkward answer (out-of-order titles, duplicate start, a bogus late cut).
{
  const paras = P(8);
  const all = paras.join(' ');
  const answers = [
    [{ start: 1 }],
    [{ start: 1 }, { start: 2 }, { start: 3 }, { start: 8 }],
    [{ start: 1, title: 'x' }, { start: 1, title: 'dup' }, { start: 5 }],
  ];
  answers.forEach((a, i) => {
    const ch = M.assembleChapters(paras, a, []);
    const out = ch.map(c => c.text).join('\n\n').split(/\s+/).filter(Boolean).join(' ');
    assert.strictEqual(out, all.split(/\s+/).filter(Boolean).join(' '),
      `answer ${i}: every word is preserved, in order, regardless of how the model grouped`);
  });
}

// ── 3. The drop list is the "cleaning folded in" option ──────────────────────
{
  const paras = P(5);
  const ch = M.assembleChapters(paras, [{ start: 1, title: 'A' }], [5]);
  assert.ok(!ch[0].text.includes('Absatz 5'), 'a discarded paragraph is left out');
  assert.ok(ch[0].text.includes('Absatz 4'), 'and the rest is kept');
  // A chapter whose every paragraph was discarded disappears rather than becoming empty.
  const ch2 = M.assembleChapters(paras, [{ start: 1, title: 'A' }, { start: 4, title: 'B' }], [4, 5]);
  assert.strictEqual(ch2.length, 1, 'a fully-discarded chapter is dropped, not emitted empty');
}

// ── 4. Validation rejects what would produce nonsense ────────────────────────
{
  const bad = (obj, allowDrop, why) => assert.ok(M.chapterSplitProblem(obj, 6, allowDrop), why);
  const ok = (obj, allowDrop) => assert.strictEqual(M.chapterSplitProblem(obj, 6, allowDrop), '',
    'a well-formed answer is accepted');
  ok({ chapters: [{ start: 1, title: 'a' }, { start: 4, title: 'b' }] }, false);
  bad(null, false, 'null is rejected');
  bad({ chapters: [] }, false, 'an empty chapter list is rejected');
  bad({ chapters: [{ start: 'x' }] }, false, 'a non-numeric start is rejected');
  bad({ chapters: [{ start: 0 }] }, false, 'a start below 1 is rejected');
  bad({ chapters: [{ start: 7 }] }, false, 'a start past the last paragraph is rejected');
  bad({ chapters: [{ start: 1 }, { start: 1 }] }, false, 'non-increasing starts are rejected');
  bad({ chapters: [{ start: 1 }, { start: 3 }, { start: 2 }] }, false, 'out-of-order starts are rejected');
  bad({ chapters: [{ start: 2 }] }, false, 'without dropping, chapter 1 must start at paragraph 1');
  bad({ chapters: [{ start: 1 }], drop: [2] }, false, 'dropping is refused when it was not offered');
  bad({ chapters: [{ start: 1 }], drop: [99] }, true, 'a discard outside the range is rejected');
  // With dropping allowed, a leading furniture paragraph legitimately shifts the first chapter.
  ok({ chapters: [{ start: 2, title: 'a' }], drop: [1] }, true);
}

// ── 5. The prompt exists and keeps the model away from the text ─────────────
{
  const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));
  const cs = prompts.chapterSplit;
  assert.ok(cs && cs.system, 'prompts.json carries the chapterSplit prompt');
  assert.ok(cs.dropClause && cs.keepClause, 'and both variants of the cleaning clause');
  assert.ok(/NEVER quote, rewrite or return the paragraph text/i.test(cs.system),
    'the prompt forbids returning text — the server contract depends on numbers only');
  assert.ok(/\{DROP\}/.test(cs.system), 'the cleaning clause is substituted into the prompt');
  assert.ok(/discarding/i.test(cs.dropClause) && !/discard/i.test(cs.keepClause.replace(/Do not discard/i, '')),
    'the keep variant tells the model not to discard');
  // The route is wired and validates before spending tokens.
  assert.ok(/url\.pathname === '\/api\/split-chapters'/.test(server), 'the endpoint exists');
  assert.ok(/Need at least two paragraphs/.test(server), 'it refuses a document it cannot group');
  assert.ok(/paras\.length > 400/.test(server), 'and refuses one too large to put in a prompt');
}

console.log('  chapter split: grouping, losslessness, drop list, validation, prompt contract: OK');
console.log('unit-chapter-split: ALL PASSED');
