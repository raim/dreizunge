// unit-live-static-progress-parity.test.js
// v74_i — the storyline screen must report the SAME progress in live and static mode.
//
// This is the third time this class of bug has shipped: a renderer reads a field that the static
// build has for free (it bakes whole topics) and the live list payload omits (v55_s generationStats,
// v58 provenance, and now `lessons[]`). It is quiet, because every headless test builds
// `APP.savedList` from whole topics and therefore runs in the STATIC shape — the live shape only
// appears in a browser.
//
// What it cost, reported from a real play-test of "Paella und Chaos" with BOTH chapters finished:
//   live header "0/0" vs static "4/8"; no per-chapter bars in live; no green completion dots; and
//   the final card said "Lektion abgeschlossen" where static said "Geschichte abgeschlossen".
// All four from ONE missing field: with no `lessons[]`, `countedLessons(s)` is 0, so
// `chapterComplete()` rejects its v69_l stamp (`rec.n === 0`) and then fails its fallback
// (`counted.length > 0`) — false for every chapter except the active one.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const builder = fs.readFileSync(path.join(ROOT, 'build-static.js'), 'utf8');

// ── 1. The live list payload projects lessons, and excludes hidden from the count ────────────
{
  assert.ok(/lessons: \(l\.lessons \|\| \[\]\)\.map\(L => \(\{/.test(server),
    'the live list payload projects a lessons[] array');
  for (const field of ['id:', 'type:', '_hidden', '_aiExamples']) {
    assert.ok(new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(server),
      `the projection carries ${field} — countedLessons needs all of them`);
  }
  // Content must stay OUT: shipping it costs 1536KB against 50KB, and no savedList consumer reads
  // it (they all work from APP.lessonData, fetched on demand).
  const proj = server.slice(server.indexOf('lessons: (l.lessons || []).map(L => ({'));
  const projBlock = proj.slice(0, proj.indexOf('})),') + 4);
  for (const heavy of ['vocab', 'sentences', 'corruptedStory', 'story']) {
    assert.ok(!projBlock.includes(heavy),
      `the projection does NOT ship ${heavy} — it is metadata only`);
  }
  // Hidden lessons never count for anything (user ruling, v74_e). Both builds, same rule.
  assert.ok(/lessonCount: \(l\.lessons \|\| \[\]\)\.filter\(L => L && !L\._hidden && !L\._aiExamples\)\.length/.test(server),
    'the live lessonCount excludes hidden lessons');
  assert.ok(/const count=\(s\.lessons\|\|\[\]\)\.filter\(L=>L&&!L\._hidden&&!L\._aiExamples\)\.length;/.test(builder),
    'and so does the static one, so a chapter reports the same number in both builds');
}

// ── 2. Behavioural parity on a real storyline ────────────────────────────────────────────────
// Built with the SAME field list the projection uses. The two savedList shapes are the only
// difference between the runs — progress, corpus and play are identical.
const liveProject = (t) => ({
  id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  lessonCount: (t.lessons || []).filter(L => L && !L._hidden && !L._aiExamples).length,
  lessons: (t.lessons || []).map(L => Object.assign(
    { id: L.id, type: L.type || 'standard' },
    L._hidden ? { _hidden: true } : {},
    L._aiExamples ? { _aiExamples: true } : {})),
});
// The static build strips hidden ai_error_hunts at bake time, then ships whole topics.
const staticProject = (t) => ({
  id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  lessons: (t.lessons || []).filter(L => !(L._hidden && L.type === 'ai_error_hunt')),
});

function playThrough(list, topics, chapterIds) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = ${JSON.stringify(list)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{} };
    APP._teacherMode = false; true;`, 'setup');
  for (const t of topics) {
    C.run(`
      APP.lessonData = ${JSON.stringify(t)};
      APP.lang = ${JSON.stringify(t.lang)}; APP.srcLang = ${JSON.stringify(t.srcLang)};
      APP.cur = { lessonIdx:0, exercises:[], cur:0 };
      if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
      (function(){
        var m = _solvedMap(APP.lessonData.topic);
        countedLessons(APP.lessonData).forEach(function(L){
          _lessonItemUniverse(APP.lessonData.lessons.indexOf(L)).forEach(function(k){ m[k] = 1; }); });
        var d = APP.progress.completed[APP.lessonData.topic] = {};
        countedLessons(APP.lessonData).forEach(function(L){ d[L.id] = { done:true, correct:4, total:4 }; });
      })();
      setComplete(APP.lessonData); true;`, 'play');
  }
  // Stand on the LAST chapter, as a learner finishing the storyline does.
  C.run(`APP.lessonData = ${JSON.stringify(topics[topics.length - 1])};
         APP.cur = { lessonIdx:0, exercises:[], cur:0 }; true;`, 'stand');
  const byId = `(function(){ var m={}; (APP.savedList||[]).forEach(function(s){ m[s.id]=s; }); return m; })()`;
  return {
    header: C.run(`_slProgressLabel(_slProgressStats(${JSON.stringify(chapterIds)}, ${byId}))`, 'h'),
    // The final card's title reads exactly this (v71_k).
    storyDone: C.run(`(function(){ var ids=${JSON.stringify(chapterIds)}, b=${byId};
        return ids.length>0 && ids.every(function(c){ var e=b[c]; return !!(e && chapterComplete(e)); }); })()`, 's'),
    perChapter: JSON.parse(C.run(`JSON.stringify((APP.savedList||[]).map(function(s){
        return { counted: countedLessons(s).length, complete: chapterComplete(s) }; }))`, 'p')),
  };
}

{
  // A storyline worth testing: more than one chapter, at least one hidden lesson (or the
  // hidden-exclusion half is vacuous) and at least one mixed-driven chapter (or the folded-prep
  // half is). Both were present in the reported failure.
  const byId = Object.fromEntries((store.topics || []).map(t => [t.id, t]));
  const sl = (store.storylines || []).find(s => {
    const ts = (s.chapters || []).map(c => byId[c]).filter(Boolean);
    if (ts.length < 2) return false;
    return ts.some(t => (t.lessons || []).some(L => L && (L._hidden || L._aiExamples)))
        && ts.some(t => (t.lessons || []).some(L => L && L.type === 'mixed' && !L._hidden));
  });
  assert.ok(sl, 'the corpus has a multi-chapter storyline with both a hidden lesson and a mixed chapter');
  const topics = (sl.chapters || []).map(c => byId[c]).filter(Boolean);

  const S = playThrough(topics.map(staticProject), topics, sl.chapters || []);
  const L = playThrough(topics.map(liveProject),   topics, sl.chapters || []);

  assert.strictEqual(L.header, S.header,
    `live and static report the same storyline progress (live ${L.header}, static ${S.header})`);
  assert.strictEqual(L.storyDone, S.storyDone,
    'and agree on whether the story is finished — this is what picks the final card\'s title');
  assert.deepStrictEqual(L.perChapter, S.perChapter,
    'and on every chapter\'s counted-lesson count and completion');

  // Not just equal — CORRECT. Two runs can agree by being broken in the same way, and "0/0 == 0/0"
  // would have passed everything above.
  assert.strictEqual(L.storyDone, true, 'a fully played storyline reads as finished');
  assert.ok(/^(\d+)\/\1( |$)/.test(L.header),
    `a fully played storyline reads n/n, not a fraction it can never close (got ${L.header})`);
  for (const c of L.perChapter) {
    assert.ok(c.counted > 0, 'every chapter has counted lessons in the live shape');
    assert.strictEqual(c.complete, true, 'and every finished chapter reads complete');
  }
  console.log(`  parity: live ${L.header} === static ${S.header}, storyDone=${L.storyDone}, chapters=${JSON.stringify(L.perChapter)}`);
}

// ── 3. v74_k: the read-full-story lock uses the SHARED completion rule ──────────────────────
// It had its own copy of "every raw lesson has a done-flag" — the FOURTH instance of that pattern
// (three were fixed in v74_i). A mixed-driven chapter's folded prep lessons never receive a
// done-flag and a hidden lesson never receives one either, so `every()` could not be satisfied and
// the 🔒 was PERMANENT however thoroughly the storyline was played. Measured on the shipped
// "Paella und Chaos" before the fix: Kälte rawLessons=3/flagged=2, Churros rawLessons=6/flagged=2,
// while `chapterComplete` said true for both.
//
// Asserted through the REAL renderer rather than by re-deriving the rule — a probe that
// re-implements the condition agrees with a broken implementation, which is how this same class of
// bug was missed twice already in this session.
{
  const byId = Object.fromEntries((store.topics || []).map(t => [t.id, t]));
  const sl = (store.storylines || []).find(s => {
    const ts = (s.chapters || []).map(c => byId[c]).filter(Boolean);
    return ts.length >= 2 && ts.some(t => (t.lessons || []).some(L => L && L.type === 'mixed' && !L._hidden));
  });
  // Non-vacuity: without a mixed chapter the old rule and the new one agree, and this proves nothing.
  assert.ok(sl, 'the corpus has a multi-chapter storyline containing a mixed-driven chapter');
  const topics = (sl.chapters || []).map(c => byId[c]).filter(Boolean);
  const names = topics.map(t => t.topic);

  const renderScreen = (play) => {
    const C = loadClient({ quiet: true });
    C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
    C.run(`
      APP.savedList = ${JSON.stringify(topics.map(staticProject))};
      APP.storylines = ${JSON.stringify(store.storylines || [])};
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed:{}, solved:{}, chapterDone:{} };
      APP._teacherMode = false; APP._slScreen = {}; true;`, 'setup');
    if (play) for (const t of topics) {
      C.run(`
        APP.lessonData = ${JSON.stringify(t)};
        APP.lang = ${JSON.stringify(t.lang)}; APP.srcLang = ${JSON.stringify(t.srcLang)};
        APP.cur = { lessonIdx:0, exercises:[], cur:0 };
        if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
        (function(){
          var m = _solvedMap(APP.lessonData.topic);
          countedLessons(APP.lessonData).forEach(function(L){
            _lessonItemUniverse(APP.lessonData.lessons.indexOf(L)).forEach(function(k){ m[k]=1; }); });
          var d = APP.progress.completed[APP.lessonData.topic] = {};
          countedLessons(APP.lessonData).forEach(function(L){ d[L.id] = {done:true, correct:4, total:4}; });
        })();
        setComplete(APP.lessonData); true;`, 'play');
    }
    C.run(`APP.lessonData = null;
      _renderStorylineScreen('ch1', encodeURIComponent(${JSON.stringify(names)}.join('|')), ${JSON.stringify(names)});
      true;`, 'render');
    const html = C.run(`(function(){ var e=document.getElementById('sl-screen-body'); return e ? e.innerHTML : ''; })()`, 'h');
    return { locked: /🔒/.test(html), readable: /toggleChainStory/.test(html) };
  };

  const before = renderScreen(false);
  assert.strictEqual(before.locked, true, 'with nothing played the full story is locked');
  assert.strictEqual(before.readable, false, 'and not readable — otherwise the lock is decorative');
  const after = renderScreen(true);
  assert.strictEqual(after.locked, false,
    'a fully played storyline UNLOCKS the full story, even when a chapter is mixed-driven');
  assert.strictEqual(after.readable, true, 'and the read-full-story header becomes clickable');
  // The SAME raw rule guarded the chapter chain: a chapter stayed locked while its predecessor was
  // judged unfinished. Play ONLY the first chapter and leave the second untouched — the second must
  // open. The first chapter carries a hidden lesson, so under the raw rule it is never "finished"
  // and the second would be locked forever.
  // The FIRST chapter must be one the two rules disagree about, AFTER static projection — and the
  // projection strips hidden ai_error_hunts, so "has a hidden lesson" in the raw corpus is not
  // enough. A first version of this assertion checked the raw topic and went vacuous: the revert
  // passed. It has to be a chapter whose folded/hidden lessons SURVIVE projection.
  const differs = (t) => {
    const ls = staticProject(t).lessons || [];
    return ls.some(L => L && L.type === 'mixed' && !L._hidden)
        || ls.some(L => L && (L._hidden || L._aiExamples));
  };
  const sl2 = (store.storylines || []).find(x => {
    const ts = (x.chapters || []).map(c => byId[c]).filter(Boolean);
    return ts.length >= 2 && differs(ts[0]);
  });
  assert.ok(sl2, 'the corpus has a storyline whose FIRST chapter the two rules judge differently');
  const topics2 = (sl2.chapters || []).map(c => byId[c]).filter(Boolean);
  const names2 = topics2.map(t => t.topic);
  const first = topics2[0];
  assert.ok(differs(first), 'and this is it — otherwise the revert below would pass');
  const C2 = loadClient({ quiet: true });
  C2.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C2.run(`
    APP.savedList = ${JSON.stringify(topics2.map(staticProject))};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{} };
    APP._teacherMode = false; APP._slScreen = {}; true;`, 'setup');
  C2.run(`
    APP.lessonData = ${JSON.stringify(first)};
    APP.lang = ${JSON.stringify(first.lang)}; APP.srcLang = ${JSON.stringify(first.srcLang)};
    APP.cur = { lessonIdx:0, exercises:[], cur:0 };
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    (function(){
      var m = _solvedMap(APP.lessonData.topic);
      countedLessons(APP.lessonData).forEach(function(L){
        _lessonItemUniverse(APP.lessonData.lessons.indexOf(L)).forEach(function(k){ m[k]=1; }); });
      var d = APP.progress.completed[APP.lessonData.topic] = {};
      countedLessons(APP.lessonData).forEach(function(L){ d[L.id] = {done:true, correct:4, total:4}; });
    })();
    setComplete(APP.lessonData); APP.lessonData = null;
    _renderStorylineScreen('ch1', encodeURIComponent(${JSON.stringify(names2)}.join('|')), ${JSON.stringify(names2)});
    true;`, 'play-first');
  const html2 = C2.run(`(function(){ var e=document.getElementById('sl-screen-body'); return e ? e.innerHTML : ''; })()`, 'h');
  // v76_d: this counted TOTAL 🔒 and required exactly 1, which silently encoded the shape of a
  // TWO-chapter storyline (ch2 open + the full-story row locked). The corpus is not a constant
  // (harness rule): the first chain the selector above matches is now SIX chapters, where ch3..ch6
  // are locked *correctly* — their own predecessors are unplayed — so the count was 5 and the
  // product was right. Assert the CLAIM instead: the chapter AFTER a completed one opens.
  // Chapter cards carry a locked/unlocked wrapper (index.html ~7490); read that, in render order.
  const cards = [];
  const wrapRe = /<div style="position:relative;border-radius:var\(--radius-xl\);overflow:hidden(;opacity:\.45;pointer-events:none)?">/g;
  for (let mm; (mm = wrapRe.exec(html2)) !== null; ) cards.push({ locked: !!mm[1], at: mm.index });
  assert.ok(cards.length >= 2,
    `the storyline screen rendered its chapter cards (found ${cards.length})`);
  assert.strictEqual(cards[0].locked, false, 'the played chapter itself is open');
  assert.strictEqual(cards[1].locked, false,
    'the chapter AFTER a completed one opens — the shared-rule fix (v74_i); under the raw '
    + '`every(done)` rule a mixed/hidden-lesson chapter is never "finished" and this stayed locked');
  // Non-vacuity, evaluated on the data this assertion actually runs against (session-28 rule 3):
  // if NOTHING is ever locked the check above is meaningless. A chain longer than two must still
  // lock the chapter whose own predecessor is unplayed.
  if (cards.length > 2) {
    assert.strictEqual(cards[2].locked, true,
      'a chapter whose OWN predecessor is unplayed is still locked — otherwise the chain rule is '
      + 'not running at all and the assertion above passes for the wrong reason');
  }
  // The full story stays locked while later chapters are unplayed; it renders its own lock row
  // (index.html ~7608) rather than a card overlay.
  const fullStoryLocks = (html2.match(/<span>🔒<\/span>/g) || []).length;
  assert.strictEqual(fullStoryLocks, 1,
    `the full-story row is still locked while later chapters are unplayed (found ${fullStoryLocks})`);
  console.log('  full-story lock: closed before play, open after; chapter chain unlocks on the shared rule');
}

console.log('unit-live-static-progress-parity: ALL PASSED');
