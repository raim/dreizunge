// E2E (live server + fake Ollama): roadmap item 5.
//  5a: /api/generate-book rejects nChapters < 2 instead of silently coercing to 2.
//  5b: /api/storyline-title (title-only patch) preserves chapters + summary.
const { boot, get, post, assert } = require('./lib');

(async () => {
  const env = await boot();
  let failed = false;
  try {
    const { sport } = env;

    // ---- 5a ----
    const r1 = await post(sport, '/api/generate-book', { generated: true, topic: 'Numbers', nChapters: 1, lang: 'de', srcLang: 'en', difficulty: 2 });
    assert(r1.status === 400, '5a: nChapters:1 must be 400 (got ' + r1.status + ')');
    assert(/between 2 and 20/.test(r1.body?.error || ''), '5a: range error message present');

    const r0 = await post(sport, '/api/generate-book', { generated: true, topic: 'Numbers', nChapters: 0, lang: 'de', srcLang: 'en', difficulty: 2 });
    assert(r0.status === 400, '5a: nChapters:0 must be 400');

    const rMissing = await post(sport, '/api/generate-book', { generated: true, topic: 'Numbers', lang: 'de', srcLang: 'en', difficulty: 2 });
    assert(rMissing.status === 400, '5a: missing nChapters must be 400');

    const r3 = await post(sport, '/api/generate-book', { generated: true, topic: 'Numbers', nChapters: 3, lang: 'de', srcLang: 'en', difficulty: 2, chapterLen: 120 });
    assert(r3.status === 202 && r3.body?.chapters === 3, '5a: nChapters:3 -> 202 with 3 chapters (got ' + r3.status + '/' + r3.body?.chapters + ')');

    const r25 = await post(sport, '/api/generate-book', { generated: true, topic: 'Numbers', nChapters: 25, lang: 'de', srcLang: 'en', difficulty: 2 });
    assert(r25.status === 202 && r25.body?.chapters === 20, '5a: nChapters:25 clamps to 20');
    console.log('  item 5a: OK');

    // ---- 5b ----
    const slId = 'sl_test_5b';
    await post(sport, '/api/storylines', { slId, title: 'Original', icon: '📗', chapters: ['cid1', 'cid2'], summary: 'A long summary that must survive.' });
    let info = await get(sport, '/api/storylines');
    let arr = Array.isArray(info.body) ? info.body : (info.body?.storylines || []);
    const before = arr.find(s => s.id === slId);
    assert(before && before.chapters?.length === 2 && before.summary, '5b: seed has chapters + summary');

    const rt = await post(sport, '/api/storyline-title', { slId, topics: ['cid1'] });
    assert(rt.status === 200, '5b: storyline-title 200 (got ' + rt.status + ')');

    info = await get(sport, '/api/storylines');
    arr = Array.isArray(info.body) ? info.body : (info.body?.storylines || []);
    const after = arr.find(s => s.id === slId);
    assert(after && after.chapters?.length === 2, '5b: chapters preserved (got ' + JSON.stringify(after?.chapters) + ')');
    assert(after.summary === 'A long summary that must survive.', '5b: summary preserved');
    assert(after.title && after.title !== 'Original', '5b: title updated');
    console.log('  item 5b: OK — title-only patch keeps chapters + summary');

    console.log('e2e-generate: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-generate FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-25).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
