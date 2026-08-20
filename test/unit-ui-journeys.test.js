// PLAN §C0.1 — lock the current screen journeys before C0.2 introduces route state.
//
// These are deliberately transition tests, not source-shape checks. The router seam may move
// functions and markup, but it must preserve these rendered outcomes and the interactive exits.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const isPost = L => L && (L.type === 'comprehension' || L.type === 'error_hunt' || L.type === 'ai_error_hunt');
const TOPIC = store.topics.find(t =>
  (t.story || '').length > 100 &&
  (t.lessons || []).some(L => L && !L._hidden && !isPost(L) && !L.type) &&
  (t.lessons || []).some(L => L && !L._hidden && L.type === 'comprehension'));
assert.ok(TOPIC, 'the corpus has a chapter whose prep work unlocks a playable comprehension lesson');

const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons,
  lessonCount: (t.lessons || []).filter(L => L && !L._hidden && !L._aiExamples).length }));
const COMP_IDX = TOPIC.lessons.findIndex(L => L && L.type === 'comprehension');
const settle = () => new Promise(resolve => setTimeout(resolve, 25));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false; APP._slScreen = {};
    APP.lessonData = ${JSON.stringify(TOPIC)};
    APP.lang = APP.formLang = ${JSON.stringify(TOPIC.lang)};
    APP.srcLang = APP.formSrcLang = ${JSON.stringify(TOPIC.srcLang)};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    (function(){
      var d = APP.lessonData, solved = _solvedMap(d.topic);
      var done = APP.progress.completed[d.topic] = {};
      (d.lessons || []).forEach(function(L, i){
        if (!L || _isStoryGatedLesson(L)) return;
        try { _lessonItemUniverse(i).forEach(function(k){ solved[k] = 1; }); } catch(_) {}
        done[L.id] = { done:true, correct:4, total:4 };
      });
    })();
    APP.cur = { lessonIdx:0, exercises:[], cur:0, correct:4, total:4, mistakes:0,
                hearts:3, streak:2, bestStreak:2 };
    saveProg = function(){};
    true;`, 'setup');
  return C;
}

const active = (C, id) => C.run(`document.getElementById(${JSON.stringify(id)}).classList.contains('active')`);

async function main() {
// Learner: progress card -> the just-unlocked story -> its comprehension lesson -> progress card.
// The final hop is the real quit handler, which is the current player exit C0.2 must preserve.
{
  const C = client();
  assert.strictEqual(C.run('storyUnlocked(APP.lessonData)'), true,
    'non-vacuity: prep work genuinely opens the story');
  assert.ok(C.run('_firstUnfinishedLessonIdx(APP.lessonData)') >= 0,
    'and the chapter still has post-story work');
  C.run('showComplete(); true;', 'progress-card');
  assert.strictEqual(active(C, 'complete-screen'), true, 'the journey starts on the rendered progress card');
  C.run("document.getElementById('comp-next').onclick(); true;", 'story');
  assert.strictEqual(active(C, 'unlockstory-screen'), true, 'Next enters the story-unlock screen');
  assert.ok(C.run("(document.getElementById('us-story').innerHTML || '').length") > 0,
    'the story screen renders its story body');
  C.run("document.getElementById('us-next').onclick(); true;", 'lesson');
  assert.strictEqual(active(C, 'lesson-screen'), true, 'story forward enters the lesson player');
  assert.strictEqual(C.run('APP.cur.lessonIdx'), COMP_IDX,
    'the story forward action starts its resolved comprehension lesson');
  C.run('confirmQuit(); true;', 'return');
  await settle();
  assert.strictEqual(active(C, 'complete-screen'), true, 'quitting the lesson returns a learner to the progress card');
  assert.deepStrictEqual(JSON.parse(C.run('JSON.stringify(_cardErrors())')), [],
    'no card error was swallowed across the learner journey');
  console.log('  learner: progress card -> story -> lesson -> progress card');
}

// Generation currently lives on the landing surface. Entering it from a lesson restores the form
// context; a cached generation opens the lesson set; returning restores the landing form again.
{
  const C = client();
  C.run(`
    APP.info = { backend:'ollama', canGenerate:true, coverageThreshold:0.8 };
    APP.activeJob = null; APP.lessonFormat = 'standard'; APP.numChapters = 1;
    loadSavedList = async function(){};
    document.getElementById('topic-input').value = 'journey fixture';
    true;`, 'generation-setup');
  C.run('goLanding(); true;', 'generation-entry');
  await settle();
  assert.strictEqual(active(C, 'landing'), true, 'returning to generation activates the landing form');
  assert.notStrictEqual(C.run("document.getElementById('gen-area').style.display"), 'none',
    'the generation controls are visible on that landing surface');
  C.run(`
    goLessonSet = function(){ show('lesson-set'); };
    fetch = function(){ return Promise.resolve({ ok:true, json:function(){ return Promise.resolve({
      cached:true, data:${JSON.stringify(TOPIC)}
    }); } }); };
    doGenerate(); true;`, 'generate');
  await settle();
  assert.strictEqual(active(C, 'lesson-set'), true, 'a cached generation exits to the generated lesson set');
  C.run('goLanding(); true;', 'generation-return');
  await settle();
  assert.strictEqual(active(C, 'landing'), true, 'leaving the generated lesson set returns to generation');
  console.log('  generation: landing form -> generated lesson set -> landing form');

  // Settings have no dedicated screen yet: the model popover is the current entry/exit surface
  // C4 will absorb. Its open/close transition must leave the underlying landing route intact.
  C.run(`
    document.getElementById('bmodels-pop').style.display = 'none';
    toggleModelPop({ stopPropagation:function(){} }); true;`, 'settings-entry');
  assert.notStrictEqual(C.run("document.getElementById('bmodels-pop').style.display"), 'none',
    'opening settings exposes the model-settings popover');
  assert.strictEqual(active(C, 'landing'), true, 'opening settings keeps the landing surface active');
  C.run('closeModelPop(); true;', 'settings-exit');
  assert.strictEqual(C.run("document.getElementById('bmodels-pop').style.display"), 'none',
    'closing settings hides the popover');
  assert.strictEqual(active(C, 'landing'), true, 'closing settings preserves the landing surface');
  console.log('  settings: landing -> model popover -> landing');
  console.log('unit-ui-journeys: ALL PASSED');
}
}

main().catch(err => { console.error(err); process.exit(1); });
