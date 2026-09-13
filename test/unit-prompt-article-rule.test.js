// unit-prompt-article-rule.test.js
// v80_j — PLAN §F3: the vocab prompt must not contradict itself about articles.
//
// The defect `prompts.json` carried: BASE FORM ONLY said nouns in the singular *"(with the usual
// article where the language uses one)"* — PER-SIDE, appealing to each language's own citation
// convention — while ARTICLE SYMMETRY is a CROSS-SIDE constraint. For German↔French they cannot both
// hold: German dictionaries cite `der Hund`, French cite bare `chien`. A model obeying the first
// rule faithfully produces exactly what the second forbids, and the first is stated first and framed
// as definitional, so it wins.
//
// Rule 31: before strengthening an instruction, check whether it is already there and being
// CONTRADICTED. The fix REMOVES the contradicting clause and adds a worked counter-example. It does
// NOT add another prohibition — that is what made this worse twice already.
//
// ⚠️ This guard pins TEXT, which rule 29 warns about, and it does so knowingly. The reason: the
// CLAIM here IS about the prompt's text — that one particular clause is absent and one particular
// worked example is present. There is no behavioural layer to assert instead, because the behaviour
// is a model's and §F3c measured it as unstable per lesson. What this guard CANNOT do is show the
// model obeys; see the bottom.
//
// v85_r — GENERALISED to every vocab-generating prompt, not just `vocab.system`. The `v80_j` fix
// only ever touched `vocab.system` (the freely-generated lesson path). `vocabFromText.system` — the
// prompt used whenever a story arrives WITH a parallel translation (user-pasted story+translation,
// PDF uploads, and — since `v85_j` — every comic-panel chapter, since `generateOneLesson` routes
// `userTranslation` callers there) — carried the IDENTICAL contradiction, untouched, for five
// releases. This is rule 8's shape one level down: a per-caller fix does not generalize to other
// callers of the same primitive (here, "generate vocab" has two prompt-level callers, and only one
// was fixed). Confirmed by reading `prompts.json` directly, not inferred: the exact same
// parenthetical, the exact same wording, sat beside the exact same ARTICLE SYMMETRY clause.
// `vocabTable.system` (the markdown-table format for models without JSON mode) carries ARTICLE
// SYMMETRY too but has no BASE FORM ONLY line at all — nothing to contradict there, so it is not in
// this guard's scope (a separate, pre-existing gap: no base-form instruction for that path at all).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));

// Every prompt that (a) generates vocab and (b) has its own BASE FORM ONLY line is in scope. Both
// currently share the exact contract this guard checks; a new one must be added here, not assumed.
const KEYS = ['vocab', 'vocabFromText'];

