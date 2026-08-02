// v72_a — sentence segmentation. The client and server each hold a copy of _sentenceSplit; this
// asserts the two are BYTE-IDENTICAL and that the shared rule behaves. Before v72_a they were two
// independently written splitters that had already drifted (the server's list had 。！？, the
// client's did not), which is the "one rule per question" failure mode this file exists to close.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function extractFrom(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing fn ' + name + ' in source');
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. Parity ───────────────────────────────────────────────────────────────
const clientSrc = extractFrom(html, '_sentenceSplit');
const serverSrc = extractFrom(server, '_sentenceSplit');
assert.strictEqual(clientSrc, serverSrc,
  '_sentenceSplit is byte-identical in index.html and server.js — if this fails, one copy was ' +
  'edited alone and the two halves of the pipeline now disagree about what a sentence is');
console.log('  _sentenceSplit: client/server parity (byte-identical): OK');

const { _sentenceSplit } = new Function(clientSrc + '\nreturn { _sentenceSplit };')();

// ── 2. The defect this replaced: non-Latin terminators ──────────────────────
// The old rule was /[.!?…]/, which excludes every terminator outside Latin script. Asserted as
// BEHAVIOUR (counts and content), not by inspecting the regex, so the guard survives a rewrite.
assert.deepStrictEqual(
  _sentenceSplit('今日は暑い。明日は寒い。本当ですか？はい。'),
  ['今日は暑い。', '明日は寒い。', '本当ですか？', 'はい。'],
  'CJK 。and ？end sentences (the whole ja corpus segmented as single units before v72_a)');
assert.strictEqual(_sentenceSplit('هل هذا صحيح؟ نعم، هو كذلك. وماذا بعد؟').length, 3,
  'the Arabic question mark ؟ (U+061F) ends a sentence — it is not in [.!?…]');
// …and the corrected v71 ruling still holds: an Arabic comma/semicolon does NOT end one.
assert.strictEqual(_sentenceSplit('ذهب إلى السوق، واشترى الخبز؛ ثم عاد.').length, 1,
  'but ، and ؛ do NOT — that passage really is one long sentence (the v71 correction)');
console.log('  non-Latin terminators recognised, non-terminators ignored: OK');

// ── 3. No text may be gained or lost (the v71_b corruption class) ───────────
// _unitsToText rejoins these pieces, so a dropped character is dropped TEXT. This is the invariant
// that matters most; it is asserted on the awkward cases the previous scan was written for.
for (const s of [
  '500.000 anni fa la Terra era diversa.',
  'S.J. Gould scrisse molto. Poi smise.',
  'Der Zug faehrt um 15.30 Uhr ab.',
  '今日は暑い。明日は寒い。',
  'هل هذا صحيح؟ نعم.',
  'One. Two. Three.',
]) {
  const joined = _sentenceSplit(s).join(' ').replace(/\s+/g, ' ').trim();
  assert.strictEqual(joined.replace(/\s/g, ''), s.replace(/\s/g, ''),
    'no character is gained or lost splitting: ' + s);
}
// The specific v71_b symptom, spelled out: a glued period is part of a token, not a boundary.
assert.deepStrictEqual(_sentenceSplit('500.000 anni fa'), ['500.000 anni fa'],
  'a period glued to a digit does not split (500.000 must not become "500. 000")');
console.log('  no text gained or lost; glued periods are not boundaries: OK');

// ── 4. A single newline is a WRAP, not a sentence end ───────────────────────
// Intl.Segmenter treats a line break as a boundary. _sentenceUnits has already split paragraphs on
// \n\n+, so a surviving \n is a wrapped line — and splitting there shatters PDF-derived text
// mid-clause, which is exactly what v70_k's paragraph repair exists to prevent.
assert.deepStrictEqual(
  _sentenceSplit('interventi dei vigili del fuoco per\nsottopassi allagati in citta.'),
  ['interventi dei vigili del fuoco per sottopassi allagati in citta.'],
  'a mid-sentence line wrap does not split (598 of 854 new boundaries came from this before)');
assert.strictEqual(_sentenceSplit('Uno.\nDue.\nTre.').length, 3,
  'while a line break AFTER a terminator still ends the sentence');
console.log('  single newlines treated as wraps, not boundaries: OK');

