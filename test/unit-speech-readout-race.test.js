// unit-speech-readout-race.test.js — v89_x.
//
// ⚠️ USER-REPORTED, and exactly right: "for listen-type question the automatic read-out IS the
// correct answer, and if speech input is active, it seems the app answers the question itself via
// the readout of the correct answer being recognized by the speech input."
//
// It did. `renderEx` calls `_speechMicRefresh()` and only THEN queues the readout, so the mic was
// already listening when the app spoke `ex.target` — which for `listen_type` IS the answer. The
// question answered itself.
//
// The fix waits for the engine to fall quiet. Polled rather than chained to a TTS callback, because
// the readout is started by renderEx on its own timer and can be re-queued by the unlock path — a
// poll observes the ENGINE, whoever started it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function open(extra) {
  const C = loadClient({ quiet: true });
  C.run(`UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.micMuted = false;
    APP.lang='de'; APP.srcLang='en'; APP.lessonData={lang:'de',srcLang:'en'};
    window.__started = [];
    _speechStartSession = function(gen, cfg){ window.__started.push({ gen: gen, kind: cfg && cfg.kind }); };
    // A controllable TTS engine: the test drives speaking/pending by hand.
    globalThis.speechSynthesis = { speaking:false, pending:false, getVoices:function(){return [];},
      cancel:function(){}, speak:function(){}, addEventListener:function(){}, removeEventListener:function(){} };
    ${extra || ''}
    true;`, 'open');
  return C;
}
const started = (C) => JSON.parse(C.run(`JSON.stringify(window.__started)`));
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {

// ── 1. The predicate is shared, so renderEx and the mic cannot drift ───────────────────────────
{
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(/function _exAutoSpeaks\(ex\)/.test(src), 'there is ONE predicate for "this question reads out"');
  assert.ok(/if\(_exAutoSpeaks\(ex\)\) _speakTimeout = setTimeout/.test(src),
    'renderEx uses it to DO the readout');
  assert.ok(/if\(!_exAutoSpeaks\(ex\) \|\| !ss\)\{ _speechStartSession/.test(src),
    'and the mic uses the SAME one to decide whether to wait — a second copy would drift silently');
  // ⚠️ THE WIRING, and it was missing until a mutation said so: every section below drives
  // `_speechStartWhenQuiet` DIRECTLY, so reverting `_speechMicRefresh` to call `_speechStartSession`
  // — i.e. restoring the reported bug in full — left them all green. The behaviour is only reachable
  // through this one call site.
  assert.ok(/if\(cfg && !APP\.micMuted\) _speechStartWhenQuiet\(gen, cfg, ex\)/.test(src),
    '_speechMicRefresh opens the mic through the WAIT, not directly — this is the fix\'s only entry point');
  assert.ok(!/if\(cfg && !APP\.micMuted\) _speechStartSession\(/.test(src),
    'and never bypasses it');
  const C = open();
  for (const t of ['listen_type', 'listen_mcq']) {
    assert.strictEqual(C.run(`_exAutoSpeaks({type:${JSON.stringify(t)}})`), true, t + ' reads out');
  }
  for (const t of ['mcq_target_source', 'syn_select', 'type_plural', 'order']) {
    assert.strictEqual(C.run(`_exAutoSpeaks({type:${JSON.stringify(t)}})`), false, t + ' does not');
  }
  assert.strictEqual(C.run(`_exAutoSpeaks(null)`), false, 'and neither does nothing');
}
console.log('  one shared "does this read out?" predicate, used by both the readout and the mic: OK');

// ── 2. A question with NO readout opens the mic immediately ────────────────────────────────────
// ⚠️ Non-negotiable: waiting on every question would add a delay to the majority that never speak.
{
  const C = open();
  C.run(`_speechStartWhenQuiet(_speechGen, {kind:'mcq'}, {type:'mcq_target_source'}); true;`);
  assert.strictEqual(started(C).length, 1, 'a non-speaking question starts listening at once, synchronously');
}
console.log('  a question with no readout opens the mic immediately, with no delay: OK');

// ── 3. ⚠️ THE BUG: a reading question must NOT open the mic while the app is talking ───────────
{
  const C = open();
  C.run(`speechSynthesis.speaking = true;
         _speechStartWhenQuiet(_speechGen, {kind:'type'}, {type:'listen_type'}); true;`);
  assert.strictEqual(started(C).length, 0, 'nothing starts synchronously');
  await wait(500);
  assert.strictEqual(started(C).length, 0,
    '⚠️ and nothing starts while the engine is still speaking — this is the report');
  C.run(`speechSynthesis.speaking = false; true;`);          // the readout finishes
  await wait(400);
  assert.strictEqual(started(C).length, 1, 'the session opens once the app has stopped talking');
  assert.strictEqual(started(C)[0].kind, 'type', 'with the config it was given');
}
console.log('  a reading question opens the mic only after the readout finishes: OK');

// ── 4. `pending` counts as talking — a queued utterance has not been spoken yet ────────────────
{
  const C = open();
  C.run(`speechSynthesis.pending = true;
         _speechStartWhenQuiet(_speechGen, {kind:'type'}, {type:'listen_type'}); true;`);
  await wait(500);
  assert.strictEqual(started(C).length, 0, 'a QUEUED utterance also holds the mic shut');
  C.run(`speechSynthesis.pending = false; true;`);
  await wait(400);
  assert.strictEqual(started(C).length, 1, 'and releases it when the queue drains');
}
console.log('  a queued-but-unspoken utterance holds the mic shut too: OK');

// ── 5. Speech that never starts must not shut the mic forever ──────────────────────────────────
// Muted, no voice for the language, TTS not yet unlocked — all real, all common. The grace elapses
// and the mic opens anyway.
{
  const C = open();
  C.run(`_speechStartWhenQuiet(_speechGen, {kind:'type'}, {type:'listen_type'}); true;`);
  await wait(300);
  assert.strictEqual(started(C).length, 0, 'it does wait a little, in case the readout is about to begin');
  await wait(1600);
  assert.strictEqual(started(C).length, 1,
    'but a readout that never starts releases the mic after the grace — it must not be shut forever');
}
console.log('  a readout that never starts releases the mic after the grace period: OK');

// ── 6. ⚠️ A question change or a mute abandons the wait ────────────────────────────────────────
// Otherwise a pending timer opens a session into a question the learner already left — which is
// precisely the stale-session hazard `_speechHandlePhrase`'s generation check exists for.
// ⚠️ The wait here MUST outlast the start-grace. The first version waited 500ms — less than the
// 1500ms grace — so removing the guard entirely left this green: the unguarded version had not
// reached its own start point yet either. Found by the mutation.
{
  const C = open();
  C.run(`_speechStartWhenQuiet(_speechGen, {kind:'type'}, {type:'listen_type'});
         _speechGen++;                       // the learner moved to the next question
         true;`);
  await wait(1900);
  assert.strictEqual(started(C).length, 0,
    'a stale generation never opens a session — even after the grace has fully elapsed');

  const C2 = open();
  C2.run(`_speechStartWhenQuiet(_speechGen, {kind:'type'}, {type:'listen_type'});
          APP.micMuted = true;
          true;`);
  await wait(1900);
  assert.strictEqual(started(C2).length, 0, 'and neither does a mic muted while the wait was pending');
}
console.log('  a question change or a mute during the wait abandons it: OK');

// ── 7. The "didn't catch that" toast is gone ───────────────────────────────────────────────────
// ⚠️ User: "the pill appears too often; we can remove the pill, since it's obvious that a correct
// answer wasn't recognized." It fired on every non-matching phrase — i.e. on background noise.
{
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(!/showToast\(t\('ex\.mic_no_match'\)\)/.test(src),
    'no code path toasts the didn-not-catch-that message any more');
  // What REMAINS is the informative half — asserted, so a later cleanup does not take it too.
  // ⚠️ ALL THREE sites, not one: the first version pinned only the `hit ?` shape, so removing the
  // `said ?` one (the typed-answer path) stayed green. Counted, so losing any of them fails.
  const heardSites = (src.match(/_micShowHeard\(alts\[0\], \w+ \? 'match' : 'bad'\)/g) || []).length;
  assert.strictEqual(heardSites, 3,
    `the heard WORD is still shown on all three answer paths (found ${heardSites}) — that is the ` +
    'informative half, and it must not be swept away with the apology');
  assert.ok(/inp\.value = alts\[0\]; onType\(\);/.test(src),
    'and a typed answer still receives the heard text, visible and editable');
  // ⚠️ The key stays: it is hand-translated into five languages.
  assert.ok(typeof UI.en['ex.mic_no_match'] === 'string',
    'ex.mic_no_match remains in ui.json — deleting it would throw away five hand-written translations');
}
console.log('  the didn-not-catch-that toast is gone; the heard word and the filled input remain: OK');

console.log('unit-speech-readout-race: ALL PASSED');
}
main().catch(e => { console.error(e); process.exit(1); });
