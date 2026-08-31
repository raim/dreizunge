// E2E: the server half of "comic images instead of the storyboard" (user request) — a real
// fresh-spawned server, real HTTP. Per the standing rule ("server.js changes need a FRESH PROCESS to
// verify live"), this is the correct verification path for a new route and a changed projection.
//
// Two claims, and the first is the one most likely to rot:
//   §1 GET /api/lessons carries `comicPanelCount` — and NOT the images themselves. This projection
//      is a WHITELIST, and its own comments record twice (v74_i, v79_n) that a field omitted from it
//      makes a feature work in the static build and silently do nothing live. Also asserts the
//      response does NOT contain the image data, which is the whole reason the count exists.
//   §2 GET /api/comic-thumb/:id serves the panel bytes with a real image content-type, decodes the
//      stored data URL, honours ?i=, and 404s rather than returning a broken empty body.
//   §3 POST /api/storylines round-trips `thumbMode`, including clearing it back to unset.
const { boot, get, post, assert } = require('./lib');
const http = require('http');

// lib.js's own get() collects the body as a STRING and does not surface headers — fine for JSON, but
// this route serves binary and its content-type/length are the point. A local helper rather than a
// change to the shared harness: only this file needs it.
function getRaw(port, p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: p }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

// A 1x1 PNG — small, but a REAL image, so the content-type and byte round-trip mean something.
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const JPG_B64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

const SEED = {
  schemaVersion: 29, flags: {}, progress: {},
  topics: [
    { id: 'tp_comic', topic: 'Comic Chapter', lang: 'de', srcLang: 'en', story: 'Hallo.', lessons: [],
      comicPanels: [ { x1:0,y1:0,x2:10,y2:10, image: 'data:image/png;base64,' + PNG_B64 },
                     { x1:0,y1:0,x2:10,y2:10, image: 'data:image/jpeg;base64,' + JPG_B64 } ] },
    { id: 'tp_plain', topic: 'Plain Chapter', lang: 'de', srcLang: 'en', story: 'Hallo.', lessons: [] },
  ],
  storylines: [ { id: 'sl_1', title: 'A Storyline', icon: '📖', chapters: ['tp_comic','tp_plain'],
                  lang: 'de', srcLang: 'en' } ],
};

(async () => {
  const env = await boot({ seed: SEED });
  try {
    const { sport } = env;

    // ── 1. The list projection carries the COUNT and not the images ──────────────
    {
      const r = await get(sport, '/api/lessons');
      assert(r.status === 200, 'list ok');
      const list = Array.isArray(r.body) ? r.body : (r.body.lessons || r.body.topics || []);
      const comic = list.find(x => x.id === 'tp_comic');
      const plain = list.find(x => x.id === 'tp_plain');
      assert(comic, 'the comic chapter is listed');
      assert(comic.comicPanelCount === 2,
        'comicPanelCount rides the whitelist projection (got ' + comic.comicPanelCount + ') — without ' +
        'it the feature works in the static build and silently does nothing live (v74_i/v79_n)');
      assert(plain && plain.comicPanelCount === undefined,
        'a chapter with no panels carries no count at all, rather than a 0 nobody reads');
      assert(r.raw.indexOf(PNG_B64.slice(0, 40)) === -1,
        'and the IMAGES are NOT in the list — that is the entire reason only a count is sent ' +
        '(a stored panel is ~240KB, and this response is fetched on every load)');
      console.log('  /api/lessons: carries comicPanelCount, never the image data: OK');
    }

    // ── 2. The thumbnail route serves real decoded bytes ─────────────────────────
    {
      const r = await getRaw(sport, '/api/comic-thumb/tp_comic');
      assert(r.status === 200, 'thumb ok (got ' + r.status + ')');
      assert(/^image\/png/.test(r.headers['content-type'] || ''),
        'served with the stored image content-type (got ' + r.headers['content-type'] + ')');
      const expected = Buffer.from(PNG_B64, 'base64');
      assert(r.buf.equals(expected),
        'the data URL was DECODED to the exact stored bytes, not echoed as base64 text ' +
        '(got ' + r.buf.length + ' bytes, expected ' + expected.length + ')');
      console.log('  /api/comic-thumb/:id: decoded bytes, correct content-type: OK');
    }

    // ── 2b. ?i= selects a later panel, and its own content-type follows ──────────
    {
      const r = await getRaw(sport, '/api/comic-thumb/tp_comic?i=1');
      assert(r.status === 200, 'second panel ok');
      assert(/^image\/jpeg/.test(r.headers['content-type'] || ''),
        'panel 1 is the JPEG — the index really selects, and the type comes from the stored URL');
      console.log('  /api/comic-thumb/:id?i=N: selects the panel and its own type: OK');
    }

    // ── 2c. Out-of-range clamps; a chapter with no panels 404s ───────────────────
    {
      const hi = await getRaw(sport, '/api/comic-thumb/tp_comic?i=99');
      assert(hi.status === 200 && /^image\/jpeg/.test(hi.headers['content-type'] || ''),
        'an out-of-range index clamps to the last panel rather than 404ing');
      const none = await get(sport, '/api/comic-thumb/tp_plain');
      assert(none.status === 404, 'a chapter with no panels is a 404 (got ' + none.status + ')');
      const missing = await get(sport, '/api/comic-thumb/tp_nope');
      assert(missing.status === 404, 'an unknown chapter is a 404');
      console.log('  /api/comic-thumb/:id: clamps a high index, 404s with no panels or no chapter: OK');
    }

    // ── 3. thumbMode round-trips through the EXISTING storyline upsert ───────────
    {
      let r = await post(sport, '/api/storylines', { slId: 'sl_1', thumbMode: 'images' });
      assert(r.status === 200, 'upsert ok');
      let sl = env.readStore().storylines.find(s => s.id === 'sl_1');
      assert(sl.thumbMode === 'images', 'thumbMode persisted (got ' + sl.thumbMode + ')');
      assert(sl.title === 'A Storyline' && (sl.chapters || []).length === 2,
        'and the patch did not disturb the title or the chapter list');

      await post(sport, '/api/storylines', { slId: 'sl_1', thumbMode: 'storyboard' });
      assert(env.readStore().storylines.find(s => s.id === 'sl_1').thumbMode === 'storyboard', 'flips back');

      await post(sport, '/api/storylines', { slId: 'sl_1', thumbMode: 'nonsense' });
      assert(env.readStore().storylines.find(s => s.id === 'sl_1').thumbMode === null,
        'an unrecognised value clears to UNSET rather than being stored as a third mode');
      console.log('  POST /api/storylines: thumbMode round-trips, invalid clears to unset: OK');
    }

    console.log('e2e-storyline-artwork: ALL PASSED');
  } finally {
    await env.stop();
  }
})().catch(e => { console.error(e); process.exit(1); });
