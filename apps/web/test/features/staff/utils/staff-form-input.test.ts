import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StaffFormValues } from "@repo/validation";

import {
  emptyStaffValues,
  staffValuesOf,
  toStaffInput,
} from "@/features/staff/utils/staff-form-input";

import { chargerRow, staffDetail } from "../fixtures";

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 9, 8, 12), toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

const FIXED_SLOTS = ["STAFF_MEMO", "ENTRY_EXIT", "ADDRESS_CHANGE", "INSURANCE", "OTHER"];

describe("emptyStaffValues", () => {
  it("starts with one employment period from today and the five memo slots, as the legacy form", () => {
    const values = emptyStaffValues();

    expect(values.jobHistories).toEqual([
      { hireDate: "2026-10-08", resignationDate: null, resignationReason: null },
    ]);
    expect(values.memos?.map((memo) => memo?.memoType)).toEqual(FIXED_SLOTS);
    expect(values.familyMembers).toEqual([]);
    expect(values.address).toEqual({ postCode: "", address1: "", pref: "", cityTown: "" });
  });
});

describe("staffValuesOf", () => {
  it("reads the stored staff: days of the DATE columns, current 担当者, the master's address parts", () => {
    const staff = staffDetail();

    expect(staffValuesOf(staff)).toMatchObject({
      employeeNumber: 101,
      birthday: "1990-04-01",
      areas: ["EAST"],
      regionCodes: [4],
      prefectureCodes: [13],
      chargerUserIds: [staff.chargers[1]!.userId],
      address: { postCode: "1600022", address1: "1-2-3", pref: "東京都", cityTown: "新宿区新宿" },
      jobHistories: [{ hireDate: "2026-04-01", resignationDate: null, resignationReason: null }],
    });
  });

  it("puts the stored memos into the five slots and the added ones after them", () => {
    const staff = staffDetail();
    const memo = (memoType: StaffFormValues["memos"][number]["memoType"], content: string) => ({
      id: crypto.randomUUID(),
      staffId: staff.id,
      sortOrder: 0,
      memoType,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const values = staffValuesOf({
      ...staff,
      memos: [memo("CUSTOM", "鍵を貸与"), memo("INSURANCE", "社保加入")],
    });

    expect(values.memos).toEqual([
      { memoType: "STAFF_MEMO", content: "" },
      { memoType: "ENTRY_EXIT", content: "" },
      { memoType: "ADDRESS_CHANGE", content: "" },
      { memoType: "INSURANCE", content: "社保加入" },
      { memoType: "OTHER", content: "" },
      { memoType: "CUSTOM", content: "鍵を貸与" },
    ]);
  });

  it("leaves what the legacy import left empty for the user", () => {
    const values = staffValuesOf(
      staffDetail({ birthday: null, position: null, address: null, chargers: [] }),
    );

    expect(values).not.toHaveProperty("birthday");
    expect(values).not.toHaveProperty("position");
    expect(values.address).toEqual({ postCode: "", address1: "", pref: "", cityTown: "" });
    expect(values.chargerUserIds).toEqual([]);
  });

  it("names a charger who has left the staff nowhere", () => {
    const staff = staffDetail();
    const gone = chargerRow(staff.id, "退任 花子", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z");

    expect(staffValuesOf({ ...staff, chargers: [gone] }).chargerUserIds).toEqual([]);
  });
});

describe("toStaffInput", () => {
  it("sends the address without the display parts and only memos with text", () => {
    const input = toStaffInput({
      address: { postCode: "1600022", address1: "1-2-3", pref: "東京都", cityTown: "新宿区新宿" },
      memos: [
        { memoType: "STAFF_MEMO", content: "週3日" },
        { memoType: "ENTRY_EXIT", content: "  " },
      ],
    } as StaffFormValues);

    expect(input.address).toEqual({ postCode: "1600022", address1: "1-2-3" });
    expect(input.memos).toEqual([{ memoType: "STAFF_MEMO", content: "週3日" }]);
  });
});
