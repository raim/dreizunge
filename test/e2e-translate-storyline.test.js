// E2E (live server + fake Ollama): item AX (v88_i) — generate lessons from an EXISTING storyline for
// a DIFFERENT source language.
//
// User request: "Allow to generate lessons based on existing storylines and chapters, but for a
// different source language. This could be a drop-down menu in the generation interface, with the
// same choice as 'continue from'. This would skip the story generation part (otherwise via LLM, PDF,
// comic), and start with the target language text."
//
// The point of the design is that almost nothing is new: POST /api/generate-book already runs the
// whole downstream pipeline (translation, chapter titles, lessons, arc, storyboard, analysis) from
// bare `chunks`, and both the PDF and image paths are nothing but "build chunks, POST". This adds a
// fourth way to OBTAIN those chunks — an existing storyline's chapter `story` fields — resolved
// SERVER-side, because the client's savedList projection carries no story text at all.
//
// The user's three rulings, all asserted here: lineage carries the ID (not just a title), comicPanels
// are copied across for now, and the same-source-language case is REFUSED.
'use strict';
const fs = require('fs');
const { boot, post, get, assert } = require('./lib');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const SEED = {
  schemaVersion: 29, flags: {}, progress: {},
  topics: [
    { id: 'tp_a', topic: 'Kapitel Eins', lang: 'nl', srcLang: 'de',
      story: 'Een weg loopt door een droge heide.', lessons: [],
      comicPanels: [{ x1: 0, y1: 0, x2: 10, y2: 10, caption: '', inScene: '',
                      description: 'Een bord bij een hek.', image: 'data:image/jpeg;base64,PANELA' }] },
    { id: 'tp_b', topic: 'Kapitel Zwei', lang: 'nl', srcLang: 'de',
      story: 'De man loopt verder over het pad.', lessons: [],
      continuedFrom: 'Kapitel Eins', continuedFromId: 'tp_a' },
  ],
  storylines: [{ id: 'sl_src', title: 'De Heide', icon: '📖', chapters: ['tp_a', 'tp_b'],
                 lang: 'nl', srcLang: 'de' }],
};

// There is no single-topic GET route — `/api/lessons` is a WHITELIST projection and carries neither
// `story` nor `comicPanels`. Read what was actually PERSISTED instead, which is the stronger claim
// anyway: these sections are about what lands in the store, not about what a projection chooses to
// expose.
const stored = (env, id) =>
  JSON.parse(fs.readFileSync(env.storePath, 'utf8')).topics.find(t => t.id === id);

async function waitBook(sport, bookId, ms = 60000) {
  const t0 = Date.now();
  for (;;) {
    const r = await get(sport, '/api/book-job/' + bookId);
    if (r.status === 200 && (r.body.status === 'done' || r.body.status === 'error')) return r.body;
    if (Date.now() - t0 > ms) throw new Error('book job did not finish: ' + JSON.stringify(r.body));
    await sleep(300);
  }
}

