// unit-fork-display.test.js — v79_k, the forked-storyline display.
//
// Rule 32: guard the ENUMERATION, not the instances that happened to get looked at. Every one of
// these sections derives its fixtures by SWEEPING lessons.json for forks under the client's own
// parent rule, so a fork added by a future data drop is covered the day it arrives, and a fork
// that stops being drawn correctly fails here rather than in a browser.
//
// Rule 34: what this CANNOT see is said plainly at the bottom — these assertions are on the
// markup `_renderStorylineScreen` produces, so they prove what is drawn and what a click is wired
// to, not that a real browser dispatches that click to the wrapper rather than the card inside it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const topics = store.topics || [];
const storylines = store.storylines || [];
const byId = new Map(topics.filter(t => t.id).map(t => [t.id, t]));
const byName = new Map(topics.map(t => [t.topic, t]));

// ── the fork sweep — the client's parent rule, not a second one ──────────────
// index.html: parent = continuedFromId ? byIdAll[…] : byTopic[continuedFrom], and the link is
// DROPPED when lang or srcLang differ. A fork the client cannot resolve is not a fork here either.
const succ = new Map();
for (const l of topics) {
  const parent = l.continuedFromId ? byId.get(l.continuedFromId)
               : (l.continuedFrom ? byName.get(l.continuedFrom) : null);
  if (!parent || parent.id === l.id) continue;
  if ((parent.lang || '') !== (l.lang || '') || (parent.srcLang || '') !== (l.srcLang || '')) continue;
  if (!succ.has(parent.id)) succ.set(parent.id, []);
  succ.get(parent.id).push(l.id);
}
const slOf = new Map();
for (const s of storylines) for (const c of (s.chapters || [])) {
  if (!slOf.has(c)) slOf.set(c, []);
  slOf.get(c).push(s.id);
}
const FORKS = [...succ.entries()].filter(([, kids]) => kids.length > 1)
  .map(([pid, kids]) => ({ pid, kids }));
assert.ok(FORKS.length > 0,
  'the corpus contains at least one fork to exercise — if this fails the sweep is broken, not the corpus');
console.log('  forks found by the client parent rule: ' + FORKS.length);

// Every (storyline that owns a fork parent) × (foreign kid) pair — the screens under test.
const PAIRS = [];
for (const f of FORKS) {
  for (const openSl of (slOf.get(f.pid) || [])) {
    for (const kid of f.kids) {
      const kidSls = (slOf.get(kid) || []).filter(s => s !== openSl);
      if (!kidSls.length) continue;                // a kid in no OTHER storyline is not a fork column
      if ((storylines.find(s => s.id === openSl)?.chapters || []).includes(kid)) continue; // own branch
      PAIRS.push({ openSl, kid, altSl: kidSls[0], parent: f.pid });
    }
  }
}
assert.ok(PAIRS.length > 0, 'at least one storyline shows a foreign fork branch');
console.log('  storyline × foreign-branch pairs under test: ' + PAIRS.length);

// ── the sandbox ─────────────────────────────────────────────────────────────
const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed-static');
const SAVED_LIST = JSON.stringify(topics.map(t => ({
  id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang, difficulty: t.difficulty,
  lessons: t.lessons, storyStyle: t.storyStyle, createdBy: t.createdBy, story: t.story,
  continuedFrom: t.continuedFrom, continuedFromId: t.continuedFromId,
})));
function seed(completed) {
  C.run(`
    APP.savedList = ${SAVED_LIST};
    APP.storylines = ${JSON.stringify(storylines)};
    APP.lessonData = null;
    APP.info = { backend: 'none', canGenerate: false, version: 'test', coverageThreshold: 0.8 };
    APP._teacherMode = false;
    APP.progress = { completed: ${JSON.stringify(completed || {})}, chapterDone: {}, solved: {}, learned: {} };
    APP._slScreen = null; true;
  `, 'seed');
}
function renderSl(slId) {
  const sl = storylines.find(s => s.id === slId);
  const names = (sl.chapters || []).map(cid => byId.get(cid)?.topic).filter(Boolean);
  C.run(`
    APP._slScreen = { chainId: ${JSON.stringify(slId)}, encodedChain: '', topics: ${JSON.stringify(names)} };
    _renderStorylineScreen(${JSON.stringify(slId)}, '', ${JSON.stringify(names)});
    true;`, 'render ' + slId);
  return C.document.getElementById('sl-screen-body').innerHTML || '';
}
const drawn = (html) => new Set(topics.filter(t =>
  html.includes('>' + t.topic + '<') || html.includes('>' + t.topic + ' ')).map(t => t.id));

