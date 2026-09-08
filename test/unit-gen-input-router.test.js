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
  assert.strictEqual(k([f('a.zip', 'application/zip')]), 'refuse', 'an unsupported file is refused, not guessed at');
  console.log('  files: pdf/text/markdown → document, png/jpg → image, zip refused: OK');
}

// ── 2. ⚠️⚠️ NOTHING IS EVER DISCARDED BEHIND THE LEARNER'S BACK (user ruling, v90_t) ──
// `v90_s` shipped a first-wins interim rule. It was wrong twice over, and the second way was not
// even named in its own write-up:
//   • mixed KINDS discarded the loser with only a console line — silent from the UI;
//   • several DOCUMENTS discarded all but the first with NO trace at all, because the "ignored"
//     count was ZERO (they were all documents). Dropping three PDFs silently used one.
// The user chose REFUSAL over picking. Only two file shapes are accepted, and everything else is
// refused without consuming anything.
{
  const k = (files) => C._genClassify('', files).kind;
  // Accepted:
  assert.strictEqual(k([f('a.png'), f('b.png'), f('c.png')]), 'image', 'several images (item V)');
  assert.strictEqual(k([f('a.pdf', 'application/pdf')]), 'document', 'exactly one document');
  // Refused — each of these silently lost a file before the ruling:
  assert.strictEqual(k([f('a.pdf', 'application/pdf'), f('b.png', 'image/png')]), 'refuse',
    'a PDF and an image together is refused, not resolved in favour of one of them');
  assert.strictEqual(k([f('a.pdf', 'application/pdf'), f('b.pdf', 'application/pdf')]), 'refuse',
    '⚠️ TWO DOCUMENTS are refused — this is the case that lost files with no trace at all, ' +
    'because both were documents and the old ignored-count was therefore zero');
  assert.strictEqual(k([f('a.pdf'), f('b.pdf'), f('c.pdf')]), 'refuse', 'and three');
  assert.strictEqual(k([f('a.pdf', 'application/pdf'), f('b.zip')]), 'refuse', 'a document plus junk');
  assert.strictEqual(k([f('a.png'), f('b.zip')]), 'refuse', 'images plus junk — not "images win"');
  // ⚠️ And the accepted document case really does carry exactly one file through, so the dispatcher
  // never has to slice — `[d.files[0]]` was how the silent loss happened.
  assert.strictEqual(C._genClassify('', [f('a.pdf', 'application/pdf')]).files.length, 1,
    'the document branch hands over exactly one file, so no caller needs to pick');
  console.log('  only "several images" or "exactly one document" is accepted; everything else refused: OK');
}

