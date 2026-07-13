#!/usr/bin/env node
'use strict';
// spike-storyboard.js — THROWAWAY spike for the v55 "SVG chapter storyboard" feature.
//
// Purpose (roadmap_v54.md ▶ NEXT BUILD → "First spike"): prove the story model can
// produce usable storyboard panels AT ALL before any UI is wired. It:
//   1. picks a real multi-chapter storyline from lessons.json,
//   2. asks the model for a STRICT JSON array of 2–5 panels built from a fixed,
//      whitelisted vocabulary of flat-vector primitives (NEVER raw SVG),
//   3. composes the SVG itself from the validated JSON (the security boundary:
//      whitelist shape types, clamp coords, escape text, drop anything unknown),
//   4. dumps raw response + parsed JSON + composed SVG to files for eyeballing.
//
// Usage:
//   node spike-storyboard.js --list                 # show candidate storylines
//   node spike-storyboard.js [slId]                 # run (default: first candidate)
//   node spike-storyboard.js --fixture              # no LLM — compose a built-in sample
//   OLLAMA_MODEL=qwen3.6:35b-a3b node spike-storyboard.js sl_1314409474
//
// Flags: --model <m>  --max-tokens <n>  --attempts <n>  --timeout <ms>  --out <dir>  --lessons <file>
//
// NOTE the llm.js timeout is a socket-INACTIVITY timeout and requests are non-streaming, so
// the socket is silent for the entire load+generation. The 12-min default killed a working
// qwen3.6:35b-a3b run; the spike therefore defaults to the 60-min clamp max and warms the
// model up (untimed-ish) before the first real attempt.
//
// Verdict criteria (per roadmap): crude-but-recognisable panels → proceed with the
// feature; garbage / can't hold the schema → stop and report. Judge the .svg by eye.
//
// When the feature is built for real: the prompt moves to prompts.json
// (`storylineStoryboard` block), composeStoryboardSVG() moves into server.js behind
// /api/storyline-storyboard, and `unit-storyboard` guards the composer. Nothing in
// this file is imported by the app; deleting it is always safe.

const fs   = require('fs');
const path = require('path');
const { callLLM, warmup, setRequestTimeout, stripRaw, extractArray, salvageArray } = require('./llm.js');

// ── CLI ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function flag(name, dflt) {
  const i = argv.indexOf('--' + name);
  return (i >= 0 && argv[i + 1] != null) ? argv[i + 1] : dflt;
}
const LIST        = argv.includes('--list');
const FIXTURE     = argv.includes('--fixture');
const LESSONS     = flag('lessons', process.env.LESSONS_FILE || path.join(__dirname, 'lessons.json'));
const MODEL       = flag('model', process.env.OLLAMA_MODEL || 'qwen2.5:7b');
const MAX_TOKENS  = parseInt(flag('max-tokens', '4096'), 10);
const ATTEMPTS    = Math.max(1, parseInt(flag('attempts', '2'), 10));
// The llm.js request timeout is a socket-INACTIVITY timeout, and stream:false means the
// socket is silent for the WHOLE load+generation — a big model can exceed the 12-min default
// while working fine. The spike defaults to the 60-min clamp max; override with --timeout <ms>.
const TIMEOUT_MS  = setRequestTimeout(flag('timeout', process.env.OLLAMA_TIMEOUT || '3600000'));
const OUT_DIR     = flag('out', path.join(__dirname, 'spike_storyboard_out'));
const SL_ID       = argv.find(a => !a.startsWith('--') && a !== flag('model') && a !== flag('out')
                                && a !== flag('lessons') && a !== flag('max-tokens') && a !== flag('attempts'));

