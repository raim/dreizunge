// unit-lesson-entry-journey.test.js — v90_f
//
// The three functions the v90_d/v90_e branch-mutation audit left standing at ZERO: `goLessonSet`,
// `startLesson` and `renderEx`. Each is lifted by an existing guard (`unit-drill`,
// `unit-learner-nav`, `unit-student-flags`) and each scored 0 — every `if` in them could be flipped,
// in either direction, without a single assertion moving. Escalated to the whole `--quick` suite
// (including `smoke-render`, which v90_d guessed would cover them and did not): still zero.
//
// ⚠️ WHY A SEPARATE FILE AND NOT THREE MORE BLOCKS. These are orchestration functions: their
// branches are language-context switches, screen transitions and render dispatch, and they close
// over most of the client. The lift-and-drive pattern the other repairs used does not reach them —
// they need the whole client loaded and driven, which is what `lib-dom`'s `loadClient` is for. The
// claims below are the ones their own comments record as user-reported bugs, which is why the
// branches exist at all.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const settle = (ms) => new Promise(r => setTimeout(r, ms || 40));

// A client with the render/navigation leaves stubbed, so what a call DID is readable.
function client(setup) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    globalThis._shown = []; globalThis._rendered = []; globalThis._toasts = []; globalThis._uiLoaded = [];
    show = (id) => _shown.push(id);
    showToast = (m) => _toasts.push(m);
    loadUIStrings = async (l) => { _uiLoaded.push(l); };
    renderErrorHunt   = () => _rendered.push('error_hunt');
    renderAiErrorHunt = () => _rendered.push('ai_error_hunt');
    renderWriting     = () => _rendered.push('writing');
    buildPath         = () => _rendered.push('lesson-set-page');
    showProgressCard  = (r) => _rendered.push('progress-card' + (r ? ':review' : ''));
    ${setup || ''}`);
  return C;
}
const S = (C) => C.sandbox;
// ⚠️ Arrays built INSIDE the vm context have the sandbox's Array prototype, so deepStrictEqual
// reports two identical-looking arrays as different. Read them back through JSON.
const arr = (C, name) => JSON.parse(C.run(`JSON.stringify(${name})`));

(async () => {

// ── 1. goLessonSet: the three language contexts, each a reported bug ─────────
//
// The chrome language, the UI language and the TARGET language are three different things, and
// this is the one choke point every entry into a lesson set passes through.
{
  const CH = (over) => `
    APP.savedList = [{ id: 'tp_1', topic: 'Eins', lang: 'ar', srcLang: 'nl', lessons: [] }];
    APP.storylines = ${over ? "[{ id: 'sl_1', title: 'Chain', chapters: ['tp_1'] }]" : '[]'};
    APP.lessonData = APP.savedList[0];
    APP.srcLang = 'de'; APP.uiLang = 'de'; APP.lang = 'it';`;

  // (a) a standalone topic: all three contexts follow the chapter
  {
    const C = client(CH(false) + "\nAPP.overruleStorylineLang = true;");
    await C.run('goLessonSet()');
    await settle();
    assert.strictEqual(S(C).APP.srcLang, 'nl', 'the render source language follows the chapter');
    assert.strictEqual(S(C).APP.lang, 'ar',
      '⚠️ and so does the TARGET language — an en→ar chapter opened while the form was on another ' +
      'target rendered its word-order banks LTR because tgt-rtl was never set');
    assert.strictEqual(S(C).APP.uiLang, 'nl', 'a standalone topic follows unconditionally…');
    assert.deepStrictEqual(arr(C, '_uiLoaded'), ['nl'], '…and the strings for it are actually fetched');
    assert.strictEqual(S(C).APP._slLangMismatch, false, 'with nothing to warn about');
    assert.ok(arr(C, '_shown').includes('lesson-set'), 'and the lesson-set page is shown');
  }

  // (b) ⚠️ a STORYLINE chapter with "keep fixed" ticked: the UI language must NOT snap over.
  // The bug this branch fixes: goLessonSet is also the plumbing every "next chapter" transition
  // inside a storyline runs through, so its old unconditional follow silently overrode the setting
  // on every chapter change.
  {
    const C = client(CH(true) + "\nAPP.overruleStorylineLang = true;");
    await C.run('goLessonSet()');
    await settle();
    assert.strictEqual(S(C).APP.uiLang, 'de', 'the overruled UI language stays exactly where it was');
    assert.deepStrictEqual(arr(C, '_uiLoaded'), [], 'and no strings are re-fetched');
    assert.strictEqual(S(C).APP._slLangMismatch, true,
      'but the mismatch is RECORDED, so the chrome can say the chapter is in another language');
    assert.strictEqual(S(C).APP.srcLang, 'nl', 'the render context still follows — only the UI is pinned');
  }

  // (c) the same chapter with the setting off behaves like the standalone case
  {
    const C = client(CH(true) + "\nAPP.overruleStorylineLang = false;");
    await C.run('goLessonSet()');
    await settle();
    assert.strictEqual(S(C).APP.uiLang, 'nl', 'no overrule → the storyline chapter takes the UI with it');
    assert.strictEqual(S(C).APP._slLangMismatch, false, 'and there is no mismatch to report');
  }

  // (d) the footer selector is the visible half of APP.srcLang and must agree with it
  {
    const C = client(CH(false));
    C.run("document.getElementById('src-lang-select-footer-ls').value = 'de';");
    await C.run('goLessonSet()');
    await settle();
    assert.strictEqual(C.document.getElementById('src-lang-select-footer-ls').value, 'nl',
      'the mid-story source selector shows the language the page is actually rendering in');
  }

  // (d2) ⚠️ a chapter that records no target language must LEAVE APP.lang alone rather than
  // assigning `undefined` over it — an unconditional assignment here blanks the render context and
  // takes the RTL/LTR flags with it.
  {
    const C = client(`APP.savedList = [{ id:'tp_1', topic:'Eins', srcLang:'nl', lessons: [] }];
      APP.storylines = []; APP.lessonData = APP.savedList[0];
      APP.srcLang = 'de'; APP.uiLang = 'de'; APP.lang = 'it';`);
    await C.run('goLessonSet()');
    await settle();
    assert.strictEqual(S(C).APP.lang, 'it', 'no target language on the chapter → the current one stands');
  }

  // (e) no lesson data at all: none of the above happens, and nothing throws
  {
    const C = client("APP.lessonData = null; APP.srcLang = 'de'; APP.uiLang = 'de'; APP.lang = 'it';");
    await C.run('goLessonSet()');
    await settle();
    assert.strictEqual(S(C).APP.srcLang, 'de', 'no chapter → no language change');
    assert.strictEqual(S(C).APP.uiLang, 'de');
    assert.strictEqual(S(C).APP.lang, 'it');
    assert.ok(arr(C, '_shown').includes('lesson-set'), 'and the page is still shown rather than left blank');
    assert.deepStrictEqual(C.calls.errors, [], 'without an error on the console');
  }
}
console.log('  goLessonSet: chrome / UI / target languages, and the storyline overrule: OK');

// ── 2. startLesson: its RETURN VALUE is routing, and its resets are bug fixes ─
{
  const LESSONS = `[
    { id: 'l0', type: 'standard', vocab: [{target:'huis',source:'Haus'},{target:'kat',source:'Katze'},
                                          {target:'boom',source:'Baum'},{target:'huis2',source:'Haus2'}] },
    { id: 'l1', type: 'standard', _hidden: true, vocab: [{target:'x',source:'y'}] },
    { id: 'l2', type: 'writing', prompts: [{ prompt: 'Schreib etwas' }] },
    { id: 'l3', type: 'error_hunt', sentences: [{ text: 'Ein Satz.', errors: [] }] },
    { id: 'l4', type: 'ai_error_hunt', sentences: [{ text: 'Ein Satz.', errors: [] }] }
  ]`;
  const base = `APP.lessonData = { id:'tp_1', topic:'Eins', lang:'nl', srcLang:'de', lessons: ${LESSONS} };
                APP.lang = 'nl'; APP.srcLang = 'de'; APP._teacherMode = false;`;

  // ⚠️ the boolean is load-bearing: loadSaved routes on it, and a silent false strands a learner
  // on the lesson-set page they must never see (v68.1).
  {
    const C = client(base);
    assert.strictEqual(C.run('startLesson(1)'), false, 'a hidden lesson does not open for a learner');
    assert.deepStrictEqual(arr(C, '_shown'), [], 'and no screen is shown at all');
    C.run('APP._teacherMode = true;');
    assert.strictEqual(C.run('startLesson(1)'), true, 'the same lesson opens for a teacher');
  }
  // a mixed lesson with nothing to pool must not open an empty player
  {
    const C = client(`APP.lessonData = { id:'tp_2', topic:'Zwei', lang:'nl', srcLang:'de',
                        lessons: [{ id:'m', type:'mixed' }] }; APP.lang='nl'; APP._teacherMode=false;`);
    assert.strictEqual(C.run('startLesson(0)'), false, 'an unpoolable mixed lesson refuses to open');
    assert.strictEqual(arr(C, '_toasts').length, 1, 'and says why');
    assert.deepStrictEqual(arr(C, '_shown'), [], 'rather than showing an empty lesson screen');
  }
  // a real lesson: the round is built and every per-round field is FRESH
  {
    const C = client(base);
    C.run(`APP.cur._wrongTargets = new Set(['stale']); APP.cur._review = true;
           APP.cur.ans = ['old']; APP.micMuted = false;`);
    assert.strictEqual(C.run('startLesson(0)'), true, 'a normal lesson opens');
    assert.ok(C.run('APP.cur.exercises.length') > 0, 'with exercises built for it');
    assert.strictEqual(C.run('APP.cur.cur'), 0, 'starting at the first question');
    assert.strictEqual(C.run('APP.cur.lessonIdx'), 0, 'and knowing which lesson it is');
    // ⚠️ each of these was a real defect: a wrong-set that accumulated across the whole session
    // (so drilling a word you had missed INCREMENTED its wrong count), a review flag that stopped
    // the round being recorded, a stale answer ledger, and a mic left listening from a previous
    // lesson (v85_b: a learner must turn it on for THIS lesson).
    assert.strictEqual(C.run('APP.cur._wrongTargets === undefined'), true, 'the wrong-set does not carry over');
    assert.strictEqual(C.run('APP.cur._review === undefined'), true, 'nor a review flag');
    assert.deepStrictEqual(C.run('JSON.stringify(APP.cur.ans)'), '[]', 'the answer ledger starts empty');
    assert.strictEqual(C.run('APP.micMuted'), true, 'and the mic starts OFF');
    assert.strictEqual(C.run('APP.cur.hearts'), 3, 'with a fresh life count');
    assert.ok(arr(C, '_shown').includes('lesson-screen'), 'the lesson screen is shown');
  }
  // the dispatch: each type reaches its own renderer, and only its own
  {
    for (const [idx, want] of [[2, 'writing'], [3, 'error_hunt'], [4, 'ai_error_hunt']]) {
      const C = client(base);
      assert.strictEqual(C.run(`startLesson(${idx})`), true);
      assert.deepStrictEqual(arr(C, '_rendered'), [want], `lesson ${idx} renders through ${want} and nothing else`);
    }
    const C = client(base);
    C.run('startLesson(0)');
    assert.ok(!arr(C, '_rendered').includes('writing') && !arr(C, '_rendered').includes('error_hunt'),
      'a standard lesson reaches none of the special renderers');
    assert.strictEqual(C.run('APP.cur.isErrorHunt'), false, 'and is not flagged as one');
  }
}
console.log('  startLesson: the routing boolean, the per-round resets, the type dispatch: OK');

// ── 3. renderEx: the guard that exists because of a crash a user hit ─────────
{
  const base = `APP.lessonData = { id:'tp_1', topic:'Eins', lang:'nl', srcLang:'de', lessons: [
      { id:'l0', type:'standard', vocab: [{target:'huis',source:'Haus'},{target:'kat',source:'Katze'},
                                          {target:'boom',source:'Baum'},{target:'huis2',source:'Haus2'}] }] };
    APP.lang = 'nl'; APP._teacherMode = false;`;

  // ⚠️ v88_r, reported: a speech-advance timer from the previous round lands after the learner has
  // browsed to a REVIEW card. That synthetic C has `_review:true`, an empty exercises array and NO
  // `cur` — and `C.cur >= length` is FALSE for undefined, so the stray call went straight through
  // to `C.exercises[undefined].type`.
  {
    const C = client(base);
    C.run('startLesson(0)');
    const before = arr(C, '_rendered').length;
    C.run("APP.cur = { _review: true, exercises: [] };");
    assert.doesNotThrow(() => C.run('renderEx()'),
      'a stray render on a review card is a no-op, not "Cannot read properties of undefined"');
    assert.strictEqual(arr(C, '_rendered').length, before, 'and it leaves the card alone');
    // the same for a C that has no round at all
    C.run("APP.cur = { exercises: [] };");
    assert.doesNotThrow(() => C.run('renderEx()'), 'and so is a render with no question index');
    C.run("APP.cur = null;");
    assert.doesNotThrow(() => C.run('renderEx()'), 'and one with no round at all');
  }
  // past the last question, the round ENDS rather than indexing off the end
  {
    const C = client(base);
    C.run('startLesson(0)');
    C.run('APP.cur.cur = APP.cur.exercises.length;');
    assert.doesNotThrow(() => C.run('renderEx()'), 'running off the end does not throw');
    assert.ok(arr(C, '_rendered').some(x => /progress-card|complete/.test(x)) || arr(C, '_shown').length > 0,
      'it finishes the round instead');
  }
  // ── ⚠️ the end of a DRILL round: the v71_h / v71_n cluster, reported as "studiare asked over
  // and over". A drill runs on an ephemeral topic. When it finishes, the ledger must be written
  // WHILE the drill lesson and its wrong-set still exist, the real topic must come back, and the
  // card shown must be the real chapter's — not the drill's own hollow one.
  {
    const C = client(base);
    C.run(`globalThis._ledger = [];
      recordLearnedFromLesson = (lesson, wrong) => _ledger.push({ id: lesson && lesson.id,
        drill: !!(lesson && lesson._drill), wrong: wrong ? [...wrong] : null });
      APP._drillPrev = APP.lessonData;
      APP.lessonData = { topic: '__drill__', lang: 'nl', srcLang: 'de', _ephemeral: true,
                         lessons: [{ id: 'drill0', type: 'standard', _drill: true,
                                     vocab: [{ target: 'studiare', source: 'lernen' }] }] };
      APP.cur = { lessonIdx: 0, exercises: [], cur: 0, _wrongTargets: new Set(['studiare']) };`);
    C.run('renderEx()');

    const ledger = JSON.parse(C.run('JSON.stringify(_ledger)'));
    assert.strictEqual(ledger.length, 1, 'the drill writes exactly one ledger entry');
    assert.strictEqual(ledger[0].drill, true,
      '⚠️ and it is the DRILL lesson that is recorded — after endDrill() `lesson` would point at a ' +
      'real chapter lesson and the drill would be invisible to the ledger');
    assert.deepStrictEqual(ledger[0].wrong, ['studiare'],
      "and its wrong-set rides along, so a word answered right walks its wrong count DOWN");

    assert.strictEqual(C.run('APP.lessonData.topic'), 'Eins', 'the real topic is restored…');
    assert.strictEqual(C.run('APP._drillPrev === undefined'), true, '…and the drill stash is cleared');
    assert.strictEqual(arr(C, '_toasts').length, 1, 'the learner is told the drill is done');
    assert.ok(arr(C, '_rendered').includes('progress-card:review'),
      "and lands on the real chapter's card in review mode, not a hollow drill card");
  }
  // …while an ordinary round ending does NONE of that
  {
    const C = client(base);
    C.run(`globalThis._ledger = [];
      recordLearnedFromLesson = (l, w) => _ledger.push(1);`);
    C.run('startLesson(0)');
    const toastsBefore = arr(C, '_toasts').length;
    C.run('APP.cur.cur = APP.cur.exercises.length;');
    C.run('renderEx()');
    assert.strictEqual(JSON.parse(C.run('JSON.stringify(_ledger)')).length, 0,
      'a normal round does not run the drill teardown');
    assert.strictEqual(arr(C, '_toasts').length, toastsBefore, 'and shows no drill toast');
  }

  // ── item Z (user ruling): a word-tap detour rejoins normal forward progress instead of ending
  // on its own progress card — "afterwards proceed with where 'next' or tapping non-highlighted
  // words would bring us". The captured action must fire ONCE and must be cleared first, so a
  // re-entrant render cannot fire it twice.
  {
    const C = client(base);
    C.run(`globalThis._resumed = 0;`);
    C.run('startLesson(0)');
    C.run(`APP.cur.cur = APP.cur.exercises.length;
           APP.cur._wordRun = { next: () => { _resumed++; } };
           renderEx();`);
    assert.strictEqual(C.run('_resumed'), 1, 'the captured action runs when the detour finishes');
    assert.strictEqual(C.run('APP.cur._wordRun === undefined'), true, 'and is cleared');
    assert.ok(!arr(C, '_rendered').includes('progress-card'),
      '⚠️ and the learner is NOT parked on a progress card — the whole point of the ruling');
    C.run('renderEx()');
    assert.strictEqual(C.run('_resumed'), 1, 'a second render cannot fire it again');

    // a detour with nothing captured falls through to the normal card rather than dead-ending
    const bare = client(base);
    bare.run('startLesson(0)');
    bare.run(`APP.cur.cur = APP.cur.exercises.length; APP.cur._wordRun = {}; renderEx();`);
    assert.ok(arr(bare, '_rendered').includes('progress-card'),
      'nothing captured → the normal progress card, not a blank screen');
  }

  // ── the question is READ ALOUD only when it is a listening question, and only once audio is
  // unlocked. Before the unlock the utterance must be QUEUED, not dropped — a listening question
  // the browser silently refused to speak is a question with no content at all.
  //
  // ⚠️ Built through the real buildExercises rather than by hand: a hand-written `{type:'listen_mcq'}`
  // is missing fields its renderer reads, and the throw that follows would count as "caught" for
  // every mutant while proving nothing.
  {
    const pick = (C, want) => JSON.parse(C.run(
      `JSON.stringify((APP.cur.exercises || []).findIndex(e => ${want}))`));
    const at = (unlocked, want) => {
      const C = client(base);
      C.run(`globalThis._spoken = []; speak = (t) => _spoken.push(t); _ttsUnlocked = ${unlocked};`);
      C.run('startLesson(0)');
      const i = pick(C, want);
      if (i < 0) return null;
      C.run(`_spoken.length = 0; _ttsPendingAfterUnlock = null; APP.cur.cur = ${i}; renderEx();`);
      return { C, target: JSON.parse(C.run(`JSON.stringify(APP.cur.exercises[${i}].target)`)) };
    };
    const LISTEN = "e.type === 'listen_mcq' || e.type === 'listen_type'";
    const READ   = "e.type !== 'listen_mcq' && e.type !== 'listen_type'";

    const on = at(true, LISTEN);
    assert.ok(on, 'the fixture really does produce a listening question (non-vacuity)');
    assert.deepStrictEqual(JSON.parse(on.C.run('JSON.stringify(_spoken)')), [],
      'nothing is spoken synchronously — the render finishes first');
    await settle(500);
    assert.deepStrictEqual(JSON.parse(on.C.run('JSON.stringify(_spoken)')), [on.target],
      'a listening question speaks its target shortly after rendering');

    const off = at(false, LISTEN);
    await settle(500);
    assert.deepStrictEqual(JSON.parse(off.C.run('JSON.stringify(_spoken)')), [],
      'with audio still locked nothing is spoken…');
    assert.strictEqual(off.C.run('_ttsPendingAfterUnlock && _ttsPendingAfterUnlock.text'), off.target,
      '…and the utterance is QUEUED for the unlock instead of being dropped');

    const quiet = at(true, READ);
    assert.ok(quiet, 'the fixture also produces a reading question');
    await settle(500);
    assert.deepStrictEqual(JSON.parse(quiet.C.run('JSON.stringify(_spoken)')), [],
      'a reading question is never read aloud');
  }

  // ── v80_p / §0h: navigating BACK to an answered question restores it, and the button says
  // "continue" rather than offering to check an answer that is already checked.
  {
    const C = client(base);
    C.run(`globalThis._restored = []; _restoreAnswer = (ex, rec) => _restored.push(rec); check = () => {};`);
    C.run('startLesson(0)');
    C.run('APP.cur.cur = 0; APP.cur.ans = [{ sel: "x", correct: true }]; renderEx();');
    assert.strictEqual(JSON.parse(C.run('JSON.stringify(_restored)')).length, 1,
      'an already-answered question is put back the way the learner left it');
    const btn = C.document.getElementById('cbtn');
    assert.strictEqual(btn.disabled, false, 'and its button is live…');
    assert.ok(/cont/.test(btn.className), '…in its continue state, not its check state');

    const fresh = client(base);
    fresh.run(`globalThis._restored = []; _restoreAnswer = (ex, rec) => _restored.push(rec);`);
    fresh.run('startLesson(0)');
    fresh.run('APP.cur.cur = 0; APP.cur.ans = []; renderEx();');
    assert.strictEqual(JSON.parse(fresh.run('JSON.stringify(_restored)')).length, 0,
      'a fresh question restores nothing');
    assert.strictEqual(fresh.document.getElementById('cbtn').disabled, true,
      'and its check button starts disabled');
  }

  // and an ordinary question actually puts something on screen
  {
    const C = client(base);
    C.run('startLesson(0)');
    const area = C.document.getElementById('ex-area');
    assert.ok(area && String(area.innerHTML || '').trim().length > 0,
      'a normal render fills #ex-area — the non-vacuity for everything above: if renderEx wrote ' +
      'nothing at all, every "it did not render" assertion in this section would pass trivially');
    // and the question that got rendered is one of the round's own
    const shown = String(area.innerHTML);
    const targets = JSON.parse(C.run('JSON.stringify(APP.lessonData.lessons[0].vocab.map(v => v.target))'));
    const sources = JSON.parse(C.run('JSON.stringify(APP.lessonData.lessons[0].vocab.map(v => v.source))'));
    assert.ok([...targets, ...sources].some(w => shown.includes(w)) || /ex-badge/.test(shown),
      'and it is built from this lesson, not from an empty template');
  }
}
console.log('  renderEx: a stray review render is a no-op, the end of a round ends it: OK');

console.log('unit-lesson-entry-journey: ALL PASSED');
})();
