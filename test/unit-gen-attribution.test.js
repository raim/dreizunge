// unit-gen-attribution.test.js
// PLAN §13 milestone 5, item 2 (v85_i) — attribution fields at GENERATION TIME. User ruling: cover
// BOTH the single-pasted-story path AND the PDF/document-upload path. Reuses EXISTING machinery
// throughout — the schema (topic.source={author,licence,url,note}, sanitizeTopicSource()) and
// endpoint (POST /api/topic-source) already existed, reachable only post-hoc via
// openProvEdit()/saveProvEdit() on the progress card. The only new code is: 4 input fields
// (#gen-source-row, inside #user-story-panel) + two small helpers (_readGenAttribution/
// _applyGenAttribution) + wiring them into THREE completion paths that all needed reading first:
// doGenerate()'s cached-hit branch, startBackgroundJob()'s own completion (+ resumeBackgroundJob()'s
// two branches, for the reload-mid-generation case), and pdfGenerateAll()'s book-job completion.
// Contract under test, against RENDERED/computed state and recorded fetch calls, not source text:
//   • §1 markup: #gen-source-row (4 inputs) lives inside #user-story-panel.
//   • §2 _readGenAttribution(): null when every field is empty, the filled object otherwise.
//   • §3 doGenerate()'s cached-hit branch applies attribution via the returned topic id.
//   • §4 doGenerate()'s background-job branch passes genAttribution into startBackgroundJob().
//   • §5 startBackgroundJob()'s own completion handler applies attribution via j.data.id.
//   • §6 resumeBackgroundJob(): the "completed while closed" branch applies attribution; the
//     "still running" branch re-attaches WITH the persisted genAttribution (not silently dropping it).
//   • §7 pdfGenerateAll() captures attribution once and applies it to EVERY resulting chapter id
//     (a single uploaded document is one source, however many chapters its text was split into).
//   • §8 _pollBookJob() returns the final job status (previously discarded) — mutation-tested.
//   • §9 _applyGenAttribution(): one /api/topic-source call per id, updates APP.savedList/
//     APP.lessonData's own cached copies, isolates one id's failure from the rest of the batch.
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
    APP.difficulty=2; APP.progress = { completed:{} };
    document.getElementById('use-story-cb').checked = true; onUseStoryCb();
    document.getElementById('user-story-input').value = 'A pasted story, well over the 20-char minimum the guard requires.';
    document.getElementById('topic-input').value = 'My Story Title';   // still required even with useStory
    true;`, 'seed');
  return C;
}

async function main() {

// ── 1. Markup: #gen-source-row lives inside #user-story-panel ────────────────────
{
  const panelOpen = html.indexOf('id="user-story-panel"');
  assert.ok(panelOpen >= 0, '#user-story-panel exists');
  const panelClose = html.indexOf('id="dialect-panel"', panelOpen);   // the next sibling panel
  assert.ok(panelClose > panelOpen, 'found the next sibling panel to bound the search');
  const rowAt = html.indexOf('id="gen-source-row"', panelOpen);
  assert.ok(rowAt > panelOpen && rowAt < panelClose, '#gen-source-row is inside #user-story-panel');
  const within = (needle) => { const at = html.indexOf(needle, rowAt); return at > rowAt && at < panelClose; };
  for (const id of ['gen-src-author', 'gen-src-licence', 'gen-src-url', 'gen-src-note']) {
    assert.ok(within('id="' + id + '"'), `#${id} is inside #gen-source-row`);
  }
}
console.log('  markup: #gen-source-row (4 attribution inputs) lives inside #user-story-panel: OK');

