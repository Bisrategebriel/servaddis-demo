# Servaddis Demo — Development Plan (living)

> This is the **working plan**. Check it at the start of every session and update it at the end of every task.
> The specs in [`/docs`](docs/) say *what* to build. This file tracks *where we are*, *what's next*, and *what we decided*.

| | |
|---|---|
| **Product** | Servaddis: hospitality-only hiring platform for Addis Ababa. This build is a **demo**, not the MVP |
| **Stack (locked)** | Next.js (App Router) + TypeScript strict · Tailwind + shadcn/ui · Prisma 6.x + SQLite (WAL) · next-intl · SWR · zod · Vitest + Playwright · pnpm · Node 22 LTS |
| **Budget** | P0 150 h · P0+P1 179 h · all 183 h ([doc 06 §1](docs/06-Implementation-Plan.md), minus 2 h for local-only hosting, D-9) |
| **Hosting** | Local only (laptop + LAN for the phone). Off-site viewers get a free Cloudflare quick-tunnel link when needed. No hosted staging (D-9) |
| **Plan version** | 0.1 · started 29 Oct 2026 |

---

## 0. How to use this file

1. **Before starting work:** read §1 *Current status* and pick the next unchecked task in §5 whose dependencies are done.
2. **While working:** follow the spec sections linked on the task, and the guardrails in §3 and conventions in §4.
3. **When a task is done:** it must meet its *Done when* line and the Definition of Done (§7). Then tick it, add actual hours, and update §1.
4. **When you decide something:** add a row to the Decision log (§9). If it changes a spec, edit the doc in `/docs` as well and record it in the Change log (§11).
5. **When a new idea comes up:** put it in the Post-demo backlog (§10). Don't put it in the current milestone (risk P-1).

Status markers: `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` cut (give the reason in §9)

---

## 1. Current status

| Field | Value |
|---|---|
| **Current milestone** | M0 Foundations |
| **Next task** | T0.2 Prisma schema + SQLite |
| **Last demoable build** | — |
| **Hours spent / P0 budget** | 0 / 150 |
| **Blockers** | None |
| **Open decisions due soon** | D-5 wordmark (icon received). Defaults apply if unanswered (§8) |

**Milestone progress**

| Milestone | P0 h | Total h | Status | Demoable outcome |
|---|--:|--:|:-:|---|
| M0 Foundations | 29 | 29 | `[~]` | Sign in as any persona; reset works; shells in EN/AM |
| M1 Onboarding & verification | 22 | 22 | `[ ]` | **Demo A**: register → upload license → admin verifies → notification |
| M2 Job posting loop | 29 | 32 | `[ ]` | **Demo B**: template → composer → fee rule blocks → admin publishes |
| M3 Jobseeker & pipeline | 24 | 26 | `[ ]` | **Demo C**: apply → shortlist → reveal → hire (first full loop) |
| M4 Team & RBAC | 8 | 8 | `[ ]` | Poster vs Screener differ in UI **and** API |
| M5 Promote, plans & insights | 10 | 25 | `[ ]` | Card render + previews; checkout; insights |
| M6 Bilingual, PWA & polish | 6 | 17 | `[ ]` | Full AM/EN; installable; polished |
| M7 Toolkit, tests & rehearsal | 22 | 24 | `[ ]` | E2E green; 3 clean rehearsals; fallback video |

**External-showing gate:** only show this outside the team once M3 + M4 + T5.1/T5.2 (Promote) are done. Anything earlier is for internal feedback only.

---

## 2. Source-of-truth map

| Need | Go to |
|---|---|
| Scope, priorities (P0/P1/P2), acceptance criteria, personas | [01-PRD.md](docs/01-PRD.md) §6–§7 |
| Architecture, stack, API list, security, env vars, budgets | [02-TRD.md](docs/02-TRD.md) §2–§11 |
| Screens and routes, state machines, entitlement, demo script | [03-App-Flow.md](docs/03-App-Flow.md) §1, §4–§9 |
| Tokens, typography, components, wireframes, microcopy | [04-UX-UI-Design-Brief.md](docs/04-UX-UI-Design-Brief.md) §2–§7 |
| Prisma schema, permissions, derived fields, rules JSON, seed | [05-Backend-Schema.md](docs/05-Backend-Schema.md) §4–§9 |
| Task list, estimates, cut line, rehearsal checklist | [06-Implementation-Plan.md](docs/06-Implementation-Plan.md) §3–§8 |