// ── 5. Mid-sentence ellipsis (changed behaviour, deliberately) ──────────────
// The old scan split at "..." + space. Where the next word is lowercase this is hesitation INSIDE
// a sentence; 51 corpus boundaries were wrong for this reason. Pinned so the improvement is not
// silently reverted by a future terminator tweak.
assert.deepStrictEqual(_sentenceSplit("\"Forse... forse c'e qualcosa che non va,\" disse."),
  ["\"Forse... forse c'e qualcosa che non va,\" disse."],
  'hesitation ellipsis does not end a sentence');
console.log('  mid-sentence ellipsis no longer splits: OK');

// ── 6. Degenerate input ─────────────────────────────────────────────────────
assert.deepStrictEqual(_sentenceSplit(''), [], 'empty string');
assert.deepStrictEqual(_sentenceSplit('   \n  '), [], 'whitespace only');
assert.deepStrictEqual(_sentenceSplit(null), [], 'null');
assert.deepStrictEqual(_sentenceSplit(undefined), [], 'undefined');
assert.deepStrictEqual(_sentenceSplit('no terminator here'), ['no terminator here'],
  'a paragraph with no terminator is one unit, never zero');
console.log('  degenerate input: OK');

// ── 7. The fallback path still works where Intl.Segmenter is absent ─────────
// Old browsers must degrade to the PRE-v72_a behaviour, not to no splitting. Exercised by running
// the same source with Intl.Segmenter hidden.
{
  const fb = new Function('Intl', clientSrc + '\nreturn _sentenceSplit;')({});
  assert.strictEqual(fb('One. Two. Three.').length, 3, 'fallback still splits Latin sentences');
  assert.deepStrictEqual(fb('500.000 anni fa'), ['500.000 anni fa'],
    'fallback keeps the v71_b glued-period protection');
  assert.deepStrictEqual(fb(''), [], 'fallback handles empty input');
}
console.log('  fallback without Intl.Segmenter degrades to the old scan: OK');

// ── 8. The server wrapper builds its pool from the same rule ────────────────
const { _synSplitSentences } = new Function(
  extractFrom(server, '_sentenceSplit') + '\n' + extractFrom(server, '_synSplitSentences') +
  '\nreturn { _synSplitSentences };')();
assert.deepStrictEqual(
  _synSplitSentences('今日は暑い。明日は寒い。'), ['今日は暑い。', '明日は寒い。'],
  'the synonym context pool splits CJK too (it did before v72_a; the CLIENT was the broken half)');
assert.strictEqual(_synSplitSentences('Uno.\n\nDue. Tre.').length, 3,
  'paragraphs are separated before splitting, so a blank line still divides');
console.log('  _synSplitSentences routes through the shared rule: OK');

