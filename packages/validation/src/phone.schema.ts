import { formatIncompletePhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js/max";
import { z } from "zod";

import { toHalfWidthDigits } from "./common.schema";

/**
 * 電話番号 and FAX番号 through libphonenumber-js (ADR 0009), as the legacy app and romuten-v3. The
 * "max" metadata: the smaller "min" one takes 090 numbers of ten digits as valid.
 */
const REGION = "JP";

/** The legacy fixed-line rule for FAX: ten digits, not 050 / 070 / 080 / 090. */
const FAX_DIGITS = /^0(?!50|[789]0)\d{9}$/;

/** A phone or FAX number as typed, formatted as far as it goes: `0312345` → `03-1234-5`. */
export const formatPhoneNumber = (text: string): string =>
  formatIncompletePhoneNumber(toHalfWidthDigits(text).replace(/\D/g, ""), REGION);

/** 電話番号: a number valid in Japan, stored in its national format (`090-1234-5678`). */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    const phone = parsePhoneNumberFromString(toHalfWidthDigits(value), REGION);
    if (!phone?.isValid()) {
      context.addIssue({ code: "custom", message: "電話番号を入力してください" });
      return z.NEVER;
    }
    return phone.formatNational();
  });

/** FAX番号: a valid fixed-line number, stored in its national format (`03-1234-5678`). */
export const faxSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    const digits = toHalfWidthDigits(value).replace(/[-\s]/g, "");
    const fax = parsePhoneNumberFromString(digits, REGION);
    if (!FAX_DIGITS.test(digits) || !fax?.isValid()) {
      context.addIssue({ code: "custom", message: "正しいFAX番号を入力してください" });
      return z.NEVER;
    }
    return fax.formatNational();
  });
