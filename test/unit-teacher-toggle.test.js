// unit-teacher-toggle.test.js
// v78_f (user testing notes, group B) — the teacher-mode switch is reachable from every page that
// carries the footer controls, not only the landing page.
//
// User: "Teacher-mode switch at the bottom of every page, beside the UI-language and mute controls.
// (Will later depend on credentials.)"
//
// Two things this file is really guarding, neither of which is "a button exists":
//
//   1. **One state rule, three presentations.** The landing entry is the full-width labelled
//      button; the two footer entries are compact icons. Three copies of "which icon means which
//      state" is how v71_w's connector line drifted and how v77_q ended up with four card headers
//      showing four different titles. So the assertion is that all three AGREE, checked by reading
//      what they render rather than what the markup contains — the v77_q lesson exactly.
//   2. **Reachability (v71 rule).** The lesson-set page is invisible to learners (v60 learner nav),
//      so a switch placed only there would not exist for the people who need it. The storyline page
//      and the landing page are the learner-reachable ones and both must carry it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const IDS = ['teacher-mode-btn', 'teacher-ico-ls', 'teacher-ico-sl'];

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
         loadSavedList = function(){};
         buildPath = function(){};
         _renderStorylineScreen = function(){ APP._slRendered = (APP._slRendered||0)+1; };
         true;`, 'seed');
  return C;
}

// ── 1. Every toggle exists in the MARKUP ─────────────────────────────────────
// Rule 16: the stub DOM auto-vivifies any id, so getElementById proves nothing on its own. A typo
// in a footer id would otherwise "pass" for ever while the button was absent from the page.
{
  for (const id of IDS) {
    assert.ok(new RegExp(`id="${id}"`).test(html), `${id} is present in index.html's markup`);
  }
  // And each footer one really sits in its footer, beside the mute control, rather than anywhere
  // that happens to parse. Checked by locating the footer block and looking inside it.
  for (const [footer, id] of [['lang-footer-lessonset', 'teacher-ico-ls'],
                              ['lang-footer-storyline', 'teacher-ico-sl']]) {
    const at = html.indexOf(`id="${footer}"`);
    assert.ok(at > 0, `${footer} exists`);
    const block = html.slice(at, html.indexOf('</div>\n', html.indexOf('mute-btn', at)));
    assert.ok(block.includes(`id="${id}"`), `${id} sits inside ${footer}, beside the mute control`);
  }
  console.log('  all three toggles are in the markup, the footer ones beside mute');
}

// ── 2. No inline handler — a headless test must be able to click them ────────
// Standing rule 22: the stub DOM does not turn onclick="f()" into a callable property.
{
  for (const id of IDS.slice(1)) {
    assert.ok(!new RegExp(`id="${id}"[^>]*onclick=`).test(html),
      `${id} assigns its handler in JS, not inline`);
  }
  console.log('  handlers are assigned in JS, so they are clickable headlessly');
}

// ── 3. All three render the SAME state, in both states ──────────────────────
// The payload. Compared by what they RENDER (title/label), not by what the markup contains.
{
  const C = client();
  for (const on of [false, true]) {
    C.run(`APP._teacherMode = ${on}; updateTeacherModeBtn();`);
    const seen = IDS.map(id => JSON.parse(C.run(`(function(){
      var b = document.getElementById(${JSON.stringify(id)});
      return JSON.stringify({ text: b.textContent || '', title: b.title || '' });
    })()`)));
    const expectLabel = on ? UI.en['teacher.mode_on'] : UI.en['teacher.mode_off'];
    const expectIcon = Array.from(expectLabel)[0];
    assert.strictEqual(seen[0].text, expectLabel,
      `the landing button shows the full label when teacherMode=${on}`);
    for (let i = 1; i < IDS.length; i++) {
      assert.strictEqual(seen[i].text, expectIcon,
        `${IDS[i]} shows the state icon when teacherMode=${on}`);
      assert.strictEqual(seen[i].title, expectLabel,
        `${IDS[i]} carries the full label as its tooltip, so the meaning stays reachable`);
    }
  }
  console.log('  all three agree in both states, icon derived from the same string');
}

