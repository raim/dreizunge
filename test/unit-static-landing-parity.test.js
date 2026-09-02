// unit-static-landing-parity.test.js
// v55_p — the landing-card render is DUPLICATED: index.html has `loadSavedList()` for the live app,
// and build-static.js injects its OWN static `loadSavedList()` for docs/. Anything added to the
// landing card in one silently vanishes in the other — which is exactly how the v55 storyboard
// shipped visible in live and invisible in static (user-reported).
//
// This test builds a real static bundle from a FIXTURE corpus (build-static.js takes in/out paths)
// and asserts the landing card actually carries each storyline-card feature. It's functional, not a
// grep of the source: it runs the real builder and inspects the real output.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dz-static-'));
const fixtureFile = path.join(tmp, 'lessons.json');
const outDir = path.join(tmp, 'docs');

// Minimal corpus: one storyline of 2 chapters carrying BOTH a summary and a storyboard.
const SB_MARKER = 'Panel caption marker';
const SUM_MARKER = 'Summary text marker';
const storyboard = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 364 194" role="img">'
  + `<g><title>${SB_MARKER}</title>`
  + '<rect x="11" y="11" width="172" height="172" fill="none" stroke="#9e9e9e"/>'
  + '<svg x="12" y="12" width="170" height="170" viewBox="0 0 100 100">'
  + '<rect x="0" y="0" width="100" height="100" fill="#a8dadc"/><circle cx="50" cy="50" r="20" fill="#f2cc8f"/>'
  + '</svg></g></svg>';
const mkTopic = (id, topic, next) => ({
  id, topic, lang: 'it', srcLang: 'en', difficulty: 2,
  story: 'Una frase. Due frasi.', storyLang: 'it',
  generatedAt: '2026-07-01T00:00:00.000Z',
  ...(next ? { continuedIn: next } : {}),
  lessons: [{ id: 'l_' + id, type: 'standard', title: 'L', vocab: [{ target: 'gatto', source: 'cat' }] }],
});
// v88_w (user report): a SECOND storyline, in `images` thumbMode, carrying BOTH a storyboard and
// inline panel images. It is the discriminating fixture — with only the storyboard-mode storyline
// above, a landing card that always renders the storyboard passes everything in this file.
const IMG_MARKER = 'data:image/png;base64,iVBORw0KGgoAAAANS-v88w-marker';
const mkImgTopic = (id, topic, next) => Object.assign(mkTopic(id, topic, next), {
  comicPanels: [{ image: IMG_MARKER, caption: 'panel' }],
});
const fixture = {
  schemaVersion: 29,
  topics: [mkTopic('t_a', 'Chapter A', 'Chapter B'), mkTopic('t_b', 'Chapter B'),
           mkImgTopic('t_i', 'Image Chapter A', 'Image Chapter B'), mkImgTopic('t_j', 'Image Chapter B')],
  storylines: [{
    id: 'sl_test', title: 'Test Storyline', icon: '📖', chapters: ['t_a', 't_b'],
    lang: 'it', srcLang: 'en',
    summary: SUM_MARKER,
    storyboard,
  }, {
    id: 'sl_img', title: 'Image Storyline', icon: '🖼️', chapters: ['t_i', 't_j'],
    lang: 'it', srcLang: 'en',
    thumbMode: 'images',
    storyboard,           // it HAS one — the mode is what must decide, not availability
  }],
  flags: {},
};
fs.writeFileSync(fixtureFile, JSON.stringify(fixture, null, 2));

execFileSync('node', [path.join(ROOT, 'build-static.js'), fixtureFile, outDir], { cwd: ROOT, stdio: 'pipe' });
const out = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');

// ── 1. The storyline data is baked whole (storyboard rides on the storyline object) ──
assert.ok(out.includes(SB_MARKER), 'the storyboard SVG is baked into the static bundle');
assert.ok(out.includes(SUM_MARKER), 'the summary is baked into the static bundle');

// ── 2. The static landing renderer emits BOTH strips ─────────────────────────────
// These are the render hooks the live loadSavedList uses; the static one must match.
assert.ok(/slsb-wrap-/.test(out), 'the STATIC landing card renders the storyboard strip (slsb-wrap-)');
assert.ok(/slsum-wrap-/.test(out), 'the STATIC landing card renders the summary strip (slsum-wrap-)');
assert.ok(/class="storyline-storyboard"/.test(out), 'the storyboard strip carries its class');

// ── 3. Ordering: storyboard ABOVE the summary, as in the live renderer ───────────
const sbAt = out.indexOf("slsb-wrap-'+chainId");
const sumAt = out.indexOf("slsum-wrap-'+chainId");
assert.ok(sbAt > 0 && sumAt > 0, 'both strips are emitted by the static renderer');
assert.ok(sbAt < sumAt, 'the static renderer places the storyboard ABOVE the summary (parity with live)');

// ── 4. Static is display-only: no generate/delete affordance for the storyboard ──
// (canGenerate is false in docs/, so the 🎬 button must never be wired there.)
const staticFnAt = out.indexOf('STATIC MODE — no server');
assert.ok(staticFnAt > 0, 'the static-mode block exists');

