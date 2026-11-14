# Architecture and supported limits

## Design

Static HTML entry points load one shared ES-module shell and their own app module. Shared pure domain functions are independently tested. No runtime third-party assets, network APIs, tracking or payment processing are used. Fonts use the system stack; icons are local SVG markup. CSS uses responsive grids, contrast-conscious colors and reduced-motion support.

Storage schemas validate imported/restored data before writing. Identifier validation and HTML escaping protect rendered user content; website links permit only HTTP(S). Writes detect stale tabs and restore in-memory state on failure. Full backup restoration validates all entries first and attempts rollback after a quota error. Browser storage is not an encrypted or server-backed database.

## Financial and property calculations

All supported currencies use two decimals: EUR, USD, GBP, BRL, CAD, AUD, INR, MXN, CHF and ZAR. There is no currency conversion. Expense shares use largest-remainder allocation with participant-order tie-breaking, so every cent is allocated. Zero weights exclude a participant. New participants do not retroactively join existing expense splits. Settlement optimization maximizes disjoint zero-sum subsets with bounded subset dynamic programming; the result is an exact minimum number of transfers for up to 12 participants. Suggestions do not record or execute actual payments.

Property scores normalize weighted subjective 0–10 ratings to 100. Price and size ratings are user assessments, not automatically inferred valuations. A new criterion contributes zero until an existing property's rating is edited. Different-currency prices are not converted.

## Calendar scope

ICS: maximum 2 MB UTF-8 and 5,000 expanded events per file, 10,000 combined stored audit events. Handles folded/escaped text, UTC/floating/IANA times, all-day exclusive ends, durations, cancellations, transparent events, RDATE/EXDATE and individual recurrence overrides. Supports DAILY/WEEKLY/MONTHLY/YEARLY rules with INTERVAL, COUNT, UNTIL, non-ordinal BYDAY, BYMONTHDAY, BYMONTH and WKST. Recurrences are bounded to 730 days after each series start; truncation and unsupported records are explicitly reported.

Not a full RFC 5545 engine: custom VTIMEZONE definitions, ordinal BYDAY, sub-daily rules, RDATE periods, and advanced recurrence transformations are not supported. Ambiguous DST times select the earlier instant; nonexistent times are rejected/skipped with a note. Use Replace ICS events when refreshing an edited calendar; merge mode is intentionally additive and cannot infer deletions from absent records.

Overlapping endpoints do not conflict. Zero-duration and transparent events do not occupy time. Busy totals are interval unions. Weeks start Monday. Open windows cover 09:00–18:00 on days containing events, including leading/trailing workday space; these are not working-hours preferences or availability guarantees. Dense reports retain exact counts but cap detailed conflict rows at 10,000 with an explicit warning. Very long event spans are bounded to 3,660 days.

Trip times are interpreted in the current browser timezone, not automatically converted to the destination timezone. Review them before cross-timezone travel. Trips span at most 366 days. Calendar sync copies are refreshed manually; deleting a trip or place does not silently delete previously recorded expenses or calendar copies.

## Local Guide and persistence

All places, ratings, addresses and useful information are supplied by the user, not verified live listings. Collections are user-entered tags (up to 20 per place). No maps, geolocation, recommendations API or live hours are implied.

No login, cross-device sync, collaboration, background calendar sync, service worker or guaranteed offline reload is included. Files may remain cached, but the first load and an uncached refresh require network access. Current automated browser coverage uses Chromium; Firefox/WebKit have not been executed in this environment. Automated axe checks supplement rather than replace a complete human assistive-technology audit.