// ── 2b. ⚠️ A REFUSAL CONSUMES NOTHING ────────────────────────────────────────
// The point of refusing rather than picking: the learner's drop is still staged, so removing the
// odd file out and pressing Scan again just works. Asserted on the dispatcher, not the classifier.
{
  const scan = client.slice(client.indexOf('async function genScan('));
  const body = scan.slice(0, scan.indexOf('\n}'));
  const line = body.split('\n').find(l => l.includes("d.kind==='refuse'"));
  assert.ok(line, 'genScan has a refuse branch');
  assert.ok(line.includes("t('form.gen_drop_one')"), 'which SAYS so, using the granted key');
  assert.ok(!/(_genRouterOpen|_genRouterCollapse|_genClearRouted|_genFiles\s*=)/.test(line),
    'and does NOT open, collapse, clear the routed fields or drop the staged files — a refusal ' +
    `must leave the form exactly as it was (got: ${line.trim()})`);
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  assert.ok(ui.en['form.gen_drop_one'], 'the refusal message exists');
  console.log('  a refusal reports the reason and consumes nothing: OK');
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

// ── 7. ⚠️ PER-MODE REVEAL: a scan shows what ITS mode needs, not the whole card (v90_u) ──
// `v90_s` opened the card all-or-nothing, so a Scan brought back the four checkboxes the field
// exists to replace — "nothing else" held only for the first window.
{
  const map = client.match(/const _GEN_MODE_SHOW = \{[\s\S]*?\n\};/);
  assert.ok(map, 'the per-mode reveal is a named table (if reshaped, update this guard)');
  const M = new Function(map[0] + '\nreturn _GEN_MODE_SHOW;')();
  // Each mode shows its OWN surface and not the others'.
  assert.ok(M.llm.includes('topic-input') && !M.llm.includes('pdf-panel') && !M.llm.includes('comic-panel'),
    'the topic mode shows the topic controls and no upload panels');
  assert.ok(M.pdf.includes('pdf-panel') && !M.pdf.includes('topic-input'),
    'the document/url mode shows the chunk list and not the topic field');
  assert.ok(M.comic.includes('comic-panel') && M.comic.length === 1,
    'the image mode shows the comic panel alone');
  assert.ok(M.paste.includes('user-story-panel') && !M.paste.includes('num-chapters-row'),
    'the paste mode shows the paste box and not the chapter-count slider');
  // ⚠️ THE MECHANISM ONLY EVER *ADDS* HIDING. Forcing visibility (e.g. display:revert !important)
  // would override the inline decisions `_updateUploadSliderVis` and `_applyLessonCardUI` make, and
  // silently break them — measured live: #story-len-row is correctly HIDDEN for a paragraph-split
  // document and SHOWN for a length-split URL, which only holds because this never force-shows.
  const reveal = ext('_genRevealFor');
  assert.ok(/classList\.add\('gen-hide'\)/.test(reveal) && /classList\.remove\('gen-hide'\)/.test(reveal),
    'the reveal toggles a hide-class');
  assert.ok(!/style\.display\s*=/.test(reveal),
    'and never assigns display itself — the existing imperative logic still governs what it reveals');
  // ⚠️ A RESTORE path never went through the router and has no mode, so it needs the WHOLE surface.
  const open = ext('_genRouterOpen');
  assert.ok(/classList\.remove\('gen-hide'\)/.test(open) && !/gen-hide'\)/.test(open.replace(/remove\('gen-hide'\)/g,'')),
    'the full-reveal path clears every hide, so a resumed draft is not stranded behind it');
  console.log('  each mode reveals its own surface; restore paths still get everything: OK');
}

// ── 8. ⚠️ THE FOUR CHECKBOXES ARE HIDDEN AS A GROUP, AND STILL WORK AS STATE (v90_v) ──
// ⚠️ RE-SCOPED, NOT DELETED. This section used to assert the OPPOSITE — that `#user-story-checks`
// is revealed in every mode — because until the user ruled, hiding it would have made the dialect
// panel and the translation modifier unreachable, i.e. a real loss of function. The user has now
// ruled: "we don't need to expose any dialect-functionality at the moment, and we also don't expose
// the 'i have my own translation' for now. These are experimental features that we can fully hide."
// The claim flipped, so the assertion flips with it rather than being dropped.
{
  // Hidden at the ELEMENT, which is what also covers the restore paths — `_genRouterOpen()` clears
  // every `.gen-hide`, so a class-based hide alone would let a resumed draft bring the row back.
  assert.ok(/id="user-story-checks" style="display:none"/.test(client),
    'the checkbox row is hidden at the element, so the full-reveal restore path cannot resurrect it');
  const always = client.match(/const _GEN_ALWAYS = (\[[^\]]*\]);/);
  assert.ok(always, 'the always-shown list is named');
  const A = JSON.parse(always[1].replace(/'/g, '"'));
  assert.ok(!A.includes('user-story-checks'), 'and it is no longer force-shown per mode');
  assert.deepStrictEqual(A, ['gen-input-panel'], 'only the router itself is always visible');

  // ⚠️ BUT THEY MUST STILL EXIST AND STILL BE READ — they are the wizard's mode state, and deleting
  // them would break `_genInputMode()` and every downstream gate. This is the re-scope, made explicit.
  for (const id of ['use-story-cb', 'use-dialect-cb', 'use-comic-cb', 'use-translation-cb']) {
    assert.ok(client.includes(`id="${id}"`), `#${id} still exists as state, it was not deleted`);
  }
  const mode = ext('_genInputMode');
  assert.ok(/use-comic-cb/.test(mode) && /use-story-cb/.test(mode),
    '_genInputMode still derives the mode from those checkboxes — the router writes them');
  const scan = client.slice(client.indexOf('async function genScan('));
  assert.ok(/use-comic-cb/.test(scan.slice(0, 4000)) && /use-story-cb/.test(scan.slice(0, 4000)),
    'and genScan still sets them, so every downstream path is unchanged');

  // ⚠️ The two experimental features are genuinely OFF, not merely invisible.
  // `#dialect-panel` is only ever shown by onUseDialectCb, which nothing now calls;
  // `#user-translation-panel` needs `.open`, which only onUseTranslationCb adds.
  const modes = client.match(/const _GEN_MODE_SHOW = \{[\s\S]*?\n\};/)[0];
  assert.ok(!/use-dialect|onUseDialectCb/.test(scan.slice(0, 4000)),
    'the router never enables dialect, so #dialect-panel is unreachable from the wizard');
  assert.ok(!/use-translation/.test(scan.slice(0, 4000)),
    'and never enables the translation modifier');
  assert.ok(/\.user-translation-panel\{display:none/.test(client.replace(/\s+/g, '')) ||
            /user-translation-panel\{display:none/.test(client.replace(/\s+/g, '')),
    'the translation panel is display:none until .open, which nothing now adds');
  console.log('  the four checkboxes are hidden but still carry the mode; dialect + translation are off: OK');
}

// ── 9. ⚠️ A CONSUMED FILE IS UNSTAGED; A REFUSED ONE IS NOT ──────────────────
// `_genClassify` checks files BEFORE text, so a file left staged after a successful scan silently
// outranks anything typed afterwards: scan a document, then type a topic and press Scan, and the
// SAME document is processed again while the typed text is ignored — the button appears dead.
{
  const scan = client.slice(client.indexOf('async function genScan('));
  const body = scan.slice(0, scan.indexOf('\n}'));
  const imageBranch = body.slice(body.indexOf("d.kind==='image'"), body.indexOf("d.kind==='document'"));
  const docBranch = body.slice(body.indexOf("d.kind==='document'"), body.indexOf("d.kind==='url'"));
  assert.ok(/_genSetFiles\(\[\]\)/.test(imageBranch), 'a consumed image drop is unstaged');
  assert.ok(/_genSetFiles\(\[\]\)/.test(docBranch), 'a consumed document is unstaged');
  const refuseLine = body.split('\n').find(l => l.includes("d.kind==='refuse'"));
  assert.ok(!/_genSetFiles/.test(refuseLine),
    '⚠️ but a REFUSAL leaves them staged, so removing the odd file out and pressing Scan again works');
  // And files still outrank text, which is exactly why the unstaging matters.
  assert.strictEqual(C._genClassify('cooking in Rome', [f('a.pdf', 'application/pdf')]).kind, 'document',
    'files outrank text by design — which is why a consumed one must not linger');
  console.log('  consumed files unstage, refused files persist, files outrank text: OK');
}

// ── 10. The camera is an input root beside the upload button (user request) ──
{
  const flat = client.replace(/\s+/g, ' ');
  assert.ok(/id="gen-camera-input"[^>]*capture="environment"/.test(flat), 'the camera input captures');
  assert.ok(/id="gen-camera-input"[^>]*accept="image\/\*"/.test(flat), 'and accepts images');
  assert.ok(/id="gen-camera-input"[^>]*onchange="genOnFilePick\(this\)"/.test(flat),
    '⚠️ a captured photo is STAGED like any other file rather than dispatched immediately — which ' +
    'is what lets several pages be shot one after another before Scan (item V\'s multi-image meaning)');
  assert.ok(flat.indexOf('id="gen-camera-btn"') < flat.indexOf('id="gen-file-btn"'),
    'the camera button sits beside the upload button, before it');
  assert.ok(/gen-camera-lbl'\); if\(gc\) gc\.textContent=t\('form\.image_camera'\)/.test(client.replace(/\s+/g,' ')),
    'and reuses form.image_camera — an existing translated key, so it cost nothing');
  console.log('  the camera is an input root beside upload, staged not auto-dispatched: OK');
}

console.log('unit-gen-input-router: ALL PASSED');
