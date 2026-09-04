// unit-tutor-selection.test.js
// PLAN §12 (user, v83 cut) — the interactive text-selection tutor: "select text, ask the tutor to
// explain its grammar or meaning, in the context of the story." Two pieces, tested separately:
//
//   1. THE RULING this cut required before the payload could be designed (roadmap PLAN §12, open
//      question 1): the tutor's REPLY LANGUAGE moves from srcLang ("I speak X") to APP.uiLang — a
//      genuinely separate, independently-set field since v81_ac — for the WHOLE tutor, not just this
//      new flow (user's explicit choice). srcLang keeps its OWN, different job unchanged: the
//      client's ledger lookup and the server's retrieval content-pairing filter
//      (tutorRetrieveContext). This is a back-compatible ADDITIVE change (a new `uiLang` field,
//      falling back to srcLang), not a rename — both roles are exercised here so a future edit
//      cannot collapse them back into one field without this test noticing.
//
//   2. THE NEW MECHANISM ITSELF: a second, independent interaction over the SAME rendered story
//      container the per-word tap already uses (`_storyBodyHtml`'s `<mark class="wp-tap">` /
//      `tapWord`, untouched). A free-text selection composes a pre-filled STUDENT turn — not the
//      tutor inventing an opener, not the learner typing it — and sends it through the existing
//      single tutor thread, reusing `/api/tutor`'s existing shape entirely (no new payload fields
//      beyond uiLang above). The DOM-shape gotcha this cut's own plan flagged — furigana readings
//      (`<ruby>base<rt>reading</rt></ruby>`) folding into a raw selection.toString() — is tested
//      behaviourally against the actual client function, not just described.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));
const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const { loadClient } = require('./lib-dom');

function extFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. Server: uiLang drives the REPLY, srcLang keeps retrieval unchanged ────
{
  const at = server.indexOf("url.pathname === '/api/tutor'");
  assert.ok(at > 0, 'the /api/tutor route exists');
  const route = server.slice(at, server.indexOf("url.pathname === '/api/story-qc'", at));

  assert.ok(/const uiLang = clip\(body\.uiLang \|\| body\.srcLang \|\| 'en', 8\);/.test(route),
    'a new uiLang field is read, falling back to srcLang for a client that has not sent it yet');
  assert.ok(/const S = langName\(uiLang\), L = langName\(lang\);/.test(route),
    'the REPLY language (S) is now uiLang, not srcLang');
  assert.ok(!/const S = langName\(srcLang\)/.test(route), 'srcLang no longer drives the reply language');
  // srcLang keeps its OWN, different job: retrieval's content-pairing filter, untouched.
  assert.ok(/tutorRetrieveContext\(\{[\s\S]{0,160}srcLang,/.test(route),
    'srcLang is still sent into retrieval, unchanged — a genuinely separate role from the reply language');
  // v86_m: retrieval also learns whether conversation history already exists (a topic-less
  // continuation mid-conversation skips the "grab by recency" fallback that a genuinely fresh
  // question still gets).
  assert.ok(/tutorRetrieveContext\(\{[\s\S]{0,200}hasHistory: history\.length > 0 \}\)/.test(route),
    'retrieval is told whether conversation history already exists');
  assert.ok(/reply \(\$\{lang\}←\$\{uiLang\}\)/.test(route), 'the reply log line reflects the real reply language');
}
console.log('  /api/tutor: uiLang drives the reply language, srcLang keeps its retrieval role: OK');

// ── 2. Client: _tutorGatherContext sends uiLang alongside the unchanged srcLang ─
{
  const gc = extFn(html, '_tutorGatherContext');
  assert.ok(/const uiLang = APP\.uiLang \|\| srcLang;/.test(gc),
    'uiLang is read from APP.uiLang (the separate, independently-set field), falling back to srcLang');
  assert.ok(/return \{ scope: sc, lang, srcLang, uiLang, story,/.test(gc),
    'uiLang is sent alongside the unchanged srcLang, lang, story — additive, not a replacement');
}
console.log('  client: _tutorGatherContext sends uiLang additively: OK');

// ── 3. The prompt persona no longer overclaims "native language" for {S} ─────
// {S} now carries whatever language the learner wants replies in (uiLang), which is not
// necessarily their native tongue (that is the whole reason APP.uiLang exists as a separate field).
{
  const sys = prompts.tutor.system;
  assert.ok(!/native language is \{S\}/.test(sys), 'the persona no longer claims {S} is the native language');
  assert.ok(/reads and writes in \{S\}/.test(sys), 'the persona describes {S} as the language replies use');
  assert.ok(sys.includes('{S}') && sys.includes('{L}'), 'both template variables still drive the prompt');
}
console.log('  tutor prompt: persona no longer overclaims {S} as "native language": OK');

// ── 4. _storyBodyHtml: the selection hook wraps the TARGET-language body only ─
{
  const C = loadClient({ quiet: true });
  const d = { story: 'Hallo Welt', lang: 'de', srcLang: 'en', lessons: [] };
  C.run(`APP.lessonData = ${JSON.stringify(d)}; true;`, 'seed');
  const withHl = C.run(`_storyBodyHtml(${JSON.stringify(d)}, {})`);
  assert.ok(/<div class="story-selectable" data-tutor-select="1">/.test(withHl),
    'the highlighted (target-language) body is wrapped in the selection hook');
  const noHl = C.run(`_storyBodyHtml(${JSON.stringify(d)}, { highlight: false })`);
  assert.ok(!/story-selectable/.test(noHl),
    'the SOURCE-language / translation view is NOT wrapped — a selection there would ask about the wrong language\'s text');
  // Coexistence: the existing per-word tap markup and handler are untouched by this.
  const body = extFn(html, '_storyBodyHtml');
  assert.ok(/onclick="event\.stopPropagation\(\);tapWord\(this\.textContent\)"/.test(html),
    'the per-word tap handler (tapWord) still exists, wired the same way');
  // v88_e (item AY): this used to pin the literal spelling `wrap(_storyParasHtml(`, which is a PROXY
  // — it broke on a refactor that kept the claim perfectly true (the comic image strip now sits
  // between the two calls). A proxy fails in both directions, so assert the CLAIM instead: the
  // selection wrapper is defined inside this ONE renderer, is what the return paths go through, and
  // exists nowhere else in the client — which is exactly "not per-caller".
  assert.ok(/const wrap = html =>/.test(body), 'the wrapper is DEFINED inside the shared renderer');
  assert.ok(/return wrap\(/.test(body), 'and the renderer returns through it');
  // "not per-caller" does NOT mean "exactly once": the per-panel comic renderer
  // (_comicStoryPanelsHtml, v85_n) legitimately has its own `wrap` too. The real claim is that every
  // EMISSION of the marker is a renderer's own wrap definition, never inlined at a call site — so
  // that is what is checked, over non-comment lines.
  const markerLines = html.split('\n')
    .filter(l => l.includes('data-tutor-select="1"') && !l.trim().startsWith('//'));
  assert.ok(markerLines.length >= 1, 'the marker is emitted somewhere');
  markerLines.forEach(l => assert.ok(/const wrap = html =>/.test(l),
    'every emission of the selection marker is a renderer\'s own `wrap` definition, never inlined '
    + 'at a call site — offending line: ' + l.trim().slice(0, 90)));
  // ONE story renderer, still — the wrap must not have grown a second copy of the body logic.
  assert.strictEqual((html.match(/function _storyBodyHtml\(/g) || []).length, 1, 'still exactly one story BODY renderer');
}
console.log('  _storyBodyHtml: selection hook wraps target-language output only, one renderer: OK');

// ── 5. _plainTextNoFurigana: the one real DOM-shape gotcha, tested behaviourally ─
// Furigana readings sit in the DOM as ordinary text (<ruby>base<rt>reading</rt></ruby>), so a raw
// selection.toString() across one would fold the READING into the segment. This is the pure string
// half of the fix (kept separate from Range/Selection plumbing so it is testable without a live
// browser selection, which the harness's DOM stub does not implement).
{
  const C = loadClient({ quiet: true });
  const run = (htmlIn) => C.run(`_plainTextNoFurigana(${JSON.stringify(htmlIn)})`);
  assert.strictEqual(run('x<ruby>漢字<rt>かんじ</rt></ruby>'), 'x漢字',
    'the furigana READING is excluded — only the base kanji survives');
  assert.ok(!run('<ruby>漢字<rt>かんじ</rt></ruby>').includes('かんじ'),
    'non-vacuity: the reading text really was present in the input and really is gone from the output');
  assert.strictEqual(run('  hello   \n  world  '), 'hello world', 'internal whitespace collapses, edges trim');
  assert.strictEqual(run('Hello <mark class="story-vocab-hl wp-tap">Welt</mark>'), 'Hello Welt',
    'ordinary highlight markup around a word does not corrupt the text');
  assert.strictEqual(run('a &amp; b'), 'a & b', 'HTML entities decode (the story was escaped before rendering)');
}
console.log('  _plainTextNoFurigana: furigana readings excluded, whitespace collapsed, entities decoded: OK');

// ── 6. The selection listener: gated correctly, coexists with the word-tap click ─
{
  const ms = extFn(html, '_storySelMaybeShow');
  assert.ok(/APP\.info\?\.canGenerate/.test(ms),
    'gated on a live backend — same honest-degradation call the tutor widget itself makes');
  assert.ok(/sel\.isCollapsed/.test(ms),
    'a COLLAPSED selection (a plain click, e.g. on a wp-tap <mark>) is ignored — this is what lets ' +
    'the free-text selection and the per-word tap coexist over the same container without one eating the other\'s click');
  assert.ok(/closest\('\.story-selectable'\)/.test(ms),
    'only fires inside the marked story body, never elsewhere in the app');
  assert.ok(/_STORY_SEL_MIN/.test(ms) && /_STORY_SEL_MAX/.test(ms), 'the captured text is length-bounded both ways');
  const init = extFn(html, '_storySelInit');
  assert.ok(/addEventListener\('mouseup', _storySelMaybeShow\)/.test(init) && /addEventListener\('touchend', _storySelMaybeShow\)/.test(init),
    'wired for both mouse and touch');
  assert.ok(/try\{ _storySelInit\(\); \}catch\(_\)\{\}/.test(html), 'wired once at boot, alongside the tutor thread load');
  assert.ok(/try\{ _storySelHide\(\); \}catch\(_\)\{\}/.test(extFn(html, 'show')),
    'a stale popover cannot survive a screen navigation');
}
console.log('  selection listener: gated on a live backend, coexists with the word-tap click: OK');

// ── 7. Grammar/meaning tap: a real STUDENT turn, not the tutor inventing an opener ─
{
  const ex = extFn(html, '_storySelExplain');
  assert.ok(/role:'student', text: t\(key, \{ segment: text \}\)/.test(ex),
    'a pre-filled STUDENT turn is pushed — closer to the NON-opening _tutorSend path than to opening:true');
  assert.ok(/mode === 'grammar' \? 'tutor\.sel_grammar_q' : 'tutor\.sel_meaning_q'/.test(ex),
    'grammar and meaning select different localized templates');
  assert.ok(/_tutorSaveThread\(\); _tutorRender\(\);/.test(ex) && /_tutorSend\(false\);/.test(ex),
    'the turn is persisted and sent through the existing single thread — no new payload shape');
  assert.ok(/if \(!_tutorState\.open\) toggleTutorWidget\(\);/.test(ex), 'opens the widget so the reply is visible');
  assert.ok(/!text \|\| !APP\.info\?\.canGenerate/.test(ex), 'also gated on a live backend, a second time');
}
console.log('  grammar/meaning tap: pre-filled student turn, existing single thread, no new payload shape: OK');

// ── 8. The popover exists, wired to both modes, and its labels are localized ────
{
  assert.ok(/id="story-sel-popover"/.test(html), 'the popover markup exists');
  assert.ok(/onclick="_storySelExplain\('grammar'\)"/.test(html), 'grammar button wired');
  assert.ok(/onclick="_storySelExplain\('meaning'\)"/.test(html), 'meaning button wired');
  const labels = extFn(html, '_tutorApplyLabels');
  assert.ok(/story-sel-grammar-lbl.*tutor\.sel_grammar/.test(labels) && /story-sel-meaning-lbl.*tutor\.sel_meaning/.test(labels),
    'the popover\'s labels are refreshed through the same localization cycle as the rest of the widget');
}
console.log('  popover: markup present, wired to both modes, labels localized: OK');

// ── 9. ui.json — new strings exist (en only, per project convention) ─────────
{
  for (const k of ['tutor.sel_grammar', 'tutor.sel_meaning', 'tutor.sel_grammar_q', 'tutor.sel_meaning_q']) {
    assert.ok(ui.en[k], `ui.json en has ${k}`);
  }
  assert.ok(ui.en['tutor.sel_grammar_q'].includes('{segment}'), 'the grammar prompt template takes {segment}');
  assert.ok(ui.en['tutor.sel_meaning_q'].includes('{segment}'), 'the meaning prompt template takes {segment}');
  assert.ok(/context of the story/.test(ui.en['tutor.sel_meaning_q']), 'meaning is explicitly asked in story context, per the user\'s own request');
}
console.log('  ui.json: new selection-popover strings present, en only: OK');

// ── 10. Touch devices get a DIFFERENT popover placement than desktop (v84_d, RE-RULED at v89_i) ──
// User report: on a phone the popover WAS appearing, just hidden underneath the browser's OWN
// native "Copy / Share" selection toolbar, which draws directly above the selection — a screen
// position this page cannot see or out-z-index (it's browser-chrome UI, not part of the DOM).
// Desktop (mouse selection, no native toolbar to collide with) keeps the original near-the-
// selection placement; touch gets a fixed spot well clear of it.
//
// ⚠️ WHICH fixed spot is the part that changed, and this section's assertion changed WITH it rather
// than being deleted. v84_d chose the BOTTOM (above #bottom-bar). A second user report showed that
// is where Android Chrome draws "Touch to Search", so the popover went straight back under a
// different piece of chrome. It is now pinned to the TOP of the VISIBLE area
// (`visualViewport.offsetTop`, because `position:fixed` is relative to the LAYOUT viewport and the
// two diverge as the URL bar collapses).
//
// The durable claim — the one worth keeping when this is re-ruled a third time — is NOT "bottom" or
// "top". It is: touch gets a FIXED, viewport-anchored, horizontally-CENTRED spot that does not
// depend on where the selection is, because every position near the selection belongs to the
// browser. That is what the assertions below are written against, with the current edge pinned
// explicitly and separately so a future change has to be deliberate.
{
  // Desktop: no touch signals on `navigator`/`window` — the harness's own default sandbox shape.
  const desktop = loadClient({ quiet: true });
  const dPop = desktop.run(`
    _storySelShowPopover({ getBoundingClientRect: () => ({ top: 300, left: 100, width: 50, height: 20 }) });
    ({ position: document.getElementById('story-sel-popover').style.position,
       top: document.getElementById('story-sel-popover').style.top,
       transform: document.getElementById('story-sel-popover').style.transform });
  `, 'desktop-popover');
  assert.strictEqual(dPop.position, 'absolute', 'desktop: popover is absolute-positioned (document coordinates, scroll-aware)');
  // `top`'s exact pixel value depends on window.scrollY, which this minimal DOM stub does not
  // define (a pre-existing harness gap, unrelated to this fix) — not asserted precisely here; the
  // point of this section is the BRANCH taken, not desktop's own (unchanged) pixel math.
  assert.ok(/px$/.test(dPop.top), 'desktop: top is still set to SOME pixel value (the assignment itself does not throw)');
  assert.strictEqual(dPop.transform, 'none', 'desktop: no centering transform (left is computed/clamped directly)');

  // Touch: maxTouchPoints > 0, the real-world signal a phone browser sets.
  const touch = loadClient({ quiet: true });
  touch.run(`navigator.maxTouchPoints = 5; true;`, 'seed-touch');
  const tPop = touch.run(`
    _storySelShowPopover({ getBoundingClientRect: () => ({ top: 300, left: 100, width: 50, height: 20 }) });
    ({ position: document.getElementById('story-sel-popover').style.position,
       bottom: document.getElementById('story-sel-popover').style.bottom,
       top: document.getElementById('story-sel-popover').style.top,
       left: document.getElementById('story-sel-popover').style.left,
       transform: document.getElementById('story-sel-popover').style.transform });
  `, 'touch-popover');
  assert.strictEqual(tPop.position, 'fixed', 'touch: popover is fixed-positioned (viewport-relative, ignores scroll)');
  assert.strictEqual(tPop.left, '50%', 'touch: horizontally centered, not anchored to the (invisible-to-us) selection position');
  assert.strictEqual(tPop.transform, 'translateX(-50%)', 'touch: centering transform actually applied');
  // v89_i: the TOP edge, and the bottom explicitly released — leaving a stale `bottom` alongside a
  // new `top` is how an element ends up stretched between the two.
  assert.strictEqual(tPop.bottom, 'auto', 'touch: the old bottom anchor is explicitly cleared, not just overridden');
  assert.strictEqual(tPop.top, '8px', 'touch: pinned to the top of the visible area');
  // ⚠️ The placement must not depend on the SELECTION's position: every spot near the selection is
  // where the browser draws its own toolbar. A second call with a wildly different rect must land in
  // exactly the same place.
  const tPop2 = touch.run(`
    _storySelShowPopover({ getBoundingClientRect: () => ({ top: 20, left: 5, width: 300, height: 90 }) });
    ({ top: document.getElementById('story-sel-popover').style.top,
       left: document.getElementById('story-sel-popover').style.left });
  `, 'touch-popover-2');
  assert.strictEqual(tPop2.top, tPop.top, 'touch: a completely different selection rect places the popover identically');
  assert.strictEqual(tPop2.left, tPop.left, 'touch: horizontally too');

  // `position:fixed` is relative to the LAYOUT viewport; on Android Chrome the VISUAL one shifts as
  // the URL bar collapses. The offset must be honoured, or the popover drifts under the URL bar.
  touch.run(`window.visualViewport = { offsetTop: 56, height: 700 }; true;`, 'seed-vv');
  const tPop3 = touch.run(`
    _storySelShowPopover({ getBoundingClientRect: () => ({ top: 300, left: 100, width: 50, height: 20 }) });
    document.getElementById('story-sel-popover').style.top;
  `, 'touch-popover-vv');
  assert.strictEqual(tPop3, '64px', 'touch: visualViewport.offsetTop is added to the inset (56 + 8)');

  // Non-vacuity: the two paths really do disagree, not just on unrelated fields.
  assert.notStrictEqual(dPop.position, tPop.position, 'sanity: desktop and touch genuinely take different code paths');
}
console.log('  touch gets a fixed, selection-independent popover pinned to the top of the VISIBLE area; desktop keeps the near-selection one: OK');

// ── 11. A short tap on PLAIN story text advances, like Next (mobile follow-up) ──
// User request: on the progress/entry cards, a short tap on plain (unhighlighted) story text
// should do what Next does; a tap on a HIGHLIGHTED word must keep ITS OWN existing behaviour
// (tapWord); a drag-select must be left alone (it opens the grammar/meaning popover instead, via
// the UNCHANGED §10 mechanism above). Reuses the SAME `sel.isCollapsed` signal §10 already trusts.
{
  const C = loadClient({ quiet: true });
  const setup = C.run(`
    document.getElementById('comp-story-text').innerHTML =
      '<span id="plain-span">plain text</span><mark class="story-vocab-hl wp-tap" id="hl-mark">Wort</mark>';
    document.getElementById('sum-sumtext').innerHTML = '<span id="sum-plain-span">summary text</span>';
    let compNextCalls = 0, sumNextCalls = 0;
    document.getElementById('comp-next').onclick = () => { compNextCalls++; };
    document.getElementById('sum-next').onclick = () => { sumNextCalls++; };
    window.__calls = () => ({ compNextCalls, sumNextCalls });
    true;
  `, 'setup');
  assert.ok(setup, 'fixture set up');

  const collapsed = () => C.run(`window.getSelection = () => ({ isCollapsed: true, rangeCount: 0 }); true;`);
  const dragged = () => C.run(`window.getSelection = () => ({ isCollapsed: false, rangeCount: 1, toString: () => 'dragged text' }); true;`);

  // A) Tap on PLAIN progress-card text (no real selection) -> comp-next fires.
  collapsed();
  C.run(`_storyTapMaybeAdvance({ target: document.getElementById('plain-span') }); true;`, 'tap-plain-comp');
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(window.__calls())`)), { compNextCalls: 1, sumNextCalls: 0 },
    'a tap on plain progress-card text calls comp-next exactly once');

  // B) Tap on the HIGHLIGHTED word -> comp-next must NOT fire (tapWord's own job, untouched here).
  collapsed();
  C.run(`_storyTapMaybeAdvance({ target: document.getElementById('hl-mark') }); true;`, 'tap-hl');
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(window.__calls())`)), { compNextCalls: 1, sumNextCalls: 0 },
    'a tap on a HIGHLIGHTED word does not ALSO call comp-next — count stays at 1 from (A)');

  // C) A drag-select over plain text -> comp-next must NOT fire (the selection popover's job).
  dragged();
  C.run(`_storyTapMaybeAdvance({ target: document.getElementById('plain-span') }); true;`, 'drag-plain');
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(window.__calls())`)), { compNextCalls: 1, sumNextCalls: 0 },
    'a drag-select over plain text does not call comp-next — count stays at 1');

  // D) Tap on the entry card's plain summary text -> sum-next fires.
  collapsed();
  C.run(`_storyTapMaybeAdvance({ target: document.getElementById('sum-plain-span') }); true;`, 'tap-plain-sum');
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(window.__calls())`)), { compNextCalls: 1, sumNextCalls: 1 },
    'a tap on plain entry-card text calls sum-next exactly once');

  // E) A tap OUTSIDE both containers does nothing at all (non-vacuity: this isn't a global catch-all).
  collapsed();
  C.run(`_storyTapMaybeAdvance({ target: document.getElementById('comp-hdr-title') }); true;`, 'tap-outside');
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(window.__calls())`)), { compNextCalls: 1, sumNextCalls: 1 },
    'a tap outside both containers calls neither — this is not a page-wide catch-all');

  // F) A disabled Next must not fire even on an otherwise-qualifying tap.
  C.run(`document.getElementById('comp-next').disabled = true; true;`);
  collapsed();
  C.run(`_storyTapMaybeAdvance({ target: document.getElementById('plain-span') }); true;`, 'tap-disabled');
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(window.__calls())`)), { compNextCalls: 1, sumNextCalls: 1 },
    'a DISABLED Next does not fire even on an otherwise-qualifying tap');

  // G) ⚠️ v88_ai (user report): in TEXT-ANALYSIS mode the progress-card body is inert.
  // "clicking on white space or non-marked words in the text analysis view should NOT open
  // questions, it should just be inert." The analysed tokens were already safe (each <mark> stops
  // propagation itself) — everything BETWEEN them was not, and both modes render into the SAME
  // element, so the mode is what has to be checked.
  C.run(`document.getElementById('comp-next').disabled = false; APP._textExplorer = true; true;`);
  collapsed();
  C.run(`_storyTapMaybeAdvance({ target: document.getElementById('plain-span') }); true;`, 'tap-explorer');
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(window.__calls())`)), { compNextCalls: 1, sumNextCalls: 1 },
    'a tap on plain text in analysis mode advances NOTHING — the count is unchanged from (A)');
  // The entry card has no explorer of its own, so it must be UNAFFECTED — otherwise this guard
  // would have quietly disabled a second surface nobody asked about.
  C.run(`_storyTapMaybeAdvance({ target: document.getElementById('sum-plain-span') }); true;`, 'tap-sum-explorer');
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(window.__calls())`)), { compNextCalls: 1, sumNextCalls: 2 },
    'while the entry card, which has no analysis mode, still advances');
  // Non-vacuity: turning the mode back OFF restores the tap, so (G) is the MODE talking and not
  // some other state this section happened to leave behind.
  C.run(`APP._textExplorer = false; true;`);
  collapsed();
  C.run(`_storyTapMaybeAdvance({ target: document.getElementById('plain-span') }); true;`, 'tap-explorer-off');
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(window.__calls())`)), { compNextCalls: 2, sumNextCalls: 2 },
    'and leaving analysis mode makes the progress card tappable again');
}
console.log('  a short tap on plain story/summary text advances like Next; highlighted words and drag-selects are both left alone: OK');

console.log('unit-tutor-selection: ALL PASSED');
