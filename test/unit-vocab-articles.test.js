// unit-vocab-articles.test.js
// v71_d: a vocab pair must carry an article on BOTH sides or NEITHER.
//
// User-reported against storyline sl_15116115 (Italian from German, 8 chapters generated from one
// PDF): "we still get a lot of lessons with articles in one language but not the other… some
// lessons have this problem, while others don't."
//
// The fixture is that storyline's ACTUAL vocab, exported from the user's lessons.json — 64 items,
// 42 of them asymmetric. Measured shape, which the whole approach is calibrated against:
//   ch1 8/8 asymmetric   ch2 6/8   ch3 7/8   ch4 0/8 (articles on BOTH sides)
//   ch5 0/8 (neither)    ch6 8/8   ch7 8/8   ch8 5/8
// Never once the other way round — 0 items had an Italian article without a German one.
//
// ── v71_y: REWRITTEN. The defect is unchanged; the mechanism is not. ────────────────────────────
// v71_d fixed this with `normalizeVocabArticles`, a deterministic rewriter holding article lists
// for 12 languages. Session 23 established that the code must not encode language knowledge, and
// the rewriter turned out to be actively harmful as well as in breach: it could only ever STRIP,
// so `la grandine` / `hail` became `grandine` / `hail`, dropping the gender an Italian learner
// needs while symmetric siblings in the same lesson kept theirs.
//
// Article symmetry is now checked in the QC pass, which (a) sees the lesson's other pairs and can
// therefore follow its convention, (b) can fix EITHER side, and (c) proposes rather than rewrites,
// so a wrong call lands in the flag UI instead of silently in the data.
//
// What this file can and cannot prove: the wiring is checkable here; whether the model actually
// catches an asymmetric pair is a judgement that needs a live QC run against a real backend, and
// is on the owed list. Section 1 keeps the original measurement so the defect's shape stays on
// record either way.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const PROMPTS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'prompts.json'), 'utf8'));
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'vocab-articles-sl15116115.json'), 'utf8'));

// ── 1. The reported storyline: the measurement, preserved ────────────────────
// This detector is TEST-LOCAL and stays that way. It is not a breach of the no-language-knowledge
// principle: it measures a fixed, known dataset to keep a bug report on record — it never runs
// against user data and never decides what the app produces. The moment such a table decides
// content, it belongs to the model instead. (Two attempts at writing one during session 23 were
// both wrong, which is the argument in miniature.)
const DE_ART = /^(der|die|das|ein|eine)\s+/i;
const IT_ART = /^(il|lo|la|i|gli|le|un|uno|una)\s+|^(l|un)['’]/i;
const hasArt = (w, re) => re.test(String(w || '').trim());
{
  const all = FIX.chapters.flatMap(c => c.vocab);
  assert.strictEqual(all.length, 64, 'the fixture is the whole storyline');
  const asym = all.filter(x => hasArt(x.target, IT_ART) !== hasArt(x.source, DE_ART));
  assert.strictEqual(asym.length, 42, '42 of 64 items were asymmetric as reported');
  const reversed = all.filter(x => hasArt(x.target, IT_ART) && !hasArt(x.source, DE_ART));
  assert.strictEqual(reversed.length, 0, 'never once the other way round');
  // Per-chapter, which is the evidence that the model decides per CALL, not per item — and the
  // reason a per-item deterministic rule was the wrong shape from the start.
  const per = FIX.chapters.map(c => c.vocab.filter(x => hasArt(x.target, IT_ART) !== hasArt(x.source, DE_ART)).length);
  assert.deepStrictEqual(per, [8, 6, 7, 0, 0, 8, 8, 5], 'the per-chapter split is all-or-nothing, not scattered');
  console.log(`  reported storyline: 42/64 asymmetric, per chapter ${per.join(',')}`);
}

// ── 2. The deterministic rewriter is gone ───────────────────────────────────
{
  for (const name of ['VOCAB_ARTICLES', 'VOCAB_ELISIONS', 'splitArticle', 'normalizeVocabArticles']) {
    assert.ok(!new RegExp(`(const|function)\\s+${name}\\b`).test(server),
      `${name} is gone — it encoded language knowledge and could only ever strip`);
  }
  assert.ok(!/article symmetry: fixed/.test(server),
    'and nothing rewrites vocab articles at generation time any more');
}

// ── 3. QC checks article symmetry, with the lesson as context ───────────────
{
  const at = server.indexOf('async function qcCheckPair(');
  assert.ok(at > -1, 'qcCheckPair exists');
  const fn = server.slice(at, server.indexOf('\n}', at));
  assert.ok(/ARTICLE SYMMETRY/.test(fn), 'the pair check covers article symmetry');
  assert.ok(/siblings/.test(fn), 'and receives the lesson\'s other pairs');
  // Convention must be SHOWN, not asserted: telling the model "Italian uses articles" would be the
  // language knowledge just removed, wearing a different hat.
  assert.ok(/do NOT correct them/.test(fn),
    'the siblings are context only, so QC does not cascade into rewriting the whole lesson');
  // It must be able to fix either side — the thing the stripper could not do.
  assert.ok(/add the missing article, or remove the lone one/.test(fn),
    'and may fix EITHER side, not only strip');
  // Bound prefixes (Arabic ال) are not lone articles. Previously handled by omitting Arabic from a
  // table; now stated as a general property, so it holds for languages nobody listed.
  assert.ok(/attached\s+`? ?\n?\s*`?prefix or suffix/.test(fn) || /prefix or suffix/.test(fn),
    'a bound definiteness marker is explicitly not a lone article');
  // The call site must actually pass the siblings, or the context arrives empty.
  assert.ok(/qcCheckPair\(item\.target, item\.source, tp\.lang, tp\.srcLang, item\.userFlag\?\.comment, arr\)/.test(server),
    'the vocab QC call site passes the lesson\'s items as context');
}

// ── 4. Generation still forbids a one-sided article ─────────────────────────
// QC is the safety net, not the only defence: the prompt asking for symmetric pairs in the first
// place is why the defect is rare enough for a proposing check to be the right shape.
{
  for (const key of ['vocab', 'vocabFromText', 'vocabTable']) {
    assert.ok(/ARTICLE SYMMETRY/.test(JSON.stringify(PROMPTS[key])),
      `PROMPTS.${key} still requires article symmetry at generation time`);
  }
  console.log('  generation prompts still require symmetry; QC proposes fixes for what slips through');
}

console.log('unit-vocab-articles: ALL PASSED');
