// unit-gen-start-button.test.js — v91_i.
//
// ⚠️ THE BUG, user-reported with two screenshots the day after `v91_h`: *"now we have no generate
// button at all anymore."* The lesson step rendered its checkbox and its two selects and then
// NOTHING — no arc list, no storyboard/analysis row, no start button.
//
// ⚠️ THE MECHANISM, reproduced in the running app rather than reasoned about:
//   `_genInputMode()` answers 'pdf' — not 'paste' — for as long as `_uploadMode` is true while
//   `use-story-cb` is checked. `_applyLessonCardUI()` then computes
//       startable = (mode==='llm' || mode==='paste') ? true : (n > 0 && !busy)
//   so in 'pdf' mode with an EMPTY chunk list (n = 0), or with a stale `_pdfBookId` (busy), the
//   whole `#gen-btn-row` is hidden. `#gen-arc-row` and `#post-gen-row` are `display:none` in the
//   markup and are only ever SHOWN by the same function, so they vanish with it. Measured:
//       mode='pdf' n=0 → gen-arc-row=none per-chapter-row=none reinforce-prior-row=none
//                        post-gen-row=none gen-btn-row=none, lesson-type-hdr and format-wrap kept
//   — which is the screenshot, exactly.
//
// ⚠️⚠️ AND `_uploadMode` WAS STICKY. `fetchStoryFromUrl` and `onUploadFileChosen` both set it;
// `clearUserStory()` cleared only the textareas, and `genChooseKind('story')` did not touch it. So
// one URL fetch put the wizard into book mode for the rest of the session, and a plain pasted story
// afterwards was still treated as an upload — with the start button gated on a chunk list that no
// longer had anything in it. **There was no way back from the UI**: the checkbox that selects the
// mode lives in `#user-story-checks`, which is `display:none` since `v90_v`.
//
// ⚠️ WHAT THIS FILE DOES NOT CLAIM. It guards RECOVERY — that an explicit "clear" and an explicit
// "this text is my story" both return the wizard to 'paste'. It does NOT prove the broken state is
// unreachable; a URL fetch that yields no chunks, or a lingering `_pdfBookId`, can still produce a
// silently-hidden button until the learner clears or re-picks. Making that state SELF-EXPLANATORY
// (a disabled button with a reason, instead of no button) needs a `ui.json` string and therefore a
// key budget from the user — proposed, not taken.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const STORY = "Il Roero Arneis DOCG nasce dalle uve nell'omonimo vitigno, oggi presente nei comuni della Provincia di Cuneo. ".repeat(2);

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang='it'; APP.srcLang='de';
    APP.numChapters = 1; APP.difficulty = 2; APP.lessonFormat = 'standard';
    APP.progress = { completed:{}, learned:{} }; saved = [];
    true;`, 'seed');
  return C;
}
// Put the wizard in the state a URL fetch / document upload leaves behind, with nothing to chunk.
const BREAK = `document.getElementById('use-story-cb').checked = true; onUseStoryCb();
  _uploadMode = true; _pdfChunks = []; _applyLessonCardUI();`;
const btn = `((document.getElementById('gen-btn-row')||{}).style||{}).display || 'visible'`;

// ── 1. ⚠️ NON-VACUITY FIRST: the broken state really does hide the button ─────────────────────
// Without this, §2 and §3 would pass on a build where the button is simply always shown, and the
// test would be guarding nothing. This also pins the MECHANISM, so a future change to the
// startable/mode gate fails here loudly rather than silently re-opening the dead end.
{
  const C = client();
  const r = JSON.parse(C.run(`${BREAK}
    JSON.stringify({ mode: _genInputMode(), n: _genChapterCount(), btn: ${btn},
                     arc: ((document.getElementById('gen-arc-row')||{}).style||{}).display,
                     post: ((document.getElementById('post-gen-row')||{}).style||{}).display })`, 'broken'));
  assert.strictEqual(r.mode, 'pdf',
    'a sticky _uploadMode really does make the wizard read as an upload while a story is checked');
  assert.strictEqual(r.n, 0, 'with an empty chunk list there is nothing to generate');
  assert.strictEqual(r.btn, 'none', 'and THAT is what hides the start button — the reported symptom');
  assert.strictEqual(r.arc, 'none', 'the arc row goes with it');
  assert.strictEqual(r.post, 'none', 'and so does the storyboard/analysis row — the whole lower card');
}
console.log('  the reported dead end reproduces: sticky upload mode + empty chunks hides the button: OK');

// ── 2. ⭐ "✕ Clear" RECOVERS ───────────────────────────────────────────────────────────────────
{
  const C = client();
  const r = JSON.parse(C.run(`${BREAK}
    clearUserStory();
    JSON.stringify({ mode: _genInputMode(), uploadMode: !!_uploadMode, btn: ${btn} })`, 'clear'));
  assert.strictEqual(r.uploadMode, false,
    '⚠️ clearing the text must also forget WHERE IT CAME FROM — a clear that leaves the wizard in ' +
    'book mode is how the learner got stuck with no visible control to undo it');
  assert.strictEqual(r.mode, 'paste', 'so the wizard is back on the paste path');
  assert.strictEqual(r.btn, 'visible', 'and the start button is offered again');
}
console.log('  ✕ Clear forgets the stale upload state and restores the button: OK');

// ── 3. ⭐ "this text is my story" RECOVERS, and keeps the story ────────────────────────────────
{
  const C = client();
  const r = JSON.parse(C.run(`${BREAK}
    document.getElementById('gen-input').value = ${JSON.stringify(STORY)};
    genChooseKind('story');
    JSON.stringify({ mode: _genInputMode(), uploadMode: !!_uploadMode, btn: ${btn},
                     label: (document.getElementById('gen-btn')||{}).textContent,
                     storyLen: ((document.getElementById('user-story-input')||{}).value||'').length })`, 'story'));
  assert.strictEqual(r.uploadMode, false, 'an explicit "this is my story" overrides leftover upload state');
  assert.strictEqual(r.mode, 'paste');
  assert.strictEqual(r.btn, 'visible', 'the start button is offered');
  assert.ok(r.storyLen > 20, 'and the pasted text really did land in the story box — recovery must not eat it');
  assert.ok(/generate/i.test(r.label || ''),
    'the button is labelled for a lesson run, not for a book of chunks that no longer exist. Got: ' +
    JSON.stringify(r.label));
}
console.log('  picking "it\'s a story" overrides stale upload state and keeps the text: OK');

// ── 4. ⚠️ A REAL UPLOAD IS UNTOUCHED ──────────────────────────────────────────────────────────
// The fix must not turn genuine document/URL runs into paste runs — that path builds a STORYLINE of
// chapters and is the whole point of `_uploadMode`. Narrowed, not removed.
{
  const C = client();
  const r = JSON.parse(C.run(`
    document.getElementById('use-story-cb').checked = true; onUseStoryCb();
    _uploadMode = true; _pdfChunks = [{status:'idle'},{status:'idle'}]; _applyLessonCardUI();
    JSON.stringify({ mode: _genInputMode(), n: _genChapterCount(), btn: ${btn} })`, 'upload'));
  assert.strictEqual(r.mode, 'pdf', 'a document with chunks is still an upload');
  assert.strictEqual(r.n, 2, 'and still counts its chapters');
  assert.strictEqual(r.btn, 'visible', 'and is still startable');
}
console.log('  a genuine upload with chunks is unaffected: OK');

console.log('unit-gen-start-button: ALL PASSED');
process.exit(0);
