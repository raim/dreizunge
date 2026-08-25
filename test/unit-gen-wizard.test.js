// unit-gen-wizard.test.js
// PLAN §13 milestone 1 (v85_c) — the generator-page wizard shell: a NAVIGATION layer over the
// EXISTING language/script (#gen-card-1, .lang-box), text-source (#gen-card-2, topic-input/
// user-story-checks/pdf-panel/user-story-panel/dialect-panel) and "everything else, for now"
// (#gen-card-3, #gen-form-section/#gen-btn-row) markup. Pure re-layout per the roadmap's approved
// approach — no id/behaviour change to anything it wraps, no new validation. Contract under test,
// against RENDERED/computed state, not source text alone (standing rule 2), except where the claim
// genuinely IS about source-text nesting (§1 below, matching unit-dialect-panel.test.js's own
// precedent for that kind of claim):
//   • §1 markup nesting: .lang-box lives inside #gen-card-1; topic-input/pdf-panel/user-story-panel/
//     dialect-panel all live inside #gen-card-2; gen-form-section/gen-btn-row live inside #gen-card-3.
//   • §2 default state: card 1 visible, cards 2/3 hidden, pill 1 active — the other two not.
//   • §3 _genWizardNext()/_genWizardBack(): step forward/back, CLAMPED at the ends (never below 1 or
//     above 3), each showing exactly one card and marking exactly one pill active.
//   • §4 _genWizardGoto(n): jumps directly (pill click), same single-card/single-active-pill
//     invariant.
//   • §5 show('generation-screen') resets the wizard to step 1 — even from step 3 — so a learner who
//     left mid-wizard and comes back always re-enters at the start. Mutation-tested: removing the
//     hook must turn this red.
//   • §6 #gen-area's own display is NEVER touched by the wizard (unit-ui-journeys.test.js's own
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

// ── 1. Markup nesting: each existing block lives inside its wizard card ──────────
{
  const bounds = id => { const open = html.indexOf('id="' + id + '"'); assert.ok(open >= 0, `#${id} exists`); return open; };
  const card1Open = bounds('gen-card-1'), card1Close = html.indexOf('end gen-card-1', card1Open);
  const card2Open = bounds('gen-card-2'), card2Close = html.indexOf('end gen-card-2', card2Open);
  const card3Open = bounds('gen-card-3'), card3Close = html.indexOf('end gen-card-3', card3Open);
  assert.ok(card1Close > card1Open, '#gen-card-1 has a matching "end gen-card-1" marker after it');
  assert.ok(card2Close > card2Open, '#gen-card-2 has a matching "end gen-card-2" marker after it');
  assert.ok(card3Close > card3Open, '#gen-card-3 has a matching "end gen-card-3" marker after it');

  const within = (needle, lo, hi) => { const at = html.indexOf(needle, lo); return at > lo && at < hi; };
  assert.ok(within('class="lang-box"', card1Open, card1Close), '.lang-box is inside #gen-card-1');
  for (const id of ['topic-input', 'pdf-panel', 'user-story-panel', 'dialect-panel']) {
    assert.ok(within('id="' + id + '"', card2Open, card2Close), `#${id} is inside #gen-card-2`);
  }
  for (const id of ['gen-form-section', 'gen-btn-row']) {
    assert.ok(within('id="' + id + '"', card3Open, card3Close), `#${id} is inside #gen-card-3`);
  }
}
console.log('  markup: .lang-box in card 1; topic/pdf/story/dialect panels in card 2; form-section/gen-btn-row in card 3: OK');

// ── 2. Default state: card 1 shown, 2/3 hidden, pill 1 (only) active ─────────────
{
  const C = client();
  const r = C.run(`_genWizardGoto(1);
    ({ c1: document.getElementById('gen-card-1').style.display,
       c2: document.getElementById('gen-card-2').style.display,
       c3: document.getElementById('gen-card-3').style.display,
       p1: document.getElementById('gen-step-pill-1').classList.contains('active'),
       p2: document.getElementById('gen-step-pill-2').classList.contains('active'),
       p3: document.getElementById('gen-step-pill-3').classList.contains('active') })`);
  assert.strictEqual(r.c1, '', 'card 1 visible (no inline display override)');
  assert.strictEqual(r.c2, 'none', 'card 2 hidden');
  assert.strictEqual(r.c3, 'none', 'card 3 hidden');
  assert.deepStrictEqual([r.p1, r.p2, r.p3], [true, false, false], 'exactly pill 1 is active');
}
console.log('  default (step 1): card 1 shown, cards 2/3 hidden, only pill 1 active: OK');

