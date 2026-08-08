// unit-continue-pin.test.js
// v76_j — "continue story" must land on the form with the story it is continuing already selected,
// and that choice must survive a language change.
//
// User-reported against sl_9302163 (a storyline whose chapters span three language pairs): clicking
// "continue story" on the STORYLINE page landed on the main page with the "continue from" field
// EMPTY, while the same button on the last chapter's lesson-set page worked. Measured cause — an
// ordering bug, not a storyline-page bug:
//
//   if (src?.lang) selectLang(src.lang);        // repopulates the menu, with the OLD srcLang
//   if (src?.srcLang) { APP.srcLang = ...; }    // changes srcLang, never repopulates
//
// selectLang() calls repopulateContinueSelect(), which filters on the CURRENT pair. With the target
// already switched to hr and the source still on en, the menu was built for a pair with no chapters
// (50 options -> 1) so the chapter's own option never existed. From the lesson-set page the form
// was ALREADY on hr<-sr, so the stale filter happened to be correct — which is why one route looked
// broken and the other did not.
//
// The second half of the report — "the story was lost when I set a source language" — is fixed by
// the PIN, not by the ordering: arriving via this route fixes the story, and a pinned story is
// offered whatever the filters say. User's rulings: changing a language keeps it in the list
// (rather than cancelling), it is cancelled by the ✕ or by picking "— new story —", and it
// persists across a reload.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS   = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI      = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const SCRIPTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts.json'), 'utf8'));

// Hand-built: the corpus is not a constant and this needs exact counts. Shaped like the reported
// storyline — the chapter being continued is in a DIFFERENT pair from the one the form starts on.
// NOTE the id shape: the product treats a ref as an id only when it matches /^tp_\d+$/, so a
// mnemonic id like `tp_z` is read as a topic NAME and resolves to nothing. A first draft of this
// fixture used one and failed section 1 for that reason alone.
const saved = [
  { id: 'tp_101', topic: 'Alpha',  lang: 'it', srcLang: 'en', lessons: [] },
  { id: 'tp_102', topic: 'Beta',   lang: 'it', srcLang: 'en', lessons: [] },
  { id: 'tp_103', topic: 'Zadnje', lang: 'hr', srcLang: 'sr', lessons: [] },  // the chain's last chapter
  // A SIBLING in the same pair as tp_103, continued by nobody. Its only job is to isolate the
  // ordering fix from the pin: the pin alone re-offers tp_103 whatever the filter did, so without
  // a second hr<-sr chapter section 1 passes even with the ordering bug restored. With the correct
  // order the menu is built for hr<-sr and offers both; with the old order it is built for hr<-en,
  // offers neither, and only the pin survives.
  { id: 'tp_104', topic: 'Susjed', lang: 'hr', srcLang: 'sr', lessons: [] },
];

// HARNESS SHIM (INTERNALS → harness limits): the stub DOM does not parse innerHTML, so a <select>
// has no `.options`. The product legitimately reads contSel.options, so the element is given the
// getter a real DOM would provide, derived from the markup the product itself wrote.
const SHIM = `(function(){
  var el = document.getElementById('continue-select');
  Object.defineProperty(el, 'options', { configurable:true, get:function(){
    var out=[], re=new RegExp('<option value="([^"]*)"([^>]*)>([^]*?)<' + '/option>','g'), m;
    while((m=re.exec(this.innerHTML||''))) out.push({
      value:m[1].replace(/&quot;/g,'"'), selected:/selected/.test(m[2]), text:m[3] });
    return out;
  }});
})();
// applyUIStrings() (reached asynchronously via selectSrcLang -> loadUIStrings) iterates the two
// LANGUAGE selects' .options too. Same harness limit; without these the rejection surfaces AFTER
// the assertions and would fail the runner on a passing test.
['lang-select','src-lang-select','diff-select','format-select','style-select','vocab-mode-select','user-story-lang'].forEach(function(id){
  var e = document.getElementById(id);
  if (e) Object.defineProperty(e, 'options', { configurable:true, get:function(){ return []; } });
});`;

