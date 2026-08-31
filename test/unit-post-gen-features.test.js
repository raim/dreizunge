// unit-post-gen-features.test.js
// PLAN §13 milestone 4 (v85_g) — the additional-features toggles (#post-gen-row) on #gen-card-4:
// "🎬 Generate a storyboard" and "🔍 Proofread with QC after generating", wired onto the multi-chapter
// book-completion path. Both reuse EXISTING machinery, confirmed by reading it first (same discipline
// v85_d's shortcut and v85_f's per-chapter override investigations used): /api/storyline-storyboard
// already resolves topic NAMES server-side (findSaved(name)), and qcRun({storylineId}) already loops
// every chapter of a storyline in ONE call — no new server work for either toggle.
// Contract under test, against RENDERED/computed state and recorded fetch/qcRun calls, not source
// text:
//   • §1 markup: #post-gen-row lives inside #gen-card-4, contains both checkboxes.
//   • §2 onNumChaptersSlider(): shows/hides #post-gen-row with the same multi-chapter-only gate
//     #gen-arc-row/#per-chapter-row already use; dropping to 1 chapter unchecks both.
//   • §3 doGenerate(): captures postGen BEFORE the request fires and calls _applyPostGenFeatures()
//     after the book job resolves, ONLY when at least one toggle is on (mutation-tested).
//   • §4 _applyPostGenFeatures(): resolves the new storyline from APP.storylines via the first
//     chapter's id, calls /api/storyline-storyboard with the right slId + topic NAMES (not full
//     objects) when storyboard is on, calls qcRun({storylineId}) when qc is on and a storyline was
//     found (falling back to {topicId} when it wasn't) — each toggle independently on/off-tested,
//     mutation-tested for the "only when sl is found" storyboard guard.
//   • §5 a failed storyboard call does not prevent qcRun from still running (best-effort isolation,
//     matching _applyPerChapterTypes' own per-call failure isolation).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = () => new Promise(resolve => setTimeout(resolve, 25));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang='de'; APP.srcLang='en';
    APP.difficulty=2; true;`, 'seed');
  return C;
}

async function main() {

// ── 1. Markup: #post-gen-row lives inside #gen-card-4 ────────────────────────────
{
  // item AL (roadmap_v87.md) renumbered the wizard's lesson card from 4 to 3 — see
  // unit-gen-wizard.test.js for the whole restructuring. The claim here is unchanged.
  const card4Open = html.indexOf('id="gen-card-3"');
  assert.ok(card4Open >= 0, "#gen-card-3 (the wizard's lesson card) exists");
  const card4Close = html.indexOf('end gen-card-3', card4Open);
  const rowAt = html.indexOf('id="post-gen-row"', card4Open);
  assert.ok(rowAt > card4Open && rowAt < card4Close, "#post-gen-row is inside the wizard's lesson card (#gen-card-3 since item AL)");
  const within = (needle) => { const at = html.indexOf(needle, rowAt); return at > rowAt && at < card4Close; };
  assert.ok(within('id="post-gen-storyboard-cb"'), '#post-gen-storyboard-cb is inside #post-gen-row');
  assert.ok(within('id="post-gen-qc-cb"'), '#post-gen-qc-cb is inside #post-gen-row');
}
console.log('  markup: #post-gen-row (storyboard + qc checkboxes) lives on the wizard lesson card: OK');

// ── 2. onNumChaptersSlider(): shows/hides with the same gate, resets on drop to 1 ─
{
  const C = client();
  const r = JSON.parse(C.run(`onNumChaptersSlider(3);
    var threeCh = document.getElementById('post-gen-row').style.display;
    document.getElementById('post-gen-storyboard-cb').checked = true;
    document.getElementById('post-gen-qc-cb').checked = true;
    onNumChaptersSlider(1);
    JSON.stringify({ threeCh: threeCh, oneCh: document.getElementById('post-gen-row').style.display,
       sbAfter: document.getElementById('post-gen-storyboard-cb').checked,
       qcAfter: document.getElementById('post-gen-qc-cb').checked })`));
  assert.strictEqual(r.threeCh, '', '3 chapters: #post-gen-row visible');
  assert.strictEqual(r.oneCh, 'none', '1 chapter: #post-gen-row hidden');
  assert.strictEqual(r.sbAfter, false, 'dropping to 1 chapter unchecks the storyboard toggle');
  assert.strictEqual(r.qcAfter, false, 'dropping to 1 chapter unchecks the QC toggle');
}
console.log('  onNumChaptersSlider(): #post-gen-row follows the multi-chapter-only gate, resets both toggles at 1: OK');

// ── 3. doGenerate(): captures postGen, calls _applyPostGenFeatures only when needed ──
// Mutation-tested: dropping the `postGen.storyboard || postGen.qc` guard must turn the "neither
// checked" case red (it would start calling _applyPostGenFeatures unconditionally).
{
  const C = client();
  C.run(`APP.numChapters = 2; onNumChaptersSlider(2);
    document.getElementById('topic-input').value = 'a coastal town';
    APP.lessonFormat = 'standard';
    loadSavedList = async function(){};
    _pollGenBook = function(){ return Promise.resolve({ status:'done', chapters:[] }); };
    window._applyPostGenCalls = 0;
    _applyPostGenFeatures = function(finalJob, opts){ window._applyPostGenCalls++; window._lastOpts = opts; };
    (async()=>{ await doGenerate(); })();
    true;`, 'generate-neither');
  await settle();
  const neitherCalls = C.run('window._applyPostGenCalls');
  assert.strictEqual(neitherCalls, 0, '_applyPostGenFeatures is NOT called when neither toggle is checked');

  const C2 = client();
  C2.run(`APP.numChapters = 2; onNumChaptersSlider(2);
    document.getElementById('post-gen-qc-cb').checked = true;
    document.getElementById('topic-input').value = 'a coastal town';
    APP.lessonFormat = 'standard';
    loadSavedList = async function(){};
    _pollGenBook = function(){ return Promise.resolve({ status:'done', chapters:[] }); };
    window._applyPostGenCalls = 0;
    _applyPostGenFeatures = function(finalJob, opts){ window._applyPostGenCalls++; window._lastOpts = opts; };
    (async()=>{ await doGenerate(); })();
    true;`, 'generate-qc-only');
  await settle();
  const r = JSON.parse(C2.run(`JSON.stringify({ calls: window._applyPostGenCalls, opts: window._lastOpts })`));
  assert.strictEqual(r.calls, 1, '_applyPostGenFeatures IS called exactly once when the QC toggle alone is checked');
  assert.deepStrictEqual(r.opts, { storyboard: false, qc: true }, 'the captured opts reflect exactly which toggles were checked');
}
console.log('  doGenerate(): captures postGen, calls _applyPostGenFeatures only when at least one toggle is on: OK');

// ── 4. _applyPostGenFeatures(): storyboard + qc, each independently on/off ───────
{
  const C = client();
  C.run(`APP.storylines = [{ id:'sl_fake', chapters:['tp_a','tp_b'] }];
    APP.savedList = [{ id:'tp_a', topic:'Real Chapter One' }, { id:'tp_b', topic:'Real Chapter Two' }];
    loadSavedList = async function(){};
    fetch = function(url, opts){
      if(url === '/api/storyline-storyboard'){
        window._sbCall = JSON.parse(opts.body);
        return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ storyboard:'<svg>x</svg>' }); } });
      }
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({}); } });
    };
    window._qcCalledWith = null;
    qcRun = function(scope){ window._qcCalledWith = scope; return Promise.resolve(); };
    var finalJob = { status:'done', chapters:[ {topicId:'tp_a'}, {topicId:'tp_b'} ] };
    (async()=>{ await _applyPostGenFeatures(finalJob, { storyboard:true, qc:true }); })();
    true;`, 'apply-both');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({
    sbCall: window._sbCall, qcCalledWith: window._qcCalledWith,
    storylineStoryboard: APP.storylines[0].storyboard })`));
  assert.deepStrictEqual(r.sbCall, { slId: 'sl_fake', topics: ['Real Chapter One', 'Real Chapter Two'] },
    'storyboard call carries the resolved slId and REAL topic NAMES (not the placeholder book-job titles)');
  assert.deepStrictEqual(r.qcCalledWith, { storylineId: 'sl_fake' }, 'qcRun is called with {storylineId} when a storyline was resolved');
  assert.strictEqual(r.storylineStoryboard, '<svg>x</svg>', "APP.storylines' own cached entry is updated with the returned storyboard");
}
console.log('  _applyPostGenFeatures(): storyboard call gets slId+topic NAMES, qcRun gets {storylineId}: OK');

