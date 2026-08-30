// unit-retranslate-chain.test.js
// v86_y — user-requested parity fix: "the new translate button is available only on chapter-level
// (lesson-set card)... Both should be available on both cards, and on the storyline page, the
// button should translate all chapters."
//
// This file covers the STORYLINE PAGE half (the lesson-set page's own #story-retranslate-btn is
// covered by unit-retranslate-story.test.js already):
//   • §1 the "read full story" header markup: a 🔄 button appears with the correct data-chain
//     (the SAME JSON chapter-id array analyzeChaptersRun's own button reads) when a real backend is
//     available, and is absent entirely otherwise (matches the lesson-set button's own gate).
//   • §2 retranslateChain(): loops /api/retranslate-story ONCE PER CHAPTER via {topicId} (not a name
//     lookup), isolates one failure from the rest, updates BOTH APP.savedList and the chain's own
//     render cache so a re-render shows the fresh text, re-renders the body, restores the button,
//     and toasts a done/failed summary.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = () => new Promise(r => setTimeout(r, 25));

const CHAPTERS = [
  { id: 'tp_c1', topic: 'Chapter One', lang: 'it', srcLang: 'de', story: 'Uno.', storyTranslation: 'Eins.', lessons: [] },
  { id: 'tp_c2', topic: 'Chapter Two', lang: 'it', srcLang: 'de', story: 'Due.', storyTranslation: 'Zwei.', lessons: [] },
];

function client(canGenerate) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = ${JSON.stringify(CHAPTERS)};
    APP.storylines = [];
    APP.info = { backend:${canGenerate ? "'ollama'" : "'none'"}, canGenerate:${!!canGenerate} };
    APP.uiLang = 'de'; APP.srcLang = 'de'; APP.overruleStorylineLang = false;
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false;
    true;`, 'seed');
  return C;
}

async function main() {

// ── 1. the "read full story" header: a 🔄 button, correct data-chain, gated on canGenerate ──────
{
  const C = client(true);
  const chainId = 'sl_x';
  const encodedChain = encodeURIComponent(JSON.stringify(CHAPTERS.map(c => c.topic)));
  C.run(`APP._slScreen = { chainId: ${JSON.stringify(chainId)}, encodedChain: ${JSON.stringify(encodedChain)}, topics: ${JSON.stringify(CHAPTERS.map(c => c.topic))} };
    _renderStorylineScreen(${JSON.stringify(chainId)}, ${JSON.stringify(encodedChain)}, ${JSON.stringify(CHAPTERS.map(c => c.topic))}); true;`, 'render');
  const html = C.run(`document.getElementById('sl-screen-body').innerHTML`);
  const btnMatch = /<button class="story-icon-btn" onclick="event\.stopPropagation\(\);retranslateChain\('slsc-sl_x',this\)"[^>]*data-chain="([^"]+)"[^>]*>🔄<\/button>/.exec(html);
  assert.ok(btnMatch, `the storyline page's own retranslate button is rendered with the right onclick target (got: ${html.slice(0, 400)})`);
  const ids = JSON.parse(decodeURIComponent(btnMatch[1]));
  assert.deepStrictEqual(ids, ['tp_c1', 'tp_c2'], 'data-chain carries the REAL chapter ids, in order, resolved the same way analyzeChaptersRun\'s own button is');
}
console.log('  storyline page: the retranslate button is rendered with the correct chapter-id data-chain: OK');

{
  const C = client(false);
  const chainId = 'sl_x';
  const encodedChain = encodeURIComponent(JSON.stringify(CHAPTERS.map(c => c.topic)));
  // Teacher mode (not canGenerate) unlocks the "read full story" section's OWN outer lock
  // (_allChaptersDone), so this isolates the retranslate button's OWN gate — without it, a mutation
  // that always renders the button would pass vacuously here too, since the whole section would be
  // showing its LOCKED 🔒 variant either way (no canGenerate, no teacher mode, chapters not
  // "complete" by _chapterComplete's own real rule, which this fixture makes no attempt to satisfy).
  C.run(`APP._slScreen = { chainId: ${JSON.stringify(chainId)}, encodedChain: ${JSON.stringify(encodedChain)}, topics: ${JSON.stringify(CHAPTERS.map(c => c.topic))} };
    APP._teacherMode = true;
    _renderStorylineScreen(${JSON.stringify(chainId)}, ${JSON.stringify(encodedChain)}, ${JSON.stringify(CHAPTERS.map(c => c.topic))}); true;`, 'render-no-backend');
  const html = C.run(`document.getElementById('sl-screen-body').innerHTML`);
  assert.ok(!/🔒/.test(html), 'sanity: the section is genuinely UNLOCKED here (teacher mode), so an absent button below is a real gate, not the section itself being hidden');
  assert.ok(!/retranslateChain/.test(html), 'no backend (static build): the retranslate button is absent entirely, not just disabled');
}
console.log('  storyline page: no backend -> the retranslate button is absent entirely: OK');

