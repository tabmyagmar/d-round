// @vitest-environment jsdom
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { Toaster } from "@repo/ui/components/sonner";

import { makeQueryClient } from "@/lib/trpc/query-client";

beforeAll(() => {
  // jsdom has no matchMedia; the toaster reads the system colour scheme through one.
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: false,
    media,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(cleanup);

afterAll(() => {
  vi.unstubAllGlobals();
});

/** A save that fails with `message`; sonner keeps its toasts across tests, so each test has its own. */
const Failing = ({ message, onError }: { message: string; onError?: (error: Error) => void }) => {
  const save = useMutation({
    mutationFn: () => Promise.reject(new Error(message)),
    ...(onError ? { onError } : {}),
  });
  return (
    <button
      type="button"
      onClick={() => {
        save.mutate();
      }}
    >
      保存
    </button>
  );
};

const renderWith = (message: string, onError?: (error: Error) => void) =>
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <Failing message={message} {...(onError ? { onError } : {})} />
      <Toaster />
    </QueryClientProvider>,
  );

describe("makeQueryClient", () => {
  it("shows a failed mutation's message as a toast", async () => {
    renderWith("This staff number is already in use");

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("エラーが発生しました")).toBeDefined();
    expect(screen.getByText("This staff number is already in use")).toBeDefined();
  });

  it("leaves a mutation with its own onError to say it", async () => {
    const onError = vi.fn();
    renderWith("A mutation's own message", onError);

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
    expect(screen.queryByText("A mutation's own message")).toBeNull();
  });
});
