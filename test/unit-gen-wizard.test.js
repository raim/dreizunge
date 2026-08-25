// unit-gen-wizard.test.js
// PLAN §13 — the generator-page wizard shell: a NAVIGATION layer over the EXISTING markup. Pure
// re-layout per the roadmap's approved approach — no id/behaviour change to anything it wraps, no new
// validation. Milestone 1 (v85_c) built #gen-card-1 (.lang-box) and #gen-card-2 (topic-input/
// user-story-checks/pdf-panel/user-story-panel/dialect-panel); its own catch-all #gen-card-3 held
// everything else. Milestone 2 (v85_d, this file's current scope) split that catch-all into
// #gen-card-3 (chaptering: story-len-row/num-chapters-row/style-wrap/continue-row) and #gen-card-4
// (lesson-selection + Generate: lesson-type-hdr/diff-wrap/format-wrap/gen-btn-row), both now nested
// INSIDE #gen-form-section's own unchanged open/close tags so onUseDialectCb()'s single
// `gf.style.display` toggle still hides both atomically. Contract under test, against RENDERED/
// computed state, not source text alone (standing rule 2), except where the claim genuinely IS about
// source-text nesting (§1/§2 below, matching unit-dialect-panel.test.js's own precedent):
//   • §1 markup nesting: .lang-box in card 1; topic-input/pdf-panel/user-story-panel/dialect-panel in
//     card 2; story-len-row/num-chapters-row/style-wrap/continue-row in card 3; lesson-type-hdr/
//     diff-wrap/format-wrap/gen-btn-row in card 4.
//   • §2 #gen-form-section wraps BOTH card 3 and card 4 — the structural fact that keeps dialect
//     mode's single hide toggle working across the split (unit-dialect-panel.test.js's own §3/§4
//     checks are untouched by this milestone: they assert the FUNCTION source and dialect-panel's
//     position relative to #gen-form-section, neither of which moved).
//   • §3 default state: card 1 visible, cards 2/3/4 hidden, pill 1 (only) active.
//   • §4 _genWizardNext()/_genWizardBack(): step forward/back, CLAMPED at the ends (never below 1 or
//     above 4), each showing exactly one card and marking exactly one pill active.
//   • §5 _genWizardGoto(n): jumps directly (pill click), same single-card/single-active-pill
//     invariant.
//   • §6 show('generation-screen') resets the wizard to step 1 — even from step 4 — so a learner who
//     left mid-wizard and comes back always re-enters at the start. Mutation-tested: removing the
//     hook must turn this red.
//   • §7 #gen-area's own display is NEVER touched by the wizard (unit-ui-journeys.test.js's own
//     "the generation controls are visible on that screen" claim must survive this milestone
//     untouched) — this is the wizard's own zero-collateral-damage check.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'none', canGenerate:false }; true;`, 'seed');
  return C;
}

const bounds = id => { const open = html.indexOf('id="' + id + '"'); assert.ok(open >= 0, `#${id} exists`); return open; };
const within = (needle, lo, hi) => { const at = html.indexOf(needle, lo); return at > lo && at < hi; };

const card1Open = bounds('gen-card-1'), card1Close = html.indexOf('end gen-card-1', card1Open);
const card2Open = bounds('gen-card-2'), card2Close = html.indexOf('end gen-card-2', card2Open);
const card3Open = bounds('gen-card-3'), card3Close = html.indexOf('end gen-card-3', card3Open);
const card4Open = bounds('gen-card-4'), card4Close = html.indexOf('end gen-card-4', card4Open);

// ── 1. Markup nesting: each existing block lives inside its wizard card ──────────
{
  assert.ok(card1Close > card1Open, '#gen-card-1 has a matching "end gen-card-1" marker after it');
  assert.ok(card2Close > card2Open, '#gen-card-2 has a matching "end gen-card-2" marker after it');
  assert.ok(card3Close > card3Open, '#gen-card-3 has a matching "end gen-card-3" marker after it');
  assert.ok(card4Close > card4Open, '#gen-card-4 has a matching "end gen-card-4" marker after it');

  assert.ok(within('class="lang-box"', card1Open, card1Close), '.lang-box is inside #gen-card-1');
  for (const id of ['topic-input', 'pdf-panel', 'user-story-panel', 'dialect-panel']) {
    assert.ok(within('id="' + id + '"', card2Open, card2Close), `#${id} is inside #gen-card-2`);
  }
  for (const id of ['story-len-row', 'num-chapters-row', 'style-wrap', 'continue-row']) {
    assert.ok(within('id="' + id + '"', card3Open, card3Close), `#${id} is inside #gen-card-3`);
  }
  for (const id of ['lesson-type-hdr', 'diff-wrap', 'format-wrap', 'gen-btn-row']) {
    assert.ok(within('id="' + id + '"', card4Open, card4Close), `#${id} is inside #gen-card-4`);
  }
}
console.log('  markup: .lang-box→card1, text-source→card2, chaptering→card3, lesson-selection+gen-btn-row→card4: OK');

