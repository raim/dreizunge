// unit-text-normalise.test.js — v89_aa.
//
// User report, two runs of the SAME comic: "Some texts are correctly un-capitalized others not. We
// generally want to un-capitalize and issue a correct normal capitalization for the extracted
// language."
//
// ⚠️ _comicExtractPrompt has ASKED for exactly this since v85_k — in detail, with a German worked
// example that v85_l proved necessary across three live rounds. It still fails: the corpus holds
// "ES GIBT EIN LAND, WO DIE KÖPFE ALLER MENSCHEN KNÖDELN GLEICHEN", the very sentence that worked
// example spells out, transcribed in full caps anyway. AN INSTRUCTION IS NOT A MECHANISM. This file
// guards the mechanism that was added around it, which has exactly two deterministic parts:
//
//   1. A DETECTOR that decides when the vision model's own output still needs fixing. Its whole job
//      is telling a failed un-shouting apart from lettering that is SUPPOSED to be capitals.
//   2. A VERIFIER that decides whether the repair model's reply may be applied at all. Its whole job
//      is keeping "fix the surface" from becoming "rewrite the text".
//
// Both are pure functions over strings, so both are fully testable without a model — which is the
// point: everything a model does here is bounded by these two.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// Lift the real functions out of server.js — the same technique unit-answer-check and
// unit-qc-ambiguous-options use for server internals.
function lift(name) {
  const at = server.indexOf('function ' + name + '(');
  assert.ok(at > -1, `server.js defines ${name}`);
  let d = 0, i = server.indexOf('{', at);
  for (; i < server.length; i++) { if (server[i] === '{') d++; else if (server[i] === '}') { d--; if (!d) { i++; break; } } }
  return server.slice(at, i);
}
// ⚠️ The floor is READ from server.js, not restated here — a test that carries its own copy of the
// number cannot notice the product's moving. It is asserted below instead, so a deliberate change
// has to come here too.
const floorM = /const SHOUT_RUN_MIN = (\d+);/.exec(server);
assert.ok(floorM, 'server.js declares SHOUT_RUN_MIN');
assert.strictEqual(Number(floorM[1]), 4,
  'the floor of 4 is measured, not arbitrary — see section 1. Moving it needs new measurements ' +
  'over the corpus, and this line is where you record that you took them.');

const F = new Function(
  [floorM[0], lift('shoutedRun'), lift('needsCaseNormalise'), lift('_surfaceKey'), lift('_lev'),
   lift('_lines'), lift('textNormaliseChanges'),
   'return { shoutedRun, needsCaseNormalise, textNormaliseChanges, _surfaceKey };'].join('\n'))();
const { shoutedRun, needsCaseNormalise, textNormaliseChanges, _surfaceKey } = F;

