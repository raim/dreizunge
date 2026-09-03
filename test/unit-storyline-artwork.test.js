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
  // User request: centred on both surfaces — which one builder gives for free. `safe` matters: both
  // callers wrap this in overflow-x:auto, and a plain centred flex row that overflows pushes its
  // first items past the scroll origin where they cannot be reached.
  assert.ok(/justify-content:safe center/.test(stripLive),
    'the strip is centred, with the `safe` keyword so an overflowing strip still starts at panel 1');
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

// ── 6. ⚠️ The toggle is reachable on BOTH surfaces, from ONE definition ─────────────────────────
// ⚠️ v88_aj RE-SCOPED BOTH OF THESE SECTIONS TO THE OPPOSITE CLAIM. They asserted that a
// `_slThumbToggleHtml` BUTTON is emitted by three surfaces — the library card (`v87_m`), the
// storyline screen (`v87_n`, after the user could not find it) and the lesson-set page (`v87_n`
// again). The user has now moved the control: "Let's move the button to switch between storyboard
// and images INTO the storyboard generation popover, and remove it from the storyline, main and
// lesson-set pages." So these were not failing — they had become assertions of the wrong thing, the
// fourth time in this line (`v88_s`, `v88_ab`, `v88_ah`, now here).
//
// The ELIGIBILITY rule they pinned is unchanged and still worth pinning; only its shape moved, from
// a button to a menu entry. `_slThumbChoice` returns null when there is nothing to choose between —
// exactly how the user scoped it originally ("if BOTH ... exists").
{
  const C = client(LIVE);
  const SL = { id:'sl_x', storyboard:'<svg/>', chapters:['a','b'] };
  const call = () => C.run(`JSON.stringify(_slThumbChoice(${JSON.stringify(SL)}, ['a','b']))`);

  C.run(`APP._teacherMode = false; true;`);
  assert.strictEqual(JSON.parse(call()), null,
    'no switch outside teacher mode — this is curation, and it changes what every learner sees');

  C.run(`APP._teacherMode = true; true;`);
  const on = JSON.parse(call());
  assert.ok(on && on.id === 'sl_x', 'in teacher mode it offers the switch, for this storyline');
  // ⚠️ EQUALITY, not containment. `includes` passed over a real defect: an earlier draft prefixed
  // its own icon to a string that already starts with one, rendering "🎬 🎬 Show the storyboard…".
  // A containment check cannot see a doubled prefix; it was found by reading the live label.
  assert.strictEqual(on.label, UI.en['storyline.thumb_show_images'],
    'the label IS the ui.json string, verbatim — it already carries its own icon');
  assert.strictEqual(on.showingImages, false, 'and reports the current side');

  // Only when there is a genuine choice.
  assert.strictEqual(JSON.parse(C.run(`JSON.stringify(_slThumbChoice(${JSON.stringify({id:'sl_x', chapters:['a','b']})}, ['a','b']))`)), null,
    'no storyboard: nothing to choose between, so no entry');
  assert.strictEqual(JSON.parse(C.run(`JSON.stringify(_slThumbChoice(${JSON.stringify(SL)}, ['b']))`)), null,
    'no chapter with images: likewise no entry');
  assert.strictEqual(JSON.parse(C.run(`JSON.stringify(_slThumbChoice(null, ['a','b']))`)), null,
    'no storyline object: no throw, no entry');

  // Once switched, it offers the way BACK — otherwise the choice is one-way.
  const flipped = JSON.parse(C.run(`JSON.stringify(_slThumbChoice(${JSON.stringify({ ...SL, thumbMode:'images' })}, ['a','b']))`));
  assert.strictEqual(flipped.label, UI.en['storyline.thumb_show_storyboard'],
    'showing images, the entry offers the storyboard back — again verbatim');
  assert.strictEqual(flipped.showingImages, true, 'and says so');
}
console.log('  _slThumbChoice(): teacher-gated, only when there IS a choice, and reversible: OK');

