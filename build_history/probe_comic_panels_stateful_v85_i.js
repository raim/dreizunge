// probe_comic_panels_stateful_v85_i.js
//
// THIRD strategy in the §2.4 overlay-probe series, following the user's own choice after reviewing
// both prior runs (probe_comic_panels_v85_i.js: one-shot enumeration confabulates past panel 4;
// probe_comic_panels_grounded_v85_i.js: stateless per-panel grounding is individually plausible but
// six independent calls don't agree on a consistent global layout — overlapping boxes for different
// claimed panel numbers). This run makes each grounding call STATEFUL: every subsequent call's
// prompt lists the boxes already found for EARLIER panels and instructs the model to answer with a
// DIFFERENT region. Directly targets the consistency failure the v2 grounded run surfaced, at the
// cost of a growing prompt (more prefill) on each successive call.
//
// Still a MEASUREMENT step. No production code follows until a human reviews the resulting overlay.
//
// USAGE:  node build_history/probe_comic_panels_stateful_v85_i.js [path/to/page.jpg]
//
// RESULTS — first run, Aug 25 2026, minicpm-v4.5, Page B (2x3 grid, 6 true panels):
//
//   Count call: 0.7s, "6" — correct again, consistent with both prior runs; this sub-step is
//   reliable across all three probe scripts so far.
//
//   Stateful grounding calls: 80-96s each (8.7 min total), growing slightly with context size as
//   expected. Feeding prior boxes back did NOT fix the consistency problem the v2 grounded run
//   surfaced, and surfaced a further defect:
//     - Panel sizes are wildly inconsistent: Panel 1 = 355x315 (out of 1000x1000 normalized), a
//       plausible large panel; Panel 4 = [590,378,640,428], a mere 50x50 sliver — nowhere near
//       panel-sized, more like a single word or icon inside a panel, not a panel itself.
//     - 2 of 6 calls (panels 5, 6) STILL end in truncated/garbled numbers followed by outright
//       hallucinated content — panel 5's raw response literally contains
//       `rel="noopener noreferrer" target="_blank">670</a>`, i.e. HTML anchor-tag markup leaking
//       into what should be four plain numbers. This is not a prompt-design artifact (the same
//       "answer only with the box" instruction as the successful v2 calls); it reads as the small
//       quantized model occasionally derailing into unrelated training-data patterns under load,
//       independent of prompt care.
//
//   VERDICT: three different strategies now tested (one-shot enumeration, stateless grounding,
//   stateful grounding-with-history) each fail in a DIFFERENT way, but all fail — none produces a
//   fully self-consistent set of 6 non-overlapping, plausibly-sized panel boxes on the EASY fixture.
//   Combined with the wall-clock cost (7-10 min per multi-call run on this CPU-only, shared-load
//   machine — each individual grounding call alone costs 75-95s regardless of prompt tuning), this
//   is a reasonable point to stop iterating on prompt variations for THIS model on THIS machine and
//   have a design conversation instead — e.g. whether a different (non-quantized / cloud / GPU)
//   backend behaves differently, or whether the roadmap's own coarser §2.6 Tier 1 target (bubble-
//   level boxes, not precise panel-grid splitting) is the more realistic near-term goal regardless of
//   model.

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const MODEL = process.env.PROBE_MODEL || 'minicpm-v4.5';
const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS) || 300000;
const HARD_CAP = Number(process.env.PROBE_PANEL_CAP) || 12;

const DEFAULT_IMG =
  '/tmp/claude-1000/-home-raim-programs-dreizunge-app/7a9bfd76-db83-42a4-816b-4d407ab78a98/scratchpad/page_b_scheissland.jpg';
const IMG_PATH = process.argv[2] || DEFAULT_IMG;

const OUT_DIR = path.dirname(IMG_PATH);
const OVERLAY_HTML = path.join(OUT_DIR, 'probe_comic_panels_stateful_overlay.html');
const LOG_TXT = path.join(OUT_DIR, 'probe_comic_panels_stateful_log.txt');

