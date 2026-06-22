// Unit tests for the drag-to-highlight chapter-selection pure helpers
// (_trimSpan, _normalizeSelections, _selectionsToChunks). Extracts the live
// function sources from index.html via brace-matching and evaluates them.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Pull `function NAME(...) { ... }` out of the inline script by brace-matching.
function extract(name) {
  const sig = 'function ' + name + '(';
  const at = html.indexOf(sig);
  assert.ok(at >= 0, 'function not found in index.html: ' + name);
  const braceStart = html.indexOf('{', at);
  let depth = 0, i = braceStart;
  for (; i < html.length; i++) {
    const ch = html[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(at, i);
}

const src = ['splitWords', 'wordCount', '_autoTitle', '_trimSpan', '_normalizeSelections', '_selectionsToChunks'].map(extract).join('\n\n');
const mod = new Function(src + '\nreturn { _autoTitle, _trimSpan, _normalizeSelections, _selectionsToChunks };')();
const { _trimSpan, _normalizeSelections, _selectionsToChunks } = mod;

// ── _trimSpan ──
assert.deepStrictEqual(_trimSpan('  hello  ', 0, 9), { start: 2, end: 7 }, 'trims both edges');
assert.deepStrictEqual(_trimSpan('abc', 0, 3), { start: 0, end: 3 }, 'no trim needed');
assert.strictEqual(_trimSpan('   ', 0, 3), null, 'all-whitespace → null');
assert.deepStrictEqual(_trimSpan('xyword', 2, 999), { start: 2, end: 6 }, 'clamps end to length');
assert.deepStrictEqual(_trimSpan('word\n\n', 0, 6), { start: 0, end: 4 }, 'trims trailing newlines');
console.log('  _trimSpan: OK');

// ── _normalizeSelections ──
assert.deepStrictEqual(_normalizeSelections([{ start: 10, end: 5 }]), [], 'drops inverted/empty');
assert.deepStrictEqual(_normalizeSelections([{ start: 20, end: 30 }, { start: 0, end: 10 }]),
  [{ start: 0, end: 10 }, { start: 20, end: 30 }], 'sorts by start');
assert.deepStrictEqual(_normalizeSelections([{ start: 0, end: 10 }, { start: 5, end: 15 }]),
  [{ start: 0, end: 15 }], 'merges overlap');
assert.deepStrictEqual(_normalizeSelections([{ start: 0, end: 10 }, { start: 10, end: 20 }]),
  [{ start: 0, end: 10 }, { start: 10, end: 20 }], 'adjacent (touching) stay separate');
assert.deepStrictEqual(_normalizeSelections([{ start: 0, end: 5 }, { start: 2, end: 3 }, { start: 4, end: 12 }]),
  [{ start: 0, end: 12 }], 'chained/contained overlaps collapse to one');
console.log('  _normalizeSelections: OK');

// ── _selectionsToChunks ──
const raw = 'Chapter Alpha\n\nSome body text here.\n\nBeta heading\n\nMore words follow now today.';
const iAlpha = raw.indexOf('Chapter Alpha');
const iBodyEnd = raw.indexOf('here.') + 'here.'.length;
const iBeta = raw.indexOf('Beta heading');
const iEnd = raw.length;

// Out-of-order + a whitespace-padded span; expect document-order chunks.
const sels = [
  { start: iBeta, end: iEnd },                 // chapter 2 (later in doc) given first
  { start: iAlpha, end: iBodyEnd + 2 },        // chapter 1, trailing whitespace to be trimmed
];
const chunks = _selectionsToChunks(raw, sels);
assert.strictEqual(chunks.length, 2, 'two chunks');
assert.ok(chunks[0].text.startsWith('Chapter Alpha'), 'chunk 1 is the earlier span (document order), got: ' + JSON.stringify(chunks[0].text.slice(0, 20)));
assert.ok(chunks[0].text.endsWith('here.'), 'chunk 1 trailing whitespace trimmed');
assert.ok(chunks[1].text.startsWith('Beta heading'), 'chunk 2 is the later span');
assert.ok(chunks.every(c => c.wordCount > 0), 'word counts populated');
assert.ok(chunks.every(c => typeof c.title === 'string' && c.title.length), 'titles populated');
assert.ok(chunks.every(c => c.status === 'pending'), 'status pending');

// Empty / whitespace-only selection is dropped.
const ws = raw.indexOf('\n\nSome');
assert.strictEqual(_selectionsToChunks(raw, [{ start: ws, end: ws + 2 }]).length, 0, 'whitespace-only span → no chunk');

// No selections → no chunks.
assert.deepStrictEqual(_selectionsToChunks(raw, []), [], 'empty selections → []');
console.log('  _selectionsToChunks: OK');

// ── _absOffsetFromNode (DOM offset mapping) ──
const fn2 = new Function(extract('_absOffsetFromNode') + '\nreturn _absOffsetFromNode;')();
// Stub nodes: text node (nodeType 3) with a parent span carrying data-start.
function spanNode(start, parent) { return { nodeType: 1, dataset: start == null ? {} : { start: String(start) }, parentElement: parent || null }; }
function textNode(parentSpan) { return { nodeType: 3, parentElement: parentSpan }; }

const segA = spanNode(100);
assert.strictEqual(fn2(textNode(segA), 5), 105, 'text node + parent data-start → abs offset');
assert.strictEqual(fn2(segA, 0), 100, 'element node with data-start, offset 0');
// Climb through a wrapper without data-start.
const grand = spanNode(10);
const wrapper = spanNode(null, grand);
assert.strictEqual(fn2(textNode(wrapper), 3), 13, 'climbs past non-data-start ancestor');
// No data-start anywhere → null (endpoint outside a segment).
const orphan = spanNode(null, spanNode(null, null));
assert.strictEqual(fn2(textNode(orphan), 4), null, 'no data-start ancestor → null');
console.log('  _absOffsetFromNode: OK');

// ── capture-path round trip: two endpoints in different segments ──
// Simulate dragging from segment(start=20) local-offset 4  to  segment(start=50) local-offset 7.
{
  const s1 = spanNode(20), s2 = spanNode(50);
  let a = fn2(textNode(s1), 4), b = fn2(textNode(s2), 7);   // 24 .. 57
  const raw2 = 'x'.repeat(80);
  const span = _trimSpan(raw2, Math.min(a, b), Math.max(a, b));
  assert.deepStrictEqual(span, { start: 24, end: 57 }, 'capture math yields the dragged span');
  // backwards drag (anchor after focus) yields the same normalized span
  let a2 = fn2(textNode(s2), 7), b2 = fn2(textNode(s1), 4);
  const span2 = _trimSpan(raw2, Math.min(a2, b2), Math.max(a2, b2));
  assert.deepStrictEqual(span2, { start: 24, end: 57 }, 'backwards drag normalizes the same');
}
console.log('  capture-path round trip: OK');

console.log('unit-pdf-selection: ALL PASSED');
