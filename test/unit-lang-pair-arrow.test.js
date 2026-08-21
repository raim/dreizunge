// unit-lang-pair-arrow.test.js — PLAN §C4, the "arrow control" acceptance detail.
//
// From the user's original UI brief (roadmap_v81.md, PLAN §C4): "The source→target language
// selector is visually reduced to an arrow control: remove its duplicated icons and descriptive
// text without changing the selected language-pair state." Confirmed with the user before
// building: the arrow itself is INERT — a plain separator glyph, not a clickable control. The two
// `<select>`s underneath remain exactly as interactive as before; only the 🗣/📖 icon + "I speak"/
// "I learn" label WRAPPING each one is gone.
//
// Applies to BOTH synced copies of the picker (generation screen's own, and the library's mirror
// — PLAN §C5, v81_w) since both are literally "the source→target language selector."
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// ── 1. No icon+label wrapper survives, on either copy ──────────────────────────────────────────
assert.ok(!/data-i18n="form\.i_speak"/.test(html) && !/data-i18n="form\.i_learn"/.test(html),
  'THE REGRESSION: the "I speak"/"I learn" <label> wrapper must be gone entirely, not just hidden');
// The 🗣/📖 glyphs still appear elsewhere in the file (story icons, dialect glossary, the TTS
// pill) — this only checks they no longer sit directly beside a lang-select, the SPECIFIC shape
// that was removed.
for (const id of ['src-lang-select', 'lang-select', 'lib-src-lang-select', 'lib-lang-select']) {
  const at = html.indexOf(`id="${id}"`);
  assert.ok(at > -1, `${id} exists`);
  const colStart = html.lastIndexOf('<div class="lang-pair-col">', at);
  const before = html.slice(colStart, at);
  assert.ok(!/🗣|📖/.test(before),
    `${id}'s column must not carry a 🗣/📖 icon before the select, got: ${before.trim()}`);
  assert.ok(!/<label/.test(before),
    `${id}'s column must not carry a <label> before the select`);
}
console.log('  no icon+label wrapper survives on either picker copy: OK');

// Mutation check: the extraction above must be able to fail.
{
  const at = html.indexOf('id="src-lang-select"');
  const colStart = html.lastIndexOf('<div class="lang-pair-col">', at);
  const before = html.slice(colStart, at);
  const mutated = before + '🗣 <label>fake</label>\n        ';
  assert.ok(/🗣/.test(mutated) && /<label/.test(mutated),
    'sanity: a reintroduced icon+label is detectable by the same pattern used above');
}
console.log('  mutation check: a reintroduced icon+label would be caught: OK');

// ── 2. Each select carries a title tooltip so the removed strings are not orphaned ────────────
// Static markup default (English placeholder, like every other title= in this file); the REAL
// localized value is wired through applyUIStrings() at runtime — check #3.
assert.ok(/id="src-lang-select"[^>]*title="I speak"/.test(html), 'src-lang-select has a title tooltip');
assert.ok(/id="lang-select"[^>]*title="I learn"/.test(html), 'lang-select has a title tooltip');
assert.ok(/id="lib-src-lang-select"[^>]*title="I speak"/.test(html), 'lib-src-lang-select has a title tooltip');
assert.ok(/id="lib-lang-select"[^>]*title="I learn"/.test(html), 'lib-lang-select has a title tooltip');
console.log('  all four selects carry a title tooltip in static markup: OK');

// ── 3. applyUIStrings() wires the REAL localized strings onto those titles ────────────────────
// Same idiom as every other _setAttr(id, 'title', t(key)) call in this function (rule: don't
// invent a new mechanism when an established one already exists).
assert.ok(/_setAttr\('src-lang-select',\s*'title',\s*t\('form\.i_speak'\)\)/.test(html),
  'src-lang-select title is wired to form.i_speak');
assert.ok(/_setAttr\('lang-select',\s*'title',\s*t\('form\.i_learn'\)\)/.test(html),
  'lang-select title is wired to form.i_learn');
assert.ok(/_setAttr\('lib-src-lang-select',\s*'title',\s*t\('form\.i_speak'\)\)/.test(html),
  'lib-src-lang-select title is wired to form.i_speak');
