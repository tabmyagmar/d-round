import { DEFAULT_LOCALE } from "../../lib/locale";

// Date helpers shared by DateField, DateTimeField and DateRangeField. Dates are handled in the
// browser's local time zone; "iso-date" values are `yyyy-MM-dd` strings without a time part.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, "0");

/** `yyyy-MM-dd` from the local date parts (no time zone shift). */
export const toIsoDate = (date: Date): string =>
  `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** `HH:mm` from the local time parts. */
export const toTimeString = (date: Date): string =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** Accepts a `Date`, an ISO date (`yyyy-MM-dd`) or any string `Date` can parse. */
export const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value !== "string" || value === "") {
    return undefined;
  }
  const match = ISO_DATE.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

/** Apply an `HH:mm` string to a date, returning a new `Date`. */
export const withTime = (date: Date, time: string): Date => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
};

export type DateLocale = Intl.LocalesArgument;

/** `09/11/2026` in en, `2026/09/11` in ja-JP; explicit so server and client render the same. */
export const formatDate = (date: Date, locale: DateLocale = DEFAULT_LOCALE): string =>
  new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(
    date,
  );

export const formatDateTime = (date: Date, locale: DateLocale = DEFAULT_LOCALE): string =>
  new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

/** Drops `undefined` entries so the result satisfies `exactOptionalPropertyTypes` props. */
export const compact = <T extends object>(
  props: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } =>
  Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
