// unit-mic-lesson-reset.test.js
// v85_b — user request: "remove auto-activation of speech recognition, the user must explicitly
// click the microphone icon to activate for a given lesson." Two claims, both behavioural (rendered
// state, not source text — standing rule 2):
//   1. A FRESH client (no test override) starts with `APP.micMuted === true` — speech input is OFF
//      by default, unlike the pre-v85_b default of `false` (auto-listening).
//   2. `startLesson()` re-mutes on every round: a mic left ACTIVE from a previous lesson (the only
//      way this could otherwise leak) is forced back off when a NEW lesson starts, so a learner must
//      tap `#speech-mic-pill` again for each lesson — mutation-tested by removing the reset line and
//      watching this go red.
// This drives a REAL lesson through `startLesson`, same discipline `unit-question-nav.test.js` uses,
// because the claim is about `startLesson`'s own behaviour, not about `_speechMicRefresh` in isolation
// (already covered, with a mocked SpeechRecognition, by `unit-speech-recognition.test.js`).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons }));

// Any playable standard lesson will do — this test cares about `APP.micMuted`, not exercise shape.
let FIX = null;
for (const t of store.topics) {
  const i = (t.lessons || []).findIndex(L => L && !L._hidden && (!L.type || L.type === 'standard'));
  if (i >= 0) { FIX = { t, i }; break; }
}
assert.ok(FIX, 'the corpus has at least one playable standard lesson');

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:1 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false; APP.muted = true;
    APP.lessonData = ${JSON.stringify(FIX.t)};
    APP.lang = ${JSON.stringify(FIX.t.lang)}; APP.srcLang = ${JSON.stringify(FIX.t.srcLang)};
    show = function(id){ APP._shown = id; };
    speak = function(){}; saveProg = function(){};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    true;`, 'seed');
  return C;
}

// ── 1. Fresh default: speech input starts OFF, not auto-listening ────────────────
{
  const C = client();
  const muted = C.run(`APP.micMuted`);
  assert.strictEqual(muted, true, 'a fresh client defaults to APP.micMuted === true (speech input off until the learner activates it)');
}
console.log('  fresh default: APP.micMuted starts true (no auto-activation): OK');

// ── 2. startLesson() re-mutes even a mic left active from a previous lesson ──────
{
  const C = client();
  const after = C.run(`APP.micMuted = false;   // simulate: the learner had activated the mic in a previous lesson
    startLesson(${FIX.i});
    APP.micMuted;`);
  assert.strictEqual(after, true, 'startLesson() must reset APP.micMuted to true, even when it was left false by a previous lesson');
}
console.log('  startLesson(): re-mutes on every new round, even carried over from a previous lesson: OK');

console.log('unit-mic-lesson-reset: ALL PASSED');
