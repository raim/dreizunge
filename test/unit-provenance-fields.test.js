// unit-provenance-fields.test.js
// v58 — provenance: structured topic.source {author,licence,url,note} + topic.createdBy.
// Contract under test:
//   • sanitizeTopicSource (pure): trims, caps, strips control chars; url must parse as
//     http(s) OR read as a DOI, else DROPPED (fail closed — it's a link target); empty
//     fields omitted; all-empty → null (= clear).
//   • Every topic write flows through upsert(), which stamps createdBy (DEFAULT 'admin',
//     preserved across updates) — ONE choke point, no per-route stamping.
//   • Schema write-stamp is 30; readers still accept >= 29 (fields optional).
//   • /api/topic-source resolves by stable id ONLY, stores the SANITIZED source, clears on null.
//   • /api/lessons list projection ships createdBy + source + sourceFile (the v55_s lesson:
//     live must not lack what static bakes whole).
//   • ONE rendering path: provLineHtml is defined once (shared code) and called by BOTH
//     landing renderers (live index.html AND build-static.js) + the chapter page; the
//     storyline screen aggregates via provLineForChapters. The <user> part ships inert.
//   • backfill-createdby.js is dry-run by default and idempotent.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const builder = fs.readFileSync(path.join(ROOT, 'build-static.js'), 'utf8');

