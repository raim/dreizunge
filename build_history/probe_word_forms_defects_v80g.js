// probe_word_forms_defects_v80g.js — PLAN §F2, the malformed word-forms items.
//
// The user's report: `tp_586040741` has items where the blank is appended at the END of a finished
// sentence and the answer is still visible inside it — `"...across the path.___"` with answer
// `cast`, while the sentence already says `casting`. The plan's point is that this is broken as
// STRUCTURE, so it can be detected with **no language knowledge** (INTERNALS: "no language knowledge
// in the code"), unlike almost everything else in Track F.
//
// Three signals, each independently checkable and each language-blind:
//   ORPHAN_BLANK  the blank follows sentence-final punctuation with no space, or sits at the very
//                 end after a complete sentence — the blank is not where a word was removed.
//   NO_BLANK      there is no blank at all, so nothing was removed.
//   ANSWER_SHOWN  the correct answer (or a long stem of it) is already present in the stem, so the
//                 item answers itself.
// ANSWER_SHOWN is the one that needs care: a stem test is not morphology, and a short answer can
// appear inside an unrelated word. It is therefore reported in TWO bands — whole-token (safe) and
// stem-prefix (indicative) — and never merged into one number.
//
// Reports. Does not assert. The paired guard, `unit-word-forms-defects`, pins the DETECTOR on
// synthetic fixtures instead, so it stays green while the corpus is still dirty.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));

// The detector, kept identical in shape to the product copy it will become.
const BLANK = /_{2,}/;
function defectsOf(item) {
  const out = [];
  const sent = String((item && item.sentence) || '');
  const choices = (item && item.choices) || [];
  const correct = String(choices[item && item.correctIndex] || '').trim();
  if (!sent) return ['NO_SENTENCE'];

  if (!BLANK.test(sent)) out.push('NO_BLANK');
  else {
    // The blank glued to the end of a finished sentence: ".___" / "!___" / "?___", or trailing after
    // terminal punctuation and nothing else. Both mean the blank replaced no word.
    if (/[.!?\u3002\u061F\u06D4]\s*_{2,}\s*[.!?]?\s*$/.test(sent)) out.push('ORPHAN_BLANK');
  }
  if (correct) {
    const stem = sent.replace(BLANK, ' ');
    const low = stem.toLowerCase();
    const c = correct.toLowerCase();
    const toks = low.split(/[^\p{L}\p{N}'\u2019-]+/u).filter(Boolean);
    if (toks.includes(c)) out.push('ANSWER_SHOWN_TOKEN');
    // ⚠️ TIGHTENED after the first sweep. The original rule compared the answer against a 4-char
    // slice of each token, so a 1-2 character token matched almost anything: it produced
    // `asistiendo` vs `a`, `avrei` vs `a`, `perdono` vs `per`, `there` vs `the` — 20 hits of which
    // only 2 were real. The rule is now "one whole word is a PREFIX of the other, both at least 4
    // characters", which keeps `casting`/`cast` and `travelled`/`travel` and drops the rest.
    // Still not morphology, and still reported as its own band.
    else if (c.length >= 4 && toks.some(t => t.length >= 4 && (t.startsWith(c) || c.startsWith(t))))
      out.push('ANSWER_SHOWN_STEM');
  }
  return out;
}

const tally = {};
const perTopic = {};
let lessons = 0, items = 0, bad = 0;
const samples = [];

for (const t of store.topics) {
  for (const L of (t.lessons || [])) {
    if (!L || L.type !== 'word_forms') continue;
    lessons++;
    for (const it of (L.items || [])) {
      items++;
      const d = defectsOf(it);
      if (!d.length) continue;
      bad++;
      perTopic[t.id] = (perTopic[t.id] || 0) + 1;
      for (const k of d) tally[k] = (tally[k] || 0) + 1;
      if (samples.length < 10 && (d.includes('ORPHAN_BLANK') || d.includes('ANSWER_SHOWN_TOKEN'))) {
        samples.push(`${t.lang}  [${d.join(',')}]  ${JSON.stringify(String(it.sentence).slice(0, 78))}  answer=${JSON.stringify((it.choices || [])[it.correctIndex])}`);
      }
    }
  }
}

const pc = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
console.log('PLAN §F2 — malformed word_forms items, swept across the corpus\n');
console.log(`word_forms lessons : ${lessons}`);
console.log(`items              : ${items}`);
console.log(`items with >=1 structural defect : ${bad}  (${pc(bad, items)})\n`);
console.log('by signal (an item can carry more than one):');
Object.entries(tally).sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k.padEnd(20)} ${String(v).padStart(5)}  ${pc(v, items)}`));

const worst = Object.entries(perTopic).sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('\nworst topics:');
worst.forEach(([id, n]) => {
  const t = store.topics.find(x => x.id === id);
  console.log(`  ${String(n).padStart(3)}  ${id}  ${(t && t.topic) || ''}`);
});

console.log('\nsamples:');
samples.forEach(s => console.log('  ' + s));
console.log('\n(reported, not asserted — the detector is pinned by unit-word-forms-defects)');
