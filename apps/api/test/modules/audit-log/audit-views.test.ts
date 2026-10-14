import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPermissionRepository, createUserRepository } from "@repo/database";
import { AUDIT_FIELDS, maskedAuditFields } from "@repo/validation";
import type {
  AuditEntityType,
  CreateBranchInput,
  CreateClientInput,
  CreateStaffInput,
  InviteUserInput,
  UserProfileInput,
} from "@repo/validation";

import { diffViews } from "../../../src/modules/audit-log/audit-log.service";
import {
  branchAuditView,
  branchLabelOf,
  clientAuditView,
  clientLabelOf,
  staffAuditView,
  staffLabelOf,
  userAuditView,
  userLabelOf,
} from "../../../src/modules/audit-log/audit-views";
import * as branchService from "../../../src/modules/branch/branch.service";
import * as clientService from "../../../src/modules/client/client.service";
import * as staffService from "../../../src/modules/staff/staff.service";
import {
  branchInput,
  clientInput,
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
  staffInput,
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

const keysOf = (entityType: AuditEntityType): string[] =>
  AUDIT_FIELDS[entityType].map((field) => field.key);

const adminContext = async () => contextFor(h, (await signedInUser(h, { role: "admin" })).headers);

/**
 * Where each field of a create form shows in its entity's audit view. Typed by the form's input, so
 * a new form field does not compile until it is mapped here — to view fields, or to none on purpose.
 */
const CLIENT_FORM: Record<keyof CreateClientInput, readonly string[]> = {
  number: ["number"],
  name: ["name"],
  nameKana: ["nameKana"],
  areas: ["areas"],
  regionCodes: ["regions"],
  chargerUserIds: ["chargers"],
  address: ["postCode", "prefCity", "address1"],
  phoneNumber: ["phoneNumber"],
  fax: ["fax"],
  webUrl: ["webUrl"],
  orderTypes: ["orderTypes"],
};

const BRANCH_FORM: Record<keyof CreateBranchInput, readonly string[]> = {
  // The branch's client is part of its label (`1024-1 新宿店`), not of its fields.
  clientId: [],
  number: ["number"],
  name: ["name"],
  nameKana: ["nameKana"],
  area: ["area"],
  regionCode: ["region"],
  chargerUserIds: ["chargers"],
  departmentNumber: ["departmentNumber"],
  departmentName: ["departmentName"],
  departmentNameKana: ["departmentNameKana"],
  departmentFax: ["departmentFax"],
  address: ["postCode", "prefCity", "address1"],
  contactLastName: ["contactLastName"],
  contactFirstName: ["contactFirstName"],
  contactLastNameKana: ["contactLastNameKana"],
  contactFirstNameKana: ["contactFirstNameKana"],
  contactPosition: ["contactPosition"],
  contactEmail: ["contactEmail"],
  memo: ["memo"],
};

const STAFF_FORM: Record<keyof CreateStaffInput, readonly string[]> = {
  employeeType: ["employeeType"],
  employeeNumber: ["employeeNumber"],
  lastName: ["lastName"],
  firstName: ["firstName"],
  lastNameKana: ["lastNameKana"],
  firstNameKana: ["firstNameKana"],
  gender: ["gender"],
  birthday: ["birthday"],
  position: ["position"],
  branchName: ["branchName"],
  email: ["email"],
  phoneNumber: ["phoneNumber"],
  emergencyPhoneNumber: ["emergencyPhoneNumber"],
  areas: ["areas"],
  regionCodes: ["regions"],
  prefectureCodes: ["prefectures"],
  chargerUserIds: ["chargers"],
  address: ["postCode", "prefCity", "address1"],
  jobHistories: ["jobHistories", "hireDate", "resignationDate", "resignationReason"],
  familyMembers: ["familyMembers"],
  memos: ["memos"],
  resumeIds: ["resumes"],
};

const USER_FORM: Record<keyof InviteUserInput, readonly string[]> = {
  email: ["email"],
  lastName: ["lastName"],
  firstName: ["firstName"],
  lastNameKana: ["lastNameKana"],
  firstNameKana: ["firstNameKana"],
  role: ["role"],
  permissionKeys: ["permissions"],
  profile: [],
  // The プロフィール画像 is not audited: a picture, no record of anything.
  avatarId: [],
};

const USER_PROFILE_FORM: Record<keyof UserProfileInput, readonly string[]> = {
  employeeNumber: ["employeeNumber"],
  departmentName: ["departmentName"],
  position: ["position"],
  retirementDate: ["retirementDate"],
  areas: ["areas"],
  regionCodes: ["regions"],
};

describe("audit views", () => {
  it("map every field of the create forms to fields of the registry", () => {
    const unmapped = (entityType: AuditEntityType, form: Record<string, readonly string[]>) =>
      Object.values(form)
        .flat()
        .filter((key) => !keysOf(entityType).includes(key));

    expect(unmapped("Client", CLIENT_FORM)).toEqual([]);
    expect(unmapped("Branch", BRANCH_FORM)).toEqual([]);
    expect(unmapped("Staff", STAFF_FORM)).toEqual([]);
    expect(unmapped("User", { ...USER_FORM, ...USER_PROFILE_FORM })).toEqual([]);
  });

  it("show a client as the download writes it, in the registry's order", async () => {
    const ctx = await adminContext();
    const charger = await signedInUser(h, { name: "担当 一郎" });

    const client = await clientService.create(ctx, clientInput([charger.user.id]));
    const view = clientAuditView(client);

    expect(Object.keys(view)).toEqual(keysOf("Client"));
    expect(view).toMatchObject({
      number: String(client.number),
      areas: "東日本",
      chargers: "担当 一郎",
      fax: "",
      orderTypes: "派遣",
      status: "利用中",
    });
    expect(clientLabelOf(client)).toBe(`${String(client.number)} 株式会社テスト`);
  });

  it("show a branch with its memo and label it under its client", async () => {
    const ctx = await adminContext();
    const charger = await signedInUser(h);
    const client = await clientService.create(ctx, clientInput([charger.user.id]));

    const branch = await branchService.create(
      ctx,
      branchInput(client.id, [charger.user.id], { memo: "鍵は守衛室" }),
    );
    const view = branchAuditView(branch);

    expect(Object.keys(view)).toEqual(keysOf("Branch"));
    expect(view).toMatchObject({ region: "南関東", memo: "鍵は守衛室", status: "利用中" });
    expect(branchLabelOf(branch)).toBe(`${String(client.number)}-1 新宿店`);
  });

  it("show a staff with every period, family member, memo and 履歴書", async () => {
    const ctx = await adminContext();
    const charger = await signedInUser(h);

    const staff = await staffService.create(ctx, staffInput([charger.user.id]));
    const view = staffAuditView(
      staff,
      staff.resumes.map((resume) => resume.fileName),
    );

    expect(Object.keys(view)).toEqual(keysOf("Staff"));
    expect(view).toMatchObject({
      birthday: "1990/04/01",
      jobHistories: "2020/04/01〜",
      familyMembers: "山田 太郎 夫",
      memos: "スタッフメモ: 面談済み",
      resumes: "",
    });
    expect(staffLabelOf(staff)).toBe(`${String(staff.employeeNumber)} 山田 花子`);
  });

  it("show a 担当者 with the アカウントタイプ and the permission overrides by name", async () => {
    const manager = await signedInUser(h, { role: "manager", name: "権限 次郎", profile: {} });
    await createPermissionRepository(h.db).replaceUserOverrides(
      manager.user.id,
      [{ permissionKey: "1301", effect: "ALLOW" }],
      manager.user.id,
    );
    const user = await createUserRepository(h.db).findById(manager.user.id);
    const names = new Map(
      (await createPermissionRepository(h.db).findVisibleCatalog()).map((row) => [
        row.key,
        row.nameJp,
      ]),
    );

    const view = userAuditView(
      user!,
      await createPermissionRepository(h.db).findUserOverrides(manager.user.id),
      names,
    );

    expect(Object.keys(view)).toEqual(keysOf("User"));
    expect(view).toMatchObject({
      role: "マネジャー",
      permissions: `＋${names.get("1301") ?? ""}`,
      status: "利用中",
    });
    expect(userLabelOf(user!)).toBe(`${String(user!.profile?.employeeNumber)} 権限 次郎`);
  });

  it("record a masked field as changed, without its values", async () => {
    const ctx = await adminContext();
    const staff = await staffService.create(ctx, staffInput([(await signedInUser(h)).user.id]));
    const before = staffAuditView(staff, []);

    const changes = diffViews(
      before,
      staffAuditView({ ...staff, phoneNumber: "080-9999-9999", branchName: "渋谷支店" }, []),
      maskedAuditFields("Staff"),
    );

    expect(changes).toEqual([
      { field: "branchName", before: "新宿支店", after: "渋谷支店" },
      { field: "phoneNumber", masked: true },
    ]);
    expect(JSON.stringify(changes)).not.toContain("080-9999-9999");
  });
});