function client(startLang, startSrc, pin) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
         SCRIPTS_DATA = ${JSON.stringify(SCRIPTS)};
         APP.savedList = ${JSON.stringify(saved)};
         APP.info = { backend:'none', canGenerate:true };
         APP.lang = ${JSON.stringify(startLang)}; APP.srcLang = ${JSON.stringify(startSrc)};
         APP.contPin = ${JSON.stringify(pin || null)};
         window.fetch = function(){ return Promise.resolve({ ok:true,
           json:function(){ return Promise.resolve([]); } }); };
         ${SHIM}
         repopulateContinueSelect();
         true;`, 'seed');
  return C;
}
const val   = (C) => C.run(`document.getElementById('continue-select').value`, 'v');
const html  = (C) => C.run(`document.getElementById('continue-select').innerHTML`, 'h');
const xShown = (C) => C.run(`(document.getElementById('cont-pin-clear')||{style:{}}).style.display !== 'none'`, 'x');

// ── 1. The reported bug: arriving from a DIFFERENT language pair ─────────────────────────────
{
  const C = client('it', 'en');
  // Non-vacuity: before the click the chapter is genuinely NOT offered, so the assertion below
  // cannot pass merely because it was there all along.
  assert.ok(!html(C).includes('value="tp_103"'),
    'precondition: on the it<-en pair the hr<-sr chapter is not offered');
  C.run(`continueFromLesson('tp_103', 2, 300); true;`, 'go');
  assert.strictEqual(val(C), 'tp_103',
    'continuing a chapter in another language pair selects it — the reported symptom was an EMPTY '
    + 'field, because the menu was rebuilt before the source language had been switched');
  assert.strictEqual(C.run(`APP.lang`, 'l'), 'hr', 'and the form switched to the chapter\'s target');
  assert.strictEqual(C.run(`APP.srcLang`, 's'), 'sr', '…and its source');
  // THE ORDERING, isolated from the pin. The menu must have been rebuilt for the pair the form
  // ended on, so the chapter's SIBLING is offered too. Under the old order the menu was built for
  // hr<-en — a pair with no chapters — and only the pinned entry survived.
  // The menu must end up built for the pair the form ENDED on, so the chapter's sibling in that
  // pair is offered too. NOTE what this does and does not guard: reverting the lang/srcLang
  // REORDERING alone does not fail here, because setContinuePin() repopulates once both languages
  // are set and so subsumes it. What is guarded is the end state — that the menu is not left built
  // for a pair the form is only half-way into. The reordering is defensive; the pin is the fix.
  assert.ok(html(C).includes('value="tp_104"'),
    'the menu ends up built for the pair the form landed on, so the sibling chapter in that pair '
    + 'is offered alongside the pinned one');
}

// ── 2. The other route still works ───────────────────────────────────────────────────────────
// This one was never broken; asserting it stops a fix for section 1 from breaking it.
{
  const C = client('hr', 'sr');
  C.run(`continueFromLesson('tp_103', 2, 300); true;`, 'go');
  assert.strictEqual(val(C), 'tp_103', 'arriving already on the chapter\'s own pair still works');
}

// ── 3. The pin survives a language change (the user's ruling) ────────────────────────────────
{
  const C = client('it', 'en');
  C.run(`continueFromLesson('tp_103', 2, 300); true;`, 'go');
  assert.strictEqual(C.run(`APP.contPin`, 'p'), 'tp_103', 'arriving by this route pins the story');
  assert.ok(xShown(C), 'and the ✕ that cancels it is shown');

  C.run(`selectSrcLang('de'); true;`, 'srcchange');
  assert.strictEqual(val(C), 'tp_103',
    'changing the SOURCE language keeps the pinned story selected — this is the "story to be '
    + 'continued was lost when I set a source language" half of the report');
  C.run(`selectLang('es'); true;`, 'tgtchange');
  assert.strictEqual(val(C), 'tp_103', 'and changing the TARGET language keeps it too');
  // It must be visibly from another pair, or it reads as though it belonged to the current one.
  const optHtml = html(C);
  const row = /<option value="tp_103"[^>]*>([^<]*)</.exec(optHtml);
  assert.ok(row, 'the pinned story is still offered');
  assert.ok(/\u2192/.test(row[1]),
    `the pinned option carries its language-pair badge (got ${JSON.stringify(row[1])})`);
}

// ── 4. Cancelling, both ways ─────────────────────────────────────────────────────────────────
{
  const C = client('it', 'en', 'tp_103');
  assert.strictEqual(val(C), 'tp_103', 'a persisted pin is restored on load');
  assert.ok(xShown(C), 'the ✕ is shown for a restored pin');
  C.run(`clearContinuePin(); true;`, 'x');
  assert.ok(!C.run(`APP.contPin`, 'p'), 'the ✕ cancels the pin');
  assert.ok(!xShown(C), 'and hides itself');
  assert.ok(!html(C).includes('value="tp_103"'),
    'once cancelled the story is filtered out again like any other');

  const C2 = client('it', 'en', 'tp_103');
  C2.run(`document.getElementById('continue-select').value=''; onContinueSelectChange(); true;`, 'new');
  assert.ok(!C2.run(`APP.contPin`, 'p'), 'picking "— new story —" also cancels the pin');
}

// ── 5. A programmatic rebuild must not cancel the pin ────────────────────────────────────────
// repopulateContinueSelect() ends by calling _updateReinforcePriorVisibility(). The cancel is wired
// to the select's own onchange (onContinueSelectChange) instead, so a rebuild cannot cancel the pin
// it is meant to restore. This section pins the OUTCOME — the pin survives repeated rebuilds — and
// is deliberately not a claim about which function holds the cancel: repopulate restores the value
// BEFORE calling the visibility helper, so even a mis-wired cancel would often survive here.
{
  const C = client('it', 'en', 'tp_103');
  C.run(`repopulateContinueSelect(); repopulateContinueSelect(); true;`, 'rebuild');
  assert.strictEqual(C.run(`APP.contPin`, 'p'), 'tp_103', 'rebuilding the menu does not cancel the pin');
  assert.strictEqual(val(C), 'tp_103', 'and it is still selected afterwards');
}

console.log('  continue-story: both routes select the chapter; the pin survives filters and is cancellable');
console.log('unit-continue-pin: ALL PASSED');
