// unit-paste-story-generate.test.js — v91_h.
//
// ⚠️ THE BUG, user-reported with a four-screenshot click series: *"Here I just clicked through with
// the goal to generate lessons from the pasted text, but on the last click on the lesson selection
// page, it just returned to the 'my story' page."* — *"Apparently, I currently can't generate text
// from pasted stories."*
//
// `v90_s`'s one-input router fills `#user-story-input` when the learner picks "it's a story", and
// deliberately leaves `#topic-input` alone — only the 'llm' (topic) branch of `genChooseKind` sets
// it. `doGenerate`'s topic guard then read the empty `#topic-input`, called `_genWizardGoto(2)` and
// focused a field that is `display:none` in story mode. Measured before the fix:
//     topicInput:""  storyLen:299  bounced:[2]  toasts:[]  requests:0
// **No toast, no request, no reason.** The wizard simply jumped back to the text step. A silent
// dead end is the worst failure shape there is: nothing to search for, nothing to report.
//
// ⚠️⚠️ WHY THE SUITE WAS GREEN THROUGHOUT. `e2e-userprompt` covers story-mode generation and passes
// — because it posts `topic: 'kitty tale'` ALONGSIDE `userStory`. It tests the API CONTRACT, not the
// request the wizard actually builds. **The flow had no test at any layer**, so a client router
// change (`v90_s`, 2026-09-08) broke it for three weeks without a single red check. That is the
// gap this file closes: it drives the real handlers, not a hand-built request.
//
// ⚠️ THE SERVER HALF IS NOT HERE, and that is deliberate. `/api/generate` independently answered
// `400 Topic too short or missing` for the same request, so the bug needed BOTH fixes; asserting the
// server's behaviour needs a booted server, so it lives in `e2e-userprompt.test.js` beside the
// story-mode case it belongs with. Pinning it here as a source regex would be a text guard for a
// behavioural claim — the thing this project has been bitten by repeatedly.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const STORY = 'La biografia personale e professionale di Giorgio Moroder è straordinaria. '.repeat(4).trim();

// A client with the network, the toasts and the wizard navigation all observable.
function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang='it'; APP.srcLang='de';
    APP.difficulty = 2; APP.lessonFormat = 'standard'; APP.numChapters = 1; APP.activeJob = null;
    APP.progress = { completed:{}, learned:{} };
    window.__fetches = []; window.__toasts = []; window.__goto = []; window.__alerts = [];
    window.fetch = function(u, o){ window.__fetches.push({ u: String(u), body: o && o.body });
      return Promise.resolve({ ok:true, status:202, json:function(){ return Promise.resolve({ jobId:'j1' }); } }); };
    showToast = function(m){ window.__toasts.push(String(m)); };
    window.alert = function(m){ window.__alerts.push(String(m)); };
    _genWizardGoto = function(n){ window.__goto.push(n); };
    // ⚠️ A SUBMIT that succeeds keeps going: the resolved fetch drives the post-generation chrome,
    // which walks the library list. Without this the file PRINTS ITS RESULTS AND THEN THROWS
    // (\`saved.map is not a function\`) from an async continuation — green output, non-zero exit,
    // exactly the \`v89\` rule-16 shape. Seeded here rather than swallowed, so a real error in that
    // path would still surface.
    saved = [];
    true;`, 'seed');
  return C;
}
// Drive the REAL router + the REAL submit handler, exactly as the four screenshots did.
const run = (C, kind, text) => JSON.parse(C.run(`
  document.getElementById('gen-input').value = ${JSON.stringify('')} + ${JSON.stringify(text)};
  genChooseKind(${JSON.stringify(kind)});
  try { doGenerate(); } catch (e) { window.__threw = String(e && e.message || e); }
  JSON.stringify({ topicInput: document.getElementById('topic-input').value,
                   storyLen: (document.getElementById('user-story-input')||{}).value.length || 0,
                   goto: window.__goto, toasts: window.__toasts, alerts: window.__alerts,
                   fetches: window.__fetches.length,
                   body: (window.__fetches[0]||{}).body || null })`, 'go'));

// ── 1. ⭐ A PASTED STORY GENERATES — no typed topic, no bounce ─────────────────────────────────
// The whole defect in one assertion.
{
  const r = run(client(), 'story', STORY);
  assert.strictEqual(r.storyLen > 0, true, 'non-vacuity: the router really did load the story box');
  assert.strictEqual(r.topicInput, '',
    'non-vacuity: #topic-input is still EMPTY in story mode — if the router ever starts filling it, ' +
    'this test stops covering the reported bug and must be rewritten, not deleted');
  assert.deepStrictEqual(r.goto, [],
    '⚠️ THE REPORTED BUG: generating from a pasted story must NOT send the learner back to the text ' +
    'step. It bounced to step ' + JSON.stringify(r.goto) + ' with no toast and no request.');
  assert.strictEqual(r.fetches, 1,
    '⚠️ …and it must actually SUBMIT. Not bouncing is worthless if the request is still never sent.');
  const body = JSON.parse(r.body || '{}');
  assert.ok(String(body.userStory || '').length >= 20, 'the request carries the pasted story');
}
console.log('  a pasted story generates with no typed topic, and does not bounce: OK');

// ── 2. ⚠️ NON-VACUITY: the topic guard STILL FIRES when it should ──────────────────────────────
// §1 alone is satisfied by deleting the guard outright, which would let an empty TOPIC run start a
// pointless long generation — the exact thing the guard was written to prevent.
{
  const r = run(client(), 'llm', 'x');          // topic mode, one character — too short
  assert.deepStrictEqual(r.goto, [2],
    '⚠️ an empty/too-short TOPIC must still bounce to the text step — the fix exempts story mode ' +
    'only. If this goes green the guard has been removed rather than narrowed.');
  assert.strictEqual(r.fetches, 0, 'and must not submit');
}
console.log('  a too-short TOPIC still bounces, so the guard was narrowed and not deleted: OK');

// ── 3. A too-short STORY is REFUSED WITH A REASON, not bounced ─────────────────────────────────
// ⚠️ This is why the fix keys on STORY MODE and not on "the story is long enough". Had it keyed on
// length, a short story would fall back into the topic guard and hit the same silent dead end —
// bounced to step 2 with a hidden field focused. The dedicated story guard says what is wrong.
{
  const r = run(client(), 'story', 'troppo corto');     // < 20 chars
  assert.deepStrictEqual(r.goto, [], 'a short story must not bounce to the text step either');
  assert.strictEqual(r.fetches, 0, 'and must not submit a story the server would reject');
  assert.ok(r.alerts.length === 1 && /story/i.test(r.alerts[0]),
    '⚠️ it must SAY so — a refusal the learner cannot see is the bug being fixed, in miniature. ' +
    'Got: ' + JSON.stringify(r.alerts));
}
console.log('  a too-short story is refused with a visible reason, not a silent bounce: OK');

console.log('unit-paste-story-generate: ALL PASSED');

// ⚠️ EXPLICIT: the stubbed fetch resolves, so an async continuation is still queued when the last
// assertion passes. `v89` rule 16 — a file that prints its results and then hangs or throws is a
// file whose result nobody can trust. Exit on our own terms.
process.exit(0);
