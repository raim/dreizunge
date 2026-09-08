// unit-gen-input-router.test.js
// v90_s — ONE input field for the generation wizard: the learner gives the thing, and the router
// decides which path follows.
//
// ⚠️ THE SAFETY ARGUMENT THIS FILE EXISTS TO PIN: the router is an ENTRY, not a replacement.
// Card 2 starts collapsed behind ONE CSS rule and every original panel, checkbox and handler is
// still present and still reachable — §4 asserts that, because "without losing functionality" was
// the user's explicit constraint and it is the one property a UI change like this quietly breaks.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function ext(name) {
  let at = client.indexOf('\nfunction ' + name + '(') + 1;
  if (at < 1) at = client.indexOf('\nasync function ' + name + '(') + 1;
  assert.ok(at >= 1, `found ${name}`);
  const b = client.indexOf('{', at);
  let d = 0, i = b;
  for (; i < client.length; i++) { if (client[i] === '{') d++; else if (client[i] === '}') { d--; if (!d) { i++; break; } } }
  return client.slice(at, i);
}

// Built by EXECUTING the real source, never by regexing it.
const cap = client.match(/^const GEN_TOPIC_MAX = (\d+);/m);
assert.ok(cap, 'GEN_TOPIC_MAX is a named constant');
const C = new Function('URL', cap[0] + '\n' + ext('_genIsHttpUrl') + '\n' + ext('_genIsImage') + '\n'
  + ext('_genIsDoc') + '\n' + ext('_genClassify')
  + '\nreturn { _genClassify, _genIsHttpUrl, GEN_TOPIC_MAX };')(URL);
const f = (name, type) => ({ name, type: type || '' });

// ── 1. Files are classified by kind ──────────────────────────────────────────
{
  const k = (files) => C._genClassify('', files).kind;
  assert.strictEqual(k([f('a.pdf', 'application/pdf')]), 'document', 'a PDF');
  assert.strictEqual(k([f('a.txt', 'text/plain')]), 'document', 'a text file');
  assert.strictEqual(k([f('a.md')]), 'document', 'markdown by extension, with no MIME type');
  assert.strictEqual(k([f('a.png', 'image/png')]), 'image', 'a PNG');
  assert.strictEqual(k([f('a.JPG')]), 'image', 'an image by extension, uppercase, no MIME');
  assert.strictEqual(k([f('a.png'), f('b.png'), f('c.png')]), 'image',
    'several images stay ONE image job — item V gives N images a defined meaning (a chapter each)');
  assert.strictEqual(k([f('a.zip', 'application/zip')]), 'unknown-file', 'an unsupported file is refused, not guessed at');
  console.log('  files: pdf/text/markdown → document, png/jpg → image, zip refused: OK');
}

// ── 2. ⚠️ A MIXED DROP IS A KNOWN GAP, and the choice is RECORDED, not silent ─
// The roadmap spec lists "mixed or multiple files in one drop" as a decision the user still owes.
// Until it is made, images win — because N images mean something and a PDF+image pair does not —
// and the count of ignored files is returned so the caller can say so rather than dropping them
// quietly. Pinned so the interim rule cannot drift into a silent one.
{
  const d = C._genClassify('', [f('a.pdf', 'application/pdf'), f('b.png', 'image/png')]);
  assert.strictEqual(d.kind, 'image', 'images win a mixed drop (the documented interim rule)');
  assert.strictEqual(d.ignored, 1, 'and the number of ignored files is REPORTED, never silently dropped');
  const d2 = C._genClassify('', [f('a.pdf', 'application/pdf'), f('b.zip')]);
  assert.strictEqual(d2.kind, 'document', 'with no image, documents win');
  assert.strictEqual(d2.ignored, 1, 'and again the remainder is counted');
  console.log('  a mixed drop resolves to images and REPORTS what it ignored: OK');
}

