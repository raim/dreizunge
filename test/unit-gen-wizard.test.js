// unit-gen-wizard.test.js
// The generator-page wizard shell. Built by PLAN §13 (v85_c/v85_d) as a NAVIGATION layer over the
// EXISTING markup — pure re-layout, no id/behaviour change to anything it wraps. It was a FOUR-card
// flow (Language / Text / Chapters / Lessons) until item AL (roadmap_v87.md), which collapsed it to
// THREE on the user's own ruling: "the #chapters and text length selector for the LLM route should
// be in 2/Text. 3 could be skipped, and current 4/Lessons should be the ONLY place where we can
// select lesson types to be generated (optionally)." The "Chapters" card was redistributed and
// DELETED, not renamed — that redistribution is what §1/§2 pin, block by block.
//
// Contract under test, against RENDERED/computed state, not source text alone (standing rule 2),
// except where the claim genuinely IS about source-text nesting (§1/§2, matching
// unit-dialect-panel.test.js's own precedent):
//   • §1 markup nesting, per card: .lang-box AND continue-from (the item AL move) in card 1;
//     topic-input/panels AND the three text-shaping rows (the item AL move) in card 2; every
//     lesson-type control — incl. the arc row and vocab-mode, both moved by item AL — in card 3.
//   • §2 the DELETIONS item AL made, asserted as absent: #gen-card-4, #gen-create-now-btn,
//     _genWizardCreateNow, and the 4th pill. A move is only half-done if the old copy survives.
//   • §3 #gen-form-section wraps the lesson card — dialect mode's single hide toggle still works —
//     AND the three moved text-shaping rows are OUTSIDE it, which is the fact that makes
//     _applyTextShapingVisibility() necessary rather than decorative (§8 proves the behaviour).
//   • §4 default state: card 1 visible, cards 2/3 hidden, pill 1 (only) active.
//   • §5 _genWizardNext()/_genWizardBack(): step forward/back, CLAMPED at [1,3] now, each showing
//     exactly one card and marking exactly one pill active.
//   • §6 _genWizardGoto(n): jumps directly (pill click), same single-card/single-active-pill
//     invariant, and clamps a stale goto(4) down to 3.
//   • §7 show('generation-screen') resets the wizard to step 1. Mutation-tested.
//   • §8 _applyTextShapingVisibility(): the behaviour the move made necessary. Own-story hides
//     length+chapters but NOT style (measured: pdfGenerateAll() really does send storyStyle, and it
//     reaches sysGrammar/generateWriting — item AL's own write-up was wrong about this); dialect and
//     comic hide all three, which #gen-form-section used to do for free.
//   • §9 #gen-area's own display is NEVER touched by wizard navigation.
//   • §10 doGenerate()'s empty-topic guard still reveals card 2 before focusing.
//   • §11 the renumbered pill 3 reads from a key that EXISTS in ui.json `en`, and is not the stale
//     "3 · Chapters" string.
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

// ── 1. Markup nesting: every block sits in the card item AL assigned it ──────────
{
  assert.ok(card1Close > card1Open, '#gen-card-1 has a matching "end gen-card-1" marker after it');
  assert.ok(card2Close > card2Open, '#gen-card-2 has a matching "end gen-card-2" marker after it');
  assert.ok(card3Close > card3Open, '#gen-card-3 has a matching "end gen-card-3" marker after it');
  assert.ok(card1Close < card2Open && card2Close < card3Open, 'the three cards appear in order 1, 2, 3');

  assert.ok(within('class="lang-box"', card1Open, card1Close), '.lang-box is inside #gen-card-1');
  // item AL: continue-from and its two sub-controls move to card 1 — mode-independent continuation.
  for (const id of ['continue-row', 'continue-select', 'cont-all-langs', 'use-full-chain-row', 'use-full-chain-cb']) {
    assert.ok(within('id="' + id + '"', card1Open, card1Close), `#${id} is inside #gen-card-1 (item AL)`);
  }
  for (const id of ['topic-input', 'pdf-panel', 'user-story-panel', 'dialect-panel', 'comic-panel']) {
    assert.ok(within('id="' + id + '"', card2Open, card2Close), `#${id} is inside #gen-card-2`);
  }
  // item AL: the text-SHAPING controls move to the card that owns the text.
  for (const id of ['story-len-row', 'num-chapters-row', 'style-wrap']) {
    assert.ok(within('id="' + id + '"', card2Open, card2Close), `#${id} is inside #gen-card-2 (item AL)`);
  }
  // item AL: card 3 is the ONE canonical place lesson types are chosen. #gen-arc-row was nested
  // inside #num-chapters-row (easy to miss) and #reinforce-prior-row inside #continue-row — both
  // moved here, so pinning them is what makes "one place" a checked claim rather than a comment.
  for (const id of ['gen-skip-lessons-row', 'lesson-type-hdr', 'diff-wrap', 'format-wrap',
                    'gen-arc-row', 'gen-arc-types', 'gen-arc-script-row', 'per-chapter-row',
                    'reinforce-prior-row', 'vocab-mode-select', 'post-gen-row', 'gen-btn-row']) {
    assert.ok(within('id="' + id + '"', card3Open, card3Close), `#${id} is inside #gen-card-3`);
  }
}
console.log('  markup: lang+continue-from→card1, text+shaping→card2, every lesson-type control→card3: OK');

