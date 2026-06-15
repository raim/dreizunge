#!/usr/bin/env node
/*
 * export-lessons.js — export selected storylines and single topics as a
 * Markdown (or HTML) "book", where each topic is a chapter (story + lessons).
 *
 * Usable two ways:
 *   • CLI:    node export-lessons.js <lessons.json> [--html] [--no-lessons] [--list] [--out f] [id ...]
 *   • module: const { buildExport, listExport } = require('./export-lessons');
 *             buildExport(store, { ids:[...], html:false, lessons:true }) -> { content, ext, mime, ... }
 *
 * ids:  sl_…  (a storyline, expanded to its chapters in order)
 *       tp_…  (a single topic / chapter)
 *       (none) → all storylines, in file order
 */
'use strict';
const fs = require('fs');

// ── furigana stripping (mirror of the client's stripFuri) ──
const KANJI = '\\u4e00-\\u9fff\\u3400-\\u4dbf々〆〇';
function stripFuri(text) {
  if (!text) return '';
  text = String(text).replace(new RegExp('([^' + KANJI + '])\\[[^\\]]+\\]', 'g'), '$1');
  return text.replace(new RegExp('([' + KANJI + ']+)\\[([^\\]]+)\\]', 'g'), '$1');
}
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── selection → documents ──
function _indexes(store) {
  const topics = store.topics || store.lessons || [];
  const storylines = store.storylines || [];
  return { topics, storylines, byId: new Map(topics.map(t => [t.id, t])), byName: new Map(topics.map(t => [t.topic, t])) };
}
function _slDoc(sl, byId) {
  const chapters = (sl.chapters || []).map(c => byId.get(c)).filter(Boolean);
  return { title: sl.title || (chapters[0] && chapters[0].topic) || 'Storyline', icon: sl.icon || '📖', chapters };
}
function resolveDocs(store, ids) {
  const { storylines, byId, byName } = _indexes(store);
  const docs = [];
  if (!ids || !ids.length) {
    for (const sl of storylines) docs.push(_slDoc(sl, byId));
  } else {
    for (const id of ids) {
      if (String(id).startsWith('sl_')) {
        const sl = storylines.find(s => s.id === id);
        if (sl) docs.push(_slDoc(sl, byId));
      } else {
        const t = byId.get(id) || byName.get(id);
        if (t) docs.push({ title: t.topic, icon: t.topicEmoji || '', chapters: [t] });
      }
    }
  }
  return docs;
}

