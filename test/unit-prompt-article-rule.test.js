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

  // ── 2. The symmetry rule says it OVERRIDES dictionary convention ──────────
  // Removing the contradiction is not enough on its own: a model still knows German convention. The
  // rule has to say which wins, or the contradiction simply moves from the prompt into the model.
  {
    const art = sys.slice(sys.indexOf('- ARTICLE SYMMETRY'));
    const line = art.slice(0, art.indexOf('\n') >= 0 ? art.indexOf('\n') : art.length);
    assert.ok(/OVERRIDES/.test(line) && /dictionary convention/i.test(line),
      `${key}.system's ARTICLE SYMMETRY must state that it overrides each language's own dictionary convention`);
  }

  // ── 3. A WORKED COUNTER-EXAMPLE, not another prohibition ──────────────────
  // Rule 31's actual prescription. The example must show the FORBIDDEN pairing explicitly, because
  // the forbidden shape is the one a faithful model produces by default.
  {
    const art = sys.slice(sys.indexOf('- ARTICLE SYMMETRY'));
    const line = art.slice(0, art.indexOf('\n') >= 0 ? art.indexOf('\n') : art.length);
    assert.ok(/WORKED EXAMPLE/i.test(line), `${key}.system's rule carries a worked example`);
    assert.ok(/der Hund/.test(line) && /le chien/.test(line),
      `${key}.system's worked example shows the CORRECT German→French pairing`);
    assert.ok(/Do NOT write/i.test(line) && /chien/.test(line),
      `${key}.system shows the FORBIDDEN pairing explicitly — the shape a faithful model produces by default`);
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

  console.log(`  ${key}.system: no contradiction, overrides-dictionary-convention stated, worked example present`);
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
