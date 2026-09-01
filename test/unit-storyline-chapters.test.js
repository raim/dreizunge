// unit-storyline-chapters.test.js
// User request: "Allow to re-order chapters of a storyline. Allow to split off storyline's chapters
// into separate storylines… Allow to add existing chapters to a given storyline, via a dropdown menu
// … same as the 'continue from' selection in the generation wizard's first page."
//
// The SERVER half (the re-linking rule, fork safety, split naming, validation) is covered by
// e2e-storyline-chapters.test.js against a real process — that is where the logic lives. This file
// covers the client's own panel: what it offers, to whom, and what it SENDS.
//
// The request bodies are the load-bearing part here, because two of the three operations differ only
// in that: a re-order sends relink:true (the user's ruling — the screen draws its tree from
// continuedFromId, so the array alone would look like it did nothing), while adding a chapter sends
// no relink at all (membership is not re-sequencing).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const SAVED = [{ id:'a', topic:'Chap A' }, { id:'b', topic:'Chap B' }, { id:'c', topic:'Chap C' },
               { id:'z', topic:'Elsewhere' }];
const SL = { id:'sl_1', title:'Alpha', chapters:['a','b','c'] };

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = ${JSON.stringify(SAVED)}; APP.storylines = [${JSON.stringify(SL)}];
    APP._slScreen = { chainId:'sl_1', encodedChain:'', topics:['Chap A','Chap B','Chap C'], chapterIds:['a','b','c'] };
    APP._teacherMode = true; APP._slManage = true;
    show = function(){}; saveProg = function(){}; showToast = function(){};
    loadSavedList = function(){ return Promise.resolve(); };
    _renderStorylineScreen = function(){};
    window._posts = [];
    fetch = function(u, o){
      // Only WRITES are recorded: _slChaptersPost also re-fetches /api/storylines to refresh, and
      // counting that bodyless GET as a request made "exactly one request" fail on correct code.
      if (o && o.body) window._posts.push({ url:u, body: JSON.parse(o.body) });
      return Promise.resolve({ ok:true, json:function(){ return Promise.resolve({ ok:true, newId:'sl_new' }); } });
    };
    true;`, 'seed');
  return C;
}
const settle = () => new Promise(r => setTimeout(r, 30));

(async () => {

// ── 1. Teacher-gated, and collapsed until asked for ─────────────────────────────
{
  const C = client();
  C.run(`APP._teacherMode = false; true;`);
  assert.strictEqual(C.run(`_slManageHtml(${JSON.stringify(SL)}, ['a','b','c'])`), '',
    'no panel outside teacher mode — re-ordering and splitting are curation');
  C.run(`APP._teacherMode = true; APP._slManage = false; true;`);
  const collapsed = C.run(`_slManageHtml(${JSON.stringify(SL)}, ['a','b','c'])`);
  assert.ok(/_slManageOpen\(\)/.test(collapsed), 'collapsed: just an opener button');
  assert.ok(!/_slMoveChapter/.test(collapsed), 'and none of the row controls until it is opened');
  assert.strictEqual(C.run(`_slManageHtml(null, ['a'])`), '', 'no storyline id: no panel (every op needs it)');
}
console.log('  panel: teacher-gated, collapsed by default, needs a storyline id: OK');

// ── 2. Opened: one row per chapter, with the ends correctly disabled ────────────
{
  const C = client();
  const open = C.run(`_slManageHtml(${JSON.stringify(SL)}, ['a','b','c'])`);
  assert.strictEqual((open.match(/_slMoveChapter\(/g) || []).length, 6, 'two move buttons per chapter');
  assert.strictEqual((open.match(/_slSplitHere\(/g) || []).length, 3, 'one split button per chapter');
  // The first chapter cannot move up or be split off (splitting at 0 is a rename, not a split — the
  // route refuses it too), and the last cannot move down.
  const rows = open.split('_slMoveChapter').length - 1;
  assert.ok(rows >= 6, 'rows rendered');
  assert.ok(/disabled/.test(open), 'the boundary buttons are disabled rather than silently failing');
}
console.log('  opened: a row per chapter, boundary buttons disabled: OK');

// ── 3. The add-picker offers every OTHER saved chapter, newest first ────────────
// "same as the 'continue from' selection in the generation wizard's first page" — every saved
// chapter, excluding the ones already in this storyline.
{
  const C = client();
  const open = C.run(`_slManageHtml(${JSON.stringify(SL)}, ['a','b','c'])`);
  const sel = open.slice(open.indexOf('<select'));
  assert.ok(/value="z"/.test(sel), 'a chapter from elsewhere is offered');
  assert.ok(!/value="a"/.test(sel) && !/value="b"/.test(sel),
    'chapters already in this storyline are not offered again');
}
console.log('  add-picker: offers other chapters, excludes current members: OK');

// ── 4. ⚠️ Re-order SENDS relink:true ────────────────────────────────────────────
// The user's ruling. The storyline screen draws its tree from continuedFromId, so re-ordering the
// array alone would leave that view in the old sequence — the move would look like it did nothing.
{
  const C = client();
  C.run(`_slMoveChapter(1, -1); true;`);
  await settle();
  const posts = JSON.parse(C.run(`JSON.stringify(window._posts)`));
  assert.strictEqual(posts.length, 1, 'exactly one request');
  assert.strictEqual(posts[0].url, '/api/storyline/chapters', 'to the chapters route');
  assert.deepStrictEqual(posts[0].body.chapters, ['b','a','c'], 'with the swapped order');
  assert.strictEqual(posts[0].body.relink, true,
    're-order sends relink:true — without it the screen keeps the old sequence (user ruling)');
}
console.log('  re-order: sends the new order WITH relink:true: OK');

// ── 5. ⚠️ Adding a chapter does NOT relink ──────────────────────────────────────
// "add without removing" — membership, not re-sequencing. Re-linking here would rewrite the chain of
// a chapter that may still legitimately belong to another storyline.
{
  const C = client();
  C.run(`document.getElementById('sl-add-chapter-select').value = 'z';
    _slAddExistingChapter(); true;`);
  await settle();
  const posts = JSON.parse(C.run(`JSON.stringify(window._posts)`));
  assert.strictEqual(posts.length, 1, 'exactly one request');
  assert.deepStrictEqual(posts[0].body.chapters, ['a','b','c','z'], 'the chapter is appended');
  assert.ok(!posts[0].body.relink, 'and NO relink — joining a storyline is not re-sequencing');
}
console.log('  add existing: appends without relinking: OK');

// ── 6. Nothing selected, or already a member: no request at all ────────────────
{
  const C = client();
  C.run(`document.getElementById('sl-add-chapter-select').value = ''; _slAddExistingChapter(); true;`);
  await settle();
  assert.strictEqual(C.run(`window._posts.length`), 0, 'the placeholder option does nothing');
  C.run(`document.getElementById('sl-add-chapter-select').value = 'a'; _slAddExistingChapter(); true;`);
  await settle();
  assert.strictEqual(C.run(`window._posts.length`), 0, 'adding a chapter that is already here does nothing');
}
console.log('  add existing: no-ops for an empty pick or an existing member: OK');

// ── 7. Split posts an INDEX, and never index 0 ─────────────────────────────────
{
  const C = client();
  C.run(`_slSplitHere(2); true;`);
  await settle();
  let posts = JSON.parse(C.run(`JSON.stringify(window._posts)`));
  assert.strictEqual(posts[0].url, '/api/storyline/split', 'to the split route');
  assert.strictEqual(posts[0].body.fromIndex, 2, 'carrying the chapter index');
  C.run(`window._posts = []; _slSplitHere(0); true;`);
  await settle();
  assert.strictEqual(C.run(`window._posts.length`), 0,
    'splitting at 0 is refused client-side too — it would move every chapter and leave an empty ' +
    'storyline behind, i.e. a rename pretending to be a split');
}
console.log('  split: posts the index, refuses 0: OK');

// ── 8. The panel is actually rendered by the storyline screen ──────────────────
// Source-layer: a panel nothing emits is the v87_m/v87_n failure (a correct control nobody can find).
{
  assert.ok(/html \+= _slManageHtml\(slMeta, _slArtIds\);/.test(html),
    'the storyline screen emits the panel');
  for (const k of ['sl.manage_chapters', 'sl.add_chapter', 'sl.split_here']) {
    assert.ok(UI.en[k], `${k} exists in ui.json en`);
  }
}
console.log('  the storyline screen emits it, and its strings exist: OK');

console.log('unit-storyline-chapters: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
