#!/usr/bin/env node
// build-canonical-text.js -- CLI wrapper for PLAN section 7.0 CP1: canonical text + analysis
// records, REPORT-ONLY. Runs the pure core in canonical-text.js over a SMALL REPRESENTATIVE
// selection of the corpus (per the plan's own acceptance bar), and writes the result to its own
// SEPARATE store, canonical-text.json -- never to lessons.json.
//
// Same CLI convention as backfill-script.js: report-only by default, --write to persist.
//
//   node build-canonical-text.js                # report only, writes nothing (default: a small
//                                                # representative sample spanning every language
//                                                # currently in the corpus)
//   node build-canonical-text.js --write         # writes canonical-text.json
//   node build-canonical-text.js --all --write    # analyse the WHOLE corpus, not just the sample
//   node build-canonical-text.js --topic tp_XYZ   # analyse one specific topic by id
//   node build-canonical-text.js --limit 40       # cap the sample size (default 24)
//   node build-canonical-text.js --write --out /tmp/x.json   # write somewhere other than the
//                                                              # committed canonical-text.json —
//                                                              # what the test suite uses, so a
//                                                              # test run never resizes the real,
//                                                              # committed artifact
'use strict';
const fs = require('fs');
const path = require('path');
const { buildCanonicalText, CP1_PIPELINE_VERSION } = require('./canonical-text.js');

const ROOT = __dirname;
const LESSONS = path.join(ROOT, 'lessons.json');
const argv = process.argv.slice(2);
const outArgIdx = argv.indexOf('--out');
const OUT = outArgIdx >= 0 ? path.resolve(argv[outArgIdx + 1]) : path.join(ROOT, 'canonical-text.json');

const WRITE = argv.includes('--write');
const ALL = argv.includes('--all');
const topicArgIdx = argv.indexOf('--topic');
const ONE_TOPIC = topicArgIdx >= 0 ? argv[topicArgIdx + 1] : null;
const limitArgIdx = argv.indexOf('--limit');
const LIMIT = limitArgIdx >= 0 ? parseInt(argv[limitArgIdx + 1], 10) : 24;

const store = JSON.parse(fs.readFileSync(LESSONS, 'utf8'));
const topics = store.topics || [];

// A representative sample: as many DISTINCT (lang) values as fit within LIMIT, one topic per
// language first (so a small run always exercises every tokeniser code path currently live in the
// corpus -- in particular the CJK branch, which only 'ja' currently reaches), THEN fill any
// remaining budget with further topics in file order. Deterministic (no randomness), so two runs
// over an unchanged corpus select the same sample.
function representativeSample(all, limit) {
  const byLang = new Map();
  all.forEach(t => { if (t && t.story && t.lang) { if (!byLang.has(t.lang)) byLang.set(t.lang, []); byLang.get(t.lang).push(t); } });
  const picked = [], seen = new Set();
  for (const [, list] of byLang) {
    if (picked.length >= limit) break;
    picked.push(list[0]); seen.add(list[0].id);
  }
  for (const t of all) {
    if (picked.length >= limit) break;
    if (t && t.story && !seen.has(t.id)) { picked.push(t); seen.add(t.id); }
  }
  return picked;
}

let selected;
if (ONE_TOPIC) {
  const t = topics.find(x => x.id === ONE_TOPIC);
  if (!t) { console.error('No topic with id ' + ONE_TOPIC); process.exit(1); }
  selected = [t];
} else if (ALL) {
  selected = topics.filter(t => t && t.story);
} else {
  selected = representativeSample(topics, LIMIT);
}

const chapters = {};
const errors = [];
let sentenceTotal = 0, tokenTotal = 0;
const byLangCount = {};
for (const t of selected) {
  try {
    const rec = buildCanonicalText(t);
    chapters[rec.chapterId] = rec;
    sentenceTotal += rec.sentenceCount;
    tokenTotal += rec.tokenCount;
    byLangCount[rec.lang] = (byLangCount[rec.lang] || 0) + 1;
  } catch (e) {
    errors.push({ topicId: t.id, topic: t.topic, error: e.message });
  }
}

console.log('CP1 canonical-text analysis');
console.log('============================================');
console.log('  Source        : ' + LESSONS);
console.log('  Corpus size   : ' + topics.length + ' topics');
console.log('  Selected      : ' + selected.length + (ONE_TOPIC ? ' (--topic)' : ALL ? ' (--all)' : ' (representative sample, --limit ' + LIMIT + ')'));
console.log('  Languages hit : ' + Object.keys(byLangCount).sort().join(', '));
console.log('  Sentences     : ' + sentenceTotal);
console.log('  Tokens        : ' + tokenTotal);
if (errors.length) {
  console.log('  Errors        : ' + errors.length);
  errors.forEach(e => console.log('    - ' + e.topicId + ' (' + e.topic + '): ' + e.error));
}
console.log('============================================');

if (WRITE) {
  const out = {
    schemaVersion: 1,
    pipelineVersion: CP1_PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    sourceCorpusSize: topics.length,
    chapterCount: Object.keys(chapters).length,
    chapters,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log('  Wrote ' + OUT + ' (' + Object.keys(chapters).length + ' chapters)');
} else {
  console.log('  Report only -- nothing written. Re-run with --write to persist to ' + path.basename(OUT) + '.');
}

// Non-negotiable, asserted here as well as in the test suite: this script NEVER writes lessons.json
// (or any other existing store) -- it is not imported, not required, not opened for writing anywhere
// above. If a future edit adds such a write, this comment is where to look for why it should not.
