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

// The composer is deliberately self-contained (helpers nested) so it can run pure here — except
// for the v55_r colour schemes, which live at module scope (the routes and /api/info need them
// too). Pull those consts in alongside it.
const schemeConsts = (server.match(/const STORYBOARD_SCHEMES = \{[\s\S]*?\n\};/) || [])[0]
  + '\n' + (server.match(/const STORYBOARD_SCHEME_DEFAULT = '[a-z]+';/) || [])[0];
assert.ok(/STORYBOARD_SCHEMES/.test(schemeConsts) && /SCHEME_DEFAULT/.test(schemeConsts), 'scheme consts found');
const compose = new Function(schemeConsts + '\n' + ext(server, 'composeStoryboardSVG') + '\nreturn composeStoryboardSVG;')();
const SCHEMES = new Function(schemeConsts + '\nreturn STORYBOARD_SCHEMES;')();

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
  // v55_t: the canvas is a FIXED 5-panel size regardless of count (922 = 5*(170+12)+12, 194 = 170+2*12),
  // so a 2-panel board's panels render exactly as large as a 5-panel board's — before, `max-width`
  // tracked the count and MORE panels came out SMALLER.
  assert.ok(/viewBox="0 0 922 194"/.test(svg), 'canvas is the fixed 5-panel size (922x194)');
  assert.ok(/max-width:922px/.test(svg), 'max-width matches the fixed canvas, not the panel count');
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
  // Look ONLY at the shapes drawn inside the first panel's nested <svg> — i.e. after that tag's
  // '>' and before its close. The panel's own x/y/width/height are LAYOUT, not shape coords, and
  // since v55_t the strip is centred so those offsets vary with the panel count.
  const openEnd = svg.indexOf('>', svg.indexOf('<svg x=')) + 1;
  const inner = svg.slice(openEnd, svg.indexOf('</svg>', openEnd));
  const nums = [...inner.matchAll(/(?:x|y|cx|cy|r|width|height|x1|y1|x2|y2)="(-?[\d.e+]+)"/g)]
    .map(m => Number(m[1]));
  assert.ok(nums.length, 'shape coordinates found inside the panel');
  assert.ok(nums.every(n => n >= 0 && n <= 100), 'every shape coordinate is clamped into the 0–100 panel viewBox');
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
// v55_v: the header must also name WHICH storyline — a sweep otherwise logs identical blocks.
assert.ok(/Storyline: \$\{slTitle/.test(gen), 'console block names the storyline');
assert.ok(/slId, slTitle: \(findStoryline\(slId\) \|\| \{\}\)\.title/.test(server), 'route passes the storyline id + title');
assert.ok(/buildGenMeta\(\{[\s\S]*type: 'storyline_storyboard'/.test(gen), 'stamped via buildGenMeta');
assert.ok(/model: OLLAMA_MODEL/.test(gen), 'stamps the STORY model (not the lesson model)');
assert.ok(/return \{ svg, panels, scheme, meta \}/.test(gen), 'returns {svg, panels, scheme, meta} (panels enable free re-colouring)');
// v55_r: the artwork should match how the story READS — the chapters' writing style is fed to the
// prompt using the SAME vocabulary the story generator uses (PROMPTS.storyStyles via getStoryStyle).
assert.ok(/getStoryStyle\(storyStyle\)/.test(gen), 'generator resolves the story style note');
assert.ok(/Match the story's tone in the artwork/.test(gen), 'the style note is appended to the system prompt');
assert.ok(/meta\.storyStyle = storyStyle \|\| null;/.test(gen), 'the stamp records which style was used');
assert.ok(/composeStoryboardSVG\(panels, scheme\)/.test(gen), 'composes with the requested scheme');
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
const calls = server.match(/await generateStorylineStoryboard\(/g) || [];
assert.strictEqual(calls.length, 1, `exactly one call site (got ${calls.length})`);
assert.ok(/\{ svg: storyboard, panels, scheme: usedScheme, meta: storyboardMeta \}\s*=\s*\n?\s*await generateStorylineStoryboard\(/.test(server),
  'call site destructures {svg, panels, scheme, meta}');
assert.ok(/sl\.storyboard = storyboard;\s*sl\.storyboardMeta = storyboardMeta;/.test(server),
  'persists the stamp beside the storyboard');
assert.ok(/return json\(res, 200, \{ storyboard, scheme: usedScheme \}\);/.test(server), 'route returns a plain string to the client');

// ── 7b. DELETE route + client toggle-menu wiring (v55_e) ──────────────────────
// DELETE /api/storyline-storyboard removes svg+meta, needs NO backend (you can always remove a
// picture), and is idempotent (absent → still 200).
assert.ok(/M === 'DELETE' && url\.pathname === '\/api\/storyline-storyboard'/.test(server), 'DELETE route exists');
const delRoute = server.slice(server.indexOf("M === 'DELETE' && url.pathname === '/api/storyline-storyboard'"));
assert.ok(/delete sl\.storyboard; delete sl\.storyboardMeta;[\s\S]{0,80}upsertStoryline\(sl\)/.test(delRoute.slice(0, 800)),
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

// ── 10. Fixed canvas + centred strip, whatever the panel count (v55_t) ────────
{
  const p = { caption: 'c', bg: 'sky', shapes: [{ type: 'rect', x: 0, y: 60, w: 100, h: 40, fill: 'leaf' }] };
  const PANEL = 170, GAP = 12, W = 5 * (PANEL + GAP) + GAP;
  let firstVb = null;
  for (const n of [2, 3, 4, 5]) {
    const { svg } = compose(Array(n).fill(p), 'classic');
    const vb = svg.match(/viewBox="([^"]+)"/)[1];
    // Same canvas for every count — this is what keeps the rendered height (and panel size) constant.
    if (firstVb === null) firstVb = vb;
    assert.strictEqual(vb, firstVb, `${n} panels: canvas identical to other counts`);
    assert.strictEqual(vb, `0 0 ${W} 194`, `${n} panels: canvas is the fixed 5-panel size`);
    assert.ok(svg.includes(`max-width:${W}px`), `${n} panels: max-width is the fixed canvas`);
    // The strip is centred: equal empty space either side.
    const xs = [...svg.matchAll(/<svg x="(\d+)"/g)].map(m => +m[1]);
    assert.strictEqual(xs.length, n, `${n} panels rendered`);
    const left = xs[0], right = W - (xs[xs.length - 1] + PANEL);
    assert.ok(Math.abs(left - right) <= 1, `${n} panels: strip centred (left ${left} ≈ right ${right})`);
    // Panels are evenly spaced by exactly one GAP.
    for (let i = 1; i < xs.length; i++) {
      assert.strictEqual(xs[i] - xs[i - 1], PANEL + GAP, `${n} panels: even spacing at ${i}`);
    }
    // Nothing spills outside the canvas.
    assert.ok(left >= 0 && right >= 0, `${n} panels: strip fits inside the canvas`);
  }
  // A full board keeps the original 12px margin (i.e. the fixed canvas is exactly the 5-panel size).
  const five = compose(Array(5).fill(p), 'classic').svg;
  assert.ok(/<svg x="12"/.test(five), '5 panels start at the original 12px margin');
}

console.log('  storyboard: composer whitelist/clamp/escape/floor + stamp + route contract: OK');

// ── 9. Colour schemes (v55_r) ─────────────────────────────────────────────────
// A scheme is an alternative hex map for the SAME palette names, so the model's colour vocabulary
// (and thus the prompt and the whitelist guarantees) is unchanged. Every scheme must therefore
// define exactly the same keys — a missing key would silently fall back mid-drawing.
{
  const names = Object.keys(SCHEMES);
  assert.ok(names.length >= 2, 'at least two schemes exist');
  assert.ok(names.includes('classic'), 'the default scheme exists');
  const keyset = Object.keys(SCHEMES.classic).sort().join(',');
  for (const n of names) {
    assert.strictEqual(Object.keys(SCHEMES[n]).sort().join(','), keyset, `scheme '${n}' defines the same palette keys`);
    assert.strictEqual(SCHEMES[n].none, 'none', `scheme '${n}' keeps none='none' (the no-fill sentinel)`);
    for (const [k, v] of Object.entries(SCHEMES[n])) {
      if (k === 'none') continue;
      assert.ok(/^#[0-9a-f]{6}$/i.test(v), `scheme '${n}'.${k} is a plain hex colour (got ${v})`);
    }
  }

  const panel = { caption: 'c', bg: 'sky', shapes: [
    { type: 'rect', x: 0, y: 60, w: 100, h: 40, fill: 'leaf' },
    { type: 'circle', cx: 80, cy: 18, r: 10, fill: 'sun' },
  ]};
  // Each scheme actually paints with ITS OWN hexes…
  for (const n of names) {
    const { svg } = compose([panel, panel], n);
    assert.ok(svg, `scheme '${n}' composes`);
    assert.ok(svg.includes(SCHEMES[n].sky), `scheme '${n}' uses its own sky colour`);
    assert.ok(svg.includes(SCHEMES[n].leaf), `scheme '${n}' uses its own leaf colour`);
  }
  // …and an unknown/absent scheme falls back to the default rather than throwing or emitting junk.
  // NOTE '__proto__'/'constructor' are the interesting cases: a bare MAP[k] lookup finds inherited
  // Object.prototype members, so a bogus scheme name used to pass the route's truthiness check and
  // produce an all-undefined palette. Own-property lookups only (v55_r).
  for (const bogus of ['nope', '', null, undefined, '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    const { svg } = compose([panel, panel], bogus);
    assert.ok(svg && svg.includes(SCHEMES.classic.sky), `unknown scheme ${JSON.stringify(bogus)} → classic fallback`);
  }
  // The COLOUR whitelist has the same trap: a model emitting fill:"constructor" must NOT resolve to
  // an inherited member (it emitted fill="function Object() { [native code] }" before the fix).
  // Every emitted fill/stroke must be a real palette hex or 'none' — nothing else, ever.
  {
    const hostile = { caption: 'x', bg: '__proto__', shapes: [
      { type: 'rect', x: 1, y: 1, w: 9, h: 9, fill: 'constructor' },
      { type: 'circle', cx: 5, cy: 5, r: 3, fill: '__proto__' },
      { type: 'circle', cx: 9, cy: 9, r: 2, fill: 'toString', stroke: 'hasOwnProperty' },
    ]};
    const { svg } = compose([hostile, panel], 'classic');
    assert.ok(svg, 'composes despite hostile colour names');
    const allowed = new Set([...Object.values(SCHEMES.classic)]);
    for (const m of svg.matchAll(/(?:fill|stroke)="([^"]*)"/g)) {
      assert.ok(allowed.has(m[1]), `emitted colour must be a palette value, got: ${JSON.stringify(m[1])}`);
    }
    assert.ok(!/\[object Object\]|native code/.test(svg), 'no inherited Object member leaks into the SVG');
  }
  // Re-composing the SAME panels under two schemes differs only in colour → the panel count and
  // structure are identical (this is what makes re-colouring safe to do without the model).
  const a = compose([panel, panel], 'classic').svg, b = compose([panel, panel], 'night').svg;
  assert.notStrictEqual(a, b, 'different schemes produce different SVGs');
  assert.strictEqual((a.match(/<svg x=/g) || []).length, (b.match(/<svg x=/g) || []).length, 'same panel count across schemes');
}

// Re-colour route: no model, no backend requirement, validates the scheme, needs stored panels.
const schemeRoute = server.slice(server.indexOf("url.pathname === '/api/storyline-storyboard/scheme'"),
                                 server.indexOf("M === 'DELETE' && url.pathname === '/api/storyline-storyboard'"));
assert.ok(/if \(!Object\.prototype\.hasOwnProperty\.call\(STORYBOARD_SCHEMES, scheme\)\) return json\(res, 400/.test(schemeRoute),
  're-colour validates the scheme name with an OWN-property check (a bare lookup lets __proto__ through)');
assert.ok(/composeStoryboardSVG\(sl\.storyboardPanels, scheme\)/.test(schemeRoute), 're-colour re-composes the STORED panels (no model call)');
assert.ok(!/_callLLM|generateStorylineStoryboard/.test(schemeRoute), 're-colour never calls the model');
assert.ok(!/active === 'none'/.test(schemeRoute), 're-colour needs no LLM backend');
assert.ok(/predates colour schemes/.test(schemeRoute), 'pre-v55_r storyboards get an explicit "regenerate" message, not a silent failure');
// Generation persists the panels + scheme; delete clears them (no orphaned panels).
assert.ok(/sl\.storyboardPanels = panels;/.test(server) && /sl\.storyboardScheme = usedScheme;/.test(server),
  'generate persists panels + scheme');
assert.ok(/delete sl\.storyboardPanels; delete sl\.storyboardScheme;/.test(server), 'delete clears panels + scheme too');
// The client must NOT hardcode the scheme list (parity): it reads /api/info.
assert.ok(/storyboardSchemes: Object\.keys\(STORYBOARD_SCHEMES\)/.test(server), '/api/info exposes the scheme names');
const client2 = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert.ok(/APP\.info && APP\.info\.storyboardSchemes/.test(client2), 'the client reads the scheme list from /api/info');
for (const n of Object.keys(SCHEMES)) {
  assert.ok(!new RegExp(`['"]${n}['"]\\s*,\\s*['"]`).test(client2.slice(client2.indexOf('function pickStoryboardScheme'), client2.indexOf('function pickStoryboardScheme') + 900)),
    `the client does not hardcode scheme '${n}'`);
}
console.log(`  storyboard schemes: ${Object.keys(SCHEMES).join(', ')} — key parity, own colours, fallback, free re-colour: OK`);
console.log('unit-storyboard: ALL PASSED');
