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
  console.error('Error: index.html not found at', sourceHtml);
  process.exit(1);
}
if (!fs.existsSync(lessonsFile)) {
  console.error('Error: lessons file not found at', lessonsFile);
  process.exit(1);
}

let lessonsData;
try {
  lessonsData = JSON.parse(fs.readFileSync(lessonsFile, 'utf8'));
} catch(e) {
  console.error('Error: could not parse', lessonsFile, '—', e.message);
  process.exit(1);
}

if (!Array.isArray(lessonsData.lessons) || lessonsData.lessons.length === 0) {
  console.error('Error: lessons.json has no lessons array or it is empty.');
  process.exit(1);
}

const topicCount = lessonsData.lessons.length;

// ── Ensure output directory ───────────────────────────────────────────
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// ── Parse index.html into parts ───────────────────────────────────────
const src = fs.readFileSync(sourceHtml, 'utf8');

const SCRIPT_OPEN  = '<script>';
const SCRIPT_CLOSE = '</script>';
const scriptOpenIdx  = src.indexOf(SCRIPT_OPEN) + SCRIPT_OPEN.length;
const scriptCloseIdx = src.lastIndexOf(SCRIPT_CLOSE);

const htmlBefore = src.slice(0, scriptOpenIdx);
const htmlAfter  = src.slice(scriptCloseIdx);
const script     = src.slice(scriptOpenIdx, scriptCloseIdx);
const lines      = script.split('\n');

// Find split points by content markers
function findLine(marker, fromLine) {
  const start = fromLine || 0;
  const idx = lines.findIndex((l, i) => i >= start && l.trim().startsWith(marker));
  if (idx < 0) throw new Error(`Marker not found: "${marker}"`);
  return idx;
}

const serverFuncsStart = findLine('async function init()');  // first server-talking function
const engineStart      = findLine('function shuffle(');       // start of pure exercise engine
const initCallLine     = findLine('init();', engineStart);    // final init() call

// Script parts:
//   part1: APP state + tiny utils (loadProg, saveProg, show, goLanding, goHome)
//   [INJECT static replacements here]
//   part2: pure exercise engine (shuffle..confirmQuit)
//   [INJECT init() call]
const part1 = lines.slice(0, serverFuncsStart).join('\n');
const part2 = lines.slice(engineStart, initCallLine).join('\n');

// ── Static replacement functions ──────────────────────────────────────
const lessonsSerialized = JSON.stringify(lessonsData.lessons, null, 2);

const staticFunctions = `
// ═══════════════════════════════════════════════════════════════════════
//  STATIC MODE — no server, all lessons baked in at build time
// ═══════════════════════════════════════════════════════════════════════

const STATIC_LESSONS = ${lessonsSerialized};

// localStorage: store progress and the saved-lessons list
const LS_SAVED = 'imp_static_saved';

function staticGetSaved() {
  try { return JSON.parse(localStorage.getItem(LS_SAVED) || '[]'); }
  catch(_) { return []; }
}
function staticPutSaved(arr) {
  localStorage.setItem(LS_SAVED, JSON.stringify(arr));
}
function staticUpsert(data) {
  const arr = staticGetSaved();
  const k = data.topic.toLowerCase();
  const i = arr.findIndex(l => l.topic.toLowerCase() === k);
  const entry = { ...data, generatedAt: data.generatedAt || new Date().toISOString() };
  if (i >= 0) arr[i] = entry; else arr.unshift(entry);
  staticPutSaved(arr);
}

// Seed built-in lessons into localStorage on first visit
(function seedBuiltins() {
  const existing = staticGetSaved().map(l => l.topic.toLowerCase());
  for (const l of STATIC_LESSONS) {
    if (!existing.includes(l.topic.toLowerCase())) {
      staticUpsert(l);
    }
  }
})();

// ── Routing ───────────────────────────────────────────────────────────
async function init() {
  APP.info = { backend: 'none', canGenerate: false };
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
  const note = document.getElementById('offline-note');
  note.style.display = 'block';
  note.textContent = '📦 Static version — select a topic below to start';
}

async function loadSavedList() {
  const saved = staticGetSaved();
  document.getElementById('lib-cnt').textContent =
    saved.length + ' topic' + (saved.length !== 1 ? 's' : '');
  const list = document.getElementById('saved-list');
  if (!saved.length) {
    list.innerHTML = '<div class="lib-empty">No lessons available.</div>';
    return;
  }
  list.innerHTML = saved.map(s => {
    const count = s.lessons ? s.lessons.length : 0;
    const t = encodeURIComponent(s.topic);
    return \`<div class="saved-item" onclick="loadSaved('\${t}')">
      <span class="saved-emoji">\${s.topicEmoji || '📚'}</span>
      <div class="saved-info">
        <div class="saved-topic">\${s.topic}</div>
        <div class="saved-meta">\${count} lesson\${count !== 1 ? 's' : ''}</div>
      </div>
    </div>\`;
  }).join('');
}

async function loadSaved(topic) {
  const dec = decodeURIComponent(topic);
  const found = staticGetSaved().find(l => l.topic.toLowerCase() === dec.toLowerCase());
  if (!found) { alert('Lesson not found.'); return; }
  APP.lessonData = found;
  goHome();
}

// Disabled in static mode
async function deleteSaved()  {}
async function regenSaved()   {}
function  regenCurrent()      {}
async function doGenerate()   {}
function  setTopic(t) {
  document.getElementById('topic-input').value = t;
}
`;

// ── Assemble final HTML ───────────────────────────────────────────────
const newScript = [part1, staticFunctions, part2, '\ninit();'].join('\n');
const output = [htmlBefore, newScript, htmlAfter].join('');
fs.writeFileSync(outputFile, output, 'utf8');

// ── Report ────────────────────────────────────────────────────────────
const topics = lessonsData.lessons.map(l => `  • ${l.topicEmoji || '📚'} ${l.topic}`).join('\n');
console.log('');
console.log('✅  Static build complete');
console.log(`    Source  : ${sourceHtml}`);
console.log(`    Lessons : ${lessonsFile} (${topicCount} topic${topicCount !== 1 ? 's' : ''})`);
console.log(`    Output  : ${outputFile}`);
console.log(`    Size    : ${(fs.statSync(outputFile).size / 1024).toFixed(1)} KB`);
console.log('');
console.log('    Topics bundled:');
console.log(topics);
console.log('');
console.log('    To deploy on GitHub Pages:');
console.log('    1. Run this script whenever lessons.json changes');
console.log('    2. git add docs/index.html && git commit && git push');
console.log('    3. In repo Settings → Pages → Source: branch=main, folder=/docs');
console.log('    4. Live at: https://<user>.github.io/<repo>/');
console.log('');
