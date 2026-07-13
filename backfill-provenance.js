#!/usr/bin/env node
// backfill-provenance.js — v53_e
//
// Backfills `topic.storyMeta` (and, where provable, `generationStats.models`) onto topics generated
// before those fields existed. DRY RUN BY DEFAULT; pass --write to save.
//
// WHY THIS IS MOSTLY DERIVATION, NOT MEMORY
// `generationStats.model` is a label built as:
//     [...new Set([OLLAMA_MODEL, OLLAMA_TRANSLATION_MODEL, OLLAMA_LESSON_MODEL])].join(' / ')
// A Set preserves first-insertion order and OLLAMA_MODEL (the STORY model) is inserted first, so
//     label.split(' / ')[0] === the story model, always.
// This is verified empirically, not assumed: the 16 topics that carry BOTH the label and the newer
// `generationStats.models` object agree on it 5/5 (the other 11 are user-provided stories, story=null),
// and the lessons model appears somewhere in the label 16/16. `--verify` re-runs that check.
//
// A single-element label means all three roles used the same model, so translation and lessons are
// derivable too. A two-element label pins only the story; which of translation/lessons is the other
// model is genuinely unrecoverable, so `generationStats.models` is LEFT ABSENT for those rather than
// guessed. Nothing here invents a value.
//
// USER-ASSERTED values (memory, not record) are marked `source: 'user-asserted'` so they can never be
// mistaken for recorded provenance:
//   --assume <model>            model for topics with no generationStats at all
//   --resolve <from>=<to>       resolve an untagged model name (e.g. translategemma=translategemma:4b)
//
// A user-provided story is stamped '(user-provided)'. It is NOT given a model: no model wrote it.
'use strict';
const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
const WRITE   = ARGS.includes('--write');
const VERIFY  = ARGS.includes('--verify');
const FILE    = path.join(__dirname, 'lessons.json');
const argVal  = (flag) => { const i = ARGS.indexOf(flag); return i >= 0 ? ARGS[i + 1] : null; };
const ASSUME  = argVal('--assume');
const RESOLVE = {}, SET_MODEL = {};
// A flag whose value is missing or malformed must FAIL, not be silently ignored: on a data
// migration, a quietly-dropped `--resolve` looks identical to one that was never needed.
function flagValue(flag, i) {
  const val = ARGS[i + 1];
  if (!val || val.startsWith('--')) {
    console.error(`${flag} needs a value, e.g.  ${flag} ${flag === '--resolve' ? 'translategemma=translategemma:4b' : 'osttirol-glossary=translategemma:4b'}`);
    process.exit(2);
  }
  return val;
}
ARGS.forEach((a, i) => {
  if (a === '--resolve') {
    const [from, to] = flagValue(a, i).split('=');
    if (!from || !to) { console.error("--resolve expects <name>=<name:tag>, e.g. translategemma=translategemma:4b"); process.exit(2); }
    RESOLVE[from] = to;
  }
  // --set-model <topic-name-or-id>=<model>: a per-topic user assertion, for stories the record
  // cannot explain (e.g. a dialect rewrite driven by an uploaded glossary, which never wrote
  // generationStats). Always marked source: 'user-asserted'.
  if (a === '--set-model') {
    const v = flagValue(a, i);
    const idx = v.lastIndexOf('=');
    if (idx <= 0) { console.error('--set-model expects <topic-or-id>=<model>'); process.exit(2); }
    SET_MODEL[v.slice(0, idx)] = v.slice(idx + 1);
  }
  if (a === '--assume') flagValue(a, i);   // validated here; read via argVal above
});

const USER_PROVIDED = '(user-provided)';

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const topics = data.topics || [];
const storylines = data.storylines || [];

// topic id → its storyline, so a chapter can see whether it came from an uploaded file.
const topicStoryline = {};
storylines.forEach(sl => (sl.chapters || []).forEach(id => { topicStoryline[id] = sl; }));

