'use strict';
// v76_e verification. Drives the PRODUCT's landing-page renderer (loadSavedList) with the real
// corpus under the reported filter state, and reads back what the storyline card carries.
const fs = require('fs'), path = require('path');
const { loadClient, ROOT } = require('../test/lib-dom');
const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const SL = 'sl_9302163';
const sl = (store.storylines || []).find(s => s.id === SL);

// The live list payload shape (server.js /api/lessons projection).
const listProject = (t) => ({
  id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  updatedAt: t.updatedAt, generatedAt: t.generatedAt,
  lessonCount: (t.lessons || []).filter(L => L && !L._hidden && !L._aiExamples).length,
  lessons: (t.lessons || []).map(L => Object.assign({ id: L.id, type: L.type || 'standard' },
    L._hidden ? { _hidden: true } : {}, L._aiExamples ? { _aiExamples: true } : {})),
});

function render(libFilter, libSrcFilter) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{} };
    APP._teacherMode = false;
    APP.libFilter = ${JSON.stringify(libFilter)};
    APP.libSrcFilter = ${JSON.stringify(libSrcFilter)};
    APP.libTagFilter = null;
    // Stand in for the two fetches loadSavedList makes; everything after them is the product path.
    window.fetch = function(u){
      var body = String(u).indexOf('/api/storylines') >= 0
        ? ${JSON.stringify(JSON.stringify(store.storylines || []))}
        : ${JSON.stringify(JSON.stringify((store.topics || []).map(listProject)))};
      return Promise.resolve({ ok:true, json:function(){ return Promise.resolve(JSON.parse(body)); } });
    };
    // Harness limit, not product: the stub DOM has no <option> lists, so the language-menu
    // populator throws. It has nothing to do with chain building.
    _populateLibSelects = function(){};
    true;`, 'setup');
  C.run(`window.__done = loadSavedList(); true;`, 'render');
  return C;
}

async function renderHtml(lf, sf) {
  const C = render(lf, sf);
  for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r));
  return C.run(`(function(){ var e=document.getElementById('saved-list'); return e ? e.innerHTML : ''; })()`, 'h');
}

(async () => {
for (const [lf, sf] of [['sr', 'all'], ['all', 'en'], ['all', 'all'], ['hr', 'all']]) {
  const html = await renderHtml(lf, sf);
  const realId = html.includes('slgroup-' + SL);
  const synth = (html.match(/slgroup-c\d+/g) || []);
  const sb = html.includes('slsb-wrap-' + SL);
  // Scope to THIS storyline's card, not the first card in the page.
  const gi = html.indexOf('slgroup-' + SL);
  const seg = gi >= 0 ? html.slice(gi, gi + 4000) : '';
  const title = /class="storyline-title-text">([^<]*)</.exec(seg);
  const chapters = /(\d+) chapters/.exec(seg);
  console.log(`libFilter=${String(lf).padEnd(4)} libSrcFilter=${String(sf).padEnd(4)}`
    + ` | real id card: ${String(realId).padEnd(5)}`
    + ` | storyboard: ${String(sb).padEnd(5)}`
    + ` | chapters shown: ${chapters ? chapters[1] : '?'}`
    + ` | title: ${title ? JSON.stringify(title[1]) : '(none)'}`
    + ` | synthetic c-ids: ${synth.length ? synth.join(',') : 'none'}`);
}
console.log('\nstoryline in store:', sl.id, JSON.stringify(sl.title), '| chapters', sl.chapters.length,
  '| storyboard', !!sl.storyboard);
})();
