#!/usr/bin/env node
// apply-cp-lessons.js -- PLAN §7.0: the FIRST script in this whole track that WRITES into the real
// lessons.json. Everything through CP1-5 (v83_h...v83_m) was deliberately inert or report-only.
// This chains CP1->CP2->CP3->CP4 for one or more chapters and appends an ADDITIVE, clearly-tagged
// "standard" vocabulary lesson to each topic -- it NEVER edits or removes an existing lesson, and it
// stays exactly as report-only-by-default as every earlier CP CLI: --write to actually persist.
//
// This is also the shared engine a future browser "add lessons" checkbox would call into -- built as
// a standalone script FIRST, on purpose, so it can be run and inspected from a terminal before any
// UI work happens, per this whole track's own "small, tested, reversible step at a time" practice.
//
// Cross-chapter dedup (roadmap_v83.md's own multi-chapter note, added right before this script was
// written): before choosing a chapter's vocabulary, EARLIER chapters in the SAME storyline (by the
// storyline's own `chapters` array, in order) have their already-taught vocabulary excluded via
// curriculum-plan.js's excludeAlreadyTaughtConcepts -- both what the LEGACY generator already taught
// there, and what THIS run has already added via its own CP4 lessons for earlier chapters in the
// same invocation. A chapter with nothing left to teach after that filter is SKIPPED, not forced.
//
// Usage:
//   node apply-cp-lessons.js --topic <id>                       # report-only, one chapter
//   node apply-cp-lessons.js --topic <id> --write                # actually persist
//   node apply-cp-lessons.js --storyline <id> --write             # every chapter, in order
//   node apply-cp-lessons.js --topic <id> --write --replace       # swap out a prior CP4 lesson
//   node apply-cp-lessons.js --topic <id> --write \
//     --lessons /scratch/lessons.json --out /scratch/lessons.json # never touches the real file
'use strict';
const fs = require('fs');
const path = require('path');
const { buildCanonicalText } = require('./canonical-text.js');
const { analyzeChapter } = require('./canonical-analysis.js');
const { buildCurriculumPlan, excludeAlreadyTaughtConcepts } = require('./curriculum-plan.js');
const { emitVocabLesson, validateLessonShape } = require('./curriculum-lesson.js');

const ROOT = __dirname;
const LESSONS = path.join(ROOT, 'lessons.json');

const argv = process.argv.slice(2);
const lessonsArgIdx = argv.indexOf('--lessons');
const LESSONS_IN = lessonsArgIdx >= 0 ? path.resolve(argv[lessonsArgIdx + 1]) : LESSONS;
const outArgIdx = argv.indexOf('--out');
const OUT = outArgIdx >= 0 ? path.resolve(argv[outArgIdx + 1]) : LESSONS_IN;
const WRITE = argv.includes('--write');
const REPLACE = argv.includes('--replace');
const topicArgIdx = argv.indexOf('--topic');
const ONE_TOPIC = topicArgIdx >= 0 ? argv[topicArgIdx + 1] : null;
const storylineArgIdx = argv.indexOf('--storyline');
const STORYLINE = storylineArgIdx >= 0 ? argv[storylineArgIdx + 1] : null;
const maxItemsArgIdx = argv.indexOf('--max-items');
const MAX_ITEMS = maxItemsArgIdx >= 0 ? parseInt(argv[maxItemsArgIdx + 1], 10) : 8;
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

let langsData = {};
try { langsData = require('./languages.json'); } catch (e) { langsData = {}; }
function langDisplayName(code) { return (langsData[code] && langsData[code].name) || code || 'the target language'; }

const PIPELINE_TAG = 'cp4';   // marks a lesson this script added, so it is identifiable and skippable/removable

// "Already taught" identity for cross-chapter dedup. v83_p: prefer `lemma` over `target` — since
// that release, a CP4-emitted vocab item's `target` is the SURFACE form the learner actually saw
// (e.g. "kam"), while `excludeAlreadyTaughtConcepts` compares against a LATER chapter's candidate
// `lemma` (e.g. "kommen"). Comparing target-to-target would silently stop matching across chapters
// for exactly the inflected words this fix was for. A LEGACY lesson's vocab item has no `lemma`
// field at all, so it falls back to `target` there (its own target IS its closest thing to a lemma).
function vocabTargetsOf(lesson) {
  return (lesson && Array.isArray(lesson.vocab) ? lesson.vocab : []).map(v => v && (v.lemma || v.target)).filter(Boolean);
}

// Every topic id that comes BEFORE `topicId` in the same storyline, in order. A topic that belongs
// to no storyline (a standalone chapter) has no "earlier chapters" at all -- degrades to [].
function earlierChapterIdsFor(store, topicId) {
  const sl = (store.storylines || []).find(s => Array.isArray(s.chapters) && s.chapters.includes(topicId));
  if (!sl) return [];
  const idx = sl.chapters.indexOf(topicId);
  return sl.chapters.slice(0, idx);
}

