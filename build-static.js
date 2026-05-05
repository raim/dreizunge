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
// ── Strip flagged exercises from baked-in lessons ─────────────────────
const flags = lessonsData.flags || {};
const flagKeys = new Set(Object.keys(flags));

function topicSlug(topic) {
  return (topic || '').slice(0, 30).replace(/\s+/g, '_');
}
function contentSlug(str) {
  return (str || '').slice(0, 40).replace(/\s+/g, '_');
}

const cleanedLessons = lessonsData.lessons.map(topic => {
  const slug = topicSlug(topic.topic);
  // A flag key for an exercise looks like: slug:type:contentSlug
  // We mark vocab and sentences whose content slug appears in any flag key for this topic
  const topicFlagKeys = [...flagKeys].filter(k => k.startsWith(slug + ':'));
  if (topicFlagKeys.length === 0) return topic;  // no flags for this topic

  // Build set of flagged content slugs
  const flaggedContent = new Set(topicFlagKeys.map(k => k.split(':').slice(2).join(':')));

  const cleanTopic = { ...topic, lessons: topic.lessons.map(lesson => ({
    ...lesson,
    vocab: (lesson.vocab || []).filter(v => !flaggedContent.has(contentSlug(v.it))),
    sentences: (lesson.sentences || []).filter(s => !flaggedContent.has(contentSlug(s.it))),
  }))};
  return cleanTopic;
});

const removedCount = lessonsData.lessons.reduce((total, topic, i) => {
  const orig = topic.lessons.reduce((n, l) => n + l.vocab.length + l.sentences.length, 0);
  const clean = cleanedLessons[i].lessons.reduce((n, l) => n + l.vocab.length + l.sentences.length, 0);
  return total + (orig - clean);
}, 0);

const lessonsSerialized = JSON.stringify(cleanedLessons, null, 2);