// ── 2. The deletions item AL made — a move is half-done if the old copy survives ──
{
  assert.strictEqual(html.indexOf('id="gen-card-4"'), -1, '#gen-card-4 is gone (the wizard is a 3-step flow)');
  assert.strictEqual(html.indexOf('id="gen-step-pill-4"'), -1, 'the 4th step pill is gone');
  assert.strictEqual(html.indexOf('id="gen-create-now-btn"'), -1,
    '#gen-create-now-btn is gone — superseded by #gen-skip-lessons-cb, which goes further (zero lessons)');
  assert.strictEqual(html.indexOf('_genWizardCreateNow'), -1,
    '_genWizardCreateNow() is gone too, not just its button (no orphaned dead function)');
  // Each moved id must appear EXACTLY once in the whole file: a copy left behind in the old card
  // would still satisfy §1's "is inside card N" check, so count them rather than locate them.
  for (const id of ['continue-row', 'story-len-row', 'num-chapters-row', 'style-wrap',
                    'gen-arc-row', 'reinforce-prior-row', 'gen-skip-lessons-row']) {
    const n = html.split('id="' + id + '"').length - 1;
    assert.strictEqual(n, 1, `#${id} appears exactly once — no copy left behind by the move`);
  }
}
console.log('  deletions: #gen-card-4, pill 4, #gen-create-now-btn + its function all gone; no duplicated moved ids: OK');

// ── 3. #gen-form-section spans the lesson card ONLY — the shaping rows are outside ──
{
  const sectionOpen = bounds('gen-form-section');
  const sectionClose = html.indexOf('end gen-form-section', sectionOpen);
  assert.ok(sectionClose > sectionOpen, '#gen-form-section has a matching "end gen-form-section" marker');
  assert.ok(sectionOpen < card3Open && card3Close < sectionClose,
    '#gen-form-section wraps the lesson card — so hiding it (onUseDialectCb) still hides it atomically');
  // The fact that makes _applyTextShapingVisibility() load-bearing rather than decorative.
  for (const id of ['story-len-row', 'num-chapters-row', 'style-wrap']) {
    assert.ok(html.indexOf('id="' + id + '"') < sectionOpen,
      `#${id} is OUTSIDE #gen-form-section — dialect/comic mode's single hide toggle no longer covers it`);
  }
}
console.log('  #gen-form-section wraps the lesson card; the moved shaping rows sit outside it: OK');

// ── 4. Default state: card 1 shown, cards 2/3 hidden, pill 1 (only) active ───────
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
  // NOTE, found by writing it and watching it fail on a correct tree: "#gen-card-4 is absent" CANNOT
  // be asserted through this harness. lib-dom's makeDocument() AUTO-VIVIFIES every id asked for
  // (`getElementById` mints a div on miss, deliberately — see its own comment), so a
  // `!!document.getElementById('gen-card-4')` check is always true and its negation always red,
  // whatever the markup says. The absence claim belongs at the SOURCE layer, where it is real —
  // §2 above. Recorded here so the next reader doesn't "fix" §2 by moving it back into the DOM.
}
console.log('  default (step 1): card 1 shown, cards 2/3 hidden, only pill 1 active: OK');

