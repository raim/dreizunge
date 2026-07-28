// unit-storyboard-frames.test.js
// v71_k — result cards show the WHOLE storyboard, each panel framed by state:
//   green = every chapter in that panel's span is finished
//   blue  = the span contains the chapter just played
//   none  = not reached yet
//
// Replaces the v65.1 crop, which showed only the panel carrying THIS chapter and returned early
// when no panel did. Panels and chapters are rarely 1:1, so that early return was reachable with
// ordinary data: `sl_1725748570` (8 chapters, panels tagged 1,3,4,6,7) showed an EMPTY card on
// chapters 2, 5 and 8, and `sl_795546417` (8 chapters, tagged 1,2,2,4,5) on chapters 6, 7 and 8.
//
// The subtle half is the SPAN. "This panel covers from its own chapter to the next panel's
// chapter" is the obvious rule and it is wrong: as soon as two panels resolve to the same chapter
// it produces a backwards range, and a panel with a backwards range can never turn green. That
// happens on SEVEN of the 22 storyboards in the user's own data — including Fungal Frenzy, which
// has FEWER panels than chapters, so it is not a quirk of short stories. The rule under test
// groups panels by DISTINCT chapter instead, which is well-defined in both directions.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function ext(src, name) {
  let at = src.indexOf('\nfunction ' + name + '(') + 1;
  assert.ok(at >= 1, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}
const _sbPanelChapter = new Function(ext(client, '_sbPanelChapter') + '\nreturn _sbPanelChapter;')();
const _sbPanelSpans   = new Function(ext(client, '_sbPanelSpans')   + '\nreturn _sbPanelSpans;')();
const _sbFrameState   = new Function(ext(client, '_sbFrameState')   + '\nreturn _sbFrameState;')();

// Panel chapters for a board, exactly as the renderer derives them.
const chapters = (tags, P, C) => Array.from({ length: P }, (_, i) => _sbPanelChapter(i, P, C, tags ? tags[i] : null));

// ── 1. Spans cover every chapter exactly once, in both directions ───────────
{
  // Fewer panels than chapters: the reported board. Panels tagged 1,3,4,6,7 over 8 chapters.
  const s1 = _sbPanelSpans(chapters([1, 3, 4, 6, 7], 5, 8), 8);
  assert.deepStrictEqual(s1, [[1, 2], [3, 3], [4, 5], [6, 6], [7, 8]],
    'sl_1725748570: the three chapters with no panel of their own are absorbed by their neighbours');
  // MORE panels than chapters: 4 panels over 2 chapters (Fibonaccis Hasen, untagged → split).
  const s2 = _sbPanelSpans(chapters(null, 4, 2), 2);
  assert.deepStrictEqual(s2, [[1, 1], [1, 1], [2, 2], [2, 2]],
    '4 panels / 2 chapters: panels pair up, and no span runs backwards');
  // The extreme: 3 panels, 1 chapter (Yusuf and the Lost Cat).
  assert.deepStrictEqual(_sbPanelSpans(chapters(null, 3, 1), 1), [[1, 1], [1, 1], [1, 1]],
    '3 panels / 1 chapter: all three panels are that one chapter');
  // Equal counts: identity.
  assert.deepStrictEqual(_sbPanelSpans(chapters(null, 3, 3), 3), [[1, 1], [2, 2], [3, 3]],
    'equal counts → one chapter per panel');
  // Duplicate tags with FEWER panels than chapters — the case that proves this is not about
  // short stories. Fungal Frenzy: 5 panels, 8 chapters, two panels both tagged chapter 2.
  assert.deepStrictEqual(_sbPanelSpans(chapters([1, 2, 2, 4, 5], 5, 8), 8),
    [[1, 1], [2, 3], [2, 3], [4, 4], [5, 8]],
    'sl_795546417: the two panels sharing chapter 2 share one span and light up together');
  // Grouping by DISTINCT chapter — not by adjacent panel — is what keeps spans from inverting;
  // with `distinct` sorted, next - 1 >= d always holds. The one input that can still invert is a
  // chapter number ABOVE chapterCount, which _sbPanelChapter clamps but a direct caller need not.
  // Asserted so the clamp is covered rather than sitting there as untested defensive code.
  assert.deepStrictEqual(_sbPanelSpans([1, 9], 3), [[1, 8], [9, 9]],
    'a chapter number above the chapter count still yields a forward span, never [9, 3]');
}

