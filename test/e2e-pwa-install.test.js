// e2e-pwa-install.test.js
// PWA install support (v84_b, user request: "how hard would it be" -> "should i start a new session
// or could you do it" -> built in the same session). Adds a manifest + service worker so a browser
// can offer "Install App" (windowed, no tabs/omnibox) for the LOCAL server only — the static GitHub
// Pages build is deliberately excluded (see index.html's own comment, right by
// `// @static-engine-end`); extending that is a separate, unbuilt follow-up.
//
// ⚠️ WHAT THIS FILE DOES NOT PROVE: that a real browser actually REGISTERS the service worker.
// Registration was attempted in the available preview browser and failed with Chrome's generic
// "An unknown error occurred when fetching the script" — but the SAME file, fetched the SAME way a
// browser would (plain `fetch()`, correct MIME type, no redirects, same Transfer-Encoding the
// already-working `/` route uses), came back byte-correct every time, and the server never even
// logged a request for the attempts, meaning the failure happened before any network call — strong
// evidence this is the sandboxed preview browser restricting Service Worker registration for
// isolation reasons, not a bug in what is served. Still UNVERIFIED, not disproven: a real user needs
// to open this in a real browser (DevTools -> Application -> Service Workers, or the install icon in
// the address bar) before this claim can be called measured rather than reasoned-through.
'use strict';
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { boot, get } = require('./lib.js');

// A raw fetch that exposes response HEADERS too, since test/lib.js's get() only parses/returns a
// JSON body (or null + raw text) -- Content-Type correctness genuinely matters here (a real browser
// requires a JavaScript MIME type to register a service worker), so it needs its own check.
function getRaw(port, p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: p }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    }).on('error', reject);
  });
}

(async () => {
  const s = await boot({});
  try {
    // ── 1. /manifest.json — served, valid JSON, carries the fields a browser needs to install ──
    const mres = await get(s.sport, '/manifest.json');
    assert.strictEqual(mres.status, 200, '/manifest.json responds 200');
    const manifest = mres.body;
    assert.ok(manifest, '/manifest.json body parses as JSON');
    for (const field of ['name', 'short_name', 'start_url', 'display', 'icons']) {
      assert.ok(field in manifest, `manifest.json has "${field}"`);
    }
    assert.strictEqual(manifest.display, 'standalone', 'display:standalone -- windowed, no tabs/omnibox');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest.json declares at least one icon');
    const iconSrc = manifest.icons[0].src;
    assert.ok(iconSrc, 'the declared icon has a src');

    // ── 2. The icon manifest.json points at actually resolves and serves as an image ────────────
    const ires = await getRaw(s.sport, iconSrc);
    assert.strictEqual(ires.status, 200, `the icon at ${iconSrc} responds 200`);
    assert.ok(/image\//.test(ires.headers['content-type'] || ''), `the icon's Content-Type is an image type (got "${ires.headers['content-type']}")`);
    assert.ok(ires.body.trim().startsWith('<svg'), 'the icon file is a real SVG, not a stub/placeholder');

    // ── 3. /sw.js — served with a real JavaScript MIME type ───────────────────────────────────
    // A browser will refuse to register a service worker whose response Content-Type isn't a
    // JavaScript type, regardless of whether the file content is otherwise fine.
    const sres = await getRaw(s.sport, '/sw.js');
    assert.strictEqual(sres.status, 200, '/sw.js responds 200');
    assert.ok(/javascript/.test(sres.headers['content-type'] || ''), `/sw.js Content-Type is a JS type (got "${sres.headers['content-type']}")`);
    const swSourceOnDisk = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    assert.strictEqual(sres.body, swSourceOnDisk, '/sw.js serves the exact file on disk, byte for byte');

    // ── 4. sw.js only ever intercepts the app SHELL — never /api/* ────────────────────────────
    // Runtime service-worker behaviour can't be exercised in this Node-only harness (no real
    // browser in the automated suite) -- so this checks the STRUCTURE that makes over-broad
    // interception impossible by construction: the fetch handler's allow-list is a literal array
    // with no api path in it, and every request is checked against that array before being
    // intercepted at all.
    // Stripped of comments first -- sw.js's own explanatory header PROSE mentions "/api/" while
    // explaining why it's excluded, which would make a naive substring check match the comment
    // instead of any actual routing code (the exact over-broad-assertion trap this project's own
    // standing rules warn about).
    const swCode = swSourceOnDisk.replace(/\/\/.*$/gm, '');
    assert.ok(!/\/api\//.test(swCode), 'sw.js CODE (comments stripped) never mentions an /api/ path -- nothing routes API calls through the cache');
    assert.ok(/const SHELL = \[.*\]/.test(swSourceOnDisk), 'sw.js declares a literal SHELL allow-list');
    assert.ok(/SHELL\.includes\(url\.pathname\)/.test(swSourceOnDisk),
      'the fetch handler gates on SHELL.includes(...) -- anything not in the literal list is left untouched, by construction');

    // ── 5. index.html (the LIVE client) wires the manifest link, theme-color, and registration ──
    const hres = await get(s.sport, '/');
    assert.ok(/<link rel="manifest" href="\/manifest\.json">/.test(hres.raw), 'index.html links the manifest');
    assert.ok(/<meta name="theme-color"/.test(hres.raw), 'index.html sets a theme-color');
    assert.ok(/navigator\.serviceWorker\.register\('\/sw\.js'\)/.test(hres.raw), 'index.html registers the service worker');
    assert.ok(/if \('serviceWorker' in navigator\)/.test(hres.raw), 'registration is feature-detected, not assumed');
    assert.ok(/\.register\('\/sw\.js'\)\.catch\(\(\) => \{\}\)/.test(hres.raw),
      'a failed registration is caught silently -- PWA installability is a bonus, never a user-facing error');

    // ── 6. The static GitHub Pages build (docs/index.html) does NOT register a service worker ──
    // Deliberate v1 scope: docs/ carries no /sw.js or /manifest.json (build-static.js copies
    // neither), so registering there would just 404 for no benefit. The registration call lives
    // below index.html's own `@static-engine-end` marker, the same marker init() itself is below,
    // which build-static.js's own slicer already excludes -- checked here as a real property of the
    // shipped artifact, not just of the marker's position in the source.
    const docsPath = path.join(ROOT, 'docs', 'index.html');
    if (fs.existsSync(docsPath)) {
      const docsHtml = fs.readFileSync(docsPath, 'utf8');
      assert.ok(!/navigator\.serviceWorker\.register/.test(docsHtml),
        'docs/index.html (the static build) must not attempt to register a service worker it cannot serve');
      // The manifest LINK tag is fine to leave in (outside the sliced <script>, harmless 404 if the
      // browser tries to fetch it) -- only the registration call is required to be gone.
    }
  } finally {
    s.stop();
  }
  console.log('  manifest.json, sw.js, icon.svg all served with correct content/MIME types: OK');
  console.log('  sw.js structurally never intercepts /api/* -- allow-list gates every interception: OK');
  console.log('  index.html (live) registers the SW with a silent catch; docs/index.html (static) does not: OK');
  console.log('  ⚠️ NOT proven here: that a real browser actually completes registration -- see this file\'s own header note');
  console.log('e2e-pwa-install: ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
