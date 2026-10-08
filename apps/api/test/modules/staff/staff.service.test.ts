import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listStaffsSchema } from "@repo/validation";
import type { ListStaffsInput } from "@repo/validation";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../src/core/errors";
import * as staffService from "../../../src/modules/staff/staff.service";
import {
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
  staffInput,
  uniqueEmployeeNumber,
} from "../../support";
import type { TestHarness } from "../../support";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
  await ensureTestPostCode(h);
});

afterAll(async () => {
  await h.stop();
});

/** An admin's context (every Admin_Staff row) and a 担当者 to assign. */
const adminWithCharger = async () => {
  const admin = await signedInUser(h, { role: "admin" });
  const charger = await signedInUser(h, { name: "担当 一郎", profile: {} });
  return { ctx: await contextFor(h, admin.headers), chargerId: charger.user.id };
};

/** The query exactly as the router hands it to the service. */
const listQuery = (input: ListStaffsInput) => listStaffsSchema.parse(input);

describe("staff service: create and read", () => {
  it("creates a staff with its address, codes, 担当者 and lists, memos without text left out", async () => {
    const { ctx, chargerId } = await adminWithCharger();

    const staff = await staffService.create(ctx, staffInput([chargerId]));

    expect(staff).toMatchObject({ lastName: "山田", status: "ACTIVE", branchName: "新宿支店" });
    expect(staff.address).toMatchObject({
      address1: "1-2-3",
      sourceAddress: { pref: "東京都", city: "新宿区", town: "新宿" },
    });
    expect(staff.regions.map((region) => region.region.name)).toEqual(["南関東"]);
    expect(staff.prefectures.map((prefecture) => prefecture.prefecture.name)).toEqual(["東京都"]);
    expect(staff.chargers.map((row) => row.user.name)).toEqual(["担当 一郎"]);
    expect(staff.memos.map((memo) => memo.memoType)).toEqual(["STAFF_MEMO"]);
    expect(staff.familyMembers.map((member) => member.firstName)).toEqual(["太郎"]);
    expect((await staffService.getById(ctx, staff.id)).id).toBe(staff.id);
  });

  it("refuses a taken スタッフ番号, unknown reference data and a 担当者 who is not an active user", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const taken = await staffService.create(ctx, staffInput([chargerId]));
    const superAdmin = await signedInUser(h, { role: "super_admin" });
    const gone = await signedInUser(h);
    await h.db.user.update({ where: { id: gone.user.id }, data: { deletedAt: new Date() } });

    await expect(
      staffService.create(ctx, staffInput([chargerId], { employeeNumber: taken.employeeNumber })),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      staffService.create(ctx, staffInput([chargerId], { regionCodes: [99] })),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      staffService.create(
        ctx,
        staffInput([chargerId], { address: { postCode: "0000000", address1: "x" } }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(staffService.create(ctx, staffInput([superAdmin.user.id]))).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(staffService.create(ctx, staffInput([gone.user.id]))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("frees the スタッフ番号 of a deleted staff", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const first = await staffService.create(ctx, staffInput([chargerId]));
    await staffService.changeStatus(ctx, { staffId: first.id, status: "SUSPENDED" });
    await staffService.removeMany(ctx, { staffIds: [first.id] });

    const again = await staffService.create(
      ctx,
      staffInput([chargerId], { employeeNumber: first.employeeNumber }),
    );

    expect(again.employeeNumber).toBe(first.employeeNumber);
    await expect(staffService.getById(ctx, first.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lets a manager read staff but not create them", async () => {
    const manager = await signedInUser(h, { role: "manager" });
    const ctx = await contextFor(h, manager.headers);

    await expect(staffService.list(ctx, listQuery({}))).resolves.toBeDefined();
    await expect(staffService.create(ctx, staffInput([manager.user.id]))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("staff service: update", () => {
  it("replaces the codes and lists, and moves 担当者 keeping who was in charge before", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const next = await signedInUser(h, { name: "後任 次郎", profile: {} });
    const staff = await staffService.create(ctx, staffInput([chargerId]));

    const updated = await staffService.update(ctx, {
      ...staffInput([next.user.id], {
        employeeNumber: staff.employeeNumber,
        areas: ["WEST"],
        regionCodes: [7],
        prefectureCodes: [27],
        familyMembers: [],
        memos: [{ memoType: "CUSTOM", content: "異動" }],
      }),
      staffId: staff.id,
    });

    expect(updated.regions.map((region) => region.regionCode)).toEqual([7]);
    expect(updated.prefectures.map((prefecture) => prefecture.prefectureCode)).toEqual([27]);
    expect(updated.familyMembers).toEqual([]);
    expect(updated.memos.map((memo) => memo.content)).toEqual(["異動"]);
    expect(updated.chargers.map((row) => [row.user.name, row.unassignedAt === null])).toEqual([
      ["担当 一郎", false],
      ["後任 次郎", true],
    ]);
  });
});

describe("staff service: list", () => {
  it("filters, searches by スタッフ番号 and name, and hides 停止 staff unless asked", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const marker = `検索${String(uniqueEmployeeNumber())}`;
    const east = await staffService.create(
      ctx,
      staffInput([chargerId], { lastName: marker, gender: "FEMALE", employeeType: "PART_TIME" }),
    );
    const west = await staffService.create(
      ctx,
      staffInput([chargerId], {
        lastName: marker,
        gender: "MALE",
        areas: ["WEST"],
        regionCodes: [7],
        prefectureCodes: [27],
      }),
    );
    const suspended = await staffService.create(ctx, staffInput([chargerId], { lastName: marker }));
    await staffService.changeStatus(ctx, { staffId: suspended.id, status: "SUSPENDED" });
    const ids = async (input: ListStaffsInput) =>
      (await staffService.list(ctx, listQuery({ search: marker, ...input }))).items
        .map((staff) => staff.id)
        .sort();

    expect(await ids({})).toEqual([east.id, west.id].sort());
    expect(await ids({ statuses: ["SUSPENDED"] })).toEqual([suspended.id]);
    expect(await ids({ genders: ["MALE"] })).toEqual([west.id]);
    expect(await ids({ areas: ["WEST"] })).toEqual([west.id]);
    expect(await ids({ regionCodes: [4] })).toEqual([east.id]);
    expect(await ids({ prefectureCodes: [27] })).toEqual([west.id]);
    expect(await ids({ employeeTypes: ["PART_TIME"] })).toEqual([east.id]);
    const byNumber = await staffService.list(
      ctx,
      listQuery({ search: String(east.employeeNumber) }),
    );
    expect(byNumber.items.map((staff) => staff.id)).toEqual([east.id]);
    expect(byNumber.items[0]?.chargers.map((row) => row.user.name)).toEqual(["担当 一郎"]);
  });
});

describe("staff service: status, delete, lookups", () => {
  it("deletes only 停止 staff, all or nothing", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const active = await staffService.create(ctx, staffInput([chargerId]));
    const suspended = await staffService.create(ctx, staffInput([chargerId]));
    await staffService.changeStatus(ctx, { staffId: suspended.id, status: "SUSPENDED" });

    await expect(
      staffService.removeMany(ctx, { staffIds: [active.id, suspended.id] }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await staffService.removeMany(ctx, { staffIds: [suspended.id] })).toEqual({ count: 1 });
    expect((await staffService.getById(ctx, active.id)).status).toBe("ACTIVE");
  });

  it("tells whether a スタッフ番号 is free and lists the staff a user is in charge of", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const staff = await staffService.create(ctx, staffInput([chargerId]));

    expect(
      await staffService.isEmployeeNumberAvailable(ctx, { employeeNumber: staff.employeeNumber }),
    ).toBe(false);
    expect(
      await staffService.isEmployeeNumberAvailable(ctx, {
        employeeNumber: staff.employeeNumber,
        excludeStaffId: staff.id,
      }),
    ).toBe(true);
    const charged = await staffService.listByCharger(ctx, chargerId);
    expect(charged.map((row) => row.id)).toEqual([staff.id]);
    expect(charged[0]?.regions).toEqual([{ regionCode: 4, region: { name: "南関東" } }]);
  });
});
