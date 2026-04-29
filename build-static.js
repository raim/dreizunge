#!/usr/bin/env node
'use strict';
/**
 * build-static.js
 *
 * Generates docs/index.html — a fully static version of the app
 * that works on GitHub Pages without any server.
 *
 * Usage:
 *   node build-static.js [lessons.json] [output-dir]
 *
 * Defaults:
 *   lessons source : ./lessons.json
 *   output dir     : ./docs
 */

const fs   = require('fs');
const path = require('path');

const lessonsFile = process.argv[2] || path.join(__dirname, 'lessons.json');
const outputDir   = process.argv[3] || path.join(__dirname, 'docs');
const outputFile  = path.join(outputDir, 'index.html');
const sourceHtml  = path.join(__dirname, 'index.html');

// ── Load inputs ───────────────────────────────────────────────────────
if (!fs.existsSync(sourceHtml)) {
  console.error('Error: index.html not found at', sourceHtml); process.exit(1);
}
if (!fs.existsSync(lessonsFile)) {
  console.error('Error: lessons file not found at', lessonsFile); process.exit(1);
}

let lessonsData;
try { lessonsData = JSON.parse(fs.readFileSync(lessonsFile, 'utf8')); }
catch(e) { console.error('Error: could not parse', lessonsFile, '—', e.message); process.exit(1); }

if (!Array.isArray(lessonsData.lessons) || lessonsData.lessons.length === 0) {
  console.error('Error: lessons.json has no lessons array or it is empty.'); process.exit(1);
}

const topicCount = lessonsData.lessons.length;
const langCodes  = [...new Set(lessonsData.lessons.map(l => l.lang || 'it'))].sort();

// ── Ensure output directory ───────────────────────────────────────────
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// ── Parse index.html into parts ───────────────────────────────────────
const src    = fs.readFileSync(sourceHtml, 'utf8');
const SO     = '<script>';
const SC     = '</script>';
const soIdx  = src.indexOf(SO) + SO.length;
const scIdx  = src.lastIndexOf(SC);
const htmlBefore = src.slice(0, soIdx);
const htmlAfter  = src.slice(scIdx);
const script     = src.slice(soIdx, scIdx);
const lines      = script.split('\n');

function findLine(marker, fromLine) {
  const start = fromLine || 0;
  const idx = lines.findIndex((l, i) => i >= start && l.trim().startsWith(marker));
  if (idx < 0) throw new Error(`Marker not found: "${marker}"`);
  return idx;
}

const serverFuncsStart = findLine('async function init()');
const engineStart      = findLine('function buildPath(');
const initCallLine     = findLine('init();', engineStart);

const part1 = lines.slice(0, serverFuncsStart).join('\n');
const part2 = lines.slice(engineStart, initCallLine).join('\n');

// ── Static replacement functions ──────────────────────────────────────
const lessonsSerialized = JSON.stringify(lessonsData.lessons, null, 2);

