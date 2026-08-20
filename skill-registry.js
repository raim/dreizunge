// skill-registry.js
// Pure, target-language skill-registry primitives for PLAN §8/B2.
//
// The registry is deliberately separate from lesson generation and learner progress. A model (or
// a later review tool) proposes the semantic ID; this module only canonicalises its mechanical
// representation and resolves it against explicitly accepted entries/aliases. It never guesses a
// lemma or merges a merely similar skill. All operations return new values, so a merge can be
// reviewed or reversed without touching observations already recorded by B1.
'use strict';

const TYPE_ALIASES = Object.freeze({ vocabulary: 'vocab' });

function clean(value) {
  return String(value == null ? '' : value).normalize('NFC').trim();
}

function lower(value, lang) {
  const text = clean(value);
  try { return lang ? text.toLocaleLowerCase(lang) : text.toLocaleLowerCase(); }
  catch (_) { return text.toLowerCase(); }
}

function canonicalSkillId(proposedId, targetLang) {
  const target = lower(targetLang);
  if (!target) throw new Error('targetLang is required');
  const parts = clean(proposedId).split(':').map(clean);
  if (parts.length < 3 || parts.some(part => !part)) {
    throw new Error('skill ID must have target-language, type, and subject segments');
  }
  if (lower(parts[0]) !== target) {
    throw new Error('skill ID target language does not match targetLang');
  }
  const type = TYPE_ALIASES[lower(parts[1])] || lower(parts[1]);
  const subject = parts.slice(2).map(part => lower(part, target)).join(':');
  return target + ':' + type + ':' + subject;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('registry entry must be an object');
  const targetLang = lower(entry.targetLang);
  const id = canonicalSkillId(entry.id, targetLang);
  const aliases = [];
  const seen = new Set([id]);
  if (entry.aliases != null && !Array.isArray(entry.aliases)) {
    throw new Error('skill aliases must be an array');
  }
  for (const alias of entry.aliases || []) {
    const canonical = canonicalSkillId(alias, targetLang);
    if (!seen.has(canonical)) { seen.add(canonical); aliases.push(canonical); }
  }
  return Object.freeze({ id, targetLang, aliases: Object.freeze(aliases),
    label: clean(entry.label) || null });
}

function createSkillRegistry(entries) {
  const byId = new Map();
  const aliases = new Map();
  for (const raw of entries || []) {
    const entry = normalizeEntry(raw);
    if (byId.has(entry.id) || aliases.has(entry.id)) throw new Error('duplicate skill ID: ' + entry.id);
    byId.set(entry.id, entry);
    for (const alias of entry.aliases) {
      if (byId.has(alias) || aliases.has(alias)) throw new Error('duplicate skill alias: ' + alias);
      aliases.set(alias, entry.id);
    }
  }
  return Object.freeze({ entries: Object.freeze(Array.from(byId.values())), byId, aliases });
}

function resolveSkill(registry, proposedId, context) {
  if (!registry || !(registry.byId instanceof Map) || !(registry.aliases instanceof Map)) {
    throw new Error('registry must be created by createSkillRegistry');
  }
  context = context || {};
  const targetLang = lower(context.targetLang);
  const canonicalId = canonicalSkillId(proposedId, targetLang);
  const exact = registry.byId.get(canonicalId);
  const aliasFor = registry.aliases.get(canonicalId);
  const entry = exact || (aliasFor && registry.byId.get(aliasFor)) || null;
  return Object.freeze({
    proposedId: clean(proposedId),
    canonicalId,
    skillId: entry ? entry.id : null,
    status: exact ? 'exact' : entry ? 'alias' : 'unregistered',
    targetLang,
    // Source language describes the route/evidence only. It is intentionally absent from IDs.
    sourceLang: clean(context.sourceLang) || null,
    entry,
  });
}

function withRegisteredSkill(registry, proposal, opts) {
  opts = opts || {};
  const resolution = resolveSkill(registry, proposal, opts);
  if (resolution.entry) return Object.freeze({ registry, resolution, changed: false });
  const entry = { id: resolution.canonicalId, targetLang: resolution.targetLang,
    label: clean(opts.label) || null, aliases: opts.aliases || [] };
  const next = createSkillRegistry(registry.entries.concat([entry]));
  return Object.freeze({ registry: next,
    resolution: Object.freeze({ ...resolution, skillId: entry.id, status: 'registered', entry: next.byId.get(entry.id) }),
    changed: true });
}

function withSkillAlias(registry, skillId, alias, targetLang) {
  const canonicalId = canonicalSkillId(skillId, targetLang);
  const entry = registry && registry.byId && registry.byId.get(canonicalId);
  if (!entry) throw new Error('cannot alias an unregistered skill: ' + canonicalId);
  const canonicalAlias = canonicalSkillId(alias, entry.targetLang);
  if (canonicalAlias.split(':')[1] !== entry.id.split(':')[1]) {
    throw new Error('skill alias type must match the registered skill type');
  }
  if (canonicalAlias === entry.id || entry.aliases.includes(canonicalAlias)) return registry;
  const entries = registry.entries.map(old => old.id === entry.id
    ? { ...old, aliases: old.aliases.concat([canonicalAlias]) } : old);
  return createSkillRegistry(entries);
}

function withoutSkillAlias(registry, skillId, alias, targetLang) {
  const canonicalId = canonicalSkillId(skillId, targetLang);
  const entry = registry && registry.byId && registry.byId.get(canonicalId);
  if (!entry) throw new Error('cannot remove an alias from an unregistered skill: ' + canonicalId);
  const canonicalAlias = canonicalSkillId(alias, entry.targetLang);
  if (!entry.aliases.includes(canonicalAlias)) return registry;
  const entries = registry.entries.map(old => old.id === entry.id
    ? { ...old, aliases: old.aliases.filter(existing => existing !== canonicalAlias) } : old);
  return createSkillRegistry(entries);
}

module.exports = { canonicalSkillId, createSkillRegistry, resolveSkill, withRegisteredSkill, withSkillAlias,
  withoutSkillAlias };