function ext(src, name) {
  let at = src.indexOf('\nfunction ' + name + '(') + 1;
  if (at < 1) at = src.indexOf('\nasync function ' + name + '(') + 1;
  assert.ok(at >= 1, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. sanitizeTopicSource (server, pure) ─────────────────────────────────────
const sanitize = new Function(ext(server, 'sanitizeTopicSource') + '\nreturn sanitizeTopicSource;')();
{
  // Happy path: all four fields, trimmed.
  const s = sanitize({ author: '  Jane Doe ', licence: 'CC BY-SA 4.0', url: 'https://example.org/story', note: 'ch. 3 only' });
  assert.deepStrictEqual(s, { author: 'Jane Doe', licence: 'CC BY-SA 4.0', url: 'https://example.org/story', note: 'ch. 3 only' });
  // Caps enforced.
  assert.strictEqual(sanitize({ author: 'x'.repeat(500) }).author.length, 120, 'author capped at 120');
  assert.strictEqual(sanitize({ note: 'x'.repeat(999) }).note.length, 500, 'note capped at 500');
  // Control characters stripped (a pasted citation with newlines must not break the one-liner).
  assert.strictEqual(sanitize({ author: 'A\nB\tC' }).author, 'A B C', 'control chars → spaces');
  // URL discipline: http(s) ok; DOI forms ok; anything else DROPPED, not stored.
  assert.strictEqual(sanitize({ url: 'http://a.example/x' }).url, 'http://a.example/x');
  assert.strictEqual(sanitize({ url: '10.1000/xyz123' }).url, '10.1000/xyz123', 'bare DOI accepted');
  assert.strictEqual(sanitize({ url: 'doi:10.1000/xyz123' }).url, 'doi:10.1000/xyz123', 'doi: prefix accepted');
  assert.strictEqual(sanitize({ url: 'javascript:alert(1)', author: 'A' }).url, undefined, 'javascript: dropped');
  assert.strictEqual(sanitize({ url: 'ftp://host/file', author: 'A' }).url, undefined, 'non-http scheme dropped');
  assert.strictEqual(sanitize({ url: 'not a url', author: 'A' }).url, undefined, 'garbage dropped');
  // Empty fields omitted; all-empty (or whitespace, or non-object) → null.
  assert.deepStrictEqual(sanitize({ author: 'A', licence: '' }), { author: 'A' }, 'empty fields omitted');
  assert.strictEqual(sanitize({ author: '   ', url: '' }), null, 'all-empty → null (clears the field)');
  assert.strictEqual(sanitize(null), null);
  assert.strictEqual(sanitize('x'), null);
  // Numbers tolerated as strings, arrays/objects are not silently stringified into junk.
  assert.strictEqual(sanitize({ author: 42 }).author, '42', 'number coerced');
  assert.strictEqual(sanitize({ author: ['a'] }), null, 'array is not a string — dropped');
}
console.log('  sanitizeTopicSource: caps, control chars, http(s)/DOI-only urls, clear-on-empty: OK');

// ── 2. createdBy stamp at the upsert choke point + schema stamp ───────────────
{
  const up = ext(server, 'upsert');
  assert.ok(/if \(!entry\.createdBy\) entry\.createdBy = existing\?\.createdBy \|\| DEFAULT_USER;/.test(up),
    'upsert stamps createdBy: preserved on update, DEFAULT_USER on create — the single choke point');
  assert.ok(/const DEFAULT_USER = 'admin';/.test(server), "DEFAULT_USER is 'admin' until login ships");
  assert.ok(/const SCHEMA_VERSION = 30;/.test(server), 'schema write-stamp is 30');
  assert.ok(/schemaVersion: SCHEMA_VERSION, storylines: s\.storylines/.test(server), 'saveStore writes SCHEMA_VERSION');
  assert.ok(/data\.schemaVersion >= 29 && Array\.isArray\(data\.topics\)/.test(server),
    'reader still accepts >= 29 (source/createdBy are optional — a v29 file loads untouched)');
}
console.log('  upsert createdBy stamp + schema 30 write / >=29 read: OK');

// ── 3. Route contract + list projection ───────────────────────────────────────
{
  const route = server.slice(server.indexOf("url.pathname === '/api/topic-source'"),
                             server.indexOf("url.pathname === '/api/lessons/save-meta'"));
  assert.ok(/findSavedById\(body\.id\)/.test(route) && !/findSaved\(body\.(topic|oldTopic)/.test(route),
    'topic-source resolves by stable id ONLY (no name fallback — same-name topics are legal)');
  assert.ok(/const source = sanitizeTopicSource\(body\.source\);/.test(route), 'route stores the SANITIZED source');
  assert.ok(/if \(source\) saved\.source = source; else delete saved\.source;/.test(route),
    'null result CLEARS the field (never an empty object in storage)');
  assert.ok(/saved\.updatedAt = new Date\(\)\.toISOString\(\);/.test(route) && /saveStore\(store\)/.test(route),
    'edit bumps updatedAt and persists');
  const proj = server.slice(server.indexOf("url.pathname === '/api/lessons'"),
                            server.indexOf('lessonTypes: (() => {'));
  for (const f of ['createdBy: l.createdBy || null', 'source: l.source || null', 'sourceFile: l.storyMeta?.sourceFile || null']) {
    assert.ok(proj.includes(f), `/api/lessons projection ships ${f.split(':')[0]} (live parity with baked static topics)`);
  }
}
console.log('  /api/topic-source contract + list projection: OK');

// ── 4. One rendering path, all sites, live+static parity ──────────────────────
{
  // The formatter exists ONCE, in shared client code (part2 → present in the static bundle).
  assert.strictEqual((client.match(/\nfunction provLineHtml\(/g) || []).length, 1, 'provLineHtml defined exactly once');
  assert.ok(!/function provLineHtml\(/.test(builder), 'build-static does NOT reimplement the formatter — it calls the shared one');
  // Both landing renderers call it (the v55_p two-renderer trap, killed at the formatting level).
  assert.ok(/\$\{provLineHtml\(s\)\}/.test(client), 'LIVE landing row renders the one-liner');
  assert.ok(/\\\$\{provLineHtml\(s\)\}/.test(builder), 'STATIC landing row renders the one-liner via the SAME function');
  // Chapter page: block above gen-stats, filled on render, editor is live-only + teacher-gated.
  assert.ok(/id="prov-stats"[^>]*>[\s\S]{0,200}id="gen-stats"/.test(client), '#prov-stats sits ABOVE #gen-stats');
  assert.ok(/renderProvStats\(d\);/.test(client), 'chapter page fills the provenance block');
  const rps = ext(client, 'renderProvStats');
  assert.ok(/typeof STATIC_LESSONS === 'undefined' && _canEdit\(\)/.test(rps),
    'the ✎ editor is live-only (static has no server) and teacher-gated like every other editor');
  // Storyline screen aggregates over chapters (storylines have NO createdBy of their own).
  assert.ok(/provLineForChapters\(chapterIds\.map\(cid => _byId\[cid\]\)\.filter\(Boolean\)\)/.test(client),
    'storyline screen derives its line from the chapters');
  const agg = ext(client, 'provLineForChapters');
  assert.ok(/new Set\(/.test(agg) && /slice\(0, 3\)/.test(agg), 'aggregate: distinct users/sources, capped display');
  // The user link ships INERT (span, not a dead <a>), and source urls are hardened.
  const fmt = ext(client, 'provLineHtml');
  assert.ok(/class="prov-user"/.test(fmt) && !/<a[^>]*prov-user/.test(fmt), 'user part is inert until login exists');
  assert.ok(/target="_blank" rel="noopener"/.test(fmt), 'source links open in a new tab with noopener');
  assert.ok(/escHtml\(/.test(fmt) && /escAttr\(/.test(fmt), 'labels and hrefs are escaped');
  // DOI handling: bare/prefixed DOIs resolve through doi.org.
  const bits = ext(client, '_provSrcBits');
  assert.ok(/https:\/\/doi\.org\//.test(bits), 'DOIs link through doi.org');
  // Save flow mirrors the server verbatim and syncs the landing row cache.
  const save = ext(client, 'saveProvEdit');
  assert.ok(/\/api\/topic-source/.test(save), 'editor saves through the route');
  assert.ok(/if \(j\.source\) d\.source = j\.source; else delete d\.source;/.test(save),
    'client mirrors the server-sanitized result (server is authoritative)');
  assert.ok(/prov\.url_dropped/.test(save), 'a rejected URL/DOI is surfaced, not silently swallowed');
  assert.ok(/APP\.savedList/.test(save), 'landing row cache stays in sync without a reload');
  // i18n: en-only keys exist.
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  for (const k of ['prov.by', 'prov.from', 'prov.edit_title', 'prov.author', 'prov.licence', 'prov.url', 'prov.note', 'prov.save', 'prov.url_dropped']) {
    assert.ok(ui.en[k], `ui.json en has ${k}`);
  }
}
console.log('  one formatter, four render sites, inert user link, hardened source links: OK');

// ── 5. Backfill: dry-run default, stamps, idempotent ──────────────────────────
{
  const tmp = path.join(os.tmpdir(), `prov-test-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify({
    schemaVersion: 29, storylines: [], flags: {},
    topics: [{ id: 'tp_1', topic: 'A', lessons: [] }, { id: 'tp_2', topic: 'B', lessons: [], createdBy: 'alice' }],
  }));
  try {
    const bin = path.join(ROOT, 'backfill-createdby.js');
    execFileSync('node', [bin, tmp], { encoding: 'utf8' });                     // dry run
    let d = JSON.parse(fs.readFileSync(tmp, 'utf8'));
    assert.ok(!d.topics[0].createdBy, 'dry run writes nothing');
    execFileSync('node', [bin, tmp, '--write'], { encoding: 'utf8' });          // write
    d = JSON.parse(fs.readFileSync(tmp, 'utf8'));
    assert.strictEqual(d.topics[0].createdBy, 'admin', 'missing createdBy stamped admin');
    assert.strictEqual(d.topics[1].createdBy, 'alice', 'existing createdBy NEVER overwritten');
    const out = execFileSync('node', [bin, tmp, '--write'], { encoding: 'utf8' });
    assert.ok(/2 already had createdBy, 0 stamped/.test(out), 'second run is a no-op (idempotent)');
  } finally { fs.unlinkSync(tmp); }
}
console.log('  backfill-createdby: dry-run default, admin stamp, preserves existing, idempotent: OK');

console.log('unit-provenance-fields: ALL PASSED');
