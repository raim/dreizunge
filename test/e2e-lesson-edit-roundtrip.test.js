// e2e-lesson-edit-roundtrip.test.js
// v75_e — EVERY lesson type's editable content must survive /api/lessons/edit.
//
// User-reported: a comprehension question was edited and saved; it held while the editor stayed
// open, then vanished on the next load from the server, and the stored diff showed nothing but a
// fresh `updatedAt`. Cause: the server's merge is a WHITELIST of content fields, and `questions`
// was not on it, so the edit was accepted with HTTP 200 and dropped. Measured across all eleven
// registry types before the fix: 6 of 16 field edits lost — all four comprehension fields
// (`q`, `choices`, `correctIndex`, `why`) and both math fields (`numbers`, `mathOps`).
//
// Nothing caught it because the existing edit tests each cover ONE type. A whitelist fails
// silently and per-type, so the guard has to be per-type too — and it has to be driven off the
// client's LESSON_TYPE_META, or the next lesson type repeats this exactly.
//
// Why e2e and not a source assertion: this is a wiring change (client sends, server stores). The
// v71_u rule applies — assertions on each half prove nothing about the join, and the whole point
// is what ends up on disk. Every case below reads the STORE after the POST.
const { boot, post, assert, ROOT } = require('./lib');
const fs = require('fs');
const path = require('path');

const SEED = {
  schemaVersion: 29,
  topics: [{
    id: 't_e', topic: 'Edit Roundtrip', userTopic: 'Edit Roundtrip', lang: 'de', srcLang: 'en',
    difficulty: 2, story: 'Es war einmal ein Test.',
    lessons: [
      { id: 'l_std', type: 'standard', title: 'V', vocab: [{ target: 'Haus', source: 'house' }],
        sentences: [{ target: 'Das Haus ist gross', source: 'the house is big', words: ['Das','Haus','ist','gross'] }] },
      { id: 'l_comp', type: 'comprehension', title: 'C',
        questions: [{ q: 'ORIGINAL question?', choices: ['a','b','c','d'], correctIndex: 1, why: 'ORIGINAL why' }] },
      { id: 'l_math', type: 'math', title: 'M', numbers: [2,3,4], mathOps: ['+','-'] },
      { id: 'l_wf', type: 'word_forms', title: 'W',
        items: [{ sentence: 'ORIGINAL ___.', choices: ['a','b','c','d'], correctIndex: 0, translation: 'ORIG tr' }] },
      { id: 'l_infl', type: 'inflections', title: 'N',
        items: [{ sentence: 'ORIGINAL Köpfe der Männer.', surfaceForm: 'Köpfe', lemma: 'der Kopf',
          lemmaChoices: ['der Kopf', 'die Hand'], lemmaCorrectIndex: 0,
          formLabel: 'plural', formChoices: ['plural', 'singular'], formCorrectIndex: 0,
          translation: 'ORIG tr', explanation: 'ORIG expl' }] },
      { id: 'l_syn', type: 'synonyms', title: 'S',
        words: [{ base: 'Haus', gloss: 'house', synonyms: [{ w: 'Heim', g: 'home' }] }] },
      { id: 'l_gr', type: 'grammar', title: 'G', grammar: [{ word: 'Haus', article: 'das', plural: 'Häuser' }] },
      { id: 'l_conj', type: 'conjugation', title: 'K',
        conjugations: [{ infinitive: 'sein', forms: [{ person: 'ich', form: 'bin' }] }] },
      { id: 'l_intro', type: 'intro_script', title: 'I', letters: [{ ch: 'A', lower: 'a', name: 'a' }] },
      { id: 'l_eh', type: 'error_hunt', title: 'E', corruptedStory: 'ORIGINAL corrupt',
        edits: [{ find: 'x', replace: 'y' }] },
      { id: 'l_aieh', type: 'ai_error_hunt', title: 'A', corruptedStory: 'ORIGINAL ai corrupt' },
      { id: 'l_mix', type: 'mixed', title: 'X', perType: 3 },
      { id: 'l_wr', type: 'writing', title: 'Y', prompt: 'ORIGINAL Schreibe über dein Haus.', hint: 'ORIGINAL Write about your house.' },
    ],
    generatedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }],
  storylines: [], flags: {}, progress: {},
};

