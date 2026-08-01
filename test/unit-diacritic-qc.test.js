// unit-diacritic-qc.test.js
// v72: flag a word written WITHOUT its diacritics where the corpus contains the accented form.
//
// Roadmap item, filed as "missing umlaut" against the user's pre-edit export: `naturliche` where
// `natürliche` was meant, which SURVIVED hand-editing — the argument for automating it.
//
// Two things changed on contact with the data, and both are the point of this file:
//
// 1. **It is a DIACRITIC check, not an umlaut check.** Framing it as German would smuggle in the
//    language knowledge the session-23 principle forbids, and would miss the identical defect in
//    `é`, `ñ`, `ç`, `å`, `ø`. Nothing in the implementation knows what language it is looking at:
//    it compares corpus forms against each other (tier 2 in INTERNALS.md) using Unicode
//    normalisation only (explicitly on the permitted side of the principle).
//
// 2. **The scan is a candidate GENERATOR, not a verdict.** Measured on the shipped corpus it
//    produces 5 candidates, most of which are MINIMAL PAIRS — real, distinct words differing only
//    by a diacritic (`souffle` breath / `soufflé` the dish; `inizio` beginning / `iniziò` he began).
//    Telling those apart requires knowing the language, so a model adjudicates each candidate.
//    The roadmap's original capitalisation rule (`Zahlen` / `zählen`) only works because German
//    capitalises nouns — a German fact in disguise. It is kept as a free pre-filter, not as the
//    decision.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));

// Extract the pure functions (no server boot needed — they take no globals).
function ext(name) {
  const at = server.indexOf('function ' + name);
  assert.ok(at > -1, `server.js defines ${name}`);
  const b = server.indexOf('{', at);
  let d = 0, i = b;
  for (; i < server.length; i++) { if (server[i] === '{') d++; else if (server[i] === '}') { d--; if (!d) break; } }
  return server.slice(at, i + 1);
}
const M = {};
new Function('module', 'exports',
  ext('_stripDiacriticsCase') +
  '\nconst _hasDiacritic = (s) => _stripDiacriticsCase(s) !== String(s == null ? "" : s).trim();\n' +
  ext('buildDiacriticIndex') + '\n' + ext('checkDiacritics') +
  '\nmodule.exports = { _stripDiacriticsCase, buildDiacriticIndex, checkDiacritics };'
)(M, M.exports = {});
const { _stripDiacriticsCase, buildDiacriticIndex, checkDiacritics } = M.exports;

// ── 1. Stripping is Unicode-mechanical and CASE-PRESERVING ─────────────────
{
  assert.strictEqual(_stripDiacriticsCase('natürliche'), 'naturliche', 'combining marks dropped');
  assert.strictEqual(_stripDiacriticsCase('soufflé'), 'souffle', 'acute dropped');
  assert.strictEqual(_stripDiacriticsCase('mañana'), 'manana', 'tilde dropped');
  assert.strictEqual(_stripDiacriticsCase('Straße'), 'Strasse', 'ß folds, case kept');
  assert.strictEqual(_stripDiacriticsCase('Ærø'), 'AEro', 'distinct-codepoint letters fold, case kept');
  // Case preservation is load-bearing — see §3.
  assert.strictEqual(_stripDiacriticsCase('Zahlen'), 'Zahlen', 'case is NOT folded');
  assert.notStrictEqual(_stripDiacriticsCase('Zahlen'), _stripDiacriticsCase('zählen'),
    'so a capitalised noun and a lowercase verb never collide');
}

// ── 2. It finds the reported defect ────────────────────────────────────────
{
  const topics = [{ lang: 'de', srcLang: 'en', lessons: [{ vocab: [
    { target: 'natürliche', source: 'natural' },
    { target: 'naturliche', source: 'natural (typo)' },
  ] }] }];
  const idx = buildDiacriticIndex(topics);
  const r = checkDiacritics('naturliche', 'de', idx);
  assert.strictEqual(r.ok, false, 'the unaccented spelling is a candidate');
  assert.strictEqual(r.sug, 'natürliche', 'and the accented corpus form is suggested');
  // The accented form itself is never a candidate.
  assert.strictEqual(checkDiacritics('natürliche', 'de', idx).ok, true, 'the correct form is left alone');
  // Language-scoped: an accented form in ANOTHER language must not seed a suggestion.
  assert.strictEqual(checkDiacritics('naturliche', 'it', idx).ok, true,
    'the index is keyed by language — a French accent cannot flag an English word');
}

// ── 3. The capitalisation pre-filter, and its limit ────────────────────────
{
  const topics = [{ lang: 'de', srcLang: 'en', lessons: [{ vocab: [
    { target: 'zählen', source: 'to count' },
    { target: 'Zahlen', source: 'numbers' },
  ] }] }];
  const idx = buildDiacriticIndex(topics);
  assert.strictEqual(checkDiacritics('Zahlen', 'de', idx).ok, true,
    'Zahlen is not reported as a typo for zählen — the case rule suppresses it for free');
  // …but the same class of pair in a language WITHOUT that convention is not suppressed, which is
  // precisely why a model has to adjudicate. Pinned so nobody mistakes the pre-filter for a fix.
  const it = buildDiacriticIndex([{ lang: 'it', srcLang: 'en', lessons: [{ vocab: [
    { target: 'iniziò', source: 'he began' } ] }] }]);
  const minimal = checkDiacritics('inizio', 'it', it);
  assert.strictEqual(minimal.ok, false,
    'a lowercase minimal pair IS still a candidate — the case rule cannot help here');
  assert.strictEqual(minimal.sug, 'iniziò');
}

