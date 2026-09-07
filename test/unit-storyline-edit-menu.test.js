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

// The ones that move, and the two that must NOT.
//
// ⚠️ v90_g: `sl-screen-summary-btn` LEFT this list — the user moved "generate summary" onto the
// summary's own edit menu, beside its manual edit and its QC. §1b below asserts where it went, so
// "no longer in the header" cannot be satisfied by deleting the control outright.
const IN_POPOVER = ['sl-screen-edit-btn', 'sl-screen-gen-btn',
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

  // ── 1b. …and generate-summary is on the SUMMARY, not gone (v90_g) ──────────────────────────
  {
    const popAt = html.indexOf('<div id="sl-screen-edit-pop"');
    const popEnd = html.indexOf('</div>\n      <!-- v69_r', popAt) > 0
      ? html.indexOf('</div>\n      <!-- v69_r', popAt) : html.indexOf('\n      <!--', popAt);
    assert.ok(!html.slice(popAt, popEnd).includes('sl-screen-summary-btn'),
      'the summary button is no longer in the header popover');
    // It kept its id, because genStorylineSummary() finds it by id to show ⏳ while it runs.
    assert.ok(/id="sl-screen-summary-btn"[^>]*>✨/.test(html),
      'it still exists, with the ✨ icon the user asked for');
    assert.ok(/_cardEditPopHtml\('sumedit-'/.test(html),
      'and it is emitted through the summary row\'s own edit menu');
    assert.ok(/genStorylineSummary\(\)/.test(html), 'still wired to the same handler');
  }
  console.log('  generate-summary moved onto the summary\'s own menu, keeping its id and handler: OK');

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

  // ── 5. The registry: three menus now, one mechanism (v90_g) ───────────────
  //
  // The user asked for the same pencil on the lesson-set story row and on the chapter-title row
  // ("same as the edit menus of other levels"). Rather than a second and third copy of this walk,
  // _slEditMenuSync became _editMenuSync(key) over a registry — so what is asserted here is that
  // ALL THREE behave the same way, not merely that a table exists.
  {
    const C = loadClient({ quiet: true });
    const keys = JSON.parse(C.run('JSON.stringify(Object.keys(_EDIT_MENUS))')).sort();
    assert.deepStrictEqual(keys, ['ls-story', 'ls-title', 'sl-screen'],
      'three menus: the storyline header, the lesson-set story row, the chapter-title row');

    for (const key of keys) {
      const out = JSON.parse(C.run(`(function(){
        var M = _EDIT_MENUS[${JSON.stringify(key)}];
        // Every button explicitly hidden first: this harness does not parse inline style
        // attributes, so an untouched button reads as visible and the counts below would be
        // measuring the fixture rather than the code.
        M.rows.forEach(function(id){ document.getElementById(id).style.display = 'none'; });
        _editMenuSync(${JSON.stringify(key)});
        var hiddenPencil = document.getElementById(M.btn).style.display;
        document.getElementById(M.rows[0]).style.display = '';
        document.getElementById(M.rows[0]).title = '✨ A Label';
        var shown = _editMenuSync(${JSON.stringify(key)});
        return JSON.stringify({
          shown: shown, hiddenPencil: hiddenPencil,
          pencil: document.getElementById(M.btn).style.display,
          firstRow: document.getElementById('row-' + M.rows[0]).style.display,
          lastRow: document.getElementById('row-' + M.rows[M.rows.length - 1]).style.display,
          label: document.getElementById('lbl-' + M.rows[0]).textContent
        });
      })()`));
      assert.strictEqual(out.shown, 1, `${key}: exactly the visible button is counted`);
      assert.strictEqual(out.firstRow, 'flex', `${key}: its row is shown`);
      assert.strictEqual(out.lastRow, 'none', `${key}: a hidden button's row stays hidden`);
      assert.strictEqual(out.label, 'A Label',
        `${key}: the label comes from the button's own title, leading icon stripped`);
      assert.strictEqual(out.hiddenPencil, 'none',
        `${key}: with every row hidden the pencil is hidden too — it would open onto nothing`);
      assert.strictEqual(out.pencil, '', `${key}: and it reappears once there is something to show`);
    }

    // ⚠️ ONE open page-wide. The two lesson-set pencils sit a few hundred pixels apart, so opening
    // the second must close the first rather than stacking two menus over the same content.
    const both = JSON.parse(C.run(`(function(){
      _EDIT_MENUS['ls-story'].rows.forEach(function(id){ document.getElementById(id).style.display = ''; });
      _EDIT_MENUS['ls-title'].rows.forEach(function(id){ document.getElementById(id).style.display = ''; });
      toggleEditMenu('ls-story');
      var afterFirst = document.getElementById('ls-story-edit-pop').style.display;
      toggleEditMenu('ls-title');
      return JSON.stringify({ afterFirst: afterFirst,
        story: document.getElementById('ls-story-edit-pop').style.display,
        title: document.getElementById('ls-title-edit-pop').style.display });
    })()`));
    assert.strictEqual(both.afterFirst, 'block', 'the first pencil opens its menu');
    assert.strictEqual(both.title, 'block', 'the second opens its own…');
    assert.strictEqual(both.story, 'none', '…and closes the first');
    const twice = C.run(`(function(){ toggleEditMenu('ls-title');
      return document.getElementById('ls-title-edit-pop').style.display; })()`);
    assert.strictEqual(twice, 'none', 'a second press on the same pencil closes it');
    console.log('  three menus, one mechanism: mirrored rows, stripped labels, one open at a time: OK');
  }

  // ── 6. The relocated buttons kept their handlers (v90_g) ──────────────────
  {
    const popStory = html.slice(html.indexOf('<div id="ls-story-edit-pop"'),
                                html.indexOf('<div class="story-body"'));
    for (const [id, handler] of [['ls-story-analyze-btn', 'analyzeChaptersRun'],
                                 ['story-repair-toggle-btn', 'toggleStoryRepair()'],
                                 ['story-qc-btn', 'runStoryQc()'],
                                 ['story-retranslate-btn', 'onRetranslateBtn()']]) {
      assert.ok(popStory.includes('id="' + id + '"'), `${id} is in the story row's menu`);
      const at = popStory.indexOf('id="' + id + '"');
      const tag = popStory.slice(popStory.lastIndexOf('<button', at), popStory.indexOf('</button>', at));
      assert.ok(tag.includes(handler), `${id} kept its handler (${handler})`);
    }
    // ⚠️ 🔬 and 💬 must NOT have moved: the user's list was the four AUTHORING controls, and these
    // two are what a LEARNER uses (the explorer works with no backend at all).
    const row = html.slice(html.indexOf('<span id="ls-story-flags"'),
                           html.indexOf('<div id="ls-story-edit-pop"'));
    assert.ok(row.includes('id="ls-story-explorer-btn"'), 'the 🔬 explorer stays in the row');
    assert.ok(row.includes('id="speakstory-btn"'), 'and 💬 read-aloud stays with it');
    assert.ok(!row.includes('id="story-qc-btn"'), 'while QC has left the row');

    const popTitle = html.slice(html.indexOf('<div id="ls-title-edit-pop"'));
    const popTitleEnd = popTitle.slice(0, popTitle.indexOf('<div class="ls-hdr-storyline"'));
    for (const [id, handler] of [['lesson-edit-btn', 'openLessonTitleEdit()'],
                                 ['gen-topic-title-btn', 'genLessonTitle()']]) {
      assert.ok(popTitleEnd.includes('id="' + id + '"'), `${id} is in the title row's menu`);
      assert.ok(popTitleEnd.includes(handler), `${id} kept its handler`);
    }
    assert.ok(!popTitleEnd.includes('id="share-btn"'),
      'and 🔗 share is NOT in it — the same exclusion the user made for the storyline header');
    console.log('  the six relocated buttons kept their handlers; the learner controls stayed put: OK');
  }

  // ── 7. …and the rows they became are LOCALIZED (v90_h) ────────────────────
  //
  // User: "the text 'Re-translate (after fixing the story text)' is not in ui.json?" It was not —
  // and neither were three of its neighbours. Until v90_g that cost only a tooltip nobody reads on
  // a touch screen; once the buttons moved into the menu, the title became THE VISIBLE ROW LABEL,
  // so the whole menu read English in every language. All four were given existing keys — the user
  // asked for exactly that ("just re-use an existing 'Translate' ui entry"), and it cost none.
  {
    const UIJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
    // The wiring is source-pinned: applyUIStrings sweeps the DOM with an element-scoped
    // querySelectorAll, which this harness does not model, so the function cannot be run here.
    for (const [id, key] of [['ls-story-explorer-btn', 'text_explorer.toggle_title'],
                             ['ls-story-analyze-btn', 'gen.post_gen_analysis_lbl'],
                             ['story-repair-toggle-btn', 'lesson.edit_story'],
                             ['story-retranslate-btn', 'models.translation']]) {
      assert.ok(new RegExp(`_setAttr\\('${id}',\\s*'title',\\s*t\\('${key.replace(/\./g, '\\.')}'\\)`).test(html),
        `${id}'s title comes from t('${key}')`);
      assert.ok(UIJ.en[key] && UIJ.en[key].trim(), `${key} exists in en`);
      const translated = Object.keys(UIJ).filter(l => l !== 'en' && UIJ[l][key]).length;
      assert.ok(translated > 20, `${key} is already translated (${translated} languages) — no new key`);
    }
    // ⚠️ and the parenthetical the user asked to drop is gone from the ATTRIBUTE. Scanning the
    // whole file for the phrase fired on the source's own comment, which QUOTES the user's request
    // — the containment trap, hit for the third time this session while writing a guard for it.
    // Assert on the delimited value, not on "the string appears somewhere".
    assert.ok(!/title="[^"]*after fixing the story text/.test(html),
      'no button still carries the old hardcoded re-translate title');
    assert.ok(/title="[^"]*after fixing the story text/.test(
      '<button title="Re-translate (after fixing the story text)">'),
      '(and that pattern really does match the shape it is looking for)');

    // The MECHANISM, run: a localized title becomes a localized row label, icon stripped.
    const C2 = loadClient({ quiet: true });
    const labels = JSON.parse(C2.run(`(function(){
      UI_STRINGS = ${JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8')).de)};
      _setAttr('ls-story-analyze-btn', 'title', t('gen.post_gen_analysis_lbl'));
      _setAttr('story-repair-toggle-btn', 'title', t('lesson.edit_story'));
      _setAttr('story-retranslate-btn', 'title', t('models.translation'));
      _EDIT_MENUS['ls-story'].rows.forEach(function(id){ document.getElementById(id).style.display = ''; });
      _editMenuSync('ls-story');
      return JSON.stringify(['ls-story-analyze-btn','story-repair-toggle-btn','story-retranslate-btn']
        .map(function(id){ return document.getElementById('lbl-' + id).textContent; }));
    })()`));
    for (const l of labels) {
      assert.ok(l && l.trim(), 'every row got a label');
      assert.ok(!/^[a-z_]+\.[a-z_]/.test(l), `"${l}" is a real string, not a raw key name`);
    }
    assert.ok(!labels.some(l => /^🔤/.test(l)), 'and the leading icon is stripped, as elsewhere');
    assert.notDeepStrictEqual(labels, ['Analyse words for the text explorer', 'Edit story', 'Translation'],
      '⚠️ the German labels are NOT the English ones — this is the whole point');
    console.log('  the story row menu reads in the UI language, at zero new keys: OK');
  }

} catch (e) { failed = true; console.error(e); }
console.log(failed ? 'unit-storyline-edit-menu: FAILED' : 'unit-storyline-edit-menu: ALL PASSED');
process.exit(failed ? 1 : 0);
