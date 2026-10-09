import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { FileField } from "../../../src/components/form/file-field";
import type { FileFieldValue } from "../../../src/components/form/types";

type Values = { files: FileFieldValue[] };

/** Like attachmentValueSchema: a file without its id fails at `files.N.id`, checked per change. */
const resolver: Resolver<Values> = (values) => {
  const index = values.files.findIndex((file) => !file.id);
  return index === -1
    ? { values, errors: {} }
    : {
        values: {},
        errors: { files: { [index]: { id: { type: "required", message: "待ってください" } } } },
      };
};

/** Uploads that finish when the test says so, in any order. */
const deferredUploads = () => {
  const pending = new Map<string, (id: string) => void>();
  const upload = (file: File) =>
    new Promise<{ id: string }>((resolve) => {
      pending.set(file.name, (id) => {
        resolve({ id });
      });
    });
  const finish = async (name: string, id: string) => {
    await act(async () => {
      pending.get(name)?.(id);
      await Promise.resolve();
    });
  };
  return { upload, finish };
};

const Harness = ({ upload }: { upload: (file: File) => Promise<{ id: string }> }) => {
  const form = useForm<Values>({ mode: "onChange", defaultValues: { files: [] }, resolver });
  const files = useWatch({ control: form.control, name: "files" });
  return (
    <>
      <FileField
        control={form.control}
        name="files"
        label="履歴書"
        accept="application/pdf"
        multiple
        maxFiles={3}
        upload={upload}
      />
      <output data-testid="value">
        {JSON.stringify(files.map((file) => ({ name: file.name, id: file.id ?? null })))}
      </output>
    </>
  );
};

const pick = (...names: string[]) => {
  fireEvent.change(screen.getByLabelText("履歴書"), {
    target: { files: names.map((name) => new File(["%PDF"], name, { type: "application/pdf" })) },
  });
};

const valueOf = () => JSON.parse(screen.getByTestId("value").textContent || "[]") as unknown;

const dropZone = () =>
  screen.getByText("ファイルをドロップ、またはクリックして選択").closest("button");

afterEach(cleanup);

describe("FileField uploads", () => {
  it("keeps both files of two picks in a row, whichever upload finishes first", async () => {
    const { upload, finish } = deferredUploads();
    render(
      <StrictMode>
        <Harness upload={upload} />
      </StrictMode>,
    );

    pick("a.pdf");
    pick("b.pdf");
    await finish("a.pdf", "id-a");
    await finish("b.pdf", "id-b");

    await waitFor(() => {
      expect(valueOf()).toEqual([
        { name: "a.pdf", id: "id-a" },
        { name: "b.pdf", id: "id-b" },
      ]);
    });
  });

  it("keeps a removed file removed while another one is still uploading", async () => {
    const { upload, finish } = deferredUploads();
    render(
      <StrictMode>
        <Harness upload={upload} />
      </StrictMode>,
    );
    pick("a.pdf");
    await finish("a.pdf", "id-a");
    pick("b.pdf");

    fireEvent.click(screen.getByRole("button", { name: "a.pdf を削除" }));
    await finish("b.pdf", "id-b");

    await waitFor(() => {
      expect(valueOf()).toEqual([{ name: "b.pdf", id: "id-b" }]);
    });
  });

  it("shows a running upload as a wait, not as an error", async () => {
    const { upload, finish } = deferredUploads();
    render(
      <StrictMode>
        <Harness upload={upload} />
      </StrictMode>,
    );

    pick("a.pdf");
    await waitFor(() => {
      expect(valueOf()).toEqual([{ name: "a.pdf", id: null }]);
    });

    expect(dropZone()?.getAttribute("aria-invalid")).toBe("false");
    await finish("a.pdf", "id-a");
    await waitFor(() => {
      expect(valueOf()).toEqual([{ name: "a.pdf", id: "id-a" }]);
    });
    expect(dropZone()?.getAttribute("aria-invalid")).toBe("false");
  });

  it("refuses the same file a second time instead of listing it twice", async () => {
    const { upload, finish } = deferredUploads();
    render(
      <StrictMode>
        <Harness upload={upload} />
      </StrictMode>,
    );
    pick("a.pdf");
    await finish("a.pdf", "id-a");

    pick("a.pdf");

    expect(screen.getByText("a.pdf: すでに選択されています")).toBeDefined();
    expect(valueOf()).toEqual([{ name: "a.pdf", id: "id-a" }]);
  });
});
