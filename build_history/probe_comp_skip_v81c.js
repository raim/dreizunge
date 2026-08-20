// probe_comp_skip_v81c.js — "it seems we are now skipping the comprehension lesson!!"
//
// User report at the v81_b device pass. This probe does NOT re-derive the branch chain in
// `showComplete`; it drives the PRODUCT (`showComplete(true)`, the call `loadSaved` now makes for a
// later chapter) over REAL corpus chapters and then CLICKS `comp-next`, recording where the click
// actually goes. Session-28 rule 2: the assertion has to touch the thing being claimed, and the
// claim is about a button.
//
// The scenario is the reported one: a learner ARRIVES at a later chapter having done the ordinary
// lessons but NOT the comprehension lesson. Under v81_b that arrival lands on `showComplete(true)`.
//
// Reports, does not assert.
'use strict';
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require(path.join(__dirname, '..', 'test', 'lib-dom'));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const byId = Object.fromEntries(store.topics.filter(t => t.id).map(t => [t.id, t]));
const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons,
  lessonCount: (t.lessons || []).filter(L => L && !L._hidden && !L._aiExamples).length }));

const BOOT = `
  APP.savedList = ${JSON.stringify(SAVED)};
  APP.storylines = ${JSON.stringify(store.storylines || [])};
  APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
  APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
  APP._teacherMode = false; APP._slScreen = {};
  APP._went = null;
  show = function(id){ APP._shown = id; };
  loadSaved = function(x){ APP._went = 'CHAPTER:' + String(x); };
  startLesson = function(i){ APP._went = 'lesson:' + i; return true; };
  showStoryUnlocked = function(){ APP._went = 'story-unlocked-page'; };
  showStoryFinished = function(){ APP._went = 'story-finished-card'; };
  compBackToStory = function(){ APP._went = 'back-to-storyline'; };
  openStorylineScreen = function(id){ APP._went = 'storyline:' + id; };
  goLandingClean = function(){ APP._went = 'landing'; };
  endDrill = function(){};
  saveProg = function(){};`;

// Candidate chapters: index >= 1 in a storyline (i.e. "later chapter", the v81_b path), carrying a
// story-gated lesson AND at least one other counted lesson.
const cands = [];
for (const sl of (store.storylines || [])) {
  const ids = sl.chapters || [];
  for (let i = 1; i < ids.length; i++) {
    const t = byId[ids[i]];
    if (!t || !(t.lessons || []).length) continue;
    cands.push({ sl, t, pos: i, hasNext: i + 1 < ids.length });
  }
}

const rows = [];
let examined = 0;

for (const c of cands) {
  const C = loadClient({ quiet: true, file: process.env.PROBE_CLIENT || undefined });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  let out;
  try {
    out = C.run(`${BOOT}
    APP.lessonData = ${JSON.stringify(c.t)};
    APP.lang = ${JSON.stringify(c.t.lang)}; APP.srcLang = ${JSON.stringify(c.t.srcLang)};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    (function(){
      var d = APP.lessonData;
      var counted = countedLessons(d);
      var gated = counted.filter(function(L){ return _isStoryGatedLesson(L); });
      if (!gated.length || counted.length < 2) return JSON.stringify({ skip:'no gated lesson' });

      // The reported state: every ordinary lesson done and solved; the comprehension lesson
      // untouched. This is what "arriving at a later chapter with work left" looks like.
      var m = _solvedMap(d.topic);
      var done = APP.progress.completed[d.topic] = {};
      counted.forEach(function(L){
        if (_isStoryGatedLesson(L)) return;
        var i = d.lessons.indexOf(L);
        _lessonItemUniverse(i).forEach(function(k){ m[k] = 1; });
        done[L.id] = { correct: 4, total: 4 };
      });

      var cov = topicCoverage();
      var frac = cov.total > 0 ? cov.solved / cov.total : 0;
      var unfinished = _firstUnfinishedLessonIdx(d);
      var gatedIdx = d.lessons.indexOf(gated[0]);

      // THE PRODUCT CALL v81_b's loadSaved makes for a later chapter.
      APP._went = null;
      showComplete(true);
      var cardErrs = (typeof _cardErrors === 'function') ? _cardErrors().length : -1;
      var btn = document.getElementById('comp-next');
      var title = (document.getElementById('comp-title')||{}).textContent || '';
      if (btn && typeof btn.onclick === 'function') btn.onclick();

      return JSON.stringify({
        topic: d.topic,
        covFrac: Math.round(frac * 1000) / 1000,
        target: _coverageTarget(),
        firstUnfinished: unfinished,
        gatedIdx: gatedIdx,
        gatedTitle: gated[0].title || gated[0].type || '',
        storyUnlocked: !!storyUnlocked(d),
        went: APP._went,
        cardErrs: cardErrs,
        title: title
      });
    })();`, 'scenario');
  } catch (e) { out = JSON.stringify({ err: String(e.message || e).slice(0, 120) }); }

  let r; try { r = JSON.parse(out); } catch (_) { continue; }
  if (!r || r.skip || r.err) continue;
  examined++;
  rows.push(Object.assign(r, { pos: c.pos, hasNext: c.hasNext, sl: c.sl.title || c.sl.id }));
}