When documents conflict, use this order: **05 Schema** (data) > **03 App Flow** (behaviour) > **02 TRD** (technical) > **04 UX** (visual) > **01 PRD** (intent). Log the conflict in §9.

---

## 3. Guardrails (never cut, never bypass)

From [doc 06 §3.2](docs/06-Implementation-Plan.md). These are what make the demo hold up when someone pokes at it.

- **Server-side RBAC on every endpoint.** Resolve the venue from the *resource*, never from the client. Foreign resource → 404; missing permission → 403. UI hiding is cosmetic only.
- **Verification gate:** only `VERIFIED` venues can submit jobs. Drafts are always allowed.
- **Rules engine** is a pure function over `rules.json`. A `block` flag → 422 with `flags[]`. The same function powers `/check`.
- **Demo clock:** services call `now()` from `server/clock.ts`, never `new Date()` or `Date.now()`.
- **Reset ≤ 10 s**, and it returns every feature to its seeded state.
- **Contact privacy:** list responses carry `phoneMasked` only. Reveal requires SHORTLISTED/HIRED + `contact.reveal`, uses `Cache-Control: no-store`, and writes an AuditLog row.
- **No real personal data.** Fictional seeds only, no real Fayda numbers, sample license PDFs only.
- **Honesty:** everything simulated carries a *Simulated* tag (SMS, payment, publish, Fayda).
- **The e2e demo-script test and the three rehearsals happen.**

---

## 4. Conventions

| Area | Rule | Ref |
|---|---|---|
| Layout | Follow the repo tree in TRD §4 (`src/app`, `src/server/{policy,services,rules,adapters,demo}`, `prisma/seed/*`, `messages/*`). The repo root is this folder (TRD calls it `servaddis-demo/`) | 02 §4 |
| Route handlers | Thin: zod parse → `withAuth` → domain service → shape response. Use the standard error envelope | 02 §5.2, §7 |
| Transactions | Every state transition is one transaction: entity + event + notification + audit | 02 §5.3–5.4 |
| Money | Integer ETB. `vat = round(amount × 0.15)`. Receipt numbers `SVD-YYYY-NNNNNN` | 05 §6.4 |
| Time | Store UTC; display `Africa/Addis_Ababa`. All end-of-day/expiry logic lives in **one** tested utility | 05 §6.4, 02 TR8 |
| i18n | No hard-coded UI strings. Keys namespaced (`employer.composer.salary.required`). `en.json` and `am.json` keys must match (CI check). Content uses `…En`/`…Am` columns | 02 §6 |
| Amharic type | Line-height ≈ 1.2× Latin; no italics or letter-spacing; allow +30 % width; never truncate titles in the AM preview | 04 §2.3 |
| Colour | Use the tokens in `styles/tokens.css` only. **Never use `#D9A441` as text on white.** Status is never shown by colour alone | 04 §2.2 |
| Adapters | Every integration (Sms, Payment, Fayda, Distribution, Storage) has an interface + a `sim` implementation that writes to the DB | 02 §2 |
| Polling | Pipeline 3 s · tracker 5 s · admin queue 4 s · promote 2 s · bell 10 s | 02 §7.2 |
| Bundles | Jobseeker routes ≤ 200 KB gz; no Recharts or admin code on them | 02 §8 |
| Git | `main` always demoable; short feature branches; squash merges; tag rehearsed builds `demo-YYYYMMDD-n` | 06 §6 |
| Versions | Pin exact Next.js, Prisma and Tailwind versions on day 1 and record them in §9 | 02 §3 |

---

## 5. Task board

Each task lists its priority, estimate, dependencies, spec refs and *Done when*. Fill in **Act** (actual hours) when you finish.

