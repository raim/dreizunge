// probe_forks_v79k.js — BASELINE measurement for the forked-storyline display task.
//
// It answers three questions with the PRODUCT functions, never a re-implementation:
//   1. which forks does the corpus actually contain, resolved the way the CLIENT resolves
//      parents (continuedFromId first, name as legacy fallback, same lang+srcLang only)?
//   2. what does _renderStorylineScreen draw for each side of a fork today — how many cards,
//      which of them are the greyed non-interactive stub, what the fork marker says?
//   3. is a SHARED chapter attributed the same way to every fork? Measured by driving the
//      product's own completion path (chapterComplete / _slProgressStats) from a seeded
//      progress store, and comparing the two sides.
//
// Nothing here writes. Run: node build_history/probe_forks_v79k.js
'use strict';
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require(path.join(__dirname, '..', 'test', 'lib-dom'));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const topics = store.topics || [];
const storylines = store.storylines || [];
const byId = new Map(topics.filter(t => t.id).map(t => [t.id, t]));
const byName = new Map(topics.map(t => [t.topic, t]));

// ── 1. fork enumeration, using the client's parent rule ─────────────────────
// index.html builds _succMap as: parent = continuedFromId ? byIdAll[..] : byTopic[continuedFrom],
// and DROPS the link when lang or srcLang differ. Mirrored exactly here — a fork the client
// cannot see is not a fork for this task.
const succ = new Map();
for (const l of topics) {
  const parent = l.continuedFromId ? byId.get(l.continuedFromId)
               : (l.continuedFrom ? byName.get(l.continuedFrom) : null);
  if (!parent) continue;
  if ((parent.lang || '') !== (l.lang || '') || (parent.srcLang || '') !== (l.srcLang || '')) continue;
  if (parent.id === l.id) continue;                       // self-link (corpus artefact, reported below)
  if (!succ.has(parent.id)) succ.set(parent.id, []);
  succ.get(parent.id).push(l.id);
}
const slOf = new Map();                                    // topic id -> [storyline ids]
for (const s of storylines) for (const c of (s.chapters || [])) {
  if (!slOf.has(c)) slOf.set(c, []);
  slOf.get(c).push(s.id);
}
const selfLinks = topics.filter(t => t.continuedFromId && t.continuedFromId === t.id);

console.log('=== 1. FORKS IN THE CORPUS (client parent rule) ===');
console.log('topics: ' + topics.length + '   storylines: ' + storylines.length);
if (selfLinks.length) {
  console.log('NOTE  ' + selfLinks.length + ' topic(s) name THEMSELVES as continuedFromId — dropped above,');
  console.log('      and dropped by the client too (a self-link renders as its own successor):');
  for (const t of selfLinks) console.log('        ' + t.id + '  "' + t.topic + '"');
}
const forks = [];
for (const [pid, kids] of succ) {
  if (kids.length < 2) continue;
  forks.push({ pid, kids });
}
for (const f of forks) {
  const p = byId.get(f.pid);
  console.log('\nfork parent  ' + f.pid + '  "' + p.topic + '"  (' + p.lang + '<-' + p.srcLang + ')');
  console.log('  parent is a chapter of : ' + ((slOf.get(f.pid) || []).join(', ') || '(no storyline)'));
  for (const k of f.kids) {
    const kt = byId.get(k);
    console.log('    kid ' + k + '  "' + kt.topic + '"  in: ' + ((slOf.get(k) || []).join(', ') || '(NO STORYLINE)'));
  }
}

// ── the client sandbox ──────────────────────────────────────────────────────
const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed-static');
const SAVED_LIST = JSON.stringify(topics.map(t => ({
  id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang, difficulty: t.difficulty,
  lessons: t.lessons, storyStyle: t.storyStyle, createdBy: t.createdBy, story: t.story,
  continuedFrom: t.continuedFrom, continuedFromId: t.continuedFromId,
  storyMeta: t.storyMeta, translationMeta: t.translationMeta, generationStats: t.generationStats,
})));

// `completedSeed` is written to APP.progress.completed — the store keyed by TOPIC NAME.
function seed(completedSeed, chapterDoneSeed) {
  C.run(`
    APP.savedList = ${SAVED_LIST};
    APP.storylines = ${JSON.stringify(storylines)};
    APP.lessonData = null;
    APP.info = { backend: 'none', canGenerate: false, version: 'probe', coverageThreshold: 0.8 };
    APP._teacherMode = false;
    APP.progress = { completed: ${JSON.stringify(completedSeed || {})},
                     chapterDone: ${JSON.stringify(chapterDoneSeed || {})},
                     solved: {}, learned: {} };
    APP._slScreen = null;
    true;
  `, 'seed');
}

