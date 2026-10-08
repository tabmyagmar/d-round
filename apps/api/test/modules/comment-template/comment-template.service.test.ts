import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createCommentTemplateSchema,
  deleteCommentTemplatesSchema,
  listCommentTemplatesSchema,
  updateCommentTemplateSchema,
} from "@repo/validation";
import type { CreateCommentTemplateFormValues, ListCommentTemplatesInput } from "@repo/validation";

import { ConflictError, ForbiddenError, NotFoundError } from "../../../src/core/errors";
import * as commentTemplateService from "../../../src/modules/comment-template/comment-template.service";
import { contextFor, createHarness, signedInUser } from "../../support";
import type { TestHarness } from "../../support";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

/** A signed-in staff user (no catalog grant touches templates) and their request context. */
const someone = async () => {
  const signedIn = await signedInUser(h);
  return { id: signedIn.user.id, ctx: await contextFor(h, signedIn.headers) };
};

/** Inputs exactly as the router hands them to the service: parsed, transforms applied. */
const create = (short: string, overrides: Partial<CreateCommentTemplateFormValues> = {}) =>
  createCommentTemplateSchema.parse({
    types: ["WORKFLOW"],
    short,
    content: `${short}の本文`,
    ...overrides,
  });
const list = (input: ListCommentTemplatesInput = {}) => listCommentTemplatesSchema.parse(input);
const ids = (...commentTemplateIds: string[]) =>
  deleteCommentTemplatesSchema.parse({ commentTemplateIds });

describe("comment template service", () => {
  it("creates a template owned by the caller", async () => {
    const me = await someone();

    const created = await commentTemplateService.create(
      me.ctx,
      create("承認", { types: ["STAFF", "WORKFLOW"] }),
    );

    expect(created).toMatchObject({
      createdBy: me.id,
      short: "承認",
      content: "承認の本文",
      types: ["WORKFLOW", "STAFF"],
    });
  });

  it("refuses a second template with the same title for the caller, not for another user", async () => {
    const me = await someone();
    const other = await someone();
    await commentTemplateService.create(me.ctx, create("同じ"));

    await expect(commentTemplateService.create(me.ctx, create("同じ"))).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(commentTemplateService.create(other.ctx, create("同じ"))).resolves.toMatchObject({
      createdBy: other.id,
    });
  });

  it("lists only the caller's templates, newest first", async () => {
    const me = await someone();
    const other = await someone();
    const first = await commentTemplateService.create(me.ctx, create("一"));
    const second = await commentTemplateService.create(me.ctx, create("二"));
    await commentTemplateService.create(other.ctx, create("他人"));

    const page = await commentTemplateService.list(me.ctx, list());

    expect(page.items.map((row) => row.id)).toEqual([second.id, first.id]);
    expect(page.total).toBe(2);
  });

  it("searches title and text and filters by menu", async () => {
    const me = await someone();
    const greeting = await commentTemplateService.create(
      me.ctx,
      create("挨拶", { content: "おはようございます", types: ["CLIENT"] }),
    );
    const approval = await commentTemplateService.create(
      me.ctx,
      create("承認", { content: "確認しました", types: ["WORKFLOW", "STAFF"] }),
    );
    const found = async (input: ListCommentTemplatesInput) =>
      (await commentTemplateService.list(me.ctx, list(input))).items.map((row) => row.id);

    expect(await found({ search: "おはよう" })).toEqual([greeting.id]);
    expect(await found({ search: "承認" })).toEqual([approval.id]);
    expect(await found({ type: "STAFF" })).toEqual([approval.id]);
    expect(await found({ type: "APPLICATION" })).toEqual([]);
  });

  it("updates only the fields it is given", async () => {
    const me = await someone();
    const created = await commentTemplateService.create(me.ctx, create("旧"));

    const updated = await commentTemplateService.update(
      me.ctx,
      updateCommentTemplateSchema.parse({ commentTemplateId: created.id, content: "新しい本文" }),
    );

    expect(updated).toMatchObject({ short: "旧", content: "新しい本文", types: ["WORKFLOW"] });
  });

  it("refuses to update another user's template and reports an unknown one", async () => {
    const me = await someone();
    const other = await someone();
    const theirs = await commentTemplateService.create(other.ctx, create("他人"));

    await expect(
      commentTemplateService.update(
        me.ctx,
        updateCommentTemplateSchema.parse({ commentTemplateId: theirs.id, short: "奪う" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      commentTemplateService.update(
        me.ctx,
        updateCommentTemplateSchema.parse({ commentTemplateId: crypto.randomUUID(), short: "無" }),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses to rename a template onto a title the caller already has", async () => {
    const me = await someone();
    await commentTemplateService.create(me.ctx, create("既存"));
    const renamed = await commentTemplateService.create(me.ctx, create("変更前"));

    await expect(
      commentTemplateService.update(
        me.ctx,
        updateCommentTemplateSchema.parse({ commentTemplateId: renamed.id, short: "既存" }),
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("deletes only the caller's templates among the ids and reports how many", async () => {
    const me = await someone();
    const other = await someone();
    const gone = await commentTemplateService.create(me.ctx, create("消す"));
    const kept = await commentTemplateService.create(me.ctx, create("残す"));
    const theirs = await commentTemplateService.create(other.ctx, create("他人"));

    await expect(
      commentTemplateService.removeMany(me.ctx, ids(gone.id, theirs.id)),
    ).resolves.toEqual({ deleted: 1 });

    const mine = await commentTemplateService.list(me.ctx, list());
    expect(mine.items.map((row) => row.id)).toEqual([kept.id]);
    const others = await commentTemplateService.list(other.ctx, list());
    expect(others.items.map((row) => row.id)).toEqual([theirs.id]);
  });

  it("reports a delete that matched none of the caller's templates", async () => {
    const me = await someone();
    const other = await someone();
    const theirs = await commentTemplateService.create(other.ctx, create("他人"));

    await expect(commentTemplateService.removeMany(me.ctx, ids(theirs.id))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("lets an anonymous caller do nothing", async () => {
    const anonymous = await contextFor(h);

    await expect(commentTemplateService.list(anonymous, list())).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(commentTemplateService.create(anonymous, create("匿名"))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
