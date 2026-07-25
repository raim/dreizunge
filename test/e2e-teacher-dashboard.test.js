// e2e-teacher-dashboard.test.js
// v69_n — teacher dashboard: OVERVIEW + FLAG TRIAGE (roadmap item, scoped with the user).
//
// Two panels, because a teacher needs two different things:
//   • WHO is learning and how far they have got — `GET /api/learners`, which existed since v65 and
//     was rendered nowhere.
//   • WHAT has been reported — `GET /api/flag-summary` (new). Item-level flags live INSIDE lessons
//     (`item.userFlag`) while story-level ones live in the flags store, so there was no single
//     place to see them. Student reports (v69's `mode`) are listed first: a learner flagging a
//     wrong pair is the QC signal most worth acting on.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { boot, get, post, sleep, assert } = require('./lib');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ── 1. Client wiring ─────────────────────────────────────────────────────────
{
  assert(/id="teacher-screen"/.test(html), 'the dashboard has its own screen');
  assert(/id="teacher-dash-btn"/.test(html), 'and an entry button');
  assert(/async function openTeacherDashboard\(\)/.test(html), 'wired to a render function');
  // Backend-only: accounts and flags are server-side. The ENTRY BUTTON is hidden without a backend.
  assert(/_tdBtn\.style\.display = APP\.info\.canGenerate \? '' : 'none';/.test(html),
    'the entry button is hidden without a backend');
  // v69_r (user report: Learners opened an empty page). If the screen is somehow reached without a
  // backend it shows a NOTICE, never a blank screen — the open path must always fill the body.
  assert(/if\(!APP\.info\?\.canGenerate\)\{/.test(html),
    'a backend-less open renders a notice instead of a blank screen');
  assert(/teacher\.no_backend/.test(html), 'with an explanatory message');
  // Each endpoint is fetched independently so one failure cannot blank the whole panel.
  assert(/try \{ const r = await fetch\('\/api\/learners'\)/.test(html)
      && /try \{ const r = await fetch\('\/api\/flag-summary'\)/.test(html),
    'learners and flags are fetched independently (a partial failure still renders)');
  // v69_r: endpoints are read INDEPENDENTLY (not Promise.all), so one failing does not blank the
  // other's panel — asserted just above via the two separate try/fetch blocks.
  // Student reports lead the flag list.
  assert(/const ordered = \[\.\.\.student, \.\.\.flags\.filter\(f => f\.mode !== 'student'\)\]/.test(html),
    'student-reported items are listed first');
  // Both chapter numbers are surfaced — showing only one is how the old label misled.
  assert(/teacher\.chapters.*done:l\.chaptersCompleted/.test(html.replace(/\n/g, ' ')),
    'the row shows finished chapters');
  assert(/started:l\.chaptersStarted/.test(html), 'and how many were merely started');
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  for (const k of ['teacher.title', 'teacher.learners', 'teacher.flags', 'teacher.no_learners',
                   'teacher.no_flags', 'teacher.chapters', 'teacher.words', 'teacher.hardest'])
    assert(ui.en[k], `ui.json carries ${k}`);
}
console.log('  client: teacher-only, backend-gated, both panels, student flags first: OK');

// ── 2. The endpoints ─────────────────────────────────────────────────────────
(async () => {
  const env = await boot({ log: false });
  let failed = false;
  try {
    // Empty library / no accounts: both must answer cleanly rather than erroring.
    let r = await get(env.sport, '/api/flag-summary');
    assert(r.status === 200 && r.body.total === 0, 'flag summary is empty but well-formed');
    r = await get(env.sport, '/api/learners');
    assert(r.status === 200 && Array.isArray(r.body.learners), 'learners list is empty but well-formed');

    // Generate a chapter, then flag one of its vocab items as a STUDENT would.
    const g = await post(env.sport, '/api/generate', { topic: 'Dash Chapter', lang: 'de', srcLang: 'en', difficulty: 2 });
    for (let i = 0; i < 100; i++) {
      await sleep(300);
      const j = await get(env.sport, '/api/job/' + g.body.jobId);
      if (j.body && (j.body.status === 'done' || j.body.status === 'error')) break;
    }
    const store = env.readStore();
    const topic = store.topics[0];
    assert(topic && (topic.lessons || []).length, 'a chapter was generated');
    const lesson = topic.lessons.find(l => (l.vocab || []).length);
    lesson.vocab[0].userFlag = { comment: 'wrong article', correct: 'die Katze', at: '2026-07-24T10:00:00.000Z', mode: 'student' };
    lesson.vocab[1] = lesson.vocab[1] || { target: 'x', source: 'y' };
    lesson.vocab[1].userFlag = { comment: 'teacher note', at: '2026-07-23T10:00:00.000Z', mode: 'teacher' };
    store.flags = { [`${topic.id}:story`]: { topic: topic.topic, type: 'story', flaggedAt: '2026-07-22T10:00:00.000Z', mode: 'student' } };
    // The server caches the store in memory, so a second server is booted with the edited data.
    env.stop();
    await sleep(300);                       // let the port free up (boot uses a pid-derived port)
    const env2 = await boot({ log: false, seed: store });
    try {
      r = await get(env2.sport, '/api/flag-summary');
      assert(r.status === 200, 'flag summary responds');
      assert(r.body.total >= 3, `it finds item, story and teacher flags together (got ${r.body.total})`);
      assert(r.body.byMode.student >= 2, `student reports are counted separately (got ${JSON.stringify(r.body.byMode)})`);
      const item = r.body.flags.find(f => f.kind === 'item' && f.mode === 'student');
      assert(item, 'the student item flag is present');
      assert(item.comment === 'wrong article' && item.correct === 'die Katze', 'with its comment and suggested fix');
      assert(item.topicId === topic.id && item.lessonId === lesson.id, 'and enough context to open it in the editor');
      assert(r.body.flags.some(f => f.kind === 'story'), 'story-level flags are included');
      // Newest first, so a teacher sees the latest reports at the top.
      const times = r.body.flags.map(f => f.at || '').filter(Boolean);
      assert(times.join('|') === [...times].sort().reverse().join('|'), 'flags are ordered newest first');
    } finally { env2.stop(); }
  } catch (e) {
    failed = true;
    console.error('e2e-teacher-dashboard FAILED:', e.message);
    try { env.stop(); } catch (_) {}
  }
  if (failed) process.exit(1);
  console.log('  endpoints: item + story + student flags, ordered, with editor context: OK');
  console.log('e2e-teacher-dashboard: ALL PASSED');
})();
