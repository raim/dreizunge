// unit-lesson-id-unique.test.js
// v80_i — lesson ids must be UNIQUE WITHIN A TOPIC.
//
// Progress is keyed by lesson id: `APP.progress.completed[topic][L.id]` in the client, and item keys
// are `${lessonId}:i:${hash}`. Two lessons in one chapter sharing an id therefore share ONE
// done-flag. Demonstrated on the corpus as it stood before this cut (`tp_17869990828330000253`):
// marking ONLY the word_forms lesson done made the synonyms AND conjugation lessons read as done.
// A learner finishes one of three lessons and the chapter believes all three are finished.
//
// The cause is in server.js: word_forms, synonyms and conjugation are all hardcoded `id: 6`, so any
// chapter generated with two of those three collides. The corpus is clean at this cut only because
// a user regeneration happened to assign fresh ids — the generators still emit 6.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

const a = src.indexOf('function _dedupeLessonIds(');
const b = src.indexOf('\nfunction saveStore(');
assert.ok(a >= 0 && b > a, '_dedupeLessonIds is still defined above saveStore');
const dedupe = new Function(src.slice(a, b) + '\nreturn _dedupeLessonIds;')();

// ── 1. The generators really do collide — the reason this exists ───────────
// If someone later gives the three types distinct ids, this section is what says so, rather than
// the fix quietly becoming dead code that still looks green.
{
  const ids = {};
  for (const ty of ['word_forms', 'synonyms', 'conjugation']) {
    const m = new RegExp("id: (\\d+), type: '" + ty + "'").exec(src);
    if (m) ids[ty] = m[1];
  }
  const vals = Object.values(ids);
  assert.strictEqual(vals.length, 3, 'all three generators still declare a literal id');
  const collide = vals.some((v, i) => vals.indexOf(v) !== i);
  assert.ok(collide,
    'the generators still emit a shared literal id (' + JSON.stringify(ids) + '). If this fails, ' +
    'they were given distinct ids — good; then say so here rather than deleting the dedupe, which ' +
    'still guards hand-edited and imported data.');
  console.log('  generators still share a literal id: ' + JSON.stringify(ids));
}

// ── 2. Duplicates are renamed; the FIRST holder keeps its id ──────────────
// Keeping the first is what protects existing learner progress: the id already carries a done-flag
// and an item-key namespace, so moving it would silently reset the lesson a learner had finished.
{
  const t = { topic: 'T', lessons: [
    { id: 1, type: 'standard' }, { id: 6, type: 'word_forms' },
    { id: 6, type: 'synonyms' }, { id: 6, type: 'conjugation' },
    { id: 9, type: 'comprehension' } ] };
  const n = dedupe([t]);
  assert.strictEqual(n, 2, 'two of the three id-6 lessons are renamed');
  const ids = t.lessons.map(L => String(L.id));
  assert.strictEqual(new Set(ids).size, ids.length, 'every id in the chapter is now distinct');
  assert.strictEqual(String(t.lessons[1].id), '6', 'the FIRST id-6 lesson keeps it — progress survives');
  assert.notStrictEqual(String(t.lessons[2].id), '6', 'the second is renamed');
  assert.notStrictEqual(String(t.lessons[3].id), '6', 'the third too');
  assert.strictEqual(String(t.lessons[0].id), '1', 'untouched ids are left alone');
  assert.strictEqual(String(t.lessons[4].id), '9', 'and so is the comprehension lesson');
  console.log('  duplicates renamed, first holder keeps its id');
}

// ── 3. Idempotent, and silent on clean data ───────────────────────────────
{
  const t = { topic: 'T', lessons: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  assert.strictEqual(dedupe([t]), 0, 'a clean chapter is not touched');
  assert.deepStrictEqual(t.lessons.map(L => L.id), ['a', 'b', 'c'], 'and its ids are unchanged');
  const dirty = { topic: 'U', lessons: [{ id: 6 }, { id: 6 }] };
  dedupe([dirty]);
  assert.strictEqual(dedupe([dirty]), 0, 'running it twice renames nothing further');
  console.log('  idempotent, and a no-op on clean data');
}

// ── 4. Collisions do not cross topics ─────────────────────────────────────
// Two chapters may each legitimately have a lesson id 6; progress is keyed per topic.
{
  const a1 = { topic: 'A', lessons: [{ id: 6 }] };
  const b1 = { topic: 'B', lessons: [{ id: 6 }] };
  assert.strictEqual(dedupe([a1, b1]), 0, 'the same id in two different chapters is fine');
  assert.strictEqual(String(b1.lessons[0].id), '6', 'and is left alone');
  console.log('  ids are scoped per topic, as progress is');
}

// ── 5. The live corpus is clean ───────────────────────────────────────────
{
  const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
  const bad = [];
  for (const t of (store.topics || [])) {
    const ids = (t.lessons || []).filter(Boolean).map(L => String(L.id));
    if (new Set(ids).size !== ids.length) bad.push(t.id);
  }
  assert.deepStrictEqual(bad, [],
    'no chapter in lessons.json has duplicate lesson ids — offenders: ' + JSON.stringify(bad));
  console.log('  lessons.json: every chapter has distinct lesson ids');
}

// ── What this does NOT establish (rule 34) ────────────────────────────────
// • It does not prove saveStore is reached on every write path; it proves the rule the choke point
//   applies. That saveStore IS the choke point is a code fact (23 call sites), not asserted here.
// • Existing lessons that already SHARE an id in a learner's saved progress keep whatever they
//   earned; the rename only fires when the store is next written.
console.log('unit-lesson-id-unique: ALL PASSED');
