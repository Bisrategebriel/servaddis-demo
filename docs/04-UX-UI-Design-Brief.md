# Servaddis Demo — UX/UI Design Brief

| | |
|---|---|
| **Document** | 04 of 6 — Demo Specification Pack |
| **Version** | 0.1 (draft for review) · 29 Oct 2026 |
| **Depends on** | 01 PRD · 03 App Flow (screen IDs) |
| **Brand source** | Business Plan §3 (navy `#16243F`, amber `#D9A441`, bell mark, "Servአዲስ" wordmark) · supplied logo PNG (colours sampled and confirmed) |
| **Stack** | Tailwind CSS tokens + shadcn/ui (see TRD §3) |

---

## 1. Design intent

Servaddis must feel like **a modern, trustworthy, local city-tech product** (Business Plan §3.4) — not a government job board and not a generic SaaS template. In a demo, the design has three jobs:

1. **Make the employer flow feel fast and easy** — a post in minutes, a pipeline you understand at a glance.
2. **Make trust visible** — verified badges, moderation states, masked contacts, audit trails, clear "why can't I do this" messages.
3. **Make bilingual feel native** — Amharic is first-class in layout, type and copy, not a translated afterthought.

### Principles

| Principle | In practice |
|---|---|
| **Specialist, not generic** | Role templates, hospitality iconography, shift and urgency as first-class UI (never a bare "Post a job" form) |
| **Trust is the product** | Verified/under-review states always visible; every restriction explains itself and names who can unblock it |
| **Low-end friendly** | High contrast, large touch targets, minimal imagery, no heavy animation on jobseeker screens |
| **Calm confidence** | Navy does the work; amber is a highlight, not a field colour; generous whitespace; short copy |
| **Demo-legible** | Readable from the back of a room: larger base size in Presenter mode, strong contrast, clear state changes (toasts, chips) |

## 2. Brand foundation

### 2.1 Logo

| Asset | Description | Use |
|---|---|---|
| **Icon mark** | Amber bell inside a rounded navy badge | App icon, favicon, PWA icon, social avatar, loading screen |
| **Primary wordmark** | "Serv" (Latin) + "አዲስ" (Amharic for Addis) | Light backgrounds, documents |
| **Reversed wordmark** | White "Serv" + amber "አዲስ" on navy | **App bars and sidebars** (amber has 6.87:1 on navy) |
| **Secondary mark** | Latin-only "Servaddis" | Where Amharic type is impractical (tiny favicons, low-fi print) |
| **Reversed icon** | Amber badge, navy bell | Dark surfaces, secondary mark |

**Rules**
- Clear space = height of the bell's clapper on all sides; minimum icon size 24 px; minimum wordmark height 20 px.
- **Amber on white fails contrast (2.25:1).** The amber "አዲስ" in the primary wordmark is acceptable in a logo at large sizes, but in UI chrome use the **reversed wordmark on navy**.
- **Asset action:** the supplied logo is a 102×81 px PNG. Rebuild the bell badge and wordmark as **SVG** before any projector or print use (the demo can ship a faithful SVG rebuild of the badge; the Amharic lettering should be set from the real font or outlined from the original source file).

### 2.2 Colour

Confirmed from the logo: navy `#16243F`, amber `#D9A441`.

**Tokens (CSS custom properties; Tailwind maps to these)**

```css
:root {
  /* Brand */
  --navy-50:#EEF2F9; --navy-100:#DCE4F2; --navy-200:#B9C8E3; --navy-300:#8FA5CB;
  --navy-600:#34568F; --navy-700:#2A4573; --navy-800:#1F3358; --navy-900:#16243F; --navy-950:#0E1830;
  --amber-50:#FFF8E8; --amber-100:#FBEBC8; --amber-300:#EBC577; --amber-400:#E3B558; --amber-500:#D9A441;
  --amber-700:#8A5A00; --amber-800:#7A5200;

  /* Neutrals (navy-tinted) */
  --gray-50:#F6F7F9; --gray-100:#ECEEF2; --gray-200:#DDE1E8; --gray-300:#C9CED8;
  --gray-400:#8A93A6; --gray-500:#6B7385; --gray-600:#5B6477; --gray-700:#3B4357;

  /* Semantic */
  --success-fg:#1A6B43; --success-bg:#E6F4EC; --success-solid:#1F7A4D;
  --info-fg:#264A8F;    --info-bg:#E8EFFB;
  --warning-fg:#7A5200; --warning-bg:#FBEBC8;
  --danger-fg:#9A1B14;  --danger-bg:#FDECEA;  --danger-solid:#B3261E;

  /* Roles */
  --bg:#F6F7F9; --surface:#FFFFFF; --text:#16243F; --text-secondary:#5B6477; --text-muted:#6B7385;
  --primary:#16243F; --primary-hover:#1F3358; --on-primary:#FFFFFF;
  --accent:#D9A441;  --accent-hover:#E3B558;  --on-accent:#16243F;
  --border:#DDE1E8;  --border-strong:#8A93A6; --focus-ring:#34568F;
}
```

