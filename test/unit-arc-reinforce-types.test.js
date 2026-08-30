// Unit guard, originally for Bug #1 (todos_v46): the grammar-arc reinforcement must generate the
// NEW word_forms + synonyms lesson types, not the LEGACY grammar + conjugation ones. Two client
// paths set `arcReinforce`; both regressed to ['grammar','conjugation'] while the UI label promised
// "Word forms + synonyms".
//
// v71_u — REWRITTEN, because the bug class it guarded is now structurally impossible rather than
// merely fixed. The book/PDF forms no longer carry a two-option arc <select> backed by a hardcoded
// reinforcement list; they carry the SAME tick-list the storyline add-lessons run has used since
// v71_p. The label cannot disagree with what is generated, because the label IS the picker — there
// is no second list to fall out of sync.
//
// So this file now guards the property that replaced it: one shared source of lesson types, and no
// hardcoded reinforcement list anywhere in the client. A future edit that reintroduces a local list
// (the actual v46 regression) fails here.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// 1. The client hardcodes no reinforcement type list.
{
  const assigns = [...html.matchAll(/arcReinforce\s*=\s*\[([^\]]*)\]/g)].map(m => m[1]);
  assert.strictEqual(assigns.length, 0,
    `the client sends no hardcoded arcReinforce list any more — the user picks types (found ${assigns.length})`);
  const modeSends = [...html.matchAll(/body\.arcMode\s*=|gbody\.arcMode\s*=/g)];
  assert.strictEqual(modeSends.length, 0, 'and no two-value arcMode: the picker replaced it');
  assert.ok(/body\.arcTypes = readArcTypeChecks\('pdf-arc-types'\)/.test(html),
    'the PDF/book form sends its ticked types');
  assert.ok(/gbody\.arcTypes=readArcTypeChecks\('gen-arc-types'\)/.test(html),
    'the generate form sends its ticked types');
}

