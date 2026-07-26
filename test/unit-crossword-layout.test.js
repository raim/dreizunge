// unit-crossword-layout.test.js
// v70_c: the crossword layout engine — pure, deterministic, client-side, no model call.
//
// This is the hard part of the word-game family, so it is tested as a library before it is wired
// to anything: a grid that is subtly wrong (words touching sideways, a puzzle that re-rolls under
// the learner) is far cheaper to catch here than through a render.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extract(name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at > -1, `index.html defines ${name}()`);
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}
const sandbox = extract('_crosswordRng') + '\n' + extract('_crosswordUsable') + '\n' + extract('_crosswordLayout');
const { _crosswordLayout, _crosswordUsable, _crosswordRng } =
  new Function(sandbox + '\nreturn { _crosswordLayout, _crosswordUsable, _crosswordRng };')();

const P = (...ws) => ws.map(w => ({ answer: w, clue: 'clue for ' + w }));

// ── 1. Which words can be in a crossword at all ──────────────────────────────
assert.ok(_crosswordUsable('Haus'), 'plain Latin word');
assert.ok(_crosswordUsable('Grüße'), 'diacritics survive');
assert.ok(_crosswordUsable('привет'), 'Cyrillic');
assert.ok(_crosswordUsable('ελληνικά'), 'Greek');
assert.ok(!_crosswordUsable('ab'), 'too short to cross anything');
assert.ok(!_crosswordUsable('a'.repeat(15)), 'too long for a sane grid');
assert.ok(!_crosswordUsable('guten Tag'), 'a space cannot occupy a cell');
assert.ok(!_crosswordUsable("don't"), 'punctuation cannot occupy a cell');
assert.ok(!_crosswordUsable('你好世界'), 'Han is excluded — one glyph per cell is not a puzzle');
assert.ok(!_crosswordUsable('こんにちは'), 'Kana excluded');
assert.ok(!_crosswordUsable('안녕하세요'), 'Hangul excluded');
assert.ok(!_crosswordUsable('مرحبا'), 'Arabic excluded from this slice (contextual shaping + RTL)');
assert.ok(!_crosswordUsable(''), 'empty');
assert.ok(!_crosswordUsable(null), 'null is not a word');

// ── 2. The grid is well-formed ───────────────────────────────────────────────
// Rebuild the cell map from the entries and check the invariants a crossword must satisfy.
function cellsOf(g) {
  const m = new Map();
  for (const e of g.entries) {
    for (let i = 0; i < e.len; i++) {
      const r = e.row + (e.dir === 'down' ? i : 0);
      const c = e.col + (e.dir === 'across' ? i : 0);
      const k = r + ',' + c, prev = m.get(k);
      // Where two entries overlap they MUST agree — that is what a crossing is.
      if (prev != null) assert.strictEqual(prev, e.answer[i], `crossing letters disagree at ${k}`);
      m.set(k, e.answer[i]);
    }
  }
  return m;
}
{
  const g = _crosswordLayout(P('HAUS', 'HUND', 'SONNE', 'NACHT', 'BAUM', 'MAUS', 'STERN', 'BUCH'), 'lesson-1');
  assert.ok(g.entries.length >= 4, 'most words placed');
  const m = cellsOf(g);

  // Every cell sits inside the reported bounding box, and the box is tight.
  let maxR = -1, maxC = -1;
  for (const k of m.keys()) {
    const [r, c] = k.split(',').map(Number);
    assert.ok(r >= 0 && c >= 0, 'coordinates are normalised to 0-based');
    if (r > maxR) maxR = r; if (c > maxC) maxC = c;
  }
  assert.strictEqual(g.height, maxR + 1, 'height is the tight bounding box');
  assert.strictEqual(g.width, maxC + 1, 'width is the tight bounding box');

  // No word may sit directly before or after another in its own direction — otherwise the two
  // read as one longer word.
  for (const e of g.entries) {
    const dr = e.dir === 'down' ? 1 : 0, dc = e.dir === 'across' ? 1 : 0;
    assert.strictEqual(m.get((e.row - dr) + ',' + (e.col - dc)), undefined,
      `${e.answer} has a letter immediately before it`);
    assert.strictEqual(m.get((e.row + dr * e.len) + ',' + (e.col + dc * e.len)), undefined,
      `${e.answer} has a letter immediately after it`);
  }

  // The adjacency rule: a cell belonging ONLY to an across entry must have empty cells above and
  // below, unless a down entry legitimately passes through it. Without this, two across words on
  // neighbouring rows spell unintended vertical pairs.
  const inDown = new Set(), inAcross = new Set();
  for (const e of g.entries) {
    for (let i = 0; i < e.len; i++) {
      const k = (e.row + (e.dir === 'down' ? i : 0)) + ',' + (e.col + (e.dir === 'across' ? i : 0));
      (e.dir === 'down' ? inDown : inAcross).add(k);
    }
  }
  for (const k of m.keys()) {
    const [r, c] = k.split(',').map(Number);
    if (!inDown.has(k)) {
      const above = m.has((r - 1) + ',' + c), below = m.has((r + 1) + ',' + c);
      assert.ok(!above && !below, `cell ${k} touches vertically but belongs to no down entry`);
    }
    if (!inAcross.has(k)) {
      const left = m.has(r + ',' + (c - 1)), right = m.has(r + ',' + (c + 1));
      assert.ok(!left && !right, `cell ${k} touches horizontally but belongs to no across entry`);
    }
  }

  // Every placed word after the first must actually cross something — a disconnected island is
  // not a crossword.
  if (g.entries.length > 1) {
    for (const e of g.entries) {
      let crossings = 0;
      for (let i = 0; i < e.len; i++) {
        const k = (e.row + (e.dir === 'down' ? i : 0)) + ',' + (e.col + (e.dir === 'across' ? i : 0));
        if (inDown.has(k) && inAcross.has(k)) crossings++;
      }
      assert.ok(crossings >= 1, `${e.answer} is disconnected from the grid`);
    }
  }
  // Placement QUALITY, not just correctness: the rules above are all satisfied by a grid holding
  // a single word, so without a floor a regression that placed almost nothing would pass silently.
  assert.ok(g.entries.length >= 5, `expected >=5 of 8 words placed, got ${g.entries.length}`);
  console.log(`  grid ${g.width}×${g.height}, ${g.entries.length} entries, ${g.skipped.length} skipped: well-formed`);
}

