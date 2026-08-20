// PLAN §8/B2 foundation: deterministic text evidence plus target-language skill identity.
'use strict';
const assert = require('assert');
const { normalizeText, foldText, tokenizeText, analyzeText } = require('../text-analysis.js');
const { canonicalSkillId, createSkillRegistry, resolveSkill, withRegisteredSkill, withSkillAlias } = require('../skill-registry.js');

// Text analysis is evidence-only: NFC + whitespace normalisation, surface-preserving tokens, and
// no morphology/translation claim. Offsets refer to the returned normalised text.
{
  const text = '  Cafe\u0301\nCafe\u0301  '; // deliberately decomposed input
  assert.strictEqual(normalizeText(text), 'Café Café', 'NFC and whitespace are normalised');
  const result = analyzeText(text, { lang: 'fr' });
  assert.deepStrictEqual(result.tokens.map(t => t.surface), ['Café', 'Café'], 'surfaces are preserved');
  assert.deepStrictEqual(result.tokens.map(t => t.key), ['café', 'café'], 'comparison key is folded');
  assert.deepStrictEqual(result.terms.map(t => [t.surface, t.count]), [['Café', 2]], 'terms retain a count and occurrences');
  assert.strictEqual(result.tokens[1].start, 5, 'offsets are in normalised text');
  assert.deepStrictEqual(tokenizeText('l’ami l\'ami', { lang: 'fr' }).map(t => t.surface), ['l’ami', "l'ami"],
    'apostrophe words remain one token');
  assert.strictEqual(foldText('İ', 'tr'), 'i', 'target locale is used when available');
  console.log('  text analysis: normalised, surface-preserving evidence only: OK');
}

// Target language defines identity. Source language is evidence context and must not fork skills.
{
  assert.strictEqual(canonicalSkillId('DE:Vocabulary:Gehen', 'de'), 'de:vocab:gehen',
    'mechanical casing/type alias canonicalised under target language');
  assert.throws(() => canonicalSkillId('en:vocab:gehen', 'de'), /does not match/,
    'a proposed ID cannot silently claim a different target language');
  assert.throws(() => canonicalSkillId('de:vocab', 'de'), /must have/, 'incomplete IDs are rejected');

  const registry = createSkillRegistry([{ id: 'de:vocab:gehen', targetLang: 'de',
    aliases: ['de:vocabulary:gehen'] }]);
  const fromEnglish = resolveSkill(registry, 'de:vocab:Gehen', { targetLang: 'de', sourceLang: 'en' });
  const fromItalian = resolveSkill(registry, 'de:vocab:gehen', { targetLang: 'de', sourceLang: 'it' });
  assert.strictEqual(fromEnglish.skillId, 'de:vocab:gehen');
  assert.strictEqual(fromItalian.skillId, 'de:vocab:gehen');
  assert.strictEqual(fromEnglish.sourceLang, 'en');
  assert.strictEqual(fromItalian.sourceLang, 'it');
  assert.strictEqual(registry.entries.length, 1, 'resolution is read-only');
  console.log('  registry: target language scopes identity; source remains evidence context: OK');
}

// Near-misses never merge by resemblance. Registering/aliasing is explicit, returns a new
// snapshot, and the original registry stays intact so a later merge can be reversed safely.
{
  const empty = createSkillRegistry();
  const unknown = resolveSkill(empty, 'de:wordform:gehen:present:1sg', { targetLang: 'de' });
  assert.strictEqual(unknown.status, 'unregistered', 'unknown proposal is not guessed into a match');
  const added = withRegisteredSkill(empty, unknown.proposedId, { targetLang: 'de' });
  assert.strictEqual(added.changed, true);
  assert.strictEqual(empty.entries.length, 0, 'registering returns a new snapshot');
  const aliased = withSkillAlias(added.registry, added.resolution.skillId,
    'de:wordform:gehen:present:first-person-singular', 'de');
  assert.strictEqual(resolveSkill(aliased, 'de:wordform:gehen:present:first-person-singular',
    { targetLang: 'de' }).status, 'alias', 'explicit alias resolves to the accepted skill');
  assert.strictEqual(resolveSkill(added.registry, 'de:wordform:gehen:present:first-person-singular',
    { targetLang: 'de' }).status, 'unregistered', 'pre-alias snapshot remains available for reversal');
  assert.throws(() => withSkillAlias(added.registry, added.resolution.skillId, 'de:vocab:gehen', 'de'),
    /type must match/, 'an explicit alias cannot cross skill types');
  console.log('  registry: explicit registration/aliases are immutable and reversible: OK');
}

console.log('unit-skill-registry: ALL PASSED');
