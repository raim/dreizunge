# Dreizunge → Platform — rough plan (accounts, central repo, token economy, web + mobile)

Status: planning only. No code yet. This is the "what would it take" doc; the prioritized
near-term work lives in `roadmap_v47.md`.

## 0. Honest difficulty read

**What you already have (the valuable, reusable core):**
- A working lesson/storyline **generation engine** with per-type generators, salvage
  validators, and `_genMeta` (attempts / valid / rejected / prompt+completion tokens) —
  i.e. metering hooks already exist.
- A capable **client** (single-file `index.html`): play, teacher-mode editing, flags,
  star ratings, per-storyline QC, static export.
- A **per-target-language example mechanism** (Major A: `promptExample` + `{EXAMPLE}`).
- A clean **registry-based dispatch** (Major B) so new lesson types are cheap.

**What is genuinely new (this is ~80% of the work, and most of it is "standard SaaS"):**
- User accounts / auth / sessions.
- A real database (today: JSON files + browser `localStorage`).
- A **hosted, metered LLM** path (today: local Ollama). The token economy *forces* this —
  you can't meter/charge for compute you don't control.
- **Payments** (buying tokens) — real money: Stripe, tax/VAT, refunds, fraud, accounting.
- A **central repository**: publish/browse/import lesson sets + storylines, submit
  flags/edits, plus a **moderation** pipeline and content licensing.
- **Cloud sync** of progress (local-first → multi-device).
- **Mobile** (web + phone).
- Ops: hosting, backups, rate limits, observability, abuse prevention.

**Rough effort (solo, part-time, reusing the engine):**
- Multi-user MVP (accounts + cloud progress + hosted LLM with *granted/earned* tokens +
  read-only shared repo): ~1–3 months.
- Full vision (token *purchase* + moderation + author submissions + polished web **and**
  native mobile + abuse-resistance): ~6–12 months or a small team.