*Derived tints (navy-50…950, amber-50…800) are proposals built around the two confirmed brand colours; the contrast values below were computed.*

**Contrast audit (WCAG 2.1; computed)**

| Use | Foreground on background | Ratio | Result |
|---|---|--:|---|
| Body text | `#16243F` on white | 15.46 | AA/AAA |
| Body text on app background | `#16243F` on `#F6F7F9` | 14.42 | AAA |
| Secondary text | `#5B6477` on white / on `#F6F7F9` | 5.94 / 5.54 | AA |
| Muted/helper text | `#6B7385` on white | 4.76 | AA — **only on white** |
| Muted on app background | `#6B7385` on `#F6F7F9` | 4.44 | **Fails AA text** → use secondary there |
| Primary button | white on `#16243F` (hover `#1F3358`) | 15.46 (12.55) | AAA |
| Accent button | `#16243F` on `#D9A441` (hover `#E3B558`) | 6.87 (8.11) | AA |
| Link / ghost | `#2A4573` on white | 9.56 | AAA |
| Amber used as text on light | `#8A5A00` on white · `#7A5200` on `#FFF8E8` | 5.93 · 6.54 | AA — **never use `#D9A441` as text on white (2.25)** |
| Amber on navy | `#D9A441` on `#16243F` | 6.87 | AA |
| Light text on navy | `#C9CED8` · `#8FA5CB` on `#16243F` | 9.79 · 6.19 | AA |
| Chip Live / Verified | `#1A6B43` on `#E6F4EC` | 5.74 | AA |
| Chip In review / Info | `#264A8F` on `#E8EFFB` | 7.39 | AA |
| Chip Changes / Warning | `#7A5200` on `#FBEBC8` | 5.87 | AA |
| Chip Rejected / Error | `#9A1B14` on `#FDECEA` | 7.23 | AA |
| Chip Draft | `#3B4357` on `#ECEEF2` | 8.50 | AA |
| Chip Expired | `#5B6477` on `#ECEEF2` | 5.12 | AA |
| Chip Closed | `#2A4573` on `#EEF2F9` | 8.51 | AA |
| Focus ring on white / on navy | `#34568F` · `#D9A441` | 7.31 · 6.87 | ≥ 3:1 |
| Input border | `#8A93A6` on white | 3.09 | ≥ 3:1 (UI component) |

**Colour usage rules**
1. **Navy is structure:** app bars, sidebars, primary buttons, headings.
2. **Amber is a highlight:** urgent badge, the bell, key CTAs on navy surfaces, the "Pro" plan, progress glow. **Max one amber element per viewport region** as a guideline.
3. **Status is never colour alone:** every chip has an icon and a label.
4. **Surfaces:** page `--bg`; cards `--surface` with `--border`; avoid shadows except on overlays (drawer, dialog, toast).

### 2.3 Typography

| Role | Latin | Ethiopic (Amharic) | Notes |
|---|---|---|---|
| UI & body | **Inter** | **Noto Sans Ethiopic** | Self-hosted; Ethiopic loaded via `unicode-range` only when needed |
| Numbers | Inter tabular figures | Western digits | `ETB 12,000` — consistent in both languages |

**Scale (rem; base 16 px; Presenter mode scales root to 18 px)**

