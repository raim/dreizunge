// unit-dialect-glossary.test.js
// M1 dialect importer (deterministic, no LLM). Verifies the faithful glossary parser against the
// REAL uploaded Osttirol material: '=' delimiter, license/header skipped, rows verbatim, the
// known PDF collided-row artifact SURFACED (not auto-split), duplicates kept-but-reported, and the
// vocab-item shape ({target, source, note?, _dialect:true}). Faithfulness spine: the importer never
// invents/splits/normalizes dialect tokens.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseDialectGlossary, dialectVocabItems } = require('../dialect-glossary.js');

const text = fs.readFileSync(path.join(__dirname, 'fixtures', 'osttirol-glossary.txt'), 'utf8');

// ── 1) Parses the real '=' glossary; license + title lines skipped ───────────
const { rows, report } = parseDialectGlossary(text);
assert.strictEqual(report.delimiter, 'equals', 'detects the " = " delimiter');
// The two non-data lines (title + CC license) must NOT become rows.
assert.ok(!rows.some(r => /Wörterbuch Osttirol/i.test(r.target)), 'title line is not a row');
assert.ok(!rows.some(r => /CC BY-NC|Kranebitter/i.test(r.target + r.source)), 'license line is not a row');
assert.ok(report.headerSkipped >= 1, 'header/license lines were skipped, not silently dropped as data');
// Row count: 85 lines contain "=" (the collided line is ONE row); title + CC license skipped.
assert.strictEqual(rows.length, 85, 'parses all data rows (collided line counts as one), got ' + rows.length);
console.log('  parses real "=" glossary; title + CC license skipped; 85 rows: OK');

// ── 2) Rows are verbatim (no normalization beyond trim) ──────────────────────
const boisl = rows.find(r => r.target === 'a boisl');
assert.ok(boisl && boisl.source === 'einige Zeit', 'multi-word dialect target kept verbatim');
const dalämpat = rows.find(r => r.target === 'dalämpat');
assert.strictEqual(dalämpat.source, 'zerzaust, kaputt, ramponiert',
  'multi-sense German side kept verbatim (not split)');
const tschoppen = rows.find(r => r.target === 'tschoppen/einetschoppen');
assert.ok(tschoppen && tschoppen.source === 'das essen reinstopfen', 'slash-variant target kept verbatim');
const lettn = rows.find(r => r.target === 'Lettn');
assert.strictEqual(lettn.source, 'Dreck / Schlamm', 'German side with " / " kept verbatim');
console.log('  rows verbatim: multi-word, multi-sense, slash-variants preserved: OK');

// ── 3) The known PDF collided row is SURFACED, never auto-split ───────────────
// Fixture line: "Mangale = Männchen, kleiner MannFock = Schwein" is TWO glued entries.
const mangale = rows.find(r => r.target === 'Mangale');
assert.ok(mangale, 'Mangale row exists');
assert.strictEqual(mangale.source, 'Männchen, kleiner MannFock = Schwein',
  'collided row is kept verbatim (importer does NOT invent a split)');
assert.ok(!rows.some(r => r.target === 'Fock'), 'the glued "Fock" is NOT auto-extracted into its own row');
assert.ok(report.suspicious.some(s => /glued/.test(s.reason) && /Mangale/.test(s.raw)),
  'the collided row is flagged as suspicious for the human to fix');
console.log('  collided PDF row surfaced as suspicious, not auto-split: OK');

// ── 4) Duplicates are kept but reported ──────────────────────────────────────
// "Schwein" appears as a gloss for Notscha AND (glued) elsewhere — but duplicate report is by
// TARGET. Our fixture has no duplicate targets, so the list should be empty; assert the mechanism.
const dupText = 'foo = bar\nfoo = baz\nqux = quux';
const dup = parseDialectGlossary(dupText);
assert.strictEqual(dup.rows.length, 3, 'duplicate targets are KEPT as separate rows');
assert.ok(dup.report.duplicates.some(d => d.target === 'foo' && d.count === 2),
  'duplicate target is reported');
console.log('  duplicate targets kept as rows but reported: OK');

// ── 5) Vocab items carry the dialect marker + optional note ──────────────────
const items = dialectVocabItems(rows);
assert.strictEqual(items.length, rows.length, 'one vocab item per row');
assert.ok(items.every(it => it._dialect === true), 'every item marked _dialect:true');
assert.ok(items.every(it => it.target && it.source), 'every item has target + source');
// A 3-col row carries a note (explicit 3-column mode).
const noted = parseDialectGlossary('Gitsche | Mädchen | Pustertal', { threeCol: true });
assert.strictEqual(noted.rows[0].note, 'Pustertal', '3rd column becomes the note in 3-col mode');
const notedItems = dialectVocabItems(noted.rows);
assert.strictEqual(notedItems[0].note, 'Pustertal', 'note carried onto the vocab item');
// Without 3-col mode, extra parts rejoin into source (faithful, no phantom note).
const twoCol = parseDialectGlossary('Gitsche | Mädchen | Pustertal');
assert.ok(!twoCol.rows[0].note, '2-col mode: no phantom note');
assert.strictEqual(twoCol.rows[0].source, 'Mädchen | Pustertal', '2-col mode rejoins extra parts verbatim');
console.log('  vocab items: _dialect:true, target/source, optional note: OK');

// ── 6) Delimiter detection across formats ────────────────────────────────────
assert.strictEqual(parseDialectGlossary('a\tb\nc\td').report.delimiter, 'tab', 'TSV detected');
assert.strictEqual(parseDialectGlossary('a | b\nc | d').report.delimiter, 'pipe', 'pipe detected');
assert.strictEqual(parseDialectGlossary('a = b\nc = d').report.delimiter, 'equals', 'equals detected');
assert.strictEqual(parseDialectGlossary('a,b\nc,d').report.delimiter, 'comma', 'CSV detected');
console.log('  delimiter detection (tab/pipe/equals/comma): OK');

console.log('unit-dialect-glossary: ALL PASSED');
