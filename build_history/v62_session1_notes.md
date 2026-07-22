# v62 — persistent tutor: one floating widget, one continuous thread (Stage 2)

Stage 2 of the tutor arc, on top of v61's end-of-chapter bot. Two decisions from the user shaped
everything: **one floating widget, always reachable** (not per-page panels) and **one continuous
thread** (not per-scope threads).

## The problem Stage 2 actually had to solve

Stage 1 sidestepped retrieval by scoping to a single chapter. A tutor reachable from anywhere
cannot: the library measured **~321,000 chars of story ≈ 80,000 tokens** across 267 chapters. That
can't go in a prompt on any local model. So the core of v62 is a retrieval layer, and the core of
*that* is a safety property.

## Retrieval: three rules, one of them safety-critical

`tutorRetrieveContext()` (server, pure-ish over `store.topics`):

1. **SPOILER SAFETY — a hard guarantee.** Retrieval only ever considers chapters the learner has
   **completed**, sent as a whitelist by the client from `APP.progress.completed`. An uncompleted
   chapter is invisible even when it is the single best keyword match for the question. This is the
   cheap 90% of what a concept graph would buy for spoiler avoidance, at none of the authoring cost.
   With nothing completed, retrieval returns **empty** rather than falling back to the library.
   The prompt also states the rule in words (belt and braces), but the whitelist is the real
   mechanism — the model is never *shown* the material it could spoil.
2. **SCOPE.** A storyline question is narrowed to that storyline's chapters; the chapter the learner
   is currently on is *excluded* (the client sends it inline, so retrieving it would duplicate and
   waste budget); other language pairs are excluded.
3. **RELEVANCE then RECENCY, under a hard char budget** (default 2400, ≤4 chapters). Scoring is
   keyword overlap between the learner's newest message and each chapter's title+story, with recency
   as the tiebreaker. Keyword overlap is a deliberate choice over embeddings: it needs no vector
   store and keeps the zero-dependency constraint. Zero-overlap chapters are skipped once we have
   at least one hit, so an unrelated question doesn't drag in noise.

## The widget

The v61 completion-card panel is **gone**, replaced by one globally-mounted floating widget (`#tutor-fab`
→ `#tutor-widget`, beside the toast). It follows the learner because `show()` — the single
screen-switch choke point — calls `refreshTutorAvailability()`. Hidden entirely without a backend,
so the static build never shows it.

**One continuous thread**, persisted in `localStorage` (`dz_tutor_thread`, capped at 60 turns) so it
survives navigation *and* reload. The thread does not reset when the scope changes — that was the
user's explicit choice, and it's what makes the tutor feel like a companion rather than a popup.
A 🗑 button clears it behind a confirm.

**Scope** is derived from the active screen (`_tutorScope`): `lesson` → this lesson, `chapter` →
the completion card, `storyline` → that deck, `global` → landing/anything else. It travels with each
turn and is shown in the widget header, so the learner can see what the tutor is looking at. The
server validates `scope.kind` against a whitelist (untrusted input).

**Context** (`_tutorGatherContext`) reuses the existing stores, no new data model: the learned
ledger supplies known vocabulary and the wrong-count words (sorted hardest-first, with the live
round's mistakes promoted to the front), and progress supplies the completed whitelist. The current
chapter's story is sent inline only when the learner is on/near it.

## Server

`/api/tutor` no longer requires a story (a global question has none) and gained `scope`, `completed`
and the retrieval call. The prompt grew `{scope}` and `{retrieved}` and an explicit no-spoiler rule,
and was rewritten from "end-of-chapter" to companion framing. Everything else from v61 holds: still
stateless, still one reply per request, all untrusted input still capped.

## Tests

`unit-tutor` rewritten for the widget contract (global mount, no `#comp-tutor`, thread persistence
and bounding, boot load, scope kinds, spoiler whitelist in the payload). New
`unit-tutor-retrieval.test.js` runs the **real** retrieval function against a fixture library and
pins: the spoiler guarantee (best-matching uncompleted chapter withheld; empty when nothing is
completed; available once completed), scope narrowing, current-chapter exclusion, language-pair
filtering, relevance ordering, and the char budget under a 50-chapter library. Suite **114 green**.

## How to see it work (browser + Ollama)

Pick a tutor model in the model menu. The 🦉 button now sits bottom-right on **every** screen. Open
it anywhere: it greets you and asks about a word you've been getting wrong. Navigate to a storyline
or into a lesson — the header's scope label changes, and the same conversation continues. Ask "what
happened in <a story you finished>?" and it answers from retrieved context (the server log prints
`ctx: <chapters used>`). Ask about a story you have **not** finished and it won't know the ending —
that material was never retrieved. Reload the page: the conversation is still there.

