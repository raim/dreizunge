// unit-storyline-edit-menu.test.js
// item Y (v88_ai) — the storyline page's header authoring buttons behind ONE pencil.
//
// User request, and the roadmap has carried item Y since the v87 line: "move all edit buttons of the
// storyline page header row behind a single edit pencil and show all edit buttons as a popover."
// With an explicit exclusion in the follow-up message: "Dont include the share link and the new play
// button in the requested popover ... keep these two in the header, next to the new edit pencil."
//
// ⚠️ WHAT THIS DELIBERATELY IS NOT. The five buttons are not re-implemented, re-titled, or
// re-gated — they are the SAME elements, relocated into the popover. So `_renderStorylineScreen`'s
// existing per-button visibility rules and `_applyUIStrings`' existing title strings stay the single
// source of truth, and `_slEditMenuSync` only MIRRORS that state onto the rows. That is what makes
// the feature cost zero new ui.json keys: each row's label is read from its own button's `title`,
// so it is always exactly the string the app already had, in whatever UI language.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// The five that move, and the two that must NOT.
const IN_POPOVER = ['sl-screen-edit-btn', 'sl-screen-gen-btn', 'sl-screen-summary-btn',
                    'sl-screen-storyboard-btn', 'sl-screen-qc-btn', 'sl-screen-del-btn'];
const STAY_IN_HEADER = ['sl-screen-walk-btn', 'share-storyline-btn'];

