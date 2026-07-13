// unit-storyboard.test.js
// v55 — storyline SVG storyboard. The model returns strict JSON panels; the server-side
// composer (composeStoryboardSVG) is the SECURITY BOUNDARY that turns them into markup.
// Guards (per roadmap_v54 "Tests (definition-of-done)"):
//   valid panels render; unknown shape types are dropped; coords are clamped to the viewBox;
//   <script>/href/foreignObject injection attempts in any string field are neutralised;
//   <2 valid panels → svg:null; the generator stamps with the STORY model via buildGenMeta;
//   mutation-test the whitelist and the panel-count floor; call site destructures + persists.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

function ext(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// The composer is deliberately self-contained (helpers nested) so it can run pure here.
const compose = new Function(ext(server, 'composeStoryboardSVG') + '\nreturn composeStoryboardSVG;')();

const goodPanel = (caption) => ({ caption, bg: 'sky', shapes: [
  { type: 'rect', x: 0, y: 60, w: 100, h: 40, fill: 'leaf' },
  { type: 'circle', cx: 80, cy: 18, r: 10, fill: 'sun' },
  { type: 'polygon', points: [[20, 60], [30, 40], [40, 60]], fill: 'earth' },
  { type: 'path', d: 'M 0 70 C 30 60 70 80 100 68 L 100 100 L 0 100 Z', fill: 'water' },
  { type: 'line', x1: 10, y1: 10, x2: 30, y2: 30, stroke: 'ink', sw: 2 },
]});

// ── 1. Valid panels render ────────────────────────────────────────────────────
{
  const { svg, stats } = compose([goodPanel('Scene one'), goodPanel('Scene two'), goodPanel('Scene three')]);
  assert.ok(svg, 'three valid panels compose');
  assert.strictEqual(stats.valid, 3, 'all three counted valid');
  assert.strictEqual((svg.match(/<svg x=/g) || []).length, 3, 'three nested panel <svg>s');
  // Captions are hover-only <title> (accessible tooltip), NOT always-on <text> (user's call).
  assert.ok(svg.includes('<title>Scene one</title>') && svg.includes('<title>Scene three</title>'),
    'captions render as <title> tooltips');
  assert.ok(!/<text[^>]*>Scene/.test(svg), 'captions are NOT drawn as visible <text>');
  assert.ok(/<g><title>/.test(svg), 'each panel group leads with its <title> so hover covers the whole panel');
  // Height dropped the caption band: 170 panel + 2*12 gap = 194, no +30 band.
  assert.ok(/viewBox="0 0 \d+ 194"/.test(svg), 'outer viewBox height has no caption band (194 = 170 + 2*12)');
  assert.ok(svg.includes('#a8dadc'), 'palette name resolved to hex (sky)');
  assert.ok(!/\bsky\b/.test(svg.replace(/Scene (one|two|three)/g, '')), 'raw palette NAME never emitted as a color');
}

// ── 2. Unknown shape types are dropped, never rendered raw (whitelist mutation test) ──
{
  const p = goodPanel('a');
  p.shapes.push({ type: 'image', href: 'http://evil/x.png' });
  p.shapes.push({ type: 'use', href: '#x' });
  p.shapes.push({ type: 'script', src: 'evil.js' });
  p.shapes.push({ type: 'made-up-shape', x: 1 });
  const { svg, stats } = compose([p, goodPanel('b')]);
  assert.ok(svg, 'still composes from the surviving valid shapes');
  for (const bad of ['image', 'evil', '<use', '<script', 'made-up']) {
    assert.ok(!svg.includes(bad), `dropped type never appears in output: ${bad}`);
  }
  assert.ok(stats.drops.filter(d => d.startsWith('unknown type:')).length === 4, 'all four foreign types recorded as drops');
}

// ── 3. Coords are clamped to the panel viewBox ────────────────────────────────
{
  const p = { caption: 'clamp', shapes: [
    { type: 'rect', x: -50, y: 9999, w: 4000, h: 4000, fill: 'ink' },
    { type: 'circle', cx: 200, cy: -7, r: 1e9, fill: 'ink' },
    { type: 'polygon', points: [[-10, -10], [500, 500], [50, 50]], fill: 'ink' },
    { type: 'text', x: 50, y: 900, text: 'edge' },
  ]};
  const { svg } = compose([p, goodPanel('b')]);
  assert.ok(svg, 'composes');
  const inner = svg.slice(svg.indexOf('<svg x='), svg.indexOf('</svg>'));
  const nums = [...inner.matchAll(/(?:x|y|cx|cy|r|width|height|x1|y1|x2|y2)="(-?[\d.e+]+)"/g)]
    .map(m => Number(m[1]));
  assert.ok(nums.every(n => n >= -1 && n <= 172), 'no shape coordinate escapes the clamp (panel offsets ≤172)');
  assert.ok(svg.includes('points="0,0 100,100 50,50"'), 'polygon points clamped into 0–100');
  assert.ok(/y="100"[^>]*>edge</.test(svg), 'text y clamped to 100');
}

// ── 4. Injection attempts in ANY string field are neutralised ─────────────────
{
  const p = { caption: '<script>alert(1)</script> "quoted" <foreignObject>', bg: 'javascript:alert(1)', shapes: [
    { type: 'text', x: 10, y: 10, text: '<img src=x onerror=alert(1)>' },
    { type: 'path', d: 'M 0 0 L 10 10 <foreignObject href=x>' },
    { type: 'rect', x: 1, y: 1, w: 10, h: 10, fill: 'red"/><script>x</script>' },
  ]};
  const { svg } = compose([p, goodPanel('b')]);
  assert.ok(svg, 'composes from what survives');
  // Escaped forms (&lt;img … onerror=…&gt; inside a text node) are CORRECT — character data
  // is inert once `<` is escaped, so no tag can form around it. The real invariants:
  // (a) the emitted TAG SET is exactly the composer's whitelist — nothing else can open a tag;
  const tags = [...new Set([...svg.matchAll(/<([a-zA-Z]+)[\s>/]/g)].map(m => m[1]))].sort();
  const allowed = ['circle', 'ellipse', 'g', 'line', 'path', 'polygon', 'polyline', 'rect', 'svg', 'text', 'title'];
  assert.ok(tags.every(t => allowed.includes(t)), `only whitelisted tags emitted (got: ${tags.join(',')})`);
  // (b) no tag carries an event handler, href, or script-URL attribute;
  assert.ok(!/<[^>]*(onerror|onload|onclick|href|xlink)\s*=/i.test(svg), 'no dangerous attribute inside any tag');
  assert.ok(!/javascript:/.test(svg), 'no script URL anywhere (bg resolves via palette, never verbatim)');
  // (c) hostile markup in text fields AND in the caption (now a <title> tooltip) is escaped.
  assert.ok(svg.includes('&lt;script&gt;') && svg.includes('&lt;foreignObject&gt;') && svg.includes('&lt;img'),
    'caption/text markup is escaped');
  assert.ok(/<title>&lt;script&gt;/.test(svg), 'hostile caption is escaped INSIDE the <title> tooltip');
  // The poisoned d must be dropped (charset), the poisoned fill must fall back to a palette hex.
  assert.ok(!svg.includes('L 10 10 '), 'poisoned path dropped');
  assert.ok(/<rect x="1" y="1" width="10" height="10" fill="#2b2b2b"\/>/.test(svg), 'poisoned fill falls back to palette ink');
}

// ── 5. Panel-count floor: <2 valid panels → svg:null (mutation-test the floor) ─
{
  assert.strictEqual(compose([goodPanel('only')]).svg, null, 'one panel → null');
  assert.strictEqual(compose([]).svg, null, 'zero panels → null');
  assert.strictEqual(compose('nonsense').svg, null, 'non-array → null');
  const junk = { caption: 'junk', shapes: [{ type: 'nope' }] };
  const r = compose([goodPanel('a'), junk]);
  assert.strictEqual(r.svg, null, 'a panel whose shapes ALL fail leaves only 1 valid → null');
  assert.strictEqual(r.stats.valid, 1, 'stats.valid reports the survivor count');
  const six = compose([1, 2, 3, 4, 5, 6].map(i => goodPanel('p' + i)));
  assert.strictEqual((six.svg.match(/<svg x=/g) || []).length, 5, 'panel cap: 6 requested → 5 rendered');
}

// ── 6. Generator contract: stamped with the STORY model, headroom + timeout ───
const gen = ext(server, 'generateStorylineStoryboard');
assert.ok(/Chapters\s*:.*Model:\s*\$\{OLLAMA_MODEL\}/.test(gen), 'console block names the model');
assert.ok(/buildGenMeta\(\{[\s\S]*type: 'storyline_storyboard'/.test(gen), 'stamped via buildGenMeta');
assert.ok(/model: OLLAMA_MODEL/.test(gen), 'stamps the STORY model (not the lesson model)');
assert.ok(/return \{ svg, meta \}/.test(gen), 'returns {svg, meta}');
assert.ok(/_callLLM\(OLLAMA_MODEL, sys, user, 6000, \{ timeoutMs: 3600000, think: false \}\)/.test(gen),
  'token headroom (spike hit the 4096 cap) + per-call 60min timeout (spike ran 30min at 2.2 tok/s) + think:false (v55_c: a live run burned all 6000 tokens inside the reasoning block → empty content)');
assert.ok(/salvageArray/.test(gen) && /extractArray/.test(gen), 'uses the llm.js JSON-salvage chain');
assert.ok(/PROMPTS\.storylineStoryboard/.test(gen), 'prompt lives in prompts.json');
// v55_b observability: a live run died with NOTHING after the header (toast-only 500). Guard:
// the generator logs response arrival BEFORE parsing + a raw excerpt on non-array, and the
// route catch logs the failure with elapsed time — a 30-min synchronous call must leave a corpse.
assert.ok(/Response : after \$\{_elapsed\}s/.test(gen), 'logs LLM response arrival before parsing');
assert.ok(/non-array JSON\. Raw starts:/.test(gen), 'logs a raw excerpt when the model returns non-array');
assert.ok(/Storyline storyboard FAILED after/.test(server), 'route catch logs failures server-side');
const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));
assert.ok(prompts.storylineStoryboard?.system && prompts.storylineStoryboard?.user, 'storylineStoryboard block present');
assert.ok(/NOT raw SVG|no SVG/i.test(prompts.storylineStoryboard.system), 'prompt forbids raw SVG');

// ── 7. Route: call site destructures and persists svg + stamp together ────────
const calls = server.match(/^.*await generateStorylineStoryboard\(.*$/gm) || [];
assert.strictEqual(calls.length, 1, `exactly one call site (got ${calls.length})`);
assert.ok(/\{ svg: storyboard, meta: storyboardMeta \}/.test(calls[0]), 'call site destructures {svg, meta}');
assert.ok(/sl\.storyboard = storyboard;\s*sl\.storyboardMeta = storyboardMeta;/.test(server),
  'persists the stamp beside the storyboard');
assert.ok(/return json\(res, 200, \{ storyboard \}\);/.test(server), 'route returns a plain string to the client');

// ── 7b. DELETE route + client toggle-menu wiring (v55_e) ──────────────────────
// DELETE /api/storyline-storyboard removes svg+meta, needs NO backend (you can always remove a
// picture), and is idempotent (absent → still 200).
assert.ok(/M === 'DELETE' && url\.pathname === '\/api\/storyline-storyboard'/.test(server), 'DELETE route exists');
const delRoute = server.slice(server.indexOf("M === 'DELETE' && url.pathname === '/api/storyline-storyboard'"));
assert.ok(/delete sl\.storyboard; delete sl\.storyboardMeta; upsertStoryline\(sl\)/.test(delRoute.slice(0, 700)),
  'DELETE removes both storyboard and its stamp, then persists');
assert.ok(!/active === 'none'/.test(delRoute.slice(0, 400)), 'DELETE does NOT require an LLM backend');
assert.ok(/return json\(res, 200, \{ ok: true \}\);/.test(delRoute.slice(0, 800)), 'DELETE is idempotent (always 200)');
// Client: ONE button dispatches — generate when empty, regenerate/delete menu when present.
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert.ok(/onclick="onStorylineStoryboardBtn\(\)"/.test(client), 'button calls the dispatcher, not genStorylineStoryboard directly');
assert.ok(/function onStorylineStoryboardBtn\(\)/.test(client), 'dispatcher exists');
assert.ok(/if \(!_slHasStoryboard\(\)\) \{ await genStorylineStoryboard\(\); return; \}/.test(client),
  'dispatcher generates when no storyboard exists');
assert.ok(/showChoiceDialog\(\{[\s\S]{0,200}storyboard\.regenerate/.test(client), 'menu offers regenerate');
assert.ok(/value: 'delete'[\s\S]{0,60}storyboard\.delete/.test(client), 'menu offers delete');
assert.ok(/method: 'DELETE'[\s\S]{0,200}\/api\/storyline-storyboard/.test(client)
       || /\/api\/storyline-storyboard'[\s\S]{0,120}method: 'DELETE'/.test(client), 'delete fn calls DELETE');
assert.ok(/delete APP\.storylines\[idx\]\.storyboard/.test(client), 'delete clears the client cache too');
const uiKeys = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8')).en;
for (const k of ['storyboard.regenerate', 'storyboard.delete', 'storyboard.deleted', 'storyboard.menu'])
  assert.ok(uiKeys[k], `ui.json en has ${k}`);

// ── 8. llm.js: per-call timeout override exists and is clamped ────────────────
const llm = fs.readFileSync(path.join(ROOT, 'llm.js'), 'utf8');
assert.ok(/opts\.timeoutMs/.test(llm), 'llm.js supports opts.timeoutMs');
assert.ok(/Math\.max\(30000, Math\.min\(3600000, Number\(opts\.timeoutMs\)\)\)/.test(llm), 'per-call timeout clamped 30s–60min');
assert.ok(/req\.setTimeout\(timeoutMs/.test(llm) && /reject\(new Error\('Ollama timeout'\)\), timeoutMs\)/.test(llm),
  'BOTH the socket timeout and the guard timer honor the per-call value');
// v55_c: think:false plumbing — sent only when requested, and callLLM falls back to a plain
// retry if the model rejects the parameter (so qwen2.5:7b keeps working as the story model).
assert.ok(/opts\.think === false \? \{ think: false \} : \{\}/.test(llm), 'think:false sent conditionally in the body');
assert.ok(/does not support thinking/i.test(llm) && /think: undefined/.test(llm),
  'callLLM retries without think on parameter rejection');

console.log('  storyboard: composer whitelist/clamp/escape/floor + stamp + route contract: OK');
console.log('unit-storyboard: ALL PASSED');
