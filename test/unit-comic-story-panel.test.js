// unit-comic-story-panel.test.js
// PLAN §2.4 / Track A4 milestone 4 (v85_n) — the LAST milestone: comic-sourced chapters render each
// drawn panel's image with its own transcribed text, instead of the plain paragraph flow, in the ONE
// shared story renderer (_storyBodyHtml) every progress card / question panel / chain view already
// goes through. Tier 1 per PLAN §2.6 — reuses the EXISTING word-highlighting machinery
// (_highlightVocabHtml) applied PER PANEL, not per-word image coordinates (Tier 2, still out of
// scope). Standing ruling (made earlier in this line): comic-sourced chapters ONLY.
// Contract under test:
//   • §1 markup: d.comicPanels present → .comic-story-panels > .comic-story-panel (one per panel,
//     in order), each with .comic-story-panel-img (src = the panel's own image) and
//     .comic-story-panel-text.
//   • §2 NO REGRESSION: a topic without comicPanels still renders the plain paragraph flow —
//     .comic-story-panels never appears.
//   • §3 opts.text overriding what to show BYPASSES the comic branch even when d.comicPanels exists
//     — the panels describe d.story specifically, not an arbitrary caller-supplied text.
//   • §4 opts.highlight===false still renders panels (an image is still useful without vocab marks)
//     but WITHOUT the story-selectable wrapper and WITHOUT word-marking.
//   • §5 vocab highlighting applies PER PANEL via the SAME _highlightVocabHtml machinery — a known
//     vocab word inside one panel's text gets wrapped in <mark class="...wp-tap">.
//   • §6 a panel with only caption (or only in-scene) text joins cleanly, no stray blank line/<br>.
//   • §7 a panel with no image (undefined) renders no broken <img> tag.
//   • §8 (v86_a, user-reported) THE REAL CALLERS actually reach the branch. §1-§7 all call
//     _storyBodyHtml() DIRECTLY, which proved the function correct but never proved either real
//     caller (_renderCompStory / _exStoryPanelHtml) ever reaches it — and neither did, in real
//     usage, for every release from v85_n through v85_u: both passed an explicit `text:` override
//     UNCONDITIONALLY, which defeats the `o.text == null` check regardless of whether the override
//     happens to equal the default (exactly what §3 above documents as correct — it IS correct for
//     _storyBodyHtml itself, the bug was entirely in what its two callers chose to pass it).
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
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang='de'; APP.srcLang='en';
    APP.difficulty=2; true;`, 'seed');
  return C;
}

const COMIC_TOPIC = {
  id: 'tp_comic1', topic: 'A Comic Chapter', lang: 'de', srcLang: 'en',
  story: 'So wurde ein Schild aufgestellt.\nRiesen sind hier nicht willkommen.',
  comicPanels: [
    { x1: 0, y1: 0, x2: 100, y2: 100, caption: 'So wurde ein Schild aufgestellt.', inScene: 'Riesen sind hier nicht willkommen.', image: 'data:image/jpeg;base64,AAAA' },
    { x1: 100, y1: 0, x2: 200, y2: 100, caption: 'Zweites Bild.', inScene: '', image: 'data:image/jpeg;base64,BBBB' },
  ],
  lessons: [{ id: 'ls1', type: 'standard', vocab: [{ target: 'Schild', source: 'sign' }] }],
};
const PLAIN_TOPIC = {
  id: 'tp_plain1', topic: 'A Plain Chapter', lang: 'de', srcLang: 'en',
  story: 'Ein ganz normaler Text ohne Comic.',
  lessons: [{ id: 'ls2', type: 'standard', vocab: [{ target: 'Text', source: 'text' }] }],
};

function main() {

// ── 1. Markup: one .comic-story-panel per drawn panel, in order, image + text ────
{
  const C = client();
  const htmlOut = C.run(`_storyBodyHtml(${JSON.stringify(COMIC_TOPIC)}, {})`);
  const r = JSON.parse(C.run(`
    var d = document.createElement('div'); d.innerHTML = ${JSON.stringify(htmlOut)};
    var panels = d.querySelectorAll('.comic-story-panel');
    JSON.stringify({
      count: panels.length,
      img0: panels[0].querySelector('.comic-story-panel-img').getAttribute('src'),
      img1: panels[1].querySelector('.comic-story-panel-img').getAttribute('src'),
      text0: panels[0].querySelector('.comic-story-panel-text').textContent,
      hasContainer: !!d.querySelector('.comic-story-panels')
    })`));
  assert.strictEqual(r.count, 2, 'exactly one .comic-story-panel per drawn panel');
  assert.strictEqual(r.img0, 'data:image/jpeg;base64,AAAA', 'panel 0 image is its OWN cropped image, in order');
  assert.strictEqual(r.img1, 'data:image/jpeg;base64,BBBB', 'panel 1 image is its OWN cropped image, in order');
  assert.ok(r.text0.includes('So wurde ein Schild aufgestellt.') && r.text0.includes('Riesen sind hier nicht willkommen.'),
    "panel 0's text includes BOTH caption and in-scene text (the user's own ruling: both, not caption-only)");
  assert.ok(r.hasContainer, '.comic-story-panels container wraps the whole thing');
}
console.log('  markup: .comic-story-panels > .comic-story-panel (image + text) per drawn panel, in order: OK');

// ── 2. No regression: a plain topic still renders the ordinary paragraph flow ────
// NOTE: querySelector on this harness's DOM stub NEVER returns null on a genuine miss — it
// auto-vivifies an empty stub <div>, which is indistinguishable BY TAG from a real match here
// (both are divs). Existence checks below therefore search the raw HTML STRING directly, not the
// parsed DOM — the documented, established workaround for this exact trap.
{
  const C = client();
  const htmlOut = C.run(`_storyBodyHtml(${JSON.stringify(PLAIN_TOPIC)}, {})`);
  assert.ok(!htmlOut.includes('comic-story-panels'), 'a topic with no comicPanels never renders .comic-story-panels');
  // "Text" is itself the topic's own vocab word, so it renders wrapped in a <mark> — checking
  // around it rather than the literal phrase, so this assertion doesn't fight the highlighting
  // this same plain-text path has always done.
  assert.ok(htmlOut.includes('Ein ganz normaler') && htmlOut.includes('ohne Comic'), 'a plain topic still renders its story text normally');
}
console.log('  no regression: a topic without comicPanels renders the ordinary paragraph flow: OK');

// ── 3. opts.text overriding what to show BYPASSES the comic branch ───────────────
{
  const C = client();
  const htmlOut = C.run(`_storyBodyHtml(${JSON.stringify(COMIC_TOPIC)}, { text: 'Some other text entirely.' })`);
  assert.ok(!htmlOut.includes('comic-story-panels'), 'opts.text overriding the shown text bypasses the comic-panel branch even when d.comicPanels exists');
  assert.ok(htmlOut.includes('Some other text entirely.'), 'the overridden text is what actually renders');
}
console.log('  opts.text override bypasses the comic-panel branch: OK');

// ── 4. opts.highlight===false: panels still render, no selection wrapper, no marks ──
{
  const C = client();
  const htmlOut = C.run(`_storyBodyHtml(${JSON.stringify(COMIC_TOPIC)}, { highlight: false })`);
  const panelCount = (htmlOut.match(/class="comic-story-panel"/g) || []).length;
  assert.strictEqual(panelCount, 2, 'highlight:false still renders both panels (the image is useful regardless)');
  assert.ok(!htmlOut.includes('story-selectable'), 'highlight:false omits the tutor-selection wrapper, same as the plain-text path');
  assert.ok(!htmlOut.includes('<mark'), 'highlight:false renders panel text WITHOUT vocab marking');
}
console.log('  opts.highlight===false: panels still render, but without the selection wrapper or vocab marks: OK');

// ── 5. Vocab highlighting applies PER PANEL via the SAME _highlightVocabHtml machinery ──
{
  const C = client();
  const htmlOut = C.run(`_storyBodyHtml(${JSON.stringify(COMIC_TOPIC)}, {})`);
  // querySelectorAll's length IS meaningful on a miss (unlike singular querySelector, which
  // auto-vivifies) — used throughout for existence checks, not `!!querySelector(...)`.
  const r = JSON.parse(C.run(`
    var d = document.createElement('div'); d.innerHTML = ${JSON.stringify(htmlOut)};
    var panels = d.querySelectorAll('.comic-story-panel');
    var marks0 = panels[0].querySelectorAll('mark.wp-tap');
    JSON.stringify({ selectableCount: d.querySelectorAll('.story-selectable').length,
      panel0MarkCount: marks0.length,
      markText: marks0.length ? marks0[0].textContent : null })`));
  assert.strictEqual(r.selectableCount, 1, 'the whole comic-panels container is wrapped for tutor-selection, same as the plain-text path');
  assert.strictEqual(r.panel0MarkCount, 1, "panel 0's own vocab word (\"Schild\", from d.lessons[0].vocab) is marked using the EXISTING highlighting machinery");
  assert.strictEqual(r.markText, 'Schild', 'the marked span is exactly the vocab word, not a larger/smaller span');
}
console.log('  vocab highlighting applies per panel via the existing _highlightVocabHtml machinery: OK');

// ── 6. A panel with only caption (no in-scene) joins cleanly, no stray blank line ──
// A nested `.querySelector(...).innerHTML` on a sub-element pulled from a querySelectorAll result
// does NOT reflect real content on this harness (a further DOM-stub limitation beyond the documented
// null-on-miss one — textContent and attributes read back fine, per §5/§1 above, but innerHTML on a
// doubly-nested match does not) — parsing the raw HTML STRING directly instead of round-tripping
// through the stub DOM sidesteps it entirely.
{
  const C = client();
  const htmlOut = C.run(`_storyBodyHtml(${JSON.stringify(COMIC_TOPIC)}, {})`);
  const textBlocks = [...htmlOut.matchAll(/class="comic-story-panel-text">(.*?)<\/div>/g)].map(m => m[1]);
  assert.strictEqual(textBlocks.length, 2, 'two panel-text blocks found in the raw output');
  assert.ok(textBlocks[1].includes('Zweites Bild.'), "panel 1 (caption only, empty inScene) renders its caption");
  assert.ok(!/<br>\s*$/.test(textBlocks[1].trim()) && !textBlocks[1].includes('<br><br>'),
    'no stray trailing/doubled <br> from joining an empty inScene field (caption/inScene.filter(Boolean) drops it before joining)');
}
console.log('  a panel with only caption text (empty in-scene) joins cleanly, no stray blank line: OK');

// ── 7. A panel with no image renders no broken <img> tag ─────────────────────────
// Same raw-string approach as §6 — splitting on the panel boundary itself rather than round-
// tripping through the stub DOM's nested-query limitations.
{
  const C = client();
  const topic = JSON.parse(JSON.stringify(COMIC_TOPIC));
  delete topic.comicPanels[1].image;
  const htmlOut = C.run(`_storyBodyHtml(${JSON.stringify(topic)}, {})`);
  const panelBlocks = htmlOut.split('class="comic-story-panel"').slice(1);
  assert.strictEqual(panelBlocks.length, 2, 'two panel blocks found in the raw output');
  assert.strictEqual((panelBlocks[0].match(/comic-story-panel-img/g) || []).length, 1, 'a panel WITH an image still renders its <img> tag normally');
  assert.strictEqual((panelBlocks[1].match(/comic-story-panel-img/g) || []).length, 0, 'a panel with no image renders NO <img> tag (not a broken/empty-src one)');
}
console.log('  a panel with no image renders no <img> tag at all, rather than a broken one: OK');

// ── 8. THE REAL CALLERS actually reach the comic-panel branch (v86_a, user-reported) ─────────────
// Every case above calls _storyBodyHtml() DIRECTLY — proving the function itself is correct, but
// NOT that either of its two real callers (_renderCompStory for the progress card,
// _exStoryPanelHtml for the question panel) ever reaches the branch. They didn't: both
// UNCONDITIONALLY passed an explicit `text:` override (identical in VALUE to _storyBodyHtml's own
// default on the story side, so no prior test caught it), which defeats the `o.text == null` check
// regardless of whether the override happens to equal the default — §3 above even documents that
// exact defeating behaviour as a correct, intentional feature. A real comic-derived topic's panel
// images therefore NEVER rendered on either surface, confirmed by the user after `v85_n`/`v85_t`/
// `v85_u` all shipped without catching it. Fixed by passing `text: null` on the STORY side (letting
// _storyBodyHtml's own default and comic-panel branch both fire) and keeping an explicit override
// ONLY for the TRANSLATION side, which has no per-panel data to show instead.
{
  const C = client();
  C.run(`
    document.getElementById('use-comic-cb');   // harmless touch, not required
    APP.lessonData = ${JSON.stringify(COMIC_TOPIC)};
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._compStoryLang = 'target';
    true;`, 'comp-story-setup');
  const out = C.run(`_renderCompStory(); document.getElementById('comp-story-text').innerHTML;`);
  assert.ok(out.includes('comic-story-panels'),
    '_renderCompStory() (the PROGRESS CARD\'s real renderer) reaches the comic-panel branch for a comic-sourced topic');
  assert.ok(out.includes('data:image/jpeg;base64,AAAA'),
    'and the actual panel image is present, not just the container');
}
console.log('  THE REAL PROGRESS-CARD RENDERER (_renderCompStory) reaches the comic-panel branch: OK');

{
  // The translation side must NOT show panels (no per-panel translation exists) — falls back to the
  // plain flat-text path, same as before this fix, on that one side only.
  const C = client();
  const topic = { ...JSON.parse(JSON.stringify(COMIC_TOPIC)), storyTranslation: 'A translated story.' };
  C.run(`
    APP.lessonData = ${JSON.stringify(topic)};
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._compStoryLang = 'source';
    true;`, 'comp-story-translation-setup');
  const out = C.run(`_renderCompStory(); document.getElementById('comp-story-text').innerHTML;`);
  assert.ok(!out.includes('comic-story-panels'),
    'showing the TRANSLATION side does not attempt to show per-panel images (no per-panel translation data exists)');
  assert.ok(out.includes('A translated story.'), 'the translation text itself still renders');
}
console.log('  the TRANSLATION side of the progress card still falls back to plain text (no per-panel translation): OK');

{
  const C = client();
  C.run(`
    APP.lessonData = ${JSON.stringify(COMIC_TOPIC)};
    APP._compStoryLang = 'target';
    true;`, 'ex-story-setup');
  const out = C.run(`_exStoryPanelHtml({ type: 'comprehension_mcq' });`);
  assert.ok(out.includes('comic-story-panels'),
    '_exStoryPanelHtml() (the QUESTION PANEL\'s real renderer) also reaches the comic-panel branch');
  assert.ok(out.includes('data:image/jpeg;base64,AAAA'), 'and the actual panel image is present there too');
}
console.log('  THE REAL QUESTION-PANEL RENDERER (_exStoryPanelHtml) also reaches the comic-panel branch: OK');

console.log('unit-comic-story-panel: ALL PASSED');
}

main();