// ── The composer (lift-target for server.js) ────────────────────────────────
// Everything below composeStoryboardSVG is written to the roadmap's safety spec so it
// can be lifted verbatim when the feature lands:
//   - fixed shape-type whitelist; unknown types are DROPPED, never rendered raw
//   - every coordinate/size clamped into the 0 0 100 100 panel viewBox
//   - colors resolved through a named palette only (no model-authored color strings)
//   - path `d` restricted to a charset whitelist + length cap; panels clip overflow
//   - all text escaped; no <script>, no <foreignObject>, no href of any kind
//   - caps: ≤5 panels, ≤25 shapes/panel; a panel with 0 valid shapes is invalid;
//     <2 valid panels → null (no storyboard)

const PALETTE = {
  paper:'#faf7f0', ink:'#2b2b2b', accent:'#e07a5f', sky:'#a8dadc', water:'#457b9d',
  leaf:'#81b29a', sun:'#f2cc8f', earth:'#8d6e63', stone:'#9e9e9e', rose:'#e5989b',
  night:'#3d405b', white:'#ffffff', none:'none',
};
const MAX_PANELS = 5, MIN_PANELS = 2, MAX_SHAPES = 25, MAX_POINTS = 60, MAX_D = 500;
const PANEL_PX = 170, GAP = 12, CAPTION_H = 30;

function escXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function num(v, lo, hi, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}
function col(v, dflt) {
  const k = String(v == null ? '' : v).trim().toLowerCase();
  return PALETTE[k] !== undefined ? PALETTE[k] : dflt;
}
function paintAttrs(s, dfltFill) {
  const fill   = col(s.fill, dfltFill);
  const stroke = col(s.stroke, 'none');
  const sw     = num(s.sw != null ? s.sw : s.strokeWidth, 0, 10, 1.5);
  const o      = num(s.o  != null ? s.o  : s.opacity, 0, 1, 1);
  let a = ` fill="${fill}"`;
  if (stroke !== 'none') a += ` stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
  if (o < 1) a += ` opacity="${o}"`;
  return a;
}
function pointsAttr(pts) {
  // Accepts [[x,y],…] or a flat [x,y,x,y,…] or a "x,y x,y" string. Returns a clamped
  // "x,y x,y" string or null.
  let flat = [];
  if (typeof pts === 'string') flat = pts.split(/[\s,]+/).map(Number);
  else if (Array.isArray(pts)) flat = pts.flat().map(Number);
  if (flat.length < 4 || flat.length % 2 !== 0 || flat.some(n => !Number.isFinite(n))) return null;
  flat = flat.slice(0, MAX_POINTS * 2).map(n => Math.max(0, Math.min(100, n)));
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push(flat[i] + ',' + flat[i + 1]);
  return out.join(' ');
}
const D_RE = /^[MmLlHhVvZzCcSsQqTtAa0-9eE .,+-]+$/;

// One shape object → SVG element string, or null (dropped). `drops` collects reasons.
function shapeToSvg(s, drops) {
  if (!s || typeof s !== 'object') { drops.push('not-an-object'); return null; }
  const t = String(s.type || s.t || '').toLowerCase();
  switch (t) {
    case 'rect': {
      const x = num(s.x, 0, 100, null), y = num(s.y, 0, 100, null);
      const w = num(s.w != null ? s.w : s.width, 0, 100, null);
      const h = num(s.h != null ? s.h : s.height, 0, 100, null);
      if (x == null || y == null || !w || !h) { drops.push('rect: bad coords'); return null; }
      const rx = num(s.rx, 0, 50, 0);
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''}${paintAttrs(s, PALETTE.ink)}/>`;
    }
    case 'circle': {
      const cx = num(s.cx, 0, 100, null), cy = num(s.cy, 0, 100, null), r = num(s.r, 0, 100, null);
      if (cx == null || cy == null || !r) { drops.push('circle: bad coords'); return null; }
      return `<circle cx="${cx}" cy="${cy}" r="${r}"${paintAttrs(s, PALETTE.ink)}/>`;
    }
    case 'ellipse': {
      const cx = num(s.cx, 0, 100, null), cy = num(s.cy, 0, 100, null);
      const rx = num(s.rx, 0, 100, null), ry = num(s.ry, 0, 100, null);
      if (cx == null || cy == null || !rx || !ry) { drops.push('ellipse: bad coords'); return null; }
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${paintAttrs(s, PALETTE.ink)}/>`;
    }
    case 'line': {
      const x1 = num(s.x1, 0, 100, null), y1 = num(s.y1, 0, 100, null);
      const x2 = num(s.x2, 0, 100, null), y2 = num(s.y2, 0, 100, null);
      if ([x1, y1, x2, y2].some(v => v == null)) { drops.push('line: bad coords'); return null; }
      const stroke = col(s.stroke, PALETTE.ink);
      const sw = num(s.sw != null ? s.sw : s.strokeWidth, 0, 10, 1.5);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
    }
    case 'polyline': {
      const p = pointsAttr(s.points);
      if (!p) { drops.push('polyline: bad points'); return null; }
      const stroke = col(s.stroke, PALETTE.ink);
      const sw = num(s.sw != null ? s.sw : s.strokeWidth, 0, 10, 1.5);
      return `<polyline points="${p}" fill="${col(s.fill, 'none')}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    case 'polygon': {
      const p = pointsAttr(s.points);
      if (!p) { drops.push('polygon: bad points'); return null; }
      return `<polygon points="${p}"${paintAttrs(s, PALETTE.ink)}/>`;
    }
    case 'path': {
      const d = String(s.d || '').trim();
      if (!d || d.length > MAX_D || !D_RE.test(d)) { drops.push('path: bad/oversized d'); return null; }
      return `<path d="${d}"${paintAttrs(s, 'none')}/>`;
    }
    case 'text': {
      const x = num(s.x, 0, 100, null), y = num(s.y, 0, 100, null);
      const content = String(s.text != null ? s.text : s.content || '').slice(0, 40).trim();
      if (x == null || y == null || !content) { drops.push('text: bad coords/empty'); return null; }
      const size = num(s.size, 3, 16, 7);
      return `<text x="${x}" y="${y}" font-size="${size}" font-family="sans-serif" fill="${col(s.fill, PALETTE.ink)}">${escXml(content)}</text>`;
    }
    default:
      drops.push(`unknown type: ${t || '(missing)'}`);
      return null;
  }
}

