// unit-roadmap-version.test.js
// v78_b — the session protocol's one version-specific sentence is now GUARDED rather than
// remembered.
//
// The protocol block in the current roadmap names the release line it belongs to. That sentence
// had shipped stale four times by session 32: roadmap_v73 said "the v72 line", roadmap_v76 said
// "the v75 line" for its entire run, and roadmap_v78 was written at the cut still naming the v77
// line — in both of the two sentences that carry it. Each time the correction was a note asking
// the NEXT session to check. Four repeats is the evidence that it was never going to be checked,
// so it becomes an assertion instead.
//
// Scope, deliberately narrow: this pins the roadmap's own statement of WHICH LINE IT IS against
// the single source of truth (server.js APP_VERSION). It says nothing about roadmap content.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

// ── The current base version, from the one place that defines it ─────────────
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const vm = server.match(/const APP_VERSION\s*=\s*'([^']+)'/);
assert.ok(vm, "server.js declares APP_VERSION");
// A point release is `v78_b`; the LINE it belongs to is `v78`. The roadmap is per BASE version.
const base = vm[1].split('_')[0];
assert.ok(/^v\d+$/.test(base), `APP_VERSION '${vm[1]}' yields a base of the form vNN (got '${base}')`);

// ── The current roadmap is the highest-numbered one ──────────────────────────
// Found by number, not by name, so this keeps working across cuts without being edited.
const roadmaps = fs.readdirSync(path.join(root, 'build_history'))
  .map(f => /^roadmap_v(\d+)\.md$/.exec(f))
  .filter(Boolean)
  .map(m => ({ file: m[0], n: Number(m[1]) }))
  .sort((a, b) => a.n - b.n);
assert.ok(roadmaps.length, 'build_history contains at least one roadmap_v*.md');
const current = roadmaps[roadmaps.length - 1];

assert.strictEqual(`v${current.n}`, base,
  `the highest-numbered roadmap is ${current.file} but APP_VERSION is '${vm[1]}' (base ${base}) — ` +
  'a version bump to a new BASE needs its own roadmap (protocol item 7)');
console.log(`  current roadmap ${current.file} matches APP_VERSION ${vm[1]}`);

// ── It names its own line, in every sentence that names one ──────────────────
// Both sentences are checked: the v78 cut got exactly this wrong, correcting neither. Matching all
// occurrences rather than the first is the difference between the two failures this test exists
// for. The patterns are anchored on the surrounding prose so the parenthetical that RECOUNTS the
// old mistakes ("roadmap_v73.md said \"the `v72` line\"") is not mistaken for a live claim.
const text = fs.readFileSync(path.join(root, 'build_history', current.file), 'utf8');
const claims = [
  { re: /\*\*This is the `(v\d+)` line\.\*\*/g,            what: 'the "This is the … line" sentence' },
  { re: /this file stays current through the whole (v\d+) line/g, what: 'the "stays current through" sentence' },
];
let checked = 0;
for (const { re, what } of claims) {
  const found = [...text.matchAll(re)];
  assert.ok(found.length, `${current.file} still carries ${what} — if it was reworded, update this guard`);
  for (const m of found) {
    assert.strictEqual(m[1], base,
      `${what} in ${current.file} names '${m[1]}' but this is the '${base}' line`);
    checked++;
  }
}
console.log(`  ${checked} version claim(s) in the protocol block name ${base}`);

// ── The per-cut prompt's NUMBERS, against the tree ───────────────────────────
// v80_d. The document set was consolidated to two files: this roadmap (durable) and ONE session
// prompt (per-cut). `HANDOVER.md` and `implementation_plan.md` were folded in and deleted.
//
// The prompt is the only document that states "now", and at the v80 cut THREE of its four stale
// claims were numbers — the expected check counts and the corpus counts — every one of them
// machine-checkable against the tree. Prose work cannot be revert-verified the way code can, so
// without this the consolidation would end as a green suite, a lot of churn, and no evidence.
// Rule 24: a note telling the next session to check something is not a guard.
//
// Scope, deliberately narrow: this pins NUMBERS the prompt asserts, not its prose.
// v81_aa: the suffix ran out of single letters at v81_z, so this now allows one-or-more —
// `v81_aa`, `v81_ab`, … The sort must order by LENGTH first, then alphabetically, or plain
// string comparison would put `aa` before `z` (wrong: `z` shipped first, `aa` is the overflow
// that comes AFTER it, same as spreadsheet columns).
const promptFiles = fs.readdirSync(path.join(root, 'build_history'))
  .map(f => /^SESSION_PROMPT_v(\d+)(?:_([a-z]+))?\.md$/.exec(f))
  .filter(Boolean)
  .map(m => ({ file: m[0], n: Number(m[1]), pt: m[2] || '' }))
  .sort((a, b) => a.n - b.n || a.pt.length - b.pt.length || a.pt.localeCompare(b.pt));
assert.ok(promptFiles.length, 'build_history contains at least one SESSION_PROMPT_v*.md');
const prompt = promptFiles[promptFiles.length - 1];
const ptext = fs.readFileSync(path.join(root, 'build_history', prompt.file), 'utf8');

