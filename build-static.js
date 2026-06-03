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
const UI_FILE   = path.join(__dirname, 'ui.json');
const LANG_FILE = path.join(__dirname, 'languages.json');

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

// Support v29 schema (topics[]) and legacy (lessons[])
const _allTopics = (lessonsData.schemaVersion >= 29 && Array.isArray(lessonsData.topics))
  ? lessonsData.topics : lessonsData.lessons;
if (!Array.isArray(_allTopics) || _allTopics.length === 0) {
  console.error('Error: lessons.json has no topics/lessons array or it is empty.'); process.exit(1);
}
// Normalise: always expose as lessonsData.lessons for the rest of the script
lessonsData.lessons = _allTopics;

const topicCount = _allTopics.length;
const langCodes  = [...new Set(_allTopics.map(l => l.lang || 'it'))].sort();

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

// Build UI strings injection — runs in Node.js, bakes all languages into page
let _uiStringsAll = {};
try { _uiStringsAll = JSON.parse(fs.readFileSync(UI_FILE, 'utf8')); }
catch(e) { console.warn('Could not read ui.json:', e.message); }

let _langsData = {};
try { _langsData = JSON.parse(fs.readFileSync(LANG_FILE, 'utf8')); }
catch(e) { console.warn('Could not read languages.json:', e.message); }

const uiScript = 'window.UI_STRINGS_ALL=' + JSON.stringify(_uiStringsAll) +
  ';\nwindow._UI_EN=' + JSON.stringify(_uiStringsAll['en']||{}) +
  ';\nwindow.LANGUAGES_DATA=' + JSON.stringify(_langsData) + ';\n';

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

// Support v29 schema (topics array) or legacy (lessons array)
const _topicsArr = (lessonsData.schemaVersion >= 29 && Array.isArray(lessonsData.topics))
  ? lessonsData.topics : lessonsData.lessons;

// Build per-topic flagged content slug sets for stripping individual exercises
// Flag key format: topicSlug:type:contentSlug  (or  topicId:type:contentSlug in v29)
function flaggedSlugsForTopic(topic) {
  const slug = topicSlug(topic.topic);
  const tid  = topic.id || slug;
  const prefixes = [slug + ':', tid + ':'];
  const slugSet = new Set();
  [...flagKeys].forEach(k => {
    if (prefixes.some(p => k.startsWith(p))) {
      const parts = k.split(':');
      if (parts.length >= 3) slugSet.add(parts.slice(2).join(':'));
    }
  });
  return slugSet;
}

// Strip flagged exercises from lesson sets — keep the topic/story, remove flagged Q&A
const cleanedLessons = _topicsArr.map(topic => {
  const flagged = flaggedSlugsForTopic(topic);
  if (flagged.size === 0) return topic; // nothing flagged — pass through unchanged
  const cleanedLessonSets = (topic.lessons || []).map(ls => ({
    ...ls,
    vocab:     (ls.vocab     || []).filter(v => !flagged.has(contentSlug(v.target))),
    sentences: (ls.sentences || []).filter(s => !flagged.has(contentSlug(s.target))),
    // grammar and conjugation items: strip if their target is flagged
    grammar:      ls.grammar      ? ls.grammar.filter(g => !flagged.has(contentSlug(g.target))) : undefined,
    conjugations: ls.conjugations ? ls.conjugations.filter(c => !flagged.has(contentSlug(c.infinitive))) : undefined,
  }));
  const strippedCount = (topic.lessons||[]).reduce((n,ls) =>
    n + (ls.vocab||[]).length + (ls.sentences||[]).length, 0)
    - cleanedLessonSets.reduce((n,ls) => n + (ls.vocab||[]).length + (ls.sentences||[]).length, 0);
  if (strippedCount > 0)
    console.log(`  Stripped ${strippedCount} flagged exercise(s) from "${topic.topic}"`);
  return { ...topic, lessons: cleanedLessonSets };
});
const removedCount = cleanedLessons.reduce((n, t, i) => {
  const orig = (_topicsArr[i].lessons||[]).reduce((m,ls)=>m+(ls.vocab||[]).length+(ls.sentences||[]).length,0);
  const clean = (t.lessons||[]).reduce((m,ls)=>m+(ls.vocab||[]).length+(ls.sentences||[]).length,0);
  return n + (orig - clean);
}, 0);

