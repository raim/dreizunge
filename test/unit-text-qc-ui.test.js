// unit-text-qc-ui.test.js — v89_aa.
//
// User request: "we want the possibility to run a pure text QC on that page, on a similar page
// after PDF extraction that could catch cases where de-capitalization failed, or where we can
// generally detect and fix typos." User ruling: BOTH surfaces, 2 ui.json keys.
//
// The server half (the detector and the verifier, which are what actually bound the model) is
// guarded by unit-text-normalise.test.js. This file guards the two CLIENT surfaces, and the
// properties it pins are the ones a user would notice going wrong:
//   • a correction reaches the state the surface actually saves from, not just the screen;
//   • an UNCHANGED text is never written back (which would churn state and mark the PDF chunk list
//     dirty for nothing);
//   • a CANCELLED job leaves every text exactly as it was;
//   • the two surfaces send the language each one's own text is in — they are NOT the same.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
// ⚠️ _jobAwait polls every 500ms and waits BEFORE its first poll, so anything under ~600ms here
// observes a job that has not been asked about yet — the assertions would read pre-QC state and a
// broken feature would look like a broken test. 900ms is one comfortable poll past that. (This
// session already shipped one guard that waited 500ms against a 1500ms grace and proved nothing.)
const settle = (ms) => new Promise(r => setTimeout(r, ms || 900));

