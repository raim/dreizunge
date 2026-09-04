#!/usr/bin/env node
'use strict';
// backfill-inflection-labels.js — v89_f
//
// `v89_d` normalises an inflections lesson's form labels into the source language at GENERATION
// time. Everything generated before it keeps whatever language the model happened to choose — which
// is what the original report was about: a Dutch grammar label read aloud in the German voice, on
// every chapter already in the corpus. This is that pass, run backwards over `lessons.json`.
//
// DRY RUN BY DEFAULT; `--write` saves (after a `.bak`), exactly like the other backfills here.
//
// ⚠️ `--write` RE-QUERIES the model; it does not replay what the dry run printed. The backend is
// non-deterministic, so the labels that land are equally valid but not character-identical to the
// ones previewed. Read the dry run as "is this the right KIND of change", never as a diff to be
// signed off line by line — and re-read the write run's own output, which prints the same before/
// after pairs for what was actually saved.
//
// It shares the DECISIONS with the generator rather than restating them: `inflection-labels.js`
// owns the gate, the request shape and the per-item fallback policy, and server.js's own
// `normaliseInflectionLabels` is the other caller. Only the I/O differs.
//
// ⚠️ CONCURRENCY IS REAL HERE, not theoretical. The user's server runs continuously and writes
// `lessons.json` on every answered question, and this script spends MINUTES inside model calls
// between its read and its write. So the write is not "save the object I loaded": the file is
// RE-READ at write time and each change is re-applied surgically, keyed on content
// (topic id → lesson id → the item's own sentence+surfaceForm+original choices), never on an
// index — see analysis-corrections.js's header for why an index is the wrong key for anything
// that has to survive a regeneration. An item that moved or changed underneath us is REPORTED and
// SKIPPED, never guessed at.
const fs = require('fs');
const path = require('path');
const llm = require('./llm.js');
const {
  shouldNormaliseLabels, buildLabelRequest, applyLabelReply, labelReplyTokens,
} = require('./inflection-labels.js');

const FILE = process.env.LESSONS_FILE || path.join(__dirname, 'lessons.json');
const LANGS = JSON.parse(fs.readFileSync(path.join(__dirname, 'languages.json'), 'utf8'));
const PROMPTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompts.json'), 'utf8'));

const langName = (c) => (LANGS[c] && (LANGS[c].name || LANGS[c])) || c;
const fillPrompt = (t, v) => String(t).replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? v[k] : '{' + k + '}'));

// ── Planning: pure, so a test can drive it with no model and no disk ──────────────────────────
// One entry per LESSON — the unit the model call is batched over. `before` keeps each item's own
// original choices so the write can prove, later, that it is still repairing the thing it read.
function planBackfill(store, opts) {
  const only = (opts && opts.topic) || null;
  const plan = [];
  for (const t of ((store && store.topics) || [])) {
    if (only && t.id !== only && t.topic !== only) continue;
    if (!shouldNormaliseLabels(t.srcLang)) continue;
    for (const l of (t.lessons || [])) {
      if (l.type !== 'inflections') continue;
      const items = (l.items || []).filter(it => it && Array.isArray(it.formChoices) && it.formChoices.length >= 2
        && Number.isInteger(it.formCorrectIndex) && it.formCorrectIndex >= 0 && it.formCorrectIndex < it.formChoices.length);
      if (!items.length) continue;
      plan.push({
        topicId: t.id, topicName: t.topic, lessonId: l.id, srcLang: t.srcLang, lang: t.lang,
        items,
        before: items.map(it => ({
          sentence: String(it.sentence || ''), surfaceForm: String(it.surfaceForm || ''),
          formChoices: it.formChoices.slice(),
        })),
      });
    }
  }
  return plan;
}

// ── Applying: also pure, and deliberately paranoid about what it is overwriting ────────────────
// `results` is `[{ topicId, lessonId, before, items }]` — `items` being the NORMALISED versions in
// the same order `before` describes. Returns counts plus the reason for every skip, so a run that
// repairs less than it planned says why rather than looking like a smaller job.
function applyPlan(store, results) {
  let applied = 0;
  const skipped = [];
  for (const r of results) {
    const t = ((store && store.topics) || []).find(x => x && x.id === r.topicId);
    if (!t) { skipped.push({ topicId: r.topicId, why: 'topic gone' }); continue; }
    const l = (t.lessons || []).find(x => x && x.type === 'inflections' && x.id === r.lessonId);
    if (!l) { skipped.push({ topicId: r.topicId, why: 'lesson gone' }); continue; }
    r.before.forEach((was, k) => {
      const next = r.items[k];
      if (!next) return;
      // Content-keyed, never index-keyed: the item must still BE the one that was read, choices and
      // all. If the user (or a re-generation) changed it while the model was thinking, the repair is
      // stale and is dropped — a stale repair silently reattached to a changed item is exactly the
      // failure analysis-corrections.js's own header warns about.
      const hit = (l.items || []).find(it => it
        && String(it.sentence || '') === was.sentence
        && String(it.surfaceForm || '') === was.surfaceForm
        && Array.isArray(it.formChoices)
        && it.formChoices.length === was.formChoices.length
        && it.formChoices.every((c, j) => c === was.formChoices[j]));
      if (!hit) { skipped.push({ topicId: r.topicId, surfaceForm: was.surfaceForm, why: 'changed on disk since it was read' }); return; }
      if (next.formChoices.every((c, j) => c === was.formChoices[j])) return;   // model returned it unchanged
      hit.formChoices = next.formChoices.slice();
      hit.formLabel = next.formLabel;
      applied++;
    });
  }
  return { applied, skipped };
}

