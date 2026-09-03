// unit-analysis-corrections.test.js
// item AI, first cut (v88_ad) — the curator's overlay over CP2's token analysis.
//
// User request at the v88_ac cut: "perhaps we need a review/edit interface for text analysis
// entries." Three rulings shaped it: corrections are STICKY across a re-analysis (a sticky overlay,
// not an edit in place), the editor is the existing token popover, and the first cut targets the
// tokens CP2 could not resolve (63 of 483 in the live store when this was written, 13%).
//
// This file covers the pure module. The ROUTE and the sticky-across-re-analysis guarantee are in
// e2e-analysis.test.js, where a real server can actually re-run CP2 over a correction.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The store path is resolved per CALL from the env var, so pointing it at a scratch file is enough
// to keep this test out of the real project root — the same isolation e2e-analysis's own comment
// insists on for canonical-analysis.json ("a run that writes the real store pollutes the working
// tree and leaves a later run reading a stale cache from an earlier one").
const scratch = path.join(os.tmpdir(), 'dz_test_corrections_' + process.pid + '.json');
process.env.ANALYSIS_CORRECTIONS_FILE = scratch;
const ac = require(path.join(__dirname, '..', 'analysis-corrections.js'));

// ⚠️ "een" appears TWICE, identically cased. A first version used "Een … een" — and because the
// capitalised one is a DIFFERENT surface, every token was occurrence 0 of its own surface, so a
// mutation that ignored the occurrence index entirely stayed GREEN. The repeat is the whole reason
// the key has three parts; the fixture has to contain one or the third part is untested.
const SENT = 'een landschap met een hek.';
const sentences = () => ([{
  text: SENT,
  tokens: [
    { surface: 'een',       lemma: 'een',  form: 'Artikel', sense: 'ein', confidence: 'high',       reviewed: false },
    { surface: 'landschap', lemma: '',     form: '',        sense: '',    confidence: 'unresolved', reviewed: false },
    { surface: 'met',       lemma: 'met',  form: 'Prap',    sense: 'mit', confidence: 'high',       reviewed: false },
    { surface: 'een',       lemma: 'een',  form: 'Artikel', sense: 'ein', confidence: 'high',       reviewed: false },
    { surface: 'hek',       lemma: '',     form: '',        sense: '',    confidence: 'unresolved', reviewed: false },
  ],
}]);