### M0 — Foundations (29 h, all P0)

| ✓ | ID | Task | Est | Act | Deps | Refs | Done when |
|:-:|---|---|--:|--:|---|---|---|
| [x] | T0.1 | `git init`; Next.js + TS strict, Tailwind tokens, shadcn/ui, ESLint/Prettier, CI skeleton | 3 | 0.5 | — | 02 §3–4, 04 §2.2 | `pnpm dev` runs; CI green on empty tests |
| [ ] | T0.2 | Prisma schema, SQLite WAL, first migration, db client | 2 | | T0.1 | 05 §4 | `prisma validate` passes; tables exist |
| [ ] | T0.3 | Seed v1: geography, skills, 12 templates (EN + draft AM), plans, personas, 3 venues, ~40 jobseekers | 4 | | T0.2 | 05 §9 | `pnpm seed` idempotent; matches 05 §9 |
| [ ] | T0.4 | OTP + session auth, `/api/me`, role routing, middleware, rate limiting | 5 | | T0.2 | 02 §5.1, 03 §2 | Demo OTP works; lockout after 5; cookie flags correct |
| [ ] | T0.5 | Policy layer: keys, presets, `authorize*`, `withAuth` + unit-test matrix | 4 | | T0.4 | 05 §5, 03 §6 | 03 §6.1 matrix fully covered by tests |
| [ ] | T0.6 | Shells (employer/jobseeker/admin), `LangToggle`, next-intl, Inter + Noto Sans Ethiopic | 5 | | T0.1 | 04 §4, 02 §6 | Renders at 360/768/1280; language toggles and persists |
| [ ] | T0.7 | Clock + sweep + `DemoSetting`; error envelope; zod helpers | 2 | | T0.2 | 02 §5.9, 05 §8 | `now()` honours offset; sweep unit-tested |
| [ ] | T0.8 | `pnpm demo` (build → migrate → seed → start, LAN mode); README section on installing `cloudflared` (`winget install Cloudflare.cloudflared`) and running the quick tunnel. No Dockerfile or hosting yet (D-9) | 1 | | T0.3 | 02 §11 | Runs offline in airplane mode; phone on the hotspot opens the LAN URL; tunnel link opens from another network |
| [ ] | T0.9 | Minimal toolkit: persona switcher + Reset | 3 | | T0.3, T0.4 | 02 §5.10, 03 §1.3 | Reset ≤ 10 s; persona lands on correct screen |

**M0 exit:** sign in as each persona in 03 §1.3, reset, toggle EN/AM on all three shells.

### M1 — Onboarding & verification (22 h, all P0)

| ✓ | ID | Task | Est | Act | Deps | Refs | Done when |
|:-:|---|---|--:|--:|---|---|---|
| [ ] | T1.1 | Landing + sign-in (phone, OTP, lockout, resend), EN/AM | 4 | | T0.4, T0.6 | 03 SCR-00/01, 04 §7 | All states complete |
| [ ] | T1.2 | Venue setup screen + venue API | 3 | | T1.1 | 03 SCR-E01 | Venue + OWNER membership created |
| [ ] | T1.3 | License upload: dropzone, type/size/magic bytes, storage adapter, `/api/files` | 4 | | T1.2 | 03 SCR-E02, 02 §9 | Invalid files rejected server-side |
| [ ] | T1.4 | Moderation service + admin queue/review (licenses), audit | 6 | | T1.3, T0.5 | 03 SCR-A01/A02 | Venue → VERIFIED/REJECTED |
| [ ] | T1.5 | Dashboard, onboarding checklist, bell, simulated SMS log | 5 | | T1.4 | 03 §3, SCR-E03 | Badge updates ≤ 5 s after approval |

**M1 exit (Demo A):** script rows 1–4 of 03 §9 run from a fresh reset, in both languages.

### M2 — Job posting loop (32 h: P0 29 · P1 3)

