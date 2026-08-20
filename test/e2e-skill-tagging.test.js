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
  } finally {
    env.stop();
  }
})().catch(err => { console.error(err.stack || err); process.exit(1); });
