/**
 * THE PERMISSION SPEC — unit half.
 *
 * The rules are grant-driven: a signed-in user carries effective catalog grants
 * `{ action, subject }` and `defineRules` turns every grant it knows into an unscoped `can`, then
 * adds the row rules: the self rule on the own User row and the owner rule on the user's own
 * CommentTemplate rows (personal data no catalog row grants), and the reference rule (every
 * signed-in user reads `Source`). This file knows nothing about roles: which role holds
 * which grant is the catalog's business (`permissions.csv`, proven against the database by
 * `apps/api/test/permission-catalog.test.ts`). Changing the shape of a rule means changing this
 * file first — the failing cell documents the change — then `rules.ts`.
 */
import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import { describe, expect, it } from "vitest";

import type { Branch, Client, CommentTemplate, Staff, User } from "@repo/database";

import { canUnscoped, commentTemplateSubject, defineAbilityFor, userSubject } from "../src/ability";
import type { AppAbility } from "../src/ability";
import { ACTIONS, SUBJECT_NAMES, isAction, isSubjectName } from "../src/rules";
import type { AbilityUser, Action, PermissionGrant, SubjectName } from "../src/rules";
import {
  accessibleBranchesWhere,
  accessibleClientsWhere,
  accessibleCommentTemplatesWhere,
  accessibleStaffWhere,
  accessibleUsersWhere,
  canUnscoped as serverCanUnscoped,
  definePrismaAbilityFor,
  prismaBranchSubject,
  prismaClientSubject,
  prismaCommentTemplateSubject,
  prismaStaffSubject,
  prismaUserSubject,
} from "../src/server";
import type { ServerAbility } from "../src/server";

/**
 * Whose row a cell is about: the current user's own (their User row, a CommentTemplate they own)
 * or anybody else's.
 */
type Relation = "self" | "other";

const ME_ID = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e";
const OTHER_ID = "019187d5-0d76-7d1a-9a4c-000000000002";

/** A signed-in user holding exactly these grants. The role is not an input to the rules. */
const holder = (permissions: readonly PermissionGrant[]): AbilityUser => ({
  id: ME_ID,
  role: "am",
  permissions,
});

/** The subjects a row rule looks into; they are asked on a row, every other subject on its type. */
const ROW_SUBJECTS: readonly SubjectName[] = ["User", "CommentTemplate"];

/**
 * One cell of the spec: an action on a subject. A row subject is asked twice (own row, someone
 * else's row); every other subject is asked on its type.
 */
type Cell = { action: Action; subject: SubjectName; relation: Relation };

const CELLS: Cell[] = ACTIONS.flatMap((action) =>
  SUBJECT_NAMES.flatMap((subject): Cell[] =>
    ROW_SUBJECTS.includes(subject)
      ? [
          { action, subject, relation: "self" },
          { action, subject, relation: "other" },
        ]
      : [{ action, subject, relation: "other" }],
  ),
);

const cellKey = ({ action, subject, relation }: Cell): string =>
  ROW_SUBJECTS.includes(subject) ? `${action} ${subject} (${relation})` : `${action} ${subject}`;

const rowId = (relation: Relation): string => (relation === "self" ? ME_ID : OTHER_ID);

/** A complete Prisma User row, so the server ability is asked with its real subject type. */
const userRow = (id: string): User => ({
  id,
  name: "Someone",
  email: `${id}@example.com`,
  emailVerified: true,
  image: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  role: "am",
  banned: false,
  banReason: null,
  banExpires: null,
  deletedAt: null,
  lastName: null,
  firstName: null,
  lastNameKana: null,
  firstNameKana: null,
});

