// probe_comic_text_extract_v85_i.js
//
// FOLLOW-UP to the three §2.4 panel-FINDING probes (probe_comic_panels_v85_i.js,
// probe_comic_panels_grounded_v85_i.js, probe_comic_panels_stateful_v85_i.js), all of which failed
// at panel ENUMERATION on minicpm-v4.5. Per the user's own new idea after reviewing those results:
// if panel boundaries come from the USER drawing a rectangle (removing localization from the model's
// job entirely), the only thing left for the model to do is TEXT EXTRACTION from an already-correct,
// already-cropped region — a different, plausibly easier task that has never been measured. This
// probe tests exactly that, on a hand-picked crop of the SAME §2.7 "Page B" fixture, chosen because
// it contains both things §2.7 flagged as real risks in one panel:
//   - a CAPTION (narration box) vs IN-SCENE text (a signpost) that must be told apart
//   - a word split across a line break with NO hyphen ("WILL"/"KOMMEN") that must be rejoined
//     without inventing a hyphen that isn't there
//   - ALL-CAPS lettering that must be RESTORED to correct German capitalization (nouns capitalized,
//     everything else not), not transcribed verbatim
//
// Still a MEASUREMENT step. No production code follows until a human reviews the output against the
// actual panel image (included below for reference — read build_history's own crop file, or eyeball
// the source page's panel 3, "SO WURDE ZUR ABSCHRECKUNG...").
//
// USAGE:  node build_history/probe_comic_text_extract_v85_i.js [path/to/crop.jpg]
//
// RESULTS — first run, Aug 25 2026, minicpm-v4.5, hand-cropped Page B panel 3:
//
//   Call took 64.9s (297 prompt tok, 59 completion tok) — much faster than any panel-FINDING call in
//   the three prior probes (75-390s), consistent with the theory that per-call cost there was mostly
//   image-encoding/localization work, not raw generation length. A small, single-purpose crop is
//   genuinely cheap to query.
//
//   Response:
//     CAPTION: SO WURDE ZUR ABSCHRECKUNG AN DER GRENZE VON DER REGIERUNG EIN GROSSES SCHILD AUFGESTELLT.
//     IN-SCENE: RIESEN SIND HIER MCHT WILL KOMMEN
//   Ground truth (read by eye): caption "So wurde zur Abschreckung an der Grenze von der Regierung
//   ein großes Schild aufgestellt"; sign "Riesen sind hier nicht willkommen".
//
//   GOOD: the caption/in-scene SPLIT is exactly right — it correctly told the narration box and the
//   signpost text apart, the one classification task this probe asked for beyond plain OCR. Every
//   letter of the caption transcription matches the source. This is the first probe in the whole
//   §2.4 series where the model's output was usable without heavy correction for at least one field.
//
//   BAD, and both are the exact two things §2.7 flagged as the highest-value transformations:
//     1. NO capitalization restoration happened at all, despite an explicit instruction — the output
//        is still ALL CAPS. The prompt's case-restoration ask was simply not followed.
//     2. The line-broken word ("WILL"/"KOMMEN", split with no hyphen in the source) was NOT rejoined
//        into "WILLKOMMEN" despite an explicit instruction to do exactly that — it stayed as two
//        separate words in the output.
//   Also one genuine OCR letter error: "NICHT" came back as "MCHT" (a dropped/merged "NI").
//
//   VERDICT: mixed, and informative in a NEW way — this is the first probe in the series where the
//   core visual/classification task (find the right text, tell two text sources apart) worked, but
//   an explicit TEXT-TRANSFORMATION instruction (case restoration, rejoin-without-hyphen) was
//   ignored outright rather than attempted-and-wrong. That is a different, and arguably more
//   addressable, kind of failure than the panel-finding probes' confabulation/inconsistency — worth
//   one more attempt with a more forceful/example-driven prompt before drawing a conclusion, given
//   the much lower per-call cost (~1 min vs 6-10 min) makes iterating here cheap.
//
// RESULTS — v2 retry (worked example + "your answer is WRONG if..." framing added to the prompt):
//
//   Call took 83.9s (469 prompt tok — the worked example roughly doubled prompt size — 49 completion
//   tok).
//
//   Response:
//     CAPTION: So wurde zur Abschreckung an der Grenze von der Regierung ein großes Schild aufgestellt.
//     IN-SCENE: Riesen sind hier mcht will kommen!
//     FREILICH hat sich die
//
//   CAPTION IS NOW A PERFECT MATCH to ground truth — correct case throughout, correct noun
//   capitalization, correct umlaut ("großes"). The worked example fixed case-restoration completely
//   for this field. This is the strongest positive result across all five probes run today.
//
//   IN-SCENE improved (properly cased now, no longer all-caps) but still carries the SAME two defects
//   as v1: the OCR letter error persists ("nicht" → "mcht", unchanged by the prompt fix, since that's
//   a visual-recognition error, not a case/formatting one) and "will kommen" was still NOT rejoined
//   into "willkommen" despite the explicit instruction and worked example.
//
//   NEW, UNPROMPTED defect: a third, unlabeled line appeared — "FREILICH hat sich die" — the start of
//   the ADJACENT panel's caption, correctly case-restored but transcribed anyway despite "output only
//   the labeled transcriptions" and despite not being asked for a third category. The source crop
//   deliberately included a sliver of the next panel (an intentionally imprecise, human-realistic
//   crop boundary) — the model treated that bleed-through as content to transcribe rather than
//   ignoring it, which is a real risk for the production case (user-drawn boxes will rarely be
//   pixel-perfect).
//
//   VERDICT: the two failure modes DIVERGED under one prompt fix — case-restoration, the single
//   highest-pedagogical-weight requirement per §2.7, was FULLY fixed by adding a worked example, and
//   ported cleanly across both fields (in-scene text is now correctly cased too). Word-rejoining and
//   the OCR letter accuracy did NOT respond to the same fix, and crop-boundary bleed-through is a
//   newly discovered risk specific to imprecise (i.e. realistic, human-drawn) crop boxes. Net signal
//   for the "user draws panels, model only extracts text" idea: MORE promising than any panel-finding
//   strategy tested — the highest-value transformation (case restoration) is solvable with prompt
//   engineering alone — but not yet production-ready: OCR letter accuracy and crop-bleed handling
//   still need either better prompting, a deterministic post-process, or padding/generous-crop
//   handling in the UI (e.g. re-cropping tighter after an initial pass) before this could ship.

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const MODEL = process.env.PROBE_MODEL || 'minicpm-v4.5';
const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS) || 300000;

