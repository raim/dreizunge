// probe_word_green_impact_v81d.js — what the v81_d denominator fix does to the REAL screen.
//
// `probe_learner_known_v80l.js` answers a related question but re-derives the colouring inline from
// `_storyWordSources` + `qid`, so it cannot see a change made inside `_wordProgress`. This one calls
// **`_wordProgress` and `_wordState`** — the ONE collector and the ONE state rule — over each
// learner's real solved map, so what it counts is what the card paints.
//
// `APP.lessonData` is set to the chapter under test because the v81_d filter is scoped to the open
// chapter by design (`_lessonQidUniverse` indexes into `APP.lessonData`). That is the product
// condition on the progress card, which is where this colouring lives.
//
// Run it against a different client build with PROBE_CLIENT=/path/to/index.html to diff.
// Reports, does not assert.
'use strict';
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require(path.join(__dirname, '..', 'test', 'lib-dom'));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const learners = JSON.parse(fs.readFileSync(path.join(ROOT, 'learners.json'), 'utf8'));

const byName = new Map(store.topics.map(t => [t.topic, t]));
const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons }));

const band = { green: 0, partial: 0, red: 0 };
const qPerWord = {};
let chapters = 0, words = 0, anyGreen = 0, allRed = 0, denom = 0;
const perChapter = [];

for (const [uid, u] of Object.entries(learners.users || {})) {
  const solved = ((u.state && u.state.progress) || {}).solved || {};
  for (const [topicName, sMap] of Object.entries(solved)) {
    const t = byName.get(topicName);
    if (!t || !(t.lessons || []).length) continue;
    if (!sMap || !Object.keys(sMap).length) continue;

    const C = loadClient({ quiet: true, file: process.env.PROBE_CLIENT || undefined });
    C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
    let out;
    try {
      out = C.run(`
        APP.savedList = ${JSON.stringify(SAVED)};
        APP.storylines = ${JSON.stringify(store.storylines || [])};
        APP.info = { backend:'none', canGenerate:false, coverageThreshold:1 };
        APP._teacherMode = false; APP.muted = false; saveProg = function(){};
        APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
        APP.progress.solved[${JSON.stringify(topicName)}] = ${JSON.stringify(sMap)};
        APP.lessonData = ${JSON.stringify(t)};
        APP.lang = ${JSON.stringify(t.lang)}; APP.srcLang = ${JSON.stringify(t.srcLang)};
        if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
        (function(){
          var d = APP.lessonData;
          var b = { green:0, partial:0, red:0 }, q = {}, n = 0;
          _wordProgress(d).forEach(function(rec){
            n++;
            b[_wordState(rec)]++;
            var k = String(rec.n);
            q[k] = (q[k] || 0) + 1;
          });
          return JSON.stringify({ b: b, q: q, n: n });
        })();`, 'colour');
    } catch (e) { continue; }
    let r; try { r = JSON.parse(out); } catch (_) { continue; }
    if (!r || !r.n) continue;
    chapters++; words += r.n;
    band.green += r.b.green; band.partial += r.b.partial; band.red += r.b.red;
    if (r.b.green > 0) anyGreen++;
    if (r.b.green === 0 && r.b.partial === 0) allRed++;
    for (const [k, v] of Object.entries(r.q)) {
      qPerWord[k] = (qPerWord[k] || 0) + v;
      denom += Number(k) * v;
    }
    perChapter.push({ topic: topicName, green: r.b.green, n: r.n });
  }
}

const pc = (a, b) => b ? (Math.round(a / b * 1000) / 10) + '%' : '—';
console.log('probe_word_green_impact_v81d — the colouring, through _wordProgress / _wordState');
console.log('  client: ' + (process.env.PROBE_CLIENT || 'index.html') + '\n');
console.log('  chapters with history   ', chapters);
console.log('  tracked words           ', words);
console.log('');
console.log('  GREEN   ', String(band.green).padStart(5), pc(band.green, words));
console.log('  PARTIAL ', String(band.partial).padStart(5), pc(band.partial, words));
console.log('  RED     ', String(band.red).padStart(5), pc(band.red, words));
console.log('');
console.log('  chapters showing at least one GREEN ', anyGreen + ' of ' + chapters,
            '(' + pc(anyGreen, chapters) + ')');
console.log('  chapters showing NOTHING but red    ', allRed + ' of ' + chapters,
            '(' + pc(allRed, chapters) + ')');
console.log('');
console.log('  questions each word is GRADED on (the denominator):');
Object.keys(qPerWord).map(Number).sort((a, b) => a - b).forEach(k => {
  console.log('    ' + String(k).padStart(2) + ' question(s): ' +
              String(qPerWord[k]).padStart(5) + '  ' + pc(qPerWord[k], words));
});
console.log('    mean ' + (words ? Math.round(denom / words * 100) / 100 : 0) + ' per word');
console.log('\n(reported, not asserted — three users, one install: a portrait, not a population)');
