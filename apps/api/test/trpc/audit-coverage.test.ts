import type { AnyProcedure, AnyRouter } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { AUDIT_ACTIONS } from "@repo/validation";

import { protectedProcedure, router } from "../../src/trpc/init";
import { appRouter } from "../../src/trpc/router";

/** docs/adr/0015-audit-log.md: no mutation may be forgotten by the audit log. */

type Procedures = Record<string, AnyProcedure>;

/** A router's procedures by dotted path (`client.update`), as tRPC flattens them at run time. */
const proceduresOf = (target: AnyRouter): Procedures => {
  const procedures: Procedures = target._def.procedures;
  return procedures;
};

/** The mutations neither listed in AUDIT_ACTIONS nor exempt, and those both listed and exempt. */
const coverageOf = (procedures: Procedures) => {
  const mutations = Object.entries(procedures).filter(
    ([, procedure]) => procedure._def.type === "mutation",
  );
  const exempt = (procedure: AnyProcedure) =>
    (procedure._def.meta as { audit?: false } | undefined)?.audit === false;
  return {
    unlisted: mutations
      .filter(([path, procedure]) => !(path in AUDIT_ACTIONS) && !exempt(procedure))
      .map(([path]) => path),
    listedAndExempt: mutations
      .filter(([path, procedure]) => path in AUDIT_ACTIONS && exempt(procedure))
      .map(([path]) => path),
  };
};

const procedurePaths = Object.keys(proceduresOf(appRouter));

describe("audit coverage", () => {
  it("lists every mutation in AUDIT_ACTIONS or exempts it, never both", () => {
    expect(coverageOf(proceduresOf(appRouter))).toEqual({
      unlisted: [],
      listedAndExempt: [],
    });
  });

  it("catches a new mutation that is neither listed nor exempt", () => {
    const fixture = router({
      widget: router({
        create: protectedProcedure.mutation(() => null),
        archive: protectedProcedure.meta({ audit: false }).mutation(() => null),
      }),
    });

    expect(coverageOf(proceduresOf(fixture)).unlisted).toEqual(["widget.create"]);
  });

  it("names a procedure for every action but Better Auth's and the system's own", () => {
    const stale = Object.keys(AUDIT_ACTIONS).filter(
      (key) =>
        !key.startsWith("auth.") && !key.startsWith("system.") && !procedurePaths.includes(key),
    );

    expect(stale).toEqual([]);
  });
});
