#!/usr/bin/env node
// build-curriculum-plan.js -- CLI for PLAN §7.0 CP3: proposed curriculum plan, report-only.
//
// Reads CP2's OWN canonical-analysis.json as input (not lessons.json for the concepts themselves --
// CP3 sits on top of CP2's lemma/form/phrase/sense proposals, never re-derives them). lessons.json
// is read TOO, but only READ-ONLY, for the "compare with current generated lessons" step the plan's
// own CP3 wording asks for -- never written. Writes its own separate store, curriculum-plan.json.
//
// No model call happens here (curriculum-plan.js's own header explains why) -- so unlike
// build-canonical-analysis.js, this CLI needs no OLLAMA_* configuration and runs fast regardless of
// how many chapters are selected; --limit therefore defaults to "all chapters in the input".
'use strict';
const fs = require('fs');
const path = require('path');
const { buildCurriculumPlan, CP3_PIPELINE_VERSION } = require('./curriculum-plan.js');

const ROOT = __dirname;
const CANONICAL_ANALYSIS = path.join(ROOT, 'canonical-analysis.json');
const LESSONS = path.join(ROOT, 'lessons.json');

const argv = process.argv.slice(2);
const outArgIdx = argv.indexOf('--out');
const OUT = outArgIdx >= 0 ? path.resolve(argv[outArgIdx + 1]) : path.join(ROOT, 'curriculum-plan.json');
const inArgIdx = argv.indexOf('--in');
const IN = inArgIdx >= 0 ? path.resolve(argv[inArgIdx + 1]) : CANONICAL_ANALYSIS;
const lessonsArgIdx = argv.indexOf('--lessons');
const LESSONS_IN = lessonsArgIdx >= 0 ? path.resolve(argv[lessonsArgIdx + 1]) : LESSONS;
const WRITE = argv.includes('--write');
const chapterArgIdx = argv.indexOf('--chapter');
const ONE_CHAPTER = chapterArgIdx >= 0 ? argv[chapterArgIdx + 1] : null;
const limitArgIdx = argv.indexOf('--limit');
const LIMIT = limitArgIdx >= 0 ? parseInt(argv[limitArgIdx + 1], 10) : 0;   // 0 = every chapter in the input

function main() {
  if (!fs.existsSync(IN)) {
    console.error(`No canonical-analysis input at ${IN} -- run build-canonical-analysis.js --write first (CP3 sits on top of CP2's output).`);
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

  let lessonsStore = null;
  try { lessonsStore = JSON.parse(fs.readFileSync(LESSONS_IN, 'utf8')); }
  catch (e) { console.warn(`Could not read ${LESSONS_IN} -- proceeding without the "compare with existing lessons" step: ${e.message}`); }

  console.log(`PLAN §7.0 CP3 -- planning ${selected.length} chapter(s)`);
  const plans = {};
  selected.forEach(chapterAnalysis => {
    const existingTopic = lessonsStore ? (lessonsStore.topics || []).find(t => t.id === chapterAnalysis.chapterId) : null;
    const plan = buildCurriculumPlan(chapterAnalysis, { existingTopic });
    plans[chapterAnalysis.chapterId] = plan;
    let line = `  ${chapterAnalysis.chapterId}: ${plan.conceptCount} concept(s) proposed`;
    if (plan.comparison) {
      line += `, ${plan.comparison.coveredByExisting}/${plan.comparison.proposedCount} already covered by existing lessons, ` +
        `${plan.comparison.existingNotProposed.length} existing vocab item(s) not among the proposals`;
    }
    console.log(line);
  });

  const out = {
    schemaVersion: 1,
    pipelineVersion: CP3_PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    chapterCount: Object.keys(plans).length,
    chapters: plans,
  };
  console.log(`\n${Object.keys(plans).length} chapter(s) planned.`);
  if (WRITE) {
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
    console.log(`Wrote ${OUT}`);
  } else {
    console.log(`(report-only -- pass --write to persist to ${OUT})`);
  }
}

main();
