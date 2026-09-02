// unit-jobs-popover.test.js
// item U follow-up (roadmap_v87.md) — user request: "a tutor job should also be part of the jobs
// popover." A live in-flight tutor question is NOT tracked by the server's generic job store (POST
// /api/tutor is stateless — INTERNALS.md §6b), so it's folded into the popover as a SYNTHETIC entry
// sourced from the one piece of client state that already exists for it (_tutorState.busy), rather
// than teaching the server about a request shape (streaming, no persisted id) the job store was
// never built for.
//
// Also covers a real bug found and fixed live (not by reading the CSS): #jobs-pop used to live
// INSIDE #jobs-fab, itself inside #bottom-bar — a stacking context of its own (position:fixed +
// z-index:900) — so no z-index on a descendant could ever out-rank a BODY-LEVEL sibling like
// #tutor-widget (z-index:901). Opening the tutor AND the jobs popover together rendered the
// popover fully invisible behind the tutor widget. Fixed by moving #jobs-pop to the body level
// (a sibling of #tutor-widget), same shape the tutor FAB/WIDGET split already uses. §3 below is a
// structural regression guard for that fix, not a new claim about behaviour.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

function client() {
  const C = loadClient({ quiet: true });
  C.run(`APP.info = { canGenerate: true };
    UI_STRINGS = ${JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8')).en)};
    true;`, 'seed');
  return C;
}