async function processTopic(store, topic, alreadyTaughtByTopicId) {
  const label = `${topic.id} (${topic.lang}, "${topic.topic}")`;
  if (!topic.story || !String(topic.story).trim()) { console.log(`  ${label}: SKIPPED — no story text`); return null; }

  // Checked BEFORE the (real, model-calling) CP1-4 chain runs — no point spending a live analysis
  // pass just to discard it because a prior cp4-pipeline lesson already sits on this topic.
  if (!REPLACE && (topic.lessons || []).some(l => l && l._pipeline === PIPELINE_TAG)) {
    console.log(`  ${label}: SKIPPED — a ${PIPELINE_TAG}-pipeline lesson already exists (pass --replace to swap it)`);
    return null;
  }

  const chapter = buildCanonicalText(topic);
  if (!chapter.sentenceCount) { console.log(`  ${label}: SKIPPED — no sentences to analyse`); return null; }

  process.stdout.write(`  ${label}: analysing ${chapter.sentenceCount} sentence(s)... `);
  const analysis = await analyzeChapter(MODEL, chapter, {
    langName: langDisplayName(topic.lang), srcLangName: langDisplayName(topic.srcLang),
  });
  const plan = buildCurriculumPlan(analysis, { existingTopic: topic });

  // Union: this topic's OWN existing lessons + every EARLIER chapter's taught vocabulary (legacy
  // AND already-added-this-run CP4 lessons alike, via alreadyTaughtByTopicId). Under --replace, the
  // EXISTING cp4-pipeline lesson on THIS topic is excluded from that union — it is the lesson about
  // to be regenerated, not a fact to treat as already-taught (otherwise a re-run would always starve
  // itself: every word it taught last time would look "already covered" by the very lesson it is
  // meant to replace).
  const ownLessons = (topic.lessons || []).filter(l => !(REPLACE && l && l._pipeline === PIPELINE_TAG));
  const alreadyTaught = new Set(vocabTargetsOf({ vocab: ownLessons.flatMap(l => l.vocab || []) }).map(t => t.toLowerCase()));
  earlierChapterIdsFor(store, topic.id).forEach(id => {
    (alreadyTaughtByTopicId[id] || []).forEach(t => alreadyTaught.add(t.toLowerCase()));
  });
  const filteredPlan = { ...plan, concepts: excludeAlreadyTaughtConcepts(plan.concepts, alreadyTaught) };

  let lesson;
  try { lesson = emitVocabLesson(filteredPlan, { maxItems: MAX_ITEMS }); }
  catch (e) { console.log(`SKIPPED — ${e.message}`); return null; }

  const validation = validateLessonShape(lesson);
  if (!validation.valid) {
    console.log(`SKIPPED — failed validation: ${validation.errors.join('; ')}`);
    return null;
  }

  console.log(`${lesson.vocab.length} new word(s)${validation.warnings.length ? `, ${validation.warnings.length} warning(s)` : ''}`);

  const finalLesson = {
    ...lesson,
    id: 'ls_' + Date.now() + '_' + PIPELINE_TAG,
    _pipeline: PIPELINE_TAG,
    // E0's own convention (server.js's add-lesson route): every lesson carries a _genMeta, even a
    // procedural/non-single-call one, so nothing downstream that displays it finds it missing.
    // Honestly reflects what happened here: CP2's real model call, not a fabricated single-shot one.
    _genMeta: { type: 'standard', model: MODEL, source: 'PLAN §7.0 CP1-4 pipeline', valid: lesson.vocab.length, at: new Date().toISOString() },
  };

  const existingIdx = REPLACE ? (topic.lessons || []).findIndex(l => l && l._pipeline === PIPELINE_TAG) : -1;
  if (existingIdx >= 0) topic.lessons.splice(existingIdx, 1, finalLesson);
  else topic.lessons.push(finalLesson);

  return finalLesson;
}

async function main() {
  if (!fs.existsSync(LESSONS_IN)) { console.error(`No lessons store at ${LESSONS_IN}`); process.exit(1); }
  const store = JSON.parse(fs.readFileSync(LESSONS_IN, 'utf8'));

  let selectedIds;
  if (STORYLINE) {
    const sl = (store.storylines || []).find(s => s.id === STORYLINE);
    if (!sl) { console.error(`No storyline with id ${STORYLINE}`); process.exit(1); }
    selectedIds = sl.chapters.slice();
  } else if (ONE_TOPIC) {
    selectedIds = [ONE_TOPIC];
  } else {
    console.error('Pass --topic <id> or --storyline <id>.');
    process.exit(1);
  }

  console.log(`PLAN §7.0 CP1-4 pipeline -- applying to ${selectedIds.length} chapter(s), model ${MODEL}`);
  // Grows as we go, so a LATER chapter in this same run sees an EARLIER one's FULL vocabulary — its
  // pre-existing (legacy) lessons AND any lesson this script just added — not just the new one. Set
  // for every processed topic regardless of whether a new lesson was actually added this run: even a
  // SKIPPED chapter's pre-existing vocabulary still counts as "already taught" for later chapters.
  const alreadyTaughtByTopicId = {};
  let added = 0, skipped = 0;
  for (const id of selectedIds) {
    const topic = (store.topics || []).find(t => t.id === id);
    if (!topic) { console.log(`  ${id}: SKIPPED — no such topic`); skipped++; continue; }
    const finalLesson = await processTopic(store, topic, alreadyTaughtByTopicId);
    if (finalLesson) added++; else skipped++;
    alreadyTaughtByTopicId[id] = (topic.lessons || []).flatMap(l => vocabTargetsOf(l));
  }

  console.log(`\n${added} lesson(s) added, ${skipped} chapter(s) skipped.`);
  if (WRITE) {
    fs.writeFileSync(OUT, JSON.stringify(store, null, 2), 'utf8');
    console.log(`Wrote ${OUT}`);
  } else {
    console.log(`(report-only -- pass --write to persist to ${OUT})`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