module.exports = { planBackfill, applyPlan };

// ── CLI ───────────────────────────────────────────────────────────────────────────────────────
if (require.main === module) main();

async function main() {
  const ARGS = process.argv.slice(2);
  const WRITE = ARGS.includes('--write');
  const argVal = (f) => { const i = ARGS.indexOf(f); return i >= 0 ? ARGS[i + 1] : null; };
  const LIMIT = Number(argVal('--limit') || 0) || 0;
  const TOPIC = argVal('--topic');
  const MODEL = argVal('--model') || process.env.OLLAMA_TRANSLATION_MODEL || process.env.OLLAMA_MODEL;
  if (!MODEL) { console.error('No model: pass --model <name> or set OLLAMA_TRANSLATION_MODEL.'); process.exit(1); }

  const store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let plan = planBackfill(store, { topic: TOPIC });
  if (LIMIT) plan = plan.slice(0, LIMIT);
  const nItems = plan.reduce((a, p) => a + p.items.length, 0);
  const nLabels = plan.reduce((a, p) => a + p.items.reduce((b, it) => b + it.formChoices.length, 0), 0);
  console.log(`${path.basename(FILE)}: ${plan.length} inflections lesson(s) to normalise, ${nItems} item(s), ${nLabels} label(s)`);
  console.log(`model: ${MODEL}${WRITE ? '' : '   (DRY RUN — pass --write to save)'}\n`);
  if (!plan.length) { console.log('nothing to do'); return; }

  const results = [];
  let totalNorm = 0, failed = 0;
  for (const [n, p] of plan.entries()) {
    const S = langName(p.srcLang);
    const { map, keysByItem, count } = buildLabelRequest(p.items);
    const payload = JSON.stringify(map);
    process.stdout.write(`[${n + 1}/${plan.length}] ${p.topicName} (${p.lang}→${p.srcLang}) — ${count} label(s)… `);
    let parsed = null;
    const t0 = Date.now();
    try {
      const { text } = await llm.callLLM(MODEL, fillPrompt(PROMPTS.inflectionLabels.system, { S }),
        payload, labelReplyTokens(payload), { think: false });
      const cleaned = String(text || '').replace(/```json|```/g, '').trim();
      try { parsed = JSON.parse(cleaned); } catch (_) { parsed = llm.extractJSON(text); }
    } catch (e) {
      console.log(`FAILED (${e.message})`);
      failed++;
      continue;
    }
    const skips = [];
    const { items, normalised } = applyLabelReply(p.items, keysByItem, parsed, (it, why) => skips.push({ it, why }));
    totalNorm += normalised;
    console.log(`${normalised}/${p.items.length} item(s), ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    for (const s of skips) console.log(`      ⚠ kept originals for "${String(s.it.surfaceForm || '').slice(0, 30)}" (${s.why})`);
    // Show the work. A backfill whose output nobody looked at is a backfill nobody can trust — and
    // these are grammar labels in a language the operator may not read, so print BOTH sides.
    p.items.forEach((it, k) => {
      const to = items[k];
      if (to.formChoices.every((c, j) => c === it.formChoices[j])) return;
      console.log(`      ${JSON.stringify(it.formChoices)}\n   →  ${JSON.stringify(to.formChoices)}`);
    });
    if (normalised) results.push({ topicId: p.topicId, lessonId: p.lessonId, before: p.before, items });
  }

  console.log(`\n${totalNorm} item(s) normalised across ${results.length} lesson(s)${failed ? `, ${failed} lesson(s) failed` : ''}`);
  if (!WRITE) { console.log('(dry run — pass --write to save; a .bak is made first)'); return; }
  if (!results.length) { console.log('nothing to write'); return; }

  // ⚠️ RE-READ, do not reuse the object loaded at the top: minutes of model calls have passed and
  // the user's server writes this file on every answered question.
  const fresh = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const { applied, skipped } = applyPlan(fresh, results);
  for (const s of skipped) console.log(`  ⚠ skipped ${s.topicId}${s.surfaceForm ? ' / "' + s.surfaceForm + '"' : ''}: ${s.why}`);
  if (!applied) { console.log('nothing still applied after the re-read — not writing'); return; }
  fs.copyFileSync(FILE, FILE + '.bak');
  fs.writeFileSync(FILE, JSON.stringify(fresh, null, 2));
  console.log(`\n✅ ${applied} item(s) written (backup at ${path.basename(FILE)}.bak)`);
}
