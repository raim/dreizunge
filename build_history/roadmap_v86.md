# Dreizunge roadmap — v86

**This is the `v86` line.** Cut from `roadmap_v85.md` at its last commit (the `v85_u` release), at the
user's own explicit request ("once we are done with these, let's cut to v86") — not a
milestone-completion cut, the same shape as every prior cut for the same reason: the `v85` line
shipped the whole PLAN §2.4 / Track A4 comic-panel-import subsystem end to end (`v85_j` upload UI
through `v85_p` real-usage fixes, all four original milestones plus an auto-detect follow-up), the
`PLAN §13` generator-page wizard redesign (`v85_c`…`v85_i`, all five milestones), a model-reliability
round (`v85_r` — the `v80_j` article-symmetry fix generalised to its second, previously-missed caller;
a skill-ID all-or-nothing-throw bug fixed), a test-harness-only crash diagnosed and fixed
(`v85_q`), and a real-device follow-up round on the comic subsystem after the user's own testing
(`v85_s` a speech-race fix, `v85_t` a version-tooltip removal + panel resize + a live model probe,
`v85_u` the ACTUAL geometry root cause behind that probe's apparent misalignment, a real mobile-photo
crash fix, and three further items evaluated and scoped for a future round).

**`roadmap_v85.md` is kept and is not superseded as a record** — the whole `v85` line's release
history (`v85_a`…`v85_u`, twenty-one point releases) lives there under `# ✅ SHIPPED IN THE v85 LINE`
and was NOT copied here. Go there for how something was built or why a guard is shaped the way it is;
this file stays current through the whole `v86` line.

> **⚠️ WHAT WAS CARRIED, AND WHAT WAS NOT.** Carried: this protocol block, the findings that govern
> the open sections, `§0`/`§0i` with their reconciliation, the standing RULES (now including new ones
> earned in the `v85` line — see below), **TRACK T** (unchanged — still nothing open) and **THE LARGER
> PLAN** (the folded `implementation_plan.md`) — `PLAN §13` is now marked FULLY SHIPPED throughout
> (it completed mid-`v85`), and `PLAN §2.4`/Track A4 similarly. Not carried: the `v85` release
> entries, and the `v85_u` SESSION_PROMPT's own per-cut backlog — that carries forward through the
> SESSION_PROMPT lineage instead (see `SESSION_PROMPT_v86_a.md`), the same way it always has; this
> file has never been where per-cut backlog lives. Nothing open was dropped — the cut is by KIND, not
> by judgement about what still matters, so no item had to be assessed to survive it. The `v85_r`
> roadmap-only "REPORTED AT THE `v85_r` CUT" section is NOT carried verbatim (all of its items A/B/C1
> shipped, C2 partly fixed/partly investigated) — its genuinely still-open remainder is folded into
> the fresh "OPEN AT THE v86 CUT" list directly below instead, so a reader does not have to reconstruct
> what is still live from a section whose title now names the WRONG cut.

### What is in this file, in order

| section | what it is |
|---|---|
| **OPEN AT THE v86 CUT** | fresh, top-of-file summary of everything still genuinely open, then the findings that govern the open sections, then `§0` / `§0i` themselves, then the standing RULES |
| **SHIPPED IN THE v86 LINE** | `v86_af` — inflection wrong choices must now be DIRECT RELATIVES of the correct answer's own dimension (a `formChoices` instruction rewrite + both worked examples fixed to comply), the user's own refinement of the `v86_ab` "datief" report. Also surfaced (NOT fixed, needs the user's go-ahead): the real `v86_ae` report turned out to be a misdiagnosis — the actual bug is `title`/`desc`/`formLabel`/`formChoices`/`explanation` coming back in the TARGET language instead of German for a real nl-target/de-source generation, `v86_ab`'s fix alone was not a strong enough signal for this real model. `v86_ae` — `inflection_lemma`'s answer-reveal read-out is now silent rather than a mispronounced target-language word: its own target IS genuinely target-language text (unlike `inflection_form`'s source-language label, already fixed at `v82_d`), so the default target-voice behaviour was believed correct and IS the designed/tested behaviour — but a real device/voice combination (Dutch target, this user's own browser) can claim to support a language yet not pronounce it reliably, a case `_ttsMakeUtterance`'s own "refuse rather than approximate" policy cannot detect (it only refuses when NO voice claims to match at all). Per the user's own explicit, accepted fallback ("we could also just omit the readout" — a source-language substitution was considered and rejected as needing a clean single-word equivalent that doesn't reliably exist), the answer-reveal now speaks nothing on either path; still auto-advances. `v86_ad` — the lesson-set card's own `#story-section` ("📖 Read the story") gained language flags + a real text explorer (🔬, not 🔍 which is QC on this row), full parity with the completion card's own `_renderCompStory`, reusing the SAME `_storyFlagButtonsHtml`/CP1-CP2 cache machinery under a separate `APP._lsStoryLang`/`APP._lsTextExplorer` state pair; `renderStoryText()` itself gained the logic (all 6 real call sites always target the same `#story-body`, so one function stays the source of truth). Took three rounds of clarification to find the right surface (library row → completion card → the actual `#story-section`); a speculative completion-card fix was reverted before shipping once the real target was confirmed. Live-verified against a REAL Ollama backend (an isolated scratch server), which also corrected an earlier `v86_ac` claim that no backend was reachable in this sandbox. `v86_ac` — the lesson-set card's existing 🔤 button now doubles as "re-analyze": a single-chapter call to `analyzeChaptersRun` pre-checks `GET /api/analysis/:id` and, if already analysed, `confirm()`s before posting `{force:true}` (a new `deleteAnalysisChapter` server-side, deletes the cache so the existing short-circuit naturally re-runs it) — a decline makes no server call at all; a multi-chapter batch call stays silent/non-destructive, unchanged. User-requested after finding no way to force a re-run once `v86_aa`'s CP2 prompt fix landed. `v86_ab` — the SAME class of bug as `v86_aa`, this time in `PROMPTS.inflections`'s own `default` worked example: it demonstrated `formLabel`/`formChoices`/`explanation` in ENGLISH despite its own `translation` field being German, contradicting the schema's own "AS A SHORT PHRASE IN {S}" instruction — confirmed independently by a live report (`tp_17880367188140000070`, a Dutch-target lesson with no dedicated example, returning those fields in DUTCH instead of German). Fixed by rewriting the example's fields into German, matching its own `translation`. Also answered a user's specific pedagogical question about that same reported item ("datief" is not a valid alternative — Dutch nouns don't inflect for case at all — just an imperfectly-chosen distractor, noted but not fixed). `v86_aa` — CP2's `"form"` field (grammatical labels in the text explorer) is now explicitly instructed to use the SOURCE language's own terminology, not English — a real user report on a german->dutch lesson found `"sense"` correctly in German but `"form"` always in English, since `"form"` was the only one of the four per-token fields with no language instruction (mirrors the `formLabel` field's own existing `PROMPTS.inflections` precedent). Prompt-only fix; the 3 already-cached chapters stay stale until re-analysed. `v86_z` — item W's whole CP1/CP2 text-explorer pipeline now works in the static build too ("Can we build the text analysis explorer also into the static docs/index.html?"): `build-static.js` reads `canonical-analysis.json` (optional, typically only a few chapters — CP2 is minutes per sentence, nobody runs the whole corpus at once) and bakes it into the SAME shape `GET /api/analysis/:id` returns, as a new fingerprinted `BUILD_SOURCES` entry; a missing file degrades to an empty bake, not a crash. `_ensureTextExplorerData()` gained a `typeof STATIC_ANALYSIS !== 'undefined'` branch (the SAME convention `STATIC_LESSONS` already uses) that reads the snapshot directly and NEVER calls `fetch` — an absent chapter degrades to the existing clean error state, no retry possible statically. Live-verified by serving the rebuilt `docs/index.html` from a plain static HTTP server (no app server at all) and confirming real per-word `<mark>` elements render from the baked data. `v86_y` — two UI-consistency fixes on the story-view controls: the 🔍 text-explorer button and the two 🌐 language flags are now genuinely mutually exclusive (before, toggling explorer left the target flag looking active since `_compStoryLang` was silently forced back to 'target', and clicking that same-state flag did nothing visible — fixed by passing `null` as the "current" flag while explorer is on, and by having `toggleCompStoryLang` also turn explorer off); and the retranslate button + language-view flags are now available on BOTH the lesson-set chapter page and the storyline "read full story" page (new `retranslateChain()` on the storyline page loops `/api/retranslate-story` once per chapter via the SAME `data-chain` id array `analyzeChaptersRun` already uses — the route now accepts `{topicId}` as well as `{topic}` for this — syncing both `APP.savedList` and the chain's own render cache, one failure isolated from the rest, gated the SAME way as `#story-qc-btn`, not teacher-mode). `v86_x` — a user-requested layout fix to `v86_v`'s comic text-review card: "the popover... could be bigger and should allow to view the text without scrolling" — asked the user to choose bigger-modal vs. wizard-page (a real architectural tradeoff), they chose bigger modal. `comicOpenReview()`'s box grew from a fixed 520px to near-fullscreen (95vw × 90vh) and its body switched from a single-column flex list to a CSS GRID (multiple columns on a wide screen — the change that actually buys back vertical space), plus bigger images/fonts/textarea rows per panel. Visually verified at desktop/7-panel/mobile sizes, confirmed no horizontal overflow. New markup-level test (reads the REAL rendered overlay, not a source regex), mutation-tested. `v86_w` — two fixes from one real-usage report: `_comicExtractPrompt` now instructs the model to insert a newline at a REAL visual structural break (colour-block banner, boxed band, unusual gap) even with no punctuation there, and (per an explicit user follow-up) to restore natural capitalization/punctuation the same way the existing case-restoration instruction already does, bounded by "only where certain, never inventing words." Live A/B on the actual reported photo: the newline-structure change is a VERIFIED real improvement (old prompt garbled a CAPTION/IN-SCENE split and fabricated text not on the sign at all; new prompt correctly kept it one IN-SCENE block, split into real lines, no hallucination) — the punctuation/capitalization addition came back BYTE-IDENTICAL to the newline-only version on this photo, an honestly-reported non-result, shipped anyway per the user's own explicit choice after being told plainly. Also: a new 🔄 "Retranslate" button (user-requested: a manual story fix does not re-translate on its own) — `POST /api/retranslate-story` mirrors `/api/storyline-retitle`'s shape, gated client-side EXACTLY like `#story-qc-btn` (`canGenerate && d.story`, open to anyone) — a first draft ALSO added `_canEdit()`, which `unit-can-edit-teacher-mode.test.js`'s own sweep correctly caught (combining `_canEdit()` with a capability term is exactly the shape that test exists to prevent, whether via `||` or `&&`); dropped, matching QC's own precedent instead. Separately: the `ai_error_hunt` the user asked to have recorded for their own manual correction was found ALREADY built by the existing pure-diff machinery — zero code needed, just verified against the stored lesson. `v86_v` — comic panels: a user-requested intermediate text-review card between extraction and lesson generation — `comicOpenReview()` opens a modal listing every panel with usable extracted text (its cropped image + an editable caption input + in-scene textarea, seeded from that panel's own text), reached both automatically (the instant extraction succeeds) and manually (the pre-existing "Create chapter" button, retargeted). Confirm writes the edited buffer back onto `APP_COMIC.boxes` BY EACH PANEL'S OWN ORIGINAL INDEX, then calls the real, completely untouched `comicCreateChapter()` — the gate sits entirely above the existing chunk-building/POST logic, so every existing test of that logic keeps testing it directly. Cancel is a true no-op (edits live in a local buffer until confirm). A real pre-existing harness limitation surfaced along the way: `test/lib-dom.js`'s `addEventListener` is a no-op by design, so a first draft wired via `addEventListener` closures would have been untestable for behaviour, forcing a fallback to source-regex assertions — rewired to the SAME onclick/oninput-attribute convention every other dynamically-rendered list in this file already uses, making `_comicReviewEdit`/`_comicReviewConfirm`/`_comicReviewCancel` plain, directly testable functions. One test was ALSO caught being vacuous mid-development (a mutation deleting the real automatic-open call left a comment containing the same text, which a regex-based assertion couldn't distinguish from the real call) and was replaced with a genuine behavioural test. New test file (6 checks), zero server changes needed (caption/inScene were already plain client-held fields all the way through). `v86_u` — `unit-article-choices` GREEN for the first time in nine cuts: `_forEachGrammarItem`'s three-tier traversal ("this lesson, then the open chapter, then the whole library") was built for a `Set`-building consumer where revisiting a value is free, then reused unsafely by `_articleStatsFor` to COUNT occurrences into a ratio — since the three tiers legitimately overlap in real use (the open lesson normally IS an entry in the open chapter, which normally IS an entry in the full library), the currently-open lesson's own article mix was counted up to 3× the weight of everyone else's. Only observable for Italian, whose real corpus-wide masculine-article ratio (91.7%, `il` vs. phonologically-conditioned `lo`) sits close enough to the 90% predictability cutoff that triple-counting one lesson's local mix could flip the verdict — confirmed to be the exact and ONLY affected lesson in the whole corpus (`tp_17879184840560000089`, "Een schoon bad", the one Italian grammar lesson with an s+consonant-initial masculine noun). Not a language-specific check anywhere — a generic counting defect, merely surfaced by Italian sitting near a real, measured linguistic edge. Fixed with dual dedup (`seenArrays`+`seenLessonIds`) in `_forEachGrammarItem`; verified zero of 24 article-bearing grammar lessons now flip verdict depending on which is "open," sample size for the affected lesson now matches the unbiased baseline exactly (n=36); mutation-tested (reverting the fix reproduces the exact predicted wrong count). New corpus-independent fixture (`unit-article-choices.test.js` §2b) covers the fix without depending on `lessons.json` staying the same shape. `v86_t` — comic-panel text now uses the SAME padded card markup in every view: `v86_q`'s `_comicPanelImageStripHtml` returned an image-only strip with the caller's text concatenated as a bare, unstyled sibling — the real bug the user caught via two screenshots (the same chapter's text started at a visibly different x-position in the progress card vs. the text-explorer view, since only the default view's per-panel case got `.comic-story-panel-text`'s own padding). Renamed to `_comicPanelsFlatTextHtml(d, textHtml)` — now wraps the caller's ALREADY-BUILT text in that exact markup (single-panel: image+text share ONE card, pixel-identical to the default view; multi-panel: each image its own card, plus one further text-only card for the flat text). A SECOND, smaller cause found on the same real chapter, same session: `.te-tok` had no `font-weight` (rendering at normal 400 vs `.story-vocab-hl`'s own 600/800), narrower per character, shifting word-wrap points even with identical padding — fixed with one line. A genuine residual difference is left BY DESIGN: the default view marks only this chapter's own vocabulary, the text-explorer marks EVERY token (CP2's "never omit a token"), so a few function words are bold in one view and plain in the other — matching that would mean not marking every word, defeating the feature; user's own call: "leave it if hard to fix." Visually verified TWICE via side-by-side screenshot comparison on an isolated server instance, not just asserted. `v86_s` — text-explorer layout fidelity: `_textExplorerBodyHtml` no longer builds paragraphs from CP1's own lossy `paraBreakBefore` flag — a new `_teStoryHtml` reconstructs the real gap between sentences directly from the raw story text (already sent to the client), using the same forward-only alignment `_teSentenceHtml` already does per token, one level up per sentence — so a blank line is a real `<p>`, a single `\n` is a `<br>`, matching the normal highlighted view's own layout exactly, entirely client-side, no CP1 change. Also recorded (not built): item AG, a real user-requested comparison of `inflections`' own per-word decomposition (clitic pronouns, an explanation field) against CP2's coarser output — scoped as "enrich CP2" per the user's own explicit direction, since CP2 feeds the whole PLAN §7.0 pipeline, not just item W. `v86_r` — a real user-reported bug, unrelated to item W: `v86_g` fixed comic-panel/story desync for `/api/save-story` only — `POST /api/story-qc/accept` (accepting a QC proposal, the exact path the user's real `ai_error_hunt` correction went through) is a SECOND, independent write to `topic.story` that never got the fix, so the progress card kept showing a corrected-elsewhere typo ("vorrestevoletrovarlo") the storyline reader had shown fixed for weeks. Same sync logic now applied to both routes; a new backfill script (`backfill-comic-panel-sync.js`, dry-run by default) found and (with the user's explicit go-ahead) fixed the exactly-one real chapter affected in the corpus — confirmed idempotent by a third dry run. `v86_q` — two more item W follow-ups: comic panel images now show in the translation AND text-explorer views too (a new image-only `_comicPanelImageStripHtml`, since neither view has per-panel text to pair each image with the way the default view's `_comicStoryPanelsHtml` does), and a 🔤 `analyzeChaptersRun()` batch curator trigger on storyline/lesson-set cards (deliberately not 🔍 — that's QC's icon on the same row) — fire-and-forget per chapter, reusing `v86_o`'s existing `/api/analyze-chapter/:id` route with no new server code. A real, legitimate test invariant (`unit-provenance-fields.test.js`'s pinned 3-button storyline-card count) updated to 4, not a false alarm. `v86_p` — item W follow-up: an opt-in `postGenAnalysis` checkbox mirroring `postGenStoryboard` exactly, resolving the user's own live-testing question ("we should be able to generate this during normal lesson generation") as opt-in (default off) given the real measured cost. A shared `_kickOffAnalysisJob` helper (factored out of the `v86_o` route) is now called from THREE client sites — `#pdf-analysis-cb`, `#comic-analysis-cb`, and `#post-gen-analysis-cb` (the plain multi-chapter "Generate new" flow, found as a THIRD caller only while writing this cut's own tests) — each threading `postGenAnalysis` into its own `/api/generate-book` request; server-side, `_runBookJob` fires one analysis job PER CHAPTER the instant it's saved (not once per storyline, unlike storyboard), fire-and-forget so a slow chapter never blocks the next one's generation. `v86_o` — item W steps 2-4 (the rest of the CP1/CP2 browser integration): a background job (`_runAnalysisJob`, CP1 then CP2, cached per chapter id via a new `analyzingChapters` lock so concurrent requests share one job), `GET /api/analysis/:chapterId` mirroring `cp5ShadowFor`'s own shape (absent → `available:false`, plus a new `stale` field for a post-analysis story edit) and `POST /api/analyze-chapter/:chapterId` (cache-hit short-circuit, else 202+jobId polled via the existing `/api/job/:id`), and a client "text explorer" view — a 🔍 toggle next to the translation flags, per-token `<mark>` highlighting built directly from the cached data via forward-only substring alignment (not a shared-word-list regex pass), a click popover, and the SAME mobile-backgrounding-safe poller shape (+ shared `visibilitychange` hook) the three comic pollers already use. Two real bugs found and fixed by this cut's own tests (a test-isolation leak into the real `canonical-analysis.json`, and a genuine self-mutation bug where the fetch guard matched its own just-created cache entry and short-circuited every call). Live-verified against the real `qwen3.6:35b-a3b` model on the SAME chapter the `v83_n`/`v83_p` note measured: ~13-14 minutes wall-clock for 4 sentences on this container's CPU-only inference (consistent with the prior "12+ minutes" finding), zero apparent wrong lemma/form/sense across 26 tokens, correct cross-sentence antecedent gender-agreement, plus 4 well-formed multi-word phrases. `v86_n` — `PLAN §7.0` CP2 groundwork (item W reconciliation, step 1 of 4): a new `OLLAMA_ANALYSIS_MODEL` role, same runtime-switchable pattern as every other role (`currentModels()`/`setRuntimeModels()`/`/api/models`/`/api/info`), falls back to `OLLAMA_MODEL` (unlike vision) since analysis needs no special capability — but nothing calls it yet, this is groundwork only for a future CP1/CP2 browser integration. Steps 2–4 (background job + cache, GET endpoint, client UI) deliberately deferred to a fresh session (this track is explicitly tagged "multi-session"). `v86_m` — item AB (the "unrelated context" half): `tutorRetrieveContext`'s "grab up to 4 topics by recency" fallback (fires when the question tokenizes to nothing) is now gated on a new `hasHistory` flag (`/api/tutor` passes `history.length > 0`) — a topic-less mid-conversation continuation ("finish that sentence please") now retrieves nothing instead of grabbing unrelated topics by recency, while a genuinely fresh/opening question still gets grounding. Live-verified against the real `qwen3.6:35b-a3b` model on a real corpus topic pair: the opening-question case still grounds correctly, and the continuation case now sends no `ctx:` at all (prompt tokens 1282→667) with the reply staying coherent from history alone. `docs/index.html` also rebuilt (unrelated staleness from the `c8fa64d` lessons commit, cleared). A new, unrelated reproducible red flagged not fixed: `unit-article-choices` now fails deterministically (one live `it`-language article lesson can't build a full MCQ), not corpus noise. `v86_l` — item AA: the teacher-mode toggle became a dropdown with two explicit named options ("Teacher"/"Student") instead of a bare "click to flip" lock icon — `_teacherMode` (the underlying boolean gating dozens of call sites app-wide) unchanged, only the control's own presentation changed. `v86_k` — item S: each lesson is now persisted the instant it finishes during multi-type generation, not batched until the whole chapter completes — fixed in BOTH `_runRecreateJob` (the user's own reported case) and `_runBookJob`'s own arc-reinforcement loop (found to have the same gap while checking whether the fix generalized), each confirmed safe to call incrementally by reading `upsert()`'s own id-matching behaviour first. Item F's live-verification half: `probe_article_symmetry_v80j.js` re-run against the full live corpus confirms the `v85_r` fix took hold (the two originally-named chapters are now 0% asymmetric; overall rate is 1.3% and mostly explained by correct per-language citation convention, not a defect). `v86_j` — the user's own answers on AE/AF from `v86_i`: AF resolved (they never actually watched the screen for the toast — `showToast()` has never logged to console, likely never a bug) and its own console-message ask was built; AE's own leading hypothesis (page discarded/reloaded) was REFUTED by the user's answer (state survived backgrounding almost exactly), so instead of a speculative fix, rich diagnostic console logging was added throughout the whole visibility-recovery mechanism (all three comic pollers' own check functions, plus the shared listener logging UNCONDITIONALLY on every fire) — diagnostic only, no behaviour change, but the next occurrence should be immediately diagnosable from console output alone. `v86_i` — a real showToast() dead-guard bug found and fixed while investigating two live-testing reports (not the cause of either, ruled out specifically). Live-testing round on `v86_d`–`v86_h` began: items L/I/M confirmed working; two problems (AE: mobile-backgrounding recovery did not recover on a real device; AF: the partial-drop toast/panel-count mismatch recurred) investigated but NOT resolved — both need the user's own answers to specific diagnostic questions before a confident fix, not a guess. `v86_h` — `INTERNALS.md` §6b caught up (doc-only). From a 16-item real-usage batch: item Q (comprehension questions must be independently answerable, a prompt-only fix), plus three unrelated small fixes — tutor logs on ASK now (not just on a completed reply), a QC 'rewrite' verdict (large change-ratio, not necessarily corruption) can now be ACCEPTED after human review (only 'corrupt' stays hard-blocked), and the static build's own `init()` now wires `_storyTapInit()` (tap-to-advance on plain story text was silently dead there). The other 13 items scoped into the roadmap as items P–AC, not built this cut. `v86_g` — item L: a comic/image chapter's progress card and question panel showed STALE text after a story edit (`_comicStoryPanelsHtml` reads `comicPanels[].caption`/`inScene`, a separate copy of the text `/api/save-story` never touched) — fixed by syncing `comicPanels[0]` on save for the unambiguous SINGLE-panel case (multi-panel deliberately left as item O, genuinely ambiguous). Item M: drag-to-move a panel box (`_comicHitBox`), the companion to the existing resize handles — a handle grab still wins at a box's own corner. Item N: a "3 shown, 4 detected" report investigated and found to be a likely MODEL accuracy limitation, not a code bug (no merging logic exists) — not changed this cut, flagged for a live-model probe if wanted. `v86_f` — item I: a fixed 90°-clockwise-per-click rotate button for the uploaded/captured comic image, using the SAME offscreen-canvas-redraw shape as the existing downscale step, routed through the SAME `img.onload -> _comicFinishSetup()` path a fresh upload uses — so natural dimensions are read from the rotated image itself and panel-box invalidation comes for free from the existing "new image clears boxes" precedent, no new logic needed. `v86_e` — item K: the SAME mobile-backgrounding fix extended to `_pollComicBookJob` (book/chapter creation), the one poller `v86_d` explicitly left open — required its own small refactor (a `while`+`sleep` loop split into a re-invokable `_comicBookCheckOnce()`, gated on the pre-existing `_comicBookId`) rather than a copy-paste, since it wasn't `setInterval`-shaped like the other two. Preserves one deliberate behavioural difference: a network hiccup mid-poll is NOT terminal here (unlike extract/detect), matching the original code exactly. Six new tests exercise the REAL function for the first time (every prior test mocked it). `v86_d` — mobile-backgrounding fix: `setInterval`-based polling for comic extraction AND detection can be throttled/suspended on a backgrounded phone tab, stranding a client that never learns its job finished (confirmed live: the user's own console showed server-side success while the UI stayed stuck). Fixed with a shared `visibilitychange` listener that re-checks any in-flight job off-schedule the instant the tab becomes visible again; `_pollComicBookJob` has the same class of gap and is explicitly NOT yet fixed (item K below). Also: a second live bug found mid-session — auto-detect silently dropped a malformed/inverted box with NO toast unless every suggested box was dropped (confirmed live: server said "4 panel(s) suggested", UI showed 3, no explanation) — now toasts on any drop, partial or total. Also item J: a "use whole image as one panel" shortcut button. `v86_c` — a genuine `v85_u` REGRESSION found and fixed: `_comicSetupCanvas()` re-registered all 8 pointer/touch listeners on every call with no matching removal, latent since the function ran once per image before `v85_u`'s own ResizeObserver made it run repeatedly — a single drag could fire the same handler multiple times, corrupting an in-progress box (confirmed: the exact "one box spans two panels" shape the user reported, twice). Fixed by wiring listeners exactly once. Also: camera capture (`capture="environment"`) with automatic downscale to 1600px, routed through the same upload handler as a regular file pick. `v86_b` — comic panels on the progress card: the REAL bug found and fixed. `v85_u`'s own "confirmed already built" conclusion was WRONG — both real callers of the shared story renderer (`_renderCompStory`, `_exStoryPanelHtml`) unconditionally passed an explicit `text:` override that defeated the comic-panel branch regardless of value, so it never actually fired from any real UI path. Fixed at both call sites; new tests exercise the REAL functions, not just the underlying renderer in isolation. |
| **TRACK T** | the text-focused progress card — steps 1–4 and `§T7` all shipped in the v81 line; nothing open here at this cut |
| **THE LARGER PLAN** | the folded `implementation_plan.md`. Cite it as `PLAN §X`. **A bare `§3` is this file's item; `PLAN §3` is Track C.** `PLAN §12`, `PLAN §7.0` Track A (CP1–5), and `PLAN §13` are ALL fully shipped. `PLAN §7.0` CP6 remains open (a CONDITIONAL, not a queued slice). `PLAN §2.4` / Track A4 (comic/image ingest) is fully shipped as its FOUR-milestone core, plus a `v85_o` auto-detect follow-up, plus a `v85_t` panel-resize follow-up, plus a `v85_u` resize-sync fix — its own sections below carry the full probe/measurement history. The browser-reachable single-chapter CP1-4 pipeline `PLAN §13` deferred remains its own, separate, not-yet-started follow-up. |

Standing rules are in the "Rules earned in session 28…34" blocks, plus two more from the `v83` line,
three from the `v84` line, and a new set from the `v85` line (search "Rules earned in the v85 line") —
read the **"⚠️ How the rules are NUMBERED"** note before citing one.

## ⚠️ Session protocol — READ FIRST

1. **Establish the green baseline before changing anything** — all four checks, and the corpus
   counts. A differing count is a FINDING, not a stale fixture.
2. **Measure before editing.** A warning in the notes is a claim about a DESIGN, not about the
   problem (rule 35). A fixer is not a diagnosis (rule 23).
3. **Revert-verify every fix and believe the result.** For anything claiming to preserve behaviour,
   CAPTURE the old output and DIFF it — "the tests still pass" is not the same claim (`v80_q`).
4. **A note telling the next session to check something is not a guard** (rule 24).
5. **Guard at the layer where the claim is observable** (rule 34). A guard that pins SOURCE TEXT for
   a claim about BEHAVIOUR cannot fail — this line cost two releases (`v80_c`, `v80_s`), and a THIRD
   time in the `v84` line (rule 39 — an inline style beating a stylesheet rule, invisible to a DOM
   harness with no real CSS cascade). Render and inspect, then MUTATION-TEST: if breaking the rule
   leaves the guard green, the guard is wrong.
6. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`). Any test that
   samples the corpus for a fixture must accumulate across several builds, and be verified over ~15
   consecutive runs, not one.
7. A version bump to a new BASE needs its own roadmap. **This is that roadmap for `v86`.**
8. **Never put emoji in a Python string literal** (rule 25) — write emoji-bearing blocks via a `cat`
   heredoc and splice the file in. And **check what a mechanical rewrite DID**, not just that it ran
   (`v80_d` mangled six sentences including a heading).
9. **A live model call needs a live test, not just a plausible prompt.** Confirmed again in the `v85`
   line: `v85_u`'s own comic-panel geometry investigation found a REAL model-accuracy limitation via a
   LIVE probe (this container has Ollama + `qwen2.5vl:7b` installed — checked directly, not assumed
   absent) — and the SAME investigation found a SEPARATE, fully-code-fixable bug (a canvas/image
   resize desync) that was very likely inflating the apparent severity of what the live probe measured.
   Neither finding would have surfaced from reasoning about the code alone.
10. **Ask before restarting a dev server you did not start, and before deleting data you did not
    create** — still true; the `v85` line's own instance was checking `git status --short lessons.json`
    before every build/test cycle, since the user's own uncommitted evaluation data sits there across
    sessions, AND (new, `v85_u`) a GENERATED build artifact (`docs/index.html`) can be freely rebuilt
    from safe, COMMITTED sources even when it independently shows as modified — the distinction that
    matters is never reading/baking the user's UNCOMMITTED data into it, not avoiding regeneration.

Standing design principle: **no language knowledge in the code**, where *permitted* means Unicode
machinery or corpus statistics, not a hand-authored table. Script tables live in `scripts.json`;
article lists live in a PROBE and must never migrate into the app (`v80_j`).

---

# ⚠️ OPEN AT THE v86 CUT

## 🆕 CARRIED FORWARD FROM THE v85 LINE, GENUINELY STILL OPEN

*Everything below survived the cut on its merits, not by mechanical carry — each item is restated
fresh, pointing at where its full diagnosis lives in `roadmap_v85.md` rather than repeating it here.*

### A. Move comic panel images OUT of `lessons.json` (from `v85_u`)

A CONFIRMED, measured violation of an EXISTING ruling (`D4`, folded from the `v80` cut, itself carried
below in THE LARGER PLAN section) that the comic feature (`v85_j`-`v85_p`) never implemented. At the
`v85_u` cut: 6 topics, 658,566 bytes of inline base64 image data in `lessons.json`; `docs/index.html`
grew ~700KB baking it wholesale (no `comicPanels` handling in `build-static.js` at all). Full scoping
(server-side asset directory, a serving route, the static-export text-only degrade `D4` already
specified, and a migration for the 6 existing topics) is in `roadmap_v85.md`'s `v85_u` entry, item 4.
**The migration of existing topics needs the user's own go-ahead before touching them** — same
standing rule as any other real-corpus-touching action.

### B. A vision-role model picker, restricted to capable models (from `v85_u`)

Most server-side plumbing already exists — `/api/models` already accepts a `vision` field exactly
like every other role. The client picker itself (`renderModelPicker()`'s own `roles` array) is a small
addition. The genuinely new part is capability filtering (nothing in this codebase currently
restricts any role's model list by fitness) — needs a short design choice (Ollama's `/api/show`
capabilities field vs. a family-name allowlist) before building. Full scoping in `roadmap_v85.md`'s
`v85_u` entry, item 5.

### C. Comic/PDF upload-card UX reorganisation (from `v85_u`)

The user's ask: the comic (and, it turns out, PDF too — both share the same shape) upload card should
handle extraction/chaptering ONLY; lesson-type/difficulty configuration belongs on a LATER wizard
step. `#gen-card-3`/`#gen-card-4` (the `PLAN §13` wizard's own "Chapters"/"Lessons" steps) already
exist and already serve exactly this purpose for the AI-generated-book path — the recommendation
(not yet confirmed by the user, not yet built) is to route comic AND PDF through that SAME staged
flow instead of each keeping its own divergent immediate-generate shortcut. "Beginner" as comic's own
default difficulty is part of this move, not a separate tweak. Full scoping and the reasoning behind
the recommendation is in `roadmap_v85.md`'s `v85_u` entry, item 6. **Needs the user's own confirmation
of the recommendation before anyone starts** — this touches the wizard shell and both upload cards.

### D. Tier 2 per-word image-coordinate vocab highlighting (from `v85_u`, restated from `PLAN §2.6`)

**⚠️ Correction (`v86_b`): Tier 1 was NOT actually working when this item was written.** `v85_u`
(and `v85_n` before it) believed panel-image-above-text was confirmed shipped and live — it was not;
see `roadmap_v86.md`'s `v86_b` entry for the real bug (both real callers of the shared story renderer
defeated the comic-panel branch unconditionally) and its fix. Tier 1 is NOW genuinely live as of
`v86_b`. This item (Tier 2, per-word coordinates) is UNCHANGED and still the real next step the user
asked for: highlighting vocabulary words AT THEIR LOCATION IN THE IMAGE itself, not just in the
transcribed text below it. Explicitly out of scope since `PLAN §2.4` was first scoped, still
unmeasured, needs its own design pass (does a vision model return per-word bounding boxes reliably
enough to trust, at what granularity, rendered how) before anyone estimates it.

### E. Chapter-title post-pass failures (from `v85_r`)

Already substantially hardened (3 attempts, a 4-rung parsing ladder, whole-chain context from an
earlier fix, a generous token budget). No further static defect found by reading. Needs a LIVE
reproduction with the raw model response captured — this container now has a live vision backend
confirmed (`v85_t`/`v85_u`), worth checking whether the TEXT model roles this needs are ALSO
installed before assuming a container still can't attempt this.

### ✅ F (live-verification half). `v85_r`'s article-symmetry fix — CONFIRMED against the live corpus, `v86_k`

`build_history/probe_article_symmetry_v80j.js` (a pure static analysis of `lessons.json`, no live
model call, read-only) re-run against the full live corpus: **1.3% asymmetric overall (40 of 3141
countable pairs)** — low. More directly: **the two SPECIFIC chapters `§F3c` originally named as
asymmetric are now BOTH 0 of 8 (0.0%)** — `tp_17869977371640000022` ("Stille vor dem Winter") and
`tp_17869980065780000104` ("Brücke der Existenz"). This is a real, direct confirmation the `v85_r` fix
took hold, not an inference — the EXACT cases the probe was written to track are now clean.

The two remaining "100% asymmetric" chapters this run found (`Geisterhafte Gestalten`, `Dunkel und
Geruch`, both `de→en`) were spot-checked directly and are NOT a regression — every pair is a plain
concrete-noun vocab flashcard (`der Nebel`↔`fog`, `das Herz`↔`heart`, `der Weg`↔`trail`, …) where the
German side correctly carries its citation-form gender article and the English side is correctly the
bare dictionary form — the SAME "each side follows its own language's own citation convention"
pattern found while spot-checking the corpus for quality earlier this cut. The probe's own header
warns it explicitly: "reported, not asserted… this cannot be language-blind" — it flags every
gender-marked German noun paired with a bare English gloss as "asymmetric" whether or not that's
actually correct, which is most of the 1.3%. **Live-verification half of item F is done.** The
"add explanations" ask (below) remains open and unbuilt.

**New live recurrence, this cut**: a fresh storyline (`sl_1833389129`) generated German entries WITH
articles ("die Liebe") paired with English entries that sometimes ALSO carried an article ("the
love" — which no fluent speaker would actually say) and sometimes didn't, inconsistently. The user's
own diagnosis, worth recording verbatim since it's a real, specific hypothesis: this likely traces to
the underlying LEXICON data the vocab-generation prompt draws from — German dictionaries conventionally
prefix a noun with its article to indicate GRAMMATICAL GENDER (a genuine, load-bearing convention:
"die Liebe" tells a learner it's feminine), while English dictionaries have no equivalent convention
(gender-neutral), so a source that pairs "die Liebe" ↔ "the love" isn't wrong per se on the German
side — the ASYMMETRY is baked into what "correct" looks like in each language's own reference
convention, not necessarily a model hallucination each time. This reframes the bug: it may not be
fully fixable by prompt correction alone (asking the model to drop the German article loses the
gender signal a learner needs; keeping it but adding an English article is simply wrong).

**Re-examined against this specific hypothesis, this cut (both the corpus-quality spot-check above and
the live-verification paragraph above): confirmed correct, not a bug.** `Wedding Fever`'s own vocab
(`sl_1833389129` itself) shows exactly the predicted pattern — `die Liebe`↔"love", `die Angst`↔"fear",
`der Humor`↔"humor" (English correctly bare, abstract/generic sense) alongside `die Hochzeit`↔"the
wedding", `der Hund`↔"the dog" (English correctly WITH "the", concrete/specific sense) — genuinely
correct per-word English judgment, not random inconsistency. The user's own report reacted to the
surface pattern (German always has an article, English sometimes doesn't) without it necessarily being
wrong; no further prompt work is needed for the symmetry question itself.

**New ask, same report**: rather than (or in addition to) suppressing the asymmetry, ask the
generating model to produce a short EXPLANATION for cases where an article genuinely belongs on one
side but not the other (the gender-marking convention above is exactly the kind of thing worth
explaining once, briefly, rather than hiding) — and show that explanation on the question card AFTER
the learner answers, so it becomes a small grammar note rather than a silently "wrong-looking" pair.
This is new scope, not yet designed: would need a new field on the vocab item (something like
`articleNote`), a prompt addition asking for it ONLY when relevant (not padding every item), and a
question-card UI slot to show it post-answer (mirroring how `writing`'s own feedback note already
shows post-submit). Not started — folded in here since it's the same underlying phenomenon.

### G. Live-verify the whole `v85_s`/`v85_t`/`v85_u` mechanical fixes on a real device

The word-tap speech-race fix, the panel resize handles, and the resize-sync fix are all
mutation-tested (proven NOT to regress what they claim to fix) but none has been touched, heard, or
seen by a human on a real device yet.

### ✅ H. `INTERNALS.md` §6b comic-panel rows — SHIPPED (doc-only commit, same session)

Caught up in full: `v85_t` (resize), `v85_u` (resize-sync fix + its own model-accuracy finding),
`v86_c` (listener-stacking regression + camera capture), `v86_d` (mobile-backgrounding fix +
silent-drop toast + item J), `v86_e` (item K), `v86_f` (item I), `v86_g` (items L/M/N) — seven cuts
of backlog, all written up to the section's own quality bar (function names, not line numbers).

### ✅ I. Rotate the uploaded/captured image — SHIPPED `v86_f`

Was: "a small button to rotate the photo" (from `v86_c` real-device testing). Built with option (a)
from the scoping below (rotating invalidates any drawn panel boxes, matching the existing "a new
image invalidates old boxes" precedent) — see the `v86_f` shipped entry for the implementation and its
test coverage. No longer open.

<details><summary>Original scoping (kept for the record)</summary>

**Ask**: a small button to rotate the photo — the user is testing the new camera-capture route
(`v86_c`) and a photo can come in sideways (portrait comic page shot in landscape, or vice versa,
common on a phone that doesn't lock orientation, or a scan/photo taken at an angle a fixed 90°
rotation would fix).

**Scoping, not built**: the pattern is a direct extension of `_comicDownscaleDims`'s own approach
(`index.html`, `v86_c`) — draw the CURRENT image onto an offscreen canvas with a rotation transform,
re-encode, replace `APP_COMIC.dataUrl`, and reload `#comic-draw-img`. For a 90°/270° rotation the
canvas's own width/height must SWAP (`APP_COMIC.naturalW`/`naturalH` swap too) — a 180° rotation
needs no dimension change. **One real design question, not yet ruled on**: any panel boxes ALREADY
drawn are stored in NATURAL PIXEL coordinates relative to the CURRENT orientation — rotating the
image after boxes exist either (a) invalidates them, matching the existing precedent that "a new
image invalidates any boxes drawn over the old one" (`comicClearPanels()`, already called whenever
`_comicFinishSetup` runs) — the SIMPLE option, recommended, since rotation is naturally a
before-you-draw-panels step — or (b) recomputes each box's coordinates through the same rotation
transform, preserving already-drawn work at the cost of real geometry code (a 90°/270° rotation maps
`(x,y)` in the OLD frame to `(y, newW-x)`/`(newH-y, x)` in the new one, per rotation direction — doable,
but adds a genuine coordinate-transform surface worth its own test coverage, not a "small button").
**Recommend (a)** unless the user specifically wants panels preserved across a rotation.

</details>

### ✅ J. A "single panel" shortcut — SHIPPED `v86_d`

Was: "treat the whole image as ONE panel" (from `v86_c` real-device testing). Built exactly as scoped
below — see the `v86_d` shipped entry for the final test coverage. No longer open.

<details><summary>Original scoping (kept for the record)</summary>

**Ask**: a button to take a complete photo/image as one panel, without manually drawing (or
auto-detecting) a box around it — useful for a single illustration, a one-panel comic, or any image
where there is exactly one thing to extract text from and drawing a box around the whole page is
pure friction.

**Scoping, not built**: small and low-risk. A new button (natural home: alongside `#comic-detect-btn`
in `#comic-detect-row`, shown at the same point once an image is loaded) that sets
`APP_COMIC.boxes = [{x1:0, y1:0, x2:APP_COMIC.naturalW, y2:APP_COMIC.naturalH}]` — REPLACING any
existing boxes, matching auto-detect's own already-established "a fresh detection replaces prior
boxes rather than merging" precedent (`unit-comic-detect.test.js`) — then `_comicRedraw()` +
`_comicRenderList()`, the same two calls every other box-mutating action already ends with.

</details>

### ✅ K. `_pollComicBookJob` mobile-backgrounding fix — SHIPPED `v86_e`

Was: "`_pollComicBookJob` has the same mobile-backgrounding vulnerability as the two pollers fixed at
`v86_d`." Built exactly as scoped below — see the `v86_e` shipped entry for the refactor and its test
coverage. No longer open.

<details><summary>Original scoping (kept for the record)</summary>

**Not fixed at `v86_d`, named explicitly.** The book/chapter-creation poller (`_pollComicBookJob`)
uses a `while`+`sleep`-shaped loop, not the `setInterval` shape `_startComicExtractJob`/
`_startComicDetectJob` had — so the SAME fix (a re-invokable check function gated by a tracked job id,
called off-schedule from a shared `visibilitychange` listener) needs its own small adaptation, not a
copy-paste. The live bug that motivated `v86_d` was specifically about comic-panel EXTRACTION, so this
was out of scope for that fix, but the underlying browser behaviour (mobile tab backgrounding
suspends timers) applies identically to any long-running client-side poll — book/chapter creation can
easily run long enough to be affected on a real device.

</details>

**Explicitly out of scope, confirmed with the user across the whole `v85` line — do not reopen without
asking**: the CP1-6 pipeline's cross-chapter arc-sequencing; spell-check-driven auto error-hunt
generation. The browser-reachable single-chapter CP1-4 pipeline (deferred by `PLAN §13`) remains a
separate, not-yet-scoped follow-up. `vocabTable.system` has no BASE FORM ONLY instruction at all —
not a contradiction, just an absence — left alone.

### ✅ L. Progress card / question panel show STALE text for a comic/image chapter after a story edit — SHIPPED `v86_g`

**User-reported LIVE bug** (real topic `sl_1597155858`, "Clean Restroom"): "I had fixed the extracted
text and made an AI error hunt lesson. The correct text is shown on the storyline and lesson-set
cards, but on the progress card the wrong text is shown, which should only show up for the error hunt
lesson." Confirmed by reading the actual stored data (read-only — `lessons.json` was never modified):
`story` held the corrected text ("...vorreste trovarlo..."), but `comicPanels[0].caption`/`inScene`
still held the ORIGINAL OCR'd text with the exact typo the user had fixed
("...vorrestevoletrovarlo..."). Root cause: `_comicStoryPanelsHtml` (the progress-card/question-panel
renderer for any chapter with `comicPanels`) builds its displayed text EXCLUSIVELY from each panel's
own `caption`/`inScene` fields — a completely separate copy of the text, extracted once at upload
time — never from `story` at all. `/api/save-story` (both the "story repair" UI's write-back and the
`error_hunt` editor's "corrected story" field POST here) updated `story` correctly but never touched
`comicPanels`, so those two surfaces kept showing the pre-edit text FOREVER after, while storyline/
lesson-set cards (which read `story` directly) correctly showed the fix.

**Fixed for the UNAMBIGUOUS single-panel case**: `/api/save-story` now syncs `comicPanels[0].caption`
to the full corrected story (clearing `inScene`, not leaving it stale alongside the synced caption) —
`_comicStoryPanelsHtml`'s own `[caption, inScene].join('\n')` then reproduces `story` exactly.
Multi-panel chapters are deliberately left untouched: there is no way to know which edited sentence
belongs to which panel from one flat story string (see item O below — a genuinely harder, separate
follow-up, not guessed at here).

**Test coverage**: a new e2e test (`e2e-save-story-comic-sync.test.js`, real server + isolated temp
store) covers all four cases — single-panel sync (caption+inScene both correct), multi-panel left
untouched, no-comicPanels-at-all (no crash, nothing created), and an unchanged story re-saved is a
no-op. Mutation-tested twice: dropping the `length === 1` guard (syncing multi-panel too) broke the
multi-panel test; dropping the `inScene` clear broke that specific assertion. Both restored, diff
clean.

### ✅ M. Drag-to-move a comic panel box — SHIPPED `v86_g`

**Ask**: "i can resize the selected comic panels now, but it would be nice to also be able to move
them" — the natural companion to `v85_t`'s own resize handles. Before this, a pointer-down inside an
existing box's BODY (not on a handle) fell through to `_comicPointerStart`'s drawing branch,
starting a brand-new overlapping box instead of relocating the existing one.

**Built**: `_comicHitBox(x,y)` (same last-drawn-first scan convention as `_comicHitHandle`) finds
which box, if any, the pointer landed inside; if a handle is ALSO hit, the handle wins (checked
first, unchanged ordering) — resize still takes priority over move at a box's own corners. A move
translates the box by the dragged delta (converted to natural pixels the same way resize already is),
clamped at the image boundary as ONE offset so the box's width/height are preserved EXACTLY (never
clamped per-edge independently, which would distort its shape against the wall).

**Test coverage**: five new tests — a body drag translates and preserves size (not a new draw, not a
resize); a handle grab still takes priority even at a box's own corner; clamping at the image boundary
preserves size exactly; a grab outside any box still draws a new one (regression check); and
`_comicPointerCancel()` clears the new `moving` state too. Mutation-tested twice: removing the
boundary clamp broke the clamp test; removing the handle-priority check broke the EXISTING `v85_t`
resize test (§7) first — a handle-priority regression breaks resize before it breaks move, since
resize depends on the same ordering. Both restored, diff clean.

### N. Comic auto-detect panel-boundary accuracy — investigated, likely a MODEL limitation, not a code bug

**User-reported**, same real-device round: a manually-defined 4-panel comic (a borderless,
newspaper-strip-style four-panel layout, no hard gutters between panels) detected "4 panel(s)
suggested" per the console log, but only 3 boxes appeared, with one box visibly spanning what a human
would call two separate panels.

**Investigated, NOT changed this cut** — the evidence points away from a code bug: `_comicApplyDetectedPanels`
(re-read in full this cut) has ZERO merging logic — each of the server's boxes is converted to natural
pixels INDEPENDENTLY; the only thing it can do to a box is drop it whole (malformed/inverted) or keep
it exactly as detected. There is no code path by which two genuinely separate, well-formed detected
boxes could merge into one on screen. The two remaining explanations are (a) the vision model's OWN
raw coordinates for that box already described an oversized region — a genuine accuracy limitation for
this specific, hard-to-segment layout, consistent with `roadmap_v85.md`'s own `v85_u` finding that
this exact model has real, separate accuracy limits on panel geometry (not the same issue as that
cut's canvas-desync bug, which WAS a real code fix) — or (b) the `v86_d` partial-drop toast (which
would have read "3/4") wasn't seen — either it faded before the screenshot, or the browser served a
cached pre-`v86_d` `index.html` (the server reads `index.html` fresh per request, so this would only
happen via BROWSER-side caching, not a stale server process).

**Not pursued further this cut** — improving detection accuracy for borderless layouts is real,
separate prompt/model work (a live-model investigation, not a quick fix), and the user can already
work around a missed panel by hand-drawing it (fully supported) or using the new drag-to-move (item M)
to fix a wrongly-placed one. Worth a live-model probe if the user wants it pursued — flagged here
rather than guessed at blind.

### O. Multi-panel `comicPanels` sync on a story edit — genuinely harder, not scoped

Item L's own fix (above) is deliberately narrow: only a chapter with EXACTLY ONE comic panel gets its
`comicPanels[0]` synced when `story` is edited. A chapter with multiple panels has no way to know
which edited SENTENCE belongs to which PANEL from a single flat story string — the story-edit UI edits
one continuous text, but the per-panel split (`caption`/`inScene` per box) was a one-time OCR
extraction with no preserved mapping back to sentence ranges. A real fix would need either (a) a
per-panel edit UI (edit each panel's own text separately, not the whole story at once) or (b) a
sentence-alignment heuristic (risky — a wrong alignment would silently scramble which image a caption
sits next to, worse than today's merely-stale text). Not scoped further this cut; flagged so it is not
silently forgotten.

## 🆕 A NEW BATCH — 16 items from real usage, evaluated at the `v86_h` cut

The user handed over a batch of 16 real-usage notes at once, asking that the easy ones (or ones
fitting this cut's own theme) be built now and the rest scoped into the roadmap. Four were built —
Q (comprehension prompt fix), plus three UNRELATED-to-comics small fixes that also shipped this cut:
tutor ask-time logging, the QC accept-on-rewrite relaxation, and the static-build tap-to-advance
parity fix (all three are their own top-level bullets in the `v86_h` shipped entry, not lettered here,
since they were not part of this batch's own items — listed together only because they landed the
same cut). The rest are scoped below, lettered P onward, continuing straight from O above.

### P. ⚠️ Inflection MCQ distractors sometimes mix grammatical DIMENSIONS — `v86_af` fixed the SINGLE-dimension case (the original "datief" report), confirmed STILL BROKEN for the COMBINED-dimension case

**User's report**, with a real example: for a question whose correct answer is "plural", the model
sometimes offers "dative"/"genitive" as WRONG options alongside the genuinely plausible "singular" —
mixing the NUMBER dimension (singular/plural) with the CASE dimension (nominative/dative/genitive) in
one distractor set, when only same-dimension alternatives make a clean multiple-choice question.

**Investigated — this is a prompt-COMPLIANCE gap, not a missing rule.** `prompts.json`'s
`inflections.system` ALREADY instructs: *"Wrong choices must be OTHER REAL, PLAUSIBLE labels for the
SAME DIMENSION (e.g. if the correct answer is 'plural', a wrong choice could be 'singular' or
'genitive plural' — not something absurd)."* The model isn't following this reliably. Two paths
forward, neither attempted this cut: (a) stronger prompt engineering — a few-shot example showing a
BAD (mixed-dimension) distractor set being corrected to a GOOD (same-dimension) one, which this prompt
currently lacks (it only has a positive worked example, no contrastive one); (b) a post-generation
validation pass — but this would need to know, per language, which form LABELS belong to the same
grammatical dimension, which is exactly the kind of hand-authored linguistic table this project's own
standing design principle forbids ("no language knowledge in the code" — script tables are the one
sanctioned exception, grammar categories are not). **Recommendation: (a), verified with a live model,
not (b).** Needs a live test with a real human reading several generated items before/after a prompt
change — this codebase's own standing rule 7 ("a live model call needs a live test AND a real human
reading the output").

**Update, `v86_ab`/`v86_af`**: a real, independent user report (`v86_ab`'s "datief" example —
Dutch, a plural noun, offered a case-dimension distractor) turned out to be this EXACT bug,
confirming the diagnosis above. `v86_af` shipped path (a) — the instruction now states the "same
dimension" rule far more explicitly ("DIRECT RELATIVES," with worked-out single-dimension vs.
combined-dimension guidance and a concrete counter-example) and both worked examples were fixed to
comply.

**Checked against real data (no new model call needed) — the rule did NOT fully take for
COMBINED-dimension answers.** The live generation already run for item AJ (below), AFTER `v86_af`
shipped, gives three real `formChoices` sets to inspect directly. All three correct answers combine
TWO dimensions (tense + person, e.g. `"Tegenwoordige tijd, derde persoon enkelvoud"`), and all three
distractor sets include `"Infinitief"` — a MOOD/finiteness value, a dimension absent from the
correct answer entirely, not a value of tense OR person. This is a genuine, unambiguous violation of
the rule `v86_af` wrote (it only permits varying ONE of the combined dimensions while KEEPING the
other, never introducing an absent one) — the single-dimension case (this item's own original
"datief" report) IS fixed, but the combined-dimension case is not. **Still open**: the rule's own
wording may need a sharper worked example specifically for combined-dimension answers (the current
`de` example demonstrates only a single-dimension case, `"plural"`/`"singular"`) — not attempted,
would need its own live re-test before shipping, per this project's own standing rule that a live-
model prompt change needs a live-model verification, not just a reading of the instruction text.

### Q. ✅ Comprehension questions must be answerable independently of each other — SHIPPED `v86_h` (prompt only, not live-verified)

**User's report**: a comprehension quiz asked a question only answerable using information from a
DIFFERENT question in the SAME quiz, not from the chapter's own story text.

**Investigated first** — `unit-comprehension.test.js` §9(b) already confirmed comprehension questions
are generated against the WHOLE CHAIN up to this chapter (`collectChainStory`), not the current
chapter in isolation, so this is NOT a missing-context bug; it's specifically about one question
leaning on a SIBLING question within the same quiz, which the prompt never explicitly forbade.

**Fixed**: `prompts.json`'s `comprehension.system` gained one new rule: *"Each question must be
answerable ON ITS OWN, from the story text alone — never write a question whose answer depends on
having read or answered a DIFFERENT question in this same quiz."* Low-risk (a prompt addition, easily
reversible, no code-logic change) — built now despite not being live-verified, unlike item P, because
the fix itself is simply asking for something the existing prompt structure already assumes but never
stated, not a new capability the model needs to be taught. **Not live-verified this cut** — flag for a
live check once the user next generates a comprehension lesson.

### R. Save an intermediate "unfinished" project state after text parsing, before lesson generation

**Ask**: after chapters/stories are defined (from a PDF, images, or LLM text-split) but before
lessons are generated, persist that intermediate state as its own resumable project — tagged
"unfinished" — so a session that stops here (closed tab, lost connection, or simply "I'll finish this
later") doesn't lose the parsing work and can resume straight into lesson generation.

**Not scoped in detail this cut** — this is a genuinely new PERSISTENCE SHAPE, not a small addition:
needs a new store concept (an "unfinished project" distinct from a playable topic — chapters/stories
exist but `lessons: []`), a UI surface to list and resume them (see item U below — likely the SAME
popover), and decisions about where in the existing `/api/generate-book`-style pipeline the
intermediate save point sits (right after chapter-splitting, before the per-chapter lesson-generation
loop begins). Related directly to item S below (which is about NOT losing ALREADY-GENERATED lessons
mid-run) — the two together cover "don't lose parsing work" and "don't lose generation work",
respectively, and might share one underlying mechanism (write progressively, not once at the end) once
designed together rather than separately.

### ✅ S. Write each lesson into the store AS IT FINISHES during multi-lesson generation — SHIPPED `v86_k`

**Ask, with a concrete real log** showing exactly why this matters: a `word_forms` lesson finished
generating (5 valid items, 1 rejected — a normal, successful result) and the user's own annotation on
the log says *"save this lesson here, before starting next"* — immediately followed by the NEXT
lesson type (`inflections`) beginning generation. If the run is interrupted anywhere after that point
(the user's own earlier report this session — "started an extraction from a photo… the generator
interface seems to have lost that" — is the SAME class of loss, one step over: work completed by the
server, not yet visible/durable to the client), the already-finished `word_forms` lesson is lost too,
even though it was already done.

**Built in BOTH multi-type generation paths, not just the one the report came from** — the standing
"a per-caller fix does not generalize to other callers of the same primitive" rule, applied
proactively this time rather than discovered as a gap later:
- **`_runRecreateJob`** (the exact function behind the user's own log — "Re-creating chapter"/"Add
  storyline lessons"): a new `persistLesson(lesson)` closure appends the lesson to `topic.lessons` and
  calls `saveStore(store)` IMMEDIATELY, wired into all FOUR lesson-success sites in the function (the
  `addTypes` tick-list loop, the legacy gate lesson, the legacy grammar-arc reinforcement loop, the
  legacy vocab-review reinforcement). The old batch-only `topic.lessons = [...(topic.lessons||[]),
  ...newLessons]` (once per CHAPTER, after every requested type finished) is gone — replaced by a
  final save that covers only the aggregate token-usage stamp `addTokenUsage` adds afterward (which
  mutates `topic` but never persists itself).
- **`_runBookJob`'s own arc-reinforcement loop** (initial book/PDF/comic generation, `base.arc` mode,
  chapters 2+): found to have the EXACT same gap while checking whether the fix generalized —
  `data.lessons.push(lesson)` for each requested `arcType`, with the chapter staying entirely
  unpersisted until ONE `_persistGenerated` call after the whole loop finished. Fixed by calling
  `_persistGenerated(data, contFrom, parent ? parent.id : null)` right after each successful arc
  lesson. Confirmed SAFE to call repeatedly before making this change, not assumed: `_persistGenerated`
  wraps `upsert()`, which matches by `data.id` — the FIRST call assigns a fresh id (mutating `data`
  directly, so later calls on the same `data` object see it already set) and every call after updates
  the SAME store entry in place, never creating a duplicate.

**Trade-off, deliberate and documented in both code sites**: this writes the WHOLE store to disk once
per lesson instead of once per chapter — more disk I/O during a large multi-type run, in exchange for
never losing already-finished work to a later type's failure or an external interruption. `saveStore`
is a plain synchronous `fs.writeFileSync`, so no ordering/race concern from calling it more often in
an already-sequential (`for`/`await`) loop.

**Test coverage**: both fixes are SOURCE-LEVEL checks (`e2e-recreate.test.js`, `e2e-book-arc-types.test.js`),
not a genuine mid-run snapshot — `fake-ollama.js` has no configurable response delay, and these runs
typically complete well under one poll interval, so trying to catch a real interruption mid-flight
would be flaky, not a real guarantee. Mutation-tested (both files): removing a `persistLesson`/
`_persistGenerated` call, or removing `saveStore` from inside `persistLesson`, breaks the corresponding
new assertion. Both existing e2e tests for these functions (`e2e-recreate.test.js`,
`e2e-book-arc-types.test.js`) still pass unchanged, confirming the FINAL cumulative result is
unaffected — only WHEN persistence happens changed, not WHAT gets persisted.

**Not done this cut, explicitly**: whether the job-status/progress reporting could surface "which
types are done so far" to a client that reconnects mid-run (the client-side half of this same
robustness story) — the server-side durability fix stands on its own regardless, but a resumed/
reloaded client still can't currently SEE partial progress live; it would just find it already there
on next load. Item R (intermediate "unfinished" project state) remains the natural home for that
client-facing half, if picked up later.

### T. Two questions initiated via text-selection → grammar click were never answered (screenshot, needs reproduction)

Referenced screenshot shows two such questions in an unanswered state. Per this project's own standing
category for this shape of report ("Bugs needing reproduction — ask the user for the case"): the
selection→grammar-question flow (`PLAN §12`) needs to be exercised live, ideally by the user narrating
the exact steps, before a code diagnosis is attempted — "never answered" could mean the UI simply
never re-surfaced them (a rendering/state gap) or that the underlying generation itself failed
silently (no error shown). Not investigated further this cut; flagged for reproduction.

### U. A popover listing all running/scheduled jobs, including unfinished projects, linking to their storyline/lesson-set pages

**Ask**: a single place to see everything in flight — the user's own note: "likely related to existing
roadmap items." It is: this would be the natural HOME for item R's own "unfinished projects" list, and
overlaps with the EXISTING job-store primitive (`newJob`/`jobStep`/`jobDone`/`jobFail`, already used by
every comic/PDF/book-generation job) — the server already tracks "what's running", just with no
aggregate client-facing view of it. Not scoped in detail: needs an endpoint listing active jobs (the
in-memory `jobs` Map has no owner/session concept currently — every job is anonymous, so "whose jobs"
needs deciding for a multi-learner deployment), plus the "unfinished projects" list from item R once
that exists. A real, moderately-sized feature — its own release, not a quick add.

### V. Multiple image upload for comic generation — each image becomes its own chapter (as if it were a single panel); allow "add images" after the first upload

**Ask**: batch-upload several comic pages/photos at once, each treated the way item J's own "use whole
image as one panel" already treats a single image — one chapter per image — plus an "add more images"
affordance so the flow isn't strictly "upload once, done."

**A real, moderately-sized feature, not scoped this cut** — the existing comic UI (`APP_COMIC`) is
built around ONE image at a time (`dataUrl`, `naturalW/H`, `boxes` — all singular). Multi-image would
need either a genuinely new state shape (an array of per-image states) or a simpler MVP: treat "add
images" as "repeat the single-image upload→chapter flow N times, chaining chapters the same way
`comicCreateChapter()`'s own one-chapter-per-panel redesign (`v85_p`) already chains multiple panels
from ONE image" — the second option reuses far more existing machinery and is worth scoping first.
Directly related to item R/S above (a multi-image batch is exactly the kind of longer-running,
multi-step job that benefits from incremental persistence).

### ✅ W. "Text explorer" mode — hover/click any word in the story to see its full grammatical analysis, independent of playing lessons — SHIPPED `v86_o`

**The user's own words: "THIS WILL BE A REALLY NICE FEATURE."** Ask: with the newer word-by-word
analysis pipeline (the same per-word grammatical breakdown `inflections` lessons already generate),
add an optional VIEW — a button next to the existing translation toggle — where the progress-card's
vocab highlighting is replaced by highlighting for EVERY word, and hovering/clicking a word shows its
grammatical form (case, tense, etc. — whatever `inflections`' own `formLabel` already captures) without
needing to start any lesson at all. Positioned explicitly as independent of lesson-playing: "dreizunge
just works as a text explorer."

**⚠️ RECONCILED (not built, scoping only) — this is the SAME feature as `PLAN §7.0` CP5, arrived at
independently from the UI side rather than the pipeline side.** CP5's own migration-sequence spec,
written at the `v81_l` cut, reads word for word: *"Let the red→green text progress card read analysis
and skill data with a legacy fallback"* (see `PLAN §7.0` below). Item W's original write-up (above)
never cross-referenced it and considered only two options — (a) a new dedicated generation pass, or
(b) repurpose the exercise-shaped `inflections` generator — missing the third, already-built,
already-measured option this reconciliation exists to record:

- **(c) surface CP1 (`canonical-text.js`) + CP2 (`canonical-analysis.js`) output directly.** CP2's
  own prompt already asks the model, per sentence, for exactly item W's per-word data — `{lemma, form,
  sense, confidence}` for EVERY token, explicitly instructed to **never omit one** (unlike
  `inflections`, which only covers a curated exercise subset). This has been measured on a real
  chapter, not just designed: the production model (`qwen3.6:35b-a3b`) got zero wrong translations
  with genuinely sophisticated context tracking; the cheap dev model (`qwen2.5:7b`) got 2/8 wrong (see
  the `v83_n`→`v83_p` note under `PLAN §7.0` below). Option (c) needs no new prompt design and no new
  quality measurement — both already exist for this exact data shape.

**What's actually already wired, checked this cut, module by module:**
- **CP1** (`canonical-text.js`, `buildCanonicalText(topic)`) is pure/deterministic, no model call, and
  explicitly safe for `server.js` to `require()` directly (the "standalone on purpose" header only
  forbids the OTHER direction — CP1/CP2 must never require `server.js`, since loading it binds an HTTP
  port as a side effect). **Already run at corpus scale once**: `canonical-text.json` (24 chapters, 14
  languages, committed at `v83_h`) exists in the repo today, though `server.js` has no read path for
  it — the file is a CLI-only artifact, never served.
- **CP2** (`canonical-analysis.js`, `analyzeChapter(model, chapter, opts)`) is also safe to
  `require()` from `server.js` — it depends only on `llm.js`, which `server.js` **already requires**
  (line 14, aliased `_rawCallLLM` etc.) and on `scripts.json`, plain data. But CP2 takes an explicit
  `model` string, not one of `server.js`'s existing per-role model settings
  (`OLLAMA_LESSON_MODEL`/`OLLAMA_TUTOR_MODEL`/etc, the runtime-switchable roles `/api/models` already
  manages) — a browser-reachable CP2 needs its OWN role added to that system, a small, mechanical
  addition (same shape as `OLLAMA_VISION_MODEL`'s own dedicated-role precedent), not a design
  question. **Never run at corpus scale**: `canonical-analysis.json` (CP2's own output file) has never
  been committed — only the single spot-measured chapter above exists as evidence. **The real cost
  finding**: CP2 makes ONE model call PER SENTENCE, sequentially — a live test this session found "one
  4-sentence chapter took 12+ minutes even on a warm model" (`PLAN §13`'s own note). On-demand,
  synchronous computation is not viable for a "hover any word" feature; this MUST be pre-computed and
  cached, not computed per-request.
- **CP3 has a real, live, but NARROW integration already** — `cp5ShadowFor()` in `server.js` (line
  735) reads `curriculum-plan.json` (CP3's own output file, almost always absent — the common case,
  degrading to `available:false`) and serves a per-chapter CONCEPT-COUNT summary + a comparison
  against existing lessons via `GET /api/cp-shadow/:chapterId`, painted into a small collapsed
  developer/curator row (`#comp-cp5-row`) in the chapter-complete popup. **This is not item W** — it's
  a concept-level coverage summary, not per-token lemma/form/sense — but it IS the exact end-to-end
  pattern (absent-by-default file → `available:false` fallback → a small GET route → a client function
  that paints a row only when real data exists) that a CP1/CP2 read path for item W should mirror,
  proven to already work in production rather than needing to be designed from scratch.
- **No server-side read/compute path exists for CP1/CP2 output at all, at any granularity.** This is
  the one genuine remaining gap, not a design question: `canonical-text.json`/`canonical-analysis.json`
  are flat CLI artifacts server.js has never opened.

**Recommended path (not started, no code changed this cut)**, in the order each piece becomes useful
on its own:
1. Give CP2 its own model role in the existing runtime-switchable role system (mechanical).
2. Design the background-job shape to run CP1 (instant) then CP2 (slow) for ONE chapter on demand,
   reusing the existing `jobs` Map / `newJob`/`jobStep`/`jobDone` infrastructure `_runBookJob` and the
   comic pipeline already use for exactly this "kick off slow server-side work, poll for completion"
   shape — cache the result keyed by chapter id (matching the plan's own reserved
   `topic.analysisVersion` field, never yet an actual stored field) so a chapter is only ever analysed
   once, not on every hover-mode visit.
3. A new GET endpoint mirroring `cp5ShadowFor`'s own shape (absent → `available:false`, no legacy
   behaviour change) to serve the cached per-token data.
4. Only then the client UI: a view toggle next to the translation button, reusing the EXISTING
   highlight/click machinery (`_highlightVocabHtml`, the `wp-tap` hook the tutor's own text-selection
   feature already reuses) rather than building new interaction plumbing — this step is the smallest
   of the four once 1–3 exist.

Steps 1–3 need no product decision, only implementation; step 4 is genuinely new UI. **Still not
scoped in fine detail** (exact cache invalidation rule, exact job-progress UI, exact per-word popup
content/styling) — this reconciliation settles WHERE the data comes from and confirms it is buildable
on already-measured, already-partially-wired infrastructure; it does not yet commit to a build order
or a release size.

**✅ ALL FOUR STEPS SHIPPED `v86_o`** — see that release's own roadmap section (under
`# ✅ SHIPPED IN THE v86 LINE`) for the full build + live-verification write-up. Step 4's client UI
ended up reusing NEITHER `_highlightVocabHtml` nor the `wp-tap` hook this note originally guessed at —
per-token analysis has no shared vocab word list to regex-match against, and the same surface form can
carry a different analysis at a different occurrence, so the real implementation builds the view
DIRECTLY from the cached per-sentence data (forward-only substring alignment against each sentence's
own raw text) instead. Cache invalidation is "serve stale, label it, don't auto-refresh"; job-progress
UI is a single status line; the per-word popup shows lemma/form/sense/confidence. Only the completion/
progress card panel got the toggle — the question panel's own story view (`_exStoryPanelHtml`) did
not, a natural small follow-up.

### X. Alternative-correct-answer handling for typing/ordering (and similar) lesson types — user's own thoughts, recorded verbatim

**The problem, from a real screenshot**: for a typing exercise, a DIFFERENT word than the one marked
correct would often ALSO be valid (a genuine synonym or equally-natural phrasing) — the learner is
marked wrong for a linguistically correct answer. Same shape for sentence-ordering: some alternative
word orders are often ALSO grammatically valid, not just the one order stored as "the" answer.

**The user's own proposed strategies, recorded here exactly as given, for a future session to weigh
rather than re-derive:**
1. **Ask the generating model to list all alternatives that would also be correct**, at generation
   time — the answer becomes a SET, not a single string. Lowest additional latency (one prompt
   addition), but asks the model to anticipate every valid alternative up front, which it may do
   incompletely.
2. **A post-generation pass that fills in valid alternatives** — a separate step after the main
   generation, specifically tasked with enumerating alternatives for each already-generated item.
   Decouples "generate the exercise" from "anticipate alternatives", possibly higher quality per-item
   but adds a whole extra generation pass to every affected lesson type.
3. **Look in the app's OWN corpus for the same question with a different correct answer already
   recorded** — a cross-topic consistency check: if the exact same word/sentence appears as a
   correctly-accepted alternative answer elsewhere in the corpus, allow it here too. Free at
   generation time, but only helps once the corpus already contains the alternative somewhere — cold
   for a brand-new phrase, and needs a real "same question" matching definition (exact string? stemmed?
   semantic?) which is itself non-trivial.
4. **A short LLM call ONLY when the learner's answer is marked wrong**, to judge whether their answer
   would ALSO be acceptable — asked reactively, not up front. Cheapest on the common (correct-answer)
   path, adds one live model call to the WRONG-answer path specifically, and needs a fast/cheap model
   role to not noticeably slow down the "you got it wrong" feedback moment.

**Not designed or scoped further this cut** — genuinely needs a decision among these (or a combination
— e.g. #1 for the common case, #4 as a fallback for whatever #1 misses) before any code. Worth noting:
this is the SAME underlying category of problem as the "add explanations for article asymmetry" ask in
item F above — both are about a generation-time judgment being too rigid for genuine linguistic
plurality — so a future session designing one might productively look at the other too, though they
are not the same fix.

### Y. Storyline-card UI redesign: fuse title-edit, title/summary/storyboard generation, and QC buttons into ONE popover behind a single pencil-icon button

**Ask, with a real screenshot** of the current button sprawl. A real, moderately-sized UI-only
redesign (no new backend capability — every action already exists, this is purely about how they're
surfaced) — not scoped further this cut. The natural next step is an inventory of every button/control
currently on the storyline card that this popover would need to fold in, before any layout work
starts.

### Z. Word-tap question routing: after answering a question reached by tapping a highlighted word, return to the SAME place "Next" would have led — but play through ALL questions tied to that word first

**Ask**: currently, tapping a highlighted word jumps into whatever lesson TYPE the tap happened to
route to, and answering it presumably returns somewhere lesson-type-specific. The ask has two parts:
(1) the RETURN destination after answering should be the same place clicking "Next" (or tapping a
NON-highlighted word) would have led — i.e. the normal forward-progress route, not something
type-specific; (2) before returning, if that SAME word has OTHER questions across DIFFERENT lesson
types, play through all of them first, in sequence, rather than stopping after just the one the tap
happened to land on.

**Not scoped this cut** — needs reading `tapWord()`'s own current routing/return logic in full first
(not attempted this cut), plus a design decision on ORDER when a word has multiple tied questions
across types (lesson-type order? generation order? does it matter to the learner?). A real UX
improvement, self-contained to the tap-to-lesson mechanism, but non-trivial once multiple questions
per word need sequencing.

### ✅ AA. Teacher-mode button → a dropdown with two explicit options — SHIPPED `v86_l`

**Ask**: replace the current single toggle button with a dropdown offering both modes by name, rather
than an implicit "click to flip" toggle.

**Built exactly as scoped** — a native `<select id="teacher-mode-select">` with two named `<option>`s
(`#teacher-mode-opt-teacher`/`-student`), `onchange="setTeacherMode(this.value)"` replacing the old
button's `onclick="toggleTeacherMode()"`. `_teacherMode` (the underlying boolean state, gating dozens
of call sites app-wide) is completely UNCHANGED — only the control's own shape changed.
`updateTeacherModeBtn()` (kept its name — still called from `build-static.js`'s static `init()`, the
`applyUIStrings()` language sweep, and after every state change) now sets the select's `.value` and
re-localizes BOTH option labels on every pass, via two new `en`-only keys
(`teacher.option_teacher`/`teacher.option_student`) rather than a separate `data-i18n` sweep, since
this control already owned an update function to reuse. `_TEACHER_TOGGLES` stays a list (unchanged
design intent: the one place a future second instance would register).

**Test coverage**: `unit-teacher-toggle.test.js` REWRITTEN for the new control shape (5 checks:
markup/both-options exist, selecting either option sets state + persists + re-syncs the select and
both labels, the two labels genuinely differ, `updateTeacherModeBtn()` assigns a real JS handler not
just the inline attribute, the new i18n keys exist). `unit-settings-card.test.js`/
`unit-static-flags.test.js` updated to the new id (their own claims — single-instance containment,
localStorage persistence — were unaffected by the shape change, only the id needed updating).
Mutation-tested twice (dropped the student-option-label sync, hard-coded `setTeacherMode`'s own
mode-setting logic) — both caught, restored, diff clean. `INTERNALS.md` updated in place (the `PLAN
§C4` Settings Card row) to describe the new control shape, not left stale.

### ✅ AB (the "unrelated context" half) — SHIPPED `v86_m`. The "stuck mid-sentence" half is still open, needs live reproduction

**User's report**: on a specific lesson-set (`tp_17877559633380000510`), a tutor question was only
partially answered and the reply got stuck mid-sentence; the console log named FOUR completely
unrelated topics as retrieved context ("Job in Germany | AI & Math Basics | AI & Code Efficiency |
Interview Drinks").

**The "unrelated context" half — root-caused by reading `tutorRetrieveContext` (server.js) in full**:
its scoring loop only includes a ZERO-keyword-overlap topic when `qt.size` (the question's own token
count) is 0 OR nothing has been picked yet (`if (qt.size && overlap === 0 && used.length) continue;`)
— by DESIGN, so a genuinely topic-less question still gets SOME grounding rather than none. But when a
question tokenizes to (near-)nothing meaningful — a short continuation like "finish that sentence
please", which doesn't need NEW topic retrieval at all since the real context is the conversation
HISTORY the tutor already receives separately — this same fallback degrades to "grab up to 4 topics by
RECENCY, regardless of relevance", which is exactly the shape of the reported log line. **Fixed
`v86_m`**: `tutorRetrieveContext` now takes a `hasHistory` flag (`/api/tutor` passes
`history.length > 0`); the recency-fallback is skipped entirely when the question tokenizes to nothing
AND history already exists — reserved for a genuinely FRESH/opening question with no history at all.
Mutation-tested (both `unit-tutor-retrieval.test.js`, which gained a whole new section, and
`unit-tutor-selection.test.js`'s own pinned-argument regex, which needed updating for the new call
shape — the standing "a guard that pins exact arguments breaks on any legitimate change" rule, applied
rather than rediscovered). **Live-verified** (rule 7) against the real `qwen3.6:35b-a3b` model on a
real corpus topic pair (fr←de): a fresh/opening question still retrieves 4 topics by recency and gets
a grounded reply referencing the real story; a topic-less continuation WITH history now retrieves
nothing at all (prompt tokens dropped 1282→667, no `ctx:` in either log line) and the model's reply
stays coherent, grounded purely in the conversation history — reproducing the reported bug shape
without regressing the opening-question case the fallback exists for.

**The "stuck mid-sentence" half — could NOT be correlated to this specific report.**
`learners.json`'s own `tutorThread` array (read-only, checked this cut) stores only `{role, text}` per
message — no timestamp, no scope tag — so the exact broken exchange can't be located after the fact
from stored data alone. Needs live reproduction. **This cut's own `v86_h` release directly helps the
NEXT occurrence**: the tutor route now logs on ASK (before the model call), not just on a completed
reply, so a future stuck/broken request will leave a trace even if it never finishes — see the `v86_h`
shipped entry.

### AC. Main page / storyline page: show chapter icons (with green progress frames) or comic/image thumbnails instead of the storyboard, when available — a fallback hierarchy

**Ask**: replace the storyboard illustration with something more informative depending on what data a
chapter/storyline actually has: (i) comic/image thumbnails, if the chapter has `comicPanels` or a
similar single-image source; (ii) the generated storyboard SVG, if one exists; (iii) chapter icons with
progress frames (the same visual already used in the progress card's own navigation popover), as the
universal fallback when neither of the above exists.

**Not scoped this cut** — a real, moderately-sized UI feature. Worth noting it dovetails naturally with
item A (moving comic images out of `lessons.json`) — once comic panel images live in their own
server-side asset store rather than inline base64 in the topic record, serving a THUMBNAIL for this
hierarchy's own tier (i) becomes cheaper (a smaller derived image, not the full-resolution panel crop)
— worth sequencing AFTER item A rather than before, if both are ever picked up.

## 🆕 CORPUS QUALITY SPOT-CHECK (`v86_j` cut) — asked directly, not a live-testing report

The user asked for a general sanity/quality pass over the live corpus (read-only throughout —
`lessons.json` never modified). Findings below; the corpus itself needed no action (nothing found was
this session's own doing) but two items are worth recording.

### ✅ Spot-check findings — no action needed

Comic-panel sync (item L) confirmed correct on live data (`血の関税`: `comicPanels[0].caption` matches
`story` byte-for-byte, `inScene` correctly cleared, after a real `ai_error_hunt` correction). Math
generation arithmetically verified correct on several sampled items. Comprehension questions
(`Wedding Fever`, pre-dating item Q's prompt fix) were already genuinely self-contained in this
sample — the reported failure mode is real but not universal, consistent with a probabilistic
compliance gap rather than a systematic break. Inflection MCQ distractors (English target) were
clean, same-dimension alternatives. **Item F's own concern was re-examined against real data and
looks LESS severe than first assumed**: `die Liebe`↔"love" vs. `die Villa`↔"the villa" is not random
inconsistency — English legitimately drops "the" for abstract/generic nouns and keeps it for
concrete/specific ones; the sampled vocab reflects genuinely correct per-word English judgment, not a
bug. Three stale, lessonless topics (`Cooking Dinner at Home`, `Mountain Walk`, `A Walk in the Park`,
all Aug 23, real story text but zero lessons) are live, concrete evidence for item R's own use case —
not a new problem, just confirmation the gap is real.

### AD. Furigana for SOURCE-language Japanese content — new audience requirement, scoped not built

**The ask**: the app also targets Japanese-speaking KIDS learning some other language — for them,
Japanese is the SOURCE language (their own, native, UI language), not the target being learned. A
child reader may not yet know every kanji even in their OWN language, so source-language Japanese text
(comprehension questions/choices/why, writing prompts, tutor replies, translations, error-hunt notes,
etc.) may need furigana too — a genuinely different case from the EXISTING furigana support, which is
built entirely around Japanese as the language being LEARNED.

**Investigated first, found reassuring**: a spot-check of story text on Japanese-TARGET topics found
what looked like broken furigana (spurious `[は]`/`[に]` brackets attached to hiragana instead of
kanji, silently stripped by `_furiParts`'s own defensive Pass 1, so never visibly broken — just
zero actual reading annotations). Checked ALL 16 Japanese-target topics in the corpus against their
`generatedAt` timestamps: every single one predates `d8bcc5c` (`v82_i`, "restore difficulty-tiered
furigana density", 2026-08-23 10:27) — the closest ones by mere HOURS. The user's own recollection
("i think i didnt generate japanese lessons since we issued a fix for furigana") is confirmed exactly
right — this is stale pre-fix data, not evidence of a current bug. Nothing to fix here; flagged so a
future session doesn't rediscover the same false alarm from the same stale topics.

**Current architecture, read in full** — furigana support exists in exactly ONE place:
`sysStory(lang, ..., difficulty)` in `server.js`, gated on `lang === 'ja'` (the TARGET language),
selecting a density tier via `_furiganaNoteFor(P, difficulty)` among `prompts.json`'s
`story.furiganaNote1/2/3` (beginner: every kanji without exception / standard / advanced: only rare
kanji — `v82_i`'s own restored behaviour). NOTHING else has any furigana awareness — not
`comprehension`, not `writing`, not the tutor prompt, not translations, not `error_hunt`. Client-side:
`furiHtml()`/`_furiParts()` are the shared rendering primitives (language-agnostic — they just look
for `kanji[reading]` bracket syntax and no-op on anything else), but `updateFuriganaRow()` (the toggle
that gates whether `APP.showFurigana` even CAN be true) checks only `APP.lessonData?.lang` — the
target language — never `srcLang`. Comprehension's own renderer (`tComprehension`) additionally
bypasses `furiHtml()` entirely for the question stem (`escHtml(ex.question)` — plain, no furigana
processing at all), while its answer choices DO go through it (via `cGrid`) — an inconsistency found
in passing, currently a no-op everywhere checked (no bracket data exists in source-language text to
begin with), but real and worth fixing as part of this same work rather than separately.

**User's own decisions on scope, this cut**: (1) don't build yet — scope in the roadmap first for
review. (2) density should REUSE the existing difficulty-tier mechanism (beginner/standard/advanced),
not a separate always-on rule — the same `furiganaNote1/2/3` shape, mirrored for source-language text.

**Scoping for a future session, not built**:
- **New prompt content**: a `srcFuriganaNote`/`srcFuriganaNote1/2/3` family (mirroring the existing
  `story.furiganaNote*` naming) needs adding to `prompts.json`, then threading into EVERY generator
  that produces source-language prose when `srcLang === 'ja'` — at minimum `comprehension` (questions,
  choices, `why`), `writing` (the question), the tutor prompt (`PROMPTS.tutor.system`), and worth
  auditing for others (`error_hunt`'s explanation-shaped fields, `synonyms`/`grammar`'s any prose
  fields, translations). Each is its OWN prompt with its own `fillPrompt(...)` call site — this is the
  bulk of the work, not one shared change.
- **Client**: `updateFuriganaRow()` needs to ALSO show the toggle when `APP.lessonData?.srcLang ===
  'ja'`, not just target `lang`. `tComprehension`'s question stem needs `furiHtml()` instead of bare
  `escHtml()` (the inconsistency found above) — and every OTHER renderer touching source-language
  prose (tutor widget, writing-feedback display, comprehension's own `why` field once shown, etc.)
  needs auditing for the same gap, not just comprehension.
- **Not yet decided**: whether TARGET-Japanese and SOURCE-Japanese furigana should share ONE
  `APP.showFurigana` toggle/setting or need their own independent one (a learner could plausibly want
  one on and the other off — e.g., full kanji help reading their native-language QUESTIONS but minimal
  help in the target-language STORY they're actively learning, or vice versa). Needs a decision before
  building the toggle-visibility change above.
- **Verification**: any prompt change here needs a live-model check with a real human (ideally
  Japanese-literate) reading the output — this codebase's own standing rule 7 — before shipping,
  exactly like `v82_c`/`v82_i` themselves were live-verified for the target-language case.

## 🆕 LIVE-TESTING ROUND ON `v86_d`–`v86_h` (`v86_i`/`v86_j` cuts) — AF resolved (likely never a bug), AE still open with diagnostic logging now in place

The user began live-verifying the whole round per `v86_h`'s own recommendation. **Confirmed working**:
item L (progress-card text sync, `sl_1597155858`), items I/M (rotate + drag-to-move, "feel right on a
touchscreen"). **Two real problems reported, investigated this cut, NOT resolved** — both need a
specific answer from the user before a confident fix (rather than a guess) can be attempted.

### AE. The mobile-backgrounding recovery fix (`v86_d`) did NOT recover, on a real device — diagnostic logging added, still open

**Reported**: backgrounded the tab mid-extraction, brought it back, still got "Chapter creation
failed: no extracted text yet" — but the CONSOLE showed the server had genuinely finished
(`[comic-extract] done: 1 panel(s), 0 failed`).

**Investigated, ruled out**: (a) the service worker (`sw.js`) — read in full, confirmed NETWORK-FIRST
by design (`fetch(req).then(...).catch(() => caches.match(req))`), so an online client always gets the
current page; not a stale-cache explanation. (b) job expiry on the server — a completed job stays in
the `jobs` Map for 5 minutes (`jobDone`'s own `_scheduleCleanup(id, 5*60*1000)`), a generous window
unless the tab was backgrounded far longer than that.

**The user's own follow-up answers ALSO ruled out the "page discarded and reloaded" hypothesis**
this section originally led with: *"it looked almost exactly like i left it, the light grey progress
message said '1 Panel'… when i reloaded it stayed the same."* If the tab's JS context had been
discarded and silently reloaded, `APP_COMIC` (never persisted anywhere until a chapter is actually
created) would have come back EMPTY — no uploaded image, no boxes — not "almost exactly as left". The
JS context surviving is real, useful information: this rules out the localStorage-based redesign this
section originally proposed as the fix, at least for THIS report. (Separately: "the light grey message
said '1 Panel'" is almost certainly `#comic-panel-count`, which shows the BOX COUNT — set the moment a
box is drawn, unrelated to extraction outcome — not `#comic-extract-status`, the field that actually
tracks "extracting…" vs cleared; the two are styled identically (`color:var(--gray-dark)`), which
likely explains the mix-up. And "when i reloaded it stayed the same" describes an EXPECTED, unrelated
behaviour: `APP_COMIC` is pure client-side working state until a chapter is created — item R's own
"unfinished project" persistence ask is exactly this gap, already scoped separately — a real reload
was always going to lose the in-progress panel/extraction state regardless of this bug.)

**Fixed this cut (`v86_j`), diagnostic-only — the underlying bug is still NOT located**: the entire
visibility-recovery mechanism was silent. Console logging was added throughout —
`_comicExtractCheckOnce`/`_comicDetectCheckOnce`/`_comicBookCheckOnce` now log on every call (stale
vs. current, the fetch outcome, the parsed status, panel counts applied), and the shared
`visibilitychange` listener itself now logs UNCONDITIONALLY on every fire — including when nothing is
tracked, so a session can confirm the listener is alive at all, separately from whether it had
anything to do. **The next occurrence of this exact report should be immediately diagnosable from the
console** the user is already checking: was the listener even firing? Did the check run? What did the
server actually say? None of that was visible before this cut.

### ✅ AF. The auto-detect partial-drop toast — console logging added `v86_j`; likely a false alarm (confirmed: user never watched the screen)

**Reported**: on a 4-panel comic (console: `[comic-detect] done: 4 panel(s) suggested`), the browser
still showed 3 panels, with NO toast and no console message about a skip.

**Investigated**: `_comicApplyDetectedPanels`'s own code, re-read in full — with `panels.length===4`
and one box filtered as malformed (`converted.length===3`), the `3 < 4` toast condition SHOULD fire;
no code path was found that would silently skip it.

**Confirmed by the user's own follow-up**: *"i did not watch the screen."* This settles it —
`showToast()` has never logged to console, only shown a ~2.2-second visual popup, so "no console
message" was never going to be evidence either way. The toast very likely DID fire; it just was not
observed. **Fixed anyway, per the user's own explicit ask ("please add a console message as well")**:
`_comicApplyDetectedPanels` now logs to console on every outcome — a clean pass logs `"all N panel(s)
kept"`, any drop (partial or total) logs the kept/suggested counts PLUS the raw (0-1000 model-space)
coordinates of every DROPPED box specifically, so a report like "the 4th panel looks shifted outside
the image" can be confirmed or refuted directly from the console on the next occurrence, not guessed
at from a screenshot.

**The panel-COUNT mismatch itself is separate from the toast question** and matches item N's own
already-recorded finding (a likely model-accuracy limitation, no merging logic exists in the code) —
but the user's own geometry observation is sharper and worth recording verbatim: *"it looks like the
widths of the three detected panels could correspond to the widths of the first three panels, with the
fourth just shifted outside and dropped"* — consistent with `_comicApplyDetectedPanels`'s own clamping
math (`x2` is clamped to `Math.min(w, ...)` but `x1` is only clamped to `Math.max(0, ...)`, never
capped against `w` — if the model's own coordinate space assumption drifts, a box positioned entirely
past the image's right edge would have `x1 > w`, get `x2` clamped down to `w`, land with `x2 <= x1`,
and correctly get dropped as malformed by the EXISTING filter — not a bug, but confirms the mechanism
by which a genuinely-detected 4th box can vanish without corrupting anything else). The new console
logging (above) will show the RAW coordinates directly on the next detection, settling this for good.

### AG. CP2's `form` field is coarser than `inflections`' own decomposition — clitic pronouns, explanations (user-requested comparison, `v86_s`)

**Asked directly by the user**: compare `tp_17877511606660000499`'s existing `inflections` lesson
against the SAME chapter's new text-explorer (CP1/CP2) annotation, for "aiutateci" and "trovarlo"
specifically. Real data, both sides, pulled from the live store — not a hypothetical:

| | `inflections` lesson | text explorer (CP2) |
|---|---|---|
| **aiutateci** — form | `"imperative plural with clitic pronoun"` | `"verb, imperative plural second person"` |
| **aiutateci** — explanation | *"'Aiutateci' is the imperative form (2nd person plural) of 'aiutare' combined with the clitic pronoun 'ci' (us)."* | *(none — only a `sense` field: "Help us")* |
| **trovarlo** — form | `"infinitive with clitic pronoun"` | `"verb, infinitive"` |
| **trovarlo** — explanation | *"'Trovarlo' is the infinitive 'trovare' combined with the clitic pronoun 'lo' (it)."* | *(none — `sense`: "find it")* |

**The real, systematic gap**: CP2's own prompt (`canonical-analysis.js`'s `buildAnalysisPrompt`)
never asks about clitic-pronoun attachment at all. The MEANING survives — folded into `sense`
("Help **us**", "find **it**") — but the grammatical DECOMPOSITION (base verb + attached clitic,
which pronoun, what it refers to) does not, because `form` is only ever asked for "part of speech
plus any relevant inflection," with no clitic-specific instruction. `inflections`' own prompt was
evidently designed with this exact decomposition as its task; CP2's was not.

**The user's own explicit direction on the fix path**: *"don't lose track that CP1/CP2 must also
work for PLAN §7.0. So for your suggestion: enrich CP2."* — i.e. this is NOT item W/text-explorer's
own problem to solve in isolation with a parallel mechanism; CP2's output feeds CP3/CP4/CP5 too
(the whole PLAN §7.0 pipeline), so enriching it there benefits all of them, not just this one UI.
Two concrete candidate enrichments, NEITHER built yet:
1. **A clitic/compound-morphology note inside `form`** (or a new sibling field) — e.g. `form: "verb,
   imperative plural second person + clitic pronoun 'ci' (us)"`, so the decomposition CP2 currently
   drops is captured without inventing a second per-word pipeline.
2. **An `explanation` field**, mirroring `inflections`' own one-sentence prose gloss — the SAME kind
   of information the popover (`_teShowWordPopover`) could show below lemma/form/sense, and the
   text-explorer UI already has a slot pattern for.

**Not started**: no prompt change, no schema change, no live-model measurement of either
enrichment's own accuracy (per this whole track's own standing rule — a live model call needs a
live test before it ships, and a prompt change to CP2 is exactly that). A future session picking
this up should re-measure `qwen3.6:35b-a3b`'s own output quality for whichever enrichment is tried,
the same way `v83_n`→`v83_p` measured CP2's original design.

### AH. Making CP2 faster: three user-proposed mechanisms, evaluated (`v86_t`) — none built, one clear recommendation

**Three ideas, asked together, all aimed at CP2's real measured cost** (one model call PER SENTENCE,
~3+ minutes each on this container's CPU-only inference — see `v86_o`'s own live-verification note):

**1. "Only analyze a fraction of the vocab — rare words, most words, even single articles" (a
coverage knob, like `inflections`' own curated subset).** The key fact this idea runs into: CP2's
cost driver is SENTENCES, not tokens — one call covers every token in a sentence AT ONCE, for
context, so filtering which TOKENS get analyzed does not by itself reduce the number of model calls;
only skipping WHOLE SENTENCES would. A real lever exists: skip a sentence entirely when every token
in it is already "well known" by some corpus-derived measure — but "well known" must be derived from
`computeFrequency()`'s own corpus statistics (already built, already exported from
`canonical-analysis.js`), NEVER a hand-authored per-language stopword/article list — this project's
own standing design principle ("no language knowledge in the code") explicitly forbids exactly that
(`v80_j`: "article lists live in a PROBE and must never migrate into the app"). Skipping sentences
this way trades real speed for a real coverage gap (those words become dead in the explorer, unless
the skip is presented as an explicit "fast, less complete" mode rather than the default). Separately,
**a "hide function words/articles" DISPLAY filter** (after analysis, using the model's OWN reported
`form` label to decide what to show) is a different, much simpler, ZERO-cost-savings feature — worth
building on its own merits regardless of any coverage-for-speed decision, and should not be confused
with it.

**2. "Reuse word explanations that already exist for other lessons... incrementally faster as more
lessons accumulate" for `canonical-analysis.json` itself.** Builds directly on the cross-chapter
reuse question already asked and answered earlier this session (see this file's own record of that
exchange): `sense` is genuinely CONTEXT-DEPENDENT by CP2's own design (the whole reason it analyses
per-sentence, not per-lemma) — a blind "same surface form seen before, skip the model call" cache
risks a silently wrong gloss surviving in a new context the model was never asked about, which is
exactly the failure mode CP2 exists to avoid. Two shapes, genuinely different risk profiles: **(a)
reuse as a HINT** — feed a prior analysis (same lemma/form) into the CP2 prompt as a candidate the
model can confirm or override, preserving the "never silently guess" principle, though on this
hardware inference time is dominated by generation length more than prompt size, so this may not
meaningfully reduce wall-clock cost even though it could improve consistency; **(b) reuse as a
SKIP** — genuinely faster, genuinely riskier (a stale/wrong-context sense ships unreviewed).

**3. "Use existing `inflections` lessons to annotate text via the new function — or is mixing two
different inputs too dangerous?"** The user's own instinct to ask this is well-founded. Real appeal:
zero new model calls for words `inflections` already covers (its own real data for THIS chapter is
literally why item AG exists — richer than CP2's own output for those same words). Real risk: the
two data shapes don't align cleanly — `inflections` items carry a `sentence`+`surfaceForm` STRING
pair with no stable per-token id, while CP2's tokens carry CP1's own STABLE `tokenId`; blending them
needs a fuzzy string match, which can assign the WRONG occurrence's data when a surface form repeats
with a different sense in a different sentence (exactly the ambiguity CP1's stable token ids exist
to avoid). Also a provenance mismatch: `inflections`' own quality bar is exercise-shaped (a wrong
DISTRACTOR there never corrupts the correct answer shown) — it has never been validated as "correct
enough to present as fact" the way the explorer's own analysis is presented. The SAME safer pattern
as idea 2(a) applies here too: use a scoped (same sentence, same token index) `inflections` match as
a HINT into the CP2 prompt, never a blind corpus-wide swap.

**Recommendation, if this is picked up**: none of the three should ship as a blind skip-the-model-
call cache — all three converge on the SAME safer mechanism (feed prior analysis, from whichever
source, as a HINT the model still confirms), which preserves CP2's own "never silently guess"
design principle intact. A genuinely faster SKIP-based mode could exist later as an explicit,
clearly-labelled opt-in ("fast, less certain") for a user who wants speed over completeness — but
should not become the default without a live-model measurement of how often a naive skip is wrong.
**Not started** — no code changed, no prompt work, no measurement; needs a product decision on which
mode(s) (if any) to actually build before any of this ships.

### AI. Surface CP1/CP2 analysis — and let a curator EDIT it — from the teacher/lesson-card interface, not just the learner's 🔍 toggle

**The ask**: at some point, the text-explorer's own analysis needs to be reachable and correctable
from the curator side (the lesson-card set / teacher interface), not only as a read-only learner
toggle. This was already anticipated in CP2's own schema, never built: `canonical-analysis.js`'s
own per-token `confidence`/`reviewed` fields exist specifically for "expose uncertainty/review
rather than silently guessing" (its own file-header comment) — but no UI has ever read `reviewed`,
shown low-confidence tokens distinctly to a curator, or let a human correct a wrong `lemma`/`form`/
`sense` the way lesson content is already editable elsewhere (`openLessonEditor` and friends).

**Scope, not yet designed in detail**: a new editor surface (or an extension of an existing one)
showing a chapter's cached per-token analysis, letting a curator correct any field and stamp
`reviewed:true` (+ presumably `reviewedBy`/`reviewedAt`, matching this project's existing provenance
conventions elsewhere), and a new write endpoint to persist corrections back into
`canonical-analysis.json`. **One real open question a future session will need to rule on**: how a
correction survives (or doesn't) a RE-analysis. The existing `stale` mechanism (`v86_o`) invalidates
a chapter's WHOLE cached analysis on any story edit, at the CHAPTER granularity — a per-token human
correction has no protected status against that today, so a future re-analysis would silently
discard it exactly like any other cached data. Whether that is acceptable (corrections are cheap to
redo) or needs its own preservation mechanism (e.g. keep a reviewed token's values across
re-analysis unless the SPECIFIC sentence containing it changed) is a real design decision, not yet
made. **Not started.**

### AJ. `PROMPTS.inflections`'s `{S}`-language fields comply reliably for `srcLang:'en'`, unreliably otherwise — a real model limitation, ACCEPTED by user ruling, not fixed

Directly generalizes item P above (the "distractors mix dimensions" finding, from the SAME
`prompts.json` prompt) into a bigger, comparative finding: `{S}`-designated fields
(`title`/`desc`/`formLabel`/`formChoices`/`explanation`) comply with the "write this in {S}"
instruction RELIABLY when `{S}` is English, and UNRELIABLY otherwise — confirmed by directly
comparing two real, live-generated lessons rather than guessing.

**Comparison data, both against the same model (`qwen3.6:35b-a3b`)**:

| | `tp_17877511606660000499` ("Cleanliness Command", it→en) | `tp_17880367188140000070` ("Die Enteignungszone", nl→de) |
|---|---|---|
| `title` | `"Italian Inflection Practice"` — correct English | `"Nederlandse vervoegingen"` — WRONG, Dutch |
| `desc` | `"Identify dictionary forms from context."` — correct English | `"Woorden in context herkennen"` — WRONG, Dutch |
| `formLabel` | `"imperative plural with clitic pronoun"` — correct English | `"Tegenwoordige tijd, derde persoon enkelvoud"` — WRONG, Dutch |
| `formChoices` | all 4 in English — correct | all 4 in Dutch — WRONG |
| `explanation` | full English sentences — correct | full Dutch sentences — WRONG |
| `translation` | correct English, both cases | correct German, both cases |
| `lemma`/`lemmaChoices`/`sentence`/`surfaceForm` | correct Italian (`{L}`), both cases | correct Dutch (`{L}`), both cases |

The `it→en` lesson predates every prompt change this session (generated `2026-08-26`, the OLD, much
weaker instruction wording) and STILL complied perfectly. The `nl→de` lesson was regenerated live,
AFTER `v86_ab`'s worked-example fix AND `v86_af`'s explicitly-reinforced "MUST be written IN {S} —
NEVER in {L}" wording plus a closing LANGUAGE CHECKLIST — and STILL failed identically. Stronger
prompt wording measurably made NO difference for this language pair; only `translation` reliably
switches language in EITHER case.

**Working hypothesis, clearly labelled as a hypothesis, not confirmed by a controlled experiment**:
this model (like most) is trained overwhelmingly on English text, giving it a strong DEFAULT bias
toward English for meta-commentary/labelling tasks. When `{S}` happens to BE English, the explicit
instruction is redundant with that default — compliance looks perfect, but may not actually prove
the INSTRUCTION works, only that the requested language matches the model's own bias. When `{S}` is
any other language, the instruction must ACTIVELY OVERRIDE that English-default bias AND the strong
LOCAL momentum of an otherwise `{L}`-saturated prompt (sentence/lemma/lemmaChoices are ALL `{L}`) —
and for this size of model (an "a3b" MoE, a genuinely lightweight architecture), that override
fails. Confirmed NOT to default to English either, when it fails — the `nl→de` case defaulted to
DUTCH (`{L}`, the CONTEXTUALLY dominant language), not English — so this is "instruction loses to
context," not simply "model always prefers English."

A secondary, untested structural observation: the schema's own field ORDER places `formLabel`/
`formChoices`/`explanation` (all `{S}`) immediately AFTER a block of `{L}`-only fields
(`lemma`/`lemmaChoices`), right when the model most needs to switch OUT of `{L}` — while
`translation` (the one field that reliably works) sits EARLY, right after a single short `{L}`
field, needing a smaller "unwind." Reordering the schema to test this directly was proposed and
NOT run — the user's own ruling (below) makes it moot for now.

**User's ruling, ending this investigation without a code change**: *"let's just leave it as it is.
it makes sense to use the target language to describe target language grammar."* Grammar labels in
the TARGET language are pedagogically defensible on their own terms, not merely a bug to tolerate —
recorded here as the explicit reasoning, not just "deferred."

**Recorded for later, NOT built**: a POST-GENERATION "translate layer" — a dedicated, SECOND LLM
call per generation that explicitly translates the `{S}`-designated fields (whatever language they
came back in) INTO `{S}`, mirroring the ONE reliably-working case in this whole prompt: a
translation-framed task, not a "compute in one language, relabel in another" one. This would need,
if built: (a) a decision on when to run it — always (extra latency/cost every time, simplest,
matches the fact that `translation`'s own reliability comes from EVERY call being translation-
framed) vs. only when a language-mismatch heuristic fires (cheaper, but a heuristic itself needs
design and could misfire); (b) which fields it covers (`title`/`desc`/`formLabel`/every
`formChoices` entry/`explanation` — NOT `translation`, already correct, and NOT any `{L}` field);
(c) whether it is `inflections`-specific or a shared helper other prompts could reuse if the SAME
pattern is ever found elsewhere (not yet checked against any other prompt in this file). Not
scoped further than this — no design decision has been made, and none is needed unless a future
session is asked to build it.

## ✅ FINDINGS THAT GOVERN THE OPEN SECTIONS BELOW

*The reconciliation layer over the two RESTORED sections, plus the one diagnosis a future session
would otherwise re-derive. These sit here, above `# 0.`, because they comment on it.*

**The release write-ups moved.** Nine of them accumulated in this position and are now in
**`# SHIPPED IN THE v80 LINE`** at the foot of this file, newest first. Nothing there is open; go
there for how something was built or why a guard is shaped the way it is.

### ⚠️ §C1's FIRST bug did NOT reproduce — and the near-miss is the finding

*"I browsed forward to the story card and back, solved no comprehension lesson, yet could proceed to
the next chapter."* **Not reproduced, and one plausible reproduction of it was an ARTEFACT I nearly
shipped a fix for.**

Two readings were tested and both died:

1. **`index.html:15493`** (`nextLessonIdx = -1` when the just-played lesson is the gated one) —
   its comment says the fall-through lands on the below-mark branch where Next greys out, and
   `v77_o` **deleted the greying**. That looked like a stranded gate. Measured: the below-mark
   branch catches it correctly and sends the learner back into the comprehension lesson. **No bug.**
2. **The done-flag write** is guarded by `_record = !(_lc.total > 0) || _lc.solved >= _lc.total`,
   where `_lc` is `lessonCoverage` — whose universe `v74_c` narrowed to SOURCE ITEMS, while
   `v71_s`'s rule is stated in QUESTIONS. **36 of the 102 gated lessons have an empty item
   universe**, so `!(total > 0)` is true and the flag is written however badly the round went. On
   12 of the 17 such chapters with a successor, a probe could answer everything wrong and walk to
   the next chapter.
   **That reproduction is an ARTEFACT.** All 39 empty-universe gated lessons are `error_hunt` /
   `ai_error_hunt`, never `comprehension` — and `startLesson` sets `C.isErrorHunt`, which the
   enclosing `if (!C._review && !C.isErrorHunt && !lesson._drill)` **excludes from the recording
   block entirely**. The probe reached the branch only because it built `APP.cur` by hand without
   that flag. **The fix was written, measured against the corpus, and then REVERTED** — for
   comprehension lessons both universes are populated, so switching to the question universe would
   have changed a working gate with no defect behind it.

**So the first bug is still open, and the next session should not re-derive these two.** What has
NOT been modelled is the user's actual sequence — *browsing* forward to the story card and back,
i.e. the summary / story-unlocked pages and the Back link, rather than playing a lesson. That is
where to look next.

### §0i — RECONCILED against `PLAN §C5/D1.` Four measured findings.

**Nothing below is deleted; each bullet is marked.**

- **~~"BLOCKED on §1 (the pass mark)"~~ — the citation DANGLES.** `§1` resolves to
  `roadmap_v75.md` §1 (*"The pass mark — needs the USER, not code"*). In THIS file `§1` is
  `useFullChain`, which is **shipped** — so a reader following the citation lands on a closed item
  and concludes the block is unblocked. **The pass-mark item was never carried into
  `roadmap_v80.md`**; it survived only in the handover's "Owed by the user" (`Churros` is 40 items
  where it was 83 questions). **The blocker is real and still owed by the user.** Cite it as
  "the pass mark, session prompt → Owed by the user", not as `§1`. **Since `v80_d` it lives in the
  session prompt's §9**, `HANDOVER.md` having been folded in and deleted.
- **Bullet 3 (a real re-generate function) — SHIPPED in the v45 line, but NOT what the bullet
  asks.** `POST /api/storyline/recreate-lessons` + `_runRecreateJob` exist, wired to the storyline
  bottom row and guarded (`unit-recreate-ui`, `e2e-recreate`). But it runs a FIXED recipe (vocab
  gate + reinforcement) or an explicit tick-list; **it never reads the chapter's existing lesson
  types**, which is precisely what "regenerates the EXISTING lesson types with the same settings"
  means. **Still open — and cheap:** the server already accepts an `addTypes` list, so this is
  deriving that list from `topic.lessons[].type` rather than new machinery.
- **Bullet 1 (align the two "add lessons" surfaces) — the misalignment is REAL and STRUCTURAL, and
  it runs the opposite way to the bullet's assumption.** The storyline picker and the
  book-generation arc share `ADD_LESSON_TYPES`, whose comment claims *"the two can never drift into
  offering different sets"* — **but the PER-CHAPTER dropdown is a third entry point and is
  hand-written markup** (`index.html` ~1144), covered by neither that claim nor
  `unit-add-lesson-registry` (which guards the SERVER registry). **The drift is not hypothetical:**
  `v78_j` added grammar+conjugation to the per-chapter menu, `v79_h` added `intro_script` to the
  registry — **drift in both directions, one release apart, and neither added a guard.**
  The two also encode one capability in two shapes: reinforcement is a TYPE (`review`) in the
  registry and an OPTION (`sial-vocab-mode`) per chapter.
- **Which way the alignment runs:** the per-chapter menu ALREADY has the per-type options the
  bullet asks for (difficulty, vocab mode, math instruction). **The storyline picker is the one
  lacking them**, along with the per-type count. So `§C5`'s Generation Card inherits this, and a
  cheap standing guard — the per-chapter `<select>` against `ADD_LESSON_TYPES` — would close the
  drift on its own.

### §0's other sub-sections — status against the plan

- **§0a rulings 1 / 2a / 2b / 3** — user rulings, all still standing, all shipped
  (`v77_l`, `v77_f`, `v77_o`, `v77_u` / `v78_k`). Keep as the record of WHY; nothing to reconcile.
- **§0b** — both halves DONE (`v77_b`, `v77_c`).
- **§0c** — the walk is complete. **⚠️ SUPERSEDED IN PART by plan §C2**, which removes the
  **next-chapter-unlocked card** (`v77_i`) from the flow. §0c BUILT that page; §C2 deletes it from
  the path. **✅ RESOLVED — the user ruled MERGE, shipped as `v80_e`**: the entry card is generalised
  to every chapter and the unlocked card is deleted, so one starter card serves both items. The
  reversal is closed; see the `v80_e` entry at the top of this roadmap. Still open in §0c and unmentioned by the plan:
  the summary page is reachable by ← but **is not forced before the first question** (an entry-path
  change the user has not seen — ask first).
- **§0d** — shipped (`v78_n`, `v77_l`); `comp-drill` confirmed alive (`v77_d`).
- **§0e ordering** — DROPPED by the user; `PROGRESSIVE STORY REVEAL` replaces it at LOW priority and
  **the plan does not mention it at all**, so it stays open here and is the only home for it.
- **§0e vocabulary panel** — cumulative half done (`v77_f`); ordering half dropped with the above.
  **Still open and unmentioned by the plan:** include vocabulary that was the question or the
  correct answer in **synonym and word_forms** lessons.
- **§0f** — shipped (`v77_v`). **§0g** — code shipped (`v77_t`); the **model-prompt change is still
  OWED BY THE USER** (needs a live model). **§0h** — question navigation, fully open, wants its own
  session; the plan does not cover it.



# 0. THE PROGRESS-CARD REWORK (user, at the v76 cut)

**Principle, in the user's words: THE STORY TEXT MUST BE THE FOCUS OF ATTENTION.** The lesson flow
exists so that the student ends up understanding the text. "Complete cards" are renamed **progress
cards** and become the spine that guides a learner through a story.

**Read `build_history/v77_card_gates.md` before touching the card** — the CORRECTED truth table
(32 rows, both gate families) and `probe_gates_v77.js` to re-run and diff.
**`v76_card_gates.md`'s TABLE is superseded and must not be built on**: four of its five findings
were artefacts of state its probe never seeded. That file is kept only for its corrected findings
and the settled coverage question.

## 0a. RULED — session 30 (user). These are decided; do not re-derive them.

All three were answered by the user at the end of session 30, after walking through each one against
the code. **Two of them delete shipped, tested behaviour.** Where a rule is superseded, delete it and
its assertions rather than layering a new rule on top — that layering is what §0a existed to prevent.

### Ruling 1 — `v74_l` is SUPERSEDED as a mechanism; its intent survives

> **User: "move the actions below the text as §0d already wants".**

`v74_l` (`index.html` ~14891) hides `comp-repeat`/`comp-drill`/`comp-crossword`/`comp-back` by id on
a genuine learner unlock and forces `comp-next` visible, so the story is not crowded by four routes
back into practice. **Keep that intent, drop that mechanism.** The story leads because the actions
move BELOW the text (§0d), not because buttons are taken away.

Consequences, all of them required together:

- **The hide-list goes.** With it go the three §0d conflicts it caused: Replay becomes ALWAYS
  available (a learner must be able to reach 100%), `comp-back` is freed for the §0c navigation
  spine, and `comp-next` stops being forced as the single route out.
- The premise `v74_l` was written on is gone anyway: once the card carries a third progress bar,
  cumulative vocabulary and back/next, it is no longer the "quiet card" the rule assumed.
- ~~Measured support: `v74_l`'s hide-list is **barely observable today**…~~ **WITHDRAWN `v77_e` —
  that measurement was wrong.** It came from the unseeded v76 table, where those buttons were
  already hidden for unrelated reasons. Re-measured by neutralising the hide-list and diffing the
  whole table: it changes **8 of 32 rows**, hiding **three otherwise-live buttons in each** (repeat,
  drill, crossword), on exactly the genuine learner unlocks. **The ruling stands — it was made on
  principle — but expect a bigger visible change than §0a assumed.**
- **Nuance not to lose:** the hide-list already keeps Repeat while coverage is short
  (`_coverageLeft`) and hides it only at 100%. So *"a learner must be able to reach 100%"* is
  already satisfied today; Repeat disappears only AT 100%, never on the way there. The case for
  moving the actions below the text stands on its own — the story should lead — but it is not
  rescuing a stranded learner.

### Ruling 2a — `v74_o` is SUPERSEDED (scope CONFIRMED by the user, session 31)

> **User, after the `v77_f` browser pass: "🎉 card only on finished stories."**
>
> **SETTLED — the shipped behaviour is correct, do not widen it.** `showComplete`'s terminal branch
> fires whenever there is nothing left in this chapter and no next chapter, which INCLUDES a learner
> who finished the LAST chapter while earlier ones are unplayed. That case is **not** a finished
> story and keeps `v74_o`'s hand-off. The gate is `_storyAllChaptersDone(slCtx)`, and both halves
> are asserted by clicking in `unit-story-finished`. **Do not "simplify" this to always show the
> card** — the narrower gate is the ruling, not an implementation detail.


> **User: "superseded — the story-finished card is the answer to the dead end".**

`v74_o` makes "nothing left to do" a TERMINAL state: Next is relabelled ↩ and hands the learner back
to the storyline (or home), reusing `APP._compBack` so the header and Next cannot disagree.

§0c makes that same state a WAYPOINT — the **story-finished card** (full story collapsible, complete
vocabulary learned, festive icon) is the next page in the walk. Under `v74_o` that card can never be
reached by pressing forward.

**The dead end `v74_o` fixed is real and must not come back.** It existed because `v71_h` greyed Next
here while `comp-back` was hidden — measured on the shipped "Paella und Chaos" with both chapters
complete: `comp-next` `disabled=true`, `comp-back` `display=none`. The story-finished card is a
better answer to that dead end than the hand-off, but only if it is actually reachable: **do not
delete `v74_o` until the story-finished card exists and Next reaches it.**

### Ruling 2b — below the pass mark, Next LEADS; the destination card is inert

> **User: "next could lead to the next card in the walk, but with no button active" → clarified:
> ALL of that card's action buttons inactive.**

This supersedes **`v71_d`**, not `v74_o` — worth stating plainly, because §0a originally attributed
the grey Next to `v74_o` and that was wrong: `v74_o` is the release that REMOVED greying from the
terminal branch. The surviving grey Next is `v71_d`'s `_belowThreshold` branch
(`_nextBlocked = true; compNext.disabled = true; compNext.classList.add('locked')`).

New behaviour: below the mark, **Next is active and moves to the next card in the walk**, and that
card renders with **all of its action buttons inactive** until the mark is met. The learner can read
ahead; they cannot act ahead.

`v71_d`'s principle is PRESERVED and in fact strengthened: Next never silently repurposes itself
into Repeat or Drill. It always means forward. What goes is the disabled button, not the rule behind
it. Inertness becomes a property of the CARD, not a lock on one button.

### Ruling 3 — article noise is accepted; take the high-recall matcher

> **User: "article noise was 'ok for now' still stands. we may later add a LLM call to judge which
> exact vocabulary is covered by lessons."**

So the mark means *"something from your vocabulary occurs here"*, not *"you have learned this
word"* — recall over precision. Take **whitespace splitting**: `+782` marks corpus-wide, 96 chapters
improved, 8 on the screenshot chapter — accepting that 4 of those are the article `la`. The clean
composed option (`+60`, 0 articles) is NOT chosen.

Two useful consequences:

- **No article table is needed at all.** Whitespace splitting needs no article set, so the
  corpus-derived `es: el, la` / `it: il, la, l'` / `ar: ال` work — and its two Italian false
  positives (`reti`, `per`) and the threshold tightening they wanted — is **not needed for this
  ruling**. That is squarely better under the standing design principle.
- **Keep "also mark articles" reversible.** The user's phrase is "ok for NOW", and the stated
  intention is to revisit with an LLM pass judging which vocabulary a lesson actually covers. Build
  the matcher so precision can be raised later without redoing the display.

**✅ SHIPPED `v77_u`** — 17 words across 13 chapters recovered. ~~**Not part of this ruling, ship regardless:** the apostrophe bug.~~ Vocab stores `l'evoluzione` with
ASCII `'` (U+0027), stories use `l’evoluzione` (U+2019), so even an exactly-present word never
matched — 15 `it`, 7 `en`, 4 `lb` chapters affected. That is a plain defect, not a judgement.

Inflection (`mutazione`/`mutazioni`) still misses under whitespace splitting; it is Tier 2 and stays
open.

### What these rulings cost in tests — read before starting

Eight test files touch the superseded rules: `smoke-render`, `unit-comprehension-gate`,
`unit-coverage-threshold`, `unit-drill`, `unit-lang-placeholder`, `unit-learner-nav`,
`unit-story-unlocked-card`, `unit-vocab-articles`.

**Several assert on SOURCE TEXT, not behaviour** — e.g. `unit-learner-nav` matches
`/_nextBlocked = true;/`, `/compNext\.disabled = true;/` and the literal `_endLbl` line against the
`showComplete` source. When the rework changes that code these fail as text mismatches. **Do not
re-pin them to the new text.** Replace each with an assertion about what the learner can DO — the
whole point of rulings 1, 2a and 2b is behavioural, and a source regex cannot express any of it.
`unit-story-unlocked-card`'s "Next-only for learners" line is `v74_l`'s and goes with it.

## 0b. Do this FIRST, before restructuring

**Make the 7 swallowing `catch(_) {}` blocks in `showComplete` visible** (564 lines, `index.html`
~14212–14776). A throw in any of them leaves the card half-rendered with the suite green. Session 29
lost real time to a bug that *looked* like a swallowed throw and was not. A counter the harness can
assert is zero, or a rethrow under a test flag, is enough. One small release, revert-verified, before
any of the work below.

**✅ DONE `v77_b`** — the 7 catches now report to a per-render ledger (`_cardErrors()`), with
`APP._cardStrict = true` rethrowing at the site. Default behaviour is unchanged: a throw is still
swallowed, it is merely no longer invisible. Measured across the whole corpus at the `v77_b` cut:
**1216 renders over all 304 topics swallowed ZERO errors**, so the catches hide nothing today — the
ledger is a net for the rework, not a bug-catcher for now. Guarded by `unit-card-errors`, which also
asserts no empty `catch` survives in `showComplete`.

**✅ DONE `v77_c` — the coverage key-space question is SETTLED: a seeding artefact, not a bug.**
`topicCoverage` reads ITEM keys (`v74_c`); the probe seeded QID keys; the two spaces are disjoint,
so 0 of 86 counted. `markSolved` writes both, and a learner driven through the real solve path
reaches 100% and unlocks in 4 rounds. Full measurement in `v76_card_gates.md`; guarded by
`unit-mixed-unlock-reachable`.

## 0c. The sequence (the big one)

Progress cards become an ordered walk, with back/next, over:

  **summary → chapter questions → story-unlocked → next-chapter-unlocked → story-finished**

**✅ WALK COMPLETE:** summary `v77_h` · chapter questions (existing progress card) · story-unlocked
`v77_j` · next-chapter-unlocked `v77_i` · story-finished `v77_f`. Every page exists and every link
is asserted by clicking. **What remains in §0c is the spine's REACH, not its pages** — see §0d for
the layout work, and note that the summary page is reachable by ← but is not yet forced before the
first question (a lesson-entry change the user has not seen).

**✅ The story-finished page SHIPPED in `v77_f`** — built first because ruling 2a forbids deleting
`v74_o` until it exists and Next reaches it, so the rest of the walk is downstream of it.
`finished-screen` / `showStoryFinished()` / `finBackToCard()`, guarded by `unit-story-finished`.
**✅ `v77_g` renamed the preview panel to `comp-story-panel`**, so the name `story-unlocked` is now
free for the real page. **Still to build: summary (the walk's FIRST page), story-unlocked,
next-chapter-unlocked**, and the
back/next spine connecting them. `comp-back` does not exist — the spine must be built (see below).

- ✅ **SHIPPED `v77_h`.** The **summary card is the FIRST page** in the back/next sequence, showing
  the story summary in the SOURCE language, with progress bars empty, before any question of that
  chapter. `summary-screen` / `showStorySummary()` / `sumForwardToCard()`, reached by `comp-prev`.
  **Note on scope:** it is reachable by ← FROM the progress card; it is not yet forced before the
  first question on lesson entry. That would change the lesson-entry path (`loadSaved`'s learner
  auto-start, v60) and is a UX change the user has not seen — **ask before doing it.**
- Back/next also walks **already-played chapters**, to revisit, replay, or complete vocabulary.
  Hint from the user: such buttons already exist in the teacher-only lesson-set view.
- A **"story finished"** card at the end: full story (collapsible), the complete vocabulary learned,
  and a festive icon.
- ~~**`comp-back` already exists and is hidden in all 32 measured rows.** Decide: revive or replace.~~
  **CORRECTED `v77_b`: `comp-back` DOES NOT EXIST** — 0 occurrences of `id="comp-back"` in both
  `index.html` and `docs/index.html`. It was deleted in `v71_k` (`#comp-hdr`, whose title is the
  route back, replaced it), and `unit-card-consistency` asserts its absence deliberately. The table
  showed it because **`lib-dom` auto-vivifies any id**, so the probe measured a phantom; `comp-story`
  is the same. **There is nothing to revive — the spine must be BUILT**, and reusing the id
  `comp-back` means updating that guard too.
- **`comp-story-unlocked` does not mean what its name says** (it is the preview label, shown while
  locked whenever canGenerate or teacher is on). Rename before adding a real unlocked card.
  **Note (`v77_b`): it is the whole bordered PANEL, not a label** — `comp-story-unlocked-lbl` is the
  caption inside it, and `comp-story-text` / `-spk` / `-xlate` are its children. The rename touches a
  container, so it is a slightly larger change than "rename the label".

## 0d. Layout and navigation

- Move progress bars, lesson icons and the replay/drill/crossword/next buttons **BELOW the text** on
  all progress cards. ~~(Check `comp-drill` first — grey or hidden in all 32 rows; possibly dead.)~~
  **CHECKED `v77_d`: `comp-drill` is ALIVE — keep it in the row.** It was grey in all 32 rows because
  the gate probe never wrote the wrong-answer ledger it reads; with mistakes recorded it goes LIVE,
  and `unit-card-consistency` has asserted exactly that since `v71_h`. Note it is `hidden` on the
  unlocked-learner row today — `v74_l`'s hide-list — so ruling 1 restores it there.
- ✅ **SHIPPED `v78_n`** — the ✕ returns to the progress card of the lesson being played.
- ✅ **MEASURED ALREADY TRUE (`v78_n`)** — `v71_h` always shows Replay and `repeatForCoverage` falls
  back to the current lesson when nothing is coverage-short, so 100% stays reachable. No code
  change; asserted in `unit-card-0d` §5 so it cannot regress silently.
- ✅ **SHIPPED `v78_n`** — one row per post-unlock lesson on every card of the chapter, labelled
  with the lesson's own title (no new ui.json key).

## §0e ordering — DROPPED by the user (session 32), replaced by a LOW-PRIORITY idea

**User: "forget about the ordering for now."** The measured re-plan below stands as the record of
WHY; the three options are withdrawn and no ruling is owed. `v77_f`'s deck-then-lesson order stays.

**Replacing it, at LOW priority and explicitly "needs more thinking" —
`PROGRESSIVE STORY REVEAL`:** *"at a later point we may show the story but just HIDE all non-learned
vocab and progressively reveal the story."*

Not scheduled. Recorded so it is not re-derived from scratch, with what is already known about it:

- **It inverts the highlight.** Today the matcher answers "which spans are known"; this needs the
  complement, "which spans are not", over the same offsets. `v78_h`'s `_storyWordSources` is the
  right input — it already carries per-word learned/not-learned — so this is a consumer of that
  collector, not a new matcher.
- **The measurement that killed ordering is the one to check first here too.** 83% of a learner's
  cumulative vocabulary does not occur in the chapter on screen; the question for reveal is the
  reverse — what fraction of a STORY's words are covered by ANY source. `v78_h` measured 1043 marks
  over 90 chapters, which is marks, not coverage. **Measure coverage as a share of story tokens
  before designing anything**: if a typical story is 10% covered, "hide everything not learned"
  hides the story, and the feature is a blank page rather than a reveal.
- **It is a reading feature, so the failure mode is severe.** A story panel that hides too much has
  no fallback the learner can reach — unlike a highlight, which is ignorable. Any design needs an
  escape (reveal-all toggle), and the read-aloud must be decided too: does TTS speak hidden words?
- Interacts with §0f/§0c (the auto read-out being moved) and with the finished card, which shows
  the whole story. **Do not design it before the auto-read move lands**, or the same page will be
  redesigned twice.

## §0e ordering + §3 highlighting — the measurement that produced the above

The roadmap said this pair "needs re-planning, not implementing", because the v75 plan was measured
twice and found wrong. Re-planned here against the current corpus. **Two of the v75 plan's premises
are now dead, one item is ready to build, and one needs a USER RULING.**

### What is already done, and was not when the plan was written

- **The apostrophe fix shipped** as `v77_u` (`_hlKey` folds U+0027/U+2019 and case on both sides).
  The v75 note listed it as "ships regardless, it is a defect not a judgement". It is done.
- **The article-set work is moot.** Session 30 ruled article noise ACCEPTED, so the corpus-derived
  `es/it/ar` article sets, the `reti`/`per` false positives and the threshold tightening are all
  unnecessary. `roadmap_v74.md`'s claim that `_articleStatsFor` already derives them was wrong, and
  it no longer matters that it was wrong.
- **A matcher already exists**: `_highlightVocabHtml` + `_hlKey`, with per-word boundaries applied
  only to spaced scripts (`v73_d`). Any "one shared matcher" is an EXTENSION of this, not a new one.

### ✅ SHIPPED as `v78_k` — §3's ruled half

`_highlightVocabHtml` matches a multi-token vocab entry only as a whole phrase. Measured just now:
`['la variazione genetica']` against a story containing exactly that phrase marks it, but a story
containing only `variazione` marks nothing. **Whitespace splitting is the ruled change** (`+782`
marks over 96 chapters, session 29's measurement) and it is still unshipped. Article noise is
accepted, so no filtering is needed. This is a self-contained release.

### DEAD PREMISE: "ordered as the words appear in the story" is undefined for most of the panel

The v75 note says story-ordering is "the same token-alignment problem, not a separate nicety", which
is why it was coupled to §3. **Measured against the corpus, that is true of a seventh of the data.**

Simulating the cumulative panel — every solved word across a storyline, matched against the chapter
story actually on screen, via the PRODUCT matcher, 612 entries over 12 multi-chapter storylines:

```
exact match in the shown story        82   13%
only a word-form / stem match         24    4%
absent entirely                      506   83%
```

Per storyline it is worse than the average suggests: `The Lion's Mischief` has **221 cumulative
words and 25 in the story**; `Nights in Cairo` has **0 of 23**. Sorting by story position would give
a 25-word ordered head and a 196-word arbitrary tail — or, for Cairo, change nothing at all.

**Why the plan and the data disagree: two releases made decisions that were never compared.** The
v75 ordering note assumed the panel showed the CHAPTER's vocabulary. `v77_f` then made it cumulative
across the deck (133 words vs 24, measured at the time). Each was right on its own; together they
make "order as they appear in the story" an instruction about 17% of the list.

**And word forms do not rescue it.** The v75 note's "greedy matching, to allow for word forms" is
worth exactly the 4% above (`preferenza`, `lezione`, `планина` — real, and a rounding error against
83% absent). Greedy stem matching is a genuine cost — it is the one part of this that risks marking
the wrong word — for four points.

### NEEDS A USER RULING before anything is built

The intent behind §0e's ordering half is sound: **connect the vocabulary panel to the story in front
of the learner.** Story-ORDER turns out to be a poor instrument for it. Three ways to serve the
intent, all using the SAME matcher (so the coupling to §3 survives, on better grounds):

**~~The three options below are WITHDRAWN — the user dropped ordering (see above). Kept only as the
record of what was measured.~~**

1. **Mark, do not reorder.** Keep the existing deck-then-lesson order and use the matcher to flag
   the panel words that occur in THIS chapter's story. Well-defined for 100% of the panel (each word
   either occurs or does not), reuses §3's matcher exactly, and the panel stops jumping around as
   the learner moves between chapters. **Recommended.**
2. **Two zones**: an ordered "in this chapter" head, then everything else in the current order.
   Delivers the v75 wording literally, at the cost of a panel that is 17% sorted and 83% not.
3. **Order by recency of solving**, ignoring the story. Well-defined for the whole panel and needs
   no matcher — but it abandons the story connection, which was the point.

Option 1 is what the measurement argues for; **the user should rule**, because "ordered as the words
appear in the story" is their sentence and the substitution is a product judgement, not a bug fix.

### Sequencing, once ruled

1. §3 whitespace splitting — ruled, measured, self-contained, no dependency on the above.
2. Extract the shared matcher to return MATCHES WITH OFFSETS rather than substituted HTML. Today
   `_highlightVocabHtml` does a regex replace and returns a string, so it can answer "mark this" but
   not "where, and in what order" — every option above needs the second answer. Highlighting then
   becomes a thin wrapper that wraps the offsets, which keeps §3's behaviour byte-identical and
   revert-verifiable.
3. The ruled §0e behaviour, on top of that matcher.
4. **The Replay ordering fix rides here** (session-32 batch): pick the LEAST-COVERED counted lesson
   rather than the first coverage-short one. It touches the same card. Independent of the ruling.

### Traps carried forward

- **`probe_gates_v77.js` must be re-run and diffed** after any change to the progress cards, against
  `v77_card_gates.md` (**not** `v76_card_gates.md`, which is superseded).
- **One matcher, not two.** `v77_f`'s finished card deliberately did NOT order, precisely so it
  would not disagree with a matcher that did not exist yet. Whatever ships must serve both that card
  and the progress-card panel, or the two will disagree about the same story.
- `_cardErrors()` empty after any card render, and `_cardHeader(prefix)` + `.card-screen` on any new
  card page.

## 0e. Vocabulary on progress cards — ⚠️ LARGELY SUPERSEDED by TRACK T

> TRACK T puts the highlighted chapter TEXT on every progress card, which subsumes a separate
> vocabulary panel. The still-open half below (include words that were the question or the correct
> answer in synonym and word_forms lessons) becomes a question about **which words get highlighted**,
> not about a panel. Read it that way; do not build the panel.

- **Cumulative per lesson-set**: every word the learner has already solved correctly, not just the
  current lesson's. **User screenshot 2 shows the panel EMPTY** on a comprehension card, because a
  comprehension lesson has no vocab of its own — so today the panel is blank on exactly the cards
  where the story is the focus. This is not polish; it is a blank panel.
- Ideally ordered as the words appear in the story (greedy matching, to allow for word forms).
  **Do this as part of §3, sharing one matcher** — it is the same token-alignment problem, not a
  separate nicety. **`v77_f` deliberately did NOT attempt it** on the story-finished card: ordering
  there before §3 exists would guarantee the two disagree. That card lists every solved item across
  the story in deck-then-lesson order (133 words vs 24 for a single chapter, measured), which is the
  cumulative half of this item done; the ORDERING half is still open.
- Include vocabulary that was the question or the correct answer in **synonym and word_forms**
  lessons.

## 0f. Story read-out — ✅ SHIPPED `v77_v`

~~**Auto-start a read-out of the story chapter when it is unlocked and shown on the progress card**
(unless muted).~~ Done; `_autoReadStory`, guarded by `unit-story-autoread`. Cheap now, and only because of `v75_h`: the old flat 4-second advance net would have
cut a story chapter to ribbons. Watch for cancel-races with the card's other speech — `v75_h` made
`cancel()` conditional, and that must not be undone here.

## 0g. Comprehension flow

- ✅ **SHIPPED `v77_t`.** ~~A wrong answer currently returns to the card; Replay then replays only
  the normal lessons.~~ Next is green and active (`v77_o`) and now **restarts that lesson** while
  questions remain; the repeat **asks only the questions not yet answered correctly**. Guarded by
  `unit-comprehension-repeat`, both halves revert-verified.
- **Still OPEN, needs the user:** the model prompt change below.
- Model prompt change (user, needs a live model — OWED BY THE USER): explanations must NOT quote
  story sentences literally; keep the explanation in the SOURCE language; if a quote is required,
  translate it; and additionally report the exact underlying quote in the TARGET language. Read out
  the explanation for CORRECT answers too — both the source-language explanation and the
  target-language quote.

## ✅ 0h. Question navigation — **SHIPPED at `v80_p`**

> `C.ans` ledger + `check(replay)` + `qPrev()`. The lock is per-run by construction. See the
> `v80_p` entry. Original scope note kept:

Back/next on the QUESTION cards. Already-made choices are shown (right or wrong) and cannot be
reverted, but the lock lasts only for that question set: replaying via the progress card makes them
playable again.

This is not a card change — it is a question-runner change (`C.cur`, `check()`, per-run answer
state) and it interacts with `_speakAndAdvance`, which today advances in one direction only. Scope
it separately.

---

# 0i. LESSON GENERATION REWORK (user, at the v76 cut) — BLOCKED on §1

- Align the teacher-only "add lessons" button on the lesson-set/chapter page with the storyline-level
  bulk "add lessons" selection menu. Per-type options on the right of each lesson type (math: LLM
  prompt; vocab: extend/neutral/reinforce), possibly including the difficulty selector, plus a
  per-type **count** defaulting to 1 (e.g. 2 vocab, 1 synonym, 1 comprehension).
  **MERGE HERE: the recovered "Global QC checkbox menu" item** — same menu, and it also wants the
  book's automatic QC made opt-in from the lesson-type menu and run AFTER the storyboard pass.
  That reverses the `v68.1` ordering decision.
- **PERHAPS: remove extend/neutral/reinforce entirely** and make "extend" the standard: whenever a
  lesson is generated it uses words of the chapter NOT YET covered by previous lessons up to this
  chapter. Aim to cover a story's vocabulary as completely as possible, focused on specific/rarer
  words. Re-inject unsolved items from previous sections outside the model, the way the lesson flow
  already reduces to unsolved.
  **BLOCKED on §1 (the pass mark).** This moves the denominator; settling the target afterwards
  means both moved at once and neither measurement is interpretable.
- Add a real **re-generate lessons** function on the storyline page, beside "add lessons", that
  regenerates the EXISTING lesson types with the same settings but new prompts and models — so older
  storylines can get better lessons.

---

---

### 0. ~~the forked-storyline display~~ — SHIPPED as `v79_k` (session 34), ONE PART STILL OPEN

**Three of the four parts shipped; see the shipped table for `v79_k`.** The fourth — "shared
chapters count the same way for every fork" — **needed no code and was measured to be already
true**: completion is keyed by topic NAME and is storyline-agnostic, so a chapter both forks *list*
already moves both decks identically. `unit-fork-display` §6 pins that (and revert-verify confirms
it passes on the pre-change code, so it is a pin, not a fix).

**⚠️ STILL OPEN — needs a user ruling, the question raised at the end of session 34.** Where a fork
is ASYMMETRIC the intent is still unmet, and it is a DATA question rather than a rendering one. At
this cut: `sl_1041030875` ("Dough of the Ancients") lists exactly one chapter, "Grandpas Dough
Talk", which continues from "pizza dough" — a chapter that storyline does not contain. So from that
side there is no fork parent to branch from, no shared prefix on screen, and playing "pizza dough"
moves the *other* deck (`sl_182891979`) from 0/2 to 1/2 while this one stays at 0/1. **The choice:
add the shared ancestor(s) to the storyline's `chapters[]`, or have the display reach back across
the `continuedFromId` link without changing the data.** Do not pick one without asking.

**Also found while measuring, and separate from all of the above:** `_slProgressStats` computes
`unlockedChapters = doneChapters + (doneChapters < total ? 1 : 0)`, so **every single-chapter
storyline reads 1/1 and a 100% bar before anything is played** (`sl_1041030875` does today). That
is the `v77_p` "the chapter in progress counts" rule meeting a one-chapter deck. Not touched — it
is not a fork bug and changing a headline number wants its own ruling.

**The original item, kept for the record.** Four parts, all on the storyline screen:

- the forked storyline is shown **completely** — every chapter, not the truncated stub — and all of
  it greyed out as it is today;
- clicking **any** greyed chapter opens that alternative storyline, so the learner can switch
  between forks from either side;
- **shared chapters count the same way for every fork** — a chapter both forks contain must not be
  progress on one and nothing on the other;
- the `⑂A/B/C` marker becomes **nothing** for the currently open storyline and the **storyline
  TITLE** for the others, and the node itself is clickable.

It lands on the surface `probe_gates_v77.js` measures. **Re-run it AND diff against
`v77_card_gates.md`** — running it without diffing proves nothing (`v76_card_gates.md`'s table is
superseded). The progress-counting part is the risky half: it is shared state between forks, so
check what `_counts` and the gate probe say before and after, not just what the screen looks like.

### 0b. POSTPONED by the user (session 33): import "new" mode — a possible FUTURE feature

Was on the session-33 bug list, deliberately deferred: *"import lessons as json: we currently have
merge and overwrite options; add a third option 'new' that re-assigns IDs to the imported stories
and chapters, such that it doesn't overwrite existing stories."*

Kept here rather than dropped, with the reason it is a session and not an afternoon: an id
re-assignment has to rewrite `continuedFromId`, the storylines' `chapters` arrays and the fork links
**consistently in one pass**. Get any one of the three wrong and the import succeeds while producing
broken chains rather than fresh stories — a silent failure of the worst kind, because the damage is
in data the user then keeps. **Do not start it without raising it with me first.**

### 1. ~~`useFullChain` does not do what its label says~~ — RULED and SHIPPED as `v79_b`

**User ruling, session 33: make the label TRUE.** Shipped — see the shipped table for the full
entry, `v79_session33_notes.md` for the measurements and how the guard was built. The label and
tooltip were left untouched because they became true; the console lines now say `Story context:` for
the story prompt and `Lesson context:` for the lesson chain.

**What the item said, kept because two of its claims turned out to be worth carrying:**

The main-page checkbox reads *"Pass the full storyline as context — better continuity, slower
generation"*, and the request field is `useFullChain`. **It controlled neither.** In `generate()` it
chose only between the PARENT CHAPTER'S story in full and its last `OLLAMA_MAX_PREV_STORY`
characters. So `Continuing from: "…" (using full chars)` in the console meant **the whole of ONE
chapter**, not the chain, while the separate chain-wide line fed LESSON generation only.

Two things the item did NOT say, both measured at the ruling and both load-bearing:

- **For 128 of 236 corpus continuations (54%) the box changed nothing at all** — the parent chapter
  is shorter than the 800-char tail, so "full" and "last 800" are the same string. The defect was
  therefore invisible on more than half the corpus, which is why it took a user report.
- **The story call passed no `ctxTokens`**, so Ollama used its ~4096 default. The single parent
  never approaches it; the chain crosses it at p90. "Small in code" was wrong: sizing `num_ctx` and
  the timeout is part of the change, not a follow-up (rule v71_t), and the chain's own budget has to
  be derived from the context ceiling so the trim happens where chapter boundaries are known.

### 2. ~~One chapter's vocabulary is in the wrong script~~ — WITHDRAWN, it is a `reinforce` artefact

Corrected by the user at the cut. `tp_17863746762340000193` has a Cyrillic story and a Latin
vocabulary lesson, and that lesson's `_genMeta` carries `_arcMode: "reinforce"` — the mode that
re-trains vocabulary from EARLIER chapters, which were Latin because the user was deliberately
switching this storyline to Cyrillic. **Working as designed; nothing to regenerate.** The plain
lesson in the same chapter, from the same builder minutes earlier, is correct Cyrillic.
`unit-script-choice` lists the id as EXPECTED, not known-bad. See the planned rework below.

### 2. PLANNED REWORK — remove `reinforce` / `neutral` / `extend` (user, v79 cut)

**The user intends to remove the arc-mode option entirely.** Recorded here because it is now load
-bearing for two other things, and because a removal is the moment to decide what replaces it rather
than what it did.

**What it does today.** `_arcMode` on a generated lesson is one of `reinforce` (re-train vocabulary
from EARLIER chapters), `neutral`, or `extend`. It is the mechanism behind the arc "review" lessons
and is stamped into `_genMeta`.

**What it explains.** The mixed-script chapter found at the v79 cut
(`tp_17863746762340000193` — Cyrillic story, Latin vocabulary) is a `reinforce` lesson faithfully
reproducing vocabulary from the storyline's earlier LATIN chapters, while the user was deliberately
switching that storyline to Cyrillic. **Not a defect** — but it shows the mode has no notion of a
storyline changing script mid-chain, and no notion of transliterating what it re-teaches. Anything
that replaces it will meet the same question.

**Why the removal interacts with work already queued:**
- **The per-text learning scheme** (see "NEEDS DESIGN") is the natural replacement, and the user
  framed it that way: *"we probably already have a TODO on this (around extend/reinforce
  redefinition)"*. **Do not remove the modes first and design the replacement after** — `reinforce`
  is currently the only thing aiming lesson generation at anything other than the current chapter,
  and the coverage measurement (9.2% of story tokens) says aiming is the whole problem.
- **`unit-script-choice`'s `EXPECTED_MIXED` entry exists only because `reinforce` exists.** It
  should be deleted in the same change, and that guard's "the generator was never told which script
  to use" message re-read — with `reinforce` gone, a mixed chapter really would mean that again.
- **`v79_a`'s script pin on lesson prompts** was justified by evidence that turned out to be a
  `reinforce` artefact (see the shipped table). It is retained on `v76_h`'s original reasoning, but
  its interaction with `reinforce` is genuinely open: a pinned prompt tells the model to write
  everything in Cyrillic while `reinforce` hands it Latin vocabulary to re-teach. **For a
  script-switching storyline transliteration is probably what the learner wants; for every other
  storyline the two never disagree.** Nobody has measured which the model actually does. If the
  modes are removed this question disappears with them, which is a reason to sequence the removal
  before touching the pin again.

**Open, for the user:** what replaces `reinforce`'s one useful property — that some lessons
deliberately revisit earlier material. The per-text scheme's difficulty ranking could subsume it
(revisit = an easier band), but that is a design choice, not a consequence.

### 2z. RULING (user, at the v80 cut) — language x lesson-type applicability is MODEL-DECLARED

**Decided.** Whether a lesson type makes sense in a language (conjugation for Chinese, cases for
Italian, articles for Serbian) is **not a table the app ships**. The model declares it, the answer is
**cached in `languages.json` with `_genMeta`-style provenance**, and it is **ternary plus a note** —
`yes` / `no` / `different-mechanism` — never boolean. A **human override wins and is marked as such**.
Asked once, not per generation.

**The reason, kept because it is the argument and not just the outcome:** the original request
offered `ova/ovo` vs `taj/ta/to` as Serbian articles. Serbian has no articles — those are
demonstratives, and definiteness in Serbian surfaces through **adjective aspect** (`star`/`stari`),
a different mechanism on a different word class. The cell is neither true nor false, and the note is
more useful to the generator than the boolean would be. A boolean is wrong on its first interesting
cell.

This keeps the knowledge in the tier `INTERNALS.md` §4 assigns it to: the cache is a MEASUREMENT,
not an authored language claim — which is what distinguishes it from the `cyrillic-sr` sounds column
that was authored, verified and **reverted**, and whose absence `unit-intro-script` still guards.

**Guard:** a source sweep that fails when a lesson type has no applicability policy, mirroring
`unit-script-pin-coverage` (rule 32 — guard the enumeration). **Scope:** decides only whether a
lesson is OFFERED; lesson quality stays QC's problem. Full design in
`PLAN §9b/D1.`

### 2x. TWO BUGS DIAGNOSED AT THE v80 DROP — not yet fixed

**(a) A new book NEVER gets a generated storyline title.** The `v78_r` guard at `server.js:5348` —
*generate only when there is none* — is correct and is a user ruling. But the storyline record is
created earlier in the same flow at `server.js:5207`/`5215` with
`upsertStoryline({ id: slId, title: chain[0], … })`, and `chain[0]` is the FIRST CHAPTER'S TOPIC
NAME. **So a title always exists by the time the guard looks and the `generateStorylineTitle` branch
is unreachable.** Reported as `Storyline title: keeping existing "ein eichhoernchen trifft ein
murmeltier — 1"`. **Do not weaken the guard** — it exists because regenerating from the new chapters
alone replaced a whole-story title with one about its tail. Mark the placeholder instead
(`titleAuto: true`, cleared on generation or user edit). **Checked: `summary` is NOT seeded, so the
summary guard works and this is title-only.** Guard BOTH halves or `v78_r` re-opens: a new book gets
a title that is not its first chapter's name, AND an existing storyline gaining a chapter keeps its
title. Full write-up: `PLAN §9c.`

**(b) The vocab article asymmetry is a COIN FLIP, and the prompt contradicts itself.** `prompts.json`
`vocab.system` says `BASE FORM ONLY … (with the usual article where the language uses one)` — PER
SIDE, appealing to each language's citation convention — and three bullets later `ARTICLE SYMMETRY …
BOTH sides or NEITHER` — CROSS SIDE. German cites `der Hund`, French cites bare `chien`, so a model
obeying the first rule produces exactly the reported defect, and the first rule is stated first and
framed as definitional. **Measured on the v80 drop:** `tp_17869977371640000022` **7 of 8**
asymmetric, `tp_17869980065780000104` **0 of 8** — same model, same `_genMeta.type`, `rejected: 0`,
four minutes apart. **A self-contradicting instruction does not bias output, it makes it UNSTABLE**,
which is why it "seems to have got worse" and why **one lesson can never validate a fix**. Fix by
REMOVING the contradicting clause plus a worked counter-example (rule 31 — adding another
prohibition is what made it worse, the `v79_i` failure repeated), then measure a RATE per
`_genMeta.at` cohort. Full write-up: `PLAN §F3/`§F3c.

### 2y. THREE MORE RULINGS (user, at the v80 cut)

**(a) Observations log scope: BOTH — keyed by a stable LOCAL id that an account can later ADOPT.**
Unblocks `PLAN §8/B1`, which was waiting only on this. **Adoption is a LINK, not a
rename:** an account accumulates a SET of local ids (one per browser/device), and an observation's
identity key stays the local id permanently, with `userId` as a resolved attribute. Re-keying to a
`userId` would make a second device un-adoptable. Payment and accounts themselves remain open.

**(b) Uploaded images: STORED SERVER-SIDE.** **They must NOT go into `lessons.json`** — it is a
single file every test parses and `build-static.js` bakes wholesale; base64 pages would multiply it.
Store as files, reference by path. **`build-static.js` then needs a decision it does not have:**
static export either omits images (image-derived chapters degrade to text-only, said so in the UI)
or copies assets and rewrites paths. Retention also sharpens the licence question in §3 below — from
"may we display this" to "may we host it".

**(c) Duplicate storyline titles: SUPERSEDED — the user RENAMED one to "Dough of the Ancients 2".**
The original ruling was "keep both identical", which would have broken the `v79_k` fork marker for
that pair (both sides rendering the same `icon + title`, so each link named the storyline the
learner was already in). **The rename fixes it at the source and is the better answer.** The
enumeration guard — for every fork, the marker must be distinguishable from the open storyline's own
label — is still worth having but is now **PREVENTIVE**: nothing in the data enforces unique titles.
`unit-fork-display` already sweeps forks. **The tree still holds the old titles; the next data drop
brings the rename.** Original ruling text, superseded, kept for the reason: Both `Dough of the Ancients` storylines keep the same title
AND icon. **This breaks the `v79_k` fork marker**, which renders the other storyline's `icon + title`
so the learner knows where a greyed branch leads — with both identical, each side's link names the
storyline the learner is already in, which is worse than the `⑂A/B/C` letters it replaced. **So the
display must tolerate duplicates:** fall back to the branch's first differing chapter name when the
labels collide. **Guard as an enumeration, not as this pair** (rule 32): for EVERY fork in the
corpus, the marker must be distinguishable from the open storyline's own label —
`unit-fork-display` already sweeps forks and can carry it. Half a session.

### 3. Owed by the user

- ~~Regenerate the lesson in item 2~~ — withdrawn, see above.
- `sl` is fully translated (617 keys) and `languages.json` is complete at 1089/1089 cells — nothing
  outstanding there.
- ~~The `cyrillic-sr` sounds column for the `latin` letter table~~ — **WITHDRAWN, and it was never
  owed.** The absence ENFORCES a `v75_g` ruling pinned in `unit-intro-script`: *"a Serbian reader
  must NOT be offered a Latin course: they already read it"*, Serbian Latin being co-official. A
  column was authored and mechanically verified at this cut (26 respellings, zero non-Serbian
  characters) and then **reverted** — adding it would have silently reversed that ruling, and the
  guard caught it. **If the ruling is ever reopened, `unit-intro-script`'s assertion changes first
  and the table is already written up in the session-32 notes.**
- The per-text learning scheme discussion. **Its prerequisite measurement is DONE** — see "THE
  COVERAGE MEASUREMENT".

## USER TESTING NOTES — session 32, second batch (screenshots) — TRIAGED

### ✅ Done in `v78_i`

- **Chapter auto-read REMOVED from the progress card, and added nowhere else.** *"This supercedes
  previous instructions on putting it somewhere else."* §0f (`v77_v`) and the brief re-scoping to
  "the card before comprehension lessons" are both **withdrawn**. `_autoReadStory` is KEPT — the
  story is still readable from the speaker control, and the helper carries the four restraints
  (muted, review renders, once per chapter, never interrupting) that a future caller would otherwise
  rediscover. **`unit-story-autoread` now asserts it has NO CALL SITE**, so the ruling is a property
  of the product rather than a fact about one commit; a next session reading three releases of
  discussion about where to put it will fail the suite instead of putting it back.
- **Conjugation: multiple choice strongly preferred over typing.** Typing is now a FALLBACK for
  forms that cannot be asked as an MCQ, not a second question layered on the same form. **This also
  fixed a real defect the new corpus exposed:** `mcq_conjugation` and `type_conjugation` share ONE
  qid (`infinitive|pronoun`), so emitting both put two exercises with one identity into a round.
- **Conjugation solution shows the WHOLE phrase** — `vi ste`, not `ste`
  (`tp_17862850223960000178`, screenshot). The read-out had combined pronoun and form since it was
  written, so the app SAID the full phrase while SHOWING half of it; the reveal now uses the same
  composition, so the two cannot disagree.

### ✅ Done in `v78_j` — the three small specified items

- **Restore the FULL lesson suite to the single-chapter "add lesson" menu**
  (`Screenshot_2026-08-10_00-58-41.png`). Grammar and conjugation were hidden from this
  single-chapter version and should come back; the screenshot shows Vokabeln, Synonyme/Antonyme,
  Wortformen, Fehlerjagen, Verständnis, Mathematik, Mischübung, Schrift lernen — **missing Grammatik
  and Konjugation**. Find the menu's type list and the gate that trims it; check whether the
  omission is a hard-coded list or a capability gate (the script entry is gated by
  `scriptLessonAvailableForSet`, so at least one is real). **No new i18n** — both types already have
  registry entries and labels.
- **`translate-ui.js`: `--threads` and `--batch` on the command line.** Threads may already exist as
  an env var; batch size is the hard-coded 10-per-batch. Goal stated by the user: **integrate
  completely new languages more efficiently.** Cheap, and `unit-langnames` already drives the real
  mode with a stubbed backend, so it is testable headlessly.
- **Add Slovenian (`sl`).** `languages.json` entry + `_langScript` mapping (latin) + a `names` cell
  in all 32 languages. **Check `unit-intro-script`'s "every language is mapped in `_langScript`"
  assertion** — an unmapped code reads as "no script", which wrongly makes a Latin course look
  teachable to its speakers (v53). The `--langnames` run that just completed filled 1024/1024 cells;
  adding a language makes it 33×33 and reopens 65 of them.

### THE COVERAGE MEASUREMENT — done, session 32. Read this before designing anything.

The roadmap has said for three sections that this number comes first. It is measured now, through
the PRODUCT matcher (`_highlightVocabHtml` + `_storyWordSources`, never a re-implementation), over
**120 corpus chapters with a story**, and it reframes the request.

**How much of a chapter's story do its lessons teach today?**

```
TOKEN coverage (running words)  :  9.2%   (1946 of 21048)
TYPE  coverage (distinct words) :  8.2%   (1127 of 13764)

per-chapter TYPE coverage   min 0%   p25 5.3%   median 13.2%   p75 19.2%   max 48.6%
chapters below 25%: 108 of 120        chapters above 50%: 0
```

**So it is a GENERATION problem, not a gap-filling problem** — decisively, and that was the question
the number was for. A learner who has solved every lesson in a chapter can read roughly one word in
eleven of its story. "Exhaust the vocabulary of the input text" is not a matter of topping up the
last few items; the current corpus is an order of magnitude away.

**And the second cut changes the design, not just the scale.** Splitting the story's word types by
CORPUS FREQUENCY per language (statistics, not a word list — INTERNALS §4):

```
top-100 most frequent types    350 / 3878  =  9.0% covered
top-500                        466 / 3821  = 12.2% covered
rare (everything else)         311 / 6065  =  5.1% covered
```

**The RAREST words are the LEAST covered** — the exact opposite of the user's "start with the
hard/unusual words". The generator today skews slightly toward the common ones. So the request is a
change of POLICY, not only of volume: even at ten times the output, a generator that keeps picking
by whatever it currently picks by would still leave the hard words last.

**What this settles, and what it does not:**
- **Settled:** the per-text scheme needs generation aimed at the text, and it needs a difficulty
  ordering to aim with. Both are the user's own framing, and the data supports both.
- **Settled:** "if it's a simple short text, go towards the basic words as well" is not a separate
  mode — at 9% coverage of the top-100 band, the basic words are not covered either.
- **NOT settled, and the next thing to measure:** how much of the gap is *reachable*. A story
  contains proper nouns, numbers and inflected forms of words the lessons DO teach; the matcher
  counts an inflection as uncovered unless a `word_forms` lesson happens to list it. **Before
  sizing any generator, measure what share of the uncovered types are inflections of covered
  lemmas** — that is the difference between "generate ten times as much" and "teach the forms of
  what is already taught", and `v78_h`'s tier-2 note (corpus inflections from `word_forms` /
  `grammar.plural`) is the machinery that would answer it.
- **Caveat on the method, stated so it is not over-read:** "covered" here means the word appears in
  some lesson of that chapter, which is a strict reading — a learner also carries vocabulary from
  earlier chapters. The cumulative figure is worse in the other direction (83% of a learner's
  cumulative vocabulary does not occur in the chapter on screen — see the §0e re-plan), so the two
  measurements bracket the real answer rather than agreeing on it. Neither is above 20%.

### → NEEDS DESIGN, and the user wants it discussed before it is built

**"DEVELOP A LEARNING SCHEME FOR EACH TEXT, where lessons are focussed on teaching the text."**
The user's framing, recorded close to verbatim because the shape matters more than any summary:

- Adding vocab lessons to a chapter should **exhaust the vocabulary of the input text** — the model
  should use vocab **not already covered by existing lessons**, ideally covering all non-basic
  vocabulary, and for a simple/short text (e.g. children's) going down to the basic words too.
- In the long run: **a full word-by-word dissection of the text**, with lessons presented
  semi-randomly around that dissection. **Start with the hard/unusual words**; the learner can
  indicate — or the app can detect — whether they understand the text sufficiently or need more
  basic lessons first.
- **Dynamic difficulty**: start mid-level; too hard → easier vocab; too easy → more specific/harder.
  Guided by the learner's history.
- **No short-cuts to the source-language interpretation.** The learner MUST prove vocabulary
  understanding first. (This is a hard constraint on the UI, not a preference — it rules out
  "reveal translation" affordances on the path being designed.)
- For a language pair, **draw on OTHER existing stories** for the dynamic quizzing, or suggest
  solving a simpler storyline first. **This needs both stories and individual questions ranked by
  difficulty.**

**Related existing item: the `extend` / `reinforce` redefinition.** The user is right that there is
already a TODO in that area — this supersedes and enlarges it. `reinforce` currently means "reuse
prior chapters' vocabulary"; the request above makes the real axis **coverage of THIS text**, which
is a different quantity and measurable today.

**The first measurement is DONE — see "THE COVERAGE MEASUREMENT" above: 9.2% of tokens, 8.2% of
types, rarest words least covered. It is a GENERATION problem, and a policy change as well as a
volume one.** The original framing of that question is kept below because the distinction it draws
is the one that mattered: **what fraction of a chapter's story tokens are already covered by its
lessons?** `v78_h` built
exactly the collector for it — `_storyWordSources` returns every word every source teaches — but
`v78_h` measured MARKS, not COVERAGE. Marks count occurrences; coverage is the share of the text a
learner could actually read. **Do that measurement first**: if a typical chapter covers 15% of its
story, "exhaust the vocabulary" is a generation problem; if it covers 70%, it is a gap-filling
problem, and those are different products. The same number is the prerequisite for the progressive
reveal idea below, so it is owed twice over.

## USER TESTING NOTES — session 32 batch, TRIAGED AND SCHEDULED

Five notes. Triaged with the code loaded, and **placed in the existing plan rather than queued as a
flat list** — two belong to sections that already exist, one is a decision rather than a defect, and
one was fixed on the spot.

### ✅ Fixed immediately — `v78_c`

- **`--langnames` crash: `Fatal: issues.some is not a function`.** Full note in the shipped table.
  **Invisible until a name is actually REJECTED** — on the happy path `issues` is empty and
  `[].some(fn)` never invokes `fn`. The 119 missing cells the run reported are unaffected: the crash
  was in the writer, not the survey.

### ✅ §7 — script lessons for a DIGRAPHIC SOURCE — `sl_56647998` — SHIPPED as `v78_g`

**User: "I generated a serbian-latin → serbian-cyrillic storyline but I can't add script lessons to
it. Script lessons would obviously fit such a script-focussed lesson."** Correct, and the cause is
exact — now with the reproduction case in the corpus (`tp_17862984310970000000`: `lang sr`,
`script cyrillic-sr`, `srcLang sr`, `srcScript latin`, both stamped by the v76_i picker).

`needsIntroScript(target, src)` computes the learner's readable scripts as
**`scriptsForLang(srcLang)` — every script the source LANGUAGE admits**. For `sr → sr` that is
`["cyrillic-sr","latin"]` on *both* sides, so `tgt.some(s => !src.has(s))` is **false** and the gate
concludes the learner already reads everything. `buildArcIntroLessons` skips every script for the
same reason (`srcScripts.has(scr) → continue`).

**The gate encodes "which scripts can this language be written in", where the question is "which
script is THIS chapter's source actually written in".** Since `v76_g`/`v76_h` that is a stored
per-topic fact: **`srcScript`**. The fix reads the chosen script when there is one —
`srcScript ? [srcScript] : scriptsForLang(srcLang)` — the same one-line shape in both functions.

Notes for whoever takes it:
- **The bug only bites when the SOURCE language is digraphic**, i.e. exactly the languages in
  `scripts.json` `_scriptChoice` (`["sr"]` today). `sr→en`, `ar→en` etc. are unaffected — which is
  why it survived: the corpus had no digraphic-source chapter until the user made one.
- **`index.html` carries its OWN `needsIntroScript`/`scriptTeachable` (≈1762/1894) — DoD item 5,
  data parity.** Fix both and assert parity, or the menu and the generator disagree about whether
  the option exists at all.
- Callers must pass the script through: `index.html:2540` and `:5033` gate the arc-script checkbox
  off `APP.lang`/`APP.srcLang` only; the v76_i picker already holds the chosen scripts.
- **Re-check `scriptTeachable` at the same time.** Once the source set narrows to ONE script its
  `soundsFor` test is being asked a sharper question than before — confirm the sr→sr direction is
  teachable in both directions rather than assuming it.
- Its own release. The gate itself is headless; only the end-to-end needs a live model.

### ✅ SHIPPED as `v78_l` — Replay's target ordering (NOT a conflict, an ORDER bug)

**User: "the replay button plays only comprehension lessons after a lesson is complete… preferably
those that haven't been seen before. Is this request in conflict with the definition of this
button?"**

**Answered: no. The definition is fine and the ORDER is wrong.** Replay is `repeatForCoverage`,
whose defined job is to raise COVERAGE. A lesson at 100% has nothing unsolved, so replaying it
raises nothing and it is correctly skipped. **An unplayed lesson is not at 100% — it is at zero**,
so "prefer ones not yet seen" is not a competing rule, it is the *strongest case* of the rule
already there.

What actually goes wrong: `_firstCoverageShortLessonIdx` returns the **first coverage-short lesson
in document order**, not the least covered. A comprehension lesson sits early and, since `v77_t`
narrows a repeat to the questions still unanswered, stays short for a long time — so it wins that
scan every time and later unplayed lessons are never reached.

Fix shape: choose the **least-covered** counted lesson (unplayed = 0% sorts first) rather than the
first short one. Keeps the button's meaning intact, no ruling needed. **Schedule with §0e/§3**,
which already owns the same card; re-run and diff `probe_gates_v77.js` after it.

### → §0c — auto read-out: RULED (user, session 32), but HELD for a screenshot

**User: "move auto-read from the progress card when the story unlocks to the card that is shown
before comprehension lessons. No other place. But the mute button should work on it."**

The read-out does not go on the finished card at all; it **moves**, and the current §0f call site is
**removed in the same change** — "no other place" is part of the ruling, not a side effect.

**HELD: do not implement yet.** The user will send a screenshot pinning which card is meant. "The
card shown before comprehension lessons" is ambiguous in the current walk — the summary card
(`v77_h`), the story-unlocked card (`v77_j`) and the progress card can all precede a comprehension
lesson, and `v77_j` exists *because* the story-unlock moment was given its own page. Guessing would
move the feature to the wrong screen and delete the working call site on the way.

When it is built:
- **Mute must work on it** — a REAL change, not a restatement of §0f's first restraint. §0f only
  checks `APP.muted` at fire time and then goes straight to `_doSpeakLang`, deliberately bypassing
  `speakBodyText` (which force-unmutes on a tap). "The mute button should work on it" means pressing
  🔇 **while it is reading** must stop it — i.e. `toggleMute` has to cancel speech in flight. Check
  what `toggleMute` does today before assuming.
- §0f's other three restraints carry over verbatim: never on a review render, once per chapter per
  session, never interrupt speech already in progress (`v75_h`).
- `_autoReadStory` already takes `(topicKey, story, langCode)`, so the move is a call-site change
  plus the mute wiring — not a rewrite.
- The `v77_v` guard asserts §0f's behaviour at the OLD site and must move with it, or it passes
  vacuously against a call site that no longer exists.

Measured, and still true: `_autoReadStory` has exactly one call site today (the progress card story
panel, `v77_v`), and the finished card `v77_f` has none. So this was never a regression.

### → Group B, unchanged

The remaining group-B items are **not** displaced by this batch and stay next in line.

## USER TESTING NOTES — session 31 batch, TRIAGED (not yet done unless marked)

Triaged with the code loaded. Grouped by what each needs, because several look like separate items
and are not. **Two were fixed immediately as `v77_x`** (chapter titles, math order).

### A. Fixed this session
- ✅ **Chapter-title generation failing on multi-chapter storylines** — `v77_x`. Root cause above;
  note it explains the user's own observation that the lesson-set page worked.
- ✅ **Math ordering shows the solved order** — `v77_x`.

### B. Small and self-contained — good first work for a fresh session
- ✅ **Clear-progress at CHAPTER level** — `v78_e`, on the **progress cards** (🧹 `comp-wipe`), via the
  shared `_clearChapterProgress`. The storyline page keeps its storyline-wide control and now shares
  the same rule; **`clearLessonProgress` turned out to be a THIRD copy carrying the `v77_s` defect
  and is fixed too.**
  **RESOLVED by the user (session 32): the "inside error / AI-error-hunt lessons" half meant
  something different — clearing the errors the LEARNER had marked, so they can be re-tagged, not a
  chapter wipe. The user then dropped it: "we can actually skip this." Not carried forward.**
  Still optional, never requested: a per-chapter control on the storyline page's chapter cards. Not
  scheduled — the progress card already carries it and those cards have the lock overlay and the
  `v76_d` element-counting trap. Raise it if it is wanted.
- ⚠️ **Sentence-translation read-out should include the `"Übersetze: "` prefix** (tp_579238210) — read
  the whole question in the source language. **RETRIAGED session 32 → needs the USER, not a fix.**
  `Übersetze: "{sentence}"` is `ex.order.q`, the WORD-ORDER exercise, and its question is entirely
  in the source language — which fits the note exactly. But **there is no read-out of it to add a
  prefix to**: every `speak`/`speakLang`/`speakBodyText` call site was enumerated, and `renderEx`
  auto-speaks only `listen_mcq`/`listen_type` (and speaks `ex.target`). `tOrder` renders no speaker
  control at all. So this is either a request to ADD a source-language question read-out to the
  order exercise — a new affordance, not a prefix fix — or it is about a screen other than the one
  found. **Ask before building.** Full note in the session-32 notes §3.
- ✅ **Synonym/antonym questions should state how many are to be found** ("<n> similar to <word>")
  — `v78_b`. Counted from `ex.correct`, the array Check scores against. New `_n` keys (owed to the
  translate pass); the uncounted keys stay as the fallback and must not be deleted.
- ✅ **Conjugation options must be alternative forms of THE SAME verb**, not other verbs, and need
  not be padded to four — `v78_d`. Same-verb pool, no cross-verb padding; the coverage universe was
  checked for the v71_s stranding trap and is unaffected.
- ✅ **Teacher-mode switch at the bottom of every page**, beside the UI-language and mute controls
  — `v78_f`. Three controls, ONE updater; the compact footer icon derives its glyph from the same
  label string the landing button shows, so there is no second spelling of "which icon means which
  state". Reused the existing `teacher.*` keys — nothing new owed to the translate pass.
  (User's "will later depend on credentials" is unchanged and still ahead: the control is wired to
  `APP._teacherMode` exactly as the landing button always was, and gating it on credentials is the
  same one change in the same one place it would have been before.)
- **Highlight word forms from conjugation and word-form lessons**, so covered vocabulary lights up
  more fully. **Belongs with §0e/§3 and the ONE shared matcher** — do not add a second matcher.

### C. Needs a live model — prompt work, verify with the user
- **Error-hunt lessons fail too often.** The user's diagnosis is concrete: make the error count
  length-dependent (1/2/3 by difficulty per paragraph or per word budget), relax "exactly", and use
  1/2/3 in TOTAL as the rejection floor. The reported failure ends in an empty Ollama response after
  three retries, so this also costs a whole add-lesson attempt.
- **Vocab lessons: article mismatch** (target `palazzo`, source `der Palast`). Prompt needs to be
  stricter, with BAD examples.
- **Word-form sentences are too long** — same treatment as synonyms.
- **Comprehension scope:** ask for chapter-level questions first, then whole-story ones, via the
  prompt rather than a new selector.
- **§0g's model-prompt change** (already recorded) belongs with these.

### D. Bugs needing reproduction — ask the user for the case
- **Bulk "add lessons": ticking mixed produced no mixed lessons**, and adding mixed alone appears to
  require another lesson type alongside it. Should work on its own, per chapter.
- **Live mode: edit windows keep the PREVIOUS chapter's content** when browsing between chapters
  (lesson editor, QC story proposals). Smells like a render that reuses a panel without clearing it
  — the same shape as several card bugs this session.

### E. Larger features — need their own release, and a decision first
- **Second script for Serbian (Latin ⇄ Cyrillic):** an LLM-generated alternative script plus a
  toggle beside the translate button in every read-story field. Note `v75_g` already ships an
  `sr`/`hr` table and a native review is OWED — settle that first.
  **Extended session 32 — the SAME toggle is wanted for the UI.** The `sr` `ui.json` pass that
  arrived at the session-32 drop is complete (612 keys) and **written entirely in LATIN script,
  zero Cyrillic**. User's ruling: *"we can keep this for now, but later perhaps add both options."*
  So `sr` UI stays Latin-only and is **not** a defect. When it is picked up, note the shape: this is
  the same question as the story toggle and the same question as `_scriptChoice`, in a third place —
  a language whose UI, whose story text and whose lesson content can each be in either script. It
  wants ONE notion of "which script is this learner reading", not three toggles that can disagree.
  **Sequence it after §7** (script lessons for a digraphic source), which is the first thing to
  actually READ the per-topic `script`/`srcScript` fields; §7 establishes whether that pair is the
  right carrier before a third consumer is built on it.
- **Live main page should mirror the static one**, with generation moved behind a button/card, and
  every "continue story" affordance redirecting there.
- **Floating pill listing running LLM jobs, one row each, with a working STOP per job.**
- **Token accounting must include deleted lessons/chapters** — record the spend when deleting, or
  the total is not a total.
- **Social-media preview for storyline URLs** (title + storyboard). Server-side OG tags; cheap only
  if the storyboard is already reachable as an image.
- **Startup check for missing ENGLISH ui.json keys**, not only other languages. Note
  `unit-ui-key-exists` already does this in the SUITE — this is about the running app.

## RECOVERED — carried since v71, still not done

These were lost once at the v71→v72 roadmap boundary and recovered in `v73_k`. **Do not let them
drop again.**

- **Global QC**: a checkbox menu of what to QC, merged with the user's request to make the book's
  automatic QC opt-in from the lesson-type menu and run it AFTER the storyboard pass. **Note this
  reverses the `v68.1` ordering decision.**
- **Crossword**: show the correct word's translation instead of the empty underline. **Needs a
  decision first** — `word_forms` items have no translation.
- ~~**Live mode with teacher mode OFF must hide every editing control.**~~ **DONE in `v79_j`**
  (session 33). `_canEdit()` now keys on teacher mode alone; the truth table moves in exactly one
  cell and `unit-can-edit-teacher-mode` holds it. **One thing this entry got wrong, kept as a
  warning:** it read as though `_canEdit()` were the whole conflation. It is not —
  `Edit / rename topic` (index.html, the library row) is a pure editing control gated directly on
  `canGenerate` and was never a `_canEdit()` caller, so a fix touching only that function would look
  complete and leave the pencil in place. It stays visible **by user ruling** (session 33: Continue
  story / Add lesson / Edit-rename are "generation, not editing"), which is a decision rather than
  an oversight — revisit it with the larger learner/teacher rework, not on its own.

---

## Owed by the USER — not doable in a container

**New `en`-only keys from `v78_b`, owed to the translate pass:** `ex.syn.q_synonyms_n`
(`{n} similar to {word}`) and `ex.syn.q_antonyms_n` (`{n} opposite to {word}`). **Both carry TWO
placeholders** — a translation that drops `{n}` silently loses the feature for that language, so
these are worth a glance when the file comes back. The uncounted `ex.syn.q_synonyms` /
`ex.syn.q_antonyms` are still in use as the fallback and are already translated: **do not delete
them.** `unit-syn-count` §5 asserts en-only, which is correct only while the keys are new — flip it
to "no language holds the English string verbatim" once the pass has run (`v71_q`).

**New `en`-only keys from `v77_i`, owed to the translate pass:** `unlocked.title`
("Next chapter unlocked!"), `unlocked.next`, `unlocked.back_card`, `unlocked.progress`
("{done} of {total} chapters").

**New `en`-only keys from `v77_h`, owed to the translate pass:** `summary.title`
("The story so far"), `summary.open`, `summary.next` ("Back to your progress"),
`summary.chapters` ("{n} chapters").

**New `en`-only keys from `v77_f`, owed to the translate pass:** `finished.title`
("Story finished!"), `finished.vocab` ("Everything you learned"), `finished.next`
("See the whole story"), `finished.back_card` ("Back to the chapter"). `t()` falls back through
English meanwhile. **`v71_q`: never assert a dropped key absent.**

- **A browser pass.** Nineteen releases deep. `v74_c` changed what coverage MEANS, `v74_i` was the
  only `server.js` change of the session (live mode is the half that cannot be exercised headlessly,
  only simulated), and `v74_j` / `v74_n` are visual.
- **Serbian/Croatian follow-ups (`v75_g`):** the 28 non-English `names` entries in
  `languages.json`, the `ui.json` translate pass for `sr` and `hr` (both are empty stubs), and
  **a native-speaker check of the 30 `cyrillic-sr` rows** — especially the letter names and the
  IPA column. The table was authored in-container, which is exactly the case the design
  principle warns is wrong in ways that stay invisible until a native speaker looks.
- **The comprehension QC checker** — needs a new prompt and a live model. Correctly queued, not
  started in a container.
- **The translate pass.** Changed in English and DROPPED from the other 29 languages for refill:
  `complete.story_unlocked`, `ex.badge.comprehension`. New and English-only:
  `complete.words_solved` = "Words you can read in this chapter",
  `form.finish_mixed` = "Finish the chapter with a mixed review round (no AI)".
  **(v75_b) These two were MISSING FROM `en` TOO** — the returning `ui.json` predated them, so they
  rendered as raw key text. Now present in `en`; every other language is missing exactly these two
  and nothing else (verified). `t()` falls back through English, so nothing is broken meanwhile.
  **`v71_q`: never assert a dropped key absent.** **When the file comes back, `unit-ui-key-exists`
  catches it if it predates the code again.**

---

## ⚠️ STANDING RULE — session 37 (user), IN FORCE UNTIL REVOKED

**"I am the only teacher/student at the moment, so it doesn't really matter if a change affects the
user progress."**

This is a standing instruction, not a one-off ruling for a single release. Its consequences:

- **Progress impact is NOT a blocker.** A change that invalidates, resets or re-colours existing
  learner progress may ship on its merits. Do not design around preserving `learners.json`, and do
  not add migration machinery for it unasked.
- **It does NOT license skipping measurement.** Keep measuring what a change does to the numbers —
  the measurements have repeatedly found real defects (`v81_d`'s 92 vanished words, `v81_h`'s
  colouring shift) and they are how a release is understood. What changes is only the WEIGHT given to
  a progress regression when deciding whether to ship, not whether it is looked at.
- **It does NOT relax the monotonic-solved-store rule** (`§T7` reading 1 vs 2). That distinction is
  about what the app CLAIMS the learner has done, and it is a ruled design boundary, not a
  data-preservation concern.
- ⚠️ **Revocable.** If a second learner ever exists, this rule lapses and progress-preserving
  behaviour becomes load-bearing again. Check it is still in force before leaning on it.

## ⚠️ How the rules are NUMBERED — read before citing one

**The standing rules run to 46, but the numbering in this file is not continuous, and that is a
wart rather than a gap.** Two blocks restart at `1.`: "Rules earned in session 28" (rules 1–8) and
"Rules earned in session 29 (continued)" / "Rules earned in session 29" (which carry what the rest
of the corpus cites as rules **10–14**, and which a grep for `^10\.` will therefore never find).
"Rules earned in session 30" resumes at `15.` and the numbering is continuous from there through 35
("Rules earned in session 34"), and again through 36–37 ("Rules earned in the v83 line"), 38–40
("Rules earned in the v84 line"), and 41–46 ("Rules earned in the v85 line", added at THIS cut) — a
whole release line rather than one numbered session, since that is the unit this project's cuts
actually happen at now. **This note itself had gone stale once already** (it stopped at "36–37" for
two whole lines' worth of later additions before this cut fixed it) — update it EVERY time a new
"Rules earned in the vNN line" block is added, in the same edit, not as a follow-up.

**Do not renumber them.** Every "rule 23", "rule 29", "rule 32" citation across the session prompt,
`INTERNALS.md`, the session prompts, the session notes and several test files is by number, and a
renumber would silently invalidate all of them — the exact failure mode rule 29 is about. When a
session says "thirty-five standing rules" it means **numbered to 35**, not thirty-five entries;
`^\d+\. \*\*` finds 33, and the "9. Package" line inside the definition-of-done list is not a rule
at all and will inflate any naive count by one.

## Rules earned in session 28 — read these before writing a probe

1. **A probe must call the product function, never a re-typed copy** — and least of all one lifted
   from a test stub. Two false findings came from re-implementing `lessonCountsFor` and the
   read-full-story lock instead of invoking them. One reported a hole that did not exist; the other
   reported a fix as not working when it already was.
2. **A claim about behaviour is only measured if the assertion touched the thing being claimed.**
   `setComplete=false` is not evidence about a button. Three inference-not-measurement errors this
   session: math's generator, the `lessonCountsFor` stub, and the error-hunt "lock".
3. **A non-vacuity check must be evaluated on the data the assertion actually runs against**, not on
   the data it was derived from. Two guards passed under their own reverts because the fixture had
   been projected before the assertion saw it.
4. **A guard that reads its own explanatory comment is a guard that lies.** A negative match on
   `white-space:nowrap` found the comment naming what had been replaced.
5. **A headless harness that builds `APP.savedList` from whole topics is testing STATIC mode**,
   whatever else it thinks it is testing. That blind spot hid `v74_i` from 167 green checks — every
   existing test ran in the static shape, and the live shape existed only in a browser.
6. **Where the environment admits only one writer, unexplained state is yours.** Mid-session a
   version bump and three edits landed without the definition-of-done being run, so the tree drifted
   past the artifact the user held; the changes were then not recognised as mine. The suite-docs-
   package cycle exists to make that drift impossible. Follow it per change.

---

## ⚠️ Session protocol — READ FIRST, applies to every change

This block is the standing "definition of done." A fresh session is expected to follow it without
being re-told; several of these were missed in past sessions (LIVE-TEST updates, i18n listing,
version bump) and only caught because the user noticed. Treat it as a checklist.

**How to start a session (REVISED at the `v80_d` cut — there are TWO documents now, not four):**
read the current **session prompt** first, `build_history/SESSION_PROMPT_v*.md`, highest version
(baseline numbers, what session 35 shipped, what is owed by the USER, open decisions — it absorbed
`HANDOVER.md`, which no longer exists), then THIS file (the highest-numbered
`build_history/roadmap_v*.md` is the current one, and it now carries the folded **THE LARGER PLAN**
section that was `implementation_plan.md`), then `INTERNALS.md`. The
`build_history/v*_session*_notes.md` files are history: search them, do not read them cold. Establish the green baseline (`node test/run.js` +
`node test/check-inline.js`) before touching anything.

**Working rules (per change):**
- One change at a time. Pure refactors stay byte-identical. After each change: full suite green
  (`node test/run.js`) and `check-inline` at 0. Re-run before moving on.
- **A carried-forward open item must be cross-checked against the SHIPPED list in the same file
  before it is carried again.** Added session 26: the "Drill result card" item was carried through
  four releases while `roadmap_v71.md` recorded it as shipped in `v71_h` on line 227 — the open
  entry sat 264 lines below the entry that closed it. Deferring an item is not evidence that it is
  still open.
- Add or update a **unit test** for any new behavior. When adding a lesson type, exercise type,
  generator, or registry entry, update the matching registry test (`unit-*-registry`).

**Definition of Done — before calling any change finished, check ALL that apply:**
1. **Tests** — suite green + `check-inline` 0; new/changed behavior has a guarding test. For render
   paths (anything drawn in the client), add/extend a `smoke-render` case — source assertions cannot
   see runtime scope, TDZ, or layout.
2. **Browser-only behavior → session notes** *(the former LIVE-TEST-CHECKLIST.md is a closed
   archive — do NOT add sections to it)*. If the change is browser-only or Ollama-only (UI, RTL,
   TTS, rendering, anything not exercisable headlessly), the session notes MUST contain a short
   "how to see it work" description — what to click and what to expect — so the user can verify it
   in normal use.
3. **i18n** — new user-facing strings go in `ui.json` **`en` only** (never add English text to other
   languages — the user's `translate-ui.js` fills *missing* keys and can't detect English
   fallbacks). List every new key in the session notes + roadmap so the offline translate pass is
   run. Changed English values won't be re-translated automatically (script keys off *missing*, not
   *changed*) — call those out explicitly or hand-edit if language-neutral.
   **(v71) When a translated `ui.json` comes BACK, validate before merging:** per-language key
   counts, and whether any `en` key vanished. A returning file may predate recent releases.
   **A test asserting a key is "en-only" is correct while the key is new and wrong once it has been
   translated** — assert instead that no language holds the English string verbatim.
4. **Static build** — if client (`index.html`) or baked data (`lessons.json`, `languages.json`,
   `scripts.json`, `ui.json`) changed, re-run `node build-static.js` so `docs/index.html` is current.
5. **Data parity** — if a generator exists on both server and client (math, intro_script, furigana
   tokenizer), keep them identical and assert parity in a test.

**Definition of Done — at a release / packaging point:**
6. **Version** — bump `APP_VERSION` in `server.js` if it's a new release. NOTE (v49): the static
   build DERIVES the version from `server.js`'s `APP_VERSION` at build time (see
   `unit-version-derivation`), so a single bump in `server.js` + a `build-static.js` re-run is
   enough — no more hand-editing `build-static.js`.
   **Point releases use an alphabetic suffix** (user, v70): the base cut is the bare number and is
   implicitly `a`, so the sequence is `v77` → `v77_b` → `v77_c` → … — the same convention the v69–v85
   lines ran. **This is the `v86` line.** Roadmaps are per BASE version, so point
   releases do not each get one — this file stays current through the whole v86 line.
   (This paragraph is the one version-specific line in the block and had shipped stale FOUR times by
   session 32 — `roadmap_v73.md` said "the `v72` line", `roadmap_v76.md` said "the `v75` line" for
   its whole run, and this file was written at the v78 cut still naming the v77 line, in BOTH
   sentences. **It is no longer maintained by hand: `unit-roadmap-version` asserts that the
   highest-numbered roadmap names the same base version as `server.js`'s `APP_VERSION`.** A note
   telling the next session to check something is not a guard; four repeats is enough evidence that
   this one was never going to be checked.)
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version bump
   write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
   **(v75) Prompt files are named for the version the session WRAPS UP WITH**, not the one it starts
   from: the prompt that opened the session ending in `v75` is `build_history/v75_prompt.md`. The old
   `session_{n}_prompt.md` names were renamed to match (`session_28_prompt.md` → `v74_prompt.md`,
   `session_29_prompt.md` → `v75_prompt.md`) — the session numbering had drifted from the version
   numbering and only one of the two is meaningful later.
9. **Package** — sync the release dir, regenerate `docs/`, zip, and call out which deliverables are
   still owed (browser pass, i18n, native-speaker content checks).
   **(v77_h, user) The zip's TOP-LEVEL DIRECTORY must be named for the release it contains**, not
   for the base cut: `dreizunge_v77_f.zip` unpacks to `dreizunge_v77_f/`. Unpacking every point
   release into the same `dreizunge_v77/` silently overwrites the previous one, or merges into it —
   which is how a stale file survives a release. Rename the directory before zipping; do not rely
   on the working directory's name.

**(v71) Test-quality rules — added because five guards failed in one session, in five distinct ways:**
- **Verify every guard by reverting its fix and watching it fail.** Four of the five were caught
  this way; the one that was not is the one that reached a release.
- **A vacuous guard passes for the wrong reason.** (v70_f: "a Check after reveal credits nothing"
  passed trivially, because reveal marks every entry done and Check skips done entries.)
- **A conditional guard only sometimes exists.** (v70_g: repeat assertions wrapped in
  `if (replayTargetExists)`, which in that scenario did not.)
- **A guard should fail as a named assertion, not a `TypeError`.** (v70_l: reverting the highlight
  threw inside the sandbox — a far weaker signal for whoever hits it.)
- **Test the caller, not just the helper.** (v70_m: five assertions on `_synContext`, none on
  `tSynSelect` — reverting the render passed them all.)
- **Test against the data that prompted the report.** (v70_n: the synonym trim was green and did
  nothing, because the fixture was a multi-sentence paragraph — the shape the fix handled, not the
  135-word single sentence the user was complaining about.)

**(v71) Reachability rule:** a learner-facing feature placed on the lesson-set page is unreachable —
learners skip that screen entirely (v60 learner nav). `_canEdit()` is NOT the gate that matters;
check against `_isLearner()`. When reporting a new affordance, say WHERE it lives in the navigation,
not just that it exists.

**(v71) Known harness traps** (each cost a debugging cycle):
- The stub DOM does **not** parse `innerHTML` — `querySelectorAll` returns `[]`. Assert against the
  markup string; `getElementById` persists stubs, which is what makes interaction testable.
- Values returned from `C.run` belong to another realm, so `deepStrictEqual` against a local `[]`
  fails on prototype identity. Compare lengths or spread first.
- `_lessonQidUniverse` caches on `topic|lessonIdx` and returns the cached Set **without
  re-deriving**. Swapping a lesson's content under a fixed topic+index is something only a test
  does — give such scenarios their own topic key.
- `build()` **samples**: it emits a round, not the full question set, and a different subset per
  call. Never derive a question's identity by rebuilding; synthesize the exercise shape and let
  `qid()` key it.
- Fixture data is **not** a constant. A scenario that leans on "the first topic in `lessons.json`"
  will break when the bundled data is replaced.
- **`APP.cur` has a DEFAULT (`lessonIdx: 0`, index.html:1651) that sections silently depend on.**
  `_exFlagTarget` resolves a flagged item through `APP.cur?.lessonIdx`, and `assembleCoverageRound`
  keys the solved-set through the same fallback. So a section that needs a real lesson index must
  **mutate and restore the field** (`APP.cur.lessonIdx = i` … `= 0`), never replace or `delete` the
  object — doing either broke an unrelated later section in v71_r. Mutating also mirrors real play,
  where `openLesson` sets `C.lessonIdx = idx` immediately before `buildExercises(idx)`.

**(session 23) DESIGN PRINCIPLE — no language knowledge in the code.** The code must not encode
facts about particular human languages: article lists, gender rules, pronoun sets, inflection,
"which languages use articles", sentence-final punctuation. Producing correct language content is
the MODEL's job — instruct it in the prompt instead. A per-language table is written by whoever is
editing the code, is wrong in ways invisible until a native speaker looks, and fails silently for
any language missing from it.
*Not* covered: mechanical/typographic facts that decide how text is HANDLED rather than whether it
is CORRECT — Unicode normalisation, script/RTL detection, diacritic folding for comparison.
The test: **does this decide whether content is right, or only how it is displayed/compared?**
Known violations inventoried in `INTERNALS.md` → "Design principle"; the worst
(`normalizeVocabArticles`) actively degrades real data.

**(v71_w) Rules:**
- **A progress FRACTION and a FINISHED signal are different questions.** "How much have you played"
  may stay a raw count; anything asserting completeness — a colour, a lock, a tick, a connector line
  — must read the shared rule. The storyline page got this wrong for two releases in both
  directions at once, and nothing failed because the two rules agreed on the bundled data.
- **A source-pin regex that falls outside its own slice window is a vacuous pass.** A 4,000-char
  slice of `_renderChapterCard` stopped before the line being pinned. Check the pin actually sees
  what it claims to.

**(v71_u) Rules:**
- **Wiring changes need a RUN, not source assertions.** When one side sends and the other consumes,
  assertions on each half prove nothing about the join: in `v71_u` the server could ignore
  `arcTypes` entirely and the whole 156-check suite stayed green. If a change is "A now passes X to
  B", the test must observe B's OUTPUT.
- **A standard/vocab lesson has NO `type` field** — it is the default shape. `l.type === 'standard'`
  is never true, and an assertion written that way is vacuous (this bit inside the very test written
  to catch a vacuous pass). Use `(l.type || 'standard')`.
- **A test that re-implements the code it tests cannot fail when that code is deleted.**
  `unit-arc-options` kept passing after its feature was removed. If a test builds its own copy of a
  block to run it, it is testing the copy.
- **New lesson types need a `fake-ollama` branch**, or an e2e will skip them silently — the arc loop
  correctly refuses to abandon a run for one bad type, so the omission is invisible. Order matters:
  place a new matcher before any looser one that could swallow it (`correctIndex` is shared by
  comprehension and word_forms).

**(v71_t) Rules:**
- **Ollama truncates an over-long prompt SILENTLY.** `num_ctx` defaults to ~4096 and there is no
  error when the prompt exceeds it. Any change that makes a prompt bigger must size the context
  window in the same commit, or the extra text is discarded invisibly and the change looks like it
  worked. A deliberate trim in our code always beats letting the backend cut blindly.
- **`callLLMLesson` spreads the caller's opts AFTER its think policy**, so a caller passing
  `timeoutMs` or `tokens` OVERRIDES the ×3 / ×2.5 that reasoning mode applies. Check you are not
  lowering them — "raise the timeout" is easy to write as a reduction.

**(v71_s) Rules:**
- **A review render is not a play.** `showComplete(true)` repoints `APP.cur` at the LAST counted
  lesson so the vocab recap resolves, so anything that JUDGES the learner — records a done-flag,
  locks Next, counts an exposure — must be behind `!C._review`, or it judges a lesson nobody just
  played. Third time this shape has bitten (v71_n, v71_s twice).
- **A withheld done-flag makes `_firstUnfinishedLessonIdx` keep returning that lesson.** Any rule
  that refuses to mark a lesson done must also stop Next pointing back at it, or the forward button
  silently means "replay this" and steps over the v71_d lock.
- **When a builder or gate is narrowed by lesson type, narrow the COVERAGE UNIVERSE to match.** A
  denominator that counts questions the round will never ask can never be satisfied.

**(v71_r) Diagnosis rules:**
- **A red baseline is a finding until proven otherwise.** When only the DATA files are newer than
  the code, the obvious read is "stale fixture" — but check whether the guard is *right* first.
  In v71_r the fixture had indeed moved AND the property it asserted was false, hiding a live
  defect. Fixing the fixture alone would have shipped the bug.
- **A failure appearing *after* you fix another one may not be new — it may be running for the
  first time.** An earlier `assert` aborts the file, so everything below it is unexecuted. Verify by
  patching the PRISTINE tree to skip the original failure and watching the later section pass,
  before assuming your change caused it.
- **Guard a guard against going vacuous on new data.** If a section only means something when the
  corpus contains a case (here: a lesson exceeding its builder's cap), assert that such a case was
  actually found. Without it the section silently becomes a no-op — which is precisely how §8
  passed while grammar sampled at random.

## Rules earned in session 29 (continued — see the session notes for the full set)

5. **A whitelist fails silently and per-type, so its guard must be per-type AND driven off the
   registry**, or it guards only the types someone thought of.
6. **A "curated title" is a proxy for authorship, not for content.** Deciding which copy of a
   duplicated record survives by any signal other than its content will eventually delete content.
7. **"Every language has key X" goes stale when a LANGUAGE is added**, exactly as "key X is absent
   everywhere" goes stale when the translate pass runs. Scope such claims to the languages actually
   translated, and floor them for non-vacuity.
8. **Replacing a brittle source pin is itself a change that needs revert-verifying.** The first
   replacement of the `if (!u)` pin was vacuous in a NEW way — its match window reached past the
   block it meant to check — and only the paired behavioural test exposed it.

## Rules earned in session 29

1. **A comment near a source-scanned pattern must not spell the pattern.** The repair comment for
   `common.cancel` contained a literal `t('…')` call and failed the very sweep it documented —
   rule 4 above, arriving from the other direction: a correct guard made to fail by prose *about*
   code. A source scanner cannot tell the two apart.
2. **When a guard asserts the precondition of a render, assert it against the state the render
   LEAVES.** A precondition checked before `showComplete()` passed under its own revert, because
   rendering the card is what marks the lesson done and flips the branch it was guarding.
3. **A test that does not reset shared state is a test of whatever ran before it.** `seed()`
   preserves `APP.progress` by design and the §3 lock probe writes completion keyed by topic NAME;
   one corpus change made two fixtures the same chapter and the leak surfaced. A section needing
   empty progress must clear it and say so.
4. **Timestamps are evidence, and cheap.** `ui.json` older than `index.html` was the entire
   diagnosis of the first red check.

## Rules earned in session 30

15. **A fix to the client is not a fix to the published build.** `build-static.js` re-implements
    part of `index.html` — currently `loadSavedList` and `savedItemHtml`. Any change to the landing
    page must be applied twice and asserted against `docs/index.html`. The `v76_e` guard passed for
    two releases while the published build stayed broken.

12. **A test that hard-codes a COUNT of a repeated element is pinning the fixture, not the claim.**
    `total 🔒 === 1` meant "a two-chapter storyline"; it broke on a six-chapter chain while the
    product was correct. Count by element KIND (the chapter-card overlay and the full-story row are
    different elements), or assert the specific element the claim is about.
13. **A guard whose scenario matches nothing may never reach the branch it tests.** `loadSavedList`
    returns early on an empty filtered list, so a "this must NOT be shown" check written with a
    filter matching nothing passed under its own revert. A negative assertion needs a positive one
    beside it proving the render got that far.
14. **Identity must be CARRIED through a projection, never recovered by hashing it.** Third time:
    `v75_f` (a storyline rebuilt because its stored id was not the hash of its chapters), `v76_e`
    (a storyline unrecognised because its chapter list was filtered before it was matched). If a
    list is filtered and then matched back against its source by length or position, the filter and
    the match are the same bug waiting.

## Rules earned in session 31

21. **A variable declared with `let` further down the same function cannot be read earlier — check
    the declaration line before reaching for a value.** `showComplete` computes `_storyDone` ~60
    lines BELOW its Next wiring; reading it there is a `ReferenceError` on every terminal card, and
    it is the exact `v68.1` bug in the exact `v68.1` function. **And the obvious fix is worse:**
    re-deriving the value inline creates a second copy of the rule, which is how the storyline
    page's connector line drifted in `v71_w`. Extract one function both sites call.
22. **A handler declared inline in markup is one a headless test can never click.** The stub DOM
    does not turn an `onclick="f()"` attribute into a callable property. `comp-next` has always
    assigned its handler in JS; anything testable must do the same.

19. **Three of `v76_card_gates.md`'s findings were seeding artefacts, in three different stores**
    (`comp-back`/`comp-story`: the stub DOM itself; the coverage rows: `solved` keyed by item vs
    qid; `comp-drill`: `learned` never written at all). A gate table is only as good as the state it
    seeds, and "the element was never enabled in 32 rows" usually means **the store that enables it
    was never populated** — not that the feature is dead. Before deleting a control as unreachable,
    find its enabling store and write it the way the PRODUCT writes it.
20. **When a passing test contradicts a written finding, the test is usually right.**
    `unit-card-consistency` asserted "drill is live once mistakes exist" while the truth table said
    "never once enabled", and the contradiction sat in the tree for a release because prose is read
    as measurement and a green assertion is read as a detail. Grep the suite for the element before
    trusting a table about it.

16. **An element-visibility probe against the stub DOM must first assert the element exists in the
    MARKUP.** `lib-dom` auto-vivifies any id, so `getElementById('anything')` returns a fresh stub
    with no `display` and no `disabled` — which reads as "present and visible", or as "present and
    hidden" once the probe's own legend maps it. Two of the nine columns in `v76_card_gates.md`
    (`comp-back`, `comp-story`) were phantoms for a whole release, and the roadmap carried
    "the button is already there and already dead" into a rework that was about to reuse it.
    The probe DID call the product function — but the READOUT went through the stub, so the
    assertion never touched the thing being claimed (session-28 rule 2, from a new direction).
17. **When two stores are keyed differently, seeding one and reading the other measures nothing.**
    The `v76` coverage question — "86 keys in, 0 counted" — was a probe seeding the QID universe
    into a store `topicCoverage` reads by ITEM key. Before concluding a gate is unreachable, seed
    it the way the PRODUCT writes it (here: `markSolved`), or drive the real path.
18. **A guard that asserts a construct is ABSENT survives a rewrite; one that pins a phrasing does
    not.** `unit-card-errors` asserts zero empty `catch` blocks in `showComplete` rather than
    matching the new call text — so it keeps working as the rework moves that code, which is
    precisely what §0a asks of the eight files that currently pin source text.

## Rules earned in session 32

23. **A fixer is not a diagnosis, and two guards firing together may be one cause seen twice.** The
    `v78` baseline opened red on both data-sensitive guards, each with a documented one-line remedy.
    Running either remedy **destroys the evidence** that says whether the remedy was right: three
    cheap facts (corpus counts unchanged at 308/86, `lessons.json` the OLDEST file in the tree, the
    hash the freshness guard names) narrowed it before anything was written, and the first
    hypothesis they suggested turned out to be **wrong** — the backfill did not reproduce the hash
    `docs/` was built from. The real cause was one thing: the shipped `lessons.json` was the user's
    NEWER file (7 topics with an `ai_error_hunt` lesson `docs/` lacked). **Corollary: when the
    remedies interact, the ORDER is part of the diagnosis** — `build-static.js` first, the fixer the
    failure literally asks for, would have baked the unstamped corpus and overwritten the evidence.
    Backfill, then rebuild.
24. **A note instructing the next session to check something is not a guard.** The protocol's
    version sentence went stale four times, each correction ending in a fresh reminder to check it
    next time; the fourth repeat got BOTH its sentences wrong, the second having survived every
    earlier fix. If a fact can be derived from a source of truth, assert it (`unit-roadmap-version`).
    A reminder is what you write when you have decided not to.

25. **Never put emoji — or any non-BMP character — in a string literal inside the script that writes
    a file.** Session 32 truncated `roadmap_v78.md` **to zero bytes** with a heredoc containing
    `\ud83e\uddf9` surrogate escapes: encoding rejects lone surrogates, and the exception arrives
    AFTER the file is opened for writing, so a "failed" write is not a no-op. Write such blocks with
    a `cat` heredoc to a temp file and splice the FILE in, so the bytes come from disk rather than
    from an escape the writer must encode. `unit-roadmap-version` caught it on the next run, and the
    packaged zip was the only intact copy — both worth remembering.

26. **When two releases each change the same surface, re-measure the older plan against the newer
    behaviour before scheduling it.** §0e's "order the vocabulary as the words appear in the story"
    assumed a per-CHAPTER panel; `v77_f` later made that panel CUMULATIVE across the deck. Neither
    was wrong, and nothing forced them to be compared — so a plan carried unchanged across three
    roadmaps turned out to describe **17% of the data** (measured: 83% of cumulative panel words
    never occur in the story on screen). The check was one probe over the corpus and was available
    the whole time. **A plan carried forward unchanged across N roadmaps is a plan whose premises
    have not been checked against N roadmaps' worth of changes.**

27. **When a comment predicts a failure mode, check every site the prediction covers — not the one
    in front of you.** `v76_h` wrote down that naming the script inside the language name "is not
    enough on its own — the model still drifts", fixed the STORY prompt, and left three LESSON
    prompt builders with the name alone. Two sessions later the corpus produced exactly the
    predicted artefact: a chapter with a pure-Cyrillic story and Latin vocabulary. **A note saying
    "X is not enough" is a search instruction: grep for every place X is done alone.**

28. **A corpus artefact is evidence of a cause only once you have checked what generated it.** At
    the v79 cut a Cyrillic chapter with Latin vocabulary was read as prompt drift, and a fix was
    written and shipped on that reading. The lesson's own `_genMeta` said `_arcMode: "reinforce"` —
    a mode whose JOB is to re-teach earlier chapters' vocabulary, which was Latin on purpose. One
    field, already in the data, would have settled it before any code was written. **`_genMeta`
    records how every lesson was made: read it before diagnosing what a lesson contains.**

## Rules earned in session 33

29. **When a pin breaks, ask whether the CLAIM changed or only the TEXT did — and if only the text,
    re-anchor rather than re-pin.** Five source pins broke this session and not one of them had a
    false claim: `unit-reasoning-model-safety` and `unit-reasoning-toggle` sliced from a line that
    moved; `unit-book-script` matched an inline copy that was deliberately deleted in favour of a
    shared helper; `unit-add-lessons` pinned an exact function signature and an exact call string
    that both grew an argument. Re-pinning each to the new text would have preserved the brittleness
    that cost the diagnosis in the first place. **The repair is to express the claim at the level
    the claim actually lives** — the function rather than its arity, the helper rather than one
    site's copy — **and to add a non-vacuity check so the widened pin cannot go silently empty.**

30. **A COUNT is a proxy, and proxies fail on the thing they should welcome.**
    `unit-intro-script` asserted a helper appeared exactly three times, meaning "no call site
    hand-rolls this question". A legitimate new call site — using the helper correctly, fixing a
    real bug — broke it. Replaced by the rule itself: exactly one definition, at least two callers,
    and every call asked about a SET rather than about `APP` globals. **If a test asserts a number,
    ask what rule the number stands for and whether the rule can be asserted instead.**

31. **Before strengthening an instruction, check whether the instruction is already there and being
    CONTRADICTED.** The word-forms prompt already said distractors must be wrong in the sentence;
    three bullets earlier it recommended, as "the easiest reliable exercise", exactly the tense swap
    that produces indecidable items. A concrete recipe beats an abstract prohibition in any model.
    **A prompt is a document, not a set: read the whole of it and look for the bullet that ASKS for
    the defect before writing a sterner version of a rule that is already present.** Corollary,
    also earned here: the prompt had only POSITIVE examples. A worked counter-example — the broken
    item beside its repair — is worth more than another sentence of prohibition.

32. **A release that says it closed a hole is a claim, not a measurement.** `v79_a`'s shipped row
    read as though the script problem was solved; it covered three prompts of fourteen, and four
    releases later a Cyrillic chapter got an all-Latin conjugation lesson. The row is now marked
    SUPERSEDED in place, because the next session would otherwise read it exactly as this one did.
    **When a fix has a natural scope ("every prompt that…", "every call site that…"), enumerate the
    scope from the source and guard the ENUMERATION, not the instances you happened to fix.**
    `unit-script-pin-coverage` sweeps every `sys*`/`generate*` function out of `server.js` and
    demands each be classified; it found 29 builders, three more than a hand-written list had,
    including a story-QC path that returns a corrected copy of a chapter and could therefore
    silently transliterate one that was already right. The sweep found bugs its author did not know
    to look for.

33. **A green guard near a defect is not evidence about that defect — find out what it actually
    compares.** `unit-script-choice` looked like the guard for "a chapter's lessons are in the wrong
    script" and stayed green through exactly that bug, because `backfill-script.js` compares a
    chapter's STORY with its VOCABULARY and the reported chapter's vocabulary was fine. Likewise
    `e2e-bookjob`'s `/Previous story/` assertion passed for both behaviours of `useFullChain` and
    could not see that release at all. **Read a passing test as the sentence it can actually
    justify** — here, "no chapter's story and vocabulary disagree" — and write the missing one.

34. **Prefer guarding at the layer where the claim is observable, and say plainly what remains
    unverified.** Three of this session's releases (`v79_f`, `v79_g`, `v79_i`) can only prove that
    an instruction REACHES a prompt or that a wiring is correct; whether the model complies is
    observable only on a live generation. Where a claim was a wiring fact — "the server sized the
    context window" — the guard moved to the backend (`fake-ollama` now logs `think`, `num_ctx` and
    `num_predict`), because no prompt assertion can reach it. Where it could not move, the limit is
    written into the shipped row rather than left implied.


## Rules earned in session 34

35. **A warning carried forward in the notes is a claim about a DESIGN, not a fact about the
    problem — measure the warned-about thing before you plan around it.** Three documents (the
    session prompt, `roadmap_v79.md` §0 and `INTERNALS.md` §6b) all warned that the fork task's
    progress half was "the risky one", that it was "shared state between forks rather than a
    rendering change", and that making a shared chapter count for both forks "collides with the
    `_rendered` guard, and how you resolve that collision IS the design decision in this task."
    **Both halves of that were wrong, and ten minutes of measurement said so before anything was
    edited.** Progress needed **no change at all**: `APP.progress.completed` and `chapterDone` are
    keyed by topic **name**, so completion was already storyline-agnostic, and playing a shared
    prefix moved both decks identically (0/4 -> 2/4 on each side, measured through
    `chapterComplete` and `_slProgressStats`). And the `_rendered` collision existed only for the
    design where a fork column redraws the whole other storyline including its prefix — the design
    the user then rejected ("don't draw the shared prefix multiple times, keep the forking"), after
    which the guard was never touched. **The warning was true of a plan nobody had committed to.**

    Why this is worth a rule rather than a note: a carried-forward warning is written by a session
    that was *anticipating*, and it hardens into fact by repetition across documents. Three
    restatements read as three confirmations when they are one guess. The tell is grammatical — a
    warning phrased in the future tense ("you will hit", "it collides with", "how you resolve that
    IS the design decision") is a prediction; one phrased in the past ("measured at the v79 cut",
    "it changes 8 of 32 rows") is a measurement. **Spend the first probe on the predicted obstacle.**
    If it is real you have lost nothing and gained a baseline; if it is not, you have been spared
    designing around a constraint that does not exist.

    Corollary, and the reason the real defect was found at all: when the warned-about mechanism
    turns out not to be the problem, **the actual defect is usually one layer out.** Here the fork
    asymmetry was never in the completion helpers — it was in **membership**, a storyline's
    `chapters[]` not listing a chapter its own chain continues from, which is data rather than code
    and needed a user ruling rather than a fix.

## Rules earned in the v83 line

36. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
    shape** (`v83_p`). Changing `PLAN §7.0` CP4's `vocab[i].target` field from lemma to surface form
    silently broke `apply-cp-lessons.js`'s own cross-chapter dedup, which read `vocab.target`
    assuming it WAS the lemma — found only by re-running the FULL test suite for every affected file
    after the first fix, not by reasoning about that one fix in isolation. Any future change to a
    shared record shape (a token record, an analysis record, a concept record, a lesson shape) needs
    the SAME sweep: what else reads this field, and does it still mean what that reader assumes?

37. **A per-caller `think:false` fix does not generalize — every OTHER caller of a raw model call
    needs the SAME check, independently** (`v83_o`, `v83_r`). `v83_o` fixed CP2's `analyzeSentence`
    sending no `think:false` against a reasoning model; `v83_r` found a THIRD, unrelated caller
    (`llm.js`'s own `warmup()`) with the identical gap, only because changing the DEFAULT MODEL
    happened to exercise it end-to-end months later. Grep for every `_callOllama`/`callLLM` call site
    before trusting that "the reasoning-model bug is fixed" — one fixed call site proves nothing
    about the others. Corollary: a NEW test that spawns a server belongs in its OWN e2e file, never
    folded into an existing always-run unit file — `unit-run-summary.test.js` (`v70_b`) will catch it
    if you try, and the fix is to split the file, never to loosen that guard.

## Rules earned in the v84 line

38. **A resource teardown that can fire its "should I resume?" check SYNCHRONOUSLY must run AFTER the
    state that check reads has been updated, not before** (`v84_l`). `_speechStopListening()` was
    originally called BEFORE `check()`/`pickChoice()` on a correct answer — stopping a
    `SpeechRecognition` session can fire its `onend` event synchronously, and `onend`'s own "should I
    resume listening?" logic read `APP.cur.answered`, which hadn't been set yet. Stop-then-check meant
    that read saw `false` and spawned a superfluous second session for a question already answered.
    Any teardown whose own completion callback re-reads mutable state needs the state write to
    happen first, or the callback sees a lie.

39. **An inline `style=""` always wins over a stylesheet rule regardless of selector specificity — and
    this class of bug is invisible to a DOM-rendering test harness with no real CSS cascade** (`v84_l`).
    A pill's `background`/`border`/`opacity` had been set inline since one release, silently making
    every later `.active`/`.listening`/`.muted` class rule a complete no-op for TWO releases before
    anyone noticed — five releases' worth of mutation-tested unit tests stayed green throughout,
    because `test/lib-dom.js` renders the DOM tree but implements no CSS cascade. Found only by
    starting a real server and reading the element's actual COMPUTED style in a real browser. If a
    claim is about rendered/computed style rather than DOM structure, `test/lib-dom.js` cannot verify
    it — that claim needs either a live-browser check or a SOURCE-LEVEL guard (grep the inline style
    for the properties that must not be there), not a DOM-structure assertion that looks like it's
    testing the right thing.

40. **An "obviously safe" optimization that reads fresh state on every call can still defeat an
    existing guarantee whose enforcement actually lived in a step the optimization skips** (`v84_m`).
    Reusing an already-open speech-recognition session across two consecutive same-language questions
    looked safe — the phrase handler already re-reads `APP.cur` fresh every time, the standard defence
    against stale state. It wasn't: the real protection against a stale PREVIOUS question's phrase
    leaking into the CURRENT one was `_speechStopListening()`'s `.stop()` call cancelling that old
    phrase's pending timer before it could ever fire — an optimization that skips the stop, even while
    reading state correctly everywhere else, reopens exactly that hole. Mutation-test any reuse/skip
    optimization against every EXISTING guard the skipped step was part of, not just against the new
    behaviour it's meant to add. Corollary from the same release: when a test mock's shape stops
    matching the real API it mocks (here: turning `interimResults` on meant every real result now
    carries `isFinal`, which the mock hadn't been updated to set), EVERY existing assertion built on
    that mock can silently misclassify its inputs — a green suite proved nothing until the mock itself
    was fixed to match the real contract.


## Rules earned in the v85 line

41. **Before declaring a "needs a live model" item unreachable in a container, actually CHECK what is
    installed** (`v85_t`/`v85_u`). `curl localhost:11434/api/tags` cost one call and turned a would-be
    "owed by the user" item into a real, cited, live-probed measurement (`qwen2.5vl:7b` was already
    there). A "not doable in a container" list written by an earlier session can go stale exactly like
    any other claim in these documents — don't inherit it without checking.
42. **A rigorously measured finding for ONE contributing factor is not proof there is only one**
    (`v85_u`). The `v85_t` live probe measured a real model-accuracy limitation with real numbers —
    correct, and still true. The user's own next-session follow-up report ("when I zoom...") revealed
    a SECOND, fully-code-fixable bug (a canvas/image resize desync) that was very likely compounding
    on top of it, probably dominating what the original screenshot actually showed. Measuring one
    factor well is not the same claim as measuring the whole picture.
43. **Check whether an EXISTING ruling already answers what looks like a new design question — grep
    the roadmap before deciding fresh** (`v85_u`). "Move comic images out of `lessons.json`" was not a
    new problem needing a new decision; it was `D4` (a `v80`-era ruling) that a LATER feature
    (`v85_j`-`v85_p`) simply never implemented. The fix was "do what was already decided," and finding
    that took one grep, not a design session.
44. **Check whether server-side (or otherwise existing) plumbing already covers a requested
    client-facing feature before estimating its size** (`v85_u`). A "add a model picker for comic
    parsing" ask looked like a multi-layer feature; `/api/models` already accepted the exact field
    needed, unused by any client control. The real gap was one line in a `roles` array plus a
    genuinely new capability-filter concept — always check both sides before sizing a request.
45. **A "redacted equivalent" probe input (a crop of a screenshot, not the pristine original) is still
    a legitimate measurement — but the substitution must be stated as an explicit caveat next to the
    result, with reasoning about which direction it could bias the finding** (`v85_t`). The crop used
    still carried a prior (bad) detection's own overlay lines; reasoned explicitly that this should
    make the model's job EASIER, not harder, so a worse-than-expected result was not explained away by
    it.
46. **A hit-tested UI affordance (drag handles, click targets) that can overlap an EXISTING interaction
    on the same surface needs an EXPLICIT precedence rule, checked first, by construction** (`v85_t`).
    Panel-resize handles are checked BEFORE falling through to "start a new box draw" in the same
    pointerdown handler — not via a separate mode flag a caller could forget to set.

(If you add a new standing rule, append it here so the next session inherits it.)

---


---



# ✅ SHIPPED IN THE v86 LINE

## ✅ v86_af — inflection wrong choices must be DIRECT RELATIVES of the correct answer's own dimension

Follow-up to the "datief" report at `v86_ab`, refined by the user in the SAME conversation right
after that fix shipped: *"perhaps we should note in the roadmap whether to decide to only ask for
direct relatives of the asked form. for example for plural the only alternative wrong option is
singular."* — a stricter, more general rule than "the category must apply to the target language":
wrong choices must stay on the SAME grammatical axis (or axes) the correct answer's own `formLabel`
names, never introduce a DIFFERENT axis, even one that is genuinely real for that language.

**`PROMPTS.inflections`'s own `formChoices` instruction rewritten** to state this explicitly: if
`formLabel` names a SINGLE dimension (e.g. `"plural"` — number only), every wrong choice must ALSO
be a value of that SAME single dimension (e.g. `"singular"`) — never a value from an unrelated
dimension (case, tense, mood, degree), even one real for the language in general. If `formLabel`
COMBINES several dimensions (e.g. `"genitive plural"` = case + number), a wrong choice may vary ONE
of those SAME combined dimensions while keeping the rest, but must not introduce a dimension absent
from the correct answer. Keeps the concrete "Dutch has no case, so `datief` is doubly wrong for a
plural noun" counter-example from the original report, grounding the abstract rule in the real
incident rather than leaving it purely theoretical.

**Both worked examples fixed to comply with their own new rule** — the SAME "worked example
contradicts the instruction it demonstrates" class of bug fixed twice already this session
(`_comicExtractPrompt`, `v86_aa`, `v86_ab`): `default`'s `formChoices` shrank from
`["Plural","Singular","Possessiv","Präteritum"]` to `["Plural","Singular"]` (the correct answer names
ONLY number, so `Possessiv`/case and `Präteritum`/tense — the latter not even applicable to a NOUN's
inflection at all — were violations of the very rule they were meant to illustrate); `de`'s
`formChoices` shrank from `["plural","genitive singular","dative plural","singular"]` to
`["plural","singular"]` for the identical reason.

`test/unit-prompt-examples.test.js`'s own `v86_ab` assertion (which checked for the NOW-REMOVED
`Possessiv`/`Präteritum` terms as its own language-consistency proof) is updated to assert exact
equality (`["Plural","Singular"]`) instead — this simultaneously verifies the dimension constraint
AND stays a valid regression guard. New §6 asserts the system prompt's own instruction text names
the rule explicitly, keeps the concrete Dutch/dative counter-example, and that the `de` example ALSO
complies (`["plural","singular"]`). All mutation-tested.

Baseline: `node test/run.js` → 299 checks, unchanged (no new test file). `--quick` → 256, unchanged.
No new `en` keys. `docs/index.html` rebuilt (`APP_VERSION` bump only — `prompts.json` is server-side-
only). `lessons.json`/`canonical-analysis.json`/`ui.json` unchanged since `v86_ae` (336/97/714, no
drift). `APP_VERSION = 'v86_af'`.

**A NEW, related, still-OPEN finding surfaced while investigating this cut's own follow-up**: the
user's earlier `v86_ae` diagnosis (an `inflection_lemma` TTS voice bug) turned out to be a
misdiagnosis, corrected by the user directly — *"the lemmas where readin the correct voice, but the
grammar labels were in dutch but read in german, e.g. Tegenwoordige tijd, derde persoon enkelvoud."*
The real, ACTUAL lesson data (`ls_1788092767813`, generated ~2 hours after `v86_ab`'s own fix was
committed and hot-reloaded — `prompts.json` has a live `fs.watch` reload, confirmed no stale-server
explanation applies) shows `title`/`desc`/`formLabel`/`formChoices`/`explanation` ALL in DUTCH (the
TARGET language) instead of German (the source language, `{S}`) — every `{S}`-designated field
EXCEPT `translation` (whose own instruction — "a translation of the sentence" — is apparently
unambiguous enough on its own to survive). This means `v86_ab`'s fix (making the `default` example
internally consistent) was necessary but evidently NOT sufficient to reliably steer this real model
(`qwen3.6:35b-a3b`) for this real language pair — the surrounding prompt context is overwhelmingly
target-language (sentence, lemma, lemmaChoices), and a single worked example may not be a strong
enough counter-signal. `v86_ae`'s own TTS-silence fix is harmless and can stay (a defensible,
independent robustness improvement — a bare target-language word read by an unreliable device voice
is a real, separate risk), but it did NOT address the real reported symptom, since the lemma readout
was never actually broken. NOT yet fixed — needs a stronger prompt reinforcement AND a live-model
test against the real backend to confirm it actually works this time (each real generation call
against this real model take roughly 5-6 minutes, confirmed via this lesson's own `_genMeta.ms:
342510`) — the user was asked whether to proceed before any further prompt changes.

## ✅ v86_ae — `inflection_lemma`'s answer-reveal is now silent, not a mispronounced target-language word

User: *"I generated a new inflection class lesson `ls_1788092767813` for `tp_17880367188140000070`,
but the answer in Dutch is still readout with the German voice. Is it possible to just issue the
correct word form in German? That may be difficult for some languages, though. Please do as you
think works best. If it's difficult, we could also just omit the readout."* Also confirmed, in the
same message: `v86_aa`'s CP2 `"form"` fix is verified working after re-analysis — the annotation now
comes back in German as expected.

**Root cause, traced through the code, not guessed at**: `check()`'s answer-reveal read-out
(`speakOk`/`speakOkLang`, correct path; `speakBad`/`speakBadLang`, wrong path) already has a
deliberate exception for `inflection_form` (`v82_d`: its answer is a source-language grammatical
LABEL, spoken with the source voice) — `inflection_lemma` was deliberately left OUT of that
exception, since its own answer genuinely IS target-language text (a bare lemma, e.g. Dutch
`"boer"`), so the default (target-voice) behaviour was believed correct. It IS the designed,
documented, tested behaviour — `_ttsMakeUtterance`'s own "refuse rather than approximate" policy
(`v55_x`) only refuses when NO voice claims to match the requested language at all; it has no way to
detect a voice that CLAIMS to match (passes the `nl` filter honestly) but is not actually a reliable,
correctly-accented Dutch voice on this particular device/browser — a real-world TTS-engine
limitation outside this app's own control, not a logic bug in the language-selection code itself
(traced end to end: `speakOkLang`/`speakBadLang` both correctly resolve to `null` → `activeTtsCode()`
→ the lesson's own target language, exactly as designed and exactly as `unit-inflection-speak-lang`'s
own pre-existing regression guard already asserted).

**Fix, per the user's own explicit, accepted fallback**: rather than attempt a source-language
substitution (considered and rejected — there is no clean, short "German word form" of an isolated
target-language lemma to read instead; `explanation` is a full sentence, not a word, and building a
reliable single-word extraction would be its own scoped project, likely fragile across languages,
exactly the "difficult for some languages" the user themselves anticipated), `inflection_lemma`'s
answer-reveal now speaks NOTHING on either the correct or wrong path — still auto-advances
(`_speakAndAdvance`'s own `!text` short-delay path already handles a silent reveal correctly, no new
code needed there). `inflection_form` is completely UNCHANGED — its own source-language label
already speaks correctly and was not part of the report.

`test/unit-inflection-speak-lang.test.js`'s own former §3 (a `v82_d`-era regression guard asserting
`inflection_lemma` KEEPS speaking target-language audio) is REPLACED, not just extended — that
assertion is exactly what this cut intentionally reverses. New §3/§4 assert silence on both the wrong
and correct paths (§4 also confirms auto-advance still happens with nothing to speak); new §5 is the
non-vacuity regression guard confirming `inflection_form` is completely untouched. All mutation-
tested (removing either omission reproduces the exact predicted "still speaks" failure).

Baseline: `node test/run.js` → 299 checks, unchanged (no new test file). `--quick` → 256, unchanged.
No new `en` keys. `docs/index.html` rebuilt (client code change). `lessons.json`/
`canonical-analysis.json`/`ui.json` unchanged since `v86_ad`'s own commit (336/97/714, no further
drift). `APP_VERSION = 'v86_ae'`.

## ✅ v86_ad — the lesson-set card's own story display gains language flags + a real text explorer

Three rounds of "which card do you mean" before landing on the actual request — worth recording so
the next session recognises the pattern faster. User: *"i don't really see the lesson-set card's 🔤
button that now doubles as 're-analyze'"* → investigated and found the library-list row's own button
(the ACTUAL `v86_ac` target) does exist and work; the user's own next message — *"but the re-analyze
works for the button on the storyline card"* — narrowed it to a THIRD surface: the OPEN chapter's own
completion/progress card (`_renderCompStory`), which had 🔍 (view/auto-generate) but no FORCE-
regenerate control. A speculative fix was drafted there — then the user's actual, final clarification
arrived: *"i meant the lesson-set card that is only visible in teacher mode, it's text display should
also have language flags and text-analysis buttons."* That is `#story-section` ("📖 Read the story")
inside the `#lesson-set` screen (teachers land there per `v60`'s own routing; learners skip it
entirely) — a FOURTH, genuinely distinct surface with NEITHER flags NOR any analysis control at all
(its own 🔍 is `story-qc-btn`, QC proofreading, an unrelated feature). The speculative completion-
card fix was reverted before shipping, once the real target was confirmed — built exactly what was
asked, nothing extra.

**Scope confirmed with the user first** (full parity chosen over a lighter flags-only version):
reuse the exact SAME `_storyFlagButtonsHtml`/CP1-CP2 cache machinery
(`_teCacheStore`/`_ensureTextExplorerData`/`_textExplorerBodyHtml`) the completion card already uses
— proven ALREADY generic (chapter-id-keyed data, a plain HTML string, no DOM-id assumptions baked
in) — wired into `#story-section`'s own header/body instead, under a SEPARATE state pair
(`APP._lsStoryLang`/`APP._lsTextExplorer`, not the completion card's `APP._compStoryLang`/
`APP._textExplorer`): a teacher can have both this card AND a student-preview of the completion card
open in different senses at once, and toggling one must never silently flip the other's visible
state.

**`renderStoryText(d, targetEl)` gained the flags/explorer logic directly**, rather than a second
wrapper only some callers would use — every one of its 6 real call sites always passes the DEFAULT
`#story-body` (no caller ever supplies an explicit `targetEl`), so baking the new behaviour into the
ONE existing function keeps every caller (toggle-collapse, save/cancel story edit, retranslate,
QC-accept) automatically consistent, instead of some paths silently reverting the flags/explorer
state on their next re-render. `toggleLsStoryLang(lang)`/`toggleLsTextExplorer()` mirror
`toggleCompStoryLang`/`toggleTextExplorer` exactly, including the `v86_y` mutual-exclusivity fix
(turning the explorer on forces `target` and unclicks both flags; clicking either flag turns the
explorer off) — replicated here rather than re-derived, since it is the same design problem. `🔬`
(not `🔍`, taken by QC on this SAME row; not `🔎` either, already the AI-hunt checkbox's own icon
further down this same row) toggles the read-only view; the existing `🔤` `analyzeChaptersRun()`
single-chapter confirm/force flow (`v86_ac`) is reused verbatim for the force-regenerate control,
gated EXACTLY like `story-qc-btn`/`story-retranslate-btn` (`canGenerate && d.story`) — the read-only
`🔬` toggle needs no such gate, matching the completion card's own `🔍` (it can still show an
ALREADY-cached or statically-baked result with no live backend at all). `speakStory()` now also
reads whichever language is currently shown, rather than always the target story.

**Live-verified against a REAL Ollama backend, not just asserted** — a scratch, isolated server
instance (its own `LESSONS_FILE`/`CANONICAL_ANALYSIS_FILE`, a fabricated topic, real ids) confirmed:
flags render and toggle correctly (🇩🇪/🇬🇧, vocab-highlighted target text ↔ the real English
translation, screenshotted); clicking 🔬 genuinely kicks off a REAL `POST /api/analyze-chapter`
job against the real backend (`[qwen3.6:35b-a3b] CP2: analysing 1 sentence(s)…`, confirmed via the
real cache entry's own `status`/`step` fields) rather than merely toggling a client-side flag;
toggling 🔬 back off cleanly restores the plain vocab-highlighted view. This ALSO corrected an
earlier mistaken claim from `v86_ac` (see that section, amended above) that no backend was reachable
in this sandbox — one was, the first check at `v86_ac` was simply too impatient for a cold
`/api/info` response.

New test file `unit-lesson-set-story-explorer.test.js` (5 sections, all against the REAL DOM via
`loadClient()`/`buildPath()`, not mocks): button-visibility gating (matches
`story-qc-btn`/`story-retranslate-btn`'s own precedent exactly); target-vs-source rendering + flag
state; real per-word `<mark>` rendering from a seeded CP1/CP2 cache entry (caught a genuine fixture
bug along the way — a token missing its own `surface` field silently renders as if it were never
there, per `_teSentenceHtml`'s own forward-alignment contract, not a crash); flags/explorer mutual
exclusivity; `speakStory()`'s language-awareness. All 5 mutation-tested (each fix reverted in turn,
each corresponding assertion failed as predicted, restored). Also re-ran `unit-retranslate-story`/
`unit-story-panel-alignment`/`unit-story-unlocked-card` (existing tests touching
`renderStoryText`/`#story-section`) to confirm zero regressions from generalizing the shared
function — all pass unchanged.

Baseline: `node test/run.js` → 299 checks (298 + 1 new test file). `--quick` → 256. No new `en` keys.
`docs/index.html` rebuilt (client code change). `lessons.json`/`canonical-analysis.json` drifted
further from live concurrent usage during this cut (the user's own re-analysis testing of
`tp_17880367188140000070`, and their own ongoing `ui.json` translation work) — re-measured fresh at
commit time, corpus counts UNCHANGED at 336/97 despite the file-level drift.
`APP_VERSION = 'v86_ad'`.

## ✅ v86_ac — the lesson-set card's 🔤 button now doubles as "re-analyze," gated by a confirm warning

User: *"In teacher mode on the lesson-set card, I expected to be able to generate the text analysis
annotation, but I can't find it. Also there should be a way to re-generate it, e.g. now that the
prompt has changed, I want to delete the old and re-generate a new text analysis annotation for
`tp_17880367188140000070`."* Follow-up, converging on the exact same design independently: *"We can
just use the same button, but reroute via a warning that this would override an existing text
annotation."*

**The "can't find it" half**: the 🔤 button (`analyzeChaptersRun`, `v86_p`) already existed on the
lesson-set card (`savedItemHtml`), gated only on `APP.info.canGenerate && s.id` — no teacher-mode
requirement, genuinely reachable. Not a missing feature, just a small icon among several on a
crowded row; no code change made for discoverability alone (not asked for, and the fix below makes
the SAME icon do double duty, which is the more valuable improvement).

**The "re-generate" half, built**: `POST /api/analyze-chapter/:chapterId` now accepts an optional
`{force:true}` body. A new `deleteAnalysisChapter(chapterId)` (mirrors `writeAnalysisChapter`'s own
read-modify-write shape) removes the chapter's cached CP2 result FIRST when `force` is set, so the
route's existing cache-hit short-circuit naturally sees `available:false` afterward and a fresh job
starts — no separate "force" branch needed past the delete step. A no-op (returns `false`) when
nothing was cached, so `force:true` on a chapter that was NEVER analysed behaves exactly like a
normal first-time run.

**Client-side, exactly the design the user converged on**: `analyzeChaptersRun(chapterIds, btn)` — a
SINGLE-chapter call (the lesson-set card's own 🔤 button always passes `ids.length===1`) now does a
cheap `GET /api/analysis/:id` pre-check first; if that chapter is ALREADY analysed, `confirm()` asks
before overwriting (`text_explorer.confirm_reanalyze`), and only a YES sends `{force:true}` — a NO is
a true silent cancel (no server call at all, button restored, no toast). A never-before-analysed
chapter skips the confirm entirely. A multi-chapter BATCH call (the storyline page's own "analyze
all," `ids.length>1`) is deliberately UNCHANGED — no pre-check, no confirm, silent skip-if-cached —
asking once per chapter in a loop would be intrusive, and a batch's whole point is "fill in what's
missing," not "redo everything already done."

`test/unit-analyze-chapters-run.test.js` gained §6-9 (not-yet-analysed skips confirm and posts
without force; already-analysed + confirm posts `{force:true}`; already-analysed + decline makes NO
server call and shows no toast; a multi-chapter batch never confirms or pre-checks, unchanged
semantics) — all mutation-tested, including moving the button-disable/restore inside a single
`try/finally` that now also covers the pre-check, so a declined confirm still restores the button
correctly. `test/e2e-analysis.test.js` gained §7-8 (a real server, real fake-Ollama round trip: a
fresh, non-stale cache short-circuits WITHOUT force exactly as before, `force:true` genuinely bypasses
that short-circuit and re-runs CP2 — proven via the fake model's own call log, not assumed — and
`force:true` on a chapter that was NEVER analysed is a harmless no-op-delete). Mutation-tested
(removing the server-side `deleteAnalysisChapter` call reproduces the exact predicted failure).

New `ui.json` string: `text_explorer.confirm_reanalyze` (`en` only, per convention).

Baseline: `node test/run.js` → 298 checks, unchanged (no new test file — both new sections live
inside ALREADY-registered files). `--quick` → 255, unchanged. `docs/index.html` rebuilt (client code
+ 1 new `en` key: 713 → 714). `lessons.json`/`canonical-analysis.json` untouched by this cut's own
edits (still 336/97, no drift since `v86_ab`). Live interactive click-through was SKIPPED at the
time, believing no LLM backend was reachable in this sandbox (`canGenerate` false on a first, too-
quick check) — **CORRECTED at `v86_ad`**: a real Ollama backend IS reachable here, it just took
several seconds to answer `/api/info` on a cold check. The mutation-tested unit + e2e suites already
covered the exact same code paths end-to-end against a real (fake) server regardless, so nothing
built at this cut was actually unverified — only the STATED REASON for skipping a live click-through
was wrong, corrected honestly rather than left standing. `v86_ad`'s own release DID perform a real
live click-through against this same real backend, confirmed further down.
`APP_VERSION = 'v86_ac'`.

## ✅ v86_ab — the SAME class of bug, this time in `PROMPTS.inflections`'s own `default` worked example

Diagnosed at `v86_y` (user asked "analyze and suggest," not build yet), built now on the user's
explicit go-ahead — plus a live example that independently confirms it, reported while this cut was
already in progress: *"In `tp_17880367188140000070` inflection lessons, I get the question
'Welche grammatikalische Form hat boeren?' ... with the correct option explanation ... 'meervoud' ...
'Boeren' is het meervoud van 'de boer', gevormd door toevoeging van -en."* — `formLabel`/`explanation`
came back in DUTCH (the TARGET language `L`), not German (the SOURCE language `S`) as the schema
requires. A different wrong language than `v86_aa`'s CP2 finding (English), but the SAME root cause:
an under-specified worked example gives the model no reliable cue for which language a field belongs
in, so it drifts to whichever language is nearest at hand — sometimes English, sometimes `L`.

**Root cause**: `PROMPTS.inflections.examples.default` (`prompts.json`) — the ONLY example used for
any target language without its own dedicated entry (checked: only `default` and `de` exist; `nl`,
this report's own target, falls through to `default`). Its own schema instruction is explicit
(*"formLabel" names the grammatical form ... AS A SHORT PHRASE IN {S}*), but the worked example
itself demonstrated `formLabel:"plural"`, `formChoices:["plural","singular","possessive","past
tense"]`, and `explanation:"Plural of 'key', formed by adding -s."` — ALL in English — while its OWN
`translation` field is German (`"Die Kinder fanden zwei große Schlüssel..."`), meaning `S` for THIS
example is unambiguously German. The worked example directly contradicted the instruction it was
supposed to illustrate. (The `de` example was checked too and found NOT to have this defect — its own
`translation` is English, so its English `formLabel`/`explanation` ARE consistent with its own
implied `S`; only `default` was broken.)

**Fix**: rewrote `default`'s `formLabel`/`formChoices`/`explanation` into German, matching its own
`translation` field — `"Plural"`, `["Plural","Singular","Possessiv","Präteritum"]`,
`"Plural von 'key', gebildet durch Anhängen von -s."` — making the example internally consistent with
the instruction it demonstrates, the same remedy this project has now applied three times to this
exact class of bug (`_comicExtractPrompt`'s capitalization fix, `v86_aa`'s CP2 `"form"` fix, this).
This is a single, necessarily language-specific worked example — it cannot literally match every
possible `S` a learner might have, but an INTERNALLY CONSISTENT example (its own worked fields all
agree on one concrete `S`) gives the model a coherent language cue to generalize from, where a
self-contradicting one gives none.

**A related, separate observation, NOT fixed this cut**: the reported example's OTHER wrong
choice, `"datief"` (dative), is not a plausible distractor for Dutch at all — modern Dutch has lost
noun-case marking almost entirely (unlike German), so `"boeren"` has no dative form distinct from its
plural; asked directly, the user's specific question ("wouldn't datief also be correct?") is answered
NO twice over, not once — worked through in full with the user afterward: (1) `"boeren"` isn't even
in a dative-shaped SYNTACTIC role here (`raken` is plain transitive, taking a direct/accusative-type
object — Dutch grammar terms it *lijdend voorwerp*, not *meewerkend voorwerp*, the dative-like
indirect-object role), and (2) Dutch nouns don't morphologically mark case at all regardless, so
there is no separate "dative form" to select even in principle. This is not a second-correct-answer
bug, just an imperfectly-chosen distractor that borrows a German-shaped case category for a language
that doesn't have one.

Left open as a possible future refinement, not built without being asked — REFINED by the user's own
follow-up into something more specific than "distractor categories must apply to the target
language": *constrain wrong choices to DIRECT RELATIVES of the asked dimension* — e.g. for a
`"plural"` item, the only genuinely meaningful wrong choice is `"singular"` (the SAME dimension,
number, just the other value), not an unrelated dimension (case, tense, mood, …) that may not even
exist for this language/word at all. This is a STRICTER, more specific rule than "must apply to the
target language" — it would also improve languages that DO have case, tense, etc., by keeping every
wrong choice on the SAME axis as the correct answer instead of mixing axes. Not built.

`test/unit-prompt-examples.test.js` gained a new §5: parses the `default` example's one worked JSON
item and asserts `formLabel === 'Plural'`, `formChoices` contains the German-only terms `'Possessiv'`/
`'Präteritum'` (chosen specifically because `'Plural'`/`'Singular'` are spelled identically in English
and German, so those two alone can't distinguish the fix), and `explanation` starts with `'Plural
von'` not `'Plural of'`. Mutation-tested (reverting the fix reproduces the exact assertion failure).

Baseline: `node test/run.js` → 298 checks, unchanged (no new test file — the new assertion block
lives inside the ALREADY-registered `unit-prompt-examples.test.js`). `--quick` → 255, unchanged. No
new `en` keys. `docs/index.html` rebuilt (APP_VERSION bump only — `prompts.json` is server-side-only,
not a static-build input). `lessons.json`/`canonical-analysis.json` untouched by this cut's own edits
(still 336/97, no further drift since `v86_aa`'s own commit). `APP_VERSION = 'v86_ab'`.

## ✅ v86_aa — CP2's "form" field now uses the SOURCE language's own grammatical terminology, not English

User report, from real usage of `v86_z`'s just-shipped static text explorer: *"In the text explorer
the word analysis should ideally be in the source language. In `tp_17880367188140000070`, a
german->dutch lesson, they are in English."*

**Root cause, found by inspecting the real prompt, not guessed at**: `buildAnalysisPrompt()`
(`canonical-analysis.js`) instructs THREE of its four per-token fields explicitly in the source
language `S` — `"sense"` ("a short gloss IN " + S), the phrase `"gloss"` ("(in " + S + ")") — but
`"form"` (the grammatical-label field: part of speech plus inflection, e.g. "verb, 3rd person
singular past") had NO language instruction at all, and its own worked-example text
(`e.g. "verb, 3rd person singular past"`) was itself hardcoded English. A model given no language cue
for one field, sitting right next to two fields that explicitly ARE cued, defaults to English for
that field regardless of the actual source language — the exact same class of prompt-compliance bug
as `_comicExtractPrompt`'s earlier German-capitalization fix and the `formLabel` field in
`PROMPTS.inflections` (which already gets this right: *"formLabel" names the grammatical form ... AS
A SHORT PHRASE IN {S}* — the precedent this fix mirrors). Confirmed on the real corpus: the
already-cached `tp_17880367188140000070` analysis (nl-target/de-source) has every `"sense"` correctly
in German (`"Sie (Höflichkeitsform)"`, `"fahren Sie"`, `"jetzt"`, …) while every `"form"` is English
(`"pronoun, formal second person singular nominative"`, `"verb, present tense, 2nd person plural/formal
singular"`, …) — exactly the field-level split the report describes, not a wholesale language failure.

**Fix**: `"form"`'s own instruction now explicitly names `S` — *"given as a short phrase IN " + S + "
-- the grammatical TERMINOLOGY itself (the part-of-speech and inflection names, not just the gloss)
must be written in " + S + ", not English, unless " + S + " happens to be English"* — and the old
hardcoded English-only worked example is removed rather than translated (a fixed literal example in
one language would just recreate the SAME bug for every other source language, per this project's own
"worked example must match ALL cases the instruction covers" lesson from the `_comicExtractPrompt`
history) — the dimension list (case/number/gender/tense/person/mood/degree) already gives the model
enough shape without a language-specific literal.

**Scope note, stated plainly**: this changes the PROMPT only. The 3 chapters already cached in
`canonical-analysis.json` (including the reported one) keep their stale, English `"form"` values until
each is re-analysed (the existing 🔤 curator "analyze chapters" trigger, or the per-chapter 🔍
first-open path) — CP2 is a real model call per sentence, minutes each, so nothing was silently
re-run against the live corpus as a side effect of this fix.

`test/unit-canonical-analysis.test.js` gained a new assertion block: a dedicated
`buildAnalysisPrompt(..., 'Dutch', 'German')` call (mirroring the real nl-target/de-source report,
distinct language names on purpose so `L`/`S` can't be confused with each other) checks `"form"`'s own
instruction text names `S` ("German") explicitly, and that the old English-only worked example is
gone. Mutation-tested: reverting the fix reproduces the exact assertion failure.

Baseline: `node test/run.js` → 298 checks, unchanged from `v86_z` (no new test FILE this cut — the new
assertion block lives inside the ALREADY-registered `unit-canonical-analysis.test.js`, adding
assertions, not a counted "check"). `--quick` → 255, also unchanged. No new `en` keys. No client or
static-build CODE change this cut — the fix is entirely server-side, inside the CP2 model prompt —
but `docs/index.html` WAS rebuilt anyway: the live corpus drifted (338/99 → 336/97 topics/storylines)
between this cut starting and its own commit, purely from the user's own concurrent usage, and
`unit-static-freshness` correctly caught the resulting staleness. `lessons.json`/
`canonical-analysis.json` untouched by this cut's own edits — the `lessons.json` diff is 100% that
live drift. `APP_VERSION = 'v86_aa'` — the FIRST double-letter release this line (`v86_a`…`v86_z` used
up all 26 single letters; mirrors the `v81_z` → `v81_aa` precedent, and the `SESSION_PROMPT_v*.md`
regex already supports `[a-z]+` from that same earlier fix, so no test change was needed for the
naming rollover itself).

## ✅ v86_z — the text explorer (PLAN §7.0 CP1/CP2, item W) now works in the static build too

User ask: *"Can we build the text analysis explorer also into the static docs/index.html?"* Item W's
whole CP1/CP2 pipeline was live-only until this cut — `GET /api/analysis/:id` /
`POST /api/analyze-chapter/:id` have no equivalent on GitHub Pages, so the 🔍 button had nothing to
show there at all.

**Design, scoped before building**: `canonical-analysis.json` is OPTIONAL and typically covers only a
FEW chapters — CP2 is a real model call PER SENTENCE, minutes each, so nobody runs it for the whole
corpus at once (3 of 338 chapters analysed at this cut). Baking whatever exists is an honest snapshot,
not a promise every chapter works offline — the exact same "frozen at the last `build-static.js` run"
contract every other baked artifact in this file already has.

**`build-static.js`**: reads `canonical-analysis.json` (env-overridable via `CANONICAL_ANALYSIS_FILE`,
same convention `server.js`'s own `ANALYSIS_STORE_FILE` already uses — lets a test point it at an
isolated scratch file), transforms each cached chapter into the SAME shape `GET /api/analysis/:id`
returns for a hit (`available:true`, plus `sentenceCount`/`tokenCount`/`sentences`/`model`/
`analyzedAt`), and bakes the whole map as `const STATIC_ANALYSIS`. `stale` is ALWAYS baked `false` —
recomputing it live would mean shipping CP1's own re-hash logic (`canonical-text.js`, Node-only) to
the browser for this alone; a frozen snapshot has no live text to compare against regardless. A
MISSING `canonical-analysis.json` degrades to `{}`, not a crash — the whole build still succeeds.
Added as a 7th fingerprinted `BUILD_SOURCES` entry, so `unit-static-freshness` catches a stale docs/
build here exactly as it already does for every other baked input.

**Client (`index.html`)**: `_ensureTextExplorerData()` gained a static-mode branch — `typeof
STATIC_ANALYSIS !== 'undefined'` (the SAME convention `STATIC_LESSONS` checks already use throughout
this file) reads the baked snapshot directly and returns, NEVER calling `fetch` at all. Unlike the
live path, there is no retry-via-a-new-job option for a chapter absent from the bake — it degrades to
a clean `error` cache entry (`_textExplorerBodyHtml`'s existing status-line rendering, unchanged).
The 🔍 button itself already had no `canGenerate` gate (unlike the QC/retranslate buttons), so it was
already reachable in the static build — this cut is what makes clicking it actually WORK there.

**Live-verified, not just asserted**: served the freshly rebuilt `docs/index.html` from a plain static
HTTP server (no Node app server at all), loaded a REAL analysed chapter ("Cleanliness Command"),
clicked 🔍, and confirmed the actual rendered DOM contains real per-word `<mark>` elements sourced
from the baked data — screenshotted for a visual check, not just a `.includes('te-tok')` assertion.

New test files: `unit-static-analysis-bake.test.js` (2 checks, runs the REAL `build-static.js` as a
subprocess against isolated scratch files — a real bake, and a missing-file degrade) and
`unit-text-explorer.test.js`'s own new §8 (2 checks — a present chapter goes straight to `ready` with
zero `fetch` calls; an absent one degrades to `error`, also zero `fetch` calls). Both mutation-tested.

Baseline: `node test/run.js` → 298 checks (297 + 1 new test FILE, `unit-static-analysis-bake.test.js`
— `unit-text-explorer.test.js`'s new §8 lives inside an EXISTING registered file, so it adds
assertions, not a new counted "check"). `--quick` → 255 (the new file is not e2e-gated). No new `en`
keys, no server change this cut.
`docs/index.html` rebuilt after the `APP_VERSION` edit (now 7 baked inputs, up from 6).
`lessons.json`/`canonical-analysis.json` untouched by this cut's own edits — re-check for concurrent
live-usage drift regardless. `APP_VERSION = 'v86_z'`.

## ✅ v86_y — progress card: the text explorer and the two language flags are alternate views, not stackable; retranslate/language-view parity between the lesson-set and storyline pages

Two user-reported UI inconsistencies on the story-view controls, from real usage of `v86_v`-`v86_x`'s
own comic/translation work.

**1. The 🔍 text-explorer button and the two 🌐 language flags weren't mutually exclusive.** User's
report: *"the text analyzing button is an alternative to the two language flags, so when clicked the
language flag should look unclicked, and clicking on the flag should go to the other view."* Root
cause: `toggleTextExplorer()` forces `APP._compStoryLang = 'target'` on toggle-ON (the analysis is of
the target-language story), which meant `_renderCompStory()`'s own flag renderer still saw
`current === 'target'` and kept the target flag looking active — a learner saw a highlighted flag
while looking at a THIRD view neither flag actually produces. Fixed two ways: `_renderCompStory()`
now passes `null` for the "current" flag when explorer mode is on (matches neither flag's own
`current === lang` check, so BOTH render unclicked — no change needed to `_storyFlagButtonsHtml`
itself), and `toggleCompStoryLang(lang)` now also sets `APP._textExplorer = false` — clicking a flag
was previously a same-state no-op re-render while explorer was on (the flag STATE was already
'target'), so nothing visible happened at all.

**2. The retranslate button and the language-view flags weren't consistently available on both
surfaces.** User's report: *"the new translate button is available only on chapter-level (lesson-set
card), while the language switch to actually view the translation is only available on the storyline
(read full story) page. Both should be available on both cards, and on the storyline page, the
button should translate all chapters."* The lesson-set page's own 🔄 button (`v86_w`) had no
counterpart on the storyline "read full story" section at all. New `retranslateChain(chainId, btn)` —
reads chapter ids from the SAME `data-chain` JSON array `analyzeChaptersRun()`'s own button already
reads, POSTs `/api/retranslate-story` ONCE PER CHAPTER (sequential, one failure isolated from the
rest, same shape as `analyzeChaptersRun` itself), syncs the fresh translation onto BOTH
`APP.savedList` and the chain's own render cache so a re-render shows it immediately, then re-renders
the body and toasts a done/failed summary. `/api/retranslate-story` (server.js) now accepts EITHER
`{topic}` (name — the lesson-set page's own existing caller, unchanged) or `{topicId}` (id — this new
caller, which already has ids in hand and needs no name lookup). Gated the SAME way as
`#story-qc-btn` (`canGenerate` alone, open to anyone, no teacher-mode check) — matches
`#story-retranslate-btn`'s own already-corrected gate from `v86_w`.

**Baseline verified 296/296 clean (the state BEFORE this cut's two new test files) before either fix
landed** — both changes were made against a confirmed-green tree, not layered onto an unknown state.

Baseline: `node test/run.js` → 297 checks (296 + 1 new test file, `unit-retranslate-chain.test.js`,
which is NOT e2e-gated so it also runs under `--quick`). `--quick` → 254. 2 new `en` keys
(`toast.retranslate_batch`, `toast.retranslate_batch_failed`) — 713 total. `docs/index.html` rebuilt
after the `APP_VERSION` edit. `lessons.json` changed during this cut from the user's own concurrent
live usage (topic/storyline counts drifted more than once mid-session), not from any edit made here.
`APP_VERSION = 'v86_y'`.

## ✅ v86_x — comic text-review card: near-fullscreen grid layout, not a narrow single-column list

User feedback on `v86_v`'s own review card, from real usage: *"the popover for text confirmation
could be bigger and should allow to view the text without scrolling. it could be a whole page in the
sequence of pages for storyline generation."*

Asked the user to choose between a bigger modal and restructuring the card into its own wizard page
(a real architectural difference — a wizard page needs new back-navigation wiring and state to return
to panel-drawing if the user goes back). **User chose the bigger modal** — lower risk, no wizard
restructuring needed.

`comicOpenReview()`'s modal box grew from a fixed 520px to near-fullscreen (`95vw` × `90vh`), and —
the change that actually buys back vertical space — its body switched from a single-column flex list
to a **CSS grid** (`repeat(auto-fill,minmax(340px,1fr))`), so panels flow into multiple columns on a
wide screen instead of stacking one under another. Each panel's own fields grew too: the image
thumbnail from a fixed 72px to `max-height:160px` (scales with its own aspect ratio), the caption
input's font size up, and the in-scene textarea from 2 rows to 4 (the other half of "too small to
read without scrolling WITHIN one panel's own field," not just the overall box being too small).

**Visually verified** (not just asserted) at three viewport sizes on an isolated server instance:
desktop (1440×900) shows 3 columns, 6 panels almost fitting two rows with no scroll; a 7-panel case
scrolls the outer container gracefully (the deliberate safety net for a comic that genuinely has more
panels than fit); mobile (375×812) collapses to one column, images scale to fit width, confirmed via
`document.documentElement.scrollWidth` that there is NO horizontal overflow at any size.

New test (`unit-comic-review-card.test.js`'s own §1b): checks the ACTUAL markup `comicOpenReview()`
built (read back off the tracked overlay element's `innerHTML`), not a source-text regex over
`index.html` — mutation-tested by reverting the modal-box sizing back to 520px and confirming the
test fails.

Baseline: `node test/run.js` → 296 checks (unchanged — no new test FILE, one new assertion section in
an existing one). `--quick` → 253. No new `en` keys, no server change, `lessons.json` untouched.
`docs/index.html` rebuilt after the `APP_VERSION` edit. `APP_VERSION = 'v86_x'`.

## ✅ v86_w — comic-extract prompt: preserve visual line structure + restore punctuation; a new "retranslate story" button

Two independent, user-requested fixes from one real-usage report (a Dutch road-sign photo,
`photo_2026-08-29_20-55-02.jpg`, chapter `sl_169961753`).

**1. The `ai_error_hunt` the user asked for was ALREADY built, no code needed.** Their own manual
story edit (introducing newlines to split a run-on extraction) went through `/api/save-story` with
the AI-hunt checkbox on — the existing pure-diff machinery (`storyDiffSentences`, no LLM) already
recorded it correctly. Verified directly against the stored lesson before writing any code.

**2. `_comicExtractPrompt` now preserves real visual structure and restores natural punctuation, live-
verified against the actual reported photo (cropped to the sign's front face).** Two rounds:

- **Round 1 (verified real improvement):** signs and panels routinely group text into visually
  distinct chunks — a highlighted headline, a separate coloured banner, a final line — with NO
  punctuation marking the boundary. The prompt now instructs the model to insert a newline at a real
  structural break (colour change, boxed/highlighted band, an unusually wide gap) while explicitly
  NOT doing this for ordinary word-wrap. Live A/B on the real photo: the OLD prompt produced a
  garbled CAPTION/IN-SCENE split plus **fabricated text that isn't on the sign at all**
  ("ONTEIGENINGSDATUM: JUNI 16 2015 ZOEK DEZE TROUW" — a hallucination, not a newline-structure
  problem, but notably ABSENT from every new-prompt run). The NEW prompt correctly classified the
  whole sign as one IN-SCENE block (no spurious caption split) and separated it into four real lines,
  no hallucination, in 52-115s vs. the old prompt's 574s.
- **Round 2 (added per explicit user follow-up, UNCONFIRMED live):** the user also asked the prompt to
  restore natural capitalization AND punctuation (comic lettering conventionally omits both) —
  bounded by "only where certain, never inventing words." Added a paragraph mirroring the existing
  capitalization-restoration instruction's own shape and caveats. Live-tested against the SAME cropped
  photo: **byte-identical output to round 1** — no measurable effect on this specific image (the
  model already treats the stylized all-caps banner as an intentional label, not lowercased prose,
  and did not add the period a "500 meter van een N2000 gebied" sentence-end plausibly wants). Shipped
  anyway per the user's own explicit choice after being told plainly it wasn't confirmed to change
  anything here — low-risk (mirrors an already-working instruction's shape, doesn't conflict with
  anything) and may still help on a caption/image this test photo didn't exercise. Neither round
  reproduces the user's own ideal correction exactly (they used a BLANK-LINE break between the three
  real blocks and kept the two final sentences joined on one line; the model uses a single newline
  uniformly for every line-like separation it perceives) — a further refinement, not attempted this
  cut given diminishing live-test throughput under heavy concurrent Ollama load (each probe round took
  9-19 minutes here, contending with the user's own live model usage).

**3. A new "🔄 Retranslate" button** (user's own words: *"We need a button to retranslate a story
after we found and manually fixed errors in the original story, e.g. and especially an extracted
text"*) — a manual `/api/save-story` fix does NOT re-translate on its own (a real LLM call,
deliberately not triggered on every edit — same cost/latency reasoning as
`/api/storyline-retitle`'s own "not on every edit" precedent), so `storyTranslation` could silently
keep describing the pre-fix text indefinitely. New `POST /api/retranslate-story` route (mirrors
`/api/storyline-retitle`'s shape: find-by-name, one `callLLMTranslation` call, persist, return) plus a
client button next to the story's edit/QC icons, gated EXACTLY like `#story-qc-btn` (`canGenerate && d.story`) after a first draft's `_canEdit()` addition was caught and removed
(an editing action, hidden in the static build and for a read-only visitor). 4 new e2e checks + 4 new
client checks, all mutation-tested.

Baseline: `node test/run.js` → 296 checks (294 + 2 new test files). `--quick` → 253 (only
`unit-retranslate-story` runs under `--quick`; `e2e-retranslate-story` is e2e-only). No new `en` keys
beyond the 2 toast strings (`toast.retranslate_done`/`toast.retranslate_failed`) — 711 total.
`docs/index.html` rebuilt after the `APP_VERSION` edit. `APP_VERSION = 'v86_w'`.

## ✅ v86_v — comic panels: an intermediate text-review card between extraction and lesson generation

User-requested (real usage): "For extracted text from comic/images, we want an intermediate card
after successful text extraction where the user can go through each panel and the extracted text, to
edit and confirm the extracted text. Only THEN we move to lesson generation."

**Design**: a new `comicOpenReview()` opens a modal overlay listing every panel that has USABLE
extracted text (skips panels never extracted and panels whose extraction errored — nothing to edit
there), each row showing its cropped image plus an editable caption input and in-scene textarea,
seeded from that panel's own extracted text. Reached from BOTH the natural entry point (fired
automatically the instant `_comicExtractCheckOnce` applies a successful extraction) and the
pre-existing manual path (the "Create chapter" button, retargeted from `comicCreateChapter()` to
`comicOpenReview()`, for a user who dismissed the auto-popup and wants to reopen it before
generating). Confirming writes the edited buffer back onto `APP_COMIC.boxes` **by each panel's own
original index**, then calls the real, completely UNTOUCHED `comicCreateChapter()` — the gate sits
entirely above the existing chunk-building/POST logic, so every one of `unit-comic-chapter.test.js`'s
own tests of that logic keeps testing it directly, with no UI in between. Cancel is a true no-op:
edits live in a local buffer, never written onto `APP_COMIC.boxes` until confirm, so backing out
leaves the panel list exactly as extraction returned it.

**A real, pre-existing harness limitation surfaced and worked around**: this app's DOM test stub
(`test/lib-dom.js`) makes `addEventListener` a no-op by design (it exists to let render code execute
without throwing, not to simulate real event dispatch) — the first draft wired the modal's
interactivity through `addEventListener` closures exactly like `showChoiceDialog()`, which would have
made it **untestable for behaviour**, forcing a fallback to source-regex assertions (the exact
anti-pattern this project's own standing rules warn against: a regex can't see whether the code
actually RUNS, only whether it's present). Rewired to the SAME onclick/oninput-ATTRIBUTE convention
every other dynamically-rendered list in this file already uses (`comicDeletePanel`/`comicMovePanel`)
— `_comicReviewEdit`/`_comicReviewConfirm`/`_comicReviewCancel` are plain, directly-callable, directly
testable functions, not handlers only a real click event can reach. One test (verifying the automatic
open-on-extraction wiring) was ALSO caught being vacuous mid-development: a first mutation deleted the
real call but left an explanatory comment containing the same function-call text, which a regex-based
assertion couldn't tell apart from the real call — replaced with a behavioural test that stubs
`comicOpenReview` and calls the real `_comicExtractCheckOnce()`, which the same mutation now correctly
fails.

New test file `unit-comic-review-card.test.js` (6 checks): filtering to editable panels, buffer
seeding, edit-buffer isolation from `APP_COMIC.boxes`, confirm's by-original-index writeback (a
mutation writing by buffer position instead was caught), confirm calling the real
`comicCreateChapter()`, cancel's true no-op guarantee, and the automatic open-on-extraction wiring (a
mutation removing the real call was caught; the vacuous-comment version above was not — see the
harness-limitation note). Server untouched — `caption`/`inScene` were already plain client-held
fields all the way through to `comicCreateChapter()`'s own request-body construction, so no route or
job-pipeline change was needed for this feature at all.

Baseline: `node test/run.js` → 294 checks (293 + 1 new test file). `--quick` → 252. 5 new `en` keys
(`form.comic_review_title`, `form.comic_review_hint`, `form.comic_caption_ph`, `form.comic_scene_ph`,
`form.comic_review_confirm`) — 709 total. `docs/index.html` rebuilt after the `APP_VERSION` edit.
`APP_VERSION = 'v86_v'`.

## ✅ v86_u — `unit-article-choices` GREEN for the first time in NINE cuts: a real corpus-counting bug, found and fixed

The single most-carried-forward open item in this whole line, finally investigated at the user's own
request rather than flagged again. Real root cause found, explained, and fixed — not a threshold
tweak, not a test loosening.

**The failing lesson, found by name**: `tp_17879184840560000089` — "Een schoon bad" (a Dutch→Italian
bathroom-vocabulary chapter), grammar lesson `ls_1787920339622_0_grammar`. The test's own claim:
"every it article lesson still builds an MCQ (3 built, 1 did not)."

**Why Italian sits near the edge at all** (a real, measured linguistic fact, not a bug):
`_articleStatsFor` decides whether an article MCQ is answerable by checking, per gender class,
whether one article dominates ≥90% of observed cases — the same mechanism that correctly gives
English ZERO article MCQs (there genuinely is no single correct answer for "a/the"). German and
French sit near 100% (article ≈ fully determined by gender alone). **Italian does not**: its
masculine article splits between "il" (default) and "lo" (required before s+consonant/z/gn/ps/x/y-
initial nouns) — a PHONOLOGICAL condition the gender-only heuristic cannot see. Measured fresh over
the whole corpus: **91.7%** overall (33/36) — comfortably real, but close enough to the 90% cutoff
that a single lesson's own local mix can tip it either way.

**The actual bug**: `_forEachGrammarItem`'s own three-tier traversal ("this lesson, then the open
chapter, then the rest of the library") was built to feed a `Set`-building consumer
(`_pluralChoicesFor`), where visiting the same value twice is free. `_articleStatsFor` was later
layered onto the SAME traversal to COUNT occurrences into a ratio — and the three tiers overlap in
real use: the lesson passed as `items` normally belongs to the open chapter (`APP.lessonData`),
which is itself normally one entry in the full library (`APP.savedList`). Confirmed by reading the
real call site (`buildExercises`: `const lesson = APP.lessonData.lessons[lessonIdx];` — a direct
reference, not a copy): the currently-open lesson's own article mix was being counted **up to 3×**
the weight of every other lesson's — enough to flip the verdict for a language whose true ratio sits
close to the threshold. Checked across the WHOLE corpus (24 article-bearing grammar lessons, 6
languages): exactly **one** lesson was affected — "Een schoon bad" is the *only* Italian grammar
lesson containing an s+consonant-initial masculine noun (specchio, spazzolino — both "lo"); the other
three Italian grammar lessons are 100% "il," so they never encounter the split at all.

**Not a language-specific check anywhere** — the bug is entirely language-agnostic (a generic
counting defect in a shared traversal helper); it was only OBSERVABLE for Italian because Italian's
real ratio happens to sit close to the edge, not because anything in the code treats Italian
specially.

**Fixed**: `_forEachGrammarItem` now dedupes — `visitArray` skips an array it has already walked
(catches `items` vs. the SAME lesson reached again via `APP.lessonData.lessons`, always the same
object by construction), and `seenLessonIds` skips a lesson by id (catches the open chapter's own
lesson reached a THIRD time via `APP.savedList`, where a separately-fetched copy of the same topic
is a DIFFERENT object with the SAME lesson id, so array-identity alone cannot catch it). Verified
against the real corpus with a reference-faithful reproduction (matching the real app's own object
graph, not a naive re-serialized test double, which initially gave a misleading "still broken"
result until corrected): sample size now matches the unbiased, lesson-independent baseline EXACTLY
(n=36) for the previously-failing lesson, and zero of the 24 article-bearing grammar lessons flip
verdict depending on which one is "open."

**Mutation-tested**: the fix was reverted, the new dedicated test failed with the EXACT predicted
number (32 instead of 24 — matching the hand-computed triple-counted arithmetic precisely), then the
fix was restored and re-verified green — real evidence the guard fires, not just that it exists.

**Test coverage**: a new, corpus-INDEPENDENT fixture in `unit-article-choices.test.js` (§2b) —
20 "x"-article items plus an open lesson with a deliberate 2x/2y split; true ratio 22/24=91.7%
(predictable), triple-counted 26/32=81.25% (not predictable) — the EXACT shape and percentage of the
real bug, reproducible regardless of what lessons.json contains in the future. A second case proves
the id-based dedup specifically (a separately-parsed copy of the same lesson, reached via
`savedList`, not just the reference-equality path).

Baseline: `node test/run.js` → 293 checks (unchanged — no new test FILES, only new assertions inside
an existing one). `--quick` → 251 (unchanged). No new `en` keys. `lessons.json`/
`canonical-analysis.json` untouched. `docs/index.html` rebuilt after the `APP_VERSION` edit.
`APP_VERSION = 'v86_u'`.

## ✅ v86_t — comic-panel text: same padded card markup in EVERY view, not a bare unstyled sibling

**User-reported, via two real screenshots** (progress card vs. text-explorer view, same chapter):
the SAME chapter's text started at a visibly DIFFERENT horizontal position depending which view was
showing — "apparently one view has margins, the other doesn't." User's own diagnosis, exactly right:
*"these should really use the same code to display text, just update the highlighting colours."*

**Root cause**: `v86_q`'s own `_comicPanelImageStripHtml(d)` (translation view, text-explorer view)
returned an image-only strip, with the caller's own text HTML concatenated AFTER it as a separate
sibling string. The DEFAULT view's `_comicStoryPanelsHtml` nests image AND text inside ONE
`.comic-story-panel` card, so the text gets `.comic-story-panel-text`'s own `padding:10px 12px`. The
two follow-up views' text got NO such wrapper — it sat flush against the outer red-bordered card's
own padding instead, a real, visible margin mismatch.

**Fixed**: `_comicPanelImageStripHtml` is now `_comicPanelsFlatTextHtml(d, textHtml)` — it takes the
caller's ALREADY-BUILT text HTML as a parameter and wraps it in the EXACT SAME
`.comic-story-panel`/`.comic-story-panel-text` markup the default view's per-panel case uses. For
the common, single-panel case, image and text now share ONE card, pixel-identical structure to the
default view — differing only in which highlighting the text itself carries (vocab marks, plain
translation prose, or the text-explorer's per-word marks). Multi-panel (no real per-panel boundary
to split the flat text by, in either follow-up view) shows every image as its own card, then the
whole flat text as one further card — same visual language, not a literal per-panel pairing.

**A second, smaller cause found on the SAME real chapter, same session**: after the structural fix
above, the user reported the text still jumped, "minimally." Real cause: `.story-vocab-hl` (the
default view's own mark) is `font-weight:600`/`800`; `.te-tok` (the text-explorer's own mark) had no
`font-weight` at all, rendering at the browser's normal (400) weight — narrower per character than a
bold mark, which shifts word-wrap points even with identical padding/margins (the fix just above).
Fixed with one line (`.te-tok{font-weight:600}` — matches `.story-vocab-hl`'s own UNSOLVED weight,
since text-explorer marks have no solved/unsolved distinction of their own). **A genuine residual
difference remains, BY DESIGN, not a bug**: the default view marks only this chapter's OWN vocabulary
(a curated subset), while the text-explorer marks EVERY token (CP2's own "never omit a token"
design) — so a few function words (e.g. "questo") are bold in the explorer view but plain in the
default one. Matching that too would mean NOT marking every word in the explorer, defeating the
feature's own point; the user's own words after seeing this — "we can leave it if hard to fix" —
this is exactly that case, left as-is deliberately.

**Visually verified**, not just asserted, TWICE: a separate, isolated server instance (a different
port, never the user's own running dev server on port 3000) rendered the real reported chapter
(`tp_17877511606660000499`) in both views and the resulting screenshots were compared directly —
once after the structural fix (padding/margin now identical), once more after the font-weight fix
(line-wrap now visually identical too, for this chapter).

**Test coverage**: `unit-comic-story-panel.test.js`'s §9 (translation view) and
`unit-text-explorer.test.js`'s §4b (text-explorer view) both rewritten (not appended — the
invariant they pinned changed) to assert the real card count and nesting structure for both the
single-panel and multi-panel cases, not just "some markup changed." The font-weight fix itself has
no dedicated test (a `font-weight` CSS value has no behavioural assertion this suite's DOM harness
can meaningfully check — this was verified visually, the same way the bug itself was reported).

Baseline: `node test/run.js` → 293 checks (unchanged — no new test FILES, only rewritten assertions
in two existing files). `--quick` → 251 (unchanged). No new `en` keys. `lessons.json`/
`canonical-analysis.json` untouched. `docs/index.html` rebuilt after the `APP_VERSION` edit.
`APP_VERSION = 'v86_t'`.

## ✅ v86_s — text-explorer layout fidelity: reconstruct structure from the REAL story text, not CP1's lossy flag

**User follow-up on item W**: *"the text layout/formatting seems to be lost for the new text
analyzer view — ideally it should have the very same layout as the normal red→green highlighted
text view, such that switching just changes the colours and links."*

**Root cause, confirmed against real cached data (`tp_17877511606660000499`), not assumed**: the
first draft's own code comment claimed "a plain single newline WITHIN a paragraph is not preserved
at the sentence-record level at all" — checked against the ACTUAL stored sentence text and this was
WRONG. CP1's sentence splitter only breaks on recognized sentence-ending punctuation (`.!?`), so a
`\n` that falls elsewhere (e.g. after a colon, mid-sentence) survives VERBATIM inside
`sentence.text` — the bug was never data loss, it was that `_teSentenceHtml`'s own plain-text
segments were `escHtml()`-only, never converting an embedded `\n` to `<br>`, so the browser silently
collapsed it to a space. A SECOND, genuinely real gap: a single `\n` BETWEEN two recognized
sentences (no blank line) is indistinguishable from a plain space at the CP1 record level —
`paraBreakBefore` only captures the blank-line/paragraph case, both collapse to the same `false`.

**Fixed, both causes, entirely client-side — no CP1 change**: the first cause got a one-line fix
(`_teEscText`, `escHtml` + `\n`→`<br>`, applied to `_teSentenceHtml`'s plain-text gaps). The second
needed a genuine rewrite: `_textExplorerBodyHtml` no longer builds paragraphs from CP1's
`paraBreakBefore` flag at all — `_teStoryHtml` reconstructs the REAL gap between each sentence
directly from the raw story text (`d.story`, already sent to the client for every other view),
using the SAME forward-only `indexOf` alignment technique `_teSentenceHtml` already uses per TOKEN,
one level up per SENTENCE. A blank line in the real gap → a genuine new `<p>`; a single `\n` → a
`<br>`; anything else → the literal (normally just a space) — exactly `_storyParasHtml`'s own
two-tier rule, so switching between the two views now changes only colours and links, matching the
user's own explicit ask. Deliberately NOT built as a CP1 pipeline change (a new `lineBreakBefore`
field) — this whole track's own standing rule is that CP1/CP2 must stay useful for PLAN §7.0
generally, and reconstructing from the story text the client already has needed no such change.

**A related, deeper finding — recorded as item AG, not built**: while doing this comparison work at
the user's own request, `inflections`' lesson data for the SAME chapter was compared word-for-word
against CP2's own output (real data, "aiutateci"/"trovarlo") — CP2's `form` field is systematically
coarser than `inflections`' own decomposition (no clitic-pronoun attachment, no explanation field).
Per the user's own explicit direction ("enrich CP2" — not a parallel mechanism, since CP2 feeds all
of PLAN §7.0, not just item W), this is scoped as item AG below, not started.

**Test coverage**: `unit-text-explorer.test.js` extended — the real reported strings
(`tp_17877511606660000499`'s own story text) prove BOTH the mid-sentence and inter-sentence single
newline become `<br>`; a genuine blank line still starts a real new `<p>`, not just another `<br>`;
ordinary prose (a plain space, no newline anywhere) is completely unaffected — three real risk
directions a change like this could get wrong, all separately checked.

Baseline: `node test/run.js` → 293 checks (unchanged — no new test FILES, only new assertions
inside the existing `unit-text-explorer.test.js`). `--quick` → 251 (unchanged). No new `en` keys
(704, unchanged). `lessons.json`/`canonical-analysis.json` untouched this cut. `docs/index.html`
rebuilt after the `APP_VERSION` edit. `APP_VERSION = 'v86_s'`.

## ✅ v86_r — the SECOND write path to `topic.story` never got the `v86_g` comicPanels sync (real user bug)

**User-reported LIVE bug**, unrelated to item W: a comic/image chapter's progress card
(`sl_1597155858` / `tp_17877511606660000499`, "Cleanliness Command") showed a stale, garbled
OCR typo ("vorrestevoletrovarlo") that had been corrected via an `ai_error_hunt` lesson weeks
earlier — the storyline reader showed the fix correctly, the progress card did not. The user's own
words: "I thought we fixed this in a previous session" — they had: `v86_g` fixed exactly this class
of bug, but only for ONE of TWO independent code paths that write `topic.story`.

**Root cause**: `_comicStoryPanelsHtml` (index.html) renders a comic-sourced chapter's progress card
from `comicPanels[i].caption`/`inScene`, NOT from `story` — a separate copy of the text extracted
once at upload time. `v86_g` synced this inside `POST /api/save-story` (the story-repair UI / error-
hunt editor's own "corrected story" field). It did NOT touch `POST /api/story-qc/accept` — the route
that applies a STORED QC PROPOSAL and rebuilds the `ai_error_hunt` lesson from the diff, a second,
architecturally separate write to `t.story` — because that route did not exist yet, or was not
checked, at the `v86_g` cut. The user's real chapter has an `ai_error_hunt` lesson, confirming the
correction went through THIS route, not the one `v86_g` fixed.

**Fixed**: the exact same sync logic (`comicPanels[0].caption = story; delete comicPanels[0].inScene`,
single-panel chapters only — multi-panel stays deliberately unfixed, item O, genuinely ambiguous
which edited sentence belongs to which panel) now also runs inside `/api/story-qc/accept`, right
where it writes `t.story`. `e2e-story-qc-accept-comic-sync.test.js` (3 checks) mirrors
`e2e-save-story-comic-sync.test.js`'s own structure exactly, using the user's REAL reported strings
as its fixture, and re-confirms the multi-panel/no-comicPanels cases stay correctly untouched.

**A real backfill was also needed** — the fix only prevents this going forward, it does not
retroactively repair a chapter already stale. `backfill-comic-panel-sync.js` (new, dry-run by
default, matching the project's existing `backfill-*.js` convention) scans every comic-sourced
topic for a single-panel `comicPanels[0]`↔`story` mismatch. Run in report-only mode first against
the real corpus: **8 comic-sourced chapters, 0 multi-panel, 7 already in sync, exactly 1 stale** —
the user's own reported chapter, no other hidden victims. Run again with `--write` (user's own
explicit "yes", per the standing rule on touching their real data) — confirmed idempotent by a third,
final dry run (0 stale after).

Baseline: `node test/run.js` → 293 checks (292 + this cut's 1 new test file). `--quick` → 251
(unaffected — the new test is e2e-only, same as its `v86_g` sibling). No new `en` keys (704,
unchanged — no user-facing string change). `lessons.json` changed exactly ONE field on ONE topic (the
user's own explicit request, applied via the backfill script, not a direct hand-edit) —
`git status --short lessons.json` shows the diff, confirmed to be nothing else. `docs/index.html`
rebuilt after BOTH the `APP_VERSION` edit and the `lessons.json` backfill. `APP_VERSION = 'v86_r'`.

## ✅ v86_q — two more item W follow-ups: comic panel images in every view, a batch curator trigger

Both asked in chat during the same live-testing session as `v86_o`/`v86_p`.

**1. Comic panel images now show in the TRANSLATION and TEXT-EXPLORER views too** (previously
target-language-only). `_comicStoryPanelsHtml`'s own per-panel image+caption pairing (the default
view) can't be reused for either — the translation is ONE flat `storyTranslation` string for the
whole chapter (no per-panel translation to pair an image with), and CP1/CP2's own sentence records
have no panel-boundary awareness at all. A new, simpler `_comicPanelImageStripHtml(d)` shows the
images ALONE (same bordered/rounded `.comic-story-panel` card look, no caption underneath),
prepended to the existing flat-text rendering in both `_storyBodyHtml`'s `highlight:false` branch
(translation) and `_textExplorerBodyHtml` (both its `ready` and empty-sentences fallback paths). A
harmless no-op (`''`) for any non-comic chapter — every existing plain-text render path is
byte-unaffected. `unit-comic-story-panel.test.js`'s own §9 (REWRITTEN, not appended — the invariant
it pinned, "translation shows no panels," is no longer the desired behaviour) and a new §4b in
`unit-text-explorer.test.js` both prove the real per-panel image data reaches the DOM, and that a
plain (non-comic) chapter is unaffected.

**2. A `analyzeChaptersRun()` batch curator trigger** — "we should be able to generate this during
normal lesson generation" (v86_p) covered NEW chapters; this covers chapters that ALREADY exist. A
new 🔤 button (deliberately NOT 🔍 — that's QC's own icon on the exact same row, the user's own
explicit reason for a different one) on both the storyline header card (batches every chapter in the
storyline) and the individual lesson-set/chapter card (`savedItemHtml`, one chapter). Unlike `qcRun()`
— its direct architectural precedent, but a genuinely different shape — this takes a raw chapter-id
ARRAY (not a `{storylineId}`/`{topicId}` scope object): CP1/CP2 has no server-side "resolve a
storyline to its chapters" endpoint of its own, so the client already has the ids in hand at render
time (the SAME `data-chain` attribute the export/delete buttons already carry) and loops itself,
POSTing `/api/analyze-chapter/:id` per chapter — no new server code at all, reusing `v86_o`'s existing
route (cache-hit short-circuit, `analyzingChapters` dedup) unchanged. Deliberately fire-and-forget
PER CHAPTER, not `qcRun()`'s blocking poll-to-completion shape — CP2 is minutes per chapter, so
waiting would tie up the tab for a whole storyline; each server-side job keeps running regardless of
whether the client tab stays open (the kickoff POST returns as soon as the job is scheduled, not
when it finishes — the same fire-and-forget property `postGenAnalysis`'s own kickoff already has).
One summary toast reports the real tally (queued / already-cached / failed) once every chapter's
kickoff has been attempted.

A real, unrelated test broken and fixed while building this: `unit-provenance-fields.test.js`'s own
§(v74_h) PINNED the exact count of icon-buttons on a storyline chapter card at three (continue/QC/
delete) — a legitimate invariant that needed updating, not a false alarm, once a fourth real action
was intentionally added; updated to four and re-verified the new assertion actually fails without
the button (mutation-tested by construction, having just watched it fail for the right reason before
the fix).

**Test coverage**: `unit-analyze-chapters-run.test.js` (5 checks, client-only) — no-backend and
empty-array degrade to a safe no-op; one fetch per chapter in the array's own order; cached vs.
queued correctly tallied in the toast; one chapter failing does not abort the rest, surfaced in the
toast; the button is disabled+hourglassed mid-run and restored to its exact prior state after.

Baseline: `node test/run.js` → 292 checks (291 + this cut's 1 new test file). `--quick` → 251.
2 new `en` keys (`text_explorer.batch_toast`/`batch_failed`; 702→704). `lessons.json` untouched
throughout. `docs/index.html` rebuilt after the `APP_VERSION` edit. `APP_VERSION = 'v86_q'`.

## ✅ v86_p — item W follow-up: an opt-in `postGenAnalysis` checkbox, mirroring `postGenStoryboard`

Picked up directly from the user's own live-testing session on `v86_o` (asked in chat, not
pre-scoped in the roadmap): "we should be able to generate this during normal lesson generation" —
resolved as an opt-in checkbox (default OFF) rather than automatic, given the measured real cost
(one model call PER SENTENCE, ~3+ min/sentence on this container's CPU-only inference — automatic
would add tens of minutes to every generation, most of which would never be explored via the 🔍
toggle). The user explicitly asked to mirror `postGenStoryboard`'s own existing opt-in pattern.

**Server (`server.js`).** A shared `_kickOffAnalysisJob(topic)` helper factored out of the
`POST /api/analyze-chapter/:chapterId` route (v86_o) — the SAME lock/dedup logic
(`analyzingChapters`, cache-hit short-circuit) now has exactly one implementation, used by both the
route (needs jobId/cached info to answer the HTTP request) and the new caller below (fire-and-forget,
no HTTP response to shape). Defined INSIDE `boot()`, alongside `_runBookJob` — it needs `active`
(the resolved LLM-backend state) in scope, which is `boot()`-local, the same reason `_runBookJob`
itself already lives there. `base.postGenAnalysis` (threaded from `body.postGenAnalysis`, mirroring
`postGenStoryboard` verbatim) gates ONE call to `_kickOffAnalysisJob(saved)` right where each chapter
is persisted inside `_runBookJob`'s own per-chapter loop — **per chapter, not once per storyline**
(unlike the storyboard post-pass, which genuinely needs every chapter's summary first; CP1/CP2
analysis has nothing to gain from waiting, so it fires the instant its own chapter is saved and never
blocks the NEXT chapter's generation).

**Client (`index.html`) — THREE call sites, matching `postGenStoryboard`'s own three exactly:**
1. `#pdf-analysis-cb` (PDF upload card), sibling to `#pdf-storyboard-cb` — threaded into
   `pdfGenerateAll()`'s request body.
2. `#comic-analysis-cb` (comic upload card), sibling to `#comic-storyboard-cb`, same visibility
   toggle as that row (`_comicRenderList`'s own `sbRow`/`anRow` logic — hidden until at least one
   panel exists) — threaded into `comicCreateChapter()`'s request body.
3. `#post-gen-analysis-cb` (`#post-gen-row`, the plain multi-chapter "Generate new" flow's own
   post-gen options), sibling to `#post-gen-storyboard-cb`/`#post-gen-qc-cb` — threaded into
   `doGenerate()`'s INITIAL request body directly. **Deliberately NOT added to the `postGen` object**
   that feeds `_applyPostGenFeatures()` (storyboard/QC's own POST-HOC orchestration, run after the
   book completes) — analysis needs no such orchestration, since `_kickOffAnalysisJob` already fires
   server-side inside `_runBookJob` itself. This third call site was found by reading
   `unit-postgen-storyboard-optin.test.js`'s own §2 while writing this cut's tests — the original
   plan (chat discussion) only anticipated the PDF/comic cards, missing that `doGenerate()`'s
   generated-multi-chapter branch is a THIRD, independent caller of the same request shape.

All three reuse the SAME `ui.json` key (`gen.post_gen_analysis_lbl`, 🔤, 1 new `en` key) that the
`postGenStoryboard`/`postGenQc` labels already established the precedent for.

**Test coverage**: `e2e-postgen-analysis-optin.test.js` (3 checks, real server + fake Ollama,
mirrors `e2e-postgen-storyboard-optin.test.js`'s own structure) — omitting the flag starts NO
analysis job at all (proven via the fake's own request log, zero `canonical_analysis` calls);
`postGenAnalysis:true` fires a REAL per-chapter job that actually completes and caches (not just "a
job started"); a multi-chapter book fires ONE job PER CHAPTER, not once for the whole book.
`unit-postgen-analysis-optin.test.js` (5 checks, client-only) — all three call sites thread their own
checkbox state into the request, both checked and unchecked.

Baseline: `node test/run.js` → 291 checks (289 + this cut's 2 new test files). `--quick` → 250. 1 new
`en` key (701→702). `lessons.json` untouched throughout. `docs/index.html` rebuilt after the
`APP_VERSION` edit. `APP_VERSION = 'v86_p'`.

## ✅ v86_o — item W steps 2-4: background CP1+CP2 job, per-chapter cache, GET shadow, client "text explorer" view

Picked up from `v86_n`'s own "WHERE TO START" — a fresh session with a full, unhurried budget, per
rule 9 (a track tagged "(multi-session)" is a standing judgment call, not overridden without a real
reason). Builds all three remaining steps of item W's recommended path in one cut.

**Step 2 — background job + per-chapter cache (server.js).** `ANALYSIS_STORE_FILE`
(`canonical-analysis.json`, env-overridable via `CANONICAL_ANALYSIS_FILE`) is read fresh from disk
each call, same "absence is the normal case" philosophy as `CURRICULUM_PLAN_FILE` — but UNLIKE that
file (a manually-produced CLI artifact server.js never writes), this one genuinely IS written by the
server: `_runAnalysisJob(jobId, topic)` runs CP1 (`buildCanonicalText`, instant) then CP2
(`analyzeChapter`, one model call per sentence, sequential) and caches the result keyed by chapter
id, mirroring `_runComicExtractJob`/`_runComicDetectJob`'s exact `newJob`/`jobStep`/`jobDone`/
`jobFail` shape — the precedent item W's own recommended path named. `analyzingChapters` (a
`chapterId -> jobId` Map, same pattern as the existing `generatingTopics` lock) prevents a second
concurrent request for the SAME chapter from starting a duplicate multi-minute job — it reuses the
in-flight job's id instead. Each cached record is enriched with CP1's own raw sentence `text` and
`paraBreakBefore` flag (canonical-analysis.js's own `analyzeChapter` deliberately does not carry
these — CP2 is token-level analysis, not a second copy of CP1's sentence boundaries) so the client
renderer (step 4) needs no second CP1 pass of its own to place tokens back into the real story
layout.

**Step 3 — GET endpoint mirroring `cp5ShadowFor`'s own shape (server.js).**
`GET /api/analysis/:chapterId` — absent → `available:false`, no legacy behaviour change, same as
`cp-shadow`. One field `cp5ShadowFor` has no analogue for: `stale` — re-hashes the chapter's LIVE
story text via CP1 (cheap) on every read and compares against the hash recorded at analysis time; a
post-analysis story edit marks the cached result stale WITHOUT deleting it (old-but-labelled beats a
silent gap). `POST /api/analyze-chapter/:chapterId` is the trigger half: a fresh, non-stale cache hit
short-circuits with `200 {cached:true, ...}` (no job at all — repeat "hover mode" visits cost
nothing); otherwise it starts (or reuses, via `analyzingChapters`) a job and returns `202 {jobId}`,
polled through the EXISTING `/api/job/:id` route every other background job already uses.

**Step 4 — the client "text explorer" view (index.html).** A 🔍 toggle button
(`#comp-story-explorer-btn`) next to the translation flags in the progress card's story panel.
`toggleTextExplorer()` forces the flag state back to `'target'` on toggle-ON — the analysis is of
`topic.story` specifically, so a translation view has nothing to show. `_ensureTextExplorerData()`
fetches the GET shadow; on a miss/stale result it POSTs the job-kickoff route and hands off to a
poller (`_startTextExplorerJob`/`_textExplorerCheckOnce`) built as a structural sibling of the three
comic pollers (`_startComicExtractJob` etc.) — SAME 2s-interval shape, and hooked into the SAME
shared `visibilitychange` listener those three already use (`v86_d`'s mobile-backgrounding fix), since
CP2 is the slowest job this app kicks off (minutes, not seconds) and a backgrounded tab missing its
own poll matters here at least as much as it does for comic extraction.

The view itself (`_textExplorerBodyHtml`/`_teSentenceHtml`/`_teTokenMarkHtml`) is built DIRECTLY from
the cached per-sentence data, not by highlighting an already-rendered story the way
`_highlightVocabHtml` works for the vocab view (that function matches a shared WORD LIST via one
regex pass; per-token analysis has no such list, and the same surface form can carry a different
analysis at a different occurrence). Each sentence's raw text is walked with a cursor; each token's
`surface` is located by a forward-only `indexOf` from where the previous token ended, so tokens are
never rejoined with a guessed whitespace rule — a token that cannot be found (index drift) is simply
skipped, surviving as part of the surrounding plain text instead of corrupting the rest of the
sentence (same "degrade, don't corrupt" convention as `_highlightVocabHtml`'s own regex-compile
fallback). Click (`_teShowWordPopover`) shows lemma/form/sense/confidence in a small popup — same
`position:fixed`, computed-from-click-coordinates, dismiss-on-next-document-click shape as
`openRetitleMenu` (the storyline retitle menu), re-derived rather than shared since that one is a
button list and this is a read-only info card. New CSS (`.te-tok`/`.te-tok-low`/`.te-tok-unresolved`/
`.te-status`) uses a distinct cooler-toned palette from `.story-vocab-hl` so the two views read as
different features — "what is this word" vs. "have I learned this word". 9 new `en`-only `ui.json`
keys (`text_explorer.*`).

**Two real bugs found and fixed by the tests written for this cut, not just written to pass:**
1. **A test-isolation bug** (`e2e-analysis.test.js`'s own first draft): `boot()` was called with no
   `CANONICAL_ANALYSIS_FILE` override, so the new store's default path (the real, committed-adjacent
   `canonical-analysis.json` in the project root) received real fixture data from the test run —
   confirmed via `git status --short` showing it as a new untracked file. UNLIKE `curriculum-plan.json`
   (never server-written, so `unit-cp5-shadow.test.js` can safely rely on the real root's copy being
   absent), this store genuinely IS written by the job under test, so every boot needs its own scratch
   file — fixed the same way that file's own `scratchPlan` fixture does, via `tmpFile()` + `extraEnv`.
2. **A genuine self-mutation bug**, caught by `unit-text-explorer.test.js`, not a fixture accident:
   `_ensureTextExplorerData`'s first draft created a fresh cache entry with `status:'loading'`, THEN
   immediately checked "is the status ready/loading/analyzing — if so, bail", which matched the entry
   it had JUST created on every single call, so the very first invocation always short-circuited
   before ever fetching anything. Fixed by checking a PRE-EXISTING entry (looked up before this call
   creates its own) rather than the one just created — the mutation-testing discipline this project's
   own rules ask for (rule: "break the thing a guard claims to protect and watch it go red") caught
   this on the first real run, not a review.

**Live-verified, not just fake-LLM-tested** — CP2's own real cost was explicitly the thing to budget
for this cut. A separate, isolated server instance (its own port, its own scratch cache file, real
Ollama, `qwen3.6:35b-a3b` — never touching the user's own long-running dev server, already running
against the same `lessons.json`) analysed `tp_17865786341910000220` ("Vittoria Ingannevole", de→it) —
the SAME chapter the `v83_n`→`v83_p` note already measured, chosen deliberately for a direct
comparison against evidence already on record. **Timing**: 4 sentences / 26 tokens took ~13-14 minutes
wall-clock on this container's CPU-only inference (`ollama ps` showed `size_vram:0` for every loaded
model) — consistent with (slightly over) the roadmap's own prior "12+ minutes even on a warm model"
finding; not a new problem, and not investigated further, since it is inherent to the container's
hardware, not this feature's code. **Quality**: zero apparent wrong lemma/form/sense across all 26
tokens, matching run 2's original 0/8 finding for this exact chapter — `Riese` correctly lemmatised
singular → `gigante`; `geben`/`GIBT` correctly read idiomatically → `esiste (in senso impersonale)`;
`SIE` (chapter 4, "she was re-elected") correctly tagged grammatically FEMININE, matching `die
Regierung` and not the neuter `das Land` — the same cross-sentence antecedent resolution the original
CLI run demonstrated, visible here in the grammar tag itself rather than a separate field; `KAM`
(lemma `kommen`, sense `venne`) confirms the `v83_p` surface/sense register-matching fix holds in this
exact production code path. PLUS 4 well-formed multi-word phrases the original single-chapter
CLI-only measurement did not separately call out (`es gibt keine`, `sich mit etwas brüsten`, `dank
ihr`, `wieder gewählt werden`). The one already-known, already-documented gap (no function-word
filtering — bare `EIN` still surfaces as its own vocabulary-shaped item) is UNCHANGED, not a new
finding.

**Test coverage**: `e2e-analysis.test.js` (7 checks, real HTTP round trips against a fresh-spawned
server + fake Ollama) — job lifecycle to `done`, one model call per sentence proven via the fake's own
request log, a fresh cache hit short-circuits with no new job/call, a story edit marks the cache stale
without deleting it, a stale chapter genuinely re-analyses, and two concurrent POSTs for the same
chapter share one job. `unit-text-explorer.test.js` (9 checks, client-only via `loadClient`) — toggle
state/fetch orchestration, cache-hit vs. job-kickoff paths, forward-only token alignment (including
the "token not found, skip without corrupting" case), all four render states, HTML/attribute injection
safety for a hostile lemma/form/sense, and an end-to-end DOM check that explorer-ON actually paints
real per-word marks (and explorer-OFF cleanly reverts).

**Not done this cut, explicitly**: the question-panel's own story view (`_exStoryPanelHtml`) did not
get the explorer toggle — only the completion/progress card panel did, per item W's own original ask
("the progress card's vocab highlighting"); extending it is a natural, small follow-up once this
lands. No richer "analysing…" progress UI than a single status line (no per-sentence progress bar). No
auto-refresh-on-stale — a stale cache is served labelled, not silently re-triggered.

Baseline: `node test/run.js` → 289 checks (287 + this cut's 2 new test files: `e2e-analysis.test.js`
and `unit-text-explorer.test.js`, one `run()` call each). `node test/run.js --quick` → 249 (`
unit-text-explorer.test.js` runs in `--quick` too — pure client-DOM, no server spawn — but
`e2e-analysis.test.js` is e2e-only). 9 new `en` keys (692→701). `lessons.json` untouched throughout
(`git status --short lessons.json` confirmed clean before and after). `docs/index.html` rebuilt AFTER
the `APP_VERSION` edit (not before — the exact ordering mistake `v86_m`/`v86_n` both made and caught,
not repeated this time). `APP_VERSION = 'v86_o'`.

## ✅ v86_n — PLAN §7.0 CP2 groundwork: a new `analysis` model role (item W reconciliation, step 1 of 4)

Step 1 of the 4-step recommended path from item W's reconciliation with `PLAN §7.0` CP5 (see the
`roadmap: item W reconciled…` doc-only commit immediately before this release) — the small, mechanical,
independently-verifiable piece, deliberately separated from steps 2–4 (background-job design, the GET
endpoint, and the client UI), which the user and I agreed belong in a FRESH session (this track is
explicitly tagged "(multi-session)" in `PLAN §7`'s own heading, and this session had already shipped a
full release plus a long investigation before this point).

**Built**: `OLLAMA_ANALYSIS_MODEL`, a new server.js model role for `PLAN §7.0` CP2's per-token
lemma/form/sense pipeline (`canonical-analysis.js`'s `analyzeChapter`/`analyzeSentence`) — mirroring
the exact pattern every other role already uses (`currentModels()`, `setRuntimeModels()`, `/api/models`
GET+POST, `/api/info`), so a future CP1/CP2 browser integration has real, independently-switchable
infrastructure to call into rather than a hardcoded model string. **Nothing calls it yet** — no
`callLLMAnalysis()` wrapper exists, no route reads it — this cut is purely the role/config plumbing,
by design (see item W's own recommended-path step 1).

Two deliberate choices, each grounded in a decision already recorded in this same roadmap file rather
than invented fresh: (1) **falls back to `OLLAMA_MODEL`/the `all` convenience override**, unlike
`OLLAMA_VISION_MODEL` — analysis needs no special model capability the way vision does, so the general
"one model for everything" override is a legitimate fit here, not a footgun. (2) **defaults to
`OLLAMA_MODEL` itself, not `canonical-analysis.js`'s own CLI-script default (`qwen2.5:7b`)** — that
default is the cheap dev-check model, and this same roadmap file's own `v83_n`→`v83_p` note already
measured it as demonstrably worse on this exact task (2/8 words wrong vs. the production model's 0/8)
and explicitly warned against reusing it as a browser default without re-measuring. Not wired into
`OLLAMA_THINK` — `canonical-analysis.js` already passes `think:false` itself at the call site, so no
role-level toggle applies.

**Test coverage**: `e2e-models.test.js` extended (§6c) — analysis defaults to the boot model, switches
independently of every other role (qc/translation left untouched), is validated against installed
models exactly like every other role, is exposed on `/api/info`, and the `{model}` convenience sets it
too (unlike vision). Mutation-tested (dropped the `if (analysis) OLLAMA_ANALYSIS_MODEL = analysis`
assignment) — caught, restored, diff clean. `INTERNALS.md`'s model-roles table gained a new row
alongside `OLLAMA_VISION_MODEL`'s own.

**docs/index.html rebuilt** (APP_VERSION is baked into the static build; `unit-version-derivation`
would otherwise go red — the SAME ordering mistake `v86_m` made and caught, not repeated this time).

Baseline: `node test/run.js` → 287 checks (unchanged — no new test FILES, only new assertions inside
`e2e-models.test.js`). No new `en` keys (no user-facing change at all this cut). `lessons.json`
untouched throughout. `APP_VERSION = 'v86_n'`.

**Not done this cut, explicitly — for the NEXT (fresh) session**: steps 2–4 of item W's recommended
path (the background-job design + per-topic cache, the GET endpoint mirroring `cp5ShadowFor`'s own
shape, and the client "text explorer" view). See item W's own roadmap section for the full path.

## ✅ v86_m — item AB (the "unrelated context" half): tutor recency-fallback gated on conversation history

Picked up from `v86_l`'s own "WHERE TO START" list — the most concretely-scoped item that needed no
user ruling, just the standing live-model check.

**The bug, root-caused in `v86_h`/carried as item AB, fixed this cut**: `tutorRetrieveContext`
(server.js) scores completed chapters by keyword overlap with the learner's latest message, then a
recency tiebreaker — but when the question tokenizes to NOTHING meaningful (`qt.size === 0`), it falls
back to "grab up to 4 topics by recency, regardless of relevance", BY DESIGN, so a genuinely
topic-less OPENING question still gets some grounding. A short mid-conversation continuation ("finish
that sentence please") also tokenizes to nothing, but for THAT case the real context is the
conversation history the tutor already receives separately — the fallback firing there is exactly the
shape of the user's own report (4 unrelated topics named as retrieved context on a stuck reply).

**Fix**: `tutorRetrieveContext` gained a `hasHistory` option; the recency-fallback now returns
immediately (`{text: '', used: []}`) when `!qt.size && hasHistory`. The `/api/tutor` route passes
`hasHistory: history.length > 0` — history already includes the learner's own latest message as its
last entry, so this reads directly off the payload the client already sends, no new field needed.

**Test coverage**: `unit-tutor-retrieval.test.js` gained a new section (§4, renumbering the old route-
wiring check to §5) covering all three cases — topic-less + no history (still grounds), topic-less +
history (now empty), real keyword match (unaffected either way). `unit-tutor-selection.test.js`'s own
pinned-argument regex for the `tutorRetrieveContext({...})` call broke on the new call shape (the
standing "a guard that pins exact arguments/conditions breaks on any legitimate change" rule) — updated
to match, plus a new assertion that `hasHistory` is wired. Both files mutation-tested (reverting the
`hasHistory` gate, and reverting the route's own `hasHistory: history.length > 0` argument) — both
caught, diff clean afterward.

**Live-verified** (rule 7 — a live model call needs a live test, not just a plausible prompt) against
the real `qwen3.6:35b-a3b` backend (confirmed installed, `ollama list`), a real corpus topic pair
(fr←de, 8 completed chapters) via a locally-started `server.js` instance and direct `/api/tutor`
requests:
- **Fresh/opening question, no history** (`opening: true`, `history: []`): retrieval still grabbed 4
  topics by recency exactly as before (`ctx: Constance und der Waldgeist | Nacht und Sturm | Neuer Tag
  | Stille vor dem Winter`), and the model's reply was genuinely grounded — it opened by referencing
  the actual retrieved story ("Constance und der Waldgeist... Schutz vor dem Sturm unter einem Baum")
  and asked a follow-up question about it. The "opening question still gets grounding" case the
  fallback exists for is unaffected.
- **Topic-less continuation, with history** (`history: [{tutor: "..."}, {student: "ok ah so"}]`):
  the "asked" log line carried NO `ctx:` suffix at all (vs. 4 topics before the fix) and prompt tokens
  dropped 1282→667 (the retrieved-context block genuinely left the prompt, not just went unused). The
  model's reply stayed fully coherent — it continued the SAME conversational thread from history alone
  ("Schön, dass es dir jetzt klar ist!... Wie sagt man 'sich verstecken' auf Französisch?") — confirming
  the fix does not degrade reply quality when context is withheld in favour of history.

**Also this cut**: `docs/index.html` rebuilt (`node build-static.js`) — it had gone stale relative to
the `c8fa64d` "adding recent lesson work" commit (lessons.json changed, docs was never rebuilt after);
unrelated to this fix but cheap and safe to clear since `lessons.json` was clean (committed, not the
user's live session data). `INTERNALS.md`'s own tutor row updated in place with the new `hasHistory`
behaviour.

**Not done this cut**: the "stuck mid-sentence" half of item AB remains open — could not be correlated
to the user's specific report from stored data alone (`learners.json`'s `tutorThread` has no
timestamp/scope tag); still needs live reproduction, which `v86_h`'s ask-time logging now supports.

**A new, unrelated finding, flagged not fixed**: `unit-article-choices.test.js` (reads the live
`lessons.json` directly, per this codebase's own standing caveat about that class of test) currently
fails reproducibly (not a flake — same result across 3 consecutive runs) with "every it article lesson
still builds an MCQ (3 built, 1 did not)" — one `it`-language article lesson somewhere in the live
corpus can't derive a full 3-way MCQ. Not investigated this cut (out of scope for the AB fix); worth a
look next session since it's now a REPRODUCIBLE red, not corpus noise.

Baseline: `node test/run.js` → 287 checks, 2 pre-existing non-regressions this cut inherited (both
since resolved: `docs/index.html` freshness fixed by the rebuild above; `unit-article-choices` remains
red for the reason above, now the ONLY red). No new `en` keys. `lessons.json` untouched throughout
(confirmed clean via `git status --short lessons.json` before and after). `APP_VERSION = 'v86_m'`.

## ✅ v86_l — item AA: teacher/student mode dropdown

The user said "continue with item AA" — the genuinely-close-to-easy pick from `v86_k`'s own "WHERE TO
START" recommendation.

**Built exactly as scoped**: the old `#teacher-mode-btn` (a single button, "click to flip",
`onclick="toggleTeacherMode()"`) is now `#teacher-mode-select` — a native `<select>` with two
explicit, named options (`#teacher-mode-opt-teacher`/`-student`), wired via
`onchange="setTeacherMode(this.value)"`. `_teacherMode` (the underlying boolean, gating dozens of call
sites throughout the app — story unlocking, hidden-lesson visibility, the editor, mixed-lesson
pooling, and more) is completely unchanged; only the control's own presentation changed.
`updateTeacherModeBtn()` kept its name (still called from three places: `build-static.js`'s static
`init()`, the `applyUIStrings()` language-switch sweep, and after every state change) but now sets the
select's `.value` and re-localizes BOTH option labels every pass — two new `en`-only keys,
`teacher.option_teacher`/`teacher.option_student`, read via `t()` inside the update function itself
rather than a separate `data-i18n` markup sweep, since this control already owned an update function
to reuse rather than a second mechanism to keep in sync.

**Test coverage**: `unit-teacher-toggle.test.js` fully rewritten for the new shape (5 checks — the
select and both options exist with headlessly-triggerable handlers; selecting either option sets
state, persists to `localStorage`, and re-syncs the select's value AND both option labels; the two
labels genuinely differ; `updateTeacherModeBtn()` assigns a real callable JS handler, not relying on
the inline attribute alone, matching this codebase's own standing rule 22 about the stub DOM not
executing inline handlers; the two new i18n keys exist). `unit-settings-card.test.js` and
`unit-static-flags.test.js` updated to the new element id — their own actual CLAIMS (single-instance
containment inside `#settings-modal`, `localStorage` persistence across reloads) were unaffected by
the shape change, confirmed by re-reading each assertion before touching it rather than blanket
search-replacing. Mutation-tested twice (dropped the student-option-label sync inside
`updateTeacherModeBtn`, hard-coded `setTeacherMode`'s own mode-setting logic to always turn teacher
mode on) — both caught by the rewritten test, restored, diff clean. `INTERNALS.md`'s own `PLAN §C4`
Settings Card row updated in place to describe the new control shape (was about to go stale the moment
this shipped, per this project's own "add the row the same cut you name a function you had to hunt
for" convention).

Baseline: `node test/run.js` → 287 checks (unchanged — no new test files). Two new `en` keys (692
total, up from 690). `lessons.json` untouched throughout. `APP_VERSION = 'v86_l'`.

## ✅ v86_k — item S (incremental lesson persistence, both generation paths) + item F's live-verification half confirmed

The user, asked "what would you do next?", approved building item S plus a quick article-symmetry
live-verification alongside it, from the recommendation given.

**Item S — persist each lesson AS IT FINISHES during multi-lesson generation**, not batched until the
whole chapter completes. Built in the function behind the user's own real report
(`_runRecreateJob`/"Re-creating chapter…"/"Add storyline lessons") via a new `persistLesson(lesson)`
closure, wired into all four lesson-success sites in that function. Then, checking whether the fix
generalized (per this line's own standing rule), found `_runBookJob`'s own arc-reinforcement loop
(initial book/PDF/comic generation, chapters 2+) had the EXACT same gap and fixed it too, by calling
`_persistGenerated(...)` after each successful arc lesson instead of once after the whole loop —
confirmed safe to call repeatedly by reading `upsert()`'s own id-matching logic first, not assumed.
Trade-off, deliberate: more disk writes during a large multi-type run, in exchange for never losing
already-finished work to a later type's failure or an external interruption.

**Item F's live-verification half — CONFIRMED.** `build_history/probe_article_symmetry_v80j.js`
(static analysis of the live corpus, no live model call, read-only) re-run: the two chapters `§F3c`
originally named as asymmetric are now BOTH 0% asymmetric — direct confirmation the `v85_r` fix took
hold. Overall corpus rate: 1.3% (40/3141 countable pairs), and spot-checking the two remaining "100%
asymmetric" chapters found them to be correct per-language citation convention (German cites with
gender article, English cites bare), not a defect — the same pattern already found while spot-checking
corpus quality earlier this cut. The "add explanations for genuine asymmetry" ask (the other half of
item F) remains open and unbuilt.

**Test coverage**: `e2e-recreate.test.js` and `e2e-book-arc-types.test.js` both gained a new
source-level check (a genuine mid-run behavioural snapshot isn't attempted — `fake-ollama.js` has no
configurable delay, these runs complete well under one poll interval, so trying to catch an
interruption mid-flight would be flaky, not a real guarantee). Both mutation-tested twice (missing
`persistLesson`/`_persistGenerated` call, missing `saveStore` inside `persistLesson`) — both caught,
restored, diff clean. Both EXISTING e2e tests for these functions still pass unchanged, confirming the
final cumulative result is unaffected — only WHEN persistence happens changed.

Baseline: `node test/run.js` → 287 checks (unchanged — no new test files, all new coverage landed
inside the two existing e2e test files). `lessons.json` untouched throughout (read-only, for the
article-symmetry probe and the corpus spot-checks it built on). `APP_VERSION = 'v86_k'`.

## ✅ v86_j — the user's own answers on AE/AF: AF resolved (never watched the screen), AE gets full diagnostic logging

The user answered both `v86_i` questions directly:
- **AF**: *"i did not watch the screen. please add a console message as well."* Confirms the toast
  likely fired all along — `showToast()` has never logged to console. Built exactly as asked.
- **AE**: *"it looked almost exactly like i left it, the light grey progress message said '1 Panel',
  while during generation I think it had an 'extracting' message. when i reloaded it stayed the
  same."* This REFUTES the `v86_i` write-up's own leading hypothesis (the page's JS context being
  discarded and silently reloaded by the mobile OS) — `APP_COMIC` is never persisted anywhere until a
  chapter exists, so a real discard-and-reload would have come back with NO uploaded image or boxes
  at all, not "almost exactly as left". The JS context surviving means the bug, if there is one, is a
  real listener/logic issue — or the visibility event genuinely never fired on this device/browser —
  neither of which was visible from the console before this cut.

**Built**: console logging added throughout the WHOLE comic visibility-recovery mechanism, not just
the one function either report was about — `_comicExtractCheckOnce`, `_comicDetectCheckOnce`, and
`_comicBookCheckOnce` (v86_e's own book-job poller, included for the same reason, proactively) all now
log on every invocation: whether the call is stale/superseded or current, the polling attempt, the
parsed server status, and (for extract) how many panels are about to be applied. The shared
`visibilitychange` listener itself now logs UNCONDITIONALLY on every fire — including when nothing is
tracked at all — so a session can confirm the listener is alive and firing on visibility changes,
completely independent of whether it had a job to act on. `_comicApplyDetectedPanels` (AF's own
function) logs on every outcome: a clean pass, a partial drop (naming counts), or a total drop —
critically, a drop ALSO logs the RAW (0-1000 model-space) coordinates of the dropped box(es)
specifically, so the user's own geometry hypothesis ("the 4th panel looks shifted outside the image")
can be confirmed or refuted directly from the console on the next detection, not guessed at from a
screenshot.

**This is diagnostic, not a fix** — no behaviour changed, only visibility. The underlying question for
AE (why didn't the extraction result get applied) remains genuinely open; the next occurrence should
be immediately diagnosable from console output the user is already in the habit of checking, rather
than needing another round of speculative hypotheses.

**Test coverage**: `unit-comic-extraction.test.js` §8c/§8d (listener logs unconditionally — source
check, same harness limitation as the existing §8b; `_comicExtractCheckOnce` logs stale calls, the
polling attempt, the status, and the panel count — all behaviourally tested and mutation-tested twice),
`unit-comic-detect.test.js` §7d (the panel-drop logging including raw coordinates, mutation-tested)
and §8b (`_comicDetectCheckOnce`'s own logging), `unit-comic-chapter.test.js` §3g
(`_comicBookCheckOnce`'s own logging, mutation-tested).

Baseline: `node test/run.js` → 287 checks, UNCHANGED from `v86_i` — `run.js`'s own count is per
registered test FILE, not per assertion, and no new test file was added this cut (all new coverage
landed inside the three already-registered comic test files). `lessons.json` untouched throughout.
`APP_VERSION = 'v86_j'`.

## ✅ v86_i — `showToast()`'s dead null-guard fixed; live-testing round on `v86_d`–`v86_h` begins

The user started live-verifying `v86_d`–`v86_h` on their device (per `v86_h`'s own recommended next
step) and reported back mid-round: the progress-card fix (item L) confirmed WORKING; rotate and
drag-to-move (items I/M) confirmed feeling right on a touchscreen. **Two real, still-open problems**
surfaced — see "OPEN AT THE v86 CUT" items AE/AF below for the full investigation; NOT resolved this
cut, genuinely needs the user's own answers to two diagnostic questions before a real fix can be
attempted rather than guessed at.

**Found and fixed while investigating (unrelated to either open problem, confirmed by ruling it out
specifically)**: `showToast()`'s own null-guard checked `t` (the global translate function — a
function reference, ALWAYS truthy, so the check was dead code) instead of `toastEl`, the element it
had just looked up two words earlier. Harmless in the app's actual current shape (`#toast` is static
markup, always present in the DOM — confirmed, which is exactly why this was NOT the explanation for
either reported problem), but genuinely wrong: had `#toast` ever been conditionally absent, the
ORIGINAL bug would throw (`toastEl.textContent` on `null`) instead of the intended silent no-op. New
`test/unit-show-toast-guard.test.js` (2 checks: happy path, and the absent-element no-op — via a
`document.getElementById` spy, since this harness's DOM stub elements have no working `.parentNode` to
physically remove the element through). Mutation-tested: reverting to the old `t` check reproduces the
exact original throw, confirmed by the new test failing for the right reason. Restored, diff clean.

Baseline: `node test/run.js` → 287 checks. `lessons.json` untouched throughout — read only, to rule
out an unrelated live-corpus-drift failure (`unit-article-choices`, confirmed via a direct before/
after comparison against the committed tree to be pure live-data drift, unrelated to any code this
session touched). `APP_VERSION = 'v86_i'`.

## ✅ v86_h — `INTERNALS.md` catch-up (doc-only), item Q, plus three small fixes from a 16-item batch

The user handed over 16 real-usage notes at once ("evaluate the following, start the easy ones… and
integrate the rest into the roadmap"), alongside "start on INTERNALS" while they live-verified the
`v86_d`–`v86_g` round on their device. `INTERNALS.md` §6b was caught up first (doc-only commit,
`be31e4d` — seven cuts of comic-panel rows, `v85_t` through `v86_g`). The 16-item batch was triaged:
four items built (Q below, plus three unrelated small fixes bundled into this same release since they
landed the same session), the other 13 scoped into `roadmap_v86.md` as items P through AC (see the "A
NEW BATCH" section above) rather than guessed at without a live check or a real design decision.

**Item Q — comprehension questions must be independently answerable**: a reported quiz asked a
question only answerable using a DIFFERENT question's own info. `unit-comprehension.test.js` already
confirmed the chapter-CHAIN context was fine (`collectChainStory`) — this was specifically about one
question leaning on a SIBLING question in the same quiz, never explicitly forbidden. Fixed with one new
rule in `prompts.json`'s `comprehension.system`: *"Each question must be answerable ON ITS OWN, from
the story text alone — never write a question whose answer depends on having read or answered a
DIFFERENT question in this same quiz."* Low-risk prompt addition, built despite not being live-verified
this cut (unlike item P, which needs a live check before any change) — it states something the prompt
structure already assumed but never said, not a new capability.

**Tutor: log on ASK, not just on a completed reply** — a stuck/broken tutor reply (reported this same
batch, item AB) previously left NO console trace at all. `/api/tutor` now logs `Tutor [kind] asked
(lang←uiLang), ctx: ...` BEFORE the model call (mirroring `_logReply`'s own shape for the reply side),
so every request leaves a footprint regardless of outcome, and an unexpected `ctx:` retrieval is
visible at the moment it happens rather than only inferred from a reply that never arrives.

**QC: a 'rewrite' verdict can now be ACCEPTED, not just discarded** — user report, real case: a
comic-extracted sign's uppercase fix was exactly right, but only "Discard" was ever offered.
`classifyStoryQc`'s 'rewrite' verdict fires on change-RATIO alone (which a SHORT text trips easily even
for a small, valid edit) — a genuinely different signal from 'corrupt' (`_qcCorruption`'s own detection
of actual model corruption: run-together words, eaten whitespace). Both `/api/story-qc/accept` and
`/api/summary-qc/accept` now block only `verdict === 'corrupt'`; the client's shared
`_renderQcProposalInto` now shows BOTH accept+discard (and the select-all/none toggle) for a 'rewrite'
proposal, gating only on `isCorrupt` — the warning TEXT itself is unchanged (still distinguishes
rewrite from corrupt), only what's actionable changed. `qc.rewrite_warn`'s `en` string reworded to
match ("review the diff carefully before accepting", not "discard and regenerate").

**Static build: tap-to-advance on plain story text was silently dead** — user report: clicking the
summary/unhighlighted story text in a static-build progress card didn't advance, unlike the regular
build. Root cause: `_storyTapInit()` (the mobile follow-up wiring a tap-to-advance listener) is called
from the REGULAR `init()`, which lives inside the `@static-exclude` region `build-static.js` drops
entirely — and build-static.js's OWN replacement `init()` never called it. The function itself
(`_storyTapInit`/`_storyTapMaybeAdvance`) was present and correct in the static bundle the whole time —
this was a missing WIRE-UP, not a missing function. Fixed by adding the call to build-static.js's own
`init()`. `_storySelInit` (select text → ask the tutor) is correctly still absent there — that one
genuinely needs a live backend, unlike pure client-side navigation.

**Test coverage**: `unit-tutor.test.js` (ask-log source check + ordering-before-`_logReply` check,
mutation-tested), `unit-qc-correct.test.js` (both accept routes' relaxed gate, both pinned tests
UPDATED not just extended since the old blanket check is gone; client button-gating source check;
mutation-tested three times — story route, summary route, client `actions`/`selToggle`),
`unit-comprehension.test.js` (the new prompt rule, mutation-tested), new
`test/unit-static-story-tap-parity.test.js` (asserts against the BUILT `docs/index.html`'s own `init()`,
same convention as `unit-static-gen-btn-hidden.test.js` — includes its own built-in mutation check).

Baseline: `node test/run.js` → 286 checks (up one — the new static-parity test file is now
registered), `unit-static-freshness` may show its usual one EXPECTED failure if `lessons.json` is
still dirty from the user's own live testing (see `v86_g`'s own note on this — not a regression).
`docs/index.html` rebuilt from the last COMMITTED `lessons.json`. One `en` string reworded
(`qc.rewrite_warn`), no new keys. `lessons.json` untouched throughout (read-only, for item AB's
diagnosis). `APP_VERSION = 'v86_h'`.

## ✅ v86_g — progress-card comic-panel text sync fix (item L), drag-to-move panels (item M)

Fourth same-session cut in the `v86_d`…`v86_g` real-device-testing round. The user reported three
things at once: a stale-text bug (item L, below), a recurrence of "fewer panels shown than detected"
(investigated as item N — a likely model limitation, NOT changed this cut, see its own write-up
above), and a drag-to-move feature request (item M).

**Item L — progress card / question panel showed STALE text for a comic/image chapter after a story
edit.** Root-caused by reading the actual stored data for the user's real reported topic
(`sl_1597155858`, read-only — `lessons.json` untouched): `story` held the human-corrected text, but
`comicPanels[0].caption`/`inScene` still held the ORIGINAL OCR'd text with the exact typo the user had
fixed. `_comicStoryPanelsHtml` (the renderer both the progress card and question panel use for any
`comicPanels`-bearing chapter) builds its text exclusively from the per-panel fields, never from
`story` — and `/api/save-story` never touched them. Fixed for the unambiguous single-panel case: the
route now syncs `comicPanels[0].caption` to the full corrected story (clearing `inScene`) whenever
`story` actually changes. Multi-panel chapters are deliberately left untouched (item O — genuinely
harder, not guessed at). New e2e test (`e2e-save-story-comic-sync.test.js`, real server, isolated temp
store): single-panel sync, multi-panel untouched, no-comicPanels no-crash, unchanged-story no-op — 4
cases. Mutation-tested twice (the length===1 guard, the inScene clear) — both caught, restored.

**Item M — drag-to-move a comic panel box**, the natural companion to `v85_t`'s own resize handles.
`_comicHitBox(x,y)` finds which box a pointer-down landed inside (same last-drawn-first convention as
the existing handle hit-test); a handle grab still takes priority at a box's own corner (unchanged
ordering — resize wins there). A move translates the box by the dragged delta, clamped at the image
boundary as ONE offset so width/height are preserved EXACTLY, never distorted by clamping each edge
independently. Five new tests in `unit-comic-panel-ui.test.js` §12b. Mutation-tested twice: removing
the boundary clamp broke the new clamp test directly; removing the handle-priority check broke the
EXISTING `v85_t` resize test FIRST (§7) — the two features share that ordering, so a regression in it
shows up on whichever test runs first, not just the newest one.

Baseline: `node test/run.js` → 285 checks (up one — the new e2e test file is now registered),
`unit-roadmap-version` 0 failures (post-ceremony, corpus counts re-measured fresh: the user was
actively testing DURING this cut, so topics/storylines moved from 333/95 to 334/96 mid-session —
a live snapshot, not a stale fixture). One EXPECTED, unavoidable failure in `unit-static-freshness`:
`lessons.json` was DIRTY at release time (the user's own live session), so `docs/index.html` was
rebuilt from the last COMMITTED `lessons.json` rather than the dirty working copy — per the standing
rule, never bake a learner's uncommitted live data into a generated artifact — which that guard
correctly flags as a fingerprint mismatch against whatever's currently on disk. Not a regression; will
clear on its own once `lessons.json` is next clean. Both `check-inline.js` → 0 failures. `docs/index.html`
rebuilt (from the committed source). No new `en` keys this cut. `lessons.json` untouched throughout
(read-only, to diagnose item L — never staged/committed/reverted). `APP_VERSION = 'v86_g'`.

## ✅ v86_f — item I: rotate the uploaded/captured comic image

Direct continuation of the `v86_d`/`v86_e` real-device-testing round, built at the user's own "please
continue with the rotate item". Built exactly as scoped at the `v86_c` cut, with option (a) — a
rotation invalidates any panel boxes already drawn, rather than recomputing their coordinates through
the rotation transform.

**Implementation**: a fixed 90°-clockwise-per-click `#comic-rotate-btn` (click again for
180°/270°), placed FIRST in `#comic-detect-row` — same row/timing as the detect and single-panel
buttons (shown once an image is loaded), positioned first since rotating is naturally a
before-you-draw-panels step. `comicRotateImage()` uses the SAME offscreen-canvas-redraw shape as
`onComicFileChosen`'s own downscale step: draws the current image onto a fresh canvas with SWAPPED
dimensions (`_comicRotatedDims(w, h)`, a pure `{rw:h, rh:w}` swap split out for testability, mirroring
`_comicDownscaleDims`'s own precedent), re-encodes to JPEG, then routes through the exact same
`img.onload -> _comicFinishSetup(img, status)` shape a brand-new upload uses. This was the key design
win: `APP_COMIC.naturalW`/`naturalH` are read straight from the newly-loaded ROTATED image rather than
computed by hand (no risk of the two ever drifting out of sync), and panel-box invalidation
(`comicClearPanels()`, already inside `_comicFinishSetup`) comes for free — no new invalidation logic
needed at all, just reuse of the existing "new image → clear boxes" path.

**Test coverage**: `_comicRotatedDims()` is pure and directly tested (landscape, portrait, square). A
no-op with no image loaded is tested behaviourally (spies on `document.createElement` to confirm a
canvas is never even created). The REAL rotate path (with a working 2D canvas context) can't be driven
behaviourally in this harness — same class of gap as `onComicFileChosen`'s own downscale branch — but
this harness's DOM stub has NO 2D canvas context at all (confirmed directly, same gap
`_comicRedraw`'s own test already documents), which means the FALLBACK branch (`if(!ctx) return;`) is
exactly what fires on every test run here — so that branch, unusually, IS directly testable: confirmed
it does not throw and leaves `APP_COMIC.dataUrl`/`naturalW`/`naturalH` completely untouched (the safe
no-op), rather than corrupting them mid-rotation. A source-level check confirms the real path reaches
`_comicFinishSetup()`. Markup checks confirm the button lives in `#comic-detect-row` and is wired to
`comicRotateImage()`. Mutation-tested three times: removing the no-context guard threw immediately
(`ctx.translate` on `undefined`); removing the no-op guard broke the "never creates a canvas" test;
removing the `_comicFinishSetup()` call broke the source check. All three restored, diff clean.

Baseline: `node test/run.js` → 284 checks, 0 failures (post-ceremony). Both `check-inline.js` → 0
failures. `docs/index.html` rebuilt. One new `en` key, `form.comic_rotate` (690 total, up from 689).
`lessons.json` untouched throughout. `APP_VERSION = 'v86_f'`.

## ✅ v86_e — item K: the same mobile-backgrounding fix extended to the book/chapter-creation poller

Direct follow-on to `v86_d`, built the same session at the user's own "please continue with item K"
— closes the one poller `v86_d`'s own diagnosis explicitly left open.

**The shape difference that made this "its own small adaptation, not a copy-paste"** (as scoped at
the `v86_d` cut): `_startComicExtractJob`/`_startComicDetectJob` are `setInterval`-based — a single
repeating callback that was trivial to also invoke off-schedule. `_pollComicBookJob` was a single
`async function` running one `while(true){ …; await _sleep(2000); }` loop with a `try/finally` for
cleanup — there was no standalone "check" step to re-invoke from the `visibilitychange` listener
without restructuring.

**Refactor**: split the loop into `_comicBookCheckOnce(bookId)` — ONE fetch-and-handle-the-result
step, gated on the PRE-EXISTING `_comicBookId` variable (which already tracked "the currently polled
job", so no new tracking variable was needed) — plus `_comicBookFinish()` for the cleanup that used to
live in the `finally` block. `_pollComicBookJob` is now a thin loop that calls
`_comicBookCheckOnce()` each iteration and stops once `_comicBookId` no longer matches (cleared by
whichever caller — the loop's own next tick, or an off-schedule `visibilitychange` call — sees a
terminal status FIRST). `_comicBookId` is nulled as the very first step of handling a terminal status,
so a second, slightly-later concurrent call is a safe no-op via the guard at the top of
`_comicBookCheckOnce` — the same idempotency shape `_comicExtractCheckOnce`/`_comicDetectCheckOnce`
already established at `v86_d`. The shared `visibilitychange` listener now re-checks all THREE
pollers.

**One genuine behavioural difference from extract/detect, preserved deliberately**: a network failure
mid-poll is NOT terminal for the book-job poller — the original code's `catch(e){ await
_sleep(2000); continue; }` retried silently forever, unlike extract/detect's own catch blocks (which
DO toast and clear state on a network failure). Reasoning, unchanged from before this refactor: book
creation can run long, and a flaky connection blip mid-generation shouldn't abort the whole flow the
way it reasonably should for a much shorter single-extraction request. Verified with a dedicated test:
fetch rejects on the first call, succeeds with `done` on the second — the poll survives the failure
and completes on the retry, `fetch` called exactly twice.

**Test coverage — the REAL function, not mocked**: every existing test in `unit-comic-chapter.test.js`
mocks `_pollComicBookJob` itself (to isolate `comicCreateChapter()`'s own request-building logic), so
NONE of them exercised this refactor at all before this cut. Six new tests were added, calling the
real functions: a `'done'` status (toast names the chapter title, full cleanup, `loadSavedList()`
called exactly once), an `'error'` status (error toast, same cleanup), a 404/job-gone (cleanup runs
but silently, no toast — matching the ORIGINAL pre-refactor behaviour exactly, confirmed by reading
the old code's bare `break`), the network-hiccup-is-not-terminal case described above, the
off-schedule/stale-id safety shape (a check for a superseded book id never even calls `fetch` —
mirroring `unit-comic-extraction.test.js`/`unit-comic-detect.test.js`'s own §8), and a source check
confirming the shared listener's wiring now includes `_comicBookCheckOnce(_comicBookId)`. Mutation-
tested twice: removing the stale-id guard in `_comicBookCheckOnce` failed the off-schedule test
(`fetch` got called when it shouldn't have); removing the book-poller line from the listener failed
the source check. Both restored, diff confirmed clean.

Baseline: `node test/run.js` → 284 checks (unchanged count — item K added tests to an EXISTING
registered file, `unit-comic-chapter.test.js`, rather than a new one), 0 failures. Both
`check-inline.js` → 0 failures. `docs/index.html` rebuilt. No new `en` keys this cut (689, unchanged
from `v86_d`). `lessons.json` untouched throughout. `APP_VERSION = 'v86_e'`.

## ✅ v86_d — mobile-backgrounding fix for both comic pollers, a silent-panel-drop fix, plus item J (single-panel shortcut)

**Live bug, reported mid-session**: "on my phone, i started an extraction from a photo, console said:
[server log showing `[comic-extract] done: 1 panel(s), 0 failed`] ... yet the generator interface
seems to have lost that. 'create chapters' still said that it requires text extraction first." The
server-side job had genuinely completed — the client just never applied the result.

**Root cause**: standard mobile-browser behaviour, not a logic bug in the extraction/detection code
itself. `_startComicExtractJob`/`_startComicDetectJob` each poll `/api/job/:id` via a plain
`setInterval(…, 2000)`. Mobile browsers throttle or fully suspend `setInterval` timers on a
backgrounded tab (screen lock, app-switch, even just scrolling away in some browsers) — so a poll
that was mid-flight when the phone locked can be delayed indefinitely, or never fire again at all,
even though the SERVER finished the job seconds later. Confirmed via the user's own console log
(server-side success) against a grep of the whole codebase turning up zero existing
`visibilitychange` handling anywhere — this class of bug was simply never guarded against.

**Fix**: a shared `document.addEventListener('visibilitychange', …)` listener that, whenever the tab
becomes visible again, immediately re-checks any job still tracked as in-flight — an OFF-SCHEDULE
check, not waiting on the (possibly still-suspended) interval to tick. Required refactoring both
pollers to expose a re-invokable check function gated by a module-level tracked job id
(`_comicExtractJobId`/`_comicExtractCheckOnce()`, `_comicDetectJobId`/`_comicDetectCheckOnce()`) — the
existing `setInterval` callback now just calls the same function on its own schedule, so the normal
(foregrounded) case is unchanged; this is purely additive. Each check function re-validates its job id
is still the CURRENT one both before AND after its own `await fetch(...)` (a second call — from the
listener, from a later interval tick, or from a newer job superseding an old one — must be a safe
no-op, not a stale re-application of an already-finished or already-superseded result).

**Explicitly NOT fixed this cut**: `_pollComicBookJob` (the book/chapter-creation poller) has the
SAME `setInterval`-based vulnerability and was not touched — its `while`+`sleep`-shaped loop needs its
own small refactor to expose a re-checkable id the same way `_startComicExtractJob`/
`_startComicDetectJob` now do. Named here explicitly, not silently left unfixed (rule: a per-caller
fix does not generalize to other callers of the same primitive) — carried to "OPEN AT THE v86 CUT"
below as item K.

**Test coverage**: this harness stubs `addEventListener` as a total no-op and has no
`visibilityState`/`visibilitychange` support at all (checked directly — same class of gap already hit
twice this line, for `ResizeObserver` and for `FileReader`), so the listener firing itself can't be
driven behaviourally. Split into what's honestly testable: (a) `_comicExtractJobId`/`_comicDetectJobId`
correctly track the in-flight job — the exact state the listener reads — and clear to `null` on every
terminal status; (b) an OFF-SCHEDULE call to `_comicExtractCheckOnce()`/`_comicDetectCheckOnce()` (the
listener's own call shape — not from the interval) still correctly applies a `done` result; (c) a
STALE/superseded job id passed to either check function is a no-op that never even calls `fetch`,
proving a late-arriving stale check cannot clobber a newer, still-current job; (d) a source-level check
(the established fallback pattern) confirming the listener's own wiring — the `visibilityState!==
'visible'` guard, and that it calls BOTH check functions, not just one. Mutation-tested twice: removing
the stale-job guard inside `_comicExtractCheckOnce` failed test (c) with the exact predicted shape
(`fetch` got called when it shouldn't have); removing the visibility-state guard AND the detect-poller
call from the listener failed test (d). Both restored, diff confirmed clean.

**A second, related live bug, found mid-session while verifying the fix above**: the user re-tested
comic auto-detection and reported the same "fewer panels shown than expected" SHAPE again — but this
time the console proved it wasn't the `v86_c` listener regression (auto-detect fills boxes
programmatically via `_comicApplyDetectedPanels`, it never goes through the pointer/drag listeners
that bug was about): "the console actually said 4 panels where detected: … `[comic-detect] done: 4
panel(s) suggested`" while the UI showed only 3. Root cause, found by reading (not guessing):
`_comicApplyDetectedPanels` already correctly drops a malformed/inverted box (`x2<=x1` or `y2<=y1` —
shipped back at `v85_o`, covered by `unit-comic-detect.test.js` §5) — that filtering itself was never
the bug. What was missing: dropping was completely SILENT unless EVERY suggested box turned out
malformed (the existing "no panels found" toast only fired on a fully-empty result). A PARTIAL drop —
exactly this case, 1 of 4 boxes malformed — left the user staring at fewer panels than the model
reported with zero explanation. **Fixed**: `_comicApplyDetectedPanels` now toasts on ANY drop, not
just a total one — a partial drop names the kept/suggested counts (`form.comic_detect_partial`, a new
`en` string), and the previously-unguarded case of "every suggestion turned out malformed" (0
survivors from a non-empty input — distinct from the server sending zero panels) now fails cleanly
with the existing "no panels found" toast instead of silently leaving `APP_COMIC.boxes` empty. Two new
tests cover both: a 2-of-4 partial drop (toast names "2/4"), and an all-4-malformed drop (0 survivors,
existing boxes left untouched). Mutation-tested: removed the partial-drop toast call, confirmed the
new test fails with `actual: 0, expected: 1` toasts. Restored, diff clean. This does NOT rule out a
genuine model-accuracy limitation also being at play (the `v85_u` line already found the vision model
itself has real, separate accuracy limits on panel geometry) — but the user can now at least SEE that
a panel was dropped and investigate from there, instead of silently losing data with no signal.

**Item J — single-panel shortcut, built same cut** (scoped at the `v86_c` cut, from the user's own
real-device testing ask: "a 'single-panel' button, to take a complete photo/image as one panel"). A
new `#comic-single-panel-btn` ("🖼️ Use whole image as one panel") calls
`comicUseWholeImageAsPanel()`, which sets `APP_COMIC.boxes = [{x1:0, y1:0, x2:naturalW, y2:naturalH}]`
— REPLACING any existing boxes, matching auto-detect's own already-established "a fresh detection
replaces prior boxes rather than merging" precedent — then redraws and re-renders the panel list, the
same two calls every other box-mutating action already ends with. A no-op with no image loaded (guards
on `naturalW`/`naturalH` both being positive). Three new tests cover: the full-image box shape, that a
second call REPLACES rather than appends to an existing box, and the no-image no-op.

Baseline (checked BEFORE the version bump / docs rebuild): `node test/run.js` → 284 checks, 2 failures
(the SESSION_PROMPT's own stale version-name claim and `docs/index.html`'s own staleness — both
routine, resolved by the release ceremony itself). `node test/run.js --quick` → 246 checks, same 2.
Both `check-inline.js` → 0 failures. After the ceremony (version bump, roadmap/prompt update, docs
rebuild): `node test/run.js` → 284 checks, 0 failures. `docs/index.html` rebuilt. Two new `en` keys
this cut — `form.comic_single_panel`, `form.comic_detect_partial` (689 total, up from 687).
`lessons.json` untouched throughout (checked clean before AND after both live-bug fixes and the
release). `APP_VERSION = 'v86_d'`.

## ✅ v86_c — a v85_u REGRESSION found and fixed (duplicate canvas listeners), plus camera capture with auto-downscale

The user, after testing `v86_b` for real: "panel recognition is really bad, this worked better before
the fix, and occured twice" — a manually-defined 4-panel comic showing only 3 boxes, one of them
spanning two whole panels' width. **This is a genuine regression from `v85_u`'s own resize-sync fix**,
confirmed by reading, not inferred from the symptom shape alone.

**Root cause**: `_comicSetupCanvas()` called `addEventListener` for all 8 pointer/touch events
(`mousedown`/`mousemove`/`mouseup`/`mouseleave`/`touchstart`/`touchmove`/`touchend`/`touchcancel`) on
EVERY invocation, with no matching `removeEventListener` first. Its own comment claimed this was
"idempotent (removeEventListener on a never-added listener is a silent no-op)" — WRONG: the
`canvas.onmousedown=null` etc. lines right above it clear the unused `on*`-PROPERTY handlers (never
used anywhere in this codebase), which is a COMPLETELY SEPARATE mechanism from
`addEventListener`-registered ones; clearing one does nothing to the other. **Before `v85_u` this ran
EXACTLY ONCE per uploaded image** (only ever called from `onComicFileChosen`'s own `img.onload`), so
the bug was latent — one listener each, harmless. `v85_u`'s own fix made this ALSO run from a
`ResizeObserver`, which by design fires MORE THAN ONCE per observed element (once immediately on
`observe()`, again on every real size change) — so from `v85_u` onward, a SINGLE real drag gesture
could fire `_comicPointerStart`/`Move`/`End` multiple times each, corrupting an in-progress drag by
re-entering it mid-gesture. This is a textbook case of the standing rule: a "safe-looking" fix (adding
a resize-observer callback) can defeat an existing guarantee (exactly-once listener registration)
whose enforcement lived entirely in "this function only ever runs once" — an assumption that was
never stated, checked, or tested, because there was never a REASON to before `v85_u` gave this
function a second, repeating call path.

**Fix**: split canvas SIZING (safe and idempotent — resets `canvas.width`/`height` and redraws,
called as often as the observer likes) from LISTENER WIRING (now guarded by a module-level
`_comicListenersWired` flag, runs exactly once for the page's whole lifetime — correct, since
`#comic-draw-canvas` is static markup, never recreated/cloned, so a one-time-ever wiring is not just
sufficient but MORE correct than the original "re-attach in case cloning ever recreated the element"
reasoning, which was speculative and never actually true in this codebase).

**Test coverage**: this harness stubs `addEventListener` as a total no-op (real event dispatch isn't
modelled at all), so the regression itself can't be reproduced by simulating a real multi-fire drag —
instead, `unit-comic-panel-ui.test.js` §9 replaces `canvas.addEventListener` with a counting spy (the
same technique the `v85_u` ResizeObserver tests already use for a different global) and asserts
EXACTLY 8 registrations total across THREE `_comicSetupCanvas()` calls, not 24. Mutation-tested:
reverted the guard, confirmed the new test fails with `actual: 24, expected: 8` — the EXACT multiplier
(3 calls × 8 events) the fix's own diagnosis predicts, not just "some larger number." Restored.

**Camera capture with automatic downscaling — built, same cut** (the user's second, unrelated ask).
A new `#comic-camera-input` (`<input type="file" accept="image/*" capture="environment">`) and
`#comic-camera-btn` ("📷 Take a photo") sit alongside the existing "Upload a comic page" button —
`capture="environment"` opens the device camera DIRECTLY on a phone/tablet browser, and is simply
ignored (harmless, falls back to an ordinary file picker) on desktop, so no device-sniffing is needed
to show or hide it. Routes through the SAME `onComicFileChosen()` handler as a regular upload — no
new code path to duplicate-maintain. **"Apt resolution"**: any chosen image (camera capture OR a
regular file pick — both funnel through the one handler) is now downscaled to at most 1600px on its
long edge before it ever becomes `APP_COMIC.dataUrl`, via an offscreen canvas re-encode to JPEG
(quality 0.88) — caps what gets drawn on, stored, and eventually uploaded, directly addressing the
SAME class of problem `v85_u`'s own mobile-photo context-size fix had to work around after the fact
(a raw camera photo can be many megapixels; 1600px keeps hand-lettered comic text legible while
keeping the base64 payload a small fraction of the original — also a small, incidental step toward
item 4's own `lessons.json`-bloat concern, though the full fix there is still the scoped, unbuilt
server-side migration). The pure scaling math is split into `_comicDownscaleDims(w, h, maxDim)` —
testable without any `Image`/`canvas` dependency — with 5 new cases covering landscape, portrait,
exactly-at-the-limit (no-op), already-small (no-op), and a degenerate zero-dimension guard (no
divide-by-zero into `NaN`). A missing/unavailable 2D canvas context (or this harness's own DOM stub)
falls back to the ORIGINAL, unresized image rather than losing the upload entirely.

Baseline (checked BEFORE the version bump / docs rebuild below, while the new `en` key and the
still-stale `docs/index.html` were the only two things behind): `node test/run.js` → 284 checks, 2
failures (the SESSION_PROMPT's stated `en`-key count and `docs/index.html`'s own staleness — both
routine consequences of this cut's own edits, not `lessons.json` drift, both resolved by the release
ceremony itself: the corpus-count line below and the rebuild). `node test/run.js --quick` → 246
checks, same 2. Both `check-inline.js` → 0 failures. `docs/index.html` rebuilt. New `en` key
`form.comic_camera` (687 total, up from 686 — the only corpus change this cut). `lessons.json`
untouched throughout. `APP_VERSION = 'v86_c'`.

## ✅ v86_b — comic panels on the progress card: the REAL bug found and fixed (`v85_n` never actually worked)

The user, immediately after `v86_a`: "i still don't see the comic panels in the progress cards."
Directly contradicts `v85_u`'s own conclusion ("confirmed ALREADY BUILT, traced end to end") — that
conclusion was WRONG, and this entry corrects the record rather than quietly overwriting it.

**What the earlier investigation got right**: `_storyBodyHtml`'s own internal branch
(`o.text == null && Array.isArray(d.comicPanels) && d.comicPanels.length → _comicStoryPanelsHtml(d, o)`)
is correct, and `unit-comic-story-panel.test.js` correctly proves it — by calling `_storyBodyHtml`
DIRECTLY. **What it never checked**: whether either of `_storyBodyHtml`'s two REAL callers
(`_renderCompStory` for the progress card, `_exStoryPanelHtml` for the question panel) ever actually
reaches that branch. Neither did. Confirmed by RENDERING a real comic-derived topic from the user's
own `lessons.json` (`tp_17877559633380000510`, "Wedding Fever") through `_renderCompStory()` itself,
not through `_storyBodyHtml` in isolation — the panel image was absent, exactly as the user reported.

**Root cause**: both callers pass an explicit `text:` override to `_storyBodyHtml`
UNCONDITIONALLY — `_renderCompStory`: `{ text: full, highlight: !showingSource }`;
`_exStoryPanelHtml`: `{ ex, text: _showSrc ? _xl : story, highlight: !_showSrc }`. `_storyBodyHtml`'s
own comic-panel gate is `o.text == null` — checking WHETHER an override was passed, not whether the
override happens to EQUAL the default. On the plain story side (the common case), `full`/`story` are
literally `d.story` — the exact same value `_storyBodyHtml` would have used anyway — so the override
was functionally a no-op for VALUE, yet still defeated the branch by existing at all. This is why no
prior manual/live check caught it: the rendered TEXT was byte-identical whether or not the branch
fired; only a comic-sourced chapter specifically, checked for the PANEL IMAGE specifically, would
ever show the difference — and apparently nobody had, including this project's own `v85_n` "live
verification" (which very likely tested `_storyBodyHtml` directly too, or a since-changed caller,
not the real UI path as it exists today).

**Fix**: both call sites now pass `text: null` on the STORY side (letting `_storyBodyHtml`'s own
default AND comic-panel branch both fire) and keep an explicit override ONLY on the TRANSLATION side
(`showingSource`/`_showSrc`), which genuinely needs one — `d.storyTranslation` is one flat string for
the whole chapter, with no per-panel breakdown to show instead, so falling back to plain text there
is correct, not a bug.

**Test coverage added, closing the exact gap that let this ship unnoticed**: `unit-comic-story-panel.test.js`
§8 — three new cases that call the REAL functions (`_renderCompStory()`, `_exStoryPanelHtml()`), not
`_storyBodyHtml` directly, proving the whole chain end to end: the progress card reaches the branch,
the question panel reaches the branch, and the translation side correctly does NOT (falls back to
plain text). Mutation-tested: reverted both call sites to their old shape, confirmed the new tests
fail with the exact symptom, restored.

**Collateral, found while verifying**: this fix's own correctness is high-blast-radius —
`_renderCompStory`/`_exStoryPanelHtml` run on EVERY progress card and EVERY question, not just comic
ones — so the full suite was run repeatedly, and it found two REAL, pre-existing issues the fix
exposed, both fixed here too:
- `unit-learner-nav.test.js` pinned the OLD `_storyBodyHtml(d, { text: full, highlight:
  !showingSource })` call as a literal source-text regex — exactly the "guard pins SOURCE TEXT for a
  claim about BEHAVIOUR" anti-pattern this project's own rules warn against. Loosened to check for
  the DURABLE claim (a call into the shared renderer, gated on `!showingSource`) rather than the
  exact argument shape, which is precisely what legitimately changes here. Mutation-tested — the
  loosened version still catches a real regression.
- `smoke-render.test.js`'s own corpus-picked fixture topic (chosen by `chapters.find(...)` from a
  real storyline) turned out to ALREADY be a real comic-derived topic (the corpus has several now,
  since `v85_j`-`v85_p`) — a pre-existing rule-29 case ("a test that reads the real, live
  `lessons.json` can go from green to red purely from the corpus growing") that this fix's own
  correctness newly exposed: one test block overrides `.story` without clearing `.comicPanels`,
  so once the branch became reachable it rendered the OLD panel captions instead of the synthetic
  text the test just set. Fixed by clearing `.comicPanels` in that one block, which is testing the
  generic (non-comic) comprehension story panel and was never meant to exercise comic behaviour.

**A live model backend was NOT needed for this fix** — this is a pure rendering/wiring bug, verified
entirely against real STORED data (the user's own comic-derived topics, already generated) through
the DOM-stub harness. No probe, no Ollama call.

Baseline: `node test/run.js` → ALL 284 CHECKS PASSED. `node test/run.js --quick` → ALL 246 CHECKS
PASSED (both re-run clean after the fixture/guard fixes above — two DIFFERENT transient flakes
appeared and cleared across intermediate runs, confirmed unrelated by re-running each standalone:
`unit-observations-log.test.js` and `unit-dreizunge-launcher.test.js`, neither touched by this
cut). Both `check-inline.js` → 0 failures. `docs/index.html` rebuilt. `lessons.json` untouched
throughout. `APP_VERSION = 'v86_b'`.

# TRACK T — THE TEXT-FOCUSED PROGRESS CARD (user, at the `v80_f` cut)

*The user's third focus shift on the progress card. Recorded here at the moment it was proposed,
with the measurements that were taken BEFORE any of it was designed — `v80_f` (the inflection share)
and the token-density numbers below. **This supersedes parts of §0 and `PLAN §C2`; what it
supersedes is struck THERE with a pointer here, never silently.***

## T0. The proposal, as given

- **MORE TEXT FOCUS.** The chapter text with highlighted vocabulary is visible on **all** progress
  cards of that chapter, **even before the text is unlocked**.
- Highlighted words are **tappable**, opening a random question associated with that word (vocab,
  word_forms, grammar, conjugation, synonyms…).
- The text is **progressively solved**: highlight goes **red → green**, red = no associated question
  solved, green = **all** associated questions solved. Comprehension unlocks only when every
  highlighted word is green (**or by pass-mark fraction**).
- **All question cards show the text too** (today only comprehension does), with the word or
  sentence currently asked **underlined** as well as coloured.
- **Drop** the chapter-wise progress bars and the progress-card copy ("Mach weiter",
  "Kapitel freigeschaltet!"). Keep the play buttons for now.
- Tapping a word opens ONE of its questions; after answering (right or wrong) the next question is a
  **randomly chosen different word** of the same text, but the learner may always tap another word.
  Revisiting a word **prefers questions not yet solved**.
- Mapping: **for now**, reuse the current highlighting; **for new lessons**, change the prompt so the
  model maps questions to exact words/phrases/sentences. Comprehension lessons should map their
  "why" explanation to the sentences it refers to.
- The learner can **select** a word/phrase/sentence and generate a lesson on it interactively (the
  model or tutor gets the chapter as context).
- **Later, for comics:** show the panels and project the highlights onto them — needs per-word
  **coordinates**.

## T1. VERDICT — extend, do not restart. Most of the machinery is already here.

| the design needs | what exists today |
|---|---|
| word → its questions | **`_storyWordSources(d)`** → `{word, lessonId, probes}` for synonyms, word_forms, grammar, conjugation |
| which words are solved | **`_solvedTargetWords`** + **`_solvedExtraWords`**, resolving `probes` through `qid()` against `_solvedMap` |
| two-tone highlighting | **`_highlightVocabHtml(html, words, strongWords)`** — already LIVE on the storyline chain panel |
| per-item solved state | `_lessonItemUniverse` / item keys (`v74_c`) |
| the text on a card | `_renderSummaryField`, `_storyParasHtml`, `furiHtml` |

**The red/green idea is already half-built**: today's dark shade means *any* question about the word
was answered. Nothing here justifies a new project. **Only the comic-panel coordinates are genuinely
new**, and they are cleanly isolated.

## T2. ⚠️ TWO OF THE PROPOSAL'S PREMISES DO NOT SURVIVE MEASUREMENT

**(a) ~~"Progress will be obvious from the greening text, so the bars can go."~~ ✅ RULED at the
`v80_n` cut: KEEP THE BARS FOR NOW.** The measurement below is why, and `v80_l` sharpened it: a
learner on a worked chapter would see ~12 highlighted words of ~189, of which ~1 is green. The text
cannot carry the progress signal on its own yet. **The bars stay; revisit only if highlight density
and the green share both rise.**
Measured: a chapter has **189 story tokens, of which 12.3 are highlighted — 6%.** Ninety-four per
cent of the text stays plain however much the learner solves. A learner at half-done sees six green
words. **Dropping the bars on this reasoning is not supported**; it may still be right for other
reasons, but it needs its own decision. **Do not treat T0's bullet as settled.**

**(b) "We can use the current highlighting to map questions to the text."**
It holds for **47.3%** of taught words and cannot be pushed past **~56.9%** by matching alone —
`v80_f`, above. **36.4% of taught words are ABSENT from the story in any form.** That is a
GENERATION problem, not a matching one.

**Consequence for T0's ordering:** the proposal treats prompt-side mapping as the *later* option and
matching as the *now* option. **The measurement inverts that.** Prompt-side mapping is the only
lever that touches the 36.4%, and it costs one prompt change instead of a per-chapter matcher.

## T3. What it SUPERSEDES — struck at the source, pointing here

- **§0e** vocabulary on progress cards, and **§0d**'s bars → subsumed by the highlighted text
  (subject to T2a).
- **`PLAN §C2`**'s third progress bar, bottom-row chapter title, and "text comprehension" labelling
  → the copy goes with the bars.
- **`v80_e`'s card copy.** "Kapitel freigeschaltet!" is named for removal. The merged starter card
  **survives as the container**; its title/copy does not. **`v80_e`'s structural win — one starter
  card per chapter — is NOT superseded** and this track depends on it.
- **§0c**'s walk partially collapses: if the text is on every card, the story-unlocked page stops
  being a separate destination.

## T4. What it makes MORE valuable, not less

- **`PLAN §8/B1`, the observations log — ✅ SHIPPED at `v81_j`.** Per-word question history is exactly
  what this design reads and exactly what the current `{seen, wrong}` counters cannot replay.
- **The pass mark** (owed by the user). T0's "or via pass mark fraction" makes it load-bearing:
  green-when-all is unreachable in practice if a word has many questions.
- **`PLAN §F2`/`§F3`** prompt QC: a malformed item is far more visible when it is reached by tapping
  a word in the text.

## T5. Open questions the user must settle before building

1. ~~**Green = ALL questions, or a fraction?**~~ **✅ MEASURED at `v80_l` — ALL is NOT a wall. Use
   ALL.** A highlighted word carries a mean of **1.70** associated questions and **53.6% carry
   exactly ONE**, so for most words "all questions solved" means "the one question solved". The
   fraction machinery T0 hedges about is not needed for this reason.
   **⚠️ But the same measurement raises a harder question in its place — see T5.4.**
2. ~~**What about lessons with no story word?**~~ **✅ RULED at the `v80_n` cut: tapping a word
   ENTERS THE USUAL LESSON FLOW**, including questions that are not themselves reachable by tapping,
   and **the play buttons stay.**

   This is a bigger simplification than it looks, and it changes T6. Tapping is a **way IN to the
   existing runner**, not a parallel one-question mode — so the 376 `intro_script` and 218 `math`
   items are not stranded, because the flow that a tap starts is the same flow the play buttons
   start. T6 step 3 ("build a single-question round from a probe") is therefore **wrong as written**:
   the work is *resolve word → lesson + entry point*, then hand off to `startLesson`, which already
   exists. Measured context, unchanged: **82% of items sit in text-anchored lessons.**
3. **T2a: do the bars actually go?**
4. **✅ RULED at the `v80_o` cut — OPTION 1: ACCEPT IT.** The mostly-red text ships as-is. Red means
   "not done", which is true, and `§T2a`'s ruling (the bars stay) means the text is a SECONDARY
   display — the headline progress signal is the bars, so the text does not have to carry it. **No
   extra colouring work; no scoping of the panel.** The two alternatives are recorded below and were
   NOT taken: a distinct PARTIAL colour, and scoping the panel to the chapter's own words.

   **⚠️ What this ruling does NOT settle**, so it is not re-opened by surprise later: 84% red is
   mostly UNFINISHED WORK, not a display artefact. Green = ALL is not the wall (mean 1.70 questions
   per word). If the screen should be greener, the levers are upstream and none of them is a
   colouring change — learners finishing chapters, the **6%** token-highlight density (`§T2a`), and
   the **47%** vocabulary matchability (`v80_f`), of which the last is a GENERATION fix.

   The measurement that produced this ruling: `v80_l` ran TRACK T's own colouring over
   the REAL history in `learners.json` — 2 users with history, 58 chapters they have actually
   worked, 1484 highlighted words:

   ```
   GREEN   every associated question solved    129    8.7%
   PARTIAL some but not all                    107    7.2%
   RED     none                               1248   84.1%

   chapters showing at least one GREEN word     23 of 58   39.7%
   chapters showing NOTHING but red             30 of 58   51.7%
   ```

   **Composed with T2a's density, this is what a learner sees on a worked chapter: of ~189 words on
   screen, ~12 are highlighted, and ~1 is green.** Over half of worked chapters would show no green
   at all.

   This is not a bug and the fix is not technical — 84% red is an ACCURATE report that the work is
   unfinished. But T0's premise is that *"progress should be obvious from the greening text"*, and on
   this install it would mostly report "you have done almost nothing". **That is a design and
   motivation question, and it is the user's.** Options that do not need new measurement: keep the
   bars after all (T2a), colour PARTIAL distinctly so effort shows before completion, or scope the
   text panel to the chapter's own words rather than the whole story.

   ⚠️ Three users, one install. A portrait of THIS install, not a population.

## ✅ T7. RULED AND SHIPPED at `v81_e` — a wrong answer takes a word out of green

*Raised by the user at the `v80_u` device pass; **explicitly deferred**, not dropped. Recorded here
rather than in a release entry because it is an OPEN design item, and the release entries are
history.*

**The request:** *"a wrongly answered question on a vocab that had been answered correctly should
also decrease the solved counter."* For TRACK T's colouring that is reasonable — a word the learner
has started getting wrong should stop being green.

**⚠️ Why it is not a small change.** `INTERNALS` records the solved store as **MONOTONIC** — *"one
correct answer ever = solved, the coverage model"* — and it is read by:

- `topicCoverage` / `lessonCoverage` → the completion fraction and the pass mark
- `setComplete` / `chapterComplete` → whether a chapter is finished
- `storyUnlocked` → **whether the story is readable at all**
- `_firstUnfinishedLessonIdx` and `_firstCoverageShortLessonIdx` → what Next and Replay open
  (the `v80_b` code)

Turning a ratchet into a fluctuating value means **a finished chapter can become unfinished and an
unlocked story can RE-LOCK**, mid-session, as a consequence of one wrong answer. That may be
acceptable, but it is a product decision and it is not the one the user was making.

**✅ THE SCOPING QUESTION IS ANSWERED: the user ruled READING 1, HIGHLIGHT ONLY, and it shipped at
`v81_e`.** The two readings and their blast radius are kept below because the ruling only holds while
the distinction does — see the `v81_e` entry for the containment guard that pins it.

⚠️ **One reader was MISSING from the list above when the ruling was made**, found by grepping the
solved store rather than trusting the note (rule 35): the ROUND BUILDERS —
`buildStandardExercises`, `buildMixedExercises`, `buildComprehensionExercises` and
`assembleCoverageRound` — all read it to bias rounds toward unsolved questions. Under reading 2,
un-solving would therefore also change WHICH QUESTIONS GET ASKED, feeding a wrong answer back into
sampling. That is arguably the most attractive part of the idea and it is the part nobody has costed.
Anyone re-opening reading 2 must start from that.

**THE TWO READINGS** — they differ enormously in blast radius:

1. **HIGHLIGHT ONLY.** A wrong answer moves the word green → partial in `_wordProgress` / the story
   colouring, and the solved store is untouched. Coverage, completion, the pass mark and the gates
   all keep their current meaning. Contained; buildable in a session; needs a second per-word counter
   (a "recent wrong" set) rather than a change to the solved store.
2. **THE WHOLE COVERAGE MODEL.** `markSolved` gains an inverse and every reader above inherits the
   new behaviour. Its own release, and it **must** re-run the `§C1` gate probes
   (`probe_gates_v80c1.js`) and `probe_gates_v77.js`, because the gates it feeds are the ones
   sessions 35–36 spent two releases fixing.

**Reading 1 is what TRACK T actually needs.** Reading 2 is a different feature — mastery decay —
which is `PLAN §9b/D2` territory and is already blocked on `§8/B4` running BKT in shadow mode.
**Do not implement 2 under cover of 1.**

## ✅ T4/STEP 4 — SHIPPED as `v81_a`, OPT-IN, and the measurement is why

T0: *"only if ALL questions associated with each highlighted word (or via pass mark fraction) are
solved we progress to the comprehension questions."*

**Measured before building it.** Making word-green the story gate outright would **RE-LOCK 21 of the
22 chapter/learner pairs whose story is unlocked today — 95%.** Green fraction of currently-unlocked
chapters, over the real `learners.json` at this cut:

```
  0%      5 chapters
  1-49%  11
  50-79%  5
  100%    1
```

**The cause is not learner laziness.** A word accumulates questions from vocab, from SENTENCES
(`v80_v`) and from every probe-bearing lesson, so *"all questions about this word"* is a far higher
bar than *"the lessons are done"*. A story a learner has EARNED would close again mid-session —
**the same hazard `§T7` raises for the solved counter, and the reason that item was deferred.**

**So the MECHANISM ships and the SWITCH is the user's.** `wordGate` is read from the topic, then the
storyline, then `APP.info`; a number in 0..1 is the fraction of tracked words that must be green.
**Unset — the default, and what every existing learner gets — leaves the `v71_s` rule exactly as it
was.** It REPLACES the lesson rule rather than combining with it: an `OR` would be a no-op (word-green
is the stricter measure in practice) and an `AND` is the 95% re-lock.

A chapter that tracks no words falls back to the lesson rule rather than answering "unlocked" on no
evidence.

**Guard:** `unit-word-gate`, six sections. **§2 is the one that matters today** — with no gate
configured, a chapter with ALL words green is still LOCKED, i.e. the default ignores the words
entirely. §3 is the discriminator: the same state, with a threshold set, unlocks — so the gate is
demonstrably what changed the answer. Mutation-tested.

~~**⚠️ THE RULING THE USER STILL OWES:** whether to switch it on, and at what fraction.~~
**✅ RULED — see the `v81_a` entry under `# SHIPPED IN THE v81 LINE`: "leave it as it is", the gate
stays available and off.** The follow-up measurement asked for there (does the pass mark rescue it?
no) is the input that closed it. The remaining options are CONTINGENT, not owed: per-storyline for
NEW books only, or redefine "green" to match the chapter's coverage rule — and the latter needs the
`§T7` scoping decision first.

*Struck at `v81_c`, not deleted. This paragraph and the entry that answers it sat ~245 lines apart in
one file and disagreed, and the `v81_b` session prompt carried the stale side forward into "THREE
RULINGS THE USER OWES" — the working rule about cross-checking a carried item against the SHIPPED
list in the same file, arriving from the other direction: here the OPEN text was the copy that went
stale.*

The numbers that produced the ruling: switching it on at 1.0 today would lock 95% of earned stories;
a fraction that does not regress anyone is somewhere below 0.5 on this install, which is weak as a
gate.

**⚠️ `v81_d` moves these numbers.** They were measured with a denominator that counted questions no
round can build — see the `v81_d` entry. Any future re-opening of this ruling must re-measure first.

## T6. Build order — ✅ FULLY UNBLOCKED at the `v80_o` cut

*Every `§T5` question is settled: `T5.1` measured (green = ALL), `T5.2` ruled (tapping enters the
usual lesson flow), `T5.3`/`T2a` ruled (the bars stay), `T5.4` ruled (accept the red screen). Nothing
below waits on the user any more except step 5, which needs a live model.*

1. ~~**Per-word solved FRACTION**~~ **✅ SHIPPED as `v80_q`** — `_wordProgress` + `_wordState`;
   both originals are wrappers over it. See the `v80_q` entry.
2. ~~**The shared text panel**~~ **✅ SHIPPED as `v80_r` + `v80_s`** — renderer, three states,
   asked-span underline, and the panel on EVERY question card, collapsed where the story leaks the
   answer (ruled option 3).
3. ~~**Tap → the lesson flow.**~~ **✅ SHIPPED as `v80_t`** — `_wordQuestions` + `tapWord`, landing
   on an unsolved question where one exists. `§0h` (`v80_p`) was built first, as this predicted.
4. **The gate change** (comprehension unlocks on green) — lands on `_storyLockedLesson` /
   `storyUnlocked`, i.e. the `v80_b` code. ~1 session.
5. **Prompt-side exact mapping** — needs a live model. **The user's, not a container's.**
6. **Comic coordinates** — isolated, last.

---


---

# THE LARGER PLAN — folded in from `implementation_plan.md` at the `v80_d` cut

> **⚠️ READ THIS BEFORE CITING ANYTHING BELOW.**
>
> The file `build_history/implementation_plan.md` **no longer exists.** It was a one-off evaluation of the
> user's larger plan (PDF focus) against these roadmaps, written at the `v80` cut, and keeping it
> alive created a SECOND home for open items — which is exactly how the two `v80` diagnoses came to
> be recorded in three places and missing from the durable one. It is folded in here whole.
>
> **Citation mapping.** Anything that said `implementation_plan.md §X` now reads **`PLAN §X`** and
> lives in this section. The letter-form labels are unchanged and unambiguous — `PLAN §C1`,
> `PLAN §D2`, `PLAN §F2`, `PLAN §8/B1`, `PLAN §9b/D8`, `PLAN §9c`, `PLAN §10` — because this roadmap
> has no sections of its own by those names. **The bare-number labels DO collide**: this roadmap
> already has a `§0`, `§1`, `§2` and `§3` of its own, and the plan had different ones. That is why
> every heading below carries the `PLAN §` prefix. **A bare `§3` means the roadmap's highlighting
> item; `PLAN §3` means Track C.**
>
> **Three duplications were resolved on the way in, not silently:**
> - `PLAN §2.6` and `PLAN §2.7` each appeared **TWICE, byte-identical** (3647 and 4857 bytes). One
>   copy of each was dropped. Nothing was lost — they were identical, and that was verified by
>   comparison rather than by eye.
> - `PLAN §2.5` appeared twice with **different content**: the corrected version
>   (*"PDF needs NO decision"*, revised under user challenge) and the superseded original
>   (*"PDF is the only case that still needs a decision"*). **Both are kept**, the original struck
>   with a pointer, because the reason a decision was reversed is worth more than the tidiness.

## ⚠️ WHAT HAS MOVED SINCE THE PLAN WAS WRITTEN — read this before acting on any section below

The plan was written at the `v80` cut. Sessions 35 acted on it. **These are the deltas; the sections
themselves are left as written, so the original reasoning stays readable.**

| plan section | status at the `v80_d` cut |
|---|---|
| **`PLAN §0.2`** — "I damaged `roadmap_v80.md`, re-carry and reconcile both sections" | **DONE.** Both sections were restored at the `v80` cut and RECONCILED in session 35 — see "SESSION 35 — the reconciliation pass" above. Its prerequisite is discharged. |
| **`PLAN §0.3`** — duplicate storyline title | **SUPERSEDED by user ruling** (`§2y`): the user RENAMED one to "Dough of the Ancients 2". The fork-marker guard is preventive, not corrective. |
| **`PLAN §0.3`** — single-chapter `1/1` and 100% bar | **✅ RULED AND SHIPPED at `v81_g`** — bar = completion, label = access. ONE root cause with the header bar, not two off-by-ones, and it is NOT the index the plan guessed: `pct` is computed from `unlockedChapters`, so ALL 91 decks show a partly-green bar at `doneChapters = 0` and all 27 single-chapter decks read 1/1 at 100%. The `+1` is the `v77_p` USER RULING and cannot just be removed. See `PLAN §C1` for the one question that needs answering. |
| **`PLAN §0.3`** — `unit-story-unlocked-page` §6 does not discriminate | **DONE, shipped `v80_c`.** It fails under revert now. See the `v80_c` entry above, which also CLOSES the `_firstUnfinishedLessonIdx` "open defect" as a misattribution. |
| **`PLAN §0.4`** — are QC tokens recorded | **Answered: yes.** Only a run-level total is missing. |
| **`PLAN §C1`** — the two progress-card gate bugs | **HALF DONE.** The SECOND bug (Replay reaching comprehension before the story unlocked) is **shipped as `v80_b`**, measured 27 of 94 partly-played chapters before / 0 after, revert-verified. The **FIRST bug is NOT reproduced**, and **two readings of it are dead ends** — see the `v80_b` block above before spending time on it. The single-chapter 100% bar and the header off-by-one are still folded in here and untouched. |
| **`PLAN §10`**, session 1 (repair and reconcile) | **DONE** (sessions 35). |
| **`PLAN §10`**, session 2 (`§C1`) | **HALF DONE**, as above. |
| **`PLAN §10`**, session 3 (`§8/B1` or `§D1`) | **`§8/B1` ✅ SHIPPED at `v81_j`** — the observations log, wired into `check()`. `§D1` is untouched. |

Everything else below is unchanged and still open.

---

> **Internal cross-references inside this folded section** (`§F3`, `§8/B1`, `§C1` written bare in
> the plan's own prose) are relative to the PLAN, not to the roadmap above. They were left as
> written rather than rewritten in 73KB of prose, because a mechanical rewrite of `§` across that
> much text is exactly the kind of edit that changes a claim by accident.

*Written at the `v80` cut, against `roadmap_v79.md` (shipped history), `roadmap_v80.md` (open
items), `INTERNALS.md` and the 35 standing rules. No code was written for this document. Every
claim about the current code below was checked in the tree at this cut; where I could not check
something, it says so.*

---

## PLAN §0 — Read this first — four findings that change the plan before it starts

### PLAN §0.1 — `bayesian_knowledge_tracing.md` ARRIVED — Track B is unblocked, but not where expected

The document is now in `build_history/`. It is sound, and its central choice is the right one:
**skills (knowledge components) are the BKT unit, not lessons or chapters**, with one canonical
skill shared across every story that exercises it (§7), and storyline/language/global progress as
*aggregations* rather than separate models (§5, §11, §12). That is the standard framing and it
avoids the usual mistake.

**But the blocking work is not the BKT.** The update rule is about ten lines of arithmetic and needs
no design. Four things stand between the document and a working implementation, and they were
checked against the tree at this cut:

**(a) THE EXISTING EVIDENCE CANNOT BE REPLAYED.** `learners.json` stores
`state.progress.learned["<target>|<source>"].vocab[word] = { source, seen, wrong }` — **aggregate
counters, not an ordered observation stream.** BKT is sequential: `P(L)` is updated per attempt, in
order, and "wrong early then right" (learning) is a different state from "right then wrong"
(decay). From `seen: 7, wrong: 0` neither can be recovered. So either BKT starts from zero evidence
going forward, or the existing counters seed `pMastery` crudely and the history is discarded. **The
document's §13 `observations` log is therefore not optional and not a later refinement — it is the
prerequisite**, and the sooner it starts recording the sooner BKT has anything to run on.

**(b) THE CURRENT KEY CONTRADICTS §7.** Evidence is bucketed by **language PAIR** (`it|de`, `en|de`),
so a learner meeting German from English and the same learner meeting German from Italian have
separate records today. §7 explicitly requires one canonical `de:vocab:gehen` regardless of route.
That is a schema migration, and the pair-keyed data cannot be merged without deciding whether
source language is a property of the *evidence* (probably yes) or of the *skill* (probably no).

**(c) SKILL TAGGING IS THE REAL COST, AND IT IS LANGUAGE KNOWLEDGE.** §3/§4 require every exercise to
name the skill it tests. Nothing emits that today. Worse, `de:wordform:gehen:present:1sg` cannot be
computed by the app from the string `gehe` — it needs lemmatisation and morphological analysis,
which INTERNALS §4 puts squarely in the model's tier. So skill IDs will be **model output**, and
**the document does not address canonicalisation**: the same skill will arrive as
`de:vocab:gehen`, `de:vocabulary:gehen`, `de:vocab:Gehen`, `de:vocab:gehen:infinitive` across
generations, and §7's "one canonical skill" quietly fails. **A registry with model-proposed IDs
resolved against existing entries is needed on day one**, not later. This is the single largest
piece of new machinery in the whole plan and it is invisible in the document.

**(d) THE MASTERY GATES COLLIDE WITH THE APP'S EXISTING PROGRESSION.** §5 redefines story progress as
"percentage of required skills with P(mastery) >= 0.70" and §6 makes chapter unlocking depend on
mastery thresholds. Dreizunge **already has** a progression system — `chapterComplete`,
`lessonCountsFor`/`countedLessons`, the `coverageTarget` pass mark with storyline/chapter override,
`_slProgressStats` — and it is the most heavily guarded surface in the codebase
(`probe_gates_v77.js`, the `unit-story-unlocked-*` family, `unit-fork-display` §6). **§5/§6 are a
REPLACEMENT of that, not an addition.** They are also a product decision, not a technical one: the
current pass mark is a teacher-set number the user has ruled on more than once.

**Consequence for ordering:** Track B's *instrumentation* can start early and independently; Track
B's *gates* should be last or never, and must not be assumed. See §8.

**One measurement to take before anything else**, because it decides whether BKT will discriminate
at all: across all of `learners.json` only **40 words have ever been answered wrong (3.0%)**. With
the document's suggested `pGuess = 0.20`, `pSlip = 0.10`, an observation stream that is 97% correct
drives `pMastery` to ceiling almost everywhere — so §6's thresholds would unlock everything
immediately and §5's percentage would read ~100% for every learner. **Check first whether `wrong`
counts FIRST attempts or only un-retried ones.** If exercises are retried until correct, the stream
is not independent, BKT's assumptions do not hold, and the fix is in the answer recording, not in
the model parameters.

### PLAN §0.2 — I damaged `roadmap_v80.md` at the cut, and this plan lands on the damage

When I created `roadmap_v80.md` I carried the open block from line 611 of `roadmap_v79.md` onward.
**Two whole open sections sit BEFORE that line and were lost:**

- `# 0. THE PROGRESS-CARD REWORK (user, at the v76 cut)` — with sub-items `0d`…`0h`
- `# 0i. LESSON GENERATION REWORK (user, at the v76 cut) — BLOCKED on §1`

`roadmap_v80.md` contains zero references to `0d`, `0h`, `0i`, "PROGRESS-CARD REWORK" or "LESSON
GENERATION REWORK"; `roadmap_v79.md` contains four. This is my error, made in the last ten minutes
of the previous session, and it is not cosmetic: **those two sections are the direct ancestors of
this plan's "CLEAN-UP PROGRESS CARDS" and "NEW LESSON GENERATION CARD".**

**Prerequisite task, before any of the below: re-carry both sections into `roadmap_v80.md`, then
reconcile them against this plan item by item** — each old bullet is either (a) superseded by a new
one, (b) still open and unmentioned here, or (c) already shipped. A superseded item must be struck
with a pointer, not silently dropped; that is how `v77_p`'s preview-panel removal stayed
comprehensible three releases later. Budget half a session.

### PLAN §0.3 — Two open items from session 34 are still unanswered and one is cheap

- **The duplicate storyline title** (`sl_182891979` / `sl_1041030875`, both `🧈🔥 Dough of the
  Ancients`, the only duplicate in 90) — each side's fork link names the storyline the learner is
  already in. An authoring call.
- **Single-chapter storylines read `1/1` and a 100% bar before anything is played** —
  `_slProgressStats` adds one for the in-progress chapter. This one is **inside the progress-card
  clean-up below** and should be folded into it rather than fixed separately (§C1).
- **`unit-story-unlocked-page` §6 does not discriminate under revert** (carried since `v77_p`). It
  needs no ruling and it is a guard that cannot fail, which is worse than no guard. **Do it first,
  before the big plan starts** — half a session, and it protects the surface the progress-card
  rework is about to churn.

### PLAN §0.4 — One question in the plan is already answered

> *"are tokens used for QC recorded? if not they should be."*

**They are.** `server.js` calls `addTokenUsage(_liveTopic(), _lqTok, 'lesson_qc')` and
`addTokenUsage(tp, _sqTok, 'story_qc')`. Chapter-level QC folds into
`generationStats.totalPromptTokens/totalCompletionTokens` — the same fields initial generation
writes, so "total" means total — and both carry a per-type tally in `tokensByType`. What is **not**
there: the `/api/qc` route itself has no `addTokenUsage` call at its own level, so a bulk QC run
attributes to the chapters it touched and nowhere else. If you want a *run-level* number ("this QC
sweep cost X"), that is a small addition and it belongs with the QC card (§F3), not with plumbing.

---

## PLAN §1 — The strategic read: this plan is three products, not one

The plan as written mixes work at incompatible scales. Sorting it that way is most of the planning
value, because the small items are being blocked by the big ones for no reason.

| Track | What it is | Scale | Depends on |
|---|---|---|---|
| **A — Ingest** | Image upload, vision extraction, chaptering, word map | **New subsystem**, weeks | **Nothing — no rulings left.** PDF text already works (§2.5) |
| **B — Pedagogy** | BKT, adaptive selection, tutor, recommendation, learning arcs | **New subsystem**, weeks | Design doc ARRIVED; B1 can start now, B7 needs a ruling |
| **C — Surface** | Progress cards, UI/settings card, generation card, QC card, LMGTFY | **Incremental**, 1–2 sessions each | Mostly nothing |
| **D — Lessons** | Mixed-lesson selection, cases/articles, generic lessons | **Incremental**, 1 session each | Language-knowledge ruling (§5) |
| **E — Export** | Printable exams and teaching material | **Small, self-contained** | Nothing |

**Recommended order: C → E → D → A → B.** (A moved cheaper after the §2 correction — image ingest needs no dependency at all — but it still follows C, because the ingest UI lands on surfaces C is about to rework.) Reasons, in order of weight:

1. **Track C is where every user complaint in this document actually is.** The screenshots are all
   surface. Shipping C makes the app better for the corpus that already exists.
2. **Track A changes the architecture** (§2) and should not be started while the surface is churning.
3. **Track B needs a corpus and a design document** that do not yet exist (§0.1). It also needs
   learner data, and the session-33 measurement is stark: across all of `learners.json` only **40
   words have ever been answered wrong** (574 with any record, 3.0%). **A BKT model fitted on that
   would be fitting noise.** BKT is the right long-term answer and the wrong next thing.
4. **Track E is small, has no dependencies, and is the only item with a clear non-digital user.**
   It is the best "spare half session" filler in the whole plan.

---

## PLAN §2 — INGEST ARCHITECTURE — corrected after the user's challenge

**My first draft of this section was wrong for images, and the user was right.** It framed
everything around PDF extraction and let the PDF difficulty contaminate the PNG case, which has
almost none of it. Corrected, with what was checked:

### PLAN §2.1 — What the code already does

The app talks to Ollama over **`/api/chat`** with `messages:[{role,content}]`, using Node's built-in
`http`/`https` (`qc-lessons.js:67`, and `server.js` carries the same shape). **Ollama's chat API
accepts `images:[<base64>]` on a message.** So sending a PNG to a vision model is *an extra field on
a request the app already makes* — no new transport, no new dependency, no `package.json`. The
"zero-dependency" property is not at risk for image ingest at all.

### PLAN §2.2 — The model can do both jobs, and the protocol is documented

Checked against the Ollama library and the MiniCPM-V CookBook:

- **`minicpm-v4.6` exists** (Ollama library) — SigLIP2-400M + **Qwen3.5-0.8B**, edge-focused,
  explicitly benchmarked on **RefCOCO** (a referring-expression *grounding* benchmark) and OCRBench.
- **`minicpm-v4.5` exists** — 8B on Qwen3-8B, OpenCompass 77.2, *"leading performance on OCRBench"*
  and *"state-of-the-art performance for PDF document parsing"*.
- **Grounding has a documented protocol** (`MiniCPM-V-CookBook/inference/minicpm-v4_5_grounding.md`):
  ask `Please provide the bounding box coordinate of the region this sentence describes:
  <ref>NAME</ref>`; the model answers with `<box>x1 y1 x2 y2</box>`, **normalised to 0–1000**,
  converted by `x = bbox[0]/1000 * width`.

So: **text extraction and panel coordinates from one model, one call shape, zero dependencies.**
That is the user's proposal and it is sound.

**Model choice, revised:** the plan's original `minicpm-v:8b-2.6-q4_K_M` is superseded by **`v4.5`**,
which is the same size class and explicitly better at OCR and document parsing. **`v4.6` is NOT the
newer-and-better option for this job** — its LLM is 0.8B, built for phones; it is the right pick for
on-device, the wrong one for ingest quality. Confirm what is pulled with `ollama list`.

### PLAN §2.3 — Cropping is a non-issue — three ways out, cheapest first

My draft implied cropping needed an image library. It does not:

1. **Do not crop.** Store the boxes as data and render each panel with CSS
   (`background-position`/`object-fit`) or a canvas draw at display time. The original PNG stays the
   only asset. **Recommended** — it is also reversible, so a bad box is re-editable forever.
2. **Crop in the browser** with `<canvas>` + `toBlob()` if real files are wanted. Free, no server.
3. **Crop in pure Node** — genuinely feasible, `zlib` is built in (verified): inflate IDAT, unfilter
   scanlines, crop, refilter, deflate. A few hundred lines and no dependency. Only worth it for
   server-side batch.

### PLAN §2.4 — What is still genuinely uncertain — and it is ONE thing

Not "can it do boxes" (it can), but: **the documented example grounds ONE region from a
description. Comic panel extraction needs N boxes enumerated in reading order, unprompted.** That is
a different task, and it is where a vision model most plausibly returns *well-formed, plausible,
wrong* output — coordinates that parse cleanly and do not match the page. That failure is invisible
unless something compares them to the image.

**So the first move in Track A4 is a measurement, not a feature** — the pattern that has worked all
session. Roughly 40 lines: post one real `murmel-comics.org/stories/2640` page to `/api/chat` with
`images:[b64]`, ask for panels, parse `<box>`, and render the boxes back over the source image as an
HTML overlay for a human to eyeball. Twenty minutes, and it answers what no amount of planning will:
does it enumerate all panels, in order, at usable precision? Record the answer as a probe with its
numbers in the header, like `probe_word_forms_v79i.js`.

**Reading order is the second unknown** and may be easier solved deterministically: given boxes,
sort top-to-bottom then left-to-right (right-to-left for manga) rather than trusting the model's
sequence. Worth testing both.

### PLAN §2.4 — RESULT (Aug 25 2026) — the overlay probe ran, three strategies, all negative

The probe finally ran, against the exact fixture named above (`murmel-comics.org/stories/2640`,
fetched with the user's one-off authorization for this internal dev probe; local copy kept only in
the session scratchpad, not the repo — the site's own licence is still unchecked, see `§2.7`). Model:
`minicpm-v4.5` (`§2.2`'s actual recommendation — pulled fresh for this, not the already-present
`v4.6`/`v:8b-2.6`). Machine: this dev box, CPU-only, with two OTHER large models also resident during
every call (`qwen3.6:35b`, `qwen2.5:7b`) — not a clean single-model bench, but this app's real
deployment shape is exactly this kind of shared box, so the numbers are not irrelevant.

Three DIFFERENT strategies were tried, each getting its own probe file (all three now committed under
`build_history/`, each with its full numeric results in its own header — read them for the raw
per-call output, this is a summary):

1. **`probe_comic_panels_v85_i.js` — one-shot enumeration** ("list every panel, in reading order, one
   `<box>` per line"). The first 4 of 6 true panels came back genuinely well-formed and consistent — a
   clean, evenly-spaced 2-column grid. From panel 5 on the response DEGENERATED: confabulated
   self-correction prose leaking into what should be terse coordinate lines, an invented in-panel sign
   text, and by panel ~14 an outright repetition loop, ending with 26 claimed "panels" for a page that
   has 6. One call, 6.4 minutes.

2. **`probe_comic_panels_grounded_v85_i.js` — stateless per-panel grounding**, `§2.2`'s actual proven
   protocol (one `<ref>NAME</ref>` → `<box>` call per panel, no shared memory between calls). A quick
   separate count call was cheap and correct both times it was tried (0.7-66s, "6", right answer). The
   FIRST attempt used a full instructional sentence as the `<ref>` NAME with a 48-token budget — the
   model echoed the whole sentence back before answering, truncating the box's last number on 4 of 6
   calls. The SECOND attempt (short name, no-echo instruction, 200-token budget) fixed the echo/
   truncation, but surfaced a DIFFERENT problem: six fully independent calls do not agree on a
   consistent layout — two different claimed panel numbers landed on nearly the same, overlapping
   region. Individually plausible boxes, no global consistency. ~8-10 minutes per full run (7 calls).

3. **`probe_comic_panels_stateful_v85_i.js` — stateful grounding** (each call is told the boxes
   already found for earlier panels and instructed to answer with a different region — directly
   targeting finding 2's consistency problem). Did not fix it: panel sizes came back wildly
   inconsistent (one plausible 355×315 panel next to a 50×50 sliver, nowhere near panel-sized), and 2
   of 6 calls STILL degenerated — one response literally contained HTML anchor-tag markup
   (`rel="noopener noreferrer" target="_blank">670</a>`) in place of a fourth coordinate, unprompted
   and unrelated to anything in the conversation. 8.7 minutes.

**VERDICT.** Three structurally different prompt strategies, three different failure modes, all on
the EASY/acceptance fixture (`§2.7`'s clean 2×3-grid "Page B") — none produced a fully self-consistent
set of correctly-sized, non-overlapping panel boxes. The one thing that stayed reliable across every
run was the cheap "how many panels?" count call. Per the user's own decision after reviewing all three
overlays live, THIS IS NOT A PROMPTING PROBLEM TO KEEP ITERATING ON — it is either a model-quantization
ceiling (`minicpm-v4.5` at this build) or a machine-load ceiling (CPU-only, three large models
resident), or both, and either way further prompt tuning on this exact setup has diminishing odds of
paying off. **Track A4 (comic panel-grid extraction) is NOT ruled out, but is NOT viable as measured.**
Two forward paths, neither started: (a) the same probes against a different backend (larger/
un-quantized model, GPU, or a cloud vision API) to separate "the model" from "the approach" as the
cause; (b) fall back to `§2.6`'s own coarser Tier 1 target (bubble-level boxes, not precise panel-grid
splitting) which may not need reliable full-page panel enumeration to be useful. **Do not resume
Track A4 by writing panel-splitting production code — the measurement says it isn't ready, and no
ruling has been made on which of the two forward paths (if either) to take next.**

### PLAN §2.4 — RESULT PART 2 (Aug 25 2026, same session) — a THIRD forward path, tested, more promising

User's own idea, put directly to the failure just measured: if panel ENUMERATION is what breaks, take
it out of the model's job entirely — let the USER draw the panel rectangles by hand (mouse drag on a
canvas overlaying the uploaded image; `§2.3`'s existing "store boxes as data, don't crop for storage"
decision covers this regardless of who drew the box), and give the model only the narrower, different
task of TEXT EXTRACTION from an already-correct, already-known region. None of the three panel-finding
probes above tested this — they all tested localization, never extraction-from-a-known-region.

Measured with a new probe, `probe_comic_text_extract_v85_i.js`, on a hand-cropped real panel from the
same Page B fixture (panel 3 — chosen because it contains BOTH of `§2.7`'s flagged risks in one panel:
a caption vs. an in-scene sign that must be told apart, and a word split across a line break with no
hyphen, "WILL"/"KOMMEN", that must be rejoined). Two runs:

- **v1** (plain instructions): the caption/in-scene SPLIT was exactly right and the caption's letters
  matched perfectly, but case-restoration and word-rejoining — the two specific transformations `§2.7`
  flagged as highest-value — were both ignored outright (not attempted-and-wrong, just skipped), plus
  one OCR letter error ("nicht" → "mcht"). ~65s, far cheaper than any panel-finding call.
- **v2** (added a worked example + "your answer is WRONG if it contains any word in all capital
  letters" framing): **case-restoration was FULLY fixed** — the caption came back a perfect, correctly-
  cased, correctly-umlauted match to ground truth, and the in-scene field's case fixed too. Word-
  rejoining and the OCR letter error were UNCHANGED by this fix (different failure category — visual
  recognition and a structural instruction don't respond to the same prompt lever). A NEW defect
  appeared: the crop deliberately included a small sliver of the *next* panel (realistic — a human-
  drawn box will rarely be pixel-perfect), and the model transcribed that bleed-through as an
  unlabeled third line instead of ignoring it.

**VERDICT.** This is the most promising result in the whole `§2.4` series. The single highest-
pedagogical-weight requirement (German case restoration — without it the app would silently teach
wrong noun capitalization) is solvable with prompt engineering alone, and ported across text sources
once fixed. What's NOT yet solved: OCR letter-level accuracy (didn't move with any prompt change
tried), line-rejoin (didn't move either), and crop-boundary bleed-through (newly discovered, means a
production UI needs either generous-then-tightened cropping or an explicit "ignore any text touching
the crop edge" instruction). **This changes the forward-path picture from PART 1 above**: rather than
"different backend" or "fall back to Tier 1 bubble-level," a THIRD path now has real positive signal —
manual panel selection (removing localization risk entirely) + model text-extraction (which just
proved partially, iterably fixable). Still not production-ready, and no ruling has been made on
whether to pursue this over the other two paths — but this is the first `§2.4` measurement with more
good news than bad.

### PLAN §2.4 — RESULT PART 3 (Aug 25 2026, same session) — a different model changes the picture entirely

User asked "could we use a more powerful model?" No GPU exists on this machine (`lspci` confirms
Intel integrated graphics only, no CUDA), so a genuinely bigger local model was expected to be
impractically slow; a same-size-class BUT different/newer architecture was tried instead: pulled
`qwen2.5vl:7b` (6.0GB) and re-ran every probe from PART 1 and PART 2 against it, unchanged prompts,
same fixture, same crop, for a clean model-vs-model comparison:

- **Text extraction** (`probe_comic_text_extract_v85_i.js`): a PERFECT match on both fields, first
  try — resolved every remaining minicpm-v4.5 defect at once (the OCR letter error, the un-rejoined
  split word, AND the crop-bleed-through line) at a cost of ~294s vs ~65-85s per call.
- **One-shot panel enumeration** (`probe_comic_panels_v85_i.js`): correct format (unlike minicpm,
  which ignored the requested tag), CORRECT COUNT (6), and a clean, consistent, evenly-spaced grid in
  EXACT reading order — no confabulation, no repetition loop, the single failure mode this whole probe
  series was built to catch. ~296s for the call.
- **Stateless grounding** (`probe_comic_panels_grounded_v85_i.js`): the one place qwen2.5vl:7b did
  NOT do well — 2 of 6 boxes came back geometrically inverted (negative height), and two others
  duplicated the same region, the identical consistency failure minicpm-v4.5 had with this exact
  strategy. Much faster though (1.6-1.9 min for all 7 calls vs 8-10 min) — machine load had dropped
  by this point in the session, so per-call cost is not directly comparable across the two models'
  runs.
- **Stateful grounding** (`probe_comic_panels_stateful_v85_i.js`): clean success — fixed exactly what
  stateless grounding got wrong (no negative boxes, no duplicates), a consistent 6-panel grid matching
  the one-shot result. 2.5 min for all 7 calls. Notably, feeding prior answers into context helped
  qwen2.5vl:7b (stateless→stateful went from broken to clean) but did NOT help minicpm-v4.5 in the
  same test (stateless→stateful stayed broken, differently) — the value of "give the model its own
  prior answers" is model-dependent, not a universal fix.

A parser bug was found and fixed along the way (not a model defect): the number-matching regexes
across all three panel-finding probes required literal digits only, so a legitimately negative
boundary coordinate (`<box>-10 -6 378 394</box>`, a corner panel's box slightly overshooting the image
edge) silently produced a garbled, wrong-looking box instead of a parse failure or a correct negative
value. Fixed by allowing an optional `-` per coordinate in all three probe files' parsers — worth
remembering for any production parser built on this protocol.

**VERDICT.** `qwen2.5vl:7b` passes 3 of the 4 tasks tested cleanly (text extraction, one-shot
enumeration, stateful grounding) and fails the 4th (stateless grounding) in the SAME way `minicpm-v4.5`
did. This is a genuinely different picture than PART 1: **the simplest strategy — one-shot
enumeration — now works outright**, on the easy fixture, with this model. Two things are still
unverified: (1) whether this generalizes to `§2.7`'s HARD fixture (Page A — rotated text, unframed
panels, text outside its panel, ambiguous order), the actual regression case the whole `§2.4` protocol
was designed to stress-test, not yet tried with any model; (2) per-call latency (~5 min for a single
qwen2.5vl:7b vision call when the machine is under its earlier load, as low as ~15-20s when it is not)
is workload-dependent on this CPU-only box, not a fixed number — real production timing needs
measuring under realistic concurrent load, not this session's on-and-off contention. **No ruling has
been made on which panel-finding strategy (if any) to build on, nor on whether Track A4 moves forward
with `qwen2.5vl:7b`, a cloud backend (not yet tried), or the manual-panel-selection design from PART 2
— all three remain live options with real positive signal behind them now.**

### PLAN §2.4 — UI SCOPING (Aug 25 2026, same session) — the manual-panel-selection design, milestone plan

User: "start scoping the UI." This is the PART 2 design — user draws panel rectangles by hand,
removing localization from the model's job, model only extracts text per drawn panel — chosen because
it tested more reliably than any model-driven panel-FINDING strategy in PART 1/3. Two rulings made
before scoping: **uploaded page images are stored inline as base64 in `lessons.json`** (consistent
with the existing "everything is one JSON store" architecture; no static-asset route exists anywhere
in this app today, and building one is out of scope for now — revisit if corpus size becomes a real
problem); **panels are drawn first, extracted in one batch afterward**, not one-at-a-time with a wait
after each rectangle.

**What already exists and where this plugs in** (verified by reading the actual code, not assumed):
- `#gen-card-2`'s text-source cluster (`#pdf-panel`/`#user-story-panel`/`#dialect-panel`, each a
  sibling `<div>` gated by its own checkbox in `#user-story-checks`) is the right home for a NEW
  sibling `#comic-panel` — the existing upload entry point (`#upload-file-input`, `onUploadFileChosen`)
  is text-shaped end to end (PDF/txt branch, then a chunking-into-chapters pipeline) and cannot carry
  an image through it; this needs its own parallel path, not a branch inside the existing one.
- `_storyBodyHtml(d, opts)` is the ONE shared story renderer already reaching every progress card,
  question panel, and the storyline chain view (the precedent: translation-toggling and
  highlighting both reach every caller for free through this one function). A new branch here,
  keyed on a new `d.comicPanels` field, is the correct integration point for PART 2's progress-card
  ruling (comic-sourced chapters only) — low risk, because it is one data-shape check in code every
  consumer already shares, not four separate call sites to keep in sync.
- The SERVER-SIDE job primitive (`newJob`/`jobStep`/`jobDone`/`jobFail`, the generic `/api/job/:id`
  poll route) is genuinely generic — `data` is an opaque payload, not tied to story-generation. A new
  comic-extraction job type can call it exactly like `_runBookJob` does. The CLIENT-SIDE
  `startBackgroundJob` wrapper does NOT reuse directly — it is hardwired to story-generation's own
  completion actions (`showStorylineForTopic`, `j.data.topic`) — a new, structurally similar sibling
  function is needed, following the pattern, not the code. (Checked per rule 12 — the "reuses existing
  machinery" claim holds for the server half, not the client half.)
- `llm.js`'s `_callOllama` has NO `images` support today — every one of this session's probe scripts
  hand-rolled its own raw HTTP call to `/api/chat` because of this. Production code should add
  `opts.images` to the existing call (it already has an `opts` bag for `think`/`stop`/`ctxTokens` —
  same shape), not keep the probes' one-off duplication.
- Per `§2.3`, cropping happens CLIENT-SIDE via `<canvas>` + `toBlob()`/`toDataURL()` (free, no new
  dependency) — the probes' crops were made with a system ImageMagick call, which is not available
  inside the deployed app; the production path was always meant to be the browser canvas route this
  session's fixture work skipped only because it was faster to script.

**Milestone plan** (mirrors `PLAN §13`'s own build order — ship the model-independent part first):

1. **Upload entry + panel-drawing UI, no model calls.** New `#comic-panel` (image file input, accepts
   image types — `#upload-file-input`'s `accept` needs extending or a second input), the uploaded
   image displayed with a canvas overlay for mouse-drag rectangle drawing, a list of drawn boxes with
   delete/reorder, reading order = draw order (adjustable). Entirely testable without touching
   `server.js`/`llm.js` at all — the first new UI affordance of its kind in this app (no drag-rectangle
   precedent exists), so this alone is real, not-trivial client-side work.
2. **Batch extraction.** "Extract text" action crops each drawn box client-side (canvas), sends all N
   crops to a NEW server endpoint/job (`llm.js` gets `opts.images`; a new job type mirrors
   `_runBookJob`'s shape), a new client-side poller (sibling to, not a reuse of, `startBackgroundJob`)
   shows one combined wait instead of N interruptions, matching this session's own probe-validated
   prompt (worked example for case-restoration, caption/in-scene labeling).
3. **Chapter formation.** Panel texts, in reading order, concatenate into the ordinary `d.story` field
   (backward-compatible with every existing text consumer: vocab extraction, comprehension questions,
   search) — comic-sourced content becomes chunked text feeding the SAME chaptering/lesson-type
   pipeline PDF/pasted-story uploads already use. `d.comicPanels` (box, text, kind, image) is stored
   alongside for milestone 4.
4. **Progress-card integration** (comic-sourced chapters only, per the standing ruling). New branch in
   `_storyBodyHtml`: when `d.comicPanels` is present, render each panel's image with its transcribed
   text, each WORD individually clickable/highlightable via the EXISTING vocab-highlighting machinery
   (`_highlightVocabHtml`) applied to the transcribed text — Tier 1 per `§2.6`, not per-word image
   coordinates (Tier 2, still explicitly out of scope, still not measured).

**Not yet started — no code written for any of this.** No ruling yet on which vision model/backend
milestone 2 targets (open per PART 3 above), nor on exact box-storage schema field names. Milestone 1
has no such dependency and could start independently of that open question, since it touches no model
at all.

### PLAN §2.6 — The interactive word map (user, at the v80 cut) — build it where coordinates are FREE

**The idea:** overlay the image with the coordinates of the extracted text so the learner can click
a word *in the picture* and get a vocab/grammar question about it.

This is the best fit for the product's own one-line description — *"explore the language of existing
texts"* — that anything in the plan has, and most of it already exists: the question types are
built, `_storyWordSources(d)` already collects "what words does this chapter teach", and the
per-word progress store is keyed by word. **What is new is only the coordinate map and an on-demand
question for an arbitrary word.**

But the difficulty is wildly different per input type, and that should drive the order:

**Tier 0 — born-digital PDF: coordinates are EXACT and FREE.** `pdf.js`'s text layer returns per-item
text with a transform matrix — position, scale, font size — for every text run on the page, with no
model call and no error. **A clickable word map over a PDF page is a rendering exercise, not a
research one.** If §2.5 goes the `pdf.js` route, this feature comes almost free with it. **Build it
here first.** It also proves the whole interaction — hit targets, question-on-click, tracking —
against a source of truth, so that when the image path arrives, only the coordinates are in doubt.

**Tier 1 — images, BUBBLE-level (recommended first image step).** Ask the model for text-block /
speech-bubble boxes, not words: few per panel, coarse, and the same referring-expression shape as
panel grounding — the model's demonstrated strength. Clicking a bubble opens the transcribed text as
**ordinary HTML with each word clickable**. Perfect hit targets, no per-word coordinates needed, and
it degrades gracefully: a slightly wrong bubble box is still a usable click target, whereas a
slightly wrong word box lands on the wrong word and teaches the wrong thing.

**Tier 2 — images, true PER-WORD boxes. This is the speculative one, and it is a real step up.**
A comic page can carry 100+ words. Per-word grounding means either many boxes in one response —
where confabulation risk scales with count and nothing in the output signals it — or one call per
word, which is not affordable. **Do not design around this until the §2.4 overlay probe has run**,
and extend that probe to ask for word boxes in one bubble so both questions are answered by the same
20 minutes of work.

There is also a **derived** option worth testing cheaply: take the bubble box plus the transcribed
string and *estimate* word positions by proportional layout inside the box. Free, no extra tokens,
and probably fine for typeset prose — but comics are hand-lettered with unknown line breaks, so
expect it to fail exactly where it is being asked to work. Test it against Tier 2 output rather than
assuming either way.

**Cheap verification, whichever tier ships:** boxes must lie inside the image bounds, must not
mutually overlap beyond a threshold, and the union of text boxes must account for the extracted
string. None of that needs language knowledge, and it catches the well-formed-but-wrong failure that
is otherwise invisible. **A wrong box is worse than no box** — it silently teaches the learner that a
word means something it does not — so the overlay should fail closed: no confident box, no click
target.

**One product question, not a technical one:** this feature stores and re-displays someone's
artwork with an interactive layer on top. The plan already scopes the corpus to *"known texts w/o
copyright"*; `murmel-comics.org` needs its licence checked before it becomes the demo case, and
user-uploaded images need a decision about whether they are stored server-side at all.

### PLAN §2.7 — Two REAL pages, read by eye at the v80 cut — what they change

The user supplied two German comics. They bracket the difficulty so well that they should become
the two fixtures for all of Track A. **Everything below is from reading the pages, not from running
a model** — these are the things the §2.4 probe has to be built to catch, not results.

**Page B ("Ein Scheissland", signed M. Lüq) — the EASY case, and the right ACCEPTANCE fixture.**
A clean 2x3 grid of rectangular panels under a title. Caption boxes sit at the top of each panel,
hand-lettered all-caps. Reading order is unambiguous left-to-right, top-to-bottom, so the
deterministic sort proposed in §2.4 is provably enough here. Two pieces of *in-scene* text (a sign
and a banner) sit inside the drawings rather than in caption boxes — a useful wrinkle, because they
must be distinguishable from narration and are exactly the kind of thing a naive "text on page"
extraction flattens together.

**Page A ("Weg? Woanders? Oder nur unsichtbar?") — the HARD case, and the right REGRESSION fixture.**
It defeats four assumptions at once:

1. **Rotated text.** The title runs diagonally; a whole caption runs bottom-to-top at 90 degrees up
   the middle of the page. **Axis-aligned bounding boxes cannot represent this** — the AABB of a
   rotated line overlaps everything beside it, so a per-word click map built on AABBs will put the
   wrong word under the pointer, and the overlap check proposed in §2.6 will fire on correct output.
   Either boxes carry a rotation, or rotated text is detected and excluded.
2. **Unframed content.** A large heart illustration and its caption have no panel border at all.
   **Panel detection by finding rectangles finds nothing there** — grouping has to be semantic.
3. **Text outside the frame.** Captions sit below their panels rather than inside them, so
   "associate text with the panel whose box contains it" is wrong on this page and right on page B.
4. **Genuinely ambiguous reading order.** Where the vertical caption falls relative to the heart
   caption is a judgement a human makes from layout. A top-to-bottom-then-left-to-right sort will
   produce a confident wrong answer.

**The finding that reaches beyond the overlay: WORDS ARE BROKEN ACROSS LINES.** Page A hyphenates
`SON-` / `DERN` across a line break; page B splits `WILL` / `KOMMEN` across lines **with no hyphen
at all**. This breaks three things, only one of which is the word map:

- the map, because one word occupies two disjoint boxes;
- **vocabulary extraction**, because the lesson would teach `son` and `dern` as words;
- **the story text itself**, which would carry the break into every downstream lesson and QC pass.

So de-hyphenation and line-rejoining belong in the extraction step, before anything else sees the
text — and the no-hyphen case means it cannot be done by looking for hyphens. It is a language
judgement, so it is the model's, per INTERNALS section 4.

**The finding with the most pedagogical weight: ALL-CAPS DESTROYS GERMAN NOUN CAPITALISATION.**
Both pages are lettered entirely in capitals. German capitalises nouns, and that distinction is
information a learner is being taught. `KÖPFE`, `MENSCHEN`, `ANGST`, `SCHATZ` must come back as
`Köpfe`, `Menschen`, `Angst`, `Schatz`, while adjectives and verbs must not. **Extraction from
capitals is therefore not transcription, it is restoration**, and the same applies to `SS` -> `ß`
(`GROSSES` -> `großes`, but `SCHEISSLAND` is a judgement). Hand-drawn umlauts are an accuracy risk on
top. None of this is the app's to decide; all of it must be asked for explicitly in the prompt and
then QC'd, because a silently mis-capitalised noun teaches the wrong rule.

**What this implies for the plan:**

- **Ship against page B, regress against page A.** A version that handles B well and *refuses* A
  cleanly is a good version. A version that produces confident boxes for A is a broken one, and
  page A is how you find out.
- **Fail closed becomes a hard requirement, not a nicety** (section 2.6). Page A is the page where
  plausible-but-wrong output is most likely and least detectable.
- **The probe needs GROUND TRUTH**, or it measures nothing. Somebody has to transcribe both pages by
  hand once, into a fixture, including the intended reading order and the restored capitalisation.
  That is an hour of work and it is what makes every later extraction change measurable instead of
  eyeballed.
- **Content curation is not only about copyright.** Page B is pointed political satire; page A is
  about bereavement. Both are legitimate reading material and neither is automatically suitable for
  an arbitrary learner or an auto-generated "meet and greet" corpus. The corpus needs a suitability
  axis alongside the licence one.
- **Page B is signed by an identifiable artist.** The licence question in section 2.6 is live for
  this specific page, not hypothetical.

### PLAN §2.5 — PDF needs NO decision — corrected again (user, at the v80 cut)

**My §2 draft asked for a PDF ruling that does not exist.** The user's correction: PDF is used for
TEXT only and already works; comics arrive as PNG. Checked, and it is more settled than that:

- **`pdf.js` is already loaded**, from `cdnjs` at `index.html:4394-4402` — the same CDN pattern the
  app already uses for KaTeX. So the "single-file client" property was **already relaxed for exactly
  this**, and nothing new is being decided.
- **Extraction already reads per-item GEOMETRY**, not just strings. `page.getTextContent()` items
  are grouped by `item.transform[5]` (y) and the minimum `item.transform[4]` (x) is kept per line,
  because — as the `v71_b` comment there says — the vertical gap distinguishes a paragraph break
  from a wrap and the left edge marks an indent.

**Rasterisation was never needed.** Delete the option list; there is no dependency question, no
`package.json`, no ruling. The two input paths are simply separate: **PDF/markdown/paste → text,
already built. PNG → vision model, needs nothing new (§2.1).**

**But this has a consequence for §2.6 that runs the other way, and it is good news:** the exact
per-word coordinates the word map wants are **already flowing through `_extractPdfText` and being
discarded.** `content.items` carries a full transform per text run; the current code takes `y` and
the line-minimum `x` and drops the rest. Tier 0 of the word map is therefore not new plumbing — it
is *keeping* what is already read, alongside the text that is already produced. That makes it the
cheapest place in the whole plan to build and prove the click-a-word interaction, against
coordinates that cannot be wrong.

One caveat to measure rather than assume: pdf.js emits text *runs*, not words. A run may be several
words or part of one, so word-level boxes need splitting a run by character widths — approximate,
but bounded and checkable, and vastly better than the image case.

### ~~PLAN §2.5 PDF is the only case that still needs a decision~~ — SUPERSEDED

> **Superseded by `PLAN §2.5` above** (*"PDF needs NO decision — corrected again"*), which the
> user's challenge produced. Kept, not deleted: this is the version that says what the
> decision WAS, and a reversal without its original is unreadable three cuts later.

A PDF is not an image; feeding it to a vision model requires **rasterising** it first, and that is
the one step with no built-in. Options:

- **Rasterise in the browser** with `pdf.js` from a CDN → canvas → PNG → the exact same vision path
  as 2.1. One code path for PDFs and comics both. Costs the single-file client property for the live
  app and needs a decision for `docs/index.html`.
- **Text-layer-only fast path**: `pdf.js` can extract an existing text layer with no model call at
  all — free and exact for born-digital PDFs, which is most uploaded prose. Fall back to
  rasterise+vision for scans and comics.
- Accept a Node dependency (**needs an explicit ruling**, ends a long-held invariant).

**Recommendation: browser `pdf.js` doing text-layer-first, rasterise-on-fallback, feeding the
existing chat+images path.** Images need no library at all; PDFs need only a client-side one; the
server stays zero-dependency in every case.

## PLAN §3 — Track C — the surface clean-up (do this first)

Ordered so that each session ends shippable. Every one of these lands on `probe_gates_v77.js`
territory; **re-run and diff against `v80_card_gates.txt`** (the `v77` table is superseded, and the
`v80` baseline exists because the drop moved it).

### PLAN §C0 — UI architecture rework: bounded screen ownership, not a rewrite

**Direction accepted by the user at the `v81_l` cut.** Separate generation, settings, QC/editing,
progress/story, and later library browsing into screen-level surfaces. Do it incrementally while
each affected flow is reworked—not in a whole-codebase refactor before product work, and not after
new flows have been cemented into the monolith.

The current client already has a generic `show(id)` switcher and several `.screen` roots, but no
authoritative `APP.screen`/route state. The landing surface still combines generation with the
library; settings and QC/editing are scattered controls or panels. Preserve all of their supported
entry/exit behaviour while giving each future screen one owner.

> **One screen owns its rendering and event wiring; shared state and navigation live outside
> screens; no screen reaches into another screen's DOM.**

**Implementation sequence:**

1. **C0.1 — lock journey behaviour before moving it.** Add behavioural transition tests for the
   learner walk (progress card → story → lesson → return), and for generation/settings entry and
   exit. Test the rendered/interactive route outcome, not the source spelling of a helper. This is
   the next code slice.
2. **C0.2 — small router seam.** Make one authoritative route state (`APP.screen` or equivalent)
   and explicit screen renderers such as `showProgressCard`, `showStory`, `showGeneration`, and
   `showSettings`. It must first preserve every current entry point; no visual redesign bundled in.
3. **C0.3 — move only the surface under active rework.** Start with generation and settings, then
   progress/card state plus story navigation. Move QC/editing, exercise running, and library browsing
   later, one bounded surface at a time.
4. **C0.4 — remove only proven-dead paths.** An old story-display or navigation path goes only after
   route-parity tests cover every supported entry point and a caller search finds none.

**Story-display rule:** retain one canonical story-panel body renderer with mode/options (for example
`{context:'progress'|'summary'|'unlocked', actions, collapsed}`), rather than accumulating near-
duplicate story views. Each screen owns its surrounding card/layout and actions; the shared renderer
owns only the story body. `_storyBodyHtml` is the current seam and must remain the sole body renderer.

**Distribution rule:** keep the single-inline-client/static-build model. “Modules” initially means
well-delimited functions and state ownership inside `index.html`; external client files are a
separate architecture decision requiring a deliberately designed and verified embed/bundle path.

This rework does **not** authorise a second app, a playback rewrite, changed gates, altered learner
progress, or a wholesale DOM rewrite. It is the enabling structure for future progress-card work and
the new generation/settings/QC pages.

### PLAN §C1 — Progress-card structural fixes (1 session) — the BUGS first, before any cosmetics

Two of the plan's items are **defects**, not design, and they should not wait behind the cosmetic
list:

- **"I browsed forward to the story card and back, solved no comprehension lesson, yet could
  proceed to the next chapter."**
- **"Via the replay button or otherwise, I could play the comprehension lessons BEFORE the
  chapter-story was unlocked."**

These are the same suspicion from both sides: **the gate is being computed from render state rather
than from lesson state**, so navigation can move the learner past a gate that never opened. They
are also the two items most likely to be *masked* by the cosmetic rework, so measure them before
touching the cards.

**First move is a probe, not an edit** — the pattern that worked for the fork task. Drive
`chapterComplete`, `lessonCountsFor`/`countedLessons` and the unlock gate directly, reproduce both
sequences, and report what each says before and after. Fold in the **single-chapter 100% bar**
(§0.3) here, since it is the same helper (`_slProgressStats` adding one for the in-progress
chapter) and the same screen.

**✅ MEASURED at `v81_f` (session 37), and the plan's reading is WRONG.** The header bar is NOT an
index off-by-one. Both symptoms are the SAME LINE — `_slProgressStats`'s
`unlockedChapters = doneChapters + (doneChapters < total ? 1 : 0)` — and `pct` is computed from
`unlockedChapters`, so the bar measures how much of the deck is OPEN, not how much is DONE. On a
fresh install, with `doneChapters = 0` everywhere:

```
deck size   decks   bar shown before anything is played
 1 chapter    27     100%   <-- and the label reads 1/1
 2 chapters   22      50%
 3 chapters   12      33%
 4 chapters    9      25%
 …
14 chapters    1       7%
                     ALL 91 storylines show a partly-green bar at doneChapters = 0.
27 of 91 — every single-chapter deck — read 1/1 and 100% before a single question.
```

So the roadmap's warning was right: fixing these as two off-by-ones would have left the real one.
**⚠️ AND THE `+1` IS A USER RULING** (`v77_p`: "the chapter in progress counts, which is why a fresh
storyline reads 1/2 rather than 0/2"), so it cannot simply be removed — that would reverse a ruling.

**THE RULING NEEDED, and it is one question:** the label and the bar currently mean the same thing.
The minimal change that keeps `v77_p` intact is to **split them** — the LABEL keeps counting UNLOCKED
chapters (1/1, 1/2 — the ruled behaviour), while the BAR counts COMPLETED ones, so a fresh deck reads
1/2 with an empty bar and a single-chapter deck reads 1/1 with an empty bar. The cost is that a deck
can read 2/2 with a half-full bar, because "2 of 2 chapters open" and "1 of 2 finished" are then
different statements. The alternative is to leave the bar alone and accept 100%-before-play on 30%
of the corpus. **Not implemented — a headline number is not ours to redefine (rule 24).**

**The original note:** the plan reads this as an index-off-by-one ("current-1"). **Verify that before
implementing it**; the same helper
produces the 100%-on-one-chapter result, so a single root cause may explain both, and fixing them
as two off-by-ones would leave the real one.

### PLAN §C2 — Progress-card content and copy (1 session)

Low-risk, high-visibility, all guarded by the gate probe:

- ~~third progress bar for comprehension lessons on the entry card;~~ **⚠️ AT RISK from TRACK T**,
  which proposes dropping the chapter bars entirely. **T2a shows that reasoning is unsupported**
  (only 6% of story tokens are highlighted), so this is NOT settled either way — do not build the
  third bar and do not delete the others until the user rules. See TRACK T.
- the bottom-row message replaced by the **chapter title** on all card states (entry, in-progress,
  unlocked-in-green) — one change applied consistently, so build it as one helper with a state
  argument, not four call sites;
- post-unlock questions labelled **"text comprehension"** rather than by the next chapter's name.
  **Check `ui.json` for an existing key first** — the plan says to reuse one if present, and adding
  a key means 33 languages;
- ~~the "next chapter unlocked!" card **removed from the flow**, going straight to the next entry
  card;~~ **RULED AND SHIPPED as `v80_e` — MERGE.** As written this was not executable: since
  `v77_q` there was no entry card for chapters 2..N, because that card WAS it. The entry card is
  now generalised to every chapter and the unlocked card is deleted. **See the `v80_e` entry at
  the top of this roadmap.**
- entry card shows the story summary as the storyline page does, **default uncollapsed**;
- chapter entry cards ≥2 remodelled to match chapter 1.

**Watch for:** removing a card from the flow interacts with C1's navigation bug. Do C1 first or the
two fixes will be hard to attribute.

### PLAN §C3 — Read-out everywhere (1 session)

Speech buttons on every vocabulary field and every chapter text field, on the final card too, with
**each item read in its own language** (vocab in target, translation in source). Clicking an
individual vocab item reads it.

This is the natural home for **"show the no-TTS-available message when the user clicks speech and
that language has no voice"** — the app already has `_ttsNoVoice` and the 🗣 pill for exactly this,
so it is wiring, not new behaviour. It also inherits `v79_n`'s `_speechLocaleFor`, so per-chapter
speech locale applies automatically. **`unit-speech-locale` §11 already guards that a voice picked
for one language never speaks another** — the property this feature depends on most.

### PLAN §C4 — The Settings Card and floating pills (1–2 sessions) — the biggest UI change here

A cog pill next to the login pill on **all** pages, including static, absorbing: the UI control row,
speech-language setting, model selection, sound test, missing-UI-entries, teacher mode, import,
static export, learners. Plus a **global mute pill** replacing every scattered mute button — while
keeping all read-out buttons, which are a different thing.

**Acceptance details retained from the user's original UI brief:**

- The source→target language selector is visually reduced to an **arrow control**: remove its
  duplicated icons and descriptive text without changing the selected language-pair state.
- If a lesson is using speech different from its intended target/chapter/storyline locale, the SC
  shows an explicit status pill and a **one-click restore action** for the intended speech. This is
  not a second read-out control: it is state visibility and recovery for the global speech setting.
  Individual read-out buttons remain in place and continue to speak their own field language.

**Three specific risks, from this session's scars:**

1. **The static build re-implements client functions.** `build-static.js` overrides 19 of them.
   `unit-static-selectlang-tts` now guards that overrides keep their live twin's UI-refresh calls —
   **extend its `REFRESHERS` list as the SC adds refreshers.** The list is a judgement, and the test
   says so.
2. **"Available in the static page" is a requirement, not a footnote.** Model selection, import and
   learners have no meaning without a server. Decide per item whether it is *hidden* or *disabled
   with a reason* in static mode, and write the decision down — a silently missing control reads as
   a bug.
3. **The mute consolidation touches `data-mute-tip`/`updateMuteButtons`**, which already has a
   guard (`unit-tts-test-row`) that broke twice this session on text-level pins. Expect to
   re-anchor it, and re-anchor at the claim.

### PLAN §C5 — Generation Card, QC Card, flag pill (1–2 sessions)

- Generation moves off the main page into its own card, aligned with the storyline and
  "add lesson" entry points — **this is the resurrected `§0i` from `roadmap_v79.md`** (§0.2), which
  was marked BLOCKED on §1; check what that block was before assuming it is gone.
- QC bulk actions get a card with **selectable QC types** (already in the old roadmap).
- The download-flagged pill shrinks to a filled-flag pill, expanding on click, with a
  **guarded "clear all flags"** and clearing on GitHub-link click.
- Keep those three cards independently reachable: a Generation Card is the common destination for
  landing, storyline continuation, and single-chapter "add lesson" affordances; a QC Card owns bulk
  runs rather than absorbing the local item/story repair controls; the flag pill is adjacent to the
  login/SC pills and reveals its details only on demand.

### PLAN §C6 — LMGTFY widget (half a session, do it as a filler)

Self-contained and genuinely small: extend a story-interpretation prompt to emit a list of unusual
or technical terms (`«programma di ricerca»` in `tp_17851387238120000029`), render a collapsible
floating widget of search links, search engine settable in the SC.

**Two notes.** The prompt must call `scriptPinNote` if it emits target-language text —
`unit-script-pin-coverage` **sweeps the source** and a new prompt fails until classified. And
"words the model itself doesn't recognise" is a self-report; treat the list as a *suggestion
surface*, never as a claim about the language, per the "no language knowledge in the code"
principle.

---

## PLAN §4 — Track E — export (1 session, no dependencies, do it early)

Printable **(a) exams** (MCQ + text fields) and **(b) teaching material** (full story with vocab
highlights, full translation without). Both are pure transforms of data that already exists, and
`_storyWordSources(d)` is already the single collector for "what words does this chapter teach".

**Print, not PDF-generation.** A print stylesheet plus a print-optimised render costs nothing and
sidesteps §2 entirely; the browser makes the PDF. Only reach for real PDF generation if you need
server-side batch export, and that is a Track A decision.

This is the item I would slot into any session that finishes early.

---

## PLAN §5 — Track D — lesson types (1 session each, but ONE needs a ruling first)

### PLAN §D1 — Mixed-lesson composition (1 session)

Let the user pick which lessons join a mixed lesson via a dropdown of the chapter's lesson
ids/titles/types. The plan notes this could optionally include **all lessons of previous chapters**
and thereby **replace reinforce/extend**. That is the more interesting half and the riskier one:
replacing an existing feature deserves its own decision and its own release, not a checkbox in a
dropdown release. **Split it: composition first, reinforce/extend replacement second.**

### PLAN §D2 — Cases and articles — NEEDS A RULING, and it is the "no language knowledge" line

The plan asks for noun cases and definite/indefinite article distinctions (`der/die/das`,
`ein/eine`; `ova/ovo` vs `taj/ta/to`), and explicitly anticipates *"a table languages × lesson
types to indicate whether a given lesson type makes sense in that language"*.

**That table is language knowledge in the app**, and `INTERNALS.md` §4 makes its absence a design
principle with a documented list of known violations. The project has already ruled this way once,
in a neighbouring case: the `cyrillic-sr` sounds column was authored, mechanically verified, and
**reverted**, because its absence enforces a `v75_g` ruling — and `unit-intro-script` catches its
return.

So this needs an explicit decision, and there is a middle path worth considering: **let the MODEL
declare per-language applicability at generation time and cache the answer as data** (in
`languages.json`), rather than the app encoding a table. That keeps the knowledge in the tier
INTERNALS §4 assigns it to, and the cache is then a measurement, not a claim.

The "reveal the full phrase, correct article and word form together" part needs no ruling and can
ship independently.

### PLAN §D3 — Generic, story-independent lessons (1 session)

A user prompt field producing lessons not tied to a story ("train colour names, include brown").
The plan's own scoping is right: **standard vocabulary first**, one lesson type, one prompt field,
following the existing LLM-math precedent. Note the new prompt needs `scriptPinNote` (§C6) and a
`_genMeta` record like every other generator.

### PLAN §D4 — Free-text WRITING + feedback (user, `v82` cut) — a new CATEGORY, not just a new type

*"The user is supposed to WRITE a short text on a given topic, and a new model prompt receives that
text and provides feedback on typos, grammar, and eventually also content. First versions likely
already work with our current default model."*

**Architecturally distinct from every lesson type shipped so far, in one specific way worth naming
before building it:** every existing type — `standard` through `inflections` — is generated ONCE, at
chapter-generation time, validated, stored, and then PLAYED many times from that static content. This
type cannot work that way. The learner's submission does not exist until they write it, so grading it
needs a LIVE model call **at play time**, not a batch one at generation time. The only existing
precedent for a live, per-session model call is the tutor chat (`callLLMTutor`/`callLLMTutorStream`,
`OLLAMA_TUTOR_MODEL`) — not any lesson generator. That has real consequences, not just an
implementation detail:

- **The static build cannot offer it at all.** `docs/index.html` has no server behind it — that is
  the whole point of the static build — and grading needs one. Either this lesson type is excluded
  from the static export entirely (say so in the UI, the same honest-degradation call already made
  for D4/images in §9b), or it is the first feature that makes "no server needed" no longer true for
  part of the app. **Worth surfacing now, before anyone assumes it "just works" in both modes like
  everything else does.**
- **It needs a new play-time API route**, not just a new generator function — every other type's
  server-side surface is `generate*` (batch) + `qcCheck*` (batch); this needs the shape of
  `/api/tutor` (live, per-request) instead, with the SUBMITTED TEXT as the payload rather than a
  topic/difficulty pair.
- **There is no single "correct answer" to store or check against**, unlike every MCQ/fill-in/select
  type — the model's feedback (typos found, grammar corrections, eventually content commentary) IS
  the exercise output, generated fresh per submission, not selected from pre-authored choices. QC in
  the existing sense (checking one generator's OUTPUT against a rubric before showing it to a
  learner) does not apply the same way here — there is nothing to QC in advance, because there is no
  advance.

**Scoping, following the user's own staging:**
1. **Typos + grammar first** — the narrower, more mechanically checkable half, and the one the user
   already expects to work with the current default model.
2. **Content feedback second**, explicitly flagged by the user as likely needing a stronger model or
   more careful prompting — "does this text actually address the topic" is a harder judgement than
   "is this sentence grammatical."

**Open, not decided here:** what the learner-facing UI is (a text box + submit, presumably new —
nothing existing takes free-form prose input at play time), whether a submission is stored at all
(and if so, whether it goes in `lessons.json` alongside everything else, or somewhere separate, given
it is per-learner content generated at play time rather than per-topic content generated once — closer
in shape to `APP.progress`/observations than to a lesson's own `items`/`vocab`), and whether/how this
interacts with the learner-progress and coverage machinery every other exercise type feeds (`markSolved`,
`_wordProgress`, the pass mark) — a free-text submission has no `qid` in the existing sense.

---

## PLAN §6 — Track F — QC rework (1 session, mostly independent)

Ordered by how much each is worth:

**F1. Word-forms QC: detect distractors that also make an error-free sentence.** This is the same
defect `probe_word_forms_v79i.js` measures, now stated as a QC job. **Read the probe's header
first**: it is explicitly *"a measuring instrument for a human, NOT a validator — rejecting these
mechanically would mean the app encoding per-language grammar, which the model owns."* So F1 must
be **model adjudication**, not a deterministic rule, or it walks straight into §5's problem.

Also carry forward the `v80` finding: the regenerated lesson went from *5 items all two-choice* to
*6 items with 1 two-choice*, while the corpus-wide percentage stayed flat at 15% because
un-regenerated lessons dominate the denominator. **QC on old lessons is therefore worth more than
another prompt revision**, and F1 is how you get it.

**F2. The malformed word-forms items** in `tp_586040741` — the blanked word shown in the sentence
with the underline appended at the end (`"...across the path.___"`, answer `cast`). This one **is**
deterministic and safe: the item is broken as *structure*, independent of language — the answer
token appears in the stem and the blank is not where the word was. No language knowledge needed.
~~**Do this one first; it is the cheapest real win in the whole document.**~~ **✅ SHIPPED as
`v80_g`** — the blank-position half. The answer-visible half was measured and deliberately left
unenforced; see the `v80_g` entry at the top of this roadmap.

**F3. THE ARTICLE MESS — diagnosed at the v80 cut. It is a rule-31 case, and the "fixes" are why it
got worse.**

The user reports German->French vocab in `tp_17869977371640000022` full of pairs where the German
side carries an article and the French side does not. Both languages HAVE articles, so this is not a
"one language lacks them" case. **The generation prompt contains two rules that contradict each
other**, and the contradiction is not subtle once both are read together. From `prompts.json`,
`vocab.system`, in this order:

1. `BASE FORM ONLY: give every vocab word in its dictionary/citation form — verbs in the infinitive,
   nouns in the singular (with the usual article where the language uses one)`
2. `ARTICLE SYMMETRY for nouns: give the article on BOTH sides ("der Hund" <-> "il cane") or on
   NEITHER side ("Hund" <-> "cane") — never an article on one side only.`

**Rule 1 is PER-SIDE and appeals to each language's own citation convention. Rule 2 is a CROSS-SIDE
constraint.** They cannot both be satisfied for a pair whose two languages have different
lexicographic conventions — and German/French is exactly that pair: German dictionaries cite nouns
**with** the definite article because it carries gender (`der Hund`), French dictionaries cite the
bare noun with a gender tag (`chien, n.m.`). **A model following rule 1 faithfully produces
`der Hund` <-> `chien`, which is precisely the reported defect.** Rule 1 is stated first and is
framed as the definitional rule ("BASE FORM ONLY"), so it wins.

**Why it got WORSE with the attempts to fix it — three compounding reasons:**

- **The symmetry rule was ADDED next to the contradicting clause rather than reconciling it**
  (rule 31: *before strengthening an instruction, check whether it is already there and being
  CONTRADICTED*). This is the same failure as `v79_i`, where the word-forms prompt banned indecidable
  distractors and recommended them three bullets earlier. Adding a prohibition beside a live
  contradiction does not remove the contradiction; it makes the prompt longer and the behaviour less
  predictable.
- **A deterministic normaliser was removed for good reasons, and nothing replaced its coverage.**
  `server.js:4438` records it: the old code split `hail` into `grandine`/`hail` and *"dropped the
  gender an Italian learner needs while symmetric siblings in the same lesson kept theirs. It made
  lessons LESS consistent than it found them."* Removing it was right — but the comment then says
  *"the generation prompt still forbids a one-sided article; QC is the safety net"*, and the
  generation prompt does **not** forbid it cleanly, because of rule 1. **The safety net was hung on
  a claim that is not true.**
- **The QC check is context-dependent and degrades quietly.** `qcCheckPair` takes `siblings` — the
  other vocab items in the same lesson — and `server.js:1536` states that omitting them *"degrades
  the article check to a judgement without context"*. So the check's strength varies with what it is
  handed, and a lesson generated wholly one-sided gives it consistent-looking siblings to agree with.

**A fourth contradiction, across prompts:** `vocab` asks for nouns **with** the article; `grammar`
asks for `"{L} noun in singular form (no article)"` and adds `"target" must have no article
prepended`, carrying the article in a separate field. Two lesson types, two opposite conventions for
the same noun. That is defensible per lesson type but it means "the article convention" is not one
thing in this codebase, and any fix must say which convention applies where.

**The fix, in order, and NOT another sentence of prohibition:**

1. **Remove the contradiction.** Rule 1's parenthetical `(with the usual article where the language
   uses one)` is the clause to change — it is what invokes per-language citation convention. Decide
   which convention wins for vocab pairs and state it ONCE.
2. **Add a WORKED COUNTER-EXAMPLE, not a rule.** The word-forms prompt was fixed this way in
   `v79_i`: a shown broken item plus its repair. Here that is `der Hund <-> chien` marked BROKEN,
   with `der Hund <-> le chien` and `Hund <-> chien` both shown as acceptable.
3. **Then measure.** A probe over the corpus counting one-sided-article pairs per language pair,
   with the numbers in its header, so "it got worse" stops being an impression. **The `v80` lesson
   applies: the corpus-wide rate cannot move until lessons are REGENERATED, so measure per
   `_genMeta.at` cohort, not in aggregate** — that is exactly how the word-forms improvement was
   nearly missed.
4. **Only then** revisit whether the QC check should be strengthened. It may be adequate once it is
   no longer compensating for a self-contradicting prompt.

**Note this is downstream of the D1 ruling.** "Does this language use articles at all" is now a
model-declared, cached fact — so the symmetry rule can consult data instead of asking the model to
re-derive it inside every generation.

**F3c. MEASURED at the v80 drop — the contradiction produces a COIN FLIP, not a constant bias.**

The user reported that chapter 1 of the new German->French storyline had the asymmetry and chapter 2
did not. Measured on the drop:

| chapter | asymmetric vocab pairs |
|---|---|
| `tp_17869977371640000022` "Stille vor dem Winter" | **7 of 8** |
| `tp_17869980065780000104` "Brücke der Existenz" | **0 of 8** |

And the two are **generated identically**: same model (`qwen3.6:35b-a3b`), same `_genMeta.type`
(`standard`), `rejected: 0` on both, **four minutes apart**. No different prompt, no different code
path, no retry that could explain it.

**This is the strongest available evidence for the rule-31 diagnosis**, and it sharpens it: a
self-contradicting instruction does not bias the output consistently, it makes the outcome
**unstable** — the model resolves the conflict differently from sample to sample. Two consequences:

- **It explains "seems to have gotten worse".** With a coin flip, a run of bad luck reads exactly
  like a regression, and a run of good luck reads exactly like a fix. Neither impression is
  measuring anything.
- **Therefore a single lesson can never validate the fix.** N=1 cannot distinguish "corrected" from
  "got lucky", and chapter 2 above is precisely a lucky sample of the broken prompt. **The F3 probe
  must sample MANY lessons per `_genMeta.at` cohort and report a RATE with its denominator**, not an
  example.

The failure direction also confirms the mechanism exactly: every asymmetric pair has the German
source carrying the article (`das Eichhörnchen`, `der Winter`, `die Begegnung`) and the French target
bare (`écureuil`, `hiver`, `rencontre`) — German citation convention applied on one side, French on
the other, which is what rule 1's `(with the usual article where the language uses one)` asks for.

**F3b. QC PROMPTS BELONG IN `prompts.json` (user, v80 cut).** Partly true already: `storyQc` and
`srcRepair` live there and are read via `fillPrompt(PROMPTS.storyQc.system, ...)`. **The lesson-level
QC prompt is still inline in `server.js`.** Moving it is small, but the user's second clause is the
valuable half — *"more systematically aligned with the generating prompts"*. The article mess is the
argument for it: **a QC prompt that checks a convention lives in a different file from the
generation prompt that sets it, so the two drift and nobody notices.** Pairing them — same file,
adjacent keys, ideally a shared fragment for any rule both must state — is what would have made this
contradiction visible. Do it as part of the F3 fix, not separately.

**F4. Run-level QC token accounting** (§0.4) — small, do it alongside the QC card.

---

## PLAN §7 — Track A — ingest and the parallel curriculum pipeline (multi-session)

### PLAN §7.0 — the new lesson architecture: analyse and plan in parallel, deliver through the existing app

**Direction accepted by the user at the `v81_l` cut.** The new approach is different enough upstream
that TEXT → ANALYSIS → CURRICULUM PLAN should be designed cleanly, but it must **not** become a
second app. Keep the existing player, editor, export, static publishing, learner progress, and
playable lesson contract as the delivery path until the new route has demonstrated coverage, quality,
and recovery across several languages. The critical change is that lessons cease to be primarily
generated chapter-by-chapter: they execute a persistent learning plan over the whole text. A chapter
remains a learner delivery boundary, not the boundary of curriculum intelligence.

```
text source (PDF / text / markdown / comic / generated story)
  → canonical text model (story → chapters → sentences → stable spans/tokens)
  → language analysis (lemmas, forms, senses, phrases, frequency, script, provenance)
  → curriculum planner (what matters in this text, chapter, and for this learner?)
  → lesson plan (concept → exercise types, ordering, prerequisites, reason)
  → generator / validator (existing playable lesson types, richer metadata)
  → existing player / editor / export / static build
  → append-only observations → per-learner BKT skill estimates
```

**The semantic ladder is not "every word is a skill":**

```
token in sentence → normalised surface → lemma or multiword phrase → sense in context → language skill
```

Thus several forms such as *went*, *goes*, and *going* can contribute to one `go` vocabulary skill
and separate form skills; *take care of* may be one phrase concept, not three unrelated words.
Likewise, corpus presence is **not** evidence that a learner knows a word or that it has the same
sense. Reuse prior analysis, verified lemma data, exercise templates, and error patterns; let the
planner decide whether the learner needs the concept.

**Version and provenance are mandatory from the first record, not a migration afterthought.** The
planned fields are `topic.analysisVersion`, `topic.curriculumVersion`, `lesson.pipelineVersion`,
`lesson.sourceSpans`, `lesson.skillLinks`, and `lesson.planReason`. Every derived lemma, phrase,
frequency value, or model decision must state how and from which stable source span it was derived.
That makes re-analysis honest: an older result is visibly old rather than being represented as if the
current logic had produced it.

**Relationship to shipped Track B:** B1–B4 already supply the bottom of this diagram—append-only
learner evidence, reviewed target-language canonical IDs, vocabulary lesson links, and shadow BKT.
They are deliberately narrower than the new planner: current B3 tags only new standard vocabulary
lessons, and B4 controls nothing. Future `lesson.skillLinks` must preserve that reviewed canonical
identity rather than invent per-generator dialects.

**Migration sequence (each stage is independently useful):**

1. **CP1 — canonical text + analysis records, report-only.** Define stable story/chapter/sentence/
   span/token records and provenance. Analyse a small representative corpus without changing any
   existing lesson, learner state, player, or publishing output. **This is the next implementation
   slice.**
2. **CP2 — analysis report.** Add lemma/form/phrase/sense/frequency/script proposals and retain the
   exact derivation or model evidence. This is language analysis, not client-side morphology; it
   must expose uncertainty/review rather than silently guessing.
3. **CP3 — proposed curriculum plan.** Emit concepts, reasons, prerequisites, ordering, and suitable
   existing exercise families for a text/chapter/learner. Compare it with current generated lessons
   on a small representative set; still emit no new lessons.
4. **CP4 — one lesson family through the existing contract.** Start with vocabulary meaning/form,
   validate it, and retain the legacy generation route in parallel. Only then add language-specific
   families such as conjugation, grammar, articles, error patterns, and comprehension.
5. **CP5 — consume the plan read-only.** Let the red→green text progress card read analysis and skill
   data with a legacy fallback. BKT remains a measurement until a separate product ruling. **A narrow
   slice of this already shipped**: `cp5ShadowFor()`/`GET /api/cp-shadow/:chapterId` (server.js) reads
   CP3's `curriculum-plan.json` and paints a concept-count summary into the chapter-complete popup —
   but this reads CP3 (concepts), not CP1/CP2 (per-token lemma/form/sense). **Item W ("text explorer"
   mode, roadmap section above) is THIS bullet's per-token half — ✅ SHIPPED `v86_o`**: a background
   CP1+CP2 job + per-chapter cache, `GET /api/analysis/:chapterId` mirroring `cp5ShadowFor`'s own
   shape, and a client toggle view painting real per-token lemma/form/sense directly from the story.
   See item W's own roadmap section for the full build + live-verification write-up.
6. **CP6 — retire nothing by assumption.** Consider retiring legacy generation only after the new
   route has measured multilingual coverage, quality, recovery/re-analysis, and player compatibility.

This section changes architecture upstream, not the current delivery shell. It does **not** authorise
a parallel player, new progress system, bulk corpus rewrite, or a BKT-driven gate.

> **📝 NOTE, added after `v83_m` shipped, during planning for browser integration (user conversation,
> not yet built) — MULTI-CHAPTER / STORYLINE-WIDE GENERATION.**
>
> Batch processing across many chapters in ONE run already works today — every CP1-4 CLI already
> accepts `--limit N`/`--all`, proven at `v83_h` (24 chapters, 14 languages, one command). What does
> **not** exist yet is the pipeline being AWARE it is looking at one continuous, ordered story.
> Two genuinely different pieces of work were distinguished in that conversation, and they should
> stay distinguished rather than being built (or deferred) as one lump:
>
> 1. **Cross-chapter DEDUPLICATION — SIMPLE, do this early, probably alongside the first browser-
>    reachable slice.** Before choosing chapter N's vocabulary, exclude lemmas already taught in
>    chapters 1…N-1 of the SAME storyline. Needs no new model call and no new pipeline stage:
>    `compareWithExistingLessons` (CP3) already does almost this — it just needs widening from "this
>    chapter's own lessons" to "every earlier chapter's lessons in the storyline" (a loop over the
>    storyline's earlier topics, unioning their `vocab.target` values) — plus a filter step in CP4
>    before it picks its top N concepts. `emitVocabLesson` already degrades cleanly to "skip, nothing
>    new to teach" when a chapter's remaining vocab concepts are empty, so "generate less or no
>    lesson for an already-covered chapter" falls out for free once the filter exists. **Without
>    this, running the pipeline across multiple chapters of one story has a real failure mode**: the
>    same highest-frequency words get re-proposed as "new" in every chapter, since CP3's ranking has
>    no memory between chapters today — worse than the legacy generator, which already avoids this
>    via its own `chainVocab`/`vocabMode:'extend'` mechanism. Mirror that existing mechanism's
>    *intent*, not its implementation (CP3's concepts have stable ids; the comparison can be a lookup
>    against `conceptId`/`lemma`, not a fuzzy word-list diff the way the legacy prompt hint is).
> 2. **Genuine cross-chapter curriculum SEQUENCING — moderate effort (roughly CP3-sized), NOT
>    necessary for now.** Deciding WHAT to teach WHEN across a whole story's arc (e.g. "teach this in
>    chapter 2 because chapter 5's phrase needs it as a prerequisite") is real design work: it needs
>    every chapter's analysis available before any one chapter's plan is finalised, and a genuinely
>    different data shape (a storyline-level plan, not N independent chapter-level ones). **Explicitly
>    NOT authorised or scoped by this note** — defer until (1) has shipped and been used for real, and
>    only revisit if the simpler dedup alone proves insufficient in practice.
>
> Neither piece changes CP1 or CP2 at all — both are CP3/CP4-only extensions. Do not build (2) by
> assuming it is a small extension of (1); they were kept separate on purpose in the conversation that
> produced this note, precisely because the two have very different effort/necessity profiles.

> **📝 NOTE, added after `v83_p` shipped — REAL-WORLD EVALUATION, `v83_n`→`v83_p`.** The user ran
> `apply-cp-lessons.js` for real, twice, against the SAME chapter (`tp_17865786341910000220`,
> "Vittoria Ingannevole", de→it, 8-word vocabulary lesson each time), and reviewed both outputs
> word-by-word against the real source text. This is the first genuine quality signal Track A has
> produced — recorded here so it is not lost to chat history, and so a future session does not
> re-derive it from scratch or re-litigate a question already answered by real evidence.
>
> **Run 1 — `qwen2.5:7b`** (the throwaway-server default model this whole project's own docs
> recommend for quick checks — NOT this topic's own legacy-generation model): 2 of 8 words wrong.
> `"riesen"` proposed as the LEMMA for a token that appears singular in the story (`RIESE`) — a real
> lemmatisation error (plural form proposed for a singular occurrence) — glossed `"mostro"`
> ("monster") instead of `"gigante"` ("giant"). `"geben"` (from the idiom "es gibt") glossed
> `"offre"` ("offers") instead of correctly reading the idiomatic "there is/exists" sense. One more
> item, `"ein"` (the bare indefinite article), was translated with a stray trailing hyphen ("un-",
> not a real word) — weak, though not as clearly wrong as the two above.
>
> **Run 2 — `qwen3.6:35b-a3b`** (the SAME model this topic's own LEGACY lessons were generated
> with, chosen deliberately for a fair, apples-to-apples comparison, and the run that surfaced the
> `v83_o` `think:false` bug before it could complete): ZERO wrong translations. `"Riese"` correctly
> lemmatised (singular, matching the story) and correctly glossed `"gigante"`. `"geben"` correctly
> read as `"esistere (in senso impersonale)"` — the idiomatic sense, explained. A NEW item this run
> surfaced, `"sie"`, was correctly traced back across two sentences to its real antecedent ("die
> Regierung") and glossed accordingly — genuinely sophisticated contextual disambiguation, exactly
> what CP2's design intends. This SAME run is also what surfaced the `v83_p` register-mismatch bug
> (`"kommen"`/`"venne"`), independent of translation correctness — a lemma/surface packaging bug at
> CP4, not a CP2 language-analysis error.
>
> **What this evidence actually supports**: the two clear CP2 accuracy errors in run 1 look like a
> SMALL-MODEL limitation, not a flaw in the pipeline's own design — run 2, same chapter, same
> prompt, larger model, zero equivalent errors, plus noticeably more sophisticated context-tracking.
> **This should inform any future decision about which model a browser-triggered CP2 call defaults
> to** — `qwen2.5:7b`-class models are cheap in a throwaway-server dev-loop sense but demonstrably
> weaker for this specific task; do not assume the DEFAULT dev-check model is an adequate PRODUCTION
> default without re-measuring.
>
> **Two gaps this evidence surfaced that remain OPEN, unaffected by `v83_o`/`v83_p`'s fixes** (first
> named in `v83_n`'s own roadmap write-up, repeated here since they are exactly the kind of finding
> this note exists to keep from being lost): (1) **no function-word filtering** — a bare article
> (`"ein"`) was proposed as a standalone vocabulary item in BOTH runs, regardless of model size; CP2/
> CP3 have no mechanism to recognise and exclude/deprioritise pure grammatical function words the
> way the legacy generator's own prompt evidently does. (2) **confidence does not survive into CP4's
> written lesson** — CP2/CP3 track a `confidence` per proposal, but `emitVocabLesson`'s final
> `vocab[i]` object never carries it; a reviewer (or a future UI) cannot tell from the written lesson
> alone which words the model was actually unsure about, even though that information existed
> earlier in the pipeline and was simply dropped at the last packaging step.

Sequenced so each step is independently useful:

1. **A1 — plain text / markdown upload with a separate chaptering card.** No §2 dependency at all,
   and it builds the chaptering UI that PDF and comics will reuse. **Also delivers the plan's
   "allow to edit the source field when generating from an uploaded text"**, which appears twice in
   the plan and is small.
2. **A2 — language detection**, both the cheap script-based path and the LLM query. The
   script-based half already has machinery: `backfill-script.js` and the `script` stamp.
3. **A3 — the PDF word map** (§2.5/§2.6 Tier 0), not PDF extraction, which already works. Keep the
   per-item transforms `_extractPdfText` currently discards.
4. **A4 — comics via vision model.** Needs no dependency and no PDF ruling, so it can start
   BEFORE A3. **Begin with the §2.4 overlay probe** against `murmel-comics.org/stories/2640`: boxes
   drawn back over the source page, eyeballed by a human, numbers recorded in the probe header.
   Panel *enumeration* and reading order are the unknowns, not OCR.

**Check `/api/generate-book` first** — it exists at `server.js:6515` and may already do part of A1.
And `roadmap_v80.md` §0b records import **"new" mode as POSTPONED by the user**; A1 overlaps it, so
reconcile rather than re-decide.

---

## PLAN §8 — Track B — pedagogy (UNBLOCKED; staged so each step stands alone)

`bayesian_knowledge_tracing.md` is in `build_history/`. §0.1 evaluates it. The staging below follows
from that evaluation, and its shape is: **instrument, then tag, then run BKT in the dark, then
show it, and only then — maybe — let it control anything.**

**B1 — the observations log (do this FIRST, and it can start today).** Append-only, per §13:
`{userId, skillId, correct, evidence, storylineId, lessonId, timestamp}`. Two properties matter more
than the schema: **record the FIRST attempt distinctly from retries** (§0.1's measurement), and
record even when `skillId` is unknown — an observation tagged `null` is recoverable later, an
observation never written is gone. **This is worth doing before any of Track A**, because every day
it runs is a day of evidence BKT will have, and the existing counters cannot be replayed into it.

**B2 — the skill registry and canonicalisation. ✅ SHIPPED at `v81_k`.** The registry is separate
from `lessons.json`; model proposals resolve only through explicit target-language registrations or
reversible same-type aliases. Source is evidence context, never part of a skill's canonical ID.

**B3 — tag NEW lessons at generation. ✅ SHIPPED at `v81_k`.** One lesson type first: standard
vocabulary. Every amended prompt still calls `scriptPinNote` and records `_genMeta`; unregistered
proposals stay pending beside the row, and no historical topic was backfilled.

**B4 — BKT in SHADOW MODE. ✅ SHIPPED at `v81_l`.** `pMastery` is recomputed only from reviewed
skill-tagged observations and shown nowhere. It runs alongside the existing `chapterComplete`/
pass-mark gate, logging only changed disagreement pairs; it cannot influence progression. It can now
accumulate the evidence that tells you whether §5/§6 are worth adopting.

**B5 — surface it read-only.** The §11 aggregate views (vocabulary/grammar/word-forms/reading), and
§8's corpus-vs-independent split, which is free once `evidence` is recorded. Still controlling
nothing.

**B6 — the scoped tutor.** *Not* the adaptive tutor of the user's §4 — the small one: a chapter-
scoped window that knows the story up to and specifically about this chapter. It is independently
useful, needs no BKT, and belongs with Track C's card work. §9's confidence-weighted chat evidence
comes much later and needs an update rule the document does not specify.

**B7 — mastery-driven progression (§5/§6). A PRODUCT DECISION, and possibly never.** It replaces a
gate the user has ruled on repeatedly. Do not start it without an explicit ruling, and not before B4
has shown what would actually change.

**B8 — the corpus.** Automated meet & greet lessons like `sl_1271936135`, plus out-of-copyright
texts. A content project as much as a code one, and it gates recommendation (§6 of the user plan):
a recommender over 90 storylines recommends the same things to everyone.

**B9 — prerequisites and CEFR (§14, §11).** Last. **CEFR mapping is the same language-knowledge
ruling as §5's languages x lesson-types table** — a CEFR level per skill is a language judgement, so
it belongs in data the model fills, not in a table the app ships.

**Still true, and it constrains B4 hardest:** at a 3.0% error rate a difficulty policy has almost no
learner signal to work with and must come from corpus statistics first. The two measurements already
identified remain the right prerequisites — **inflection share** and **learner-known share** — and
one pass over the same inventory yields both.

## PLAN §9 — Cross-cutting risks

**R1 — The single file is at 1.14 MB.** Every track adds to it. Nothing in the plan addresses it,
and `check-inline.js` runtime and browser parse time both scale with it. **Decide before Track A
whether the client stays one file**, because the ingest UI is the largest single addition proposed.

**R2 — The static build will drift again.** It re-implements 19 functions. Every card in Track C
either works in static mode or is deliberately absent, and `unit-static-selectlang-tts` only guards
the refresher pairing. **Expect to extend that guard once per Track C session.**

**R3 — Pricing implies auth, and auth is nowhere in this plan.** "Requires subscription to stably
store progress", "only direct LLM use will cost" — none of that exists today. It is at least its own
track and possibly its own product decision. **It should not be discovered mid-Track-B.**

**R4 — The plan has no failure mode for the model.** Ingest, tutor, QC adjudication and term
extraction all assume a working LLM. The app already handles "no LLM" gracefully; each new
model-dependent feature needs the same, and the plan's own pricing model makes some of them
*expected* to be unavailable.

**R5 — Rule 24 applies to this document.** It is a plan, not a guard. Nothing here is protected
until it is a test.

---

## PLAN §9b — THE DECISIONS STILL OUTSTANDING — the complete list

Everything else in this document is buildable without asking. These are not.

**D1. The languages x lesson-types table — RULED at the v80 cut (user chose the proposed option).**

**Applicability is MODEL-DECLARED, CACHED AS DATA, TERNARY, WITH PROVENANCE.** Not a table the app
ships, and not a question asked at every generation.

The argument that decided it, kept because it is the reason and not just the outcome: the plan's own
example proposed *"ova/ovo vs. taj/ta/to"* as Serbian articles. **Serbian has no articles.** Those
are demonstratives, and the nearer analogue to definiteness in Serbian is **adjective aspect** —
the definite/indefinite adjective forms (`star` / `stari`) — a different mechanism on a different
word class. So the cell "Serbian x articles" is neither `true` nor `false`, and the honest answer
*"no articles; definiteness surfaces through adjective morphology"* is **more useful to the
generator than the boolean**, because it says what to teach instead. A boolean table is wrong on its
first interesting cell, and the interesting cells are the only ones needing a table at all.

**The shape:**

- **Ternary plus a note**, never boolean: `yes` / `no` / `different-mechanism`, with a sentence.
  The note is what turns a refused "cases" request for Italian into a useful preposition lesson.
- **Cached in `languages.json`**, keyed by `(language, lessonType)`, **with `_genMeta`-style
  provenance** — model, date, prompt version — exactly as lessons carry it. That is what makes this
  a MEASUREMENT rather than an authored claim, which is the tier INTERNALS §4 permits, and what
  makes it re-derivable when the prompt improves and auditable when it is wrong.
- **A human override wins and is MARKED as an override**, distinguishable from a cached answer. The
  user is the language authority this project trusts (`v75_g` is exactly that), and an override that
  looks like a cache entry loses the ruling behind it.
- **Asked once, not per generation.** Per-generation is non-deterministic — the same language must
  not get a conjugation lesson on Tuesday and not on Wednesday — and pays tokens repeatedly for a
  stable fact.

**Why not the alternatives:** a hand-authored table scales badly across two growing axes (33
languages x ~14 types) and caps quality at the maintainer's linguistics; no gating at all produces
the incoherent lessons this is meant to prevent.

**The honest cost, recorded rather than glossed:** a wrong CACHED answer is stickier than a wrong
per-call one, because nothing re-asks. Provenance is the mitigation — a prompt-version change can
invalidate and re-derive the affected cells.

**Guard it the way this project already guards this shape:** a source SWEEP that fails when a lesson
type has no applicability policy, mirroring `unit-script-pin-coverage`, which sweeps the source so a
new prompt cannot skip `scriptPinNote`. Rule 32 — guard the enumeration, not the cells that happened
to get filled.

**Scope limit:** this decides only whether a lesson is OFFERED. Whether the generated lesson is any
good remains QC's problem (§F). And the other half of the original request — **revealing the full
phrase with the correct article and word form together** — needs no table and can ship at any time.

*Unblocks: D2 (cases/articles), D3 (generic lessons) partly, B9 (CEFR, same mechanism).*

**D2. Mastery-driven progression (BKT §5/§6, plan §8/B7).** Replaces the `coverageTarget` pass mark
you have ruled on repeatedly. §8/B4 runs BKT in shadow mode first, so this can be decided from a
disagreement log instead of a prediction. **Do not decide it now** — decide it when B4 has data.
*Blocks: B7 only.*

**D3. Corpus licence AND suitability.** `murmel-comics.org` page B is signed by an identifiable
artist, so the licence question is concrete, not hypothetical. Separately, suitability is its own
axis: page B is political satire, page A is about bereavement — both legitimate reading, neither
automatically right for an auto-generated beginner corpus. *Blocks: B8, and the comic demo.*

**D4. Uploaded images — RULED: STORED SERVER-SIDE (user, v80 cut).**

Three consequences that follow immediately and are design constraints, not opinions:

- **Images must NOT go into `lessons.json`.** It is a single JSON file that every test loads, that
  `build-static.js` bakes wholesale, and that the corpus checks parse repeatedly. Base64 comic pages
  would multiply its size by orders of magnitude and slow the entire suite. **Store as files in an
  asset directory, reference by path from the topic record** — the same relationship `docs/` already
  has to the corpus.
- **The static build needs a decision it does not have yet.** `build-static.js` bakes lessons into
  `docs/index.html`; it cannot bake megabytes of PNG. Either the static export omits images (and
  image-derived chapters degrade to text-only), or it copies assets alongside and rewrites paths.
  **Cheapest honest answer: text-only in static, and say so in the UI** rather than shipping a
  storyline whose pages silently fail to load.
- **Retention makes D3 sharper, not softer.** Storing a signed artist's page server-side is a
  stronger act than transiently reading it. The licence question moves from "can we display this"
  to "can we host this".

**D5. Does the client stay ONE file?** `index.html` is 1.14 MB with a ~972 KB inline script, and the
ingest UI is the largest single addition proposed. Note §2.5 shows the property is **already**
partly relaxed — pdf.js and KaTeX both load from CDN — so the question is where the line actually
is, not whether to cross it. *Blocks: nothing immediately; gets harder the longer it waits.*

**D6. Observations log scope — RULED: BOTH, keyed by a stable local id an account can adopt
(user, v80 cut).** Payment and accounts remain open; this decides only the key, which was the part
that blocks §8/B1.

**The design that follows, with the traps named:**

- A client-generated stable id (UUID) in `localStorage`, written on first observation. Every
  observation carries it. No account needed to start recording — which is what makes B1 startable
  now.
- **Adoption must be a LINK, not a rename.** An account accumulates a SET of local ids: one per
  browser and device. Re-keying observations to a `userId` loses the ability to adopt a second
  browser later, and breaks if two devices are adopted in either order.
- **Therefore an observation's identity key is the local id, permanently**, and `userId` is a
  resolved attribute. This is the choice that is expensive to reverse, so it is stated here rather
  than discovered at implementation.
- **Two traps to handle explicitly:** a browser adopted by account A and later signed into account
  B (the observations do not move — they were A's evidence when made), and clearing `localStorage`
  (the evidence is orphaned, not lost; an un-adopted id is simply never claimed).
- Pseudonymous by construction, which is the right default for evidence collected before anyone has
  agreed to anything.

**D7. Does mixed-lesson composition REPLACE reinforce/extend (§D1)?** Replacing a shipped feature
deserves its own release and its own decision, not a checkbox. *Blocks: the second half of D1.*

**D8. Duplicate storyline titles — RESOLVED IN THE DATA (user renamed one to "Dough of the
Ancients 2" at the v80 cut).**

The earlier ruling was "keep both identical", which would have broken the `v79_k` fork marker for
that pair. The rename removes the defect at its source and is the better fix — the marker renders
the other storyline's `icon + title`, and two distinguishable titles is exactly what it needs.

**The guard is still worth building, but it is now PREVENTIVE, not corrective**, and should be
described that way rather than as a bug fix: for every fork in the corpus, the marker must be
distinguishable from the open storyline's own label. Nothing in the data enforces unique titles, so
a future duplicate would silently reproduce the defect. `unit-fork-display` already sweeps forks and
can carry the assertion in a few lines. **Lower priority than it was — it now protects against a
recurrence rather than fixing a live problem.**

> **✅ SHIPPED as `v80_h`.** The rename was CONFIRMED in the tree first, as the note below asks
> (0 duplicate-title groups across 91 storylines), so this landed as preventive. The marker now
> falls back to naming the branch's own chapter, and `unit-fork-display` §8 injects a synthetic
> duplicate AND an empty title so the sweep cannot pass vacuously. Revert-verified.

**~~Note for the next data drop~~ — DISCHARGED at `v80_h`:** the rename has ARRIVED. The tree now
carries "Dough of the Ancients 2" and 0 duplicate-title groups. Original note follows.

**Note for the next data drop:** the tree at this cut still carries the OLD duplicate titles; the
rename lives in the user's copy. The next `lessons.json` will bring it, and a title change is
exactly the kind of quiet data movement the session protocol says to diff for rather than assume.

## ✅ PLAN §9c — THE STORYLINE TITLE IS NEVER GENERATED FOR A NEW BOOK — **SHIPPED at `v80_l`**

> Fixed by option 2 below (mark the placeholder), with `v78_r` unweakened and every authoring path
> clearing the flag. All 91 existing storylines keep their titles. See the `v80_l` entry.
> Diagnosis kept in full:

**User report:** generating a multi-chapter German->French storyline skipped the title with
`Storyline title: keeping existing "ein eichhoernchen trifft ein murmeltier — 1"`, and the title had
to be made by hand afterwards.

**Diagnosed, and it is a precondition that stopped being true.** `server.js:5348` guards the title
generation with `v78_r`'s rule — *"only when there is none. A continuation must not rename a
storyline the learner already has"* — which is correct and was a user ruling. But the storyline
record is created **earlier in the same flow**, at `server.js:5207` and `5215`:

```js
upsertStoryline({ id: slId, title: chain[0], icon: '📖', chapters: chapterIds, ... })
```

`chain[0]` is the FIRST CHAPTER'S TOPIC NAME — here `"ein eichhoernchen trifft ein murmeltier — 1"`,
complete with the auto-numbering suffix. **So by the time the guard asks "is there a title?", there
always is one.** The `else` branch that calls `generateStorylineTitle` is unreachable for any
storyline created through this path. The title is not skipped because the storyline is a
continuation; it is skipped because a PLACEHOLDER was seeded as if it were an authored title.

**The guard is right and must not be weakened** — `v78_r` exists because regenerating a title from
the new chapters alone replaced a whole-story title with one about its tail. The fix is to make the
guard able to tell a placeholder from a real title. Options, in preference order:

1. **Do not seed a title at all** for a new storyline (`title: ''` or omitted), letting the existing
   guard do exactly what it says. Cleanest, but every reader of `sl.title` must tolerate an empty
   one until the post-pass runs — check the storyline list, the fork marker (which renders
   `icon + title`), and `build-static.js`.
2. **Mark the placeholder** — `titleAuto: true`, cleared when a real title is generated or the user
   edits it. Explicit, survives a crash between the two steps, and makes "was this authored?"
   answerable elsewhere too. **Recommended.**
3. Compare `sl.title` to `chain[0]` and treat equality as absent. Cheapest, and wrong the moment a
   user deliberately names a storyline after its first chapter.

**Guard it where the claim is observable:** a new multi-chapter book gets a title that is NOT its
first chapter's topic name, and an EXISTING storyline gaining a chapter keeps its title unchanged.
Both halves are needed — the second is the `v78_r` ruling, and a fix that only asserts the first
would re-open it.

**Scope checked, not assumed:** the same `_slPre2` pattern guards the storyline SUMMARY at
`server.js:5373`, but **`summary` is never seeded** by `upsertStoryline` — the only writes are the
generated one and the user's edit. So the summary guard works as intended and **this is a
title-only bug**. Fix the title; leave the summary path alone.

## PLAN §10 — Suggested next three sessions — revised after the v80 rulings

Four decisions landed at this cut (§9b D1, D4, D6, D8), which changes what is startable.

1. **Repair and reconcile.** The two restored roadmap sections at the top of `roadmap_v80.md`'s open
   block — strike what this plan supersedes **with a pointer**, keep what is still open. Then
   `unit-story-unlocked-page` §6, the guard that does not discriminate under revert. Ends with a
   roadmap that describes reality and one fewer guard that cannot fail.

2. **C1 — the two progress-card gate bugs**, measured before edited (browse-forward-and-back skipping
   comprehension; replay reaching comprehension before the story unlocked), with the
   single-chapter 100% bar and the header-bar off-by-one folded in, since all three may share a root
   cause in `_slProgressStats`. Highest user-visible value in the document.

3. **Either of two now-unblocked one-session items**, whichever suits:
   - **§8/B1, the observations log** — unblocked by D6. Append-only, first-attempt distinct from
     retries, local-id keyed, recording even when `skillId` is unknown. **The only item whose value
     DECAYS while it waits**, because the existing `{seen, wrong}` counters cannot be replayed.
   - **The applicability cache** (D1) — model call, ternary + note, provenance, sweep guard. No UI,
     no migration, and it is the prerequisite for cases/articles lessons and for CEFR.

**Small and independent, for any session that finishes early:** the fork-marker fallback (D8, half a
session, `unit-fork-display` already has the sweep), **F2** the malformed word-forms detector — the
cheapest real win in the document — and **Track E**, printable export.

**Still open, and none of it blocks the above:** the corpus licence and suitability question (D3,
now sharper since images are retained), payment and accounts beyond the key design (D6), whether the
client stays one file (D5, which only gets harder), and whether mixed lessons replace
reinforce/extend (D7). **Mastery-driven progression (D2) should NOT be decided until §8/B4 has run
BKT in shadow mode and produced a disagreement log** — deciding it now would be guessing.

---

## PLAN §11 — Teacher-mode generator tutor (user, `v82` cut) — conversational authoring, not another form

*"Generator/teacher-mode version of the tutor, where you can tell it to generate lesson types in a
certain way and the LLM decides how, similar to how I can tell YOU (Claude Sonnet) to generate
storylines or lessons. For example, we want to upload a PDF and the model suggests the best
split-into-chapters splits and types of lessons to generate, and it can actually do that! This may
require a more powerful model than our current default qwen3.6?"*

**What this is, precisely, because it is easy to conflate with two things it is not:**
- **Not §7.0's CP1–CP6 pipeline.** That is a fully automated batch pipeline (canonicalize → analyse
  → plan → generate), designed to run without a human in the loop once built, chapter by chapter. This
  is the OPPOSITE shape: a human — the teacher — steers generation turn by turn through natural
  language, the way the user directs a session with Claude Code itself. §7.0 is relevant as a likely
  SUPPLIER of the underlying moves (chaptering, lesson-type suggestion) this surface would call, not
  as the thing being proposed.
- **Not the existing student-facing tutor**, reused wholesale. The `v62` tutor (`callLLMTutor`/
  `callLLMTutorStream`, one persistent floating thread, `OLLAMA_TUTOR_MODEL`) is the right STARTING
  MATERIAL — same chat shape, same streaming, arguably the same per-role model slot — but it is
  presently pure conversation: it answers, it does not act. This proposal needs the model to actually
  DO things (split a chapter, generate a specific lesson type with specific instructions), which the
  current tutor has no mechanism for at all.

**The hard part is exactly that gap: getting the model from "here is what I would generate" to
actually generating it.** Two shapes worth naming, not deciding between yet:
1. **Tool/function calling** — the model emits a structured call (`generate_lesson({type, topic,
   difficulty, instructions})`, `split_chapters({boundaries})`), the app executes it against the
   EXISTING generator functions (`ADD_LESSON_GENERATORS`, `generateOneLesson`, the book-generation
   chaptering already in `/api/generate-book`), and reports the result back into the conversation.
   This reuses everything already built for one-shot generation — the tutor turn becomes a director,
   not a new author.
2. **Structured-output parsing** — cheaper to build, more brittle: ask for a JSON plan in the reply
   and parse it, no true tool-calling needed. Degrades worse when the model doesn't comply, which is
   exactly the concern the user raised about model capability.

**The user's own capability question is the right one to lead with, not an afterthought:** local
models via Ollama vary widely in tool-calling reliability, and `qwen3.6:35b-a3b` (the current default
for `story`/`lessons`) was never evaluated for it — every existing generator call is single-shot,
structured-JSON-in-structured-JSON-out, never a multi-turn plan-then-act loop. **This is a genuine
prerequisite to measure, not a formality**: before building either shape above, run a small probe —
a handful of realistic "split this PDF into chapters and pick lesson types" requests against the
current default and whatever stronger model is being considered, and record whether tool calls (or
parseable structured plans) come back reliably. The app's model-role architecture already has the
seam this needs: a new role (or reusing `OLLAMA_TUTOR_MODEL`) that can be pointed at a different,
possibly larger model independent of `OLLAMA_LESSON_MODEL`, the same way `qc` and `tutor` already run
separate models from `story`/`lessons` today.

**The PDF example in the user's own framing is not a separate feature — it is THE first concrete use
case**, and it already has groundwork: §7.0's A1 (plain text/markdown upload with a chaptering card)
and A3 (the PDF word map) are the ingest half; this section is the CONVERSATIONAL layer that would
sit on top and let the teacher steer those same moves by instruction ("split at the natural scene
breaks, not evenly," "make chapter 3 a comprehension-heavy review") rather than only through a form.

**Not scoped here, deliberately:** which specific actions the tutor can trigger first (a minimal
useful set, not "everything §5/§7 can generate," is worth choosing explicitly rather than defaulting
to "all of it"), how a partially-wrong generated plan gets corrected mid-conversation rather than
restarted, and whether this is a NEW screen/widget or an extension of the existing tutor thread
(reusing v62's ONE continuous thread would mean student help and teacher authoring share a
transcript, which may or may not be wanted — a real product question, not a technical one).

---

## PLAN §12 — Interactive text-selection tutor (user, `v83` cut) — explain a segment, in context, via the tutor

*"On all story chapter text views, we can click words that are covered by a lesson. We additionally
allow the user to select text segments and the user can then select between 'grammar' and 'meaning'.
It could open the tutor with a pre-filled prompt asking the tutor to explain this text segment,
either the grammar or the meaning in the context of the whole story."* Plus: *"The tutor should be
primed to use the selected UI language, even if different from a specific lesson's source
language."*

**What already exists, precisely, because the new work is smaller than it looks stacked next to it:**
- **Per-word tapping is a SEPARATE, existing mechanism** — `_storyBodyHtml(d, opts)` (the ONE story
  renderer, per `INTERNALS.md` §6b) renders lesson-covered words as
  `<mark class="story-vocab-hl wp-tap" role="button" tabindex="0">`, and `tapWord(word)` opens the
  matching exercise. This request does NOT change that path — it ADDS a second, independent
  interaction (free-text-range selection) over the SAME rendered container, which must coexist with
  the existing per-word click targets rather than replace them. Concretely: a `mouseup`/
  `selectionchange` listener on the story container reading `window.getSelection()`, distinct from
  the `<mark>` elements' own `onclick`.
- **The tutor's live-call shape is the exact precedent to reuse, not invent.** `/api/tutor`
  (`callLLMTutor`/`callLLMTutorStream`, stateless, `OLLAMA_TUTOR_MODEL`) already takes `scope`,
  `story`, `wrongWords`/`knownWords`, and a `history` transcript, and already supports an `opening`
  flag that asks the model to generate ITS OWN first turn. **This request needs a DIFFERENT shape the
  tutor does not have yet**: the STUDENT's first turn pre-filled with a SPECIFIC, client-composed
  prompt ("Explain the grammar of: '<segment>'" / "Explain the meaning of: '<segment>', in the
  context of the story") — not the tutor inventing an opener, and not the learner typing it by hand.
  This is closer to `_tutorSend(opening)`'s NON-opening path (a real "student" history entry, sent as
  the first item) than to its `opening:true` path.
- **`PLAN §D4`'s two releases are the closest LIVE-MODEL-PRIMING precedent** (`v82_e`/`v82_f`,
  `roadmap_v82.md`) — a client action composes a prompt, sends it with context (the story) to a live
  route, and the RIGHT model/prompt shape for a judgement task was NOT obvious on the first attempt
  in either half of that build (the QC-vs-lesson model choice, then the advanced-furigana wording).
  Budget for the same here: whatever prompt template asks the tutor to "explain this segment" will
  likely need at least one live iteration against a real answer before it reads well.

**The two real open questions, in order of how much they change the shape of the work:**

1. **Which language does the tutor reply in — `srcLang` (current, unchanged for the REST of the
   tutor) or `APP.uiLang` (what the user is asking for HERE)?** Measured, not assumed: today
   `_tutorGatherContext()` sends `srcLang = sc.srcLang || APP.srcLang` — the LESSON's own source
   language (the "I speak X" pairing) — and the server prompt tells the tutor to write in that
   language. `APP.uiLang` is a SEPARATE, DELIBERATELY DECOUPLED setting since `v81_ac` (UI language
   moved into Settings, independent of "I speak"), so a learner can genuinely have UI language ≠
   lesson source language ≠ lesson target language — three potentially different values. The user's
   ask is explicit for THIS new flow ("primed to use the selected UI language, even if different from
   a specific lesson's source language"), but does not say whether the EXISTING general tutor
   conversation should also switch from `srcLang` to `uiLang`, or whether only this new
   segment-explanation entry point should. **Get this ruled before building the request payload** —
   it decides whether `/api/tutor` needs a new field at all (if only the NEW flow uses `uiLang`, the
   route needs to accept and honour an explicit override; if ALL tutor replies should move to
   `uiLang`, that is a wider, back-compatible-across-every-caller change to `_tutorGatherContext`
   itself, not scoped to this feature).
2. **What exactly counts as "a text segment"?** A native browser selection can span partial words,
   cross `<mark>` boundaries, include punctuation, or (worse) cross paragraph breaks inside the
   `_storyBodyHtml` container. Decide the SNAPPING rule (word-boundary-aligned? sentence-bounded?
   raw as selected?) before building the popover — this is exactly the kind of thing worth a quick
   measurement against `_storyBodyHtml`'s actual DOM shape rather than assuming `getSelection()`
   hands back something clean.

**Not scoped here, deliberately:**
- The exact UI for "select, then choose grammar/meaning" (a floating mini-toolbar anchored to the
  selection is the obvious shape, matching how most rich-text editors do it, but the app has no
  existing precedent for a selection-anchored popover to reuse or diverge from).
- Whether this reuses the ONE existing floating tutor widget/thread (`v62`, one continuous
  conversation) or opens a fresh, scoped mini-conversation per explanation — reusing the single
  thread means a segment-explanation sits in the same transcript as general Q&A, which may or may not
  read well; `PLAN §11`'s own open question about the teacher-tutor sharing a thread with the
  student-tutor is the same shape of question, unresolved there too.
- Whether "explain the grammar" and "explain the meaning" are two DIFFERENT prompt templates
  (`PROMPTS.tutor` gaining two new variants) or one template with a mode flag — a design detail, not
  a blocker, but affects `prompts.json`'s shape.
- Static-build behaviour: like `writing` (`PLAN §D4`), this needs a live model call, so it is
  unavailable in `docs/index.html` by construction. Say so honestly in the UI (same call `v82_e`
  made) rather than showing a selection popover that can never resolve.
- Whether the story TRANSLATION language (when a learner is reading the source-language rendering of
  a chapter, e.g. via `toggleExStoryLang`/`toggleCompStoryLang`) affects which text a selection
  captures, or whether selection is only meaningful over the TARGET-language story text. Given the
  whole point is explaining TARGET-language grammar/meaning, selecting over the SOURCE-language
  rendering may need to be disabled or handled differently — check `APP._compStoryLang` (the shared
  toggle both screens read) before assuming selection "just works" on whichever side is showing.

## PLAN §13 — Generator page redesign (user, `v85` cut) — step-wise wizard around what already exists

*"Let's make it a step-wise process, with individual cards and back/next navigation, where default
settings allow to just click through or skip the navigation and just generate a default set of
lessons first... we want to allow to just generate chapters without lessons first as well."* Five
steps as given: (1) language/script select, with "continue from" working for every text-source type;
(2) text source — LLM-generated, PDF/text upload, or comic/image parser, each carrying obligatory
attribution fields (author/url/etc.); (3) chaptering (word/chapter count, formatting/length/LLM split,
comic panels) — from which a storyline can ALREADY be generated (title, optional summary/storyboard,
optional spell-check round auto-generating hidden error-hunt lessons over the ORIGINAL text's real
errors); (4) lesson selection — common-for-all-chapters (as now, reworded away from "learning arc"
framing) and per-chapter, plus the `PLAN §7.0` CP1-6 pipeline as an option; (5) additional features —
title/summary/storyboard/QC as opt-in toggles.

**Assessed this session before any code was written — most of this already exists.** The current
`#generation-screen` is one long always-visible form, not step-wise, but nearly every capability above
is already built:

- Language/script/`continue-select`: exists (`#src-lang-select`/`#lang-select`,
  `#src-script-wrap`/`#script-wrap`, `#continue-select`). Already wired into LLM-story generation AND
  PDF upload (`pdfGenerateAll()` reads it). **Gap, confirmed**: `doDialectImport()` does not read
  `#continue-select` at all, and hardcodes `base:'de', source:'de'` regardless of the actual selected
  pair — a real, narrow bug independent of the wizard itself.
- Text source: LLM-generated and PDF/text upload both exist (`#pdf-panel`, `#user-story-panel`).
  **Comic/image parser does not exist at all** — this is `PLAN §7.0` Track A's own **A4**, still at
  "begin with the §2.4 overlay probe," no code. Attribution fields: the schema already supports this
  (`topic.source = {author, licence, url, note}`, `v58` provenance) with a working endpoint
  (`/api/topic-source`), but the only client call site edits an EXISTING topic after the fact — not
  present in the generation flow itself.
- Chaptering: word/chapter-count (`#num-chapters-slider`) and split-mode (¶/↔/📄/✨LLM,
  `#split-mode-para/-len/-page/-llm`) both exist. Comic-panel splitting is blocked on the same A4 gap.
  Title/summary generation (`generateStorylineTitle`) already runs automatically once a book has ≥2
  chapters — not a toggle today, but the machinery exists. Storyboard is a separate, manual post-hoc
  `🎬` button, not part of the generation flow. **Spell-check → auto-generate hidden error-hunt
  lessons from the ORIGINAL text's real errors does not exist** — two adjacent-sounding mechanisms
  already exist and are NOT it: `error_hunt` deliberately corrupts a CLEAN story (the opposite
  direction), and `ai_error_hunt`/the existing text-cleanup diff is explicitly "deletion-only" (ad/
  furniture removal, never spelling/grammar correction). This is genuinely new work, though it can
  reuse the existing "(original, corrected) diff seeds an error-hunt lesson" machinery structurally
  with a new prompt.
- Lesson selection: the common-for-all-chapters ticklist exists and ALREADY replaced the old
  two-button arc-mode chooser at `v71_u` — there is no leftover legacy control in the client HTML. The
  ONLY thing still called "learning arc" is the checkbox LABEL that reveals the ticklist
  ("🎯 Build a learning arc per chapter") — confirmed with the user this is a wording/framing
  complaint, not a request to remove a second mechanism; reword it (and the PDF path's identical
  `#pdf-arc-lbl`), no logic change. Per-chapter type selection exists but ONLY post-hoc (the
  storyline-screen's per-chapter "add lessons" dropdown) — offering it AT generation time is new UI
  reusing the existing picker/endpoint shape, not new machinery.
- Additional features: storyboard and QC (`/api/qc`) both exist as separate manual triggers; folding
  them into the generation flow as toggles is wiring, not new pipeline work.

**The one real conflict with an existing plan, found and reconciled with the user directly**: "the new
pipeline should eventually design a complete lesson arc over chapters, selecting appropriate types for
the given source/target language pair, and for the given text" is, word for word, the cross-chapter
curriculum **sequencing** piece this same file's own `PLAN §7.0` note (added after `v83_m`) explicitly
separated out and marked *"moderate effort, roughly CP3-sized, NOT necessary for now... explicitly NOT
authorised or scoped... defer until the simpler [cross-chapter vocabulary] dedup has shipped and been
used for real."* That simpler dedup piece has ALSO not shipped to the browser yet — `apply-cp-lessons.js`
(CP1-4 chained, additive) is still CLI-only. **Ruled by the user this cut: build the step-wise UX
first, land the browser-reachable SINGLE-CHAPTER CP1-4 pipeline as a generation-time option once that
shell exists (its own follow-up build — needs a background-job design, since CP2's per-sentence calls
are slow: one 4-sentence chapter took 12+ minutes even on a warm model in a live test this session),
and leave BOTH comic import and the cross-chapter arc-sequencing piece explicitly out of scope** —
reopening the sequencing piece now would skip the very prerequisite that `PLAN §7.0` note called out.

**Approved implementation approach for the wizard shell itself** (full detail, including the exact
existing `id`s/functions each card wraps and the suggested per-release build order, is in this
session's own plan-mode transcript — condensed here so it survives past that): wrap the EXISTING
sections as `.gen-card`s inside a new `#gen-wizard`, don't rewrite them — this is a 1.15MB single-file
client with extensive `id`-selector test coverage, and the lowest-risk path (which also happens to be
what "click through with defaults" actually requires) is a navigation layer that shows/hides existing
markup, not a new form/data model. Reuse the existing `.pdf-step`/`.pdf-step.done/.active` pill visual
language for the page-level stepper (currently a per-chunk progress indicator, same look fits a
page-level one). A "Create storyline now, add lessons later" action on the chaptering card reuses the
existing empty-lesson-type no-op (`index.html`, `if(!addTypes || !addTypes.length) return;`) — chapter/
storyline creation and lesson generation are already loosely separable server-side, so this is a UI
affordance, not new backend logic.

**Suggested build order, each its own release** (per this project's own "one release per commit"
rule): (1) wizard shell + language/script + text-source cards, pure re-layout, zero behaviour change,
verified with a real click-through of all three text sources in the browser preview; (2) chaptering
card + "create storyline now" shortcut; (3) lesson-selection card + reworded label + per-chapter
override at generation time; (4) additional-features card (title/summary/storyboard/QC as toggles);
(5) the small independent gap-fills (attribution fields, dialect `continue-from` wiring) whenever
convenient. The browser-reachable CP1-4 option is its own build AFTER (1)-(5), not part of this
sequence.

**Not scoped here, deliberately** (per the ruling above): comic/image import; cross-chapter curriculum
arc-sequencing; spell-check-driven auto error-hunt generation (flagged during assessment, genuinely
new, not confirmed in scope — ask before starting it, since it needs a new prompt).
