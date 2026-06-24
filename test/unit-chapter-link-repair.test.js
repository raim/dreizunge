// Unit test for repair-chapter-links.js (Bug #2): broken continuedFromId links cause
// chapters to be treated as stray roots and never lock. The repair backfills each
// broken link from the storyline's authoritative chapter order, leaves valid links
// (incl. legit forks) alone, is idempotent, and never links across languages.
const assert = require('assert');
const path = require('path');
const { planRepairs, applyRepairs, linkResolves } = require(path.join(__dirname, '..', 'repair-chapter-links.js'));

function mk(id, topic, extra) { return Object.assign({ id, topic, lang: 'en', srcLang: 'fr' }, extra || {}); }

const store = {
  storylines: [
    { id: 'sl_lin', title: 'Linear', chapters: ['c0', 'c1', 'c2', 'c3'] },     // c1..c3 links broken
    { id: 'sl_fork', title: 'Fork', chapters: ['f0', 'f1', 'f2'] },            // valid fork f1,f2 → f0
    { id: 'sl_mixlang', title: 'MixLang', chapters: ['m0', 'm1'] },            // m1 different language
  ],
  topics: [
    mk('c0', 'Ch0'),                                                  // root
    mk('c1', 'Ch1', { continuedFromId: null, continuedFrom: 'English story fragment' }), // broken
    mk('c2', 'Ch2', { continuedFromId: 'c1' }),                       // valid
    mk('c3', 'Ch3', { continuedFromId: null }),                       // broken
    mk('f0', 'F0'),
    mk('f1', 'F1', { continuedFromId: 'f0' }),                        // valid fork arm
    mk('f2', 'F2', { continuedFromId: 'f0' }),                        // valid fork arm (non-adjacent parent)
    mk('m0', 'M0'),
    mk('m1', 'M1', { lang: 'en', srcLang: 'de', continuedFromId: null }), // different srcLang → must NOT link to m0 (fr)
  ],
};

// 1) plan finds exactly the broken, same-language links
const plan = planRepairs(store);
const fixedIds = plan.map(r => r.chapterId).sort();
assert.deepStrictEqual(fixedIds, ['c1', 'c3'], `should plan to fix c1 & c3 only, got ${JSON.stringify(fixedIds)}`);
const byCh = Object.fromEntries(plan.map(r => [r.chapterId, r]));
assert.strictEqual(byCh.c1.newContinuedFromId, 'c0', 'c1 re-links to its predecessor c0');
assert.strictEqual(byCh.c3.newContinuedFromId, 'c2', 'c3 re-links to its predecessor c2');

// 2) valid links and forks are untouched
assert.ok(!plan.some(r => ['c2', 'f1', 'f2'].includes(r.chapterId)), 'valid links / fork arms are not touched');
// 3) cross-language predecessor never linked
assert.ok(!plan.some(r => r.chapterId === 'm1'), 'cross-language chapter is not linked to a different-language predecessor');

// 4) apply, then verify every non-first chapter in the linear storyline now resolves
const n = applyRepairs(store, plan);
assert.strictEqual(n, 2, 'applied 2 repairs');
const byId = Object.fromEntries(store.topics.map(t => [t.id, t]));
['c1', 'c2', 'c3'].forEach(cid => assert.ok(linkResolves(byId[cid], byId), `${cid} resolves after repair`));

// 4b) root-detection sanity: exactly one root (c0) in sl_lin after repair
const lin = store.storylines.find(s => s.id === 'sl_lin');
const roots = lin.chapters.filter(cid => !linkResolves(byId[cid], byId));
assert.deepStrictEqual(roots, ['c0'], `sl_lin should have exactly one root (c0), got ${JSON.stringify(roots)}`);

// 5) idempotent — a second plan over the repaired store is empty
assert.strictEqual(planRepairs(store).length, 0, 'repair is idempotent');

console.log('unit-chapter-link-repair: ALL PASSED (fixes broken links from chapter order; forks/cross-lang untouched; idempotent)');
