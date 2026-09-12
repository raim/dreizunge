// unit-article-symmetry.test.js — v91_a. "German with article, Italian without."
//
// ⚠️ THE SHAPE OF THIS CHECK IS MEASURED, NOT DESIGNED. Six earlier shapes were measured against the
// real production model on the real corpus and rejected; `article-symmetry.js`'s header carries the
// table. The three that matter for anyone editing this file:
//   • asking about BOTH sides in one reply scored 7/10 — the two answers CORRELATE ("NO NO")
//   • "the articles are EXACTLY <list>" scored 7/11 — a form the list lacks becomes a silent MISS
//   • "articles ... include <list> — EVIDENCE, not a complete set" scored 11/11
// End to end on the chapter whose 8 of 8 asymmetric pairs the shipped QC passed clean: 8/8 flagged
// with correct proposals (`l'autonomia`, `lo statuto`, `la responsabilità`), 0 of 4 false findings.
//
// ⚠️ NO ARTICLE TABLE EXISTS IN THE APP, and that is `v80_j`, not taste. The list is MODEL-DECLARED
// per language and then vetoed against CORPUS STATISTICS, which the standing principle permits. §2
// below is the guard on that veto, and it is the one that stops the worst failure this feature can
// produce: a hallucinated list for a language with no articles at all.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { startFakeOllama, tmpFile } = require('./lib');
const ROOT = path.join(__dirname, '..');

// ⚠️ `article-symmetry.js` pulls in `llm.js`, which reads OLLAMA_HOST ONCE at require time. So the
// fake backend must be spawned and the env set BEFORE the require — everything below therefore
// lives inside the async body, including the pure sections that need no backend at all.
// (This exact trap is documented in unit-analysis-truncation.test.js, and it still caught this file
// on its first run: required at the top, the module talked to the REAL Ollama and asked it for a
// model named 'fake'.)
let art = null;