// ⚠️ The 2 keys the user granted must EXIST — a t() miss renders the raw key into a button, which
// is exactly the sort of thing that ships unnoticed.
for (const k of ['qc.btn.text', 'qc.toast.text_done']) {
  assert.ok(UI.en[k], `ui.json defines ${k}`);
}
assert.ok(UI.en['ex.writing.no_issues'] && UI.en['qc.toast.no_backend'] && UI.en['app.checking'],
  'and the three strings this feature REUSES rather than adding are still there');

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang='de'; APP.srcLang='nl';
    APP.difficulty=2;
    _comicCropDataUrl = function(b){ return 'CROP_'+b.x1; };
    TOASTS = []; showToast = function(m){ TOASTS.push(m); };
    true;`, 'seed');
  return C;
}
// A stubbed job round-trip: POST answers with a jobId, the poll answers 'done' with `payload`.
// Driving the REAL _jobAwait rather than stubbing it keeps the job shape itself under test.
function stubJob(C, payload, opts) {
  C.run(`SENT = null;
    fetch = async function(url, init){
      if(String(url).indexOf('/api/text-qc') === 0){
        SENT = JSON.parse(init.body);
        return { ok:true, status:200, json: async () => ({ ok:true, jobId:'j1' }) };
      }
      if(String(url).indexOf('/api/job/') === 0){
        return { ok:true, status:200, json: async () => (${JSON.stringify(opts && opts.job || { status:'done' })}) };
      }
      throw new Error('unexpected fetch: ' + url);
    };
    true;`, 'stub');
  // The payload rides on the poll answer, so it has to go in with it.
  C.run(`fetch = (function(inner){ return async function(url, init){
      const r = await inner(url, init);
      if(String(url).indexOf('/api/job/') === 0){
        const j = await r.json();
        // ⚠️ The payload rides along on EVERY terminal status, cancelled included. Attaching it
        // only to 'done' made the cancel check untestable: a build that ignored the cancel would
        // still have found nothing to apply, and the mutation stayed green. The stub has to offer
        // the corrections so that refusing them is a real decision.
        j.data = ${JSON.stringify(payload)};
        return { ok:true, status:200, json: async () => j };
      }
      return r;
    };})(fetch); true;`, 'payload');
}

async function main() {

// ── 1. The comic review card ────────────────────────────────────────────────────────────────────
// ⚠️ The correction must land in _comicReviewBuffer — the thing _comicReviewConfirm() saves from.
// Writing only into the <textarea> would look right on screen and be silently discarded on confirm.
{
  const C = client();
  C.run(`APP_COMIC.boxes = [
      { x1:0,y1:0,x2:9,y2:9, text:{ caption:'ES GIBT EIN LAND', inScene:'WO DIE KOEPFE GLEICHEN' } },
      { x1:1,y1:1,x2:9,y2:9, text:{ caption:'Schon korrekt.', inScene:'' } }];
    comicOpenReview(); true;`, 'open');
  stubJob(C, { results: [
    { text:'Es gibt ein Land.\nWo die Köpfe gleichen.', changed:8, cased:7, repaired:1, unchanged:false, failed:false },
    { text:'Schon korrekt.', changed:0, cased:0, repaired:0, unchanged:true, failed:false },
  ] });
  C.run(`comicReviewQc(); true;`, 'qc');
  await settle();

  const sent = JSON.parse(C.run(`JSON.stringify(SENT)`));
  assert.strictEqual(sent.lang, 'de',
    'the comic card sends APP.lang — panel text is in the TARGET language (what /api/comic-extract itself sends)');
  assert.strictEqual(sent.items.length, 2, 'both panels went in one batch, not one request each');
  assert.strictEqual(sent.items[0].text, 'ES GIBT EIN LAND\nWO DIE KOEPFE GLEICHEN',
    'and each item is the MERGED text the box shows (v89_z), not a bare caption');

  // ⚠️ v89_ab: NOTHING is applied yet. The QC proposes; the user accepts. A build that wrote the
  // correction straight into the buffer would pass every later assertion here while removing the
  // whole feature, so this is checked BEFORE the accept.
  let buf = JSON.parse(C.run(`JSON.stringify(_comicReviewBuffer)`));
  assert.strictEqual(buf[0].caption, 'ES GIBT EIN LAND',
    'the buffer is UNTOUCHED until the user accepts');
  // (No textarea assertion here: lib-dom's getElementById AUTO-VIVIFIES a miss, so a textarea
  // rendered inside the modal's innerHTML reads back as an empty stub until product code writes to
  // it. That makes "unchanged" unobservable at this layer — the buffer check above is the real one.)
  // The panel is up, with one row for the one changed item — not one per sentence, and not one for
  // the unchanged panel.
  const panelHtml = C.run(`document.getElementById('comic-review-qc-panel').innerHTML`);
  assert.ok(/textQcAccept\(\)/.test(panelHtml) && /textQcDiscard\(\)/.test(panelHtml),
    'the proposal panel offers accept and discard');
  assert.strictEqual(C.run(`document.querySelectorAll('#comic-review-qc-panel .qc-textfix-cb').length`), 1,
    'ONE row — per ITEM, and the unchanged panel contributed none');
  assert.ok(panelHtml.includes(UI.en['qc.review_hdr']),
    'headed by the existing proofreader string — no new key was spent');

  C.run(`textQcAccept(); true;`, 'accept');
  buf = JSON.parse(C.run(`JSON.stringify(_comicReviewBuffer)`));
  assert.strictEqual(buf[0].caption, 'Es gibt ein Land.\nWo die Köpfe gleichen.',
    'after accept, the correction is in the buffer _comicReviewConfirm saves from');
  assert.strictEqual(buf[0].inScene, '', 'and it collapsed through the v89_z merge rule');
  // ⚠️ The unchanged panel must be left completely alone.
  assert.strictEqual(buf[1].caption, 'Schon korrekt.', 'an unchanged panel keeps its text');
  // The box on screen has to change too, or the fix is invisible until a reopen.
  // ⚠️ Precisely what this proves, and no more: accept WRITES the corrected text to
  // getElementById('comic-review-text-N').value. It does NOT prove the on-screen textarea updates —
  // lib-dom auto-vivifies this lookup, so the value read back is the one product code just wrote.
  // (The real-DOM behaviour was verified separately in a browser against a live model at v89_aa.)
  // The mutation that drops the write still turns this red, which is what it is here for.
  assert.strictEqual(C.run(`document.getElementById('comic-review-text-0').value`),
    'Es gibt ein Land.\nWo die Köpfe gleichen.', 'accept writes the correction to the textarea node');
  assert.strictEqual(C.run(`document.getElementById('comic-review-qc-panel').style.display`), 'none',
    'and the panel closes behind the accept');
  const toasts = JSON.parse(C.run(`JSON.stringify(TOASTS)`));
  assert.ok(/\b1\b/.test(toasts.join(' ')),
    `the toast reports what was applied, got ${JSON.stringify(toasts)}`);
}
console.log('  comic review card: proposes first, and only an ACCEPT reaches the save buffer: OK');

// ── 2. The PDF chunk panel ──────────────────────────────────────────────────────────────────────
{
  const C = client();
  C.run(`_pdfChunks = [
      { text:'DIT IS EEN HELE LUIDE ZIN', wordCount:6, title:'a', status:'pending' },
      { text:'Deze is al goed.',          wordCount:3, title:'b', status:'pending' }];
    _chunksDirty = false; _aiCleanBackup = null; true;`, 'chunks');
  stubJob(C, { results: [
    { text:'Dit is een hele luide zin.', changed:6, cased:6, repaired:0, unchanged:false, failed:false },
    { text:'Deze is al goed.', changed:0, unchanged:true, failed:false },
  ] });
  C.run(`pdfTextQc(); true;`, 'qc');
  await settle();

  const sent = JSON.parse(C.run(`JSON.stringify(SENT)`));
  assert.strictEqual(sent.lang, 'nl',
    '⚠️ the PDF panel sends APP.srcLang, NOT APP.lang — a document is in the SOURCE language, ' +
    'which is what aiCleanChunks alongside it already assumes. The two surfaces genuinely differ.');
  // ⚠️ Proposed, not applied — and in particular the UNDO must not be armed yet, or discarding a
  // proposal would leave a live undo button pointing at a pass that never happened.
  assert.strictEqual(JSON.parse(C.run(`JSON.stringify(_pdfChunks)`))[0].text, 'DIT IS EEN HELE LUIDE ZIN',
    'the chunk is untouched until accept');
  assert.strictEqual(C.run(`_aiCleanBackup`), null, 'and no undo is armed for an unaccepted proposal');
  assert.strictEqual(C.run(`_chunksDirty`), false, 'nor is the list dirty yet');

  C.run(`textQcAccept(); true;`, 'accept');
  const chunks = JSON.parse(C.run(`JSON.stringify(_pdfChunks)`));
  assert.strictEqual(chunks[0].text, 'Dit is een hele luide zin.', 'the chunk text is corrected');
  // ⚠️ NOT asserted on wordCount: the server's verifier refuses any reply whose word count differs,
  // so a QC correction can never change it and the assertion could not fail either way (a mutation
  // deleting the recompute stayed green — the recompute is defensive, not observable). The TITLE is
  // re-derived from the corrected text and does change, so that is what pins the recompute.
  assert.strictEqual(chunks[0].title, C.run(`_autoTitle('Dit is een hele luide zin.', 0)`),
    'the title was re-derived from the CORRECTED text, not left on the shouted one');
  assert.notStrictEqual(chunks[0].title, 'a', 'and it really moved off the seeded value');
  assert.strictEqual(chunks[1].text, 'Deze is al goed.', 'the unchanged chunk is untouched');
  assert.strictEqual(C.run(`_chunksDirty`), true, 'the chunk list is marked dirty so the draft saves');
  // v89_ab: the dirty flag moved into the proposal's `done` callback, which only fires on an
  // accept that applied something. Pinned at the SOURCE layer too because `_chunksDirty = true`
  // appears elsewhere in the file, so a behavioural check alone cannot say WHICH writer ran.
  assert.ok(/done:\(n\)=>\{\s*\n\s*if\(!n\) return;\s*\n\s*_chunksDirty = true;/.test(
      fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')),
    'and it is set only when an accept actually applied something');
  const backup = JSON.parse(C.run(`JSON.stringify(_aiCleanBackup)`));
  assert.strictEqual(backup[0], 'DIT IS EEN HELE LUIDE ZIN',
    'the pre-QC text is kept so the shared undo can restore it');
  // The undo really does restore it — driving the REAL aiCleanUndo, not asserting on the backup alone.
  C.run(`aiCleanUndo(); true;`, 'undo');
  assert.strictEqual(JSON.parse(C.run(`JSON.stringify(_pdfChunks)`))[0].text, 'DIT IS EEN HELE LUIDE ZIN',
    'and the shared undo button puts it back');
}
console.log('  PDF panel: corrects chunks, sends the SOURCE language, and the shared undo restores: OK');

// ── 3. ⚠️ Nothing changed / cancelled — the two quiet paths ──────────────────────────────────────
// A pass that "succeeds" by rewriting nothing must not claim it did, and a CANCEL must lose nothing.
{
  const C = client();
  C.run(`_pdfChunks = [{ text:'Al goed.', wordCount:2, title:'a', status:'pending' }];
    _chunksDirty = false; _aiCleanBackup = null; true;`, 'chunks');
  stubJob(C, { results: [ { text:'Al goed.', unchanged:true, failed:false } ] });
  C.run(`pdfTextQc(); true;`, 'qc');
  await settle();
  assert.strictEqual(C.run(`_chunksDirty`), false, 'an all-unchanged run does NOT dirty the list');
  assert.strictEqual(C.run(`_aiCleanBackup`), null, 'and leaves no undo pointing at nothing');
  // v89_ab: it says so in the PANEL now, not a toast — and with ex.writing.no_issues rather than
  // qc.clean, whose text ("…the story is already clean") is wrong for a PDF chunk. That override is
  // the `cleanKey` option added to the shared renderer.
  const clean = C.run(`document.getElementById('pdf-textqc-panel').innerHTML`);
  assert.ok(clean.includes(UI.en['ex.writing.no_issues']),
    'the panel says there was nothing to fix, reusing an existing string');
  assert.ok(!clean.includes(UI.en['qc.clean']), 'and NOT the story-specific wording');
  assert.ok(!/textQcAccept/.test(clean), 'with no accept button, since there is nothing to accept');
}
{
  const C = client();
  C.run(`_pdfChunks = [{ text:'DIT IS HEEL LUID', wordCount:4, title:'a', status:'pending' }];
    _chunksDirty = false; true;`, 'chunks');
  stubJob(C, { results: [ { text:'Dit is heel luid.', unchanged:false } ] }, { job: { status:'cancelled' } });
  C.run(`pdfTextQc(); true;`, 'qc');
  await settle();
  assert.strictEqual(JSON.parse(C.run(`JSON.stringify(_pdfChunks)`))[0].text, 'DIT IS HEEL LUID',
    '⚠️ a CANCELLED job applies nothing — the user stopped it, so the text must be as they left it');
  // ⚠️ Where this is really enforced: _jobAwait returns null for a cancelled job and drops the
  // payload. _textQcRun's own `if(!data)` is belt-and-braces and cannot fail on its own — mutating
  // it away leaves this green. Mutating _jobAwait's cancel branch turns it RED, which is how this
  // assertion was confirmed to be worth anything.
  assert.strictEqual(C.run(`_chunksDirty`), false, 'and nothing was marked dirty');
}
console.log('  an unchanged run claims nothing, and a cancelled one changes nothing: OK');

// ── 3b. ⚠️ PARTIAL acceptance — the entire reason the panel exists ──────────────────────────────
// Applying all-or-nothing would make the panel decoration. Ticking one row of two must apply that
// row and leave the other exactly as it was.
{
  const C = client();
  C.run(`_pdfChunks = [
      { text:'EERSTE LUIDE ZIN HIER', wordCount:4, title:'a', status:'pending' },
      { text:'TWEEDE LUIDE ZIN HIER', wordCount:4, title:'b', status:'pending' }];
    _chunksDirty = false; _aiCleanBackup = null; true;`, 'chunks');
  stubJob(C, { results: [
    { text:'Eerste luide zin hier.', unchanged:false },
    { text:'Tweede luide zin hier.', unchanged:false },
  ] });
  C.run(`pdfTextQc(); true;`, 'qc');
  await settle();
  assert.strictEqual(C.run(`document.querySelectorAll('#pdf-textqc-panel .qc-textfix-cb').length`), 2,
    'two changed chunks, two rows');
  // Untick the SECOND row, then accept.
  C.run(`document.querySelectorAll('#pdf-textqc-panel .qc-textfix-cb')[1].checked = false;
    textQcAccept(); true;`, 'accept one');
  const chunks = JSON.parse(C.run(`JSON.stringify(_pdfChunks)`));
  assert.strictEqual(chunks[0].text, 'Eerste luide zin hier.', 'the ticked row was applied');
  assert.strictEqual(chunks[1].text, 'TWEEDE LUIDE ZIN HIER',
    '⚠️ and the UNTICKED row was not — a correction the user declined must not land');
}
// And unticking EVERYTHING says so rather than silently doing nothing.
{
  const C = client();
  C.run(`_pdfChunks = [{ text:'EEN LUIDE ZIN HIER', wordCount:4, title:'a', status:'pending' }];
    _chunksDirty = false; _aiCleanBackup = null; true;`, 'chunks');
  stubJob(C, { results: [ { text:'Een luide zin hier.', unchanged:false } ] });
  C.run(`pdfTextQc(); true;`, 'qc');
  await settle();
  C.run(`document.querySelectorAll('#pdf-textqc-panel .qc-textfix-cb')[0].checked = false;
    TOASTS = []; textQcAccept(); true;`, 'accept none');
  assert.strictEqual(JSON.parse(C.run(`JSON.stringify(_pdfChunks)`))[0].text, 'EEN LUIDE ZIN HIER',
    'nothing applied');
  assert.strictEqual(JSON.parse(C.run(`JSON.stringify(TOASTS)`))[0], UI.en['qc.none_selected'],
    'and the user is told, using acceptStoryQc\'s own existing string');
  assert.ok(C.run(`!!_textQcProposal`), 'the proposal stays open so they can tick something');
}
console.log('  partial acceptance: only ticked rows land, and ticking none says so: OK');

// ── 3c. ⚠️ A proposal must not outlive the card it belongs to ───────────────────────────────────
// comicOpenReview rebuilds the overlay from scratch every time, so a proposal left behind points at
// a panel node that no longer exists AND holds an `apply` closure over a buffer that has been
// replaced — accepting it would write into the previous card's state.
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{ x1:0,y1:0,x2:9,y2:9, text:{ caption:'EEN LUIDE ZIN HIER', inScene:'' } }];
    comicOpenReview(); true;`, 'open');
  stubJob(C, { results: [ { text:'Een luide zin hier.', unchanged:false } ] });
  C.run(`comicReviewQc(); true;`, 'qc');
  await settle();
  assert.ok(C.run(`!!_textQcProposal`), 'the proposal is open while the card is');
  C.run(`_comicReviewCancel(); true;`, 'close');
  assert.strictEqual(C.run(`_textQcProposal`), null,
    'closing the card drops it — nothing survives to be accepted into a replaced buffer');
  // Non-vacuity: closing the COMIC card must not drop a PDF panel's proposal, which lives on a
  // different screen and is not rebuilt by this close.
  C.run(`_textQcProposal = { rows:[], apply:function(){}, panelId:'pdf-textqc-panel', cbClass:'qc-textfix-cb' };
    _comicReviewCancel(); true;`, 'close again');
  assert.ok(C.run(`!!_textQcProposal`), "and it only drops its OWN panel's proposal");
}
console.log('  a pending proposal dies with the card that owns it, and only that one: OK');

