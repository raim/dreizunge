#!/usr/bin/env node
// harvest-examples.js — turn ⭐-rated lesson items into per-language prompt examples.
//
//   node harvest-examples.js [lessons.json] [--out examples.json] [--verbose]
//
// Scans a Dreizunge lessons.json for items the user starred as good examples
// (item.userRating.at) and writes an examples.json mapping each in-scope prompt type to
// its starred items, keyed by the "<target>__<source>" language pair they were rated under:
//
//   { "wordForms": { "de__en": "<good-items block>" }, "synonyms": { … }, … }
//
// The server overlays this file on top of prompts.json (the shipped, curated layer): the
// {EXAMPLE} resolver prefers a harvested exact-pair example, then a curated per-language
// example, then the default. Because a harvested example is only ever served back to its
// own "<target>__<source>" pair, its baked-in {S} translations are always correct.
//
// Zero dependencies. ⭐ is the human quality signal; this tool adds a light structural
// check per type and skips (with --verbose, reports) items that are obviously malformed,
// but does not re-judge semantic quality. It does NOT import server.js — it only reshapes
// data. Re-runnable: the output is recomputed from lessons.json each run, so un-starring an
// item drops it on the next harvest. Curated/hand-written examples belong in prompts.json.

'use strict';

// Preamble for the {EXAMPLE} slot — identical in spirit to the curated examples in
// prompts.json. {L}/{S} are filled by the server at injection time.
const PRE = 'Good example items to imitate — match the JSON shape, field choices, and difficulty; ' +
  'produce all content in {L} and {S} as the schema and rules specify:';

// In-scope lesson types → the prompt that has an {EXAMPLE} slot, the array that holds its
// items, the schema fields to keep (everything else — userRating, qc, flags, editedAt — is
// stripped), and a light "is this structurally complete?" check.
const TYPES = {
  word_forms: {
    key: 'wordForms', arr: 'items',
    fields: ['sentence', 'translation', 'choices', 'correctIndex', 'explanation'],
    ok: it => typeof it.sentence === 'string' && /_{3,}/.test(it.sentence) &&
      Array.isArray(it.choices) && it.choices.filter(Boolean).length >= 2 &&
      Number.isInteger(it.correctIndex) && it.correctIndex >= 0 && it.correctIndex < it.choices.length,
  },
  synonyms: {
    key: 'synonyms', arr: 'words',
    fields: ['base', 'gloss', 'synonyms', 'antonyms', 'homophones'],
    ok: it => typeof it.base === 'string' && it.base.trim() && Array.isArray(it.synonyms),
  },
  grammar: {
    key: 'grammar', arr: 'grammar',
    fields: ['target', 'source', 'gender', 'article', 'plural'],
    ok: it => typeof it.target === 'string' && it.target.trim() &&
      typeof it.source === 'string' && it.source.trim(),
  },
  conjugation: {
    key: 'conjugation', arr: 'conjugations',
    fields: ['infinitive', 'source', 'tense', 'forms'],
    ok: it => typeof it.infinitive === 'string' && it.infinitive.trim() &&
      Array.isArray(it.forms) && it.forms.length >= 1,
  },
};

function pick(it, fields) {
  const o = {};
  for (const f of fields) if (it[f] !== undefined) o[f] = it[f];
  return o;
}

// Walk the store and collect starred items grouped by prompt key → "<L>__<S>" pair.
function harvest(store, opts = {}) {
  const grouped = {};            // { promptKey: { 'L__S': [strippedItem…] } }
  const topics = Array.isArray(store && store.topics) ? store.topics : [];
  let rated = 0, kept = 0, skipped = 0;
  for (const tp of topics) {
    const lang = tp && tp.lang, src = tp && tp.srcLang;
    if (!lang || !src) continue;                 // need a language pair to key on
    for (const ls of (tp.lessons || [])) {
      const spec = TYPES[ls && ls.type];
      if (!spec) continue;                       // not an {EXAMPLE}-enabled type
      const arr = Array.isArray(ls[spec.arr]) ? ls[spec.arr] : [];
      for (const it of arr) {
        if (!it || typeof it !== 'object' || !it.userRating || !it.userRating.at) continue;
        rated++;
        if (!spec.ok(it)) {
          skipped++;
          if (opts.verbose) process.stderr.write(`  skip (malformed ${ls.type}): ${JSON.stringify(it).slice(0, 70)}\n`);
          continue;
        }
        const pair = `${lang}__${src}`;
        const byPair = grouped[spec.key] || (grouped[spec.key] = {});
        (byPair[pair] || (byPair[pair] = [])).push(pick(it, spec.fields));
        kept++;
      }
    }
  }
  return { grouped, rated, kept, skipped };
}

// Render grouped items into the examples.json shape (one good-items block per pair).
function toExamplesFile(grouped) {
  const ex = {};
  for (const key of Object.keys(grouped)) {
    ex[key] = {};
    for (const pair of Object.keys(grouped[key])) {
      const items = grouped[key][pair];
      ex[key][pair] = PRE + '\n' + items.map(i => JSON.stringify(i)).join('\n');
    }
  }
  return ex;
}

function parseArgs(argv) {
  const o = { file: 'lessons.json', out: 'examples.json', verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i];
    else if (a === '--verbose' || a === '-v') o.verbose = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else if (!a.startsWith('-')) o.file = a;
  }
  return o;
}

if (require.main === module) {
  const fs = require('fs');
  const o = parseArgs(process.argv.slice(2));
  if (o.help) {
    process.stdout.write(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 21).join('\n') + '\n');
    process.exit(0);
  }
  let store;
  try { store = JSON.parse(fs.readFileSync(o.file, 'utf8')); }
  catch (e) { console.error(`harvest-examples: cannot read ${o.file}: ${e.message}`); process.exit(1); }
  const { grouped, rated, kept, skipped } = harvest(store, { verbose: o.verbose });
  const ex = toExamplesFile(grouped);
  const pairs = Object.values(ex).reduce((n, m) => n + Object.keys(m).length, 0);
  fs.writeFileSync(o.out, JSON.stringify(ex, null, 2) + '\n');
  console.error(`harvest-examples: ${rated} starred item(s) → ${kept} kept, ${skipped} skipped; ` +
    `${pairs} (type,pair) example block(s) → ${o.out}`);
}

module.exports = { harvest, toExamplesFile, TYPES, PRE };
