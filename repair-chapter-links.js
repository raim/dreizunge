#!/usr/bin/env node
// repair-chapter-links.js — fix Bug #2 (v46): chapters whose continuation link is
// broken get re-linked to their real predecessor, so the storyline screen can lock
// them correctly.
//
//   node repair-chapter-links.js [lessons.json]            # dry-run report
//   node repair-chapter-links.js [lessons.json] --apply    # write the fixes back
//   node repair-chapter-links.js [lessons.json] --apply --out other.json
//
// Background: locking gates each chapter on its predecessor, resolved via
// `continuedFromId` (or a same-language `continuedFrom` name fallback). Some chapters
// — a known generation artifact of the cross-language continuation flow — carry a
// `continuedFromId: null` and a `continuedFrom` holding a source-language *story
// fragment* that matches no topic, so the predecessor can't be resolved, the chapter
// is treated as a stray "first" chapter, and the lock falls OPEN. The storyline
// already stores the authoritative chapter ORDER in `storylines[].chapters`, so we
// backfill each chapter's `continuedFromId` from `chapters[i-1]` wherever the existing
// link is missing or unresolvable. Valid links (including legitimate forks pointing at
// a non-adjacent same-language chapter) are left untouched. Idempotent.
//
// Zero dependencies.

'use strict';

// A link is "valid" if continuedFromId points to an existing topic in the SAME
// (lang, srcLang) — matching the app's makeParentResolver semantics.
function linkResolves(topic, byId) {
  const pid = topic && topic.continuedFromId;
  if (!pid) return false;
  const p = byId[pid];
  if (!p) return false;
  if ((p.lang || '') !== (topic.lang || '')) return false;
  if ((p.srcLang || '') !== (topic.srcLang || '')) return false;
  return true;
}

// Produce the list of repairs needed (no mutation). Each entry:
// { storylineId, storylineTitle, chapterId, index, topic, oldContinuedFromId, newContinuedFromId }
function planRepairs(store) {
  const topics = Array.isArray(store && store.topics) ? store.topics : [];
  const byId = {};
  topics.forEach(t => { if (t && t.id) byId[t.id] = t; });
  const storylines = Array.isArray(store && store.storylines) ? store.storylines : [];
  const plan = [];

  storylines.forEach(sl => {
    const chapters = (sl.chapters || []).filter(cid => byId[cid]); // skip dangling ids
    for (let i = 1; i < chapters.length; i++) {
      const cid = chapters[i];
      const topic = byId[cid];
      if (linkResolves(topic, byId)) continue;        // already validly linked → leave it
      const prevId = chapters[i - 1];
      const prev = byId[prevId];
      // Only link when the predecessor is same-language (a mixed-language storyline
      // shouldn't get a cross-language lock link).
      if (!prev) continue;
      if ((prev.lang || '') !== (topic.lang || '') || (prev.srcLang || '') !== (topic.srcLang || '')) continue;
      if (topic.continuedFromId === prevId) continue; // already correct (defensive)
      plan.push({
        storylineId: sl.id, storylineTitle: sl.title || sl.id,
        chapterId: cid, index: i,
        topic: String(topic.topic || cid),
        oldContinuedFromId: topic.continuedFromId || null,
        newContinuedFromId: prevId,
      });
    }
  });
  return plan;
}

// Apply a plan to the store (mutates store.topics in place). Returns count applied.
function applyRepairs(store, plan) {
  const byId = {};
  (store.topics || []).forEach(t => { if (t && t.id) byId[t.id] = t; });
  let n = 0;
  plan.forEach(r => {
    const t = byId[r.chapterId];
    if (!t) return;
    t.continuedFromId = r.newContinuedFromId;
    n++;
  });
  return n;
}

if (require.main === module) {
  const fs = require('fs');
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  let file = 'lessons.json';
  let out = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out = argv[++i];
    else if (!argv[i].startsWith('-')) file = argv[i];
  }
  let store;
  try { store = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error(`repair-chapter-links: cannot read ${file}: ${e.message}`); process.exit(1); }

  const plan = planRepairs(store);
  if (!plan.length) { console.log('repair-chapter-links: no broken chapter links found — nothing to do.'); process.exit(0); }

  const byStory = {};
  plan.forEach(r => { (byStory[r.storylineTitle] = byStory[r.storylineTitle] || []).push(r); });
  console.log(`repair-chapter-links: ${plan.length} broken chapter link(s) across ${Object.keys(byStory).length} storyline(s):`);
  Object.keys(byStory).forEach(title => {
    console.log(`  • ${title}`);
    byStory[title].forEach(r => {
      const snip = r.topic.length > 36 ? r.topic.slice(0, 35) + '…' : r.topic;
      console.log(`      ch[${r.index}] "${snip}"  ${r.oldContinuedFromId || '(none)'} → ${r.newContinuedFromId}`);
    });
  });

  if (!apply) { console.log('\n(dry-run — re-run with --apply to write the fixes)'); process.exit(0); }
  const n = applyRepairs(store, plan);
  const dest = out || file;
  fs.writeFileSync(dest, JSON.stringify(store, null, 2));
  console.log(`\nrepair-chapter-links: applied ${n} fix(es) → ${dest}`);
}

module.exports = { planRepairs, applyRepairs, linkResolves };