// ── 4. Non-vacuity: the two states are actually different ───────────────────
// Without this, §3 would pass on a control that rendered the same thing for ON and OFF.
{
  assert.notStrictEqual(UI.en['teacher.mode_on'], UI.en['teacher.mode_off'],
    'the two labels differ in en');
  assert.notStrictEqual(Array.from(UI.en['teacher.mode_on'])[0],
                        Array.from(UI.en['teacher.mode_off'])[0],
    'and so do their leading icons — otherwise the compact button could never show state');
  console.log('  the ON and OFF renderings genuinely differ');
}

// ── 5. Clicking any of them flips the mode, persists it, and re-syncs ───────
// Driven through the real handler on each control in turn, because "the landing one works" says
// nothing about the two that were added.
{
  for (const id of IDS) {
    const C = client();
    C.run(`APP._teacherMode = false; updateTeacherModeBtn();`);
    C.run(`document.getElementById(${JSON.stringify(id)}).onclick();`);
    assert.strictEqual(C.run(`APP._teacherMode`), true, `clicking ${id} turns teacher mode on`);
    assert.strictEqual(C.run(`localStorage.getItem('dz_teacher_mode')`), '1',
      `clicking ${id} persists the new state across reloads`);
    // And the OTHER controls followed — the point of one updater. Compared on rendered TEXT, which
    // is the state signal for both presentations; the landing button's TITLE is deliberately the
    // static tooltip key rather than the label, so it is not a state signal at all.
    const onLabel = UI.en['teacher.mode_on'];
    for (const other of IDS.filter(x => x !== id)) {
      const expect = (other === 'teacher-mode-btn') ? onLabel : Array.from(onLabel)[0];
      assert.strictEqual(C.run(`document.getElementById(${JSON.stringify(other)}).textContent`),
        expect, `${other} updated too, though ${id} was the one clicked`);
    }
    C.run(`document.getElementById(${JSON.stringify(id)}).onclick();`);
    assert.strictEqual(C.run(`APP._teacherMode`), false, `clicking ${id} again turns it back off`);
    assert.strictEqual(C.run(`localStorage.getItem('dz_teacher_mode')`), '0', 'and persists that too');
  }
  console.log('  each control toggles, persists, and re-syncs the others');
}

// ── 6. The sync happens AFTER the screen re-renders ─────────────────────────
// The toggle now lives inside the screens toggleTeacherMode redraws. Syncing first and redrawing
// second would leave the control showing its pre-click state on exactly the page it was clicked
// from. Asserted by ordering: the storyline re-render must have run before the final sync.
{
  const C = client();
  C.run(`
    APP._teacherMode = false;
    APP._slScreen = { chainId:'c', encodedChain:'e', topics:['A'] };
    document.getElementById('storyline-screen').classList.add('active');
    APP._order = [];
    _renderStorylineScreen = function(){ APP._order.push('render'); };
    var _u = updateTeacherModeBtn;
    updateTeacherModeBtn = function(){ APP._order.push('sync'); return _u.apply(null, arguments); };
    toggleTeacherMode();
    true;`, 'order');
  const order = JSON.parse(C.run(`JSON.stringify(APP._order)`));
  assert.ok(order.includes('render') && order.includes('sync'),
    'both the re-render and the sync ran (non-vacuity)');
  assert.ok(order.lastIndexOf('sync') > order.indexOf('render'),
    'the toggle is re-synced AFTER the screen it lives on is redrawn');
  console.log('  the sync follows the re-render, so the clicked page shows the new state');
}

// ── 7. No new i18n ──────────────────────────────────────────────────────────
// Deliberate: the compact button reuses the existing labels and derives its icon from them, so this
// change adds nothing to the translate pass. Asserted so a later "just hard-code the emoji" edit
// has to justify itself.
{
  for (const k of ['teacher.mode_on', 'teacher.mode_off', 'teacher.unlock_tooltip']) {
    assert.ok(UI.en[k], `${k} exists in en`);
  }
  assert.ok(!/teacher\.(ico|toggle|switch)/.test(html),
    'no new teacher.* key was invented — the existing labels carry both presentations');
  console.log('  reuses the existing keys; nothing new owed to the translate pass');
}

console.log('unit-teacher-toggle: ALL PASSED');
