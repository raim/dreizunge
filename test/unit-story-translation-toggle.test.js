// unit-story-translation-toggle.test.js
// v60.6 — when a story has a stored source-language translation (the auto-translate pass's
// storyTranslation), offer a way to switch languages in every "read story" panel.
//
// REWRITTEN (user follow-up): the single "🌐 Original/Translation" TEXT toggle button is replaced
// everywhere by TWO FLAG buttons (`_storyFlagButtonsHtml`, shared by all four instances) — clicking
// a flag SHOWS that language rather than blindly flipping. The same follow-up also unified the
// progress card's and question card's panel FRAMES (both are now `<details>` with a chapter TITLE,
// the flags, and the speak button in one summary row — previously the frames were deliberately
// different, only the body was shared). Four instances, all covered here:
//   1. the progress card (`comp-story-*`)
//   2. the question-card panel (`ex-story-*`)
//   3. the library's saved-item story reader (`sis-*`)
//   4. the storyline's combined "read full story" panel (`cs*`)
// Contract, per instance:
//   • The flag pair is HIDDEN unless storyTranslation exists — nothing to switch to.
//   • Default view is the target-language story; clicking a flag sets that language explicitly.
//   • Clicking the ALREADY-active flag is a harmless no-op re-render, not a flip away from it.
//   • Each flag's tooltip names its language, localized to APP.uiLang.
//   • The progress card's and question panel's 🔊 read whichever language is shown.
//   • Vocab highlighting applies only to the target story (a translation isn't the target lang).
//   • The static build gets it for free (whole topics baked, storyTranslation preserved) — same
//     claim as before, unaffected by this rewrite.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const builder = fs.readFileSync(path.join(ROOT, 'build-static.js'), 'utf8');
const LANGS_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const uiJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function seedLangs(C) {
  C.run(`LANGS = ${JSON.stringify(LANGS_JSON)}; UI_STRINGS = ${JSON.stringify(uiJson.en)}; APP.uiLang = 'en'; true;`);
}

// ── 1. _storyFlagButtonsHtml itself — the shared primitive ─────────────────────────────────────
{
  const C = loadClient({ quiet: true });
  seedLangs(C);

  const hidden = C.run(`_storyFlagButtonsHtml('it', 'de', false, 'target', l => 'x(' + l + ')')`);
  assert.strictEqual(hidden, '', 'no translation -> nothing rendered, same as the button it replaces');

  const html2 = C.run(`_storyFlagButtonsHtml('it', 'de', true, 'target', l => 'setLang(\\'' + l + '\\')')`);
  assert.ok(html2.includes('setLang(\'target\')') && html2.includes('setLang(\'source\')'),
    'both flags are wired via the SAME callback, one per language');
  assert.ok(/🇮🇹/.test(html2) && /🇩🇪/.test(html2), 'the target and source flags themselves render');
  assert.ok(/title="Italian"/.test(html2) && /title="German"/.test(html2),
    'each flag\'s tooltip names its language (localized, falls back to LANGS[].name here)');

  console.log('  _storyFlagButtonsHtml: hidden without a translation, wired + labeled with both flags: OK');
}

// Mutation check: prove the "hidden without a translation" claim can fail.
{
  const from = 'function _storyFlagButtonsHtml(targetLang, srcLang, hasTranslation, current, onClickFor) {\n  if (!hasTranslation) return \'\';';
  assert.ok(html.includes(from), 'mutation anchor found');
  const mutated = html.replace(from, from.replace('if (!hasTranslation) return \'\';', '// guard removed'));
  const C = loadClient({ quiet: true, file: (() => {
    const p = path.join(ROOT, 'test', '.tmp-mutated-flags.html');
    fs.writeFileSync(p, mutated);
    return p;
  })() });
  seedLangs(C);
  const got = C.run(`_storyFlagButtonsHtml('it', 'de', false, 'target', l => l)`);
  assert.notStrictEqual(got, '', 'THE MUTATION: removing the hasTranslation guard must produce non-empty output');
  fs.unlinkSync(path.join(ROOT, 'test', '.tmp-mutated-flags.html'));
  console.log('  mutation check: removing the no-translation guard breaks the hidden-when-absent claim: OK');
}

