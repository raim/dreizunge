#!/usr/bin/env node
// backfill-script.js — stamp `script` / `srcScript` on topics whose language has a SCRIPT CHOICE.
//
// Serbian is digraphic: Cyrillic and Latin are both official and a text is written in one or the
// other. Nothing ever told the model which, so it chose per generation — measured across the
// bundled corpus, Serbian-as-target came back Latin and Serbian-as-source came back Cyrillic.
// This records what each existing topic ACTUALLY uses, so the choice becomes explicit data rather
// than an accident of generation, and a later chapter can differ from its storyline on purpose
// (the user's case: train words in Latin first, then the same storyline in Cyrillic).
//
// Which languages have a choice at all is declared in scripts.json `_scriptChoice`, NOT derived
// from `_langScript[x].length > 1` — that is also true of Japanese, which mixes hiragana and
// katakana concurrently and has no choice to make.
//
// Detection is Unicode only (\p{Script=…}); no table of language facts is consulted or written.
//
//   node backfill-script.js            # report only, writes nothing
//   node backfill-script.js --write    # stamp lessons.json (a .bak is written first)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const WRITE = process.argv.includes('--write');
const LESSONS = path.join(ROOT, 'lessons.json');

const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts.json'), 'utf8'));
const store = JSON.parse(fs.readFileSync(LESSONS, 'utf8'));

const CHOICE = new Set(scripts._scriptChoice || []);
// The script names a language may be written in, in scripts.json's own vocabulary.
const scriptsFor = (code) => {
  const m = (scripts._langScript || {})[code];
  return m ? (Array.isArray(m) ? m : [m]) : [];
};

// Unicode script property → the scripts.json table name that uses it. Mechanical, not linguistic:
// this maps an ENCODING fact to a table name, it does not decide whether content is correct.
const UNICODE_OF = {
  latin: /\p{Script=Latin}/gu,
  cyrillic: /\p{Script=Cyrillic}/gu,
  'cyrillic-sr': /\p{Script=Cyrillic}/gu,
  greek: /\p{Script=Greek}/gu,
  arabic: /\p{Script=Arabic}/gu,
  hebrew: /\p{Script=Hebrew}/gu,
  devanagari: /\p{Script=Devanagari}/gu,
  hangul: /\p{Script=Hangul}/gu,
  thai: /\p{Script=Thai}/gu,
  hiragana: /\p{Script=Hiragana}/gu,
  katakana: /\p{Script=Katakana}/gu,
  han: /\p{Script=Han}/gu,
};

// Collect the text a topic holds in ONE of its two languages. Which side a field belongs to is a
// property of the schema, not of the text: stories are in the target language, vocab/sentences
// carry both sides, and the topic TITLE is in the SOURCE language (verified across the corpus).
function textFor(topic, side) {
  const parts = [];
  if (side === 'source' && topic.topic) parts.push(topic.topic);
  if (side === 'target' && topic.story) parts.push(topic.story);
  for (const l of topic.lessons || []) {
    if (side === 'target' && l.story) parts.push(l.story);
    for (const v of l.vocab || []) parts.push(side === 'target' ? (v.target || v.t || '') : (v.source || v.s || ''));
    for (const e of l.sentences || []) parts.push(side === 'target' ? (e.target || e.t || '') : (e.source || e.s || ''));
  }
  return parts.join(' ');
}

// Which of the candidate scripts this text is written in. Returns null when there is no signal,
// and reports a tie rather than guessing — a genuinely mixed text is a finding, not a default.
function detect(text, candidates) {
  const tally = candidates.map(name => {
    const re = UNICODE_OF[name];
    return { name, n: re ? (String(text).match(re) || []).length : 0 };
  }).sort((a, b) => b.n - a.n);
  if (!tally.length || tally[0].n === 0) return { pick: null, tally };
  const [top, next] = tally;
  // A clear majority is required; anything closer is reported for a human to look at.
  if (next && next.n > 0 && top.n < next.n * 4) return { pick: null, tally, mixed: true };
  return { pick: top.name, tally };
}

let stamped = 0, already = 0, ambiguous = 0, considered = 0;
const rows = [];

for (const topic of store.topics || []) {
  for (const [side, langKey, field] of [['target', 'lang', 'script'], ['source', 'srcLang', 'srcScript']]) {
    const code = topic[langKey];
    if (!code || !CHOICE.has(code)) continue;
    considered++;
    const candidates = scriptsFor(code);
    const { pick, tally, mixed } = detect(textFor(topic, side), candidates);
    const cur = topic[field];
    const counts = tally.map(t => `${t.name}=${t.n}`).join(' ');
    if (!pick) {
      ambiguous++;
      rows.push(`  ? ${topic.id}  ${code} (${side})  ${mixed ? 'MIXED' : 'no signal'}  ${counts}`);
      continue;
    }
    if (cur === pick) { already++; continue; }
    rows.push(`  ${cur ? '~' : '+'} ${topic.id}  ${code} (${side})  ${cur || '(none)'} -> ${pick}   ${counts}`);
    if (WRITE) topic[field] = pick;
    stamped++;
  }
}

console.log(`scripts.json _scriptChoice: ${[...CHOICE].join(', ') || '(none)'}`);
console.log(`topics scanned: ${(store.topics || []).length}; language sides with a script choice: ${considered}`);
if (rows.length) console.log(rows.join('\n'));
console.log(`\nto stamp: ${stamped}   already correct: ${already}   ambiguous (left alone): ${ambiguous}`);

if (!WRITE) { console.log('\n(report only — pass --write to stamp lessons.json)'); process.exit(0); }
if (!stamped) { console.log('nothing to write.'); process.exit(0); }

fs.copyFileSync(LESSONS, LESSONS + '.bak');
const out = JSON.stringify(store, null, 2);
JSON.parse(out);                       // never write a file that will not re-parse
fs.writeFileSync(LESSONS, out, 'utf8');
console.log(`\n💾 stamped ${stamped} field(s); previous file kept at ${path.basename(LESSONS)}.bak`);
