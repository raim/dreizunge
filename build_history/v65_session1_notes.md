# v65 — learner accounts + server-side state

The last structural step of the tutor arc, and the largest. Three decisions from the user:
**real accounts with passwords**, **server wins** (localStorage is the offline fallback), and
**progress + learned ledger + tutor thread** move server-side.

## The thing I checked first, because getting it wrong would have been unrecoverable

`build-static.js` bakes `lessons.json` **wholesale** into `docs/index.html`, which is published to
GitHub Pages. Had learner accounts been stored there, every password hash and every student's
history would have been published on the next static build. So learner data lives in its own store
(`learners.json`, `LEARNERS_FILE`-overridable, chmod 600 on write) that the static builder never
reads — and a test now asserts the builder never touches it, plus that no credential-shaped data
appears in the published bundle.

## Security posture (stated plainly)

Zero-dependency, using node's own `crypto`:
- **scrypt** (memory-hard KDF) with a **per-user random salt**; plaintext is never stored. Two users
  with the same password get different hashes.
- **Timing-safe** hash comparison.
- **Sessions**: 256-bit random tokens in **HttpOnly, SameSite=Lax** cookies. `Secure` is added when
  the request arrived over TLS but not forced — forcing it would silently break plain-HTTP LAN use.
  Only the **SHA-256 of the token** is stored, so a leaked `learners.json` cannot be replayed as a
  live session.
- **No account enumeration**: unknown-user and wrong-password return the identical message.
- **Throttling**: repeated failures lock the account for a window, failing closed.
- **A learner can only write their own state** — the username comes from the session, never the
  request body.
- **No password is ever logged** (asserted across every `console.*` line in both files).

**What this does NOT do:** transport security. Over plain HTTP on a LAN, passwords travel in the
clear. Anyone exposing this beyond localhost should terminate TLS in front of it. Said explicitly
because auth that feels strong while being weak is worse than none.

## Sync model

`saveProg()` still writes localStorage **first**, then schedules a debounced (1.5 s) push when a
learner is signed in. So an offline session, a signed-out session, and the static build all behave
exactly as before — the server is additive, never a dependency. A `beforeunload` beacon flushes the
last few answers past the debounce.

**Server wins on load**, with one deliberate exception: if the server copy is empty *and* this
device has local history, the local history is uploaded instead of being overwritten. That makes
first login a **migration** rather than a data loss, which is the failure mode I most wanted to
avoid.

## UI

A 👤 badge bottom-left (hidden without a backend, so the static build never shows it), opening a
small modal: sign in, create account, sign out. The hint text says plainly what an account changes —
progress follows you to other devices; without one everything stays local.

## Teacher view

`GET /api/learners` returns a per-learner summary: chapters completed, words learned, last seen, and
the **hardest words ranked by wrong-count** — enough to see who is struggling and with what, without
dumping anyone's whole ledger. Credentials never appear in it (asserted).

## Tests

New `unit-learners.test.js` (suite **116 green**) proves the security properties **behaviourally**
against the real module rather than by reading source: plaintext absent from the store, per-user
salts producing different hashes for identical passwords, identical failure messages, throttling,
session tokens hashed at rest and revocable on sign-out, oversized state refused, summaries free of
credentials, the static builder never reading the store, cookie flags, session-scoped writes, and
the client's server-wins/offline-fallback/migration behaviour.

Two of my own assertions were **too crude and I fixed the tests, not the code**: `"salt"` matched
Italian *saltate* and Spanish *resaltar* in the UI bundle (now shape-matched: `"salt":"<hex>"`), and
the password-logging check caught a legitimate `b.password` argument rather than a log (now scans
`console.*` lines only).

## How to see it work

Start the server, click 👤 → Create, pick a name and a password (8+ chars). Play a chapter and chat
with the tutor. Open the app on another device (or another browser profile), sign in with the same
account: your chapters, vocabulary and tutor conversation are all there. Verified end-to-end.
Sign out and the device keeps its own local copy but stops syncing.

## Still open (roadmap_v65.md)

Stage 3 concept graph; a teacher-facing UI for `/api/learners` (the endpoint exists, nothing renders
it yet); optional per-learner tutor-model preferences; plus the standing non-tutor items and ~56
accumulated en-only i18n keys.
