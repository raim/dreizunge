#!/usr/bin/env node
// migrate-v29.js
// One-time migration of lessons.json to the v29 data model.
//
// Changes:
//   - Each topic gets a stable string ID:  "tp_<hash>"
//   - Each lesson set gets a stable ID:    "ls_<topicHash>_<type>_<n>"
//   - Each lesson set gets an explicit type field (inferred from id/content)
//   - storylines{} map rebuilt as storylines[] array with stable "sl_" IDs
//   - continuedFrom (topic name) preserved for reference but chains now
//     explicit in storyline.chapters[] (array of topic IDs)
//   - Orphan topics (no chain) become 1-chapter storylines
//   - Flags re-keyed from topicSlug:... to topicId:...
//
// Usage:
//   node migrate-v29.js                      # migrates lessons.json in-place
//   node migrate-v29.js --dry               # print summary, don't write
//   node migrate-v29.js --input foo.json    # use alternate input file
//   node migrate-v29.js --output bar.json   # write to alternate output

'use strict';
const fs   = require('fs');
const path = require('path');

const args       = process.argv.slice(2);
const DRY        = args.includes('--dry');
const inputIdx   = args.indexOf('--input');
const outputIdx  = args.indexOf('--output');
const INPUT_FILE  = inputIdx  >= 0 ? args[inputIdx  + 1] : path.join(__dirname, 'lessons.json');
const OUTPUT_FILE = outputIdx >= 0 ? args[outputIdx + 1] : INPUT_FILE;

