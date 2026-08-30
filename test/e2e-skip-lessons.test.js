// E2E (live server + fake Ollama): decoupling chaptering from lesson generation (user request,
// roadmap_v87.md — "get rid of the mixing of text extraction into chapters and lesson generation
// ... we generally want to have texts and chapters first ... and THEN add lessons"). Covers the
// shared server mechanism (`skipLessons`) across all three ways a chapter can be created:
// /api/generate (single topic), /api/generate-book with real chunks (the PDF/comic shape), and
// /api/generate-book with generated:true (the LLM multi-chapter shape) — per this project's own
// standing rule ("server.js changes need a FRESH PROCESS to verify live").
'use strict';
const { boot, post, get, assert, sleep } = require('./lib');

async function waitJob(sport, jobId, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await get(sport, '/api/job/' + jobId);
    if (r.status === 200 && (r.body.status === 'done' || r.body.status === 'error')) return r.body;
    await sleep(150);
  }
  throw new Error('job timed out');
}
async function waitBookJob(sport, bookId, timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await get(sport, '/api/book-job/' + bookId);
    if (r.status === 200 && (r.body.status === 'done' || r.body.status === 'error')) return r.body;
    await sleep(150);
  }
  throw new Error('book job timed out');
}

(async () => {
  const env = await boot({ log: true });
  let failed = false;
  try {
    const { sport } = env;

    // ── 1. /api/generate, skipLessons:true — a single chapter with story, ZERO lessons ─────────
    {
      const start = await post(sport, '/api/generate', {
        topic: 'Skip Lessons Single', lang: 'de', srcLang: 'en', difficulty: 2, skipLessons: true });
      assert(start.status === 202, 'accepted (got ' + start.status + ' ' + start.raw + ')');
      const fin = await waitJob(sport, start.body.jobId);
      assert(fin.status === 'done', 'job done (status=' + fin.status + ', err=' + (fin.error||'') + ')');
      assert(fin.data.story && fin.data.story.trim().length > 0, 'the chapter has real story text');
      assert(Array.isArray(fin.data.lessons) && fin.data.lessons.length === 0,
        'zero lessons (got ' + (fin.data.lessons||[]).length + ')');
      const store = env.readStore();
      const saved = store.topics.find(t => t.topic === fin.data.topic);
      assert(saved, 'the chapter is actually persisted to disk');
      assert(saved.story, 'the persisted record has story text');
      assert(Array.isArray(saved.lessons) && saved.lessons.length === 0, 'the persisted record has zero lessons too');
      console.log('  /api/generate + skipLessons:true: story persisted, zero lessons, both in the job result and on disk: OK');
    }

    // ── 2. /api/generate, WITHOUT skipLessons — unchanged: at least one lesson (regression guard) ─
    {
      const start = await post(sport, '/api/generate', {
        topic: 'Normal Single', lang: 'de', srcLang: 'en', difficulty: 2 });
      const fin = await waitJob(sport, start.body.jobId);
      assert(fin.status === 'done', 'job done');
      assert(fin.data.lessons.length >= 1, 'the NORMAL path still generates at least one lesson (got ' +
        fin.data.lessons.length + ') — skipLessons must not have changed the default');
      console.log('  /api/generate WITHOUT skipLessons: still generates the standard gate lesson, unchanged: OK');
    }

    // ── 3. /api/generate-book with real chunks (the PDF/comic shape), skipLessons:true ─────────
    {
      const chunks = [
        { title: 'Chapter One', text: 'Es war einmal ein Test. Die Katze lief.', wordCount: 8 },
        { title: 'Chapter Two', text: 'Der Hund schlief. Alles war ruhig.', wordCount: 6 },
      ];
      const start = await post(sport, '/api/generate-book', {
        chunks, lang: 'de', srcLang: 'en', difficulty: 2, skipLessons: true,
        // Sent alongside on purpose — skipLessons must WIN, not combine with arc.
        arc: true, arcTypes: ['word_forms', 'synonyms'] });
      assert(start.status === 202, 'accepted (got ' + start.status + ' ' + start.raw + ')');
      const fin = await waitBookJob(sport, start.body.bookId);
      assert(fin.status === 'done', 'book job done (status=' + fin.status + ', err=' + (fin.error||'') + ')');
      const store = env.readStore();
      const saved = fin.chapters.map(c => store.topics.find(t => t.id === c.topicId)).filter(Boolean);
      assert(saved.length === 2, 'both chapters persisted (got ' + saved.length + ')');
      for (const t of saved) {
        assert(t.story && t.story.trim().length > 0, 'chapter "' + t.topic + '" has real story text');
        assert(Array.isArray(t.lessons) && t.lessons.length === 0,
          'chapter "' + t.topic + '" has ZERO lessons despite arc:true/arcTypes being sent (got ' + t.lessons.length + ')');
      }
      console.log('  /api/generate-book (chunks) + skipLessons:true: both chapters get story only, arc is correctly ignored: OK');
    }

    // ── 4. /api/generate-book, generated:true (the LLM multi-chapter shape), skipLessons:true ──
    {
      const start = await post(sport, '/api/generate-book', {
        generated: true, topic: 'Skip Lessons Book', nChapters: 2, lang: 'de', srcLang: 'en',
        difficulty: 2, chapterLen: 80, skipLessons: true });
      assert(start.status === 202, 'accepted (got ' + start.status + ' ' + start.raw + ')');
      const fin = await waitBookJob(sport, start.body.bookId);
      assert(fin.status === 'done', 'book job done (status=' + fin.status + ', err=' + (fin.error||'') + ')');
      const store = env.readStore();
      const saved = fin.chapters.map(c => store.topics.find(t => t.id === c.topicId)).filter(Boolean);
      assert(saved.length === 2, 'both generated chapters persisted');
      for (const t of saved) {
        assert(t.story && t.story.trim().length > 0, 'generated chapter "' + t.topic + '" has real story text');
        assert(Array.isArray(t.lessons) && t.lessons.length === 0, 'generated chapter "' + t.topic + '" has zero lessons');
      }
      // The title post-pass and storyline linkage are unrelated to lessons — confirm the book job
      // ran them (reached 'done', both chapters chained) rather than skipLessons short-circuiting
      // the whole pipeline. NOT asserting the post-pass actually RENAMED the placeholders — the fake
      // backend's own chapter_titles branch keys on prompt SHAPE (a literal "Chapter 1:" in the user
      // message), and whether that pass succeeds against the fake is an orthogonal, pre-existing
      // concern this test isn't about (e2e-book-arc-types.test.js's own root/child chapter check is
      // the same scope, for the same reason).
      assert(saved[1].continuedFromId === saved[0].id, 'chapter 2 chains from chapter 1 (storyline linkage still ran)');
      console.log('  /api/generate-book (generated:true) + skipLessons:true: chapters created, chained, zero lessons: OK');
    }

    // ── 5. /api/generate-book, generated:true, WITHOUT skipLessons — unchanged (regression guard) ─
    {
      const start = await post(sport, '/api/generate-book', {
        generated: true, topic: 'Normal Book', nChapters: 2, lang: 'de', srcLang: 'en',
        difficulty: 2, chapterLen: 80 });
      const fin = await waitBookJob(sport, start.body.bookId);
      assert(fin.status === 'done', 'book job done');
      const store = env.readStore();
      const saved = fin.chapters.map(c => store.topics.find(t => t.id === c.topicId)).filter(Boolean);
      for (const t of saved) assert(t.lessons.length >= 1, 'chapter "' + t.topic + '" still gets its standard lesson without skipLessons');
      console.log('  /api/generate-book (generated:true) WITHOUT skipLessons: unchanged, still generates lessons: OK');
    }

    console.log('e2e-skip-lessons: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-skip-lessons FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-40).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
