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
// Row count: fixture now CLEAN (the PDF collided row was corrected into two rows in the source).
assert.strictEqual(rows.length, 86, 'parses all data rows, got ' + rows.length);
assert.strictEqual(report.suspicious.length, 0, 'clean fixture has no suspicious rows');
console.log('  parses real "=" glossary; title + CC license skipped; 86 clean rows: OK');

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

// ── 3) Collided rows are SURFACED, never auto-split (synthetic — the real PDF artifact,
//        now corrected in the source/fixture, is reproduced here to keep the guarantee tested) ──
const collided = parseDialectGlossary('Mangale = Männchen, kleiner MannFock = Schwein');
assert.strictEqual(collided.rows.length, 1, 'a glued line stays ONE row (importer does not invent a split)');
assert.strictEqual(collided.rows[0].source, 'Männchen, kleiner MannFock = Schwein',
  'glued row kept verbatim');
assert.ok(!collided.rows.some(r => r.target === 'Fock'), 'the glued "Fock" is NOT auto-extracted');
assert.ok(collided.report.suspicious.some(s => /glued/.test(s.reason)),
  'the collided row is flagged as suspicious for the human to fix');
// And once the human fixes it (as the fixture now is), the two rows parse cleanly, no flag.
const fock = rows.find(r => r.target === 'Fock');
assert.ok(fock && fock.source === 'Schwein', 'corrected fixture: Fock = Schwein is its own clean row');
const mangale2 = rows.find(r => r.target === 'Mangale');
assert.strictEqual(mangale2.source, 'Männchen, kleiner Mann', 'corrected fixture: Mangale row clean');
console.log('  collided row surfaced-not-split (synthetic); corrected rows parse clean: OK');

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

// ── 7) buildDialectTopic: rows → a valid, playable dialect topic (no LLM) ─────
const { buildDialectTopic } = require('../dialect-glossary.js');
const topic = buildDialectTopic(rows,
  { label: 'Osttirol', base: 'de', source: 'de', note: 'East Tyrol',
    attribution: 'Bernd Kranebitter — Dialekt Wörterbuch Osttirol (CC BY-NC)' },
  { perLesson: 12 });
// Topic shape: dialect is a variety of the base language (lang === srcLang === de).
assert.strictEqual(topic.lang, 'de', 'dialect topic lang is the base language (de)');
assert.strictEqual(topic.srcLang, 'de', 'dialect topic source is High German (de)');
assert.ok(topic.id && /^tp_/.test(topic.id), 'topic has a tp_ id');
assert.strictEqual(topic.topic, 'Osttirol', 'topic label');
// Chunking: 86 rows / 12 per lesson = 8 lessons (last partial); no row lost.
assert.strictEqual(topic.lessons.length, 8, 'rows chunked into vocab lessons');
const totalVocab = topic.lessons.reduce((a, l) => a + l.vocab.length, 0);
assert.strictEqual(totalVocab, rows.length, 'every row becomes exactly one vocab item (none lost)');
assert.ok(topic.lessons.every(l => l.type === 'standard'), 'dialect lessons are standard vocab lessons');
assert.ok(topic.lessons.every(l => l._dialect === true), 'each lesson marked _dialect');
assert.ok(topic.lessons.every(l => l.vocab.every(v => v._dialect === true)), 'each vocab item marked _dialect');
// Order preserved (author order, no reshuffle): first item is the first row.
assert.strictEqual(topic.lessons[0].vocab[0].target, rows[0].target, 'file order preserved');
// Attribution + metadata ride on the topic (never sent to a model).
assert.ok(/Kranebitter/.test(topic._dialect.attribution), 'attribution stored on the topic');
assert.strictEqual(topic._dialect.rowCount, rows.length, 'row count recorded');
assert.strictEqual(topic._dialect.base, 'de', 'base language recorded');
// Caller-supplied id is honoured (real tp_ id from the app).
const withId = buildDialectTopic(rows.slice(0, 3), { label: 'X' }, { id: 'tp_123', perLesson: 12 });
assert.strictEqual(withId.id, 'tp_123', 'caller-supplied id used');
// Empty input still yields a valid (empty) topic, not a crash.
const empty = buildDialectTopic([], { label: 'Empty' }, {});
assert.strictEqual(empty.lessons.length, 1, 'empty material → one empty lesson (valid topic)');
console.log('  buildDialectTopic: valid topic, _dialect markers, attribution, order, no row lost: OK');

console.log('unit-dialect-glossary: ALL PASSED');