// ── 5. Next/Back: step forward/back, clamped at both ends [1,3] ──────────────────
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
  assert.deepStrictEqual(steps.map(s => s.step), [1, 2, 3, 3, 2, 1, 1], 'step sequence clamps at both ends of [1,3]');
  assert.deepStrictEqual(steps[2], { step: 3, c1: 'none', c2: 'none', c3: '' }, 'step 3: only card 3 visible');
  assert.deepStrictEqual(steps[3], steps[2], 'Next beyond the last card is a no-op (still exactly card 3)');
  assert.deepStrictEqual(steps[6], steps[5], 'Back before the first card is a no-op (still exactly card 1)');
}
console.log('  _genWizardNext()/_genWizardBack(): clamp at [1,3], exactly one card visible at every step: OK');

// ── 6. _genWizardGoto(n): direct jump; a stale goto(4) clamps to 3 ───────────────
{
  const C = client();
  const r = C.run(`_genWizardGoto(1); _genWizardGoto(3);
    var jumped = { step: _genWizardStep,
       c3: document.getElementById('gen-card-3').style.display,
       p3active: document.getElementById('gen-step-pill-3').classList.contains('active'),
       p1active: document.getElementById('gen-step-pill-1').classList.contains('active') };
    _genWizardGoto(4);   // a stale caller from the 4-card era must not strand the wizard on nothing
    ({ jumped: jumped, afterStale: _genWizardStep,
       c3AfterStale: document.getElementById('gen-card-3').style.display })`);
  assert.strictEqual(r.jumped.step, 3, '_genWizardGoto(3) jumps directly, not one step at a time');
  assert.strictEqual(r.jumped.c3, '', 'card 3 visible after the jump');
  assert.strictEqual(r.jumped.p3active, true, 'pill 3 active after the jump');
  assert.strictEqual(r.jumped.p1active, false, 'pill 1 no longer active after the jump');
  assert.strictEqual(r.afterStale, 3, '_genWizardGoto(4) clamps to 3 rather than showing no card at all');
  assert.strictEqual(r.c3AfterStale, '', 'card 3 is still the visible one after the clamped goto');
}
console.log('  _genWizardGoto(n): jumps directly, and a stale goto(4) clamps to 3: OK');

// ── 7. show('generation-screen') resets the wizard to step 1 ─────────────────────
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
console.log("  show('generation-screen'): always resets the wizard to step 1, even from step 3: OK");

// ── 8. _applyTextShapingVisibility(): the behaviour the item AL move made necessary ──
// The three rows left #gen-form-section, so dialect/comic mode's single `gf.style.display` toggle no
// longer hides them. This is the replacement, and it is NOT a blanket hide: #style-wrap must stay
// visible for the own-story/PDF path, because pdfGenerateAll() genuinely sends storyStyle and the
// server threads it into real lesson prompts (measured — item AL's own write-up said otherwise).
{
  const C = client();
  const snap = mode => `(function(){
      ['use-story-cb','use-dialect-cb','use-comic-cb'].forEach(function(id){
        var el=document.getElementById(id); if(el) el.checked=false; });
      ${mode ? `document.getElementById('${mode}').checked = true;` : ''}
      _applyTextShapingVisibility();
      return JSON.stringify({ len: document.getElementById('story-len-row').style.display,
               ch:  document.getElementById('num-chapters-row').style.display,
               st:  document.getElementById('style-wrap').style.display });
    })()`;
  // Through JSON, not as a live object: a literal built inside the vm context carries THAT realm's
  // Object.prototype, which deepStrictEqual treats as a mismatch even when every value is equal
  // (§5 already goes through JSON.stringify for the same reason).
  const none = JSON.parse(C.run(snap(null)));
  assert.deepStrictEqual(none, { len: '', ch: '', st: '' }, 'plain LLM-generate: all three shaping rows visible');

  const story = JSON.parse(C.run(snap('use-story-cb')));
  assert.strictEqual(story.len, 'none', 'own-story/PDF: story length hidden (the text is not model-written)');
  assert.strictEqual(story.ch, 'none', 'own-story/PDF: chapter count hidden (conflicts with one provided story)');
  assert.strictEqual(story.st, '', 'own-story/PDF: writing style STAYS visible — pdfGenerateAll() really sends storyStyle');

  for (const [mode, label] of [['use-dialect-cb', 'dialect'], ['use-comic-cb', 'comic']]) {
    const r = JSON.parse(C.run(snap(mode)));
    assert.deepStrictEqual(r, { len: 'none', ch: 'none', st: 'none' },
      `${label} mode: all three hidden — what #gen-form-section used to do for free before the move`);
  }
}
console.log('  _applyTextShapingVisibility(): own-story hides length+chapters only; dialect/comic hide all three: OK');

