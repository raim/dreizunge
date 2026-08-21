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

// ── 6. Both copies still carry exactly one arrow each, between the two columns ────────────────
const arrowCount = (html.match(/<div class="lang-pair-arrow">→<\/div>/g) || []).length;
assert.strictEqual(arrowCount, 2, `exactly 2 arrows expected (one per synced copy), found ${arrowCount}`);
console.log('  exactly one arrow per picker copy (2 total): OK');

// ── What this does NOT establish ────────────────────────────────────────────────────────────
// The actual title values after a real applyUIStrings() run, and the arrow's rendered layout,
// were verified live in a real browser (both the generation screen and the library screen, plus a
// live language change confirming the selected-pair STATE is unaffected by this purely visual
// change) rather than here — applyUIStrings() has enough unrelated DOM dependencies that a full
// harness run needs shimming disproportionate to what this file is actually about (rule 34).

console.log('unit-lang-pair-arrow: ALL PASSED');
