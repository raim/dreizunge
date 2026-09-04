// unit-model-roles.test.js — v89_r.
//
// ⚠️ A STRUCTURAL guard, deliberately, because the per-role kind kept failing to be written.
//
// `configuredModels()` is the list the idle-release (`v88_l`) and shutdown-release sweeps free. A
// role missing from it is a model this server can LOAD and never FREE — which defeats the whole
// point of the idle release on a machine where RAM is the constraint, and fails silently: nothing
// throws, the model simply sits there.
//
// THREE of the eight roles were missing. `answerCheck` was caught at `v89_l` only because its
// default names a model no other role does; `tutor` and `analysis` had been absent since they were
// introduced and were found by an audit, not by a test. That is the whole argument for enumerating
// the roles from the source rather than listing them here: **a guard that has to be edited when a
// role is added is a guard that will be forgotten exactly when it matters.**
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

// Every role, read from its declaration. `let OLLAMA_…_MODEL` is the shape all eight share, and it
// excludes the non-model knobs that live beside them (OLLAMA_LESSON_FORMAT, OLLAMA_THINK, …).
const roles = [...server.matchAll(/^let (OLLAMA_[A-Z_]*MODEL)\b/gm)].map(m => m[1]);
assert.ok(roles.length >= 8,
  `found ${roles.length} model roles — if the declaration shape changed, re-anchor this guard ` +
  `deliberately rather than letting it go vacuous. Got: ${JSON.stringify(roles)}`);
// Non-vacuity on the extraction itself: the two ends of the list must really be there.
for (const known of ['OLLAMA_MODEL', 'OLLAMA_ANSWERCHECK_MODEL']) {
  assert.ok(roles.includes(known), `the extraction found ${known} (got ${JSON.stringify(roles)})`);
}
console.log(`  ${roles.length} model roles declared: ${roles.map(r => r.replace(/^OLLAMA_|_MODEL$/g, '') || 'MODEL').join(', ')}`);

// ── The release list must name every one of them ───────────────────────────────────────────────
{
  const at = server.indexOf('function configuredModels()');
  assert.ok(at > -1, 'server.js defines configuredModels()');
  const body = server.slice(at, server.indexOf('\n}', at));
  const missing = roles.filter(r => !new RegExp('\\b' + r + '\\b').test(body));
  assert.deepStrictEqual(missing, [],
    'EVERY model role must appear in configuredModels(), or it is a model this server can load and ' +
    'never free. Missing: ' + JSON.stringify(missing));
  console.log('  every role appears in configuredModels(): OK');
}

// ── And /api/models must accept every one of them, or it cannot be pointed elsewhere ───────────
// ⚠️ The second list a role must join. `v89_l` found this the hard way: a role wired into
// setRuntimeModels but missing from the route's own `requested` array is accepted WITHOUT being
// validated against the installed models; missing from both, it is silently ignored.
{
  const at = server.indexOf("const requested = [body.model,");
  assert.ok(at > -1, "the /api/models route still builds a `requested` array — re-anchor if renamed");
  const line = server.slice(at, server.indexOf(']', at));
  // The route names roles in camelCase body fields, not by their variable names.
  const field = (r) => {
    const bare = r.replace(/^OLLAMA_/, '').replace(/_MODEL$/, '').toLowerCase();
    // `OLLAMA_MODEL` reduces to 'model' (the `_MODEL$` strip needs the underscore), and it IS the
    // story role — `body.story` sets it, `body.model` is the set-everything convenience.
    return { 'model': 'story', 'translation': 'translation', 'lesson': 'lessons', 'qc': 'qc',
             'tutor': 'tutor', 'vision': 'vision', 'analysis': 'analysis',
             'answercheck': 'answerCheck' }[bare];
  };
  const unmapped = roles.map(field).filter(f => f === undefined);
  assert.deepStrictEqual(unmapped, [],
    'every role maps to a known /api/models body field — a new role needs a row in this table too');
  const missing = roles.map(field).filter(f => !new RegExp('body\\.' + f + '\\b').test(line));
  assert.deepStrictEqual(missing, [],
    "every role must be in /api/models's `requested` array, or it is accepted unvalidated. " +
    'Missing: ' + JSON.stringify(missing));
  console.log("  every role appears in /api/models's validated `requested` array: OK");
}

console.log('unit-model-roles: ALL PASSED');