// panels JSON → { svg, stats } | { svg:null, stats } if fewer than MIN_PANELS survive.
function composeStoryboardSVG(panels) {
  const stats = { requested: Array.isArray(panels) ? panels.length : 0, valid: 0, drops: [] };
  if (!Array.isArray(panels)) return { svg: null, stats };
  const rendered = [];
  for (const p of panels.slice(0, MAX_PANELS)) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.shapes)) { stats.drops.push('panel: no shapes[]'); continue; }
    const drops = [];
    const shapes = p.shapes.slice(0, MAX_SHAPES).map(s => shapeToSvg(s, drops)).filter(Boolean);
    stats.drops.push(...drops);
    if (!shapes.length) { stats.drops.push('panel: 0 valid shapes'); continue; }
    rendered.push({
      bg: col(p.bg, PALETTE.paper),
      caption: String(p.caption || '').slice(0, 70).trim(),
      body: shapes.join('\n      '),
    });
  }
  stats.valid = rendered.length;
  if (rendered.length < MIN_PANELS) return { svg: null, stats };

  const W = rendered.length * (PANEL_PX + GAP) + GAP;
  const H = PANEL_PX + CAPTION_H + GAP * 2;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`,
  ];
  rendered.forEach((p, i) => {
    const x = GAP + i * (PANEL_PX + GAP);
    parts.push(
      `  <rect x="${x - 1}" y="${GAP - 1}" width="${PANEL_PX + 2}" height="${PANEL_PX + 2}" fill="none" stroke="${PALETTE.stone}" stroke-width="1" rx="4"/>`,
      // Nested <svg> both scales the 0–100 panel space and CLIPS any overflow.
      `  <svg x="${x}" y="${GAP}" width="${PANEL_PX}" height="${PANEL_PX}" viewBox="0 0 100 100">`,
      `    <rect x="0" y="0" width="100" height="100" fill="${p.bg}"/>`,
      `      ${p.body}`,
      `  </svg>`,
      `  <text x="${x + PANEL_PX / 2}" y="${GAP + PANEL_PX + 18}" font-size="11" font-family="sans-serif" fill="${PALETTE.ink}" text-anchor="middle">${escXml(p.caption)}</text>`
    );
  });
  parts.push('</svg>');
  const svg = parts.join('\n');
  if (svg.length > 120000) { stats.drops.push('svg: over size cap'); return { svg: null, stats }; }
  return { svg, stats };
}

// ── Prompt (moves to prompts.json `storylineStoryboard` when the feature lands) ──
const SYS = `You are an illustrator for a language-learning storybook. You draw simple, flat-vector storyboard panels using ONLY a small JSON shape vocabulary. You output ONLY a valid JSON array — no markdown, no explanation, no SVG, nothing else.

