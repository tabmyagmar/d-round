import { describe, expect, it } from "vitest";

import { chargersDuring } from "@/features/staff/utils/staff-chargers";

const at = (iso: string) => new Date(iso);

/** A charger assigned at `from` and, unless `to` is null, unassigned at `to`. */
const charger = (name: string, from: string, to: string | null = null) => ({
  name,
  createdAt: at(from),
  unassignedAt: to === null ? null : at(to),
});

const names = (chargers: readonly { name: string }[]) => chargers.map((c) => c.name);

describe("chargersDuring", () => {
  const chargers = [
    charger("before-and-gone", "2019-01-10T00:00:00Z", "2019-12-31T00:00:00Z"),
    charger("before-and-staying", "2019-06-01T00:00:00Z"),
    charger("inside", "2021-03-01T09:00:00Z", "2021-09-01T00:00:00Z"),
    charger("on-the-last-day", "2022-03-31T10:00:00Z"),
    charger("after", "2022-04-01T00:00:00Z"),
  ];

  it("lists those in charge at some point of a closed period, the last day included", () => {
    expect(
      names(
        chargersDuring(chargers, {
          hireDate: at("2020-04-01T00:00:00Z"),
          resignationDate: at("2022-03-31T00:00:00Z"),
        }),
      ),
    ).toEqual(["before-and-staying", "inside", "on-the-last-day"]);
  });

  it("lists everyone not gone before the hire date while the staff is still employed", () => {
    expect(
      names(
        chargersDuring(chargers, { hireDate: at("2021-06-01T00:00:00Z"), resignationDate: null }),
      ),
    ).toEqual(["before-and-staying", "inside", "on-the-last-day", "after"]);
  });

  it("lists nobody for a period no charger covered", () => {
    expect(
      chargersDuring(chargers, {
        hireDate: at("2018-01-01T00:00:00Z"),
        resignationDate: at("2018-12-31T00:00:00Z"),
      }),
    ).toEqual([]);
  });
});
