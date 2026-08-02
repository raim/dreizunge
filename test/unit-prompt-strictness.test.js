// Prompt-strictness guards: (1) synonyms/antonyms must be drop-in replacements (substitutable in a
// sentence); (2) the dialect-from-glossary prompts require SEVERAL glossary words, and the V2
// rewrite retries once when too few glossary words land.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const prompts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'prompts.json'), 'utf8'));

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
// vocab prompts (JSON, from-text, table) now require both-or-neither.
{
  for (const key of ['vocab', 'vocabFromText', 'vocabTable']) {
    const sys = prompts[key].system;
    assert.ok(/ARTICLE SYMMETRY/.test(sys), `${key}.system carries the article-symmetry rule`);
    assert.ok(/BOTH sides/.test(sys) && /NEITHER side/.test(sys) && /never an article on one side only/.test(sys),
      `${key}.system states both-or-neither explicitly`);
  }
}
console.log('  article symmetry required in all three vocab prompts: OK');
console.log('unit-prompt-strictness: ALL PASSED');