// ── Report ──────────────────────────────────────────────────────────────────
const skipped = rows.filter(r => r.went && r.went.indexOf('CHAPTER:') === 0);
const toGated = rows.filter(r => r.went === 'lesson:' + r.gatedIdx);
const toOther = rows.filter(r => r.went && r.went.indexOf('lesson:') === 0 && r.went !== 'lesson:' + r.gatedIdx);
const elsewhere = rows.filter(r => !skipped.includes(r) && !toGated.includes(r) && !toOther.includes(r));

console.log('probe_comp_skip_v81c — later chapters with an UNPLAYED comprehension lesson');
console.log('  scenario: ordinary lessons solved, gated lesson untouched, then showComplete(true)');
console.log('            (the call v81_b\'s loadSaved makes) and comp-next CLICKED.\n');
console.log('  later chapters examined                     ', examined);
console.log('  Next LEAVES for another chapter             ', skipped.length,
            '  <-- comprehension skipped');
console.log('  Next opens the comprehension lesson         ', toGated.length);
console.log('  Next opens some other lesson                ', toOther.length);
console.log('  Next goes elsewhere (card/story/back)       ', elsewhere.length);
console.log('  card render errors, total                   ',
            rows.reduce((a, r) => a + Math.max(0, r.cardErrs), 0));

const titles = {};
rows.forEach(r => { titles[r.title || '(empty)'] = (titles[r.title || '(empty)'] || 0) + 1; });
console.log('\n  card TITLE on arrival:');
Object.entries(titles).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log('    ' + String(v).padStart(4) + '  ' + k));

const byWent = {};
elsewhere.forEach(r => { byWent[r.went] = (byWent[r.went] || 0) + 1; });
if (elsewhere.length) console.log('  elsewhere breakdown                         ', JSON.stringify(byWent));

console.log('\n  every skipping row had an unfinished lesson: ',
  skipped.every(r => r.firstUnfinished >= 0) ? 'YES' : 'no');
console.log('  ... and it was the comprehension lesson:     ',
  skipped.every(r => r.firstUnfinished === r.gatedIdx) ? 'YES' : 'no');
console.log('  story unlocked on skipping rows:            ',
  skipped.filter(r => r.storyUnlocked).length + ' of ' + skipped.length);

console.log('\n  sample skipping rows:');
skipped.slice(0, 8).forEach(r => {
  console.log('    ' + r.topic.slice(0, 34).padEnd(36) +
    ' cov ' + String(r.covFrac).padEnd(6) + ' target ' + String(r.target).padEnd(5) +
    ' unfinished=' + String(r.firstUnfinished).padEnd(3) +
    ' -> ' + r.went);
});
if (toGated.length) {
  console.log('\n  sample rows that DO reach comprehension:');
  toGated.slice(0, 5).forEach(r => {
    console.log('    ' + r.topic.slice(0, 34).padEnd(36) +
      ' cov ' + String(r.covFrac).padEnd(6) + ' -> ' + r.went);
  });
}
