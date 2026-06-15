#!/usr/bin/env node
// One-time repair: re-merge storylines whose fork collapsed to a single line.
// Safe & idempotent. Writes a .bak backup first. Run AFTER booting v41 once
// (so continuedFromId is present in lessons.json).
//
//   node merge-collapsed-forks.js [path-to-lessons.json]   (default: ./lessons.json)
//
const fs = require('fs');
const path = process.argv[2] || 'lessons.json';
const store = JSON.parse(fs.readFileSync(path, 'utf8'));
const topics = store.topics || [];
const byId = Object.fromEntries(topics.map(t => [t.id, t]));
const parentIdOf = t => (t && t.continuedFromId) || null;

let merges = 0, changed = true;
while (changed) {
  changed = false;
  const list = store.storylines || [];
  for (const child of list) {
    if (!child.chapters || !child.chapters.length) continue;
    const head = byId[child.chapters[0]];          // child's first chapter
    const pid  = parentIdOf(head);                  // ...continues from pid
    if (!pid || !byId[pid]) continue;
    // Parent storyline must END with pid (don't merge into the middle of a chain)
    const parent = list.find(s => s !== child && s.chapters[s.chapters.length - 1] === pid);
    if (!parent) continue;
    // pid must have exactly ONE child overall (fork fully collapsed) — never merge a live fork
    const kids = topics.filter(t => parentIdOf(t) === pid);
    if (kids.length !== 1) continue;
    parent.chapters = [...parent.chapters, ...child.chapters];
    store.storylines = list.filter(s => s !== child);
    console.log(`Merged "${child.title}" [${child.chapters.map(c => byId[c]?.topic || c).join(' \u2192 ')}] `
              + `into "${parent.title}" \u2192 [${parent.chapters.map(c => byId[c]?.topic || c).join(' \u2192 ')}]`);
    merges++; changed = true; break;   // restart scan after each mutation
  }
}

if (merges === 0) {
  console.log('No collapsed forks found — nothing to merge.');
} else {
  fs.copyFileSync(path, path + '.bak');
  fs.writeFileSync(path, JSON.stringify(store, null, 2));
  console.log(`\n${merges} merge(s) applied. Backup written to ${path}.bak`);
}