// ── 2. Progress card: title, flags, collapse frame, 🔊 follows the shown language ──────────────
{
  const C = loadClient({ quiet: true });
  seedLangs(C);
  C.run(`
    APP.lang = 'it';
    APP.lessonData = { topic: 'La Selezione Naturale', story: 'ZIEL story', storyTranslation: 'SOURCE translation', lang: 'it', srcLang: 'de', lessons: [] };
    APP._compStoryLang = 'target';
    true;`);
  C.run(`_renderCompStory(); true;`);

  assert.strictEqual(C.run(`document.getElementById('comp-story-panel-lbl').textContent`), 'La Selezione Naturale',
    'THE ACCEPTANCE CLAIM: the panel title is the CHAPTER title, not a generic caption');
  assert.strictEqual(C.run(`document.getElementById('comp-story-text').textContent`), 'ZIEL story',
    'defaults to the target story');
  assert.ok(C.run(`document.getElementById('comp-story-flags').innerHTML`).includes('🇮🇹'),
    'flags render into #comp-story-flags when a translation exists');
  // NOT asserted here: tagName === 'DETAILS' / .open === true. lib-dom never parses STATIC markup
  // outside the <script> block (INTERNALS.md §5) — #comp-story-panel is static, so getElementById()
  // hands back a generic stub div, not the real <details>. The <details open> claim is a SOURCE-TEXT
  // check instead, in the "markup + static parity" section below, where it belongs.

  C.run(`toggleCompStoryLang('source'); true;`);
  assert.strictEqual(C.run(`document.getElementById('comp-story-text').textContent`), 'SOURCE translation',
    'setting "source" shows the translation');
  assert.ok(C.run(`document.getElementById('comp-story-spk').getAttribute('onclick')`).includes('storyTranslation'),
    'the 🔊 reads the translation while it is shown');

  // Clicking the ALREADY-active flag is a no-op re-set, not a flip.
  C.run(`toggleCompStoryLang('source'); true;`);
  assert.strictEqual(C.run(`document.getElementById('comp-story-text').textContent`), 'SOURCE translation',
    'THE ACCEPTANCE CLAIM: re-setting the already-active language does not flip away from it');

  C.run(`toggleCompStoryLang('target'); true;`);
  assert.strictEqual(C.run(`document.getElementById('comp-story-text').textContent`), 'ZIEL story',
    'setting "target" restores the original');

  // No translation -> flags empty, story still shown.
  C.run(`APP.lessonData.storyTranslation = ''; APP._compStoryLang = 'target'; _renderCompStory(); true;`);
  assert.strictEqual(C.run(`document.getElementById('comp-story-flags').innerHTML`), '',
    'no translation -> no flags rendered');
  assert.strictEqual(C.run(`document.getElementById('comp-story-text').textContent`), 'ZIEL story',
    'story still shown without a translation');
}
console.log('  progress card: chapter title, collapsible frame, flags set (not flip), 🔊 follows: OK');