// ── 1. The detector's threshold, which is the whole false-positive story ────────────────────────
// ⚠️ The floor of 4 is not taste — it was MEASURED over all 20 panels in the corpus that carry
// extracted text. The two groups it has to separate, with their longest shouted run:
//
//   must be fixed     9, 11, 15, 19, 20, 20, 33   (whole panels transcribed in caps)
//   must be LEFT      3  "REIZEN DOOR ZEELAND"    (a brand lockup on a real Dutch sign)
//                     2  "GRATIS / KOSTENLOS"     (a real bilingual sign)
//                     1  "ONTEIGENINGSZONE", "PULITO"  (one shouted word, for emphasis)
//
// Rewriting the second group would be the bug: those signs really are set in capitals, and the
// learner is reading a photograph of them. This section pins BOTH sides — a threshold that only
// ever fires is as wrong as one that never does.
{
  const shout = [
    ['NATÜRLICH KAM DANN NIE EIN RIESE. GIBT JA KEINE', 9],
    ['ES GIBT EIN LAND, WO DIE KÖPFE ALLER MENSCHEN KNÖDELN GLEICHEN', 11],
  ];
  for (const [txt, run] of shout) {
    assert.strictEqual(shoutedRun(txt), run, `run length for ${JSON.stringify(txt.slice(0, 30))}`);
    assert.ok(needsCaseNormalise(txt), 'a fully shouted panel is flagged');
  }
  // The real corpus texts that must NOT be touched.
  const keep = [
    'U rijdt nu 500 meter van een N2000 gebied\nONTEIGENINGSZONE\nDit raakt niet alleen boeren.',
    'Aiutateci a mantenere PULITO questo bagno:\nlasciatelo come vorreste trovarlo!!!\nGrazie!',
    'GRATIS\nKOSTELOOS\n(bord laten staan)',
    'Scan de QR-code voor meer informatie\nREIZEN\nDOOR\nZEELAND\nwww.reizendoorzeeland.nl',
  ];
  for (const txt of keep) {
    assert.ok(!needsCaseNormalise(txt),
      `deliberate capitals must be left alone: ${JSON.stringify(txt.slice(0, 40))} ` +
      `(run ${shoutedRun(txt)}, floor 4)`);
  }
  // The boundary itself, both sides, so a moved floor cannot pass silently.
  assert.ok(!needsCaseNormalise('EIN ZWEI DREI klein'), 'three shouted words is below the floor');
  assert.ok(needsCaseNormalise('EIN ZWEI DREI VIER klein'), 'four is at it');

  // ⚠️ Unicode machinery only — no per-language table (PLAN §4). A caseless script cannot score,
  // so those languages are never sent to the repair model at all.
  assert.strictEqual(shoutedRun('これは日本語のテキストです'), 0, 'Japanese: no cased letters, no opinion');
  assert.strictEqual(shoutedRun('هذا نص عربي طويل جدا'), 0, 'Arabic: same');
  assert.ok(needsCaseNormalise('ΑΥΤΟ ΕΙΝΑΙ ΕΝΑ ΕΛΛΗΝΙΚΟ ΚΕΙΜΕΝΟ'), 'Greek is handled by the same rule');
  assert.ok(needsCaseNormalise('ЭТО ОЧЕНЬ ГРОМКИЙ РУССКИЙ ТЕКСТ'), 'and Cyrillic');
  // A single-letter or caseless token must not BREAK a run — "I" and "5." are evidence neither way,
  // so they neither count toward it nor end it. Here that means 4 (LISTEN UP HAVE BEEN), not 2.
  assert.strictEqual(shoutedRun('LISTEN UP I HAVE BEEN'), 4,
    'the one-letter "I" is skipped, not treated as a break — a break would score 2');
  assert.strictEqual(shoutedRun('LISTEN UP klein HAVE BEEN'), 2,
    'but a genuinely lower-case word DOES break it');
}
console.log('  the detector fires on failed un-shouting and leaves deliberate capitals alone: OK');