// One case per EDITABLE field the client's editor writes for that type. `vocab` covers both
// `standard` and its `vocab` alias, which share an editor branch.
const CASES = [
  ['standard',      'l_std',   'vocab[0].target',              l => { l.vocab[0].target = 'EDITED'; },                 s => s.vocab[0].target === 'EDITED'],
  ['standard',      'l_std',   'sentences[0].target',          l => { l.sentences[0].target = 'EDITED s'; },           s => s.sentences[0].target === 'EDITED s'],
  ['standard',      'l_std',   'title',                        l => { l.title = 'EDITED title'; },                     s => s.title === 'EDITED title'],
  ['comprehension', 'l_comp',  'questions[0].q',               l => { l.questions[0].q = 'EDITED question?'; },        s => s.questions[0].q === 'EDITED question?'],
  ['comprehension', 'l_comp',  'questions[0].choices[0]',      l => { l.questions[0].choices[0] = 'EDITED choice'; },  s => s.questions[0].choices[0] === 'EDITED choice'],
  ['comprehension', 'l_comp',  'questions[0].correctIndex',    l => { l.questions[0].correctIndex = 3; },              s => s.questions[0].correctIndex === 3],
  ['comprehension', 'l_comp',  'questions[0].why',             l => { l.questions[0].why = 'EDITED why'; },            s => s.questions[0].why === 'EDITED why'],
  ['math',          'l_math',  'numbers',                      l => { l.numbers = [7,8,9]; },                          s => JSON.stringify(s.numbers) === '[7,8,9]'],
  ['math',          'l_math',  'mathOps',                      l => { l.mathOps = ['×','÷']; },                        s => JSON.stringify(s.mathOps) === '["×","÷"]'],
  ['word_forms',    'l_wf',    'items[0].sentence',            l => { l.items[0].sentence = 'EDITED ___.'; },          s => s.items[0].sentence === 'EDITED ___.'],
  ['inflections',   'l_infl',  'items[0].surfaceForm',         l => { l.items[0].surfaceForm = 'EDITED'; },            s => s.items[0].surfaceForm === 'EDITED'],
  ['inflections',   'l_infl',  'items[0].lemmaChoices[0]',     l => { l.items[0].lemmaChoices[0] = 'EDITED lemma'; },  s => s.items[0].lemmaChoices[0] === 'EDITED lemma'],
  ['inflections',   'l_infl',  'items[0].formChoices[0]',      l => { l.items[0].formChoices[0] = 'EDITED form'; },    s => s.items[0].formChoices[0] === 'EDITED form'],
  ['synonyms',      'l_syn',   'words[0].base',                l => { l.words[0].base = 'EDITED'; },                   s => s.words[0].base === 'EDITED'],
  ['grammar',       'l_gr',    'grammar[0].article',           l => { l.grammar[0].article = 'die'; },                 s => s.grammar[0].article === 'die'],
  ['conjugation',   'l_conj',  'conjugations[0].forms[0].form',l => { l.conjugations[0].forms[0].form = 'EDITED'; },   s => s.conjugations[0].forms[0].form === 'EDITED'],
  ['intro_script',  'l_intro', 'letters[0].name',              l => { l.letters[0].name = 'EDITED'; },                 s => s.letters[0].name === 'EDITED'],
  ['error_hunt',    'l_eh',    'corruptedStory',               l => { l.corruptedStory = 'EDITED corrupt'; },          s => s.corruptedStory === 'EDITED corrupt'],
  ['ai_error_hunt', 'l_aieh',  'corruptedStory',               l => { l.corruptedStory = 'EDITED ai'; },               s => s.corruptedStory === 'EDITED ai'],
  ['mixed',         'l_mix',   'perType',                      l => { l.perType = 5; },                                s => s.perType === 5],
  ['writing',       'l_wr',    'prompt',                       l => { l.prompt = 'EDITED prompt'; },                   s => s.prompt === 'EDITED prompt'],
  ['writing',       'l_wr',    'hint',                         l => { l.hint = 'EDITED hint'; },                       s => s.hint === 'EDITED hint'],
];