// ── 2. _readGenAttribution(): null when empty, the object when filled ────────────
{
  const C = client();
  const r = JSON.parse(C.run(`var empty = _readGenAttribution();
    document.getElementById('gen-src-author').value = 'Jane Doe';
    document.getElementById('gen-src-licence').value = 'CC BY';
    var filled = _readGenAttribution();
    JSON.stringify({ empty: empty, filled: filled })`));
  assert.strictEqual(r.empty, null, 'every field empty: _readGenAttribution() returns null');
  assert.deepStrictEqual(r.filled, { author: 'Jane Doe', licence: 'CC BY', url: '', note: '' },
    'at least one field filled: returns the full object, empty fields as empty strings');
}
console.log('  _readGenAttribution(): null when empty, the filled object otherwise: OK');

// ── 3. doGenerate()'s cached-hit branch applies attribution via the returned id ──
{
  const C = client();
  C.run(`document.getElementById('gen-src-author').value = 'Jane Doe';
    loadSavedList = async function(){}; showLessonSet = function(){};
    window._applyCalledWith = null;
    _applyGenAttribution = function(ids, source){ window._applyCalledWith = { ids: ids, source: source }; };
    fetch = function(url){
      if(url === '/api/generate') return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({
        cached:true, data:{ id:'tp_cached1', topic:'X' } }); } });
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({}); } });
    };
    (async()=>{ await doGenerate(); })();
    true;`, 'cached-hit');
  await settle();
  const r = JSON.parse(C.run('JSON.stringify(window._applyCalledWith)'));
  assert.deepStrictEqual(r.ids, ['tp_cached1'], 'cached-hit: attribution applied to the returned topic id');
  assert.strictEqual(r.source.author, 'Jane Doe', 'cached-hit: the captured attribution reaches _applyGenAttribution');
}
console.log("  doGenerate()'s cached-hit branch applies attribution via resp.data.id: OK");

// ── 4. doGenerate()'s background-job branch passes genAttribution through ────────
{
  const C = client();
  C.run(`document.getElementById('gen-src-author').value = 'Jane Doe';
    showGeneration = function(){};
    window._startBgCalledWith = null;
    startBackgroundJob = function(jobId, topic, genAttribution){ window._startBgCalledWith = { jobId: jobId, genAttribution: genAttribution }; };
    fetch = function(url){
      if(url === '/api/generate') return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ cached:false, jobId:'job1' }); } });
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({}); } });
    };
    (async()=>{ await doGenerate(); })();
    true;`, 'bg-job');
  await settle();
  const r = JSON.parse(C.run('JSON.stringify(window._startBgCalledWith)'));
  assert.strictEqual(r.jobId, 'job1', 'background-job path reached with the right jobId');
  assert.strictEqual(r.genAttribution.author, 'Jane Doe', 'startBackgroundJob() receives the captured attribution as its 3rd argument');
}
console.log('  doGenerate()\'s background-job branch passes genAttribution into startBackgroundJob(): OK');

// ── 5. startBackgroundJob()'s own completion applies attribution via j.data.id ───
{
  const C = client();
  C.run(`window._applyCalledWith = null;
    _applyGenAttribution = function(ids, source){ window._applyCalledWith = { ids: ids, source: source }; return Promise.resolve(); };
    updateStopBtn = function(){};
    fetch = function(url){
      if(url === '/api/job/job2') return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({
        status:'done', data:{ id:'tp_bg1', topic:'BgTopic' } }); } });
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({}); } });
    };
    startBackgroundJob('job2', 'ignored', { author:'PDF Author', licence:'', url:'', note:'' });
    true;`, 'start-bg');
  await new Promise(r => setTimeout(r, 2200));   // startBackgroundJob's own 2000ms poll interval
  const r = JSON.parse(C.run('JSON.stringify(window._applyCalledWith)'));
  assert.deepStrictEqual(r.ids, ['tp_bg1'], "startBackgroundJob()'s completion applies attribution via j.data.id");
  assert.strictEqual(r.source.author, 'PDF Author', 'the genAttribution passed into startBackgroundJob() reaches the apply call');
}
console.log("  startBackgroundJob()'s own completion handler applies attribution via j.data.id: OK");

