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

const callerFor = async (role: "admin" | "am" = "am") =>
  createCaller(await contextFor(h, (await signedInUser(h, { role })).headers));

const avatar = {
  kind: "USER_AVATAR" as const,
  fileName: "face.png",
  contentType: "image/png",
  size: 100,
};

describe("attachment router", () => {
  it("requires a session", async () => {
    const anonymous = createCaller(await contextFor(h));
    await expect(anonymous.attachment.createUploadUrl(avatar)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("hands every signed-in user an upload URL for their avatar", async () => {
    const caller = await callerFor("am");

    const target = await caller.attachment.createUploadUrl(avatar);

    expect(target.url).toMatch(/^memory:\/\/upload\/avatars\/[0-9a-f-]{36}\.png$/);
    expect(target.headers["x-goog-content-length-range"]).toBe("100,100");
  });

  it("answers BAD_REQUEST for a file outside the kind's rule and FORBIDDEN for a 履歴書 of an AM", async () => {
    const am = await callerFor("am");

    await expect(
      am.attachment.createUploadUrl({ ...avatar, contentType: "image/gif", fileName: "a.gif" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      am.attachment.createUploadUrl({ ...avatar, size: 6 * 1024 * 1024 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      am.attachment.createUploadUrl({
        kind: "STAFF_RESUME",
        fileName: "履歴書.pdf",
        contentType: "application/pdf",
        size: 100,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
