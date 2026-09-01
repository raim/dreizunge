// unit-comic-story-text.test.js
// items AY + AZ (v88_e) — a comic chapter's three views must not disagree about what to show.
//
// User report 1: "in the progress card of tp_17882535928630000095 the vocab-highlight does not show
// text, while the translation and text-analysis view do show text."
// User report 2 ("perhaps related"): "while text-analysis is running, the text is not shown in the
// original story language vocab-highlight view, while the image is not showing in the text-analysis
// view (which shows the '[…] CP2: analysing 2 sentence(s)…' message)."
//
// They ARE related, and they are two distinct defects:
//   • AY — `_comicStoryPanelsHtml()` builds each panel's text from `caption`+`inScene` ONLY. The
//     reported chapter is DESCRIPTION-ONLY (both empty; its story came from the v87_l image-
//     description fallback), so the default view rendered images with NO TEXT. The translation view
//     and the explorer both bypass the per-panel path and show the flat story — exactly the
//     asymmetry reported. Report 2's first half is this same bug, not an analysis-timing one.
//   • AZ — `_textExplorerBodyHtml()`'s four TRANSIENT states returned a bare status line with no
//     `_comicPanelsFlatTextHtml` wrapper, so the panel image vanished for the whole of a CP2 run.
//     Same class as v87_k: a surface that short-circuits the shared renderer loses what it grew.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// The reported chapter's real shape: one whole-image panel, NO caption, NO inScene, and (because it
// predates v88_d) no `description` field either — the story text exists only as `d.story`.
const STORY = 'Een weg loopt door een droge heideveld onder een blauwe hemel met wolken.';
const REPORTED = {
  id: 'tp_reported', topic: 'Verlassene Heide', lang: 'nl', srcLang: 'de',
  story: STORY, storyTranslation: 'Eine Straße führt durch ein trockenes Heidefeld.',
  lessons: [{ id: 1, type: 'standard', vocab: [{ target: 'weg', source: 'Straße' }] }],
  comicPanels: [{ x1: 0, y1: 0, x2: 1280, y2: 721, caption: '', inScene: '',
                  image: 'data:image/jpeg;base64,IMGDATA' }],
};

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    __D = ${JSON.stringify(REPORTED)};
    true;`, 'seed');
  return C;
}
const strip = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  let failed = false;
  try {

    // ── 1. THE REPORTED BUG: the default (vocab-highlight) view shows the text ─────────────────
    {
      const C = client();
      const html = C.run(`_storyBodyHtml(__D, {})`);
      assert.ok(strip(html).includes('droge heideveld'),
        'the default view renders the chapter text — it rendered NOTHING but an image before this cut');
      assert.ok(html.includes('IMGDATA'), 'and still renders the panel image');
      console.log('  a description-only comic chapter shows its text in the default view: OK');
    }

    // ── 2. …and the three views AGREE about the text they show ────────────────────────────────
    // The report is precisely that they disagreed. Compared on visible text, not markup: the views
    // legitimately differ in wrapper and colouring, but not in whether the story is present.
    {
      const C = client();
      const def   = strip(C.run(`_storyBodyHtml(__D, {})`));
      const trans = strip(C.run(`_storyBodyHtml(__D, { text: __D.storyTranslation, highlight:false })`));
      assert.ok(def.includes('droge heideveld'), 'default view: the target-language story');
      assert.ok(trans.includes('trockenes Heidefeld'), 'translation view: the translated story');
      assert.ok(!def.includes('trockenes Heidefeld'), 'and the two are genuinely different views (non-vacuity)');
      console.log('  the default and translation views both show their own text: OK');
    }

    // ── 3. Non-vacuity: a chapter WITH real panel lettering keeps per-panel pairing ────────────
    // The fix must not collapse every comic chapter to the flat rendering — that pairing is the
    // whole of PLAN §2.4 milestone 4.
    {
      const C = client();
      const html = C.run(`_storyBodyHtml({ ...__D, comicPanels: [
        { x1:0,y1:0,x2:10,y2:10, caption:'HALT', inScene:'Een bord.', image:'data:image/jpeg;base64,P1' },
        { x1:10,y1:0,x2:20,y2:10, caption:'STOP', inScene:'', image:'data:image/jpeg;base64,P2' } ] }, {})`);
      assert.ok(html.includes('comic-story-panel-text'), 'panels with lettering still render per-panel');
      const s = strip(html);
      assert.ok(s.includes('HALT') && s.includes('STOP'), 'each panel shows its OWN text');
      assert.ok(html.includes('P1') && html.includes('P2'), 'and each its own image');
      console.log('  a chapter with real panel lettering still gets per-panel pairing: OK');
    }

    // ── 4. A panel whose only content is a DESCRIPTION now renders that description ────────────
    // Chapters created from v88_d onward persist the field; before this cut it was never read here.
    {
      const C = client();
      const html = C.run(`_storyBodyHtml({ ...__D, comicPanels: [
        { x1:0,y1:0,x2:10,y2:10, caption:'', inScene:'', description:'Een bord bij een hek.',
          image:'data:image/jpeg;base64,P1' } ] }, {})`);
      assert.ok(strip(html).includes('Een bord bij een hek.'),
        "the panel description is rendered as that panel's text");
      console.log('  a description-only PANEL renders its description: OK');
    }

    // ── 5. A chapter with NO comicPanels is completely unchanged ──────────────────────────────
    // _comicPanelsFlatTextHtml is now called on the ordinary path too; it must stay a no-op there.
    {
      const C = client();
      const plain = { id:'t2', lang:'nl', srcLang:'de', story: STORY, lessons: [] };
      const html = C.run(`_storyBodyHtml(${JSON.stringify(plain)}, {})`);
      assert.ok(strip(html).includes('droge heideveld'), 'an ordinary chapter still renders its story');
      assert.ok(!html.includes('comic-story-panel'), 'and gains no comic markup whatsoever');
      console.log('  a chapter with no comicPanels is untouched: OK');
    }

    // ── 6. item AZ: the image survives every TRANSIENT explorer state ──────────────────────────
    {
      const C = client();
      for (const [status, extra] of [['loading', ''], ['analyzing', ", step:'CP2: analysing 2 sentence(s)…'"],
                                     ['error', ", error:'boom'"]]) {
        C.run(`_teCacheStore()['tp_reported'] = { status:'${status}'${extra} }; true;`, status);
        const html = C.run(`_textExplorerBodyHtml(__D)`);
        assert.ok(html.includes('IMGDATA'),
          `the panel image is still shown while the explorer is "${status}" — it vanished for the whole run before`);
        assert.ok(html.includes('te-status'), `and the ${status} status line is still rendered`);
      }
      console.log('  the panel image survives the loading/analyzing/error explorer states: OK');
    }

    // ── 7. …and the SETTLED state still works as it always did ────────────────────────────────
    {
      const C = client();
      C.run(`_teCacheStore()['tp_reported'] = { status:'ready', data:{ sentences: [] } }; true;`, 'ready');
      const html = C.run(`_textExplorerBodyHtml(__D)`);
      assert.ok(html.includes('IMGDATA'), 'settled: the image');
      assert.ok(strip(html).includes('droge heideveld'), 'settled: the story text');
      assert.ok(!html.includes('te-status'), 'and no status line');
      console.log('  the settled explorer state is unchanged (non-vacuity): OK');
    }

  } catch (e) { failed = true; console.error(e); }
  console.log(failed ? 'unit-comic-story-text: FAILED' : 'unit-comic-story-text: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
