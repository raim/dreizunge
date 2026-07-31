// unit-add-lessons.test.js
// v71_p — "Re-create all lessons" became "Add lessons", driven by a shared tick-list of lesson
// types instead of a two-button choice between two fixed bundles.
//
// Three things this pins, each of which was a real behaviour before the change:
//   1. ADD does not hide. Re-create marked every existing lesson `_hidden`, which silently
//      discards the learner's progress against them. Adding must leave them alone.
//   2. Every chapter, including the first. The old arc could only reinforce from chapter 2 on,
//      because it assumed chapter 1 had no prior vocabulary to review. An explicit tick-list
//      removes that assumption — asking for word_forms on a storyline means all of it.
//   3. One picker, two entry points. The storyline button and the book learning arc must offer
//      the SAME set, or the two drift into disagreeing about what a "learning arc" contains.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// ── 1. The picker exists, is shared, and replaced the old chooser ───────────
{
  assert.ok(/const ADD_LESSON_TYPES = \[/.test(html), 'the type list is a single named table');
  assert.ok(/function renderLessonTypeChecks\(container, opts\)/.test(html), 'it renders as checkboxes');
  assert.ok(/function readLessonTypeChecks\(container, cls\)/.test(html), 'and reads back a selection');
  assert.ok(/function _pickLessonTypes\(titleText\)/.test(html), 'with a modal wrapper');
  // The two-bundle chooser is GONE, not left beside the new one — two ways to express the same
  // intent is how the storyline page and the book form drift apart.
  assert.ok(!/function _pickArcMode\(/.test(html), 'the old two-button arc-mode chooser is removed');
  assert.ok(!/_pickArcMode\(\)/.test(html), 'and nothing still calls it');
}

// ── 2. The table covers the generatable types, story-gated where required ───
{
  const table = html.slice(html.indexOf('const ADD_LESSON_TYPES = ['),
                           html.indexOf(']', html.indexOf('const ADD_LESSON_TYPES = [')));
  for (const t of ['standard', 'review', 'word_forms', 'synonyms', 'grammar', 'conjugation',
                   'comprehension', 'math']) {
    assert.ok(new RegExp(`v: '${t}'`).test(table), `${t} is offered`);
  }
  // Story-dependent types must carry the flag, or a storyless chapter is offered a format whose
  // generator throws — the same gate the add-lesson menu applies (v71_l).
  assert.ok(/v: 'comprehension'[^}]*needsStory: true/.test(table), 'comprehension is story-gated');
  assert.ok(/v: 'error_hunt'[^}]*needsStory: true/.test(table), 'so is error_hunt');
  assert.ok(/!\(x\.needsStory && o\.hasStory === false\)/.test(html),
    'and the renderer honours that gate');
  // An empty selection must not silently run the default set.
  assert.ok(/if\(!sel\.length\)\{ go\.textContent='⚠ ' \+ t\('sl\.add_lessons_none'\)/.test(html),
    'ticking nothing is refused rather than treated as "the usual"');
}

// ── 3. The storyline button ADDS ───────────────────────────────────────────
{
  assert.ok(/const addTypes = await _pickLessonTypes\(t\('sl\.add_lessons_btn'\)\);/.test(html),
    'the storyline button opens the picker');
  assert.ok(/JSON\.stringify\(\{ id: startId, addTypes, add: true \}\)/.test(html),
    'and posts the tick-list in ADD mode');
  assert.ok(/id="sl-bottom-recreate"[^>]*title="Add lessons to every chapter"/.test(html),
    'the button says what it now does');
  assert.ok(!/title="Re-create all lessons \(keeps & hides the originals\)"/.test(html),
    'and no longer claims to hide the originals');
  for (const k of ['sl.add_lessons_btn', 'sl.add_lessons_hint', 'sl.add_lessons_none']) {
    assert.ok(UI.en[k], `en string ${k} exists`);
  }
}

// ── 4. Server: adding keeps existing lessons, and covers chapter 1 ──────────
{
  const at = server.indexOf('async function _runRecreateJob(');
  assert.ok(at > 0, 'the job function exists');
  const body = server.slice(at, server.indexOf('\n}', server.indexOf('return { recreated, hidden')));

  assert.ok(/const keepExisting = !!addTypes \|\| !!\(opts && opts\.add\);/.test(body),
    'an addTypes run is an ADD run');
  assert.ok(/if \(!keepExisting\) \{\s*\n\s*for \(const l of \(topic\.lessons \|\| \[\]\)\) \{ if \(!l\._hidden\)/.test(body),
    'and hiding is confined to the legacy re-create path — THE point of this change');
  // Chapter 1 is not special any more: the tick-list branch has no `i >= 1` gate.
  const tickBranch = body.slice(body.indexOf('if (addTypes) {'), body.indexOf('return;\n      }'));
  assert.ok(tickBranch.length > 100, 'the tick-list branch was found');
  assert.ok(!/i >= 1/.test(tickBranch),
    'the tick-list applies to EVERY chapter, including the first');
  // One failing type must not abandon the rest of the selection.
  assert.ok(/console\.warn\(`  \[add-lessons\] chapter \$\{i \+ 1\} \$\{aType\} failed/.test(tickBranch),
    'a type that fails on one chapter is logged and skipped, not fatal');
  // Unknown types are filtered before any generation is attempted.
  assert.ok(/opts\.addTypes\.filter\(t => ADD_LESSON_GENERATORS\[t\] \|\| t === 'standard' \|\| t === 'review'\)/.test(body),
    'unknown types are filtered out rather than reaching a missing generator');
  // The route threads it through.
  assert.ok(/_runRecreateJob\(jobId, startId, \{ arcMode: body\.arcMode, addTypes: _addTypes, add: !!body\.add \}\)/.test(server),
    'the route passes the tick-list to the job');
}

// ── 5. Chapter-title post-pass retries on EMPTY titles (v71_p) ──────────────
// Reported: the pass printed `Titles   :   |  ` — it parsed an array of the right length whose
// titles were all empty strings. A retry that only caught parse errors would not have retried.
{
  const at = server.indexOf('async function generateChapterMeta(');
  const body = server.slice(at, server.indexOf('\n}', server.indexOf('return out;', at)));
  assert.ok(/const MAX_TITLE_ATTEMPTS = 3;/.test(body), 'up to three attempts');
  assert.ok(/const named = got\.filter\(o => o\.title\)\.length;/.test(body),
    'acceptance is on CONTENT — how many titles came back named');
  assert.ok(/if \(named === n\) \{ out = got; break; \}/.test(body), 'a complete set stops early');
  assert.ok(/if \(named && \(!out \|\| named > out\.filter\(o => o\.title\)\.length\)\) out = got;/.test(body),
    'and the best partial is kept, since a partial set beats falling back to "Chapter 3"');
  assert.ok(/async function _generateChapterMetaOnce\(sys, user, n\)/.test(server),
    'one attempt is a separate function, so the loop has something to retry');
  assert.ok(/_callLLM\(OLLAMA_MODEL, sys, user, 60 \* n \+ 120, \{ think: false \}\)/.test(server),
    'and it still passes think:false — the v65.1 guarantee survives the refactor');
}

console.log('unit-add-lessons: ALL PASSED');