(async () => {
  const logPath = tmpFile('dz_article_chatlog', '.jsonl');
  const fake = await startFakeOllama(logPath);
  process.env.OLLAMA_HOST = 'http://127.0.0.1:' + fake.port;
  art = require(path.join(ROOT, 'article-symmetry.js'));   // AFTER the env — see the note above
  let failed = false;
  try {
    // ── 1. leadsEntry: elision is a PREFIX, everything else a whole word ──────────────────────────
    // ⚠️ The traps are real corpus entries: `illuminare` begins with "il" and `lavoro` with "la".
    // A substring test here would report an article on both and invent asymmetry across the corpus.
    {
      const yes = [["l'", "l'autonomia"], ["un'", "un'idea"], ['il', 'il percorso'],
                   ['la', 'la tutela'], ['die', 'die Autonomie'], ['het', 'het bos']];
      const no  = [["l'", 'lavoro'], ['il', 'illuminare'], ['la', 'lavoro'],
                   ['die', 'Diebstahl'], ['der', 'derselbe'], ['il', 'percorso']];
      for (const [f, t] of yes) assert.strictEqual(art.leadsEntry(f, t), true, `${f} should lead ${t}`);
      for (const [f, t] of no)  assert.strictEqual(art.leadsEntry(f, t), false, `${f} must NOT lead ${t}`);
      // Curly and straight apostrophes are the same article; the corpus contains both.
      assert.strictEqual(art.leadsEntry("l'", '’' === '’' ? "l’autonomia" : ''), true,
        'a curly apostrophe is normalised, or half the corpus would read as article-less');
    }
    console.log('  leadsEntry: elided forms match by prefix, others by whole word, apostrophes normalised: OK');

    // ── 2. ⭐ THE CORPUS VETO — the guard against a hallucinated declaration ───────────────────────
    // ⚠️ Measured on the real thing: asked for Polish articles, the model produced **51 forms** —
    // demonstratives, quantifiers, English "a"/"an", and noise like "cieć". Polish has none. Without
    // this veto, every Polish noun beginning with "ten"/"ta" would be flagged asymmetric.
    {
      const topics = [
        { lang: 'it', srcLang: 'de', lessons: [{ vocab: [
          { target: 'il percorso', source: 'der Weg' },
          { target: 'autonomia',   source: 'die Autonomie' },
          { target: 'lavoro',      source: 'die Arbeit' },      // begins with "la" — a trap, not evidence
          { target: 'illuminare',  source: 'beleuchten' },      // begins with "il" — ditto
        ] }] },
        { lang: 'pl', srcLang: 'de', lessons: [{ vocab: [
          { target: 'dom', source: 'das Haus' }, { target: 'kot', source: 'die Katze' },
        ] }] },
      ];
      const hallucinated = ['ten', 'ta', 'to', 'cieć', 'jeden', 'żadna', 'a', 'an'];
      const pl = art.articleEvidence(hallucinated, topics, 'pl');
      assert.strictEqual(pl.attested, false,
        '⚠️ a declaration no corpus entry supports is NOT attested — this is what stops the Polish case');
      assert.deepStrictEqual(pl.supported, [], 'and it yields no evidence at all');

      const it = art.articleEvidence(['il', 'la', 'lo', 'gli', "l'"], topics, 'it');
      assert.strictEqual(it.attested, true, 'a language whose articles DO lead real entries is attested');
      assert.deepStrictEqual(it.supported, ['il'],
        'only "il" actually leads an entry here — "la"/"lo" must NOT be inferred from lavoro/illuminare');

      // ⚠️ NON-VACUITY, and the reason `attested` is a whole-declaration verdict rather than a filter:
      // the supported set is DELIBERATELY incomplete. Italian really does have "la", "gli" and "l'";
      // they simply do not lead an entry in this fixture. §4 proves an incomplete set still works.
      assert.ok(it.supported.length < 5, 'the supported set is a floor, not the language\'s full article list');
      assert.strictEqual(art.articleEvidence([], topics, 'it').attested, false,
        'an empty declaration is not attested either — no findings rather than guessed ones');
    }
    console.log('  the corpus veto rejects a wholly unsupported declaration and attests a supported one: OK');

    // ── 3. The detector prompt says EVIDENCE, not a closed set ────────────────────────────────────
    // A source-level check, deliberately: this exact wording is the difference between 7/11 and 11/11,
    // and nothing downstream can observe it once the reply comes back.
    {
      const withEv = art.detectSys(['il', 'la']);
      assert.ok(/EVIDENCE, not a complete set/.test(withEv),
        '⚠️ the list must be framed as evidence — "the articles are exactly" measured 7/11 against 11/11');
      // ⚠️ The CLOSED-SET phrasing specifically — not the word "exactly", which the reply-format
      // line legitimately uses ("Reply with exactly one word"). A looser pattern fails on correct code.
      assert.ok(!/articles of this language are exactly/i.test(withEv),
        'and must NOT close the set — that framing measured 7/11');
      assert.ok(/il la/.test(withEv), 'the attested forms are actually passed to the model');
      const none = art.detectSys([]);
      assert.ok(/always NO/.test(none), 'with no evidence the answer is pinned to NO, never guessed');
      assert.ok(!/include/.test(none), 'and no empty list is offered as evidence');
    }
    console.log('  the detector frames the list as evidence, and pins to NO when there is none: OK');

    // ── 4. checkPair end to end, over a real (fake) backend ───────────────────────────────────
    const ctx = { targetEvidence: ['il', 'lo'], sourceEvidence: ['der', 'die'],
                  targetLangName: 'Italian', sourceLangName: 'German' };
    {
      // ⚠️ The evidence above lacks "la" and "l'" ON PURPOSE — that is what §2's veto leaves behind.
      // These must still be found, which is the whole point of the evidence framing.
      const r = await art.checkPair('fake', { target: 'autonomia', source: 'die Autonomie' }, ctx);
      assert.ok(r, 'the reported defect is found: one side has an article, the other does not');
      assert.strictEqual(r.field, 'target', 'the proposal targets the side that LACKS the article');
      assert.strictEqual(r.sug, "l'autonomia", 'and supplies it, elision included');
      assert.strictEqual(r.was, 'autonomia', 'carrying the original so a curator can see the change');
    }
    {
      const r = await art.checkPair('fake', { target: 'esperienza', source: 'die Erfahrung' }, ctx);
      assert.ok(r && r.sug === "l'esperienza", 'a second elided case, from evidence that never listed l\'');
    }
    console.log('  an asymmetric pair is flagged with the missing article, using incomplete evidence: OK');

    // ── 5. Non-vacuity: everything symmetric produces NOTHING ─────────────────────────────────
    // ⚠️ Both of these were WRONG under the 4/7 one-shot prompt — it stripped the first and added to
    // the second. A checker that flags them is worse than no checker.
    for (const [pair, why] of [
      [{ target: "l'autonomia", source: 'die Autonomie' }, 'both sides carry one'],
      [{ target: 'autonomia',   source: 'Autonomie' },     'neither side does'],
      [{ target: 'svuotare',    source: 'leeren' },        'a VERB — symmetric for free, no POS judgement needed'],
      [{ target: 'illuminare',  source: 'beleuchten' },    'begins with "il" but is not an article'],
    ]) {
      const r = await art.checkPair('fake', pair, ctx);
      assert.strictEqual(r, null, `no finding when ${why}: ${pair.source} / ${pair.target}`);
    }
    console.log('  symmetric pairs, verbs, and "il"-initial words produce no finding at all: OK');

    // ── 6. An article-less language costs NO model call and yields NO finding ─────────────────
    {
      const before = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').split('\n').length : 0;
      const r = await art.checkPair('fake', { target: 'dom', source: 'das Haus' },
        { targetEvidence: [], sourceEvidence: [], targetLangName: 'Polish', sourceLangName: 'German' });
      const after = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').split('\n').length : 0;
      assert.strictEqual(r, null, 'nothing to compare when neither language uses articles');
      assert.strictEqual(after, before,
        '⚠️ and NOT ONE model call is spent discovering that — the corpus veto already answered it');
    }
    console.log('  a language the veto rejected costs no model call and yields no finding: OK');

    // ── 7. The declaration parses both a list and NONE ────────────────────────────────────────
    {
      const none = await art.declareArticles('fake', 'ZZZNOART');
      assert.deepStrictEqual(none, [], 'NONE parses to an empty list, not to the word "none"');
      const list = await art.declareArticles('fake', 'Italian');
      assert.ok(list.includes('il') && list.includes("un'"),
        'a declared list is parsed, apostrophes kept — an elided form is an article, not punctuation');
      assert.strictEqual(new Set(list).size, list.length, 'and de-duplicated');
      // ⚠️ The hallucination path: a declaration the corpus cannot attest yields NO evidence, so the
      // detector is pinned to NO and the language produces no findings. Same end state as NONE.
      const fakeDecl = await art.declareArticles('fake', 'ZZZFAKE');
      assert.ok(fakeDecl.length > 0, 'the model did declare something (non-vacuity for the veto)');
      const ev = art.articleEvidence(fakeDecl, [{ lang: 'xx', srcLang: 'de',
        lessons: [{ vocab: [{ target: 'dom', source: 'das Haus' }] }] }], 'xx');
      assert.strictEqual(ev.attested, false, 'and the corpus refuses to attest it');
    }
    console.log('  declaration parses NONE and a real list; an unattested one degrades to no findings: OK');

    // ── 8. A proposal must be the ORIGINAL with something added — never a rewrite ─────────────
    {
      const ok = await art.proposeArticle('fake', 'autonomia', 'Italian');
      assert.strictEqual(ok, "l'autonomia");
      // ⚠️ The guard that matters, and it needed its own fixture: a reply that TRANSLATED or
      // reworded the entry must be DISCARDED, not offered to a curator as an "article fix".
      // Mutation-testing found the earlier version of this assertion vacuous — the fake echoed the
      // input either way, so "accept anything" survived.
      const rewritten = await art.proposeArticle('fake', 'ZZZREWRITE', 'Italian');
      assert.strictEqual(rewritten, null,
        'a proposal that is not the original with something prefixed is refused outright');
      // And the same refusal reaches checkPair, so no finding is produced from a rewrite.
      const r = await art.checkPair('fake', { target: 'ZZZREWRITE', source: 'die Sache' }, ctx);
      assert.strictEqual(r, null, 'a pair whose only proposal is a rewrite yields NO finding');
    }
    console.log('  a proposal is accepted only when it is the original with an article prefixed: OK');

    // ── 9. An UNPARSEABLE verdict means "unknown", never "no article" ─────────────────────────
    // ⚠️ Reading an unparseable reply as "no article" would INVENT an asymmetry against a side that
    // may well have one — the single worst thing a propose-only check can do, because the curator
    // sees a confident, wrong suggestion. Mutation-testing caught this: without the fixture below,
    // flipping `null` to `false` survived the whole file.
    {
      assert.strictEqual(await art.hasArticle('fake', 'ZZZGARBLE', ['il', 'lo']), null,
        'an unparseable reply is null — not false');
      const r = await art.checkPair('fake', { target: 'ZZZGARBLE', source: 'die Sache' }, ctx);
      assert.strictEqual(r, null, 'and a pair with an unknown side produces no finding at all');
    }
    console.log('  an unparseable verdict is "unknown" and suppresses the finding, not "no article": OK');

    // ── 10. hasArticle spends NO model call when it has no evidence ───────────────────────────
    // The single guard that replaced a mutually-masking pair (v90 rule 5), so it needs its own test.
    {
      const before = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').split('\n').length : 0;
      assert.strictEqual(await art.hasArticle('fake', 'dom', []), false,
        'with no attested articles the answer is false, decided without asking');
      const after = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').split('\n').length : 0;
      assert.strictEqual(after, before, 'and not one model call was made');
    }
    console.log('  hasArticle answers from the evidence alone when there is none, with no model call: OK');

    console.log('unit-article-symmetry: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('unit-article-symmetry FAILED:', e.message);
  } finally {
    try { fake.child.kill(); } catch (_) {}
    try { fs.unlinkSync(logPath); } catch (_) {}
    process.exit(failed ? 1 : 0);
  }
})();
