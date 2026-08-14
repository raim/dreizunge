// probe_word_forms_v79i.js
//
// RESULTS SO FAR — two cuts, and NEITHER is a post-fix measurement:
//
//   Aug 13 drop (321 topics)   47 English two-choice items,  8 tense pairs (17%)
//   Aug 14 drop (321 topics)   46 English two-choice items,  7 tense pairs (15%)
//
// The Aug 14 movement is NOT evidence about the prompt change. `tp_872660509`'s word-forms lesson
// still carries its original `_genMeta.at` (2026-08-12T12:25:21), i.e. it was never regenerated —
// one item ("moved"/"move") was removed by hand between the drops. The prompt written in `v79_i`
// has not yet met a model. **The first meaningful diff is a run AFTER regenerating a word_forms
// lesson with the live model.**
//
// Corpus-wide at the Aug 14 drop: 72 word_forms lessons, 324 items, across 9 target languages.
//
// WHAT THIS MEASURES, AND WHAT IT DOES NOT. It counts the one subclass of the reported defect that
// is mechanically detectable without the app knowing any grammar: an ENGLISH-target item whose two
// choices are a present/past (or participle/past) pair of the same verb. Such a pair is almost
// never decided by an isolated sentence, which is the user's complaint. It is a FLOOR, not the
// rate: an item can be undecidable for reasons this cannot see (gender, aspect, register), and in
// the other eight target languages it sees nothing at all.
//
// It is deliberately NOT a validator in the product. Deciding "is this German pair decidable in
// this sentence" is language knowledge, and the standing principle is that the app does not encode
// per-language grammar — the model does. This file is a MEASURING instrument for a human, run
// before and after a prompt change, and that is the only role it should ever have.
//
// Re-run after regenerating word_forms lessons with a live model and DIFF against the numbers
// above. A drop in the flagged share is the evidence that v79_i's prompt change worked; the guard
// `unit-word-forms-decidable` can only show that the instruction reaches the prompt.
// detectable without language knowledge: English-target items whose two choices are a
// present/past pair of the same verb, which an isolated sentence almost never decides.
// English only — the check keys on English morphology and must not pretend to judge the others.
const L = require('../lessons.json');
const isPastPair = (a, b) => {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()];
  const pairs = [['is','was'],['are','were'],['am','was'],['has','had'],['does','did'],['can','could'],['will','would']];
  if (pairs.some(([p,q]) => (x===p&&y===q)||(x===q&&y===p))) return true;
  // regular: base vs base+ed / base+d
  const ed = (s) => s + (s.endsWith('e') ? 'd' : 'ed');
  if (ed(x) === y || ed(y) === x) return true;
  // -ing vs -ed on the same stem
  const stem = s => s.replace(/(ing|ed)$/, '');
  if (/(ing)$/.test(x) && /(ed)$/.test(y) && stem(x) === stem(y)) return true;
  if (/(ing)$/.test(y) && /(ed)$/.test(x) && stem(x) === stem(y)) return true;
  return false;
};
let en = 0, flagged = 0; const examples = [];
for (const t of L.topics) {
  if (t.lang !== 'en') continue;
  for (const l of (t.lessons || [])) {
    if (!l || l.type !== 'word_forms') continue;
    for (const it of (l.items || [])) {
      const ch = it.choices || [];
      if (ch.length !== 2) continue;
      en++;
      if (isPastPair(ch[0], ch[1])) {
        flagged++;
        if (examples.length < 8) examples.push(`${t.id}  ${JSON.stringify(ch)}  ${String(it.sentence).slice(0, 62)}`);
      }
    }
  }
}
console.log(`English-target two-choice word_forms items : ${en}`);
console.log(`  of those, a tense pair of the same verb  : ${flagged}  (${(100*flagged/en).toFixed(0)}%)`);
console.log('samples:'); examples.forEach(e => console.log('  ' + e));
