// unit-lesson-id-integrity.test.js
// v67.1 — lesson IDs must be UNIQUE within a topic.
//
// Learner progress is keyed by lesson id (`progress.completed[topic][lesson.id]`), so two lessons
// sharing an id inside one topic means finishing one silently marks the other done. Reported
// symptom: "clicking Next just opens result cards of lessons I haven't solved", and a chapter that
// could never be properly completed. A real library had 90 of 278 topics affected.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// ── 1. The repair pass exists and is collision-aware ─────────────────────────
{
  const at = server.indexOf('function fixLessonIds()');
  assert.ok(at > 0, 'the lesson-id repair pass exists');
  const body = server.slice(at, at + 1800);
  assert.ok(/const seen = new Set\(\)/.test(body), 'it tracks ids already seen within a topic');
  assert.ok(/seen\.has\(String\(ls\.id\)\)/.test(body), 'it detects a duplicate, not just a missing id');
  assert.ok(/while \(seen\.has\(cand\)\)/.test(body), 'the replacement id is itself checked for collision');
  // The old hash collided by construction: topic+type+'auto' is identical for two lessons of the
  // same type in one topic. The replacement must vary with the lesson INDEX.
  assert.ok(/\+ i \+/.test(body), 'the generated id varies with the lesson index (the old one did not)');
  assert.ok(!/topic\.topic\+ls\.type\+'auto'/.test(server), 'the old collision-prone id scheme is gone');
}
console.log('  repair pass: collision-aware, index-varying ids: OK');

// ── 2. End-to-end on a corrupted store ───────────────────────────────────────
// Boot the server against a store with duplicate ids and confirm it repairs them on startup.
{
  const tmp = path.join(os.tmpdir(), 'dz_dupids_' + process.pid + '.json');
  const store = {
    schemaVersion: 30, storylines: [], flags: {},
    topics: [{
      id: 'tp_1', topic: 'Dup Chapter', lang: 'it', srcLang: 'de', story: 'x',
      lessons: [
        { id: '1', vocab: [] },
        { id: '6', type: 'word_forms', vocab: [] },
        { id: '6', type: 'synonyms',   vocab: [] },   // ← the reported collision
        { id: '6', type: 'synonyms',   vocab: [] },   // ← triple collision
        { type: 'grammar', vocab: [] },               // ← missing id entirely
      ],
    }],
  };
  fs.writeFileSync(tmp, JSON.stringify(store));
  try {
    // Booting the server runs the repair pass; --check style dry run isn't enough, so run it and
    // stop it immediately by pointing at a free port and killing after the startup pass.
    try {
      execFileSync(process.execPath, ['-e', `
        process.env.LESSONS_FILE = ${JSON.stringify(tmp)};
        process.env.PORT = '0';
        try { require(${JSON.stringify(path.join(ROOT, 'server.js'))}); } catch(_) {}
        setTimeout(() => process.exit(0), 300);
      `], { timeout: 20000, stdio: 'ignore' });
    } catch (_) { /* the server may exit non-zero when told to stop; the file is what matters */ }

    const after = JSON.parse(fs.readFileSync(tmp, 'utf8'));
    const ids = (after.topics[0].lessons || []).map(l => String(l.id));
    assert.strictEqual(ids.length, 5, 'no lesson was dropped by the repair');
    assert.ok(ids.every(Boolean), 'every lesson has an id');
    assert.strictEqual(new Set(ids).size, ids.length,
      `all ids are unique after repair (got ${ids.join(',')})`);
    // The FIRST occurrence keeps its id, so existing progress for it is not needlessly reset.
    assert.strictEqual(ids[0], '1', 'the first lesson keeps its id');
    assert.strictEqual(ids[1], '6', 'the first holder of a duplicated id keeps it');
    assert.notStrictEqual(ids[2], '6', 'the second holder is renamed');
    assert.notStrictEqual(ids[3], ids[2], 'the third holder gets its own distinct id');
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}
console.log('  end-to-end: a corrupted store is repaired on boot, first holder keeps its id: OK');

console.log('unit-lesson-id-integrity: ALL PASSED');
