// unit-speak-advance.test.js
// v75_h — a correct answer advances when the READ-OUT has finished, not on a stopwatch.
//
// User-reported, two symptoms that turned out to be one defect seen from both ends:
//   • "if solved correctly, we currently jump to the next question before the read-out is finished"
//   • "if the next question starts with a read-out, the read-out is cut short"
// `_speakAndAdvance` armed a FLAT 4-second safety net. Any sentence that takes longer than that to
// speak — which is most long ones at rate 0.9 — hit the net mid-utterance: it advanced, `renderEx`
// auto-spoke the next question, and THAT path's `speechSynthesis.cancel()` truncated the readout
// still in progress. So the second symptom is the first one's consequence: the two utterances were
// overlapping because the first was never allowed to finish.
//
// Speech itself cannot be observed headlessly — there is no speechSynthesis in the harness and the
// real timing is a property of the device. What IS testable, and what this file pins, is the
// POLICY: does the advance wait while the engine reports it is busy? A fake engine drives that
// directly, so the assertions run against elapsed behaviour rather than against the source text.
'use strict';
const assert = require('assert');
const { loadClient } = require('./lib-dom');

const C = loadClient({ quiet: true });

// A fake engine that stays "speaking" for a controllable number of milliseconds and fires the
// utterance's onend when it stops — the shape a real engine presents for a long sentence.
const install = (speakMs, opts) => C.run(`
  globalThis.__log = [];
  globalThis.__fake = { speaking: false, pending: false, cancels: 0, spoke: [] };
  globalThis.speechSynthesis = {
    get speaking(){ return __fake.speaking; },
    get pending(){ return __fake.pending; },
    getVoices: function(){ return [{ name:'V', lang:'de-DE', localService:true }]; },
    cancel: function(){ __fake.cancels++; __fake.speaking = false; },
    speak: function(u){
      __fake.spoke.push(u.text);
      __fake.speaking = true;
      setTimeout(function(){ __fake.speaking = false; if (u.onend) u.onend(); }, ${speakMs});
    },
    addEventListener: function(){}, removeEventListener: function(){},
  };
  globalThis.SpeechSynthesisUtterance = function(t){ this.text = t; };
  _ttsUnlocked = true;
  APP.muted = false;
  APP.lang = 'de'; APP.srcLang = 'en';
  APP.lessonData = { topic:'T', lang:'de', srcLang:'en', lessons:[{ id:'l', type:'standard', vocab:[] }] };
  LANGS = { de: { name:'German', tts:'de-DE' }, en: { name:'English', tts:'en-GB' } };
  APP.cur = { lessonIdx:0, cur:0, exercises:[], correct:0, total:0, mistakes:0, hearts:3,
              streak:0, bestStreak:0 };
  // Observe the advance without dragging the whole render path in: renderEx is what _speakAndAdvance
  // calls after bumping C.cur, and what it does is not this file's subject.
  globalThis.renderEx = function(){ __log.push({ at: Date.now(), cur: APP.cur.cur }); };
  ${opts || ''}
  true;`);

