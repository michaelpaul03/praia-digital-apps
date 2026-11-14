# Case 684 verification record

Executed in the retained development environment on 2026-11-14T06:04:36.968523+00:00.

## Final regression

- **89/89 unit tests passed**, including all original 63 core tests and 26 additional schema/input-boundary cases. The settlement suite compares its exact optimum to an independent DFS oracle on 100 generated groups; share tests include 1,000 deterministic cent-conservation trials.
- **19/19 real-browser scenarios passed**. The suite executes actual property, group, expense, trip, activity and place CRUD; native/custom form validation; scores, shares and balances; favorites; collections; search/date filters; every calendar report tab; CSV/JSON/ICS downloads; malformed and unsupported ICS records; refresh persistence; and the full property/place/trip/expense/calendar handoff.
- **18 populated responsive checks passed**, covering all six pages at 375×812, 768×1024 and 1440×1000. No document-level horizontal overflow. Mobile directory open/close and Escape were checked on every page at mobile/tablet widths. An earlier equivalent matrix captured 18 screenshots; the final regression rechecked layouts without redundantly recapturing them.
- **10 axe-core 4.10.3 scans**: six populated pages and four editing dialogs; zero violations for WCAG 2 A/AA and 2.1 A/AA rules. Keyboard checks executed skip-to-main, menu traversal/Escape, modal Tab wrapping, Escape close and focus restoration.
- **18 distinct internal link/asset requests returned HTTP 200**. Every direct entry point and refresh passed. Header/footer directories, related tools and contextual links stay within the repository base path. Every scenario monitored page/console errors and failed internal requests; none remained.
- Corrupt storage is preserved and blocked from overwrite. Quota failure rolls back memory. Stale tabs cannot silently replace newer data. Backup restoration validates all five workspaces before writing and rolls back partial storage failure.

## Fixes made during QA

Safe identifiers and defensive HTML escaping protect restored records. Duplicate criteria, byte-sized ICS limits, mixed DTEND/DURATION and bounded recurrence expansion are validated. The CSS layer cascade had hidden the mobile toggle; the conflicting important declarations were removed. Dialog Tab wrapping is explicit, and opening mobile navigation now gives deterministic keyboard focus. One test's expected one-cent allocation was corrected to participant-order largest-remainder semantics; the application calculation was already correct. Test-only restore timing and native-function evaluation issues were corrected.

The MIT license remains Git blob `0b1016cff1f769b91a8dae7a10abab41b955bee6`. The original README introduction and Git history are retained. Static packaging validates all JavaScript syntax, local assets/module imports, six physical entry points and the absence of a custom domain.

## Evidence and limitations

[qa-results.json](qa-results.json) records each case, viewport, accessibility finding and checked URL. Detailed execution logs, screenshots and exported reports accompany the delivery evidence. This file describes executed local pre-publication checks; live deployment evidence is verified separately in the final delivery.

See [ARCHITECTURE.md](ARCHITECTURE.md) for local-only storage, browser-timezone itineraries, supported ICS rules/limits, currencies and no-payment/no-live-business scope. Chromium is the executed browser; Firefox/WebKit and a full human screen-reader audit are not claimed. No significant defect remains in the executed scenarios.
