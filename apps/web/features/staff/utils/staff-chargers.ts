/** One day in milliseconds: a resignation date (a calendar day) ends at the next midnight. */
const DAY_MS = 86_400_000;

type ChargerPeriod = { createdAt: Date; unassignedAt: Date | null };

/**
 * The 担当者 in charge at some point of an employment period — 在籍情報's 担当者 column: assigned
 * before the period ended and not unassigned before it began. The legacy
 * `chargePersonNames` counted only the assignments made inside the period, having no end date to
 * compare (ADR 0008, `unassigned_at`).
 */
export const chargersDuring = <TCharger extends ChargerPeriod>(
  chargers: readonly TCharger[],
  period: { hireDate: Date; resignationDate: Date | null },
): TCharger[] =>
  chargers.filter(
    (charger) =>
      (period.resignationDate === null ||
        charger.createdAt.getTime() < period.resignationDate.getTime() + DAY_MS) &&
      (charger.unassignedAt === null || charger.unassignedAt >= period.hireDate),
  );
