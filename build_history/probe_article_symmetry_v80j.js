// probe_article_symmetry_v80j.js — PLAN §F3 / §F3c, the article mess.
//
// The defect: vocab pairs where one side carries the article and the other does not
// (`der Hund` <-> `chien`). §F3 diagnoses it as a rule-31 case — `prompts.json` `vocab.system`
// states BASE FORM ONLY *"(with the usual article where the language uses one)"*, which is PER-SIDE
// and appeals to each language's own citation convention, and then ARTICLE SYMMETRY, which is
// CROSS-SIDE. For German/French they cannot both hold: German cites `der Hund`, French cites bare
// `chien`. §F3c measured the result as a COIN FLIP — 7/8 asymmetric in one chapter, 0/8 in the next,
// same model, four minutes apart — from which it follows that ONE LESSON CAN NEVER VALIDATE A FIX.
//
// This probe exists so that a fix can be judged against the CORPUS instead. It is the before-number.
//
// ⚠️ MEASURING INSTRUMENT FOR A HUMAN, NOT A VALIDATOR, and unusually so: unlike the structural
// detectors shipped at v80_g/v80_h, this one CANNOT be language-blind — "is this an article" is a
// language fact. The article lists below are hand-written and live in this probe ONLY. They must
// never migrate into server.js or index.html, where the standing rule is that no language knowledge
// lives in the code.
//
// Consequences of that, stated rather than hidden:
//   • Only language pairs where BOTH sides have articles are counted. Serbian, Croatian, Polish and
//     Japanese have none, so a "missing" article there is CORRECT and counting it would invent a
//     defect. Those pairs are excluded and reported as excluded.
//   • Arabic and Hebrew mark definiteness with a PREFIX, not a separate word. They are excluded too
//     rather than guessed at.
//   • A noun is not distinguished from a verb or adjective. A pair like `laufen` <-> `courir` has no
//     article on either side and counts as SYMMETRIC, which is right; but a genuine one-sided
//     adjective would not be caught. The number is therefore a floor for nouns, not a total.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));

// Definite and indefinite articles, as separate leading words. Hand-written; see the header.
const ART = {
  de: ['der', 'die', 'das', 'ein', 'eine', 'einen', 'einem', 'einer', 'des', 'dem', 'den'],
  en: ['the', 'a', 'an'],
  fr: ['le', 'la', 'les', "l'", 'un', 'une', 'des', 'du', 'de la'],
  it: ['il', 'lo', 'la', 'i', 'gli', 'le', "l'", 'un', 'uno', 'una', "un'"],
  es: ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'],
  pt: ['o', 'a', 'os', 'as', 'um', 'uma'],
  nl: ['de', 'het', 'een'],
  lb: ['den', 'déi', 'd\'', 'e', 'en', 'eng', 'engem'],
};
// Languages with NO article system — a bare noun is correct, not a defect.
const NO_ARTICLE = new Set(['sr', 'hr', 'pl', 'ja', 'zh', 'sw', 'fi', 'et', 'lv', 'lt', 'ru', 'uk', 'cs', 'sk']);
// Prefixing languages — definiteness is not a leading word; not guessed at.
const PREFIX_ART = new Set(['ar', 'he', 'fa']);

const norm = s => String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
function hasArticle(text, lang) {
  const arts = ART[lang];
  if (!arts) return null;
  const t = norm(text);
  if (!t) return null;
  for (const a of arts) {
    if (a.endsWith("'")) { if (t.startsWith(a)) return true; }
    else if (t.startsWith(a + ' ')) return true;
  }
  return false;
}

let pairsSeen = 0, counted = 0, asym = 0;
const excluded = {};
const byLangPair = {};
const byChapter = [];
const samples = [];

