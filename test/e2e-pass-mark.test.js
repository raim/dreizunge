// e2e-pass-mark.test.js
// v69_i — pass marks per STORYLINE and per CHAPTER (user request):
//   "pass mark can be set on storyline page, it should also only be valid for that story line,
//    default 80%" + "add a chapter-specific Pass mark that overrides the storyline pass mark to
//    the lesson-set page, above the lessons chain."
//
// Resolution is most-specific-first: chapter → its storyline → global default (80%). An absent
// value at a level means INHERIT, which is deliberately different from 0 ("no pass mark at all,
// anything completes") — so clearing must REMOVE the field, not set it to zero.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { boot, post, get, sleep, assert } = require('./lib');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// ── 1. Client wiring ─────────────────────────────────────────────────────────
{
  // One control, two mount points — the storyline screen and above the lesson chain.
  assert(/function passMarkRowHtml\(scope, id, own, inherited\)/.test(html), 'a single control renders both scopes');
  assert(/id="sl-passmark"/.test(html), 'the storyline screen has a slot');
  assert(/id="ls-passmark"/.test(html), 'the lesson-set page has a slot');
  // "above the lessons chain": the chapter slot must precede the path list in the document.
  const lsAt = html.indexOf('id="ls-passmark"');
  const pathAt = html.indexOf('id="path"');
  assert(lsAt > 0 && (pathAt < 0 || lsAt < pathAt), 'the chapter control sits above the lesson chain');
  // Teacher-only: a learner must never see (or set) a pass mark.
  assert(/function passMarkRowHtml[\s\S]{0,200}if\(!_canEdit\(\)\) return '';/.test(html),
    'the control renders only for teachers');
  // Inheritance must be visible, or a teacher cannot tell an override from a default.
  assert(/passmark\.inherited/.test(html), 'an inherited value is labelled as inherited');
  // The scope is a PARAMETER of the one control (not two hardcoded copies), so check the call sites.
  assert(/passMarkRowHtml\('storyline', _slObj\.id,/.test(html), 'the storyline screen passes its own id');
  assert(/passMarkRowHtml\('topic', d\.id \|\| '',/.test(html), 'the lesson-set page passes the chapter id');
  assert(/onchange="setPassMark\('\$\{scope\}'/.test(html), 'the input reports back under its scope');

  // v69_j — guard for a CLASS of bug, not just this instance. The first cut of the storyline block
  // referenced `sl`, which exists in that function only as an arrow parameter on a find(); the page
  // threw "sl is not defined" on every open. A regex assertion happily matched the source text
  // while the identifier was undefined at RUNTIME — the same blind spot that let the v68.1 TDZ
  // crash through. So: for each call site, resolve the identifier actually passed and prove it is
  // declared (or is a parameter) in the enclosing function.
  {
    const enclosing = (needle) => {
      const at = html.indexOf(needle);
      assert(at > 0, `call site present: ${needle}`);
      const fnAt = html.lastIndexOf('\nfunction ', at) + 1;
      const open = html.indexOf('{', fnAt);
      let d = 0, i = open;
      for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
      return { head: html.slice(fnAt, open), body: html.slice(fnAt, i) };
    };
    for (const call of ["passMarkRowHtml('storyline',", "passMarkRowHtml('topic',"]) {
      const at = html.indexOf(call);
      const arg = html.slice(at + call.length).trimStart();
      const root = (/^([A-Za-z_$][\w$]*)/.exec(arg) || [])[1];
      assert(root, `could not read the id argument at ${call}`);
      const { head, body } = enclosing(call);
      const declared = new RegExp(`(?:const|let|var)\\s+${root}\\b`).test(body);
      const isParam = new RegExp(`\\(([^)]*\\b${root}\\b[^)]*)\\)`).test(head);
      assert(declared || isParam,
        `${call} passes "${root}", which is neither declared nor a parameter of its enclosing function`);
    }
  }
  // Empty input clears the override rather than setting 0.
  assert(/const value = str === '' \? null :/.test(html), 'an empty field sends null (inherit), not 0');
}
console.log('  client: one control, two slots, teacher-only, inheritance shown: OK');

// ── 2. Server route ──────────────────────────────────────────────────────────
(async () => {
  const env = await boot({ log: false });
  let failed = false;
  try {
    const g = await post(env.sport, '/api/generate', { topic: 'PM Chapter', lang: 'de', srcLang: 'en', difficulty: 2 });
    for (let i = 0; i < 100; i++) {
      await sleep(300);
      const j = await get(env.sport, '/api/job/' + g.body.jobId);
      if (j.body && (j.body.status === 'done' || j.body.status === 'error')) break;
    }
    const store0 = env.readStore();
    const topic = store0.topics[0];
    const sl = (store0.storylines || [])[0];
    assert(topic && sl, 'a chapter and its storyline exist');

    // Default: 80%, not "solve everything".
    const info = await get(env.sport, '/api/info');
    assert(info.body.coverageThreshold === 0.8, `global default is 80% (got ${info.body.coverageThreshold})`);

    // Storyline scope — and it must land on THAT storyline only.
    let r = await post(env.sport, '/api/pass-mark', { scope: 'storyline', id: sl.id, value: 0.5 });
    assert(r.status === 200 && r.body.value === 0.5, 'storyline pass mark accepted');
    assert(env.readStore().storylines[0].coverageTarget === 0.5, 'persisted on the storyline');
    assert(!('coverageTarget' in env.readStore().topics[0]), 'and NOT written onto its chapters');

    // Chapter scope overrides.
    r = await post(env.sport, '/api/pass-mark', { scope: 'topic', id: topic.id, value: 0.95 });
    assert(r.status === 200 && env.readStore().topics[0].coverageTarget === 0.95, 'chapter pass mark persisted');
    assert(env.readStore().storylines[0].coverageTarget === 0.5, 'the storyline mark is untouched by a chapter override');

    // Clearing REMOVES the field (inherit), rather than storing 0.
    r = await post(env.sport, '/api/pass-mark', { scope: 'topic', id: topic.id, value: null });
    assert(r.status === 200, 'clearing accepted');
    assert(!('coverageTarget' in env.readStore().topics[0]), 'clearing removes the override entirely');

    // 0 is a legitimate value and must survive as 0.
    r = await post(env.sport, '/api/pass-mark', { scope: 'topic', id: topic.id, value: 0 });
    assert(env.readStore().topics[0].coverageTarget === 0, '0 is stored as a real value, not treated as unset');

    // Validation.
    assert((await post(env.sport, '/api/pass-mark', { scope: 'topic', id: 'nope', value: 0.5 })).status === 404,
      'an unknown id is a 404');
    assert((await post(env.sport, '/api/pass-mark', { scope: 'bogus', id: topic.id, value: 0.5 })).status === 400,
      'an unknown scope is a 400');
    assert((await post(env.sport, '/api/pass-mark', { scope: 'topic', id: topic.id, value: 'x' })).status === 400,
      'a non-numeric value is a 400');
    // Out-of-range values are clamped rather than rejected (a slider/typo should not error).
    r = await post(env.sport, '/api/pass-mark', { scope: 'topic', id: topic.id, value: 4 });
    assert(r.status === 200 && r.body.value === 1, 'values above 1 clamp to 1');
  } catch (e) {
    failed = true;
    console.error('e2e-pass-mark FAILED:', e.message);
  } finally {
    env.stop();
  }
  if (failed) process.exit(1);
  console.log('  server: per-scope persistence, inherit-vs-zero, validation, clamping: OK');
  console.log('e2e-pass-mark: ALL PASSED');
})();