function renderSl(slId) {
  const sl = storylines.find(s => s.id === slId);
  const names = (sl.chapters || []).map(cid => byId.get(cid)?.topic).filter(Boolean);
  C.run(`
    APP._slScreen = { chainId: ${JSON.stringify(slId)}, encodedChain: '', topics: ${JSON.stringify(names)} };
    _renderStorylineScreen(${JSON.stringify(slId)}, '', ${JSON.stringify(names)});
    true;
  `, 'render ' + slId);
  return C.document.getElementById('sl-screen-body').innerHTML || '';
}

// Which chapters does the drawn tree actually contain, and how?
function readScreen(html) {
  const drawn = [];
  for (const t of topics) {
    const n = html.split('>' + t.topic + '<').length - 1
            + html.split('>' + t.topic + ' ').length - 1;
    if (n > 0) drawn.push({ id: t.id, topic: t.topic, times: n });
  }
  // v79_k markup: a greyed alternative branch is one `sl-fork-alt` wrapper holding every chapter
  // of that fork; the fork marker is the other storyline's TITLE, and the open storyline's column
  // carries an empty marker row. The pre-v79_k detectors (`opacity:.5;pointer-events:none`, and
  // the `\u2442 A/B/C` letters) are kept below so a regression to the old shape is visible rather
  // than reading as zero of everything.
  const altBlocks = (html.match(/class="sl-fork-alt"/g) || []).length;
  const altOpeners = (html.match(/_openStorylineById\('([^']+)'\)/g) || [])
    .map(m => m.replace(/.*\('|'\).*/g, ''));
  const oldStubs = (html.match(/opacity:\.5;pointer-events:none/g) || []).length;
  const oldMarkers = (html.match(/\u2442 [A-Z]/g) || []);
  const locks = (html.match(/🔒/g) || []).length;
  return { drawn, altBlocks, altOpeners, oldStubs, oldMarkers, locks };
}

console.log('\n\n=== 2. WHAT THE SCREEN DRAWS TODAY (learner: canGenerate=false, teacher=false) ===');

// The two fork families the enumeration above finds with resolvable, storyline-bearing kids.
const CASES = [
  { label: 'A. shared prefix, both forks list it', pair: ['sl_1191899409', 'sl_320941528'] },
  { label: 'B. asymmetric — the fork parent is a chapter of one side only', pair: ['sl_182891979', 'sl_1041030875'] },
];

for (const cs of CASES) {
  console.log('\n--- ' + cs.label + ' ---');
  for (const slId of cs.pair) {
    const sl = storylines.find(s => s.id === slId);
    seed({}, {});
    const html = renderSl(slId);
    const r = readScreen(html);
    console.log('\n  ' + slId + '  "' + sl.title + '"');
    console.log('    chapters[] (' + sl.chapters.length + '): ' +
      sl.chapters.map(c => byId.get(c)?.topic || ('?' + c)).join(' -> '));
    console.log('    cards drawn (' + r.drawn.length + '): ' +
      r.drawn.map(d => d.topic + (d.times > 1 ? ' x' + d.times : '')).join(' | '));
    console.log('    greyed alt-fork blocks: ' + r.altBlocks +
      '   opens storyline: ' + ([...new Set(r.altOpeners)].join(', ') || '(none)') +
      '   locks: ' + r.locks);
    console.log('    pre-v79_k shapes still present (expect 0/none): stubs=' + r.oldStubs +
      ' letters=' + (r.oldMarkers.join(' ') || 'none'));
    const extra = r.drawn.filter(d => !sl.chapters.includes(d.id));
    console.log('    drawn but NOT in this storyline: ' + (extra.map(d => d.topic).join(', ') || '(none)'));
    const missing = sl.chapters.filter(c => !r.drawn.some(d => d.id === c));
    console.log('    in this storyline but NOT drawn: ' +
      (missing.map(c => byId.get(c)?.topic || c).join(', ') || '(none)'));
    // The wrapper takes the click; the cards inside are pointer-events:none so savedItemHtml's own
    // loadSaved onclick cannot fire. Both halves are asserted, because either alone is not the claim.
    const wrapClickable = /class="sl-fork-alt"[^>]*onclick="_openStorylineById/.test(html);
    const innerInert = /class="sl-fork-alt"[\s\S]{0,300}?<div style="pointer-events:none">/.test(html);
    console.log('    greyed branch opens the OTHER storyline on click: ' + wrapClickable +
      '   inner chapter cards inert: ' + innerInert);
    const titles = (html.match(/_openStorylineById\('[^']+'\)"[^>]*>([^<]+)</g) || [])
      .map(m => m.replace(/.*>/, '').trim());
    console.log('    marker text: ' + (titles.join(' | ') || '(none — no foreign branch here)'));
  }
}

// ── 3. attribution of a SHARED chapter ──────────────────────────────────────
// Drive the product's own helpers. `chapterComplete` reads APP.progress by TOPIC NAME;
// `_slProgressStats` walks a storyline's chapterIds. The question is whether finishing a
// shared chapter moves both sides by the same amount.
console.log('\n\n=== 3. DOES A SHARED CHAPTER COUNT THE SAME FOR EVERY FORK? ===');

function statsFor(slId) {
  const sl = storylines.find(s => s.id === slId);
  const ids = JSON.stringify(sl.chapters || []);
  return C.run(`
    (function(){
      const byIdMap = Object.fromEntries((APP.savedList||[]).filter(l=>l.id).map(l=>[l.id,l]));
      const st = _slProgressStats(${ids}, byIdMap);
      const per = (${ids}).map(cid => {
        const s = byIdMap[cid];
        return { topic: s && s.topic, complete: s ? !!chapterComplete(s) : null,
                 counted: s ? countedLessons(s).length : null };
      });
      return JSON.stringify({ st: st, per: per });
    })()
  `, 'stats ' + slId);
}

// Mark every lesson of the SHARED chapter done. Both sides should move identically
// for the part they share.
function completeChapters(names) {
  const out = {};
  for (const n of names) {
    const t = byName.get(n);
    out[n] = Object.fromEntries((t.lessons || []).map(l => [l.id, { correct: 1, total: 1 }]));
  }
  return out;
}

for (const cs of CASES) {
  console.log('\n--- ' + cs.label + ' ---');
  // the chapters that are ancestors of the fork: the shared prefix
  const [aId, bId] = cs.pair;
  const A = storylines.find(s => s.id === aId), B = storylines.find(s => s.id === bId);
  const sharedIds = (A.chapters || []).filter(c => (B.chapters || []).includes(c));
  console.log('  chapters listed by BOTH storylines: ' +
    (sharedIds.map(c => byId.get(c)?.topic).join(', ') || '(none)'));

  for (const phase of ['nothing played', 'the shared prefix played']) {
    const names = phase === 'nothing played' ? []
      : (sharedIds.length ? sharedIds.map(c => byId.get(c).topic)
                          // no listed overlap: play the fork PARENT, whoever lists it
                          : [byId.get(forks.find(f => (f.kids || []).some(k => (B.chapters || []).includes(k)))?.pid)?.topic].filter(Boolean));
    seed(completeChapters(names), {});
    console.log('\n  [' + phase + (names.length ? ': ' + names.join(', ') : '') + ']');
    for (const slId of cs.pair) {
      renderSl(slId);                       // render first: the screen is what the learner sees
      const raw = JSON.parse(statsFor(slId));
      const sl = storylines.find(s => s.id === slId);
      console.log('    ' + slId + ' "' + sl.title + '"  ' +
        'doneChapters=' + raw.st.doneChapters + '/' + raw.st.totalChapters +
        '  unlocked=' + raw.st.unlockedChapters + '/' + raw.st.totalChapters +
        '  bar=' + raw.st.pct + '%  lessons=' + raw.st.doneSets + '/' + raw.st.totalSets);
      console.log('      per chapter: ' + raw.per.map(p => p.topic + '=' + (p.complete ? 'DONE' : '.')).join('  '));
    }
  }
}

console.log('\n\n=== _cardErrors after the last render ===');
console.log(C.run('JSON.stringify((typeof _cardErrors === "function") ? _cardErrors() : "no such function")', 'errs'));

// ── 4. the 3-way fork, and how much of the OTHER fork the stub actually shows ─
// The roadmap/INTERNALS row says the else-arm "renders only kids[0]". Checked here rather
// than assumed: what it renders is ONE CARD PER other-kid, with no recursion into that
// branch — a different (and larger) truncation than "only the first kid".
console.log('\n\n=== 4. THE 3-WAY FORK, AND THE SHAPE OF THE TRUNCATION ===');
for (const slId of ['sl_1271936135', 'sl_1362886653', 'sl_703242082']) {
  const sl = storylines.find(s => s.id === slId);
  seed({}, {});
  const html = renderSl(slId);
  const r = readScreen(html);
  console.log('\n  ' + slId + ' "' + sl.title + '"  chapters[]=' + sl.chapters.length);
  console.log('    cards drawn: ' + r.drawn.length + '   alt-fork blocks: ' + r.altBlocks +
              '   opens: ' + ([...new Set(r.altOpeners)].join(', ') || '(none)'));
  console.log('    drawn from other storylines: ' +
    (r.drawn.filter(d => !sl.chapters.includes(d.id)).map(d => d.topic).join(', ') || '(none)'));
}
// How many chapters does each OTHER fork really have, vs how many this screen shows of it?
console.log('\n  other-fork completeness, case A (sl_1191899409 open):');
{
  seed({}, {});
  const html = renderSl('sl_1191899409');
  const other = storylines.find(s => s.id === 'sl_320941528');
  const drawnIds = new Set(readScreen(html).drawn.map(d => d.id));
  const shown = other.chapters.filter(c => drawnIds.has(c));
  console.log('    "' + other.title + '" has ' + other.chapters.length + ' chapters; this screen shows ' +
    shown.length + ': ' + shown.map(c => byId.get(c).topic).join(', '));
  console.log('    not shown: ' + other.chapters.filter(c => !shown.includes(c))
    .map(c => byId.get(c).topic).join(', '));
}
