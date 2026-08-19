// unit-lessonset-storyline-link.test.js
// v80_x — the storyline chip on the LESSON-SET page.
//
// User report: *"in teacher mode, in a lessonset page, when clicking the storyline title (top row)
// currently leads to the main page instead of to the storyline page."*
//
// Measured before changing anything, and there were TWO defects one line apart:
//
//   1. THE ROW NEVER RENDERED. It looked its storyline up in `slTitles = APP.storylines || {}`,
//      indexed by `'c'+hash` and `'root:'+topic` — keys from a schema this app has not used for many
//      versions. `APP.storylines` is an ARRAY, so every lookup returned undefined, every chip
//      rendered as '', and the row was hidden on every chapter. A render of a real storyline chapter
//      returned an EMPTY `#home-hdr-storyline`.
//   2. THE DESTINATION WAS WRONG. The click ran `loadSaved(chain[0])` — loading the FIRST CHAPTER'S
//      TOPIC rather than opening the storyline. With a name that no longer resolves, `loadSaved`
//      falls through to the landing page, which is what the user saw.
//
// Both are fixed by asking the resolver the cards already use: `_storylineForTopic` finds the deck by
// MEMBERSHIP, so a rename cannot break it, and `_openStorylineById` is the destination every other
// storyline link uses.
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

// A chapter that is NOT the first of its storyline: the old code keyed off `chain[0]`, so a
// first chapter would have hidden defect 2 behind a coincidence.
let FIX = null;
for (const sl of (store.storylines || [])) {
  const ids = sl.chapters || [];
  if (ids.length < 2 || !sl.id) continue;
  const t = store.topics.find(x => x.id === ids[1]);
  if (t) { FIX = { sl, t }; break; }
}
assert.ok(FIX, 'the corpus has a storyline with a second chapter');

function page(teacher) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'local', canGenerate:true };
    APP._teacherMode = ${teacher ? 'true' : 'false'};
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP.lessonData = ${JSON.stringify(FIX.t)};
    APP.lang = ${JSON.stringify(FIX.t.lang)}; APP.srcLang = ${JSON.stringify(FIX.t.srcLang)};
    show = function(id){ APP._shown = id; }; saveProg = function(){};
    _openStorylineById = function(id){ APP._went = 'storyline:' + id; };
    loadSaved = function(x){ APP._went = 'loadSaved:' + x; };
    goLandingClean = function(){ APP._went = 'landing'; };
    buildPath(); true;`, 'render');
  return C;
}

// ── 1. The row renders at all ────────────────────────────────────────────
for (const teacher of [true, false]) {
  const C = page(teacher);
  const html = C.run(`document.getElementById('home-hdr-storyline').innerHTML`);
  assert.ok(html && /<span/.test(html),
    `${teacher ? 'teacher' : 'learner'} mode: the storyline row RENDERS (it was empty on every ` +
    'chapter before v80_x)');
  assert.ok(html.includes(FIX.sl.title || ''), 'and names the storyline this chapter belongs to');
  // Asserted through `classList`, not `className`: lib-dom's `classList.add` does not write back to
  // `className`, so matching that string tests the HARNESS rather than the product (rule 16's
  // family — know what the harness models before believing it).
  assert.ok(C.run(`document.getElementById('home-hdr-storyline').classList.contains('visible')`),
    'and the row is made visible');
}
console.log(`  the storyline row renders in both modes ("${FIX.sl.title}")`);

// ── 2. ⚠️ Clicking it opens the STORYLINE, not a topic and not the landing ──
{
  const C = page(true);
  const on = C.run(`document.querySelector('#home-hdr-storyline span').getAttribute('onclick')`);
  assert.ok(/_openStorylineById\(/.test(on), 'the chip opens the storyline page');
  assert.ok(!/loadSaved\(/.test(on),
    'and does NOT loadSaved a topic — that is the call that fell through to the landing page');
  C.run(`eval(document.querySelector('#home-hdr-storyline span').getAttribute('onclick')); true;`);
  assert.strictEqual(C.run(`APP._went`), 'storyline:' + FIX.sl.id,
    'and it lands on THIS chapter\'s storyline');
  console.log('  clicking it opens the storyline page, by id');
}

// ── 3. A solo chapter shows no row rather than a broken one ──────────────
{
  const solo = store.topics.find(t => {
    if (!t.id) return false;
    return !(store.storylines || []).some(sl => (sl.chapters || []).includes(t.id));
  });
  if (solo) {
    const C = loadClient({ quiet: true });
    C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
      APP.savedList = ${JSON.stringify(SAVED)};
      APP.storylines = ${JSON.stringify(store.storylines || [])};
      APP.info = { backend:'local', canGenerate:true }; APP._teacherMode = true;
      APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
      APP.lessonData = ${JSON.stringify(solo)};
      show = function(){}; saveProg = function(){}; buildPath(); true;`);
    assert.strictEqual(C.run(`document.getElementById('home-hdr-storyline').innerHTML`), '',
      'a chapter in no storyline shows no chip');
    assert.ok(!C.run(`document.getElementById('home-hdr-storyline').classList.contains('visible')`),
      'and the row stays hidden');
    console.log('  a solo chapter shows no row');
  } else {
    console.log('  (every corpus topic is in a storyline — solo case not exercised)');
  }
}

// ── What this does NOT establish (rule 34) ───────────────────────────────
// • No real click is dispatched; the onclick attribute is evaluated. The chip's styling and hit area
//   are unverified — a device pass is owed.
console.log('unit-lessonset-storyline-link: ALL PASSED');
