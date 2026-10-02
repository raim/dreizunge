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

    // ── v91_h: a pasted story with NO typed topic ──────────────────────────────────────────────
    // ⚠️⚠️ THE CASE THIS FILE WAS MISSING, AND WHY IT STAYED GREEN THROUGH A THREE-WEEK OUTAGE.
    // Every story-mode assertion above posts `topic: 'kitty tale'` ALONGSIDE `userStory` — so this
    // file tested the API CONTRACT, never the request the WIZARD actually builds. `v90_s`'s
    // one-input router fills only `#user-story-input` when the learner picks "it's a story", so the
    // real request carries NO topic, and this route answered `400 Topic too short or missing`.
    // The user reported it as *"I currently can't generate text from pasted stories"*.
    // ⚠️ Fixed on BOTH sides deliberately — `doGenerate` had its own silent bounce (see
    // `unit-paste-story-generate.test.js`) — because paste, drag-drop, file upload and the URL fetch
    // all arrive HERE, and only this layer covers them at once.
    const NOTOPIC = 'Die Katze sass auf dem warmen Dach und blickte lange über die Stadt. '.repeat(3).trim();
    const r3 = await post(sport, '/api/generate', { lang: 'de', srcLang: 'en', difficulty: 2,
      userStory: NOTOPIC, userStoryLang: 'target' });          // no `topic` key at all
    assert(r3.status === 202,
      '⚠️ a pasted story with NO topic must be ACCEPTED — it carries its own subject. Got '
      + r3.status + ' ' + JSON.stringify(r3.body));
    const done3 = await waitJob(sport, r3.body.jobId);
    assert(done3 && done3.status === 'done', 'no-topic story finished (status=' + (done3 && done3.status) + ')');
    // The synthesized topic is the story's own opening — the shape the corpus already holds for
    // pasted chapters (`userTopic: "La biografia personale e professiona"`). It is temporary: the
    // title post-pass renames the chapter afterwards.
    const t3 = done3.data.topic || '';
    assert(t3.length > 2 && NOTOPIC.replace(/\s+/g, ' ').startsWith(t3.replace(/…$/, '').trim()),
      'the synthesized topic is the opening of the pasted story\n  got: ' + JSON.stringify(t3));
    const saved3 = (env.readStore().topics || []).find(t => t.topic === t3);
    assert(saved3 && (saved3.story || '').length > 20, 'the chapter was saved WITH its story');
    console.log('  a pasted story with NO topic generates, titled from its own opening:', JSON.stringify(t3));

    // ⚠️ NON-VACUITY: the topic requirement is NARROWED, not removed. With neither a topic nor a
    // story there is nothing to generate from, and the route must still refuse.
    const r4 = await post(sport, '/api/generate', { lang: 'de', srcLang: 'en', difficulty: 2 });
    assert(r4.status === 400,
      'a request with neither topic nor story must still be refused — got ' + r4.status);
    console.log('  …and a request with neither topic nor story is still refused: OK');

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
