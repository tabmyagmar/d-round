import { describe, expect, it } from "vitest";

import {
  createCommentTemplateSchema,
  deleteCommentTemplatesSchema,
  listCommentTemplatesSchema,
  updateCommentTemplateSchema,
} from "../src/comment-template.schema";

const ID = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e";

/** The first issue's path and message, or null when the value parses. */
const firstIssue = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => {
  const issue = result.error?.issues[0];
  return issue ? { path: issue.path.join("."), message: issue.message } : null;
};

const valid = { types: ["CLIENT"], short: "承認", content: "承認します。" };

describe("createCommentTemplateSchema", () => {
  it("keeps the menus once each, in the legacy order", () => {
    const parsed = createCommentTemplateSchema.parse({
      ...valid,
      types: ["STAFF", "WORKFLOW", "STAFF"],
    });
    expect(parsed.types).toEqual(["WORKFLOW", "STAFF"]);
  });

  it("trims the title and keeps the text as written", () => {
    const parsed = createCommentTemplateSchema.parse({
      ...valid,
      short: "  承認  ",
      content: " 一行目\n二行目 ",
    });
    expect(parsed.short).toBe("承認");
    expect(parsed.content).toBe(" 一行目\n二行目 ");
  });

  it.each([
    [{ types: [] }, "types", "使用先メニューを選択してください"],
    [{ short: "   " }, "short", "タイトルを入力してください"],
    [{ short: "あ".repeat(101) }, "short", "タイトルは100文字以内にしてください"],
    [{ content: "" }, "content", "テキスト内容を入力してください"],
    [{ content: "あ".repeat(1001) }, "content", "テキスト内容は1000文字以内にしてください"],
  ])("rejects %j with the legacy message", (change, path, message) => {
    expect(firstIssue(createCommentTemplateSchema.safeParse({ ...valid, ...change }))).toEqual({
      path,
      message,
    });
  });

  it("rejects a menu that does not exist", () => {
    expect(createCommentTemplateSchema.safeParse({ ...valid, types: ["MEMO"] }).success).toBe(
      false,
    );
  });

  it("asks for the menus when none were sent", () => {
    expect(
      firstIssue(createCommentTemplateSchema.safeParse({ short: "承認", content: "本文" })),
    ).toEqual({ path: "types", message: "使用先メニューを選択してください" });
  });
});

describe("updateCommentTemplateSchema", () => {
  it("takes any subset of the fields next to the id", () => {
    expect(updateCommentTemplateSchema.parse({ commentTemplateId: ID, short: "新" })).toEqual({
      commentTemplateId: ID,
      short: "新",
    });
  });
});

describe("deleteCommentTemplatesSchema", () => {
  it("takes one to fifty ids", () => {
    const ids = (count: number) => Array.from({ length: count }, () => ID);
    expect(deleteCommentTemplatesSchema.safeParse({ commentTemplateIds: ids(1) }).success).toBe(
      true,
    );
    expect(deleteCommentTemplatesSchema.safeParse({ commentTemplateIds: ids(50) }).success).toBe(
      true,
    );
    expect(deleteCommentTemplatesSchema.safeParse({ commentTemplateIds: [] }).success).toBe(false);
    expect(deleteCommentTemplatesSchema.safeParse({ commentTemplateIds: ids(51) }).success).toBe(
      false,
    );
  });
});

describe("listCommentTemplatesSchema", () => {
  it("defaults the page and accepts one menu", () => {
    expect(listCommentTemplatesSchema.parse({ type: "STAFF", search: " 承認 " })).toEqual({
      page: 1,
      perPage: 20,
      type: "STAFF",
      search: "承認",
    });
  });

  it("rejects an unknown menu", () => {
    expect(listCommentTemplatesSchema.safeParse({ type: "MEMO" }).success).toBe(false);
  });
});
