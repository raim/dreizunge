// unit-browse-mode.test.js
// v88_r (user request) — the progress card's arrows BROWSE chapters; a new ▶ plays.
//
// "Can we make the new teacher play mode also available for students? Let's allow to browse through
// texts by the current arrows and instead move the 'next' function to play the next questions to a
// play button in the progress card menu. That is, we remove the chapter-wise progress locking as
// the default play mode for students. […] However, we do still want the 'play mode' question
// progress within chapters, to first solve vocab, then, to really complete a chapter, solve the
// comprehension or text hunt lessons."
//
// ⚠️ THE DESIGN CLAIM THIS FILE EXISTS TO PROTECT — the same one `unit-teacher-walk` protects for
// the walk: this is an OVERRIDE, not a rewire. showComplete()'s gate chain (the §C1 analysis,
// v77_card_gates.md's 32-row truth table, several releases of user-reported dead ends) still
// computes exactly what it computed before. §1 and §6 are the assertions that would catch a
// regression there: the destination the chain resolves is unchanged, it is simply carried on ▶.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = ms => new Promise(r => setTimeout(r, ms || 40));

const L = (id) => ({ id, type: 'standard', vocab: [{ target: 'huis', source: 'Haus' }] });
const SAVED = [
  { id: 'tp_1', topic: 'One',   lang: 'nl', srcLang: 'de', lessons: [L('a')] },
  { id: 'tp_2', topic: 'Two',   lang: 'nl', srcLang: 'de', lessons: [L('b')] },
  { id: 'tp_3', topic: 'Three', lang: 'nl', srcLang: 'de', lessons: [L('c')] },
];
const SLS = [{ id: 'sl_x', title: 'A Storyline', chapters: ['tp_1', 'tp_2', 'tp_3'] }];

