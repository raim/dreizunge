// unit-per-chapter-types.test.js
// PLAN §13 milestone 3 (v85_f) — the per-chapter lesson-type override on #gen-card-4. User ruling on
// how it should work: "sequential, reusing existing per-chapter endpoint" — NOT a new server-side
// per-chapter arcTypes body shape. The override REPLACES the shared "arc" checkbox for a given
// generation (a type must never be requested twice for the same chapter); after the book job
// finishes, one /api/lessons/add-lesson call per (chapter, type) pair, sequentially, reusing the
// SAME endpoint doAddLesson()'s own per-chapter "add lesson" card already calls.
// Contract under test, against RENDERED/computed state and recorded fetch calls, not source text:
//   • §1 markup: #per-chapter-row lives inside #gen-card-4, contains #per-chapter-cb/#per-chapter-list.
//   • §2 onNumChaptersSlider(): shows/hides #per-chapter-row with the same multi-chapter-only gate
//     #gen-arc-row already uses; dropping to 1 chapter also unchecks+hides an already-open list.
//   • §3 onPerChapterCb()/_renderPerChapterTypes(): renders exactly APP.numChapters rows, each its
//     own independently-readable tick-list, none of them offering the "mixed" toggle (noMixed).
//   • §4 renderLessonTypeChecks()'s `noMixed` option: suppressed when true, UNCHANGED (still present)
//     for existing callers that don't pass it — proves the new option didn't alter old behaviour.
//   • §5 _readPerChapterTypes(n): reads back exactly what was ticked, per row, independently.
//   • §6 doGenerate()'s multi-chapter branch: when per-chapter is ON, `gbody.arc` is NEVER set —
//     even when #gen-arc-cb is left checked — mutation-tested.
//   • §7 _applyPerChapterTypes(): one /api/lessons/add-lesson call per (chapter, type) pair with the
//     right id/lessonFormat, skips chapters with no topicId or no types, tolerates one call failing
//     without aborting the rest of the batch — mutation-tested.
//   • §8 _pollGenBook() returns the final job status (previously discarded) — mutation-tested.
//
// Harness notes, both hit while writing this file, neither a product bug — recorded so the next
// file that needs them doesn't rediscover them the hard way:
//   • document.getElementById/.querySelector never return null on a miss — lib-dom.js documents this
//     as deliberate (auto-vivifies an empty stub, always a <div>, so render code can chain
//     `.textContent =` without a null check). "!!getElementById(...)"/"!!querySelector(...)" are
//     therefore ALWAYS true — checking `.tagName` (or, for a container, `.children.length`) against
//     what the code under test is expected to actually produce is what distinguishes a genuine
//     result from the stub.
//   • `vm.runInContext` executes each C.run() string as a plain (non-async, non-module) script — a
//     bare top-level `await` inside one throws a SyntaxError. Any code that must await something
//     (doGenerate(), _applyPerChapterTypes(), _pollGenBook()) is wrapped in its own `(async()=>{...})()`
//     IIFE inside the string; the REAL await happens outside, via `settle()`, between separate C.run
//     calls — the same shape unit-ui-journeys.test.js's own `client()`/`settle()` pair already uses.
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

// ── 1. Markup: #per-chapter-row lives inside #gen-card-4 ─────────────────────────
{
  const card4Open = html.indexOf('id="gen-card-4"');
  assert.ok(card4Open >= 0, '#gen-card-4 exists');
  const card4Close = html.indexOf('end gen-card-4', card4Open);
  const rowAt = html.indexOf('id="per-chapter-row"', card4Open);
  assert.ok(rowAt > card4Open && rowAt < card4Close, '#per-chapter-row is inside #gen-card-4');
  const within = (needle) => { const at = html.indexOf(needle, rowAt); return at > rowAt && at < card4Close; };
  assert.ok(within('id="per-chapter-cb"'), '#per-chapter-cb is inside #per-chapter-row');
  assert.ok(within('id="per-chapter-list"'), '#per-chapter-list is inside #per-chapter-row');
}
console.log('  markup: #per-chapter-row (cb + list) lives inside #gen-card-4: OK');