| ✓ | ID | Pri | Task | Est | Act | Deps | Refs | Done when |
|:-:|---|:-:|---|--:|--:|---|---|---|
| [ ] | T2.1 | P0 | Template picker + 12 templates' content | 4 | | T0.3, T1.5 | 03 SCR-E05, 05 §9.2 | Each template fills EN + AM |
| [ ] | T2.2 | P0 | Composer: 4 steps, `BilingualField`, `SalaryRange`, `UrgencySelect`, live preview, draft save | 10 | | T2.1 | 03 SCR-E06, 04 §7 | All E-07/E-08 criteria met |
| [ ] | T2.3 | P0 | Rules engine, `/check`, `RuleFlagList`, unit tests incl. AM patterns | 5 | | T2.2 | 05 §7.1, 03 §4.4 | Fee request blocked; off-platform contact warns |
| [ ] | T2.4 | P0 | Submit flow, entitlement resolver, status chips, jobs list + overview | 6 | | T2.3 | 03 §4.1–4.2, 05 §7.2 | Unverified venue locked; founding quota decrements on approval |
| [ ] | T2.5 | P0 | Admin job review, fast-approve tag, publish + expiry | 4 | | T2.4, T1.4 | 05 §6.1, §6.4 | Approve → LIVE with correct `expiresAt` (EAT) |
| [ ] | T2.6 | P1 | Expiry banner (T-3 d), one-tap repost, manual close | 3 | | T2.5 | PRD E-11 | Repost is fast-approve if unchanged |

**Build T2.2 first and timebox it.** Fallback if it overruns: single-page composer (risk P-2).
**M2 exit (Demo B):** script rows 5–7.

### M3 — Jobseeker & applicant pipeline (26 h: P0 24 · P1 2)

| ✓ | ID | Pri | Task | Est | Act | Deps | Refs | Done when |
|:-:|---|:-:|---|--:|--:|---|---|---|
| [ ] | T3.1 | P0 | Public feed API, feed UI + filter sheet, job detail | 6 | | T2.5 | 03 SCR-J01/J02, 05 §10 | Within perf budget |
| [ ] | T3.2 | P0 | Idempotent apply, `StepTracker`, jobseeker notifications | 4 | | T3.1 | 03 §5.2, SCR-J03 | Duplicate taps are safe |
| [ ] | T3.3 | P0 | Applicants API + pipeline (list/board), verified-first, polling, live toast | 6 | | T3.2 | 03 SCR-E08, §5.1 | Toast ≤ 5 s |
| [ ] | T3.4 | P0 | Applicant drawer: view/shortlist/reject/hire/reveal; events; audit; masking | 6 | | T3.3 | 03 SCR-E09, 05 §12 | Reveal gating and audit verified |
| [ ] | T3.5 | P0 | Hire → auto-close at headcount, time-to-fill, check-ins | 2 | | T3.4 | 03 §5.1 | Job auto-closes; `filledAt` set |
| [ ] | T3.6 | P1 | Jobseeker profile + completeness meter | 2 | | T3.2 | 03 SCR-J04, 05 §6.4 | SCR-J04 done |

**M3 exit (Demo C):** script rows 8–9. Show this build to one friendly employer for feedback.

### M4 — Team & RBAC (8 h, all P0)

| ✓ | ID | Task | Est | Act | Deps | Refs | Done when |
|:-:|---|---|--:|--:|---|---|---|
| [ ] | T4.1 | Team API: invite, role/grants, remove, last-owner guards | 3 | | T0.5 | 03 §6.3, 05 §5.3 | Guards enforced server-side |
| [ ] | T4.2 | Team screen + `PermissionMatrix`; permission-aware UI everywhere; 403 page | 5 | | T4.1, T3.4 | 03 SCR-E14, 04 §7 | Poster can't reach applicants; Screener can't create jobs (UI + API) |

**M4 exit:** script rows 10–12.

### M5 — Promote, plans & insights (25 h: P0 10 · P1 13 · P2 2)

