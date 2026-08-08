'use strict';
// Which chapters carry a lock after chapter 1 is completed? Uses the SAME harness and the SAME
// product render the failing parity test drives (_renderStorylineScreen), not a re-implementation.
const fs = require('fs'), path = require('path');
const { loadClient, ROOT } = require('../test/lib-dom');
const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const byId = {}; for (const t of (store.topics || [])) byId[t.id] = t;

const staticProject = (t) => ({
  id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  lessons: (t.lessons || []).filter(L => !(L._hidden && L.type === 'ai_error_hunt')),
});
const differs = (t) => {
  const ls = staticProject(t).lessons || [];
  return ls.some(L => L && L.type === 'mixed' && !L._hidden)
      || ls.some(L => L && (L._hidden || L._aiExamples));
};
const sl2 = (store.storylines || []).find(x => {
  const ts = (x.chapters || []).map(c => byId[c]).filter(Boolean);
  return ts.length >= 2 && differs(ts[0]);
});
const topics2 = (sl2.chapters || []).map(c => byId[c]).filter(Boolean);
const names2 = topics2.map(t => t.topic);
const first = topics2[0];

const C2 = loadClient({ quiet: true });
C2.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
C2.run(`
  APP.savedList = ${JSON.stringify(topics2.map(staticProject))};
  APP.storylines = ${JSON.stringify(store.storylines || [])};
  APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
  APP.progress = { completed:{}, solved:{}, chapterDone:{} };
  APP._teacherMode = false; APP._slScreen = {}; true;`, 'setup');
C2.run(`
  APP.lessonData = ${JSON.stringify(first)};
  APP.lang = ${JSON.stringify(first.lang)}; APP.srcLang = ${JSON.stringify(first.srcLang)};
  APP.cur = { lessonIdx:0, exercises:[], cur:0 };
  if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
  (function(){
    var m = _solvedMap(APP.lessonData.topic);
    countedLessons(APP.lessonData).forEach(function(L){
      _lessonItemUniverse(APP.lessonData.lessons.indexOf(L)).forEach(function(k){ m[k]=1; }); });
    var d = APP.progress.completed[APP.lessonData.topic] = {};
    countedLessons(APP.lessonData).forEach(function(L){ d[L.id] = {done:true, correct:4, total:4}; });
  })();
  setComplete(APP.lessonData); APP.lessonData = null;
  _renderStorylineScreen('ch1', encodeURIComponent(${JSON.stringify(names2)}.join('|')), ${JSON.stringify(names2)});
  true;`, 'play-first');

const html2 = C2.run(`(function(){ var e=document.getElementById('sl-screen-body'); return e ? e.innerHTML : ''; })()`, 'h');
console.log('storyline:', sl2.id, JSON.stringify(sl2.title), '| chapters:', topics2.length);
topics2.forEach((t, i) => console.log(`  ch${i + 1}`, (t.lang || '?') + '<-' + (t.srcLang || '?'), JSON.stringify(t.topic).slice(0, 44)));
console.log('\ntotal 🔒 in rendered html:', (html2.match(/🔒/g) || []).length);

// Attribute each lock to the chapter card it sits in, by splitting on chapter name occurrences.
const marks = [];
for (const t of topics2) {
  const idx = html2.indexOf(t.topic);
  marks.push({ name: t.topic, idx });
}
marks.sort((a, b) => a.idx - b.idx);
console.log('\nlock attribution (by position in html):');
let lastIdx = 0;
for (let i = 0; i < marks.length; i++) {
  const start = marks[i].idx, end = (i + 1 < marks.length) ? marks[i + 1].idx : html2.length;
  if (start < 0) { console.log('  (not found)', marks[i].name); continue; }
  const seg = html2.slice(start, end);
  console.log(`  ${(marks[i].name || '').slice(0, 40).padEnd(42)} locks=${(seg.match(/🔒/g) || []).length}`);
}
const head = html2.slice(0, marks.filter(m => m.idx >= 0)[0]?.idx ?? 0);
console.log(`  [header / full-story row]                  locks=${(head.match(/🔒/g) || []).length}`);

// Precise attribution by MARKUP SIGNATURE (index.html 7491 = chapter-card overlay, 7608 = full-story row)
const cardLock = (html2.match(/position:absolute;inset:0[^>]*>🔒<\/div>/g) || []).length;
const fullLock = (html2.match(/<span>🔒<\/span>/g) || []).length;
console.log('\n--- by markup signature ---');
console.log('chapter-card lock overlays (7491):', cardLock);
console.log('full-story row lock (7608)       :', fullLock);

// Which chapter cards are locked? Split html on the locked/unlocked wrapper openings, in order.
console.log('\n--- per-chapter card state (in render order) ---');
const wrapRe = /<div style="position:relative;border-radius:var\(--radius-xl\);overflow:hidden(;opacity:\.45;pointer-events:none)?">/g;
let m, order = [];
while ((m = wrapRe.exec(html2)) !== null) order.push({ locked: !!m[1], at: m.index });
order.forEach((o, i) => {
  const seg = html2.slice(o.at, order[i + 1] ? order[i + 1].at : html2.length);
  const who = topics2.find(t => seg.includes(t.topic));
  console.log(`  card ${i + 1}: locked=${String(o.locked).padEnd(5)} ${(who ? who.topic : '?').slice(0, 40)}`);
});