const runAdvance = (text) => C.run(`__t0 = Date.now(); _speakAndAdvance(${JSON.stringify(text)}); true;`);
const state = () => JSON.parse(C.run(`JSON.stringify({
  advanced: __log.length > 0,
  elapsed: __log.length ? __log[0].at - __t0 : null,
  cur: APP.cur.cur, cancels: __fake.cancels, spoke: __fake.spoke })`));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // ── 1. A read-out LONGER than the old 4s net must not be cut off ────────────────────────────
  // 6s of speech: under the old flat `setTimeout(advance, 4000)` this advanced at 4s, mid-sentence.
  {
    install(6000);
    runAdvance('Ein sehr langer Satz, der deutlich länger als vier Sekunden zum Vorlesen braucht.');
    await sleep(4600);
    let s = state();
    // Non-vacuity for the whole section, checked on the state the assertion runs against: the fake
    // must actually be speaking here, or "did not advance" would be true for the wrong reason.
    assert.strictEqual(C.run(`__fake.speaking`), true,
      'the fake engine is still speaking at 4.6s — otherwise this proves nothing about the 4s net');
    assert.strictEqual(s.advanced, false,
      'past the old 4s safety net the round has NOT advanced — the read-out is still running');
    await sleep(2200);
    s = state();
    assert.strictEqual(s.advanced, true, 'and it advances once the read-out actually ends');
    assert.strictEqual(s.cur, 1, 'exactly one question forward');
    assert.ok(s.elapsed > 5500,
      `it waited for the speech (advanced after ${s.elapsed}ms, speech ran 6000ms)`);
  }
  console.log('  a 6s read-out is not cut off at 4s; advance follows the speech: OK');

  // ── 2. Speech that never starts must still advance ──────────────────────────────────────────
  // The net exists because `onend` is not guaranteed. Removing the flat timer must not reintroduce
  // the hang it was there to prevent.
  {
    install(0, `globalThis.speechSynthesis.speak = function(u){ __fake.spoke.push(u.text); };`);
    runAdvance('Ein Satz, der nie gesprochen wird.');
    await sleep(1000);
    assert.strictEqual(state().advanced, false, 'it gives the engine a moment to start');
    await sleep(3600);
    const s = state();
    assert.strictEqual(s.advanced, true,
      'but a read-out that never starts still advances — the learner is never stranded');
    assert.ok(s.spoke.length > 0, 'and it did try to speak (non-vacuity: the path was exercised)');
  }
  console.log('  a read-out that never starts still advances — no hang: OK');

  // ── 3. Nothing in flight → no cancel ────────────────────────────────────────────────────────
  // `cancel()` immediately followed by `speak()` truncates the NEW utterance on several engines.
  // It was being issued unconditionally, including when there was nothing to cancel.
  {
    install(300);
    assert.strictEqual(C.run(`__fake.speaking || __fake.pending`), false,
      'nothing is in flight before the call (the precondition this section is about)');
    runAdvance('Kurz.');
    await sleep(900);
    const s = state();
    assert.strictEqual(s.cancels, 0,
      'with nothing in flight the engine is not cancelled — an unconditional cancel() right before ' +
      'speak() is what truncated the next question\'s read-out');
    assert.strictEqual(s.advanced, true, 'and it still advances');
  }
  console.log('  no cancel() when nothing is in flight: OK');

  // ── 4. Something IS in flight → cancel first, then speak ────────────────────────────────────
  // The conditional must not become "never cancel": an overlapping utterance has to be stopped.
  {
    install(3000);
    C.run(`speechSynthesis.speak({ text:'vorher' }); true;`);
    assert.strictEqual(C.run(`__fake.speaking`), true, 'a previous utterance really is in flight');
    runAdvance('Danach.');
    await sleep(400);
    assert.ok(state().cancels >= 1, 'an in-flight utterance IS cancelled before the new one');
  }
  console.log('  an in-flight utterance is still cancelled: OK');

  // ── 5. Long text is chunked through the shared path ─────────────────────────────────────────
  // The old code built ONE utterance from the whole string and ignored `_ttsChunks`, whose 200-char
  // cap exists because browsers drop over-long utterances outright.
  {
    install(50);
    const long = ('Dies ist ein Satz. ').repeat(30);   // ~540 chars
    assert.ok(long.length > 200, 'the fixture really does exceed the chunker\'s 200-char limit');
    runAdvance(long);
    await sleep(1600);
    const s = state();
    assert.ok(s.spoke.length > 1,
      `long text is split into chunks (got ${s.spoke.length}) rather than spoken as one utterance`);
    s.spoke.forEach(c => assert.ok(c.length <= 200 + 40, 'each chunk stays near the 200-char limit'));
    assert.strictEqual(s.advanced, true, 'and it advances after the LAST chunk');
  }
  console.log('  long text is chunked, and advance waits for the last chunk: OK');

  // ── 6. No voice for the language → refuse to speak, but STILL advance ───────────────────────
  // v55_x: an English voice spelling out "Mtu" as "M t u" is worse than silence, so the resolver
  // refuses. But a refusal must not strand the learner on a silent listening item. That claim was
  // pinned only in source, by a regex matching the literal `if (!u) {` — the spelling of the
  // refusal rather than the claim — which broke on an inlined variable while the behaviour was
  // unchanged. Asserted here against a running engine instead.
  {
    // An engine whose ONLY voice is for a different language. `_ttsPickVoice` returns null (voices
    // ARE loaded, nothing matches), which is the refusal — distinct from undefined/still-loading.
    install(300, `globalThis.speechSynthesis.getVoices = function(){
                    return [{ name:'EN', lang:'en-GB', localService:true }]; };
                  APP.lang = 'sw';
                  APP.lessonData = { topic:'T', lang:'sw', srcLang:'en',
                                     lessons:[{ id:'l', type:'standard', vocab:[] }] };
                  LANGS = { sw: { name:'Swahili', tts:'sw-KE' }, en: { name:'English', tts:'en-GB' } };`);
    // Non-vacuity, on the state the assertion runs against: this must really BE the refusal case,
    // or "it advanced" would just be the ordinary spoken path passing under a different name.
    assert.strictEqual(C.run(`_ttsPickVoice('sw-KE')`), null,
      'the engine genuinely has no Swahili voice — the refusal branch, not the normal one');
    runAdvance('Mtu');
    await sleep(1400);
    const s = state();
    assert.strictEqual(s.spoke.length, 0,
      'nothing was spoken — an English voice must not approximate Swahili (v55_x)');
    assert.strictEqual(s.advanced, true,
      'but the round still advances — a refusal must not hang a listening exercise');
    assert.strictEqual(s.cur, 1, 'exactly one question forward');
  }
  console.log('  no voice for the language: silent, and still advances: OK');

  console.log('unit-speak-advance: ALL PASSED');
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