// ── 3. Question-card panel: same frame, same flags, title falls back sanely ────────────────────
{
  const C = loadClient({ quiet: true });
  seedLangs(C);
  C.run(`
    APP.lang = 'it';
    APP.lessonData = { topic: 'La Selezione Naturale', story: 'ZIEL story', storyTranslation: 'SOURCE translation', lang: 'it', srcLang: 'de', lessons: [] };
    APP._compStoryLang = 'target';
    true;`);
  const panelHtml = C.run(`_exStoryPanelHtml({ type: 'comprehension_mcq' })`);
  // user (progress-card redesign follow-up): "on all question cards the story text field should be
  // collapsed by default" — SUPERSEDES the "open by default, same as the progress card" claim this
  // pinned before. The two panels now deliberately DIFFER: #comp-story-panel (the progress card's
  // own field, untouched by this ruling) still opens by default; #ex-story-panel (this one, on every
  // question card) does not. Same FRAME either way — collapse control, title, flags, speech button —
  // just a different starting state.
  assert.ok(panelHtml.startsWith('<details id="ex-story-panel" style='),
    'THE ACCEPTANCE CLAIM: collapsed by default, UNLIKE the progress card\'s own panel');
  assert.ok(panelHtml.includes('La Selezione Naturale'),
    'THE ACCEPTANCE CLAIM: the question panel ALSO shows the chapter title, not "The story"');
  assert.ok(panelHtml.includes('🇮🇹') && panelHtml.includes('🇩🇪'), 'both flags render');
  assert.ok(/<summary[^>]*>.*🇮🇹.*🇩🇪.*💬/s.test(panelHtml.replace(/\n/g, '')) || (
    panelHtml.indexOf('</summary>') > panelHtml.indexOf('🇮🇹') &&
    panelHtml.indexOf('</summary>') > panelHtml.indexOf('💬')
  ), 'THE ACCEPTANCE CLAIM: title, flags, AND the speak button all sit inside the same <summary> row');

  // No topic title -> falls back to the old generic label rather than showing nothing.
  const noTopic = C.run(`(function(){ const save = APP.lessonData.topic; APP.lessonData.topic = ''; const h = _exStoryPanelHtml({type:'comprehension_mcq'}); APP.lessonData.topic = save; return h; })()`);
  assert.ok(noTopic.includes(uiJson.en['ex.comprehension.story']), 'a missing topic falls back to the old generic label');
}
console.log('  question-card panel: same frame as the progress card, title+flags+speech in one row: OK');

// ── 4. Saved-item card (library reader): flags, highlighting still target-only ─────────────────
{
  const C = loadClient({ quiet: true });
  seedLangs(C);
  C.run(`
    _savedStoryCache['x'] = { story: 'ZIEL', storyTranslation: 'SOURCE', lang: 'it', srcLang: 'de',
      lessons: [{ vocab: [{ target: 'ZIEL' }] }] };
    document.getElementById('sis-body-x').dataset.storyLang = 'target';
    _renderSavedStory('x');
    true;`);
  assert.ok(C.run(`document.getElementById('sis-body-x').innerHTML`).includes('ZIEL'), 'shows the target story');
  assert.ok(C.run(`document.getElementById('sis-flags-x').innerHTML`).includes('🇮🇹'), 'flags render with a translation');

  C.run(`toggleSavedStoryLang('x', 'source'); true;`);
  assert.ok(C.run(`document.getElementById('sis-body-x').innerHTML`).includes('SOURCE'), 'setting "source" shows the translation');

  // No translation -> flags empty.
  C.run(`
    _savedStoryCache['y'] = { story: 'ONLY', storyTranslation: '', lang: 'it', srcLang: 'de', lessons: [] };
    document.getElementById('sis-body-y').dataset.storyLang = 'target';
    _renderSavedStory('y');
    true;`);
  assert.strictEqual(C.run(`document.getElementById('sis-flags-y').innerHTML`), '', 'no translation -> no flags');
}
console.log('  saved-item card: flags render/hide correctly, set (not flip) the shown language: OK');

// ── 5. Markup + static parity ───────────────────────────────────────────────────────────────────
{
  assert.ok(/<details id="comp-story-panel" open/.test(html), 'progress card panel is a <details open>');
  assert.ok(/id="comp-story-flags"/.test(html), 'progress card has a flags mount point');
  assert.ok(!/comp-story-xlate|ex-story-xlate|sis-xlate-|csxlate-/.test(html),
    'THE REGRESSION: none of the four old text-toggle ids survive anywhere in the file');
  // The loader still caches the whole loaded topic so the flags need no re-fetch.
  const tssStart = html.indexOf('\nasync function toggleSavedStory(');
  assert.ok(tssStart >= 0, 'toggleSavedStory found');
  const savedStoryFn = html.slice(tssStart);
  assert.ok(/_savedStoryCache\[id\] = d/.test(savedStoryFn.slice(0, savedStoryFn.indexOf('\n}'))),
    'toggleSavedStory caches the loaded topic for the flags to use');
  // build-static bakes whole topics (spreads ...topic), so storyTranslation survives → static gets
  // the feature with no extra code. Assert the serializer doesn't drop it.
  assert.ok(/\{ \.\.\.topic, lessons: publicLessons \}/.test(builder) || /return topic;/.test(builder),
    'static serializer keeps whole topics (storyTranslation preserved)');
}
console.log('  markup: <details> frame, flags mount points, old toggle ids fully gone, static parity: OK');

