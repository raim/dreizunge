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
// A plain, non-story-gated lesson — TOPIC is guaranteed to have one (see the TOPIC filter above).
const PLAIN_IDX = TOPIC.lessons.findIndex(L => L && !L._hidden && !isPost(L) && !L.type);
// A real storyline with at least one chapter that resolves to a real, saved topic — for the
// storyline-screen journey. Independent of TOPIC: storyline-screen renders from its own chain args.
const BY_ID = Object.fromEntries(SAVED.filter(l => l.id).map(l => [l.id, l]));
const SL = (store.storylines || []).find(s => (s.chapters || []).some(cid => BY_ID[cid]));
assert.ok(SL, 'the corpus has a storyline with at least one resolvable chapter');
const SL_TOPIC = BY_ID[SL.chapters.find(cid => BY_ID[cid])].topic;
const SL_CHAIN = SL.chapters.map(cid => BY_ID[cid]?.topic).filter(Boolean);
const SL_ENC = encodeURIComponent(JSON.stringify(SL_CHAIN));
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

  // PLAN §C0.3: showGenerationClean() is a SECOND, distinct entry into the same screen — it also
  // resets the URL hash, which plain showGeneration() does not. The stub history.replaceState is a
  // no-op (this harness does not model real URL state), so the distinguishing behaviour is proven
  // with a spy rather than by reading location.hash back, which would pass whether or not the real
  // call happened.
  const cleanCalls = C.run(`
    window.__spyReplaceState = 0;
    var orig = history.replaceState;
    history.replaceState = function(){ window.__spyReplaceState++; return orig.apply(history, arguments); };
    showGenerationClean();
    window.__spyReplaceState;`, 'generation-clean');
  assert.strictEqual(cleanCalls, 1, 'showGenerationClean() resets the URL hash (history.replaceState called once)');
  assert.strictEqual(active(C, 'landing'), true, 'showGenerationClean() also activates the landing surface');
  assert.strictEqual(C.run('APP.screen'), 'landing', 'APP.screen agrees');
  console.log('  generation: the "home" entry point (showGenerationClean) resets the hash and lands on landing too');

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
}

// PLAN §C0.3 — a NEW bounded surface, not on this file's original four-name list: the teacher
// dashboard, chosen directly by the user rather than drawn from the plan's example screens.
// `showTeacher()` is a pure delegate with no distinguishing behaviour of its own to spy on (unlike
// `showGenerationClean`'s hash reset or `showSettings`'s forwarded event) — walking the real
// rendered journey through it already proves the delegation.
{
  const C = client();
  C.run(`APP.info = { backend:'ollama', canGenerate:true, coverageThreshold:0.8 };
    loadSavedList = async function(){}; true;`, 'teacher-setup');
  C.run('showTeacher(); true;', 'teacher-entry');
  await settle();
  assert.strictEqual(active(C, 'teacher-screen'), true, 'showTeacher() activates the teacher screen');
  assert.strictEqual(C.run('APP.screen'), 'teacher-screen', 'APP.screen agrees');
  assert.ok(C.run("(document.getElementById('td-body').innerHTML || '').length") > 0,
    'the dashboard body rendered its panels rather than staying blank');
  // The "🌍" home button (`index.html:1560`) is static markup calling `showGenerationClean()` —
  // this harness never parses raw HTML outside the `<script>` block into its fake DOM (only
  // JS-rendered `innerHTML` content becomes real nodes; ids fetched via `getElementById` are
  // auto-vivified stubs with no children), so there is no element to click. Call the function the
  // button calls, exactly as the "generation" block above already proves it in isolation — what
  // THIS assertion adds is that the exit still works when reached FROM the teacher screen.
  C.run('showGenerationClean(); true;', 'teacher-exit');
  await settle();
  assert.strictEqual(active(C, 'landing'), true,
    'the teacher screen\'s "🌍" home button (already-seamed showGenerationClean) returns to landing');
  assert.strictEqual(C.run('APP.screen'), 'landing', 'APP.screen returns with it');
  console.log('  teacher dashboard: landing -> rendered panels (via showTeacher) -> landing');
}

// PLAN §C0.3 — the SECOND of three surfaces ruled together (user, after `v81_r`): lesson-set, the
// per-chapter lesson list. Like the teacher journey above, the exit (the "🌍" home button) is
// static markup and unreachable by simulated click in this harness — `showGenerationClean()` is
// called directly, already proven in isolation by the "generation" block earlier in this file.
{
  const C = client();
  C.run('loadSavedList = async function(){}; true;', 'lessonset-setup');
  C.run('showLessonSet(); true;', 'lessonset-entry');
  await settle();
  assert.strictEqual(active(C, 'lesson-set'), true, 'showLessonSet() activates the lesson-set screen');
  assert.strictEqual(C.run('APP.screen'), 'lesson-set', 'APP.screen agrees');
  // buildPath() appends nodes via createElement/appendChild, not an innerHTML string assignment —
  // this harness's innerHTML getter only reflects STRING writes (see INTERNALS.md §5's className
  // bullet for the same shape of gap), so children.length is the assertion that can actually see it.
  assert.ok(C.run("document.getElementById('lesson-path').children.length") > 0,
    'the lesson path rendered its nodes rather than staying blank');
  C.run('showGenerationClean(); true;', 'lessonset-exit');
  await settle();
  assert.strictEqual(active(C, 'landing'), true,
    'the lesson-set screen\'s "🌍" home button (already-seamed showGenerationClean) returns to landing');
  assert.strictEqual(C.run('APP.screen'), 'landing', 'APP.screen returns with it');
  console.log('  lesson-set: landing -> rendered lesson path (via showLessonSet) -> landing');
}

