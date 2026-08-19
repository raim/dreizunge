// unit-lesson-script-output.test.js
// v80_h — a lesson for a non-Latin chapter must actually CONTAIN the target script.
//
// `v79_f` found a Serbian (cyrillic-sr) conjugation lesson written entirely in Latin and fixed the
// PROMPT, pinning the script. `unit-script-pin-coverage` guards that every prompt carries that pin.
// **But a pin is an instruction, and a model can ignore it** — and nothing checked the OUTPUT.
// Rule 34: guard at the layer where the claim is observable. "This lesson is in the target script"
// is observable in the LESSON, not in the prompt that asked for it.
//
// Swept at this cut (`build_history/probe_lesson_script_v80h.js`): 7 lessons across 5 Serbian
// chapters carry ZERO Cyrillic, of which only ONE was known. Arabic, Hebrew and Japanese are clean.
//
// ⚠️ Fixtures are SYNTHETIC plus ONE pinned real case, deliberately. The corpus still holds those 7,
// so a corpus-wide assertion would be red on arrival and would then be "fixed" by weakening it. The
// count belongs to the probe, which reports. This file pins the DETECTOR.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const SCRIPTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts.json'), 'utf8'));
// Sliced on function boundaries, not by counting braces: this function contains regex literals with
// `{` in them, and a brace counter walks straight off the end of it.
const a = src.indexOf('function lessonScriptDefect(');
const b = src.indexOf('\nfunction buildGenMeta(');
assert.ok(a >= 0 && b > a, 'lessonScriptDefect is still defined in server.js above buildGenMeta');
const detect = new Function('_scriptsData', src.slice(a, b) + '\nreturn lessonScriptDefect;')(SCRIPTS);

// Repeats the TEXT, not spaces. The first version padded with spaces, so the fixture had ~85 Latin
// characters and never cleared the detector's 200-character floor — section 2's `null` assertions
// passed vacuously and section 3's non-vacuity check is what caught it.
const pad = (s, n) => s.repeat(Math.ceil(n / s.length)).slice(0, n);
const latinLesson = (extra) => ({ id: 'x', type: 'conjugation',
  conjugations: [{ infinitive: 'raditi', forms: ['I work here every single day of the week'] }],
  note: pad('This whole lesson is written in the Latin alphabet only and carries plenty of text ', 300) + (extra || '') });

// ── 1. Real Cyrillic content is NOT flagged ───────────────────────────────
// ⚠️ REWRITTEN at the v80_i drop. This section used to pin the reported PAIR — the all-Latin
// `id=6` conjugation lesson and its correct regeneration — and assert that one was flagged and the
// other clean. **The user then deleted the broken lesson, which is exactly what this detector
// exists to prompt, and the section failed.** Pinning a corpus item whose whole purpose is to be
// cleaned up is a guard that breaks on success. Rule 29: the CLAIM did not change, the corpus did.
//
// What survives, and is the part worth guarding against real data: the detector must not
// FALSE-POSITIVE on genuine target-script lessons. The flagged case is synthetic below, where it
// cannot be deleted out from under the test.
{
  const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
  const cyr = store.topics.filter(t => t.script === 'cyrillic-sr' && (t.lessons || []).length);
  assert.ok(cyr.length, 'the corpus still has cyrillic-sr chapters to check against');
  let clean = 0, flagged = 0;
  for (const t of cyr) for (const L of (t.lessons || [])) {
    if (!L || L._hidden) continue;
    if (detect(L, t.script)) flagged++; else clean++;
  }
  assert.ok(clean > 0,
    'non-vacuity: real Cyrillic lessons exist and are NOT flagged — otherwise the rule fires on ' +
    'everything and the sections below prove nothing');
  console.log(`  real cyrillic-sr corpus: ${clean} clean, ${flagged} still flagged (see probe_lesson_script_v80h.js)`);
}

// ── 2. ⚠️ NO OPINION where it has no business having one ───────────────────
// Without this the rule could be "flag anything", which would fire on the whole Latin corpus.
{
  const L = latinLesson();
  assert.strictEqual(detect(L, 'latin'), null, 'a latin chapter is never flagged');
  assert.strictEqual(detect(L, null), null, 'no script stamped: no opinion');
  assert.strictEqual(detect(L, 'not-a-real-script'), null, 'unknown script: no opinion, not a guess');
  assert.strictEqual(detect(null, 'cyrillic-sr'), null, 'no lesson: no opinion');
  console.log('  silent on latin, unstamped, and unknown scripts');
}

