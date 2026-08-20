// PLAN §C0.1 — lock the current screen journeys; PLAN §C0.2 introduces the router seam over them.
//
// These are deliberately transition tests, not source-shape checks. The router seam may move
// functions and markup, but it must preserve these rendered outcomes and the interactive exits.
//
// §C0.2 update: `APP.screen` (the one authoritative route state, written only by `show(id)`) is
// now asserted at every screen transition below, alongside the rendered `.active` class — the two
// must never disagree. The three journeys also now enter through the new explicit renderers
// (`showProgressCard`, `showGeneration`, `showSettings`) instead of the functions they delegate
// to, so a faithful delegation is proven IN the locked journey, not by a separate synthetic call.
// `showStory()` is exercised indirectly: it is what `comp-next`'s onclick calls internally now
// (rerouted from a direct `showStoryUnlocked()` call, its one call site) — asserting the story
// screen becomes active after that click already proves the reroute did not break anything.
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
  C.run('showProgressCard(); true;', 'progress-card');
  assert.strictEqual(active(C, 'complete-screen'), true, 'the journey starts on the rendered progress card');
  assert.strictEqual(C.run('APP.screen'), 'complete-screen', 'APP.screen agrees with the rendered card');
  C.run("document.getElementById('comp-next').onclick(); true;", 'story');
  assert.strictEqual(active(C, 'unlockstory-screen'), true, 'Next enters the story-unlock screen');
  assert.strictEqual(C.run('APP.screen'), 'unlockstory-screen',
    'APP.screen tracks the reroute onto showStory() — comp-next used to call showStoryUnlocked() directly');
  assert.ok(C.run("(document.getElementById('us-story').innerHTML || '').length") > 0,
    'the story screen renders its story body');
  C.run("document.getElementById('us-next').onclick(); true;", 'lesson');
  assert.strictEqual(active(C, 'lesson-screen'), true, 'story forward enters the lesson player');
  assert.strictEqual(C.run('APP.screen'), 'lesson-screen', 'APP.screen follows into the lesson player');
  assert.strictEqual(C.run('APP.cur.lessonIdx'), COMP_IDX,
    'the story forward action starts its resolved comprehension lesson');
  C.run('confirmQuit(); true;', 'return');
  await settle();
  assert.strictEqual(active(C, 'complete-screen'), true, 'quitting the lesson returns a learner to the progress card');
  assert.strictEqual(C.run('APP.screen'), 'complete-screen', 'APP.screen returns with it');
  assert.deepStrictEqual(JSON.parse(C.run('JSON.stringify(_cardErrors())')), [],
    'no card error was swallowed across the learner journey');
  console.log('  learner: progress card -> story -> lesson -> progress card (via showProgressCard/showStory)');
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
  C.run('showGeneration(); true;', 'generation-entry');
  await settle();
  assert.strictEqual(active(C, 'landing'), true, 'returning to generation activates the landing form');
  assert.strictEqual(C.run('APP.screen'), 'landing', 'APP.screen agrees — showGeneration() delegates to goLanding()');
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
  assert.strictEqual(C.run('APP.screen'), 'lesson-set', 'APP.screen follows the generated lesson set');
  C.run('showGeneration(); true;', 'generation-return');
  await settle();
  assert.strictEqual(active(C, 'landing'), true, 'leaving the generated lesson set returns to generation');
  assert.strictEqual(C.run('APP.screen'), 'landing', 'APP.screen returns with it');
  console.log('  generation: landing form -> generated lesson set -> landing form (via showGeneration)');

  // Settings have no dedicated screen yet: the model popover is the current entry/exit surface
  // C4 will absorb. Its open/close transition must leave the underlying landing route intact —
  // and APP.screen, which only `.screen` roots ever change, must stay 'landing' throughout.
  //
  // The popover-state assertion just below does NOT prove showSettings forwards its event
  // argument to toggleModelPop — dropping that argument produced no observable difference here
  // (this harness models no real event bubbling, so a lost stopPropagation() is silent). Assert
  // the forwarding directly instead: a spy counting the call is the only way this can fail.
  const spyCalls = C.run(`
    document.getElementById('bmodels-pop').style.display = 'none';
    window.__spyStops = 0;
    showSettings({ stopPropagation:function(){ window.__spyStops++; } });
    window.__spyStops;`, 'settings-entry');
  assert.strictEqual(spyCalls, 1, 'showSettings forwards its event argument to toggleModelPop (stopPropagation called exactly once)');
  assert.notStrictEqual(C.run("document.getElementById('bmodels-pop').style.display"), 'none',
    'opening settings (via showSettings) exposes the model-settings popover');
  assert.strictEqual(active(C, 'landing'), true, 'opening settings keeps the landing surface active');
  assert.strictEqual(C.run('APP.screen'), 'landing', 'APP.screen is untouched — settings is not a `.screen` root');
  C.run('closeModelPop(); true;', 'settings-exit');
  assert.strictEqual(C.run("document.getElementById('bmodels-pop').style.display"), 'none',
    'closing settings hides the popover');
  assert.strictEqual(active(C, 'landing'), true, 'closing settings preserves the landing surface');
  assert.strictEqual(C.run('APP.screen'), 'landing', 'APP.screen still untouched after closing');
  console.log('  settings: landing -> model popover -> landing (via showSettings)');
  console.log('unit-ui-journeys: ALL PASSED');
}
}

main().catch(err => { console.error(err); process.exit(1); });