// ── 4b. storyboard OFF: no storyboard call, qc still runs ────────────────────────
{
  const C = client();
  C.run(`APP.storylines = [{ id:'sl_fake', chapters:['tp_a'] }];
    APP.savedList = [{ id:'tp_a', topic:'Real Chapter' }];
    loadSavedList = async function(){};
    window._sbCalled = false;
    fetch = function(url){ if(url === '/api/storyline-storyboard') window._sbCalled = true;
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({}); } }); };
    window._qcCalledWith = null;
    qcRun = function(scope){ window._qcCalledWith = scope; return Promise.resolve(); };
    var finalJob = { status:'done', chapters:[ {topicId:'tp_a'} ] };
    (async()=>{ await _applyPostGenFeatures(finalJob, { storyboard:false, qc:true }); })();
    true;`, 'apply-qc-only');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ sbCalled: window._sbCalled, qcCalledWith: window._qcCalledWith })`));
  assert.strictEqual(r.sbCalled, false, 'storyboard:false never calls /api/storyline-storyboard');
  assert.deepStrictEqual(r.qcCalledWith, { storylineId: 'sl_fake' }, 'qc:true still runs independently of the storyboard toggle');
}
console.log('  _applyPostGenFeatures(): storyboard off + qc on run independently — no storyboard call, qc still fires: OK');

// ── 4c. no storyline resolved: storyboard skipped even if on; qc falls back to {topicId} ──
// Mutation-tested: dropping the `&& sl` guard on the storyboard branch must turn this red. Note this
// asserts setGenStatus was never called with the storyboard status, not just that fetch wasn't
// reached — a guard-less version crashes on `sl.id` (null) INSIDE the arguments being built for
// fetch(), before fetch() itself ever runs, so "fetch wasn't called" alone can't tell a deliberate
// skip apart from a silently-swallowed crash (both look identical from the fetch stub's own side).
{
  const C = client();
  C.run(`APP.storylines = [];   // no storyline contains this chapter — e.g. a single-chapter "book"
    APP.savedList = [{ id:'tp_a', topic:'Lone Chapter' }];
    loadSavedList = async function(){};
    window._sbCalled = false;
    window._sbStatusSet = false;
    setGenStatus = function(state, text){ if(/storyboard|🎬/.test(String(text))) window._sbStatusSet = true; };
    fetch = function(url){ if(url === '/api/storyline-storyboard') window._sbCalled = true;
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({}); } }); };
    window._qcCalledWith = null;
    qcRun = function(scope){ window._qcCalledWith = scope; return Promise.resolve(); };
    var finalJob = { status:'done', chapters:[ {topicId:'tp_a'} ] };
    (async()=>{ await _applyPostGenFeatures(finalJob, { storyboard:true, qc:true }); })();
    true;`, 'apply-no-storyline');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ sbCalled: window._sbCalled, sbStatusSet: window._sbStatusSet, qcCalledWith: window._qcCalledWith })`));
  assert.strictEqual(r.sbCalled, false, 'no storyline resolved: storyboard is skipped even though storyboard:true, never called with an undefined slId');
  assert.strictEqual(r.sbStatusSet, false, 'the storyboard branch is never ENTERED at all when no storyline was resolved (not entered-then-crashed — genuinely skipped)');
  // JSON.stringify drops undefined-valued keys, so the round-tripped shape omits storylineId
  // entirely rather than carrying it as null/undefined — asserting the shape that actually survives.
  assert.deepStrictEqual(r.qcCalledWith, { topicId: 'tp_a' }, 'qc falls back to {topicId} (the first chapter) when no storyline was found');
}
console.log('  _applyPostGenFeatures(): no storyline resolved — storyboard skipped (never fires with undefined slId), qc falls back to {topicId}: OK');

// ── 5. A failed storyboard call does not prevent qcRun from still running ────────
{
  const C = client();
  C.run(`APP.storylines = [{ id:'sl_fake', chapters:['tp_a'] }];
    APP.savedList = [{ id:'tp_a', topic:'Real Chapter' }];
    loadSavedList = async function(){};
    fetch = function(url){ if(url === '/api/storyline-storyboard') return Promise.reject(new Error('simulated failure'));
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({}); } }); };
    window._qcCalledWith = null;
    qcRun = function(scope){ window._qcCalledWith = scope; return Promise.resolve(); };
    var finalJob = { status:'done', chapters:[ {topicId:'tp_a'} ] };
    (async()=>{ await _applyPostGenFeatures(finalJob, { storyboard:true, qc:true }); })();
    true;`, 'apply-sb-fails');
  await settle();
  const qcCalledWith = JSON.parse(C.run(`JSON.stringify(window._qcCalledWith)`));
  assert.deepStrictEqual(qcCalledWith, { storylineId: 'sl_fake' }, 'qcRun still runs even though the storyboard call rejected — one feature\'s failure does not block the other');
}
console.log('  _applyPostGenFeatures(): a failed storyboard call does not prevent qcRun from still running: OK');

console.log('unit-post-gen-features: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
