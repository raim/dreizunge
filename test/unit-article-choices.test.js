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
//
// v73_f — the metric is now split by LANGUAGE, because "more lessons build an article MCQ" stopped
// being the right thing to maximise. Six of the 19 were English, where the exercise has no answer:
// "which article fits `dream`?" offering a / an / the, when both "a dream" and "the dream" are
// correct. Those six were counted as a win by the old assertion. So the claim is now two claims —
// the table's removal must not cost coverage where the question is ANSWERABLE, and it must cost
// exactly all of it where the question is not.
{
  C.run(`APP.savedList = ${JSON.stringify(store.topics)}; true;`, 'seed-corpus');
  const byLang = {};      // lang -> { built, none }
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
      const rec = byLang[t.lang] = byLang[t.lang] || { built: 0, none: 0 };
      if (n > 0) rec.built++; else rec.none++;
    }
  }
  const total = Object.values(byLang).reduce((a, r) => a + r.built + r.none, 0);
  const built = Object.values(byLang).reduce((a, r) => a + r.built, 0);
  assert.ok(total >= 15, `the corpus really contains article lessons to measure (${total})`);

  // Where the article IS predictable from the noun, coverage must be complete — this is the v71_x
  // win, and the language the table never covered at all (it held de/fr/it/es/pt/nl/ru only).
  for (const lang of ['de', 'it', 'fr']) {
    const r = byLang[lang];
    if (!r) continue;
    assert.strictEqual(r.none, 0,
      `every ${lang} article lesson still builds an MCQ (${r.built} built, ${r.none} did not)`);
  }
  assert.ok(built >= 13,
    `article MCQs still build in at least 13 lessons (got ${built}); the removed table managed 15 ` +
    `across ALL languages, of which the English ones were unanswerable`);

  // …and where it is NOT predictable, none must build. This is the user-reported defect.
  const en = byLang.en;
  assert.ok(en && en.built + en.none >= 3,
    'the corpus still has English article lessons to prove the suppression on');
  assert.strictEqual(en.built, 0,
    'no English lesson builds an article MCQ — a/the is a definiteness choice the sentence makes, ' +
    'not a property of the noun, so there is no answer to mark correct');

  const shape = Object.entries(byLang).map(([l, r]) => `${l} ${r.built}/${r.built + r.none}`).join(', ');
  console.log(`  corpus: article MCQs build where answerable — ${shape}`);
}

// ── 4. Plural distractors are drawn, not manufactured (v73_h) ──────────────
// The builder used to pad a short distractor list with `x.plural + 'e'` — a German pluralisation
// fact (Hund → Hunde) sitting in a language-neutral builder. In English it produced "bookse": a
// non-word, rejectable on sight, so the padding made the question EASIER than a real distractor
// would. Exactly the ARTICLE_CHOICES defect one function further down, and it survived v71_x
// because that pass was looking for a table and this was an expression.
{
  const seenChoices = [];
  let built = 0;
  for (const t of store.topics) {
    const ls = t.lessons || [];
    for (const L of ls) {
      if (!L || L.type !== 'grammar') continue;
      const withPl = (L.grammar || []).filter(g => g && g.plural);
      if (!withPl.length) continue;
      C.run(`APP.lessonData = ${JSON.stringify(t)}; APP.lang = ${JSON.stringify(t.lang)};
             APP.srcLang = ${JSON.stringify(t.srcLang)}; true;`);
      const exs = JSON.parse(C.run(
        `JSON.stringify(buildGrammarExercises(${JSON.stringify(L)}).filter(e => e.type === 'mcq_plural'))`));
      exs.forEach(e => { built++; seenChoices.push({ lang: t.lang, correct: e.correct, choices: e.choices }); });
    }
  }
  assert.ok(built >= 10, `the corpus builds plural MCQs to inspect (${built})`);

  // Every distractor must be a plural that EXISTS somewhere in the corpus for that language. A
  // manufactured one cannot satisfy this, which is the whole assertion.
  const realPlurals = {};
  for (const t of store.topics) {
    for (const L of t.lessons || []) {
      if (!L || L.type !== 'grammar') continue;
      for (const g of L.grammar || []) {
        if (g && g.plural) (realPlurals[t.lang] = realPlurals[t.lang] || new Set()).add(g.plural);
      }
    }
  }
  const invented = [];
  for (const { lang, correct, choices } of seenChoices) {
    for (const c of choices) {
      if (c === correct) continue;
      if (!(realPlurals[lang] || new Set()).has(c)) invented.push(`${lang}: "${c}"`);
    }
  }
  assert.deepStrictEqual(invented.slice(0, 5), [],
    'every plural distractor is a real plural from the corpus, not a form the builder invented');

  // The correct answer must not also arrive as a distractor. It can: a different item may carry the
  // same plural, and the corpus draw would then offer it twice — two identical options, one of
  // which is right, which is a broken question rather than a hard one.
  const dupes = seenChoices
    .filter(s => new Set(s.choices).size !== s.choices.length)
    .map(s => `${s.lang}: ${JSON.stringify(s.choices)}`);
  assert.deepStrictEqual(dupes.slice(0, 3), [],
    'no plural MCQ offers the same option twice');
  const missing = seenChoices.filter(s => !s.choices.includes(s.correct));
  assert.strictEqual(missing.length, 0, 'and the correct answer is always among the options');

  // Asserted on the helper directly. The corpus draw only fires for the handful of lessons holding
  // fewer than three plurals of their own, so relying on it to surface a leaked correct answer
  // makes the guarantee hostage to which chapters happen to be in lessons.json.
  {
    const probe = { topic: 'PluralProbe', lang: 'de', srcLang: 'en', lessons: [{ id: 'p1', type: 'grammar',
      grammar: [ { target: 'Hund', plural: 'Hunde' }, { target: 'Katze', plural: 'Katzen' },
                 { target: 'Rüde', plural: 'Hunde' } ] }] };
    C.run(`APP.lessonData = ${JSON.stringify(probe)}; APP.lang='de'; APP.srcLang='en';
           APP.savedList = ${JSON.stringify([probe])}; true;`, 'seed-plural-probe');
    const got = C.run(`_pluralChoicesFor('de', APP.lessonData.lessons[0].grammar, 'Hunde')`);
    assert.ok(!got.includes('Hunde'),
      'the excluded plural never comes back as a distractor — two nouns sharing one plural is real ' +
      '(der/die Angestellte), so this is not a hypothetical');
    assert.ok(got.includes('Katzen'), 'while the others still do');
  }

  // …and the specific mechanism is gone from the source, because a corpus that happens to contain
  // the padded form would let the check above pass while the defect remained.
  const grammarFn = html.slice(html.indexOf('function buildGrammarExercises('));
  assert.ok(!/\.plural\s*\+\s*'e'/.test(grammarFn.slice(0, grammarFn.indexOf('\n}\n'))),
    "the '+ e' padding is removed, not merely unreachable");
  console.log(`  plural MCQs: ${built} built, ${seenChoices.reduce((a, s) => a + s.choices.length - 1, 0)} distractors, all real`);
}

console.log('unit-article-choices: ALL PASSED');
