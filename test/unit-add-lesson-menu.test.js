// unit-add-lesson-menu.test.js
// v78_j (user, screenshot) — the single-chapter "add lesson" menu offers the FULL suite.
//
// User: "please add the whole suit of possible lessons to this menu. We had been hiding grammar and
// conjugation lessons from this single chapter version of 'add lessons', let's bring them back."
//
// There was no gate — only an omission. Both are full registry types in `LESSON_TYPE_META`, with a
// builder, an editor branch and a translated label, and the storyline-wide arc has offered them all
// along via `ADD_LESSON_TYPES`. The single-chapter menus simply listed fewer.
//
// The real defect is structural and is what this file guards: **the option list is written out
// three times** — the progress-card menu (static markup), the library menu (a template literal) and
// `ADD_LESSON_TYPES` (the arc's tick-list). Three copies of one list is how they came to disagree,
// and adding two options to two of them fixes today's symptom without fixing that. So the assertion
// is AGREEMENT, not presence: whatever a type's availability is, the two add-lesson menus must say
// the same thing about it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Pull the <option value="..."> set out of a named <select>, by id for the static menu and by the
// templated id for the library one.
function optionsOf(selectMarker) {
  const at = html.indexOf(selectMarker);
  assert.ok(at > 0, `the select ${selectMarker} exists`);
  const end = html.indexOf('</select>', at);
  assert.ok(end > at, `${selectMarker} is closed`);
  const block = html.slice(at, end);
  return [...block.matchAll(/<option value="([a-z_]+)"/g)].map(m => m[1]);
}

const lib  = optionsOf('id="sial-fmt-${sid}"');

// ── 1. ⚠️ THE THIRD COPY IS GONE — the structural defect this file names is now half-fixed ──────
// This file's own header calls it out: "the option list is written out three times — the
// progress-card menu (static markup), the library menu (a template literal) and ADD_LESSON_TYPES...
// Three copies of one list is how they came to disagree." At v87_o the user asked for the lesson-set
// page to offer "the same checkmark list of all lesson types, as for book generation jobs and for
// add-lessons button of the storyline page", and the way to do that was to DELETE the static
// progress-card <select> and route that surface through `_pickLessonTypes()` → the shared
// `renderLessonTypeChecks` over `ADD_LESSON_TYPES`.
//
// So the card-vs-library agreement check below could not be kept as written — one side no longer
// exists. It is replaced by the stronger claim the header was really after: that surface now reads
// the SHARED registry, so it cannot drift from it at all.
{
  assert.strictEqual(html.indexOf('id="sial-fmt-lesson-card"'), -1,
    'the lesson-set card no longer carries its own hand-written copy of the option list');
  assert.ok(/onclick="doAddLessonMulti\('lesson-card'/.test(html),
    'its Generate button opens the shared multi-type picker instead');
  assert.ok(/_pickLessonTypes\(t\('sl\.add_lessons_btn'\), \{[\s\S]{0,240}allowAi/.test(html),
    'and that picker is the SAME one the storyline page uses, passed this surface\'s own gates');
  console.log('  the lesson-set card reads the shared registry — one hand-written copy fewer: OK');
}

// ── 2. The library menu still offers the full suite (v78_j\'s original claim) ────────────────────
// v78_j was about grammar/conjugation being omitted from the single-chapter menus. The card side is
// now registry-driven and cannot omit them; the library menu is still hand-written, so it is still
// worth pinning.
{
  for (const type of ['grammar', 'conjugation']) {
    assert.ok(lib.includes(type), `the library menu offers ${type}`);
  }
  console.log('  the library menu still offers grammar and conjugation: OK');
}

// ── 3. The library menu does not drift from the SHARED registry ─────────────────────────────────
// The agreement check, re-pointed at the thing that is now authoritative. Two documented
// exceptions, each with a real reason rather than an excuse:
//   • `review`  — registry-only: the arc\'s reinforcement pseudo-type, never offered as a
//     single-chapter add-lesson option by the hand-written library menu.
// `mixed` is in NEITHER list, by design: renderLessonTypeChecks appends it as its own toggle below a
// rule (it owns no content — it pools the open set\'s other lessons at play time), and
// readLessonTypeChecks adds it to the selection only when a real type is also ticked. So the
// lesson-set card can still create one — via that toggle rather than via a hand-written <option>.
{
  const REGISTRY = [...html.slice(html.indexOf('const ADD_LESSON_TYPES = ['),
                                  html.indexOf('\n];', html.indexOf('const ADD_LESSON_TYPES = [')))
    .matchAll(/\{ v: '([a-z_]+)'/g)].map(m => m[1]);
  assert.ok(REGISTRY.length >= 10, `the shared registry was parsed (${REGISTRY.length} types)`);
  const LIB_ONLY = new Set();
  const REGISTRY_ONLY = new Set(['review']);
  const regSet = new Set(REGISTRY), libSet = new Set(lib);
  const onlyLib = [...libSet].filter(v => !regSet.has(v));
  const onlyReg = [...regSet].filter(v => !libSet.has(v));
  assert.deepStrictEqual(onlyLib.sort(), [...LIB_ONLY].sort(),
    `the library menu offers nothing outside the shared registry (got ${JSON.stringify(onlyLib)})`);
  assert.deepStrictEqual(onlyReg.sort(), [...REGISTRY_ONLY].sort(),
    `and the registry holds nothing the library lacks except \`review\` (got ${JSON.stringify(onlyReg)})`);
  assert.ok(/fmt === 'mixed'[\s\S]{0,400}mixed\.need_open_set/.test(html),
    'the mixed handler really does require an open lesson set — so its absence from the registry is ' +
    'a reason, not an excuse');
  // And it IS still reachable from the lesson-set card, through the tick-list's own toggle — the
  // capability the deleted <option value="mixed"> used to provide must not have been lost with it.
  assert.ok(/o\.noMixed \? '' :/.test(html), 'renderLessonTypeChecks still offers the mixed toggle by default');
  assert.ok(!/_pickLessonTypes\([\s\S]{0,200}noMixed/.test(html),
    'and the add-lessons picker does NOT suppress it, so the card can still create a mixed review');
  console.log(`  the library menu agrees with the shared registry (${regSet.size} types), two documented exceptions: OK`);
}

// ── 4. The dialect gate moved with it ────────────────────────────────────────────────────────────
// The deleted <select> carried it as a CSS class (`.opt-ai-authoring`), swept at open time. The
// tick-list had no equivalent, so routing this surface through it would have silently offered a
// dialect topic the LLM-authoring types — the exact thing openAddLesson\'s own comment says must not
// happen ("they would inject standard-German content, breaking the no-invented-dialect guarantee").
{
  assert.ok(/\{ v: 'grammar', ai: true,/.test(html) && /\{ v: 'synonyms', ai: true,/.test(html),
    'the registry marks the LLM-authoring types');
  assert.ok(/!\(x\.ai && o\.allowAi === false\)/.test(html),
    'and renderLessonTypeChecks filters on it, so a dialect topic is never offered them');
  assert.ok(/allowAi: !\(d && d\._dialect\)/.test(html),
    'with the lesson-set card passing allowAi:false for a dialect topic');
  console.log('  the dialect gate survived the move from <select> class to registry flag: OK');
}

console.log('unit-add-lesson-menu: ALL PASSED');
