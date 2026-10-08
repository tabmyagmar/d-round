import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCallerFactory } from "../../../src/trpc/init";
import { appRouter } from "../../../src/trpc/router";
import { contextFor, createHarness, signedInUser } from "../../support";
import type { TestHarness } from "../../support";

/** The router only wires input → ability → service; these tests prove the wiring and codes. */
let h: TestHarness;
const createCaller = createCallerFactory(appRouter);

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

const callerFor = async () => createCaller(await contextFor(h, (await signedInUser(h)).headers));

describe("comment template router", () => {
  it("requires a session", async () => {
    const anonymous = createCaller(await contextFor(h));
    await expect(anonymous.commentTemplate.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("lets an AM keep their own templates: create, list, update, delete", async () => {
    const caller = await callerFor();

    const created = await caller.commentTemplate.create({
      types: ["CLIENT"],
      short: "挨拶",
      content: "お世話になっております。",
    });
    const updated = await caller.commentTemplate.update({
      commentTemplateId: created.id,
      short: "ご挨拶",
    });
    const page = await caller.commentTemplate.list({ type: "CLIENT" });
    const deleted = await caller.commentTemplate.deleteMany({ commentTemplateIds: [created.id] });

    expect(updated.short).toBe("ご挨拶");
    expect(page.items.map((row) => ({ id: row.id, content: row.content }))).toEqual([
      { id: created.id, content: "お世話になっております。" },
    ]);
    expect(deleted).toEqual({ deleted: 1 });
  });

  it("makes the caller the owner, whatever owner the client sends", async () => {
    const victim = await signedInUser(h);
    const caller = await callerFor();
    // A variable, not a literal: the extra key reaches the router as a client could send it.
    const input = {
      types: ["STAFF" as const],
      short: "乗っ取り",
      content: "本文",
      createdBy: victim.user.id,
    };

    const created = await caller.commentTemplate.create(input);

    expect(created.createdBy).not.toBe(victim.user.id);
    const victimCaller = createCaller(await contextFor(h, victim.headers));
    expect((await victimCaller.commentTemplate.list({})).items).toEqual([]);
  });

  it("maps another user's row to FORBIDDEN and a repeated title to CONFLICT", async () => {
    const owner = await callerFor();
    const intruder = await callerFor();
    const created = await owner.commentTemplate.create({
      types: ["WORKFLOW"],
      short: "承認",
      content: "承認します。",
    });

    await expect(
      intruder.commentTemplate.update({ commentTemplateId: created.id, short: "奪う" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      owner.commentTemplate.create({ types: ["STAFF"], short: "承認", content: "別の本文" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects invalid input with BAD_REQUEST", async () => {
    const caller = await callerFor();

    await expect(
      caller.commentTemplate.create({ types: [], short: "空", content: "本文" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.commentTemplate.deleteMany({
        commentTemplateIds: Array.from({ length: 51 }, () => crypto.randomUUID()),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