// ── 6b. The switch is offered in the STORYBOARD MENU, and nowhere else ─────────────────────────
// ⚠️ Both halves matter. "Move it into the popover" is only half the instruction — leaving a copy
// on any of the three pages would satisfy a one-sided check and still be wrong. The removal is
// asserted as an ABSENCE over the whole file (`v88_s`'s rule), which is the only form that cannot
// be satisfied by luck.
{
  assert.ok(/value: 'thumb', label: _thumb\.label/.test(html),
    'the storyboard menu offers the switch as one of its choices');
  assert.ok(/else if \(choice === 'thumb'\)\s+await toggleSlThumbMode\(_thumb\.id\);/.test(html),
    'and choosing it performs the flip');
  assert.ok(/const _thumb = _slThumbChoice\(/.test(html),
    'gated by the same eligibility rule, so the menu never grows an entry that would do nothing');

  // ⚠️ ABSENCE, over the whole file: no surface renders a toggle BUTTON any more.
  assert.ok(!/_slThumbToggleHtml\s*\(/.test(html),
    'and NO page calls the old toggle-button renderer — it is gone, not merely unused');
  assert.ok(!/const _slToggle =/.test(html), 'the storyline screen no longer builds one');
  assert.ok(!/_lsTog/.test(html), 'nor does the lesson-set page');

  // The ARTWORK itself must survive on the surfaces that showed it — the user moved the control,
  // not the picture.
  assert.ok(/_slArtworkHtml\(_slSumMeta, chain\)/.test(html),
    'the library card still renders the artwork');
  assert.ok(/APP\._teacherMode \? _slArtworkHtml\(_ctxSl, _lsIds\) : ''/.test(html),
    'and the lesson-set page still renders it, teacher-only as before');
  assert.ok(/id="ls-storyline-art"/.test(html), 'with its own container in the lesson-set header');
}
console.log('  the switch lives in the storyboard menu, and on no page any more: OK');

// ⚠️ The sections below are the file's only ASYNC ones (toggleSlThumbMode awaits its own POST),
// so they live in an IIFE: this file is otherwise top-level-synchronous CommonJS, where a bare
// `await` is a parse error (ERR_AMBIGUOUS_MODULE_SYNTAX), not a runtime one.
(async () => {
// Its own fixture: §6's `SL` is block-scoped to that section, and widening a scope so a later block
// can borrow it couples two sections that otherwise share nothing.
const SL_ART = { id:'sl_x', storyboard:'<svg/>', chapters:['a','b'] };

// ── v88_ai: flipping the mode REPAINTS every surface, not just the library ─────────────────────
// ⚠️ User report: "Switching between storyboard and images requires a reload to take effect."
// `toggleSlThumbMode` only ever called `loadSavedList()`, which rebuilds the LIBRARY — so pressing
// the button on the storyline screen or the lesson-set card persisted the flip and left the artwork
// beside it stale. Exactly `v86_ad`'s standing lesson ("a second surface over shared state needs the
// repaint path widened too"), here with FOUR surfaces offering the control and one being repainted.
//
// Asserted behaviourally, by counting the renders each surface performs, not by reading the source.
{
  const C = loadClient({ quiet: true });
  const out = C.run(`(function(){
    APP._teacherMode = true;
    APP.storylines = [${JSON.stringify(SL_ART)}];
    APP._slScreen = { chainId:'sl_x', encodedChain:'%5B%5D', topics:[] };
    var calls = { sl:0, path:0, lib:0 };
    _renderStorylineScreen = function(){ calls.sl++; };
    buildPath = function(){ calls.path++; };
    loadSavedList = function(){ calls.lib++; return Promise.resolve(); };
    fetch = function(){ return Promise.resolve({ ok:true, json:function(){ return Promise.resolve({}); } }); };
    return toggleSlThumbMode('sl_x').then(function(){
      return JSON.stringify({ calls: calls, mode: APP.storylines[0].thumbMode });
    });
  })()`);
  const r = JSON.parse(await out);
  assert.strictEqual(r.mode, 'images', 'the flip still happens (non-vacuity: the toggle ran)');
  assert.strictEqual(r.calls.lib, 1, 'the library is still refreshed, as before');
  assert.strictEqual(r.calls.sl, 1,
    'and the STORYLINE SCREEN is repainted — the surface the user was looking at when they reported this');
  assert.strictEqual(r.calls.path, 1, 'and the lesson-set page, which offers the same button');
  console.log('  flipping the artwork mode repaints every surface that shows it, with no reload: OK');
}

// The repaint must be safe when those surfaces are NOT up — the library card is the common case,
// and a toggle pressed there must not try to render a storyline screen that does not exist.
{
  const C = loadClient({ quiet: true });
  const out = C.run(`(function(){
    APP._teacherMode = true;
    APP.storylines = [${JSON.stringify(SL_ART)}];
    APP._slScreen = null;
    var calls = { sl:0 };
    _renderStorylineScreen = function(){ calls.sl++; };
    buildPath = function(){ throw new Error('no lesson-set page'); };
    loadSavedList = function(){ return Promise.resolve(); };
    fetch = function(){ return Promise.resolve({ ok:true, json:function(){ return Promise.resolve({}); } }); };
    return toggleSlThumbMode('sl_x').then(function(){
      return JSON.stringify({ sl: calls.sl, mode: APP.storylines[0].thumbMode });
    }).catch(function(e){ return JSON.stringify({ threw: String(e.message) }); });
  })()`);
  const r = JSON.parse(await out);
  assert.ok(!r.threw, 'a toggle from the library does not throw when the other surfaces are absent (got ' + r.threw + ')');
  assert.strictEqual(r.sl, 0, 'and does not render a storyline screen that is not open');
  assert.strictEqual(r.mode, 'images', 'while still performing the flip');
  console.log('  and degrades safely when those surfaces are not open: OK');
}

console.log('unit-storyline-artwork: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
