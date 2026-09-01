// unit-word-tap-speech-race.test.js
// v85_s — user-reported: tapping a highlighted word on the progress card to jump to a question
// about it often played the SPEECH for a DIFFERENT question; the next interaction was fine.
//
// Root cause (see roadmap_v85.md's "REPORTED AT THE v85_r CUT" §B for the full diagnosis chain):
// tapWord() calls showLesson(), whose startLesson() unconditionally renders exercise 0 first, then
// tapWord() itself corrects onto the word's REAL question with a SECOND, synchronous renderEx() call.
// Each renderEx() for a listen_mcq/listen_type exercise queues its own 350ms auto-speak setTimeout —
// and nothing cancelled the FIRST one before the second was scheduled, so two timers raced to
// speak() on the same shared TTS output.
//
// This file drives renderEx() directly (not the whole tapWord()/showLesson() chain) because the
// race lives entirely inside renderEx()'s own timeout bookkeeping — reproducing the two synchronous
// calls it actually gets is enough to prove the fix without dragging in word/lesson resolution.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`
    LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    // A fake engine — this harness has no real speechSynthesis — that just records what it was
    // asked to say. The claim under test is "how many times, and with what text", not real audio.
    globalThis.__spoken = [];
    globalThis.speechSynthesis = {
      speaking: false, pending: false,
      getVoices: function(){ return [{ name:'DE', lang:'de-DE', localService:true }]; },
      cancel: function(){}, speak: function(u){ __spoken.push(u.text); },
      addEventListener: function(){}, removeEventListener: function(){},
    };
    globalThis.SpeechSynthesisUtterance = function(t){ this.text = t; };
    _ttsUnlocked = true;
    APP.muted = false;
    APP.lang = 'de'; APP.srcLang = 'en';
    APP.lessonData = { topic:'T', lang:'de', srcLang:'en', lessons:[{ id:'l', type:'standard', vocab:[] }] };
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP.cur = {
      lessonIdx:0, cur:0, correct:0, total:0, mistakes:0, hearts:3, streak:0, bestStreak:0,
      answered:false, sel:null, placed:[], usedIdx:[], ans:[],
      exercises: [
        { type:'listen_mcq', target:'FALSCH', pron:null, choices:['FALSCH','x','y','z'] },
        { type:'listen_mcq', target:'RICHTIG', pron:null, choices:['RICHTIG','x','y','z'] },
      ],
    };
    true;`, 'setup');
  return C;
}

(async () => {
  // ── 1. The exact double-render shape tapWord() produces ──────────────────────────────────────
  {
    const C = client();
    // startLesson()'s own initial render — exercise 0 ("FALSCH").
    C.run('renderEx(); true;', 'render-0');
    // tapWord()'s correction, right away, in the same synchronous pass — exercise 1 ("RICHTIG").
    C.run('APP.cur.cur = 1; renderEx(); true;', 'render-1');
    await sleep(450);   // both 350ms timers, if both survived, would have fired by now
    const spoken = JSON.parse(C.run('JSON.stringify(__spoken)'));
    assert.strictEqual(spoken.length, 1,
      `exactly one utterance should reach the engine, not one per render (got ${spoken.length}: ${JSON.stringify(spoken)})`);
    // 'Richtig', not 'RICHTIG': item AW (v88_b) title-cases runs of 4+ capitals on the way into the
    // utterance, so an all-caps word is spoken rather than spelled out. This file's own claim is
    // WHICH question is spoken (the second, not the stale first) and how many times — both
    // untouched. The fixture's placeholders happen to be all-caps, so leaving them that way is free
    // confirmation that AW's transform reaches the listen_mcq auto-speak path as well.
    assert.strictEqual(spoken[0], 'Richtig',
      'the ONE utterance spoken is the CURRENT (second) question\'s text, not the first render\'s stale one');
  }
  console.log('  two synchronous renderEx() calls (the tapWord() shape): only the LATEST question is spoken');

  // ── 2. Non-vacuity: a single renderEx() call still speaks normally ────────────────────────────
  // Guards against a fix that accidentally suppresses the FIRST call ever made, rather than only a
  // stale one superseded by a later render.
  {
    const C = client();
    C.run('renderEx(); true;', 'render-single');
    await sleep(450);
    const spoken = JSON.parse(C.run('JSON.stringify(__spoken)'));
    assert.strictEqual(spoken.length, 1, 'a single render still produces exactly one utterance');
    assert.strictEqual(spoken[0], 'Falsch', 'and it is that render\'s own question');   // title-cased by item AW, see case 1's note
  }
  console.log('  a single renderEx() call: unaffected, still speaks its own question');

  // ── 3. A listen-type render followed by a NON-listen render cancels the pending speech too ────
  // The fix cancels unconditionally at the top of renderEx(), not only inside the listen-type
  // branch — this is what makes it also cover a listen → non-listen double-render, not just
  // listen → listen. Non-vacuity for that generalisation, not exercised by case 1.
  {
    const C = client();
    C.run(`APP.cur.exercises[1] = { type:'mcq_target_source', target:'RICHTIG', choices:['a','b','c','d'] }; true;`);
    C.run('renderEx(); true;', 'render-0');
    C.run('APP.cur.cur = 1; renderEx(); true;', 'render-1-nonlisten');
    await sleep(450);
    const spoken = JSON.parse(C.run('JSON.stringify(__spoken)'));
    assert.strictEqual(spoken.length, 0,
      'the first render\'s pending speech is cancelled even though the SECOND render is not a listen type');
  }
  console.log('  listen-type render superseded by a non-listen render: the stale speech is cancelled too');

  console.log('unit-word-tap-speech-race: ALL PASSED');
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
