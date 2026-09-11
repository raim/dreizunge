// unit-tutor-queued-turn.test.js — v90_z. The tutor dropped ~1 in 5 questions, silently.
//
// ⚠️ THE REPORT, AND WHAT MEASURING IT ACTUALLY SHOWED.
// User: "the tutor job did appear in the job popover, but I never received a reply or a console
// message about a failure, time-out etc. ... You will find several unanswered questions."
// Counted in the user's own `learners.json` → `users.raim.state.tutorThread`: 6 of 33 student turns
// got no `tutor` reply (18%), the last THREE consecutive, and one question asked three times.
// FOUR of the six are `tutor.sel_meaning_q` turns — the text-selection path, not a random spread.
//
// The mechanism, reproduced in this harness before anything was changed: `_storySelExplain` and
// `askTutorAboutQuestion` PUSH the student turn (which `_tutorSaveThread` persists to localStorage
// and `_learnerSyncSoon` syncs into `learners.json` — which is why the question is visible there)
// and THEN call `_tutorSend`, whose first line was `if(_tutorState.busy) return;`. A question asked
// while the previous reply was still streaming was therefore stored and never sent, with no toast,
// no console line and no error. On a 35B reasoning model one reply is minutes long, which is the
// whole of "the last three are consecutive".
//
// ⚠️ "The job appeared in the job popover" proves LESS than it looks: the tutor entry there is
// SYNTHETIC, rendered purely off `_tutorState.busy` (see `_jobsUpdateBadgeAndList`'s own comment —
// POST /api/tutor is stateless and not in the server's job store at all). It says `_tutorSend`
// started; it says nothing about any request reaching the server.
//
// ⚠️ WHY THIS DRIVES THE REAL FUNCTIONS AND NOT A SOURCE REGEX. `v89` rule 12 / `v88`'s fourth
// lesson: a guard that pins source text for a claim about BEHAVIOUR cannot fail when the behaviour
// is wrong. The claim here is "the question is eventually SENT", and the only place that is
// observable is the fetch body.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// A client whose `fetch` records every request body and hands back a resolver per call, so a test
// controls exactly WHEN each reply lands — the ordering is the entire subject here.
function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP.lessonData = null; APP.lang = 'it'; APP.srcLang = 'de';
    window.__sent = []; window.__resolvers = []; window.__toasts = [];
    showToast = function(m){ window.__toasts.push(String(m)); };
    fetch = function(u, o){
      window.__sent.push(JSON.parse(o.body));
      return new Promise(function(res){ window.__resolvers.push(function(reply){
        res({ ok:true, headers:{ get:function(){ return 'application/json'; } },
              json:function(){ return Promise.resolve(reply === null ? {} : { reply: reply }); } }); }); });
    };
    _tutorState.history = [{ role:'student', text:'earlier' }, { role:'tutor', text:'earlier reply' }];
    _tutorState.open = true; _tutorState.busy = false; _tutorPending = false;
    true;`, 'seed');
  return C;
}
const peek = (C) => JSON.parse(C.run(`JSON.stringify({
  hist: _tutorState.history.length, sends: window.__sent.length, pending: _tutorPending,
  busy: _tutorState.busy, toasts: window.__toasts.length,
  lastSentTurns: (window.__sent.slice(-1)[0] || { history: [] }).history.length })`, 'peek'));
const tick = () => new Promise(r => setTimeout(r, 40));

(async () => {
  // ── 1. EVERY caller that stores a student turn eventually sends it ──────────────────────────
  // The payload assertion of the whole change, and the one the old code fails: with the bare
  // `return`, `sends` stays at 1 forever while the thread grows.
  {
    const C = client();
    C.run(`_storySelText = 'in fila indiana'; _storySelExplain('meaning'); true;`, 'q1');
    let st = peek(C);
    assert.strictEqual(st.sends, 1, 'the first question goes out immediately');
    assert.strictEqual(st.busy, true);

    C.run(`_storySelText = 'De stekker zit er weer in.'; _storySelExplain('meaning'); true;`, 'q2');
    C.run(`APP.cur = { exercises:[{ type:'vocab', source:'x', target:'y' }], cur:0, answered:false };
           askTutorAboutQuestion(); true;`, 'q3');
    st = peek(C);
    assert.strictEqual(st.hist, 5, 'both turns asked while busy are in the thread — the learner can see them');
    assert.strictEqual(st.sends, 1, 'and neither has gone out yet, because a reply is still in flight');
    assert.strictEqual(st.pending, true, 'they are REMEMBERED — this flag is what used to not exist');

    C.run(`window.__resolvers[0]('answer to the first'); true;`, 'r1');
    await tick();
    st = peek(C);
    assert.strictEqual(st.sends, 2, '⚠️ the queued question IS sent once the first reply lands — it used to be lost forever');
    assert.strictEqual(st.pending, false, 'and the queue is cleared, not left armed');
    assert.strictEqual(st.lastSentTurns, 6,
      'the send carries the WHOLE history, so both queued questions travel in it — two turns collapse into one call');

    C.run(`window.__resolvers[1]('answer to the queued turn'); true;`, 'r2');
    await tick();
    const roles = C.run(`_tutorState.history.map(function(m){ return m.role; }).join(',')`, 'roles');
    assert.strictEqual(roles, 'student,tutor,student,student,student,tutor,tutor',
      'every student turn in the thread is followed by a reply — no question is left unanswered');
    assert.strictEqual(peek(C).busy, false, 'and the widget is idle again, not stuck busy');
  }
  console.log('  a question asked while the tutor is still answering is queued and sent, never silently dropped: OK');

  // ── 2. Exactly ONE extra call, not one per queued turn ──────────────────────────────────────
  // The collapse is deliberate: /api/tutor is given the whole transcript, so N queued turns are one
  // send. A queue that fired per turn would send the same transcript N times and get N replies.
  {
    const C = client();
    C.run(`_storySelText = 'a'; _storySelExplain('meaning');
           _storySelText = 'b'; _storySelExplain('meaning');
           _storySelText = 'c'; _storySelExplain('meaning');
           _storySelText = 'd'; _storySelExplain('meaning'); true;`, 'burst');
    assert.strictEqual(peek(C).sends, 1);
    C.run(`window.__resolvers[0]('first'); true;`, 'r1'); await tick();
    assert.strictEqual(peek(C).sends, 2, 'three turns queued during one reply produce ONE follow-up call, not three');
    C.run(`window.__resolvers[1]('second'); true;`, 'r2'); await tick();
    assert.strictEqual(peek(C).sends, 2, 'and the queue does not re-arm itself afterwards');
    assert.strictEqual(peek(C).busy, false);
  }
  console.log('  several turns queued during one reply collapse into a single follow-up call: OK');

  // ── 3. The typed path is unchanged — it never stored an unsendable turn ─────────────────────
  // `sendTutorMessage` checks `busy` BEFORE pushing (and the input is disabled meanwhile), so it was
  // never part of this defect. Guarded so a "fix" here cannot quietly change it into one.
  {
    const C = client();
    C.run(`_storySelText = 'x'; _storySelExplain('meaning'); true;`, 'q1');
    const before = peek(C);
    C.run(`document.getElementById('tutor-widget-input').value = 'le agnolotto'; sendTutorMessage(); true;`, 'typed');
    const after = peek(C);
    assert.strictEqual(after.hist, before.hist, 'a typed message while busy is NOT stored — it is refused at the input');
    assert.strictEqual(after.pending, false, 'and it does not arm the queue either, since nothing was stored to send');
  }
  console.log('  the typed path still refuses at the input rather than storing an unsendable turn: OK');

  // ── 4. A stream that ends with NOTHING is no longer silent ──────────────────────────────────
  // The second silent path, and the one that fits the two TYPED questions in the user's thread that
  // got no reply: `_tutorReadStream` finishing with no `done` frame, no `error` frame and an empty
  // buffer pushed nothing and said nothing. `tutor.failed` already existed — no new key.
  {
    const C = client();
    C.run(`window.__toasts = [];
      var _empty = { getReader: function(){ return { read: function(){ return Promise.resolve({ done:true }); } }; } };
      window.__p = _tutorReadStream(_empty); true;`, 'emptystream');
    await tick();
    const st = peek(C);
    assert.strictEqual(st.toasts, 1, 'a stream that delivers nothing at all reports a failure instead of saying nothing');
    const msg = C.run(`window.__toasts[0]`, 'toast');
    assert.strictEqual(msg, UI.en['tutor.failed'], 'it uses the EXISTING tutor.failed string — this fix costs no ui.json key');
  }
  console.log('  a stream that ends with no reply and no error frame now surfaces tutor.failed: OK');

  // ── 5. A stream that DID deliver text is not reported as a failure ──────────────────────────
  // Non-vacuity for §4: a toast on every stream would satisfy §4 and be a worse bug.
  {
    const C = client();
    C.run(`window.__toasts = [];
      var _enc = new TextEncoder();
      var _chunks = [_enc.encode('data: ' + JSON.stringify({ delta:'Ciao' }) + '\\n\\n')];
      var _i = 0;
      var _body = { getReader: function(){ return { read: function(){
        return Promise.resolve(_i < _chunks.length
          ? { done:false, value:_chunks[_i++] } : { done:true }); } }; } };
      window.__p = _tutorReadStream(_body); true;`, 'partial');
    await tick();
    assert.strictEqual(peek(C).toasts, 0, 'a stream that delivered text is kept, not reported as a failure');
    const last = C.run(`(_tutorState.history.slice(-1)[0] || {}).text || ''`, 'last');
    assert.strictEqual(last, 'Ciao', 'and what arrived is kept in the thread — the pre-existing salvage behaviour');
  }
  console.log('  a stream that delivered text is kept and NOT reported as a failure: OK');

  console.log('unit-tutor-queued-turn: ALL PASSED');
})().catch(e => { console.error('unit-tutor-queued-turn FAILED:', e.message); process.exit(1); });