// ── render helpers (shared shape, two outputs) ──
function chapterParts(t, includeLessons) {
  const story = stripFuri(t.story || '').trim();
  const lessons = [];
  if (includeLessons) {
    for (const ls of (t.lessons || [])) {
      const blocks = [];
      if (Array.isArray(ls.vocab) && ls.vocab.length)
        blocks.push({ kind: 'vocab', items: ls.vocab.map(v => [stripFuri(v.source ?? v.word ?? v.target), v.target ?? v.translation ?? '']) });
      if (Array.isArray(ls.sentences) && ls.sentences.length)
        blocks.push({ kind: 'sentences', items: ls.sentences.map(s => [stripFuri(s.source ?? s.target), s.target ?? '']) });
      if (Array.isArray(ls.grammar) && ls.grammar.length)
        blocks.push({ kind: 'grammar', items: ls.grammar.map(g => [stripFuri(g.point ?? g.title ?? g.rule ?? ''), g.explanation ?? g.desc ?? g.example ?? ''].filter(Boolean)) });
      if (Array.isArray(ls.conjugations) && ls.conjugations.length)
        blocks.push({ kind: 'conjugations', items: ls.conjugations.map(c => [stripFuri(c.verb ?? c.infinitive ?? ''), stripFuri(c.form ?? c.conjugated ?? ''), c.translation ?? c.pronoun ?? ''].filter(Boolean)) });
      if (blocks.length) lessons.push({ title: ls.title || 'Lesson', desc: ls.desc || '', blocks });
    }
  }
  return { story, lessons };
}
function renderMarkdown(docs, includeLessons) {
  const out = [];
  for (const doc of docs) {
    out.push(`# ${doc.icon ? doc.icon + ' ' : ''}${doc.title}\n`);
    doc.chapters.forEach((t, i) => {
      out.push(`## ${i + 1}. ${t.topicEmoji ? t.topicEmoji + ' ' : ''}${t.topic}\n`);
      const { story, lessons } = chapterParts(t, includeLessons);
      if (story) out.push(story.split(/\n\n+/).map(p => p.trim()).filter(Boolean).join('\n\n') + '\n');
      for (const ls of lessons) {
        out.push(`### ${ls.title}`);
        if (ls.desc) out.push(`_${ls.desc}_\n`);
        for (const b of ls.blocks) {
          if (b.kind === 'vocab' || b.kind === 'sentences') {
            for (const [a, c] of b.items) out.push(`- **${a}**${c ? ' — ' + c : ''}`);
          } else {
            for (const row of b.items) out.push(`- ${row.join(' — ')}`);
          }
        }
        out.push('');
      }
    });
    out.push('\n---\n');
  }
  return out.join('\n');
}
function renderHtml(docs, includeLessons) {
  const body = [];
  for (const doc of docs) {
    body.push(`<h1>${esc((doc.icon ? doc.icon + ' ' : '') + doc.title)}</h1>`);
    doc.chapters.forEach((t, i) => {
      body.push(`<h2>${i + 1}. ${esc((t.topicEmoji ? t.topicEmoji + ' ' : '') + t.topic)}</h2>`);
      const { story, lessons } = chapterParts(t, includeLessons);
      if (story) for (const p of story.split(/\n\n+/)) if (p.trim()) body.push(`<p>${esc(p.trim())}</p>`);
      for (const ls of lessons) {
        body.push(`<h3>${esc(ls.title)}</h3>`);
        if (ls.desc) body.push(`<p class="desc">${esc(ls.desc)}</p>`);
        body.push('<ul>');
        for (const b of ls.blocks) {
          if (b.kind === 'vocab' || b.kind === 'sentences')
            for (const [a, c] of b.items) body.push(`<li><strong>${esc(a)}</strong>${c ? ' — ' + esc(c) : ''}</li>`);
          else for (const row of b.items) body.push(`<li>${esc(row.join(' — '))}</li>`);
        }
        body.push('</ul>');
      }
    });
  }
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(docs[0].title)}</title>
<style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 20px;line-height:1.7;color:#222}
h1{border-bottom:2px solid #ccc;padding-bottom:6px}h2{margin-top:1.6em}h3{color:#555}
.desc{color:#777;font-style:italic}ul{color:#333}strong{color:#111}</style></head>
<body>
${body.join('\n')}
</body></html>`;
}

// ── reusable API ──
function buildExport(store, opts) {
  opts = opts || {};
  const html = !!opts.html;
  const includeLessons = opts.lessons !== false;
  const docs = resolveDocs(store, opts.ids);
  if (!docs.length) return null;
  const content = html ? renderHtml(docs, includeLessons) : renderMarkdown(docs, includeLessons);
  const chapters = docs.reduce((n, d) => n + d.chapters.length, 0);
  return { content, html, ext: html ? 'html' : 'md',
    mime: html ? 'text/html' : 'text/markdown',
    title: docs[0].title, docCount: docs.length, chapters };
}
function listExport(store) {
  const { topics, storylines, byId } = _indexes(store);
  const inSl = new Set(storylines.flatMap(s => s.chapters || []));
  return {
    storylines: storylines.map(sl => ({ id: sl.id, icon: sl.icon || '', title: sl.title || '(untitled)',
      chapters: (sl.chapters || []).map(c => (byId.get(c) || {}).topic || c) })),
    orphans: topics.filter(t => !inSl.has(t.id)).map(t => ({ id: t.id, emoji: t.topicEmoji || '', topic: t.topic })),
  };
}

module.exports = { buildExport, listExport, resolveDocs, stripFuri };

// ── CLI ──
if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help') || argv.length === 0) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 15).join('\n').replace(/^ \* ?/gm, ''));
    process.exit(0);
  }
  const opt = { html: false, lessons: true, list: false, out: null, file: null };
  const ids = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a || !a.trim()) continue;
    if (a === '--html') opt.html = true;
    else if (a === '--no-lessons') opt.lessons = false;
    else if (a === '--list') opt.list = true;
    else if (a === '--out') opt.out = argv[++i];
    else if (a.endsWith('.json') && !opt.file) opt.file = a;
    else if (/^(sl_|tp_)/.test(a)) ids.push(a);
    else if (!opt.file) opt.file = a;
    else console.error('  (ignoring unrecognized arg: ' + a + ')');
  }
  if (!opt.file) { console.error('Error: no lessons.json path given.'); process.exit(1); }
  const store = JSON.parse(fs.readFileSync(opt.file, 'utf8'));
  if (opt.list) {
    const { storylines, orphans } = listExport(store);
    console.log('Storylines:');
    for (const sl of storylines) console.log(`  ${sl.id}  ${sl.icon} ${sl.title}  [${sl.chapters.join(' → ')}]`);
    if (orphans.length) { console.log('\nStandalone topics:'); for (const t of orphans) console.log(`  ${t.id}  ${t.emoji} ${t.topic}`); }
    process.exit(0);
  }
  const result = buildExport(store, { ids, html: opt.html, lessons: opt.lessons });
  if (!result) { console.error('Nothing to export.'); process.exit(1); }
  const outPath = opt.out || ('dreizunge-export.' + result.ext);
  fs.writeFileSync(outPath, result.content);
  console.log(`Exported ${result.docCount} document(s), ${result.chapters} chapter(s) → ${outPath}`);
}
