# Servaddis demo — presenter runbook

**For:** whoever presents the demo. **Use with:** the script in [03-App-Flow §9](03-App-Flow.md) (what to say) and the checklist in [06-Implementation-Plan §8](06-Implementation-Plan.md). This page is the hands-on part: what to run, what to click, and what to do when something goes wrong.

---

## 1. Setup

| What | How |
|---|---|
| Start the demo | `pnpm demo` (fresh data, builds, starts). Restart quickly with `pnpm demo --skip-build`. Off-site audience: `pnpm demo --tunnel` and give viewers the printed link, never the toolkit code |
| Laptop windows | Two browser windows side by side at ≥ 1280 px each: **Employer** (left) and **Admin** (right). Clean profile, zoom 100 %, notifications off |
| Phone | The jobseeker. Same Wi-Fi or hotspot as the laptop; open the **LAN address** `pnpm demo` prints. No phone: a 390 px-wide browser window works the same |
| Toolkit | The wrench button, bottom-right on the laptop (right edge on phones). Turn on **Presenter mode** in both laptop windows for a projector: larger text, stronger contrast, secondary tools folded under *More tools* |
| Sign-in code | Always `123456` (shown on the sign-in screen in demo mode) |
| Language | The **አማ \| EN** toggle in the top bar. Signing in or switching persona applies that person's own language (Dawit Amharic, Selam English): tap the toggle again if you are presenting in one language |

**People** (all fictional):

| Who | Phone | Use in the script |
|---|---|---|
| Bruk — new café owner | 0911000011 | Rows 1–9 (registers live) |
| Selam — Owner, Hiwot Garden Hotel | 0911000001 | Rows 10, 13, 15 |
| Yared — Poster | 0911000002 | Row 11 |
| Rahel — Screener | 0911000003 | Row 12 |
| Henock — Owner, Piassa Terrace (Standard plan) | 0911000005 | Row 14 (not in the persona switcher: sign in with the number) |
| Dawit — jobseeker | 0922000001 | Row 8, on the phone |
| Moderator | 0911000009 | Admin window throughout |

## 2. The hour before

1. `pnpm demo` on the presenter laptop. Wait for the addresses.
2. Toolkit → **Reset demo**. The toolkit shows the seed version; *Demo data is out of date* means reset again.
3. Admin window: toolkit → **Moderator**. Employer window: open `/` (landing), signed out.
4. Phone: open the LAN address, check Amharic renders, set screen timeout to 10 min, battery > 50 %.
5. Open the fallback recording (§5) in a background tab.
6. Do Not Disturb on; close chat apps.