**Biggest risk by far: the "buy tokens" path.** Real money pulls in payments compliance,
tax (you're in DE → EU VAT/MOSS, GDPR), refunds, chargebacks, and fraud. Everything else is
buildable incrementally; payments is the part that's unforgiving if rushed. Strongly
consider shipping **earn-only** first and adding purchase later.

## 1. Architectural forks to decide *before* writing code

1. **Local-first vs cloud-first.** Today it's local-first (localStorage, JSON, Ollama,
   static build for GitHub Pages). A platform is cloud-first. Recommended: keep a
   local/offline *mode* (it's a differentiator and the static build already exists), but
   make the account + repo + hosted-generation features cloud-only.
2. **LLM hosting.** Local Ollama stays as a "bring-your-own-compute / free" tier; the paid
   tier calls a hosted API (or your own GPU). The token economy meters the hosted path.
   `_genMeta` already records token counts — that's the billing meter.
3. **Keep the zero-dep Node server, or adopt a framework?** The current server is a single
   zero-dep file. For multi-user you'll want at least: a router, an auth lib, a DB driver,
   and migrations. Pragmatic path: introduce a thin framework (e.g. Fastify/Express) *behind
   a clean API boundary* and keep the generation engine as a library it calls. Don't rewrite
   the engine.
4. **Database.** Postgres is the safe default (relational: users, tokens, lessons, repo
   items, flags, moderation). Add object storage only if you store large blobs.
5. **Web + mobile strategy.**
   - **PWA-first** (recommended): the client is already a single web app; make it
     installable, add offline caching. One codebase, instant updates, no app-store tax.
   - **Native wrapper** when you need store presence / push / IAP: wrap the web app with
     **Capacitor** (cheapest path from the existing HTML/JS). Full **React Native** only if
     you need deep native UX — that's a second client to maintain.
   - Note: Apple/Google take ~15–30% on in-app purchases, which interacts badly with a token
     store — often cheaper to sell tokens on the **web** and just consume them in the app.
6. **Repository model.** How is shared content represented, versioned, attributed, licensed,
   and moderated? Decide: fork-on-import vs live-subscribe; who can publish; how edits/flags
   from many users merge back (your existing flag/QC data is the seed for this).

## 2. Offline TODOs (decisions & prep that don't require coding — do these first)

These are the things that sink projects when skipped:

- [ ] **Token economics.** Define the unit (raw LLM tokens vs an abstracted "credit"),
      earn rates (per lesson solved, with daily caps), spend prices (per generation by model
      + output size), and the conversion if buying. Model your **LLM cost per generation**
      vs tokens granted so the economy can't run you into a loss.
- [ ] **Earn-loop anti-abuse policy.** "Earn tokens by solving lessons" is farmable
      (scripted solves, self-generated trivial lessons). Decide caps, proof-of-effort, and
      whether *generated* lessons count toward earning (probably not).
- [ ] **Payments + tax.** Pick a provider (Stripe). Confirm EU VAT/MOSS handling, invoicing,
      refunds, chargeback policy. Decide web-only purchase to dodge app-store IAP cuts.
- [ ] **Legal.** ToS, Privacy Policy, GDPR (DE/EU): data export/delete, consent, data
      processing agreement with the LLM provider. **Content licensing**: when a user submits
      a lesson set to the repo, what license do they grant? DMCA/abuse takedown process.
- [ ] **Moderation policy.** What's allowed in shared content; report/queue/remove flow;
      who moderates (you, trusted users, automated pre-screen using the existing QC?).
- [ ] **Data model on paper.** users, sessions, token_ledger (append-only), lesson_sets,
      storylines, repo_items (+ versions), flags, edits, submissions, moderation_actions.
- [ ] **Cost & hosting budget.** Hosted LLM $/month at expected usage, DB/host, egress.
- [ ] **Threat model.** Free-tier abuse, token fraud, scraping the repo, prompt-injection in
      user-submitted content fed back into generation.
- [ ] **Pricing/positioning.** Free (BYO-Ollama / offline) vs paid (hosted generation)
      tiers; what earning actually unlocks.

## 3. Coarse implementation plan (phases — each shippable)

- **Phase 0 — API boundary.** Carve a clean HTTP API out of the current monolith so the
  client talks to documented endpoints and the generation engine is a callable library.
  No new features; pure decoupling. Unblocks everything else and keeps the engine reusable.
- **Phase 1 — Accounts + cloud progress.** Auth, user table, migrate progress from
  `localStorage` to server-side per-user state (keep local as offline cache). Multi-device.
- **Phase 2 — Hosted generation + token meter (earn/granted only).** Route generation
  through a hosted LLM; debit a per-user token ledger using `_genMeta` counts; grant tokens
  on signup + on lesson completion (with caps). **No purchasing yet.**
- **Phase 3 — Central repository (read + publish).** Browse/import shared lesson sets &
  storylines; submit flags/edits; author-publish with a moderation queue. Reuse existing
  flag/rating/QC as the curation substrate.
- **Phase 4 — Token purchase + hardened earn loop.** Stripe, VAT, refunds; anti-abuse on
  earning. (Highest risk — do last, only once usage justifies it.)
- **Phase 5 — Mobile.** PWA polish (installable, offline) → Capacitor wrapper for stores if
  needed. Sell tokens on web to avoid IAP cuts.
- **Cross-cutting throughout:** rate limits, backups, observability, audit log on the token
  ledger, prompt-injection hardening for repo content.

## 4. How today's pieces map onto the platform

| Today | Becomes |
|---|---|
| Generators + validators + `_genMeta` | Server-side **generation service**, token-metered |
| Teacher-mode editor | **Author** role; output flows to the repo via submissions |
| Per-item flags + star ratings + QC | **Community curation + moderation** substrate (half-built already) |
| `lessons.json` / storyline JSON | **repo_items** rows (versioned, attributed, licensed) |
| `localStorage` progress | Per-user **cloud progress** (local kept as offline cache) |
| Static build (`docs/`) | "Play offline / shareable export" feature |
| Ollama | **Free/BYO-compute tier**; hosted API is the paid, metered tier |

## 5. Token system sketch
- **Meter:** you already capture `promptTokens`/`completionTokens` per generation in
  `_genMeta` — that is the billing signal. Price a generation by model + output size.
- **Earn:** completing lessons grants credits (daily cap; generated-by-self lessons don't
  count; ideally require a minimum score / no-skip).
- **Buy:** Stripe, web-first. Append-only **token_ledger** (never mutate balances; sum the
  ledger) for auditability and dispute handling.
- **Spend:** debit on generation; refund on hard failure (your salvage path makes "partial
  success" common — decide the charge policy for partially-valid output up front).
- **Abuse vectors:** farm loops, shared accounts, refund fraud, a single user issuing
  expensive generations — cap concurrency and per-request output size.

## 6. Things that will bite (write these on the wall)
- Payments/tax/refunds are a project of their own — sequence them last.
- The earn loop is gameable; design caps before launch, not after.
- User-submitted repo content fed back into prompts is a **prompt-injection** surface.
- Moderation is ongoing labor, not a feature you finish.
- App-store IAP economics can wreck token margins — keep purchase on the web.
- Don't rewrite the generation engine; wrap it. The engine is the moat, not the plumbing.
