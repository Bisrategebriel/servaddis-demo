# Servaddis Demo — Product Requirements Document (PRD)

| | |
|---|---|
| **Document** | 01 of 6 — Demo Specification Pack |
| **Product** | Servaddis — Ethiopia's Hospitality Hiring Platform (high-level demo build) |
| **Version** | 0.1 (draft for review) · 29 Oct 2026 |
| **Author** | Prepared for Bisrategebriel Fisseha |
| **Sources** | Technical & Financial Proposal v2.0 (20 Sep 2026) · Business Plan (14 Sep 2026) · logo |
| **Companion docs** | 02 TRD · 03 App Flow · 04 UX/UI Design Brief · 05 Backend Schema · 06 Implementation Plan |

---

## 1. Purpose of this document

This PRD defines what the **Servaddis demo** must do, for whom, and how we will know it worked. The demo is **not** the MVP described in the proposal. It is a believable, clickable, data-backed slice of the product, built to be shown live to potential **partners** (hotel groups, associations, training institutes, investors) and potential **employers** (hotel HR, restaurant owners).

It deliberately goes deep on the **employer side** — the side that pays — and keeps the jobseeker and admin sides just thick enough to prove the hiring loop is real.

## 2. Product context (from the source documents)

- Servaddis is a **hospitality-only job board** for Addis Ababa first, then the tourism corridor (Bahir Dar, Hawassa, Adama, Lalibela, Gondar).
- It is **a job board, not a staffing agency**: no placement, no guarantee, no placement fee at launch.
- Core loop to prove: *employer posts a structured role → qualified workers apply with one tap → a hire happens → both sides return.*
- Principles: PWA-first and low-bandwidth, Amharic-first with English equal, trust is the product (verification + 100 % pre-publication moderation), meet users where they are (Telegram, SMS, social).
- Primary revenue: employer subscriptions; secondary: one-time urgent posts, jobseeker SMS alerts, training-institute partnerships.
- The closest competitor named in the Business Plan is **JOBS_ADDIS**, a hospitality Telegram bot with 57,000+ subscribers. The demo must make the difference visible within the first two minutes (see §9).

## 3. Demo objectives

| # | Objective | How the demo proves it |
|---|---|---|
| O1 | Show that posting a hospitality job is **fast and structured** | A new employer goes from sign-in to a published, bilingual job in **under 3 minutes** using a role template |
| O2 | Show that **trust is built in**, not bolted on | License verification gate, rules-based scam flags, 100 % moderation, verified-first candidate ordering, gated contact reveal |
| O3 | Show that employers get a **hiring workflow**, not a message inbox | Applicant pipeline (Applied → Viewed → Shortlisted → Hired/Rejected) with live arrival of applicants |
| O4 | Show that **hotels with real HR teams** are catered for | Staff roles: a poster who cannot shortlist, a screener who cannot post, an owner who controls billing |
| O5 | Show **reach beyond the platform** | "Promote to socials" generates a branded bilingual card and per-channel previews in one click |
| O6 | Show a **credible business model** | Plans, urgent one-time post, checkout, receipt, and an insights view employers would renew for |
| O7 | Look and feel like a **real, local, bilingual** product | Amharic/English toggle, Addis sub-cities, ETB pricing, navy/amber brand |

## 4. Audience and success criteria

### 4.1 Who watches the demo

| Audience | What they need to believe | What they will ask |
|---|---|---|
| **Hotel / restaurant decision-makers** | "My HR team can use this tomorrow and it will save us time." | Can my HR staff and my GM have different access? Is it safe from fake jobs? What does it cost? |
| **Industry associations, training institutes / TVET** | "This is a credible channel for our members/graduates." | How do graduates get verified? How is quality controlled? |
| **Investors / strategic partners** | "The product is real, the wedge is defensible, the revenue path is clear." | How is this different from Telegram channels and Ethiojobs? How do you make money? What is built vs. simulated? |

### 4.2 Demo success criteria

