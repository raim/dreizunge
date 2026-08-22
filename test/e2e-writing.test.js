// E2E: PLAN §D4 (v82) — the `writing` lesson type.
//
// Two halves, tested separately because they are architecturally different (see the roadmap's
// `PLAN §D4` write-up): the STEM (a writing task) is generated ONCE like every other lesson type,
// through the normal add-lesson job; grading is a LIVE call at play time, through its own route,
// with no generation job and no stored "correct answer" involved at all.
const { boot, post, get, assert, sleep } = require('./lib');

const STORY = 'Es war einmal ein Test. Die Katze und das Haus blieben gleich.';
const SEED = {
  schemaVersion: 29,
  topics: [{
    id: 't_wr', topic: 'Test Topic', userTopic: 'Test Topic',
    lang: 'de', srcLang: 'en', difficulty: 2,
    story: STORY, lessons: [],
    generatedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }],
  storylines: [], flags: {}, progress: {},
};

async function waitJob(sport, jobId, timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await get(sport, '/api/job/' + jobId);
    if (r.status === 200 && (r.body.status === 'done' || r.body.status === 'error')) return r.body;
    await sleep(300);
  }
  throw new Error('job timed out');
}

(async () => {
  const env = await boot({ seed: SEED });
  let failed = false;
  try {
    const { sport } = env;

    // ── 1. The stem: generated once, through the normal add-lesson job ──────────────────────────
    const start = await post(sport, '/api/lessons/add-lesson', { id: 't_wr', lessonFormat: 'writing', difficulty: 2 });
    assert(start.status === 202, 'add-lesson accepted (got ' + start.status + ' ' + start.raw + ')');

    const fin = await waitJob(sport, start.body.jobId);
    assert(fin.status === 'done', 'job done (status=' + fin.status + ', err=' + (fin.error || '') + ')');

    const topic = env.readStore().topics.find(t => t.id === 't_wr');
    const wr = (topic.lessons || []).find(l => l.type === 'writing');
    assert(wr, 'a writing lesson was appended\n  lessons: ' + JSON.stringify((topic.lessons || []).map(l => l.type)));
    assert(typeof wr.prompt === 'string' && wr.prompt.trim(), 'lesson has a non-empty prompt (task)');
    assert(typeof wr.hint === 'string', 'lesson carries a hint field (may be empty, must exist)');
    console.log('  writing task: ' + JSON.stringify(wr.prompt));
    // Generation metadata, same convention every other generator carries.
    assert(wr._genMeta && typeof wr._genMeta === 'object', 'lesson has _genMeta');
    assert(typeof wr._genMeta.model === 'string' && wr._genMeta.model, '_genMeta.model set');
    assert(wr._genMeta.valid === 1, '_genMeta.valid is 1 (one task, not an item array)');

    // ── 2. Grading: a LIVE call, no job, no stored "correct answer" ──────────────────────────────
    // The fake's default reply is two "<wrong> => <fix> — <note>" lines (server.js's parseWritingFeedback).
    const fb = await post(sport, '/api/writing-feedback', {
      text: 'Ich habe gerne. Der Haus ist gross.', lang: 'de', srcLang: 'en', prompt: wr.prompt,
    });
    assert(fb.status === 200, 'writing-feedback accepted (got ' + fb.status + ' ' + fb.raw + ')');
    assert(fb.body.ok === false, 'the fake\'s two-line reply parses as NOT ok');
    assert(Array.isArray(fb.body.issues) && fb.body.issues.length === 2, 'both issues parsed (got ' + JSON.stringify(fb.body.issues) + ')');
    assert(fb.body.issues[0].wrong === 'Ich habe' && fb.body.issues[0].fix === 'Ich habe ein', 'first issue split correctly');
    assert(fb.body.issues[0].note && fb.body.issues[0].note.includes('object'), 'the note (source-language reason) survives');
    console.log('  writing-feedback (typos+grammar): ' + fb.body.issues.length + ' issue(s) parsed');

    // Missing text is rejected before any model call.
    const empty = await post(sport, '/api/writing-feedback', { text: '', lang: 'de', srcLang: 'en' });
    assert(empty.status === 400, 'an empty submission is rejected with 400 (got ' + empty.status + ')');

    // Missing lang is rejected too.
    const noLang = await post(sport, '/api/writing-feedback', { text: 'hallo' });
    assert(noLang.status === 400, 'a missing lang is rejected with 400 (got ' + noLang.status + ')');
  } catch (e) {
    failed = true;
    console.error('e2e-writing: FAILED —', e.message);
  } finally {
    env.stop();
  }

  // "OK" — the no-mistakes shape. FAKE_WRITING_REPLY is read by fake-ollama.js's own process,
  // inherited at spawn time. boot() derives its port from the PID, one server at a time per
  // process (the same constraint e2e-text-cleanup.test.js documents) — env must be stopped first.
  if (!failed) {
    await sleep(400);
    process.env.FAKE_WRITING_REPLY = 'OK';
    const okEnv = await boot({ seed: SEED });
    try {
      const okFb = await post(okEnv.sport, '/api/writing-feedback', { text: 'Ich gehe.', lang: 'de', srcLang: 'en' });
      if (okFb.status !== 200) throw new Error('OK reply accepted (got ' + okFb.status + ')');
      if (okFb.body.ok !== true) throw new Error('"OK" parses as ok:true (got ' + JSON.stringify(okFb.body) + ')');
      if (!Array.isArray(okFb.body.issues) || okFb.body.issues.length !== 0) throw new Error('no issues on "OK"');
      console.log('  writing-feedback "OK" (no mistakes) shape: OK');
      console.log('e2e-writing: ALL PASSED');
    } catch (e) {
      failed = true;
      console.error('e2e-writing: FAILED —', e.message);
    } finally {
      delete process.env.FAKE_WRITING_REPLY;
      okEnv.stop();
    }
  }
  process.exit(failed ? 1 : 0);
})();