function callOllamaVision(model, prompt, imgB64, numPredict) {
  return new Promise((resolve, reject) => {
    const u = new URL('/api/chat', OLLAMA_HOST);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      model, stream: false, keep_alive: -1,
      options: { temperature: 0.1, num_predict: numPredict || 200 },
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

function parseCount(text) {
  const m = text.match(/\d+/);
  return m ? Number(m[0]) : null;
}

function parseBox(text) {
  let m = text.match(/<box>\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*<\/box>/i);
  if (!m) m = text.match(/\[?\s*([\d.]+)[,\s]+([\d.]+)\s*\]?\s*(?:to|,)?\s*\[?\s*([\d.]+)[,\s]+([\d.]+)\s*\]?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
}

function buildOverlayHtml(imgB64, mime, results) {
  const colors = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080'];
  const boxesHtml = results.filter(r => r.box).map((r, i) => {
    const [x1, y1, x2, y2] = r.box;
    const left = (x1 / 10).toFixed(2), top = (y1 / 10).toFixed(2);
    const w = ((x2 - x1) / 10).toFixed(2), h = ((y2 - y1) / 10).toFixed(2);
    const color = colors[i % colors.length];
    return `<div class="box" style="left:${left}%;top:${top}%;width:${w}%;height:${h}%;border-color:${color}">
      <span style="background:${color}">#${r.i}</span>
    </div>`;
  }).join('\n');
  const list = results.map(r => `<li>panel ${r.i}: ${r.box ? `box=[${r.box.join(', ')}]` : 'UNPARSEABLE'} — raw: ${r.raw.slice(0, 150).replace(/</g,'&lt;')}</li>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Comic panel stateful probe</title>
<style>
  body { font-family: sans-serif; background:#222; color:#eee; margin:0; padding:20px; }
  .wrap { position:relative; display:inline-block; }
  img { display:block; max-width:600px; }
  .box { position:absolute; border:3px solid; box-sizing:border-box; }
  .box span { position:absolute; top:-1.4em; left:0; color:#fff; font-size:13px; padding:1px 5px; border-radius:3px; }
  h2 { margin-top:2em; }
  li { margin-bottom: 0.4em; }
</style></head><body>
<h1>PLAN §2.4 stateful probe — each call sees prior panels' boxes</h1>
<p>Model: ${MODEL}. ${results.filter(r=>r.box).length}/${results.length} panel(s) parsed.</p>
<div class="wrap"><img src="data:${mime};base64,${imgB64}"><br>${boxesHtml}</div>
<h2>Per-call results</h2>
<ol>${list}</ol>
</body></html>`;
}

async function main() {
  console.log(`Reading image: ${IMG_PATH}`);
  const buf = fs.readFileSync(IMG_PATH);
  const b64 = buf.toString('base64');
  const ext = path.extname(IMG_PATH).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  const log = [];
  const say = (s) => { console.log(s); log.push(s); };

  say(`Image size: ${buf.length} bytes. Calling ${MODEL} at ${OLLAMA_HOST} to count panels ...`);
  const t0 = Date.now();
  const countPrompt = 'How many rectangular comic panels are on this page? Count only the panel frames, not speech bubbles or captions. Answer with only a single number, nothing else.';
  const countResp = await callOllamaVision(MODEL, countPrompt, b64, 16);
  say(`Count call took ${((Date.now() - t0) / 1000).toFixed(1)}s. Raw: "${countResp.text.trim()}"`);
  let n = parseCount(countResp.text);
  if (!n || n < 1) { say('Could not parse a usable count; defaulting to 6 (known true count for this fixture).'); n = 6; }
  n = Math.min(n, HARD_CAP);
  say(`Will request ${n} panel(s), one STATEFUL grounding call each (hard cap ${HARD_CAP}).`);

  const results = [];
  for (let i = 1; i <= n; i++) {
    const already = results.filter(r => r.box);
    const knownList = already.length
      ? `Panels already located (do NOT answer with any of these regions again): ` +
        already.map(r => `panel ${r.i}=[${r.box.join(',')}]`).join('; ') + '. '
      : '';
    const prompt = `This comic page has ${n} rectangular panels. Numbering them in reading order — top row first, left to right within each row, then the next row down — panel ${i} is one specific region of the image. ${knownList}Provide ONLY panel ${i}'s bounding box, a region DIFFERENT from any already located, in this exact format and nothing else, no repetition of this question: <box>x1 y1 x2 y2</box>`;
    const tCall = Date.now();
    let raw = '';
    try {
      const r = await callOllamaVision(MODEL, prompt, b64, 200);
      raw = r.text.trim();
    } catch (e) {
      raw = 'ERROR: ' + e.message;
    }
    const dt = ((Date.now() - tCall) / 1000).toFixed(1);
    const box = parseBox(raw);
    say(`Panel ${i}/${n} (${dt}s, ${already.length} prior boxes in context): raw="${raw.slice(0, 150)}" → box=${box ? JSON.stringify(box) : 'UNPARSEABLE'}`);
    results.push({ i, raw, box });
  }

  fs.writeFileSync(LOG_TXT, log.join('\n'), 'utf8');
  say(`Log written to: ${LOG_TXT}`);

  const html = buildOverlayHtml(b64, mime, results);
  fs.writeFileSync(OVERLAY_HTML, html, 'utf8');
  say(`Overlay written to: ${OVERLAY_HTML}`);
  say(`Total wall time: ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min for ${n + 1} calls.`);
}

main().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