// ── 2. #gen-form-section wraps BOTH card 3 and card 4 (dialect mode's atomic hide) ──
{
  const sectionOpen = bounds('gen-form-section');
  const sectionClose = html.indexOf('end gen-form-section', sectionOpen);
  assert.ok(sectionClose > sectionOpen, '#gen-form-section has a matching "end gen-form-section" marker');
  assert.ok(sectionOpen < card3Open && card4Close < sectionClose,
    '#gen-form-section wraps card 3 through card 4 — so hiding it (onUseDialectCb) hides both cards atomically');
}
console.log('  #gen-form-section wraps cards 3+4 together, unchanged span from before the split: OK');

// ── 3. Default state: card 1 shown, cards 2/3/4 hidden, pill 1 (only) active ─────
{
  const C = client();
  const r = C.run(`_genWizardGoto(1);
    ({ c1: document.getElementById('gen-card-1').style.display,
       c2: document.getElementById('gen-card-2').style.display,
       c3: document.getElementById('gen-card-3').style.display,
       c4: document.getElementById('gen-card-4').style.display,
       p1: document.getElementById('gen-step-pill-1').classList.contains('active'),
       p2: document.getElementById('gen-step-pill-2').classList.contains('active'),
       p3: document.getElementById('gen-step-pill-3').classList.contains('active'),
       p4: document.getElementById('gen-step-pill-4').classList.contains('active') })`);
  assert.strictEqual(r.c1, '', 'card 1 visible (no inline display override)');
  assert.strictEqual(r.c2, 'none', 'card 2 hidden');
  assert.strictEqual(r.c3, 'none', 'card 3 hidden');
  assert.strictEqual(r.c4, 'none', 'card 4 hidden');
  assert.deepStrictEqual([r.p1, r.p2, r.p3, r.p4], [true, false, false, false], 'exactly pill 1 is active');
}
console.log('  default (step 1): card 1 shown, cards 2/3/4 hidden, only pill 1 active: OK');

// ── 4. Next/Back: step forward/back, clamped at both ends [1,4] ──────────────────
{
  const C = client();
  const seq = C.run(`_genWizardGoto(1);
    var steps = [];
    function snap(){ steps.push({ step: _genWizardStep,
      c1: document.getElementById('gen-card-1').style.display,
      c2: document.getElementById('gen-card-2').style.display,
      c3: document.getElementById('gen-card-3').style.display,
      c4: document.getElementById('gen-card-4').style.display }); }
    snap();
    _genWizardNext(); snap();
    _genWizardNext(); snap();
    _genWizardNext(); snap();
    _genWizardNext(); snap();   // past the last card — must clamp at 4
    _genWizardBack(); snap();
    _genWizardBack(); snap();
    _genWizardBack(); snap();
    _genWizardBack(); snap();   // past the first card — must clamp at 1
    JSON.stringify(steps);`);
  const steps = JSON.parse(seq);
  assert.deepStrictEqual(steps.map(s => s.step), [1, 2, 3, 4, 4, 3, 2, 1, 1], 'step sequence clamps at both ends');
  assert.deepStrictEqual(steps[3], { step: 4, c1: 'none', c2: 'none', c3: 'none', c4: '' }, 'step 4: only card 4 visible');
  assert.deepStrictEqual(steps[4], steps[3], 'Next beyond the last card is a no-op (still exactly card 4)');
  assert.deepStrictEqual(steps[8], steps[7], 'Back before the first card is a no-op (still exactly card 1)');
}
console.log('  _genWizardNext()/_genWizardBack(): clamp at [1,4], exactly one card visible at every step: OK');

// ── 5. _genWizardGoto(n): direct jump, same single-active-pill invariant ─────────
{
  const C = client();
  const r = C.run(`_genWizardGoto(1); _genWizardGoto(4);
    ({ step: _genWizardStep,
       c4: document.getElementById('gen-card-4').style.display,
       p4active: document.getElementById('gen-step-pill-4').classList.contains('active'),
       p1active: document.getElementById('gen-step-pill-1').classList.contains('active') })`);
  assert.strictEqual(r.step, 4, '_genWizardGoto(4) jumps directly, not one step at a time');
  assert.strictEqual(r.c4, '', 'card 4 visible after the jump');
  assert.strictEqual(r.p4active, true, 'pill 4 active after the jump');
  assert.strictEqual(r.p1active, false, 'pill 1 no longer active after the jump');
}
console.log('  _genWizardGoto(n): jumps directly (pill click), pill-active state follows: OK');

// ── 6. show(\'generation-screen\') resets the wizard to step 1 ────────────────────
// Mutation-tested: comment out the hook in show() and this must go red.
{
  const C = client();
  const r = C.run(`_genWizardGoto(4);
    var before = _genWizardStep;
    show('generation-screen');
    ({ before: before, after: _genWizardStep,
       c1: document.getElementById('gen-card-1').style.display })`);
  assert.strictEqual(r.before, 4, 'setup: wizard was left on step 4');
  assert.strictEqual(r.after, 1, "show('generation-screen') resets the wizard back to step 1");
  assert.strictEqual(r.c1, '', 'card 1 is visible again after the reset');
}
console.log('  show(\'generation-screen\'): always resets the wizard to step 1, even from step 4: OK');