| Token | Size / line-height (Latin) | Size / line-height (Amharic) | Use |
|---|---|---|---|
| `display` | 32 / 40 · 700 | 32 / 48 | Landing, empty states |
| `h1` | 24 / 32 · 700 | 24 / 36 | Page titles |
| `h2` | 20 / 28 · 600 | 20 / 32 | Section titles |
| `h3` | 16 / 24 · 600 | 16 / 28 | Card titles |
| `body` | 16 / 24 · 400 | 16 / 28 | Default |
| `small` | 14 / 20 · 400 | 14 / 24 | Secondary info |
| `caption` | 12 / 16 · 500 | 12 / 20 | Chips, helper text (never below 12) |

**Amharic rules:** line-height ≈ **1.2× the Latin** value (Ethiopic ascenders/descenders are taller); avoid italics and faux-bold (use the 600/700 files); do not letter-space; allow +30 % width for the same meaning; never truncate a job title to one line in the Amharic preview.

### 2.4 Layout tokens

| Token | Value |
|---|---|
| Spacing scale | 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64 |
| Radius | `sm` 6 (inputs, chips) · `md` 10 (buttons) · `lg` 16 (cards) · `xl` 24 (sheets, badges) · pill 999 |
| Elevation | `0` flat · `1` card hover (0 1px 2px / 8 % navy) · `2` drawer/dialog (0 8px 24px / 16 % navy) |
| Borders | 1 px `--border`; strong `--border-strong` for inputs |
| Touch targets | ≥ 44×44 px on jobseeker screens; ≥ 40 px on employer desktop |
| Motion | 150 ms ease-out for hover/press; 250 ms for drawers; toasts slide 200 ms; **respect `prefers-reduced-motion`**; no parallax, no autoplay |
| Icons | **lucide** 20 px (24 px on mobile nav), 1.75 stroke; hospitality metaphors: bell, utensils, coffee, bed, spa (flower), map-pin, compass (tours) |

### 2.5 Imagery and illustration

- Business Plan direction: **real Ethiopian hospitality workers and venues**, not international stock lobbies.
- The demo does **not** use scraped photos. Use **initial avatars** (navy/amber tints), simple line illustrations for empty states, and **real photos only if you supply permission-cleared images**.
- Venue logos in seed data: generated monogram tiles (navy/amber/gray).

## 3. Voice and microcopy

Tone: **confident, efficient, professional**; short sentences; verbs first; no exclamation marks except in success moments; respectful to service work ("Hire your next barista" not "Find cheap labour").

**Draft Amharic strings below need native-speaker review before external use.**

| Key | English | አማርኛ (draft) |
|---|---|---|
| landing.hiring | I'm hiring | ሠራተኛ እየፈለግሁ ነው |
| landing.looking | I'm looking for work | ሥራ እየፈለግሁ ነው |
| auth.phone | Enter your phone number | ስልክ ቁጥርዎን ያስገቡ |
| auth.sendCode | Send code | ኮድ ላክ |
| auth.enterCode | Enter the 6-digit code | ባለ 6 አሃዝ ኮዱን ያስገቡ |
| venue.pending | Pending verification | በማረጋገጥ ላይ |
| venue.verified | Verified venue | የተረጋገጠ ድርጅት |
| job.post | Post a job | ሥራ ይለጥፉ |
| job.status.draft | Draft | ረቂቅ |
| job.status.review | In review | በግምገማ ላይ |
| job.status.live | Live | ክፍት |
| job.status.closed | Closed | ተዘግቷል |
| job.status.expired | Expired | ጊዜው አልፏል |
| job.urgent | Urgent | አስቸኳይ |
| job.salary | Salary (ETB per month) | ደመወዝ (በወር፣ በብር) |
| job.apply | Apply | ያመልክቱ |
| job.applied | Applied | አመልክተዋል |
| applicant.shortlist | Shortlist | ወደ አጭር ዝርዝር አስገባ |
| applicant.reject | Reject | ውድቅ አድርግ |
| applicant.hired | Hired | ተቀጥረዋል |
| applicant.reveal | Reveal contact | ስልክ ቁጥር አሳይ |
| applicant.hiddenHint | Contact is hidden until you shortlist this candidate. | ይህን አመልካች አጭር ዝርዝር ውስጥ እስኪያስገቡ ድረስ ስልክ ቁጥሩ ተደብቋል። |
| promote.title | Promote to socials | በማኅበራዊ ሚዲያ ያስተዋውቁ |
| nav.team | Team | ቡድን |
| nav.plans | Plans | ዕቅዶች |
| nav.insights | Insights | ትንታኔ |
| error.salary | Add a realistic salary range. Jobseekers see this first. | ተጨባጭ የደመወዝ ክልል ያስገቡ። አመልካቾች መጀመሪያ የሚያዩት ይህን ነው። |
| error.noFee | Servaddis jobs must never ask applicants to pay. | በServaddis የሚለጠፉ ሥራዎች ከአመልካቾች ክፍያ መጠየቅ የለባቸውም። |
| error.noPermission | Your role can't do this. Ask the owner to change your access. | የእርስዎ ሚና ይህን ማድረግ አይፈቅድም። ባለቤቱን ፈቃድ እንዲሰጥዎ ይጠይቁ። |

