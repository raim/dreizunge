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
  assert.ok(/tutorRetrieveContext\(\{[\s\S]{0,120}srcLang \}\)/.test(route),
    'srcLang is still sent into retrieval, unchanged — a genuinely separate role from the reply language');
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
  assert.ok(/wrap\(_storyParasHtml\(/.test(body), 'the wrapper is applied via the shared renderer, not per-caller');
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

console.log('unit-tutor-selection: ALL PASSED');
