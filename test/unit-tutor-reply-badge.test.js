// unit-tutor-reply-badge.test.js
// v84_g — "if an answer arrives [while the tutor widget is closed], the tutor could give a sign,
// like a speech bubble" (user request, following a question about whether a tutor request keeps
// running after the widget is closed with ×: it does — closing is a pure CSS toggle, nothing aborts
// the in-flight fetch/stream, see `refreshTutorAvailability`). Contract under test:
//   • A reply landing while the widget is OPEN never sets the badge (the learner already saw it).
//   • A reply landing while the widget is CLOSED shows a speech-bubble badge above the fab, and sets
//     `_tutorState.unread`.
//   • Reopening the widget (toggleTutorWidget) clears both the badge and the flag — and ONLY that;
//     nothing else (a screen change, a timer) is what clears it.
//   • The badge is real markup inside #tutor-fab, wired to reopen the tutor on its own click.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// ── 1. Markup: the badge exists inside #tutor-fab, starts hidden, reopens the tutor ──
{
  const fabAt = html.indexOf('id="tutor-fab"');
  assert.ok(fabAt >= 0, '#tutor-fab exists');
  const fabBlock = html.slice(fabAt, html.indexOf('</div>', html.indexOf('</div>', fabAt) + 1) + 6);
  assert.ok(/id="tutor-fab-badge"/.test(fabBlock), 'the badge lives inside #tutor-fab');
  assert.ok(/id="tutor-fab-badge"[^>]*display:\s*none/.test(fabBlock), 'the badge starts hidden');
  assert.ok(/id="tutor-fab-badge"[^>]*onclick="toggleTutorWidget\(\)"/.test(fabBlock),
    'tapping the badge itself reopens the tutor, same as the fab button');
}
console.log('  markup: badge lives inside #tutor-fab, starts hidden, reopens on tap: OK');

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP.lessonData = null; APP.lang='de'; APP.srcLang='en';
    _tutorApplyLabels();   // real markup would have this run at init; the badge's TEXT depends on it
    true;`, 'seed');
  return C;
}
const jsonReply = (text) => `fetch = function(){ return Promise.resolve({ ok:true,
  headers:{ get:function(){ return 'application/json'; } },
  json:function(){ return Promise.resolve({ reply:${JSON.stringify(text)} }); } }); };`;

(async () => {

// ── 2. A reply landing while OPEN never sets the badge ────────────────────────
{
  const C = client();
  C.run(`${jsonReply('Hallo!')} _tutorState.open = true;`);
  await C.run(`_tutorSend(false)`);
  const r = C.run(`({ unread: _tutorState.unread,
    display: document.getElementById('tutor-fab-badge').style.display })`);
  assert.strictEqual(r.unread, false, 'no unread flag while the widget was open to see the reply live');
  assert.notStrictEqual(r.display, 'block', 'the badge is not shown while open');
}
console.log('  a reply while OPEN never raises the badge: OK');

// ── 3. A reply landing while CLOSED raises the badge and the flag ─────────────
{
  const C = client();
  C.run(`${jsonReply('Guten Tag!')} _tutorState.open = false;`);
  await C.run(`_tutorSend(false)`);
  const r = C.run(`({ unread: _tutorState.unread,
    display: document.getElementById('tutor-fab-badge').style.display,
    text: document.getElementById('tutor-fab-badge').textContent,
    history: _tutorState.history.length })`);
  assert.strictEqual(r.unread, true, 'closing does not stop the reply from landing — it just goes unseen');
  assert.strictEqual(r.display, 'block', 'the badge is shown once the reply lands');
  assert.strictEqual(r.text, UI.en['tutor.reply_ready'], 'the badge reads the "I have an answer" text');
  assert.strictEqual(r.history, 1, 'the reply is still saved into the thread, same as if it were open');
}
console.log('  a reply while CLOSED raises the speech-bubble badge: OK');

// ── 4. Reopening — and ONLY reopening — clears the badge and the flag ─────────
{
  const C = client();
  C.run(`${jsonReply('Guten Tag!')} _tutorState.open = false;`);
  await C.run(`_tutorSend(false)`);
  assert.strictEqual(C.run(`_tutorState.unread`), true, 'sanity: unread is set before reopening');
  C.run(`toggleTutorWidget()`);   // the ONLY thing that should clear it
  const r = C.run(`({ unread: _tutorState.unread,
    display: document.getElementById('tutor-fab-badge').style.display, open: _tutorState.open })`);
  assert.strictEqual(r.open, true, 'sanity: the widget is now open');
  assert.strictEqual(r.unread, false, 'reopening clears the unread flag');
  assert.strictEqual(r.display, 'none', 'reopening hides the badge again');
}
console.log('  reopening the widget clears the badge and the unread flag: OK');

console.log('unit-tutor-reply-badge: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