for (const key of KEYS) {
  const sys = prompts[key] && prompts[key].system;
  assert.ok(typeof sys === 'string' && sys.length, `prompts.json still has ${key}.system as a string`);

  // ── 1. The contradicting per-side clause is GONE ──────────────────────────
  {
    assert.ok(/BASE FORM ONLY/.test(sys), `non-vacuity: ${key}.system still has a BASE FORM ONLY rule`);
    const base = sys.slice(sys.indexOf('- BASE FORM ONLY'));
    const line = base.slice(0, base.indexOf('\n') >= 0 ? base.indexOf('\n') : base.length);
    assert.ok(!/article/i.test(line),
      `${key}.system's BASE FORM ONLY line must not mention articles at all — a per-side article ` +
      'instruction there contradicts ARTICLE SYMMETRY, and being stated first it wins. Line was: ' + line);
  }

  // ── 2. ⭐ THE RULE DEMANDS BOTH SIDES AND OFFERS NO ALTERNATIVE ───────────
  // ⚠️⚠️ THIS REPLACED ITS OPPOSITE IN THE v91 LINE, ON MEASUREMENT. It formerly required the rule to
  // say it "OVERRIDES each language's own dictionary convention" and to carry a worked counter-
  // example. Both were `v80_j`/`v85_r` DESIGN HYPOTHESES, reasonable when written and never tested
  // against a model. They were then tested, 8 de→it chapters × 64 pairs per arm:
  //     shipped rule, with the explanation and the counter-example   23/64 — 36%
  //     `pos`: the explanation AND the negative exemplar DELETED     23/64 — 36%  ← no effect at all
  //     `flip`: the examples reversed in direction                   23/64 — 36%  ← no effect
  //     `noex`: the examples deleted                                  8/64 — 13%  ← partial
  //     a rule DEMANDING both sides, no example                       0/64 —  0%  ← the fix
  // The prose this guard used to REQUIRE was measured to do nothing; the CHOICE it permitted was the
  // cause. ⚠️ Not a loosening — this pins a stricter contract than before, just a different one.
  {
    const art = sys.slice(sys.indexOf('- ARTICLE SYMMETRY'));
    const line = art.slice(0, art.indexOf('\n') >= 0 ? art.indexOf('\n') : art.length);
    assert.ok(/give every noun its article on BOTH sides/.test(line),
      `${key}.system's ARTICLE SYMMETRY must DEMAND the article on both sides`);
    assert.ok(!/or on NEITHER side/i.test(line),
      `⚠️ ${key}.system must not offer the NEITHER branch — measured as the cause (36% vs 0%)`);
    assert.ok(/do not leave both bare/i.test(line),
      `${key}.system closes the bare-both escape, which is how three other arms reached "symmetry"`);
  }

  // ── 3. NO HARDCODED ARTICLE OF ANY LANGUAGE — the v80_j principle, now affordable ──────────
  // ⚠️ The old rule hardcoded `der Hund`, `il cane`, `le chien`, `chien, n.m.` — German, Italian and
  // French text delivered to EVERY language pair, including pairs sharing none of those languages.
  // It was tolerated because the worked example was believed load-bearing. It is not: an arm with the
  // demand and NO example measured identically to one with it (0/64 both). So the rule is now pure
  // {L}/{S} and carries no language knowledge. 407 characters against the old 861.
  {
    const art = sys.slice(sys.indexOf('- ARTICLE SYMMETRY'));
    const line = art.slice(0, art.indexOf('\n') >= 0 ? art.indexOf('\n') : art.length);
    for (const w of ['der Hund', 'il cane', 'le chien', 'chien', 'Hund', 'cane']) {
      assert.ok(!line.includes(w),
        `${key}.system's article rule must name no article or noun of any specific language — found ` +
        `"${w}". The example measured as unnecessary (0/64 with and without).`);
    }
    assert.ok(/\{L\}/.test(line) && /\{S\}/.test(line),
      `${key}.system's article rule refers to the languages by PLACEHOLDER, so it is correct for ` +
      'every pair rather than for German/Italian/French only');
  }

  // ── 4. No new prohibition was bolted on ───────────────────────────────────
  // The failure mode §F3 names: each attempt to fix this ADDED a rule beside the live contradiction.
  // Counting the article rules is a crude proxy, but a rising count is the signature of that failure.
  {
    const bullets = sys.split('\n').filter(l => /^-\s/.test(l) && /article/i.test(l));
    assert.strictEqual(bullets.length, 1,
      `exactly ONE bullet in ${key}.system should talk about articles — found ${bullets.length}. ` +
      'Adding a second prohibition beside a contradiction is what made this worse twice (rule 31).');
  }

  console.log(`  ${key}.system: no BASE-FORM contradiction, DEMANDS both sides, no neither-branch, no hardcoded language`);
}

// ── What this does NOT establish (rule 34) ────────────────────────────────
// • It does NOT show the model obeys. §F3c measured the outcome as unstable PER LESSON — 191
//   chapters fully symmetric, 2 fully asymmetric, only 5 in between — so a single regenerated lesson
//   proves nothing either way. The corpus rate is the only honest before/after, and it lives in
//   `build_history/probe_article_symmetry_v80j.js`.
// • Judging the fix needs regeneration against a LIVE model across MANY lessons, then re-running
//   that probe. That is the user's step, not a container's — doubly so for `vocabFromText`, whose
//   `v85_r` fix has NEVER been measured against a live model at all (the `v80_j` measurement only
//   ever covered `vocab.system`'s callers).
console.log('unit-prompt-article-rule: ALL PASSED');