// ── 1. the foreign fork is drawn COMPLETELY ─────────────────────────────────
// The defect this replaces: the else-arm drew ONE card per foreign kid and never recursed, so a
// four-chapter alternative showed as a single stub. "Completely" is measured against the other
// storyline's own chapters[] — every chapter of it is on screen, whether as part of the shared
// prefix above the fork or inside the greyed column.
{
  let checked = 0;
  for (const p of PAIRS) {
    seed({});
    const html = renderSl(p.openSl);
    const on = drawn(html);
    const alt = storylines.find(s => s.id === p.altSl);
    const missing = (alt.chapters || []).filter(c => byId.get(c) && !on.has(c));
    assert.deepStrictEqual(missing.map(c => byId.get(c).topic), [],
      `${p.openSl} must show every chapter of the forked storyline ${p.altSl} ("${alt.title}")`);
    checked++;
  }
  console.log('  every chapter of every forked storyline is on screen: OK (' + checked + ' pairs)');
}

// ── 2. the shared prefix is drawn ONCE (the user's ruling) ──────────────────
// "Don't draw the shared prefix multiple times, keep the forking." This is also what keeps the
// `_rendered` guard intact: the greyed column starts AT the fork, so a chapter both forks contain
// is drawn once, above the branch, and no column redraws it.
{
  for (const p of PAIRS) {
    seed({});
    const html = renderSl(p.openSl);
    const alt = storylines.find(s => s.id === p.altSl);
    const open = storylines.find(s => s.id === p.openSl);
    const shared = (alt.chapters || []).filter(c => (open.chapters || []).includes(c));
    for (const c of shared) {
      const name = byId.get(c).topic;
      const n = html.split('>' + name + '<').length - 1;
      assert.ok(n <= 1,
        `shared chapter "${name}" is drawn ${n} times on ${p.openSl} — the prefix must be drawn once`);
    }
  }
  console.log('  a chapter both forks contain is drawn at most once per screen: OK');
}

// ── 3. the marker: nothing for the open storyline, the TITLE for the others ─
{
  for (const p of PAIRS) {
    seed({});
    const html = renderSl(p.openSl);
    const alt = storylines.find(s => s.id === p.altSl);
    assert.ok(html.includes(alt.title),
      `${p.openSl} must label the foreign branch with the storyline TITLE "${alt.title}"`);
    // The A/B/C letters are gone — the whole point of the change.
    assert.ok(!/\u2442 [A-Z]\b/.test(html),
      `${p.openSl} still renders the old \u2442A/B/C letter marker`);
    // …and the open storyline never labels its own column with its own title as a fork marker.
    const own = storylines.find(s => s.id === p.openSl);
    assert.ok(!new RegExp('_openStorylineById\\(\'' + own.id + '\'\\)').test(html),
      `${p.openSl} must not offer a fork link to ITSELF`);
  }
  console.log('  fork marker is the other storyline title, never a letter, never self: OK');
}

