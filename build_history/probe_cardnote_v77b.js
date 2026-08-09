// probe_cardnote_v77b.js — does the v77_b ledger actually SEE a swallowed throw?
// Session-28 rule 1: call the product function, never a re-typed copy. This drives the real
// showComplete in the real client and breaks a real collaborator, rather than asserting on source.
'use strict';
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require(path.join(__dirname, '..', 'test', 'lib-dom'));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const ok = t => (t.story || '').length > 200 && (t.lessons || []).length >= 3;
const TOPIC = store.topics.find(ok);

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
       APP.storylines = ${JSON.stringify(store.storylines || [])}; true;`);

function seed() {
  C.run(`
    APP.lessonData = ${JSON.stringify(TOPIC)};
    APP.lang = ${JSON.stringify(TOPIC.lang)}; APP.srcLang = ${JSON.stringify(TOPIC.srcLang)};
    APP._teacherMode = false; APP._cardStrict = false;
    APP.info = { backend:'none', canGenerate:false, version:'probe', coverageThreshold: 1 };
    APP.progress = { completed: {}, solved: {} };
    APP.cur = { lessonIdx: 0, correct: 1, total: 1, mistakes: 0, bestStreak: 1, flagCount: 0,
                exercises: [], cur: 0 };
    true;`);
}

console.log('chapter under test: "' + TOPIC.topic + '"\n');
C.run(`var _origStoryboard = _renderCompStoryboard; true;`);

// 1. Clean render — the ledger must be EMPTY. (Non-vacuity for step 2: if this were already
//    non-empty, step 2 would prove nothing.)
seed();
C.run(`showComplete();`);
const clean = C.run(`JSON.stringify(_cardErrors())`);
console.log('1. clean render        -> _cardErrors() = ' + clean);

// 2. Break a collaborator that one of the seven catches wraps, and render again. The card must
//    still render (the catch still swallows) but the ledger must now NAME the site.
seed();
C.run(`_renderCompStoryboard = function(){ throw new Error('probe: storyboard exploded'); }; true;`);
let threw2 = null;
try { C.run(`showComplete();`); } catch (e) { threw2 = e.message; }
const dirty = C.run(`JSON.stringify(_cardErrors())`);
console.log('2. storyboard throws   -> showComplete threw? ' + (threw2 || 'no'));
console.log('                          _cardErrors() = ' + dirty);

// 3. Same break, but strict. showComplete must now THROW rather than swallow.
seed();
C.run(`APP._cardStrict = true;
       _renderCompStoryboard = function(){ throw new Error('probe: storyboard exploded'); }; true;`);
let threw3 = null;
try { C.run(`showComplete();`); } catch (e) { threw3 = e.message; }
console.log('3. strict mode         -> showComplete threw? ' + (threw3 || 'NO — strict did nothing'));

// 4. The ledger is per-render, not cumulative: a clean render after a dirty one reads empty.
//    NOTE: steps 2-3 replaced `_renderCompStoryboard` in the sandbox and it stays replaced —
//    restoring it is the whole point of this step. Without the restore this reads as a product
//    bug when it is really the probe testing its own leaked state (session-29 rule 3).
seed();
C.run(`_renderCompStoryboard = _origStoryboard; true;`);
C.run(`showComplete();`);
console.log('4. clean render again  -> _cardErrors() = ' + C.run(`JSON.stringify(_cardErrors())`));