const DEFAULT_IMG =
  '/tmp/claude-1000/-home-raim-programs-dreizunge-app/7a9bfd76-db83-42a4-816b-4d407ab78a98/scratchpad/panel3_crop.jpg';
const IMG_PATH = process.argv[2] || DEFAULT_IMG;
const OUT_DIR = path.dirname(IMG_PATH);
const RUN_TAG = process.env.PROBE_RUN_TAG || 'v2';
const RAW_TXT = path.join(OUT_DIR, `probe_comic_text_extract_raw_response_${RUN_TAG}.txt`);

// v2 (tightened): v1 got the caption/in-scene SPLIT and the letters right, but ignored both the
// case-restoration and the line-rejoin instructions outright — not attempted-and-wrong, just
// skipped. This version adds a worked example directly in the prompt and a stricter, checkable
// framing ("your answer is WRONG if...") instead of a polite instruction, to see if that's fixable.
const PROMPT = `This image is a single panel cropped from a German-language comic page. All lettering in the
source is ALL CAPS — that is a lettering convention of the artwork, not the real capitalization of the
German text. Your job is NOT to transcribe the capital letters as shown. Your answer is WRONG if it
contains any word written in all capital letters (except a single leading capital, which is correct for
nouns and sentence starts).

Worked example — if the source panel showed, in all caps: "ES GIBT EIN LAND WO DIE KOEPFE ALLER
MENSCHEN GLEICHEN", the correct output is: "Es gibt ein Land, wo die Köpfe aller Menschen gleichen." —
note: EVERY word is lowercase except "Es" (sentence start) and the three nouns "Land", "Köpfe",
"Menschen" (German capitalizes all nouns, nothing else); "KOEPFE" became "Köpfe" (restore umlauts
written as "OE"/"AE"/"UE").

There may be two kinds of text in this panel:
1. A CAPTION or narration box (plain text, usually no border or a simple rectangular box, at the top or
   bottom of the panel).
2. IN-SCENE text that is part of the drawn scene itself (e.g. text on a sign, banner, or object the
   characters are looking at).

List each separately, labeled "CAPTION:" or "IN-SCENE:", each in properly-cased German exactly like the
worked example above. Within each, if a single word is broken across two lines, rejoin it into one word
— only insert a hyphen if the source image actually shows one; do not add a hyphen that isn't there.
Output only the labeled transcriptions, nothing else.`;

function callOllamaVision(model, prompt, imgB64) {
  return new Promise((resolve, reject) => {
    const u = new URL('/api/chat', OLLAMA_HOST);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      model, stream: false, keep_alive: -1,
      options: { temperature: 0.1, num_predict: 400 },
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

async function main() {
  console.log(`Reading crop: ${IMG_PATH}`);
  const buf = fs.readFileSync(IMG_PATH);
  const b64 = buf.toString('base64');
  const ext = path.extname(IMG_PATH).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  console.log(`Crop size: ${buf.length} bytes. Calling ${MODEL} at ${OLLAMA_HOST} ...`);

  const t0 = Date.now();
  const { text, promptTokens, completionTokens } = await callOllamaVision(MODEL, PROMPT, b64);
  const ms = Date.now() - t0;
  console.log(`Model responded in ${(ms / 1000).toFixed(1)}s (${promptTokens} prompt tok, ${completionTokens} completion tok).`);

  fs.writeFileSync(RAW_TXT, text, 'utf8');
  console.log(`Raw response written to: ${RAW_TXT}`);
  console.log('--- raw response ---');
  console.log(text);
  console.log('--- end raw response ---');
  console.log('\nGROUND TRUTH (read by eye from the crop, for comparison):');
  console.log('CAPTION: "So wurde zur Abschreckung an der Grenze von der Regierung ein großes Schild aufgestellt"');
  console.log('IN-SCENE (sign): "Riesen sind hier nicht willkommen"');
}

main().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