// ── 2. No span may run backwards, and the whole story must be covered ───────
// The property the naive rule broke. Checked across a spread of shapes rather than examples.
{
  for (const [P, C] of [[5, 8], [2, 12], [6, 4], [12, 11], [4, 4], [5, 1], [3, 7], [1, 9], [9, 1]]) {
    const spans = _sbPanelSpans(chapters(null, P, C), C);
    const covered = new Set();
    spans.forEach((sp, i) => {
      assert.ok(Array.isArray(sp), `P=${P} C=${C} panel ${i}: has a span`);
      assert.ok(sp[1] >= sp[0], `P=${P} C=${C} panel ${i}: span ${JSON.stringify(sp)} does not run backwards`);
      assert.ok(sp[0] >= 1 && sp[1] <= C, `P=${P} C=${C} panel ${i}: span stays inside the story`);
      for (let c = sp[0]; c <= sp[1]; c++) covered.add(c);
    });
    assert.strictEqual(covered.size, C, `P=${P} C=${C}: every chapter belongs to some panel's span`);
    // Panels resolving to the same chapter must get the SAME span — they are one story moment.
    const chs = chapters(null, P, C);
    chs.forEach((c, i) => chs.forEach((c2, j) => {
      if (c === c2) assert.deepStrictEqual(spans[i], spans[j],
        `P=${P} C=${C}: panels ${i} and ${j} share chapter ${c}, so they share a span`);
    }));
  }
}

// ── 3. Frame states ─────────────────────────────────────────────────────────
{
  const none = () => false, all = () => true;
  // A span is green only when EVERY chapter in it is done — the point of spans.
  assert.strictEqual(_sbFrameState([7, 8], c => c === 7, 3), 'none',
    'chapter 7 done but 8 not: the panel covering 7-8 stays unframed');
  assert.strictEqual(_sbFrameState([7, 8], all, 3), 'done', 'both done → green');
  assert.strictEqual(_sbFrameState([1, 2], none, 2), 'open', 'the open chapter inside the span → blue');
  assert.strictEqual(_sbFrameState([1, 2], none, 5), 'none', 'neither played nor open → no frame');
  // Blue outranks green: replaying a finished chapter must still show where the learner is.
  assert.strictEqual(_sbFrameState([4, 5], all, 4), 'open',
    'a finished span containing the chapter just played is BLUE, not green');
  // Degenerate input can never throw or produce a frame.
  [null, undefined, [], [0, 0], [3, 1], 'x'].forEach(sp =>
    assert.strictEqual(_sbFrameState(sp, all, 1), 'none', `degenerate span ${JSON.stringify(sp)} → no frame`));
}

// ── 4. End to end on the reported boards: no chapter is ever left blank ─────
// The actual regression. For every chapter of each reported storyline, SOME panel must be framed —
// under the old crop, chapters with no panel of their own rendered nothing at all.
{
  const boards = [
    { name: 'sl_1725748570 (Evolution der Theorie)', tags: [1, 3, 4, 6, 7], P: 5, C: 8 },
    { name: 'sl_795546417 (Fungal Frenzy)',          tags: [1, 2, 2, 4, 5], P: 5, C: 8 },
    { name: 'Fibonaccis Hasen',                      tags: null,            P: 4, C: 2 },
    { name: 'Yusuf and the Lost Cat',                tags: null,            P: 3, C: 1 },
    { name: 'Nights in Cairo',                       tags: null,            P: 5, C: 3 },
  ];
  for (const b of boards) {
    const spans = _sbPanelSpans(chapters(b.tags, b.P, b.C), b.C);
    for (let open = 1; open <= b.C; open++) {
      const states = spans.map(sp => _sbFrameState(sp, () => false, open));
      assert.ok(states.includes('open'),
        `${b.name}: chapter ${open} must frame a panel — this is the reported empty card`);
      assert.strictEqual(states.filter(s => s === 'open').length,
        spans.filter(sp => sp && open >= sp[0] && open <= sp[1]).length,
        `${b.name}: chapter ${open} frames exactly the panels whose span contains it`);
    }
    // Everything played → the whole board is green, with nothing left unframed.
    const finished = spans.map(sp => _sbFrameState(sp, () => true, 0));
    assert.deepStrictEqual([...new Set(finished)], ['done'],
      `${b.name}: a fully played story shows an all-green board`);
  }
}

// ── 5. Progressive play greens the board monotonically ──────────────────────
// A panel that has gone green must never go back to unframed as more chapters are finished.
{
  const C = 8, spans = _sbPanelSpans(chapters([1, 3, 4, 6, 7], 5, C), C);
  const seenDone = new Set();
  for (let upto = 0; upto <= C; upto++) {
    const isDone = c => c <= upto;
    spans.forEach((sp, i) => {
      const st = _sbFrameState(sp, isDone, 0);
      if (st === 'done') seenDone.add(i);
      else assert.ok(!seenDone.has(i), `panel ${i} went green earlier and must not un-green at ${upto} chapters done`);
    });
  }
  assert.strictEqual(seenDone.size, spans.length, 'finishing every chapter greens every panel');
  // And the first panel does NOT go green after chapter 1 alone — its span is 1-2.
  assert.strictEqual(_sbFrameState(spans[0], c => c === 1, 0), 'none',
    'panel 1 covers chapters 1-2, so finishing only chapter 1 leaves it unframed');
}

console.log('unit-storyboard-frames: ALL PASSED');