// ── Helpers ───────────────────────────────────────────────────────────────────
function hash32(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function topicId(topic)    { return 'tp_' + hash32(topic.trim().toLowerCase()); }
function chainId(topics)   { return 'sl_' + hash32(JSON.stringify(topics)); }
function topicSlug(topic)  { return (topic || '').slice(0, 30).replace(/\s+/g, '_'); }

// Infer lesson set type from existing data
function inferType(ls) {
  if (ls.type && ls.type !== '?') return ls.type;
  if (Array.isArray(ls.grammar)       && ls.grammar.length)       return 'grammar';
  if (Array.isArray(ls.conjugations)  && ls.conjugations.length)  return 'conjugation';
  if (ls.type === 'error_hunt' || (ls.title || '').toLowerCase().includes('error hunt')
      || (ls.title || '').toLowerCase().includes('text understand')) return 'error_hunt';
  return 'standard';
}

// ── Load ──────────────────────────────────────────────────────────────────────
console.log(`\nDreizunge v29 migration`);
console.log(`Input : ${INPUT_FILE}`);
console.log(`Output: ${OUTPUT_FILE}${DRY ? ' (DRY RUN)' : ''}\n`);

let raw;
try { raw = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8')); }
catch(e) { console.error('Cannot read input:', e.message); process.exit(1); }

// Normalise to {lessons:[], storylines:{}, flags:{}}
const topics   = Array.isArray(raw) ? raw : (raw.lessons || []);
const oldSL    = raw.storylines || {};
const oldFlags = raw.flags      || {};

console.log(`Topics   : ${topics.length}`);
console.log(`Storyline entries (old): ${Object.keys(oldSL).length}`);
console.log(`Flag entries: ${Object.keys(oldFlags).length}\n`);

// ── Step 1: Assign stable IDs to topics and lesson sets ──────────────────────
const idByTopic = {};   // topic name (lower) → topicId
const topicById = {};   // topicId → migrated topic object

const migratedTopics = topics.map(t => {
  const tid = topicId(t.topic);
  idByTopic[t.topic.trim().toLowerCase()] = tid;

  // Migrate lesson sets
  const typeCounts = {};
  const lessonSets = (t.lessons || []).map(ls => {
    const type = inferType(ls);
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    const lsId = `ls_${hash32(tid + '_' + type + '_' + typeCounts[type])}`;
    const migrated = { ...ls, id: lsId, type };
    return migrated;
  });

  const migrated = {
    ...t,
    id:         tid,
    lessons:    lessonSets,
  };
  topicById[tid] = migrated;
  return migrated;
});

console.log('Step 1: Topic and lesson set IDs assigned');
migratedTopics.forEach(t => {
  console.log(`  ${t.id}  "${t.topic.slice(0,50)}"`);
  t.lessons.forEach(ls => console.log(`    ${ls.id}  type=${ls.type}  "${(ls.title||'').slice(0,40)}"`));
});

// ── Step 2: Build explicit storyline chains ──────────────────────────────────
// Walk continuedFrom pointers to build ordered chains
const topicNames    = migratedTopics.map(t => t.topic);
const continuedFrom = {};
migratedTopics.forEach(t => {
  if (t.continuedFrom) continuedFrom[t.topic.trim().toLowerCase()] = t.continuedFrom.trim().toLowerCase();
});

// Find chain heads (topics not referenced as a continuedFrom target)
const allTargets = new Set(Object.values(continuedFrom));
const heads = migratedTopics.filter(t => !allTargets.has(t.topic.trim().toLowerCase()));

const chains = [];
const visitedTopics = new Set();

for (const tail of heads) {
  // "head" is actually the tail — nothing points to it as a continuedFrom target
  // Walk backwards through continuedFrom to build the chain, then reverse
  const chain = [tail.topic];
  visitedTopics.add(tail.topic.trim().toLowerCase());
  let cur = tail;
  for (let iter = 0; iter < 100; iter++) {
    const prev = cur.continuedFrom ? migratedTopics.find(t =>
      t.topic.trim().toLowerCase() === cur.continuedFrom.trim().toLowerCase()
    ) : null;
    if (!prev || visitedTopics.has(prev.topic.trim().toLowerCase())) break;
    chain.unshift(prev.topic);
    visitedTopics.add(prev.topic.trim().toLowerCase());
    cur = prev;
  }
  chains.push(chain);
}

// Any topics not visited (disconnected) become solo chains
migratedTopics.forEach(t => {
  if (!visitedTopics.has(t.topic.trim().toLowerCase())) {
    chains.push([t.topic]);
    console.warn(`  Disconnected topic (solo chain): "${t.topic}"`);
  }
});

console.log(`\nStep 2: ${chains.length} storyline chain(s) built`);
chains.forEach(c => console.log(`  ${c.length} chapter(s): ${c.map(t=>'"'+t.slice(0,30)+'"').join(' → ')}`));

// ── Step 3: Build new storylines[] array ─────────────────────────────────────
// Merge old storylines metadata (titles/icons) into new objects
function findOldMeta(chainTopics) {
  // Try chainId key first
  const cid = 'c' + Math.abs(JSON.stringify(chainTopics).split('').reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0));
  if (oldSL[cid]) return oldSL[cid];
  // Try root: key
  const rootKey = 'root:' + chainTopics[0];
  if (oldSL[rootKey]) return oldSL[rootKey];
  // Fuzzy: find any entry whose title matches a topic name
  for (const [, v] of Object.entries(oldSL)) {
    if (chainTopics.some(t => t.toLowerCase().includes((v.title||'').toLowerCase().split(' ')[0].toLowerCase()) && (v.title||'').length > 3))
      return v;
  }
  return null;
}

const newStorylines = chains.map(chainTopics => {
  const slId    = chainId(chainTopics.map(t => topicId(t)));
  const meta    = findOldMeta(chainTopics);
  const chapters = chainTopics.map(t => idByTopic[t.trim().toLowerCase()]).filter(Boolean);

  // Validate icon — reject known garbage values
  const rawIcon = meta?.icon || '';
  const badIcons = new Set(['fungus', 'jest', '-mountai', 'c1651995745']);
  const icon = badIcons.has(rawIcon) || rawIcon.length > 10 ? '📖' : (rawIcon || '📖');

  return {
    id:       slId,
    title:    meta?.title || chainTopics[0],
    icon,
    lang:     topicById[chapters[0]]?.lang     || null,
    srcLang:  topicById[chapters[0]]?.srcLang  || null,
    chapters,
    createdAt: topicById[chapters[0]]?.generatedAt || new Date().toISOString(),
    updatedAt: topicById[chapters[chapters.length-1]]?.updatedAt || new Date().toISOString(),
  };
});

console.log(`\nStep 3: ${newStorylines.length} storyline object(s) built`);
newStorylines.forEach(sl => console.log(`  ${sl.id}  "${sl.title}"  [${sl.chapters.length} chapters]`));

// ── Step 4: Migrate flags ─────────────────────────────────────────────────────
// Old key format: topicSlug:type:contentSlug
// New key format: topicId:type:contentSlug
const newFlags = {};
let flagsMigrated = 0, flagsLost = 0;

for (const [oldKey, val] of Object.entries(oldFlags)) {
  const parts = oldKey.split(':');
  if (parts.length < 3) { flagsLost++; continue; }
  const slug = parts[0];
  // Find topic by slug match
  const matchedTopic = migratedTopics.find(t => topicSlug(t.topic) === slug);
  if (!matchedTopic) { flagsLost++; continue; }
  const newKey = matchedTopic.id + ':' + parts.slice(1).join(':');
  newFlags[newKey] = val;
  flagsMigrated++;
}
console.log(`\nStep 4: Flags migrated: ${flagsMigrated}, lost (no topic match): ${flagsLost}`);

// ── Step 5: Assemble output ───────────────────────────────────────────────────
const output = {
  schemaVersion: 29,
  storylines:    newStorylines,
  topics:        migratedTopics,
  flags:         newFlags,
};

// Stats
const totalLessonSets = migratedTopics.reduce((n, t) => n + t.lessons.length, 0);
console.log(`\n── Summary ─────────────────────────────────────────────`);
console.log(`  Topics      : ${migratedTopics.length}`);
console.log(`  Lesson sets : ${totalLessonSets}`);
console.log(`  Storylines  : ${newStorylines.length}`);
console.log(`  Flags       : ${flagsMigrated} migrated`);
console.log(`  Schema      : v29`);

if (DRY) {
  console.log('\n(dry run — not writing output)\n');
  process.exit(0);
}

// Back up original
const backupFile = INPUT_FILE.replace('.json', '.pre-v29.json');
try {
  fs.writeFileSync(backupFile, fs.readFileSync(INPUT_FILE, 'utf8'), 'utf8');
  console.log(`\nBackup written to: ${backupFile}`);
} catch(e) {
  console.warn(`Could not write backup: ${e.message}`);
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
console.log(`Output written to: ${OUTPUT_FILE}\n`);
