#!/usr/bin/env node
// backfill-comic-panel-sync.js — v86_r
//
// One-shot companion to the v86_g/v86_r fixes: `_comicStoryPanelsHtml` (index.html) renders a
// comic/image chapter's progress card and question panel from `comicPanels[i].caption`/`inScene`,
// NOT from `story` — a separate copy of the text, extracted once at upload time. TWO server routes
// write `story` after that point (`/api/save-story`, the story-repair/error-hunt editor path, fixed
// at v86_g; `/api/story-qc/accept`, the QC-proposal-acceptance path, fixed at v86_r) — but only
// going FORWARD from each fix's own release. Any SINGLE-panel chapter whose story was corrected
// through either route BEFORE its own fix shipped is still stale today, and nothing re-triggers the
// sync on its own. This backfill finds and (with --write) corrects exactly those.
//
// Scope: SINGLE-panel chapters only, same as both live fixes — a chapter with MULTIPLE panels has
// no way to know which edited sentence belongs to which panel from one flat story string
// (deliberately left unfixed, item O in roadmap_v86.md — genuinely ambiguous, not overlooked).
//
// DRY RUN BY DEFAULT; pass --write to save. Idempotent: a second run changes nothing (a chapter
// already in sync reports as "already in sync", not touched again).
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = process.argv.find(a => a.endsWith('.json')) || path.join(__dirname, 'lessons.json');
const WRITE = process.argv.includes('--write');

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (!(data && Array.isArray(data.topics))) {
  console.error(`Unsupported schema in ${FILE} (need a topics array)`); process.exit(1);
}

let checked = 0, inSync = 0, fixed = 0, multiPanelSkipped = 0;
for (const t of data.topics) {
  if (!Array.isArray(t.comicPanels) || !t.comicPanels.length) continue;
  checked++;
  if (t.comicPanels.length > 1) { multiPanelSkipped++; continue; }
  const p = t.comicPanels[0];
  const panelText = [p.caption, p.inScene].filter(Boolean).join('\n');
  if (panelText === (t.story || '')) { inSync++; continue; }
  console.log(`  ${t.id} ("${t.topic}"): STALE`);
  console.log(`    panel text: ${JSON.stringify(panelText)}`);
  console.log(`    story     : ${JSON.stringify(t.story)}`);
  if (WRITE) {
    p.caption = t.story || '';
    delete p.inScene;
  }
  fixed++;
}

console.log(`\n${FILE}: ${checked} comic-sourced chapter(s) checked (${multiPanelSkipped} multi-panel, skipped — item O, not this fix's scope).`);
console.log(`${inSync} already in sync, ${fixed} stale single-panel chapter(s) ${WRITE ? 'fixed' : 'found'}.`);
if (!WRITE) { console.log('DRY RUN — nothing written. Pass --write to save.'); process.exit(0); }
if (fixed === 0) { console.log('Nothing to do.'); process.exit(0); }
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('Written.');
