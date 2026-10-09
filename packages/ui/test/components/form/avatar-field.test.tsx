import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AvatarField } from "../../../src/components/form/avatar-field";
import type { FileFieldValue } from "../../../src/components/form/types";

type Values = { avatar: FileFieldValue | null };

const STORED: FileFieldValue = {
  id: "0199a1b2-0000-7000-8000-000000000001",
  name: "old.png",
  size: 10,
  type: "image/png",
  url: "https://storage.example/old.png",
};

/** A form host that shows the stored value. */
const Harness = ({
  upload,
  initial = null,
}: {
  upload: (file: File) => Promise<Pick<FileFieldValue, "id" | "url">>;
  initial?: FileFieldValue | null;
}) => {
  const form = useForm<Values>({ defaultValues: { avatar: initial } });
  const avatar = useWatch({ control: form.control, name: "avatar" });
  return (
    <form>
      <AvatarField
        control={form.control}
        name="avatar"
        label="プロフィール画像"
        accept="image/png,image/jpeg"
        maxSize={1024}
        upload={upload}
      />
      <output data-testid="value">{JSON.stringify(avatar)}</output>
    </form>
  );
};

const pick = (file: File) => {
  fireEvent.change(screen.getByLabelText("プロフィール画像"), { target: { files: [file] } });
};

const valueOf = () => JSON.parse(screen.getByTestId("value").textContent || "null") as unknown;

beforeEach(() => {
  let previews = 0;
  URL.createObjectURL = vi.fn(() => {
    previews += 1;
    return `blob:preview-${String(previews)}`;
  });
  URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

describe("AvatarField", () => {
  it("uploads a picked image at once and stores its reference instead of the file", async () => {
    const upload = vi.fn(() => Promise.resolve({ id: "new-id" }));
    render(
      <StrictMode>
        <Harness upload={upload} />
      </StrictMode>,
    );

    pick(new File(["png"], "face.png", { type: "image/png" }));

    await waitFor(() => {
      expect(valueOf()).toEqual({
        name: "face.png",
        size: 3,
        type: "image/png",
        url: "blob:preview-1",
        id: "new-id",
      });
    });
    expect(screen.getByRole("button", { name: "プロフィール画像を変更" })).toBeDefined();
  });

  it("removes the stored image with the corner button", () => {
    render(
      <StrictMode>
        <Harness upload={vi.fn()} initial={STORED} />
      </StrictMode>,
    );

    fireEvent.click(screen.getByRole("button", { name: "プロフィール画像を削除" }));

    expect(valueOf()).toBeNull();
    expect(screen.getByRole("button", { name: "プロフィール画像を選択" })).toBeDefined();
  });

  it("refuses another type or a file over the limit without uploading", () => {
    const upload = vi.fn();
    render(
      <StrictMode>
        <Harness upload={upload} initial={STORED} />
      </StrictMode>,
    );

    pick(new File(["gif"], "anim.gif", { type: "image/gif" }));
    expect(screen.getByText("anim.gif: この形式は選択できません")).toBeDefined();
    pick(new File(["x".repeat(2048)], "big.png", { type: "image/png" }));
    expect(screen.getByText("big.png: 1 KB を超えています")).toBeDefined();

    expect(upload).not.toHaveBeenCalled();
    expect(valueOf()).toEqual(STORED);
  });

  it("keeps the previous image when the upload fails and says why", async () => {
    const upload = vi.fn(() => Promise.reject(new Error("ファイルのアップロードに失敗しました")));
    render(
      <StrictMode>
        <Harness upload={upload} initial={STORED} />
      </StrictMode>,
    );

    await act(async () => {
      pick(new File(["png"], "face.png", { type: "image/png" }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("face.png: ファイルのアップロードに失敗しました")).toBeDefined();
    });
    expect(valueOf()).toEqual(STORED);
  });
});

describe("AvatarField after a failed second pick", () => {
  it("keeps the image uploaded a moment ago, its preview included", async () => {
    let calls = 0;
    const upload = () => {
      calls += 1;
      return calls === 1
        ? Promise.resolve({ id: "first-id" })
        : Promise.reject(new Error("ファイルのアップロードに失敗しました"));
    };
    render(
      <StrictMode>
        <Harness upload={upload} />
      </StrictMode>,
    );

    pick(new File(["png"], "first.png", { type: "image/png" }));
    await waitFor(() => {
      expect(valueOf()).toMatchObject({ id: "first-id", url: "blob:preview-1" });
    });
    await act(async () => {
      pick(new File(["png"], "second.png", { type: "image/png" }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("second.png: ファイルのアップロードに失敗しました")).toBeDefined();
    });
    expect(valueOf()).toMatchObject({ name: "first.png", id: "first-id", url: "blob:preview-1" });
  });
});

describe("AvatarField while uploading", () => {
  /** Like attachmentValueSchema: a file without its id fails at `avatar.id`, checked on every change. */
  const resolver: Resolver<Values> = (values) =>
    values.avatar && !values.avatar.id
      ? { values: {}, errors: { avatar: { id: { type: "required", message: "待ってください" } } } }
      : { values, errors: {} };

  const Validating = ({ upload }: { upload: (file: File) => Promise<{ id: string }> }) => {
    const form = useForm<Values>({ mode: "onChange", defaultValues: { avatar: null }, resolver });
    return (
      <AvatarField control={form.control} name="avatar" label="プロフィール画像" upload={upload} />
    );
  };

  it("shows the waiting file as a wait, not as an error", async () => {
    let finish: (value: { id: string }) => void = () => undefined;
    render(
      <StrictMode>
        <Validating upload={() => new Promise((resolve) => (finish = resolve))} />
      </StrictMode>,
    );

    pick(new File(["png"], "face.png", { type: "image/png" }));

    const circle = await screen.findByRole("button", { name: "プロフィール画像を変更" });
    await waitFor(() => {
      expect(screen.getByLabelText("アップロード中")).toBeDefined();
    });
    expect(circle.getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByText("待ってください")).toBeNull();

    await act(async () => {
      finish({ id: "new-id" });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.queryByLabelText("アップロード中")).toBeNull();
    });
    expect(circle.getAttribute("aria-invalid")).toBe("false");
  });
});
