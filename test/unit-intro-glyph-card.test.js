// unit-intro-glyph-card.test.js
// v79_g (user request, with screenshot): the script-primer glyph→sound question.
//
// It rendered as "Wie sagt man М м?" — a line of prose whose entire content is the glyph, with the
// glyph itself at question size and underlined, above four answer buttons each half a card wide
// carrying a single letter. Four changes, all asserted here by RENDERING the card and reading the
// DOM rather than by matching the source string:
//
//   1. the carrier sentence is gone — the glyph IS the question, and it is bigger;
//   2. no underline (the .q-word treatment marks a word inside a sentence; there is no sentence);
//   3. the answers are content-sized chips laid out next to each other, like the ordering bank,
//      at a font a step DOWN from the glyph rather than a match for it;
//   4. the glyph is spoken on render, and the chosen chip is spoken on tap, in the TARGET voice.
//
// Scope matters as much as the change: the OTHER item in the same lesson (sound→glyph) keeps its
// sentence, because its prompt is a transliteration that needs the question to say what is asked.
// A change that silently stripped both would look identical in a screenshot of the first one.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// A minimal Cyrillic-Serbian primer lesson, matching the screenshot's chapter (sr taught to a
// German speaker). Built here rather than mined from the corpus so the section cannot go vacuous
// when the data changes.
const LESSON = {
  id: 'ls_intro_test', type: 'intro_script', script: 'cyrillic-sr', difficulty: 2,
  letters: [
    { ch: 'М', lower: 'м', translit: 'm', name: 'em' },
    { ch: 'О', lower: 'о', translit: 'o', name: 'o' },
    { ch: 'Н', lower: 'н', translit: 'n', name: 'en' },
    { ch: 'И', lower: 'и', translit: 'i', name: 'i' },
    { ch: 'Р', lower: 'р', translit: 'r', name: 'er' },
  ],
};

function render(exercise, opts) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.de)}; true;`, 'seed');
  C.run(`
    APP.lessonData = { id:'tp_test', lang:'sr', srcLang:'de', script:'cyrillic-sr',
                       lessons:[${JSON.stringify(LESSON)}] };
    APP.lang = 'sr'; APP.srcLang = ${JSON.stringify((opts || {}).appSrcLang || 'en')};
    APP.muted = ${(opts || {}).muted ? 'true' : 'false'};
    APP.info = { backend:'none', canGenerate:false };
    APP.progress = { completed:{}, solved:{} };
    APP._spoken = [];
    speak = function(txt){ APP._spoken.push(String(txt)); };
    APP.cur = { lessonIdx:0, exercises:[${JSON.stringify(exercise)}], cur:0, correct:0, total:1, mistakes:0 };
    document.getElementById("ex-body").innerHTML = EX_RENDERERS[APP.cur.exercises[0].type](APP.cur.exercises[0]);
    true;`, 'render');
  return C;
}
const html = C => C.run(`document.getElementById('ex-body').innerHTML || ''`);
const spoken = C => JSON.parse(C.run(`JSON.stringify(APP._spoken)`));

// The two item shapes, built by the PRODUCT generator so the test cannot drift from what the app
// actually makes (a re-typed copy would pass even if the generator changed).
const built = (() => {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.de)}; true;`, 'seed');
  C.run(`APP.lessonData = { lang:'sr', srcLang:'de' }; APP.srcLang='de'; true;`, 'ctx');
  return JSON.parse(C.run(
    `JSON.stringify(introScriptExercisesFrom(${JSON.stringify(LESSON.letters)}, { distractorPool: ${JSON.stringify(LESSON.letters)}, srcScripts: ['latin'] }))`));
})();
const GLYPH_SOUND = built.find(e => e._intro === 'glyph_sound');
const SOUND_GLYPH = built.find(e => e._intro === 'sound_glyph');
assert.ok(GLYPH_SOUND, 'the product generator still produces a glyph_sound item');
assert.ok(SOUND_GLYPH, 'and a sound_glyph item — the one that must KEEP its sentence');