// ── 8b. Each mode toggle actually CALLS it — the wiring, not just the helper ──────
// Mutation-tested: drop the _applyTextShapingVisibility() call from any of the three toggles and the
// matching assertion here goes red. Without this, §8 would pass on a helper nothing ever invokes.
{
  for (const [cb, fn, label] of [['use-story-cb', 'onUseStoryCb()', 'onUseStoryCb'],
                                 ['use-dialect-cb', 'onUseDialectCb()', 'onUseDialectCb'],
                                 ['use-comic-cb', 'onUseComicCb()', 'onUseComicCb']]) {
    const C = client();
    const r = C.run(`['use-story-cb','use-dialect-cb','use-comic-cb'].forEach(function(id){
        var el=document.getElementById(id); if(el) el.checked=false; });
      _applyTextShapingVisibility();
      document.getElementById('${cb}').checked = true;
      ${fn};
      document.getElementById('num-chapters-row').style.display`);
    assert.strictEqual(r, 'none', `${label} calls _applyTextShapingVisibility() itself`);
  }
}
console.log('  all three mode toggles call _applyTextShapingVisibility() themselves: OK');

// ── 9. #gen-area's own display is untouched — the wizard's zero-collateral check ──
{
  const C = client();
  const r = C.run(`_genWizardGoto(1); _genWizardGoto(2); _genWizardGoto(3);
    document.getElementById('gen-area').style.display`);
  assert.notStrictEqual(r, 'none', "#gen-area itself is never hidden by wizard navigation (unit-ui-journeys.test.js's own invariant)");
}
console.log("  #gen-area's own display is never touched by wizard navigation: OK");

// ── 10. doGenerate()'s empty-topic guard reveals card 2 before focusing (v85_e fix) ──
{
  const C = client();
  const r = C.run(`_genWizardGoto(3);   // navigated past card 2 without typing a topic
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

// ── 11. The renumbered pill 3 reads a key that EXISTS, and is not the stale label ──
// The step NUMBER is baked into each pill string, so pill 3 could not simply reuse `gen.wizard_step4`
// ("4 · Lessons"), and overwriting `gen.wizard_step3` in place would have left 32 translations saying
// "Chapters" on a Lessons step. Hence a new key — pinned here so applyUIStrings() can't drift onto a
// key that renders as its own literal name (unit-ui-key-exists.test.js's own documented failure mode).
{
  assert.ok(UI.en['gen.wizard_step3_lessons'], 'gen.wizard_step3_lessons exists in ui.json `en`');
  assert.ok(/lessons/i.test(UI.en['gen.wizard_step3_lessons']), 'it names the Lessons step');
  assert.ok(!/chapters/i.test(UI.en['gen.wizard_step3_lessons']), 'it is not the stale "Chapters" label');
  const C = client();
  // applyUIStrings() walks #lang-select/#src-lang-select's `.options`, which lib-dom's vivified
  // elements don't have — seed them so the REAL function can run end to end rather than pinning its
  // source text (standing rule 5: guard where the claim is observable).
  const r = C.run(`['lang-select','src-lang-select','style-select','format-select','diff-select',
      'continue-select','vocab-mode-select','user-story-lang','split-mode-para']
      .forEach(function(id){ var el=document.getElementById(id); if(el && !el.options) el.options=[]; });
    applyUIStrings(); document.getElementById('gen-step-pill-3').textContent`);
  assert.strictEqual(r, UI.en['gen.wizard_step3_lessons'],
    'applyUIStrings() puts that key on pill 3 (not gen.wizard_step3, and not a raw key name)');
}
console.log('  pill 3 renders gen.wizard_step3_lessons, a key that exists in `en`: OK');

console.log('unit-gen-wizard: ALL PASSED');
