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

    // ── 4. A panel whose only content is a DESCRIPTION still renders that description ──────────
    // Chapters created from v88_d onward persist the field; before v88_e it was never read here.
    //
    // ⚠️ v88_ab REBUILT THIS SECTION, and the reason is worth stating: its fixture spread `__D`
    // (whose story is the heideveld text) over a panel holding an UNRELATED description, i.e. a
    // chapter whose `story` and whose panel copy disagreed. Measured across the whole store at the
    // v88_ab cut, that state does not occur: for all 18 chapters carrying panels the panel
    // derivation reproduced `story` character-for-character, the sole exception being a panel with
    // no text at all (which this renderer never sees — `_comicPanelsHaveText` gates it to the flat
    // path). A real description-only chapter has `story === description`, because v87_l's fallback
    // is what put the description there. The old fixture passed only because the renderer
    // re-derived the text and ignored `story`; v88_ab made the single-panel case read `story`
    // directly, precisely so the two can never disagree on screen.
    //
    // So the claim is split in two, and NEITHER half is the old vacuous one:
    //   4a — the realistic single-panel shape, pinning the GATE (a description-only panel must be
    //        admitted to the per-panel pairing at all, which is `_comicPanelsHaveText`'s job).
    //   4b — a MULTI-panel chapter, where per-panel derivation is the only thing that can produce
    //        each panel's text, pinning `_comicTextFromFields` inside the renderer.
    {
      const C = client();
      const DESC = 'Een bord bij een hek.';
      const html = C.run(`_storyBodyHtml({ ...__D, story: ${JSON.stringify(DESC)}, comicPanels: [
        { x1:0,y1:0,x2:10,y2:10, caption:'', inScene:'', description:${JSON.stringify(DESC)},
          image:'data:image/jpeg;base64,P1' } ] }, {})`);
      assert.ok(strip(html).includes(DESC),
        "the panel description is rendered as that panel's text");
      // ⚠️ NO non-vacuity assertion for the GATE here, and that is deliberate — it CANNOT have one.
      // A first draft asserted `comic-story-panel-text` to claim this reached the per-panel pairing
      // rather than the flat fallback. Mutation-testing `_comicPanelsHaveText` (made to ignore
      // `description`) left it GREEN: for ONE panel, `_comicPanelsFlatTextHtml` emits the identical
      // comic-story-panels / comic-story-panel / comic-story-panel-text wrapper, so the two paths
      // are indistinguishable in both markup AND text once story === description. That marker was a
      // proxy that could never fire. The gate's real claim is asserted in §4b-gate below, in the
      // multi-panel fixture where the two paths genuinely produce different output.
      console.log('  a description-only PANEL renders its description: OK');
    }

    // ── 4b-gate. _comicPanelsHaveText: a description-only chapter still gets PER-PANEL pairing ──
    // The gate decides between per-panel pairing (each panel's text beside its own image) and the
    // flat path (all images, then the whole `story` once). Those differ only when there is MORE
    // THAN ONE panel — which is why this is the fixture that can observe it. Both panels here carry
    // nothing but a description, so if the gate stopped counting `description` the chapter would
    // fall to the flat path and render `d.story` instead of the two panel texts.
    {
      const C = client();
      const html = C.run(`_storyBodyHtml({ ...__D, comicPanels: [
        { x1:0,y1:0,x2:10,y2:10, caption:'', inScene:'', description:'Een bord bij een hek.',
          image:'data:image/jpeg;base64,P1' },
        { x1:10,y1:0,x2:20,y2:10, caption:'', inScene:'', description:'Een pad door de heide.',
          image:'data:image/jpeg;base64,P2' } ] }, {})`);
      const s = strip(html);
      assert.ok(s.includes('Een bord bij een hek.') && s.includes('Een pad door de heide.'),
        'both description-only panels render their own text — the gate admitted them');
      assert.ok(!s.includes('droge heideveld'),
        'and the chapter story is NOT what was rendered (non-vacuity: this is the per-panel path, not the flat one)');
      console.log('  _comicPanelsHaveText admits description-only panels to the per-panel path: OK');
    }

    // ── 4b. MULTI-panel: each panel's OWN text is derived, description included ────────────────
    // The single-panel shortcut cannot apply here (a flat story string cannot be split back across
    // panels), so this is the section that pins the renderer's use of the shared text rule.
    {
      const C = client();
      const html = C.run(`_storyBodyHtml({ ...__D, comicPanels: [
        { x1:0,y1:0,x2:10,y2:10, caption:'HALT', inScene:'', description:'', image:'data:image/jpeg;base64,P1' },
        { x1:10,y1:0,x2:20,y2:10, caption:'', inScene:'', description:'Een bord bij een hek.',
          image:'data:image/jpeg;base64,P2' } ] }, {})`);
      const s = strip(html);
      assert.ok(s.includes('HALT'), 'the lettering panel shows its lettering');
      assert.ok(s.includes('Een bord bij een hek.'),
        'and the description-only panel shows its description — derived per panel, not from d.story');
      assert.ok(!s.includes('droge heideveld'),
        'and neither panel falls back to the chapter story (non-vacuity: d.story is NOT what is shown here)');
      console.log('  a MULTI-panel chapter derives each panel\'s own text, descriptions included: OK');
    }

    // ── 4c. v88_ab: the COMBINE ruling, end to end on the render side ──────────────────────────
    // The user's ruling replaced v87_l's `extracted || description` with `extracted + description`.
    // The reported shape is a photographed sign whose caption came back as the 12-character heading
    // while the description held a full sentence about the same photo.
    {
      const C = client();
      const CAP = 'De Manteling', DESC = 'Een landschap met heuvels en struiken.';
      // A chapter created under the new rule: comicCreateChapter builds `story` with
      // _comicPanelText, so story and panel agree by construction. Built here the same way rather
      // than hand-written, so the test cannot drift from the function it is about.
      const story = C.run(`_comicPanelText({ text:{ caption:${JSON.stringify(CAP)}, inScene:'',
        description:${JSON.stringify(DESC)} } })`);
      assert.strictEqual(story, CAP + '\n\n' + DESC, 'the chapter text carries both blocks');
      const html = C.run(`_storyBodyHtml({ ...__D, story: ${JSON.stringify(CAP + '\n\n' + DESC)},
        comicPanels: [ { x1:0,y1:0,x2:10,y2:10, caption:${JSON.stringify(CAP)}, inScene:'',
          description:${JSON.stringify(DESC)}, image:'data:image/jpeg;base64,P1' } ] }, {})`);
      const s = strip(html);
      assert.ok(s.includes(CAP), 'the sign heading is shown');
      assert.ok(s.includes('Een landschap met heuvels'),
        'AND the description is shown — a 12-character heading no longer suppresses it');
      // It must appear ONCE. Reading `story` (which already contains the description) and ALSO
      // appending the panel's `description` is the duplication this design exists to prevent, and
      // it is exactly what the v86_g story-edit sync would have caused.
      assert.strictEqual(s.split('Een landschap met heuvels').length - 1, 1,
        'exactly once — not duplicated by the renderer re-appending the panel description');
      // Two <p> blocks, not one paragraph: _storyParasHtml splits on a blank line.
      assert.ok((html.match(/<p[ >]/g) || []).length >= 2,
        'and as two paragraph blocks, which is the blank-line separator doing its job');
      console.log('  v88_ab: extracted heading AND description both render, once, as two blocks: OK');
    }

    // ── 4d. v88_ab: a story EDIT reaches the story panel with no panel sync at all ─────────────
    // v86_g's server-side sync used to be what kept this surface correct after a story edit, and
    // under the combine rule re-deriving would append `description` a second time. The single-panel
    // case now reads `d.story`, so the stale panel copy cannot reach the screen. This is that
    // claim, stated as the divergence it protects against.
    {
      const C = client();
      const html = C.run(`_storyBodyHtml({ ...__D, story:'De gecorrigeerde tekst.', comicPanels: [
        { x1:0,y1:0,x2:10,y2:10, caption:'De oude OCR-tekst met de typfout', inScene:'',
          description:'Een oude beschrijving.', image:'data:image/jpeg;base64,P1' } ] }, {})`);
      const s = strip(html);
      assert.ok(s.includes('De gecorrigeerde tekst.'), 'the edited story is what the panel shows');
      assert.ok(!s.includes('typfout'), 'the stale panel caption does not reach the screen');
      assert.ok(!s.includes('Een oude beschrijving.'),
        'and neither does the stale panel description — no re-derivation happens for one panel');
      console.log('  a single-panel chapter shows d.story, so a stale panel copy cannot leak: OK');
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