for (const t of store.topics) {
  const tl = t.lang, sl = t.srcLang;
  let chCounted = 0, chAsym = 0;
  for (const L of (t.lessons || [])) {
    if (!L || L._hidden || !Array.isArray(L.vocab)) continue;
    for (const v of L.vocab) {
      if (!v || !v.target || !v.source) continue;
      pairsSeen++;
      const skip = NO_ARTICLE.has(tl) || NO_ARTICLE.has(sl) ? 'no-article-language'
                 : PREFIX_ART.has(tl) || PREFIX_ART.has(sl) ? 'prefix-article-language'
                 : (!ART[tl] || !ART[sl]) ? 'article-list-not-written'
                 : null;
      if (skip) { excluded[skip] = (excluded[skip] || 0) + 1; continue; }
      const a = hasArticle(v.target, tl), b = hasArticle(v.source, sl);
      if (a === null || b === null) continue;
      counted++; chCounted++;
      const key = sl + '->' + tl;
      const R = (byLangPair[key] = byLangPair[key] || { n: 0, asym: 0 });
      R.n++;
      if (a !== b) {
        asym++; chAsym++; R.asym++;
        if (samples.length < 10) samples.push(`${key}  ${JSON.stringify(v.source)} <-> ${JSON.stringify(v.target)}`);
      }
    }
  }
  if (chCounted) byChapter.push({ id: t.id, topic: t.topic, pair: sl + '->' + tl, n: chCounted, asym: chAsym });
}

const pc = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
console.log('PLAN §F3 — vocab article symmetry, corpus-wide\n');
console.log(`vocab pairs seen        : ${pairsSeen}`);
console.log(`pairs COUNTED           : ${counted}   (both languages have word articles)`);
console.log(`ASYMMETRIC              : ${asym}   ${pc(asym, counted)}\n`);
console.log('excluded, and why:');
Object.entries(excluded).sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k.padEnd(26)} ${String(v).padStart(5)}`));

console.log('\nby language pair:');
Object.entries(byLangPair).sort((a, b) => b[1].n - a[1].n).slice(0, 10)
  .forEach(([k, v]) => console.log(`  ${k.padEnd(10)} n=${String(v.n).padStart(5)}   asymmetric ${String(v.asym).padStart(4)}  ${pc(v.asym, v.n)}`));

// §F3c's claim is that the outcome is UNSTABLE per lesson, not a constant bias. The distribution of
// per-chapter rates is what shows that: a constant bias gives a clump, a coin flip gives the ends.
const bands = { 'all symmetric (0%)': 0, 'partial (1-49%)': 0, 'majority (50-99%)': 0, 'all asymmetric (100%)': 0 };
for (const c of byChapter) {
  const r = c.asym / c.n;
  if (r === 0) bands['all symmetric (0%)']++;
  else if (r < 0.5) bands['partial (1-49%)']++;
  else if (r < 1) bands['majority (50-99%)']++;
  else bands['all asymmetric (100%)']++;
}
console.log('\nper-chapter distribution — §F3c predicts the ENDS, not the middle:');
Object.entries(bands).forEach(([k, v]) => console.log(`  ${k.padEnd(24)} ${String(v).padStart(4)} chapters`));

console.log('\nthe two chapters §F3c named:');
for (const id of ['tp_17869977371640000022', 'tp_17869980065780000104']) {
  const c = byChapter.find(x => x.id === id);
  console.log('  ' + id + '  ' + (c ? `${c.topic}: ${c.asym} of ${c.n} asymmetric (${pc(c.asym, c.n)})` : '(no countable pairs)'));
}

console.log('\nworst chapters:');
byChapter.filter(c => c.n >= 4).sort((a, b) => (b.asym / b.n) - (a.asym / a.n) || b.n - a.n).slice(0, 8)
  .forEach(c => console.log(`  ${String(c.asym).padStart(3)}/${String(c.n).padEnd(3)} ${c.pair.padEnd(8)} ${c.topic}`));

console.log('\nsamples:');
samples.forEach(s => console.log('  ' + s));
console.log('\n(reported, not asserted — and NOT language-blind; see the header)');