// ── 6a. resumeBackgroundJob(): "completed while closed" branch applies attribution ──
{
  const C = client();
  C.run(`localStorage.setItem('imp3_activejob', JSON.stringify({ jobId:'job3', topic:'T',
      genAttribution: { author:'Resumed Author', licence:'', url:'', note:'' } }));
    window._applyCalledWith = null;
    _applyGenAttribution = function(ids, source){ window._applyCalledWith = { ids: ids, source: source }; return Promise.resolve(); };
    loadSavedList = async function(){};
    fetch = function(url){
      if(url === '/api/job/job3') return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({
        status:'done', data:{ id:'tp_resumed1', topic:'T' } }); } });
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({}); } });
    };
    (async()=>{ await resumeBackgroundJob(); })();
    true;`, 'resume-done');
  await settle();
  const r = JSON.parse(C.run('JSON.stringify(window._applyCalledWith)'));
  assert.deepStrictEqual(r.ids, ['tp_resumed1'], 'resumeBackgroundJob(): a job that finished while the page was closed still applies its persisted attribution');
  assert.strictEqual(r.source.author, 'Resumed Author', 'the persisted genAttribution survives a reload');
}
console.log('  resumeBackgroundJob(): "completed while closed" branch applies the persisted attribution: OK');

// ── 6b. resumeBackgroundJob(): "still running" branch re-attaches WITH genAttribution ──
// Mutation-tested: dropping `saved.genAttribution` from the re-attach call must turn this red.
{
  const C = client();
  C.run(`localStorage.setItem('imp3_activejob', JSON.stringify({ jobId:'job4', topic:'T',
      genAttribution: { author:'StillRunning Author', licence:'', url:'', note:'' } }));
    window._reattachCalledWith = null;
    startBackgroundJob = function(jobId, topic, genAttribution){ window._reattachCalledWith = { jobId: jobId, genAttribution: genAttribution }; };
    fetch = function(url){
      if(url === '/api/job/job4') return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ status:'running' }); } });
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({}); } });
    };
    (async()=>{ await resumeBackgroundJob(); })();
    true;`, 'resume-running');
  await settle();
  const r = JSON.parse(C.run('JSON.stringify(window._reattachCalledWith)'));
  assert.strictEqual(r.jobId, 'job4', 're-attach reached with the right jobId');
  assert.strictEqual(r.genAttribution.author, 'StillRunning Author', 're-attach carries the persisted genAttribution forward, not dropping it on reload');
}
console.log('  resumeBackgroundJob(): "still running" branch re-attaches carrying genAttribution forward: OK');

// ── 7. pdfGenerateAll(): one shared attribution applied to EVERY resulting chapter ──
{
  const C = client();
  C.run(`document.getElementById('gen-src-author').value = 'Doc Author';
    _pdfChunks = [ { title:'C1', text:'x', wordCount:5 }, { title:'C2', text:'y', wordCount:5 } ];
    _pdfBookId = null;
    window._applyCalledWith = null;
    _applyGenAttribution = function(ids, source){ window._applyCalledWith = { ids: ids, source: source }; };
    _pollBookJob = function(bookId){ return Promise.resolve({ status:'done', chapters:[ {topicId:'tp_c1'}, {topicId:'tp_c2'} ] }); };
    fetch = function(url){
      if(url === '/api/generate-book') return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ bookId:'bookX' }); } });
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({}); } });
    };
    (async()=>{ await pdfGenerateAll(); })();
    true;`, 'pdf-gen');
  await settle();
  const r = JSON.parse(C.run('JSON.stringify(window._applyCalledWith)'));
  assert.deepStrictEqual(r.ids, ['tp_c1', 'tp_c2'], 'attribution applied to BOTH resulting chapters, one shared source for the whole document');
  assert.strictEqual(r.source.author, 'Doc Author', 'the captured attribution reaches the PDF-path apply call');
}
console.log('  pdfGenerateAll(): one shared attribution applied to every resulting chapter id: OK');