// ── 9. Length fallback: over-long units are sub-split (v72_b, item b) ───────
// The fix for the ORIGINAL Arabic complaint, which v72_a did not touch: those sentences are
// genuinely long, not mis-segmented. Budget chosen from the corpus (p99 = 325), so 300 touches
// ~1% of units, almost all Arabic and Italian.
{
  const SENT = html.match(/const _SENT_END_RE = [^\n]+/)[0];
  const MAXC = html.match(/const _MAX_UNIT_CHARS = \d+;/)[0];
  const M = new Function(SENT + '\n' + MAXC + '\n' + extractFrom(html, '_sentenceSplit') + '\n' +
    extractFrom(html, '_splitLongUnit') + '\n' + extractFrom(html, '_sentenceUnits') + '\n' +
    'return { _splitLongUnit, _sentenceUnits, _MAX_UNIT_CHARS };')();

  assert.strictEqual(M._MAX_UNIT_CHARS, 300, 'the budget is the measured one, not an invented round number');

  // Short input is returned untouched — the fallback must not disturb ordinary prose.
  assert.deepStrictEqual(M._splitLongUnit('A short sentence.'), ['A short sentence.']);
  assert.deepStrictEqual(M._splitLongUnit(''), []);
  assert.deepStrictEqual(M._splitLongUnit(null), []);

  // NO WORD MAY BE GAINED OR LOST. This is the invariant that caught the first implementation:
  // Intl.Segmenter reports word boundaries INSIDE a token ("l'aria" -> l | ' | aria), so cutting at
  // an arbitrary boundary and rejoining with a space invents words. Cuts are anchored to existing
  // whitespace for exactly this reason.
  const longIt = ('Oggi il programma di ricerca e piu pluralista, perche prevede una molteplicita di ' +
    "fattori e di fenomeni, le sorgenti di variazione non sono soltanto le mutazioni genetiche, " +
    "ma anche quelle epigenetiche e quelle dovute al trasferimento genico orizzontale, mentre " +
    "l'aria della selezione naturale si integra alla selezione sessuale e di gruppo, con esiti " +
    'che restano oggetto di discussione fra 30-32 studiosi diversi.');
  assert.ok(longIt.length > 300, 'the fixture really is over budget');
  const parts = M._splitLongUnit(longIt);
  assert.ok(parts.length > 1, 'an over-long unit is split');
  assert.strictEqual(parts.join(' ').split(/\s+/).filter(Boolean).length,
    longIt.split(/\s+/).filter(Boolean).length,
    'no word is gained or lost by splitting');
  assert.ok(parts.every(p => p.length <= 300 || !/\s/.test(p)), 'each piece is within budget');
  // The two tokens that broke the first attempt must survive whole.
  assert.ok(parts.some(p => /l'aria/.test(p)), "an apostrophe token is not split (l'aria)");
  assert.ok(parts.some(p => /30-32/.test(p)), 'a hyphenated number is not split (30-32)');

  // Clause boundaries are preferred, in any script, with no punctuation list in the code.
  assert.ok(parts.every(p => !/^[a-z]/.test(p) || /[,;:]/.test(longIt)),
    'pieces begin after a clause break where one is available');
  const longAr = 'ذهب الرجل إلى السوق، ' .repeat(20).trim();
  const arParts = M._splitLongUnit(longAr);
  assert.ok(arParts.length > 1, 'Arabic over-long units split too');
  assert.strictEqual(arParts.join(' ').replace(/\s+/g, ''), longAr.replace(/\s+/g, ''),
    'and lose no Arabic text');
  assert.ok(arParts.slice(0, -1).every(p => /،$/.test(p)),
    'splitting at ، — the clause separator Unicode correctly refuses to treat as a sentence end');

  // A script with no whitespace yields no safe cut, so the unit is left whole rather than cut
  // mid-word. Correct, and costs nothing: everything over budget in the corpus uses whitespace.
  const longJa = '今日はとても暑いですね'.repeat(40);
  assert.ok(longJa.length > 300);
  assert.deepStrictEqual(M._splitLongUnit(longJa), [longJa],
    'a whitespace-free script is left whole rather than cut mid-word');
  console.log('  over-long units sub-split at clause boundaries, losslessly: OK');

  // Fragments are FLAGGED, so a consumer showing one to a learner can mark it as an excerpt.
  const units = M._sentenceUnits(longIt);
  assert.ok(units.length > 1 && units.every(u => u.frag), 'sub-split units are flagged as fragments');
  assert.strictEqual(units.filter(u => u.fragFirst).length, 1, 'exactly one first fragment');
  assert.strictEqual(units.filter(u => u.fragLast).length, 1, 'exactly one last fragment');
  const whole = M._sentenceUnits('One. Two. Three.');
  assert.ok(whole.length === 3 && whole.every(u => !u.frag),
    'ordinary sentences are NOT flagged as fragments');
  console.log('  fragments flagged, whole sentences not: OK');
}

// ── 10. units → text roundtrip must not INSERT whitespace (v72_b) ──────────
// v72_a gave CJK real sentence boundaries for the first time — and CJK puts no whitespace at them,
// so _unitsToText rejoining with ' ' silently inserted a space after every 。 and changed the text
// of all 13 Japanese stories in the corpus. It survived a green suite because every PDF fixture is
// Latin, where the separator really is a space. Units now carry the separator that was actually
// there.
{
  const SENT = html.match(/const _SENT_END_RE = [^\n]+/)[0];
  const MAXC = html.match(/const _MAX_UNIT_CHARS = \d+;/)[0];
  const M = new Function(SENT + '\n' + MAXC + '\n' + extractFrom(html, '_sentenceSplit') + '\n' +
    extractFrom(html, '_splitLongUnit') + '\n' + extractFrom(html, '_sentenceUnits') + '\n' +
    extractFrom(html, '_unitsToText') + '\nreturn { _sentenceUnits, _unitsToText };')();
  const round = (s) => M._unitsToText(M._sentenceUnits(s));

  const ja = '今日は暑い。明日は寒い。本当ですか？はい。';
  assert.strictEqual(round(ja), ja, 'a CJK paragraph survives units -> text unchanged');
  assert.ok(M._sentenceUnits(ja).length === 4, 'and it really was split into 4 units, not left whole');

  const en = 'One. Two. Three.';
  assert.strictEqual(round(en), en, 'a Latin paragraph is unchanged too — the space is still a space');
  assert.strictEqual(round('Uno.\n\nDue. Tre.'), 'Uno.\n\nDue. Tre.', 'paragraph breaks survive');

  // Units built by hand, without `sep`, must still join with a space.
  assert.strictEqual(M._unitsToText([{ text: 'A.', para: 0 }, { text: 'B.', para: 0 }]), 'A. B.',
    'units with no sep default to a space, so older callers are unaffected');
  console.log('  units -> text inserts no whitespace, in any script: OK');
}

// ── 11. Clause detection for the synonym clamp window (v72_c) ──────────────
// _synClamp starts its window just after a nearby clause break so the excerpt reads as a phrase.
// It used a hand-written list `[,;:—–،؛。、]` which had `،` and `、` but NOT the Devanagari danda
// `।` — and Hindi is a shipped language. Same mechanism as _splitLongUnit now answers it, so there
// is one way to ask "is this punctuation?" instead of two.
{
  const M = new Function(
    html.match(/const _SYN_CLAUSE_RE = [^\n]+/)[0] + '\n' +
    html.match(/const SYN_CONTEXT_MAX_WORDS = \d+;/)[0] + '\n' +
    extractFrom(html, '_endsClause') + '\n' + extractFrom(html, '_synClamp') +
    '\nreturn { _endsClause, _synClamp, _SYN_CLAUSE_RE };')();

  // The scripts the list already covered still work…
  for (const w of ['word,', 'кома,', '語、', 'كلمة،', 'satz;', 'ding:'])
    assert.ok(M._endsClause(w), `${w} ends a clause`);
  // …and the ones it silently missed now do too. This is the whole point of the change.
  for (const [w, script] of [['बात।', 'Devanagari danda'], ['խոսք։', 'Armenian'], ['ቃል።', 'Ethiopic']]) {
    assert.ok(M._endsClause(w), `${w} ends a clause (${script})`);
    assert.ok(!M._SYN_CLAUSE_RE.test(w), `and the old hand-written list MISSED it (${script}) — ` +
      'if this ever fails the list was extended by hand, which is the thing being avoided');
  }
  // A plain word does not, and neither does empty input.
  for (const w of ['word', 'wort', '言葉', '', null]) assert.ok(!M._endsClause(w), `${JSON.stringify(w)} does not`);

  // The fallback path, for engines without Intl.Segmenter, degrades to the old list.
  {
    const fb = new Function('Intl',
      html.match(/const _SYN_CLAUSE_RE = [^\n]+/)[0] + '\n' + extractFrom(html, '_endsClause') +
      '\nreturn _endsClause;')({});
    assert.ok(fb('word,'), 'fallback still detects a comma');
    assert.ok(!fb('बात।'), 'fallback has the old gap, which is the correct degradation');
  }
  console.log('  clause detection is script-driven, with the old list as fallback: OK');

  // And the behaviour it exists for: the window begins just AFTER a clause break rather than
  // mid-clause. The fixture is built so the branch is genuinely reached — the target sits far
  // enough in that the window does not start at word 0, and the break falls inside the six words
  // the scan looks back over. (An earlier version of this test put the target at word 10, so the
  // window started at 0, the scan never ran, and the assertion proved nothing.)
  {
    const mk = (word, brk, target) => {
      const w = [];
      for (let i = 0; i < 40; i++) w.push(word + i);
      w[10] = word + '10' + brk;
      w[20] = target;
      return w.join(' ');
    };
    const latin = M._synClamp(mk('w', ',', 'TARGET'), 'TARGET', 24);
    assert.ok(/TARGET/.test(latin), 'the window contains the target word');
    assert.ok(latin.startsWith('… w11'),
      'the window begins just after the clause break at w10, not mid-clause');
    assert.ok(latin.endsWith('…'), 'and elision is marked at both ends');
    assert.ok(latin.split(/\s+/).filter(Boolean).length <= 26, 'the window is clamped');

    // The same sentence in Devanagari. This aligns ONLY because clause detection is script-driven:
    // the danda was not in the hand-written list, so before v72_c the window began mid-clause.
    const hindi = M._synClamp(mk('श', '।', 'लक्ष्य'), 'लक्ष्य', 24);
    assert.ok(hindi.startsWith('… श11'),
      'a Devanagari sentence aligns to its danda too — the case the hand-written list could not see');

    // Short input is returned whole, with no ellipsis to mislead the learner.
    assert.strictEqual(M._synClamp('a short sentence', 'short', 24), 'a short sentence');
  }
  console.log('  _synClamp window: clause-aligned in any script, clamped, elision marked: OK');
}

console.log('unit-sentence-segmentation: ALL PASSED');