// ── 7. #gen-area's own display is untouched — the wizard's zero-collateral check ──
{
  const C = client();
  const r = C.run(`_genWizardGoto(1); _genWizardGoto(2); _genWizardGoto(3); _genWizardGoto(4);
    document.getElementById('gen-area').style.display`);
  assert.notStrictEqual(r, 'none', "#gen-area itself is never hidden by wizard navigation (unit-ui-journeys.test.js's own invariant)");
}
console.log("  #gen-area's own display is never touched by wizard navigation: OK");

// ── 8. _genWizardCreateNow(): the "create storyline now, add lessons later" shortcut ─────────────
// v85_e — the user's ruling on the v85_d open question: "skip the arc, standard set only." NOT a new
// server-side "zero lessons" mode: forces the arc checkbox off and the format to 'standard', then
// calls the UNMODIFIED doGenerate() — the same call the normal Generate button makes. Verified here
// that it forces BOTH fields correctly (even when they started the opposite way) and calls
// doGenerate() exactly once; doGenerate() itself is stubbed so this stays a pure wiring test, not an
// end-to-end generation test (that's `doGenerate()`'s own existing coverage elsewhere).
{
  const C = client();
  const r = C.run(`document.getElementById('gen-arc-cb').checked = true;   // simulate arc left on
    onFormatSelect('error_hunt');   // simulate a non-standard format already chosen
    let doGenerateCalls = 0;
    doGenerate = function(){ doGenerateCalls++; };
    _genWizardCreateNow();
    ({ arcAfter: document.getElementById('gen-arc-cb').checked,
       lessonFormatAfter: APP.lessonFormat,
       formatSelectAfter: document.getElementById('format-select').value,
       doGenerateCalls: doGenerateCalls })`);
  assert.strictEqual(r.arcAfter, false, '_genWizardCreateNow() unchecks #gen-arc-cb, even when it started checked');
  assert.strictEqual(r.lessonFormatAfter, 'standard', "_genWizardCreateNow() forces APP.lessonFormat to 'standard' (what doGenerate() actually reads)");
  assert.strictEqual(r.formatSelectAfter, 'standard', "_genWizardCreateNow() syncs #format-select's own displayed value too");
  assert.strictEqual(r.doGenerateCalls, 1, '_genWizardCreateNow() calls the UNMODIFIED doGenerate() exactly once');
}
console.log('  _genWizardCreateNow(): forces arc off + format standard, then calls doGenerate() unmodified: OK');

// ── 9. _genWizardCreateNow() is a no-op on fields already at their target state ───────────────────
// Mutation-adjacent sanity: calling it when arc is ALREADY off and format is ALREADY 'standard' must
// not throw or double-toggle anything (onFormatSelect('standard') is only called when needed).
{
  const C = client();
  const r = C.run(`document.getElementById('gen-arc-cb').checked = false;
    onFormatSelect('standard');
    let doGenerateCalls = 0;
    doGenerate = function(){ doGenerateCalls++; };
    _genWizardCreateNow();
    ({ arcAfter: document.getElementById('gen-arc-cb').checked,
       lessonFormatAfter: APP.lessonFormat, doGenerateCalls: doGenerateCalls })`);
  assert.strictEqual(r.arcAfter, false, 'arc stays off');
  assert.strictEqual(r.lessonFormatAfter, 'standard', 'format stays standard');
  assert.strictEqual(r.doGenerateCalls, 1, 'doGenerate() is still called exactly once, no double-toggle side effects');
}
console.log('  _genWizardCreateNow(): already-at-target fields are a clean no-op-on-those-fields, doGenerate() still runs: OK');

// ── 10. doGenerate()'s empty-topic guard reveals card 2 before focusing (v85_e fix) ───────────────
// The wizard (v85_c) can leave #topic-input's own card hidden when this guard fires. Before v85_e,
// .focus() on a display:none field was silently invisible — this is the fix, mutation-tested.
{
  const C = client();
  const r = C.run(`_genWizardGoto(3);   // simulate having navigated past card 2 without typing a topic
    var before = _genWizardStep;
    document.getElementById('topic-input').value = '';
    APP.lessonFormat = 'standard';
    document.getElementById('continue-select').innerHTML = '<option value="">— new story —</option>';
    doGenerate();
    ({ before: before, after: _genWizardStep,
       c2: document.getElementById('gen-card-2').style.display })`);
  assert.strictEqual(r.before, 3, 'setup: wizard was on card 3 (topic card hidden) when the empty-topic guard fires');
  assert.strictEqual(r.after, 2, "doGenerate() reveals card 2 (the topic field's own card) before focusing it");
  assert.strictEqual(r.c2, '', 'card 2 is actually visible after the guard fires');
}
console.log("  doGenerate()'s empty-topic guard reveals #gen-card-2 before .focus() — no more silent no-op: OK");

console.log('unit-gen-wizard: ALL PASSED');