**Writing rules for restrictions:** say *what* is blocked, *why*, and *who or what unblocks it*. Example: "You can't submit yet — your venue is awaiting verification. We usually review licenses within one business day." (Demo: instant.)

## 4. Application shells and responsive behaviour

| Shell | Used by | Structure | Breakpoints |
|---|---|---|---|
| **Employer** | Employer routes | **Left sidebar** (navy-900, 248 px): reversed wordmark, nav (Dashboard, Jobs, Team, Insights, Plans, Venue), venue switcher and role label at the bottom. **Top bar** (white): page title, language toggle, notification bell, user menu. Content on `--bg`, max-width 1200 px | ≥ 1024 full sidebar · 768–1023 icon rail · < 768 sidebar becomes a bottom sheet menu and tables become cards |
| **Jobseeker** | `/`, `/jobs`, `/me/*` | **Top app bar** (navy-900, reversed wordmark, language toggle) · **bottom nav** (Jobs · My applications · Profile) · single column | Designed at 360 px; scales up to a 640 px centred column on desktop |
| **Admin** | `/admin/*` | Sidebar navy-950 with an amber "Admin" tag; dense tables | ≥ 1024 only (not a mobile target) |
| **Demo dock** | all (demo mode) | Collapsible floating handle at the bottom-right; expands to a panel; never overlaps primary actions on mobile (moves to top-right) | — |

A **"Demo environment"** ribbon sits above the top bar on the hosted copy.

## 5. Component inventory

Built on shadcn/ui primitives (Button, Input, Select, Tabs, Dialog, Sheet, Drawer, Dropdown, Toast, Tooltip, Table, Badge, Progress, Switch, Checkbox, Skeleton). Custom components:

| Component | Purpose | Key states / notes |
|---|---|---|
| `LangToggle` | አማ \| EN segmented control | Persistent; announces change to screen readers |
| `PhoneInput` | +251 prefix, 9-digit mask, validation | Error text bilingual |
| `OtpInput` | 6 boxes, paste support, auto-advance | Resend countdown; lockout state |
| `FileDropzone` | License upload | idle · dragging · uploading (progress) · uploaded · error (type/size) |
| `ChecklistCard` | Onboarding steps with progress | done · current · locked (with reason) |
| `KpiTile` | Number + delta + sparkline | loading skeleton; no-data |
| `TemplateTile` | Role template picker | icon · title EN/AM · typical salary · "Popular" tag |
| `Stepper` | Composer progress (4 steps) | current · done · error badge |
| `BilingualField` | Input with **አማ / EN** tabs and completion dots | one-language-filled warning |
| `SalaryRange` | Min/max with period selector and hint ("Typical: ETB 5,000–9,000") | out-of-range warning (not blocking) |
| `UrgencySelect` | Normal · Half-day · Today · Tomorrow · 2 days | explains expiry for each |
| `RuleFlagList` | Inline moderation flags with the offending phrase highlighted | block (red) · warn (amber-tinted) · info |
| `StatusChip` | Job and application states (see §6.2) | icon + label |
| `VerifiedBadge` | Venue verified / Fayda verified | tooltip explains what was checked |
| `UrgentBadge` | Amber pill with clock icon and deadline | |
| `JobCard` | Feed card (jobseeker) and list card (employer) | urgent pinned; salary in bold; sub-city; venue badge |
| `ApplicantCard` | Avatar, name, role fit tags, experience, completeness bar, verified tick | selected · new (dot) · disabled actions |
| `PipelineBoard` | Columns: Applied · Viewed · Shortlisted · Hired · Rejected | drag is **not** required; actions via buttons; list/board toggle |
| `ApplicantDrawer` | Right sheet (desktop) / full-screen (mobile): profile, timeline, actions | masked vs revealed contact; disabled-with-reason buttons |
| `LiveToast` | "New applicant: Dawit A. — Barista" with View action | auto-dismiss 6 s; pauses on hover |
| `PermissionMatrix` | Rows of permissions with switches per member | preset vs customised indicator |
| `ChannelPreview` | Telegram / Facebook / Instagram / TikTok-draft mock posts | status chip; **Simulated** tag |
| `CardCanvas` | Rendered job card image with language toggle | loading shimmer; download |
| `PlanCard` | Plan name, price, features, CTA | current · recommended (amber outline) · locked feature rows |
| `ReceiptSheet` | Printable receipt | |
| `FunnelChart`, `TrendChart` | Insights | colour-blind safe: navy, amber, gray; labels, not legend-only |
| `StepTracker` | Jobseeker application progress | Applied → Viewed → Shortlisted → Hired / Rejected |
| `SimulatedTag` | Small gray "Simulated" tag | hideable from Toolkit |
| `DemoDock` | Presenter toolkit | collapsed · expanded |
| `EmptyState` | Line illustration + one sentence + one action | per screen |