// ── 4. The button exists on BOTH surfaces (the user asked for both) ─────────────────────────────
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{ x1:0,y1:0,x2:9,y2:9, text:{ caption:'HALLO', inScene:'' } }];
    comicOpenReview(); true;`, 'open');
  const html = C.run(`_comicReviewOverlayEl.innerHTML`);
  assert.ok(/onclick="comicReviewQc\(\)"/.test(html), 'the review card carries the QC button');
  // ⚠️ Compared against the ESCAPED label, not the raw one: the granted string contains "&", which
  // escHtml renders as "&amp;". Asserting on the raw string fails against correct markup — and
  // "loosen it until it passes" would have thrown away the check that the label is there at all.
  const wantLbl = C.run(`escHtml(t('qc.btn.text'))`);
  assert.ok(html.includes(wantLbl),
    `labelled with the granted key, escaped — wanted ${JSON.stringify(wantLbl)}`);
  assert.ok(!html.includes('qc.btn.text'), 'and not the raw key name, which is what a t() miss renders');
  // And the PDF one, in the STATIC markup, where a label also has to be translated at render time.
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(/id="pdf-textqc-btn"[^>]*\n?[^>]*onclick="pdfTextQc\(\)"/.test(src.replace(/\s+/g, ' ').replace(/> </g, '><')) ||
            /onclick="pdfTextQc\(\)"/.test(src), 'the PDF panel carries its own button');
  assert.ok(/getElementById\('pdf-textqc-lbl'\)[^\n]*t\('qc\.btn\.text'\)/.test(src),
    "⚠️ and its STATIC label is re-translated by applyUi — a hardcoded English span would look " +
    'right in en and be wrong in all five translated languages');
}
console.log('  both surfaces carry the button, and the static one is translated: OK');

console.log('unit-text-qc-ui: ALL PASSED');
}
main().catch(e => { console.error(e); process.exit(1); });
