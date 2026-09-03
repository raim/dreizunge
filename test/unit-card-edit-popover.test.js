// unit-card-edit-popover.test.js
// v88_am — the item-Y pencil popover, extended to DYNAMICALLY RENDERED cards.
//
// User request: "We just summarized edit buttons behind a pencil in the storyline page header.
// Let's do the same for the storyline fields on the main page, and for the individual chapter fields
// of the storyline page. Hide all but the play and share buttons behind a pencil that opens a
// popover with the existing edit buttons."
//
// ⚠️ WHY THIS IS A SECOND MECHANISM AND NOT `_slEditMenuSync`. Item Y's popover MIRRORS static
// markup: the storyline page has ONE header whose buttons exist in the document, so the sync copies
// their state onto rows. A library list has one card per storyline and a storyline page one per
// chapter — the buttons are built as STRINGS, per card, and there is no single element to mirror.
// `_cardEditPopHtml` therefore builds rows directly from the button HTML the caller was ALREADY
// emitting, with the label it already carried. That is what keeps the move at zero new ui.json keys
// and keeps every handler working: the buttons are relocated, not rewritten.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function client(teacher = true, canGenerate = true) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP._teacherMode = ${teacher}; APP.info = { canGenerate: ${canGenerate} }; true;`, 'seed');
  return C;
}
const CHAPTER = { id: 'tp_a', topic: 'A Chapter', lang: 'de', srcLang: 'en',
                  lessonCount: 1, difficulty: 2, storyLen: 300, lessons: [] };