const staticFunctions = `
// ═══════════════════════════════════════════════════════════════════════
//  STATIC MODE — no server, lessons baked in at build time
// ═══════════════════════════════════════════════════════════════════════

const STATIC_LESSONS = ${lessonsSerialized};
// Sort newest first
STATIC_LESSONS.sort((a,b)=>((b.updatedAt||b.generatedAt||'').localeCompare(a.updatedAt||a.generatedAt||'')));

async function init() {
  APP.info = { backend: 'none', canGenerate: false };
  selectLang(APP.lang);
  restoreDiffSelect();
  renderPill();
  loadSavedList();
  const hashTopic = decodeURIComponent((location.hash.match(/[#&]topic=([^&]*)/) || [])[1] || '');
  if (hashTopic) loadSaved(hashTopic);
}

function renderPill() {
  const pill=document.getElementById('bpill'), lbl=document.getElementById('blbl');
  document.getElementById('bmodel').textContent = '';
  pill.className = 'bpill none';
  lbl.textContent = 'Static — built-in lessons only';
  document.getElementById('gen-btn').disabled = true;
  document.getElementById('topic-input').disabled = true;
  const note=document.getElementById('offline-note');
  note.style.display='block';
  note.innerHTML='📦 Static version — select a topic below to start<br><small style="font-weight:600;opacity:.7"><a href="https://github.com/raim/dreizunge" target="_blank" style="color:inherit">github.com/raim/dreizunge</a></small>';
  // Limit lang dropdown to languages that have lessons in this build
  const presentLangs=new Set(STATIC_LESSONS.map(s=>s.lang||'it'));
  const sel=document.getElementById('lang-select');
  if(sel){
    Array.from(sel.options).forEach(opt=>{ opt.style.display=presentLangs.has(opt.value)?'':'none'; });
    // If current selection has no lessons, switch to first available
    if(!presentLangs.has(sel.value)){
      const first=[...presentLangs][0];
      if(first){ sel.value=first; APP.lang=first; saveLang(); }
    }
  }
  // Disable user-story checkboxes — generation not available in static mode
  const useStoryCb=document.getElementById('use-story-cb');
  if(useStoryCb){ useStoryCb.disabled=true; useStoryCb.closest('.user-story-check-row').style.opacity='0.4'; useStoryCb.closest('.user-story-check-row').title='Story input requires the live server'; }
  // Gray out controls that have no effect in static mode
  const diffSel=document.getElementById('diff-select');
  if(diffSel){ diffSel.disabled=true; diffSel.title='Difficulty selection has no effect in static mode'; }
  const diffWrap=document.getElementById('diff-wrap')||diffSel?.closest('.diff-wrap');
  if(diffWrap) diffWrap.style.opacity='0.4';
  const lenSlider=document.getElementById('story-len-slider');
  if(lenSlider){ lenSlider.disabled=true; lenSlider.title='Story length has no effect in static mode'; }
  const lenRow=lenSlider?.closest('.story-len-row');
  if(lenRow) lenRow.style.opacity='0.4';
}

async function loadSavedList() {
  const saved = STATIC_LESSONS;
  APP.savedList = saved;  // needed by buildPath for cont-nav "continued in" links
  const hasMultiLang=[...new Set(saved.map(s=>s.lang||'it'))].length>1;
  const filterEl=document.getElementById('lib-filter');
  if(filterEl){
    if(hasMultiLang){
      const activeL=LANGS[APP.libFilter]||null;
      filterEl.innerHTML=(APP.libFilter==='all'
        ? \`<button class="lib-filter-btn active">🌐 All languages</button>\`
        : \`<button class="lib-filter-btn active">\${activeL?activeL.flag+' '+activeL.name:APP.libFilter.toUpperCase()}</button>\`+
          \`<button class="lib-filter-btn" onclick="setLibFilter('all')">🌐 All</button>\`
      );
    } else {
      filterEl.innerHTML='';
    }
  }

  const filtered=APP.libFilter==='all'?saved:saved.filter(s=>(s.lang||'it')===APP.libFilter);
  document.getElementById('lib-cnt').textContent=
    filtered.length+' of '+saved.length+' topic'+(saved.length!==1?'s':'');
  const list=document.getElementById('saved-list');
  if(!filtered.length){
    list.innerHTML='<div class="lib-empty">'+(saved.length?'No lessons in this language.':'No lessons available.')+'</div>';
    return;
  }

  // Build storyline chains
  const byTopic=Object.fromEntries(filtered.map(l=>[l.topic,l]));
  const childMap={};
  filtered.forEach(l=>{
    if(l.continuedFrom && byTopic[l.continuedFrom])
      (childMap[l.continuedFrom]=childMap[l.continuedFrom]||[]).push(l.topic);
  });
  const hasParent=new Set(filtered.filter(l=>l.continuedFrom&&byTopic[l.continuedFrom]).map(l=>l.topic));
  const chains=[];
  function walk(topic,chain){
    const ext=[...chain,topic], kids=childMap[topic]||[];
    if(!kids.length){chains.push(ext);return;}
    kids.forEach(k=>walk(k,ext));
  }
  filtered.filter(l=>!hasParent.has(l.topic)).forEach(r=>walk(r.topic,[]));
  const storylines=chains.filter(c=>c.length>1);
  const inChain=new Set(storylines.flat());
  const orphans=filtered.filter(l=>!inChain.has(l.topic));

  function itemHtml(s, connector) {
    const sL=LANGS[s.lang||'it']||LANGS.it;
    const t=encTopic(s.topic);
    const d=s.difficulty||2;
    const diff={1:'Beginner',2:'Intermediate',3:'Advanced'}[d]||'';
    const diffBadge='<span class="diff-badge d'+d+'">'+diff+'</span>';
    const ratingStr=s.ratings
      ? ' · '+(['🔵','🟡','🔴'][s.ratings.difficulty-1]||'')+' '+(['😐','😊','😄'][s.ratings.fun-1]||'')
      : '';
    const count=s.lessons?s.lessons.length:0;
    const dateStr=s.updatedAt||s.generatedAt;
    const date=dateStr?new Date(dateStr).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'';
    const conn=connector?'<span class="storyline-connector">↩</span>':'';
    const escapedTopic=s.topic.replace(/"/g,'&quot;');
    return \`<div class="saved-item" onclick="loadSaved('\${t}')">
      \${conn}<span class="saved-emoji">\${sL.flag} \${s.topicEmoji||'📚'}</span>
      <div class="saved-info">
        <div class="saved-topic">\${s.topic} \${diffBadge}</div>
        <div class="saved-meta">\${count} lesson\${count!==1?'s':''} · \${date}\${ratingStr}</div>
      </div>
      <div class="saved-actions" onclick="event.stopPropagation()">
        <button class="ico-btn export" title="Export lesson with flags"
          data-topic="\${escapedTopic}"
          onclick="exportTopics([this.dataset.topic])">⬇</button>
      </div>
    </div>\`;
  }

  const newestOf=chain=>chain.reduce((b,t)=>{const d=byTopic[t]?.updatedAt||byTopic[t]?.generatedAt||'';return d>b?d:b;},'');
  storylines.sort((a,b)=>newestOf(b).localeCompare(newestOf(a)));

  let html='';
  for(const chain of storylines){
    const chainTopicsJson=JSON.stringify(chain.map(t=>byTopic[t]?.topic).filter(Boolean));
    const chainEncoded=encodeURIComponent(chainTopicsJson);
    const chainId='c'+Math.abs(chainTopicsJson.split('').reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0));
    html+='<div class="storyline-group"><div class="storyline-hdr">📖 Story line · '+chain.length+' lesson'+(chain.length!==1?'s':'')+
      '<button class="ico-btn export" style="margin-left:auto;font-size:11px;padding:2px 8px" title="Export full story line with flags"'+
      ' data-chain="'+chainEncoded+'"'+
      ' onclick="event.stopPropagation();exportTopics(JSON.parse(decodeURIComponent(this.dataset.chain)))">⬇ Export</button>'+
      '</div>';
    chain.forEach((topic,i)=>{
      const s=byTopic[topic]; if(!s)return;
      html+='<div class="storyline-item">'+itemHtml(s,i>0)+'</div>';
    });
    html+=\`<div class="storyline-story"><button class="storyline-story-hdr" onclick="toggleChainStory('\${chainId}')">📖 Read full story<span class="storyline-story-arrow" id="csarrow-\${chainId}">▼</span></button><div class="storyline-story-body" id="csbody-\${chainId}" data-chain="\${chainEncoded}"></div></div>\`;
    html+='</div>';
  }
  if(orphans.length){
    if(storylines.length) html+='<div class="orphans-hdr">📚 Individual lessons</div>';
    html+=orphans.map(s=>itemHtml(s,false)).join('');
  }
  list.innerHTML=html||'<div class="lib-empty">No lessons available.</div>';
}

function setLibFilter(lang){
  APP.libFilter=lang;
  if(lang!=='all' && LANGS[lang]){
    APP.lang=lang; saveLang();
    const sel=document.getElementById('lang-select');
    if(sel) sel.value=lang;
    const L=LANGS[lang];
    const lbl=document.getElementById('topic-label');
    if(lbl) lbl.textContent='What do you want to learn '+L.name+' for?';
    const tagline=document.getElementById('app-tagline');
    if(tagline) tagline.textContent='Learn '+L.name+' vocabulary for any topic';
  }
  loadSavedList();
}

async function loadSaved(topic) {
  const dec=decodeURIComponent(topic);
  const found=STATIC_LESSONS.find(l=>l.topic.toLowerCase()===dec.toLowerCase());
  if(!found){ alert('Lesson not found.'); return; }
  APP.lessonData=found; goHome();
}

function setTopic(t){ document.getElementById('topic-input').value=t; }
`;