// 2 + 3. RUN both pickers and read them back (v73_c).
//
// These two sections used to be pure source regexes — `/renderLessonTypeChecks\(c, \{ cls: …/` and
// `/checked: \['review'\]/`. Both were pins on how the code is WRITTEN: reformatting the call broke
// them, and neither could have noticed the picker rendering nothing at all. They are now driven
// through the real render → read round trip, which lib-dom could not do before it parsed innerHTML
// (`readLessonTypeChecks` uses `querySelectorAll('.arc-lt-check')`, which returned [] until v73_c —
// so any earlier attempt at this would have read an empty list and passed vacuously).
{
  const { loadClient } = require('./lib-dom');
  const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  const C = loadClient({ quiet: true });
  C.run(`UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed-ui');

  const valuesIn = (id) => C.document.getElementById(id).querySelectorAll('.arc-lt-check').map(b => b.value);

  // Both forms render, and render the SAME options — the property that replaced the two drifting
  // <select>s. Compared as rendered output, so a private copy in one form fails here even if it
  // happens to be spelled identically in source.
  C.run(`renderArcTypeChecks('gen-arc-types'); renderArcTypeChecks('pdf-arc-types'); true;`, 'render-both');
  const genValues = valuesIn('gen-arc-types');
  const pdfValues = valuesIn('pdf-arc-types');
  assert.ok(genValues.length >= 8, `the generate form renders a real tick-list (${genValues.length} options)`);
  assert.deepStrictEqual(genValues, pdfValues,
    'both forms offer exactly the same lesson types — one shared list, no second source of truth');

  // The default, read through the PRODUCT's own reader rather than pinned in source.
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(readArcTypeChecks('gen-arc-types'))`, 'read-default')),
    ['review'],
    "the picker defaults to ['review'] — the old 'vocab' arc, unchanged for anyone who ignores it");

  // A tick is observable end-to-end: set the box the way a learner's click would, read it back
  // through readArcTypeChecks. This is the join the 'wiring needs a run' rule is about — the
  // renderer and the reader agreeing on the class name and the value attribute.
  C.run(`document.getElementById('gen-arc-types').querySelectorAll('.arc-lt-check')
           .filter(b => b.value === 'synonyms').forEach(b => { b.checked = true; }); true;`, 'tick');
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(readArcTypeChecks('gen-arc-types'))`, 'read-ticked')),
    ['review', 'synonyms'],
    'ticking a box is read back by the reader the form actually uses');

  // Story-dependent types are hidden when there is no story — the same gate the add-lesson menu
  // applies. Asserted on the rendered options, which is where the learner meets it.
  C.run(`const c = document.getElementById('pdf-arc-types'); c.dataset.rendered = '';
         renderLessonTypeChecks(c, { cls: 'arc-lt-check', checked: ['review'], hasStory: false }); true;`, 'no-story');
  const noStory = valuesIn('pdf-arc-types');
  assert.ok(!noStory.includes('comprehension') && !noStory.includes('error_hunt'),
    'without a story the story-dependent types are not offered');
  assert.ok(noStory.includes('standard') && noStory.includes('review'),
    'while the story-free ones still are');

  console.log(`  picker round trip: ${genValues.length} options, default ['review'], tick read back`);

  // Still source-level, and correctly so: this asserts an ABSENCE, which no render can show.
  assert.ok(!/id="pdf-arc-mode"/.test(html) && !/id="gen-arc-mode"/.test(html),
    'the two-option arc <select>s are removed from both forms');
}

// 4. The server accepts the list, and still understands old clients.
{
  assert.ok(/const ARC_LESSON_TYPES = \[/.test(server), 'the server has one canonical type list');
  assert.ok(/function sanitizeArcTypes\(list\)/.test(server),
    'and sanitises the client list rather than trusting it — it arrives over HTTP');
  assert.ok(/function arcTypesFromLegacyMode\(arcMode, arcReinforce\)/.test(server),
    'a legacy arcMode is translated into a list');
  assert.ok(/return \['review'\];/.test(server),
    "legacy 'vocab' maps to the review lesson it used to mean");
  assert.ok(/\(r && r\.length\) \? r : \['word_forms', 'synonyms'\]/.test(server),
    "and legacy 'grammar' still maps to word_forms + synonyms — the v46 fix, preserved");
  assert.ok(/async function generateArcLesson\(aType, ctx\)/.test(server),
    'there is one shared per-type generator');
  // Decoupling chaptering from lesson generation (roadmap_v87.md) added a leading
  // `!base.skipLessons &&` to this condition — the anchor now matches on the STABLE suffix rather
  // than the whole condition, so a future guard addition here doesn't re-break this same way.
  const book = server.slice(server.indexOf('base.arc && i >= 1 && Array.isArray(data.lessons))'));
  const bookBlock = book.slice(0, 2500);
  assert.ok(/generateArcLesson\(aType, \{/.test(bookBlock), 'the book arc dispatches through it');
  assert.ok(!/base\.arcMode === 'grammar'/.test(bookBlock),
    'and no longer branches on the two-value mode');
}

// 5. Every type the picker offers is one the server can build.
// The pairing the v71_l comprehension bug turned on: the picker offered a type the route clamped
// away, so ticking it silently produced a standard lesson instead.
{
  const listSrc = html.slice(html.indexOf('const ADD_LESSON_TYPES = ['));
  const clientTypes = [...listSrc.slice(0, listSrc.indexOf('];')).matchAll(/\{ v: '([a-z_]+)'/g)].map(m => m[1]);
  assert.ok(clientTypes.length >= 8, `the picker offers a real list (${clientTypes.length} types)`);
  const srvSrc = server.slice(server.indexOf('const ARC_LESSON_TYPES = ['));
  const srvTypes = [...srvSrc.slice(0, srvSrc.indexOf('];')).matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
  for (const ty of clientTypes) {
    assert.ok(srvTypes.includes(ty),
      `the server accepts '${ty}' — a type the picker offers but the route drops is silently ignored`);
  }
  console.log(`  picker/server pairing: ${clientTypes.length} types, all accepted`);
}

console.log('unit-arc-reinforce-types: ALL PASSED');
