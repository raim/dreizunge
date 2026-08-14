// unit-can-edit-teacher-mode.test.js
// v79_j — roadmap "RECOVERED — carried since v71": *"Live mode with teacher mode OFF must hide
// every editing control. Same `_canEdit()` conflation."*
//
// `_canEdit()` was `canGenerate || _teacherMode`, which answers two unrelated questions at once:
// CAN this install generate, and DOES this person want the authoring role. A learner on a live
// install — server up, teacher mode deliberately off — therefore saw every editing affordance.
//
// The change is provable rather than arguable because the truth table moves in exactly one cell,
// and that is what this file asserts: three cells unchanged, one fixed. A test that only checked
// the fixed cell would pass equally well for a function that returned `false` always.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
const canEdit = (canGenerate, teacher) => C.run(
  `APP.info = { backend:'${canGenerate ? 'ollama' : 'none'}', canGenerate:${!!canGenerate} };
   APP._teacherMode = ${!!teacher};
   _canEdit()`, 'gate');

// ── 1. The whole truth table ──────────────────────────────────────────────────────────────────
{
  assert.strictEqual(canEdit(false, false), false, 'static learner: no editing (unchanged)');
  assert.strictEqual(canEdit(false, true),  true,  'static teacher: editing (unchanged) — the '
    + 'static build has no backend, so teacher mode was already the only source of edit rights');
  assert.strictEqual(canEdit(true,  true),  true,  'live teacher: editing (unchanged)');
  assert.strictEqual(canEdit(true,  false), false, 'LIVE LEARNER: no editing — this is the cell '
    + 'the release fixes, and the only one that moves');
  console.log('  truth table: 3 cells unchanged, live+learner fixed: OK');
}

// ── 2. It is teacher mode that decides, not the backend ───────────────────────────────────────
// Stated separately from the table because it is the CLAIM; the table is the evidence. If someone
// later reintroduces a capability term, the table above would still pass in three cells.
{
  assert.strictEqual(canEdit(true, false), canEdit(false, false),
    'the backend does not grant edit rights on its own');
  assert.strictEqual(canEdit(true, true), canEdit(false, true),
    'and does not withhold them either — the two axes are now independent');
}

// ── 3. Generation stays on the capability axis (user ruling, session 33) ───────────────────────
// "Continue story", "Add lesson" and "Edit / rename topic" are gated on canGenerate directly and
// must NOT have been swept into this change. Asserted because the tempting over-fix is to route
// everything through one flag, which would hide generation from a live teacher who simply has
// teacher mode off — and, in the static build, would show generation controls that cannot work.
{
  const row = html.slice(html.indexOf('function savedItemHtml('),
                         html.indexOf('function savedItemHtml(') + 6000);
  for (const marker of ['sl.continue_btn', 'sl.add_lessons_btn', 'form.edit_topic']) {
    const at = row.indexOf(marker);
    if (at < 0) continue;                       // label key not on this row; nothing to claim
    const around = row.slice(Math.max(0, at - 400), at + 200);
    assert.ok(/canGenerate/.test(around),
      `${marker} is still gated on canGenerate, not folded into _canEdit — generation is a `
      + 'capability question and the user ruled it stays one');
  }
  console.log('  generation controls still keyed on canGenerate: OK');
}

// ── 4. No caller of _canEdit re-adds the capability term ──────────────────────────────────────
// A sweep rather than a list: the failure mode is a NEW call site writing
// `_canEdit() || APP.info?.canGenerate`, which would restore the bug one screen at a time and
// leave every assertion above green.
{
  // `.` does not match newlines, and these call sites sit inside multi-line template literals,
  // so the window is taken by index rather than by a dot-star pattern.
  const callers = [];
  for (let i = html.indexOf('_canEdit()'); i >= 0; i = html.indexOf('_canEdit()', i + 1))
    callers.push(html.slice(Math.max(0, i - 120), i + 120));
  assert.ok(callers.length >= 10, `found ${callers.length} _canEdit call sites to sweep`);
  for (const c of callers) {
    assert.ok(!/_canEdit\(\)\s*(\|\||&&)\s*[^)]*canGenerate/.test(c)
           && !/canGenerate[^)]*(\|\||&&)\s*_canEdit\(\)/.test(c),
      `no call site widens the gate back to the capability axis: ...${c.trim()}...`);
  }
  console.log(`  ${callers.length} call sites, none re-adds canGenerate: OK`);
}

// ── 5. The static build agrees ────────────────────────────────────────────────────────────────
// build-static.js re-implements client functions, so a client-only fix can be a non-fix there.
// Here the published build ships the same source, which is worth asserting rather than assuming.
{
  const docs = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');
  assert.ok(/function _canEdit\(\)\{ return !!APP\._teacherMode; \}/.test(docs),
    'docs/index.html carries the same gate — the static build is where a learner is most likely '
    + 'to be, since it has no backend and no way to turn teacher mode on by accident');
}

console.log('unit-can-edit-teacher-mode: ALL PASSED');