## 6. States and feedback

### 6.1 Global feedback patterns

| Situation | Pattern |
|---|---|
| Loading | Skeletons shaped like the content; no spinners over 1 s without a skeleton |
| Success | Toast (bottom-centre mobile, top-right desktop) with icon; important success (venue verified, job live) also updates the relevant chip with a subtle highlight pulse |
| Error | Inline next to the field plus a summary at top for forms with > 1 error; server error toast with retry |
| Blocked by permission | Disabled control **with tooltip/inline reason**; full-page 403 shows who can help |
| Blocked by state | Disabled with reason ("Shortlist first") |
| Offline | Slim banner "You're offline" on jobseeker routes; actions disabled |
| Simulated | Gray *Simulated* tag next to anything not real (SMS, payment, publish) |

### 6.2 Status chip mapping

| Status | Label (EN/AM) | Icon | Tokens |
|---|---|---|---|
| Draft | Draft / ረቂቅ | pencil | gray |
| In review | In review / በግምገማ ላይ | hourglass | info |
| Changes requested | Changes requested / ማስተካከያ ተጠይቋል | message-circle | warning |
| Live | Live / ክፍት | radio | success |
| Expired | Expired / ጊዜው አልፏል | clock | gray (expired) |
| Closed | Closed / ተዘግቷል | check-circle | closed (navy tint) |
| Rejected | Rejected / ውድቅ ሆኗል | x-circle | danger |
| Applied / Viewed / Shortlisted / Hired / Rejected (applications) | አመልክተዋል / ታይቷል / አጭር ዝርዝር ውስጥ / ተቀጥረዋል / ውድቅ | send · eye · star · badge-check · x | gray · info · warning→navy · success · danger |
| Venue Pending / Verified / Rejected | | hourglass · shield-check · shield-alert | info · success · danger |

## 7. Screen-by-screen design notes and wireframes

Screen IDs match doc 03 §1.2. Wireframes are low-fidelity layout intent, not visual design.

### SCR-00 / SCR-01 — Landing and sign-in (mobile first, also desktop)

```
┌──────────────────────────────┐
│ [bell] Servአዲስ      አማ | EN │  navy bar, reversed wordmark
├──────────────────────────────┤
│  The hiring platform built   │
│  only for hospitality.       │  display, navy
│                              │
│  [ 🏨  I'm hiring          ] │  primary card button (navy)
│  [ 🍽  I'm looking for work] │  secondary card button (white, navy border)
│                              │
│  ✔ Verified venues  ✔ Free to apply │
└──────────────────────────────┘
```
Sign-in: single field screen → OTP screen; demo hint chip under the field: *Demo: use 123456*.

### SCR-E03 — Employer dashboard

