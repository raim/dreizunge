// unit-vocab-articles.test.js
// v71_d: a vocab pair must carry an article on BOTH sides or NEITHER.
//
// User-reported against storyline sl_15116115 (Italian from German, 8 chapters generated from one
// PDF): "we still get a lot of lessons with articles in one language but not the other… some
// lessons have this problem, while others don't."
//
// The fixture is that storyline's ACTUAL vocab, exported from the user's lessons.json — 64 items,
// 42 of them asymmetric. Measured shape, which is what the fix is calibrated against:
//   ch1 8/8 asymmetric   ch2 6/8   ch3 7/8   ch4 0/8 (articles on BOTH sides)
//   ch5 0/8 (neither)    ch6 8/8   ch7 8/8   ch8 5/8
// Never once the other way round — 0 items had an Italian article without a German one.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function extract(name) {
  const at = server.indexOf('function ' + name + '(');
  assert.ok(at > -1, `server.js defines ${name}()`);
  const b = server.indexOf('{', at); let d = 0, i = b;
  for (; i < server.length; i++) { if (server[i] === '{') d++; else if (server[i] === '}') { d--; if (!d) { i++; break; } } }
  return server.slice(at, i);
}
const tables = server.match(/const VOCAB_ARTICLES = \{[\s\S]*?\};[\s\S]*?const VOCAB_ELISIONS = \{[^\n]*\};/);
assert.ok(tables, 'the article tables are module-level constants');
const M = new Function(tables[0] + '\n' + extract('splitArticle') + extract('normalizeVocabArticles') +
  '\nreturn { VOCAB_ARTICLES, splitArticle, normalizeVocabArticles };')();

const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'vocab-articles-sl15116115.json'), 'utf8'));
const asym = (v, lang, src) => v.filter(x =>
  !!M.splitArticle(x.target, lang).article !== !!M.splitArticle(x.source, src).article).length;

// ── 1. The reported storyline, before ────────────────────────────────────────
// Pins the measurement the fix is built on. If the detector stops seeing the problem, this fails
// before anything else does.
{
  const all = FIX.chapters.flatMap(c => c.vocab);
  assert.strictEqual(all.length, 64, 'the fixture is the whole storyline');
  assert.strictEqual(asym(all, FIX.lang, FIX.srcLang), 42, '42 of 64 items were asymmetric as reported');
  // Direction: always the source (German) carrying the article.
  const reversed = all.filter(x => M.splitArticle(x.target, FIX.lang).article &&
                                  !M.splitArticle(x.source, FIX.srcLang).article);
  assert.strictEqual(reversed.length, 0, 'never once the other way round');
  // Per-chapter, which is the evidence that the model decides per CALL, not per item.
  const per = FIX.chapters.map(c => asym(c.vocab, FIX.lang, FIX.srcLang));
  assert.deepStrictEqual(per, [8, 6, 7, 0, 0, 8, 8, 5], 'the per-chapter split is all-or-nothing, not scattered');
  console.log(`  reported storyline: 42/64 asymmetric, per chapter ${per.join(',')}`);
}

// ── 2. …and after ────────────────────────────────────────────────────────────
{
  const all = FIX.chapters.flatMap(c => c.vocab.map(v => ({ ...v })));
  const changed = M.normalizeVocabArticles(all, FIX.lang, FIX.srcLang);
  assert.strictEqual(changed.length, 42, 'every asymmetric item was touched');
  assert.strictEqual(asym(all, FIX.lang, FIX.srcLang), 0, 'and none is left asymmetric');
  // The specific pair the user quoted.
  const teoria = all.find(v => v.target === 'teoria');
  assert.strictEqual(teoria.source, 'Theorie', '"teoria" / "die Theorie" -> "teoria" / "Theorie"');
  // Chapters that were already consistent must be left completely alone.
  const ch4 = FIX.chapters[3].vocab.map(v => ({ ...v }));
  assert.strictEqual(M.normalizeVocabArticles(ch4, FIX.lang, FIX.srcLang).length, 0,
    'chapter 4 had articles on both sides and is not touched');
  assert.strictEqual(ch4[1].target, 'la base', 'its target article survives');
  assert.strictEqual(ch4[1].source, 'die Grundlage', 'and so does its source article');
  const ch5 = FIX.chapters[4].vocab.map(v => ({ ...v }));
  assert.strictEqual(M.normalizeVocabArticles(ch5, FIX.lang, FIX.srcLang).length, 0,
    'chapter 5 had articles on neither side and is not touched');
}

