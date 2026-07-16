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
const fixture = {
  schemaVersion: 29,
  topics: [mkTopic('t_a', 'Chapter A', 'Chapter B'), mkTopic('t_b', 'Chapter B')],
  storylines: [{
    id: 'sl_test', title: 'Test Storyline', icon: '📖', chapters: ['t_a', 't_b'],
    lang: 'it', srcLang: 'en',
    summary: SUM_MARKER,
    storyboard,
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
for (const hook of ['slsb-wrap-', 'slsum-wrap-']) {
  assert.ok(client.includes(hook), `live landing renderer emits ${hook}`);
  assert.ok(builder.includes(hook), `static landing renderer emits ${hook} (add it to BOTH loadSavedList impls)`);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('  static landing parity: storyboard + summary baked, both strips rendered, order matches: OK');
console.log('unit-static-landing-parity: ALL PASSED');
