// probe_comic_panels_v85_i.js
//
// PLAN §2.4 "overlay probe". Per the roadmap's own §2.4 analysis, the ONE genuinely uncertain thing
// about the comic-import idea is panel ENUMERATION in reading order — not whether a vision model can
// find a single box on request (it can; that's the documented §2.2 grounding protocol: prompt
// `Please provide the bounding box coordinate of the region this sentence describes: <ref>NAME</ref>`,
// response `<box>x1 y1 x2 y2</box>` normalized 0-1000). This script posts ONE real comic page to the
// vision model via Ollama's `/api/chat` (`images:[base64]` — zero new dependency, §2.1), asks it to
// enumerate every panel as a bounding box IN READING ORDER, and writes an HTML overlay of the
// returned boxes back over the source image so a human can eyeball accuracy.
//
// This is a MEASUREMENT step, not production code. No panel-splitting feature, no progress-card
// change, and no index.html/server.js edit should follow until a human has looked at the rendered
// overlay and confirmed the boxes are usable.
//
// FIXTURE: roadmap §2.7 "Page B" — murmel-comics.org/stories/2640, "Ein Scheissland" by König Lü.Q,
// fetched with the user's explicit one-off authorization for this internal dev probe (the SITE's own
// licence terms are UNCHECKED per the roadmap's own note — this image must not become a permanent
// demo/test fixture committed to the repo without that check; it is left in the session scratchpad,
// not this directory). This is the EASY/acceptance case per §2.7: a clean 2x3 grid of rectangular
// panels, unambiguous reading order, so a FAIL here would mean panel detection isn't viable at all —
// a PASS here says nothing yet about the HARD case ("Page A": rotated text, unframed panels, text
// sitting outside its panel's box, genuinely ambiguous order), which needs its own separate run
// before this approach can be trusted in general.
//
// MODEL: minicpm-v4.5 — roadmap §2.2's actual recommendation. NOT v4.6 (0.8B phone-optimized LLM,
// explicitly called out as the wrong pick for ingest quality) and NOT the older v:8b-2.6 it
// supersedes.
//
// USAGE:  node build_history/probe_comic_panels_v85_i.js [path/to/page.jpg]
//   Defaults to the scratchpad copy of the Page B fixture if no path is given.
//
// RESULTS — first real run, Aug 25 2026, minicpm-v4.5, Page B (2x3 grid, 6 true panels):
//
//   Model call took 382.9s (6.4 min) on this machine — CPU-only inference, with two OTHER large
//   models (qwen3.6:35b, qwen2.5:7b) also resident/competing for CPU per `ollama ps` at call time.
//   Not a clean single-model timing; a quieter machine would likely be faster, but this app's own
//   real deployment target is exactly this kind of shared/CPU box, so the number is not irrelevant.
//
//   FORMAT: the model ignored the requested `<box>...</box>` tag form entirely, instead emitting a
//   bare `x1 y1 x2 y2` (first 4 panels) / `[x1,y1] to [x2,y2]` (later panels) form under the same
//   "Panel N:" label. The parser was relaxed to accept both — worth remembering for any production
//   prompt: do not assume compliance with a requested inline-tag format from this model.
//
//   ENUMERATION: panels 1-4 are genuinely plausible — a consistent, evenly-spaced 2-column top
//   section (254-493 / 525-764 on x; 68-307 / 336-575 on y), exactly consistent with a 2-wide grid.
//   From panel 5 onward the response DEGENERATES: it starts inserting confabulated self-correction
//   prose ("...corrected to match grid layout...", "(likely a typo for...)") INSIDE what should be a
//   terse coordinate line, invents an in-panel sign text ("RIESEN SIND HIER MICH WIL KOMMEN") that
//   does not obviously correspond to real page content, and from panel ~14 on it enters an outright
//   REPETITION LOOP — the same "SIE WURDE WIEDERGEMALT HURRA... (likely a typo for WIEDERGEWÄHLT)"
//   sentence repeats verbatim across panels 14/16/18/20/22/24/26, each paired with a slightly
//   different box that shrinks in a way suggesting the model is pattern-completing a numeric
//   sequence rather than re-examining the image. It claimed 26 "panels" for a page with 6 true ones.
//
//   VERDICT: this is exactly the §2.4 risk the probe was written to catch, materializing on the
//   EASY/acceptance fixture. Single-shot "enumerate every panel in one response" is NOT reliable
//   with this model at this context length — confabulation/repetition sets in well before reaching
//   the true panel count, even though the model can clearly localize the first few panels correctly.
//   This does not by itself rule out per-panel grounding (§2.2's proven single-box protocol, asking
//   for ONE named region at a time) or a hard cap + majority-grid-inference strategy — those are
//   different prompts than the one this run tested and need their own measurement before ruling
//   in/out. See the human-reviewed overlay for the visual read: the first-4 boxes look right; do not
//   trust the rest.

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const MODEL = process.env.PROBE_MODEL || 'minicpm-v4.5';
const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS) || 180000;

