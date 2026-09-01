// unit-teacher-walk.test.js
// item: teacher walkthrough (v88_o) — a teacher can page through a storyline's progress cards with
// no locking, back/next stepping chapter by chapter, playing lessons optional.
//
// User request: "currently we only see progress cards in student mode. let's allow a teacher mode
// access, started via a play button on the storyline card, and where there is NO locking/unlocking,
// back/next buttons just lead through chapters, playing lessons is optional."
//
// ⚠️ THE DESIGN CLAIM THIS FILE EXISTS TO PROTECT: the walk is an OVERRIDE, not a rewire.
// showComplete()'s Next/Back decision tree is the most expensive code in the client to get wrong
// (the §C1 gate analysis, v77_card_gates.md's 32-row truth table, several releases). §4 asserts the
// LEARNER path is untouched, which is the assertion that would catch a regression there.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = ms => new Promise(r => setTimeout(r, ms || 40));

const SAVED = [
  { id: 'tp_1', topic: 'One',   lang: 'nl', srcLang: 'de', lessons: [{ id: 1, type: 'standard' }] },
  { id: 'tp_2', topic: 'Two',   lang: 'nl', srcLang: 'de', lessons: [{ id: 1, type: 'standard' }] },
  { id: 'tp_3', topic: 'Three', lang: 'nl', srcLang: 'de', lessons: [{ id: 1, type: 'standard' }] },
];
const SLS = [{ id: 'sl_x', title: 'A Storyline', chapters: ['tp_1', 'tp_2', 'tp_3'] }];

