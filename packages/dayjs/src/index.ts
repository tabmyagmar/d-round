import dayjsModule from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import "dayjs/locale/ja.js";

/**
 * dayjs configured once for every workspace (romuten-v3 `packages/dayjs`): utc, timezone and
 * customParseFormat, Japanese locale. Date arithmetic and conversions go through it instead of
 * hand-written `Date` code; `@repo/ui` keeps `Date` and `Intl` at the react-day-picker boundary.
 */
// One instance for the whole repo; the plugins extend the module itself (the same object).
const dayjs = dayjsModule;
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.locale("ja");

/** The business time zone: 今日 is a day in Japan, wherever the code runs. */
export const TIME_ZONE = "Asia/Tokyo";

/** A calendar day as the forms and the API exchange it. */
export const ISO_DAY = "YYYY-MM-DD";

/** A DATE column's value (midnight UTC) as its calendar day, e.g. `2026-04-01`. */
export const toIsoDay = (date: Date): string => dayjs.utc(date).format(ISO_DAY);

/** A calendar day as a DATE column takes it: midnight UTC of that day. */
export const fromIsoDay = (isoDay: string): Date => dayjs.utc(isoDay, ISO_DAY, true).toDate();

/** Today in Japan as a calendar day. */
export const todayIsoDay = (): string => dayjs().tz(TIME_ZONE).format(ISO_DAY);

export { dayjs };
