// unit-static-markup-handlers.test.js — v91_f.
//
// ⚠️ EVERY INLINE `on*` HANDLER IN THE PUBLISHED BUILD MUST NAME A FUNCTION THAT BUILD DEFINES.
//
// `index.html` and `build-static.js` disagree about which functions exist: the `@static-exclude`
// region drops some, `build-static.js` replaces others with its own copies, and the MARKUP that
// references them travels into `docs/` untouched either way. So a button can ship to GitHub Pages
// wired to a function that is not in the bundle, and nothing notices until somebody clicks it.
//
// This has now happened repeatedly. `v90_j` (two library-sort handlers), `v91_e` (`_syncPillTitle`,
// which also broke `applyUIStrings` and with it most of the published UI's strings), and the audit
// after `v91_e` found five more still wired: `onContinueSelectChange`, `onTranslateSelectChange`,
// `clearContinuePin`, `onGenStatusClick`, `analyzeChaptersRun`.
//
// ⚠️ THOSE FIVE WERE NOT LIVE BUGS, and that is exactly why a guard is worth more than a fix. Each
// sits behind a hidden control — the two wizard selects are OUTSIDE `#gen-area`, so they become
// visible the instant the generation screen shows, and firing one really does throw
// (`Uncaught ReferenceError: onContinueSelectChange is not defined`, confirmed in a browser). What
// keeps them harmless is that no visible control routes to that screen. **That is an equilibrium
// held by CSS, not by design**: one `display:none` removed and they are live. A guard survives that
// change; a spot-fix does not.
//
// ⚠️ WHY THIS READS THE MARKUP AND `typeof`s IN THE REAL BUNDLE, rather than diffing declarations
// between the two files. The audit's own source-level scan was wrong in BOTH directions: it reported
// `_updateReinforcePriorVisibility`, which only appears inside an HTML comment, and it MISSED
// `analyzeChaptersRun` completely. Attributes are unambiguous, and `typeof` inside the loaded bundle
// is the definition of "does this build have it".
//
// ⚠️ SCOPE, stated rather than implied: this covers handlers present in the built file's MARKUP.
// Handlers written into strings by renderers (`walkForTitle`'s ⚓/🔍 buttons, say) are not visible
// here — those are gated on `APP.info.canGenerate`, which is false in the published build, and the
// audit verified them unreachable. Extending to rendered markup means driving each renderer, which
// is a different and much larger test.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const STATIC = path.join(ROOT, 'docs', 'index.html');
assert.ok(fs.existsSync(STATIC), 'docs/index.html exists — run `node build-static.js` first');
const html = fs.readFileSync(STATIC, 'utf8');

// ⚠️ TWO THINGS ARE STRIPPED FIRST, and skipping either produces false positives that would make
// this file untrustworthy — both were observed on its first run:
//   1. HTML COMMENTS. They travel into docs/ and discuss function names in prose. This is exactly
//      the false positive the post-`v91_e` audit's own scan produced.
//   2. THE INLINE <script>. It contains template literals that LOOK like handler attributes —
//      `onclick="qcRun({topicId:'${d.id}'…})"` inside a renderer — plus local closures (`f(`).
//      Those are RENDERED markup, not markup, and they are out of this file's stated scope: they
//      are gated on `APP.info.canGenerate` (false in the published build) and the audit verified
//      them unreachable. Scanning them here reported four names that are not defects.
const markup = html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ');

// Every inline handler attribute, and the identifiers each one CALLS.
const ATTR = /\son(?:click|change|input|focus|blur|mouseenter|mouseleave|submit|keydown|keyup)\s*=\s*"([^"]*)"/gi;
// Names that are language constructs or provided by the browser, not by this bundle.
const BUILTIN = new Set(['return', 'if', 'for', 'while', 'switch', 'catch', 'typeof', 'new', 'void',
  'delete', 'this', 'event', 'alert', 'confirm', 'prompt', 'setTimeout', 'setInterval', 'Number',
  'String', 'Boolean', 'Array', 'Object', 'JSON', 'Math', 'Date', 'RegExp', 'parseInt', 'parseFloat']);

const wanted = new Map();   // fn -> one example attribute value, for the failure message
for (const m of markup.matchAll(ATTR)) {
  const body = m[1];
  for (const c of body.matchAll(/(?:^|[;{}(,&|!?:=\s])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = c[1];
    if (BUILTIN.has(name)) continue;
    if (!wanted.has(name)) wanted.set(name, body.slice(0, 70));
  }
}
assert.ok(wanted.size > 15,
  `non-vacuity: found only ${wanted.size} handler functions in the published markup — the attribute ` +
  'scan has probably broken rather than the build having become that small');

// `typeof` each one INSIDE the published bundle. loadClient evaluates the real script (minus the
// live bootstrap), so this is the build's own answer, not a guess from source.
const C = loadClient({ file: STATIC, quiet: true });
const missing = [];
for (const [name, example] of wanted) {
  const t = C.run(`(function(){ try { return typeof ${name}; } catch(e){ return 'undefined'; } })()`, 'chk');
  if (t === 'undefined') missing.push({ name, example });
}

assert.deepStrictEqual(missing.map(m => m.name), [],
  '⚠️ The PUBLISHED build wires markup to function(s) it does not define:\n' +
  missing.map(m => `    ${m.name}()  —  on="${m.example}"`).join('\n') +
  '\n  Clicking or changing that control throws a ReferenceError on GitHub Pages.\n' +
  '  Fix ONE of these ways, in order of preference:\n' +
  '   1. if both builds need the behaviour, MOVE the function below @static-exclude-end;\n' +
  '   2. if the static build genuinely has nothing to do, add a no-op stub in build-static.js\n' +
  '      (its existing pattern, e.g. `function triggerUITranslation(){}`);\n' +
  '   3. if the control should not exist there at all, stop emitting the markup.\n' +
  '  Do NOT rely on the control being hidden — that is CSS, and it changes.');

console.log(`  all ${wanted.size} inline markup handlers in the published build resolve to a defined function: OK`);
console.log('unit-static-markup-handlers: ALL PASSED');
