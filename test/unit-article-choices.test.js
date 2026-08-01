// v71_x: article MCQ distractors come from the DATA, not from a table in the code.
//
// Session-23 design principle: the code must not encode facts about particular human languages.
// `ARTICLE_CHOICES` was a clear violation — it asserted "German has der/die/das" (nominative only,
// so wrong the moment a lesson uses another case) and carried `ru: ['м','ж','с']`, gender labels
// standing in for articles, which is the code holding a theory about a language.
//
// The replacement is not a compromise. Measured against the bundled corpus, deriving distractors
// from every article the model has actually produced in that language builds article MCQs in
// **19 of 20** grammar lessons, against **15 of 20** with the table — because the table covered
// de/fr/it/es/pt/nl/ru and nothing else, so English lessons could never build one at all.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed-static');

// ── 1. The table is gone and nothing like it came back ─────────────────────
{
  assert.ok(!/const ARTICLE_CHOICES = \{/.test(html), 'the hardcoded article table is gone');
  // Pinned against CODE, not prose: the comment explaining the removal quotes the old entry, so a
  // bare search for the string matches the very note saying it is gone. (Same trap as v71_t's
  // MAX_STORY_CHARS assertion.)
  assert.ok(!/^\s*ru: \['м','ж','с'\]/m.test(html), 'and so is the gender-label stand-in');
  assert.ok(/function _articleChoicesFor\(lang, items\)/.test(html),
    'distractors come from a data-derived helper');
  // The helper must not grow its own table.
  const fn = html.slice(html.indexOf('function _articleChoicesFor(lang, items)'));
  const body = fn.slice(0, fn.indexOf('\n}') + 2);
  assert.ok(!/\bde:\s*\[|\bfr:\s*\[|\bit:\s*\[|\bes:\s*\[/.test(body),
    'and the helper itself encodes no per-language list');
}

// ── 2. It draws on the corpus, nearest source first ────────────────────────
{
  const topic = {
    topic: 'ArtProbe', lang: 'de', srcLang: 'en',
    lessons: [{ id: 'g1', type: 'grammar', grammar: [
      { target: 'Hund', source: 'dog', gender: 'm', article: 'der', plural: 'Hunde' },
      { target: 'Mann', source: 'man', gender: 'm', article: 'der', plural: 'Männer' },
    ] }],
  };
  // A same-language sibling elsewhere in the store carries the other articles.
  const other = { topic: 'ArtOther', lang: 'de', srcLang: 'en', lessons: [{ id: 'g2', type: 'grammar',
    grammar: [ { target: 'Katze', source: 'cat', gender: 'f', article: 'die' },
               { target: 'Haus',  source: 'house', gender: 'n', article: 'das' } ] }] };
  C.run(`APP.lessonData = ${JSON.stringify(topic)}; APP.lang='de'; APP.srcLang='en';
    APP.savedList = ${JSON.stringify([topic, other])}; true;`, 'seed-probe');
  const got = C.run(`_articleChoicesFor('de', APP.lessonData.lessons[0].grammar)`);
  assert.ok(got.includes('der'), "the lesson's own article is present");
  assert.ok(got.includes('die') && got.includes('das'),
    'and the others are learned from the corpus, not from a table — so a lesson whose items are ' +
    'all one gender can still be asked a real question');
  // A language with nothing in the store yields nothing — no invented distractors.
  const empty = C.run(`_articleChoicesFor('xx', [])`);
  // Length, not deepStrictEqual: values cross the vm realm boundary, so an array built inside the
  // sandbox has a DIFFERENT Array.prototype and deepStrictEqual([], []) fails on the prototype
  // check alone. (Harness quirk — recorded in INTERNALS.)
  assert.strictEqual(empty.length, 0,
    'an unseen language yields no distractors rather than a guess');
  console.log(`  derived choices for de: ${JSON.stringify(got)}`);
}

// ── 3. Corpus-wide: strictly better than the table it replaced ─────────────
// The number is the argument. If a future change drops it, this fails with the count.
{
  C.run(`APP.savedList = ${JSON.stringify(store.topics)}; true;`, 'seed-corpus');
  let built = 0, none = 0;
  for (const t of store.topics) {
    const ls = t.lessons || [];
    for (let i = 0; i < ls.length; i++) {
      const L = ls[i];
      if (!L || L.type !== 'grammar') continue;
      if (!(L.grammar || []).some(x => x.article)) continue;
      C.run(`APP.lessonData = ${JSON.stringify(t)}; APP.lang = ${JSON.stringify(t.lang)};
        APP.srcLang = ${JSON.stringify(t.srcLang)};
        APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
        APP.progress = { completed:{}, solved:{}, learned:{} };
        APP.progress.solved[APP.lessonData.topic] = {};
        APP.cur.lessonIdx = ${i}; APP._teacherMode = false;
        if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse(); true;`);
      const n = C.run(`(function(){ APP._derivingUniverse = true;
        const e = buildExercises(${i}); APP._derivingUniverse = false;
        return e.filter(x => x.type === 'mcq_article').length; })()`);
      if (n > 0) built++; else none++;
    }
  }
  assert.ok(built + none >= 15, `the corpus really contains article lessons to measure (${built + none})`);
  assert.ok(built >= 19,
    `article MCQs build in at least 19 lessons (got ${built}); the removed table managed 15`);
  assert.ok(none <= 1,
    `at most one lesson builds none — Hebrew, which has a single definite article and no ` +
    `indefinite, so there is genuinely nothing to draw a distractor from (got ${none})`);
  console.log(`  corpus: article MCQs build in ${built} lesson(s), none in ${none} (table managed 15)`);
}

console.log('unit-article-choices: ALL PASSED');
