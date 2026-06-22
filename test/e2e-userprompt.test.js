// E2E (live server + fake Ollama): the generated lesson record stores the full,
// untruncated user input in `userPrompt`, while the display `topic` is the short
// LLM-generated title. Confirms the model is NOT shortchanged (storyPrompt + the
// stored fields contain the whole input).
const { boot, get, post, waitPort, assert, sleep } = require('./lib');

async function waitJob(sport, jobId, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await sleep(300);
    const st = await get(sport, '/api/job/' + encodeURIComponent(jobId));
    if (st.body && ['done', 'error'].includes(st.body.status)) return st.body;
  }
  return null;
}

(async () => {
  const env = await boot();
  let failed = false;
  try {
    const { sport } = env;
    // A long topic that would be shortened to a title.
    const LONG = 'eliza verstand, dass sie den CO2-Zyklus der Erde im Labor nachstellen muss, '
      + 'um den Kindern zu zeigen wie Photosynthese und Verbrennung zusammenhaengen';

    const r = await post(sport, '/api/generate', { topic: LONG, lang: 'de', srcLang: 'en', difficulty: 2, storyLen: 150 });
    assert(r.status === 202 && r.body.jobId, 'generate accepted with jobId (got ' + r.status + ')');
    const done = await waitJob(sport, r.body.jobId);
    assert(done && done.status === 'done', 'generation finished (status=' + (done && done.status) + ' err=' + (done && done.error) + ')');

    const data = done.data;
    // Display topic is the short fake title; userPrompt holds the full input verbatim.
    assert(data.userPrompt === LONG, 'userPrompt holds the FULL untruncated topic\n  got: ' + JSON.stringify(data.userPrompt));
    assert(data.userTopic === LONG, 'userTopic also full (unchanged behaviour)');
    assert(typeof data.topic === 'string' && data.topic.length > 0, 'display topic present');
    // The story prompt the model received contains the full input (model not shortchanged).
    assert((data.storyPrompt || '').includes(LONG), 'storyPrompt (model input) contains the full topic');

    // Persisted to the store too.
    const saved = (env.readStore().topics || []).find(t => t.userPrompt === LONG);
    assert(saved, 'saved record carries the full userPrompt');
    console.log('  topic(display):', JSON.stringify(data.topic));
    console.log('  userPrompt len:', data.userPrompt.length, '(full input preserved)');
    console.log('e2e-userprompt: ALL PASSED');

    // Story-mode: userPrompt also captures pasted story + translation.
    const STORY = 'Es war einmal eine kleine Katze. '.repeat(4).trim();
    const TRANS = 'Once upon a time there was a little cat.';
    const r2 = await post(sport, '/api/generate', { topic: 'kitty tale', lang: 'de', srcLang: 'en', difficulty: 2,
      userStory: STORY, userTranslation: TRANS, userStoryLang: 'target' });
    assert(r2.status === 202, 'story-mode generate accepted');
    const done2 = await waitJob(sport, r2.body.jobId);
    assert(done2 && done2.status === 'done', 'story-mode finished (status=' + (done2 && done2.status) + ')');
    const up2 = done2.data.userPrompt || '';
    assert(up2.includes('kitty tale') && up2.includes(STORY) && up2.includes(TRANS),
      'story-mode userPrompt captures topic + story + translation\n  got: ' + JSON.stringify(up2.slice(0, 120)));
    console.log('  story-mode userPrompt captures topic + story + translation: OK');

    console.log('\nALL USERPROMPT TESTS PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-userprompt FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-25).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