/** A complete Prisma CommentTemplate row owned by `createdBy`. */
const templateRow = (createdBy: string): CommentTemplate => ({
  id: "019187d5-0d76-7d1a-9a4c-000000000101",
  createdBy,
  types: ["WORKFLOW"],
  short: "承認",
  content: "承認します。",
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

const browserSubject = (cell: Cell) => {
  if (cell.subject === "User") {
    return userSubject({ id: rowId(cell.relation) });
  }
  if (cell.subject === "CommentTemplate") {
    return commentTemplateSubject({ createdBy: rowId(cell.relation) });
  }
  return cell.subject;
};

const serverSubject = (cell: Cell) => {
  if (cell.subject === "User") {
    return prismaUserSubject(userRow(rowId(cell.relation)));
  }
  if (cell.subject === "CommentTemplate") {
    return prismaCommentTemplateSubject(templateRow(rowId(cell.relation)));
  }
  return cell.subject;
};

/** Every cell's answer from the browser ability, keyed so a failure shows the exact cell. */
const browserAnswers = (ability: AppAbility): Record<string, boolean> =>
  Object.fromEntries(
    CELLS.map((cell) => [cellKey(cell), ability.can(cell.action, browserSubject(cell))]),
  );

/** The same cells answered by the server (prisma) ability. */
const serverAnswers = (ability: ServerAbility): Record<string, boolean> =>
  Object.fromEntries(
    CELLS.map((cell) => [cellKey(cell), ability.can(cell.action, serverSubject(cell))]),
  );

/** The self rule: everyone may read and update their own User row. */
const isSelfRule = ({ action, subject, relation }: Cell): boolean =>
  subject === "User" && relation === "self" && (action === "read" || action === "update");

/** The owner rule: everyone may create, read, update and delete their own 定型文. */
const isOwnerRule = ({ action, subject, relation }: Cell): boolean =>
  subject === "CommentTemplate" &&
  relation === "self" &&
  (action === "create" || action === "read" || action === "update" || action === "delete");

/** The reference rule: every signed-in user reads reference data (regions, post codes). */
const isReferenceRule = ({ action, subject }: Cell): boolean =>
  subject === "Source" && action === "read";

/** What a signed-in user holding exactly `grants` may do: the granted cells plus the rules. */
const expectedFor = (grants: readonly PermissionGrant[]): Record<string, boolean> =>
  Object.fromEntries(
    CELLS.map((cell) => [
      cellKey(cell),
      isSelfRule(cell) ||
        isOwnerRule(cell) ||
        isReferenceRule(cell) ||
        grants.some((grant) => grant.action === cell.action && grant.subject === cell.subject),
    ]),
  );

const NOTHING: Record<string, boolean> = Object.fromEntries(
  CELLS.map((cell) => [cellKey(cell), false]),
);

/** Every single-grant holder, labelled — the inputs for the grant-by-grant specs below. */
const SINGLE_GRANTS: PermissionGrant[] = ACTIONS.flatMap((action) =>
  SUBJECT_NAMES.map((subject): PermissionGrant => ({ action, subject })),
);

describe("the typed lists", () => {
  it("accept every action and every subject name of the catalog", () => {
    expect(ACTIONS).toEqual(["create", "read", "update", "delete", "status", "changeRole"]);
    expect(SUBJECT_NAMES).toEqual([
      "User",
      "Client",
      "Staff",
      "Branch",
      "AuditLog",
      "Workflow",
      "WorkflowTemplate",
      "SourceCsvHistory",
      "CommentTemplate",
      "Source",
    ]);
    for (const action of ACTIONS) {
      expect(isAction(action)).toBe(true);
    }
    for (const subject of SUBJECT_NAMES) {
      expect(isSubjectName(subject)).toBe(true);
    }
  });

  it.each(["all", "manage", "", "Read", "READ", "create "])('reject the action "%s"', (value) => {
    expect(isAction(value)).toBe(false);
  });

  it.each(["all", "", "user", "Admin_User", "Invoice", "User "])(
    'reject the subject "%s"',
    (value) => {
      expect(isSubjectName(value)).toBe(false);
    },
  );
});

describe("one grant allows exactly its cell on other rows (plus the self rule)", () => {
  it.each(SINGLE_GRANTS)("$action $subject", (grant) => {
    expect(browserAnswers(defineAbilityFor(holder([grant])))).toEqual(expectedFor([grant]));
  });

  it("a `changeRole User` grant does not allow `update` on other rows, and vice versa", () => {
    const other = userSubject({ id: OTHER_ID });
    const changeRole = defineAbilityFor(holder([{ action: "changeRole", subject: "User" }]));
    expect(changeRole.can("changeRole", other)).toBe(true);
    expect(changeRole.can("update", other)).toBe(false);

    const update = defineAbilityFor(holder([{ action: "update", subject: "User" }]));
    expect(update.can("update", other)).toBe(true);
    expect(update.can("changeRole", other)).toBe(false);
  });

  it("grants add up: two grants allow both cells and nothing else", () => {
    const grants: PermissionGrant[] = [
      { action: "read", subject: "Client" },
      { action: "delete", subject: "User" },
    ];
    expect(browserAnswers(defineAbilityFor(holder(grants)))).toEqual(expectedFor(grants));
  });
});

describe("the self rule", () => {
  it("with no grants a user may read and update their own row and nothing else", () => {
    const ability = defineAbilityFor(holder([]));
    const self = userSubject({ id: ME_ID });
    const other = userSubject({ id: OTHER_ID });

    expect(ability.can("read", self)).toBe(true);
    expect(ability.can("update", self)).toBe(true);
    for (const action of ["create", "delete", "status", "changeRole"] as const) {
      expect(ability.can(action, self)).toBe(false);
    }
    expect(ability.can("read", other)).toBe(false);
    expect(ability.can("update", other)).toBe(false);
    expect(browserAnswers(ability)).toEqual(expectedFor([]));
  });
});

describe("the owner rule (personal 定型文)", () => {
  it("with no grants a user may create, read, update and delete their own templates, never another user's", () => {
    const ability = defineAbilityFor(holder([]));
    const own = commentTemplateSubject({ createdBy: ME_ID });
    const others = commentTemplateSubject({ createdBy: OTHER_ID });

    for (const action of ["create", "read", "update", "delete"] as const) {
      expect(ability.can(action, own)).toBe(true);
      expect(ability.can(action, others)).toBe(false);
    }
    expect(ability.can("status", own)).toBe(false);
    expect(ability.can("changeRole", own)).toBe(false);
  });

  it("lets every signed-in user past the type-level check, but never unscoped", () => {
    const ability = defineAbilityFor(holder([]));
    expect(ability.can("delete", "CommentTemplate")).toBe(true);
    expect(canUnscoped(ability, "read", "CommentTemplate")).toBe(false);
  });
});

describe("the reference rule (Source)", () => {
  it("lets every signed-in user read reference data unscoped and write none of it", () => {
    const ability = defineAbilityFor(holder([]));

    expect(ability.can("read", "Source")).toBe(true);
    expect(canUnscoped(ability, "read", "Source")).toBe(true);
    for (const action of ["create", "update", "delete", "status", "changeRole"] as const) {
      expect(ability.can(action, "Source")).toBe(false);
    }
    expect(defineAbilityFor(null).can("read", "Source")).toBe(false);
  });
});

describe("grants the rules do not know are ignored (fail closed)", () => {
  it.each(SUBJECT_NAMES)("a parent row grant `all %s` allows nothing", (subject) => {
    const ability = defineAbilityFor(holder([{ action: "all", subject }]));
    expect(browserAnswers(ability)).toEqual(expectedFor([]));
  });

  // `manage` and `all` are CASL wildcards: without the guard in `defineRules` these three would
  // grant every action and/or every subject.
  it.each([
    { action: "manage", subject: "User" },
    { action: "read", subject: "all" },
    { action: "manage", subject: "all" },
    { action: "read", subject: "Invoice" },
    { action: "read", subject: "user" },
    { action: "READ", subject: "User" },
    { action: "", subject: "" },
  ])('"$action $subject" allows nothing', (grant) => {
    expect(browserAnswers(defineAbilityFor(holder([grant])))).toEqual(expectedFor([]));
  });

  it("an unknown grant next to a known one does not disturb the known one", () => {
    const known: PermissionGrant = { action: "read", subject: "Client" };
    const ability = defineAbilityFor(holder([{ action: "all", subject: "Client" }, known]));
    expect(browserAnswers(ability)).toEqual(expectedFor([known]));
  });
});

describe("an anonymous visitor", () => {
  it("can do nothing, in the browser and on the server", () => {
    expect(browserAnswers(defineAbilityFor(null))).toEqual(NOTHING);
    expect(serverAnswers(definePrismaAbilityFor(null))).toEqual(NOTHING);
  });
});

describe("the server (prisma) ability answers exactly like the browser ability", () => {
  const holders: [string, AbilityUser][] = [
    ["no grants", holder([])],
    ["a parent row grant", holder([{ action: "all", subject: "User" }])],
    ...SINGLE_GRANTS.map((grant): [string, AbilityUser] => [
      `${grant.action} ${grant.subject}`,
      holder([grant]),
    ]),
  ];

  it.each(holders)("for a user holding %s", (_label, user) => {
    expect(serverAnswers(definePrismaAbilityFor(user))).toEqual(
      browserAnswers(defineAbilityFor(user)),
    );
  });
});

describe("canUnscoped", () => {
  it("is true with the `read User` grant (an unconditional rule)", () => {
    const ability = defineAbilityFor(holder([{ action: "read", subject: "User" }]));
    expect(canUnscoped(ability, "read", "User")).toBe(true);
  });

  it("is false with the self rule only: `can` on the bare type is optimistic, the unscoped check is not", () => {
    const ability = defineAbilityFor(holder([]));
    expect(ability.can("read", "User")).toBe(true);
    expect(canUnscoped(ability, "read", "User")).toBe(false);
  });

  it("is false when the unconditional rule is for another cell", () => {
    const ability = defineAbilityFor(holder([{ action: "read", subject: "Client" }]));
    expect(canUnscoped(ability, "read", "Client")).toBe(true);
    expect(canUnscoped(ability, "read", "User")).toBe(false);
    expect(canUnscoped(ability, "update", "Client")).toBe(false);
  });

  it("is false for an anonymous visitor", () => {
    expect(canUnscoped(defineAbilityFor(null), "read", "User")).toBe(false);
  });

  it("answers the same on the server ability: the grant opens a cell, the self rule does not", () => {
    const granted = definePrismaAbilityFor(holder([{ action: "update", subject: "User" }]));
    const selfOnly = definePrismaAbilityFor(holder([]));

    expect(serverCanUnscoped(granted, "update", "User")).toBe(true);
    expect(selfOnly.can("update", "User")).toBe(true);
    expect(serverCanUnscoped(selfOnly, "update", "User")).toBe(false);
    expect(serverCanUnscoped(definePrismaAbilityFor(null), "update", "User")).toBe(false);
  });

  it("honours CASL priority: a later unconditional `cannot` overrides an earlier `can`", () => {
    const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
    builder.can("read", "User");
    builder.cannot("read", "User");
    expect(canUnscoped(builder.build(), "read", "User")).toBe(false);
  });

  it("honours CASL priority: a later unconditional `can` overrides an earlier `cannot`", () => {
    const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
    builder.cannot("read", "User");
    builder.can("read", "User");
    expect(canUnscoped(builder.build(), "read", "User")).toBe(true);
  });
});

describe("accessibleUsersWhere", () => {
  it("restricts a user without the `read User` grant to their own row", () => {
    const where = accessibleUsersWhere(definePrismaAbilityFor(holder([])));
    expect(JSON.stringify(where)).toContain(ME_ID);
    expect(JSON.stringify(where)).not.toContain(OTHER_ID);
  });

  it("does not restrict a user holding the `read User` grant", () => {
    const where = accessibleUsersWhere(
      definePrismaAbilityFor(holder([{ action: "read", subject: "User" }])),
    );
    expect(JSON.stringify(where)).not.toContain(ME_ID);
  });

  it("looks at the asked action: a `read User` grant does not widen `update`", () => {
    const ability = definePrismaAbilityFor(holder([{ action: "read", subject: "User" }]));
    expect(JSON.stringify(accessibleUsersWhere(ability, "update"))).toContain(ME_ID);
  });
});

describe("accessibleCommentTemplatesWhere", () => {
  it("restricts every user to the templates they own", () => {
    for (const action of ["read", "delete"] as const) {
      const where = JSON.stringify(
        accessibleCommentTemplatesWhere(definePrismaAbilityFor(holder([])), action),
      );
      expect(where).toContain("createdBy");
      expect(where).toContain(ME_ID);
      expect(where).not.toContain(OTHER_ID);
    }
  });
});

describe("Staff on the server: grant-driven, no row rule", () => {
  const staffRow = (): Staff => ({
    id: "019187d5-0d76-7d1a-9a4c-000000000201",
    employeeType: "FULL_TIME",
    employeeNumber: 1,
    lastName: "山田",
    firstName: "花子",
    lastNameKana: "ヤマダ",
    firstNameKana: "ハナコ",
    gender: "FEMALE",
    birthday: null,
    position: null,
    branchName: null,
    email: null,
    phoneNumber: null,
    emergencyPhoneNumber: null,
    areas: [],
    status: "ACTIVE",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    deletedAt: null,
  });

  it("answers a row check like the type: the grant opens every row, no grant none", () => {
    const granted = definePrismaAbilityFor(holder([{ action: "update", subject: "Staff" }]));
    const none = definePrismaAbilityFor(holder([]));

    expect(granted.can("update", prismaStaffSubject(staffRow()))).toBe(true);
    expect(none.can("update", prismaStaffSubject(staffRow()))).toBe(false);
  });

  it("leaves a list and a delete with their grant unrestricted: an empty where", () => {
    const ability = definePrismaAbilityFor(
      holder([
        { action: "read", subject: "Staff" },
        { action: "delete", subject: "Staff" },
      ]),
    );
    expect(ability.can("read", "Staff")).toBe(true);
    expect(accessibleStaffWhere(ability)).toEqual({});
    expect(accessibleStaffWhere(ability, "delete")).toEqual({});
  });
});

describe("Client on the server: grant-driven, no row rule", () => {
  const clientRow = (): Client => ({
    id: "019187d5-0d76-7d1a-9a4c-000000000301",
    number: 1,
    name: "株式会社テスト",
    nameKana: "カブシキガイシャテスト",
    areas: [],
    orderTypes: [],
    phoneNumber: "03-1234-5678",
    fax: null,
    webUrl: null,
    status: "ACTIVE",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    deletedAt: null,
  });

  it("answers a row check like the type: the grant opens every row, no grant none", () => {
    const granted = definePrismaAbilityFor(holder([{ action: "update", subject: "Client" }]));
    const none = definePrismaAbilityFor(holder([]));

    expect(granted.can("update", prismaClientSubject(clientRow()))).toBe(true);
    expect(none.can("update", prismaClientSubject(clientRow()))).toBe(false);
  });

  it("leaves a list and a delete with their grant unrestricted: an empty where", () => {
    const ability = definePrismaAbilityFor(
      holder([
        { action: "read", subject: "Client" },
        { action: "delete", subject: "Client" },
      ]),
    );
    expect(ability.can("read", "Client")).toBe(true);
    expect(accessibleClientsWhere(ability)).toEqual({});
    expect(accessibleClientsWhere(ability, "delete")).toEqual({});
  });
});

describe("Branch on the server: grant-driven, no row rule", () => {
  const branchRow = (): Branch => ({
    id: "019187d5-0d76-7d1a-9a4c-000000000401",
    clientId: "019187d5-0d76-7d1a-9a4c-000000000301",
    number: 1,
    name: "新宿店",
    nameKana: "シンジュクテン",
    area: "EAST",
    regionCode: 4,
    departmentNumber: 1,
    departmentName: "営業部",
    departmentNameKana: "エイギョウブ",
    departmentFax: null,
    contactLastName: "山田",
    contactFirstName: "太郎",
    contactLastNameKana: "ヤマダ",
    contactFirstNameKana: "タロウ",
    contactPosition: "LEADER",
    contactEmail: "yamada@example.com",
    memo: null,
    status: "ACTIVE",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    deletedAt: null,
  });

  it("answers a row check like the type: the grant opens every row, no grant none", () => {
    const granted = definePrismaAbilityFor(holder([{ action: "update", subject: "Branch" }]));
    const none = definePrismaAbilityFor(holder([]));

    expect(granted.can("update", prismaBranchSubject(branchRow()))).toBe(true);
    expect(none.can("update", prismaBranchSubject(branchRow()))).toBe(false);
  });

  it("leaves a list and a delete with their grant unrestricted: an empty where", () => {
    const ability = definePrismaAbilityFor(
      holder([
        { action: "read", subject: "Branch" },
        { action: "delete", subject: "Branch" },
      ]),
    );
    expect(ability.can("read", "Branch")).toBe(true);
    expect(accessibleBranchesWhere(ability)).toEqual({});
    expect(accessibleBranchesWhere(ability, "delete")).toEqual({});
  });
});
