# praia-digital-apps
A collection of useful, interconnected web applications inspired by Praia Digital.


## Case 684 · A connected, local-first toolkit

A polished, dependency-free application hub and five functional tools. No sign-in, analytics, payment processing, paid API keys, live business listings, or backend database. The project is independent of, and not affiliated with, praia.digital.

### Applications

| Application | URL | What it does |
| --- | --- | --- |
| Central hub | https://michaelpaul03.github.io/praia-digital-apps/ | Search/filter the app directory; featured/recent tools; connected workflow; full-workspace backup and restore. |
| Property Planner | https://michaelpaul03.github.io/praia-digital-apps/property-planner/ | Add/edit/delete properties, descriptions, prices, area, personal ratings, notes and favorites. Customize up to 12 weighted criteria, compare side by side, export scored JSON/CSV reports. |
| Calendar Auditor | https://michaelpaul03.github.io/praia-digital-apps/calendar-auditor/ | Import and validate ICS files, detect overlaps, calculate union busy time and open workday windows, filter dates, group daily/weekly/monthly, export JSON/CSV, sync saved itineraries. |
| Stay Splitter | https://michaelpaul03.github.io/praia-digital-apps/stay-splitter/ | Multiple groups, 2–12 participants, editable expenses, equal/custom weighted shares, integer-cent balances, exact minimum-transfer suggestions and complete reports. Does not move money. |
| Trip Planner | https://michaelpaul03.github.io/praia-digital-apps/trip-planner/ | Multiple trips, destination/date ranges, per-day activity timelines, times/durations/costs/notes, edit/move/delete activities, trip estimates, JSON/CSV/ICS exports. |
| Local Guide | https://michaelpaul03.github.io/praia-digital-apps/local-guide/ | User-entered places, categories, collections, ratings, useful information, notes, favorites, search/filter, details and collection exports. No invented or live business data. |

### How the tools connect

1. Choose **Plan a visit** on a property to prefill a trip/visit with its name, location and notes.
2. From a trip, open **Add saved places**. A place's **Add to trip** action carries its name, location and notes into the selected itinerary.
3. Choose **Split planned costs** on a trip. Create/select a same-currency group, select a cost and review its amount/payer before recording it. A source identifier prevents duplicate import into the same group. Estimates are never automatically treated as payments.
4. Choose **Audit these dates**, then **Sync itinerary**, to compare activity copies with imported ICS events. Re-sync updates that trip's audit copies without duplicating them or deleting external ICS events.

Every page shares the header directory, hub backlink, related-tool recommendations, footer, accessible dialogs and responsive navigation. Links resolve from the shared module location, preserving the `/praia-digital-apps/` base path even on direct app access or refresh.

## Run locally

Serve the repository parent so local URLs match GitHub Pages:

```sh
cd ..
python3 -m http.server 8768
# Open http://localhost:8768/praia-digital-apps/
```

Serving the repository root at `/` also works; internal URLs are derived from the loaded shared module. Do not open the HTML files directly with `file://`: ES modules require HTTP(S).

## Data, privacy and backups

- Versioned records live under `praia.case684.<workspace>.v1` in browser `localStorage`. They are isolated to this origin/browser/device, but other scripts on the same GitHub Pages origin can technically access origin storage. Do not store sensitive identity, banking, or confidential records.
- Each write validates a schema, allocates money in integer cents, checks for newer changes from another tab, and rolls in-memory edits back if storage fails. Corrupt saved records are preserved and blocked from overwrite.
- Use **Download workspace backup** on the hub for a restorable JSON backup of all five tools. **Restore workspace backup** validates every contained workspace before replacing any data, requests confirmation, and attempts transactional rollback if storage fails. Only non-null records included in a backup are replaced; other workspaces are unchanged.
- Individual app JSON/CSV exports are portable reports/data snapshots; use the hub's full workspace format for one-click restoration. Property exports use the selected comparison, if any; Local Guide exports the current filtered view.
- Clearing browser data, private browsing, or browser eviction can remove saved work. Exports may contain personal notes; store them appropriately. CSV formula-like text is neutralized for spreadsheet safety; a leading apostrophe may appear in those exported cells.

## Development and verification

Runtime: modern browser with ES modules, native dialog, structuredClone, Intl and localStorage. No npm packages or build-time runtime dependencies.

```sh
node --test tests/*.test.mjs
python3 tools/build.py --output dist
python3 -m pip install -r tests/requirements.txt
python3 -m playwright install chromium
python3 tests/setup_qa.py
BASE_URL=http://localhost:8768/praia-digital-apps/ python3 tests/browser_test.py
```

The browser tests use isolated temporary browser contexts and synthetic QA data; they do not alter the repository or transmit payments. They can also be run against the published site by changing `BASE_URL`. `QA_OUTPUT` controls reports/screenshots; `AXE_PATH` can point to a preinstalled axe-core 4.10.3 engine. `setup_qa.py` verifies the test-only engine's pinned SHA-256. An internet connection is needed only to install test tooling, not to run the applications once their files are loaded.

### Structure

```text
index.html                    # central hub
assets/css/style.css          # shared responsive design system
assets/js/main.js             # application routing and hub
assets/js/shared.js            # UI, storage, backup/restore and navigation
assets/js/core.js              # pure calculations and calendar logic
assets/js/schema.js            # validation and backup boundaries
assets/icons/favicon.svg
property-planner/{index.html,assets/app.js}
calendar-auditor/{index.html,assets/app.js}
stay-splitter/{index.html,assets/app.js}
trip-planner/{index.html,assets/app.js}
local-guide/{index.html,assets/app.js}
tests/                        # domain/schema/browser tests and fixtures
tools/build.py                # static production validation/package
```

## GitHub Pages deployment

Publish this existing repository's `main` branch, root folder. `.nojekyll` ensures the static module files are served directly. No custom domain or DNS change is required or authorized. There is no client-side rewrite dependency: all six URLs have a physical `index.html` and support direct loading/refresh. `dist/` is an optional verified package, not the Pages source.

The original MIT license remains byte-for-byte unchanged; this README retains the original title/introduction and Git history. See [QA notes](docs/QA.md) and [architecture and limits](docs/ARCHITECTURE.md) for evidence and scope.
