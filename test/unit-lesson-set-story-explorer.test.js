// unit-lesson-set-story-explorer.test.js
// v86_ad — user-requested, after two rounds of "wrong card" investigation: "i meant the lesson-set
// card that is only visible in teacher mode, it's text display should also have language flags and
// text-analysis buttons." This is the `#story-section` ("📖 Read the story") card inside the
// `#lesson-set` screen — DISTINCT from both the library-list row's own 🔤 button (v86_ac) and the
// student completion card's own flags+explorer (`_renderCompStory`, item W). Its own 🔍 is QC
// ("Proofread with QC model"), a different feature entirely — the new explorer toggle here uses 🔬.
//
// Full parity with the completion card, per the user's own explicit choice: same
// _storyFlagButtonsHtml / CP1-CP2 cache (_teCacheStore/_ensureTextExplorerData/_textExplorerBodyHtml)
// machinery, reusing it verbatim — just a SEPARATE state pair (APP._lsStoryLang/APP._lsTextExplorer,
// not APP._compStoryLang/APP._textExplorer), since a teacher can have both cards open in different
// senses (this card, plus a student-preview of the completion card) without one silently flipping
// the other's visible state.
//
// Contract under test:
//   1. #ls-story-analyze-btn visibility — canGenerate AND a story (matches #story-qc-btn/
//      #story-retranslate-btn's own precedent exactly); the read-only 🔬 explorer toggle needs no
//      such gate.
//   2. renderStoryText(d): default (target, no explorer) highlights vocab in the TARGET text; flags
//      reflect 'target' active. toggleLsStoryLang('source') switches to storyTranslation, WITHOUT
//      vocab highlighting (vocab is target-language, matching it against a translation finds
//      nothing real), flags reflect 'source' active.
//   3. toggleLsTextExplorer(): renders REAL per-word <mark> elements from the CP1/CP2 cache (not a
//      _storyBodyHtml highlight variant) when data exists — checked against the actual DOM, not the
//      source's own branch.
//   4. Flags/explorer mutual exclusivity (the SAME v86_y fix, now replicated here): turning the
//      explorer ON unclicks BOTH flags; clicking either flag turns the explorer OFF.
//   5. speakStory() reads whichever language/text is CURRENTLY shown (target story vs source
//      translation), not always the target.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP.savedList = []; APP.storylines = [];
    show = function(){}; saveProg = function(){};
    true;`, 'seed');
  return C;
}

const BASE_TOPIC = { id: 'tp_ls1', topic: 'Farm', lang: 'de', srcLang: 'en', difficulty: 1,
  story: 'Der Hund lauft schnell.', storyTranslation: 'The dog runs fast.',
  lessons: [{ type: 'vocab', vocab: [{ target: 'Hund' }] }] };

async function main() {

// ── 1. #ls-story-analyze-btn visibility — matches #story-qc-btn/#story-retranslate-btn exactly ──
{
  const C = client();
  const cases = [
    { teacher: false, canGenerate: true,  story: true,  want: '',     label: 'backend + story, even WITHOUT teacher mode: SHOWN (matches story-qc-btn)' },
    { teacher: true,  canGenerate: true,  story: true,  want: '',     label: 'teacher + backend + story: also SHOWN' },
    { teacher: true,  canGenerate: false, story: true,  want: 'none', label: 'no backend (static build): HIDDEN even in teacher mode' },
    { teacher: true,  canGenerate: true,  story: false, want: 'none', label: 'no story yet: HIDDEN — nothing to analyse' },
  ];
  for (const c of cases) {
    const topic = { ...BASE_TOPIC, story: c.story ? BASE_TOPIC.story : '' };
    C.run(`APP.info = { backend:'local', canGenerate:${c.canGenerate} };
      APP._teacherMode = ${c.teacher};
      APP.lessonData = ${JSON.stringify(topic)};
      APP.lang = 'de'; APP.srcLang = 'en';
      APP._lsStoryLang = null; APP._lsTextExplorer = false;
      buildPath(); true;`, 'case');
    const display = C.run(`document.getElementById('ls-story-analyze-btn').style.display`);
    assert.strictEqual(display, c.want, c.label + ' (got display="' + display + '")');
  }
}
console.log('  #ls-story-analyze-btn: shown for a real backend + an existing story, regardless of teacher mode (matches story-qc-btn/story-retranslate-btn): OK');

// ── 2. renderStoryText: target highlights vocab; toggleLsStoryLang('source') shows the
//    translation, unhighlighted; flags reflect the active language ────────────────────────────
{
  const C = client();
  C.run(`APP.lessonData = ${JSON.stringify(BASE_TOPIC)};
    APP.lang = 'de'; APP.srcLang = 'en';
    APP._lsStoryLang = null; APP._lsTextExplorer = false;
    renderStoryText(APP.lessonData); true;`, 't2a');
  const target = JSON.parse(C.run(`JSON.stringify({
    html: document.getElementById('story-body').innerHTML,
    flags: document.getElementById('ls-story-flags').innerHTML })`));
  assert.ok(/Hund/.test(target.html), 'target view shows the target story text');
  assert.ok(/story-vocab-hl|vocab/.test(target.html) || /<mark/.test(target.html) || /class="[^"]*hl/.test(target.html),
    `target view highlights the vocab word "Hund" somehow (got ${target.html.slice(0,300)})`);
  assert.ok(/story-flag-btn/.test(target.flags), 'flags rendered (a translation exists)');

  C.run(`toggleLsStoryLang('source'); true;`, 't2b');
  const source = JSON.parse(C.run(`JSON.stringify({
    html: document.getElementById('story-body').innerHTML,
    flags: document.getElementById('ls-story-flags').innerHTML })`));
  assert.ok(/dog runs fast/.test(source.html), 'source view shows the ENGLISH translation, not the German story');
  assert.ok(!/Hund/.test(source.html), 'switching to source no longer shows the target text at all');
}
console.log('  renderStoryText(): target view highlights vocab; toggleLsStoryLang(\'source\') shows the translation instead, both reflected in the flags: OK');

// ── 3. toggleLsTextExplorer(): renders REAL per-word marks from the CP1/CP2 cache ───────────────
{
  const C = client();
  C.run(`APP.lessonData = ${JSON.stringify(BASE_TOPIC)};
    APP.lang = 'de'; APP.srcLang = 'en';
    APP._lsStoryLang = null; APP._lsTextExplorer = false;
    renderStoryText(APP.lessonData);
    // Seed the SHARED cache directly — same store toggleTextExplorer's own _ensureTextExplorerData
    // reads/writes, keyed by chapter id, so this test exercises the REAL renderer with REAL data
    // rather than mocking fetch.
    _teCacheStore()['tp_ls1'] = { status: 'ready', data: { sentences: [
      { text: 'Der Hund lauft schnell.', tokens: [
        { idx:0, surface:'Der', lemma:'der', form:'article', sense:'the', confidence:'high' },
        { idx:1, surface:'Hund', lemma:'hund', form:'noun', sense:'dog', confidence:'high' },
      ] },
    ] } };
    toggleLsTextExplorer(); true;`, 't3');
  const r = JSON.parse(C.run(`JSON.stringify({
    explorer: APP._lsTextExplorer,
    html: document.getElementById('story-body').innerHTML,
    btnOpacity: document.getElementById('ls-story-explorer-btn').style.opacity })`));
  assert.strictEqual(r.explorer, true, 'toggleLsTextExplorer() turns the state ON');
  assert.ok(/te-tok/.test(r.html) && /data-lemma="der"/.test(r.html) && /data-lemma="hund"/.test(r.html),
    `the body renders REAL per-word marks from the CP1/CP2 cache, not the plain vocab-highlight view (got ${r.html.slice(0,300)})`);
  assert.strictEqual(r.btnOpacity, '1', 'the explorer button shows itself active');
}
console.log('  toggleLsTextExplorer(): renders REAL per-word <mark> elements from the CP1/CP2 cache into #story-body: OK');

// ── 4. Flags/explorer mutual exclusivity (the v86_y fix, replicated here) ───────────────────────
{
  const C = client();
  C.run(`APP.lessonData = ${JSON.stringify(BASE_TOPIC)};
    APP.lang = 'de'; APP.srcLang = 'en';
    APP._lsStoryLang = 'source'; APP._lsTextExplorer = false;
    renderStoryText(APP.lessonData);
    _teCacheStore()['tp_ls1'] = { status: 'ready', data: { sentences: [] } };
    toggleLsTextExplorer(); true;`, 't4a');
  const afterOn = JSON.parse(C.run(`JSON.stringify({
    lang: APP._lsStoryLang, flags: document.getElementById('ls-story-flags').innerHTML })`));
  assert.strictEqual(afterOn.lang, 'target', 'turning the explorer ON forces the language back to target');
  assert.ok(!/border:1\.5px solid var\(--blue\)/.test(afterOn.flags),
    `neither flag renders active while the explorer is on (got ${afterOn.flags})`);

  C.run(`toggleLsStoryLang('target'); true;`, 't4b');
  const afterFlag = JSON.parse(C.run(`JSON.stringify({ explorer: APP._lsTextExplorer })`));
  assert.strictEqual(afterFlag.explorer, false, 'clicking a flag exits explorer mode');
}
console.log('  flags and the text-explorer toggle are genuine alternatives: turning one on always turns the other off: OK');

// ── 5. speakStory() reads whichever language/text is CURRENTLY shown ────────────────────────────
{
  const C = client();
  C.run(`APP.lessonData = ${JSON.stringify(BASE_TOPIC)};
    APP.lang = 'de'; APP.srcLang = 'en';
    window._speakCalls = [];
    speakBodyText = function(bodyId, lang, text){ window._speakCalls.push({ lang, text }); };
    APP._lsStoryLang = null; speakStory(); true;`, 't5a');
  const target = JSON.parse(C.run('JSON.stringify(window._speakCalls[0])'));
  assert.strictEqual(target.lang, 'de', 'target mode speaks the TARGET language');
  assert.ok(/Der Hund/.test(target.text), 'target mode speaks the target story text');

  C.run(`window._speakCalls = []; APP._lsStoryLang = 'source'; speakStory(); true;`, 't5b');
  const source = JSON.parse(C.run('JSON.stringify(window._speakCalls[0])'));
  assert.strictEqual(source.lang, 'en', 'source mode speaks the SOURCE language');
  assert.ok(/dog runs fast/.test(source.text), 'source mode speaks the translation, not the target story');
}
console.log('  speakStory(): reads whichever language/text is currently shown (target story vs source translation), not always the target: OK');

console.log('unit-lesson-set-story-explorer: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