// ── 2. retranslateChain(): per-chapter POST via topicId, cache sync, isolation, toast ───────────
{
  const C = client(true);
  C.run(`_chainStoryCache['sl_x'] = ${JSON.stringify(CHAPTERS)};
    _chainStoryLang['sl_x'] = 'source';   // viewing the translation column, so the fresh text is the one on screen
    document.getElementById('csbody-sl_x').setAttribute('id','csbody-sl_x');
    window._fetchCalls = [];
    fetch = function(url, opts){
      const body = JSON.parse(opts.body);
      window._fetchCalls.push(body.topicId);
      // tp_c1 (the FIRST id in data-chain) fails — proves a later chapter still runs afterward,
      // not just that a LATER failure leaves an earlier success alone.
      if (body.topicId === 'tp_c1') return Promise.resolve({ ok:false, status:500, json: function(){ return Promise.resolve({error:'boom'}); } });
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ storyTranslation: 'FRESH ' + body.topicId }); } });
    };
    window._toasts = []; showToast = function(m){ window._toasts.push(m); };
    const btn = { dataset: { chain: encodeURIComponent(JSON.stringify(['tp_c1','tp_c2'])) }, disabled:false, innerHTML:'🔄' };
    window._btn = btn;
    (async()=>{ await retranslateChain('sl_x', btn); })();
    true;`, 'run');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({
    fetchCalls: window._fetchCalls,
    savedC1: (APP.savedList.find(s=>s.id==='tp_c1')||{}).storyTranslation,
    savedC2: (APP.savedList.find(s=>s.id==='tp_c2')||{}).storyTranslation,
    cacheC2: (_chainStoryCache['sl_x'].find(d=>d.id==='tp_c2')||{}).storyTranslation,
    toasts: window._toasts,
    btnDisabled: window._btn.disabled, btnHtml: window._btn.innerHTML,
  })`));
  assert.deepStrictEqual(r.fetchCalls, ['tp_c1', 'tp_c2'], 'one POST per chapter id, in data-chain order, via topicId (not a name lookup) — and BOTH ran, proving the first one\'s failure did not stop the loop');
  assert.strictEqual(r.savedC1, 'Eins.', 'the FAILED (first) chapter\'s savedList entry keeps its ORIGINAL translation, untouched — not corrupted with a partial/garbage value');
  assert.strictEqual(r.savedC2, 'FRESH tp_c2', 'the SECOND chapter still succeeds and lands its FRESH translation on APP.savedList, even though the FIRST one failed — real isolation, not just "failures happen to be last"');
  assert.strictEqual(r.cacheC2, 'FRESH tp_c2', 'the chain\'s OWN render cache is updated too, so the body re-render below actually shows the fresh text');
  assert.ok(r.toasts.some(t => /1/.test(t) && /re-?translat/i.test(t)), 'toast reports how many succeeded: ' + JSON.stringify(r.toasts));
  assert.ok(r.toasts.some(t => /1/.test(t) && /failed/i.test(t)), 'toast ALSO reports the one failure, not silently swallowed: ' + JSON.stringify(r.toasts));
  assert.strictEqual(r.btnDisabled, false, 'the button is re-enabled after the batch finishes');
  assert.strictEqual(r.btnHtml, '🔄', 'the button label is restored to its original icon, not left showing the hourglass');
  const bodyHtml = C.run(`document.getElementById('csbody-sl_x').innerHTML`);
  assert.ok(/FRESH tp_c2/.test(bodyHtml), 'the chain body was re-rendered with the fresh translation once the batch completed');
}
console.log('  retranslateChain(): one POST per chapter via topicId, a single failure is isolated, savedList AND the chain cache both sync, the body re-renders, and the toast names both outcomes: OK');

// ── 3. clean no-ops ───────────────────────────────────────────────────────────────────────────
{
  const C = client(false);   // no backend
  C.run(`window._fetchCalled = false; fetch = function(){ window._fetchCalled = true; };
    const btn = { dataset: { chain: encodeURIComponent(JSON.stringify(['tp_c1'])) } };
    (async()=>{ await retranslateChain('sl_x', btn); })();
    true;`, 'no-backend');
  await settle();
  assert.strictEqual(C.run('window._fetchCalled'), false, 'no backend: a clean no-op, no network call at all');
}
{
  const C = client(true);
  C.run(`window._fetchCalled = false; fetch = function(){ window._fetchCalled = true; };
    (async()=>{ await retranslateChain('sl_x', null); })();
    true;`, 'no-btn');
  await settle();
  assert.strictEqual(C.run('window._fetchCalled'), false, 'no button (data-chain unavailable): a clean no-op, no network call, no throw');
}
console.log('  retranslateChain(): no backend, or no button to read data-chain from, are both clean no-ops: OK');

console.log('unit-retranslate-chain: ALL PASSED');
}

main().catch(e => { console.error(e); process.exit(1); });