assert.ok(/_setAttr\('lib-lang-select',\s*'title',\s*t\('form\.i_learn'\)\)/.test(html),
  'lib-lang-select title is wired to form.i_learn');
console.log('  applyUIStrings() wires form.i_speak/form.i_learn onto all four titles: OK');
// The strings themselves are not orphaned — form.i_speak/form.i_learn still exist and translate.
assert.strictEqual(ui.en['form.i_speak'], 'I speak');
assert.strictEqual(ui.en['form.i_learn'], 'I learn');

// ── 4. The dead .form-lbl[data-i18n] sweep is gone too, not left as a vacuous no-op ───────────
assert.ok(!/document\.querySelectorAll\('\.form-lbl\[data-i18n\]'\)/.test(html),
  'the generic .form-lbl[data-i18n] sweep is removed — it swept exactly these two labels and ' +
  'nothing else, so it has nothing left to do');
console.log('  the now-dead generic label sweep was removed, not left as a no-op: OK');

// ── 5. The arrow itself is actually styled, not bare unstyled text ────────────────────────────
const arrowRule = /\.lang-pair-arrow\{([^}]*)\}/.exec(html);
assert.ok(arrowRule, '.lang-pair-arrow has a CSS rule');
assert.ok(/font-size:\s*\d/.test(arrowRule[1]), 'the arrow has an explicit font-size');
assert.ok(/color:/.test(arrowRule[1]), 'the arrow has an explicit color');
console.log('  .lang-pair-arrow is actually styled (not bare inline text): OK');

// ── 5b. Follow-up user request: thicker + as large as the selectors, but not TALLER ───────────
// `.lang-select`'s rendered height was measured LIVE in a real browser at 44px (padding 10+10,
// border 2.5+2.5, ~19px line-height for a 15px font). The arrow's own box is pinned to that exact
// same 44px via an explicit CSS `height`, with flex-centering, so its bounding box can never
// exceed the selector's — equal, not taller, by construction rather than by font-metric luck.
assert.ok(/height:\s*44px/.test(arrowRule[1]),
  'THE REGRESSION: the arrow\'s box must be pinned to the select\'s own 44px height (measured ' +
  'live), or "not higher than the selectors" stops being guaranteed by construction');
// "Thicker": a heavy/bold glyph at a size well above the original 20px, not just a font-weight
// bump on the original thin arrow (Unicode arrow glyphs largely ignore font-weight).
const arrowSizeMatch = /font-size:\s*(\d+)px/.exec(arrowRule[1]);
assert.ok(arrowSizeMatch && Number(arrowSizeMatch[1]) >= 30,
  'the arrow font-size should be substantially larger than the original 20px to read as "thicker"');
console.log('  arrow is pinned to the selector\'s own height and sized up for "thicker": OK');

// ── 6. Both copies still carry exactly one arrow each, between the two columns ────────────────
// v81_ab (user follow-up): swapped the thin "→" for the heavy round-tipped "➜" specifically for
// visual weight — a Unicode arrow's thickness is mostly baked into the glyph, not font-weight.
const arrowCount = (html.match(/<div class="lang-pair-arrow">➜<\/div>/g) || []).length;
assert.strictEqual(arrowCount, 2, `exactly 2 arrows expected (one per synced copy), found ${arrowCount}`);
assert.strictEqual((html.match(/<div class="lang-pair-arrow">→<\/div>/g) || []).length, 0,
  'the original thin arrow must not survive alongside the heavy one');
console.log('  exactly one HEAVY arrow per picker copy (2 total), no thin arrow left behind: OK');

// ── What this does NOT establish ────────────────────────────────────────────────────────────
// The actual title values after a real applyUIStrings() run, and the arrow's rendered layout,
// were verified live in a real browser (both the generation screen and the library screen, plus a
// live language change confirming the selected-pair STATE is unaffected by this purely visual
// change) rather than here — applyUIStrings() has enough unrelated DOM dependencies that a full
// harness run needs shimming disproportionate to what this file is actually about (rule 34).

console.log('unit-lang-pair-arrow: ALL PASSED');