```
┌ Sidebar ┐ ┌──────────────────────────────────────────────────────────────┐
│ Servአዲስ│ │ Good morning, Bruk              [አማ|EN]  🔔2  Bruk ▾          │
│ ▸ Home  │ ├──────────────────────────────────────────────────────────────┤
│   Jobs  │ │ Get started  ████████░░ 3 of 4                               │
│   Team  │ │ ✔ Register  ✔ Venue profile  ✔ License (pending)  ○ First job │
│   Insights│ │                                      [ Post your first job ] │
│   Plans │ ├───────────────┬───────────────┬───────────────┬──────────────┤
│         │ │ Live jobs  3  │ New applicants 7 │ Avg time-to-fill 6.2 d │ Plan: Founding │
│ Hiwot ▾ │ ├──────────────────────────────────┴───────────────┴──────────┤
│ Owner   │ │ Recent activity   • Dawit A. applied to Barista (2 min)       │
└─────────┘ └──────────────────────────────────────────────────────────────┘
```

### SCR-E05 — Template picker

```
 Choose a role to start      [ Search roles… ]        Start blank →
 ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
 │ ☕      │ │ 🍴      │ │ 🛏      │ │ 🧑‍🍳     │
 │Barista │ │Waiter  │ │House-  │ │Line    │
 │ባሪስታ   │ │አስተናጋጅ│ │keeper  │ │Cook    │
 │5–9k ETB│ │4–8k    │ │4–7k    │ │6–10k   │
 └────────┘ └────────┘ └────────┘ └────────┘   … 12 tiles (3 × 4 on desktop, 2 × 6 on mobile)
 ⚠ Your venue is awaiting verification: you can draft now, submit after approval.
```

### SCR-E06 — Composer (4 steps) and bilingual preview

```
 ① Basics  ② Details  ③ Pay & urgency  ④ Preview & submit
 ─────────────────────────────────────────────────────────────
 Step ③                                     │  Live preview
 Salary  ETB [ 5,000 ] – [ 9,000 ]  per ▾Month│  ┌─────────────────────────┐
         Typical for Barista: 5,000–9,000    │  │ Barista        [Urgent] │
 Employment  (•) Full-time ( ) Part ( ) Shift│  │ Bole Sunrise Café ✔     │
 Headcount   [ 2 ]                           │  │ ETB 5,000–9,000 / month │
 Urgency     ( ) Normal (•) Tomorrow …       │  │ Bole · Full-time        │
   "Expires end of tomorrow (EAT)"           │  └─────────────────────────┘
                                             │  [ አማ ] [ EN ]  📱 | 🖥
 [ Back ]                 [ Save draft ] [ Continue ]
```
Step ④ shows the full preview, the **RuleFlagList** (empty = green "No issues found"), and the **Submit for review** button. A blocked rule keeps Submit disabled and scrolls to the offending field with the phrase highlighted.

### SCR-E08/E09 — Applicant pipeline and drawer

```
 Barista · Bole Sunrise Café   [Live]            View: [Board|List]  Sort: Completeness ▾
 ┌ Applied (4) ──┐ ┌ Viewed (2) ──┐ ┌ Shortlisted (1)┐ ┌ Hired (0) ┐
 │ ● Dawit A.  ✔ │ │ Hana B.      │ │ Meron T. ✔     │ │           │
 │  3 yrs · 85%  │ │  2 yrs · 70% │ │  5 yrs · 100%  │ │           │
 │ Yonas G.      │ └──────────────┘ └────────────────┘ └───────────┘
 └───────────────┘                                  ┌──────────── Drawer ────────────┐
                                                    │ Dawit Alemu   ✔ Fayda verified │
 ● = new (live toast on arrival)                    │ Waiter · Barista · 3 yrs       │
                                                    │ Skills: Espresso · Latte art   │
                                                    │ Languages: አማ native · EN good │
                                                    │ Phone: +251 92• ••• ••01 🔒    │
                                                    │  "Shortlist first to reveal"   │
                                                    │ [Reject ▾] [Shortlist]         │
                                                    └────────────────────────────────┘
```
After shortlisting: **Reveal contact** becomes enabled; after reveal, the number is shown with a small "Revealed by Selam, 10:42" line. Buttons the viewer lacks permission for are **hidden for clarity** if the role can never use them (e.g. Poster never sees the pipeline), and **disabled with a reason** if state prevents them.

### SCR-E10 — Promote to socials

