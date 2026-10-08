import { dayjs } from "@repo/dayjs";

type ChargerPeriod = { createdAt: Date; unassignedAt: Date | null };

/**
 * The 担当者 in charge at some point of an employment period — 在籍情報's 担当者 column: assigned
 * before the period ended (a resignation date is a whole day, so it ends at the next midnight) and
 * not unassigned before it began. The legacy `chargePersonNames` counted only the assignments
 * made inside the period, having no end date to compare (ADR 0008, `unassigned_at`).
 */
export const chargersDuring = <TCharger extends ChargerPeriod>(
  chargers: readonly TCharger[],
  period: { hireDate: Date; resignationDate: Date | null },
): TCharger[] =>
  chargers.filter(
    (charger) =>
      (period.resignationDate === null ||
        dayjs(charger.createdAt).isBefore(dayjs.utc(period.resignationDate).add(1, "day"))) &&
      (charger.unassignedAt === null || !dayjs(charger.unassignedAt).isBefore(period.hireDate)),
  );