## Deferred (Stage 3+)

Streaming replies (still whole-reply with a "thinking…" state); server-side learner state for
cross-device threads; per-question inline help; and the concept graph for rigorous prerequisite
logic and cross-domain links — the tutor works without it and gets smarter with it.

## Addendum v62.1 (same session) — selecting a tutor model returned "Nothing to set"

**Bug (user):** choosing a tutor model in the model menu showed a toast starting "Nothing to set…".

**Root cause:** the tutor role was wired into `setRuntimeModels` (which applies it) and into
`currentModels` (which reports it), but NOT into the `/api/models` route's *change detection* —
`const requested = [body.model, body.story, body.translation, body.lessons, body.qc]` omitted
`body.tutor`. So a tutor-only POST looked like an empty request and hit the 400 guard before
`setRuntimeModels` ever ran. The same omission affected `hasThink`, so toggling the tutor's 🧠 alone
would have failed identically (not yet reported, fixed at the same time).

**Why it escaped v62's tests and smoke:** the POST branch begins with
`if (active !== 'ollama') return 503`, so in a backend-less container the request never reaches the
validation being tested — the bug is only observable WITH a live Ollama. The v62 smoke checked the
GET side (which correctly showed the tutor model) and the endpoint's 503, both of which passed.

**Fix:** `body.tutor` added to `requested`; `typeof body.think.tutor === 'boolean'` added to
`hasThink`; the 400 message now lists qc and tutor too. The switch log also reports the tutor model
when it differs from the story model (or has reasoning on). Verified by extracting the three
predicates and running them: tutor-model-only, tutor-reasoning-only, qc-only, story-only and
timeout-only are all accepted, while an empty or junk body is still rejected.

**Regression guard:** `unit-tutor` now asserts, in source, that EVERY role the menu offers
(`model, story, translation, lessons, qc, tutor`) is present in the change-detection block, plus the
`think.tutor` predicate and the still-intact empty-body rejection. Written as a source assertion
precisely because the runtime path is unreachable without Ollama. Suite 114 green; static rebuilt.

## Addendum v62.2 (same session) — tutor markdown was shown literally

**Bug (user):** the tutor writes markdown, so replies showed `**fear**` with literal asterisks.

**Fix:** `_tutorMd()` — a deliberately minimal renderer for `**bold**`, `*italic*`/`_italic_` and
`` `code` ``. Line breaks already worked (the bubble is `white-space:pre-wrap`), so block-level
markdown was not needed.

**Security note (the reason this is more than cosmetic):** rendering model output as HTML is a
potential injection path. The order is therefore **escape first, format second** — `escHtml` runs on
the raw text, and the emphasis regexes then operate only on the already-escaped string, so a reply
containing `<script>` or `<img onerror=…>` is escaped into inert text before any markup is produced.
Code-span contents are stashed and restored last so emphasis rules can't chew on them, and they are
escaped too. Markdown is applied ONLY to tutor replies; the student's own message stays
plain-escaped (no reason to format what the user typed).

**Two false-positive classes handled:** emphasis content may not start/end with whitespace (standard
markdown), so `2 * 3 * 4` stays arithmetic; and underscore italics require word boundaries, so
`snake_case` vocabulary survives.

Guarded in `unit-tutor` by running the real extracted function: bold/italic/code render, arithmetic
and snake_case are untouched, and four injection payloads are proven inert. Suite 114 green.
