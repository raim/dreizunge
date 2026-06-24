#!/usr/bin/env node
// report-edits.js — temporal edit/activity report for a Dreizunge lessons.json.
//
//   node report-edits.js [lessons.json] [options]
//
// Options:
//   --out FILE      write to FILE (extension .html → HTML, else markdown). Default: stdout (markdown)
//   --html          force HTML output (to stdout or --out)
//   --since ISO     only events at/after this ISO timestamp (e.g. 2026-06-01)
//   --limit N       keep only the N most-recent events (default: all)
//   --kinds LIST    comma-separated subset of: storyline,chapter,lesson,question,flag
//
// Zero dependencies (pure Node), matching the project ethos. Reads recorded
// timestamps already in the store (createdAt/updatedAt on storylines,
// generatedAt/updatedAt on chapters/topics, _genMeta.at on lessons, editedAt and
// userFlag.at on questions, and flaggedAt on the legacy global flag store) and
// emits a single most-recent-first activity log. It records nothing new — it only
// surfaces what edits/generation already stamped.

'use strict';

const KINDS = ['storyline', 'chapter', 'lesson', 'question', 'flag'];

// ── helpers ───────────────────────────────────────────────────────────────
function ts(v) { return (typeof v === 'string' || typeof v === 'number') ? v : null; }
function snippet(s, n = 60) {
  s = (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function pair(o) { // "en←de" target←source label
  const l = o && o.lang, s = o && o.srcLang;
  return (l || s) ? ` (${l || '?'}←${s || '?'})` : '';
}

// The content arrays a lesson may hold; each element is a "question"/item.
const ITEM_ARRAYS = ['vocab', 'sentences', 'words', 'items', 'conjugations', 'pairs', 'questions'];

// ── core: build the flat, sortable event list ───────────────────────────────
function collectEvents(store, opts = {}) {
  const events = [];
  const push = (when, kind, action, loc, detail) => {
    const t = ts(when);
    if (!t) return;
    events.push({
      ts: t, kind, action,
      storyline:  (loc && loc.storyline)  || '',
      chapter:    (loc && loc.chapter)    || '',
      lessonType: (loc && loc.lessonType) || '',
      question:   (loc && loc.question)   || '',
      detail: detail || '',
    });
  };

  const storylines = Array.isArray(store && store.storylines) ? store.storylines : [];
  const topics = Array.isArray(store && store.topics) ? store.topics : [];

  // chapter-id → owning storyline (chapters are an ordered list of topic ids)
  const slOfChapter = {};
  storylines.forEach(sl => (sl.chapters || []).forEach(cid => { slOfChapter[cid] = sl; }));

  // 1) Storylines
  storylines.forEach(sl => {
    const name = `“${snippet(sl.title || sl.id, 40)}”${pair(sl)}`;
    push(sl.createdAt, 'storyline', 'created', { storyline: name });
    if (sl.updatedAt && sl.updatedAt !== sl.createdAt)
      push(sl.updatedAt, 'storyline', 'updated', { storyline: name });
  });

  // 2) Chapters (topics / lesson-sets) + 3) lessons + 4) questions inside them
  topics.forEach(tp => {
    const sl = slOfChapter[tp.id];
    const slName = sl ? `“${snippet(sl.title || sl.id, 30)}”` : '(standalone)';
    const chName = `“${snippet(tp.topic || tp.id, 40)}”${pair(tp)}`;
    const chShort = `“${snippet(tp.topic || tp.id, 30)}”`;
    push(tp.generatedAt, 'chapter', 'generated', { storyline: slName, chapter: chName });
    if (tp.updatedAt && tp.updatedAt !== tp.generatedAt)
      push(tp.updatedAt, 'chapter', 'updated', { storyline: slName, chapter: chName });

    (tp.lessons || []).forEach(ls => {
      const lsName = `${ls.type || 'standard'} “${snippet(ls.title || '', 30)}”`;
      const gm = ls._genMeta;
      if (gm && gm.at)
        push(gm.at, 'lesson', 'generated',
          { storyline: slName, chapter: chShort, lessonType: lsName },
          gm.model ? `model ${gm.model}` : '');

      // questions / items
      ITEM_ARRAYS.forEach(arr => {
        (Array.isArray(ls[arr]) ? ls[arr] : []).forEach(it => {
          if (!it || typeof it !== 'object') return;
          const content = snippet(it.target || it.base || it.q || it.source || it.word || it.prompt || '', 50);
          const loc = { storyline: slName, chapter: chShort, lessonType: lsName, question: `[${content}]` };
          if (it.editedAt) push(it.editedAt, 'question', 'edited', loc);
          if (it.userFlag && it.userFlag.at)
            push(it.userFlag.at, 'flag', 'flagged', loc,
              snippet(it.userFlag.comment || '', 80));
          // forward-compatible: a rating timestamp if a rating system adds one
          if (it.userRating && it.userRating.at)
            push(it.userRating.at, 'question', 'rated', loc, '⭐ good example');
        });
      });
    });
  });

  // 5) Legacy global flag store (keyed map of past flags)
  const flags = store && store.flags;
  if (flags && typeof flags === 'object') {
    Object.keys(flags).forEach(k => {
      const f = flags[k]; if (!f || typeof f !== 'object') return;
      push(f.flaggedAt, 'flag', 'flagged',
        { chapter: f.topic ? `“${snippet(f.topic, 30)}”` : '', question: `[${snippet(f.target || k, 50)}]` },
        snippet(f.comment || '', 80));
    });
  }

  // filter + sort (most recent first) + limit
  let out = events;
  if (opts.since) out = out.filter(e => String(e.ts) >= String(opts.since));
  if (opts.kinds && opts.kinds.length) {
    const set = new Set(opts.kinds);
    out = out.filter(e => set.has(e.kind));
  }
  out.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0)); // desc
  if (opts.limit && opts.limit > 0) out = out.slice(0, opts.limit);
  return out;
}

