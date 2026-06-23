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

// ── error-hunt diff (ported from the client's ehTokenize/ehLcsOps) ──
function ehTokenize(text) {
  return (String(text || '').match(/[\w\u00C0-\u024F\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF'\u2019]+|[^\w\s'\u2019]/gu) || []);
}
function ehLcsOps(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const ops = []; let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) { ops.unshift({ type: 'eq', a: a[i - 1], b: b[j - 1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { ops.unshift({ type: 'ins', b: b[j - 1] }); j--; }
    else { ops.unshift({ type: 'del', a: a[i - 1] }); i--; }
  }
  const merged = [];
  for (let k = 0; k < ops.length; k++) {
    if (ops[k].type === 'del' && k + 1 < ops.length && ops[k + 1].type === 'ins') { merged.push({ type: 'sub', a: ops[k].a, b: ops[k + 1].b }); k++; }
    else merged.push(ops[k]);
  }
  return merged;
}
// Inline diff of `correct` vs `corrupted`, like the error-hunt editor: the WRONG
// (corrupted) word struck through, the CORRECT word highlighted. html=true → <del>/<ins>
// (styled by the export stylesheet); else Markdown (~~wrong~~ **correct**).
function ehDiff(correct, corrupted, html) {
  const ops = ehLcsOps(ehTokenize(correct || ''), ehTokenize(corrupted || ''));
  if (!ops.some(o => o.type !== 'eq')) return html ? esc(correct || '') : (correct || '');
  return ops.map(op => {
    if (op.type === 'eq')  return html ? esc(op.a) + ' ' : op.a + ' ';
    if (op.type === 'sub') return html ? `<del>${esc(op.b)}</del> <ins>${esc(op.a)}</ins> ` : `~~${op.b}~~ **${op.a}** `;
    if (op.type === 'del') return html ? `<ins>${esc(op.a)}</ins> ` : `**${op.a}** `;   // correct word the corruption dropped
    if (op.type === 'ins') return html ? `<del>${esc(op.b)}</del> ` : `~~${op.b}~~ `;    // extra wrong word the corruption added
    return '';
  }).join('').trim();
}
const TYPE_LABEL = {
  standard: 'Vocabulary', vocab: 'Vocabulary', grammar: 'Grammar', conjugation: 'Conjugation',
  synonyms: 'Synonyms & antonyms', word_forms: 'Word forms', error_hunt: 'Error hunt',
  ai_error_hunt: 'AI error hunt', math: 'Math', mixed: 'Mixed review',
};
// A short "type · difficulty · arc" descriptor for a lesson (the export's extra info).
function lessonMeta(ls, t) {
  const bits = [TYPE_LABEL[ls.type] || ls.type || 'Lesson'];
  const diff = ls.difficulty != null ? ls.difficulty : (t && t.difficulty);
  if (diff != null) bits.push('difficulty ' + diff);
  if (ls._arcMode) bits.push(ls._arcMode);                                  // reinforce / extend
  if (ls.vocabMode && ls.vocabMode !== 'neutral') bits.push(ls.vocabMode);
  return bits.join(' · ');
}

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
      if (Array.isArray(ls.sentences) && ls.sentences.length && ls.type !== 'ai_error_hunt')
        blocks.push({ kind: 'sentences', items: ls.sentences.map(s => [stripFuri(s.source ?? s.target), s.target ?? '']) });
      if (Array.isArray(ls.grammar) && ls.grammar.length)
        blocks.push({ kind: 'grammar', items: ls.grammar.map(g => [stripFuri(g.point ?? g.title ?? g.rule ?? ''), g.explanation ?? g.desc ?? g.example ?? ''].filter(Boolean)) });
      if (Array.isArray(ls.conjugations) && ls.conjugations.length)
        blocks.push({ kind: 'conjugations', items: ls.conjugations.map(c => [stripFuri(c.verb ?? c.infinitive ?? ''), stripFuri(c.form ?? c.conjugated ?? ''), c.translation ?? c.pronoun ?? ''].filter(Boolean)) });
      // Word forms: the blanked sentence, the correct form, and the translation.
      if (Array.isArray(ls.items) && ls.items.length && ls.type === 'word_forms')
        blocks.push({ kind: 'word_forms', items: ls.items.map(it => {
          const correct = Array.isArray(it.choices) ? it.choices[it.correctIndex] : '';
          return [stripFuri(it.sentence || ''), correct || '', it.translation || ''].filter((x, i) => i < 2 || x);
        }) });
      // Synonyms & antonyms: base word → its synonyms / antonyms.
      if (Array.isArray(ls.words) && ls.words.length && ls.type === 'synonyms')
        blocks.push({ kind: 'synonyms', items: ls.words.map(w => [
          stripFuri(w.base ?? w.word ?? ''),
          (w.synonyms || []).join(', '),
          (w.antonyms || []).length ? '↔ ' + (w.antonyms || []).join(', ') : '',
        ].filter((x, i) => i < 2 || x)) });
      // Error hunt: inline diff of the correct chapter story vs the corrupted version.
      if (ls.type === 'error_hunt' && ls.corruptedStory && story)
        blocks.push({ kind: 'eh', correct: story, corrupted: stripFuri(ls.corruptedStory) });
      // AI error hunt: each sentence the model altered, shown corrected vs the AI version.
      if (ls.type === 'ai_error_hunt' && Array.isArray(ls.sentences)) {
        const errs = ls.sentences
          .filter(s => s && s.ai && s.corrected && s.ai.trim() !== s.corrected.trim())
          .map(s => ({ correct: stripFuri(s.corrected), corrupted: stripFuri(s.ai), reason: s.reason || '' }));
        if (errs.length) blocks.push({ kind: 'aeh', items: errs });
      }
      // Include the lesson if it has any renderable content, OR if it is an error-hunt
      // type (so its presence + meta still show even when nothing diffed).
      if (blocks.length || ls.type === 'error_hunt' || ls.type === 'ai_error_hunt')
        lessons.push({ title: ls.title || 'Lesson', desc: ls.desc || '', meta: lessonMeta(ls, t), blocks });
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
        if (ls.meta) out.push('`' + ls.meta + '`\n');
        if (ls.desc) out.push(`_${ls.desc}_\n`);
        for (const b of ls.blocks) {
          if (b.kind === 'eh') {
            out.push('_Error hunt — ~~struck~~ = altered text · **bold** = correct:_\n');
            out.push(ehDiff(b.correct, b.corrupted, false) + '\n');
          } else if (b.kind === 'aeh') {
            for (const e of b.items) out.push(`- ${ehDiff(e.correct, e.corrupted, false)}${e.reason ? '  _(' + e.reason + ')_' : ''}`);
          } else if (b.kind === 'vocab' || b.kind === 'sentences' || b.kind === 'word_forms' || b.kind === 'synonyms') {
            for (const row of b.items) { const [a, ...rest] = row; const tail = rest.filter(Boolean).join(' · '); out.push(`- **${a}**${tail ? ' — ' + tail : ''}`); }
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
        if (ls.meta) body.push(`<p class="meta">${esc(ls.meta)}</p>`);
        if (ls.desc) body.push(`<p class="desc">${esc(ls.desc)}</p>`);
        for (const b of ls.blocks) {
          if (b.kind === 'eh') {
            body.push('<p class="eh-legend"><del>struck</del> = altered text · <ins>green</ins> = correct</p>');
            body.push(`<p class="eh">${ehDiff(b.correct, b.corrupted, true)}</p>`);
          } else if (b.kind === 'aeh') {
            body.push('<ul class="eh-list">');
            for (const e of b.items) body.push(`<li>${ehDiff(e.correct, e.corrupted, true)}${e.reason ? ` <span class="reason">(${esc(e.reason)})</span>` : ''}</li>`);
            body.push('</ul>');
          } else {
            body.push('<ul>');
            if (b.kind === 'vocab' || b.kind === 'sentences' || b.kind === 'word_forms' || b.kind === 'synonyms')
              for (const row of b.items) { const [a, ...rest] = row; const tail = rest.filter(Boolean).join(' · '); body.push(`<li><strong>${esc(a)}</strong>${tail ? ' — ' + esc(tail) : ''}</li>`); }
            else for (const row of b.items) body.push(`<li>${esc(row.join(' — '))}</li>`);
            body.push('</ul>');
          }
        }
      }
    });
  }
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(docs[0].title)}</title>
<style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 20px;line-height:1.7;color:#222}
h1{border-bottom:2px solid #ccc;padding-bottom:6px}h2{margin-top:1.6em}h3{color:#555}
.desc{color:#777;font-style:italic}ul{color:#333}strong{color:#111}
.meta{color:#888;font-size:13px;font-weight:bold;margin:2px 0;text-transform:uppercase;letter-spacing:.3px}
.eh-legend{color:#999;font-size:12px;font-style:italic;margin:4px 0}
.eh{background:#fafafa;border-left:3px solid #ddd;padding:8px 12px;line-height:2}
del{color:#c0392b;background:#fdecea;border-radius:3px;padding:0 2px}
ins{color:#1e7e34;background:#e6f4ea;text-decoration:none;border-radius:3px;padding:0 2px}
.reason{color:#999;font-style:italic;font-size:13px}</style></head>
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