(async () => {
  let failed = false;
  try {

    // ── 1. _jobsEffectiveList(): plain passthrough when the tutor is idle ──────────────────────
    {
      const C = client();
      C.run(`_jobsLastList = [{ id:'j1', kind:'job', label:'Generating "X"', status:'running',
        step:'working…', error:null, link:null, createdAt:1 }];
        _tutorState.busy = false;`, 't1');
      const eff = C.run('_jobsEffectiveList()', 't1-read');
      assert.strictEqual(eff.length, 1, 'tutor idle: just the real job (got ' + eff.length + ')');
      assert.strictEqual(eff[0].id, 'j1', 'the real job is unchanged');
      console.log('  _jobsEffectiveList(): passthrough when the tutor is idle: OK');
    }

    // ── 2. _jobsEffectiveList(): a synthetic tutor entry is PREPENDED while busy ───────────────
    {
      const C = client();
      C.run(`_jobsLastList = [{ id:'j1', kind:'job', label:'Generating "X"', status:'running',
        step:'working…', error:null, link:null, createdAt:1 }];
        _tutorState.busy = true;`, 't2');
      const eff = C.run('_jobsEffectiveList()', 't2-read');
      assert.strictEqual(eff.length, 2, 'tutor busy: real job + synthetic tutor entry (got ' + eff.length + ')');
      assert.strictEqual(eff[0].kind, 'tutor', 'the synthetic entry is FIRST (most recent)');
      assert.strictEqual(eff[0].id, '__tutor__', 'the synthetic entry has a stable, non-colliding id');
      assert.strictEqual(eff[0].status, 'running', 'the synthetic entry reports running');
      // JSON round-trip, not assert.deepStrictEqual: eff[0].link was built inside the vm sandbox's
      // OWN realm, whose Object.prototype differs from this process's — deepStrictEqual treats that
      // as a structural mismatch even when every own-property value is identical.
      assert.strictEqual(JSON.stringify(eff[0].link), JSON.stringify({ type: 'tutor' }), 'the synthetic entry carries a tutor link');
      assert.strictEqual(eff[1].id, 'j1', 'the real job is still present, unmutated, second');
      console.log('  _jobsEffectiveList(): a synthetic tutor entry is prepended while busy: OK');
    }

    // ── 3. #jobs-pop is NOT nested inside #jobs-fab (the stacking-context fix) ─────────────────
    // lib-dom's own .contains()/.parentNode do not track ancestry for the STATICALLY-parsed tree
    // (only for nodes appendChild'd at runtime — real gaps in a harness that is deliberately "NOT a
    // DOM implementation", per its own header comment) so this checks the one thing that's actually
    // true either way: markup ORDER. #jobs-fab's own block has no nested <div> (a button + a span),
    // so its FIRST following </div> reliably closes it — mutation-tested in §3b below, which proves
    // this check can fail, not just that it happens to pass today.
    {
      const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const fabStart = html.indexOf('<div id="jobs-fab"');
      assert.ok(fabStart >= 0, '#jobs-fab found');
      const fabEnd = html.indexOf('</div>', fabStart);
      const fabBlock = html.slice(fabStart, fabEnd);
      assert.ok(!fabBlock.includes('id="jobs-pop"'),
        '#jobs-pop is not nested inside #jobs-fab\'s own block (was, before the fix)');
      assert.ok(html.includes('id="jobs-pill"'), 'the pill itself is still there');
      console.log('  #jobs-pop is not nested inside #jobs-fab (mutation-tested below): OK');
    }

    // ── 3b. Mutation test for §3: nesting #jobs-pop back inside #jobs-fab makes the guard fail ──
    {
      const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const mutated = html.replace(
        '<span id="jobs-pill-badge" style="display:none"></span>\n    </div>',
        '<span id="jobs-pill-badge" style="display:none"></span>\n      <div id="jobs-pop" class="jobs-pop-MUTATED"></div>\n    </div>'
      );
      assert.notStrictEqual(mutated, html, 'the mutation actually changed the markup (fixture still matches)');
      const fabStart = mutated.indexOf('<div id="jobs-fab"');
      const fabEnd = mutated.indexOf('</div>', fabStart);
      const fabBlock = mutated.slice(fabStart, fabEnd);
      assert.ok(fabBlock.includes('id="jobs-pop"'),
        'mutation reproduces the OLD nested structure — §3\'s own guard would now fail to catch it');
      console.log('  mutation test: re-nesting #jobs-pop reproduces the old (broken) structure: OK');
    }

    // ── 4. .jobs-pop's own CSS is position:fixed, not absolute (the actual paint-order fix) ────
    {
      const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const m = /\.jobs-pop\{([^}]*)\}/.exec(html);
      assert.ok(m, '.jobs-pop rule found');
      assert.ok(/position:fixed/.test(m[1]), '.jobs-pop is position:fixed (was position:absolute, ' +
        'relative-anchored to the pill — the OTHER half of the same live-found bug)');
      console.log('  .jobs-pop is position:fixed at the base rule, not just the mobile fallback: OK');
    }

    // ── 5. _jobsRenderList() renders the tutor row with its own icon/label/step/open button ────
    {
      const C = client();
      C.run(`_jobsLastList = []; _tutorState.busy = true;
        document.getElementById('jobs-pop').style.display = '';
        _jobsRenderList();`, 't5');
      const html = C.document.getElementById('jobs-pop-list').innerHTML;
      assert.ok(html.includes('🦉'), 'the tutor row uses the owl icon, not the generic hourglass');
      assert.ok(html.includes(UI_STRINGS_TUTOR_TITLE(C)), 'the tutor row is labeled with tutor.title');
      assert.ok(/data-jobid="__tutor__"/.test(html), 'the open button carries the synthetic id');
      console.log('  _jobsRenderList(): the tutor row renders its own icon + label + open button: OK');
    }

    // ── 6. _jobsOpenLink({type:'tutor'}) opens the tutor widget (only if not already open) ─────
    {
      const C = client();
      C.run(`
        window._openCalls = 0;
        toggleTutorWidget = function(){ window._openCalls++; _tutorState.open = !_tutorState.open; };
        window._closeCalls = 0;
        closeJobsPop = function(){ window._closeCalls++; };
        _tutorState.open = false;
        _jobsOpenLink({ type: 'tutor' });
      `, 't6a');
      assert.strictEqual(C.run('window._openCalls', 't6a-read'), 1, 'closed tutor: Open opens it');
      assert.strictEqual(C.run('window._closeCalls', 't6a-read2'), 1, 'the jobs popover itself closes');

      C.run(`window._openCalls = 0; _tutorState.open = true; _jobsOpenLink({ type: 'tutor' });`, 't6b');
      assert.strictEqual(C.run('window._openCalls', 't6b-read'), 0, 'already-open tutor: Open is a no-op on the widget');
      console.log('  _jobsOpenLink(tutor): opens the widget only when closed, always closes the popover: OK');
    }

    // NOT unit-testable here: _jobsPopOutside's target-discrimination relies on real Element
    // .contains(), which lib-dom.js stubs to unconditionally return false (line 385) for the
    // statically-parsed tree — checked directly (a probe against a known-nested pair returned
    // false too), so ANY assertion built on it here would pass or fail independent of whether the
    // real logic is correct, which is worse than no test. Verified LIVE instead, in a real browser,
    // after relocating #jobs-pop to the body level: a click inside the open popover (e.g. its
    // header) does not close it; a click elsewhere on the page does. See this item's own roadmap
    // write-up for the live-verification note.

    // ── v88_v: the job labels a person READS carry the image vocabulary, not "comic" ────────────
    // User report, with a screenshot of the popover: *"The job popover on the lower right still has
    // two mentions of 'comics'. We aimed to replace these, since 'comics' is just one use case of
    // the image upload. Below the image the text 'detect comic panels' is OK, since this really
    // refers to an image of a comics/manga."*
    //
    // ⚠️ WHY `v88_f`'s COMIC→IMAGE RENAME COULD NOT HAVE CAUGHT THIS. Both strings are hardcoded
    // English in `server.js`, not `ui.json` keys — `unit-ui-key-exists` sweeps what goes through
    // `t()`, and **server job labels are the one user-facing surface `ui.json` does not cover at
    // all**. They are never translated either; that is a known limitation, not something this
    // release changes.
    //
    // Asserted over the WHOLE SET of labels, not over the two that were reported: "a fix must apply
    // to every caller" is `v88_b`'s own lesson, and a third label added later with the old word
    // would otherwise ship unnoticed. The panel-DETECTION job is the ONE deliberate exception, by
    // the user's explicit ruling above — it really is about comics.
    {
      const srv = require('fs').readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8');
      // Interpolations are stripped: `${d.comic && …}` is CODE, and the claim is about the words a
      // person reads. Without this the draft label fails on its own `d.comic` field access — a field
      // that must NOT be renamed, since it is stored on every draft on disk.
      const readable = lit => lit.slice(1, -1).replace(/\$\{[^}]*\}/g, '');
      const labels = [];
      for (const m of srv.matchAll(/label:\s*(`[^`]*`|'[^']*'|"[^"]*")/g)) labels.push(readable(m[1]));
      for (const m of srv.matchAll(/const label = [^;]*?(`[^`]*`)/g)) labels.push(readable(m[1]));
      assert.ok(labels.length >= 8,
        'the sweep found the job labels (got ' + labels.length + ') — a short list means the regex '
        + 'stopped matching, not that every label is clean');
      const comicky = labels.filter(l => /comic/i.test(l));
      assert.deepStrictEqual(comicky.map(l => l.trim()), ['Detecting comic panels'],
        'the ONLY job label that still says "comic" is panel detection, which the user ruled correct '
        + '— it really is about a comic/manga image (got ' + JSON.stringify(comicky) + ')');
      assert.ok(labels.some(l => /Extracting image panels/.test(l)),
        'the extraction job reads as an IMAGE operation');
      assert.ok(labels.some(l => /Image draft/.test(l)),
        'and so does the parked draft');
      console.log('  server job labels: image vocabulary everywhere except panel detection: OK');
    }

    console.log('unit-jobs-popover: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('unit-jobs-popover FAILURE:', e.stack || e.message);
  }
  process.exit(failed ? 1 : 0);
})();

function UI_STRINGS_TUTOR_TITLE(C) {
  return C.run("UI_STRINGS['tutor.title']", 'read-title');
}