// ── 3. One character of the script is enough to clear it ───────────────────
// The claim is "contains the target script at all", NOT "is mostly in it" — a stronger rule would
// need a ratio, and a ratio is a language judgement this file has no basis to make.
{
  const L = latinLesson();
  assert.ok(detect(L, 'cyrillic-sr'), 'non-vacuity: the all-Latin fixture IS flagged');
  const one = JSON.parse(JSON.stringify(L));
  one.conjugations[0].forms.push('радим');
  assert.strictEqual(detect(one, 'cyrillic-sr'), null,
    'a lesson carrying target-script text is not flagged');
  console.log('  one script-bearing field clears the lesson');
}

// ── 4. Machine fields do not count as content ──────────────────────────────
// `_genMeta`, ids and type names are never in the target script; if they counted, a lesson could
// clear the check on its provenance stamp alone.
{
  const L = latinLesson();
  L._genMeta = { type: 'conjugation', model: 'qwen3.6:35b-a3b', at: '2026-01-01T00:00:00.000Z' };
  assert.ok(detect(L, 'cyrillic-sr'), 'provenance fields do not rescue an all-Latin lesson');
  console.log('  _genMeta does not count as target-script content');
}

// ── 5. A nearly empty lesson is a DIFFERENT defect, not claimed here ───────
{
  const tiny = { id: 'y', type: 'conjugation', conjugations: [{ infinitive: 'x', forms: ['ab'] }] };
  assert.strictEqual(detect(tiny, 'cyrillic-sr'), null,
    'too little text for the absence to mean anything — this detector does not claim it');
  console.log('  a nearly empty lesson is not claimed by this rule');
}

// ── 6. Other scripts work, from the DATA not from a hardcoded range ────────
// The alphabet comes from scripts.json. If a future script is added there, this rule covers it with
// no code change — which is the reason it is written this way.
{
  const arabicish = { id: 'z', type: 'standard',
    vocab: [{ target: 'كتاب', source: 'book' }],
    note: pad('padding text to clear the length floor ', 300) };
  const names = Object.keys(SCRIPTS).filter(k => !k.startsWith('_'));
  const ar = names.find(n => /arab/i.test(n));
  if (ar) {
    assert.strictEqual(detect(arabicish, ar), null, `${ar}: a lesson with Arabic text is not flagged`);
    assert.ok(detect(latinLesson(), ar), `${ar}: an all-Latin lesson IS flagged`);
    console.log(`  the rule is data-driven: it works for ${ar} with no code change`);
  } else {
    console.log('  (scripts.json lists no arabic table at this cut — data-driven case not exercised)');
  }
}

// ── 7. v80_m — a comprehension lesson is NOT claimed by this rule ─────────
// The v80_h version of this detector flagged 7 lessons and FOUR were comprehension lessons that
// were not defective. Comprehension questions are written in the SOURCE language throughout the
// corpus (de->fr gives German questions, ar->en Arabic, it->de Italian) — that is the design, not a
// bug. Measured across non-Latin-target chapters: comprehension carries target-script text in 1 of
// 5 lessons, where `standard` is 61 of 62 and synonyms/word_forms/grammar/intro_script/error_hunt
// are 100%.
{
  const comp = { id: 'c', type: 'comprehension',
    questions: [{ q: 'Warum ist Max\' Pfote schmutzig?', choices: ['Weil er im Park war'], correctIndex: 0 }],
    note: pad('Alle Fragen und Antworten stehen in der Ausgangssprache, wie im ganzen Korpus. ', 300) };
  assert.strictEqual(detect(comp, 'cyrillic-sr'), null,
    'a comprehension lesson written in the source language is NOT a defect');
  // Non-vacuity: the SAME text under a type that does carry target language IS flagged, so this is
  // an exemption for one type and not the rule going quiet.
  const asStandard = Object.assign({}, comp, { type: 'standard' });
  assert.ok(detect(asStandard, 'cyrillic-sr'),
    'the same content as a `standard` lesson IS flagged — the exemption is per-type, not blanket');
  console.log('  comprehension is exempt; the same text as `standard` is still flagged');
}

// ── What this does NOT establish (rule 34) ─────────────────────────────────
// • It says nothing about a lesson in the WRONG non-Latin script, nor about one that is mostly
//   Latin with a token of the target script. Both need a ratio, and a ratio is a language judgement.
// • It does not distinguish "correct Serbian in the wrong SCRIPT" from "the wrong LANGUAGE". Both
//   remaining corpus hits are the former — correct Serbian written in gajica rather than Cyrillic —
//   which is a transliteration away, not a regeneration. The rule cannot tell them apart.
// • It does not run at generation time yet. `_genMeta` records the flag; nothing rejects or retries
//   on it, because whether a retry converges needs a live model to establish.
console.log('unit-lesson-script-output: ALL PASSED');
