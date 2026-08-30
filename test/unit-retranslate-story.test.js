// unit-retranslate-story.test.js
// v86_w — user-requested: "We need a button to retranslate a story after we found and manually fixed
// errors in the original story, e.g. and especially an extracted text." A manual `/api/save-story`
// fix does not re-translate on its own (server.js's own /api/retranslate-story explains why: a real
// LLM call, deliberately not triggered on every edit) — `storyTranslation` can silently keep
// describing the pre-fix text until the new button/route is explicitly used.
//
// This file covers the CLIENT half:
//   • §1 #story-retranslate-btn's own visibility, wired in buildPath() — gated EXACTLY like
//     #story-qc-btn (a real backend AND an existing story), deliberately NOT also on _canEdit():
//     re-translating doesn't let anyone free-edit content, it re-runs one deterministic LLM call and
//     overwrites one derived field — the same class of action QC's button already is, which carries
//     no teacher-mode gate either. A first draft DID add _canEdit(), which
//     unit-can-edit-teacher-mode.test.js's own sweep (§4, "no call site widens the gate back to the
//     capability axis") correctly caught: combining _canEdit() with canGenerate is exactly the shape
//     that test exists to prevent, whether the operator is || (the original v79_j bug) or && (this
//     one) — the fix is to not need _canEdit() here at all, matching QC's own precedent.
//   • §2 retranslateStory(): the request body, the state update on success (storyTranslation
//     replaced, renderStoryText called), a clean no-op with no story, and a failure that toasts
//     without crashing or corrupting the existing (stale) translation.
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
    APP.savedList = [];
    show = function(){}; saveProg = function(){};
    true;`, 'seed');
  return C;
}

const BASE_TOPIC = { id: 'tp_x', topic: 'Sign', lang: 'nl', srcLang: 'en', difficulty: 1,
  story: 'U Rijdt Nu 500 Meter\n\nOnteigeningszone\n\nDit Raakt Ons Allemaal.',
  storyTranslation: 'STALE translation.', lessons: [] };

async function main() {

// ── 1. #story-retranslate-btn visibility — canGenerate AND a story (matches #story-qc-btn EXACTLY,
//    deliberately NOT also gated on _canEdit() — see index.html's own comment on this line: it does
//    not let anyone free-edit any content, it re-runs one deterministic LLM call and overwrites one
//    derived field, the same class of action QC's own button already is with no teacher-mode gate
//    either) ────────────────────────────────────────────────────────────────────────────────────
{
  const C = client();
  const cases = [
    { teacher: false, canGenerate: true,  story: true,  want: '',     label: 'backend + story, even WITHOUT teacher mode: SHOWN (matches story-qc-btn)' },
    { teacher: true,  canGenerate: true,  story: true,  want: '',     label: 'teacher + backend + story: also SHOWN' },
    { teacher: true,  canGenerate: false, story: true,  want: 'none', label: 'no backend (static build): HIDDEN even in teacher mode' },
    { teacher: true,  canGenerate: true,  story: false, want: 'none', label: 'no story yet: HIDDEN — nothing to re-translate' },
  ];
  for (const c of cases) {
    const topic = { ...BASE_TOPIC, story: c.story ? BASE_TOPIC.story : '' };
    C.run(`APP.info = { backend:'local', canGenerate:${c.canGenerate} };
      APP._teacherMode = ${c.teacher};
      APP.lessonData = ${JSON.stringify(topic)};
      APP.lang = 'nl'; APP.srcLang = 'en';
      buildPath(); true;`, 'case');
    const display = C.run(`document.getElementById('story-retranslate-btn').style.display`);
    assert.strictEqual(display, c.want, c.label + ' (got display="' + display + '")');
  }
}
console.log('  #story-retranslate-btn: shown for a real backend + an existing story, regardless of teacher mode (matches story-qc-btn): OK');

// ── 2. retranslateStory(): request shape, success updates state, failure toasts without corrupting ──
{
  const C = client();
  C.run(`APP.lessonData = ${JSON.stringify(BASE_TOPIC)};
    window._fetchCall = null;
    fetch = function(url, opts){
      window._fetchCall = { url: url, method: opts.method, body: JSON.parse(opts.body) };
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ storyTranslation: 'Fresh, corrected translation.' }); } });
    };
    window._renderCalls = 0; renderStoryText = function(){ window._renderCalls++; };
    window._toasts = []; showToast = function(m){ window._toasts.push(m); };
    (async()=>{ await retranslateStory(); })();
    true;`, 't2a');
  await new Promise(r => setTimeout(r, 25));
  const r = JSON.parse(C.run(`JSON.stringify({
    fetchCall: window._fetchCall,
    storyTranslation: APP.lessonData.storyTranslation,
    renderCalls: window._renderCalls,
    toasts: window._toasts,
    btnDisabled: document.getElementById('story-retranslate-btn').disabled,
  })`));
  assert.strictEqual(r.fetchCall.url, '/api/retranslate-story', 'posts to the new dedicated route');
  assert.deepStrictEqual(r.fetchCall.body, { topic: 'Sign' }, 'sends the topic name, matching /api/save-story\'s own convention');
  assert.strictEqual(r.storyTranslation, 'Fresh, corrected translation.', 'the stale translation is replaced with the fresh one from the server');
  assert.strictEqual(r.renderCalls, 1, 'the story panel is re-rendered so the reader sees the fresh translation immediately');
  assert.ok(r.toasts.some(t => /re-?translat/i.test(t)), 'a success toast confirms it happened: ' + JSON.stringify(r.toasts));
  assert.strictEqual(r.btnDisabled, false, 'the button is re-enabled after completion');
}
console.log('  retranslateStory(): posts {topic}, replaces the stale translation, re-renders, toasts success: OK');

{
  const C = client();
  C.run(`APP.lessonData = { ...${JSON.stringify(BASE_TOPIC)}, story: '' };   // no story yet
    window._fetchCalled = false; fetch = function(){ window._fetchCalled = true; return Promise.resolve({ok:true,json:function(){return Promise.resolve({});}}); };
    (async()=>{ await retranslateStory(); })();
    true;`, 't2b');
  await new Promise(r => setTimeout(r, 25));
  const called = JSON.parse(C.run(`JSON.stringify(window._fetchCalled)`));
  assert.strictEqual(called, false, 'no story to translate: a clean no-op, no network call at all');
}
console.log('  retranslateStory(): a topic with no story yet is a clean no-op: OK');

{
  const C = client();
  C.run(`APP.lessonData = ${JSON.stringify(BASE_TOPIC)};
    fetch = function(){ return Promise.resolve({ ok:false, status:500, json: function(){ return Promise.resolve({ error:'model unreachable' }); } }); };
    window._toasts = []; showToast = function(m){ window._toasts.push(m); };
    (async()=>{ await retranslateStory(); })();
    true;`, 't2c');
  await new Promise(r => setTimeout(r, 25));
  const r = JSON.parse(C.run(`JSON.stringify({
    storyTranslation: APP.lessonData.storyTranslation, toasts: window._toasts,
    btnDisabled: document.getElementById('story-retranslate-btn').disabled,
  })`));
  assert.strictEqual(r.storyTranslation, 'STALE translation.', 'a failed re-translation leaves the EXISTING translation untouched — never wiped or corrupted');
  assert.ok(r.toasts.some(t => /re-?translat/i.test(t) && /model unreachable/.test(t)), 'a failure toast names the real error: ' + JSON.stringify(r.toasts));
  assert.strictEqual(r.btnDisabled, false, 'the button is re-enabled after a failure too, not left stuck disabled');
}
console.log('  retranslateStory(): a server failure toasts the real error and leaves the existing translation untouched: OK');

console.log('unit-retranslate-story: ALL PASSED');
}

main().catch(e => { console.error(e); process.exit(1); });
