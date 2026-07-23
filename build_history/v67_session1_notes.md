# v67 — assessment of the v66 review notes, and fixes for the confirmed issues

None of the reported items were addressed by v66 (that release covered a different five). Each was
checked against the code before implementing; two turned out to be different problems than they
appeared.

## FIXED

### Tutor spoke for the student (invented whole exchanges)
Root cause: the tutor is handed a `Student: / Tutor:` transcript and asked to continue — models
happily continue **both** sides. Three defences, weakest to strongest:
1. the prompt now forbids it explicitly ("Write ONLY your own next reply… never invent their answer");
2. **stop-sequences** (`\nStudent:` and friends, incl. `Schüler:`, `Studente:`) halt generation, wired
   through both the whole-reply and streaming call paths;
3. `sanitizeTutorReply()` truncates anything that still slips through — the only real guarantee.
Verified on the reported transcript: 2 invented turns → 0, while ordinary prose colons
("Beispiel: das Haus ist groß.") survive untouched, and a leading self-label is stripped.

### Tutor accepted wrong target-language production
Two reports — praising *"Little i hops over the wiese"* (a German word in an English sentence) and
accepting an English answer when the target was Italian. The prompt now requires the tutor to CHECK
target-language production, name the intruding word and give the correct one rather than praising,
and to ask for a retry in the target language when the learner answers in their own. Stated as
outranking encouragement, since the previous prompt's warmth was pulling it the other way.

### Tutor cited an unrelated story
`ctx: order Tuscan specialties` while reading a different story: retrieval narrowed to a storyline
only for *storyline* scope. A chapter/lesson question searched the whole (same-language) library, so
an old story could win on keywords. Now chapter/lesson scope resolves its owning storyline and
narrows to it — a question asked while reading chapter 3 is about that arc.

### Pass mark was advisory, not enforced
A learner who had played every lesson but sat below the mark could still press Next and move on:
`_firstUnfinishedLessonIdx` returns -1 once every lesson has a done-flag, so the "next chapter"
branch was reached. The chapter was correctly marked *incomplete*, but nothing stopped them leaving.
Now, below the mark, **Next becomes the practice drill** and the next-chapter branch refuses to
advance — replay until the required percentage is reached, as asked.

### arcMode "grammar" label said "grammar and conjugation"
**Not a behaviour bug.** The code does word_forms + synonyms, and the English label already says
"🧩🔁 Word forms + synonyms". The *German* label still said "🏷🔤 Grammatik + Konjugation" — a stale
translation from before the English changed. You saw the stale German. Removed for all 29 languages
so `translate-ui.js` regenerates it.

**Worth noting as a systemic gap:** v66 removed placeholders by comparing values to English, which
cannot detect this class — a stale translation differs from English while being wrong. There is no
staleness detection today. The durable fix is a fingerprint of the English source stored alongside
each translation, so `translate-ui.js` can flag "source changed since translated". Not built here;
flagged as the next i18n item.

## ASSESSED, NOT YET IMPLEMENTED

- **Story-complete card / indication when every chapter is done.** Real gap: the completion card
  celebrates a chapter, and the storyline bar reaching N/N is the only signal. Wants either a
  distinct end-of-story card or a clear banner. Straightforward on top of `_compProgressHtml`, which
  already computes chapters-done/total.
- **PDF import: strip non-story text** (headers, nav, "read more" links from print-to-PDF pages).
  Belongs in the import prompt: instruct the model to drop anything that is not narrative prose.
  Needs a look at the PDF import path first, which I did not touch this round.
- **PDF source shown once per story, not per chapter.** Provenance display: the source line is
  rendered per chapter and should be hoisted to the storyline when every chapter shares one source.
  `provLineHtml` is already the shared formatter, so the change is localized.

These three are queued rather than rushed — each needs a design decision (where the story-complete
card lives; how aggressive the PDF stripping should be; whether a per-chapter source should still
show when it *differs* from the storyline's).

## Tests

Suite **116 green**. New guards: the sanitizer run against the reported runaway plus marker variants
and the prose-colon false positive; stop-sequences present on both call paths; the prompt's
no-self-conversation and target-language-checking rules; and the pass-mark enforcement (Next becomes
the drill, next-chapter refuses below the mark).