// WHERE THE TEXT CAME FROM — orthogonal to WHO wrote it (`model`).
//   generated       an LLM wrote it in-app
//   dialect-rewrite an LLM rewrote it from an uploaded glossary (no generationStats is written)
//   file-upload     a chapter of an uploaded book/document — `userStory`, but authored by someone
//   user-pasted     the user pasted the text themselves
// A `userStory` chapter of an uploaded book is NOT "pasted by the user": it has an author, and
// eventually a licence. Collapsing both into '(user-provided)' loses exactly that.
function classifyOrigin(t) {
  if (t._dialect || t.aiGenerated) return 'dialect-rewrite';
  if (t.userStory) {
    const sl = topicStoryline[t.id];
    return (sl && sl.sourceFile) ? 'file-upload' : 'user-pasted';
  }
  if (t.storyPrompt && !/^User-provided story/.test(t.storyPrompt)) return 'generated';
  if (t.generationStats) return 'generated';   // stats prove it ran in-app, even if no prompt was kept
  if (t.story) return 'unknown';
  return 'no-story';
}

// ── --verify: prove the label→story-model assumption against topics that have both ──────────────
if (VERIFY) {
  // Only rows RECORDED by server.js are evidence. Rows this script wrote (marked `modelsSource`) are
  // its own output, and comparing them to the label is circular — worse, a `--resolve`d tag
  // (translategemma → translategemma:4b) will never equal the untagged label, so they would report as
  // false mismatches on every run after the backfill.
  const both = topics.filter(t => t.generationStats && t.generationStats.models && !t.generationStats.modelsSource);
  let ok = 0, skip = 0, bad = 0, lessonsOk = 0;
  for (const t of both) {
    const gs = t.generationStats;
    const parts = String(gs.model).split(' / ');
    if (gs.models.story === null) skip++;
    else if (parts[0] === gs.models.story) ok++;
    else { bad++; console.error(`  MISMATCH: label=${JSON.stringify(gs.model)} models.story=${gs.models.story}`); }
    if (gs.models.lessons && parts.includes(gs.models.lessons)) lessonsOk++;
  }
  const backfilled = topics.filter(t => t.generationStats && t.generationStats.modelsSource).length;
  console.log(`verify: label[0] === models.story → ${ok} ok, ${bad} mismatched, ${skip} user-provided (skipped)`);
  console.log(`verify: models.lessons appears in label → ${lessonsOk}/${both.length}`);
  console.log(`verify: ignored ${backfilled} backfilled row(s) — this script wrote them, so they are not evidence`);
  process.exit(bad ? 1 : 0);
}

const resolveModel = (m) => (m && RESOLVE[m]) ? RESOLVE[m] : m;

const stamp = (model, source, at, origin, sourceFile) => {
  const m = {
    type: 'story', model, attempts: null, valid: null, rejected: 0, rejectReasons: null,
    promptTokens: 0, completionTokens: 0, ms: null, at: at || null,
    backfilled: true, source, origin,
  };
  if (sourceFile) m.sourceFile = sourceFile;
  return m;
};

const counts = {};
const bump = (k) => { counts[k] = (counts[k] || 0) + 1; };
let changedStory = 0, changedModels = 0, skipped = 0, needAssume = 0, unresolved = new Set();

let refinedOrigin = 0;