// ── 4. the greyed branch opens that storyline, and its cards do not open a chapter ──
// Both halves matter. The wrapper carries `_openStorylineById`; the cards inside are
// pointer-events:none so `savedItemHtml`'s own `loadSaved` onclick cannot win the click.
{
  for (const p of PAIRS) {
    seed({});
    const html = renderSl(p.openSl);
    const m = html.match(/class="sl-fork-alt"[^>]*>/g) || [];
    assert.ok(m.length > 0, `${p.openSl} draws no greyed fork branch`);
    for (const tag of m) {
      assert.ok(/onclick="_openStorylineById\('sl_/.test(tag),
        `a greyed fork branch on ${p.openSl} is not wired to open a storyline: ${tag}`);
    }
    assert.ok(/class="sl-fork-alt"[\s\S]{0,300}?<div style="pointer-events:none">/.test(html),
      `${p.openSl}: the cards inside a greyed branch must be inert so the wrapper takes the click`);
    assert.ok(html.includes(`_openStorylineById('${p.altSl}')`),
      `${p.openSl} must offer a route into ${p.altSl}`);
  }
  console.log('  greyed branch opens the alternative storyline; its cards are inert: OK');
}

// ── 5. switching forks is REACHABLE FROM EITHER SIDE ───────────────────────
// The user's second bullet. Not "a link exists" but "the link exists both ways": for every pair of
// storylines that share a fork parent AND both list it, each must offer a route to the other.
{
  let pairsChecked = 0;
  for (const f of FORKS) {
    const owners = (slOf.get(f.pid) || []);
    for (const a of owners) for (const b of owners) {
      if (a === b) continue;
      // b is reachable from a only if b actually owns one of the fork's kids
      const bOwnsAKid = f.kids.some(k => (slOf.get(k) || []).includes(b));
      if (!bOwnsAKid) continue;
      seed({});
      const html = renderSl(a);
      assert.ok(html.includes(`_openStorylineById('${b}')`),
        `from ${a} the learner cannot reach fork ${b}`);
      pairsChecked++;
    }
  }
  assert.ok(pairsChecked > 0, 'at least one two-sided fork pair exists in the corpus');
  console.log('  forks are switchable from either side: OK (' + pairsChecked + ' directed pairs)');
}

// ── 5b. the ACTIVE fork sits in the CENTRE, alternatives to the sides (v79_l, user) ──
// The column the learner is reading must not drift left as forks are added. Asserted on the
// ORDER of the branch columns, which is the only place the claim is observable: a column is "own"
// if it is not a `.sl-fork-alt` wrapper. With one alternative there is nothing to balance, so the
// claim is only that own comes first; with two or more, own must sit strictly between them.
{
  let widest = 0, checkedCentred = 0;
  for (const slId of [...new Set(PAIRS.map(p => p.openSl))]) {
    seed({});
    const html = renderSl(slId);
    // Split on the column wrapper the branch block emits, then classify each column.
    const cols = html.split('<div style="flex:1;min-width:0').slice(1);
    if (cols.length < 2) continue;
    const kinds = cols.map(c => {
      // a column's own content ends where the next column begins
      const body = c.split('<div style="flex:1;min-width:0')[0];
      return /class="sl-fork-alt"/.test(body) ? 'alt' : 'own';
    });
    const ownAt = kinds.indexOf('own');
    assert.ok(ownAt >= 0, `${slId}: the branch has no column for the open storyline: ${kinds}`);
    // ownKids stay contiguous — never an alt wedged inside the own group
    const lastOwn = kinds.lastIndexOf('own');
    assert.ok(!kinds.slice(ownAt, lastOwn + 1).includes('alt'),
      `${slId}: an alternative is wedged inside the open storyline's columns: ${kinds}`);
    const alts = kinds.filter(k => k === 'alt').length;
    if (alts >= 2) {
      assert.ok(ownAt > 0 && lastOwn < kinds.length - 1,
        `${slId}: with ${alts} alternatives the open storyline must sit BETWEEN them, got ${kinds}`);
      checkedCentred++;
    }
    widest = Math.max(widest, kinds.length);
  }
  assert.ok(checkedCentred > 0,
    'at least one fork with two or more alternatives exists — otherwise "centred" is untested');
  console.log('  active fork centred, alternatives to the sides: OK (' +
    checkedCentred + ' multi-alt fork(s), widest branch ' + widest + ' columns)');
}