Output: a JSON array of 2 to 5 panels, one per key scene of the story, in story order.
Each panel: {"caption": "...", "bg": "<palette color>", "shapes": [ ... ]}
- caption: one short sentence in {S} describing the scene (max 70 characters).
- bg: background color name from the palette.
- shapes: 5 to 20 shapes drawn back-to-front in a 100x100 coordinate space (0,0 = top-left).

Allowed shapes (any other type is discarded):
{"type":"rect","x":N,"y":N,"w":N,"h":N,"rx":N,"fill":C,"stroke":C,"sw":N}
{"type":"circle","cx":N,"cy":N,"r":N,"fill":C,"stroke":C,"sw":N}
{"type":"ellipse","cx":N,"cy":N,"rx":N,"ry":N,"fill":C}
{"type":"line","x1":N,"y1":N,"x2":N,"y2":N,"stroke":C,"sw":N}
{"type":"polyline","points":[[x,y],[x,y],...],"stroke":C,"sw":N}
{"type":"polygon","points":[[x,y],[x,y],...],"fill":C}
{"type":"path","d":"M ... Z","fill":C,"stroke":C,"sw":N}

All coordinates must be numbers between 0 and 100. "sw" is stroke width (0-10).
C must be one of these palette names (nothing else): paper, ink, accent, sky, water, leaf, sun, earth, stone, rose, night, white, none.

Style: flat, geometric, children's-book simplicity. Build scenes from big background shapes first (sky, ground), then landmarks, then figures (circles for heads, rects/polygons for bodies). No text inside panels. No letters drawn from shapes.`;

const USER = `Story ({chapters} chapters):

{chapterSummaries}

Draw a storyboard of 2 to 5 panels covering the arc of this story. Captions in {S}. Return ONLY the JSON array.`;

