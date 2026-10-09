import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { attachmentDeleteJobId } from "@repo/queue";
import { createUploadUrlSchema } from "@repo/validation";

import type { RequestContext } from "../../../src/core/context";
import { ForbiddenError, ValidationError } from "../../../src/core/errors";
import {
  UPLOAD_NOT_ALLOWED,
  createUploadUrl,
} from "../../../src/modules/attachment/attachment.service";
import * as userService from "../../../src/modules/user/user.service";
import { contextFor, createHarness, signedInUser, uniqueEmployeeNumber } from "../../support";
import type { TestHarness } from "../../support";

/** プロフィール画像 on the user writes and reads (ADR 0012). */
let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

const contextOf = async (role: "admin" | "am" = "am") => {
  const signedIn = await signedInUser(h, { role });
  return { id: signedIn.user.id, ctx: await contextFor(h, signedIn.headers) };
};

/** A finished avatar upload of the caller: the URL handed out and the browser's PUT done. */
const uploadedAvatar = async (ctx: RequestContext, fileName = "face.png") => {
  const target = await createUploadUrl(
    ctx,
    createUploadUrlSchema.parse({
      kind: "USER_AVATAR",
      fileName,
      contentType: "image/png",
      size: 4096,
    }),
  );
  const row = await h.db.attachment.findUniqueOrThrow({ where: { id: target.id } });
  h.storage.put(row.objectKey, { size: row.size, contentType: row.contentType });
  return row;
};

const statusOf = async (id: string) =>
  (await h.db.attachment.findUniqueOrThrow({ where: { id } })).status;

describe("the avatar on updateProfile and getById", () => {
  it("sets, replaces and removes the caller's own avatar; the old one goes to the worker", async () => {
    const me = await contextOf();
    const first = await uploadedAvatar(me.ctx, "first.png");

    await userService.updateProfile(me.ctx, { avatarId: first.id });
    const withFirst = await userService.getById(me.ctx, me.id);

    expect(withFirst.avatar).toMatchObject({ id: first.id, fileName: "first.png", size: 4096 });
    expect(withFirst.avatar?.url).toContain(first.objectKey);

    const second = await uploadedAvatar(me.ctx, "second.png");
    await userService.updateProfile(me.ctx, { avatarId: second.id });

    expect((await userService.getById(me.ctx, me.id)).avatar?.id).toBe(second.id);
    expect(await statusOf(first.id)).toBe("DELETED");
    expect(await h.attachmentDeleteQueue.getJob(attachmentDeleteJobId(first.id))).toBeDefined();

    await userService.updateProfile(me.ctx, { avatarId: null });

    expect((await userService.getById(me.ctx, me.id)).avatar).toBeNull();
    expect(await statusOf(second.id)).toBe("DELETED");
  });

  it("keeps the avatar when the input leaves it out and changes nothing for a repeated id", async () => {
    const me = await contextOf();
    const avatar = await uploadedAvatar(me.ctx);
    await userService.updateProfile(me.ctx, { avatarId: avatar.id });

    await userService.updateProfile(me.ctx, { lastName: "改名" });
    await userService.updateProfile(me.ctx, { avatarId: avatar.id });

    expect(await statusOf(avatar.id)).toBe("ATTACHED");
    expect((await userService.getById(me.ctx, me.id)).avatar?.id).toBe(avatar.id);
  });

  it("forbids an AM to set another user's avatar and refuses another user's upload", async () => {
    const am = await contextOf("am");
    const other = await contextOf("am");
    const mine = await uploadedAvatar(am.ctx);
    const theirs = await uploadedAvatar(other.ctx);

    await expect(
      userService.updateProfile(am.ctx, { userId: other.id, avatarId: mine.id }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(userService.updateProfile(am.ctx, { avatarId: theirs.id })).rejects.toThrow(
      new ValidationError(UPLOAD_NOT_ALLOWED),
    );
    expect(await statusOf(mine.id)).toBe("PENDING");
    expect(await statusOf(theirs.id)).toBe("PENDING");
  });
});

describe("the avatar on 担当者追加 and 担当者情報編集", () => {
  it("lets an admin give an invited user an avatar and change another user's", async () => {
    const admin = await contextOf("admin");
    const forInvite = await uploadedAvatar(admin.ctx, "invited.png");

    const invited = await userService.invite(admin.ctx, {
      email: `${crypto.randomUUID()}@example.com`,
      lastName: "招待",
      firstName: "花子",
      lastNameKana: "ショウタイ",
      firstNameKana: "ハナコ",
      role: "am",
      profile: {
        employeeNumber: uniqueEmployeeNumber(),
        departmentName: "東日本営業部",
        position: "SV",
        retirementDate: null,
        areas: ["EAST"],
        regionCodes: [4],
      },
      avatarId: forInvite.id,
    });

    expect(invited.avatar).toMatchObject({ id: forInvite.id, fileName: "invited.png" });
    expect((await h.db.attachment.findUniqueOrThrow({ where: { id: forInvite.id } })).userId).toBe(
      invited.id,
    );

    const replacement = await uploadedAvatar(admin.ctx, "replaced.png");
    const updated = await userService.update(admin.ctx, {
      userId: invited.id,
      avatarId: replacement.id,
    });

    expect(updated.avatar?.id).toBe(replacement.id);
    expect(await statusOf(forInvite.id)).toBe("DELETED");
  });
});