| ✓ | ID | Pri | Task | Est | Act | Deps | Refs | Done when |
|:-:|---|:-:|---|--:|--:|---|---|---|
| [ ] | T5.1 | P0 | **Spike first:** Amharic in Satori (TTF). Then card renderer, QR, card endpoint | 5 | | T2.5 | 02 §5.6, TR1; 04 SCR-E10 | 1080×1080 + 1080×1920 PNGs in EN and AM |
| [ ] | T5.2 | P0 | Promote screen, sim distribution adapter, captions, previews, publish log | 5 | | T5.1 | 03 §7 | TikTok = draft; Simulated tags shown |
| [ ] | T5.3 | P2 | Real Telegram publish behind `TELEGRAM_REAL` | 2 | | T5.2 | 02 §5.6 | Photo + caption appear in the channel |
| [ ] | T5.4 | P1 | Plans, sim checkout, webhook, subscription, VAT receipt | 7 | | T2.4 | 03 §8, 02 §5.7 | Promote unlocks after Pro |
| [ ] | T5.5 | P1 | Insights queries + charts + deterministic seeded history | 6 | | T3.5, T0.3 | 05 §9.5, §10.1 | Trend shows improvement |

**M5 exit:** script rows 13–15. Record the TR1 spike result in §9.

### M6 — Bilingual, PWA & polish (17 h: P0 6 · P1 9 · P2 2)

| ✓ | ID | Pri | Task | Est | Act | Deps | Refs | Done when |
|:-:|---|:-:|---|--:|--:|---|---|---|
| [ ] | T6.1 | P0 | Amharic pass on all P0 screens/notifications + native review | 6 | | T1.1…T5.2 | 04 §3 | 0 missing keys; no clipped Amharic |
| [ ] | T6.2 | P1 | PWA: manifest, icons, Serwist offline shell | 3 | | T0.6 | 02 TR5 | Installable; offline page shown |
| [ ] | T6.3 | P1 | Polish: empty states, skeletons, motion, responsive | 6 | | T3.4 | 04 §6, §11 | Design QA checklist passes |
| [ ] | T6.4 | P2 | Presenter mode | 2 | | T6.3 | 04 §8 | Works on all P0 screens |

### M7 — Toolkit, tests & rehearsal (24 h: P0 22 · P1 2)

| ✓ | ID | Pri | Task | Est | Act | Deps | Refs | Done when |
|:-:|---|:-:|---|--:|--:|---|---|---|
| [ ] | T7.1 | P0 | Toolkit: simulate applicant, approve-all, scenario jump, time-skip, phone drawer, tag toggle, ribbon | 6 | | T0.9, T3.3 | 02 §5.10 | All toolkit functions work |
| [ ] | T7.2 | P0 | E2E demo-script (EN + AM) + RBAC API matrix | 6 | | T7.1, T4.2 | 02 §12, 03 §9 | Passes on fresh seed in CI |
| [ ] | T7.3 | P0 | Lighthouse budgets, axe, throttled-3G device pass | 4 | | T6.3 | 02 §8 | Jobseeker ≤ 200 KB, FCP ≤ 3.5 s |
| [ ] | T7.4 | P0 | 3 rehearsals, runbook, fallback video, bug buffer | 6 | | T7.2, T7.3 | 06 §8 | 3 consecutive clean runs |
| [ ] | T7.5 | P1 | Admin audit view + counts page | 2 | | T1.4 | 03 SCR-A03 | SCR-A03 done |

**Parallel or gap work (no milestone):** Amharic copy review from M2 onward · PWA icons generated from `assets/brand/servaddis-icon.svg` (copy it to `public/icons/` at T0.1; the maskable 512 needs a square, full-bleed navy version because the rounded corners would show as transparent) · sample license PDF ("SAMPLE — NOT A REAL LICENSE") · 6 empty-state illustrations · drafting the e2e script as flows land.

---

## 6. Cut line (if behind schedule)

Apply in this order and log each cut in §9 ([doc 06 §3](docs/06-Implementation-Plan.md)):

