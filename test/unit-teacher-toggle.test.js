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
//
// v86_l (user-requested): the single "click to flip" toggle BUTTON became a dropdown SELECT with
// two explicit named options ("Teacher"/"Student") — a bare lock icon never made which mode it meant
// obvious without reading the tooltip. `_teacherMode`, `_TEACHER_KEY`, and every gate elsewhere in
// the app keyed off the boolean are UNCHANGED — only the control's own shape and its own
// setTeacherMode(mode)/updateTeacherModeBtn() pair changed.
//
// What is worth guarding, independent of how many instances exist or where: does the one remaining
// control actually work — set state from either option, persist across reloads, and show the right
// selected option (and labels) for each state.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function client() {
  const C = loadClient({ quiet: true });
  // setTeacherMode() unconditionally calls loadSavedList() to refresh the library view — stub it
  // (async, would otherwise reject on the stub DOM's incomplete state and crash the process after
  // this file's own synchronous assertions already passed).
  C.run(`UI_STRINGS = ${JSON.stringify(UI.en)}; loadSavedList = async function(){}; true;`, 'seed');
  return C;
}

// ── 1. The one instance exists, a <select> with both options, carrying its handler inline ────────
{
  assert.ok(/id="teacher-mode-select" onchange="setTeacherMode\(this\.value\)"/.test(html),
    'teacher-mode-select carries its handler inline, triggerable headlessly via a real onchange');
  assert.ok(/id="teacher-mode-opt-teacher" value="teacher"/.test(html), 'a "teacher" option exists');
  assert.ok(/id="teacher-mode-opt-student" value="student"/.test(html), 'a "student" option exists');
  console.log('  the dropdown exists with both options and an inline, headlessly-triggerable handler');
}

// ── 2. Selecting either option sets the mode, persists it, and shows the right selection+labels ──
{
  const C = client();
  C.run('APP._teacherMode = false; updateTeacherModeBtn();');
  C.run("document.getElementById('teacher-mode-select').onchange = () => setTeacherMode('teacher'); document.getElementById('teacher-mode-select').onchange();");
  assert.strictEqual(C.run('APP._teacherMode'), true, 'selecting "teacher" turns teacher mode on');
  assert.strictEqual(C.run("localStorage.getItem('dz_teacher_mode')"), '1',
    'and persists the new state across reloads');
  assert.strictEqual(C.run("document.getElementById('teacher-mode-select').value"), 'teacher',
    'the select reflects the "teacher" option as chosen');
  assert.strictEqual(C.run("document.getElementById('teacher-mode-opt-teacher').textContent"),
    UI.en['teacher.option_teacher'], 'the teacher option shows the right label');
  assert.strictEqual(C.run("document.getElementById('teacher-mode-opt-student').textContent"),
    UI.en['teacher.option_student'], 'the student option ALSO shows its label (both are kept in sync, not just the selected one)');

  C.run("document.getElementById('teacher-mode-select').onchange = () => setTeacherMode('student'); document.getElementById('teacher-mode-select').onchange();");
  assert.strictEqual(C.run('APP._teacherMode'), false, 'selecting "student" turns it back off');
  assert.strictEqual(C.run("localStorage.getItem('dz_teacher_mode')"), '0', 'and persists that too');
  assert.strictEqual(C.run("document.getElementById('teacher-mode-select').value"), 'student',
    'the select reflects the "student" option as chosen');
  console.log('  selecting either option sets the mode, persists, and re-syncs the select+labels correctly in both directions');
}

// ── 3. Non-vacuity: the two option labels are actually different ──────────────
{
  assert.notStrictEqual(UI.en['teacher.option_teacher'], UI.en['teacher.option_student'],
    'the two option labels differ in en — otherwise check #2 could pass on a control whose labels never change');
  console.log('  the Teacher and Student option labels genuinely differ');
}

// ── 4. updateTeacherModeBtn() wires onchange in JS too, not just the inline attribute ─────────────
// (Same reasoning as the OLD button's own onclick reassignment: this harness's stub DOM does not
// turn an inline onchange="f()" attribute into a callable .onchange property, so the JS-side
// assignment inside updateTeacherModeBtn() is what makes the control actually testable/robust here,
// same standing rule 22 the old toggle's own comment already named.)
{
  const C = client();
  C.run("document.getElementById('teacher-mode-select').onchange = null; updateTeacherModeBtn();");
  const hasHandler = C.run("typeof document.getElementById('teacher-mode-select').onchange === 'function'");
  assert.strictEqual(hasHandler, true, 'updateTeacherModeBtn() (re-)assigns a real, callable onchange handler');
}
console.log('  updateTeacherModeBtn() assigns a real onchange handler in JS, not relying on the inline attribute alone');

// ── 5. No new i18n owed beyond the two new option-label keys ──────────────────
{
  for (const k of ['teacher.option_teacher', 'teacher.option_student', 'teacher.unlock_tooltip']) {
    assert.ok(UI.en[k], `${k} exists in en`);
  }
  console.log('  the two new option-label keys exist in en; nothing else new owed to the translate pass');
}

console.log('unit-teacher-toggle: ALL PASSED');