```
 Promote “Barista”                                  [ Promote to socials  ◉ ON ]
 ┌ Card ─────────────┐   Channels                                          [አማ|EN]
 │  1080×1080 render │   ✔ Telegram   Published   [Simulated]   Preview ▸
 │  navy bg, amber   │   ✔ Facebook   Published   [Simulated]   Preview ▸
 │  bell, title,     │   ✔ Instagram  Published   [Simulated]   Preview ▸
 │  venue, salary,   │   ◔ TikTok     Draft for team (add trending sound)  Preview ▸
 │  QR → /jobs/:id   │   Caption (AM/EN) · #ServaddisJobs #AddisJobs #ሥራ
 └───────────────────┘   [ Download card ]
 (Standard plan: panel is locked → "Upgrade to Pro" )
```
**Card design:** navy background; amber bell badge top-left; job title in white 700 (Amharic or English per selected language); venue and sub-city in `navy-200`; salary band in an amber pill with navy text; urgent ribbon if applicable; QR code on a white tile bottom-right; small "Servaddis.com" wordmark placeholder bottom-left (domain to be confirmed).

### SCR-E14 — Team and permissions

```
 Team                                                         [ + Invite member ]
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ Selam Getachew    Owner         (you)                                       │
 │ Meseret Abate     HR Manager    Preset                       ⋯              │
 │ Yared Alemu       Poster        Preset     ▸ expand                         │
 │ Rahel Mekonnen    Screener      Customised ▾                                │
 │    Post jobs ○  View applicants ● Shortlist ● Reject ● Hire ○ Reveal contact ● │
 │    Billing ○   Insights ○ …                      [ Save ]  [ Reset to preset ]│
 └─────────────────────────────────────────────────────────────────────────────┘
 Role helper: “Poster can create and submit jobs but cannot see applicants.”
```

### SCR-J01/J02/J03 — Jobseeker feed, detail, tracker (360 px)

```
┌────────────────────────────┐ ┌────────────────────────────┐ ┌────────────────────────────┐
│ Servአዲስ          አማ | EN │ │ ‹  Barista                 │ │ My applications            │
│ [ Search… ] [Filters ⚙]    │ │ Bole Sunrise Café ✔        │ │ Barista · Bole Sunrise Café│
│ ┌────────────────────────┐ │ │ ETB 5,000–9,000 / month    │ │ ○─────●─────○─────○        │
│ │ ⚡ Urgent · today      │ │ │ Bole · Full-time · 2 openings │ │ Applied Viewed Short- Hired│
│ │ Barista                │ │ │ ───────────────            │ │          ▲ now   listed    │
│ │ Bole Sunrise Café ✔    │ │ │ What you'll do …           │ │ Updated 2 min ago          │
│ │ ETB 5–9k · Bole        │ │ │ Requirements …             │ │                            │
│ └────────────────────────┘ │ │ Benefits …                 │ │                            │
│ ┌────────────────────────┐ │ │ ┌────────────────────────┐ │ │                            │
│ │ Waiter · Piassa …      │ │ │ │  [  Apply  (one tap) ] │ │ │                            │
│ └────────────────────────┘ │ │ └────────────────────────┘ │ │                            │
│ Jobs · Applications · Me   │ │  sticky apply bar          │ │ Jobs · Applications · Me   │
└────────────────────────────┘ └────────────────────────────┘ └────────────────────────────┘
```
Filters open as a bottom sheet: role, sub-city, type, salary range, urgent only. Jobseeker screens avoid images; the job card is text-first to keep weight under budget.

### SCR-A01/A02 — Admin queue and review

```
 Moderation queue    [Licenses 1] [Jobs 2]                          Filter ▾
 ┌ Venue / Job ────────────┬ Age ──┬ Flags ──┬ Tag ─────────────────────┐
 │ Bole Sunrise Café (lic.)│ 2 min │ —       │                          │
 │ Barista · Hiwot Garden  │ 5 min │ 1 warn  │ Unchanged repost — fast ✓│
 └─────────────────────────┴───────┴─────────┴──────────────────────────┘
 Review: [ document viewer / job preview EN|AM ]  Rule flags: ⚠ Off-platform contact in description
   Reason (required for reject/changes): [____________]   [ Reject ] [ Request changes ] [ Approve ]
```

### SCR-E11/E12/E13 — Plans, checkout, receipt