// ── 2. The verifier: what the repair model is ALLOWED to do ─────────────────────────────────────
// cleanNarrativeText's contract is "deletion only". This one's is "SURFACE only", and it is what
// makes the pass safe to run unattended inside the extraction job.
{
  const ok = (a, b, why) => {
    const r = textNormaliseChanges(a, b);
    assert.ok(r.ok, `${why} — should be accepted, got ${JSON.stringify(r)}`);
    return r;
  };
  const no = (a, b, why, expect) => {
    const r = textNormaliseChanges(a, b);
    assert.ok(!r.ok, `${why} — should be REJECTED, got ${JSON.stringify(r)}`);
    if (expect) assert.strictEqual(r.why, expect, `${why} — rejected for the right reason`);
  };

  // Allowed: case, punctuation, and both together — the ordinary result.
  const r1 = ok('NATÜRLICH KAM DANN NIE EIN RIESE\nGIBT JA KEINE',
                'Natürlich kam dann nie ein Riese.\nGibt ja keine.', 'recase + repunctuate');
  assert.strictEqual(r1.words, 9);
  assert.strictEqual(r1.cased, 9, 'all nine words changed surface only');
  assert.strictEqual(r1.repaired, 0, 'and none of them counted as a typo repair');
  // Allowed and REPORTED AS UNCHANGED: the already-correct text. Rule C of the prompt.
  const r2 = ok('Es gibt ein Land.', 'Es gibt ein Land.', 'an already-correct text');
  assert.strictEqual(r2.changed, 0, 'nothing changed');

  // ⚠️ Allowed: ß. A LIVE run caught this one. German ß upper-cases to SS, so un-shouting
  // "GROSSES" to "großes" is a CASE mapping and the correct answer — but folded DOWN it scores two
  // edits, blows the repair budget and is rejected, and the retry then returns a visibly worse,
  // timid result that leaves the line shouted. _surfaceKey folds UP for exactly this.
  assert.strictEqual(_surfaceKey('GROSSES'), _surfaceKey('großes'), 'ß folds onto SS');
  const r3 = ok('EIN GROSSES SCHILD', 'ein großes Schild', 'ß restored while un-shouting');
  assert.strictEqual(r3.repaired, 0, 'ß is a case change, NOT a typo repair');

  // Allowed: a bounded repair of a misread letter — the other half of what the user asked for.
  const r4 = ok('RIÉSEN SINd HIER', 'Riesen sind hier', 'a misread letter and a stray capital');
  assert.strictEqual(r4.repaired, 0, 'É→e is a diacritic, so still surface-only');
  const r5 = ok('DIE KOEPFE ALLER', 'Die Köpfe aller', 'OE written for ö');
  assert.strictEqual(r5.repaired, 1, 'that one IS a repair — a letter was dropped');

  // ⚠️ Refused: everything that would make this a rewrite rather than a repair. These are the
  // assertions the feature rests on — the model is unattended when the automatic pass runs.
  no('EIN GROSSES SCHILD', 'ein großes Schild hier', 'a word was ADDED', 'words');
  no('EIN GROSSES SCHILD', 'ein Schild', 'a word was DELETED', 'words');
  no('EIN GROSSES SCHILD', 'ein Schild großes', 'words were REORDERED', 'word');
  no('DIE RIESEN KOMMEN', 'Die Giganten kommen', 'a word was SUBSTITUTED', 'word');
  no('The cat sat', 'Die Katze saß', 'the text was TRANSLATED', 'word');
  // ⚠️ And the line structure, which v88_z established is real content: a sign's own boundaries.
  no('GRATIS\nKOSTENLOS', 'Gratis Kostenlos', 'lines were MERGED', 'lines');
  no('GRATIS KOSTENLOS', 'Gratis\nKostenlos', 'a line was SPLIT', 'lines');
  // Trailing/leading blank lines are the model being untidy, not a structural change.
  ok('GRATIS\nKOSTENLOS', '\nGratis\nKostenlos\n\n', 'stray blank lines around the reply');

  // ⚠️ The repair budget's REAL limit, stated honestly rather than wished away. Edit distance
  // cannot tell "fix a misread letter in HUND" from "swap HAND in for HUND" — they are the same
  // one-character move. A budget that refused it would also refuse KOEPFE→Köpfe, which is half of
  // what the user asked for, so ONE edit is allowed and IS the exposure:
  const near = textNormaliseChanges('DER HUND', 'der Hand');
  assert.ok(near.ok, 'a one-edit change is allowed — this is the documented limit, not an oversight');
  assert.strictEqual(near.repaired, 1,
    '...but it is COUNTED as a repair rather than waved through as a case change, so the caller ' +
    'and the log can see that a letter really moved');
  // The budget is what keeps that exposure to one letter. Two edits on a short word is refused.
  no('DER HUND', 'der Hände', 'two edits on a 4-letter word', 'word');
  no('DIE RIESEN', 'die Riesenrad', 'a word that grew past the budget', 'word');
}
console.log('  the verifier accepts case/punctuation/bounded repairs and refuses every rewrite: OK');

console.log('unit-text-normalise: ALL PASSED');
