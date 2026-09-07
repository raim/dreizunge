// e2e-translation-edit.test.js — v90_g
//
// User: "allow to edit translations on lesson-set pages (teacher view). This could be an option of
// the re-translate button: the user gets offered to edit an existing translation or to use the LLM
// to re-translate." The client half is guarded in unit-story-translation-toggle; this is the route
// that persists the edit.
//
// ⚠️ WHY THE ROUTE IS ITS OWN AND NOT A FIELD ON /api/save-story. That route's body sets `aiStory`
// on first save, collapses an edited story into a single comic panel's caption, invalidates curator
// corrections keyed on sentence text, and regenerates the AI error hunt. All four are about the
// TARGET story. Running them for a source-language translation edit would rewrite a comic caption
// with prose from the other language. §3 is the assertion that keeps them apart.
'use strict';
// ⚠️ lib.js exports its OWN one-argument `assert(cond, msg)`; the node module is what carries
// strictEqual/deepStrictEqual. Both are wanted here, so both are imported under clear names.
const { boot, post } = require('./lib');
const assert = require('assert');

const SEED = {
  schemaVersion: 29, storylines: [], flags: {}, progress: {},
  topics: [{
    id: 'tp_x', topic: 'Het Huis', lang: 'nl', srcLang: 'de',
    story: 'Het huis is groot. De deur is rood.',
    aiStory: 'Het huis is groot. De deur is rood.',
    storyTranslation: 'Das Haus ist gross. Die Tür ist rot.',
    storyMeta: { type: 'story', model: 'fake:1', origin: 'generated', source: 'test seed' },
    translationMeta: { type: 'translation', model: 'fake:1', origin: 'generated', source: 'test seed' },
    comicPanels: [{ caption: 'Het huis is groot.', inScene: 'De deur is rood.' }],
    lessons: [{ id: 'l1', type: 'standard', vocab: [{ target: 'huis', source: 'Haus' }] }],
  }],
};

let failed = false;
(async () => {
  const env = await boot({ seed: SEED });
  const T = () => env.readStore().topics[0];
  try {
    // ── 1. The edit lands, and it is addressable both ways the client might send it ──────────
    {
      const r = await post(env.sport, '/api/save-translation',
        { topicId: 'tp_x', translation: '  Das Haus ist GROSS. Die Tür ist rot.  ' });
      assert.strictEqual(r.status, 200, 'a valid edit is accepted');
      assert.strictEqual(r.body.storyTranslation, 'Das Haus ist GROSS. Die Tür ist rot.',
        'the saved value comes back TRIMMED — the client renders what the server stored');
      assert.strictEqual(T().storyTranslation, 'Das Haus ist GROSS. Die Tür ist rot.', 'and it is persisted');

      const byName = await post(env.sport, '/api/save-translation',
        { topic: 'Het Huis', translation: 'Per Name gespeichert.' });
      assert.strictEqual(byName.status, 200, 'a topic NAME works too (the lesson-set page sends both)');
      assert.strictEqual(T().storyTranslation, 'Per Name gespeichert.');
      console.log('  the edit persists, by id and by name, trimmed');
    }

    // ── 2. The stamp says a PERSON wrote it ─────────────────────────────────────────────────
    // unit-translation-stamp asserts over the whole corpus that every stamp records where its value
    // came from. A hand-edited translation was written by nobody's model.
    {
      const m = T().translationMeta;
      assert.strictEqual(m.model, '(user-provided)', 'credited to no model…');
      assert.strictEqual(m.origin, 'user-provided', '…with the origin to match');
      assert.ok(m.source && /hand/i.test(m.source), 'and a source that says how it got here');
      assert.strictEqual(m.type, 'translation', 'still a translation stamp');
      assert.ok(T().updatedAt, 'the chapter is stamped as updated');
      console.log('  the stamp records a human author, not a model');
    }

    // ── 3. ⚠️ AND IT TOUCHES NOTHING ELSE ───────────────────────────────────────────────────
    // The whole reason this is not a flag on /api/save-story.
    {
      const t = T();
      assert.strictEqual(t.story, SEED.topics[0].story, 'the target story is untouched');
      assert.strictEqual(t.aiStory, SEED.topics[0].aiStory, 'so is the immutable original');
      assert.deepStrictEqual(t.comicPanels, SEED.topics[0].comicPanels,
        '⚠️ and the comic panels — /api/save-story would have collapsed them into one caption');
      assert.deepStrictEqual(t.storyMeta, SEED.topics[0].storyMeta, 'the STORY stamp is not rewritten');
      assert.strictEqual(t.lessons.length, 1, 'and no lesson was regenerated');
      console.log('  story, aiStory, comic panels, story stamp and lessons all untouched');
    }

    // ── 4. Refusals, each leaving the stored translation alone ──────────────────────────────
    {
      const before = T().storyTranslation;
      for (const [label, payload, code] of [
        ['no topic at all',   { translation: 'x' },                              400],
        ['no translation',    { topicId: 'tp_x' },                               400],
        ['a non-string',      { topicId: 'tp_x', translation: 42 },              400],
        ['an empty one',      { topicId: 'tp_x', translation: '   \n  ' },       400],
        ['an unknown topic',  { topicId: 'tp_nope', translation: 'x' },          404],
      ]) {
        const r = await post(env.sport, '/api/save-translation', payload);
        assert.strictEqual(r.status, code, `${label} → ${code}`);
        assert.ok(r.body.error, `${label}: and says why`);
        assert.strictEqual(T().storyTranslation, before, `${label}: the stored value is unchanged`);
      }
      console.log('  malformed requests are refused and change nothing');
    }

    // ── 5. It works with no model available ─────────────────────────────────────────────────
    // A person typing must not depend on a backend. (The seeded server HAS a fake Ollama, so this
    // asserts the route carries no `active === 'none'` gate of its own — the one /api/retranslate-
    // story does carry, deliberately, because that one calls a model.)
    {
      const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8');
      const at = src.indexOf("url.pathname === '/api/save-translation'");
      assert.ok(at > 0, 'the route is found');
      const body = src.slice(at, src.indexOf("url.pathname === '/api/lessons/edit'", at));
      assert.ok(!/No LLM backend available/.test(body),
        'no backend gate — editing by hand must work while the model is down');
      assert.ok(!/runAsJob/.test(body), 'and no job wrapper: there is nothing long-running to track');
      console.log('  no backend gate and no job wrapper — it is a human typing');
    }
  } catch (e) {
    failed = true;
    console.error(e && e.stack || e);
  } finally {
    await env.stop();
  }
  if (!failed) console.log('e2e-translation-edit: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