// ── 6. Storyline "read full story" panel gets the same flag treatment ──────────────────────────
{
  const C2 = loadClient({ quiet: true });
  seedLangs(C2);
  const chapters = [
    { topic: 'Ch one', lang: 'it', srcLang: 'de', story: 'La selezione naturale.', storyTranslation: 'Die natürliche Selektion.', lessons: [] },
    { topic: 'Ch two', lang: 'it', srcLang: 'de', story: 'Le mutazioni.',          storyTranslation: 'Die Mutationen.',           lessons: [] },
  ];
  C2.run(`APP.lang='it'; APP.srcLang='de'; _chainStoryCache['ch1'] = ${JSON.stringify(chapters)}; true;`);
  const body = C2.document.getElementById('csbody-ch1');

  C2.run(`_renderChainStory(document.getElementById('csbody-ch1'), _chainStoryCache['ch1'], 'ch1');`);
  assert.ok(/La selezione naturale/.test(body.innerHTML), 'target text renders by default');
  assert.ok(!/natürliche Selektion/.test(body.innerHTML), 'and not the translation');
  assert.ok(C2.document.getElementById('csflags-ch1').innerHTML.includes('🇮🇹'),
    'the flags are offered when a translation exists (from the FIRST chapter\'s language pair)');

  C2.run(`toggleChainStoryLang('ch1', 'source');`);
  assert.ok(/natürliche Selektion/.test(body.innerHTML), 'setting "source" shows the translation');
  assert.ok(/Die Mutationen/.test(body.innerHTML), 'for every chapter, not just the first');
  assert.ok(!/La selezione naturale/.test(body.innerHTML), 'and hides the original');

  C2.run(`toggleChainStoryLang('ch1', 'source');`);
  assert.ok(/natürliche Selektion/.test(body.innerHTML),
    'THE ACCEPTANCE CLAIM: re-setting the already-active language does not flip back to target');

  C2.run(`toggleChainStoryLang('ch1', 'target');`);
  assert.ok(/La selezione naturale/.test(body.innerHTML), 'setting "target" restores the original');

  // A chapter with no translation falls back to its original rather than showing a gap.
  C2.run(`_chainStoryCache['ch2'] = [
    { topic:'A', lang:'it', srcLang:'de', story:'Uno.', storyTranslation:'Eins.', lessons:[] },
    { topic:'B', lang:'it', srcLang:'de', story:'Due.', lessons:[] } ];
    _chainStoryLang['ch2'] = 'source';
    _renderChainStory(document.getElementById('csbody-ch2'), _chainStoryCache['ch2'], 'ch2');`);
  const b2 = C2.document.getElementById('csbody-ch2').innerHTML;
  assert.ok(/Eins\./.test(b2), 'the translated chapter shows its translation');
  assert.ok(/Due\./.test(b2), 'the untranslated chapter still shows its original');

  // No translations at all -> no flags.
  C2.run(`_chainStoryCache['ch3'] = [{ topic:'C', lang:'it', srcLang:'de', story:'Tre.', lessons:[] }];
    _renderChainStory(document.getElementById('csbody-ch3'), _chainStoryCache['ch3'], 'ch3');`);
  assert.strictEqual(C2.document.getElementById('csflags-ch3').innerHTML, '',
    'no translation anywhere in the chain -> no flags');

  // 🔊 reads whatever is shown — unaffected by the flag rewrite.
  const spoken = C2.run(`(function(){
    let got = null;
    const orig = globalThis.speakBodyText;
    globalThis.speakBodyText = (a, lang, text) => { got = { lang, text }; };
    _chainStoryLang['ch1'] = 'source';
    speakChainStory('ch1');
    globalThis.speakBodyText = orig;
    return got;
  })()`);
  assert.ok(/natürliche Selektion/.test(spoken.text), 'the speaker reads the translation when shown');
  assert.strictEqual(spoken.lang, 'de', 'and uses the source language for it');

  console.log('  storyline full-story panel: flags set per-chapter-pair, all-chapters, fallback, 🔊: OK');
}

console.log('unit-story-translation-toggle: ALL PASSED');