```
 Plans         Standard                 Pro  ★ Recommended           Urgent post
               ETB 1,500 / mo           ETB 3,500 / mo              ETB 300 one-time
               5 live jobs              Unlimited live jobs         1 job
               Applicant pipeline       Applicant pipeline          Applicant pipeline
               ✕ Promote to socials     ✔ Promote to socials        ✔ Promote to socials
               [ Choose ]               [ Choose ]  (amber outline) [ Buy ]
 Prices are illustrative.
```
The simulated Chapa page uses a **neutral payment-page look with a visible "Simulated payment" banner** and does not imitate Chapa's trademarked branding. Receipt is a clean A4/print layout with VAT line.

### SCR-E15 — Insights

Four KPI tiles (Live jobs, Applicants this month, Avg time-to-fill, Hires), a **funnel** (Applied → Viewed → Shortlisted → Hired, with %), a **time-to-fill trend** line (6 months, improving), and an **applicant quality** bar (avg completeness + % verified). Annotate the trend with one sentence in plain language: "Hires are filling 5 days faster than six months ago."

## 8. Presenter mode and projector considerations

| Feature | Detail |
|---|---|
| Presenter mode (toggle in dock) | Root font +12 %, increased row heights, thicker focus rings, hides the dock's secondary tools until opened, suppresses non-essential toasts |
| Contrast | All text ≥ AA; avoid `--text-muted` on gray backgrounds; no light-gray hairlines as the only separator |
| Window layout | Employer and Admin windows side by side at ≥ 1280 px each, or on two displays; the jobseeker view is a real phone or a 390×844 device frame |
| State clarity | After every action, one obvious visual change (chip colour, toast, counter) so the audience sees cause and effect |
| Language switching | Switch language mid-demo on the composer preview to show bilingual strength; keep the switch in the top bar, not in a menu |

## 9. Accessibility requirements

- WCAG 2.1 AA for text and UI components (audit in §2.2).
- All interactive elements keyboard-reachable with a visible focus ring (`--focus-ring`, 2 px + 2 px offset; amber ring on navy surfaces).
- Form inputs have visible labels (no placeholder-only labels); errors are programmatically associated and announced.
- Status chips include text; icons are decorative (`aria-hidden`) when text is present.
- The language toggle sets `lang` on `<html>` (`am` / `en`) so screen readers and hyphenation behave.
- Touch targets ≥ 44 px on jobseeker screens; no hover-only interactions.
- Respect `prefers-reduced-motion`; no flashing; toasts are `role="status"` (non-critical) or `role="alert"` (errors).

## 10. Asset checklist

| Asset | Status | Spec |
|---|---|---|
| Logo SVG (icon, wordmark, reversed) | **Needed** (supplied PNG is 102×81) | Vector; navy/amber exact hex; Amharic lettering from the source |
| PWA icons | To generate | 192, 512, maskable 512 (safe zone 80 %), Apple touch 180 |
| Favicon | To generate | SVG + 32 px PNG |
| Open-Graph image | To generate | 1200×630, navy with bell |
| Fonts | To bundle | Inter (400/500/600/700), Noto Sans Ethiopic (400/600/700), TTF for card render + WOFF2 for web |
| Sample license PDF | To create | Clearly marked "SAMPLE — NOT A REAL LICENSE" |
| Venue monograms, avatars | Generated in code | |
| Photography | **Optional** | Only permission-cleared images of real Ethiopian hospitality workers and venues |
| Empty-state illustrations | To create | 6 simple line drawings (jobs, applicants, team, notifications, offline, 403) |

## 11. Design QA checklist (per screen)

- [ ] Works at 360, 768 and 1280 px.
- [ ] Looks right in **both** English and Amharic (no clipping, truncation, or tofu glyphs).
- [ ] All states designed: loading, empty, error, permission-blocked, success.
- [ ] Contrast checked against §2.2; no amber text on white.
- [ ] Every restriction explains what, why and who can fix it.
- [ ] Simulated features carry the *Simulated* tag.
- [ ] Keyboard path through the primary action works; focus is visible.
- [ ] Screen weight within the jobseeker budget (doc 02 §8).
- [ ] Screenshot reviewed on a real mid-range Android phone and on a projector.

## 12. Optional next step

If you want a visual prototype before building, this brief is detailed enough to produce a clickable Figma file or a static HTML prototype of the five hero screens (composer preview, pipeline + drawer, team permissions, promote, jobseeker feed). Say the word and I'll do that as a follow-up.