// PLAN §C0.3 — the THIRD of three surfaces ruled together (user, after `v81_r`): `lesson-screen`,
// the exercise runner ("exercise running" in the plan's own words). The learner journey earlier in
// this file already exercises `showLesson()` INDIRECTLY (the story-unlock screen's Next button
// calls it internally) — this block enters it DIRECTLY instead, on a plain non-story-gated lesson,
// and exits through `confirmQuit()`, which already routes through the seamed `showProgressCard()`.
{
  const C = client();
  assert.ok(PLAIN_IDX >= 0, 'non-vacuity: TOPIC has a plain lesson to start directly');
  const started = C.run(`showLesson(${PLAIN_IDX})`);
  assert.strictEqual(started, true, 'showLesson() reports it took over the screen');
  assert.strictEqual(active(C, 'lesson-screen'), true, 'showLesson() activates the lesson-screen');
  assert.strictEqual(C.run('APP.screen'), 'lesson-screen', 'APP.screen agrees');
  assert.strictEqual(C.run('APP.cur.lessonIdx'), PLAIN_IDX, 'the requested lesson index was taken');
  C.run('confirmQuit(); true;', 'lesson-exit');
  await settle();
  assert.strictEqual(active(C, 'complete-screen'), true,
    'quitting a directly-started lesson returns to the progress card (via the already-seamed showProgressCard)');
  assert.strictEqual(C.run('APP.screen'), 'complete-screen', 'APP.screen returns with it');
  console.log('  lesson-screen: direct entry (via showLesson) -> progress card, on a plain lesson');
}

// PLAN §C0.3 — `storyline-screen`, the LAST of three surfaces ruled together (user, after `v81_r`)
// and the biggest: four distinct entry functions, this journey enters through one of them
// (`showStorylineById`, the one real storyline links use). The exit is the same static-markup gap
// `v81_r`/`v81_s` already found (the "🌍" home button is unreachable by this harness) — resolved
// the same way, calling `showGenerationClean()` directly. `closeStorylineScreen()` (the OTHER exit,
// wired to "← Back") is not exercised here: its only effect is `history.back()`, which this
// harness's stub `history` object no-ops, so there is nothing observable to assert on it.
{
  const C = client();
  C.run('loadSavedList = async function(){}; true;', 'storyline-setup');
  C.run(`showStorylineById(${JSON.stringify(SL.id)}); true;`, 'storyline-entry');
  await settle();
  assert.strictEqual(active(C, 'storyline-screen'), true, 'showStorylineById() activates the storyline screen');
  assert.strictEqual(C.run('APP.screen'), 'storyline-screen', 'APP.screen agrees');
  assert.ok(C.run("(document.getElementById('sl-screen-body').innerHTML || '').length") > 0,
    'the storyline body rendered its chapter cards rather than staying blank');
  // The other three entry names are pure delegates over the SAME `openStorylineScreen`/render path
  // already proven above — a fresh client() each, checking only that entry lands on the same
  // screen, is enough to prove the delegation without re-testing the render itself. `showStoryline`
  // ITSELF is included here too — none of the other three call it (each resolves to
  // `openStorylineScreen` or, for `showStorylineByChainId`, an independent render path), so it is
  // otherwise NEVER exercised: mutation-tested this way first, breaking it silently survived every
  // other assertion in this file.
  const C1b = client();
  C1b.run('loadSavedList = async function(){}; true;', 'storyline-raw-setup');
  C1b.run(`showStoryline(${JSON.stringify(SL.id)}, ${JSON.stringify(SL_ENC)}); true;`, 'storyline-raw-entry');
  await settle();
  assert.strictEqual(active(C1b, 'storyline-screen'), true,
    'showStoryline() itself — the raw entry every other wrapper here delegates through or duplicates — activates the storyline screen');
  const C2 = client();
  C2.run('loadSavedList = async function(){}; true;', 'storyline-topic-setup');
  C2.run(`showStorylineForTopic(${JSON.stringify(SL_TOPIC)}); true;`, 'storyline-topic-entry');
  await settle();
  assert.strictEqual(active(C2, 'storyline-screen'), true,
    'showStorylineForTopic() also activates the storyline screen, resolving by topic membership');
  const C3 = client();
  C3.run('loadSavedList = async function(){}; true;', 'storyline-chainid-setup');
  C3.run(`showStorylineByChainId(${JSON.stringify(SL.id)}); true;`, 'storyline-chainid-entry');
  await settle();
  assert.strictEqual(active(C3, 'storyline-screen'), true,
    'showStorylineByChainId() also activates the storyline screen — the URL/hash entry path, which ' +
    'does NOT call openStorylineScreen at all (it re-renders independently with replaceState)');
  C.run('showGenerationClean(); true;', 'storyline-exit');
  await settle();
  assert.strictEqual(active(C, 'landing'), true,
    'the storyline screen\'s "🌍" home button (already-seamed showGenerationClean) returns to landing');
  assert.strictEqual(C.run('APP.screen'), 'landing', 'APP.screen returns with it');
  console.log('  storyline-screen: landing -> rendered chapter cards (via showStorylineById) -> landing');
}
console.log('unit-ui-journeys: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
