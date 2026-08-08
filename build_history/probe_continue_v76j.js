'use strict';
// Reproduces the reported bug by CALLING continueFromLesson (the product function both routes use),
// with the real chapters of sl_9302163.
const fs = require('fs'), path = require('path');
const { loadClient, ROOT } = require('../test/lib-dom');
const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const SCRIPTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts.json'), 'utf8'));

const byId = {}; for (const t of (store.topics || [])) byId[t.id] = t;
const sl = (store.storylines || []).find(s => s.id === 'sl_9302163');
const chapters = sl.chapters.map(c => byId[c]).filter(Boolean);
const last = chapters[chapters.length - 1];

const saved = (store.topics || []).map(t => ({
  id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  script: t.script, srcScript: t.srcScript, difficulty: t.difficulty, storyLen: t.storyLen,
  lessons: (t.lessons || []).map(L => ({ id: L.id, type: L.type || 'standard' })),
}));

function run(startLang, startSrc, label) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
         SCRIPTS_DATA = ${JSON.stringify(SCRIPTS)};
         APP.savedList = ${JSON.stringify(saved)};
         APP.storylines = ${JSON.stringify(store.storylines || [])};
         APP.info = { backend:'none', canGenerate:true };
         APP.progress = { completed:{}, solved:{}, chapterDone:{} };
         APP.lang = ${JSON.stringify(startLang)}; APP.srcLang = ${JSON.stringify(startSrc)};
         window.fetch = function(){ return Promise.resolve({ ok:true,
           json:function(){ return Promise.resolve([]); } }); };
         // HARNESS SHIM (INTERNALS: the stub DOM does not parse innerHTML, so a <select> has no
         // .options). The product legitimately reads contSel.options, so give the element the
         // getter a real DOM would provide, derived from the markup the product wrote.
         (function(){
           var el = document.getElementById('continue-select');
           Object.defineProperty(el, 'options', { configurable:true, get:function(){
             var out=[], re=new RegExp('<option value="([^"]*)"([^>]*)>([^]*?)<' + '/option>','g'), m;
             while((m=re.exec(this.innerHTML||''))) out.push({
               value:m[1].replace(/&quot;/g,'"'), selected:/selected/.test(m[2]), text:m[3] });
             return out;
           }});
         })();
         // Populate the menu the way the landing page would before the click.
         repopulateContinueSelect();
         true;`, 'seed');

  const before = C.run(`document.getElementById('continue-select').options.length`, 'n');
  C.run(`continueFromLesson(${JSON.stringify(last.id)}, ${last.difficulty || 2}, ${last.storyLen || 300}); true;`, 'go');
  const val   = C.run(`document.getElementById('continue-select').value`, 'v');
  const nOpts = C.run(`document.getElementById('continue-select').options.length`, 'n2');
  const lang  = C.run(`APP.lang`, 'l');
  const src   = C.run(`APP.srcLang`, 's');
  console.log(`${label}`);
  console.log(`   start pair ${startLang}<-${startSrc} | options before ${before}`);
  console.log(`   after: APP.lang=${lang} APP.srcLang=${src} options=${nOpts}`);
  console.log(`   continue-select value = ${JSON.stringify(val)}   ${val === last.id ? '✓ holds the chapter' : '✗ EMPTY / wrong'}`);
  return val;
}

console.log(`storyline ${sl.id} "${sl.title}" — last chapter: ${JSON.stringify(last.topic)} (${last.lang}<-${last.srcLang})\n`);
run('it', 'en', 'A) arriving from a DIFFERENT language pair (the storyline-page route):');
console.log('');
run(last.lang, last.srcLang, 'B) already on the chapter\'s own pair (the lesson-set route):');
console.log('');

// And the second half of the report: does a later source-language change drop the selection?
{
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
         SCRIPTS_DATA = ${JSON.stringify(SCRIPTS)};
         APP.savedList = ${JSON.stringify(saved)};
         APP.info = { backend:'none', canGenerate:true };
         APP.lang = ${JSON.stringify(last.lang)}; APP.srcLang = ${JSON.stringify(last.srcLang)};
         window.fetch = function(){ return Promise.resolve({ ok:true,
           json:function(){ return Promise.resolve([]); } }); };
         // HARNESS SHIM (INTERNALS: the stub DOM does not parse innerHTML, so a <select> has no
         // .options). The product legitimately reads contSel.options, so give the element the
         // getter a real DOM would provide, derived from the markup the product wrote.
         (function(){
           var el = document.getElementById('continue-select');
           Object.defineProperty(el, 'options', { configurable:true, get:function(){
             var out=[], re=new RegExp('<option value="([^"]*)"([^>]*)>([^]*?)<' + '/option>','g'), m;
             while((m=re.exec(this.innerHTML||''))) out.push({
               value:m[1].replace(/&quot;/g,'"'), selected:/selected/.test(m[2]), text:m[3] });
             return out;
           }});
         })();
         repopulateContinueSelect();
         document.getElementById('continue-select').value = ${JSON.stringify(last.id)};
         true;`, 'seed');
  const held = C.run(`document.getElementById('continue-select').value`, 'v');
  C.run(`selectSrcLang('de'); true;`, 'switch');
  const after = C.run(`document.getElementById('continue-select').value`, 'v2');
  console.log('C) a selection is made, then the SOURCE language is changed to de:');
  console.log(`   before: ${JSON.stringify(held)}`);
  console.log(`   after : ${JSON.stringify(after)}   ${after === held ? '✓ survives' : '✗ LOST'}`);
}
