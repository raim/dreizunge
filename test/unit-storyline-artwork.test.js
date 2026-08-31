// unit-storyline-artwork.test.js
// User request: "use the images of a comic story, or thumbnails thereof, instead of the story-board.
// If both, images and a storyboard exists, the teacher should be able to choose which to show on the
// main page and in the storyline view."
//
// Contract under test:
//   §1 _slThumbMode(): UNSET resolves as "storyboard if one exists, else the images" (user ruling);
//      an explicit thumbMode always wins.
//   §2 _slHasComicImages(): reads `comicPanelCount` from the LIVE list projection AND the inline
//      `comicPanels` the static build ships — the two builds carry different shapes and both count.
//   §3 _slImageStripHtml(): one thumbnail per CHAPTER (its first panel), in chapter order, each
//      clickable to its own chapter; live mode uses the /api/comic-thumb route, static uses the
//      inline data URL.
//   §4 _slArtworkHtml(): the resolver both surfaces call, incl. the fallback when a storyline is set
//      to 'images' but no chapter actually has one.
//   §5 ONE resolver, BOTH surfaces — asserted at the source layer, since the two render sites
//      drifting apart is the exact defect v87_k had to repair on another card.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function client(saved) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = ${JSON.stringify(saved || [])}; APP.storylines = [];
    show = function(){}; saveProg = function(){}; true;`, 'seed');
  return C;
}
const LIVE = [{ id:'a', topic:'Chap A', comicPanelCount:2 }, { id:'b', topic:'Chap B' }];
const STATIC = [{ id:'a', topic:'Chap A', comicPanels:[{ image:'data:image/png;base64,AAA' }] },
                { id:'b', topic:'Chap B' }];

// ── 1. _slThumbMode(): the unset rule, and explicit choices winning ──────────────
{
  const C = client(LIVE);
  const mode = (sl, ids) => C.run(`_slThumbMode(${JSON.stringify(sl)}, ${JSON.stringify(ids)})`);
  assert.strictEqual(mode({ storyboard:'<svg/>' }, ['a','b']), 'storyboard',
    'UNSET with a storyboard: the storyboard — nothing changes for an existing storyline');
  assert.strictEqual(mode({}, ['a','b']), 'images',
    'UNSET with no storyboard but images present: the images — a comic storyline finally shows something');
  assert.strictEqual(mode({}, ['b']), 'storyboard',
    'UNSET with neither: storyboard (which resolves to nothing to draw), not a broken image strip');
  assert.strictEqual(mode({ thumbMode:'images', storyboard:'<svg/>' }, ['a','b']), 'images',
    'an explicit images choice beats an existing storyboard — the whole point of the toggle');
  assert.strictEqual(mode({ thumbMode:'storyboard' }, ['a','b']), 'storyboard',
    'an explicit storyboard choice beats the images-present default');
  assert.strictEqual(mode({ thumbMode:'nonsense', storyboard:'<svg/>' }, ['a','b']), 'storyboard',
    'an unrecognised value is treated as UNSET, not as a third mode');
}
console.log('  _slThumbMode(): unset = storyboard-if-any-else-images; explicit always wins: OK');

// ── 2. _slHasComicImages(): both build shapes count ──────────────────────────────
// LIVE gets `comicPanelCount` from /api/lessons' whitelist projection; the static build ships whole
// topics and has the real `comicPanels` array. A helper that knew only one would make this feature
// work in one build and silently do nothing in the other — the exact failure v74_i/v79_n record on
// that projection.
{
  const live = client(LIVE), stat = client(STATIC);
  assert.strictEqual(live.run(`_slHasComicImages(['a','b'])`), true, 'live: comicPanelCount counts');
  assert.strictEqual(live.run(`_slHasComicImages(['b'])`), false, 'live: a chapter without it does not');
  assert.strictEqual(stat.run(`_slHasComicImages(['a','b'])`), true, 'static: an inline comicPanels array counts');
  assert.strictEqual(stat.run(`_slHasComicImages(['b'])`), false, 'static: a chapter without one does not');
  assert.strictEqual(live.run(`_slHasComicImages([])`), false, 'no chapters at all: false, not a throw');
  assert.strictEqual(live.run(`_slHasComicImages(['nope'])`), false, 'an id not in savedList: false, not a throw');
}
console.log('  _slHasComicImages(): counts the LIVE projection field and the STATIC inline array: OK');

// ── 3. _slImageStripHtml(): one cell per chapter, right source per build ─────────
{
  const live = client(LIVE);
  const stripLive = live.run(`_slImageStripHtml(['a','b'])`);
  assert.strictEqual((stripLive.match(/<img/g) || []).length, 1,
    'exactly one thumbnail — chapter B has no panels and contributes no empty cell');
  assert.ok(stripLive.includes('/api/comic-thumb/a'),
    'live mode loads through the route, NOT an inline data URL (a stored panel is ~240KB)');
  assert.ok(/loading="lazy"/.test(stripLive), 'lazily loaded — a library page can hold many storylines');
  assert.ok(/loadSaved\(/.test(stripLive), 'each thumbnail opens its own chapter, like a storyboard panel does');

  const stat = client(STATIC);
  const stripStatic = stat.run(`_slImageStripHtml(['a','b'])`);
  assert.ok(stripStatic.includes('data:image/png;base64,AAA'),
    'the static build uses the inline image it already ships — it has no server to ask');
  assert.ok(!stripStatic.includes('/api/comic-thumb/'), 'and never points at a route that will not exist there');

  assert.strictEqual(live.run(`_slImageStripHtml(['b'])`), '',
    'no chapter with an image yields NO strip at all, so callers can hide the wrapper');
}
console.log('  _slImageStripHtml(): one cell per chapter, route in live / inline in static, lazy + clickable: OK');

// ── 4. _slArtworkHtml(): what both surfaces actually render, incl. the fallback ──
{
  const C = client(LIVE);
  const art = (sl, ids) => C.run(`_slArtworkHtml(${JSON.stringify(sl)}, ${JSON.stringify(ids)})`);
  assert.ok(art({ storyboard:'<svg id="sb"/>' }, ['a','b']).includes('<svg id="sb"/>'),
    'unset + storyboard: the storyboard is rendered unchanged');
  assert.ok(art({ thumbMode:'images', storyboard:'<svg id="sb"/>' }, ['a','b']).includes('<img'),
    'explicit images: the strip replaces the storyboard');
  assert.ok(art({ thumbMode:'images', storyboard:'<svg id="sb"/>' }, ['b']).includes('<svg id="sb"/>'),
    'images chosen but NO chapter has one: falls back to the storyboard rather than showing an empty box');
  assert.strictEqual(art({ thumbMode:'images' }, ['b']), '',
    'images chosen, none exist, no storyboard either: empty string, so the caller hides the wrapper');
}
console.log('  _slArtworkHtml(): renders the chosen artwork, falls back rather than showing an empty box: OK');

// ── 5. ONE resolver, BOTH surfaces ──────────────────────────────────────────────
// Source-layer, because that is where the claim is real: the library card and the storyline screen
// must not each decide for themselves. v87_k is the precedent — a second surface re-implementing a
// shared renderer silently missed four things it had grown.
{
  const calls = (html.match(/_slArtworkHtml\(/g) || []).length;
  assert.ok(calls >= 3, `_slArtworkHtml is defined and called by both surfaces (${calls} occurrences)`);
  assert.ok(/const _slSb2 = _slArtworkHtml\(/.test(html), 'the library storyline card renders through it');
  assert.ok(/const _slSb = _slArtworkHtml\(/.test(html), 'the storyline screen renders through it');
  assert.ok(!/const _slSb2 = _slSumMeta\?\.storyboard/.test(html),
    'and the card no longer reads .storyboard directly, which is how the two would drift');
  assert.ok(!/const _slSb = slMeta\?\.storyboard \|\| '';/.test(html),
    'nor does the screen');
  for (const k of ['storyline.thumb_show_images', 'storyline.thumb_show_storyboard']) {
    assert.ok(UI.en[k], `${k} exists in ui.json en`);
  }
}
console.log('  one resolver, both surfaces, and the toggle strings exist: OK');

console.log('unit-storyline-artwork: ALL PASSED');