let failed = false;
try {

  // ── 1. _cardEditPopHtml: rows, labels, and the empty case ───────────────────────────────────
  {
    const C = client();
    const out = C.run(`_cardEditPopHtml('p1', [
      { html: '<button id="b1">A</button>', label: 'Alpha' },
      null,
      { html: '', label: 'dropped — no html' },
      { html: '<button id="b2">B</button>', label: 'Beta' } ])`);
    assert.ok(out.includes('id="p1"'), 'the popover carries the id it was given');
    assert.strictEqual((out.match(/sl-edit-pop-row/g) || []).length, 2,
      'one row per entry that HAS html — a falsy entry is dropped, so callers keep using their own '
      + 'conditional expressions');
    assert.ok(out.includes('id="b1"') && out.includes('id="b2"'),
      'and the buttons are carried through VERBATIM, handlers and all');
    assert.ok(out.includes('Alpha') && out.includes('Beta'), 'each with its label');
    assert.ok(/_cardEditToggle\('p1',this\)/.test(out), 'the pencil toggles this popover, passing itself for placement');

    // ⚠️ A pencil that would open an EMPTY menu is not offered — the same "a dead control is worse
    // than no control" rule applied to the cancel affordance and to item Y's own pencil.
    assert.strictEqual(C.run(`_cardEditPopHtml('p2', [])`), '', 'no entries: no pencil at all');
    assert.strictEqual(C.run(`_cardEditPopHtml('p2', [null, { html: '' }])`), '',
      'and entries that all render nothing are the same as none');
    console.log('  _cardEditPopHtml: one row per real entry, verbatim buttons, no empty pencil: OK');
  }

  // ── 2. Toggling: opens, closes, and only ONE is open across the whole page ──────────────────
  // Many cards each own a popover, so "open" has to be page-wide state or two could sit open at
  // once — on a library list that would stack popovers over each other.
  {
    const C = client();
    // ⚠️ Read through `document.getElementById`, the SAME accessor the code uses — not through
    // elements this test creates. lib-dom auto-vivifies an id on a miss and caches that element, so
    // a locally-created div with the same id is a DIFFERENT object: the code would set display on
    // the vivified one while the test inspected its own, and every assertion here would fail on a
    // correct tree. (The same trap `v88_ad` hit with the token popover.)
    const r = JSON.parse(C.run(`(function(){
      var a = document.getElementById('popA'); a.style.display = 'none';
      var b = document.getElementById('popB'); b.style.display = 'none';
      var btn = { getBoundingClientRect: function(){ return { left:10, right:30, top:10, bottom:30 }; } };
      _cardEditToggle('popA', btn);
      var afterA = a.style.display;
      _cardEditToggle('popB', btn);            // opening B must close A
      var aAfterB = a.style.display, bAfterB = b.style.display;
      _cardEditToggle('popB', btn);            // pressing the same pencil closes it
      return JSON.stringify({ afterA: afterA, aAfterB: aAfterB, bAfterB: bAfterB,
        bClosed: b.style.display, openId: _cardEditOpenId });
    })()`, 'toggle'));
    assert.notStrictEqual(r.afterA, 'none', 'the pencil opens its popover');
    assert.strictEqual(r.aAfterB, 'none', 'opening another card closes the first — only ONE is ever open');
    assert.notStrictEqual(r.bAfterB, 'none', 'while the new one is open');
    assert.strictEqual(r.bClosed, 'none', 'pressing the same pencil again closes it');
    assert.strictEqual(r.openId, null, 'and the page-wide open marker is cleared');
    console.log('  only one card popover is open at a time, and a second press closes it: OK');
  }

  // ── 3. The CHAPTER card: everything behind the pencil, nothing left in the row ───────────────
  // This card has neither a play nor a share button — its whole body IS the play affordance — so
  // "hide all but play and share" means the row is left holding only the pencil.
  {
    const C = client();
    const out = C.run(`savedItemHtml(${JSON.stringify(CHAPTER)}, false, true, true, true)`);
    assert.ok(/_cardEditToggle\('sicardpop-/.test(out), 'the chapter card has a pencil');
    const beforePop = out.split('card-edit-pop')[0];
    assert.strictEqual((beforePop.match(/class="ico-btn/g) || []).length, 1,
      'and the action row holds exactly ONE icon — the pencil itself (got: '
        + (beforePop.match(/class="ico-btn[^"]*"/g) || []).join(',') + ')');
    // A storyline chapter drops edit/add/export by a rule that predates this change; those simply
    // become absent rows rather than needing a second conditional.
    assert.strictEqual((out.match(/sl-edit-pop-row/g) || []).length, 4,
      'four rows for a storyline chapter: continue, QC, analyse, delete');
    for (const call of ['continueFromLesson(', 'qcRun({topicId:', 'analyzeChaptersRun([', 'deleteSaved('])
      assert.ok(out.includes(call), `${call} survived the move with its handler intact`);
    console.log('  the storyline chapter card: every action behind the pencil, row holds only it: OK');
  }

  // ── 3b. …and the SAME card outside a storyline keeps its own extra actions ───────────────────
  // The per-context differences that already existed are untouched: they just add rows.
  {
    const C = client();
    const out = C.run(`savedItemHtml(${JSON.stringify(CHAPTER)}, false, true, true, false)`);
    assert.strictEqual((out.match(/sl-edit-pop-row/g) || []).length, 7,
      'seven rows for a standalone library item — edit, add and export come back');
    assert.ok(out.includes('openSavedItemEdit(') && out.includes('openAddLesson(')
           && out.includes('openExportMenu('), 'and they are the real handlers, unchanged');
    console.log('  the same renderer outside a storyline keeps its extra actions, as rows: OK');
  }

  // ── 3c. A learner sees no pencil at all ──────────────────────────────────────────────────────
  // Non-vacuity for the whole mechanism: with canGenerate false only Delete survives, so the pencil
  // must still appear — but with nothing generative behind it. Asserted as a COUNT rather than
  // "absent", because a wrong implementation could just as easily render an empty menu.
  {
    const C = client(false, false);
    const out = C.run(`savedItemHtml(${JSON.stringify(CHAPTER)}, false, true, true, true)`);
    assert.strictEqual((out.match(/sl-edit-pop-row/g) || []).length, 1,
      'without a backend only Delete remains, so the popover has exactly one row');
    assert.ok(out.includes('deleteSaved('), 'and it is Delete');
    assert.ok(!out.includes('qcRun('), 'the generative actions are gone, not merely hidden');
    console.log('  the popover shrinks to what the context actually offers: OK');
  }

  // ── 4. The LIBRARY storyline card: play and share STAY, the rest moves ───────────────────────
  // ⚠️ Source-level, and bounded: this markup is built inside `loadSavedList`, which needs a whole
  // savedList/storylines fixture and a DOM to paint into. The claim here is about WHICH BUTTONS ARE
  // WHERE in that template, which is exactly what the source shows — and both halves are asserted,
  // because "keep these two in the header" is only half the instruction: also putting them in the
  // popover would satisfy a one-sided check and still be wrong.
  {
    const at = html.indexOf("_cardEditPopHtml('slcardpop-");
    assert.ok(at > 0, 'the library storyline card builds a card popover');
    // The header row runs from the walkthrough button down to the pencil call.
    const rowStart = html.lastIndexOf('walkStoryline(this.dataset.sl', at);
    assert.ok(rowStart > 0 && rowStart < at, 'the walkthrough button is found before it');
    const row = html.slice(rowStart, at);
    const pop = html.slice(at, html.indexOf('])}', at));

    assert.ok(row.includes('shareStorylineById('), 'SHARE stays in the header row (user ruling)');
    assert.ok(!pop.includes('shareStorylineById('), 'and is NOT also in the popover');
    // The play button is what `rowStart` anchors on, so its presence in the row is established;
    // what must be checked is that it did not ALSO get swept into the popover.
    assert.ok(!pop.includes('walkStoryline('), 'PLAY likewise stays out of the popover');

    for (const [call, what] of [['openExportMenu(', 'export'], ['qcRun({storylineId:', 'QC'],
                               ['analyzeChaptersRun(', 'analyse'], ['deleteStoryline(', 'delete']]) {
      assert.ok(pop.includes(call), `${what} moved INTO the popover`);
      assert.ok(!row.includes(call), `and ${what} is no longer in the header row`);
    }
    console.log('  the library storyline card: play and share stay, the other four move behind the pencil: OK');
  }

  // ── 5. Zero new ui.json keys ─────────────────────────────────────────────────────────────────
  // Every row label is a string the button already carried, so this whole feature adds nothing to
  // translate across 33 languages. Pinned because a later "just add a label key" would be easy and
  // would quietly cost the user a translation pass.
  {
    assert.ok(UI.en['ui.edit_title'], 'the pencil reuses the existing edit-title string');
    const C = client();
    const out = C.run(`savedItemHtml(${JSON.stringify(CHAPTER)}, false, true, true, true)`);
    // ⚠️ Asserted on the LABEL SPAN, not with a bare `includes`. The button keeps its own `title`
    // attribute carrying the same string, so a containment check is satisfied by the title even when
    // the label is wrong — and it was: a too-greedy strip that ate the first word stayed GREEN until
    // this was delimited. The third containment-proxy failure in this line.
    assert.ok(out.includes('>' + UI.en['qc.btn.topic'] + '<'),
      'a plain-worded label is rendered verbatim, first word and all');
    // ⚠️ A leading icon is STRIPPED — the row already shows the button, so "🔤 Analyse words for the
    // text explorer" printed the glyph twice. Caught by reading the LIVE label, not by a test: the
    // assertion here had been `includes`, which a doubled prefix satisfies perfectly. Both directions
    // are pinned, because a strip that was too greedy would eat the first word of a plain label.
    const analyse = UI.en['gen.post_gen_analysis_lbl'];
    const stripped = analyse.replace(/^[^\p{L}\p{N}]+\s/u, '');
    assert.notStrictEqual(stripped, analyse, 'non-vacuity: that string really does start with an icon');
    assert.ok(out.includes('>' + stripped + '<'),
      'and its row label has the icon stripped, so it is not shown twice');
    assert.ok(!out.includes('>' + analyse + '<'), 'the doubled form is not rendered');
    console.log('  every row label is a string the app already had — no new keys: OK');
  }

} catch (e) { failed = true; console.error(e); }
console.log(failed ? 'unit-card-edit-popover: FAILED' : 'unit-card-edit-popover: ALL PASSED');
process.exit(failed ? 1 : 0);
