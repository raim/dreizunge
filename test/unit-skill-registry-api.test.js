// PLAN §8/B2 — behavioural API test for the server-side canonical skill registry.
// The endpoints are deliberately isolated: no lesson, observation, or player mutation appears
// here. A proposed skill must be explicitly registered; an explicit alias can be removed again.
'use strict';
const assert = require('assert');
const fs = require('fs');
const { boot, get, post, req } = require('./lib');

(async () => {
  const env = await boot();
  try {
    let r = await get(env.sport, '/api/skills');
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.body, { schemaVersion: 1, skills: [] }, 'starts from the isolated empty registry');

    r = await post(env.sport, '/api/skills/resolve',
      { proposedId: 'DE:Vocabulary:Gehen', targetLang: 'de', sourceLang: 'en' });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.body.resolution, {
      proposedId: 'DE:Vocabulary:Gehen', canonicalId: 'de:vocab:gehen', skillId: null,
      status: 'unregistered', targetLang: 'de', sourceLang: 'en', entry: null,
    }, 'resolving is read-only and source language does not become part of identity');

    r = await post(env.sport, '/api/skills/register',
      { proposedId: 'DE:Vocabulary:Gehen', targetLang: 'de', sourceLang: 'en', label: 'gehen' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.changed, true, 'explicit review action registers the skill');
    assert.strictEqual(r.body.resolution.skillId, 'de:vocab:gehen');
    assert.strictEqual(r.body.resolution.status, 'registered');
    assert.strictEqual(JSON.parse(fs.readFileSync(env.skillsPath, 'utf8')).skills[0].id, 'de:vocab:gehen',
      'registration reaches disk before any later review action can mask a missing write');

    r = await post(env.sport, '/api/skills/resolve',
      { proposedId: 'de:vocab:gehen', targetLang: 'de', sourceLang: 'it' });
    assert.strictEqual(r.body.resolution.status, 'exact');
    assert.strictEqual(r.body.resolution.skillId, 'de:vocab:gehen', 'Italian route resolves to the target-language skill');
    assert.strictEqual(r.body.resolution.sourceLang, 'it', 'route is retained as evidence context only');

    const alias = 'de:vocab:gehen:infinitive';
    r = await post(env.sport, '/api/skills/alias',
      { skillId: 'de:vocab:gehen', alias, targetLang: 'de' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.changed, true, 'alias requires explicit approval');
    r = await post(env.sport, '/api/skills/resolve', { proposedId: alias, targetLang: 'de' });
    assert.strictEqual(r.body.resolution.status, 'alias');
    assert.strictEqual(r.body.resolution.skillId, 'de:vocab:gehen');

    r = await req(env.sport, 'DELETE', '/api/skills/alias',
      { skillId: 'de:vocab:gehen', alias, targetLang: 'de' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.changed, true, 'an approved merge can be reversed');
    r = await post(env.sport, '/api/skills/resolve', { proposedId: alias, targetLang: 'de' });
    assert.strictEqual(r.body.resolution.status, 'unregistered', 'reversal removes only the alias');

    const persisted = JSON.parse(fs.readFileSync(env.skillsPath, 'utf8'));
    assert.deepStrictEqual(persisted, { schemaVersion: 1,
      skills: [{ id: 'de:vocab:gehen', targetLang: 'de', aliases: [], label: 'gehen' }] },
      'the review state persists outside lessons.json');
    const lessons = JSON.parse(fs.readFileSync(env.storePath, 'utf8'));
    assert.deepStrictEqual(lessons.topics, [], 'registry review never writes lesson data');
    console.log('  skill registry API: explicit target-language review, persistence, reversible aliases: OK');
  } finally {
    env.stop();
  }
})().catch(err => { console.error(err.stack || err); process.exit(1); });