// ── 3. Text: url / story / ask ───────────────────────────────────────────────
{
  const c = (s) => C._genClassify(s, []);
  assert.strictEqual(c('').kind, 'empty', 'nothing typed');
  assert.strictEqual(c('   ').kind, 'empty', 'whitespace only');
  assert.strictEqual(c('https://example.org/a').kind, 'url', 'a URL');
  assert.strictEqual(c('  http://example.org/a  ').kind, 'url', 'trimmed');
  // ⚠️ A story that MENTIONS a link is a story. Pasted articles routinely contain URLs.
  assert.strictEqual(c('Read more at https://example.org/a for details.').kind, 'ask',
    'a text containing a URL is NOT a URL — the WHOLE input has to be one');
  // ⚠️⚠️ THE CASE THAT ACTUALLY TESTS THE WHITESPACE GUARD, and the first draft of this file missed
  // it. The fixture above STARTS with prose, so `new URL()` throws on it and the guard is never
  // reached — deleting the guard left this file green. A text that BEGINS with a link is different:
  // measured, `new URL('https://example.org/a and here is the rest')` SUCCEEDS, percent-encoding the
  // spaces into the path. Without the guard that story would be fetched as a URL, against a nonsense
  // address.
  assert.strictEqual(c('https://example.org/a and here is the rest of my story').kind, 'ask',
    'a story that BEGINS with a link is still a story — new URL() would otherwise accept it, ' +
    'silently encoding the prose into the path');
  assert.strictEqual(c('ftp://example.org/a').kind, 'ask', 'a non-http scheme is not a fetchable URL');
  // ⚠️ The threshold is #topic-input's own maxlength, per the user's "use current length max for
  // the topic field". The roadmap records that server.js slices topics to 300 — a contradiction
  // flagged for reconciliation, deliberately NOT resolved by silently picking one here.
  assert.strictEqual(C.GEN_TOPIC_MAX, 400, "the threshold is the topic field's own cap");
  assert.strictEqual(c('x'.repeat(C.GEN_TOPIC_MAX)).kind, 'ask', 'at the cap it is still ambiguous — ask');
  assert.strictEqual(c('x'.repeat(C.GEN_TOPIC_MAX + 1)).kind, 'story',
    'past the cap it cannot be a topic, because the field would not have accepted it as one');
  console.log(`  text: url vs story vs ask, with the ${C.GEN_TOPIC_MAX}-char topic cap as the boundary: OK`);
}

// ── 4. ⚠️ NOTHING WAS LOST — the collapse is ONE reversible CSS rule ──────────
// The user's constraint was "w/o losing functionality". Every original panel and checkbox must
// still exist in the markup and still be reachable; the router only decides what is SHOWN first.
{
  for (const id of ['user-story-checks', 'pdf-panel', 'user-story-panel', 'dialect-panel',
                    'comic-panel', 'topic-input', 'style-wrap', 'use-story-cb', 'use-dialect-cb',
                    'use-comic-cb', 'upload-file-input', 'comic-file-input', 'fetch-url-input']) {
    assert.ok(client.includes(`id="${id}"`), `#${id} still exists — the router hid it, it did not delete it`);
  }
  // The hiding is one rule against one class, so removing the class restores the previous behaviour
  // exactly. A rule that instead set display imperatively per element could not make that claim.
  assert.ok(/\.gen-card\.router-collapsed > \*:not\(#gen-input-panel\):not\(\.gen-card-nav\)\{display:none !important\}/.test(client),
    'the collapse is ONE CSS rule keyed on .router-collapsed (if reshaped, update this guard)');
  assert.ok(ext('_genRouterOpen').includes("classList.remove('router-collapsed')"),
    'and opening is exactly the removal of that class');
  // ⚠️ Every RESTORE path must open it, or a resumed draft renders behind the collapsed card —
  // which is `v87_d`'s bug (real content rendered into a display:none node) in a new place.
  const opens = (client.match(/_genRouterOpen\(\);\s*\/\/ v90_s/g) || []).length;
  assert.ok(opens >= 3, `every restore path opens the router (found ${opens}, expected 3+)`);
  console.log('  all 13 original controls still present; collapse is one reversible rule: OK');
}

// ── 5. The two file handlers were NOT refactored ─────────────────────────────
// They are reached through their own hidden inputs via a synthetic DataTransfer, so the PDF flow and
// item V's multi-image upload keep working without being re-tested.
{
  assert.ok(/function onUploadFileChosen\(input\)|async function onUploadFileChosen\(input\)/.test(client),
    'onUploadFileChosen still takes an <input>, unrefactored');
  assert.ok(/function onComicFileChosen\(input\)/.test(client),
    'onComicFileChosen still takes an <input>, unrefactored');
  assert.ok(ext('_genFeedFiles').includes('new DataTransfer'),
    'the router hands files to them through a synthetic DataTransfer rather than changing them');
  console.log('  both file handlers are untouched and driven through their own inputs: OK');
}

// ── 6. The question is asked, not guessed — and costs no new key ─────────────
{
  const ask = ext('_genAskKind');
  assert.ok(ask.includes("t('form.use_story')") && ask.includes("t('gen.title')"),
    'the story/topic choice reuses two EXISTING translated keys');
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  assert.ok(ui.en['form.use_story'] && ui.en['gen.title'], 'both of which exist');
  assert.strictEqual(ui.en['form.gen_input_lbl'], 'Drop a text, image or topic here:',
    'the field title is the user\'s own wording');
  assert.ok(ui.en['form.gen_scan'], 'and the Scan button has a label');
  // ⚠️ Scan must stay EXPLICIT. An oninput would reclassify mid-sentence (a topic becomes a story at
  // character 401) and fire a network fetch the instant a pasted URL completed.
  assert.ok(/id="gen-scan-btn"[^>]*onclick="genScan\(\)"/.test(client.replace(/\s+/g, ' ')),
    'Scan is a button press, never an oninput');
  assert.ok(!/id="gen-input"[^>]*oninput=/.test(client.replace(/\s+/g, ' ')),
    'and the field itself does not classify while the learner types');
  console.log('  the ambiguous case is ASKED with existing keys, behind an explicit Scan: OK');
}

console.log('unit-gen-input-router: ALL PASSED');
