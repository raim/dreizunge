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

// 2. Both forms render from the ONE shared list.
{
  assert.ok(/function renderArcTypeChecks\(containerId, opts\)\{/.test(html),
    'there is one shared arc picker renderer');
  assert.ok(/renderLessonTypeChecks\(c, \{ cls: 'arc-lt-check'/.test(html),
    'and it delegates to the shared tick-list renderer, not a private copy');
  for (const id of ['pdf-arc-types', 'gen-arc-types']) {
    assert.ok(new RegExp(`renderArcTypeChecks\\('${id}'`).test(html), `${id} is rendered from it`);
    assert.ok(new RegExp(`id="${id}"`).test(html), `${id} exists in the form markup`);
  }
  // Gone, not merely unused: a hidden <select> still carrying two options is exactly the second
  // source of truth this file exists to forbid.
  assert.ok(!/id="pdf-arc-mode"/.test(html) && !/id="gen-arc-mode"/.test(html),
    'the two-option arc <select>s are removed from both forms');
}

// 3. Default ticks preserve the previous behaviour.
{
  assert.ok(/checked: \['review'\]/.test(html),
    "the picker defaults to ['review'] — the old 'vocab' arc, unchanged for anyone who ignores it");
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
  const book = server.slice(server.indexOf('if (base.arc && i >= 1 && Array.isArray(data.lessons))'));
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