// ── 2. onNumChaptersSlider(): shows/hides with the same gate as #gen-arc-row ─────
{
  const C = client();
  const r = JSON.parse(C.run(`onNumChaptersSlider(3);
    var threeCh = document.getElementById('per-chapter-row').style.display;
    document.getElementById('per-chapter-cb').checked = true; onPerChapterCb();
    var listOnAt3 = document.getElementById('per-chapter-list').style.display;
    onNumChaptersSlider(1);
    JSON.stringify({ threeCh: threeCh, oneCh: document.getElementById('per-chapter-row').style.display,
       listOnAt3: listOnAt3,
       cbAfterDropTo1: document.getElementById('per-chapter-cb').checked,
       listAfterDropTo1: document.getElementById('per-chapter-list').style.display })`));
  assert.strictEqual(r.threeCh, '', '3 chapters: #per-chapter-row visible');
  assert.strictEqual(r.listOnAt3, '', '3 chapters, checked on: the list is visible');
  assert.strictEqual(r.oneCh, 'none', '1 chapter: #per-chapter-row hidden');
  assert.strictEqual(r.cbAfterDropTo1, false, 'dropping to 1 chapter unchecks #per-chapter-cb');
  assert.strictEqual(r.listAfterDropTo1, 'none', 'dropping to 1 chapter also hides the (now stale) list');
}
console.log('  onNumChaptersSlider(): #per-chapter-row follows the multi-chapter-only gate, resets cleanly at 1: OK');

// ── 3. onPerChapterCb()/_renderPerChapterTypes(): exactly N rows, no mixed toggle ─
{
  const C = client();
  const r = JSON.parse(C.run(`APP.numChapters = 4;
    document.getElementById('per-chapter-cb').checked = true;
    onPerChapterCb();
    var rowCount = document.getElementById('per-chapter-list').children.length;
    var eachRowHasCheckboxes = [1,2,3,4].every(function(i){
      return document.getElementById('per-chapter-types-'+i).querySelectorAll('.pc-lt-check-'+i).length > 0; });
    var mixedQ = document.getElementById('per-chapter-types-1').querySelector('.pc-lt-check-1-mixed');
    var row1HasMixed = mixedQ.tagName === 'INPUT';
    JSON.stringify({ rowCount: rowCount, eachRowHasCheckboxes: eachRowHasCheckboxes, row1HasMixed: row1HasMixed })`));
  assert.strictEqual(r.rowCount, 4, 'exactly 4 row wrappers rendered for APP.numChapters=4');
  assert.strictEqual(r.eachRowHasCheckboxes, true, 'each of the 4 rows was actually populated by renderLessonTypeChecks (real checkboxes, not just an auto-vivified empty stub)');
  assert.strictEqual(r.row1HasMixed, false, 'no "finish with mixed review" toggle in a per-chapter row (noMixed)');
}
console.log('  onPerChapterCb()/_renderPerChapterTypes(): exactly APP.numChapters rows, none offering mixed: OK');

// ── 4. renderLessonTypeChecks()'s `noMixed` option leaves EXISTING callers unchanged ──
{
  const C = client();
  const r = JSON.parse(C.run(`var withNoMixed = document.createElement('div');
    renderLessonTypeChecks(withNoMixed, { cls:'t1', noMixed:true });
    var withoutNoMixed = document.createElement('div');
    renderLessonTypeChecks(withoutNoMixed, { cls:'t2' });
    JSON.stringify({ hasMixedWithFlag: withNoMixed.querySelector('.t1-mixed').tagName === 'INPUT',
       hasMixedWithoutFlag: withoutNoMixed.querySelector('.t2-mixed').tagName === 'INPUT' })`));
  assert.strictEqual(r.hasMixedWithFlag, false, 'noMixed:true suppresses the mixed row');
  assert.strictEqual(r.hasMixedWithoutFlag, true, 'omitting noMixed (existing callers, e.g. the arc picker) still gets the mixed row');
}
console.log('  renderLessonTypeChecks(): noMixed suppresses the row; omitting it preserves existing behaviour: OK');

// ── 5. _readPerChapterTypes(n): reads back exactly what was ticked, per row ──────
{
  const C = client();
  const r = C.run(`APP.numChapters = 3;
    document.getElementById('per-chapter-cb').checked = true;
    onPerChapterCb();
    var row2 = document.getElementById('per-chapter-types-2');
    row2.querySelectorAll('.pc-lt-check-2').forEach(function(cb){ if(cb.value==='error_hunt') cb.checked=true; });
    JSON.stringify(_readPerChapterTypes(3));`);
  assert.deepStrictEqual(JSON.parse(r), [[], ['error_hunt'], []], 'only chapter 2 (index 1) carries the ticked type, the others are empty');
}
console.log('  _readPerChapterTypes(n): per-row ticks read back independently, untouched rows empty: OK');