function fill(t, vars) { return t.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`)); }

// ── Fixture (compose-only path; also documents the target schema) ───────────
const FIXTURE_PANELS = [
  { caption: 'Ein Spaziergang am Fluss beginnt', bg: 'sky', shapes: [
    { type: 'rect', x: 0, y: 60, w: 100, h: 40, fill: 'leaf' },
    { type: 'path', d: 'M 0 70 C 30 60 70 80 100 68 L 100 100 L 0 100 Z', fill: 'water' },
    { type: 'circle', cx: 80, cy: 18, r: 10, fill: 'sun' },
    { type: 'polygon', points: [[20,60],[30,40],[40,60]], fill: 'earth' },
    { type: 'circle', cx: 50, cy: 48, r: 5, fill: 'rose' },
    { type: 'rect', x: 46, y: 53, w: 8, h: 14, rx: 2, fill: 'accent' },
    { type: 'line', x1: 46, y1: 60, x2: 38, y2: 66, stroke: 'ink', sw: 2 },
  ]},
  { caption: 'Die Weinberge an der Mosel', bg: 'paper', shapes: [
    { type: 'rect', x: 0, y: 55, w: 100, h: 45, fill: 'leaf' },
    { type: 'polyline', points: [[5,55],[25,25],[45,55]], stroke: 'earth', sw: 2 },
    { type: 'polyline', points: [[40,55],[65,18],[90,55]], stroke: 'earth', sw: 2 },
    { type: 'circle', cx: 25, cy: 62, r: 3, fill: 'rose' },
    { type: 'circle', cx: 45, cy: 70, r: 3, fill: 'rose' },
    { type: 'circle', cx: 65, cy: 64, r: 3, fill: 'rose' },
    // deliberate junk — MUST be dropped by the composer, proving the whitelist:
    { type: 'script', src: 'evil.js' },
    { type: 'text', x: 50, y: 900, text: 'clamped?' },
    { type: 'path', d: 'M 0 0 <foreignObject>' },
  ]},
];

// ── Main ────────────────────────────────────────────────────────────────────
function loadStorylines() {
  const d = JSON.parse(fs.readFileSync(LESSONS, 'utf8'));
  const topicById = new Map((d.topics || []).map(t => [t.id, t]));
  const cands = (d.storylines || [])
    .map(sl => ({ sl, topics: (sl.chapters || []).map(id => topicById.get(id)).filter(t => t && t.story) }))
    .filter(x => x.topics.length >= 2);
  return cands;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (FIXTURE) {
    console.log('── Fixture mode (no LLM) ──');
    const { svg, stats } = composeStoryboardSVG(FIXTURE_PANELS);
    report(svg, stats, FIXTURE_PANELS, '(fixture)', null);
    return;
  }

  const cands = loadStorylines();
  if (LIST) {
    console.log(`Candidate storylines in ${LESSONS} (≥2 chapters with stories):\n`);
    for (const { sl, topics } of cands)
      console.log(`  ${sl.id}  [${sl.srcLang || '?'}→${sl.lang || '?'}] ${sl.icon || ''} "${sl.title}" — ${topics.length} chapters`);
    return;
  }
  const pick = SL_ID ? cands.find(c => c.sl.id === SL_ID) : cands[0];
  if (!pick) {
    console.error(SL_ID ? `Storyline ${SL_ID} not found or has <2 story chapters. Try --list.` : 'No candidate storylines. Try --list.');
    process.exit(1);
  }
  const { sl, topics } = pick;
  const srcLang = topics[0].srcLang || 'en';
  const LANG_NAMES = { en:'English', de:'German', fr:'French', it:'Italian', es:'Spanish', ar:'Arabic', sw:'Swahili', lb:'Luxembourgish', ja:'Japanese' };
  const S = LANG_NAMES[srcLang] || srcLang;

  const chapterSummaries = topics.map((t, i) =>
    `Chapter ${i + 1}: "${t.topic}"\n${(t.story || '').slice(0, 600).replace(/\n/g, ' ')}…`
  ).join('\n\n');
  const sys  = fill(SYS,  { S });
  const user = fill(USER, { S, chapters: topics.length, chapterSummaries });

  console.log(`\n── Storyline storyboard SPIKE ───────────────────────`);
  console.log(`  Storyline: ${sl.id} "${sl.title}" (${topics.length} chapters, ${srcLang}→${sl.lang})`);
  console.log(`  Model    : ${MODEL}   max_tokens: ${MAX_TOKENS}   attempts: ${ATTEMPTS}   timeout: ${Math.round(TIMEOUT_MS / 60000)}min`);

  // Load the model OUTSIDE the timed attempt — a cold 35B load otherwise eats the same
  // inactivity window as generation. warmup() never throws; a warmup timeout just proceeds.
  await warmup(MODEL);

  const _t0 = Date.now();
  let panels = null, raw = '', lastErr = null, attempt = 0;
  for (attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const _ta = Date.now();
    const secs = () => ((Date.now() - _ta) / 1000).toFixed(0) + 's';
    try {
      const result = await callLLM(MODEL, sys, user, MAX_TOKENS);
      const rate = result.completionTokens ? ` (${result.completionTokens} tok, ${(result.completionTokens / ((Date.now() - _ta) / 1000)).toFixed(1)} tok/s)` : '';
      console.log(`  Attempt ${attempt}: response after ${secs()}${rate}`);
      raw = result.text;
      fs.writeFileSync(path.join(OUT_DIR, `raw_attempt${attempt}.txt`), raw);
      let arr;
      try { arr = JSON.parse(stripRaw(raw)); }
      catch (_) { try { arr = extractArray(raw); } catch (_2) { arr = salvageArray(raw); } }
      if (!Array.isArray(arr)) throw new Error('model returned non-array JSON');
      panels = arr;
      const { svg, stats } = composeStoryboardSVG(panels);
      if (svg) {
        // Stamp preview — what buildGenMeta will record when this lands in server.js.
        const meta = { type: 'storyline_storyboard', model: MODEL, attempts: attempt,
                       valid: stats.valid, promptTokens: result.promptTokens,
                       completionTokens: result.completionTokens, ms: Date.now() - _t0,
                       at: new Date().toISOString() };
        report(svg, stats, panels, MODEL, meta);
        return;
      }
      lastErr = new Error(`only ${stats.valid} valid panel(s) (need ≥${MIN_PANELS}); drops: ${stats.drops.join('; ') || 'none'}`);
      console.log(`  Attempt ${attempt}: parsed but unusable — ${lastErr.message}`);
    } catch (e) {
      lastErr = e;
      console.log(`  Attempt ${attempt}: ${e.message} after ${secs()}`);
    }
  }
  console.error(`\n✗ SPIKE FAILED after ${ATTEMPTS} attempt(s): ${lastErr && lastErr.message}`);
  if (/timeout/i.test(String(lastErr && lastErr.message))) {
    console.error(`  This is a TIMEOUT, not a model-quality verdict. Things to try, in order:`);
    console.error(`    1. Check the model generates at all + its speed: ollama run ${MODEL} --verbose "say hi"`);
    console.error(`    2. Shrink the job: --max-tokens 2500 (fewer/simpler panels still prove the point)`);
    console.error(`    3. A faster model for the verdict: --model qwen2.5:7b (schema-holding is what's being tested)`);
  } else {
    console.error(`  Raw responses are in ${OUT_DIR}/ — per the roadmap, if the model can't hold`);
    console.error(`  the schema, STOP and report; don't build the UI on an unproven generator.`);
  }
  process.exit(2);
}

function report(svg, stats, panels, model, meta) {
  fs.writeFileSync(path.join(OUT_DIR, 'panels.json'), JSON.stringify(panels, null, 2));
  console.log(`  Panels   : ${stats.valid}/${stats.requested} valid`);
  if (stats.drops.length) console.log(`  Dropped  : ${stats.drops.join('; ')}`);
  if (!svg) { console.error('  ✗ No storyboard (fewer than 2 valid panels).'); process.exit(2); }
  const out = path.join(OUT_DIR, 'storyboard.svg');
  fs.writeFileSync(out, svg);
  const html = `<!doctype html><meta charset="utf-8"><title>storyboard spike</title><body style="background:#eee;padding:2em">${svg}</body>`;
  fs.writeFileSync(path.join(OUT_DIR, 'storyboard.html'), html);
  if (meta) console.log(`  Stamp    : ${JSON.stringify(meta)}`);
  console.log(`  SVG      : ${out} (${svg.length} bytes; .html wrapper beside it)`);
  console.log(`  Verdict  : open the SVG — crude-but-recognisable → proceed; garbage → stop.`);
  console.log('────────────────────────────────────────────────────\n');
}

main().catch(e => { console.error(e); process.exit(1); });
