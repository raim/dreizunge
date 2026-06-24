// Major A — per-target-language worked examples. Each in-scope prompt carries an
// {EXAMPLE} token in its `system` string, filled from prompts.json `<prompt>.examples`
// ({ default, <lang>… }) via the server's promptExample() helper. The default reproduces
// the old inline example (or '' where a prompt had none), so the assembled prompt is
// byte-identical until a language seed is added. This test guards the seam + wiring for all
// four in-scope prompts, and validator-gates the wordForms examples' quality.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const PROMPTS = JSON.parse(fs.readFileSync(path.join(root, 'prompts.json'), 'utf8'));

function extract(name) {
  const at = server.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing fn ' + name);
  const bs = server.indexOf('{', at);
  let d = 0, i = bs;
  for (; i < server.length; i++) { const c = server[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return server.slice(at, i);
}

// 1) Every in-scope prompt has exactly one {EXAMPLE} seam + an examples map with a default.
//    `hadInline` = the prompt previously carried an inline worked example that must have
//    moved out of `system` (conjugation had none, so its default is the empty string).
const inScope = [
  { key: 'wordForms',   hadInline: true,  leftover: 'GOOD example' },
  { key: 'synonyms',    hadInline: true,  leftover: 'Example ({L}=German' },
  { key: 'grammar',     hadInline: true,  leftover: 'Example (German \u2190 French)' },
  { key: 'conjugation', hadInline: false, leftover: null },
];
for (const { key, hadInline, leftover } of inScope) {
  const P = PROMPTS[key];
  assert.ok(P && P.examples && typeof P.examples.default === 'string',
    `${key}.examples.default missing/not a string`);
  assert.strictEqual((P.system.match(/\{EXAMPLE\}/g) || []).length, 1,
    `${key}.system must contain exactly one {EXAMPLE} token`);
  if (hadInline) {
    assert.ok(P.examples.default.length > 0, `${key}.examples.default should be non-empty`);
    assert.ok(!P.system.includes(leftover), `${key}: worked example must have moved out of system`);
    // Simplified "good items" format: a short preamble + at least one JSON item, no GOOD/BAD prose.
    assert.ok(/good example items/i.test(P.examples.default), `${key}.examples.default should use the good-items preamble`);
    assert.ok(P.examples.default.includes('{"'), `${key}.examples.default should hold a JSON item`);
    assert.ok(!/\bBAD\b/.test(P.examples.default), `${key}.examples.default should no longer carry a BAD block`);
  } else {
    assert.strictEqual(P.examples.default, '', `${key}.examples.default should be '' (no prior example)`);
  }
}
console.log('  {EXAMPLE} seam + examples.default for all 4 in-scope prompts: OK');

// 2) promptExample() helper behaviour — pair-aware resolution.
const { promptExample } = new Function(extract('promptExample') + '\nreturn { promptExample };')();
assert.strictEqual(promptExample(PROMPTS.wordForms, 'zz'), PROMPTS.wordForms.examples.default, 'unknown lang -> default');
assert.strictEqual(promptExample({ examples: { default: 'D', de: 'DE' } }, 'de'), 'DE', 'known lang -> its example');
assert.strictEqual(promptExample({ examples: { default: 'D' } }, 'de'), 'D', 'missing lang -> default');
assert.strictEqual(promptExample({}, 'de'), '', 'no examples block -> ""');
assert.strictEqual(promptExample(null, 'de'), '', 'null prompt -> ""');
// pair axis: exact "<L>__<S>" wins over per-language, which wins over default.
assert.strictEqual(promptExample({ examples: { default: 'D', de: 'DE', 'de__en': 'PAIR' } }, 'de', 'en'), 'PAIR', 'exact pair wins');
assert.strictEqual(promptExample({ examples: { default: 'D', de: 'DE' } }, 'de', 'fr'), 'DE', 'missing pair -> per-language');
assert.strictEqual(promptExample({ examples: { default: 'D', 'de__en': 'PAIR' } }, 'de', 'fr'), 'D', 'wrong-source pair -> default (not the en pair)');
console.log('  promptExample pair/lang/default resolution: OK');

// 3) Each generator injects its example via {EXAMPLE}, passing (lang, srcLang).
assert.ok(/EXAMPLE:\s*fillPrompt\(promptExample\(PROMPTS\.wordForms,\s*lang,\s*srcLang\),\s*\{\s*L,\s*S\s*\}\)/.test(server),
  'generateWordForms should inject {EXAMPLE} with srcLang');
for (const fn of ['sysGrammar', 'sysConjugation']) {
  assert.ok(/EXAMPLE:\s*fillPrompt\(promptExample\(P,\s*lang,\s*srcLang\),\s*\{\s*L,\s*S\s*\}\)/.test(extract(fn)),
    `${fn} should inject {EXAMPLE} with srcLang`);
}
const synRegion = server.slice(server.indexOf('async function generateSynonyms('), server.indexOf('async function generateConjugation('));
assert.ok(/EXAMPLE:\s*fillPrompt\(promptExample\(P,\s*lang,\s*srcLang\),\s*\{\s*L,\s*S\s*\}\)/.test(synRegion),
  'generateSynonyms should inject {EXAMPLE} with srcLang');
console.log('  generators inject {EXAMPLE} (wordForms/synonyms/grammar/conjugation): OK');

// 3b) loadPrompts overlays a harvested examples.json onto prompts.json, then resolves.
//     Structural: the server reads EXAMPLES_FILE and Object.assigns it onto PROMPTS[*].examples.
assert.ok(/const EXAMPLES_FILE = process\.env\.EXAMPLES_FILE \|\|/.test(server), 'EXAMPLES_FILE env-overridable path');
assert.ok(/PROMPTS\[key\]\.examples = Object\.assign\(\{\}, PROMPTS\[key\]\.examples, overlay\[key\]\)/.test(server),
  'loadPrompts overlays harvested examples onto curated ones');
//     Behavioural: the same merge (curated + a harvested pair) resolves pair-first.
const merged = Object.assign({}, PROMPTS.wordForms.examples, { 'de__en': 'HARVESTED_PAIR' });
assert.strictEqual(promptExample({ examples: merged }, 'de', 'en'), 'HARVESTED_PAIR',
  'overlaid harvested pair is preferred for its exact language pair');
assert.strictEqual(promptExample({ examples: merged }, 'de', 'fr'), PROMPTS.wordForms.examples.de,
  'a different source still falls back to the curated de seed (harvested {S} not reused cross-source)');
console.log('  harvested examples overlay + resolve pair-first: OK');

// 4) Quality gate — every JSON item in every wordForms example validates structurally.
//    The simplified format is a preamble + one or more item JSONs; pull each out and run it
//    through validateWordFormsItems (story = the item's own sentence with the blank filled,
//    so story-grounding passes for a well-formed item).
const { validateWordFormsItems } = new Function(
  extract('_wfNorm') + '\n' + extract('validateWordFormsItems') + '\nreturn { validateWordFormsItems };')();
function braceMatch(s, open) { let d = 0; for (let i = open; i < s.length; i++) { const c = s[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return i; } } return -1; }
function itemsOf(example) {
  const items = [];
  for (let i = example.indexOf('{"'); i >= 0; i = example.indexOf('{"', i + 1)) {
    const close = braceMatch(example, i);
    if (close < 0) break;
    items.push(JSON.parse(example.slice(i, close + 1)));
    i = close;
  }
  return items;
}
let checked = 0;
for (const [lang, example] of Object.entries(PROMPTS.wordForms.examples)) {
  const items = itemsOf(example);
  assert.ok(items.length > 0, `wordForms example "${lang}" should contain at least one JSON item`);
  for (const item of items) {
    const story = String(item.sentence || '').replace('___', (item.choices || [])[item.correctIndex] || '');
    const { valid, rejected } = validateWordFormsItems([item], story);
    assert.strictEqual(rejected.length, 0, `wordForms example "${lang}" item rejected: ${JSON.stringify(rejected)}`);
    assert.strictEqual(valid.length, 1, `wordForms example "${lang}" item did not validate`);
    checked++;
  }
}
console.log(`  every wordForms example item validates (${checked} item(s)): OK`);

console.log('unit-prompt-examples: ALL PASSED');
