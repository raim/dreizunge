// E2E: PLAN §D4 (v82, reworked v82_f) — the `writing` lesson type.
//
// Two halves, tested separately because they are architecturally different (see the roadmap's
// `PLAN §D4` write-up): the STEM (a reading-comprehension QUESTION, source-language only) is
// generated ONCE like every other lesson type, through the normal add-lesson job; grading is a LIVE
// call at play time, through its own route, with no generation job and no stored "correct answer"
// involved at all — it judges the learner's own free-text answer against the story, live.
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
  let question = null;
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
    assert(typeof wr.question === 'string' && wr.question.trim(), 'lesson has a non-empty question');
    assert(wr.prompt === undefined && wr.hint === undefined,
      'the old bilingual prompt/hint fields are gone — question replaces both (v82_f)');
    console.log('  writing question: ' + JSON.stringify(wr.question));
    question = wr.question;
    // Generation metadata, same convention every other generator carries.
    assert(wr._genMeta && typeof wr._genMeta === 'object', 'lesson has _genMeta');
    assert(typeof wr._genMeta.model === 'string' && wr._genMeta.model, '_genMeta.model set');
    assert(wr._genMeta.valid === 1, '_genMeta.valid is 1 (one question, not an item array)');

    // ── 2. Grading: a LIVE call, no job, no stored "correct answer" ──────────────────────────────
    // The fake's default reply: a "partially correct" verdict plus two "<wrong> => <fix> — <note>"
    // language-issue lines (server.js's parseWritingFeedback splits the two apart).
    const fb = await post(sport, '/api/writing-feedback', {
      text: 'Ich habe gerne. Der Haus ist gross.', lang: 'de', srcLang: 'en', question, story: STORY,
    });
    assert(fb.status === 200, 'writing-feedback accepted (got ' + fb.status + ' ' + fb.raw + ')');
    assert(fb.body.correctness === 'partially correct', 'the verdict line parsed (got ' + JSON.stringify(fb.body.correctness) + ')');
    assert(fb.body.correctnessNote && fb.body.correctnessNote.includes('cat'), 'the verdict explanation survives');
    assert(fb.body.ok === false, 'the fake\'s two language-issue lines parse as NOT ok');
    assert(Array.isArray(fb.body.issues) && fb.body.issues.length === 2, 'both issues parsed (got ' + JSON.stringify(fb.body.issues) + ')');
    assert(fb.body.issues[0].wrong === 'Ich habe' && fb.body.issues[0].fix === 'Ich habe ein', 'first issue split correctly');
    assert(fb.body.issues[0].note && fb.body.issues[0].note.includes('object'), 'the note (source-language reason) survives');
    console.log('  writing-feedback: verdict=' + fb.body.correctness + ', ' + fb.body.issues.length + ' language issue(s) parsed');

    // Missing text/question/story are each rejected before any model call.
    const empty = await post(sport, '/api/writing-feedback', { text: '', lang: 'de', srcLang: 'en', question, story: STORY });
    assert(empty.status === 400, 'an empty submission is rejected with 400 (got ' + empty.status + ')');

    const noLang = await post(sport, '/api/writing-feedback', { text: 'hallo', question, story: STORY });
    assert(noLang.status === 400, 'a missing lang is rejected with 400 (got ' + noLang.status + ')');

    const noQuestion = await post(sport, '/api/writing-feedback', { text: 'hallo', lang: 'de', srcLang: 'en', story: STORY });
    assert(noQuestion.status === 400, 'a missing question is rejected with 400 (got ' + noQuestion.status + ') — ' +
      'grading needs it to judge correctness (v82_f)');

    const noStory = await post(sport, '/api/writing-feedback', { text: 'hallo', lang: 'de', srcLang: 'en', question });
    assert(noStory.status === 400, 'a missing story is rejected with 400 (got ' + noStory.status + ')');
  } catch (e) {
    failed = true;
    console.error('e2e-writing: FAILED —', e.message);
  } finally {
    env.stop();
  }

  // A clean "correct, no language issues" verdict — the shape a fully right answer takes.
  // FAKE_WRITING_REPLY is read by fake-ollama.js's own process, inherited at spawn time. boot()
  // derives its port from the PID, one server at a time per process (the same constraint
  // e2e-text-cleanup.test.js documents) — env must be stopped first.
  if (!failed) {
    await sleep(400);
    process.env.FAKE_WRITING_REPLY = 'CORRECTNESS: correct — The story confirms the cat and the house stayed the same.';
    const okEnv = await boot({ seed: SEED });
    try {
      const okFb = await post(okEnv.sport, '/api/writing-feedback',
        { text: 'Die Katze und das Haus blieben gleich.', lang: 'de', srcLang: 'en', question: question || 'Q?', story: STORY });
      if (okFb.status !== 200) throw new Error('correct-verdict reply accepted (got ' + okFb.status + ')');
      if (okFb.body.correctness !== 'correct') throw new Error('verdict parses as correct (got ' + JSON.stringify(okFb.body) + ')');
      if (okFb.body.ok !== true) throw new Error('no language-issue lines means ok:true');
      if (!Array.isArray(okFb.body.issues) || okFb.body.issues.length !== 0) throw new Error('no issues when the verdict line stands alone');
      console.log('  writing-feedback "correct, no language issues" shape: OK');
    } finally {
      delete process.env.FAKE_WRITING_REPLY;
      okEnv.stop();
    }
  }

  // A reply that ignores the requested shape entirely — parseWritingFeedback's fallback, not a crash.
  if (!failed) {
    await sleep(400);
    process.env.FAKE_WRITING_REPLY = 'This looks good to me, well done!';
    const unkEnv = await boot({ seed: SEED });
    try {
      const unkFb = await post(unkEnv.sport, '/api/writing-feedback',
        { text: 'Die Katze und das Haus blieben gleich.', lang: 'de', srcLang: 'en', question: question || 'Q?', story: STORY });
      if (unkFb.status !== 200) throw new Error('non-compliant reply still accepted (got ' + unkFb.status + ')');
      if (unkFb.body.correctness !== 'unknown') throw new Error('a reply with no CORRECTNESS line parses as unknown (got ' + JSON.stringify(unkFb.body) + ')');
      if (!unkFb.body.correctnessNote.includes('well done')) throw new Error('the raw reply is surfaced as the note rather than discarded');
      console.log('  writing-feedback non-compliant-reply fallback ("unknown"): OK');
      console.log('e2e-writing: ALL PASSED');
    } catch (e) {
      failed = true;
      console.error('e2e-writing: FAILED —', e.message);
    } finally {
      delete process.env.FAKE_WRITING_REPLY;
      unkEnv.stop();
    }
  }
  process.exit(failed ? 1 : 0);
})();