// ── 6. doGenerate(): per-chapter ON means gbody.arc is NEVER set, even if #gen-arc-cb is checked ──
// Mutation-tested: reverting the `!perChapterOn &&` guard must turn this red.
{
  const C = client();
  C.run(`APP.numChapters = 2; onNumChaptersSlider(2);
    document.getElementById('gen-arc-cb').checked = true;   // left checked — must be IGNORED
    document.getElementById('per-chapter-cb').checked = true; onPerChapterCb();
    document.getElementById('topic-input').value = 'a coastal town';
    APP.lessonFormat = 'standard';
    loadSavedList = async function(){};   // showGeneration()'s own showGeneration->goLanding chain calls it
    _pollGenBook = function(){ return Promise.resolve({ status:'done', chapters:[] }); };
    _applyPerChapterTypes = function(){};
    (async()=>{ await doGenerate(); })();
    true;`, 'generate');
  await settle();
  const r = JSON.parse(C.run(`var call = _smoke.fetch.find(function(c){ return c.url === '/api/generate-book'; });
    var body = call ? JSON.parse(call.init.body) : null;
    JSON.stringify({ hasArcField: body ? ('arc' in body) : null, hasArcTypesField: body ? ('arcTypes' in body) : null })`));
  assert.strictEqual(r.hasArcField, false, "gbody.arc is never set when per-chapter override is on, regardless of #gen-arc-cb's own checked state");
  assert.strictEqual(r.hasArcTypesField, false, 'gbody.arcTypes is never set either');
}
console.log('  doGenerate(): per-chapter override replaces the shared arc — gbody.arc/arcTypes never set: OK');

// ── 7. _applyPerChapterTypes(): one call per (chapter, type), skips empties, isolates failures ──
{
  const C = client();
  C.run(`pollJob = function(jobId){ return Promise.resolve({}); };
    loadSavedList = async function(){};   // _applyPerChapterTypes's own final reload
    var finalJob = { status:'done', chapters:[ {topicId:'tp_a'}, {topicId:null}, {topicId:'tp_c'} ] };
    var perChapterTypes = [ ['synonyms','word_forms'], ['error_hunt'], [] ];
    // chapter 2 (index 1) has a type ticked but no topicId — must be skipped, not crash
    (async()=>{ await _applyPerChapterTypes(finalJob, perChapterTypes); })();
    true;`, 'apply');
  await settle();
  const calls = JSON.parse(C.run(`JSON.stringify(_smoke.fetch.filter(function(c){ return c.url === '/api/lessons/add-lesson'; })
      .map(function(c){ return JSON.parse(c.init.body); }))`));
  assert.strictEqual(calls.length, 2, 'exactly 2 calls: chapter 0 x 2 types; chapter 1 skipped (no topicId); chapter 2 skipped (no types)');
  assert.deepStrictEqual(calls.map(c => c.id), ['tp_a', 'tp_a'], "both calls target chapter 0's topicId");
  assert.deepStrictEqual(calls.map(c => c.lessonFormat).sort(), ['synonyms', 'word_forms'], 'one call per ticked type');
  assert.ok(calls.every(c => c.difficulty === 2), 'difficulty carried from APP.difficulty');
}
console.log('  _applyPerChapterTypes(): one /api/lessons/add-lesson call per (chapter, type), no-topicId/no-types chapters skipped: OK');

// ── 7b. _applyPerChapterTypes(): one failing call does not abort the rest of the batch ───────────
{
  const C = client();
  C.run(`var n = 0;
    loadSavedList = async function(){};   // _applyPerChapterTypes's own final reload
    fetch = function(url, init){
      if(url === '/api/lessons/add-lesson'){
        n++;
        if(n === 1) return Promise.reject(new Error('simulated failure'));
        return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({}); } });
      }
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({}); } });
    };
    var finalJob = { status:'done', chapters:[ {topicId:'tp_a'}, {topicId:'tp_b'} ] };
    var perChapterTypes = [ ['synonyms'], ['word_forms'] ];
    (async()=>{ await _applyPerChapterTypes(finalJob, perChapterTypes); })();
    true;`, 'apply-fail');
  await settle();
  const n = C.run('n');
  assert.strictEqual(n, 2, 'both calls were attempted — the first one failing did not stop the second');
}
console.log('  _applyPerChapterTypes(): one failing call is isolated, the rest of the batch still runs: OK');

// ── 8. _pollGenBook() returns the final job status ────────────────────────────────
// Mutation-tested: dropping the `return j;` must turn this red.
{
  const C = client();
  C.run(`fetch = function(url){
      return Promise.resolve({ status:200, json: function(){ return Promise.resolve({
        status:'done', chapters:[{status:'done',topicId:'tp_x'}] }); } });
    };
    loadSavedList = async function(){};
    window._pollResult = undefined;
    (async()=>{ window._pollResult = await _pollGenBook('book_1', 1); })();
    true;`, 'poll');
  await settle();
  const result = JSON.parse(C.run('JSON.stringify(window._pollResult)'));
  assert.strictEqual(result.status, 'done', '_pollGenBook() returns the final job object, not undefined');
  assert.strictEqual(result.chapters[0].topicId, 'tp_x', "the returned object carries each chapter's topicId — what _applyPerChapterTypes needs");
}
console.log('  _pollGenBook(): returns the final job status (chapters[].topicId included): OK');

console.log('unit-per-chapter-types: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
