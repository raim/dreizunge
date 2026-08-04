// unit-story-unlocked-card.test.js
// v74_l — the story-unlocked card (roadmap §3, from the user's play-test).
//
// The card is the reward for finishing a chapter's preparation, and the one screen whose job is to
// get the learner to READ. Four changes: it says what to do, it stops competing with itself, and
// the story is set as prose rather than as a caption.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const html  = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ── 1. The story is set as prose, not as a caption ──────────────────────────────────────────
// Pinned in the MARKUP because it is a static style attribute — there is no cascade in the stub
// DOM to read it back from. Italic was the substantive complaint: a long run of italic at 13px
// reads as a caption, and the story is in the TARGET language, often with diacritics or a
// non-Latin script, where italic synthesis is worst.
{
  const m = html.match(/<div id="comp-story-text" style="([^"]*)"/);
  assert.ok(m, 'the completion-card story panel exists');
  assert.ok(!/italic/.test(m[1]), 'the story is NOT italic');
  const size = (m[1].match(/font-size:\s*(\d+)px/) || [])[1];
  assert.ok(size && Number(size) >= 15, `and is at least 15px (found ${size || 'none'})`);
}

// ── 2. The label tells the learner what to do ───────────────────────────────────────────────
// "Stories unlocked!" announced a state; this card's purpose is an instruction.
{
  assert.strictEqual(UI.en['complete.story_unlocked'], 'read and understand the chapter',
    'the story-unlocked label is an instruction');
  assert.strictEqual(UI.en['ex.badge.comprehension'], 'did you get this?',
    'and the comprehension badge asks the learner a question');
  // v71_q: a key dropped for the translate pass to refill must NOT be asserted absent anywhere —
  // that is what broke unit-model-settings. Asserted here as "English present, others pending",
  // which stays true both before and after the pass runs.
  const langs = Object.keys(UI);
  assert.ok(langs.length > 25, 'ui.json still carries the full language set');
  for (const k of ['complete.story_unlocked', 'ex.badge.comprehension']) {
    assert.ok(UI.en[k], `${k} has an English value`);
  }
}

