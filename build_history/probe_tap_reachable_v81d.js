// probe_tap_reachable_v81d.js — does the v81_d filter make any highlighted word a DEAD TAP?
//
// `_wordQuestions` is filtered by the same question universe as `_wordProgress`, so the tap prefers
// a question that can actually be answered. The hazard is at the other end: if filtering empties the
// candidate list, `tapWord` returns false and the tap does NOTHING — which its own comment calls the
// worst outcome, and which `§T5.2` rules against ("tapping enters the usual lesson flow").
//
// Counts, per chapter, the highlighted words for which `_wordQuestions` returns nothing. Run with
// PROBE_CLIENT=/path/to/index.html to diff two builds.  Reports, does not assert.
'use strict';
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require(path.join(__dirname, '..', 'test', 'lib-dom'));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const LIMIT = Number(process.env.LIMIT || 25);

const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons }));

const cands = store.topics.filter(t => (t.lessons || []).length && String(t.story || '').trim())
  .slice(0, LIMIT);

let words = 0, dead = 0, noq = 0, chapters = 0;
const samples = [];

for (const t of cands) {
  const C = loadClient({ quiet: true, file: process.env.PROBE_CLIENT || undefined });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  let out;
  try {
    out = C.run(`
      APP.savedList = ${JSON.stringify(SAVED)};
      APP.storylines = ${JSON.stringify(store.storylines || [])};
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:1 };
      APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
      APP._teacherMode = false; APP.muted = false; saveProg = function(){};
      APP.lessonData = ${JSON.stringify(t)};
      APP.lang = ${JSON.stringify(t.lang)}; APP.srcLang = ${JSON.stringify(t.srcLang)};
      if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
      (function(){
        var d = APP.lessonData;
        // Exactly the words the panel marks and makes tappable.
        var marked = _storyExtraWords(d).concat(
          (d.lessons||[]).reduce(function(a,L){
            return a.concat(((L && L.vocab) || []).map(function(v){ return v && v.target; })); }, [])
        ).filter(Boolean);
        var seen = {}, n = 0, dead = 0, noq = 0, ex = [];
        marked.forEach(function(w){
          var k = _hlKey(stripFuri(String(w)));
          if (!k || seen[k]) return;
          seen[k] = 1; n++;
          if (!_wordQuestions(d, w).length) noq++;
          // v81_f: the claim is about a TAP, so the tap is what gets called (rule 34). This used to
          // read the question-resolver's length instead, which measured the wrong layer -- it went on
          // reporting 181 dead taps after v81_f had routed every one into its teaching lesson.
          var ok = false;
          try { ok = (tapWord(w) === true); } catch(e) { ok = false; }
          if (!ok) { dead++; if (ex.length < 4) ex.push(w); }
        });
        return JSON.stringify({ n: n, dead: dead, noq: noq, ex: ex });
      })();`, 'tap');
  } catch (e) { continue; }
  let r; try { r = JSON.parse(out); } catch (_) { continue; }
  if (!r) continue;
  chapters++; words += r.n; dead += r.dead; noq += (r.noq || 0);
  if (r.dead && samples.length < 8) samples.push({ topic: t.topic, dead: r.dead, n: r.n, ex: r.ex });
}

const pc = (a, b) => b ? (Math.round(a / b * 1000) / 10) + '%' : '—';
console.log('probe_tap_reachable_v81d — highlighted words whose tap resolves to NOTHING');
console.log('  client: ' + (process.env.PROBE_CLIENT || 'index.html') + '\n');
console.log('  chapters scanned      ', chapters);
console.log('  highlighted words     ', words);
console.log('  words with NO question', noq, '(' + pc(noq, words) + ')');
console.log('  DEAD taps             ', dead, '(' + pc(dead, words) + ')  <-- tapWord returned false');
if (samples.length) {
  console.log('\n  sample chapters:');
  samples.forEach(s => console.log('    ' + s.topic.slice(0, 30).padEnd(32) +
    s.dead + '/' + s.n + '   e.g. ' + s.ex.join(', ')));
}
