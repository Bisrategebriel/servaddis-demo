# Servaddis demo

A clickable, data-backed demo of Servaddis, a hospitality-only hiring platform for Addis Ababa.
It is a demo, not the production system: SMS, payments, Fayda and social publishing are simulated.

- The specs are in [`docs/`](docs/).
- Build status, decisions and conventions are in [`PLAN.md`](PLAN.md).

## Run the demo

Needs Node 22+ and pnpm.

```bash
pnpm install
pnpm demo
```

`pnpm demo` creates `.env` on first run, applies migrations, loads fresh demo data, builds, and
starts the server. It prints the addresses to open. Everything is bundled, so once installed it
needs no internet connection.

| Command                  | Use                                              |
| ------------------------ | ------------------------------------------------ |
| `pnpm demo`              | Laptop, plus phones on the same Wi-Fi or hotspot |
| `pnpm demo --skip-build` | Faster restart with the last build               |
| `pnpm demo --tunnel`     | Also opens a temporary public link               |

**Every `pnpm demo` wipes the demo data**, as does the toolkit's Reset button.

Presenting? Follow the [presenter runbook](docs/07-Runbook.md): setup, the script click by click,
and what to do when something goes wrong.

### Showing it to someone off-site

Install Cloudflare's tunnel tool once:

```bash
winget install Cloudflare.cloudflared
```

Then run `pnpm demo --tunnel`. It prints a public `https://….trycloudflare.com` link and a toolkit
code. The link changes on every run and works only while the command is running. QR codes on job
cards follow the current link automatically. The toolkit stays locked until you type the code into
the demo dock, so viewers can't reset the demo or switch persona. Stop the command when you finish.

## Demo logins

The sign-in code is always `123456`. The wrench button in the corner (the demo dock) signs in as
any of these with one click.

| Persona   | Phone           | Role                           |
| --------- | --------------- | ------------------------------ |
| Bruk      | `+251911000011` | New café owner, registers live |
| Selam     | `+251911000001` | Owner, Hiwot Garden Hotel      |
| Yared     | `+251911000002` | Poster, Hiwot Garden Hotel     |
| Rahel     | `+251911000003` | Screener, Hiwot Garden Hotel   |
| Meseret   | `+251911000004` | HR Manager, Hiwot Garden Hotel |
| Dawit     | `+251922000001` | Jobseeker                      |
| Moderator | `+251911000009` | Platform admin                 |

All people, venues and numbers are fictional.

## Development

```bash
cp .env.example .env   # then fill in the three secrets
pnpm db:deploy
pnpm seed
pnpm dev
```

| Command                 | Use                                                                 |
| ----------------------- | ------------------------------------------------------------------- |
| `pnpm run check`        | Lint, typecheck, format check, tests and build                      |
| `pnpm test`             | Unit and integration tests, including the endpoint × role matrix    |
| `pnpm e2e`              | Browser tests: accessibility, demo script, performance (~10 min)    |
| `pnpm e2e --skip-build` | The same, reusing the last test build                               |
| `pnpm rehearse`         | The demo script 3 times in a row; `--record` saves a fallback video |
| `pnpm seed`             | Wipe and reload the demo data                                       |
| `pnpm db:migrate`       | Create and apply a migration                                        |
| `pnpm db:studio`        | Browse the database                                                 |

`pnpm e2e` uses its own build, database and port, so it is safe to run next to `pnpm dev` and
never touches the demo data. Locally it drives the installed Microsoft Edge; CI installs
Chromium. CI runs the same checks as `pnpm run check`, then `pnpm e2e`.

The browser tests live in `tests/e2e/`:

- `a11y.spec.ts`: axe (WCAG 2.1 A and AA) on every P0 screen, in English and Amharic.
- `demo-script.spec.ts`: the full demo script, in English and Amharic.
- `perf.spec.ts`: jobseeker pages on a cold load at 360 px with Lighthouse's "Slow 4G" profile
  and 4× CPU slowdown. Each page must stay within 200 KB of JS and CSS, and its median first
  contentful paint within 3.5 s. CI enforces the size budget; first paint depends on the
  runner's CPU, so CI reports it and enforces it only with `E2E_STRICT_FCP=1`.

Run one file with `pnpm e2e --skip-build -- tests/e2e/perf.spec.ts`.
