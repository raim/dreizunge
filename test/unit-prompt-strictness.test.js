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
assert.ok(/directly replace "base" in a sentence/.test(synSys), 'synonyms rule mentions direct replacement in a sentence');
assert.ok(/DIFFERENT sense of "base"/.test(synSys), 'synonyms rule excludes a different sense');
assert.ok(/antonyms[\s\S]{0,120}same grammatical slot|SAME grammatical slot/i.test(synSys), 'antonyms rule requires the same grammatical slot');
console.log('  synonyms/antonyms substitutability rules: OK');

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

console.log('unit-prompt-strictness: ALL PASSED');