// ── 3. Only the lone article goes — never the word ──────────────────────────
{
  const one = (t, s, lang, src) => { const v = [{ target: t, source: s }]; M.normalizeVocabArticles(v, lang, src); return v[0]; };
  assert.deepStrictEqual(one('teoria', 'die Theorie', 'it', 'de'), { target: 'teoria', source: 'Theorie' });
  assert.deepStrictEqual(one('la teoria', 'Theorie', 'it', 'de'), { target: 'teoria', source: 'Theorie' },
    'the target side is stripped when it is the one carrying the article');
  assert.deepStrictEqual(one('la teoria', 'die Theorie', 'it', 'de'), { target: 'la teoria', source: 'die Theorie' },
    'a consistent pair is untouched');
  assert.deepStrictEqual(one('conoscere', 'kennen', 'it', 'de'), { target: 'conoscere', source: 'kennen' },
    'a verb pair has no articles and is untouched');
}

// ── 4. Elided articles (the case a space-split misses) ──────────────────────
{
  assert.strictEqual(M.splitArticle("l'evoluzione", 'it').text, 'evoluzione', "l'evoluzione -> evoluzione");
  assert.strictEqual(M.splitArticle("l'evoluzione", 'it').article, "l'", 'and the article is reported');
  assert.strictEqual(M.splitArticle("un'idea", 'it').text, 'idea', "un'idea -> idea");
  assert.strictEqual(M.splitArticle("l’acqua", 'it').text, 'acqua', 'a typographic apostrophe works too');
  assert.strictEqual(M.splitArticle("l'eau", 'fr').text, 'eau', 'French elision');
}

// ── 5. A single token is the word, never an article ────────────────────────
// "die" is a German article AND an English verb; "la" is Italian for "the" and a musical note.
// Stripping a lone token would delete the vocab item itself.
{
  assert.strictEqual(M.splitArticle('die', 'de').article, '', 'a bare "die" is the word, not an article');
  assert.strictEqual(M.splitArticle('la', 'it').article, '', 'nor is a bare "la"');
  const v = [{ target: 'la', source: 'die' }];
  M.normalizeVocabArticles(v, 'it', 'de');
  assert.deepStrictEqual(v[0], { target: 'la', source: 'die' }, 'so neither item is destroyed');
}

// ── 6. Arabic is deliberately absent from the table ────────────────────────
// ال- is a bound prefix, not a separate word. Stripping it would corrupt the word.
{
  assert.ok(!M.VOCAB_ARTICLES.ar, 'Arabic has no article table');
  assert.strictEqual(M.splitArticle('الكتاب', 'ar').text, 'الكتاب', 'the Arabic definite prefix is never removed');
  // A language with no table counts as article-less, matching the prompt's own rule.
  const v = [{ target: '本', source: 'das Buch' }];
  M.normalizeVocabArticles(v, 'ja', 'de');
  assert.strictEqual(v[0].source, 'Buch', 'a German article is dropped opposite an article-less language');
}

// ── 7. It is wired into the lesson pipeline ────────────────────────────────
{
  assert.ok(/normalizeVocabArticles\(lesson\.vocab, lang, srcLang\)/.test(server),
    'every generation path normalises before the lesson is accepted');
  assert.ok(/article symmetry: fixed/.test(server), 'and reports what it changed');
}

console.log('unit-vocab-articles: ALL PASSED');