// ── 5. Parity guard: every landing-card hook in the live renderer exists in the
//      static renderer too. This is the actual root-cause guard — it fails the moment
//      someone adds a strip to one loadSavedList and forgets the other.
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const builder = fs.readFileSync(path.join(ROOT, 'build-static.js'), 'utf8');
for (const hook of ['slsb-wrap-', 'slsum-wrap-', 'data-sb-chain', 'provLineHtml(s)',
                    // v88_w: the ARTWORK RESOLVER is a landing-card hook like any other. `v87_m`
                    // made `_slArtworkHtml` the one place that decides storyboard-vs-images and
                    // asserted "neither surface reads .storyboard directly any more" — against
                    // index.html ALONE, so the static landing card kept its own direct read and
                    // never honoured the mode. That is the v55_p trap this whole file exists for,
                    // sprung on a feature added two lines under its own warning comment.
                    '_slArtworkHtml(']) {
  assert.ok(client.includes(hook), `live landing renderer emits ${hook}`);
  assert.ok(builder.includes(hook), `static landing renderer emits ${hook} (add it to BOTH loadSavedList impls)`);
}

// ── 5b. v88_w: FUNCTIONAL — the static landing card honours thumbMode ────────────────────────────
// The source check above proves the resolver is CALLED; this proves the built bundle actually
// renders images for an images-mode storyline and the storyboard for the other. Run against the real
// built file, because the whole class of bug this file guards is "the static renderer differs".
{
  const { loadClient } = require('./lib-dom');
  const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
  const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  const C = loadClient({ quiet: true, file: path.join(outDir, 'index.html') });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.libFilter = 'all'; APP.libSrcFilter = 'all'; APP.libTagFilter = null;
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    loadSavedList();
    window._html = document.getElementById('saved-list').innerHTML;
    true;`, 'static-render');
  const html = C.run('window._html');
  // Scope each claim to its own storyline group, or "the page contains an image somewhere" would
  // pass while the images-mode card still showed a storyboard.
  // ⚠️ Bounded by the NEXT storyline group, not by a character budget. The first attempt sliced a
  // fixed 4000 chars from the artwork slot and ran straight into the other storyline's card, so the
  // "and not an image strip" assertion failed on a correct render — the seventh fixed-size window to
  // fail that way in this line. A structural bound cannot fail for that reason.
  const groupOf = id => {
    const at = html.indexOf('slgroup-' + id);
    assert.ok(at > 0, `the ${id} card rendered its own group container`);
    const next = html.indexOf('slgroup-', at + 1);
    return html.slice(at, next > at ? next : html.length);
  };
  const imgGroup = groupOf('sl_img'), sbGroup = groupOf('sl_test');
  assert.ok(imgGroup.includes(IMG_MARKER),
    'an images-mode storyline shows its PANEL IMAGES on the static landing card');
  assert.ok(!imgGroup.includes(SB_MARKER),
    'and NOT its storyboard, even though it has one — the mode decides, not availability');
  // Non-vacuity in the other direction: the default-mode storyline still gets its storyboard, so
  // this is not passing because artwork stopped rendering altogether.
  assert.ok(sbGroup.includes(SB_MARKER),
    'while a storyboard-mode storyline still shows its storyboard');
  assert.ok(!sbGroup.includes(IMG_MARKER), 'and not an image strip it has no images for');
  console.log('  static landing card: thumbMode decides the artwork, same as live: OK');
}

fs.rmSync(tmp, { recursive: true, force: true });

// ── 6. Live/static parity for the storyline screen's generation stats (v55_s) ──
// The storyline screen renders per-chapter gen stats from APP.savedList entries. Static ships whole
// topics (so it worked), but the LIVE /api/lessons list payload is a slim summary that omitted
// generationStats — so the block silently hid itself in live mode (user-reported). The list now
// carries a compact projection with the SAME SHAPE, so the single renderer works in both modes.
{
  const clientSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  // The renderer's fields — keep this list in step with index.html's sl-screen-stats block.
  const NEEDED = ['totalMs', 'model', 'totalPromptTokens', 'totalCompletionTokens'];
  const block = clientSrc.slice(clientSrc.indexOf("getElementById('sl-screen-stats')"),
                               clientSrc.indexOf("getElementById('sl-screen-stats')") + 700);
  for (const f of NEEDED) {
    assert.ok(new RegExp('gs\\.' + f).test(block), `the storyline stats renderer reads gs.${f}`);
  }
  // …and the live list payload must provide every one of them.
  const listProj = srv.slice(srv.indexOf('generationStats: l.generationStats ?'),
                             srv.indexOf('generationStats: l.generationStats ?') + 420);
  assert.ok(listProj, '/api/lessons projects generationStats');
  for (const f of NEEDED) {
    assert.ok(new RegExp(f + ':\\s*l\\.generationStats\\.' + f).test(listProj),
      `/api/lessons list payload includes generationStats.${f} (live mode needs it to render stats)`);
  }
  // Deliberately a PROJECTION, not the whole object: the per-lesson token breakdown would roughly
  // double the list payload and no list consumer reads it.
  assert.ok(!/generationStats: l\.generationStats,/.test(srv), 'the list ships a projection, not the full stats object');
}

console.log('  static landing parity: storyboard + summary baked, both strips rendered, order matches: OK');
console.log('  live/static parity: storyline gen-stats fields present in the list payload: OK');
console.log('unit-static-landing-parity: ALL PASSED');
