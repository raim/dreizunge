// Prompt-strictness guards: (1) synonyms/antonyms must be drop-in replacements (substitutable in a
// sentence); (2) the dialect-from-glossary prompts require SEVERAL glossary words, and the V2
// rewrite retries once when too few glossary words land.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const prompts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'prompts.json'), 'utf8'));

// ── Vocab: no two items in one lesson may be interchangeable (v89_u) ──────────────────
// ⚠️ THE LEVER HERE IS NOT WHAT THE ROADMAP ASSUMED. "Harden the prompt so DISTRACTORS must be wrong
// for this item" cannot work: distractors for the meaning-based MCQ types are chosen CLIENT-side,
// by `wS`/`wV` sampling the OTHER items' glosses, filtered only by exact string inequality. The
// model never picks them. What the model DOES control is which items share a lesson — so the rule
// is about the ITEM SET, and it is the one place a prompt can reduce this defect at all.
//
// The reported instance: `gratis`→`kostenlos` and `kosteloos`→`umsonst` in ONE lesson, so the
// sibling-sampled distractor `KOSTENLOS` was a perfectly good answer to `KOSTELOOS`.
//
// ⚠️ Prompt text is not behaviour — see the inflections block below, where three release lines of
// {S} instructions were obeyed in 1 run of 3. This asserts the instruction is PRESENT and was not
// quietly reworded away; `v89_u`'s entry carries the live measurement.
for (const key of ['vocab', 'vocabFromText']) {
  const sys = prompts[key].system;
  assert.ok(/NO TWO ITEMS IN ONE LESSON MAY BE INTERCHANGEABLE/.test(sys),
    key + ': carries the interchangeability rule');
  // ⚠️ The REASON is asserted, not just the rule. This repo has its own evidence that a model told
  // WHY a rule exists follows it more reliably — the synonyms prompt's "marked WRONG" clause, pinned
  // a few lines below. Dropping the explanation would leave a bare instruction that reads as style.
  assert.ok(/multiple-choice questions by taking ONE item as the answer/.test(sys),
    key + ': explains the MECHANISM — that the app samples the other items as wrong options');
  assert.ok(/marked WRONG for choosing the one you did not designate/.test(sys),
    key + ': and states the consequence for the learner, which is what makes it a rule and not a preference');
  assert.ok(/Concrete: if one entry is glossed/.test(sys), key + ': and gives a worked counter-example');
}
console.log('  vocab prompts forbid interchangeable items in one lesson, with the mechanism and the reason: OK');