// ── 6. a shared chapter counts the SAME for every fork ─────────────────────
// The user's third bullet, guarded where the claim is observable (rule 34): completion is stored
// by TOPIC NAME and is therefore storyline-agnostic, so finishing a chapter both forks list must
// move both decks by the same amount. Asserted through the product helpers, over every fork.
{
  let checked = 0;
  for (const f of FORKS) {
    const owners = (slOf.get(f.pid) || []);
    if (owners.length < 2) continue;
    for (let i = 0; i < owners.length; i++) for (let j = i + 1; j < owners.length; j++) {
      const A = storylines.find(s => s.id === owners[i]), B = storylines.find(s => s.id === owners[j]);
      const shared = (A.chapters || []).filter(c => (B.chapters || []).includes(c));
      if (!shared.length) continue;
      const completed = {};
      for (const c of shared) {
        const t = byId.get(c);
        completed[t.topic] = Object.fromEntries((t.lessons || []).map(l => [l.id, { correct: 1, total: 1 }]));
      }
      seed(completed);
      const verdicts = C.run(`
        (function(){
          const m = Object.fromEntries((APP.savedList||[]).filter(l=>l.id).map(l=>[l.id,l]));
          return JSON.stringify(${JSON.stringify(shared)}.map(cid => ({
            id: cid, done: !!chapterComplete(m[cid]), counted: countedLessons(m[cid]).length
          })));
        })()`, 'verdicts');
      for (const v of JSON.parse(verdicts)) {
        assert.ok(v.done,
          `shared chapter "${byId.get(v.id).topic}" was played in full but does not read as complete`);
      }
      // and the two decks must both have counted it
      const statsOf = (slId) => JSON.parse(C.run(`
        (function(){
          const m = Object.fromEntries((APP.savedList||[]).filter(l=>l.id).map(l=>[l.id,l]));
          return JSON.stringify(_slProgressStats(${JSON.stringify(storylines.find(s=>s.id===slId).chapters||[])}, m));
        })()`, 'stats'));
      const sa = statsOf(A.id), sb = statsOf(B.id);
      assert.strictEqual(sa.doneChapters, shared.length,
        `${A.id} must count all ${shared.length} shared chapter(s) as done`);
      assert.strictEqual(sb.doneChapters, shared.length,
        `${B.id} must count all ${shared.length} shared chapter(s) as done — a chapter both forks ` +
        `contain must not be progress on one and nothing on the other`);
      checked++;
    }
  }
  assert.ok(checked > 0, 'at least one fork has a shared prefix listed by both storylines');
  console.log('  shared chapters count identically for every fork: OK (' + checked + ' storyline pairs)');
}

// ── 7. nothing was broken while rendering any of it ────────────────────────
{
  const errs = C.run('JSON.stringify((typeof _cardErrors === "function") ? _cardErrors() : [])', 'errs');
  assert.deepStrictEqual(JSON.parse(errs), [], '_cardErrors() must be empty after every fork render');
  console.log('  _cardErrors() empty after every render: OK');
}

// ── What this test does NOT establish (rule 34) ────────────────────────────
// • It reads MARKUP. That the wrapper's onclick actually wins over the inner card's `loadSaved` is
//   a browser event-dispatch fact; `pointer-events:none` on the inner block is asserted as the
//   mechanism, but only a live click proves the outcome. LIVE-TEST-CHECKLIST carries the step.
// • It says nothing about the ASYMMETRIC fork, where the other storyline does not list the fork
//   parent at all (`sl_1041030875` at this cut, whose only chapter continues from a chapter it
//   does not contain). That deck still shows one card and no fork, because it has no fork parent
//   to branch from — a membership question in the DATA, left open deliberately.
console.log('unit-fork-display: ALL PASSED');