// ── 7b. pdfGenerateAll(): no attribution fields filled → no apply call at all ────
{
  const C = client();
  C.run(`_pdfChunks = [ { title:'C1', text:'x', wordCount:5 } ];
    _pdfBookId = null;
    window._applyCalls = 0;
    _applyGenAttribution = function(){ window._applyCalls++; };
    _pollBookJob = function(bookId){ return Promise.resolve({ status:'done', chapters:[ {topicId:'tp_c1'} ] }); };
    fetch = function(url){
      if(url === '/api/generate-book') return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ bookId:'bookY' }); } });
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({}); } });
    };
    (async()=>{ await pdfGenerateAll(); })();
    true;`, 'pdf-gen-empty');
  await settle();
  const calls = C.run('window._applyCalls');
  assert.strictEqual(calls, 0, 'no attribution fields filled: _applyGenAttribution is never called at all');
}
console.log('  pdfGenerateAll(): empty attribution fields never trigger a call: OK');

// ── 8. _pollBookJob() returns the final job status ────────────────────────────────
// Mutation-tested: dropping `return j;` must turn this red.
{
  const C = client();
  C.run(`fetch = function(url){
      return Promise.resolve({ status:200, json: function(){ return Promise.resolve({
        status:'done', chapters:[{status:'done',topicId:'tp_x'}] }); } });
    };
    loadSavedList = async function(){};
    window._pollResult = undefined;
    (async()=>{ window._pollResult = await _pollBookJob('book_1'); })();
    true;`, 'poll-book');
  await settle();
  const result = JSON.parse(C.run('JSON.stringify(window._pollResult)'));
  assert.strictEqual(result.status, 'done', '_pollBookJob() returns the final job object, not undefined');
  assert.strictEqual(result.chapters[0].topicId, 'tp_x', 'the returned object carries chapters[].topicId — what the attribution wiring needs');
}
console.log('  _pollBookJob(): returns the final job status (chapters[].topicId included): OK');

// ── 9. _applyGenAttribution(): per-id calls, cache updates, failure isolation ─────
{
  const C = client();
  C.run(`APP.savedList = [ { id:'tp_a', topic:'A' }, { id:'tp_b', topic:'B' } ];
    APP.lessonData = { id:'tp_a', topic:'A' };
    var calls = [];
    fetch = function(url, opts){
      calls.push(JSON.parse(opts.body));
      if(JSON.parse(opts.body).id === 'tp_a') return Promise.reject(new Error('simulated failure'));
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ source:{ author:'Real Author' } }); } });
    };
    window._calls = calls;
    (async()=>{ await _applyGenAttribution(['tp_a','tp_b'], { author:'Real Author', licence:'', url:'', note:'' }); })();
    true;`, 'apply-attribution');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ calls: window._calls,
    savedListB: APP.savedList.find(function(s){ return s.id==='tp_b'; }).source,
    savedListA: APP.savedList.find(function(s){ return s.id==='tp_a'; }).source,
    lessonData: APP.lessonData.source })`));
  assert.strictEqual(r.calls.length, 2, 'one /api/topic-source call per id, both attempted despite the first one failing');
  assert.deepStrictEqual(r.calls.map(c => c.id), ['tp_a', 'tp_b'], 'each call targets the right id');
  assert.strictEqual(r.savedListA, undefined, "tp_a's own call failed — APP.savedList's cached entry is NOT updated for it");
  assert.deepStrictEqual(r.savedListB, { author: 'Real Author' }, "tp_b's own successful call updates APP.savedList's cached entry");
  assert.strictEqual(r.lessonData, undefined, 'APP.lessonData (id tp_a) reflects the failed call too — not updated');
}
console.log('  _applyGenAttribution(): one call per id, cache updates on success, one failure does not stop the rest: OK');

console.log('unit-gen-attribution: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
