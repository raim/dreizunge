// probe_comic_panels_grounded_v85_i.js
//
// FOLLOW-UP to probe_comic_panels_v85_i.js. That first run showed single-shot "enumerate every
// panel in one response" degenerating into confabulation/repetition after ~4 of 6 true panels, even
// on the EASY §2.7 "Page B" fixture. Per the user's own choice after reviewing that result, this
// script tests the alternative the roadmap's §2.2 grounding protocol was actually validated for:
// asking the model to locate ONE named region at a time —
//   `Please provide the bounding box coordinate of the region this sentence describes: <ref>NAME</ref>`
//   → `<box>x1 y1 x2 y2</box>`
// — rather than one long enumeration. Approach:
//   1. One short call: "how many rectangular comic panels are on this page?" (a number, not boxes).
//   2. One grounding call PER claimed panel, asking for "panel i, counting all panels in reading
//      order top-to-bottom then left-to-right" — capped at whatever count step 1 returned (plus a
//      hard ceiling so a bad count-answer can't runaway the probe into dozens of slow calls).
// Still a MEASUREMENT step. No production code follows until a human reviews the resulting overlay.
//
// USAGE:  node build_history/probe_comic_panels_grounded_v85_i.js [path/to/page.jpg]
//
// RESULTS — first real run, Aug 25 2026, minicpm-v4.5, Page B (2x3 grid, 6 true panels):
//
//   Count call: correct on the first try — "6" — in 66.4s. Cheap, reliable signal; worth keeping as
//   a step regardless of what happens to per-panel grounding.
//
//   Per-panel grounding calls: 6 calls, 73-87s each (9.4 min total for all 7 calls). A NEW failure
//   mode, different from the one-shot run's confabulation/repetition: the model ECHOES THE ENTIRE
//   <ref>...</ref> DESCRIPTION VERBATIM before answering, e.g. raw output for panel 3 was literally
//   "panel 3 of 6, counting every rectangular comic panel on this page in reading order — top row
//   first, left to right, then the next row down145 208 479 4" — the whole prompt text repeated back
//   with NO delimiter before the box numbers start. Two consequences:
//     (a) the echo eats into the num_predict budget (48 tokens/call here), so the box's LAST number
//         gets truncated mid-digit on 4 of 6 calls (y2 came back as "4", "6", "6", "9" — single
//         digits, clearly cut off, not real coordinates)
//     (b) with no delimiter between the echoed name and the answer, a naive number-scan can silently
//         fuse the tail of the echo with the head of the real answer (panel 2's raw ends "...of
//         6507 48 913 351" — the "6" from "of 6" fused onto "507", corrupting x1 into "6507")
//   Panel 1 (which had the most room before hitting num_predict) came back CLEAN and plausible:
//   box=[20,39,487,259], a sensible top-left-panel box. That is the one data point in this run
//   uncorrupted by truncation, and it argues the underlying grounding CAN be accurate — the failure
//   here is a probe-prompt-design bug (an over-long, sentence-length <ref> name, too small a
//   num_predict), not evidence the technique itself is unworkable.
//
//   VERDICT: promising but inconclusive. A tighter prompt — a short <ref> name instead of a full
//   instructional sentence, a larger num_predict so echo+answer both fit, and an explicit "answer
//   with the box only, do not repeat the question" instruction — is worth one more try before
//   drawing a real conclusion about this approach.
//
// RESULTS — v2 retry (tightened prompt: short instruction, no <ref> echo requested, num_predict 200):
//
//   Count call: instant (0.7s, presumably a cache/keep_alive effect) — "6" again, still correct.
//
//   Per-panel calls: 75-85s each (7.8 min total, similar per-call cost to v1 despite the 4x larger
//   token budget — confirms the earlier guess that image PREFILL, not completion length, dominates
//   the wall-clock cost on this machine). The verbatim-echo problem is GONE — every response now
//   starts directly with 4 numbers, no repeated prompt text. But a NEW, different defect appears:
//   2 of 6 calls (panels 2 and 6) still end with a truncated/garbled last number followed by stray
//   text ("957 3 sur", "936 9 draw height)") — this time NOT a token-budget artifact (200 tokens was
//   plenty; the calls finished in the same ~75-85s as the smaller-budget v1 calls, meaning the model
//   itself chose to stop early after producing a short, malformed answer). This looks like the model
//   occasionally failing to complete a coherent 4-number answer at all, independent of prompt length.
//
//   MORE IMPORTANTLY: even where all 4 numbers parsed cleanly (panels 1, 3, 4, 5), the boxes do NOT
//   form a consistent, non-overlapping 2x3 grid the way the ONE-SHOT run's first 4 panels did.
//   Panel 1=[350,689,470,809], Panel 4=[305,678,694,918] — heavily overlapping x-ranges and near-
//   identical y-ranges, i.e. two DIFFERENT "panel numbers" answered with nearly the SAME region.
//   Panel 5=[498,360,752,550] lands in the middle row, plausible in isolation. Each call is answered
//   completely independently (the model has no memory of what it said for other panel numbers in the
//   same page), so nothing enforces that six per-call answers actually tile the page — the model
//   appears to be guessing a plausible-looking box for whatever region "feels like panel N" in
//   isolation, not consulting a shared, consistent reading-order layout.
//
//   VERDICT: the echo/truncation bug is fixed, but the deeper problem this run surfaces is that
//   STATELESS per-call grounding has no mechanism to keep six independent answers mutually
//   consistent — overlapping/duplicate boxes across different claimed panel numbers, on the EASY
//   fixture. Fixing this would need either (a) passing prior answers back into each subsequent call
//   as context ("already found panels at boxes X, Y — do not repeat these"), which multiplies cost
//   further per remaining panel, or (b) a fundamentally different one-shot strategy that avoids both
//   this run's inconsistency AND the original one-shot run's confabulation/repetition. Neither is
//   free; this is the point where a design conversation is more valuable than another probe call.
//
// RESULTS — MODEL COMPARISON: qwen2.5vl:7b, same stateless grounding strategy (Aug 25 2026):
//
//   Much cheaper: count call 4-6s, all 6 grounding calls 14-20s each, 1.6-1.9 min total for all 7
//   calls (vs 8-10 min for minicpm-v4.5) — machine load had dropped by this point in the session
//   (other large models likely evicted after their keep_alive), so this is not a clean model-vs-model
//   speed comparison, just a note that per-call cost is not fixed.
//
//   First attempt exposed a PARSER bug, not (only) a model bug: `<box>-10 -6 378 394</box>` — a
//   plausible slightly-negative boundary coordinate — silently mismatched entirely under a
//   digit-only regex, producing garbage output ("box=[6,37,8,394]", no relation to the input). Fixed
//   by allowing an optional `-` on every coordinate; see `parseBox`'s comment.
//
//   With the parser fixed, the MODEL's own output is still bad: panels 1 and 3 came back with
//   NEGATIVE-HEIGHT boxes (`y1=-5, y2=-386`; `y1=-548, y2=-740`) — geometrically inverted, not just
//   imprecise. And panels 5 and 6 landed on nearly the SAME region again (`[389,760,746,1085]` vs
//   `[385,759,740,1086]`) — the identical duplicate-region failure minicpm-v4.5 had with this same
//   stateless strategy.
//
//   VERDICT: a genuinely striking result — the SAME model that produced a clean, fully-correct 2x3
//   grid under ONE-SHOT enumeration (see probe_comic_panels_v85_i.js's qwen2.5vl comparison) degrades
//   badly under STATELESS per-panel grounding, the exact task §2.2's protocol was validated for. This
//   says the failure mode measured across this whole probe series is not simply "weaker models
//   confabulate more" — it is closely tied to WHICH TASK SHAPE is asked of a given model. For
//   qwen2.5vl:7b specifically, one-shot enumeration is the strategy to build on; stateless (and,
//   untested here, stateful) grounding is not.

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const MODEL = process.env.PROBE_MODEL || 'minicpm-v4.5';
const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS) || 300000;
const HARD_CAP = Number(process.env.PROBE_PANEL_CAP) || 12; // never issue more than this many grounding calls