const lessonsSerialized = JSON.stringify(cleanedLessons, null, 2);

// Storylines — keep all, no filtering needed (topics are all kept)
const rawStorylines = lessonsData.storylines || (lessonsData.schemaVersion >= 29 ? [] : {});
const cleanedStorylines = rawStorylines; // all topics kept, no chapters to remove
const storylinesSerialized = JSON.stringify(cleanedStorylines);

const staticFunctions = `
// ═══════════════════════════════════════════════════════════════════════
//  STATIC MODE — no server, lessons baked in at build time
// ═══════════════════════════════════════════════════════════════════════

const STATIC_LESSONS = ${lessonsSerialized};
// Sort newest first
STATIC_LESSONS.sort((a,b)=>((b.updatedAt||b.generatedAt||'').localeCompare(a.updatedAt||a.generatedAt||'')));

const STATIC_STORYLINES = ${storylinesSerialized};

// ── repopulateContinueSelect — filters continue-dropdown by language ──
function repopulateContinueSelect(){
  const contSel=document.getElementById('continue-select');
  if(!contSel) return;
  const showAll=document.getElementById('cont-all-langs')?.checked;
  const curLang=APP.lang||'it';
  const saved=APP.savedList||[];
  const filtered=showAll ? saved : saved.filter(s=>(s.lang||'it')===curLang);
  const prev=contSel.value;
  contSel.innerHTML='<option value="">\u2014 new story \u2014</option>'+
    filtered.map(s=>{
      const tL=LANGS[s.lang||'it']||LANGS.it||{flag:'',name:s.lang||'it'};
      const langTag=showAll&&(s.lang||'it')!==curLang?' ['+tL.name+']':'';
      return '<option value="'+s.topic.replace(/"/g,'&quot;')+'">'+tL.flag+' '+s.topic+langTag+'</option>';
    }).join('');
  if(prev && [...contSel.options].some(o=>o.value===prev)) contSel.value=prev;
}


async function init() {
  APP.info = { backend: 'none', canGenerate: false };
  APP.libFilter='all'; APP.libSrcFilter='all';
  await loadLanguages();
  const _ss=document.getElementById('src-lang-select'); if(_ss) _ss.value='all';
  const _ts=document.getElementById('lang-select'); if(_ts) _ts.value='all';
  selectLang(APP.lang, true);
  await loadUIStrings(APP.srcLang);
  restoreDiffSelect();
  renderPill();
  await loadSavedList();
  // Hash routing
  if (location.hash.startsWith('#sl=')) {
    const chainId = location.hash.slice(4);
    _tryOpenStorylineByChainId(chainId);
  } else {
    const hashTopic = decodeURIComponent((location.hash.match(/[#&]topic=([^&]*)/) || [])[1] || '');
    if (hashTopic) loadSaved(hashTopic);
  }
}

function renderPill() {
  const pill=document.getElementById('bpill'), lbl=document.getElementById('blbl');
  const bmodel=document.getElementById('bmodel');
  if(bmodel) bmodel.textContent = '';
  if(pill) pill.className = 'bpill none';
  if(lbl) lbl.textContent = 'Static — built-in lessons only';
  const genBtn=document.getElementById('gen-btn'); if(genBtn) genBtn.disabled = true;
  const topicInp=document.getElementById('topic-input'); if(topicInp) topicInp.disabled = true;
  // C5: replace generation form with static info message
  const _tf = document.querySelector('.topic-form');
  if (_tf && !document.getElementById('static-gen-overlay')) {
    const _ov = document.createElement('div');
    _ov.id = 'static-gen-overlay';
    _ov.style.cssText = 'background:var(--white);border-radius:var(--radius-xl);padding:22px;'+ 
      'box-shadow:0 8px 32px rgba(0,0,0,.08);border:2px solid var(--gray-mid);margin-bottom:14px;'+ 
      'font-size:13px;font-weight:600;color:#444;line-height:1.7';
    _ov.innerHTML = '<strong style="font-size:15px">Dreizunge</strong> is an open-source language lesson generator: learn vocabulary for <strong>any topic</strong>. '+'Visit <a href="https://github.com/raim/dreizunge" target="_blank" style="color:#2a4acc">github.com/raim/dreizunge</a> to <strong>generate new stories</strong>.<br><br>'+'This is the <strong>static version</strong> — you can play the existing lessons below and lessons <strong>shared with you</strong> (json files), but not generate new ones.<br><br>'+'<span style="color:#c00;font-weight:800">⚠ AI generated content.</span> '+'Use a real language learning app or a human teacher if you are new to a language.';
    _tf.parentNode.replaceChild(_ov, _tf);
  }
  const note=document.getElementById('offline-note');
  if(note){ note.style.display='block';
  note.innerHTML=t('static.info')+'<br><small style="font-weight:600;opacity:.7"><a href="https://github.com/raim/dreizunge" target="_blank" style="color:inherit">github.com/raim/dreizunge</a></small>'; }

  // Show flagged-lessons reminder if this build stripped flagged exercises
  // Limit lang dropdown to languages that have lessons in this build
  const presentLangs=new Set(STATIC_LESSONS.map(s=>s.lang||'it'));
  const sel=document.getElementById('lang-select');
  if(sel){
    Array.from(sel.options).forEach(opt=>{ opt.style.display=(opt.value==='all'||presentLangs.has(opt.value))?'':'none'; });
    // If current selection has no lessons, switch to first available
    if(!presentLangs.has(sel.value)){
      const first=[...presentLangs][0];
      if(first){ sel.value=first; APP.lang=first; saveLang(); }
    }
  }
  // In static mode the From/To selectors act as library filters, not generation controls.
  // Relabel them to reflect browse-only purpose.
  const langPairRow=document.querySelector('.lang-pair-row');
  if(langPairRow){
    const cols=langPairRow.querySelectorAll('.lang-pair-col');
    if(cols[0]){ const lbl=cols[0].querySelector('.form-lbl'); if(lbl) lbl.textContent='🗣️ From'; }
    if(cols[1]){ const lbl=cols[1].querySelector('.form-lbl'); if(lbl) lbl.textContent='📖 To'; }
  }
  // Disable user-story checkboxes — generation not available in static mode
  const useStoryCb=document.getElementById('use-story-cb');
  if(useStoryCb){ useStoryCb.disabled=true; const _ucr=useStoryCb.closest('.user-story-check-row'); if(_ucr){ _ucr.style.opacity='0.4'; _ucr.title='Story input requires the live server'; } }
  // Gray out controls that have no effect in static mode
  const diffSel=document.getElementById('diff-select');
  if(diffSel){ diffSel.disabled=true; diffSel.title='Difficulty selection has no effect in static mode'; }
  const diffWrap=document.getElementById('diff-wrap')||diffSel?.closest('.diff-wrap');
  if(diffWrap) diffWrap.style.opacity='0.4';
  const lenSlider=document.getElementById('story-len-slider');
  if(lenSlider){ lenSlider.disabled=true; lenSlider.title='Story length has no effect in static mode'; }
  const lenRow=lenSlider?.closest('.story-len-row');
  if(lenRow) lenRow.style.opacity='0.4';
  const formatSel=document.getElementById('format-select');
  if(formatSel){ formatSel.disabled=true; formatSel.title='Lesson format has no effect in static mode'; }
  const formatWrap=document.getElementById('format-wrap');
  if(formatWrap) formatWrap.style.opacity='0.4';
  const styleSel=document.getElementById('style-select');
  if(styleSel){ styleSel.disabled=true; styleSel.title='Writing style has no effect in static mode'; }
  const styleWrap=document.getElementById('style-wrap');
  if(styleWrap) styleWrap.style.opacity='0.4';
}

function itemHtml(s, connector) {
  const enc=encTopic(s.topic);
  const d=s.difficulty||2;
  const diff={1:'Beginner',2:'Intermediate',3:'Advanced'}[d]||'';
  const diffBadge='<span class="diff-dot d'+d+'" title="'+diff+'"></span>';
  const ratingStr=s.ratings
    ? ' · '+(['🔵','🟡','🔴'][s.ratings.difficulty-1]||'')+' '+(['😐','😊','😄'][s.ratings.fun-1]||'')
    : '';
  const count=s.lessons?s.lessons.length:0;
  const dateStr=s.updatedAt||s.generatedAt;
  const date=dateStr?new Date(dateStr).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'';
  const conn=connector?'<span class="storyline-connector">↩</span>':'';
  const escapedTopic=s.topic.replace(/"/g,'&quot;');
  const escapedTopicSq=s.topic.replace(/'/g,"\\'");
  const sid='si-'+enc.replace(/[^a-z0-9]/gi,'').slice(0,20)+Math.abs(s.topic.split('').reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0));
  const tL=LANGS[s.lang||'it']||LANGS.it;
  const srcL=LANGS[s.srcLang||'en']||{flag:'🇬🇧',name:'English'};
  return \`<div class="saved-item-wrap">
    <div class="saved-item" onclick="loadSaved('\${enc}')">
      \${conn}<span class="saved-emoji"> \${s.topicEmoji||'📚'}</span>
      <div class="saved-info">
        <div class="saved-topic">\${s.topic} \${diffBadge}</div>
        <div class="saved-meta"><span class=\"lang-pair-badge\" title=\"\${srcL.name} → \${tL.name}\">\${srcL.flag}→\${tL.flag}</span> \${count} lesson\${count!==1?'s':''} · \${date}\${ratingStr}</div>
      </div>
      <div class="saved-actions" onclick="event.stopPropagation()">
        <button class="ico-btn export" title="Export lesson with flags"
          data-topic="\${escapedTopic}"
          onclick="exportTopics([this.dataset.topic])">⬇</button>
      </div>
    </div>
    <div class="saved-item-story">
      <button class="saved-item-story-hdr" onclick="event.stopPropagation();toggleSavedStory('\${sid}','\${escapedTopicSq}')">
        \${t('lesson.read_story_short')} <span id="sis-arrow-\${sid}" style="margin-left:auto;font-size:10px">▼</span>
      </button>
      <div class="saved-item-story-body" id="sis-body-\${sid}"></div>
    </div>
  </div>\`;
}
// Alias for live-server compatibility
function savedItemHtml(s, connector) { return itemHtml(s, connector); }

async function loadSavedList() {
  // Seed storylines: baked-in titles + localStorage overrides
  let _lsOverrides = {};
  try { _lsOverrides = JSON.parse(localStorage.getItem('dz_storylines') || '{}'); } catch(e) {}
  // v29: STATIC_STORYLINES is an array; legacy: object
  APP.storylines = Array.isArray(STATIC_STORYLINES)
    ? STATIC_STORYLINES
    : Object.assign({}, STATIC_STORYLINES, _lsOverrides);
  const saved = STATIC_LESSONS;
  APP.savedList = saved;  // needed by buildPath for cont-nav "continued in" links
  // Sync main selectors to current filter state
  const _srcSel=document.getElementById('src-lang-select');
  const _tgtSel=document.getElementById('lang-select');
  if(_srcSel) _srcSel.value=APP.libSrcFilter||'all';
  if(_tgtSel) _tgtSel.value=APP.libFilter||'all';

  const filtered=saved.filter(s=>{
    if(APP.libFilter!=='all' && (s.lang||'it')!==APP.libFilter) return false;
    if(APP.libSrcFilter!=='all' && (s.srcLang||'en')!==APP.libSrcFilter) return false;
    return true;
  });
  document.getElementById('lib-cnt').textContent=
    filtered.length+' of '+saved.length+' topic'+(saved.length!==1?'s':'');
  const list=document.getElementById('saved-list');
  if(!filtered.length){
    list.innerHTML='<div class="lib-empty">'+(saved.length?'No lessons in this language.':'No lessons available.')+'</div>';
    return;
  }

  // Build display chains — v29: use STATIC_STORYLINES array; legacy: continuedFrom
  const byTopic=Object.fromEntries(filtered.map(l=>[l.topic,l]));
  const byId=Object.fromEntries(filtered.filter(l=>l.id).map(l=>[l.id,l]));
  let storylines, orphans;
  const _slArr=Array.isArray(STATIC_STORYLINES)?STATIC_STORYLINES:[];
  const v29chains=_slArr.filter(sl=>sl.chapters&&sl.chapters.length>1);
  if(v29chains.length>0){
    storylines=v29chains.map(sl=>sl.chapters.map(cid=>byId[cid]?.topic||null).filter(Boolean)).filter(c=>c.length>1);
    const inChain=new Set(storylines.flat());
    orphans=filtered.filter(l=>!inChain.has(l.topic));
  } else {
    const childMap={};
    filtered.forEach(l=>{
      if(l.continuedFrom&&byTopic[l.continuedFrom])
        (childMap[l.continuedFrom]=childMap[l.continuedFrom]||[]).push(l.topic);
    });
    const hasParent=new Set(filtered.filter(l=>l.continuedFrom&&byTopic[l.continuedFrom]).map(l=>l.topic));
    const chains=[];
    function walk(topic,chain){
      const ext=[...chain,topic],kids=childMap[topic]||[];
      if(!kids.length){chains.push(ext);return;}
      kids.forEach(k=>walk(k,ext));
    }
    filtered.filter(l=>!hasParent.has(l.topic)).forEach(r=>walk(r.topic,[]));
    storylines=chains.filter(c=>c.length>1);
    const inChain=new Set(storylines.flat());
    orphans=filtered.filter(l=>!inChain.has(l.topic));
  }



  const newestOf=chain=>chain.reduce((b,t)=>{const d=byTopic[t]?.updatedAt||byTopic[t]?.generatedAt||'';return d>b?d:b;},'');
  storylines.sort((a,b)=>newestOf(b).localeCompare(newestOf(a)));
  const showAllLangs = APP.libFilter==='all';
  // When showing all languages, group storylines by language
  if(showAllLangs) storylines.sort((a,b)=>{
    const la=byTopic[a[0]]?.lang||'it', lb=byTopic[b[0]]?.lang||'it';
    return la.localeCompare(lb) || newestOf(b).localeCompare(newestOf(a));
  });

  const _slArr2=Array.isArray(STATIC_STORYLINES)?STATIC_STORYLINES:[];
  const slTitles=_slArr2.length
    ? Object.fromEntries(_slArr2.map(sl=>[sl.id,sl]))
    : (STATIC_STORYLINES||{});
  let html='', _lastLang=null;
  for(const chain of storylines){
    if(showAllLangs){
      const cl=byTopic[chain[0]]?.lang||'it';
      if(cl!==_lastLang){
        const L=LANGS[cl]||LANGS.it;
        html+='<div class="orphans-hdr">'+L.flag+' '+L.name+'</div>';
        _lastLang=cl;
      }
    }
    const chainTopics=chain.map(t=>byTopic[t]?.topic).filter(Boolean);
    const chainTopicsJson=JSON.stringify(chainTopics);
    const chainEncoded=encodeURIComponent(chainTopicsJson);
    const legacyChainId='c'+Math.abs(chainTopicsJson.split('').reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0));
    // v29: find storyline by matching chain topics via id; legacy: by hash
    const matchSl2=_slArr2.find(sl=>{
      const slt=(sl.chapters||[]).map(cid=>byId[cid]?.topic||null).filter(Boolean);
      return slt.length&&slt.every((t,i)=>t===chainTopics[i])&&slt.length===chainTopics.length;
    });
    const resolvedSlId=matchSl2?.id||legacyChainId;
    const chainId=resolvedSlId;
    const slMeta=matchSl2||slTitles[chainId]||slTitles['root:'+chainTopics[0]]||null;
    const hasTitle=!!(slMeta&&slMeta.title);
    const titleIcon=slMeta?.icon||'📖';
    const titleText=slMeta?.title||'';
    const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const escapedRoot=chainId;
    const chainNewest=newestOf(chain);
    const chainDate=chainNewest?new Date(chainNewest).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'';
    const hdrTitle=hasTitle
      ? '<span class="storyline-title" style="cursor:pointer;flex:1"><span style="font-size:18px">'+titleIcon+'</span><div style="min-width:0"><div class="storyline-title-text">'+esc(titleText)+'</div><div class="storyline-title-sub">'+(()=>{const first=byTopic[chain[0]];const tL2=LANGS[first?.lang||'it']||LANGS.it;const sL2=LANGS[first?.srcLang||'en']||{flag:"🇬🇧"};return '<span class="lang-pair-badge" style="font-size:10px">'+sL2.flag+'→'+tL2.flag+'</span> ';})()+chain.length+' chapter'+(chain.length!==1?'s':'')+(chainDate?' · '+chainDate:'')+'</div></div></span>'
      : '<span class="storyline-title" style="flex:1">'+(()=>{const first=byTopic[chain[0]];const tL2=LANGS[first?.lang||'it']||LANGS.it;const sL2=LANGS[first?.srcLang||'en']||{flag:"🇬🇧"};return '<span class="lang-pair-badge">'+sL2.flag+'→'+tL2.flag+'</span>';})()+'<span class="storyline-title-sub">Story line · '+chain.length+' chapter'+(chain.length!==1?'s':'')+(chainDate?' · '+chainDate:'')+'</span></span>';
    html+='<div class="storyline-group" id="slgroup-'+chainId+'">';
    html+='<div class="storyline-hdr" id="slhdr-'+chainId+'"'
      +' data-chain-id="'+chainId+'" data-chain="'+chainEncoded+'"'
      +' style="cursor:pointer" onclick="openStorylineScreen(this.dataset.chainId,this.dataset.chain)">'+hdrTitle
      +'<button class="ico-btn export" style="font-size:11px;padding:2px 8px" title="Export full story line"'
      +' data-chain="'+chainEncoded+'"'
      +' onclick="event.stopPropagation();exportTopics(JSON.parse(decodeURIComponent(this.dataset.chain)))">⬇</button>'
      +'<button class="ico-btn" style="font-size:11px;padding:2px 8px" title="Share storyline link"'
      +' data-chain-id="'+chainId+'"'
      +' onclick="event.stopPropagation();shareStorylineById(this.dataset.chainId)">🔗</button>'
      +'<button class="ico-btn export" style="font-size:11px;padding:2px 8px" title="Export full story line"'
      +' data-chain="'+chainEncoded+'"'
      +' onclick="event.stopPropagation();exportTopics(JSON.parse(decodeURIComponent(this.dataset.chain)))">⬇</button>'
      +'</div>';
    // Read summary strip if stored
    const _slSumMeta2=matchSl2||slTitles[chainId]||null;
    const _slSum2=_slSumMeta2?.summary||'';
    if(_slSum2){
      html+='<div class="storyline-story" id="slsum-wrap-'+chainId+'">'
        +'<button class="storyline-story-hdr" data-cid="'+chainId+'" onclick="event.stopPropagation();toggleSlSummary(this.dataset.cid)">'
        +'📖 Read summary<span class="storyline-story-arrow" id="slsc-summary-arrow-'+chainId+'">▼</span></button>'
        +'<div class="storyline-story-body" id="slsc-summary-body-'+chainId+'" style="display:none">'
        +'<p style="font-size:14px;line-height:1.6;margin:0;color:var(--text)">'+_slSum2.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</p>'
        +'</div></div>';
    }
    html+='</div>';
  }
  if(orphans.length){
    if(showAllLangs){
      let _oLang=null;
      orphans.sort((a,b)=>(a.lang||'it').localeCompare(b.lang||'it')||(b.updatedAt||b.generatedAt||'').localeCompare(a.updatedAt||a.generatedAt||''));
      orphans.forEach(s=>{
        const sl=s.lang||'it';
        if(sl!==_oLang){const L=LANGS[sl]||LANGS.it;html+='<div class="orphans-hdr">'+L.flag+' '+L.name+'</div>';_oLang=sl;}
        html+=itemHtml(s,false);
      });
    } else {
      if(storylines.length) html+='<div class="orphans-hdr">📚 Individual lessons</div>';
      html+=orphans.map(s=>itemHtml(s,false)).join('');
    }
  }
  list.innerHTML=html||'<div class="lib-empty">No lessons available.</div>';
  repopulateContinueSelect();
}

function setLibFilter(lang){
  if(lang==='all'){ APP.libFilter='all'; APP.libSrcFilter='all'; }
  else { APP.libFilter=lang; }
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
  'async function doGenerate(){}',
  'async function submitRating(){}',
  '// In static mode, UI strings are baked in — no translation needed',
  'function triggerUITranslation(){}',
  '// Static: globe resets filter; any other value sets filter + lang',
  'function selectSrcLang(code){',
  '  if(code==="all"){ APP.libSrcFilter="all"; const sel=document.getElementById("src-lang-select"); if(sel) sel.value="all"; loadSavedList(); return; }',
  '  APP.srcLang=code; saveSrcLang(); APP.libSrcFilter=code;',
  '  const sel=document.getElementById("src-lang-select"); if(sel&&sel.value!==code) sel.value=code;',
  '  loadUIStrings(code).then(()=>loadSavedList());',
  '}',
  'function selectLang(code, silent){',
  '  if(code==="all"){ APP.libFilter="all"; const sel=document.getElementById("lang-select"); if(sel) sel.value="all"; loadSavedList(); return; }',
  '  APP.lang=code; APP.libFilter=code; saveLang();',
  '  const sel=document.getElementById("lang-select"); if(sel&&sel.value!==code) sel.value=code;',
  '  const tb=document.getElementById("lang-tutor-banner");',
  '  if(tb){ if(code==="de"){ tb.innerHTML=t("lang.tutor_de_html"); tb.style.display=""; } else tb.style.display="none"; }',
  '  if(!silent) loadSavedList();',
  '}',
  'function setLibFilter(lang){',
  '  if(lang==="all"){ APP.libFilter="all"; APP.libSrcFilter="all"; }',
  '  else { APP.libFilter=lang; }',
  '  loadSavedList();',
  '}',
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
  '  const vocabWords=(d.lessons||[]).flatMap(L=>L.vocab||[]).map(v=>v.target).filter(Boolean).sort((a,b)=>b.length-a.length);',
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
  // Flagged-lesson banner — never show in static build (no server flags baked in)
  'function downloadFlaggedLessons(){}',

  // C4: disable storyline title editing in static
  'function openStorylineEdit(){}',

  // Storyline title stubs — must be AFTER part2 to override live server versions
  'function _slSave(){ try{ localStorage.setItem(\'dz_storylines\',JSON.stringify(APP.storylines||{})); }catch(e){} }',
  'async function saveStorylineTitle(chainId,rootTopic){',
  '  const title=document.getElementById(\'sledit-input-\'+chainId).value.trim();',
  '  const icon=document.getElementById(\'sledit-icon-\'+chainId).textContent.trim();',
  '  if(!title)return;',
  '  APP.storylines=APP.storylines||{};',
  '  APP.storylines[rootTopic]={title,icon};',
  '  // Also store under root alias so title survives new chapters',
  '  const _rt=(APP.savedList||[]).find(l=>l.topic&&\'c\'+Math.abs(JSON.stringify([l.topic]).split(\'\').reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0))===chainId)?.topic;',
  '  if(_rt) APP.storylines[\'root:\'+_rt]={title,icon};',
  '  _slSave(); closeStorylineEdit(chainId); await loadSavedList();',
  '}',
  'async function clearStorylineTitle(chainId,rootTopic){',
  '  APP.storylines=APP.storylines||{};',
  '  delete APP.storylines[rootTopic];',
  '  _slSave(); closeStorylineEdit(chainId); await loadSavedList();',
  '}',
  'async function genStorylineTitle(chainId,rootTopic){ alert(\'Title generation requires the live server. Use ✏️ to enter manually.\'); }',
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
const newScript = [uiScript, part1, staticFunctions, part2, staticOverrides, '\ninit();'].join('\n');
const output    = [htmlBefore, newScript, htmlAfter].join('');
fs.writeFileSync(outputFile, output, 'utf8');

// ── Report ─────────────────────────────────────────────────────────────
const LANG_NAMES = {
  target:'Italian',fr:'French',de:'German',es:'Spanish',pt:'Portuguese',
  nl:'Dutch',pl:'Polish',sv:'Swedish',ja:'Japanese',zh:'Mandarin',
  ar:'Arabic',ru:'Russian',ko:'Korean',tr:'Turkish',hi:'Hindi',
};
const langSummary = langCodes.map(c => LANG_NAMES[c]||c).join(', ');
const topicLines  = lessonsData.lessons.map(l => {
  const flag = {target:'🇮🇹',fr:'🇫🇷',de:'🇩🇪',es:'🇪🇸',pt:'🇵🇹',
                nl:'🇳🇱',pl:'🇵🇱',sv:'🇸🇪',ja:'🇯🇵',zh:'🇨🇳',
                ar:'🇸🇦',ru:'🇷🇺',ko:'🇰🇷',tr:'🇹🇷',hi:'🇮🇳',lb:'🇱🇺'}[l.lang||'it']||'🌐';
  return `  • ${flag} ${l.topicEmoji||'📚'} ${l.topic}`;
}).join('\n');

console.log('');
console.log('✅  Static build complete');
console.log(`    Source    : ${sourceHtml}`);
console.log(`    Lessons   : ${lessonsFile} (${topicCount} topic${topicCount!==1?'s':''})`);
console.log(`    Flagged   : ${removedCount} flagged exercise${removedCount!==1?'s':''} stripped from baked lessons`);
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