const staticFunctions = `
// ═══════════════════════════════════════════════════════════════════════
//  STATIC MODE — no server, all lessons baked in at build time
// ═══════════════════════════════════════════════════════════════════════

const STATIC_LESSONS = ${lessonsSerialized};

// localStorage
const LS_SAVED = 'imp_static_saved';

function staticGetSaved() {
  try { return JSON.parse(localStorage.getItem(LS_SAVED) || '[]'); }
  catch(_) { return []; }
}
function staticPutSaved(arr) { localStorage.setItem(LS_SAVED, JSON.stringify(arr)); }
function staticUpsert(data) {
  const arr = staticGetSaved();
  const k = data.topic.toLowerCase();
  const i = arr.findIndex(l => l.topic.toLowerCase() === k);
  const entry = { ...data, generatedAt: data.generatedAt || new Date().toISOString() };
  if (i >= 0) arr[i] = entry; else arr.unshift(entry);
  staticPutSaved(arr);
}

// Seed built-in lessons on first visit
(function seedBuiltins() {
  const existing = staticGetSaved().map(l => l.topic.toLowerCase());
  for (const l of STATIC_LESSONS) {
    if (!existing.includes(l.topic.toLowerCase())) staticUpsert(l);
  }
})();

// ── Init ──────────────────────────────────────────────────────────────
async function init() {
  APP.info = { backend: 'none', canGenerate: false };
  selectLang(APP.lang);
  restoreDiffSlider();
  renderPill();
  loadSavedList();
}

function renderPill() {
  const pill = document.getElementById('bpill');
  const lbl  = document.getElementById('blbl');
  document.getElementById('bmodel').textContent = '';
  pill.className = 'bpill none';
  lbl.textContent = 'Static — built-in lessons only';
  document.getElementById('gen-btn').disabled = true;
  document.getElementById('topic-input').disabled = true;
  const sel = document.getElementById('lang-select');
  if (sel) sel.disabled = true;
  const note = document.getElementById('offline-note');
  note.style.display = 'block';
  note.textContent = '📦 Static version — select a topic below to start';
}

// ── Saved list with language filter ───────────────────────────────────
async function loadSavedList() {
  const saved = staticGetSaved();

  // Build language filter buttons if multiple languages present
  const langs = [...new Set(saved.map(s => s.lang || 'it'))].sort();
  const filterEl = document.getElementById('lib-filter');
  if (filterEl && langs.length > 1) {
    filterEl.innerHTML = ['all', ...langs].map(l => {
      const L = LANGS[l];
      const lbl = l === 'all' ? '🌐 All' : (L ? L.flag + ' ' + L.name : l.toUpperCase());
      return \`<button class="lib-filter-btn\${APP.libFilter===l?' active':''}" onclick="setLibFilter('\${l}')">\${lbl}</button>\`;
    }).join('');
  } else if (filterEl) { filterEl.innerHTML = ''; }

  const filtered = APP.libFilter === 'all' ? saved : saved.filter(s => (s.lang||'it') === APP.libFilter);
  document.getElementById('lib-cnt').textContent =
    filtered.length + ' of ' + saved.length + ' topic' + (saved.length !== 1 ? 's' : '');
  const list = document.getElementById('saved-list');
  if (!filtered.length) {
    list.innerHTML = '<div class="lib-empty">' + (saved.length ? 'No lessons in this language.' : 'No lessons available.') + '</div>';
    return;
  }
  list.innerHTML = filtered.map(s => {
    const lang = s.lang || 'it';
    const L = LANGS[lang];
    const flag = L ? L.flag : '🌐';
    const count = s.lessons ? s.lessons.length : 0;
    const t = encodeURIComponent(s.topic);
    return \`<div class="saved-item" onclick="loadSaved('\${t}')">
      <span class="saved-emoji">\${flag} \${s.topicEmoji||'📚'}</span>
      <div class="saved-info">
        <div class="saved-topic">\${s.topic}</div>
        <div class="saved-meta">\${count} lesson\${count !== 1 ? 's' : ''}</div>
      </div>
    </div>\`;
  }).join('');
}

function setLibFilter(lang) { APP.libFilter = lang; loadSavedList(); }

async function loadSaved(topic) {
  const dec = decodeURIComponent(topic);
  const found = staticGetSaved().find(l => l.topic.toLowerCase() === dec.toLowerCase());
  if (!found) { alert('Lesson not found.'); return; }
  APP.lessonData = found;
  goHome();
}

function  setTopic(t) { document.getElementById('topic-input').value = t; }
`;

