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
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));

const sys = prompts.vocab && prompts.vocab.system;
assert.ok(typeof sys === 'string' && sys.length, 'prompts.json still has vocab.system as a string');

// ── 1. The contradicting per-side clause is GONE ──────────────────────────
{
  assert.ok(/BASE FORM ONLY/.test(sys), 'non-vacuity: the BASE FORM ONLY rule is still there');
  const base = sys.slice(sys.indexOf('- BASE FORM ONLY'));
  const line = base.slice(0, base.indexOf('\n') >= 0 ? base.indexOf('\n') : base.length);
  assert.ok(!/article/i.test(line),
    'the BASE FORM ONLY line must not mention articles at all — a per-side article instruction ' +
    'there contradicts ARTICLE SYMMETRY, and being stated first it wins. Line was: ' + line);
  console.log('  BASE FORM ONLY no longer carries a per-side article clause');
}

// ── 2. The symmetry rule says it OVERRIDES dictionary convention ──────────
// Removing the contradiction is not enough on its own: a model still knows German convention. The
// rule has to say which wins, or the contradiction simply moves from the prompt into the model.
{
  const art = sys.slice(sys.indexOf('- ARTICLE SYMMETRY'));
  const line = art.slice(0, art.indexOf('\n') >= 0 ? art.indexOf('\n') : art.length);
  assert.ok(/OVERRIDES/.test(line) && /dictionary convention/i.test(line),
    'ARTICLE SYMMETRY must state that it overrides each language\'s own dictionary convention');
  console.log('  ARTICLE SYMMETRY states that it overrides dictionary convention');
}

// ── 3. A WORKED COUNTER-EXAMPLE, not another prohibition ──────────────────
// Rule 31's actual prescription. The example must show the FORBIDDEN pairing explicitly, because
// the forbidden shape is the one a faithful model produces by default.
{
  const art = sys.slice(sys.indexOf('- ARTICLE SYMMETRY'));
  const line = art.slice(0, art.indexOf('\n') >= 0 ? art.indexOf('\n') : art.length);
  assert.ok(/WORKED EXAMPLE/i.test(line), 'the rule carries a worked example');
  assert.ok(/der Hund/.test(line) && /le chien/.test(line),
    'the worked example shows the CORRECT German→French pairing');
  assert.ok(/Do NOT write/i.test(line) && /chien/.test(line),
    'and shows the FORBIDDEN one explicitly — the shape a faithful model produces by default');
  console.log('  a worked counter-example is present, both shapes shown');
}

// ── 4. No new prohibition was bolted on ───────────────────────────────────
// The failure mode §F3 names: each attempt to fix this ADDED a rule beside the live contradiction.
// Counting the article rules is a crude proxy, but a rising count is the signature of that failure.
{
  const bullets = sys.split('\n').filter(l => /^-\s/.test(l) && /article/i.test(l));
  assert.strictEqual(bullets.length, 1,
    'exactly ONE bullet in vocab.system should talk about articles — found ' + bullets.length +
    '. Adding a second prohibition beside a contradiction is what made this worse twice (rule 31).');
  console.log('  exactly one article rule in the prompt, not two');
}

// ── What this does NOT establish (rule 34) ────────────────────────────────
// • It does NOT show the model obeys. §F3c measured the outcome as unstable PER LESSON — 191
//   chapters fully symmetric, 2 fully asymmetric, only 5 in between — so a single regenerated lesson
//   proves nothing either way. The corpus rate is the only honest before/after, and it lives in
//   `build_history/probe_article_symmetry_v80j.js`: 31 of 3069 countable pairs (1.0%) at this cut.
// • Judging the fix needs regeneration against a LIVE model across MANY lessons, then re-running
//   that probe. That is the user's step, not a container's.
console.log('unit-prompt-article-rule: ALL PASSED');