const DEFAULT_IMG =
  '/tmp/claude-1000/-home-raim-programs-dreizunge-app/7a9bfd76-db83-42a4-816b-4d407ab78a98/scratchpad/page_b_scheissland.jpg';
const IMG_PATH = process.argv[2] || DEFAULT_IMG;

const OUT_DIR = path.dirname(IMG_PATH);
const OVERLAY_HTML = path.join(OUT_DIR, 'probe_comic_panels_overlay.html');
const RAW_TXT = path.join(OUT_DIR, 'probe_comic_panels_raw_response.txt');

const PROMPT = `This image is one page of a comic. It is laid out as a grid of rectangular panels.
List every panel on the page, in reading order (top row first, left to right within each row, then
the next row down). For each panel output exactly one line in this format:

Panel <n>: <box>x1 y1 x2 y2</box>

where x1,y1 is the top-left corner and x2,y2 is the bottom-right corner of the panel's bounding box,
with each coordinate normalized to the 0-1000 range (0,0 = top-left of the whole image, 1000,1000 =
bottom-right of the whole image). Output nothing else: no preamble, no explanation, just the numbered
list of panels, one per line.`;

function callOllamaVision(model, prompt, imgB64) {
  return new Promise((resolve, reject) => {
    const u = new URL('/api/chat', OLLAMA_HOST);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      model, stream: false, keep_alive: -1,
      options: { temperature: 0.1, num_predict: 1024 },
      messages: [{ role: 'user', content: prompt, images: [imgB64] }]
    });
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(d);
          if (p.error) return reject(new Error('Ollama: ' + p.error));
          const text = p.message?.content || p.response || '';
          if (!text) return reject(new Error('Ollama returned empty response'));
          resolve({ text, promptTokens: p.prompt_eval_count || 0, completionTokens: p.eval_count || 0 });
        } catch (e) { reject(new Error('Ollama parse: ' + e.message + '\n' + d.slice(0, 300))); }
      });
    });
    req.on('error', e => reject(new Error('Ollama network: ' + e.message)));
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error('Ollama timeout after ' + TIMEOUT_MS + 'ms')); });
    req.write(body); req.end();
  });
}

function parsePanels(text) {
  // Accept EITHER the requested `<box>x1 y1 x2 y2</box>` form OR a bare `x1 y1 x2 y2` /
  // `[x1,y1] to [x2,y2]` form — v85_i's first real run showed the model ignoring the tag format
  // for its early (plausible-looking) panels while still numbering them "Panel N:", so a strict
  // parse would silently report zero panels even though useful numbers were present.
  const reTag = /Panel\s*(\d+)\s*:?\s*<box>\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*<\/box>/gi;
  const reBare = /Panel\s*(\d+)\s*:\s*\[?\s*([\d.]+)[,\s]+([\d.]+)\s*\]?\s*(?:to|,|\s)\s*\[?\s*([\d.]+)[,\s]+([\d.]+)\s*\]?/gi;
  const panels = [];
  const seen = new Set();
  for (const re of [reTag, reBare]) {
    let m;
    while ((m = re.exec(text))) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      panels.push({
        claimedN: Number(m[1]),
        box: [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])]
      });
    }
  }
  panels.sort((a, b) => a.claimedN - b.claimedN);
  return panels;
}

function sortReadingOrder(panels) {
  // Deterministic top-to-bottom, then left-to-right, using box center — the alternative the roadmap
  // flags as worth comparing against the model's own claimed sequence.
  const withCenter = panels.map(p => ({
    ...p,
    cy: (p.box[1] + p.box[3]) / 2,
    cx: (p.box[0] + p.box[2]) / 2
  }));
  // Group into rows by y-proximity (within 8% of page height), then sort each row left-to-right.
  const ROW_TOL = 80; // out of 1000
  const sorted = [...withCenter].sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const p of sorted) {
    let row = rows.find(r => Math.abs(r.y - p.cy) < ROW_TOL);
    if (!row) { row = { y: p.cy, items: [] }; rows.push(row); }
    row.items.push(p);
  }
  rows.sort((a, b) => a.y - b.y);
  const out = [];
  for (const r of rows) { r.items.sort((a, b) => a.cx - b.cx); out.push(...r.items); }
  return out;
}