// Stubs injected AFTER part2 so they override engine versions
const staticOverrides = [
  '// ── Disabled in static mode ──────────────────────────────────────',
  'async function syncFlagsFromServer(){}',
  'async function pushFlagToServer(){}',
  'async function deleteSaved(){}',
  'async function regenSaved(){}',
  'function regenCurrent(){}',
  'function shareLesson(){}',
  'async function doGenerate(){}',
  'async function submitRating(){}',
  'function importLessons(input){',
  '  const file=input.files[0]; if(!file)return;',
  '  input.value="";',
  '  const reader=new FileReader();',
  '  reader.onload=function(e){',
  '    let data;',
  '    try{ data=JSON.parse(e.target.result); }',
  '    catch(err){ showToast("⚠ Invalid JSON file"); return; }',
  '    const incoming=Array.isArray(data)?data:(data.lessons||data);',
  '    if(!Array.isArray(incoming)||!incoming.length){ showToast("⚠ No lessons found in file"); return; }',
  '    let added=0, updated=0;',
  '    for(const l of incoming){',
  '      if(!l.topic||!Array.isArray(l.lessons)) continue;',
  '      const idx=STATIC_LESSONS.findIndex(x=>x.topic===l.topic);',
  '      if(idx>=0){ STATIC_LESSONS[idx]=l; updated++; }',
  '      else{ STATIC_LESSONS.unshift(l); added++; }',
  '    }',
  '    loadSavedList();',
  '    showToast("✓ Session import: +"+added+" new, ~"+updated+" updated (resets on refresh)");',
  '  };',
  '  reader.readAsText(file);',
  '}',
  'function toggleChat(){}',
  'function autoResizeChat(){}',
  'function clearChat(){}',
  'async function sendChat(){ alert("Model console requires the live server."); }',
  'function toggleStoryFlag(){}',
  'function saveStoryComment(){}',
  'function _updateStoryFlagUI(){}',
  'async function toggleChainStory(chainId){',
  '  const body=document.getElementById("csbody-"+chainId);',
  '  const arrow=document.getElementById("csarrow-"+chainId);',
  '  if(!body)return;',
  '  const opening=!body.classList.contains("open");',
  '  body.classList.toggle("open",opening);',
  '  if(arrow)arrow.classList.toggle("open",opening);',
  '  if(!opening||body.dataset.loaded)return;',
  '  body.dataset.loaded="1";',
  '  const topics=JSON.parse(decodeURIComponent(body.dataset.chain));',
  '  const chapters=topics.map(t=>STATIC_LESSONS.find(l=>l.topic===t)).filter(Boolean);',
  '  _renderChainStory(body,chapters);',
  '}',
  'function autoResizeTopic(el){ el.style.height="auto"; el.style.height=Math.min(el.scrollHeight,160)+"px"; }',
  'function toggleStory(){',
  '  const body=document.getElementById("story-body"),arrow=document.getElementById("story-arrow");',
  '  if(!body)return;',
  '  const open=body.classList.toggle("open");',
  '  if(arrow)arrow.classList.toggle("open",open);',
  '}',
  'function speakStory(){ const d=APP.lessonData; if(d&&d.story)speak(d.story); }',
  'function renderStoryText(d,targetEl){',
  '  const body=targetEl||document.getElementById("story-body"); if(!body)return;',
  '  // Highlight all vocab words (static: no completion gating)',
  '  const vocabWords=(d.lessons||[]).flatMap(L=>L.vocab||[]).map(v=>v.it).filter(Boolean).sort((a,b)=>b.length-a.length);',
  '  const escHtml=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");',
  '  let escaped=escHtml(d.story||"");',
  '  if(vocabWords.length){',
  '    const pattern=vocabWords.map(w=>w.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&")).join("|");',
  '    escaped=escaped.replace(new RegExp("("+pattern+")","gi"),\'<mark class="story-vocab-hl">$1</mark>\');',
  '  }',
  '  body.innerHTML=escaped.split(/\\n\\n+/).map(p=>"<p>"+p.replace(/\\n/g,"<br>")+"</p>").join("");',
  '}',
  'function toggleStoryRepair(){}',
  'function doRepairStory(){ alert("Story repair requires the live server."); }',
  '// Export — works fully in static mode using baked-in lesson data',
  'async function exportTopics(topics){',
  '  if(!topics||!topics.length)return;',
  '  showToast("⏳ Preparing export…");',
  '  try{',
  '    const lessons=[];',
  '    for(const topic of topics){',
  '      const data=STATIC_LESSONS.find(l=>l.topic===topic);',
  '      if(!data){ showToast("⚠ Not found: "+topic); return; }',
  '      const topicSlug=topic.slice(0,30).replace(/\\s+/g,"_");',
  '      const flags={};',
  '      Object.entries(APP.flagged).forEach(([k,v])=>{ if(k.startsWith(topicSlug+":"))flags[k]=v; });',
  '      lessons.push({...data,exportedFlags:flags,exportedAt:new Date().toISOString()});',
  '    }',
  '    const payload={lessons,exportedAt:new Date().toISOString(),exportedBy:"dreizunge-static"};',
  '    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});',
  '    const url=URL.createObjectURL(blob);',
  '    const a=document.createElement("a");',
  '    const filename=topics.length===1',
  '      ?"dreizunge-"+topics[0].replace(/[^a-z0-9]+/gi,"-").toLowerCase().slice(0,40)+".json"',
  '      :"dreizunge-storyline-"+Date.now()+".json";',
  '    a.href=url; a.download=filename;',
  '    document.body.appendChild(a); a.click();',
  '    document.body.removeChild(a); URL.revokeObjectURL(url);',
  '    showToast("✓ Exported "+lessons.length+" lesson"+(lessons.length!==1?"s":""));',
  '  }catch(e){ showToast("⚠ Export failed: "+e.message); }',
  '}',
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
                ar:'🇸🇦',ru:'🇷🇺',ko:'🇰🇷',tr:'🇹🇷',hi:'🇮🇳',lb:'🇱🇺'}[l.lang||'it']||'🌐';
  return `  • ${flag} ${l.topicEmoji||'📚'} ${l.topic}`;
}).join('\n');

console.log('');
console.log('✅  Static build complete');
console.log(`    Source    : ${sourceHtml}`);
console.log(`    Lessons   : ${lessonsFile} (${topicCount} topic${topicCount!==1?'s':''})`);
console.log(`    Flagged   : ${removedCount} exercise${removedCount!==1?'s':''} stripped from baked-in lessons`);
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