// ── rendering ───────────────────────────────────────────────────────────────
const ACTION_ICON = { created: '✨', generated: '🛠️', updated: '✏️', edited: '✏️', flagged: '🚩', rated: '⭐' };

function fmtTime(t) { // compact, readable; keep ISO if unparseable
  const d = new Date(t);
  if (isNaN(d.getTime())) return String(t);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function summarize(events) {
  const byKind = {};
  events.forEach(e => { byKind[e.kind] = (byKind[e.kind] || 0) + 1; });
  return byKind;
}

function renderMarkdown(events, meta = {}) {
  const lines = [];
  lines.push('# Dreizunge — edit & activity report');
  lines.push('');
  lines.push(`Generated ${fmtTime(new Date().toISOString())} UTC · ${events.length} event(s)` +
    (meta.source ? ` · source \`${meta.source}\`` : ''));
  const sum = summarize(events);
  lines.push('');
  lines.push('Counts by kind: ' + (Object.keys(sum).length
    ? Object.keys(sum).sort().map(k => `${k} ${sum[k]}`).join(' · ') : '(none)'));
  lines.push('');
  lines.push('| When (UTC) | Storyline | Chapter | Lessonset type | Question | Action | Detail |');
  lines.push('|---|---|---|---|---|---|---|');
  events.forEach(e => {
    const cell = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    lines.push(`| ${fmtTime(e.ts)} | ${cell(e.storyline)} | ${cell(e.chapter)} | ${cell(e.lessonType)} | ${cell(e.question)} | ${ACTION_ICON[e.action] || ''} ${e.action} | ${cell(e.detail)} |`);
  });
  lines.push('');
  return lines.join('\n');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHtml(events, meta = {}) {
  const sum = summarize(events);
  const rows = events.map(e =>
    `<tr class="k-${esc(e.kind)}"><td class="t" data-sort="${esc(e.ts)}">${esc(fmtTime(e.ts))}</td>` +
    `<td>${esc(e.storyline)}</td>` +
    `<td>${esc(e.chapter)}</td>` +
    `<td>${esc(e.lessonType)}</td>` +
    `<td>${esc(e.question)}</td>` +
    `<td class="a" data-sort="${esc(e.action)}">${ACTION_ICON[e.action] || ''} ${esc(e.action)}</td>` +
    `<td class="d">${esc(e.detail)}</td></tr>`).join('\n');
  // Small colour legend, only for the kinds actually present (each tr.k-* has a tint).
  const KIND_ORDER = ['storyline', 'chapter', 'lesson', 'question', 'flag'];
  const legendItems = KIND_ORDER.filter(k => sum[k]).map(k =>
    `<span class="sw"><span class="box k-${k}"></span>${esc(k)}&nbsp;${sum[k]}</span>`).join('');
  const legend = legendItems ? `<div class="legend">Row colour: ${legendItems}</div>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Dreizunge — edit & activity report</title>
<style>
 body{font-family:system-ui,Segoe UI,Roboto,sans-serif;margin:24px;color:#222;background:#fafafa}
 h1{font-size:20px;margin:0 0 4px} .meta{color:#666;font-size:13px;margin-bottom:16px}
 table{border-collapse:collapse;width:100%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}
 th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;vertical-align:top}
 th{background:#f0f0f3;position:sticky;top:0;cursor:pointer;user-select:none;white-space:nowrap} td.t{white-space:nowrap;color:#555;font-variant-numeric:tabular-nums}
 th[aria-sort=ascending]::after{content:" \\25B2";font-size:10px;color:#888} th[aria-sort=descending]::after{content:" \\25BC";font-size:10px;color:#888}
 td.a{white-space:nowrap} td.d{color:#666}
 tr.k-storyline{background:#f3f8ff} tr.k-chapter{background:#fffaf2}
 tr.k-flag{background:#fff3f3} tr.k-lesson td:first-child{border-left:3px solid #ddd}
 .legend{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:0 0 14px;font-size:12px;color:#555}
 .legend .sw{display:inline-flex;align-items:center;gap:5px}
 .legend .box{width:14px;height:14px;border:1px solid #ccc;border-radius:3px;box-sizing:border-box}
 .legend .box.k-storyline{background:#f3f8ff} .legend .box.k-chapter{background:#fffaf2}
 .legend .box.k-flag{background:#fff3f3} .legend .box.k-lesson{background:#fff;border-left:3px solid #ddd}
 .legend .box.k-question{background:#fff}
</style></head><body>
<h1>Dreizunge — edit &amp; activity report</h1>
<div class="meta">Generated ${esc(fmtTime(new Date().toISOString()))} UTC · ${events.length} event(s)${meta.source ? ` · source <code>${esc(meta.source)}</code>` : ''}</div>
${legend}
<table><thead><tr><th>When (UTC)</th><th>Storyline</th><th>Chapter</th><th>Lessonset type</th><th>Question</th><th>Action</th><th>Detail</th></tr></thead>
<tbody>
${rows}
</tbody></table>
<script>
// Click a column header to sort the table by that column (toggles asc/desc). Vanilla,
// zero-dependency. Time/Action cells carry a data-sort key so they sort by raw value.
(function(){
  var table = document.querySelector('table'); if(!table || !table.tHead) return;
  var tbody = table.tBodies[0], ths = table.tHead.rows[0].cells, cur = -1, dir = 1;
  function key(tr, i){ var td = tr.cells[i]; if(!td) return ''; var d = td.getAttribute('data-sort'); return d != null ? d : td.textContent.trim(); }
  function sortBy(col){
    dir = (col === cur) ? -dir : 1; cur = col;
    var rows = [].slice.call(tbody.rows);
    rows.sort(function(a, b){
      var x = key(a, col), y = key(b, col);
      var nx = +x, ny = +y, num = x !== "" && y !== "" && !isNaN(nx) && !isNaN(ny);
      var c = num ? (nx - ny) : x.toLowerCase().localeCompare(y.toLowerCase());
      return c * dir;
    });
    rows.forEach(function(r){ tbody.appendChild(r); });
    for(var i = 0; i < ths.length; i++) ths[i].setAttribute("aria-sort", i === col ? (dir > 0 ? "ascending" : "descending") : "none");
  }
  for(var i = 0; i < ths.length; i++){ (function(i){ ths[i].setAttribute("aria-sort","none"); ths[i].title = "Sort by this column"; ths[i].addEventListener("click", function(){ sortBy(i); }); })(i); }
})();
</script>
</body></html>`;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const o = { file: 'lessons.json', out: null, html: false, since: null, limit: 0, kinds: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i];
    else if (a === '--html') o.html = true;
    else if (a === '--since') o.since = argv[++i];
    else if (a === '--limit') o.limit = parseInt(argv[++i], 10) || 0;
    else if (a === '--kinds') o.kinds = String(argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '-h' || a === '--help') o.help = true;
    else if (!a.startsWith('-')) o.file = a;
  }
  return o;
}

if (require.main === module) {
  const fs = require('fs');
  const o = parseArgs(process.argv.slice(2));
  if (o.help) {
    process.stdout.write(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 16).join('\n') + '\n');
    process.exit(0);
  }
  let store;
  try { store = JSON.parse(fs.readFileSync(o.file, 'utf8')); }
  catch (e) { console.error(`report-edits: cannot read ${o.file}: ${e.message}`); process.exit(1); }
  const events = collectEvents(store, { since: o.since, limit: o.limit, kinds: o.kinds });
  const wantHtml = o.html || (o.out && /\.html?$/i.test(o.out));
  const text = wantHtml ? renderHtml(events, { source: o.file }) : renderMarkdown(events, { source: o.file });
  if (o.out) { fs.writeFileSync(o.out, text); console.error(`report-edits: wrote ${events.length} event(s) → ${o.out}`); }
  else process.stdout.write(text);
}

module.exports = { collectEvents, renderMarkdown, renderHtml, summarize, KINDS };
