// unit-single-chapter-qc.test.js — v90_z. Post-generation vocab QC on the SINGLE-chapter path.
//
// ⚠️ THE REPORT: "we still get a lot of mismatches of german with and italian w/o article … In
// Italian nouns do have sex/gender, so it would be relevant information. A QC (perhaps an option on
// QC for vocab) could specifically catch that and add the correct missing article."
//
// ⚠️ AND WHY THE FIX IS NOT THE ONE THAT WAS ASKED FOR. `qcCheckPair` (server.js) has carried an
// explicit ARTICLE SYMMETRY rule for releases, with the lesson's other pairs supplied as context so
// it infers the convention rather than being told one. Measured across the live corpus before
// writing any code:
//
//   de→it pairs in lessons that HAVE been QC'd : 64,  0 asymmetric —  0.0%
//   de→it pairs in lessons that have NOT       : 274, 65 asymmetric — 23.7%
//   de→en QC'd 72 → 0.0% ; de→en not QC'd 270 → 8.1% ; de→nl not QC'd 97 → 34.0%
//   of the 23 chapters with any asymmetric pair, 21 had NO vocab QC run at all
//
// 0 of 64 is not luck — at a 23.7% underlying rate that outcome has probability ~4e-8. The rule
// works. What did not work was REACHING it: `#post-gen-qc-cb` rode on `_genArcApplicable()`, which
// is `n > 1` on the LLM path, so a chapter generated on its own — including every "continue this
// storyline" chapter — could not opt in, and `_applyPostGenFeatures` had exactly one call site,
// inside `doGenerate`'s multi-chapter `resp.bookId` branch. A second copy of a working rule would
// not have corrected one existing pair.
//
// ⚠️ Guarded at the layer where "the QC actually runs" is observable — the recorded `qcRun` call —
// not by a regex over the source (`v89` rule 12). `unit-post-gen-features.test.js` §2 carries the
// re-scoped visibility ruling; this file carries the wiring.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = (ms) => new Promise(r => setTimeout(r, ms || 40));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang='it'; APP.srcLang='de';
    APP.difficulty = 2; APP.progress = { completed:{}, learned:{} };
    window.__qcCalls = [];
    qcRun = function(scope){ window.__qcCalls.push(scope); return Promise.resolve(); };
    loadSavedList = async function(){}; saveProg = function(){};
    saveActiveJob = function(v){ window.__saved = v; }; loadActiveJob = function(){ return window.__toLoad || null; };
    updateStopBtn = function(){}; setGenStatus = function(){}; showToast = function(){};
    buildPath = function(){}; showStorylineForTopic = function(){};
    true;`, 'seed');
  return C;
}
// A finished /api/job/<id> poll for one generated chapter.
const doneJob = `fetch = function(u){ return Promise.resolve({ ok:true, json:function(){
  return Promise.resolve({ status:'done', data:{ id:'tp_new1', topic:'Leere Aula' } }); } }); };`;

(async () => {
  // ── 1. ⭐ A single generated chapter IS QC'd when the box is ticked ──────────────────────────
  // The payload assertion: before v90_z this call could not happen at all on this path.
  {
    const C = client();
    C.run(doneJob + `startBackgroundJob('job1', 'Leere Aula', null, true); true;`, 'run');
    await settle(2600);   // startBackgroundJob polls on a 2s interval
    const calls = JSON.parse(C.run(`JSON.stringify(window.__qcCalls)`, 'calls'));
    assert.strictEqual(calls.length, 1, '⚠️ QC runs for a chapter generated on its own — the whole change');
    assert.deepStrictEqual(calls[0], { topicId: 'tp_new1' },
      'scoped by topicId to the chapter that was just generated, using the server-confirmed id');
  }
  console.log('  a single generated chapter is QC\'d when the post-generation box is ticked: OK');

  // ── 2. Non-vacuity: unticked means no QC ────────────────────────────────────────────────────
  // Without this, "always QC" would satisfy §1 and would be a worse bug — an unasked-for model pass
  // per chapter is exactly what `v77_w` removed from the book job.
  {
    const C = client();
    C.run(doneJob + `startBackgroundJob('job2', 'Leere Aula', null, false); true;`, 'run');
    await settle(2600);
    assert.strictEqual(C.run(`window.__qcCalls.length`, 'n'), 0,
      'an unticked box runs NO QC — generation must not quietly start a model pass nobody asked for');
  }
  console.log('  an unticked box runs no QC at all: OK');

  // ── 3. The opt-in is read at SEND time and survives on the persisted job ─────────────────────
  // Same reason `genAttribution` rides there (v85_i): the checkbox lives on a screen the learner
  // leaves the instant generation starts, and a reload mid-generation must not forget it.
  {
    const C = client();
    // ⚠️ NOT a never-settling fetch stub, however natural one looks for "a job still in flight":
    // `startBackgroundJob` polls on a `setInterval` that is only cleared by a terminal status, so a
    // promise that never settles leaves the timer alive and the whole FILE hangs after printing
    // ALL PASSED — `v89` rule 16, verbatim, and it caught this test on its first run. The flag is
    // written synchronously before any poll, so a terminating stub proves exactly the same thing.
    C.run(doneJob + `startBackgroundJob('job3', 'Leere Aula', null, true); true;`, 'run');
    const saved = JSON.parse(C.run(`JSON.stringify(window.__saved)`, 'saved'));
    assert.strictEqual(saved.postGenQc, true, 'the choice is persisted with the active job, not held only in the DOM');
    assert.strictEqual(saved.jobId, 'job3');
  }
  console.log('  the opt-in is persisted on the active job so a reload cannot lose it: OK');

  // ── 4. A chapter that finished while the page was CLOSED is still QC'd ───────────────────────
  // `resumeBackgroundJob`'s own done-branch — the path a learner hits by closing the tab and coming
  // back, which on a CPU-only box generating one chapter is the normal case, not an edge one.
  {
    const C = client();
    C.run(doneJob + `window.__toLoad = { jobId:'job4', topic:'Leere Aula', postGenQc:true };
      (async function(){ await resumeBackgroundJob(); })(); true;`, 'resume');
    await settle(120);
    const calls = JSON.parse(C.run(`JSON.stringify(window.__qcCalls)`, 'calls'));
    assert.strictEqual(calls.length, 1, 'the opt-in survives the reload and still runs');
    assert.deepStrictEqual(calls[0], { topicId: 'tp_new1' });
  }
  console.log('  a chapter that completed while the page was closed is still QC\'d on resume: OK');

  // ── 5. Non-vacuity for §4 ───────────────────────────────────────────────────────────────────
  {
    const C = client();
    C.run(doneJob + `window.__toLoad = { jobId:'job5', topic:'Leere Aula' };
      (async function(){ await resumeBackgroundJob(); })(); true;`, 'resume');
    await settle(120);
    assert.strictEqual(C.run(`window.__qcCalls.length`, 'n'), 0,
      'a resumed job with no opt-in runs no QC — the flag is read, not assumed');
  }
  console.log('  a resumed job without the opt-in runs no QC: OK');

  // ── 6. doGenerate reads the checkbox BEFORE the request, not from the DOM later ──────────────
  // The failure this prevents is silent: reading it inside the poll would see whatever the learner
  // left ticked minutes later, on a screen they may have changed.
  {
    const C = client();
    C.run(`APP.numChapters = 1; onNumChaptersSlider(1);
      document.getElementById('topic-input').value = 'una città costiera';
      document.getElementById('post-gen-qc-cb').checked = true;
      APP.lessonFormat = 'standard';
      window.__startArgs = null;
      startBackgroundJob = function(a,b,c,d){ window.__startArgs = [a,b,c,d];
        document.getElementById('post-gen-qc-cb').checked = false; };   // the learner unticks it after
      fetch = function(u,o){ return Promise.resolve({ ok:true, json:function(){
        return Promise.resolve({ jobId:'job6' }); } }); };
      showGeneration = function(){};
      (async function(){ await doGenerate(); })(); true;`, 'gen');
    await settle(120);
    const args = JSON.parse(C.run(`JSON.stringify(window.__startArgs)`, 'args'));
    assert.ok(args, 'doGenerate reached the single-chapter background-job branch');
    assert.strictEqual(args[3], true,
      'the ticked box was captured at SEND time — a later untick cannot retroactively change it');
  }
  console.log('  doGenerate captures the checkbox before the request fires, not from the DOM afterwards: OK');

  console.log('unit-single-chapter-qc: ALL PASSED');
  // Explicit, for the same reason: every section here starts a real `setInterval` inside the client,
  // and one that has not yet reached its terminal poll would otherwise hold the process open.
  process.exit(0);
})().catch(e => { console.error('unit-single-chapter-qc FAILED:', e.message); process.exit(1); });
