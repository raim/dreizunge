#!/usr/bin/env node
// build-curriculum-lesson.js -- CLI for PLAN §7.0 CP4: one lesson family (vocabulary meaning/form)
// through the existing contract, report-only unless --write is given. NEVER touches lessons.json —
// this is a NEW, PARALLEL emission route, the legacy generator is completely untouched.
//
// Reads CP3's OWN curriculum-plan.json as input (not canonical-analysis.json or lessons.json
// directly -- CP4 sits on top of CP3's already-ordered, already-evidenced concepts). Writes its own
// separate store, curriculum-lesson.json.
'use strict';
const fs = require('fs');
const path = require('path');
const { emitChapterLessons, CP4_PIPELINE_VERSION } = require('./curriculum-lesson.js');

const ROOT = __dirname;
const CURRICULUM_PLAN = path.join(ROOT, 'curriculum-plan.json');

const argv = process.argv.slice(2);
const outArgIdx = argv.indexOf('--out');
const OUT = outArgIdx >= 0 ? path.resolve(argv[outArgIdx + 1]) : path.join(ROOT, 'curriculum-lesson.json');
const inArgIdx = argv.indexOf('--in');
const IN = inArgIdx >= 0 ? path.resolve(argv[inArgIdx + 1]) : CURRICULUM_PLAN;
const WRITE = argv.includes('--write');
const chapterArgIdx = argv.indexOf('--chapter');
const ONE_CHAPTER = chapterArgIdx >= 0 ? argv[chapterArgIdx + 1] : null;
const limitArgIdx = argv.indexOf('--limit');
const LIMIT = limitArgIdx >= 0 ? parseInt(argv[limitArgIdx + 1], 10) : 0;   // 0 = every chapter in the input
const maxItemsArgIdx = argv.indexOf('--max-items');
const MAX_ITEMS = maxItemsArgIdx >= 0 ? parseInt(argv[maxItemsArgIdx + 1], 10) : 8;

function main() {
  if (!fs.existsSync(IN)) {
    console.error(`No curriculum-plan input at ${IN} -- run build-curriculum-plan.js --write first (CP4 sits on top of CP3's output).`);
    process.exit(1);
  }
  const store = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const allChapters = Object.values(store.chapters || {});
  let selected;
  if (ONE_CHAPTER) {
    selected = allChapters.filter(c => c.chapterId === ONE_CHAPTER);
    if (!selected.length) { console.error(`No chapter with id ${ONE_CHAPTER} in ${IN}`); process.exit(1); }
  } else {
    selected = LIMIT > 0 ? allChapters.slice(0, LIMIT) : allChapters;
  }

  console.log(`PLAN §7.0 CP4 -- emitting vocabulary lessons for ${selected.length} chapter(s)`);
  const chapters = {};
  let skipped = 0;
  selected.forEach(plan => {
    let result;
    try { result = emitChapterLessons(plan, { maxItems: MAX_ITEMS }); }
    catch (e) { skipped++; console.log(`  ${plan.chapterId}: SKIPPED — ${e.message}`); return; }
    chapters[plan.chapterId] = result;
    const v = result.validation;
    console.log(`  ${plan.chapterId}: ${result.lessons[0].vocab.length} vocab item(s), valid=${v.valid}` +
      (v.errors.length ? `, ${v.errors.length} error(s)` : '') + (v.warnings.length ? `, ${v.warnings.length} warning(s)` : ''));
  });

  const out = {
    schemaVersion: 1,
    pipelineVersion: CP4_PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    chapterCount: Object.keys(chapters).length,
    skippedCount: skipped,
    chapters,
  };
  console.log(`\n${Object.keys(chapters).length} chapter(s) emitted, ${skipped} skipped (no vocab concepts).`);
  if (WRITE) {
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
    console.log(`Wrote ${OUT}`);
  } else {
    console.log(`(report-only -- pass --write to persist to ${OUT})`);
  }
}

main();