// ── 4. Multi-word fields and empties are skipped ───────────────────────────
{
  const idx = buildDiacriticIndex([{ lang: 'fr', srcLang: 'en', lessons: [{ vocab: [
    { target: 'soufflé', source: 'souffle' } ] }] }]);
  assert.strictEqual(checkDiacritics('le souffle chaud', 'fr', idx).ok, true,
    'phrases are skipped — per-token checking needs tokenisation rules that vary by language');
  assert.strictEqual(checkDiacritics('', 'fr', idx).ok, true, 'empty is fine');
  assert.strictEqual(checkDiacritics(null, 'fr', idx).ok, true, 'null is fine');
}

// ── 5. The model adjudicates; the scan does not decide ─────────────────────
// The whole design rests on this. If a future edit flags candidates directly, precision on the
// shipped corpus drops to roughly 1 in 5 and the flag UI stops being worth reading.
{
  assert.ok(/async function qcCheckDiacriticCandidate\(word, suggestion, lang\)/.test(server),
    'candidates are adjudicated by a model');
  const fn = server.slice(server.indexOf('async function qcCheckDiacriticCandidate'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.ok(/MISSPELLING of/.test(body) && /DIFFERENT, correctly/.test(body),
    'and the question put to it is typo-vs-distinct-word');
  assert.ok(/if \(!\/\^FIX\/\.test\(reply\)\) return \{ ok: true \};/.test(body),
    'anything unclear defaults to OK — a false flag costs more than a missed typo');
  // The QC run must call the adjudicator, not the scan's verdict.
  assert.ok(/const v = await qcCheckDiacriticCandidate\(String\(word\)\.trim\(\), c\.sug, lg\);/.test(server),
    'the QC run adjudicates each candidate');
  assert.ok(/'diacritic', QC_DIACRITIC_BY\)/.test(server),
    'and files findings under their own checker identity, beside the model verdicts');
  assert.ok(/const QC_DIACRITIC_BY = 'diacritics';/.test(server), 'that identity is named');
}

// ── 6. Corpus reality check ────────────────────────────────────────────────
// Both originally-reported defects are already hand-fixed, so this rule's value now is preventing
// their RETURN, not cleaning up. Recorded as a number so a future session knows what to expect
// rather than assuming the check is broken when it finds almost nothing.
{
  const idx = buildDiacriticIndex(store.topics);
  assert.ok(idx.size > 100, `the corpus has accented forms to compare against (${idx.size})`);
  let candidates = 0;
  for (const tp of store.topics) {
    for (const ls of (tp.lessons || [])) {
      for (const key of ['vocab', 'sentences', 'grammar']) {
        for (const it of (ls[key] || [])) {
          if (!it) continue;
          if (!checkDiacritics(it.target, tp.lang, idx).ok) candidates++;
          if (!checkDiacritics(it.source, tp.srcLang, idx).ok) candidates++;
        }
      }
    }
  }
  assert.ok(candidates < 30,
    `the scan stays a short list for a model to adjudicate, not a flood (${candidates})`);
  // The originally-reported spellings must not be present — if one comes back, the check earns
  // its keep and this assertion is the alarm.
  const flat = JSON.stringify(store.topics);
  assert.ok(!/"naturliche/.test(flat), 'the reported `naturliche` is still fixed');
  assert.ok(!/symbiosi"/.test(flat), 'and the reported `symbiosi` is still fixed');
  console.log(`  corpus: ${idx.size} accented forms indexed, ${candidates} candidate(s) for the model`);
}

// ── 7. Parity with the client's normDiacritics ─────────────────────────────
// The client folds the same distinct-codepoint letters for forgiving answer scoring. They differ
// ONLY in case handling, deliberately; if one grows a fold the other lacks, they disagree about
// what counts as the same word.
{
  const at = client.indexOf('function normDiacritics(s){');
  assert.ok(at > -1, 'the client still has normDiacritics');
  const clientFn = client.slice(at, client.indexOf('\n}', at));
  for (const ch of ['ß', 'æ', 'œ', 'ø']) {
    assert.ok(clientFn.includes(ch), `client folds ${ch}`);
    assert.ok(server.slice(server.indexOf('function _stripDiacriticsCase')).slice(0, 600).includes(ch),
      `server folds ${ch} too — otherwise the two disagree about identical words`);
  }
  assert.ok(/normalize\('NFD'\)/.test(clientFn), 'client NFD-normalises');
  console.log('  parity: server and client fold the same distinct-codepoint letters');
}

console.log('unit-diacritic-qc: ALL PASSED');