// ── 3. Numbering follows crossword convention ────────────────────────────────
{
  const g = _crosswordLayout(P('HAUS', 'HUND', 'SONNE', 'NACHT', 'BAUM', 'STERN'), 'seed-num');
  const byStart = new Map();
  for (const e of g.entries) {
    const k = e.row + ',' + e.col;
    if (byStart.has(k)) assert.strictEqual(byStart.get(k), e.num, 'entries sharing a start cell share a number');
    byStart.set(k, e.num);
  }
  // Numbers increase in reading order.
  const seq = [...byStart.entries()]
    .map(([k, num]) => ({ r: +k.split(',')[0], c: +k.split(',')[1], num }))
    .sort((a, b) => (a.r - b.r) || (a.c - b.c));
  seq.forEach((s, i) => assert.strictEqual(s.num, i + 1, 'numbering runs 1..n in reading order'));
  console.log(`  numbering: ${seq.length} start cells, 1..${seq.length} in reading order: OK`);
}

// ── 4. Deterministic — the same lesson always yields the same puzzle ─────────
// Not cosmetic: shuffle() uses Math.random(), and a re-rolled grid would change under the learner
// mid-solve AND change the exercise's qid, which keys the solved-bit.
{
  const words = P('HAUS', 'HUND', 'SONNE', 'NACHT', 'BAUM', 'MAUS');
  const a = _crosswordLayout(words, 'lesson-42');
  const b = _crosswordLayout(words, 'lesson-42');
  assert.deepStrictEqual(a, b, 'same input + same seed → identical grid');

  const c = _crosswordLayout(words, 'lesson-43');
  assert.ok(JSON.stringify(a) !== JSON.stringify(c) || a.entries.length <= 1,
    'a different lesson generally gets a different arrangement');

  // And the RNG itself is a pure function of its seed.
  const r1 = _crosswordRng('x'), r2 = _crosswordRng('x');
  assert.deepStrictEqual([r1(), r1(), r1()], [r2(), r2(), r2()], 'seeded RNG is reproducible');
  console.log('  deterministic across calls; seeded RNG reproducible: OK');
}

// ── 5. Degenerate input degrades gracefully, never throws ───────────────────
assert.deepStrictEqual(_crosswordLayout([], 's'), { width: 0, height: 0, entries: [], skipped: [] }, 'empty input');
assert.deepStrictEqual(_crosswordLayout(null, 's').entries, [], 'null input');
assert.deepStrictEqual(_crosswordLayout(undefined, 's').entries, [], 'undefined input');
{
  // All unusable → nothing placed, and the caller can see why via `skipped` being empty (they were
  // filtered before placement) rather than the function throwing.
  const g = _crosswordLayout(P('你好', 'ab', 'guten Tag'), 's');
  assert.strictEqual(g.entries.length, 0, 'no usable words → no entries');

  // One usable word: placed, and it is the seed of the grid.
  const one = _crosswordLayout(P('HAUS'), 's');
  assert.strictEqual(one.entries.length, 1, 'a single word still makes a (trivial) grid');
  assert.strictEqual(one.width, 4);
  assert.strictEqual(one.height, 1);

  // Words that share no letters cannot cross, so all but the first are skipped rather than
  // dumped on the grid as islands.
  const iso = _crosswordLayout(P('ABC', 'DEF', 'GHI'), 's');
  assert.strictEqual(iso.entries.length, 1, 'non-crossing words are not placed');
  assert.deepStrictEqual(iso.skipped.sort(), ['DEF', 'GHI'], 'and they are reported as skipped');

  // A repeated answer is one solution with two clues — deduped.
  const dup = _crosswordLayout(P('HAUS', 'haus', 'HUND'), 's');
  const answers = dup.entries.map(e => e.answer).concat(dup.skipped.map(s => s.toUpperCase()));
  assert.strictEqual(answers.filter(a => a === 'HAUS').length, 1, 'duplicate answers are deduped case-insensitively');

  // Missing clue → unusable (a crossword entry without a clue is unsolvable).
  assert.strictEqual(_crosswordLayout([{ answer: 'HAUS' }], 's').entries.length, 0, 'no clue → not placed');
  console.log('  degenerate input: empty/null/unusable/isolated/duplicate/clue-less all handled');
}

// ── 6. The clue and the original spelling survive ────────────────────────────
{
  const g = _crosswordLayout([{ answer: 'Grüße', clue: 'greetings' }, { answer: 'Süß', clue: 'sweet' }], 's');
  const e = g.entries[0];
  assert.strictEqual(e.clue, e.display === 'Grüße' ? 'greetings' : 'sweet', 'the clue travels with its answer');
  assert.ok(/^[A-ZÄÖÜSS\u00C0-\u024F]+$/u.test(e.answer), 'the answer is uppercased for cell matching');
  assert.ok(g.entries.every(x => x.display && x.display !== x.answer.toLowerCase()),
    'the original spelling is preserved for display');
  console.log('  clue + original spelling preserved alongside the uppercased answer: OK');
}

console.log('unit-crossword-layout: ALL PASSED');