// `open` = which chapter's card is rendered; `done` = topics whose lessons all carry a done-flag.
function client(open, done, opts) {
  const o = opts || {};
  const C = loadClient({ quiet: true });
  const completed = {};
  (done || []).forEach(t => {
    const s = SAVED.find(x => x.topic === t);
    completed[t] = Object.fromEntries((s.lessons || []).map(l => [l.id, { correct: 1, total: 1 }]));
  });
  const cur = SAVED.find(x => x.id === open);
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    // coverageThreshold 0: the pass mark is a SEPARATE gate (the _belowThreshold branch) and this
    // file is not about it — with a mark in force every fixture below would land in that branch and
    // §4's terminal case would be unreachable. unit-story-unlocked-card owns the mark.
    APP.info = { canGenerate: true, coverageThreshold: 0 };
    APP._teacherMode = ${o.teacher ? 'true' : 'false'};
    APP.lang='nl'; APP.srcLang='de';
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(o.solo ? [] : SLS)};
    APP.progress = { completed:${JSON.stringify(completed)}, solved:{}, chapterDone:{},
                     learned:{}, storyShown:{} };
    APP.lessonData = Object.assign(${JSON.stringify(cur)},
      { story: 'Een verhaal over een huis.', coverageTarget: 0 });
    __loaded = []; __started = null; __wentBack = null; __finished = 0;
    fetch = function(url){
      var m = /id=(tp_\\d)/.exec(String(url));
      if (m) { __loaded.push(m[1]);
        var t = ${JSON.stringify(SAVED)}.filter(function(x){ return x.id===m[1]; })[0];
        return Promise.resolve({ ok:true, status:200, json:function(){
          return Promise.resolve(Object.assign({}, t, { story:'Een verhaal.' })); } }); }
      return Promise.resolve({ ok:true, status:200, json:function(){ return Promise.resolve([]); } });
    };
    showLessonSet = async function(){ show('lesson-set'); };
    showLesson = function(i){ __started = i; return true; };
    loadSaved = function(x){ __loaded.push('loadSaved:' + String(x)); };
    compBackToStory = function(){ __wentBack = 'story'; };
    showStoryFinished = function(){ __finished++; };
    showComplete(true);
    true;`, 'seed');
  return C;
}
const btn = (C, id) => JSON.parse(C.run(
  `(function(){ var b = document.getElementById('${id}');
     return JSON.stringify({ disabled: !!b.disabled, hasClick: typeof b.onclick === 'function',
                             title: b.title, display: b.style.display }); })()`));

(async () => {
  let failed = false;
  try {

    // ── 1. ▶ CARRIES THE GATE CHAIN'S OWN DESTINATION ────────────────────────────────────────
    // The load-bearing claim. Nothing about which lesson comes next changed; the chain still picks
    // it, and ▶ is where the pick is now carried. Asserted by CLICKING, because "has an onclick"
    // is the vacuous form this project has been bitten by before.
    {
      const C = client('tp_1', []);
      const play = btn(C, 'comp-play');
      assert.strictEqual(play.disabled, false, '▶ is live while the chapter has unplayed work');
      assert.strictEqual(play.display, '', 'and it is shown');
      C.run(`document.getElementById('comp-play').onclick(); true;`, 'play');
      assert.strictEqual(C.run(`__started`), 0,
        '▶ starts the lesson the gate chain resolved — the within-chapter progression the user '
        + 'asked to KEEP is untouched, only the button carrying it changed');
      console.log('  ▶ carries the gate chain\'s in-chapter destination: OK');
    }

    // ── 2. → STEPS EXACTLY ONE CHAPTER, WITH NO COMPLETION CHECK ─────────────────────────────
    // This is "we remove the chapter-wise progress locking". Standing on chapter 1 with its own
    // work UNFINISHED, forward still moves to chapter 2 — which is precisely what the old Next
    // refused to do until the chapter was complete.
    {
      const C = client('tp_1', []);
      const next = btn(C, 'comp-next');
      assert.strictEqual(next.disabled, false, '→ is live on an UNFINISHED chapter — no lock');
      assert.strictEqual(next.title, UI.en['walk.next'], 'and it says "Next chapter"');
      C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
      await settle(80);
      assert.strictEqual(C.run(`JSON.stringify(__loaded)`), JSON.stringify(['tp_2']),
        '→ opens chapter 2 even though chapter 1 is not finished');
      assert.strictEqual(C.run(`__started`), null,
        'and it does NOT start a lesson — browsing is not playing');
      console.log('  → browses to the next chapter with the chapter unfinished: OK');
    }

    // ── 3. BROWSING DOES NOT SKIP A FINISHED CHAPTER ─────────────────────────────────────────
    // ⚠️ The discriminating fixture. `_nextChapter()` — the rule the old Next used — scans for the
    // next UNFINISHED chapter, so with chapter 2 finished it answers chapter 3. Browsing must
    // answer chapter 2. Without this section a browse implemented on top of `_nextChapter` would
    // pass every other assertion in this file.
    {
      const C = client('tp_1', ['One', 'Two']);
      // Non-vacuity: the two rules really do disagree on this fixture.
      assert.strictEqual(C.run(`chapterComplete((APP.savedList||[]).filter(function(s){return s.id==='tp_2';})[0])`), true,
        'chapter 2 really is finished, so "next unfinished" would skip it');
      C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
      await settle(80);
      assert.strictEqual(C.run(`JSON.stringify(__loaded)`), JSON.stringify(['tp_2']),
        '→ steps to the ADJACENT chapter, not to the next unfinished one');
      console.log('  → does not skip a finished chapter (the rule the old Next used would have): OK');
    }

    // ── 4. THE END OF THE DECK: ▶ GREYS, → CARRIES THE END-OF-STORYLINE MOVE ──────────────────
    // The chain's terminal branch is the one case ▶ does not take — "back to the storyline" is not
    // something you play. v74_o's guarantee (the last card is never a dead end) is what → keeps.
    {
      const C = client('tp_3', ['One', 'Two', 'Three']);
      const play = btn(C, 'comp-play'), next = btn(C, 'comp-next');
      assert.strictEqual(play.disabled, true,
        'with nothing left to play, ▶ greys rather than pointing at an exit');
      assert.strictEqual(play.hasClick, false, 'and carries no handler');
      assert.strictEqual(play.display, '', 'but stays present and greyed (v71_h), never hidden');
      assert.strictEqual(next.disabled, false, '→ is live — the last card is not a dead end (v74_o)');
      C.run(`document.getElementById('comp-next').onclick(); true;`, 'end');
      assert.strictEqual(C.run(`__finished`), 1,
        'and it opens the story-finished card, the last page of the §0c walk (v77_f)');
      console.log('  end of a finished deck: ▶ greys, → opens the finished card: OK');
    }

    // ── 4b. …and ONE rule decides that, not two ──────────────────────────────────────────────
    // `_compEndForward` has two askers now (the terminal gate branch and the browse arrow). A
    // second copy of "where does the end lead" is exactly the shape that drifted for the storyline
    // page's connector line in v71_w, so the shared helper is pinned at the source layer.
    {
      const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      assert.ok(/function _compEndForward\(slCtx, isDrill\)/.test(src),
        'the end-of-storyline rule is one named function');
      const callers = (src.match(/_compEndForward\(/g) || []).length;
      assert.strictEqual(callers, 3,
        'and it is CALLED from exactly two places plus its own definition — a third caller, or a '
        + 'branch that stops calling it, is a drift this assertion is here to name');
      assert.ok(!/const _finish = !lesson\._drill && _storyAllChaptersDone\(_slCtx\)/.test(src),
        'the gate chain no longer spells the rule inline — it asks the helper');
      console.log('  the end-of-storyline destination is one rule with two askers: OK');
    }

    // ── 5. A SOLO CHAPTER (no storyline) ─────────────────────────────────────────────────────
    // There is no chapter to browse to, so → falls to the same end-of-storyline rule, which for a
    // chapter belonging to no deck means home. ▶ still plays.
    {
      const C = client('tp_1', [], { solo: true });
      assert.strictEqual(btn(C, 'comp-play').disabled, false, 'a solo chapter still has ▶');
      C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
      await settle(60);
      assert.strictEqual(C.run(`JSON.stringify(__loaded)`), '[]', '→ loads no chapter — there is none');
      assert.strictEqual(C.run(`__wentBack`), 'story',
        'it takes the end-of-storyline route instead of dead-ending');
      console.log('  a solo chapter: ▶ plays, → takes the end route: OK');
    }

    // ── 6. ⚠️ THE GATE CHAIN IS RECORDED, NOT REWIRED ────────────────────────────────────────
    // `_compNextKind` is the only new input the chain produces, and it must NAME the branch that
    // ran — if it were wrong, ▶ would grey on a chapter with work left (or offer an exit as if it
    // were play). Checked at both ends of its range against fixtures whose branch is known.
    {
      const A = client('tp_1', []);
      assert.strictEqual(A.run(`(function(){ var k=null; var o=_browseApplyNav;
        _browseApplyNav=function(x){ k=x.kind; }; showComplete(true); _browseApplyNav=o; return k; })()`),
        'play', 'an unfinished chapter reports the PLAY branch');
      const B = client('tp_3', ['One', 'Two', 'Three']);
      assert.strictEqual(B.run(`(function(){ var k=null; var o=_browseApplyNav;
        _browseApplyNav=function(x){ k=x.kind; }; showComplete(true); _browseApplyNav=o; return k; })()`),
        'end', 'a finished deck reports the TERMINAL branch');
      console.log('  the chain reports which branch resolved it, at both ends of the range: OK');
    }

    // ── 7. THE HEADER-ROW DUPLICATE ──────────────────────────────────────────────────────────
    // ▶ lives in the ☰ popup with the rest of the machinery, per the request — and is mirrored out
    // beside the arrows, because playing is the move the card is ASKING for and must not cost two
    // taps while browsing costs one. Mirrored by the SAME `_mirrorNavBtn` the arrows use.
    {
      const C = client('tp_1', []);
      C.run(`__hdr = null;
        document.getElementById('comp-play').onclick = function(){ __hdr = 'via-duplicate'; };
        _mirrorNavBtn('comp-play', 'comp-story-play');
        document.getElementById('comp-story-play').onclick({ stopPropagation: function(){} });
        true;`, 'mirror');
      assert.strictEqual(C.run(`__hdr`), 'via-duplicate',
        'the header duplicate invokes the popup button\'s own handler, so the two cannot disagree');

      const D = client('tp_3', ['One', 'Two', 'Three']);
      assert.strictEqual(btn(D, 'comp-story-play').disabled, true,
        'and a greyed ▶ greys its duplicate too — the disabled state is mirrored, not re-derived');
      console.log('  ▶ is mirrored into the header nav row, state and handler: OK');
    }

    // ── 8. THE TEACHER WALK STILL OWNS THE ARROWS ────────────────────────────────────────────
    // Two overrides now run at the end of the same render. The walk's must win on the arrows, or a
    // teacher stepping through a storyline would find → pointing at the browse target instead of
    // the walk's next chapter — and Back would stop leading out of the walk.
    //
    // ⚠️ WHAT ENFORCES THIS IS THE CALL ORDER, not `_browseApplyNav`'s own `walkActive()` check.
    // Measured: deleting that check leaves this section — and unit-teacher-walk — entirely green,
    // because `_walkApplyNav()` runs immediately afterwards and repoints both arrows again. The
    // behavioural assertion below therefore cannot attribute itself to one guard, which is stated
    // rather than papered over (v87_p's ruling on exactly this situation). The ordering IS
    // attributable, so it is pinned at the source layer too, and swapping the two calls goes red.
    {
      const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const b = src.indexOf('_browseApplyNav({ kind:');
      const w = src.indexOf('try { _walkApplyNav(); }');
      const m = src.indexOf('try { _syncCompHdrNav(); }');
      assert.ok(b > 0 && w > 0 && m > 0, 'all three end-of-render steps are present');
      assert.ok(b < w && w < m,
        'browse runs, THEN the walk override (so a walk wins), THEN the header mirror (so the '
        + 'duplicates inherit whichever spoke last)');
    }
    {
      const C = client('tp_1', [], { teacher: true });
      C.run(`APP_WALK = { slId:'sl_x', chapters:['tp_1','tp_2','tp_3'], idx: 2 };
        showComplete(true); true;`, 'walk');
      assert.strictEqual(btn(C, 'comp-next').disabled, true,
        'on the walk\'s LAST chapter → is disabled — the walk decided that, not the browse '
        + '(which would have offered the end-of-storyline move on a live button)');
      assert.strictEqual(btn(C, 'comp-play').disabled, false,
        'while ▶ is still offered: playing a chapter stays optional during a walk, not forbidden');
      console.log('  a teacher walk still owns the arrows; ▶ remains available: OK');
    }

    // ── 9. A DRILL CARD IS LEFT ENTIRELY ALONE ───────────────────────────────────────────────
    // Its topic is synthetic (nothing to browse to) and its branch is the fix for three separate
    // user-reported dead ends (v66.1, v69.2). Not code to disturb for a cosmetic gain.
    {
      const C = client('tp_1', []);
      C.run(`APP.lessonData.lessons[0]._drill = true;
        APP.cur = { lessonIdx:0, correct:0, total:0, mistakes:0, bestStreak:0, flagCount:0, exercises:[] };
        showComplete(); true;`, 'drill');
      assert.strictEqual(btn(C, 'comp-play').display, 'none', '▶ is hidden on a drill card');
      assert.strictEqual(btn(C, 'comp-next').hasClick, true,
        'and → keeps the drill branch\'s own handler — the browse override never touched it');
      console.log('  a drill card keeps its own wiring, whole: OK');
    }

    // ── 10. "WHERE FORWARD WOULD HAVE LED" FOLLOWS THE SPLIT ─────────────────────────────────
    // `_captureNextAction` (the word-tap detour, item Z) and `_storyTapMaybeAdvance` (a tap on the
    // plain story text) both read the forward button's CURRENT handler. With forward split in two,
    // they must prefer ▶ and fall back to → — together the pair reproduces exactly what comp-next
    // alone meant before. Reading only comp-next would silently turn a tap-to-continue into a
    // tap-to-leave-the-chapter.
    {
      const C = client('tp_1', []);
      C.run(`__which = null;
        document.getElementById('comp-play').onclick = function(){ __which = 'play'; };
        document.getElementById('comp-next').onclick = function(){ __which = 'next'; };
        _captureNextAction()(); true;`, 'cap');
      assert.strictEqual(C.run(`__which`), 'play', 'with ▶ live, the captured action is ▶');

      C.run(`__which = null;
        var p = document.getElementById('comp-play'); p.disabled = true;
        _captureNextAction()(); true;`, 'cap2');
      assert.strictEqual(C.run(`__which`), 'next',
        'and with ▶ greyed it falls back to → — never to nothing');
      console.log('  the word-tap detour and the story tap follow ▶ first, → second: OK');
    }

    // ── 11. A STRAY SPEECH-ADVANCE ONTO A REVIEW CARD DOES NOT THROW ─────────────────────────
    // Found BY this release, not invented for it. A review render's synthetic C has `_review:true`,
    // no exercises and NO `cur`, and renderEx's length guard is `C.cur >= length` — false for
    // `undefined`, so a timer left over from the previous round walked straight into
    // `C.exercises[undefined]`. Latent while reaching a review card mid-flight was rare; → now
    // loads the next chapter ASYNCHRONOUSLY and lands on exactly that card, so a learner pressing
    // it right after answering has that timer in the air.
    {
      const C = client('tp_1', []);
      C.run(`APP.cur = { lessonIdx:0, correct:0, total:0, mistakes:0, bestStreak:0,
                         flagCount:0, exercises: [], _review: true };
             __threw = null; try { renderEx(); } catch(e){ __threw = String(e && e.message); }
             true;`, 'stray');
      assert.strictEqual(C.run(`__threw`), null,
        'renderEx returns quietly when APP.cur is a review card — no round to render, nothing to record');
      console.log('  a stray speech-advance onto a review card no longer throws: OK');
    }

    // ── 12. STATIC-BUILD PARITY ──────────────────────────────────────────────────────────────
    // ⚠️ `_backToChapterProgress` is defined ABOVE @static-exclude-end in index.html, so the static
    // build never had it — the ← "previous chapter" button has been a ReferenceError in
    // docs/index.html since v82_e shipped it. v88_r points the FORWARD arrow at the same helper,
    // which is how the gap surfaced. build-static.js now supplies its own STATIC_LESSONS version.
    {
      const docs = path.join(ROOT, 'docs', 'index.html');
      const built = fs.readFileSync(docs, 'utf8');
      assert.ok(/async function _backToChapterProgress\(ref\)\{/.test(built),
        'the static build DEFINES _backToChapterProgress, not just calls it');
      assert.ok(/_backToChapterProgress[\s\S]{0,400}?STATIC_LESSONS/.test(built),
        'and it resolves from STATIC_LESSONS — there is no /api/lessons/load to fetch from');
      assert.ok(/id="comp-play"/.test(built) && /id="comp-story-play"/.test(built),
        'and both ▶ buttons reach the published build, where the students actually are');
      console.log('  static build: _backToChapterProgress is defined, and ▶ ships: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  console.log(failed ? 'unit-browse-mode: FAILED' : 'unit-browse-mode: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