// ── 3. Next/Back: step forward/back, clamped at both ends ────────────────────────
{
  const C = client();
  const seq = C.run(`_genWizardGoto(1);
    var steps = [];
    function snap(){ steps.push({ step: _genWizardStep,
      c1: document.getElementById('gen-card-1').style.display,
      c2: document.getElementById('gen-card-2').style.display,
      c3: document.getElementById('gen-card-3').style.display }); }
    snap();
    _genWizardNext(); snap();
    _genWizardNext(); snap();
    _genWizardNext(); snap();   // past the last card — must clamp at 3
    _genWizardBack(); snap();
    _genWizardBack(); snap();
    _genWizardBack(); snap();   // past the first card — must clamp at 1
    JSON.stringify(steps);`);
  const steps = JSON.parse(seq);
  assert.deepStrictEqual(steps.map(s => s.step), [1, 2, 3, 3, 2, 1, 1], 'step sequence clamps at both ends');
  assert.deepStrictEqual(steps[2], { step: 3, c1: 'none', c2: 'none', c3: '' }, 'step 3: only card 3 visible');
  assert.deepStrictEqual(steps[3], steps[2], 'Next beyond the last card is a no-op (still exactly card 3)');
  assert.deepStrictEqual(steps[6], steps[5], 'Back before the first card is a no-op (still exactly card 1)');
}
console.log('  _genWizardNext()/_genWizardBack(): clamp at [1,3], exactly one card visible at every step: OK');

// ── 4. _genWizardGoto(n): direct jump, same single-active-pill invariant ─────────
{
  const C = client();
  const r = C.run(`_genWizardGoto(1); _genWizardGoto(3);
    ({ step: _genWizardStep,
       c3: document.getElementById('gen-card-3').style.display,
       p3active: document.getElementById('gen-step-pill-3').classList.contains('active'),
       p1active: document.getElementById('gen-step-pill-1').classList.contains('active') })`);
  assert.strictEqual(r.step, 3, '_genWizardGoto(3) jumps directly, not one step at a time');
  assert.strictEqual(r.c3, '', 'card 3 visible after the jump');
  assert.strictEqual(r.p3active, true, 'pill 3 active after the jump');
  assert.strictEqual(r.p1active, false, 'pill 1 no longer active after the jump');
}
console.log('  _genWizardGoto(n): jumps directly (pill click), pill-active state follows: OK');

// ── 5. show(\'generation-screen\') resets the wizard to step 1 ────────────────────
// Mutation-tested: comment out the hook in show() and this must go red.
{
  const C = client();
  const r = C.run(`_genWizardGoto(3);
    var before = _genWizardStep;
    show('generation-screen');
    ({ before: before, after: _genWizardStep,
       c1: document.getElementById('gen-card-1').style.display })`);
  assert.strictEqual(r.before, 3, 'setup: wizard was left on step 3');
  assert.strictEqual(r.after, 1, "show('generation-screen') resets the wizard back to step 1");
  assert.strictEqual(r.c1, '', 'card 1 is visible again after the reset');
}
console.log('  show(\'generation-screen\'): always resets the wizard to step 1, even from step 3: OK');

// ── 6. #gen-area's own display is untouched — the wizard's zero-collateral check ──
{
  const C = client();
  const r = C.run(`_genWizardGoto(1); _genWizardGoto(2); _genWizardGoto(3);
    document.getElementById('gen-area').style.display`);
  assert.notStrictEqual(r, 'none', "#gen-area itself is never hidden by wizard navigation (unit-ui-journeys.test.js's own invariant)");
}
console.log("  #gen-area's own display is never touched by wizard navigation: OK");

console.log('unit-gen-wizard: ALL PASSED');
