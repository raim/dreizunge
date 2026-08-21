// unit-settings-card.test.js — PLAN §C4 stage 1 (`v81_y`); check #5 updated for a later user
// follow-up that consolidated the teacher-mode toggle too.
//
// The Settings Card absorbs the items that were already single-instance, self-contained controls
// (the missing-UI-strings notice, import/export-static/teacher-dashboard), PLUS — per an explicit
// user ruling given after v81_aa — the teacher-mode toggle, which `v78_f` had deliberately placed
// in THREE instances (landing/library, the lesson-set footer, the storyline footer) specifically
// for reachability from every page. That reachability property is now satisfied by the Settings
// Card itself (reachable via `#settings-pill` on every screen, including static), so the three
// scattered instances collapsed into this one. Check #5 below guards the CURRENT claim — one
// instance, inside the card, the old three-instance list gone — not the original v78_f one.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { loadClient } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const uiJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function count(re) { return (html.match(re) || []).length; }

// Extract the `#settings-modal` block by brace/tag balance (div-depth tracking), the same
// technique `unit-static-selectlang-tts.test.js` uses for function bodies — the built artifact,
// not a hand-counted line range, is what actually ships.
function divBlock(src, openTagRe) {
  const m = openTagRe.exec(src);
  assert.ok(m, 'opening tag found: ' + openTagRe);
  let depth = 1;
  const tagRe = /<div\b|<\/div>/g;
  tagRe.lastIndex = m.index + m[0].length;
  let t;
  while ((t = tagRe.exec(src))) {
    if (t[0] === '<div') depth++;
    else depth--;
    if (depth === 0) return src.slice(m.index, t.index + t[0].length);
  }
  throw new Error('unbalanced <div> from ' + openTagRe);
}
const settingsModal = divBlock(html, /<div id="settings-modal"/);

// ── 1. Each moved control appears EXACTLY ONCE in the whole file ──────────────────────────────
// (catches a leftover duplicate from a careless cut/paste — the opposite risk from §C5, which
// deliberately duplicated its pickers.)
for (const [label, re] of [
  ['#ui-translate-row',    /id="ui-translate-row"/g],
  ['#export-static-btn',   /id="export-static-btn"/g],
  ['#teacher-dash-btn',    /id="teacher-dash-btn"/g],
  ['.import-btn label',    /class="import-btn"/g],
  ['#teacher-mode-btn',    /id="teacher-mode-btn"/g],
]) {
  assert.strictEqual(count(re), 1, `${label} must appear exactly once in index.html, found ${count(re)}`);
}
console.log('  each moved control appears exactly once: OK');

// ── 2. All five moved controls are actually INSIDE #settings-modal ────────────────────────────
for (const [label, needle] of [
  ['#ui-translate-row',  'id="ui-translate-row"'],
  ['#export-static-btn', 'id="export-static-btn"'],
  ['#teacher-dash-btn',  'id="teacher-dash-btn"'],
  ['.import-btn label',  'class="import-btn"'],
  ['#teacher-mode-btn',  'id="teacher-mode-btn"'],
]) {
  assert.ok(settingsModal.includes(needle), `${label} must be inside #settings-modal`);
}
console.log('  all five moved controls are inside #settings-modal: OK');

// Mutation check: the containment assertion above must actually be able to fail. Take a control
// OUT of the modal slice and confirm the same check then reports it missing.
{
  const withoutImport = settingsModal.replace(/<label class="import-btn"[\s\S]*?<\/label>/, '');
  assert.notStrictEqual(withoutImport, settingsModal,
    'the mutation must actually remove the import control — if this fires, the regex no longer ' +
    'matches the real markup and check #2 is vacuous');
  assert.ok(!withoutImport.includes('class="import-btn"'), 'sanity: mutated slice lacks the control');
}
console.log('  mutation check: removing a control from the slice makes containment fail: OK');

// ── 3. #corner-pills wraps BOTH the login pill and the settings pill ──────────────────────────
const cornerPills = divBlock(html, /<div id="corner-pills"/);
assert.ok(cornerPills.includes('id="acct-badge"'), '#corner-pills contains the login pill');
assert.ok(cornerPills.includes('id="settings-pill"'), '#corner-pills contains the settings pill');
console.log('  #corner-pills wraps both the login pill and the settings pill: OK');

// ── 4. THE ACCEPTANCE CLAIM: settings-pill is visible on every page, unlike acct-badge ────────
// acct-badge is hidden without a backend (`display:none` inline, only cleared by JS when
// canGenerate). settings-pill must carry NO such default hiding — it needs to work in the static
// build, which never sets canGenerate.
{
  const pillTag = /<button id="settings-pill"[^>]*>/.exec(html);
  assert.ok(pillTag, 'settings-pill button found');
  assert.ok(!/display:\s*none/.test(pillTag[0]),
    'THE REGRESSION: settings-pill must not default to display:none, or it never appears in the ' +
    'static build (which never sets APP.info.canGenerate)');
}
console.log('  settings-pill has no default display:none: OK');

// ── 5. The teacher-mode toggle is DOWN to one instance, and the old markup is really gone ─────
// The CURRENT claim (user follow-up after v81_aa), replacing v78_f's three-instance one.
assert.ok(/const _TEACHER_TOGGLES = \[\s*\{ id: 'teacher-mode-btn', compact: false \},\s*\];/.test(html),
  '_TEACHER_TOGGLES must be down to the single settings-modal instance');
for (const gone of ['teacher-mode-bar', 'teacher-ico-ls', 'teacher-ico-sl']) {
  assert.ok(!html.includes(`id="${gone}"`),
    `THE REGRESSION: the old v78_f markup (id="${gone}") must be fully gone, not just unlisted`);
}
console.log('  teacher-mode toggle is down to the single settings-modal instance, old markup gone: OK');

// ── 6. openSettings()/closeSettings() actually toggle the modal ───────────────────────────────
{
  const C = loadClient({ quiet: true });
  C.run('openSettings(); true;');
  assert.strictEqual(C.run("document.getElementById('settings-modal').style.display"), 'flex',
    'openSettings() shows the card');
  C.run('closeSettings(); true;');
  assert.strictEqual(C.run("document.getElementById('settings-modal').style.display"), 'none',
    'closeSettings() hides the card again');
}
console.log('  openSettings()/closeSettings() toggle the modal: OK');

// ── 7. The new title string lives in ui.json (en only) and is wired ───────────────────────────
assert.strictEqual(uiJson.en['settings.title'], 'Settings', 'settings.title exists in the en table');
assert.ok(/_setText\('settings-title', '⚙️ '\+t\('settings\.title'\)\)/.test(html),
  'settings-title is set from t(\'settings.title\') in applyUIStrings()');
console.log('  settings.title is in ui.json (en) and wired via applyUIStrings(): OK');

console.log('unit-settings-card: ALL PASSED');