// Stubs injected AFTER part2 so they override engine versions
const staticOverrides = [
  '// Disabled in static mode — overrides engine versions',
  'async function syncFlagsFromServer() {}',
  'async function pushFlagToServer()   {}',
  'async function deleteSaved()        {}',
  'async function regenSaved()         {}',
  'function  regenCurrent()            {}',
  'async function doGenerate()         {}',
  'async function repairLesson()       {}',
  'async function repairFromLesson()   {}',
  '',
  '// UI helpers — work fully in static mode',
  'function autoResizeTopic(el){ el.style.height=\'auto\'; el.style.height=Math.min(el.scrollHeight,160)+\'px\'; }',
  'function onDiffSlider(v){',
  '  APP.difficulty=parseInt(v,10); saveDifficulty();',
  '  const el=document.getElementById(\'diff-val\');',
  '  if(el){ el.textContent=DIFF_SHORT[APP.difficulty]||v; el.className=\'diff-val d\'+APP.difficulty; }',
  '}',
  'function restoreDiffSlider(){',
  '  const sl=document.getElementById(\'diff-slider\'); if(sl) sl.value=APP.difficulty;',
  '  onDiffSlider(APP.difficulty);',
  '}',
  '',
  '// Story — DOM-only functions work in static mode',
  'function toggleStory(){',
  '  const body=document.getElementById(\'story-body\');',
  '  const arrow=document.getElementById(\'story-arrow\');',
  '  if(!body) return;',
  '  const open=body.classList.toggle(\'open\');',
  '  if(arrow) arrow.classList.toggle(\'open\',open);',
  '}',
  'function toggleStoryRepair(){',
  '  const wrap=document.getElementById(\'story-repair-wrap\');',
  '  if(wrap) wrap.classList.toggle(\'open\');',
  '}',
  'function renderStoryText(d){',
  '  const body=document.getElementById(\'story-body\'); if(!body) return;',
  '  const paras=(d.story||\'\').split(/\\n\\n+/).map(p=>\'<p>\'+p.replace(/\\n/g,\'<br>\')+\'</p>\').join(\'\');',
  '  let html=`<div id="story-orig">${paras}</div>`;',
  '  if(d.storyTranslation){',
  '    const tp=d.storyTranslation.split(/\\n\\n+/).map(p=>\'<p>\'+p.replace(/\\n/g,\'<br>\')+\'</p>\').join(\'\');',
  '    html+=`<div class="story-translation" id="story-trans">${tp}</div>`;',
  '  } else {',
  '    html+=\'<div class="story-translation" id="story-trans" style="display:none"></div>\';',
  '  }',
  '  body.innerHTML=html;',
  '}',
  'function speakStory(){ const d=APP.lessonData; if(d&&d.story) speak(d.story); }',
  'function toggleStoryTranslation(){',
  '  const d=APP.lessonData; if(!d) return;',
  '  if(d.storyTranslation){',
  '    const t=document.getElementById(\'story-trans\');',
  '    if(t){ t.style.display=t.style.display===\'none\'?\'\': \'none\'; }',
  '    const body=document.getElementById(\'story-body\');',
  '    if(body&&!body.classList.contains(\'open\')){ body.classList.add(\'open\'); const a=document.getElementById(\'story-arrow\'); if(a) a.classList.add(\'open\'); }',
  '    return;',
  '  }',
  '  alert(\'Story translation requires the live server.\');',
  '}',
  'function doRepairStory(){ alert(\'Story repair requires the live server.\'); }',
].join('\n');

// ── Assemble ──────────────────────────────────────────────────────────
const newScript = [part1, staticFunctions, part2, staticOverrides, '\ninit();'].join('\n');
const output    = [htmlBefore, newScript, htmlAfter].join('');
fs.writeFileSync(outputFile, output, 'utf8');

// ── Report ─────────────────────────────────────────────────────────────
const LANG_NAMES = {
  it:'Italian',fr:'French',de:'German',es:'Spanish',pt:'Portuguese',
  nl:'Dutch',pl:'Polish',sv:'Swedish',ja:'Japanese',zh:'Mandarin',
  ar:'Arabic',ru:'Russian',ko:'Korean',tr:'Turkish',hi:'Hindi',
};
const langSummary = langCodes.map(c => LANG_NAMES[c]||c).join(', ');
const topicLines  = lessonsData.lessons.map(l => {
  const flag = {it:'🇮🇹',fr:'🇫🇷',de:'🇩🇪',es:'🇪🇸',pt:'🇵🇹',
                nl:'🇳🇱',pl:'🇵🇱',sv:'🇸🇪',ja:'🇯🇵',zh:'🇨🇳',
                ar:'🇸🇦',ru:'🇷🇺',ko:'🇰🇷',tr:'🇹🇷',hi:'🇮🇳'}[l.lang||'it']||'🌐';
  return `  • ${flag} ${l.topicEmoji||'📚'} ${l.topic}`;
}).join('\n');

console.log('');
console.log('✅  Static build complete');
console.log(`    Source    : ${sourceHtml}`);
console.log(`    Lessons   : ${lessonsFile} (${topicCount} topic${topicCount!==1?'s':''})`);
console.log(`    Languages : ${langSummary}`);
console.log(`    Output    : ${outputFile}`);
console.log(`    Size      : ${(fs.statSync(outputFile).size/1024).toFixed(1)} KB`);
console.log('');
console.log('    Topics bundled:');
console.log(topicLines);
console.log('');
console.log('    To deploy on GitHub Pages:');
console.log('    1. node build-static.js  (run whenever lessons.json changes)');
console.log('    2. git add docs/index.html && git commit && git push');
console.log('    3. Settings → Pages → branch=main, folder=/docs');
console.log('    4. https://<user>.github.io/<repo>/');
console.log('');
