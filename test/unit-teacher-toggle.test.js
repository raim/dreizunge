// unit-teacher-toggle.test.js
// v78_f (user testing notes, group B) originally put the teacher-mode switch in THREE places —
// full-width on landing, plus a compact icon on the lesson-set and storyline footers — because
// none of those pages alone was reachable from everywhere a learner might be.
//
// SUPERSEDED (user follow-up after v81_aa): with the Settings Card (`PLAN §C4`, `v81_y`) now
// reachable from every screen including static, that reachability goal is met by ONE instance
// living inside `#settings-modal` instead. The three-instance markup, the footer-containment
// checks, and the "all three presentations agree" comparison this file used to run are gone along
// with it — `test/unit-settings-card.test.js` guards the single-instance/single-location claim.
// What is STILL worth guarding here, independent of how many instances exist or where: does the
// one remaining toggle actually work — flip state, persist across reloads, and show the right
// label for each state.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function client() {
  const C = loadClient({ quiet: true });
  // toggleTeacherMode() unconditionally calls loadSavedList() to refresh the library view — stub
  // it (async, would otherwise reject on the stub DOM's incomplete state and crash the process
  // after this file's own synchronous assertions already passed).
  C.run(`UI_STRINGS = ${JSON.stringify(UI.en)}; loadSavedList = async function(){}; true;`, 'seed');
  return C;
}

// ── 1. The one instance exists and carries its handler inline ─────────────────
// (Reachable by a headless click, standing rule 22 — unlike the old compact footer copies, this
// one always assigned its handler inline in the markup, so nothing changed here.)
{
  assert.ok(/id="teacher-mode-btn" onclick="toggleTeacherMode\(\)"/.test(html),
    'teacher-mode-btn carries its handler inline, clickable headlessly');
  console.log('  the toggle exists with an inline, headlessly-clickable handler');
}

// ── 2. Clicking flips the mode, persists it, and shows the right label ────────
{
  const C = client();
  C.run('APP._teacherMode = false; updateTeacherModeBtn();');
  C.run("document.getElementById('teacher-mode-btn').onclick();");
  assert.strictEqual(C.run('APP._teacherMode'), true, 'clicking turns teacher mode on');
  assert.strictEqual(C.run("localStorage.getItem('dz_teacher_mode')"), '1',
    'and persists the new state across reloads');
  assert.strictEqual(C.run("document.getElementById('teacher-mode-btn').textContent"),
    UI.en['teacher.mode_on'], 'shows the ON label');

  C.run("document.getElementById('teacher-mode-btn').onclick();");
  assert.strictEqual(C.run('APP._teacherMode'), false, 'clicking again turns it back off');
  assert.strictEqual(C.run("localStorage.getItem('dz_teacher_mode')"), '0', 'and persists that too');
  assert.strictEqual(C.run("document.getElementById('teacher-mode-btn').textContent"),
    UI.en['teacher.mode_off'], 'shows the OFF label');
  console.log('  clicking toggles, persists, and re-labels correctly in both directions');
}

// ── 3. Non-vacuity: the two states are actually different ─────────────────────
{
  assert.notStrictEqual(UI.en['teacher.mode_on'], UI.en['teacher.mode_off'],
    'the two labels differ in en — otherwise check #2 could pass on a control that never changes');
  console.log('  the ON and OFF labels genuinely differ');
}

// ── 4. No new i18n ──────────────────────────────────────────────────────────
{
  for (const k of ['teacher.mode_on', 'teacher.mode_off', 'teacher.unlock_tooltip']) {
    assert.ok(UI.en[k], `${k} exists in en`);
  }
  console.log('  reuses the existing keys; nothing new owed to the translate pass');
}

console.log('unit-teacher-toggle: ALL PASSED');
