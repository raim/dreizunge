// probe_word_green_v81c.js — "some words are impossible to turn green".
//
// User report at the v81_b device pass: tapping such a word always brings the SAME question, and
// solving it never greens the word.
//
// The question this probe asks: `_wordProgress` grades a word out of the probes `_storyWordSources`
// declares for it. Are those probes questions the lesson can actually ASK?
//
// The oracle is `_lessonQidUniverse(i)` — the product's own converged question set (it re-derives
// from `buildExercises` until the union stops growing, NEEDED=15/CAP=120), which is also the set
// coverage counts against. So this is not a re-derivation of what a round contains
// (session-28 rule 1), and it respects the rule that `buildExercises` is non-deterministic in
// CONTENT: the universe already accumulates across builds.
//
// A probe key that is NOT in that universe is a question no round can emit → it can never be
// solved → the word it is charged to can never reach ok === n → it can never be green.
//
// Reports, does not assert.  LIMIT=n to sample; default all.
'use strict';
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require(path.join(__dirname, '..', 'test', 'lib-dom'));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const LIMIT = Number(process.env.LIMIT || 0);

const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons }));

const BOOT = `
  APP.savedList = ${JSON.stringify(SAVED)};
  APP.storylines = ${JSON.stringify(store.storylines || [])};
  APP.info = { backend:'none', canGenerate:false, coverageThreshold:1 };
  APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
  APP._teacherMode = false; APP.muted = false;
  saveProg = function(){};`;

let cands = store.topics.filter(t => (t.lessons || []).length && String(t.story || '').trim());
if (LIMIT) cands = cands.slice(0, LIMIT);

const agg = {
  chapters: 0, words: 0,
  wordsAllAskable: 0, wordsSomeUnaskable: 0, wordsNoneAskable: 0, wordsNoProbes: 0,
  keys: 0, keysAskable: 0,
  byKind: {},              // probe type -> { total, askable }
  oneAskableManyGraded: 0, // "tapping always brings the same question"
};
const samples = [];

for (const t of cands) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  let out;
  try {
    out = C.run(`${BOOT}
    APP.lessonData = ${JSON.stringify(t)};
    APP.lang = ${JSON.stringify(t.lang)}; APP.srcLang = ${JSON.stringify(t.srcLang)};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    (function(){
      var d = APP.lessonData;
      // The product's converged question set, per lesson.
      var uni = {};
      (d.lessons||[]).forEach(function(L, i){
        if (!L || L.id == null) return;
        try { uni[String(L.id)] = _lessonQidUniverse(i); } catch(_) { uni[String(L.id)] = new Set(); }
      });
      // What each word is GRADED on, straight from the product's own source walk.
      var perWord = {};
      _storyWordSources(d).forEach(function(s){
        var w = s.word;
        if (!perWord[w]) perWord[w] = { graded: 0, askable: 0, kinds: {} };
        (s.probes||[]).forEach(function(p){
          var k = null; try { k = qid(p, s.lessonId); } catch(_) {}
          if (!k) return;
          var U = uni[String(s.lessonId)];
          var ok = !!(U && U.has(k));
          perWord[w].graded++; if (ok) perWord[w].askable++;
          var kd = perWord[w].kinds[p.type] || (perWord[w].kinds[p.type] = {t:0,a:0});
          kd.t++; if (ok) kd.a++;
        });
      });
      // The vocab side of _wordProgress adds ONE gradeable unit per vocab row, and its membership
      // test accepts any solved key of that lesson matching the target — so it is askable whenever
      // the lesson has any question about the word. Counted separately, not mixed in.
      return JSON.stringify({ topic: d.topic, perWord: perWord });
    })();`, 'scan');
  } catch (e) { continue; }
  let r; try { r = JSON.parse(out); } catch (_) { continue; }
  if (!r) continue;
  agg.chapters++;

  for (const [w, rec] of Object.entries(r.perWord)) {
    agg.words++;
    if (!rec.graded) { agg.wordsNoProbes++; continue; }
    agg.keys += rec.graded; agg.keysAskable += rec.askable;
    if (rec.askable === rec.graded) agg.wordsAllAskable++;
    else if (rec.askable === 0) agg.wordsNoneAskable++;
    else agg.wordsSomeUnaskable++;
    if (rec.askable === 1 && rec.graded > 1) {
      agg.oneAskableManyGraded++;
      if (samples.length < 12) samples.push({ topic: r.topic, word: w, graded: rec.graded,
        askable: rec.askable, kinds: rec.kinds });
    }
    for (const [k, v] of Object.entries(rec.kinds)) {
      const b = agg.byKind[k] || (agg.byKind[k] = { total: 0, askable: 0 });
      b.total += v.t; b.askable += v.a;
    }
  }
}

const pc = (a, b) => b ? (Math.round(a / b * 1000) / 10) + '%' : '—';
console.log('probe_word_green_v81c — can a highlighted word actually reach GREEN?');
console.log('  oracle: _lessonQidUniverse (the product\'s converged question set)\n');
console.log('  chapters scanned                        ', agg.chapters);
console.log('  distinct highlighted words              ', agg.words);
console.log('  probe keys they are graded on           ', agg.keys,
            ' of which ASKABLE ' + agg.keysAskable + ' (' + pc(agg.keysAskable, agg.keys) + ')');
console.log('');
console.log('  words whose every graded question is askable ', agg.wordsAllAskable,
            '(' + pc(agg.wordsAllAskable, agg.words) + ')  <-- CAN go green');
console.log('  words with SOME unaskable question           ', agg.wordsSomeUnaskable,
            '(' + pc(agg.wordsSomeUnaskable, agg.words) + ')  <-- can never go green');
console.log('  words with NO askable question at all        ', agg.wordsNoneAskable,
            '(' + pc(agg.wordsNoneAskable, agg.words) + ')  <-- red forever');
console.log('  words carrying no probes at all              ', agg.wordsNoProbes,
            '(' + pc(agg.wordsNoProbes, agg.words) + ')');
console.log('');
console.log('  graded on >1 question but only ONE is askable', agg.oneAskableManyGraded,
            '  <-- "always the same question, never greens"');
console.log('\n  by probe kind (askable / declared):');
Object.entries(agg.byKind).sort((a, b) => b[1].total - a[1].total).forEach(([k, v]) => {
  console.log('    ' + k.padEnd(20) + String(v.askable).padStart(6) + ' / ' +
              String(v.total).padStart(6) + '   ' + pc(v.askable, v.total));
});
console.log('\n  samples (word: graded -> askable, by kind):');
samples.forEach(s => {
  const kinds = Object.entries(s.kinds).map(([k, v]) => k + ' ' + v.a + '/' + v.t).join(', ');
  console.log('    ' + String(s.word).slice(0, 22).padEnd(24) + s.askable + '/' + s.graded +
              '  [' + kinds + ']   ' + s.topic.slice(0, 28));
});
