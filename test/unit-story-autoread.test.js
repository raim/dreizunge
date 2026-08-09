// unit-story-autoread.test.js
// v77_v — roadmap §0f: the story is read aloud when it unlocks on the progress card.
//
// The restraints are the substance here, not the reading itself. Each one protects something that
// has broken before, so each is asserted separately:
//   1. it reads when the story unlocks;
//   2. MUTED means muted — `speakBodyText` force-unmutes on a tap, and auto-play has no such consent;
//   3. ONCE per chapter — showComplete re-renders into the same DOM repeatedly;
//   4. never on a review render — re-opening a finished chapter is not the moment of unlocking;
//   5. never interrupts speech already in progress (v75_h made cancel() conditional on purpose).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const TOPIC = store.topics.find(t => (t.story || '').length > 100 && (t.lessons || []).length >= 2);
assert.ok(TOPIC, 'the corpus has a chapter with a story');

// Drives the helper directly: it is the whole of §0f's decision, and driving it keeps each
// restraint testable on its own rather than through a full card render.
function seed(opts) {
  opts = opts || {};
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.lessonData = ${JSON.stringify(TOPIC)};
    APP.lang = ${JSON.stringify(TOPIC.lang)}; APP.srcLang = ${JSON.stringify(TOPIC.srcLang)};
    APP.muted = ${!!opts.muted};
    APP._autoRead = {};
    APP._spoke = [];
    _doSpeakLang = function(text, lang){ APP._spoke.push({ text: text, lang: lang }); };
    _lessonIsDialect = function(){ return ${!!opts.dialect}; };
    speechSynthesis = { speaking: ${!!opts.speaking}, pending: false,
                        cancel: function(){ APP._cancelled = true; },
                        getVoices: function(){ return []; },
                        addEventListener: function(){} };
    true;`, 'setup');
  return C;
}
const read = C => C.run(`_autoReadStory(APP.lessonData.topic, APP.lessonData.story, APP.lessonData.lang)`);
const spoken = C => JSON.parse(C.run(`JSON.stringify(APP._spoke.length)`));

// ── 1. It reads when the story unlocks ────────────────────────────────────
{
  const C = seed();
  assert.strictEqual(read(C), true, 'the story is read aloud when it unlocks');
  assert.strictEqual(spoken(C), 1, 'exactly once');
  assert.strictEqual(C.run(`APP._spoke[0].lang`), TOPIC.lang,
    'in the TARGET language of the chapter');
  assert.ok(C.run(`APP._spoke[0].text.length`) > 50, 'and it is the story, not a fragment');
  console.log('  unlocked: the story is read in the target language');
}

// ── 2. Muted means muted ──────────────────────────────────────────────────
// speakBodyText treats a tap as consent to unmute. Auto-play has no tap and therefore no consent.
{
  const C = seed({ muted: true });
  assert.strictEqual(read(C), false, 'a muted learner is not read to');
  assert.strictEqual(spoken(C), 0, 'nothing is spoken');
  assert.strictEqual(C.run(`APP.muted`), true, 'and mute is NOT silently turned off');
  console.log('  muted: silent, and stays muted');
}

// ── 3. Once per chapter ───────────────────────────────────────────────────
// showComplete renders into the same DOM repeatedly; without this every re-render restarts it.
{
  const C = seed();
  read(C); read(C); read(C);
  assert.strictEqual(spoken(C), 1, 'repeated renders do not restart the reading');
  console.log('  repeated renders: read once');
}

// ── 4. Never interrupts speech in progress ────────────────────────────────
// v75_h made cancel() conditional to stop exactly these races; auto-play must not undo that.
{
  const C = seed({ speaking: true });
  assert.strictEqual(read(C), false, 'auto-read stays silent while something else is speaking');
  assert.strictEqual(spoken(C), 0, 'nothing is spoken');
  assert.notStrictEqual(C.run(`APP._cancelled || false`), true,
    'and it does NOT cancel the speech already running');
  console.log('  speech in progress: stays silent, cancels nothing');
}

// ── 5. Dialect chapters are never read ────────────────────────────────────
// Same rule the speaker button uses: no authentic spoken voice exists for them.
{
  const C = seed({ dialect: true });
  assert.strictEqual(read(C), false, 'a dialect chapter is not read aloud');
  console.log('  dialect: not read');
}

// ── 6. On the card: a REVIEW render does not read ─────────────────────────
// Driven through showComplete, because the review guard lives at the call site, not in the helper.
{
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = []; APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false;
    APP.lessonData = ${JSON.stringify(TOPIC)};
    APP.lang = ${JSON.stringify(TOPIC.lang)}; APP.srcLang = ${JSON.stringify(TOPIC.srcLang)};
    APP.muted = false; APP._autoRead = {}; APP._spoke = [];
    _doSpeakLang = function(text, lang){ APP._spoke.push({ text: text, lang: lang }); };
    show = function(id){ APP._shown = id; };
    (function(){ var d = APP.lessonData, m = _solvedMap(d.topic);
      var done = APP.progress.completed[d.topic] = {};
      countedLessons(d).forEach(function(L){
        try { _lessonItemUniverse(d.lessons.indexOf(L)).forEach(function(k){ m[k]=1; }); } catch(e){}
        done[L.id] = { done:true, correct:4, total:4 }; }); })();
    APP.cur = { lessonIdx:0, correct:4, total:4, mistakes:0, exercises:[], cur:0 };
    showComplete(true); true;`, 'review');
  assert.strictEqual(C.run(`APP._spoke.length`), 0,
    'a review render never starts the reading — it is not the moment of unlocking');
  console.log('  review render: silent');
}

console.log('unit-story-autoread: ALL PASSED');