// The consolidation is itself asserted: recreating either deleted file re-opens the second home for
// open items that this cut closed. Named explicitly so a future session has to decide, not drift.
for (const gone of ['HANDOVER.md', 'implementation_plan.md']) {
  assert.ok(!fs.existsSync(path.join(root, 'build_history', gone)),
    `build_history/${gone} was folded into the roadmap/prompt and deleted at the v80_d cut — ` +
    'recreating it re-creates the duplication that let the v80 diagnoses go missing from the ' +
    'durable document. If it is genuinely wanted back, delete this assertion deliberately.');
}
assert.strictEqual(promptFiles.length, 1,
  `exactly one session prompt should exist (found ${promptFiles.length}: ` +
  `${promptFiles.map(p => p.file).join(', ')}) — the convention is to RENAME the prompt at each ` +
  'cut, not to keep the previous one alongside');

// ── 1. The four baseline expectations vs. the actual suite ───────────────────
// Counted from run.js rather than by running it: this test is INSIDE the suite it would run.
const runjs = fs.readFileSync(path.join(root, 'test', 'run.js'), 'utf8');

// `expect NNN checks` / `expect NNN` in the prompt's baseline block.
const full = /node test\/run\.js\s+→ expect (\d+) checks/.exec(ptext);
const quick = /node test\/run\.js --quick\s+→ expect (\d+)/.exec(ptext);
assert.ok(full && quick,
  `${prompt.file} states its baseline as "node test/run.js → expect NNN checks" and ` +
  '"--quick → expect NNN" — if that block was reworded, update this guard');

// The count is derivable STATICALLY: run.js increments `total` once per run() call, and the e2e
// block is the only conditional group (`if (!quick) { ... } else { ... }`). So the quick count is
// every run() call outside that block and the full count is all of them. Counted from source
// rather than by executing the suite, because THIS TEST IS IN THE SUITE — spawning it here would
// recurse. Comment lines and the function's own definition are excluded; anything else that looks
// like a call is one.
const rl = runjs.split('\n');
const qStart = rl.findIndex(l => l.trim() === 'if (!quick) {');
const qEnd = rl.findIndex((l, i) => i > qStart && l.trim() === '} else {');
assert.ok(qStart > 0 && qEnd > qStart,
  'run.js still groups the e2e tests in `if (!quick) { ... } else { ... }` — if that changed, ' +
  'this counting rule needs revisiting rather than re-pinning');
const isCall = l => !/^\s*\/\//.test(l) && !/function run\(/.test(l) && /(?<![\w.])run\(/.test(l);
const e2eCount = rl.slice(qStart, qEnd).filter(isCall).length;
const quickCount = rl.filter((l, i) => !(i >= qStart && i < qEnd)).filter(isCall).length;
const fullCount = quickCount + e2eCount;

assert.strictEqual(Number(full[1]), fullCount,
  `${prompt.file} says the full suite is ${full[1]} checks; run.js contains ${fullCount} run() ` +
  'calls. Whichever is wrong, the prompt is the document that claims to describe "now".');
assert.strictEqual(Number(quick[1]), quickCount,
  `${prompt.file} says --quick is ${quick[1]} checks; run.js has ${quickCount} outside the e2e block.`);
assert.ok(e2eCount > 0, 'non-vacuity: the e2e block contains checks, so the two counts differ');
console.log(`  ${prompt.file} states baseline ${full[1]} / ${quick[1]}`);

// ── 2. The corpus counts vs. lessons.json et al ──────────────────────────────
// These are the ones that actually rotted: HANDOVER said 321 topics / 90 storylines at the v80 cut
// while the tree held 324 / 91, and it had been written FOUR MINUTES after lessons.json — so the
// number was carried, not measured. That is the whole reason this section exists.
const store = JSON.parse(fs.readFileSync(path.join(root, 'lessons.json'), 'utf8'));
const langs = JSON.parse(fs.readFileSync(path.join(root, 'languages.json'), 'utf8'));
const ui = JSON.parse(fs.readFileSync(path.join(root, 'ui.json'), 'utf8'));

const corpus = /\*\*(\d+) topics, (\d+) storylines, (\d+) languages, (\d+) `en` keys\*\*/.exec(ptext);
assert.ok(corpus,
  `${prompt.file} states its corpus as "**N topics, N storylines, N languages, N \`en\` keys**" — ` +
  'if that sentence was reworded, update this guard rather than dropping it');

const want = [
  ['topics',     Number(corpus[1]), (store.topics || []).length,      'lessons.json'],
  ['storylines', Number(corpus[2]), (store.storylines || []).length,  'lessons.json'],
  ['languages',  Number(corpus[3]), Object.keys(langs).length,        'languages.json'],
  ['en keys',    Number(corpus[4]), Object.keys(ui.en || {}).length,  'ui.json'],
];
for (const [what, stated, actual, src] of want) {
  assert.strictEqual(stated, actual,
    `${prompt.file} says ${stated} ${what}, but ${src} holds ${actual}. The PROMPT is the thing to ` +
    'fix: it describes "now", and a carried count is how three of the four stale items at the v80 ' +
    'cut happened. Measure, then edit the prompt.');
}
console.log(`  corpus counts agree with the tree: ${want.map(w => w[2] + ' ' + w[0]).join(', ')}`);

// ── 3. The prompt names the version it was cut at ────────────────────────────
const pv = /APP_VERSION = '([^']+)'/.exec(ptext);
assert.ok(pv, `${prompt.file} states APP_VERSION — if reworded, update this guard`);
assert.strictEqual(pv[1], vm[1],
  `${prompt.file} says APP_VERSION = '${pv[1]}' but server.js says '${vm[1]}'`);
console.log(`  prompt names APP_VERSION ${pv[1]}`);

console.log('unit-roadmap-version: ALL PASSED');
