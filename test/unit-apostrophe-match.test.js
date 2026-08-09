// unit-apostrophe-match.test.js
// v77_u — the apostrophe defect (roadmap §3, "ship regardless of ruling 3").
//
// Vocabulary stores `l'evoluzione` with ASCII U+0027; stories are written with the typographic
// U+2019 (`l’evoluzione`). Compared literally those are different strings, so a word that is
// EXACTLY present in the story never matched. Nothing about matching policy — a plain defect.
//
// Fixed as Unicode machinery (one character class covering the apostrophe code points), not a
// table, so it adds no language knowledge: the same class of rule as the case-insensitivity the
// matcher already applies.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
const marks = h => (String(h || '').match(/<mark/g) || []).length;

// ── 1. The defect itself, in both directions ──────────────────────────────
{
  // Vocabulary with ASCII, story with typographic — the shipped corpus's actual shape.
  const ascii = C.run(`_highlightVocabHtml('Studiamo l\\u2019evoluzione oggi.', ["l'evoluzione"], [])`);
  assert.strictEqual(marks(ascii), 1,
    "an ASCII-apostrophe vocabulary word matches a typographic apostrophe in the story");
  // And the reverse, so the fix is a folding rather than a one-way rewrite.
  const typo = C.run(`_highlightVocabHtml("Studiamo l'evoluzione oggi.", ['l\\u2019evoluzione'], [])`);
  assert.strictEqual(marks(typo), 1,
    'and a typographic vocabulary word matches an ASCII apostrophe in the story');
  console.log('  apostrophe forms match in both directions');
}

// ── 2. Non-vacuity: the match is the APOSTROPHE, not a substring fluke ─────
// Without this the section could pass because "evoluzione" matched inside the word.
{
  const none = C.run(`_highlightVocabHtml('Studiamo la rivoluzione oggi.', ["l'evoluzione"], [])`);
  assert.strictEqual(marks(none), 0,
    'the word is not matched where it does not occur — the fix widened equality, not the net');
}

// ── 3. A SOLVED word earns the strong mark across apostrophe forms ────────
// The two-tier marking (v74_n) keys the solved set by the word's text. If only the regex folded
// and the key did not, a solved word would match but keep the weak mark — the defect half-fixed.
{
  const h = C.run(`_highlightVocabHtml('Studiamo l\\u2019evoluzione oggi.', ["l'evoluzione"], ["l'evoluzione"])`);
  assert.ok(/story-vocab-hl solved/.test(h),
    'a solved word keeps its strong mark when the story spells it with the other apostrophe');
  console.log('  solved marking folds too');
}

// ── 4. It is not language knowledge ───────────────────────────────────────
// The design principle allows Unicode machinery, not hand-authored tables. Asserted structurally:
// the fold is a character class over code points, with no word list behind it.
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const i = html.indexOf('function _hlKey(');
  assert.ok(i > 0, 'the folding rule lives in one helper');
  const body = html.slice(i, i + 400);
  assert.ok(/\\u2019/.test(body), 'and folds by code point');
  assert.ok(!/\b(le|la|il|der|die|das)\b\s*:/.test(body), 'with no article or word table behind it');
}

// ── 5. The corpus actually gains from it ──────────────────────────────────
// A fix nobody's data exercises is a fix that could quietly stop working. Measured on the shipped
// corpus so a regression shows up as a number, not as silence.
{
  let gained = 0, chapters = 0;
  for (const t of store.topics) {
    const story = String(t.story || '');
    if (story.length < 50) continue;
    const words = (t.lessons || []).flatMap(L => (L && L.vocab) || [])
      .map(v => v && v.target).filter(Boolean).filter(w => /['\u2019]/.test(w));
    if (!words.length) continue;
    let here = 0;
    for (const w of words) {
      if (story.includes(w)) continue;                 // already matched literally
      const folded = w.replace(/['\u2019]/g, "['\u2019]").replace(/[.*+?^${}()|[\]\\]/g, m =>
        (m === '[' || m === ']') ? m : '\\' + m);
      let re; try { re = new RegExp(folded, 'i'); } catch (_) { continue; }
      if (re.test(story)) here++;
    }
    if (here) { chapters++; gained += here; }
  }
  assert.ok(chapters > 0 && gained > 0,
    `the shipped corpus contains apostrophe mismatches this fixes (${gained} words in ${chapters} chapters)`);
  console.log(`  corpus: ${gained} words in ${chapters} chapters now matchable`);
}

console.log('unit-apostrophe-match: ALL PASSED');
