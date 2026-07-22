# v61 — end-of-chapter comprehension tutor (Stage 1 of the tutor arc)

First feature of the tutor arc, built after an architecture review of two design docs
(`concept_graph.md`, `chatbot.md`). Plan + staging rationale: `roadmap_v61.md`.

## Why this shape

The review's key finding: **~60–70% of the learner-state substrate the tutor spec asks for already
existed** — `_learnedLedger` tracks every word as `{source, seen, wrong}` with a decaying wrong-count
(exactly the "focus on the learner's errors" signal), `APP.progress.completed` tracks chapters,
`topicCoverage()` tracks mastery, `myStoryPayload()` already ranks vocabulary hardest-first, and
`sl.summary`/`storyMeta` are ready-made RAG sources. So the tutor did **not** need a new data model.

The concept graph (the other doc) is the genuinely large, separable piece: it needs a concept
ontology plus `teaches:`/`prerequisites:` annotations on every lesson — an authoring project with its
own QC problem. **Decision: decouple.** The tutor is useful knowing only "words you learned, stories
you did, words you got wrong". Staging: **Stage 1 = end-of-chapter bot (this release)**, Stage 2 =
persistent assistant on main + storyline pages, Stage 3 = concept graph (optional).

## Stage-1 decisions (locked with the user)

1. **Non-streamed replies.** A chapter Q&A turn is short; streaming through the zero-dep server and
   the v59 metering wrapper is real work, deferred. The UI shows a "thinking…" state instead.
2. **Client sends learner-state per request → the server stays stateless.** Learner state lives in
   the browser (localStorage); generation lives on the server. Rather than move state server-side
   (a Stage-2 concern for cross-device), each request carries the slice it needs.
3. **Conversational, not graded.** The tutor asks and discusses; it does not score free text.
   Reliable free-text grading is its own hard problem and would undercut the "encourage discovery"
   philosophy the spec asks for.

## What shipped

**Tutor model role.** `OLLAMA_TUTOR_MODEL` (env-overridable, defaults to the STORY model — both
produce prose, unlike the lesson model's JSON). Runtime-switchable via `/api/models`, exposed in
`/api/info` + `/api/models`, with its own reasoning checkbox (`think.tutor`) reusing v60.7's
`thinkOpts` — so enabling reasoning for the tutor also bumps its token budget ×2.5 and timeout ×3.
`callLLMTutor` is the role wrapper (applies the policy centrally, like `callLLMLesson`).

**`POST /api/tutor`** — stateless. Takes `{story, wrongWords, knownWords, lang, srcLang, history,
opening}` and returns ONE `{reply, promptTokens, completionTokens}`. 503 without a backend; 400
without a story. Every untrusted field is capped: story 4000 chars, wrongWords 40×60, knownWords
200×60, history last 20 turns × 800 chars, and history roles are normalized to `student|tutor` (a
client can't smuggle a third role into the transcript). Because the llm layer takes a single
system+user pair, the conversation is **flattened into the user message** ("Conversation so far: …")
rather than changing the LLM plumbing — the cheapest way to get multi-turn without touching a
choke point every other feature depends on. An empty model reply is reported as an error rather
than rendered as an empty bubble.

**Prompt** (`prompts.json` → `tutor`): warm tutor persona; ONE focused comprehension/grammar
question at a time; explicitly told which words the learner got **wrong** and to weave those in;
bounded to the chapter's story and the learner's known vocabulary ("do NOT introduce unrelated new
vocabulary"); prefers a hint or follow-up question over handing over the answer; replies in the
learner's source language. Takes `{S} {L} {story} {wrongWords} {knownWords}`.

**Client.** A collapsible 🦉 panel on the completion card, shown only when a backend AND a story
exist, and never on a drill card. Opening it starts the conversation (the tutor asks the first
question). `_tutorGatherContext` assembles the payload from existing stores: this round's
`_wrongTargets` **unioned** with ledger words whose wrong-count is >0 (so a mistake earlier in the
chapter still counts), plus the ledger's known vocabulary to bound explanations. Client caps mirror
the server's. Five en-only i18n keys.

## Tests

New `unit-tutor.test.js` (registered; suite **113 green**): the model role (own model, switchable,
reasoning-capable, exposed); the route (stateless — asserts it persists nothing — plus every input
cap and the 503/400 guards); the prompt (error focus, one-question rule, vocabulary bounding,
discovery-over-answers); the client (backend+story gate, never-on-drills, error-focused context
gathering, busy-flag always clears); and the static build (tutor gated off — `canGenerate:false`).
`unit-reasoning-toggle` updated for the third role (currentModels shape, setRuntimeModels, menu
checkbox, switchThink guard). `unit-version-derivation` needed only the static rebuild.

## How to see it work (browser + Ollama)

Pick a tutor model in the model menu (defaults to your story model; optionally tick its 🧠 box).
Play a chapter and get some answers **wrong** — those words are the tutor's focus. On the completion
card, open "🦉 Talk to the tutor": it greets you and asks a comprehension question aimed at a word
you missed. Answer it, or ask your own question about the story/grammar; it replies in your source
language, one question at a time. Reopen a different chapter's card and the conversation resets
(Stage 1 is per-chapter by design). The panel is absent with no backend (including the static build)
and on drill cards.

## Deferred (Stage 2+)

Persistent assistant reachable from the main and storyline pages, with retrieval across ALL
completed stories (needs a RAG selection strategy — keyword/recency over existing stores, no vector
DB, to keep the zero-dep constraint); optional per-question help; server-side learner state for
cross-device; streamed replies; and the concept graph (Stage 3) for rigorous prerequisite/spoiler
logic and cross-domain links.