(async () => {
  const env = await boot({ seed: SEED });
  let failed = false;
  try {
    // ── Registry coverage: this file must cover EVERY type the client can edit ──────────────
    // Without it the guard rots the moment a lesson type is added — which is precisely how the
    // reported bug reached a user: the whitelist and the registry drifted and nothing compared
    // them. Read from the client source, so the two cannot disagree.
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const block = html.slice(html.indexOf('const LESSON_TYPE_META = {'));
    const registryTypes = [...block.slice(0, block.indexOf('\n};')).matchAll(/^\s{2}([a-z_]+):\s*\{/gm)].map(m => m[1]);
    assert(registryTypes.length >= 10,
      'the registry parsed (' + registryTypes.length + ' types) — if this drops to nothing the ' +
      'coverage check below is vacuous and this file stops guarding new types');
    const covered = new Set(CASES.map(c => c[0]));
    // `vocab` is an alias of `standard` (same editor branch, same content fields).
    const uncovered = registryTypes.filter(t => t !== 'vocab' && !covered.has(t));
    assert(uncovered.length === 0,
      'every lesson type in LESSON_TYPE_META has a round-trip case here; uncovered: ' + uncovered.join(', '));

    // ── The round-trip itself ───────────────────────────────────────────────────────────────
    const lost = [];
    for (const [type, id, label, mutate, check] of CASES) {
      // A fresh copy of the FULL lesson array each time — that is what the client posts, and a
      // per-lesson post would not exercise the index/id pairing the merge does.
      const lessons = JSON.parse(JSON.stringify(SEED.topics[0].lessons));
      mutate(lessons.find(l => l.id === id));
      const r = await post(env.sport, '/api/lessons/edit', { id: 't_e', lessons });
      assert(r.status === 200, `${type}.${label}: edit accepted (got ${r.status})`);
      const stored = env.readStore().topics.find(t => t.id === 't_e').lessons.find(l => l.id === id);
      let ok = false;
      try { ok = !!check(stored); } catch (_) { ok = false; }
      if (!ok) lost.push(`${type}.${label}`);
    }
    assert(lost.length === 0,
      'every edited field is on disk after the save. LOST (accepted with 200, stored unchanged): ' +
      lost.join(', '));
    console.log(`  ${CASES.length} field edits across ${covered.size} lesson types: all persisted`);

    // ── The failure mode, stated directly: a 200 is not evidence of a save ──────────────────
    // The reported symptom was that only `updatedAt` moved. Assert the content moved WITH it, so
    // a future whitelist gap cannot pass by touching the timestamp alone.
    {
      const lessons = JSON.parse(JSON.stringify(SEED.topics[0].lessons));
      lessons.find(l => l.id === 'l_comp').questions[0].q = 'Warum … Laubfrosch?';
      const before = env.readStore().topics.find(t => t.id === 't_e').updatedAt;
      await post(env.sport, '/api/lessons/edit', { id: 't_e', lessons });
      const after = env.readStore().topics.find(t => t.id === 't_e');
      assert(after.updatedAt !== before, 'the save stamped updatedAt (non-vacuity: a save happened)');
      assert(after.lessons.find(l => l.id === 'l_comp').questions[0].q === 'Warum … Laubfrosch?',
        'and the question text moved with it — not updatedAt alone, which was the reported symptom');
    }
    console.log('  a save moves content, not just updatedAt: OK');
    console.log('e2e-lesson-edit-roundtrip: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('FAIL: ' + (e && e.message ? e.message : e));
  } finally {
    await env.stop();
  }
  process.exit(failed ? 1 : 0);
})();
