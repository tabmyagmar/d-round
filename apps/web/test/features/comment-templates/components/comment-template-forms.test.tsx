// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentTemplateCreateForm } from "@/features/comment-templates/components/comment-template-create-form";
import { CommentTemplateUpdateForm } from "@/features/comment-templates/components/comment-template-update-form";

import { commentTemplateRow } from "../fixtures";

afterEach(cleanup);

const box = (name: string) => screen.getByRole("checkbox", { name });

/** Rendered in StrictMode, as `next dev` does: effects mount, unmount and mount again. */
const renderCreate = (errorMessage?: string) => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <StrictMode>
      <CommentTemplateCreateForm
        pending={false}
        errorMessage={errorMessage}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    </StrictMode>,
  );
  return { onSubmit, onCancel };
};

describe("CommentTemplateCreateForm", () => {
  it("asks for 使用先メニュー, タイトル and テキスト", () => {
    renderCreate();

    expect(screen.getByRole("group", { name: /使用先メニュー/ })).toBeDefined();
    expect(screen.getByLabelText(/^タイトル/)).toBeDefined();
    expect(screen.getByLabelText(/^テキスト/)).toBeDefined();
  });

  it("shows the legacy messages when submitted empty", async () => {
    const { onSubmit } = renderCreate();

    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(await screen.findByText("使用先メニューを選択してください")).toBeDefined();
    expect(screen.getByText("タイトルを入力してください")).toBeDefined();
    expect(screen.getByText("テキスト内容を入力してください")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends the menus in the legacy order with the title and the text", async () => {
    const { onSubmit } = renderCreate();

    fireEvent.click(box("スタッフ管理"));
    fireEvent.click(box("ワークフロー承認画面用コメント"));
    fireEvent.input(screen.getByLabelText(/^タイトル/), { target: { value: "承認" } });
    fireEvent.input(screen.getByLabelText(/^テキスト/), { target: { value: "承認します。" } });
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        types: ["WORKFLOW", "STAFF"],
        short: "承認",
        content: "承認します。",
      });
    });
  });

  it("shows the API's error and lets キャンセル close the dialog", () => {
    const { onCancel } = renderCreate("同じタイトルの定型文があります");

    expect(screen.getByText("同じタイトルの定型文があります")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("CommentTemplateUpdateForm", () => {
  const TEMPLATE = commentTemplateRow({
    types: ["CLIENT"],
    short: "挨拶",
    content: "お世話になっております。",
  });

  const renderUpdate = () => {
    const onSubmit = vi.fn();
    render(
      <StrictMode>
        <CommentTemplateUpdateForm
          template={TEMPLATE}
          pending={false}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      </StrictMode>,
    );
    return onSubmit;
  };

  it("starts from the template and keeps 更新 disabled while nothing changed", () => {
    renderUpdate();

    expect(box("クライアント管理").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText(/^タイトル/)).toHaveProperty("value", "挨拶");
    expect(screen.getByRole("button", { name: "更新" })).toHaveProperty("disabled", true);
  });

  it("sends only what changed", async () => {
    const onSubmit = renderUpdate();
    const save = screen.getByRole("button", { name: "更新" });

    fireEvent.input(screen.getByLabelText(/^テキスト/), {
      target: { value: "いつもありがとうございます。" },
    });
    await waitFor(() => {
      expect(save).toHaveProperty("disabled", false);
    });
    fireEvent.click(save);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        commentTemplateId: TEMPLATE.id,
        content: "いつもありがとうございます。",
      });
    });
  });
});