let failed = false;
try {
  try { fs.unlinkSync(scratch); } catch (_) {}

  // ── 1. Absence is the normal case, never an error ──────────────────────────────────────────
  {
    assert.deepStrictEqual(ac.correctionsFor('tp_nope'), [], 'no store file at all reads as no corrections');
    assert.deepStrictEqual(ac.correctionsFor(''), [], 'a missing chapter id degrades too, rather than throwing');
    const s = sentences();
    assert.strictEqual(ac.applyCorrections(s, []), s, 'an empty correction list is the identity — the same array back, not a copy');
    console.log('  absence degrades to "no corrections" everywhere: OK');
  }

  // ── 2. The merge resolves an unresolved token ──────────────────────────────────────────────
  // This is the worklist's whole purpose: a token with no lemma does not count as resolved
  // anywhere downstream (_analysisSentenceUsable, computeFrequency both test `t.lemma`).
  {
    const src = sentences();
    const out = ac.applyCorrections(src, [{ sentenceText: SENT, surface: 'landschap', occurrence: 0,
      lemma: 'landschap', form: 'Nomen', sense: 'Landschaft' }]);
    const tok = out[0].tokens[1];
    assert.strictEqual(tok.lemma, 'landschap', 'the curated lemma is applied');
    assert.strictEqual(tok.form, 'Nomen', 'and the form');
    assert.strictEqual(tok.sense, 'Landschaft', 'and the sense');
    assert.strictEqual(tok.reviewed, true, 'the token is marked reviewed — CP2\'s own schema field, unused until this cut');
    assert.strictEqual(tok.confidence, 'high',
      'and its confidence stops being "unresolved" — otherwise it counts as resolved in the DATA while still rendering as un-analysed');
    // ⚠️ Non-mutation. The merge runs on every read of a shared, cached store; mutating the record
    // in place would corrupt the cache for every later reader in the same process.
    assert.strictEqual(src[0].tokens[1].lemma, '', 'the SOURCE analysis is untouched — the merge is pure');
    assert.strictEqual(src[0].tokens[1].reviewed, false, 'including its reviewed flag');
    console.log('  a correction resolves an unresolved token, without mutating the source: OK');
  }

  // ── 3. ⚠️ OCCURRENCE targeting — the assertion that makes the key trustworthy ───────────────
  // "een" appears twice in this sentence, at token indices 0 and 3, identically cased. A key
  // without an occurrence would hit whichever one it found first, and the curator would never see
  // that their edit landed on the wrong word. Both directions are asserted (occurrence 0 hits ONLY
  // index 0, occurrence 1 hits ONLY index 3) because a merge that ignored the index entirely would
  // satisfy either one alone.
  {
    const out = ac.applyCorrections(sentences(), [{ sentenceText: SENT, surface: 'een', occurrence: 0,
      sense: 'FIRST-EEN' }]);
    const hit0 = out[0].tokens.map((t, i) => (t.sense === 'FIRST-EEN' ? i : -1)).filter(i => i >= 0);
    assert.deepStrictEqual(hit0, [0], 'occurrence 0 hits ONLY the first "een" (index 0)');

    const out2 = ac.applyCorrections(sentences(), [{ sentenceText: SENT, surface: 'een', occurrence: 1,
      sense: 'SECOND-EEN' }]);
    const hit1 = out2[0].tokens.map((t, i) => (t.sense === 'SECOND-EEN' ? i : -1)).filter(i => i >= 0);
    assert.deepStrictEqual(hit1, [3],
      'and occurrence 1 hits ONLY the second (index 3) — this pair is what makes the occurrence index testable at all');

    const out3 = ac.applyCorrections(sentences(), [{ sentenceText: SENT, surface: 'een', occurrence: 7,
      sense: 'NOPE' }]);
    assert.strictEqual(out3[0].tokens.filter(t => t.sense === 'NOPE').length, 0,
      'an occurrence beyond the repeats matches no token rather than falling back to the first');
    console.log('  the occurrence index targets the right repeat of a surface: OK');
  }

  // ── 4. A correction for a DIFFERENT sentence text does not apply ───────────────────────────
  // This is the deliberate limit of the key. When a sentence is rewritten, its corrections stop
  // applying — which is right: the words they described may no longer be there. Pinned so that a
  // future "loosen the match" change has to argue with an assertion.
  {
    const out = ac.applyCorrections(sentences(), [{ sentenceText: 'Een heel andere zin.',
      surface: 'landschap', occurrence: 0, lemma: 'WRONG' }]);
    assert.strictEqual(out[0].tokens[1].lemma, '', 'a correction keyed to another sentence is not applied');
    assert.strictEqual(out[0].tokens[1].reviewed, false, 'and the token is not marked reviewed either');
    console.log('  a correction does not leak across sentences: OK');
  }

  // ── 5. Empty fields do not blank the model's own values ────────────────────────────────────
  // Clearing one box means "the model's value was fine for this field", never "erase it". A
  // blanked lemma would UNRESOLVE the token, which no curator would mean by leaving a box empty.
  {
    const out = ac.applyCorrections(sentences(), [{ sentenceText: SENT, surface: 'met', occurrence: 0,
      sense: 'nur der Sinn', lemma: '', form: '' }]);
    const tok = out[0].tokens[2];
    assert.strictEqual(tok.sense, 'nur der Sinn', 'the field the curator filled is applied');
    assert.strictEqual(tok.lemma, 'met', 'the lemma they left blank keeps the model\'s value');
    assert.strictEqual(tok.form, 'Prap', 'and so does the form');
    console.log('  a blank field keeps the model\'s value instead of erasing it: OK');
  }

  // ── 6. Round trip through the real store: save, upsert, read, clear ────────────────────────
  {
    ac.saveCorrection('tp_x', { sentenceText: SENT, surface: 'hek', occurrence: 0, lemma: 'hek', sense: 'Zaun' });
    assert.strictEqual(ac.correctionsFor('tp_x').length, 1, 'one correction is stored');
    assert.ok(fs.existsSync(scratch), 'and it really reached the scratch file, not the project root');

    // Upsert, not append — a pile of superseded edits would leave the merge disambiguating by order.
    ac.saveCorrection('tp_x', { sentenceText: SENT, surface: 'hek', occurrence: 0, lemma: 'hek', sense: 'Gatter' });
    assert.strictEqual(ac.correctionsFor('tp_x').length, 1, 'correcting the SAME token again replaces rather than appends');
    assert.strictEqual(ac.correctionsFor('tp_x')[0].sense, 'Gatter', 'and the newer value wins');

    ac.saveCorrection('tp_x', { sentenceText: SENT, surface: 'landschap', occurrence: 0, lemma: 'landschap' });
    assert.strictEqual(ac.correctionsFor('tp_x').length, 2, 'a DIFFERENT token is a second correction');
    assert.strictEqual(ac.correctionsFor('tp_other').length, 0, 'and another chapter is unaffected');

    assert.strictEqual(ac.deleteCorrection('tp_x', { sentenceText: SENT, surface: 'hek', occurrence: 0 }), true,
      'clearing one correction reports that it removed something');
    assert.strictEqual(ac.correctionsFor('tp_x').length, 1, 'and only that one is gone');
    assert.strictEqual(ac.deleteCorrection('tp_x', { sentenceText: SENT, surface: 'hek', occurrence: 0 }), false,
      'clearing it again is a harmless no-op, not an error');
    console.log('  save/upsert/read/clear round-trips through the store: OK');
  }

  // ── 7. ⚠️ Deleting a CHAPTER takes its corrections; re-analysing must NOT ───────────────────
  // The asymmetry IS the feature. v88_ac fixed exactly this leak for canonical-analysis.json (5 of
  // 20 entries were orphans of deleted chapters); a second per-chapter store added without the same
  // cleanup would reintroduce it on day one. But the force-re-analyse path must leave corrections
  // alone, or "sticky" means nothing.
  {
    ac.saveCorrection('tp_del', { sentenceText: SENT, surface: 'hek', occurrence: 0, lemma: 'hek' });
    assert.strictEqual(ac.correctionsFor('tp_del').length, 1, 'precondition: the chapter has a correction');
    assert.strictEqual(ac.deleteChapterCorrections('tp_del'), true, 'deleting the chapter drops its corrections');
    assert.strictEqual(ac.correctionsFor('tp_del').length, 0, 'and they are really gone');
    assert.strictEqual(ac.correctionsFor('tp_x').length, 1,
      'while an unrelated chapter keeps its own — a targeted drop, not a sweep');
    assert.strictEqual(ac.deleteChapterCorrections('tp_never'), false,
      'a chapter with no corrections is a harmless no-op');
    console.log('  deleting a chapter drops its corrections, and only its own: OK');
  }

  // ── 8. The store on disk is addressed by chapter, and survives a reread ────────────────────
  {
    const raw = JSON.parse(fs.readFileSync(scratch, 'utf8'));
    assert.strictEqual(raw.schemaVersion, 1, 'the file is stamped with a schema version');
    assert.ok(raw.chapters && raw.chapters['tp_x'], 'and keyed by chapter id');
    assert.strictEqual(raw.chapterCount, Object.keys(raw.chapters).length,
      'chapterCount is re-derived on every write, not left stating an old total');
    assert.ok(raw.chapters['tp_x'].corrections[0].correctedAt, 'each correction is timestamped');
    console.log('  the store file shape is stable and self-describing: OK');
  }

  // ── 9. v88_ae: partitionCorrections splits applied from orphaned ───────────────────────────
  // A correction whose sentence has been rewritten away is a NORMAL state, not corruption — and the
  // user's ruling is that it is KEPT and listed for repair, never deleted on the rewrite. So the
  // split has to be a first-class answer, not something inferred from a failed merge.
  {
    const corr = [
      { sentenceText: SENT, surface: 'landschap', occurrence: 0, lemma: 'landschap' }, // applies
      { sentenceText: SENT, surface: 'een', occurrence: 1, lemma: 'een' },             // applies
      { sentenceText: 'Een zin die is herschreven.', surface: 'zin', occurrence: 0, lemma: 'zin' }, // orphan: sentence gone
      { sentenceText: SENT, surface: 'een', occurrence: 9, lemma: 'x' },               // orphan: no 10th "een"
      { sentenceText: SENT, surface: 'ontbreekt', occurrence: 0, lemma: 'y' },         // orphan: no such token
    ];
    const p = ac.partitionCorrections(sentences(), corr);
    assert.strictEqual(p.applied.length, 2, 'two corrections still land on a token');
    assert.strictEqual(p.orphaned.length, 3, 'and three do not');
    assert.deepStrictEqual(p.orphaned.map(c => c.surface).sort(), ['een', 'ontbreekt', 'zin'],
      'the orphans are the rewritten sentence, the out-of-range occurrence and the missing surface');
    assert.deepStrictEqual(p.applied.map(c => c.surface).sort(), ['een', 'landschap'],
      'and the applied ones are exactly the rest');
    console.log('  partitionCorrections splits applied from orphaned: OK');
  }

  // ── 10. ⚠️ The split must AGREE with the merge ─────────────────────────────────────────────
  // These are two answers to one question ("does this correction land on a token"), and the whole
  // feature rests on them agreeing: the UI reports a count from the partition while the reader sees
  // the result of the merge. If they drifted, a curator would be told N corrections apply while a
  // different number actually did. Asserted by construction rather than by inspection — every
  // correction the partition calls APPLIED must change a token, and every ORPHAN must change none.
  {
    const corr = [
      { sentenceText: SENT, surface: 'landschap', occurrence: 0, sense: 'MARK-A' },
      { sentenceText: SENT, surface: 'een', occurrence: 1, sense: 'MARK-B' },
      { sentenceText: 'weg.', surface: 'weg', occurrence: 0, sense: 'MARK-C' },
      { sentenceText: SENT, surface: 'een', occurrence: 4, sense: 'MARK-D' },
    ];
    const p = ac.partitionCorrections(sentences(), corr);
    const merged = ac.applyCorrections(sentences(), corr);
    const marks = new Set(merged.flatMap(s => s.tokens.map(t => t.sense)));
    for (const c of p.applied)
      assert.ok(marks.has(c.sense), `partition says "${c.sense}" applies, and the merge applied it`);
    for (const c of p.orphaned)
      assert.ok(!marks.has(c.sense), `partition says "${c.sense}" is orphaned, and the merge ignored it`);
    // Non-vacuity: this would pass trivially if both lists were empty.
    assert.ok(p.applied.length > 0 && p.orphaned.length > 0,
      'non-vacuity: the fixture really contains both kinds (got ' + p.applied.length + '/' + p.orphaned.length + ')');
    console.log('  the partition and the merge agree token-for-token: OK');
  }

} catch (e) { failed = true; console.error(e); }
finally { try { fs.unlinkSync(scratch); } catch (_) {} }
console.log(failed ? 'unit-analysis-corrections: FAILED' : 'unit-analysis-corrections: ALL PASSED');
process.exit(failed ? 1 : 0);
