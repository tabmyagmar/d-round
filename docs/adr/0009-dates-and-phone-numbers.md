# ADR 0009 — Dates through dayjs, phone numbers through libphonenumber-js

Date: 2026-10-08 · Status: accepted

## Context

The staff ticket's code handled dates with hand-written `Date` code — `toISOString().slice(0, 10)`
for DATE columns, `getMonth()` / `getDate()` for an age, a `DAY_MS` constant for a period end,
`new Date(iso)` before a write — so each line chose between local time and UTC on its own, and
"today" depended on the time zone of the machine running it. Phone numbers were checked by a
hand-written regex that accepted numbers that do not exist and formatted nothing. The legacy
d-round-web and romuten-v3 use dayjs (romuten-v3 as one shared workspace package, `packages/dayjs`)
and libphonenumber-js (`shared/lib/schemas/stringSchemas.ts`,
`apps/web/src/lib/utils/common-schemas.ts`).

## Decision

- **Dates:** one workspace package, `@repo/dayjs`, as romuten-v3's: dayjs 1.11.23 extended once with
  utc, timezone and customParseFormat and the Japanese locale, plus the calendar-day helpers every
  layer needs — `toIsoDay` (a DATE column's midnight UTC as `yyyy-MM-dd`), `fromIsoDay`
  (`yyyy-MM-dd` to the midnight UTC a DATE column takes) and `todayIsoDay` (today in `Asia/Tokyo`).
  Workspaces import dayjs only from it. Its plugin imports carry `.js`, because the API and worker
  bundles keep node_modules external and Node's ESM resolver needs the extension. `@repo/ui` keeps
  `Date` and `Intl` at the react-day-picker boundary: `DateField` emits `yyyy-MM-dd`, `formatDate`
  follows the template's locale.
- **Phone numbers:** libphonenumber-js 1.13.14 in `@repo/validation`. `phoneSchema` accepts a number
  libphonenumber-js parses as valid for Japan and stores its national format (`090-1234-5678`);
  `faxSchema` keeps the legacy fixed-line rule (ten digits, not 050 / 070 / 080 / 090) and stores
  the same format. The forms format as the user types (`formatPhoneNumber`, `formatFaxNumber`,
  `formatPostCode`), as the legacy fields did.

## Alternatives

- Native `Date` only: the conversions stay hand-written, and the time zone stays whatever the
  runtime has.
- date-fns: romuten-v3's web app lists it, but its shared code uses dayjs; one library is enough.
- Temporal: not available in Node 24 or every browser without a flag yet.
- Keeping the phone regex: no real number check, no formatting, and no fax rule.

## Consequences

- A date conversion or "today" is one helper call, the same in the browser, the API and the worker;
  a new plugin is added in `packages/dayjs` once.
- libphonenumber-js adds its metadata to the web bundle (the "min" build, as the legacy app).
- Revisit the date choice when Temporal ships in Node and the supported browsers.
