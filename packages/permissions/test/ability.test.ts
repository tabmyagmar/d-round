/**
 * THE PERMISSION SPEC — unit half.
 *
 * The rules are grant-driven: a signed-in user carries effective catalog grants
 * `{ action, subject }` and `defineRules` turns every grant it knows into an unscoped `can`, then
 * adds the self rule on the own User row. This file knows nothing about roles: which role holds
 * which grant is the catalog's business (`permissions.csv`, proven against the database by
 * `apps/api/test/permission-catalog.test.ts`). Changing the shape of a rule means changing this
 * file first — the failing cell documents the change — then `rules.ts`.
 */
import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import { describe, expect, it } from "vitest";

import type { User } from "@repo/database";

import { canUnscoped, defineAbilityFor, userSubject } from "../src/ability";
import type { AppAbility } from "../src/ability";
import { ACTIONS, SUBJECT_NAMES, isAction, isSubjectName } from "../src/rules";
import type { AbilityUser, Action, PermissionGrant, SubjectName } from "../src/rules";
import { accessibleUsersWhere, definePrismaAbilityFor, prismaUserSubject } from "../src/server";
import type { ServerAbility } from "../src/server";

/** Whose User row a cell is about: the current user's own row or anybody else's. */
type Relation = "self" | "other";

const ME_ID = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e";
const OTHER_ID = "019187d5-0d76-7d1a-9a4c-000000000002";

/** A signed-in user holding exactly these grants. The role is not an input to the rules. */
const holder = (permissions: readonly PermissionGrant[]): AbilityUser => ({
  id: ME_ID,
  role: "staff",
  permissions,
});

/**
 * One cell of the spec: an action on a subject. `User` is the only subject with rows today, so it
 * is asked twice (own row, another user's row); every other subject is asked on its type.
 */
type Cell = { action: Action; subject: SubjectName; relation: Relation };

const CELLS: Cell[] = ACTIONS.flatMap((action) =>
  SUBJECT_NAMES.flatMap((subject): Cell[] =>
    subject === "User"
      ? [
          { action, subject, relation: "self" },
          { action, subject, relation: "other" },
        ]
      : [{ action, subject, relation: "other" }],
  ),
);

const cellKey = ({ action, subject, relation }: Cell): string =>
  subject === "User" ? `${action} User (${relation})` : `${action} ${subject}`;

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
  role: "staff",
  banned: false,
  banReason: null,
  banExpires: null,
  deletedAt: null,
});

/** Every cell's answer from the browser ability, keyed so a failure shows the exact cell. */
const browserAnswers = (ability: AppAbility): Record<string, boolean> =>
  Object.fromEntries(
    CELLS.map((cell) => [
      cellKey(cell),
      ability.can(
        cell.action,
        cell.subject === "User" ? userSubject({ id: rowId(cell.relation) }) : cell.subject,
      ),
    ]),
  );

/** The same cells answered by the server (prisma) ability. */
const serverAnswers = (ability: ServerAbility): Record<string, boolean> =>
  Object.fromEntries(
    CELLS.map((cell) => [
      cellKey(cell),
      ability.can(
        cell.action,
        cell.subject === "User" ? prismaUserSubject(userRow(rowId(cell.relation))) : cell.subject,
      ),
    ]),
  );

/** The self rule: everyone may read and update their own User row. */
const isSelfRule = ({ action, subject, relation }: Cell): boolean =>
  subject === "User" && relation === "self" && (action === "read" || action === "update");

/** What a signed-in user holding exactly `grants` may do: the granted cells plus the self rule. */
const expectedFor = (grants: readonly PermissionGrant[]): Record<string, boolean> =>
  Object.fromEntries(
    CELLS.map((cell) => [
      cellKey(cell),
      isSelfRule(cell) ||
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