1. **P2:** T5.3 Telegram, T6.4 presenter mode.
2. **P1:** T7.5 audit view → T3.6 profile → T6.3 polish → T6.2 PWA → T2.6 repost → T5.5 insights → T5.4 plans. Plans and insights go last because they sell the business model.
3. **Levers (≈ 25 h total):** pipeline list-only (2) · team presets-only (2) · ~~local-only, no staging (2)~~ *already applied, D-9* · Amharic on 5 hero screens only (3) · toolkit Approve replaces admin UI (8) · Simulate-applicant replaces jobseeker UI (8).

Guardrails in §3 are **never** on the cut list.

---

## 7. Definition of done

**Task:** types compile (strict) · API enforces permissions, with tests · strings exist in EN **and** AM · works at 360/768/1280 · no serious axe violations · its demo-script step passes · Reset returns it to seeded state · *Done when* met ([02 §16](docs/02-TRD.md)).

**Milestone:** every P0 task is done · `main` CI is green · its part of the demo script runs from a fresh reset in **both languages** · zero open defects on the script path ([06 §11](docs/06-Implementation-Plan.md)).

**Bug triage:** *Blocker* (breaks the script or shows wrong data) → fix now · *Major* (visible on the script path) → fix before demo · *Minor* (off-script) → backlog.

---

## 8. Open decisions (from doc 06 §9 / PRD §12)

If a decision isn't made by its deadline, build with the default and mark it *defaulted*.

| # | Decision | Needed by | Default | Status |
|---|---|---|---|---|
| D-1 | Pricing Standard/Pro/Urgent (Q1) | M5 | ETB 1,500 / 3,500 / 300, labelled "Illustrative" | open |
| D-2 | Unchanged-repost moderation (Q2) | M2 | Queue with "fast approve" tag | open |
| D-3 | Poster sees counts (Q3); who can reveal contact (Q4) | M2/M3 | Counts yes; Screener + HR Manager + Owner reveal | open |
| D-4 | Founding-partner quota (Q5) | M2 | 3 free posts | open |
| D-5 | Logo vector source | M0 | Rebuild bell badge as SVG from the PNG | **partly resolved**: icon mark received → [assets/brand/servaddis-icon.svg](assets/brand/servaddis-icon.svg). Wordmark ("Serv" + "አዲስ") still open; default is live text in Inter + Noto Sans Ethiopic next to the icon |
| D-6 | Native Amharic reviewer (2–3 h) | M6 (book for M5 week) | Draft strings, internal use only | open |
| D-7 | Real photography | M6 | Initial avatars + illustrations | open |
| D-8 | Demo hardware | M7 | Own devices | open |
| D-9 | Staging host/domain | M0 | VPS/container with persistent `/data` volume | **decided 2026-10-29**: local only, no paid services. Phone joins over LAN; off-site viewers get a **Cloudflare quick tunnel** link (free, no account). The tunnel URL changes on every run, so set `PUBLIC_BASE_URL` to the current LAN or tunnel URL so card QR codes work. If a permanent link or budget comes later: VPS, or Vercel + Turso + Blob. **Supabase is ruled out** because it would mean Postgres on the laptop |
| D-10 | Telegram channel + bot token | T5.3 | Skip (simulated) | open |

---

## 9. Decision log