function buildOverlayHtml(imgB64, mime, panels, sorted) {
  const colors = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080'];
  const boxesHtml = panels.map((p, i) => {
    const [x1, y1, x2, y2] = p.box;
    const left = (x1 / 10).toFixed(2), top = (y1 / 10).toFixed(2);
    const w = ((x2 - x1) / 10).toFixed(2), h = ((y2 - y1) / 10).toFixed(2);
    const color = colors[i % colors.length];
    return `<div class="box" style="left:${left}%;top:${top}%;width:${w}%;height:${h}%;border-color:${color}">
      <span style="background:${color}">#${p.claimedN}</span>
    </div>`;
  }).join('\n');
  const sortedList = sorted.map((p, i) => `<li>reading-order ${i + 1} = model's Panel ${p.claimedN} (box ${p.box.join(',')})</li>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Comic panel overlay probe</title>
<style>
  body { font-family: sans-serif; background:#222; color:#eee; margin:0; padding:20px; }
  .wrap { position:relative; display:inline-block; }
  img { display:block; max-width:600px; }
  .box { position:absolute; border:3px solid; box-sizing:border-box; }
  .box span { position:absolute; top:-1.4em; left:0; color:#fff; font-size:13px; padding:1px 5px; border-radius:3px; }
  h2 { margin-top:2em; }
</style></head><body>
<h1>PLAN §2.4 overlay probe — model-claimed panel boxes over source image</h1>
<p>Model: ${MODEL}. ${panels.length} panel(s) parsed from response.</p>
<div class="wrap"><img src="data:${mime};base64,${imgB64}"><br>${boxesHtml}</div>
<h2>Deterministic top-to-bottom/left-to-right reading order (for comparison against the model's own numbering)</h2>
<ol>${sortedList}</ol>
</body></html>`;
}

async function main() {
  console.log(`Reading image: ${IMG_PATH}`);
  const buf = fs.readFileSync(IMG_PATH);
  const b64 = buf.toString('base64');
  const ext = path.extname(IMG_PATH).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';

  let text;
  if (process.env.PROBE_REPARSE_ONLY) {
    // Re-parse a previously saved raw response instead of paying for another 6+min model call —
    // used to re-run the overlay after a parser fix without re-querying the (slow, CPU-only) model.
    console.log(`Re-parsing saved response: ${RAW_TXT}`);
    text = fs.readFileSync(RAW_TXT, 'utf8');
  } else {
    console.log(`Image size: ${buf.length} bytes. Calling ${MODEL} at ${OLLAMA_HOST} ...`);
    const t0 = Date.now();
    const r = await callOllamaVision(MODEL, PROMPT, b64);
    const ms = Date.now() - t0;
    console.log(`Model responded in ${(ms / 1000).toFixed(1)}s (${r.promptTokens} prompt tok, ${r.completionTokens} completion tok).`);
    text = r.text;
    fs.writeFileSync(RAW_TXT, text, 'utf8');
    console.log(`Raw response written to: ${RAW_TXT}`);
  }
  console.log('--- raw response ---');
  console.log(text);
  console.log('--- end raw response ---');

  const panels = parsePanels(text);
  console.log(`Parsed ${panels.length} panel box(es).`);
  if (!panels.length) {
    console.log('NO PANELS PARSED — either the model did not follow the format, or produced no boxes. Check the raw response above.');
    return;
  }
  for (const p of panels) console.log(`  Panel ${p.claimedN}: box=[${p.box.join(', ')}]`);

  const sorted = sortReadingOrder(panels);
  const orderMatches = sorted.every((p, i) => p.claimedN === panels[i].claimedN);
  console.log(`Model's own order matches deterministic top-to-bottom/left-to-right sort: ${orderMatches}`);

  const html = buildOverlayHtml(b64, mime, panels, sorted);
  fs.writeFileSync(OVERLAY_HTML, html, 'utf8');
  console.log(`Overlay written to: ${OVERLAY_HTML}`);
  console.log('Open that file (or have the user look at it) to visually verify box accuracy.');
}

main().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
