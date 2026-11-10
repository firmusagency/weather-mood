# Weather Mood: working notes for Claude Code sessions

Weather-aware day-trip recommendations for hotels and hosts in Chania, Crete. Hotels pay, guests use it free.
Read `README.md` first: it documents every screen, script, workflow and data file. This file holds the
decisions and conventions that are not obvious from the code.

## Decisions already made (do not re-open without the owner)

- Product name stays **Weather Mood**. Region: Chania only for now; no "all of Crete".
- Business model: hotels/hosts pay a subscription; guests never pay; **taverns and local partners are never charged**
  (they are observers and partners, not customers).
- Free tiers first; the only planned mandatory cost before the first paying customer is the Open-Meteo commercial
  subscription (secret `OPEN_METEO_API_KEY`). National Observatory (meteo.gr) daily files are used for verification
  only; ask for written permission before commercial launch.
- Correctness beats agreement: when the owner questions a forecast, verify against data (Windy, stations) and fix the
  engine rather than argue. Every engine change comes with a test in `tests/`.
- Hard limits sit above the score (`hardLimits` in `src/engine/scoring.ts`): cold or rainy days are not beach days,
  rain in the mountains rules gorges out. Thresholds are in README; change them only with the owner.
- Guest-facing text is plain language in EL/EN/DE/FR, never scores or jargon. Staff see numbers in the dashboard.
- Never put model identifiers or AI attribution in repo files, PR titles or commit bodies beyond the standard trailer.

## Where things live

- Engine: `src/engine/` (analysis → scoring → recommend; synopsis; stay planner; verification; feedback calibration).
- Guest page: `src/guest/` (phone, lobby, reception form, QR card, stay planner, push). Dashboard: `src/ui/`.
  Public accuracy page: `src/accuracy/`.
- Per-property configuration: `src/data/properties.json` (name, brand, logo, favourites, tips). Spots: `src/data/spots.ts`
  (all `verified: false` until the owner checks them on site; the owner will do this later).
- Data that accumulates (the moat): `data/archive/` (one next-day forecast per day), `data/verification/`,
  `data/messages/`, `data/feedback/`, `data/reports/`. Never delete or rewrite these.
- Live site: GitHub Pages from `.github/workflows/pages.yml` → https://firmusagency.github.io/weather-mood/
  (`guest.html`, `accuracy.html`). A custom domain will replace it later; then set `VITE_BASE=/` in the deploy workflow
  and the `VITE_GUEST_URL` / `VITE_DASHBOARD_URL` variables.
- Database: Supabase project `weather-mood` (firmusagency's org). Anon key may only INSERT; service key is a GitHub
  secret used by the nightly scripts. Migrations in `supabase/migrations/`.

## Conventions

- Branch: `claude/gifted-tesla-83gi9j` is the working and default branch; bots commit data to it several times a day,
  so always `git pull --rebase` before pushing. Checkpoints are branches named `checkpoint-N-...` (tags cannot be pushed
  from the cloud session).
- `npm test` (vitest) and `npm run typecheck` must pass before every push. `npm run build` builds all three pages.
- Demos for the owner: `npm run demo:guest|demo:page|demo:accuracy` produce single-file pages in `dist-single/`
  that are published as Claude artifacts; they are static snapshots, the live site is the source of truth.
- GitHub runs `schedule:` crons 4–6 h late here. The on-time runs are dispatched by Supabase pg_cron
  (`supabase/migrations/0003_scheduler.sql`, schema `ops`, Athens-time check); the GitHub crons are a late fallback and the
  evening/morning/weekly workflows skip it unless the output is really missing and the Athens hour still makes sense
  (the first guard compared file dates and let a fallback through at 01:50; never judge by "tomorrow" in a late job). Needs the vault secret `github_dispatch_token`
  (fine-grained PAT, Actions: write, no expiry; in place since 2026-11-07); `select * from ops.dispatch_status` shows what happened.
- Open-Meteo is not reachable from the cloud sandbox: data comes from the GitHub Actions; trigger `snapshot.yml` to
  refresh and pull the result.
- The owner reads Greek; reply in Greek, keep code and commit messages in English.

## Open next steps (as of 2026-11-10)

- `AFTER_RAIN` thresholds (gorges after rain) stay as set: public closure notices show OFYPEKA shuts Samaria on a same-day
  forecast of ~8–10 mm (we are stricter) and keeps it shut for inspections after heavy rain (see
  `docs/gorges-after-rain-2026-11-09.md`). Re-check only against the official status in season (May–Oct 2027).
- Samaria official status is read twice a day (`scripts/samaria-status.ts` → `public/data/closures.json`, engine `closures.ts`);
  the in-season weather-closure wording has not been seen yet, so check `data/closures/log.jsonl` in May 2027 and adjust the parser.
- Rain calibration (`docs/rain-calibration-2026-11-01.md`): re-run `npm run rain:calibration` at ~30 days; the proposal is
  caution ≥ 40% / 0.5 mm for the sea. Per-model rain is in the snapshot and the verification rows since 2026-11-08, so the
  per-model table in that script fills up from the 2026-11-09 verification on.
- Station gust calibration (`src/engine/stationcal.ts`, `docs/station-gusts-2026-11-10.md`) activates by itself at 30 days per
  station: expect Paleochora ~17 Nov and Falasarna ~20 Nov 2026 at about ×1.18. Check the dashboard panel then; nothing to do unless
  the factor looks wrong. Elafonisi and Kissamos stations read low and are never used to lower a forecast.
- Push notifications have never been sent: the evening log said "push not configured". The log now names what is missing
  (`pushMissing`); read the next evening run and tell the owner which secret/variable to add (likely `VAPID_PRIVATE_KEY`).
- Dropped for now (owner, 2026-11-09): tavern observer network (no incentive to offer) and the boat-company line
  (Cretan Daily Cruises publishes no cancellations; only by phone 28220 22888). Revisit when there is a pilot hotel.