Do **not** click through the script after the reset: it would use up the live moments (Bruk's registration, the first applicant). If you want a warm-up, run it, then **Reset** again.

## 3. The script, hands-on

Rows follow 03-App-Flow §9. **If it fails** lists the quickest way back on track; every toolkit action drives the real system, so notifications, toasts and texts still happen.

| # | Window | Do | You should see | If it fails |
|---|---|---|---|---|
| 1 | Employer | Landing → **I'm hiring** → 0911000011 → code | Venue setup | Toolkit → **Bruk** |
| 2 | Employer | Switch to Amharic; *Bole Sunrise Café*, Café, Bole → **Save and continue** | License upload | — |
| 3 | Employer | Upload `public/samples/license-sample.pdf` → **Go to dashboard** | *Pending verification*, checklist 3 of 4 | — |
| 4 | Admin | Queue → *Bole Sunrise Café* → **Approve** | Employer: **Verified** badge and bell within 5 s, no reload | Toolkit → **Approve all pending**, or **Skip to state: Venue verified** |
| 5 | Employer | **Post your first job** → Barista → adjust salary → Preview → **አማ** | Bilingual preview | — |
| 6 | Employer | Basics → add "registration fee ETB 200" to the description → Preview | Red flag quoting the phrase; Submit disabled. **Fix this** → remove → **Submit** → *In review* | — |
| 7 | Admin | Queue → Jobs → the Barista job → **Approve** | Job **Live**; appears on the phone's feed | **Approve all pending**, or **Skip to state: Job live** |
| 8 | Phone | Feed → Barista (Bole Sunrise Café) → **Sign in to apply** → 0922000001 → code → **Apply** | Employer: *New applicant* toast within 5 s | Toolkit → **Simulate applicant** (Dawit applies to the job on screen) |
| 9 | Employer | Applicants → Dawit (→ *Viewed*) → *Reveal contact* is disabled → **Shortlist** → **Reveal contact** → **Mark hired** | Job closes as filled; phone tracker shows *Hired*; time-to-fill on the job page | **Skip to state: Applicants present** or **Job hired** |
| 10 | Employer | Toolkit → **Selam** → Team | Yared = Poster, Rahel = Screener; toggle one permission → Save | — |
| 11 | Employer | Toolkit → **Yared** → Jobs, then a job's applicants, then Plans | Jobs yes; applicants and plans show the *no access* page with who can help | — |
| 12 | Employer | Toolkit → **Rahel** → Jobs → applicants | Applicants yes; no *Post a job* | — |
| 13 | Employer | Toolkit → **Selam** → Front Desk Agent → **Promote** → **Promote to socials** | Card renders; four channels fill in, each tagged *Simulated* | — |
| 14 | Employer | Sign out → sign in 0911000005 (Henock) → Plans → **Switch to Pro** → **Pay** | Receipt: VAT ETB 525, total ETB 4,025; Promote unlocked on his jobs | On the checkout page **Simulate failure** shows the error path, then try again |
| 15 | Employer | Toolkit → **Selam** → Insights | Time-to-fill trend and funnel | — |

## 4. When something goes wrong

| Problem | Do this |
|---|---|
| Venue Wi-Fi down | Nothing changes: `pnpm demo` runs fully offline. Put laptop and phone on the phone's hotspot and open the new LAN address |
| Phone can't connect | Use a 390 px browser window as the phone, or toolkit → **Simulate applicant** for row 8 |
| Admin window misbehaves | Toolkit → **Approve all pending** |
| Lost the thread / wrong state | Toolkit → **Skip to state…** for the next row's starting point (signs you in as Bruk) |
| Someone else clicked around | Toolkit → **Reset demo** (≤ 10 s), then **Skip to state…** to where you were |
| A screen errors | **Try again** on the error panel; if it persists, Reset |
| Expiry or check-in question | Toolkit → demo clock **+1 d / +14 d** (urgent jobs expire; the 2-week check-in texts go out) |
| "Did that really send an SMS?" | Toolkit → **Phone (SMS)**: every text the simulated gateway would have sent |
| "Is this real?" | Point at the *Simulated* tags (SMS, payment, social posts); Admin → **Audit log** shows every sensitive action with who and when |
| Total failure | Play the fallback recording (§5) and narrate it; offer a follow-up session |

*Under the hood* (TRD §13, a live server-event panel in the toolkit) was not built; the audit log and the Simulated tags cover the same question.

## 5. Rehearsing and the fallback recording

| Command | What it does |
|---|---|
| `pnpm rehearse` | Builds once, then runs the whole script automatically **three times in a row**, English and Amharic, each from a fresh seed, on its own database and port (safe next to `pnpm demo` or `pnpm dev`). Stops at the first failure |
| `pnpm rehearse --runs 5` | More consecutive runs |
| `pnpm rehearse --record` | One run at a human pace in presenter mode, recording each window. Prints the path of a page (`rehearsals/<date>/index.html`) that plays Employer, Admin and Phone side by side, in English or Amharic. Works offline; copy the folder to a USB stick |

The automated runs prove the build; they don't replace rehearsing with people. Before the demo, also do **three human rehearsals** (at least one in Amharic if anyone in the audience prefers it) and record them here:

| Date | Language | Presenter | Clean? | Notes / fixes |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

A narrated screen recording of a human run makes a better fallback than the automated one; keep both.

## 6. Still to do before showing it outside the team

- Native Amharic review of `docs/amharic-review.csv` (`pnpm amharic:review` regenerates it).
- The vector wordmark (decision D-5); the current one is live text.
- A pass on a real mid-range Android phone (throttled tests pass; nothing replaces a real device).
- `pnpm demo` once with the laptop in airplane mode.