| ID | Criterion | Target |
|---|---|---|
| S1 | Full walkthrough (script in doc 03 §9) completes without a manual database edit | 100 % of rehearsals |
| S2 | Sign-in → published job for a new venue (excluding admin wait) | ≤ 3 min on stage |
| S3 | Applicant appears on employer screen after jobseeker taps Apply | ≤ 5 s |
| S4 | Every employer and jobseeker screen works in both languages | 100 % of P0 screens |
| S5 | Jobseeker feed and detail on throttled "Fast 3G", mid-range Android | First contentful paint ≤ 3.5 s (production target applied to the demo's jobseeker routes) |
| S6 | Presenter can reset the demo to a clean seeded state | ≤ 10 s, one click |
| S7 | Audience can state the difference vs. a Telegram channel after the demo | Qualitative: ask 3 viewers in rehearsal |

## 5. Users and personas

| Persona | Role in demo | Description |
|---|---|---|
| **Selam Getachew** — Hotel GM / account **Owner** | Primary demo user | Runs a 60-room hotel; wants quality hires fast, controls budget and staff access. Phone `+251911000001`. |
| **Yared Alemu** — HR officer, role **Poster** | RBAC example | Writes and submits job posts; must not see applicant decisions. Phone `+251911000002`. |
| **Rahel Mekonnen** — HR manager, role **Screener** | RBAC example | Reviews applicants, shortlists and rejects; cannot create posts. Phone `+251911000003`. |
| **Bruk Tilahun** — Café owner (new venue) | Onboarding example | Single-venue café owner; registers from scratch in the demo. Phone entered live. |
| **Dawit Alemu** — Waiter, 24 | Jobseeker | Low-end Android, Amharic-first, applies with one tap. Phone `+251922000001`. |
| **Servaddis moderator** | Admin | Reviews licenses and posts against scam rules. Phone `+251911000009`. |

> All people, venues and phone numbers in the demo are **fictional**. Before external showings, confirm no seeded venue name collides with a real Addis business.

## 6. Scope

### 6.1 Priority legend

**P0** — the demo is not credible without it · **P1** — strong enhancer, build if P0 is on track · **P2** — stretch / cut first

### 6.2 In scope — functional requirements

Proposal references (EM-xx, JS-xx, PAY-xx, §) point to the Technical & Financial Proposal v2.0.

#### Employer experience (primary focus)

| ID | Requirement | Pri | Proposal ref |
|---|---|---|---|
| E-01 | Phone + OTP sign-in and registration (OTP simulated; fixed code in demo mode) | P0 | §4.7 Employer step 1 |
| E-02 | Venue profile: name (EN/AM), category, sub-city, contact phone, short description | P0 | §4.7 steps 1, 3 |
| E-03 | Business-license upload (PDF/JPG/PNG, ≤ 5 MB) with progress and a "Pending verification" state | P0 | EM-01 |
| E-04 | **Verification gate:** employer can build drafts, but cannot submit a post for publication until the venue is Verified | P0 | EM-01 |
| E-05 | Onboarding checklist on the dashboard (Register → License → Venue profile → First post) with progress | P0 | §4.7 |
| E-06 | Role-template picker covering the hospitality taxonomy (12 roles incl. tour guide, spa, hospitality manager) | P0 | EM-02, EM-03 |
| E-07 | Structured job composer: headcount, employment type, **mandatory salary range**, shift pattern, requirements, benefits, sub-city, urgency (Normal / Half-day / Same-day / Next-day / Two-day) | P0 | EM-02, §2.2 |
| E-08 | **Bilingual preview** (Amharic/English toggle, phone-card and desktop view) before submitting | P0 | EM-04 |
| E-09 | **Rules check on submit**: fee-request language, blocked keywords, missing salary, suspicious contact info; inline flags the employer can fix | P0 | §4.3 |
| E-10 | Submit for moderation; job status chips (Draft, In review, Changes requested, Live, Expired, Closed, Rejected); notification on decision | P0 | §4.3, §4.9 |
| E-11 | 30-day post duration with expiry banner at T-3 days and **one-tap repost** | P1 | EM-05 |
| E-12 | **Applicant pipeline** per job: list/board view, profile cards, verified candidates first, sort by completeness or experience | P0 | EM-10 |
| E-13 | Shortlist, reject (with canned reasons), mark hired; hire count closes the job when headcount is met | P0 | EM-11 |
| E-14 | **Contact reveal gated behind shortlisting**; masked number before, logged reveal after | P0 | EM-12 |
| E-15 | "Promote to socials" toggle → branded bilingual card render → per-channel previews (Telegram, Facebook, Instagram, TikTok-draft) → simulated publish log | P0 | EM-13, §4.6 |
| E-16 | Plans page and **simulated checkout** (Chapa-style hosted page) for Standard/Pro subscriptions and a one-time urgent post; receipt with 15 % VAT | P1 | PAY-01, 02, 04, 05 |
| E-17 | **Team & permissions**: Owner invites staff by phone, assigns a role preset, toggles individual permissions; enforced server-side and reflected in the UI | P0 | Open Q1 |
| E-18 | **Insights**: time-to-fill, applicants per job, applicant-quality trend, funnel (applied → shortlisted → hired) | P1 | §4.9 |
| E-19 | Live applicant arrival (≤ 5 s) with toast and unread badge | P0 | — (demo effect) |
| E-20 | Optional "Verify with Fayda" badge for the owner (simulated) | P2 | §4.3 |

#### Jobseeker experience (minimal, mobile-first)

| ID | Requirement | Pri | Proposal ref |
|---|---|---|---|
| J-01 | Jobs feed with filters: role, sub-city, employment type, salary range; urgent jobs pinned with a badge | P0 | JS-10 |
| J-02 | Job detail with venue name, **Verified venue** badge, salary, shift, requirements, bilingual content | P0 | — |
| J-03 | **One-tap apply** with optional short note (sign-in via OTP if needed) | P0 | JS-11 |
| J-04 | Application status tracker: Applied → Viewed → Shortlisted → Hired / Rejected, with timestamps | P0 | JS-12 |
| J-05 | Read-mostly profile with skill tags, languages, experience and completeness meter | P1 | JS-02, JS-06 |
| J-06 | Report-job action feeding the admin queue | P2 | JS-14 |

#### Admin / moderation (minimal)

| ID | Requirement | Pri | Proposal ref |
|---|---|---|---|
| A-01 | Moderation queue with tabs: Licenses, Job posts; age, venue, rule-flag count; "unchanged repost" fast-approve tag | P0 | §4.9 |
| A-02 | Review screen: document viewer or full job preview, rule flags, **Approve / Request changes / Reject** with reason | P0 | §4.3 |
| A-03 | Decisions propagate: venue badge, job goes Live, in-app notification and simulated SMS to the employer | P0 | — |
| A-04 | Audit log view (who approved what, who revealed which contact) | P1 | §9 |
| A-05 | Basic counts page (venues, live jobs, applications) | P2 | §4.9 |

#### Cross-cutting

| ID | Requirement | Pri | Proposal ref |
|---|---|---|---|
| X-01 | **Amharic/English toggle**, persistent per user, on every P0 screen and notification; Ethiopic font and line-height handled | P0 | JS-04, §2.1 |
| X-02 | **Role-based access control** enforced in the API (not only hidden in the UI) | P0 | Open Q1 |
| X-03 | **Demo Toolkit** (presenter-only): persona switcher, reset to seed, "simulate applicant", "time-skip" (expiry, 2-week check-in), simulated-SMS phone drawer, show/hide "Simulated" tags | P0 | — |
| X-04 | Installable PWA (manifest, icons, offline shell with friendly offline page) | P1 | §3.1 |
| X-05 | Notification bell (in-app) and simulated SMS log | P1 | §4.5 |
| X-06 | Responsive: employer screens desktop-first but fully usable at 390 px; jobseeker screens mobile-first at 360 px | P0 | §5 |

### 6.3 Out of scope for the demo

| Item | Why | Handling in the demo |
|---|---|---|
| Real SMS/USSD short-code, keyword subscription, carrier billing | Needs telco approval and costs; not needed to prove the employer loop | Simulated SMS log drawer; slide in the pitch |
| Real Fayda integration | Requires government onboarding | "Verify with Fayda" is a simulated flow with a fake ID; no real FIN is ever entered or stored |
| Real payment gateway (Chapa/Telebirr/CBE Birr) | Merchant onboarding by client | Chapa-styled simulated checkout, clearly labelled "Simulated" |
| Real Facebook/Instagram/TikTok publishing | App review: Meta verification, TikTok audit (2–6 weeks) | Card render is real; publish is simulated. **Optional stretch:** real Telegram post to a demo channel |
| Reliability rating algorithm and placement check-ins | Needs real placement data | Seeded values shown; check-in rows exist but only the 2-week trigger is demoable via time-skip |
| Jobseeker guided no-CV profile builder, near-me search, Telegram bot, alerts | Jobseeker side is minimal by decision | Seeded jobseeker profiles; described in the pitch |
| Assisted/kiosk onboarding for field reps | Not part of the employer loop | Slide in the pitch |
| Referral engine and gamification | Not selected for this demo; spec still open in the proposal | See Appendix B for a recommendation |
| Multi-city operation | Launch is Addis only | City is a first-class field; other cities are seeded but disabled |
| Afaan Oromo / Sidaamu Afoo | Phase 2 | i18n framework is ready for extra locales |
| Native mobile app | Fast-follow, not launch | PWA install only |

## 7. Key user stories and acceptance criteria (P0 employer flows)

**Story 1 — Register and get verified (E-01…E-05)**
*As a café owner, I want to register my venue and upload my license, so that I can post jobs on a platform I can trust.*

- **Given** I enter a valid Ethiopian mobile number, **when** I submit the OTP, **then** I land on venue setup (new user) or my dashboard (existing user).
- **Given** I upload a PDF/JPG/PNG up to 5 MB, **when** the upload completes, **then** the venue shows *Pending verification* and the checklist advances.
- **Given** my venue is *Pending*, **when** I try to submit a job, **then** I can save drafts but the submit button explains why it is locked.
- **Given** the admin approves my license, **when** I next open the app, **then** my venue shows a *Verified* badge and I receive a notification (and a simulated SMS).

**Story 2 — Post a job in minutes (E-06…E-10)**
*As a hiring manager, I want to start from a role template, so that a complete post takes minutes.*

- **Given** I pick the *Waiter/Waitress* template, **then** the composer pre-fills requirements, benefits, shift pattern and a suggested salary range which I can edit.
- **Given** I leave the salary range empty, **when** I continue, **then** I cannot proceed and the error appears in my current language.
- **Given** my description contains a fee request ("registration fee", "send money"), **when** I submit, **then** the rules check blocks submission and explains which phrase and why.
- **Given** the post passes the rules check, **when** I submit, **then** the status becomes *In review* and the admin queue shows it within 5 s.
- **Given** the admin approves, **then** the job is *Live*, has a 30-day expiry (or the urgency deadline), and appears in the jobseeker feed.

**Story 3 — Work the applicant pipeline (E-12…E-14, E-19)**
*As a screener, I want to move applicants through stages, so that I can reach interviews quickly.*

- **Given** a jobseeker applies, **then** within 5 s a toast and an unread badge appear on the job.
- **Given** I open an applicant, **then** their status becomes *Viewed* and the jobseeker's tracker updates.
- **Given** an applicant is *Applied/Viewed*, **then** the phone number is masked and "Reveal contact" is disabled with the tooltip "Shortlist first".
- **Given** I shortlist and then reveal contact, **then** the number is shown and the reveal is written to the audit log with my name and time.
- **Given** headcount is 2 and I mark the second hire, **then** the job closes automatically and *time-to-fill* is recorded.

**Story 4 — Control who can do what (E-17, X-02)**
*As an owner, I want my HR staff to have different access, so that postings and hiring decisions are separated.*

- **Given** I invite Yared as *Poster*, **then** he can create and submit jobs, but **cannot** open the applicant list; calling the applicants API as him returns *403*.
- **Given** I invite Rahel as *Screener*, **then** she can shortlist and reject, but the *New job* button is hidden and the create-job API returns *403*.
- **Given** I toggle an individual permission for a member, **then** the change applies on their next request and appears in the audit log.
- **Given** I am the only Owner, **when** I try to remove or downgrade myself, **then** the action is blocked.

**Story 5 — Reach more candidates (E-15)**
*As an owner, I want one click to advertise a role, so that I reach candidates beyond the app.*

- **Given** a job is Live and I turn on *Promote to socials*, **then** a branded card (image) renders in under 5 s with the job title, venue, salary band, sub-city and QR/deep link.
- **Given** the card renders, **then** I see per-channel previews with bilingual caption and hashtags, and a publish log with statuses; TikTok shows *Draft for team to finish with trending sound*.
- **Given** the demo runs in simulation mode, **then** every status carries a visible *Simulated* tag unless the presenter hides tags.

**Story 6 — Apply in one tap (J-01…J-04)**
*As a waiter, I want to apply in one tap, so that I do not need a CV.*

- **Given** I am signed in with a seeded profile, **when** I tap *Apply*, **then** the application is created once (duplicate taps are idempotent) and the tracker shows *Applied*.
- **Given** the employer shortlists me, **then** my tracker shows *Shortlisted* within one refresh or 5 s.

## 8. Real vs. simulated (honesty table for the room)

Show this on a closing slide or have the answer ready. Over-claiming in front of partners is a bigger risk than under-claiming.

| Capability | In the demo | In production |
|---|---|---|
| Data, workflow, roles and permissions | **Real** (persisted, enforced) | Same logic, Laravel/MySQL |
| Bilingual content and toggle | **Real** | Same, plus native-speaker verification |
| Card render for socials | **Real** image generation | Same, plus short video render |
| Publishing to Facebook/Instagram/TikTok | Simulated | Via scheduling API after platform approval |
| Telegram post | Simulated (optional real stretch) | Real bot + channel |
| OTP, SMS alerts, check-ins | Simulated (SMS log drawer) | Local aggregator + short code |
| Payments | Simulated checkout | Chapa (+ manual bank transfer) |
| Fayda verification | Simulated | Real integration |
| License review | Real human-in-the-loop (admin screen) | Same |
| Scam rules | Real rules on text | Same, tuned with pilot data |

## 9. Demo narrative (summary — full script in doc 03 §9)

Target length: **9–10 minutes**. Open with the problem, not the product.

1. **The gap (60 s)** — "Telegram channels broadcast. Hotels need a *hiring workflow*." Show a JOBS_ADDIS-style unstructured post next to a Servaddis structured post.
2. **Onboard a new venue (2 min)** — Bruk registers, uploads license; admin approves in a second window.
3. **Post a job (2 min)** — template → composer → bilingual preview → rules check catches a "registration fee" line → fix → submit → approve.
4. **Applicants arrive (2 min)** — second phone (jobseeker) applies live; pipeline updates; shortlist; contact reveal gate; hire.
5. **Team controls (1 min)** — switch to Poster and Screener personas to show different capabilities.
6. **Promote and pay (1 min)** — card render and previews; plans and checkout.
7. **Insights and close (1 min)** — time-to-fill, funnel; real-vs-simulated slide; ask.

**Differentiators to land (versus a Telegram channel or general portal):** structured and moderated posts; verified venues and verified-first candidates; a real pipeline with gated contact; staff permissions; analytics for renewal; multi-channel distribution from one action; bilingual by default.

## 10. Non-functional requirements (demo-level)

| Area | Requirement |
|---|---|
| Performance | Jobseeker routes: FCP ≤ 3.5 s on throttled 3G; core JS budget ≤ 200 KB gzipped. Employer routes: interactive ≤ 2.5 s on broadband laptop. |
| Reliability | Demo must work **offline-capable at the venue**: runnable locally on the presenter's laptop with one command, in addition to the hosted URL. |
| Data | Seed + reset in ≤ 10 s. No real personal data. All identities fictional. |
| Security (demo-appropriate) | Server-side authorization on every mutating endpoint; upload validation (type, size, filename); signed httpOnly session cookie; rate-limited OTP; no secrets in the client. A visible "Demo environment" ribbon. |
| Accessibility | WCAG 2.1 AA colour contrast for text (see doc 04 for the palette audit); keyboard-operable forms; touch targets ≥ 44 px on jobseeker screens. |
| Localization | All strings externalized; EN/AM at launch; locale infrastructure supports adding `om` and `sid`. |
| Browser support | Latest Chrome/Edge/Safari; Android Chrome/WebView on 2 GB-RAM class devices for jobseeker routes. |
| Legal/brand | Logo used as provided; supply a vector (SVG) logo — the attached one is 102×81 px and will blur on projectors. |

## 11. Risks and mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Venue Wi-Fi fails during a partner demo | Medium | High | Local run mode (`npm run demo`), pre-recorded 3-minute fallback video, mobile hotspot |
| R2 | Partners assume simulated features are real | Medium | High | "Simulated" tags, §8 table, presenter script wording |
| R3 | Amharic rendering/typography defects (tofu, clipped line-height) | Medium | Medium | Bundle Noto Sans Ethiopic; test on Android; native-speaker review of all strings (my Amharic copy in doc 04 is a draft) |
| R4 | Scope creep from the "gamify" and "referral" questions in the proposal | High | Medium | Explicitly out of scope; Appendix B holds the recommendation; revisit after demo feedback |
| R5 | Over-building: demo code becomes accidental production code | Medium | Medium | Treat the demo as disposable; carry forward schema, taxonomy, copy and UI components, not the stack (doc 02 §17) |
| R6 | Seeded venue/people names collide with real businesses | Low | Medium | Use fictional names; do a quick web check before external sessions |
| R7 | Live "applicant arrival" fails (polling/network) | Low | High | Demo Toolkit "Simulate applicant" button as a deterministic fallback |
| R8 | Time to build exceeds availability | Medium | Medium | Cut line defined in doc 06 §3 (P2, then P1); each phase leaves a demoable build |

## 12. Open questions

| # | Question | Needed by | Demo default if unanswered |
|---|---|---|---|
| Q1 | Final subscription tiers and prices | Before external demo | Illustrative placeholders: Urgent post ETB 300; Standard ETB 1,500/mo (5 live jobs); Pro ETB 3,500/mo (unlimited, socials). **Not from your documents — replace.** |
| Q2 | Does an *unchanged repost* still need full moderation? (Proposal says 100 % pre-publication.) | Build start | Goes to queue tagged "Unchanged repost — fast approve" |
| Q3 | Can a Poster see applicant **counts** (not identities)? | Build start | Yes — counts only, no applicant list |
| Q4 | Who can reveal contact — Screener or HR Manager only? | Build start | Screener and HR Manager; revealed contact is audit-logged |
| Q5 | Founding-partner free postings: how many, and for how long? (Business plan: free/discounted first postings for first 50 employers.) | Before external demo | 3 free posts per founding venue |
| Q6 | Demo logo and brand assets: vector files available? | Design start | Rebuild bell mark as SVG from the supplied PNG |

## 13. Traceability and source-document issues

While reading the proposal and business plan I found the inconsistencies below. None block the demo, but several will be noticed by a careful partner or client, so they are worth fixing in the source documents.

| # | Finding | Where | Demo decision |
|---|---|---|---|
| D1 | **Payment schedule totals do not match the total investment.** The four instalments (276,900 + 276,900 + 276,900 + 92,300) sum to **ETB 923,000**, which is the fee *before* VAT. The proposal's total is **ETB 1,061,450** including 15 % VAT. Either label the schedule "excl. VAT" or add VAT to each instalment (30 % of 1,061,450 = 318,435). | Proposal §11.1 vs §11.2 | n/a — fix in proposal |
| D2 | Executive Summary table shows "Professional Fees (net of VAT): ETB" with **no figure** | Proposal §1 | n/a — fix in proposal (ETB 923,000) |
| D3 | **Placement fee conflict.** Business Plan §4.2 still lists a "verified-candidate placement fee"; the proposal deliberately excludes it for licensing reasons | BP §4.2 vs Proposal §2.2, §9 | Demo shows **no** placement fee |
| D4 | **Payment rails inconsistent.** §3.2 lists Telebirr, CBE Birr and Chapa; PAY-04 lists Chapa + bank transfer; Deliverables list Chapa only | Proposal §3.2, §4.4, §10 | Demo: Chapa-style checkout + bank-transfer option |
| D5 | **Registration method inconsistent.** JS-01 says Fayda registration; employer onboarding and the Business Plan use phone + OTP; the plan's drives sign up "by phone number" | Proposal §4.1, §4.7; BP §8.2 | Demo: phone + OTP primary; Fayda as optional verification badge |
| D6 | Requirement numbering has gaps (JS-05, JS-07–09; EM-06–09 not defined) and the Exclusions mention a "Section 12.2 add-on" and PAY-05 an "add-on", but no add-on section exists | Proposal §4, §12 | Demo uses only defined IDs |
| D7 | Referral engine is "to be discussed"; Business Plan §5.3 says the bonus is paid when the referred friend **gets hired** | Proposal §4.8; BP §5.3 | Out of scope; see Appendix B |
| D8 | Business Plan §7 "Onboarding Process" body is just "On app"; the proposal §4.7 fills this in | BP §7 | Demo follows proposal §4.7 |
| D9 | Business Plan has stray placeholders (`[C:\Users\...\bell.JPG]`, "Telegram/Telegram", "WhatsApp/Telegram" in the tracker legend, empty sub-bullet under campus activation) | BP §3.4, §5.2, §5.3, §8.3 | n/a — clean up before sharing |
| D10 | The proposal's urgency definition (half-day, same-day, next-day, two-day) is only in the revenue paragraph; there is no functional requirement for it | Proposal §2.2 | Demo implements it as E-07 `urgency` |

## Appendix A — Requirement-to-document map

| Area | Where it is specified |
|---|---|
| Screens, routes, flows, state machines, demo script | 03 App Flow |
| Architecture, API, adapters, security, deployment | 02 TRD |
| Tables, enums, permissions matrix, seed data | 05 Backend Schema |
| Visual design, components, wireframes, microcopy | 04 UX/UI Design Brief |
| Phases, tasks, estimates, cut line, rehearsal checklist | 06 Implementation Plan |

## Appendix B — Recommendation on the open "referral" and "gamification" questions (not built in this demo)

You asked in the proposal what the ideal referral scheme is, and whether it should pay on sign-up or on hire. My recommendation, for discussion:

- **Pay on hire, not on sign-up.** Sign-up bounties attract fake accounts and multi-account abuse, and in a market with cheap SIMs they are easy to farm. Paying when the referred person is *hired and passes the 2-week check-in* ties the cost to the outcome that earns revenue, and the Business Plan (§5.3) already describes it this way.
- **Cap and stage it:** small token on verified sign-up (e.g. airtime), main bonus on hire + 2-week check-in, cap per referrer per month, and self-referral/duplicate-device checks.
- **Employers can refer too:** "refer two venues" after a successful hire (Business Plan §8.1, Action 7) as subscription-credit rather than cash.
- **Gamification, kept honest:** use progress mechanics that reinforce trust and quality (profile completeness, response-time badges for employers, "verified" milestones, hiring streaks) rather than points or leaderboards that could reward spam applications.
- Both fit as post-demo additions: `Referral` and `Badge` tables would sit alongside the schema in doc 05 with no changes to existing tables.