function client(teacher) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { canGenerate: true }; APP._teacherMode = ${teacher ? 'true' : 'false'};
    APP.lang='nl'; APP.srcLang='de';
    APP.savedList = ${JSON.stringify(SAVED)}; APP.storylines = ${JSON.stringify(SLS)};
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    __loaded = [];
    fetch = function(url){
      var u = String(url);
      var m = /\\/api\\/lessons\\/load\\?id=(tp_\\d)/.exec(u);
      if (m) { __loaded.push(m[1]);
        var t = ${JSON.stringify(SAVED)}.filter(function(x){ return x.id===m[1]; })[0];
        return Promise.resolve({ ok:true, status:200, json:function(){ return Promise.resolve(
          Object.assign({}, t, { story:'Een verhaal.', lessons:[{id:1,type:'standard',vocab:[]}] })); } }); }
      return Promise.resolve({ ok:true, status:200, json:function(){ return Promise.resolve([]); } });
    };
    showLessonSet = async function(){};       // language/dir setup, not what this file tests
    __completeCalls = 0; _origComplete = showComplete;
    showComplete = function(rev, i){ __completeCalls++; return _origComplete(rev, i); };
    true;`, 'seed');
  return C;
}

(async () => {
  let failed = false;
  try {

    // ── 1. Starting the walk opens the FIRST chapter, via the REVIEW render ───────────────────
    // The review render is what records nothing — a teacher paging through must not mark chapters
    // complete or write into a learner's ledger.
    {
      const C = client(true);
      C.run(`__revFlags=[]; showComplete = function(rev,i){ __revFlags.push(rev); __completeCalls++; };
        walkStoryline('sl_x', ''); true;`, 'start');
      await settle(80);
      assert.strictEqual(C.run(`JSON.stringify(__loaded)`), JSON.stringify(['tp_1']),
        'the walk opens the storyline\'s FIRST chapter');
      assert.strictEqual(C.run(`JSON.stringify(__revFlags)`), JSON.stringify([true]),
        'through showComplete(true) — the REVIEW render, which records nothing');
      assert.strictEqual(C.run(`APP_WALK && APP_WALK.idx`), 0, 'and the walk is at index 0');
      console.log('  starting the walk opens chapter 1 through the review render: OK');
    }

    // ── 2. Next / Back step chapter by chapter, regardless of completion ──────────────────────
    {
      const C = client(true);
      C.run(`showComplete = function(){ __completeCalls++; };
        walkStoryline('sl_x',''); true;`, 'start');
      await settle(80);
      C.run(`walkGoto(APP_WALK.idx + 1); true;`, 'fwd'); await settle(60);
      C.run(`walkGoto(APP_WALK.idx + 1); true;`, 'fwd2'); await settle(60);
      assert.strictEqual(C.run(`JSON.stringify(__loaded)`), JSON.stringify(['tp_1','tp_2','tp_3']),
        'forward walks the chapters in order, with no completion check anywhere');
      C.run(`walkGoto(APP_WALK.idx - 1); true;`, 'back'); await settle(60);
      assert.strictEqual(C.run(`APP_WALK.idx`), 1, 'and back steps exactly one chapter');
      console.log('  next/back step through chapters with no gating: OK');
    }

    // ── 3. The nav override: ends of the walk, and where Back leads on chapter 1 ──────────────
    {
      const C = client(true);
      C.run(`APP_WALK = { slId:'sl_x', chapters:['tp_1','tp_2','tp_3'], idx:0 };
        _walkApplyNav(); true;`, 'first');
      assert.strictEqual(C.run(`document.getElementById('comp-next').disabled`), false,
        'forward is live on the first chapter');
      assert.ok(C.run(`!!document.getElementById('comp-prev').onclick`),
        'and BACK is live too — on chapter 1 it leaves the walk rather than dead-ending');

      C.run(`APP_WALK.idx = 2; _walkApplyNav(); true;`, 'last');
      assert.strictEqual(C.run(`document.getElementById('comp-next').disabled`), true,
        'forward is DISABLED on the last chapter — greyed out reads as "you are at the end", '
        + 'where a vanished button reads as a bug');
      console.log('  the nav override handles both ends of the walk: OK');
    }

    // ── 4. ⚠️ THE LEARNER PATH IS UNTOUCHED ──────────────────────────────────────────────────
    // The whole safety argument for this design. With no walk active, _walkApplyNav must not touch
    // a single property of either button — showComplete's own gate branches own them.
    {
      const C = client(false);
      C.run(`APP_WALK = null;
        var n = document.getElementById('comp-next');
        n.disabled = true; n.onclick = null; n.style.opacity = '.5';
        _walkApplyNav();
        __after = { disabled: n.disabled, hasClick: !!n.onclick, opacity: n.style.opacity };
        true;`, 'learner');
      const after = JSON.parse(C.run(`JSON.stringify(__after)`));
      assert.strictEqual(after.disabled, true, 'a disabled Next stays disabled — the gate still owns it');
      assert.strictEqual(after.hasClick, false, 'and un-wired stays un-wired');
      assert.strictEqual(after.opacity, '.5', 'and its styling is untouched');
      console.log('  with no walk active the override is a complete no-op: OK');
    }

    // ── 5. Teacher-gated, at BOTH layers ─────────────────────────────────────────────────────
    // The button is teacher-only in the markup, and walkStoryline refuses independently — a mode
    // that unlocks every chapter must not depend on markup alone for that.
    {
      const C = client(false);
      C.run(`walkStoryline('sl_x',''); true;`, 'learner-start');
      await settle(60);
      assert.strictEqual(C.run(`APP_WALK`), null, 'a learner cannot start a walk even by calling it');
      assert.strictEqual(C.run(`JSON.stringify(__loaded)`), '[]', 'and nothing is loaded');

      const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const at = src.indexOf('walkStoryline(this.dataset.sl');
      assert.ok(at > 0, 'the play button exists in the storyline card markup');
      assert.ok(/APP\._teacherMode\?`<button/.test(src.slice(Math.max(0, at - 400), at)),
        'and it is rendered only in teacher mode');
      console.log('  the walk is teacher-gated in the markup AND in the function: OK');
    }

    // ── 6. Navigating away ends the walk ─────────────────────────────────────────────────────
    // Otherwise a stale walk would repoint the nav on a card reached by another route entirely.
    {
      const C = client(true);
      C.run(`APP_WALK = { slId:'sl_x', chapters:['tp_1'], idx:0 };
        show('complete-screen'); __stillWalking = walkActive();
        show('landing-screen');  __afterLeaving = walkActive(); true;`, 'nav');
      assert.strictEqual(C.run(`__stillWalking`), true, 'staying on the progress card keeps the walk');
      assert.strictEqual(C.run(`__afterLeaving`), false, 'leaving it ends the walk');
      console.log('  the walk ends when the teacher navigates away: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  console.log(failed ? 'unit-teacher-walk: FAILED' : 'unit-teacher-walk: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