(async () => {
  const env = await boot({ log: true, seed: SEED });
  let failed = false;
  try {
    const { sport } = env;

    // ── 1. The degenerate case is REFUSED (user's ruling) ─────────────────────────────────────
    // Same source language would silently duplicate an entire storyline — every chapter, every
    // lesson, a full generation run — and produce nothing the learner does not already have.
    {
      const same = await post(sport, '/api/generate-book',
        { translateFrom: 'sl_src', lang: 'nl', srcLang: 'de', skipLessons: true });
      assert(same.status === 400, 'same source language is refused (got ' + same.status + ')');
      assert(/already written for/i.test(same.body.error || ''),
        'and the error says WHY, naming the language (got ' + JSON.stringify(same.body.error) + ')');
      console.log('  same source language is refused, with a reason: OK');
    }

    // ── 2. Unknown / empty storylines are refused too ─────────────────────────────────────────
    {
      const missing = await post(sport, '/api/generate-book',
        { translateFrom: 'sl_nope', lang: 'nl', srcLang: 'en', skipLessons: true });
      assert(missing.status === 404, 'an unknown storyline 404s (got ' + missing.status + ')');
      console.log('  an unknown storyline is refused: OK');
    }

    // ── 3. The real run: a DIFFERENT source language ──────────────────────────────────────────
    // skipLessons keeps this fast and focused — the chunks pipeline downstream of chaptering is
    // already covered by e2e-bookjob/e2e-skip-lessons and is deliberately not re-tested here.
    const started = await post(sport, '/api/generate-book',
      { translateFrom: 'sl_src', lang: 'nl', srcLang: 'en', skipLessons: true });
    assert(started.status === 200 || started.status === 202,
      'a different source language is accepted (got ' + started.status + ' ' + JSON.stringify(started.body) + ')');
    const bookId = started.body.bookId;
    assert(bookId, 'a book id came back');
    const done = await waitBook(sport, bookId);
    assert(done.status === 'done', 'the book job finished (got ' + done.status + ' ' + (done.error || '') + ')');

    const all = await get(sport, '/api/lessons');
    const made = all.body.filter(t => t.id !== 'tp_a' && t.id !== 'tp_b');
    assert(made.length === 2, 'one new chapter per source chapter WITH text (got ' + made.length + ')');
    made.forEach(t => assert(t.srcLang === 'en', 'each new chapter is for the NEW source language'));
    made.forEach(t => assert(t.lang === 'nl', 'and keeps the TARGET language'));
    console.log('  a different source language produces one new chapter per source chapter: OK');

    // ── 4. The target text is REUSED, not regenerated ─────────────────────────────────────────
    // This is the whole point of the item: "skip the story generation part and start with the
    // target language text."
    {
      const full = { body: stored(env, made[0].id) };
      assert(full.body, 'the new chapter is in the store');
      const stories = [SEED.topics[0].story, SEED.topics[1].story];
      assert(stories.includes(full.body.story),
        'the new chapter REUSES a source story verbatim rather than generating a new one (got '
        + JSON.stringify(full.body.story) + ')');
      console.log('  the target-language text is reused verbatim, not regenerated: OK');
    }

    // ── 5. Lineage carries the ID, not just a title (user's ruling) ───────────────────────────
    {
      const full = { body: stored(env, made[0].id) };
      assert(/^tp_(a|b)$/.test(full.body.translationOfId || ''),
        'the chapter records the SOURCE CHAPTER ID it was translated from (got '
        + JSON.stringify(full.body.translationOfId) + ')');
      assert(typeof full.body.translationOfTitle === 'string' && full.body.translationOfTitle,
        'plus a display snapshot of its title (got ' + JSON.stringify(full.body.translationOfTitle) + ')');

      const sls = await get(sport, '/api/storylines');
      const made_sl = sls.body.find(s => s.id !== 'sl_src');
      assert(made_sl, 'a new storyline was created');
      assert(made_sl.translationOfId === 'sl_src',
        'and IT records the source STORYLINE ID (got ' + JSON.stringify(made_sl.translationOfId) + ')');
      assert(made_sl.translationOfTitle === 'De Heide',
        'plus the source title as a snapshot (got ' + JSON.stringify(made_sl.translationOfTitle) + ')');
      console.log('  lineage is recorded by ID at both chapter and storyline level: OK');
    }

    // ── 6. comicPanels are copied across (user's ruling, "for now") ───────────────────────────
    // ⚠️ This duplicates image data inside lessons.json — the D4 violation item A exists to fix.
    // Asserted so the behaviour is explicit and item A's migration has something to find.
    {
      const bodies = made.map(t => ({ body: stored(env, t.id) }));
      const withPanels = bodies.filter(r => Array.isArray(r.body.comicPanels) && r.body.comicPanels.length);
      assert(withPanels.length === 1,
        'exactly the chapter whose SOURCE had panels gets panels (got ' + withPanels.length + ')');
      assert(withPanels[0].body.comicPanels[0].image === 'data:image/jpeg;base64,PANELA',
        'and the image is carried across verbatim');
      assert(withPanels[0].body.comicPanels[0].description === 'Een bord bij een hek.',
        'with its description — the field v88_d taught the pipeline to keep');
      console.log('  comicPanels are copied to the translated chapter: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  finally { try { env.stop(); } catch (_) {} }
  console.log(failed ? 'e2e-translate-storyline: FAILED' : 'e2e-translate-storyline: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
