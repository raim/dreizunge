# v63 — per-question inline help

Third step of the tutor arc (v61 end-of-chapter → v62 persistent widget → v63 in-lesson help).
Small in surface area, but it carries one genuinely important design decision.

## The feature

A 🦉 in the lesson topbar, next to the progress bar. Tapping it opens the tutor about the exercise
currently on screen and asks for a **hint** (before you answer) or an **explanation** (after). The
button appears only with a live backend and only while an exercise is showing; it refreshes with
every exercise and again the moment an answer is graded, so it flips from hint-mode to explain-mode
by itself.

Because v62 already put the tutor on every screen with a continuous thread, this needed no new
plumbing — only that the tutor learn *which question* the learner is looking at. So the work is in
`_tutorCurrentQuestion()` and the lesson scope.

## The design decision: the answer is WITHHELD, not merely forbidden

A tutor that hands over the answer while you are still answering is worse than no tutor. The
obvious implementation — send the exercise including its `correct` field and tell the model "don't
reveal it" — is exactly the kind of guarantee that erodes under a clever prompt or a compliant
model.

So this follows the same structural approach as v62's spoiler whitelist: **the answer is never sent
until the learner has answered.** `APP.cur.answered` is already tracked, so the client can gate it
precisely. Three independent gates, deliberately redundant:
1. `_tutorCurrentQuestion` omits any field whose value equals the correct answer while unanswered;
2. `_tutorScope` only attaches `answer` when `answered` is true;
3. the server refuses to carry an `answer` unless the client also said `answered: true`.
The prompt *also* says "give a HINT… never state the answer" — but that is belt-and-braces on top
of a model that was simply never told the answer.

**Why value-filtering rather than per-type rules.** Exercise shapes differ in where the answer
lives: a source→target question's answer is `target`, a target→source question's is `source`, a
cloze's is the missing word. Special-casing each type is a standing invitation to miss one (and I
did miss one on the first pass — the target→source case leaked through a naive rule). Filtering on
the *value* — never emit a field equal to `correct` — is shape-agnostic and can't be defeated by a
new lesson type.

**Choices are deliberately kept.** For multiple choice, the answer is necessarily among the choices
sent. That is not a leak: the learner already sees every choice on screen, and the model is not told
which is correct — it knows only the candidate set, which is exactly what it needs to give a useful
hint ("think about which of these relates to water").

## Tests

`unit-tutor` gained a per-question section that runs the real describer across five exercise shapes
(source→target MCQ, target→source MCQ, typed, cloze, listening MCQ) and asserts for each that the
answer is **not identifiable as a labelled field** while unanswered, and **is** available once
answered. The leak check deliberately ignores the `Choices:` block, encoding the distinction above
so a future reader doesn't "fix" it. Also pins the second and third gates (scope + server) and the
button wiring. Suite **114 green**.

## How to see it work (browser + Ollama)

Start any lesson. A 🦉 appears in the top bar. Before answering, tap it: the tutor gives a hint that
points at the word or structure without naming the answer — ask it directly for the answer and it
still won't have one, because it was never sent. Answer the question, then tap 🦉 again: now it
explains fully, including the correct answer. The conversation continues in the same thread as
everywhere else, so you can follow up in the widget.

## Still open (roadmap_v63.md)

Streaming replies; server-side learner state (cross-device threads + a teacher view); Stage 3
concept graph. Plus the standing non-tutor items and the ~45 accumulated en-only i18n keys.