let failed = false;
try {

  // ── 1. Structure: who is inside the popover, and who is still in the title row ──────────────
  // Source-layer, because "which container is this button in" is a structural claim and the DOM
  // harness does not model containment (`Element.contains` is a dead stub here — see
  // unit-jobs-popover's own note, which hit exactly this).
  {
    const popAt = html.indexOf('<div id="sl-screen-edit-pop"');
    assert.ok(popAt > 0, 'the popover container exists');
    const popEnd = html.indexOf('</div>\n      <!-- v69_r', popAt) > 0
      ? html.indexOf('</div>\n      <!-- v69_r', popAt) : html.indexOf('\n      <!--', popAt);
    const popHtml = html.slice(popAt, popEnd);
    // ⚠️ The title row is bounded by its OWN closing tag, not by "everything before the popover".
    // The first version sliced rowAt..popAt, which is a PROXY for "inside the title row" — and
    // mutation-testing proved it: moving the share button OUT of the row but still above the
    // popover left the guard green, i.e. it would have passed on markup that violates the very
    // ruling it exists to pin. The row contains no nested divs (home, title, pencil, play, share),
    // so its first closing tag really is its end.
    const rowAt = html.indexOf('<div class="sl-screen-title-row">', html.indexOf('id="storyline-screen"'));
    const rowEnd = html.indexOf('</div>', rowAt);
    assert.ok(rowAt > 0 && rowEnd > rowAt, 'the storyline title row is found and bounded');
    assert.ok(rowEnd < popAt, 'and it closes before the popover begins (non-vacuity for the bound)');
    const rowHtml = html.slice(rowAt, rowEnd);

    for (const id of IN_POPOVER) {
      assert.ok(popHtml.includes('id="' + id + '"'), `${id} moved INTO the popover`);
      assert.ok(!rowHtml.includes('id="' + id + '"'), `${id} is no longer in the header title row`);
    }
    // ⚠️ The user's explicit exclusion. Asserted in BOTH directions, because "keep these two in the
    // header" is only half the instruction — putting them in the popover as well would satisfy a
    // one-sided check while still being wrong.
    for (const id of STAY_IN_HEADER) {
      assert.ok(rowHtml.includes('id="' + id + '"'), `${id} STAYS in the header (user's ruling)`);
      assert.ok(!popHtml.includes('id="' + id + '"'), `and ${id} is NOT also in the popover`);
    }
    assert.ok(rowHtml.includes('id="sl-screen-edit-menu-btn"'),
      'and the new pencil sits in the header, next to them');
    console.log('  the five authoring buttons moved into the popover; play and share stayed put: OK');
  }

  // ── 2. ⚠️ The delete button escaped a container it should never have been in ────────────────
  // It was nested inside #sl-tag-editor, which is `display:none` unless the TAG editor is open — so
  // "Delete storyline" was only ever reachable by opening the tag editor first. A pre-existing bug,
  // found by relocating the row rather than by a report, and pinned so it cannot creep back.
  {
    const tagAt = html.indexOf('<div id="sl-tag-editor"');
    const tagEnd = html.indexOf('<div id="sl-screen-edit-row"', tagAt);
    assert.ok(tagAt > 0 && tagEnd > tagAt, 'the tag editor block is found');
    assert.ok(!html.slice(tagAt, tagEnd).includes('sl-screen-del-btn'),
      'the delete button is NOT inside the tag editor any more — it used to be unreachable unless '
      + 'the tag editor happened to be open');
    console.log('  the delete button is out of the tag editor, where it was unreachable: OK');
  }

  // ── 3. Behaviour: rows mirror their buttons, and labels come from the buttons' own titles ────
  {
    const C = loadClient({ quiet: true });
    const out = JSON.parse(C.run(`(function(){
      // EVERY button's state is set explicitly: this harness does not parse inline style
      // attributes, so a button left untouched reads as visible and the counts below would be
      // measuring the fixture rather than the code. Two visible, four hidden — so the mirror has
      // something to get wrong in both directions.
      _SL_EDIT_MENU_BTNS.forEach(function(id){ document.getElementById(id).style.display = 'none'; });
      document.getElementById('sl-screen-edit-btn').style.display = '';
      document.getElementById('sl-screen-edit-btn').title = 'Edit title';
      document.getElementById('sl-screen-gen-btn').style.display = '';
      document.getElementById('sl-screen-gen-btn').title = '✨ Re-generate titles';
      var shown = _slEditMenuSync();
      // Read back by ID, not by a class query over the container: element-scoped querySelectorAll is
      // not modelled by this harness, and a guard written that way passes or fails for reasons that
      // have nothing to do with the product (the same limitation unit-jobs-popover records for
      // Element.contains). No backticks in this comment: it lives inside a template literal.
      var rows = _SL_EDIT_MENU_BTNS.map(function(id){
        return { id: id, row: document.getElementById('row-' + id).style.display,
                 lbl: document.getElementById('lbl-' + id).textContent };
      });
      return JSON.stringify({ shown: shown, rows: rows,
        pencil: document.getElementById('sl-screen-edit-menu-btn').style.display });
    })()`, 'sync'));

    const byId = Object.fromEntries(out.rows.map(r => [r.id, r]));
    assert.strictEqual(byId['sl-screen-edit-btn'].row, 'flex', 'a visible button gets a visible row');
    assert.strictEqual(byId['sl-screen-qc-btn'].row, 'none', 'a hidden button gets a hidden row');
    // The label is the BUTTON'S OWN title — not a second copy of the string, which is what keeps
    // this at zero new ui.json keys and cannot drift from what _applyUIStrings set.
    assert.strictEqual(byId['sl-screen-edit-btn'].lbl, 'Edit title',
      "the row label is read from the button's own title attribute");
    // ⚠️ The leading icon is STRIPPED: the row already shows the button, so a title beginning with
    // the same glyph ("✨ Generate title") would print it twice side by side. Titles that are plain
    // words, like 'Edit title' above, must survive untouched — both directions asserted, because a
    // strip that was too greedy would eat the first word of those.
    assert.strictEqual(byId['sl-screen-gen-btn'].lbl, 'Re-generate titles',
      'a leading icon in the title is not repeated next to the button that already shows it');
    assert.strictEqual(out.shown, 2, 'and the count reflects only the visible ones');
    assert.notStrictEqual(out.pencil, 'none', 'the pencil is shown when the menu has contents');
    console.log('  rows mirror their buttons and take their labels from them: OK');
  }

  // ── 4. A pencil that would open an EMPTY menu is hidden ──────────────────────────────────────
  // The same principle this project applied to the cancel affordance: a dead control is worse than
  // no control. On a learner's screen (no canGenerate) every row is hidden, so the pencil must be.
  {
    const C = loadClient({ quiet: true });
    const pencil = C.run(`(function(){
      ${IN_POPOVER.map(id => `document.getElementById('${id}').style.display='none';`).join('')}
      var shown = _slEditMenuSync();
      return JSON.stringify({ shown: shown,
        pencil: document.getElementById('sl-screen-edit-menu-btn').style.display });
    })()`, 'empty');
    const r = JSON.parse(pencil);
    assert.strictEqual(r.shown, 0, 'nothing to show');
    assert.strictEqual(r.pencil, 'none', 'so the pencil hides itself rather than opening an empty menu');
    console.log('  the pencil hides when every row is hidden: OK');
  }

  // ── 5. Toggling opens and closes ────────────────────────────────────────────────────────────
  {
    const C = loadClient({ quiet: true });
    const r = JSON.parse(C.run(`(function(){
      document.getElementById('sl-screen-edit-btn').style.display = '';
      var pop = document.getElementById('sl-screen-edit-pop');
      pop.style.display = 'none';
      toggleSlEditMenu({});
      var opened = pop.style.display;
      toggleSlEditMenu({});
      var closed = pop.style.display;
      _slEditMenuClose();
      return JSON.stringify({ opened: opened, closed: closed, after: pop.style.display });
    })()`, 'toggle'));
    assert.notStrictEqual(r.opened, 'none', 'the pencil opens the popover');
    assert.strictEqual(r.closed, 'none', 'and pressing it again closes it');
    assert.strictEqual(r.after, 'none', '_slEditMenuClose closes it too');
    console.log('  the pencil toggles the popover open and closed: OK');
  }

  // ── 6. Every relocated button kept its handler ───────────────────────────────────────────────
  // The move must be a MOVE. A button that arrives in the popover without its onclick is a control
  // that looks right and does nothing — and the whole point of relocating rather than rewriting was
  // that none of this wiring had to be touched.
  {
    const wired = {
      'sl-screen-edit-btn': 'openStorylineEditInScreen()',
      'sl-screen-gen-btn': 'openRetitleMenu(event)',
      'sl-screen-summary-btn': 'genStorylineSummary()',
      'sl-screen-storyboard-btn': 'onStorylineStoryboardBtn()',
      'sl-screen-del-btn': 'deleteCurrentStoryline()',
    };
    for (const [id, call] of Object.entries(wired)) {
      const at = html.indexOf('id="' + id + '"');
      const tag = html.slice(html.lastIndexOf('<button', at), html.indexOf('>', at) + 1);
      assert.ok(tag.includes(call), `${id} still calls ${call} after the move`);
    }
    // The QC button is wired in JS (_renderStorylineScreen sets its onclick), not in markup — so it
    // is checked where it actually lives, rather than asserted absent from the tag and called done.
    assert.ok(/qcBtn\.onclick = \(\) => qcRun\(\{ storylineId: chainId \}, qcBtn\);/.test(html),
      'and the QC button is still wired in _renderStorylineScreen');
    console.log('  every relocated button kept its handler: OK');
  }

} catch (e) { failed = true; console.error(e); }
console.log(failed ? 'unit-storyline-edit-menu: FAILED' : 'unit-storyline-edit-menu: ALL PASSED');
process.exit(failed ? 1 : 0);
