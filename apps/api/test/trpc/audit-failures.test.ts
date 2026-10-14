import { Writable } from "node:stream";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@repo/database";
import { createLogger } from "@repo/logger";

import { createCallerFactory } from "../../src/trpc/init";
import { appRouter } from "../../src/trpc/router";
import {
  clientInput,
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
} from "../support";
import type { TestHarness } from "../support";

/** `auditFailures` (src/trpc/init.ts, docs/adr/0015-audit-log.md): a failed mutation leaves a row. */
let h: TestHarness;
const createCaller = createCallerFactory(appRouter);

beforeAll(async () => {
  h = await createHarness();
  await ensureTestPostCode(h);
});

afterAll(async () => {
  await h.stop();
});

const failuresOf = (actorId: string) =>
  h.db.auditLog.findMany({
    where: { actorId, status: "FAILURE" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

describe("failed mutations in the audit log", () => {
  it("records a refused mutation with its code, and the caller sees the same error", async () => {
    const am = await signedInUser(h);
    const caller = createCaller(await contextFor(h, am.headers));

    await expect(caller.client.create(clientInput([am.user.id]))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    expect(await failuresOf(am.user.id)).toEqual([
      expect.objectContaining({
        actorType: "USER",
        actorRole: "am",
        action: "client.create",
        entityType: "Client",
        errorCode: "FORBIDDEN",
      }),
    ]);
  });

  it("records a domain error by its code and invalid input as BAD_REQUEST", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const charger = await signedInUser(h);
    const caller = createCaller(await contextFor(h, admin.headers));
    const client = await caller.client.create(clientInput([charger.user.id]));

    await expect(caller.client.deleteMany({ clientIds: [client.id] })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(
      caller.client.changeStatus({ clientId: "not-a-uuid", status: "SUSPENDED" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect((await failuresOf(admin.user.id)).map((row) => [row.action, row.errorCode])).toEqual([
      ["client.deleteMany", "CONFLICT"],
      ["client.changeStatus", "BAD_REQUEST"],
    ]);
  });

  it("records nothing for a failed query or an exempt mutation", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const caller = createCaller(await contextFor(h, admin.headers));

    await expect(caller.client.byId({ clientId: crypto.randomUUID() })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller.commentTemplate.create({} as never)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(await failuresOf(admin.user.id)).toEqual([]);
  });

  it("answers with the same error, and logs it, when the failure row cannot be written", async () => {
    const am = await signedInUser(h);
    const written: string[] = [];
    const logger = createLogger(
      { name: "test" },
      new Writable({
        write: (chunk: Buffer, _encoding, callback) => {
          written.push(chunk.toString());
          callback();
        },
      }),
    );
    const unreachable = createPrismaClient({
      connectionString: "postgresql://nobody:nothing@127.0.0.1:1/none",
    });
    try {
      const caller = createCaller({
        ...(await contextFor(h, am.headers)),
        db: unreachable,
        logger,
      });

      await expect(caller.client.create(clientInput([am.user.id]))).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    } finally {
      await unreachable.$disconnect();
    }
    expect(await failuresOf(am.user.id)).toEqual([]);
    expect(written.map((line): unknown => JSON.parse(line))).toContainEqual(
      expect.objectContaining({
        msg: "audit log row not written",
        action: "client.create",
        errorCode: "FORBIDDEN",
      }),
    );
  });
});