| Date | ID | Decision | Why | Docs updated? |
|---|---|---|---|---|
| 2026-10-29 | ADR-01…09 | Architecture as in TRD §14 (Next.js-only backend, SQLite+Prisma, polling, sim adapters, own OTP auth, bilingual columns, demo clock, JSON rules, `next/og` cards) | Confirmed in the spec pack | n/a |
| 2026-10-29 | D-9 | Local-only hosting; Cloudflare quick tunnel for off-site viewers; no Docker or staging for now; Supabase ruled out for later too | Keep it simple and free. Vercel needs Turso + Blob plus code changes, and its free Hobby plan is non-commercial. Supabase needs Postgres on the laptop and its free projects pause when idle. A VPS costs money | Yes: TRD §11 note |
| 2026-10-29 | T0.1 | Pinned (exact, `saveExact: true`): Next.js `16.4.3`, React `19.3.0`, Tailwind `4.3.3`, TypeScript `5.9.3`, shadcn `4.23.0` (Radix base, `radix-nova` preset, lucide), Vitest `5.0.5`, ESLint `9.39.5`, Prettier `3.9.10`. Node 24.19 locally, 22 in CI (`engines >=22`). Prisma is pinned at T0.2 | PLAN §4 versions rule | n/a |
| 2026-10-29 | T0.1 | **Next 16.4 differs from the TRD's assumptions:** (1) *middleware* is now **`proxy`** (`src/proxy.ts`), so T0.4 builds "proxy", not middleware; (2) **Cache Components** and Partial Prefetching are on by default; request-time data (cookies, session, DB reads) must sit behind `<Suspense>` or be marked dynamic; (3) Tailwind runs through `@tailwindcss/turbopack`, not PostCSS; (4) `LayoutProps`/`PageProps` are generated globals, so `typecheck` runs `next typegen` first. Read `node_modules/next/dist/docs/` before each new Next feature (see `AGENTS.md`) | The bundled docs are the source of truth for this version | n/a |
| 2026-10-29 | T0.1 | Token mapping: doc 04 roles that clash with shadcn are renamed. Amber accent → `brand-accent` (shadcn's `accent` stays a subtle navy-50 hover); `--bg`/`--surface` → `background`/`card`. Tailwind's default `gray-*`/`amber-*` are replaced by the brand scales. No dark theme | Avoids amber leaking into every menu hover | n/a |
| 2026-10-29 | T0.1 | shadcn's default button is 32 px tall (`h-8`), below the 40/44 px touch targets (doc 04 §2.4). Fix the sizes when building the shells in T0.6 | Logged so it isn't missed | n/a |
| | | *Pinned Prisma version (fill in at T0.2)* | | |
| | | *TR1 Satori/Amharic spike result (fill in at T5.1)* | | |

---

## 10. Post-demo backlog (park ideas here, don't build them)

- Referral engine (pay on hire + 2-week check-in) and honest gamification ([PRD App. B](docs/01-PRD.md))
- Real SMS short-code, Telegram bot, jobseeker alerts
- Guided no-CV profile builder, near-me search
- Kiosk/assisted onboarding for field reps
- Real Fayda, Chapa, Meta/TikTok integrations
- Median (instead of average) time-to-fill; Ethiopian-calendar dates
- Afaan Oromo / Sidaamu Afoo locales
- Fix the proposal inconsistencies D1–D10 ([PRD §13](docs/01-PRD.md)) before sending anything to the client

---

## 11. Change log

| Date | Change |
|---|---|
| 2026-10-29 | Plan created from spec pack v0.1 (docs 01–06 saved to `/docs`) |
| 2026-10-29 | Logo icon mark added at `assets/brand/servaddis-icon.svg`; D-5 partly resolved |
| 2026-10-29 | D-9 decided: local-only hosting. T0.8 cut from 3 h to 1 h; budget now P0 150 h. TRD §11 annotated |
| 2026-10-29 | T0.1 done: Next 16.4.3 scaffold, brand tokens (`src/styles/tokens.css` + `globals.css`), shadcn/ui, Prettier/ESLint/Vitest, CI workflow, `.env.example`, logo as favicon. `pnpm run check` green; `pnpm dev` serves `/` |

---

## Quick reference

| | |
|---|---|
| Demo OTP | `123456` (`DEMO_MODE=1`) |
| Owner — Selam (Hiwot Garden Hotel) | `+251911000001` |
| Poster — Yared | `+251911000002` |
| Screener — Rahel | `+251911000003` |
| HR Manager — Meseret | `+251911000004` |
| New café owner — Bruk (created live) | `+251911000011` |
| Jobseeker — Dawit | `+251922000001` |
| Moderator | `+251911000009` |
| Commands (now) | `pnpm dev` · `pnpm run check` (lint → typecheck → format → test → build, same as CI) · `pnpm format` · `pnpm test` |
| Commands (later) | `pnpm seed` (T0.3) · `pnpm demo` (T0.8) · `pnpm e2e` (T7.2) |
| Env vars | [02 §10](docs/02-TRD.md) |