const DEFAULT_IMG =
  '/tmp/claude-1000/-home-raim-programs-dreizunge-app/7a9bfd76-db83-42a4-816b-4d407ab78a98/scratchpad/page_b_scheissland.jpg';
const IMG_PATH = process.argv[2] || DEFAULT_IMG;

const OUT_DIR = path.dirname(IMG_PATH);
const RUN_TAG = process.env.PROBE_RUN_TAG || 'v2';
const OVERLAY_HTML = path.join(OUT_DIR, `probe_comic_panels_grounded_overlay_${RUN_TAG}.html`);
const LOG_TXT = path.join(OUT_DIR, `probe_comic_panels_grounded_log_${RUN_TAG}.txt`);

function callOllamaVision(model, prompt, imgB64, numPredict) {
  return new Promise((resolve, reject) => {
    const u = new URL('/api/chat', OLLAMA_HOST);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      model, stream: false, keep_alive: -1,
      options: { temperature: 0.1, num_predict: numPredict || 64 },
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
  // -? on each group: a boundary panel can legitimately be reported with a slightly negative
  // coordinate (overshooting the image edge by a few units), and the original digit-only groups
  // silently mismatched the whole box in that case (qwen2.5vl:7b's first grounded run) rather than
  // just losing precision on one corner.
  let m = text.match(/<box>\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)\s*<\/box>/i);
  if (!m) m = text.match(/\[?\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\]?\s*(?:to|,)?\s*\[?\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\]?/);
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
  const list = results.map(r => `<li>panel ${r.i}: ${r.box ? `box=[${r.box.join(', ')}]` : 'UNPARSEABLE'} — raw: ${r.raw.slice(0, 120).replace(/</g,'&lt;')}</li>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Comic panel grounded probe</title>
<style>
  body { font-family: sans-serif; background:#222; color:#eee; margin:0; padding:20px; }
  .wrap { position:relative; display:inline-block; }
  img { display:block; max-width:600px; }
  .box { position:absolute; border:3px solid; box-sizing:border-box; }
  .box span { position:absolute; top:-1.4em; left:0; color:#fff; font-size:13px; padding:1px 5px; border-radius:3px; }
  h2 { margin-top:2em; }
  li { margin-bottom: 0.4em; }
</style></head><body>
<h1>PLAN §2.4 grounded probe — one <ref>panel N</ref> call per panel</h1>
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
  say(`Will request ${n} panel(s), one grounding call each (hard cap ${HARD_CAP}).`);

  // v2 (tightened): the first attempt used a full instructional sentence as the <ref> NAME and a
  // 48-token budget; the model echoed that whole sentence back before answering and got truncated
  // mid-number on 4/6 calls. Fix: (1) a SHORT name — reading order is established once, up front, in
  // a system-style preamble instead of being re-spelled out inside every <ref>; (2) an explicit
  // "answer with only the box tag" instruction; (3) a much larger num_predict so an echo (if it still
  // happens) can't crowd out the real answer.
  const results = [];
  for (let i = 1; i <= n; i++) {
    const prompt = `This comic page has ${n} rectangular panels. Numbering them in reading order — top row first, left to right within each row, then the next row down — panel ${i} is one specific region of the image. Provide ONLY its bounding box, in this exact format and nothing else, no repetition of this question: <box>x1 y1 x2 y2</box>`;
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
    say(`Panel ${i}/${n} (${dt}s): raw="${raw.slice(0, 150)}" → box=${box ? JSON.stringify(box) : 'UNPARSEABLE'}`);
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
