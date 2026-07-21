#!/usr/bin/env node
// backfill-createdby.js — v58 provenance
//
// Stamps `createdBy: 'admin'` onto every TOPIC that lacks it. One-shot companion to the
// runtime stamp in server.js's upsert(): the roadmap's call was an EXPLICIT backfill rather
// than a read-time default, so the stored data says what it means. Everything predating user
// login was, by definition, created by the admin — this is a policy fact, not a guess, so
// (unlike backfill-provenance.js's --assume values) it is NOT marked user-asserted.
//
// Storylines are deliberately NOT stamped: their provenance line is DERIVED from their
// chapters' fields at render time, which stays truthful once login exists and a storyline's
// chapters have different creators.
//
// DRY RUN BY DEFAULT; pass --write to save. Idempotent: a second run changes nothing.
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = process.argv.find(a => a.endsWith('.json')) || path.join(__dirname, 'lessons.json');
const WRITE = process.argv.includes('--write');
const DEFAULT_USER = 'admin';

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (!(data && data.schemaVersion >= 29 && Array.isArray(data.topics))) {
  console.error(`Unsupported schema in ${FILE} (need schemaVersion >= 29)`); process.exit(1);
}

let stamped = 0, had = 0;
for (const t of data.topics) {
  if (t.createdBy) { had++; continue; }
  t.createdBy = DEFAULT_USER;
  stamped++;
}

console.log(`${FILE}: ${data.topics.length} topics — ${had} already had createdBy, ${stamped} stamped '${DEFAULT_USER}'`);
if (!WRITE) { console.log('DRY RUN — nothing written. Pass --write to save.'); process.exit(0); }
if (stamped === 0) { console.log('Nothing to do.'); process.exit(0); }
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('Written.');