// ── Inflections: which language each field is written in (v89_c) ───────────────────
// User ruling, taken after the live corpus was measured: the grammatical-form LABEL stays an
// explanation in {S}, the language the learner already speaks — it is not moved to {L}. The label's
// readout follows that (unit-inflection-speak-lang §1/§2/§5), so the prompt is the only lever left
// for the drift the measurement found: nl/de and it/nl chapters carry formLabels the model wrote in
// the TARGET language, against this prompt's own {S} instruction, while en/ja, de/en, it/en and
// en/de comply. That is roadmap_v86.md's item AJ ({S}-designated fields comply reliably when {S} is
// English) showing up in real data.
//
// ⚠️ This guards prompt TEXT, and prompt text is all a prompt is — but it cannot guard model
// BEHAVIOUR. Nothing here proves the drift stops; it proves the instruction is present and did not
// get quietly reworded away, which is exactly what happened to the same field's own worked example
// at v86_ab. Re-measure the corpus, do not read this test as evidence.
{
  const inflSys = prompts.inflections.system;
  assert.ok(/AS A SHORT PHRASE IN \{S\}, THE LEARNER'S OWN LANGUAGE — NOT in \{L\}/.test(inflSys),
    "formLabel's own bullet says {S} AND says not {L} — the positive alone is what the model was already ignoring");
  assert.ok(/2 to 6 short labels IN \{S\} \(never in \{L\}\)/.test(inflSys),
    'formChoices carries the same explicit negative — a compliant formLabel with target-language choices is the half-failure this catches');
  assert.ok(/THE LANGUAGE OF EACH FIELD IS FIXED/.test(inflSys),
    'a dedicated RULE names the field-language split rather than leaving it implied per-field');
  // The rule PARTITIONS the fields. A rule that only repeated "use {S}" would add nothing over the
  // per-field text that was already being ignored; naming the three {L} fields is what makes the
  // boundary checkable by the model itself.
  for (const f of ['surfaceForm', 'lemma', 'lemmaChoices']) {
    assert.ok(new RegExp('THREE fields are in \\{L\\}[^.]*"' + f + '"').test(inflSys),
      `the field-language rule names "${f}" as one of the {L} fields`);
  }
  for (const f of ['formLabel', 'formChoices', 'translation', 'explanation']) {
    assert.ok(new RegExp('EVERY other field[^.]*"' + f + '"').test(inflSys),
      `the field-language rule names "${f}" as an {S} field`);
  }
  assert.ok(/RE-READ every "formLabel" and every entry of every "formChoices" list/.test(inflSys),
    'and a re-read step before returning the JSON — the self-check that gives the model somewhere to catch its own drift');
  // The schema block repeats it, because a model that skims the prose still reads the schema.
  assert.ok(/"formLabel": "short phrase IN \{S\}, NOT in \{L\}/.test(inflSys), 'the SCHEMA line for formLabel repeats the constraint');
  assert.ok(/"formChoices": \["2 to 6 short labels IN \{S\}, NOT in \{L\}/.test(inflSys), 'and the schema line for formChoices');
  // Non-vacuity: the {L}-only fields must NOT have picked up an {S} instruction in the process.
  assert.ok(/"lemma" is the word's DICTIONARY \(citation\) form/.test(inflSys),
    'lemma is still described as the word\'s own dictionary form — the hardening did not spill onto the {L} fields');
}
console.log('  inflections: formLabel/formChoices are pinned to {S} with an explicit "not {L}" and a re-read step: OK');

// ── Synonyms/antonyms: substitutability ─────────────────────────────────────────
const synSys = prompts.synonyms.system;
assert.ok(/drop-in replacement for "base"/.test(synSys), 'synonyms rule requires a drop-in replacement');
// v72_d: the requirement is now anchored to the sentence the model itself quoted, not to "a
// sentence" in the abstract. Before this, the model chose synonyms having never seen the story —
// so nothing tied the sense it picked to the sentence the learner is eventually shown.
assert.ok(/that exact sentence in place of "base"/.test(synSys),
  'synonyms must be substitutable in THAT sentence, not merely in some sentence');
assert.ok(/the quoted sentence decides which one is meant/.test(synSys),
  'and the prompt says explicitly that the quoted sentence resolves the sense');

// v72_e (user-reported): the model was returning shaky synonyms because the prompt DEMANDED at
// least one. A doubtful entry is not a harmless extra — buildSynExercises makes a select-all, so
// a learner who does not tick the questionable word is marked WRONG. Fewer, certain entries beat
// more, uncertain ones, and an empty list is a legitimate answer.
assert.ok(/QUALITY OVER QUANTITY/.test(synSys), 'the prompt prefers precision over count');
assert.ok(/\[\] is better than/.test(synSys), 'and says an empty list beats a bad entry');
assert.ok(/marked WRONG/.test(synSys),
  'and gives the REASON — a model told why a rule exists follows it more reliably than one given a bare instruction');
assert.ok(/DROP the ones you are not sure of/.test(synSys), 'with an explicit instruction to drop doubtful candidates');
assert.ok(!/at least 1, up to 4/.test(synSys), 'the old "at least 1" floor is gone — it is what forced the shaky entries');

// An entry needs ONE relation, not both: a word with good antonyms and no convincing synonym is
// a perfectly good entry. The server enforces the same rule (see below).
assert.ok(/at least ONE of "synonyms" or "antonyms"/.test(synSys), 'one relation is enough');
assert.ok(/but NOT both/.test(synSys), 'and both are explicitly not required');
assert.ok(/DIFFERENT sense of "base"/.test(synSys), 'synonyms rule excludes a different sense');
// v73 (user-reported: too few antonyms). Antonyms are held to a DIFFERENT, looser standard than
// synonyms, and the asymmetry is deliberate rather than sloppy — it mirrors what the two exercises
// actually ask. The synonym round asks "similar to X" (ui: ex.syn.q_synonyms), which implies X could
// be replaced; the antonym round asks "opposite to X" (ex.syn.q_antonyms), which does not. Requiring
// an antonym to be substitutable in the quoted sentence was therefore stricter than the question
// being put to the learner, and it suppressed perfectly good opposites.
assert.ok(/does NOT have to be substitutable in the quoted\s*sentence/.test(synSys.replace(/\s+/g, ' ')) ||
          /does NOT have to be substitutable in the quoted sentence/.test(synSys.replace(/\s+/g, ' ')),
  'antonyms are NOT held to the synonym substitution test');
assert.ok(/same part of speech/.test(synSys),
  'but they do keep the part of speech, so the options read consistently');
assert.ok(/genuine opposite of the SENSE/.test(synSys),
  'and they still match the sense the quoted sentence establishes — the sense check is the part that must NOT be relaxed');
assert.ok(/be GENEROUS/.test(synSys),
  'and the model is told to be generous, because the previous rule produced too few antonyms');
// The synonym side must NOT have been loosened along with it.
assert.ok(/QUALITY OVER QUANTITY/.test(synSys) && /DROP the ones you are not sure of/.test(synSys),
  'synonyms are still held to the strict standard — only antonyms were relaxed');
console.log('  synonyms/antonyms substitutability rules: OK');

// ── v72_d: the quoted context sentence ──────────────────────────────────────────
// The model now returns the story sentence it had in mind. The server checks it character-for-
// character against the story, so the prompt has to say that plainly — a model that thinks it may
// paraphrase will, and the item then silently falls back to a server-picked sentence.
{
  assert.ok(/"sentence"/.test(synSys), 'the schema has a sentence field');
  assert.ok(/VERBATIM/.test(synSys), 'the prompt demands a verbatim quote');
  assert.ok(/Do NOT paraphrase, translate, shorten, join two/.test(synSys),
    'and spells out the ways a model usually breaks a verbatim quote');
  assert.ok(/DISCARDED if\s*\n?\s*it does not match/.test(synSys.replace(/\s+/g, ' ')) ||
            /DISCARDED if it does not match/.test(synSys.replace(/\s+/g, ' ')),
    'and states the consequence, so the instruction is not merely decorative');
  assert.ok(/return ""/.test(synSys), 'with a defined answer when no sentence contains the word');
  assert.ok(prompts.synonyms.storyBlock && /\{story\}/.test(prompts.synonyms.storyBlock),
    'the story itself is passed, not just extracted keywords');
  const ex = Object.values(prompts.synonyms.examples || {}).join('\n');
  assert.ok(/"sentence":"/.test(ex), 'the worked example demonstrates the new field');
  console.log('  synonyms context-sentence rules: OK');
}

// The prompt may only permit an antonym-only entry if the SERVER keeps one. These two drifted in
// opposite directions before v72_e: the prompt demanded >=1 synonym and the server dropped anything
// without one, so "give fewer synonyms" would have silently deleted whole words.
{
  assert.ok(/if \(!synonyms\.length && !antonyms\.length\) continue;/.test(server),
    'the server keeps an entry that has EITHER relation — otherwise a strict prompt loses words');
  assert.ok(!/if \(!synonyms\.length\) continue;/.test(server),
    'and no longer requires a synonym specifically');
  console.log('  server keeps antonym-only entries, matching the prompt: OK');
}

// ── Dialect prompts: require several glossary words ─────────────────────────────
assert.ok(/MUST use SEVERAL glossary dialect words/.test(server), 'V1 dialect prompt requires several glossary words');
assert.ok(/MUST substitute SEVERAL glossary dialect words/.test(server), 'V2 dialect prompt requires several glossary words');
assert.ok(/only one \(or none\) of the glossary words is a failure/.test(server), 'dialect prompt marks 1-or-0 usage as a failure');

// ── V2 coverage-gated retry ──────────────────────────────────────────────────────
const v2 = server.slice(server.indexOf('async function generateDialectStoryV2'),
                        server.indexOf('async function qcCheckPair'));
assert.ok(/const MIN_GLOSSARY_WORDS = 2/.test(v2), 'V2 sets a 2-word minimum');
assert.ok(/runRewrite\(true\)/.test(v2), 'V2 retries the rewrite with escalation');
assert.ok(/coverage\.used > best\.coverage\.used/.test(v2), 'V2 keeps whichever attempt used more glossary words');
assert.ok(/escalate/.test(v2) && /noticeably MORE of them/.test(v2), 'escalated prompt asks for more glossary words');
console.log('  dialect prompts + V2 coverage retry: OK');


// ── v69.1: article symmetry in vocab pairs ───────────────────────────────────────────────────
// User-reported (qwen3.6, e.g. tp_17847396989280000125): the source noun came WITH an article,
// the target noun without ("das Feld" ↔ "campo"). The base-form rule said "with the usual article
// where applicable" but never demanded SYMMETRY, so the model was free to include it on one side
// only — which makes MCQ answers inconsistent and teaches the article on the wrong side. All three
// ⚠️⚠️ UPDATED IN THE v91 LINE — THE CONTRACT INVERTED, AND IT WAS MEASURED, NOT ARGUED.
// This block used to require both-or-NEITHER. **The NEITHER branch was the defect.** Measured on 8
// de→it chapters, 64 vocab pairs per arm, production parameters:
//     shipped (both-or-neither)   23/64 asymmetric — 36%   (79% of actual NOUN pairs)
//     a rule DEMANDING both sides  0/64 asymmetric —  0%   articles on both sides, no failures
// Offering the model a choice let it resolve that choice badly: at `target`-first it commits the
// target side bare, the both-sides branch stops being reachable, and the German prior then supplies
// an article on the source side — producing exactly the pairing the rule forbids. Four other prose
// surgeries (explanation removed, examples reversed, examples deleted, schema example moved) each
// measured NO improvement; only removing the choice worked. Full write-up in `roadmap_v91.md`.
{
  for (const key of ['vocab', 'vocabFromText', 'vocabTable']) {
    const sys = prompts[key].system;
    assert.ok(/ARTICLE SYMMETRY/.test(sys), `${key}.system carries the article-symmetry rule`);
    assert.ok(/article on BOTH sides/.test(sys), `${key}.system DEMANDS the article on both sides`);
    // ⭐ The assertion that carries the finding: the choice must not come back.
    assert.ok(!/or on NEITHER side/i.test(sys),
      `⚠️ ${key}.system must NOT offer the "or on NEITHER side" branch — that branch was MEASURED as ` +
      'the cause of the asymmetry this rule exists to prevent (36% vs 0%). Do not restore it as a ' +
      '"clarification".');
    assert.ok(/do not leave both bare/i.test(sys),
      `${key}.system closes the bare-both escape explicitly`);
    // ⚠️ USER RULING, v91 line: *"if the other language has no articles, it would be ok to show the
    // German with article and eg. Japanese without."* The rule USED to say "omit them on both sides"
    // for such a pair, which strips `der Ball` to `Ball` for a Serbian learner and destroys the
    // gender for no benefit. ⭐ The project's OWN measuring instrument already agreed with the user:
    // `probe_article_symmetry_v80j.js` counts only pairs where BOTH languages have articles.
    // ⚠️ A regression check briefly read the model's 69% source-side article rate on en→ja / de→sr as
    // a DEFECT and reverted the fix over it. That was the wrong criterion — it is the desired
    // behaviour. Do not reintroduce "omit on both sides".
    assert.ok(/has no articles at all/i.test(sys),
      `${key}.system still handles the article-less case`);
    assert.ok(/KEEPS its article/.test(sys),
      `⚠️ ${key}.system must say the OTHER side keeps its article when one language has none — a ` +
      'noun-gender language must not be stripped just because its partner has no articles');
    assert.ok(!/omit them on both sides|omit them in both/i.test(sys),
      `⚠️ ${key}.system must NOT tell an article-less pair to omit articles on BOTH sides`);
  }
  // ⚠️ v85_r's lesson, now pinned: `vocab` and `vocabFromText` are two prompt-level callers of the
  // same idea, and a fix to one sat un-generalised in the other for five releases.
  const bullet = (t) => { const i = t.indexOf('- ARTICLE SYMMETRY'); return t.slice(i, t.indexOf('\n- ', i + 3)); };
  assert.strictEqual(bullet(prompts.vocab.system), bullet(prompts.vocabFromText.system),
    'vocab.system and vocabFromText.system must carry the IDENTICAL article rule — they drifted for ' +
    'five releases once already (v85_r)');
  // ⚠️ vocabTable is deliberately DIFFERENT: it emits markdown columns, not target/source keys.
  assert.ok(/column 1/.test(prompts.vocabTable.system) && /column 2/.test(prompts.vocabTable.system),
    'vocabTable.system names COLUMNS, since it has no target/source fields to name');
}
console.log('  all three vocab prompts DEMAND both sides, with no neither-branch: OK');
console.log('unit-prompt-strictness: ALL PASSED');