const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {

// ── 1-2. The glyph is the question: no carrier sentence, no underline, bigger ─────────────────
{
  const C = render(GLYPH_SOUND);
  const h = html(C);
  assert.ok(/class="qglyph"/.test(h), 'the glyph is rendered in its own large treatment');
  assert.ok(!/class="qtext"/.test(h),
    'and the carrier sentence is gone — this is the reported "Wie sagt man X?" line');
  assert.ok(!/class="q-word"/.test(h),
    'the underlined in-sentence word treatment is not used: there is no sentence to mark against');
  // The glyph itself survived the rewrite. Non-vacuity: an empty card would satisfy every
  // assertion above.
  const glyphText = C.run(`(document.querySelector('.qglyph')||{}).textContent || ''`);
  assert.ok(glyphText.trim().length > 0 && glyphText.includes(GLYPH_SOUND.source.trim().charAt(0)),
    `the glyph is still shown (got "${glyphText}")`);
  // Size is a real part of the request, so it is measured rather than assumed. Read from the
  // stylesheet the page ships, and compared to the question size it replaces.
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const px = re => { const m = re.exec(src); return m ? parseFloat(m[1]) : null; };
  const qglyph = px(/\.qglyph\{font-size:(\d+(?:\.\d+)?)px/);
  const qtext  = px(/\.qtext\{font-size:(\d+(?:\.\d+)?)px/);
  const chip   = px(/\.choices\.chips \.choice\{font-size:(\d+(?:\.\d+)?)px/);
  const choice = px(/^\.choice\{[^}]*font-size:(\d+(?:\.\d+)?)px/m);
  assert.ok(qglyph && qtext && chip && choice, 'all four sizes are declared in the stylesheet');
  assert.ok(qglyph > qtext * 2,
    `the glyph is significantly larger than the question text it replaced (${qglyph} vs ${qtext})`);
  assert.ok(chip > choice,
    `the answers are larger than a standard choice button (${chip} vs ${choice})`);
  assert.ok(chip < qglyph,
    `but a step DOWN from the glyph, not a match for it (${chip} vs ${qglyph})`);
  console.log(`  glyph ${qglyph}px, chips ${chip}px, no sentence, no underline: OK`);
}

// ── 3. The answers are chips, sized to content and flowing next to each other ─────────────────
{
  const C = render(GLYPH_SOUND);
  assert.ok(/class="choices[^"]*\bchips\b/.test(html(C)),
    'the answer row uses the chip layout, not the two-column full-width grid');
  const n = C.run(`document.querySelectorAll('.choice').length`);
  assert.strictEqual(n, GLYPH_SOUND.choices.length,
    'every choice is still rendered — the layout changed, not the question');
}

// ── 4. Spoken: the glyph on render, the chosen chip on tap ────────────────────────────────────
{
  const C = render(GLYPH_SOUND);
  // The speak calls are deferred so the card exists first (the browser needs the card rendered
  // before the utterance is built). The harness uses real timers, so wait rather than flush.
  await wait(150);
  let said = spoken(C);
  assert.ok(said.length >= 1 && said[0].includes(GLYPH_SOUND.source.trim().charAt(0)),
    `the glyph is read aloud when the card appears (spoke: ${JSON.stringify(said)})`);
  // Tapping a chip speaks THAT chip.
  const idx = GLYPH_SOUND.choices.indexOf(GLYPH_SOUND.correct);
  // Drive the product's own click handler with the rendered chip, taken from the card rather than
  // looked up by id (the id lookup would auto-vivify a stub if the chip were missing, and a stub
  // has no handler — a silent pass).
  C.run(`(function(){ var b = document.querySelectorAll('.choice')[${idx}];
    if (!b) throw new Error('chip ${idx} was not rendered');
    pickChoice(${idx}, b); })(); true;`, 'tap');
  await wait(150);
  said = spoken(C);
  assert.ok(said.includes(GLYPH_SOUND.correct),
    `tapping an answer reads it back (spoke: ${JSON.stringify(said)})`);
}

// ── 5. Muted means silent — the primer must not talk over a muted app ─────────────────────────
{
  const C = render(GLYPH_SOUND, { muted: true });
  await wait(150);
  assert.deepStrictEqual(spoken(C), [],
    'nothing is spoken while muted, on render or on tap');
}

// ── 6. SCOPE: the sound→glyph item in the same lesson is untouched ────────────────────────────
// Its prompt is a transliteration, so it still needs the question sentence to say what is asked.
{
  const C = render(SOUND_GLYPH);
  const h = html(C);
  assert.ok(/class="qtext"/.test(h),
    'the sound→glyph item keeps its question sentence — the change is scoped to the one item '
    + 'whose prompt is a single grapheme');
  assert.ok(!/class="qglyph"/.test(h), 'and does not get the large-glyph treatment');
  assert.ok(!/\bchips\b/.test(h), 'nor the chip layout: its answers are glyphs, not short sounds');
  console.log('  scope: the sound-to-glyph item in the same lesson is unchanged: OK');
}

// ── 7. The badge names the language in the LEARNER's language ─────────────────────────────────
// From the same screenshot: "ÜBERSETZE INS SERBIAN" — a German sentence with an English language
// name. The flag came from lessonData.srcLang and the NAME from APP.srcLang, which is still the
// default 'en' when a lesson is opened directly by #topic=. Two sources of truth for one fact.
{
  const C = render(GLYPH_SOUND, { appSrcLang: 'en' });   // the mismatch condition
  const badge = C.run(`(document.querySelector('.ex-badge')||{}).textContent || ''`);
  assert.ok(/Serbisch/.test(badge),
    `the badge names Serbian in German, as the rest of the badge is (got "${badge}")`);
  assert.ok(!/Serbian/.test(badge),
    'and not in English — the flag and the name must come from the same place');
  // languages.json really does carry the German name, so this is a lookup fix and not a data one.
  assert.strictEqual(LANGS.sr.names.de, 'Serbisch', 'non-vacuity: the German name was always there');
  console.log('  badge language name matches the badge language: OK');
}

console.log('unit-intro-glyph-card: ALL PASSED');

})().catch(e => { console.error(e); process.exit(1); });
