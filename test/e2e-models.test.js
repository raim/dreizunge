// E2E: runtime model picker + the two model-config paths that were previously never
// exercised headlessly — the TABLE lesson format (translategemma-style) and the SPLIT
// translation path (translation model ≠ story model). Also checks the structured per-role
// model provenance now recorded on generationStats.
//
// The fake Ollama reports several models (incl. one whose name contains 'translategemma',
// which flips the server's lesson format to 'table') and emits a real markdown table for the
// table prompt + a plain translation for the translation prompt.
const { boot, get, post, assert, sleep } = require('./lib');

async function waitJob(sport, jobId, timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await get(sport, '/api/job/' + jobId);
    if (r.status === 200 && (r.body.status === 'done' || r.body.status === 'error')) return r.body;
    await sleep(300);
  }
  throw new Error('job timed out');
}
const findTopic = (env, ut) => env.readStore().topics.find(t => t.userTopic === ut || t.topic === ut);

(async () => {
  const env = await boot();
  let failed = false;
  try {
    const { sport } = env;

    // ── 1) GET /api/models lists installed models + the active per-role assignment ──────
    const m0 = await get(sport, '/api/models');
    assert(m0.status === 200, '/api/models returns 200');
    assert(Array.isArray(m0.body.available), 'available is an array');
    assert(m0.body.available.includes('fake'), 'available includes the default fake model');
    assert(m0.body.available.includes('fake-translategemma'), 'available includes the translategemma fake');
    assert(m0.body.active.story === 'fake' && m0.body.active.lessons === 'fake' && m0.body.active.translation === 'fake',
      'all roles default to the boot model');
    assert(m0.body.active.lessonFormat === 'json', 'default lesson format is json');

    // /api/info reflects the same active state.
    const i0 = await get(sport, '/api/info');
    assert(i0.body.ollamaModel === 'fake' && i0.body.ollamaLessonFormat === 'json', '/api/info reflects defaults');

    // ── 2) Validation: an uninstalled model is rejected ────────────────────────────────
    const bad = await post(sport, '/api/models', { model: 'definitely-not-installed' });
    assert(bad.status === 400, 'uninstalled model rejected with 400 (got ' + bad.status + ')');
    // ...and rejection did NOT mutate the active roles.
    const i0b = await get(sport, '/api/info');
    assert(i0b.body.ollamaModel === 'fake', 'rejected switch left the active model unchanged');

    // Empty body rejected too.
    const empty = await post(sport, '/api/models', {});
    assert(empty.status === 400, 'empty switch body rejected');

    // ── 3) Switch the LESSONS role to the translategemma fake → format flips to table ───
    const sw = await post(sport, '/api/models', { lessons: 'fake-translategemma' });
    assert(sw.status === 200, 'lessons switch accepted');
    assert(sw.body.active.lessons === 'fake-translategemma', 'lessons role updated');
    assert(sw.body.active.lessonFormat === 'table', 'lesson format auto-derived to table');
    assert(sw.body.active.story === 'fake', 'story role untouched by a lessons-only switch');
    const i1 = await get(sport, '/api/info');
    assert(i1.body.ollamaLessonModel === 'fake-translategemma' && i1.body.ollamaLessonFormat === 'table',
      '/api/info reflects the table switch');

    // ── 4) Generate → exercises the TABLE lesson-build path (parseTableLesson) ──────────
    const g1 = await post(sport, '/api/generate',
      { topic: 'Tiere Tabelle', lang: 'de', srcLang: 'en', difficulty: 2, storyLen: 120, forceRegenerate: true });
    assert(g1.status === 202, 'table generate accepted (got ' + g1.status + ' ' + g1.raw + ')');
    const fin1 = await waitJob(sport, g1.body.jobId);
    assert(fin1.status === 'done', 'table generate finished (err=' + (fin1.error || '') + ')');
    const t1 = findTopic(env, 'Tiere Tabelle');
    assert(t1, 'table topic saved');
    const std1 = (t1.lessons || []).find(l => Array.isArray(l.vocab) && l.vocab.length);
    assert(std1, 'a vocab lesson was built from the table output\n  lessons: ' + JSON.stringify((t1.lessons || []).map(l => l.type)));
    assert(std1.vocab.some(v => v.target === 'Haus' && v.source === 'house'), 'table vocab rows parsed (Haus=house)');
    assert(std1.sentences && std1.sentences.some(s => /Das Haus ist groß/.test(s.target)), 'table sentence rows parsed');
    assert(t1.generationStats.lessonFormat === 'table', 'generationStats records table format');
    assert(t1.generationStats.models && t1.generationStats.models.lessons === 'fake-translategemma',
      'provenance: lessons model recorded');
    assert(t1.generationStats.models.story === 'fake', 'provenance: story model recorded');
    // No separate translation model here → translation did not run.
    assert(t1.generationStats.models.translation === null, 'provenance: translation null when no distinct model');

    // ── 5) Split translation + table together: story≠translation ≠ lessons ─────────────
    const sw2 = await post(sport, '/api/models', { story: 'fake', translation: 'fake-transl', lessons: 'fake-translategemma' });
    assert(sw2.status === 200 && sw2.body.active.translation === 'fake-transl', 'translation role set distinct');
    assert(sw2.body.active.lessonFormat === 'table', 'lesson format still table (lessons still translategemma)');
    const g2 = await post(sport, '/api/generate',
      { topic: 'Tiere Split', lang: 'de', srcLang: 'en', difficulty: 2, storyLen: 120, forceRegenerate: true });
    const fin2 = await waitJob(sport, g2.body.jobId);
    assert(fin2.status === 'done', 'split generate finished (err=' + (fin2.error || '') + ')');
    const t2 = findTopic(env, 'Tiere Split');
    assert(t2, 'split topic saved');
    assert(t2.storyTranslation && /stayed the same/i.test(t2.storyTranslation),
      'story was translated by the distinct translation model (split path ran)');
    assert(t2.generationStats.models.translation === 'fake-transl', 'provenance: translation model recorded when it runs');
    assert(t2.generationStats.models.story === 'fake', 'provenance: story model recorded (split)');
    assert(t2.generationStats.models.lessons === 'fake-translategemma', 'provenance: lessons model recorded (split)');

    // ── 6) A convenience {model} switch sets all three roles at once ────────────────────
    const sw3 = await post(sport, '/api/models', { model: 'fake' });
    assert(sw3.body.active.story === 'fake' && sw3.body.active.translation === 'fake' && sw3.body.active.lessons === 'fake',
      '{model} sets all three roles');
    assert(sw3.body.active.lessonFormat === 'json', 'format back to json after leaving translategemma');

    // ── 7) Runtime request timeout: settable (standalone) + reflected + clamped ──────────
    const m1 = await get(sport, '/api/models');
    assert(typeof m1.body.active.timeoutMs === 'number', '/api/models exposes the active timeoutMs');
    const tset = await post(sport, '/api/models', { timeoutMs: 900000 });
    assert(tset.status === 200 && tset.body.active.timeoutMs === 900000, 'timeout set standalone (no model change)');
    const clamp = await post(sport, '/api/models', { timeoutMs: 5 });   // below the 30s floor
    assert(clamp.body.active.timeoutMs === 30000, 'timeout clamped up to the 30s floor');
    const empty2 = await post(sport, '/api/models', {});
    assert(empty2.status === 400, 'empty body still rejected (no model, no timeout)');

    console.log('  /api/models list+switch+validation OK; table-format + split-translation + provenance exercised');
  } catch (e) {
    failed = true;
    console.error('  FAIL:', e.message);
    console.error('  --- server log tail ---\n' + env.srvlog().split('\n').slice(-30).join('\n'));
  } finally { env.stop(); }
  process.exit(failed ? 1 : 0);
})();