// ── 3. The card stops competing with its own instruction ────────────────────────────────────
function renderCard({ teacher }) {
  const topic = (store.topics || []).find(t =>
    (t.lessons || []).some(L => L && L.type === 'mixed' && !L._hidden) && t.story);
  assert.ok(topic, 'the corpus has a mixed-driven chapter with a story');
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = []; APP.storylines = [];
    APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{} };
    APP._teacherMode = ${teacher};
    APP.cur = { lessonIdx:0, exercises:[], cur:0 };
    (function(){
      countedLessons(APP.lessonData).forEach(function(L){
        var i = APP.lessonData.lessons.indexOf(L), prev = APP.cur.lessonIdx;
        APP.cur.lessonIdx = i;
        for (var r = 0; r < 40; r++) { try { buildExercises(i).forEach(function(ex){ markSolved(ex); }); } catch(e) {} }
        APP.cur.lessonIdx = prev;
        var d = APP.progress.completed[APP.lessonData.topic] = APP.progress.completed[APP.lessonData.topic] || {};
        d[L.id] = { done:true, correct:4, total:4 };
      });
    })();
    true;`, 'setup');
  const mi = (topic.lessons || []).findIndex(L => L && L.type === 'mixed' && !L._hidden);
  C.run(`APP.cur = { lessonIdx:${mi}, exercises:[], cur:0, correct:4, total:4, mistakes:0,
                     hearts:3, streak:4, bestStreak:4 };
         showComplete(); true;`, 'render');
  const vis = id => C.run(`(function(){ var e=document.getElementById('${id}');
     return e ? (e.style.display === 'none' ? 'hidden' : 'shown') : 'absent'; })()`, 'v');
  return {
    unlocked: C.run(`storyUnlocked(APP.lessonData)`, 'u'),
    coverageLeft: C.run(`(typeof _firstCoverageShortLessonIdx === 'function') && _firstCoverageShortLessonIdx() >= 0`, 'c'),
    label: C.run(`(function(){ var e=document.getElementById('comp-story-unlocked-lbl'); return e ? e.textContent : ''; })()`, 'l'),
    next: vis('comp-next'), repeat: vis('comp-repeat'),
    drill: vis('comp-drill'), crossword: vis('comp-crossword'),
  };
}
{
  const learner = renderCard({ teacher: false });
  // Non-vacuity: the story must actually be unlocked, or "the card is quiet" is trivially true
  // because there is no story-unlocked card at all.
  assert.strictEqual(learner.unlocked, true, 'the fixture really does unlock the story');
  assert.strictEqual(learner.label, 'read and understand the chapter', 'and the card says so');
  assert.strictEqual(learner.next, 'shown', 'Next is offered');
  assert.strictEqual(learner.drill, 'hidden', 'the drill is not — it argues against the instruction');
  assert.strictEqual(learner.crossword, 'hidden', 'nor is the crossword');
  if (!learner.coverageLeft) {
    assert.strictEqual(learner.repeat, 'hidden', 'and with nothing left to gain, nor is Repeat');
  }

  // A TEACHER sees the story without having passed the gate, so the practice actions still make
  // sense there — the card is a preview, not a reward.
  const teacher = renderCard({ teacher: true });
  assert.strictEqual(teacher.next, 'shown', 'a teacher still gets Next');
  assert.ok(teacher.repeat === 'shown' || teacher.crossword === 'shown',
    'and keeps the practice actions — the stripping applies to the learner reward card only');
}

// ── 4. Repeat survives when it is the only way up ───────────────────────────────────────────
// The story unlocks on the PREP gate, which can be passed while coverage is still short: the
// storyline mark can exceed the lesson one, and replaying re-samples the round. Hiding Repeat
// unconditionally would strand exactly the learner smoke-render's "a finished lesson still offers
// Repeat" case exists for — that assertion caught this on the first attempt at this change.
{
  assert.ok(/_coverageLeft\s*\?[\s\S]{0,200}?'comp-drill'/.test(html),
    'Repeat is excluded from the hidden set while coverage can still be raised');
  assert.ok(/_firstCoverageShortLessonIdx\(\) >= 0/.test(html),
    'and "still to gain" is COVERAGE, not chapter completion — a chapter can read complete with questions unasked');
}

// ── 5. v74_m: the story keeps its PARAGRAPHS ────────────────────────────────────────────────
// 249 of 299 shipped chapters contain newlines and 217 contain blank lines. HTML collapses both, so
// before this the card presented every story as one undifferentiated slab — on the single screen
// whose whole job is to get the story read. Both other story panels (lesson-set/library, storyline
// chain) have split on blank lines since v39; this one was added later and never did.
{
  const topic = (store.topics || []).find(t =>
    /\n\s*\n/.test(t.story || '') && (t.lessons || []).some(L => L && (L.vocab || []).length));
  assert.ok(topic, 'the corpus has a multi-paragraph story with vocabulary');
  const want = (topic.story || '').split(/\n\s*\n/).length;
  // Non-vacuity: a single-paragraph story would satisfy any implementation, including the old one.
  assert.ok(want >= 2, `the fixture really has multiple paragraphs (${want})`);

  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = []; APP.storylines = [];
    APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{} }; APP._teacherMode = true;
    APP.cur = { lessonIdx:0, exercises:[], cur:0, correct:4, total:4, mistakes:0,
                hearts:3, streak:4, bestStreak:4 };
    (function(){
      var i = (APP.lessonData.lessons||[]).findIndex(function(L){ return L && (L.vocab||[]).length; });
      var prev = APP.cur.lessonIdx; APP.cur.lessonIdx = i;
      for (var r = 0; r < 20; r++) { try { buildExercises(i).forEach(function(ex){ markSolved(ex); }); } catch(e) {} }
      APP.cur.lessonIdx = prev;
    })();
    showComplete(); _renderCompStory(true); true;`, 'render');
  const h = C.run(`(function(){ var e=document.getElementById('comp-story-text'); return e ? e.innerHTML : ''; })()`, 'h');
  assert.strictEqual((h.match(/<p dir="auto">/g) || []).length, want,
    `the full story is emitted as ${want} paragraphs, not one slab`);
  // Paragraphs must not have cost the highlighting: the split runs AFTER the highlighter, on HTML,
  // so it must not cut through a <mark>.
  assert.ok((h.match(/<mark/g) || []).length > 0,
    'and the solved-word highlighting survives the split');
  assert.ok(!/<p[^>]*>\s*<\/p>/.test(h), 'with no empty paragraphs from runs of blank lines');
  // The <p>s need a rhythm or they stack flush and read as one block again.
  assert.ok(/#comp-story-text p\{margin/.test(html),
    'and the panel gives its paragraphs spacing, as .story-body has since v39');
}

console.log('  story-unlocked card: instruction label, prose story, Next-only for learners, Repeat kept while coverage remains');
console.log('  story paragraphs: preserved, highlighting intact, spacing applied');
console.log('unit-story-unlocked-card: ALL PASSED');
