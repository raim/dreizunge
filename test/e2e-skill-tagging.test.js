// PLAN §8/B3 — new vocabulary lessons carry model proposals, resolve known skills through B2,
// and leave unknown-but-valid proposals pending for review. No old lesson is read or rewritten.
'use strict';
const assert = require('assert');
const { boot, get, post, sleep } = require('./lib');

async function waitJob(sport, jobId) {
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    await sleep(200);
    const r = await get(sport, '/api/job/' + encodeURIComponent(jobId));
    if (r.body && ['done', 'error'].includes(r.body.status)) return r.body;
  }
  return null;
}

(async () => {
  const env = await boot({ log: true });
  try {
    // Seed ONE reviewed ID only. The fake proposes eight, proving that B3 resolves known IDs but
    // does not silently register the other seven under a generator-owned vocabulary dialect.
    let r = await post(env.sport, '/api/skills/register',
      { proposedId: 'de:vocab:haus', targetLang: 'de', label: 'Haus' });
    assert.strictEqual(r.status, 200);

    r = await post(env.sport, '/api/generate',
      { topic: 'Skill tagging', lang: 'de', srcLang: 'en', difficulty: 2, storyLen: 80 });
    assert.strictEqual(r.status, 202, 'generation accepted');
    const job = await waitJob(env.sport, r.body.jobId);
    assert.ok(job && job.status === 'done', 'generation completes: ' + (job && job.error));
    const topic = env.readStore().topics.find(t => t.topic === job.data.topic);
    assert.ok(topic, 'new topic persisted');
    const lesson = topic.lessons[0];
    assert.ok(lesson._genMeta, 'standard vocabulary generation still stamps _genMeta');
    assert.deepStrictEqual(lesson.skillIds, ['de:vocab:haus'], 'only the reviewed canonical ID is attached');
    assert.deepStrictEqual(lesson._skillTags, { type: 'vocab', proposed: 8, resolved: 1, pending: 7 },
      'unknown proposals are recorded as pending, not auto-registered');
    assert.strictEqual(lesson.vocab[0].skillId, 'de:vocab:haus', 'known proposal resolved to canonical ID');
    assert.strictEqual(lesson.vocab[0].skillProposal.status, 'exact');
    assert.strictEqual(lesson.vocab[1].skillId, null, 'unknown proposal has no unvalidated skillId');
    assert.strictEqual(lesson.vocab[1].skillProposal.status, 'unregistered');
    assert.ok(/^de:vocab:/.test(lesson.vocab[1].skillProposal.canonicalId), 'pending proposal remains target-language scoped');
    assert.ok(lesson.vocab.every(v => v.skillProposal && v.skillProposal.sourceLang === 'en'),
      'source language remains evidence context on every resolution');

    const calls = env.readChatLog().filter(x => x.kind === 'vocab');
    assert.ok(calls.length, 'vocabulary prompt reached the model');
    assert.ok(calls.some(x => /skillId/.test(x.sys)), 'JSON vocabulary prompt requires per-item model skill IDs');
    console.log('  B3 vocab tagging: target-language proposals, reviewed resolution, pending review: OK');

    // v85_r: a missing or malformed skillId on ONE vocab item used to throw and discard the WHOLE
    // lesson (see resolveVocabularySkillTags's own comment) — plausibly the "3 failed attempts,
    // 462s" flakiness reported at v85_p. The fake's SKILLDEFECT marker (in the topic, reaching the
    // user message) drops item[1]'s skillId entirely and gives item[2] a wrong-language-prefix one;
    // both are recoverable-by-design now, not fatal.
    r = await post(env.sport, '/api/generate',
      { topic: 'Skill tagging SKILLDEFECT', lang: 'de', srcLang: 'en', difficulty: 2, storyLen: 80 });
    assert.strictEqual(r.status, 202, 'generation accepted');
    const defectJob = await waitJob(env.sport, r.body.jobId);
    assert.ok(defectJob && defectJob.status === 'done',
      'a lesson with defective per-item skill IDs still completes on the FIRST attempt, not after retries: ' +
      (defectJob && defectJob.error));
    const defectTopic = env.readStore().topics.find(t => t.topic === defectJob.data.topic);
    assert.ok(defectTopic, 'the defective-skill-ID topic still persisted');
    const defectLesson = defectTopic.lessons[0];
    assert.strictEqual(defectLesson.vocab.length, 8, 'all 8 vocab items survive — none dropped for a bad skillId');
    assert.strictEqual(defectLesson.vocab[1].skillId, null, 'the item with no proposed skillId has none resolved');
    assert.strictEqual(defectLesson.vocab[1].skillProposal.status, 'missing',
      'a dropped skillId field is recorded as "missing", not thrown');
    assert.strictEqual(defectLesson.vocab[2].skillId, null, 'the item with a malformed skillId has none resolved');
    assert.ok(/^malformed:/.test(defectLesson.vocab[2].skillProposal.status),
      'a malformed skillId (wrong target-language prefix) is recorded as "malformed: <reason>", not thrown');
    assert.strictEqual(defectLesson.vocab[0].skillProposal.status, 'exact',
      'a well-formed proposal on another item (already-registered "de:vocab:haus") resolves normally, ' +
      'unaffected by its neighbours\' defects');
    // Scoped to the actual per-lesson vocab call ("Lesson N of M") — the fake's fallback routing
    // tags OTHER unrelated calls (a warm-up ping, the topic/emoji metadata call) as kind:'vocab' too,
    // and those also carry the topic name, so filtering on SKILLDEFECT alone overcounts.
    const defectCalls = env.readChatLog().filter(x =>
      x.kind === 'vocab' && /SKILLDEFECT/.test(x.usr || '') && /Lesson \d+ of \d+/.test(x.usr || ''));
    assert.strictEqual(defectCalls.length, 1,
      'exactly one model call was needed for the lesson itself — the defect did not trigger a retry-and-regenerate');
    console.log('  B3 vocab tagging: a missing or malformed per-item skillId degrades gracefully, no whole-lesson retry: OK');
  } finally {
    env.stop();
  }
})().catch(err => { console.error(err.stack || err); process.exit(1); });