for (const t of topics) {
  const gs = t.generationStats;
  const at = t.generatedAt || t.updatedAt || null;
  const origin = classifyOrigin(t);
  const sl = topicStoryline[t.id];
  const srcFile = (origin === 'file-upload' && sl) ? sl.sourceFile : null;
  const override = SET_MODEL[t.id] || SET_MODEL[t.topic];

  // Idempotent for the MODEL. A re-run may still add `origin` to rows stamped before it existed,
  // and may apply a new --set-model override, but it never re-derives a model it already wrote.
  if (t.storyMeta && !(override && t.storyMeta.model !== override)) {
    skipped++;
    if (!t.storyMeta.origin) { t.storyMeta.origin = origin; refinedOrigin++; }
    if (srcFile && !t.storyMeta.sourceFile) { t.storyMeta.sourceFile = srcFile; refinedOrigin++; }
    bump(t.storyMeta.model);
    continue;
  }

  if (override) {
    // The user knows something the record does not. Never silent.
    t.storyMeta = stamp(resolveModel(override), 'user-asserted (--set-model)', at, origin, srcFile);
    bump(resolveModel(override) + ' (asserted)'); changedStory++;
  } else if (origin === 'file-upload' || origin === 'user-pasted') {
    // No model wrote this story. Recording one would be a lie.
    t.storyMeta = stamp(USER_PROVIDED, 'userStory flag', at, origin, srcFile);
    bump('user-provided'); changedStory++;
  } else if (gs && gs.models && gs.models.story) {
    t.storyMeta = stamp(gs.models.story, 'generationStats.models.story', at, origin, srcFile);
    bump(gs.models.story); changedStory++;
  } else if (gs && gs.model) {
    const raw = String(gs.model).split(' / ')[0];
    const model = resolveModel(raw);
    if (model === raw && /^[a-z0-9._-]+$/i.test(raw) && !raw.includes(':')) unresolved.add(raw);
    t.storyMeta = stamp(model, model === raw ? 'generationStats.model[0]' : 'generationStats.model[0] + user-asserted tag', at, origin, srcFile);
    bump(model); changedStory++;
  } else if (ASSUME && t.storyPrompt && !/^User-provided story/.test(t.storyPrompt)) {
    // No generationStats, but a real system prompt is recorded → it WAS generated in-app, and the
    // user can say by what. Marked user-asserted so it never passes for a recorded value.
    t.storyMeta = stamp(resolveModel(ASSUME), 'user-asserted (--assume)', at, origin, srcFile);
    bump(resolveModel(ASSUME) + ' (assumed)'); changedStory++;
  } else if (t.story) {
    // A story exists but nothing records how it got here (e.g. a dialect rewrite driven by an
    // uploaded glossary, which never wrote generationStats). '(unknown)' is the truthful answer —
    // --assume must not paper over it; use --set-model if you actually know.
    t.storyMeta = stamp('(unknown)', 'no record (story present, no generationStats, no storyPrompt)', at, origin, srcFile);
    bump('(unknown)'); changedStory++;
  } else {
    needAssume++;
    continue;
  }

  // Only backfill generationStats.models where ALL THREE roles are provable: a single-element label.
  if (gs && !gs.models && gs.model && !String(gs.model).includes(' / ')) {
    const m = resolveModel(String(gs.model));
    gs.models = { story: t.userStory ? null : m, translation: m, lessons: m };
    gs.modelsSource = 'backfill:generationStats.model (single-model label)';
    changedModels++;
  }
}

console.log(`\ntopics: ${topics.length}`);
console.log(`  storyMeta written        : ${changedStory}`);
console.log(`  already had storyMeta    : ${skipped}`);
console.log(`  generationStats.models   : ${changedModels} backfilled (single-model labels only)`);
console.log(`  origin/sourceFile added  : ${refinedOrigin} on already-stamped topics`);
const originCounts = {};
topics.forEach(t => { if (t.storyMeta) originCounts[t.storyMeta.origin] = (originCounts[t.storyMeta.origin] || 0) + 1; });
console.log('\nstory origin distribution:');
Object.entries(originCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(k).padEnd(34)} ${v}`));
if (needAssume) console.log(`  ⚠ ${needAssume} topic(s) have no generationStats — pass --assume <model> to stamp them`);
if (unresolved.size) console.log(`  ⚠ untagged model name(s): ${[...unresolved].join(', ')} — pass --resolve <name>=<name:tag>`);
console.log('\nstory model distribution:');
Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(k).padEnd(34)} ${v}`));

if (!WRITE) { console.log('\n(dry run — pass --write to save; a .bak is made first)'); process.exit(0); }
if (!changedStory && !changedModels && !refinedOrigin) { console.log('\nnothing to do — already up to date'); process.exit(0); }
if (needAssume) { console.error('\nrefusing to write while topics are unstamped; pass --assume'); process.exit(1); }
if (unresolved.size) { console.error('\nrefusing to write with untagged model names; pass --resolve'); process.exit(1); }

fs.copyFileSync(FILE, FILE + '.bak');
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
console.log(`\n✅ written (backup at ${path.basename(FILE)}.bak)`);
