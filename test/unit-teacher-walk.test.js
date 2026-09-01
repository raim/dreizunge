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
const SLS = [{ id: 'sl_x', title: 'A Storyline', chapters: ['tp_1', 'tp_2', 'tp_3'],
               summary: 'Wat er tot nu toe gebeurd is.' }];

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
    // ⚠️ v88_p: this stub used to be an empty function, and THAT is why the release shipped broken.
    // The real showLessonSet() -> goLessonSet() -> show('lesson-set') NAVIGATES, and show()'s own
    // "leaving the progress card ends the walk" rule fired on that transit — killing the walk before
    // the card rendered, so Next kept the learner's handler and started a lesson. The empty stub
    // removed the exact interaction that breaks it. It now reproduces the navigation, which is the
    // only reason §7 below can fail.
    showLessonSet = async function(){ show('lesson-set'); };
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
      // v88_q: pinned to the NO-summary case. This section is about how a CHAPTER is opened (the
      // review render, which records nothing); the summary-first entry is 6c's subject. Asserting
      // both here would make each failure ambiguous.
      C.run(`_summaryOfStory = function(){ return null; };
        __revFlags=[]; showComplete = function(rev,i){ __revFlags.push(rev); __completeCalls++; };
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
      C.run(`_summaryOfStory = function(){ return null; };
        showComplete = function(){ __completeCalls++; };
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

    // ── 6b. The storyline SCREEN offers the same walk (v88_p, user request) ──────────────────
    // "the teacher play button should also be available on the storyline card, not just on the main
    // page." Same walk, same gate — the screen just knows its own storyline, so it needs no
    // data-attributes.
    {
      const C = client(true);
      C.run(`APP._slScreen = { chainId:'sl_x', encodedChain:'' };
        __started = null; _origWalk = walkStoryline;
        walkStoryline = function(id, enc){ __started = id; };
        walkStorylineFromScreen(); true;`, 'screen');
      assert.strictEqual(C.run(`__started`), 'sl_x',
        'the screen entry point starts the walk for the storyline it is showing');

      // The button is teacher-gated on the SCREEN too, and — unlike the other header controls —
      // NOT gated on canGenerate: walking reads existing chapters and needs no backend.
      const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const at = src.indexOf("const walkBtn = document.getElementById('sl-screen-walk-btn');");
      assert.ok(at > 0, 'the screen button has visibility logic');
      const blk = src.slice(at, at + 400);
      assert.ok(/APP\._teacherMode/.test(blk), 'gated on teacher mode');
      assert.ok(!/canGenerate/.test(blk),
        'and NOT on canGenerate — a walk needs no backend, so it must work in the static build too');
      console.log('  the storyline screen offers the same walk, teacher-gated: OK');
    }

    // ── 6c. v88_q: the walk STARTS on the summary when the storyline has one ─────────────────
    // User: "the teacher play button SHOULD start with the summary, if one is available." Index -1
    // IS that page — the same first page §0c gives a learner, so the teacher previews the course
    // the learner actually gets.
    {
      const C = client(true);
      C.run(`__sum = 0; showStorySummary = function(){ __sum++; show('summary-screen'); };
        showComplete = function(){ __completeCalls++; show('complete-screen'); };
        _summaryOfStory = function(){ return { sl: { summary:'x' }, text:'x' }; };
        walkStoryline('sl_x',''); true;`, 'sum-start');
      await settle(90);
      assert.strictEqual(C.run(`APP_WALK && APP_WALK.idx`), -1,
        'the walk lands on the SUMMARY page (index -1), not chapter 1');
      assert.ok(C.run(`__sum`) >= 1, 'and the summary card was rendered');
      assert.strictEqual(C.run(`JSON.stringify(__loaded)`), JSON.stringify(['tp_1']),
        'chapter 1 is still LOADED first — _summaryOfStory resolves through the open chapter, so '
        + 'the question cannot even be asked before then');
      console.log('  the walk starts on the summary when the storyline has one: OK');
    }

    // ── 6d. …and goes straight to chapter 1 when it has NONE ─────────────────────────────────
    // "if one is available" is a real condition, not decoration: showStorySummary() on a storyline
    // with no summary text would render a blank card.
    {
      const C = client(true);
      C.run(`__sum = 0; showStorySummary = function(){ __sum++; show('summary-screen'); };
        showComplete = function(){ __completeCalls++; show('complete-screen'); };
        _summaryOfStory = function(){ return null; };
        walkStoryline('sl_x',''); true;`, 'no-sum');
      await settle(90);
      assert.strictEqual(C.run(`APP_WALK && APP_WALK.idx`), 0,
        'with no summary the walk starts on chapter 1');
      assert.strictEqual(C.run(`__sum`), 0, 'and the summary card is never rendered');
      console.log('  with no summary it starts on chapter 1: OK');
    }

    // ── 6e. Forward from the summary reaches chapter 1; Back from chapter 1 returns to it ─────
    {
      const C = client(true);
      C.run(`_summaryOfStory = function(){ return { sl:{summary:'x'}, text:'x' }; };
        APP_WALK = { slId:'sl_x', chapters:['tp_1','tp_2','tp_3'], idx:-1 };
        _walkApplySumNav();
        __sumFwd = !!document.getElementById('sum-next').onclick; true;`, 'sumfwd');
      assert.strictEqual(C.run(`__sumFwd`), true, 'the summary page gets a forward handler');

      C.run(`APP_WALK.idx = 0; _walkApplyNav();
        __prevTitle = document.getElementById('comp-prev').title; true;`, 'backtitle');
      assert.strictEqual(C.run(`__prevTitle`), UI.en['walk.summary'],
        'and Back from chapter 1 returns to the SUMMARY, not out to the library');

      C.run(`_summaryOfStory = function(){ return null; }; _walkApplyNav();
        __prevTitle2 = document.getElementById('comp-prev').title; true;`, 'backtitle2');
      assert.strictEqual(C.run(`__prevTitle2`), UI.en['walk.exit'],
        'with no summary it leaves for the library instead (non-vacuity: the two differ)');
      console.log('  summary → chapter 1 → back to summary, and the no-summary case: OK');
    }

    // ── 7. ⚠️ THE WALK SURVIVES ITS OWN NAVIGATION ───────────────────────────────────────────
    // The user-reported bug, and the one the original stub could not express: opening a chapter goes
    // through show('lesson-set') on the way to the card. If that counts as "leaving", APP_WALK is
    // null by the time the card renders, _walkApplyNav() no-ops, and Next keeps the LEARNER's
    // handler — which starts a lesson instead of stepping to the next chapter.
    {
      const C = client(true);
      C.run(`_summaryOfStory = function(){ return null; };
        __navSeen = []; _origShow = show;
        show = function(id){ __navSeen.push(id); return _origShow(id); };
        showComplete = function(){ __completeCalls++; };
        walkStoryline('sl_x',''); true;`, 'transit');
      await settle(90);
      assert.ok(JSON.parse(C.run(`JSON.stringify(__navSeen)`)).includes('lesson-set'),
        'the walk really does transit through the lesson-set screen (non-vacuity: if it stopped '
        + 'doing so, this section would prove nothing)');
      assert.strictEqual(C.run(`walkActive()`), true,
        'and the walk SURVIVES that transit — otherwise the card renders with no walk and Next '
        + 'falls back to the learner handler, which starts a lesson');
      assert.strictEqual(C.run(`APP_WALK && APP_WALK.idx`), 0, 'still positioned on chapter 1');
      console.log('  the walk survives its own lesson-set transit: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  console.log(failed ? 'unit-teacher-walk: FAILED' : 'unit-teacher-walk: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
