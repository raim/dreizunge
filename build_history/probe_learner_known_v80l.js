// probe_learner_known_v80l.js — THE LEARNER-KNOWN SHARE.
//
// The untaken half of the pass that produced `v80_f`. TRACK T §T5.1 asks whether green should mean
// ALL of a word's questions or a fraction, and that is not a taste question: it depends on whether
// "every question for this word solved" is a state real learners actually reach. This probe answers
// it from `learners.json` rather than from intuition.
//
// It drives the PRODUCT's own helpers — `_storyWordSources`, `qid()`, `_solvedMap` — against each
// learner's real solved-map, so what it reports is what the screen would paint, not a re-derivation
// of it.
//
// ⚠️ WHAT IT CANNOT TELL YOU. Three users, one of whom has almost no history. This is a portrait of
// THIS install, not a population. It is still the right input for T5.1, because T5.1 is a question
// about this app's actual learners — but a rate here is not a general fact and must not be quoted
// as one.
'use strict';
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require(path.join(__dirname, '..', 'test', 'lib-dom'));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const learners = JSON.parse(fs.readFileSync(path.join(ROOT, 'learners.json'), 'utf8'));

const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons }));
const byName = new Map(store.topics.map(t => [t.topic, t]));

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
  APP.savedList = ${JSON.stringify(SAVED)};
  APP.storylines = ${JSON.stringify(store.storylines || [])};
  APP.info = { backend:'none', canGenerate:false, coverageThreshold:1 };
  APP._teacherMode = false; saveProg = function(){}; true;`);

const users = Object.entries(learners.users || {});
const band = { green: 0, partial: 0, red: 0 };
const perUser = [];
let chaptersTouched = 0, wordsTotal = 0, chaptersAllRed = 0, chaptersAnyGreen = 0;
const samples = [];
const QPW = [];

for (const [uid, u] of users) {
  const prog = (u.state && u.state.progress) || {};
  const solved = prog.solved || {};
  const U = { id: uid.slice(0, 8), chapters: 0, words: 0, green: 0, partial: 0, red: 0 };

  for (const [topicName, sMap] of Object.entries(solved)) {
    const t = byName.get(topicName);
    if (!t || !(t.lessons || []).length) continue;          // glossaries and deleted topics
    if (!sMap || !Object.keys(sMap).length) continue;

    // Per highlighted word: how many of its associated questions has THIS learner solved?
    const rows = JSON.parse(C.run(`(function(){
      APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
      APP.progress.solved[${JSON.stringify(topicName)}] = ${JSON.stringify(sMap)};
      APP.lessonData = ${JSON.stringify(t)};
      if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
      var d = APP.lessonData, m = _solvedMap(d.topic) || {};
      var byWord = {};
      // the extra sources (synonyms, word_forms, grammar, conjugation) carry explicit probes
      _storyWordSources(d).forEach(function(s){
        if (!s || !s.word) return;
        var r = (byWord[s.word] = byWord[s.word] || { n:0, ok:0 });
        (s.probes || []).forEach(function(p){
          var k = null; try { k = qid(p, s.lessonId); } catch(e) {}
          if (!k) return;
          r.n++; if (m[k]) r.ok++;
        });
      });
      // vocab targets: their questions are the lesson's item keys for that word
      (d.lessons || []).forEach(function(L, i){
        if (!L || L._hidden || !Array.isArray(L.vocab)) return;
        L.vocab.forEach(function(v, vi){
          if (!v || !v.target) return;
          var r = (byWord[v.target] = byWord[v.target] || { n:0, ok:0 });
          var k = null; try { k = _itemKey(L.id, v, 'vocab'); } catch(e) {}
          if (!k) return;
          r.n++; if (m[k]) r.ok++;
        });
      });
      return JSON.stringify(Object.keys(byWord).map(function(w){
        return { w: w, n: byWord[w].n, ok: byWord[w].ok };
      }));
    })()`));

    const live = rows.filter(r => r.n > 0);
    if (!live.length) continue;
    chaptersTouched++; U.chapters++;
    let anyGreen = false, anyOk = false;
    for (const r of live) {
      wordsTotal++; U.words++;
      QPW.push(r.n);
      if (r.ok === 0) { band.red++; U.red++; }
      else if (r.ok >= r.n) { band.green++; U.green++; anyGreen = true; anyOk = true; }
      else { band.partial++; U.partial++; anyOk = true; }
    }
    if (anyGreen) chaptersAnyGreen++;
    if (!anyOk) chaptersAllRed++;
    if (samples.length < 8 && live.length >= 4) {
      const g = live.filter(r => r.ok >= r.n).length;
      samples.push(`${g}/${live.length} words green   ${topicName}`);
    }
  }
  if (U.words) perUser.push(U);
}

const pc = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
console.log('THE LEARNER-KNOWN SHARE — what TRACK T would actually paint\n');
console.log(`users with any solved history : ${perUser.length} of ${users.length}`);
console.log(`chapters they have worked      : ${chaptersTouched}`);
console.log(`highlightable words in those   : ${wordsTotal}\n`);
console.log('  GREEN   every associated question solved : ' + String(band.green).padStart(5) + '  ' + pc(band.green, wordsTotal));
console.log('  PARTIAL some but not all                 : ' + String(band.partial).padStart(5) + '  ' + pc(band.partial, wordsTotal));
console.log('  RED     none                             : ' + String(band.red).padStart(5) + '  ' + pc(band.red, wordsTotal));

console.log('\nper user:');
perUser.forEach(u => console.log(`  ${u.id}  chapters=${String(u.chapters).padStart(3)}  words=${String(u.words).padStart(4)}` +
  `   green ${pc(u.green, u.words).padStart(6)}   partial ${pc(u.partial, u.words).padStart(6)}   red ${pc(u.red, u.words).padStart(6)}`));

console.log('\nchapters where the screen would show:');
console.log(`  at least one GREEN word : ${chaptersAnyGreen} of ${chaptersTouched}  ${pc(chaptersAnyGreen, chaptersTouched)}`);
console.log(`  NOTHING but red         : ${chaptersAllRed} of ${chaptersTouched}  ${pc(chaptersAllRed, chaptersTouched)}`);

// Why so red? Two candidate causes and they need separating: either a word carries so many
// questions that ALL is unreachable, or learners simply do not finish chapters. The distribution of
// questions-per-word decides the first.
const qpw = {};
let qpwTotal = 0, qpwN = 0;
for (const r of QPW) { const k = Math.min(r, 6); qpw[k] = (qpw[k] || 0) + 1; qpwTotal += r; qpwN++; }
console.log('\nquestions associated with each highlighted word:');
for (const k of Object.keys(qpw).sort((a,b)=>a-b))
  console.log(`  ${k == 6 ? '6+' : k} question${k == 1 ? ' ' : 's'} : ${String(qpw[k]).padStart(5)}  ${pc(qpw[k], qpwN)}`);
console.log(`  mean ${(qpwTotal / qpwN).toFixed(2)} questions per word`);
console.log('  -> if this is near 1, "green = ALL" is NOT the wall and the redness is unfinished work');

console.log('\nsample worked chapters:');
samples.forEach(s => console.log('  ' + s));
console.log('\n(reported, not asserted — three users, one install; see the header)');
