#!/usr/bin/env node
// build-canonical-analysis.js -- CLI for PLAN §7.0 CP2: analysis report (lemma/form/phrase/
// sense/frequency/script proposals), report-only unless --write is given.
//
// Reads canonical-text.json (CP1's OWN output store -- not lessons.json directly: CP2 sits on top
// of CP1 in the migration sequence, and analysing a topic's story text a second, independent way
// would risk drifting from CP1's own sentence/token boundaries). Writes its own separate store,
// canonical-analysis.json, and NEVER touches canonical-text.json or lessons.json.
//
// Model calls are slow, so the default --limit is small (2 chapters) -- unlike build-canonical-
// text.js's cheap, deterministic 24-chapter default. Pass --chapter <id> to analyse one specific
// chapter, or --limit <n> / --all for a larger report-only run.
'use strict';
const fs = require('fs');
const path = require('path');
const { analyzeChapter, computeFrequency, CP2_PIPELINE_VERSION } = require('./canonical-analysis.js');

const ROOT = __dirname;
const CANONICAL_TEXT = path.join(ROOT, 'canonical-text.json');

const argv = process.argv.slice(2);
const outArgIdx = argv.indexOf('--out');
const OUT = outArgIdx >= 0 ? path.resolve(argv[outArgIdx + 1]) : path.join(ROOT, 'canonical-analysis.json');
const inArgIdx = argv.indexOf('--in');
const IN = inArgIdx >= 0 ? path.resolve(argv[inArgIdx + 1]) : CANONICAL_TEXT;
const WRITE = argv.includes('--write');
const ALL = argv.includes('--all');
const chapterArgIdx = argv.indexOf('--chapter');
const ONE_CHAPTER = chapterArgIdx >= 0 ? argv[chapterArgIdx + 1] : null;
const limitArgIdx = argv.indexOf('--limit');
const LIMIT = limitArgIdx >= 0 ? parseInt(argv[limitArgIdx + 1], 10) : 2;
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

let langsData = {};
try { langsData = require('./languages.json'); } catch (e) { langsData = {}; }
function langDisplayName(code) {
  return (langsData[code] && langsData[code].name) || code || 'the target language';
}

async function main() {
  if (!fs.existsSync(IN)) {
    console.error(`No canonical-text input at ${IN} -- run build-canonical-text.js --write first (CP2 sits on top of CP1's output).`);
    process.exit(1);
  }
  const store = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const allChapters = Object.values(store.chapters || {});
  let selected;
  if (ONE_CHAPTER) {
    selected = allChapters.filter(c => c.chapterId === ONE_CHAPTER);
    if (!selected.length) { console.error(`No chapter with id ${ONE_CHAPTER} in ${IN}`); process.exit(1); }
  } else {
    selected = ALL ? allChapters : allChapters.slice(0, LIMIT);
  }

  console.log(`PLAN §7.0 CP2 -- analysing ${selected.length} chapter(s) with model ${MODEL}`);
  const analyzed = [];
  for (const chapter of selected) {
    process.stdout.write(`  ${chapter.chapterId} (${chapter.lang}, ${chapter.sentenceCount} sentence(s))... `);
    const result = await analyzeChapter(MODEL, chapter, {
      langName: langDisplayName(chapter.lang),
      srcLangName: langDisplayName(chapter.srcLang),
    });
    let unresolved = 0, low = 0, phraseCount = 0;
    result.sentences.forEach(s => {
      s.tokens.forEach(t => { if (t.confidence === 'unresolved') unresolved++; else if (t.confidence === 'low') low++; });
      phraseCount += s.phrases.length;
    });
    console.log(`${result.tokenCount} token(s), ${phraseCount} phrase(s), ${low} low-confidence, ${unresolved} unresolved`);
    analyzed.push(result);
  }

  const lemmaFrequency = computeFrequency(analyzed);
  const chaptersOut = {};
  analyzed.forEach(a => { chaptersOut[a.chapterId] = a; });
  const out = {
    schemaVersion: 1,
    pipelineVersion: CP2_PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    model: MODEL,
    chapterCount: analyzed.length,
    chapters: chaptersOut,
    lemmaFrequency,
  };

  console.log(`\n${analyzed.length} chapter(s) analysed, ${Object.keys(lemmaFrequency).length} distinct lemma(s) proposed (in this sample).`);
  if (WRITE) {
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
    console.log(`Wrote ${OUT}`);
  } else {
    console.log(`(report-only -- pass --write to persist to ${OUT})`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
