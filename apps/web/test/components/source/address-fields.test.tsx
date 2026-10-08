// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { useForm } from "react-hook-form";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { Toaster } from "@repo/ui/components/sonner";

import { AddressFields } from "@/components/source/address-fields";
import type { AddressParts } from "@/components/source/address-fields";

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

type Values = { address: { postCode: string; pref: string; cityTown: string; address1: string } };

const SHINJUKU: AddressParts = { pref: "東京都", city: "新宿区", town: "新宿" };

const Harness = ({
  findAddress,
}: {
  findAddress: (code: string) => Promise<AddressParts | null>;
}) => {
  const form = useForm<Values>({
    defaultValues: { address: { postCode: "", pref: "", cityTown: "", address1: "" } },
  });
  return (
    <AddressFields
      control={form.control}
      names={{
        postCode: "address.postCode",
        pref: "address.pref",
        cityTown: "address.cityTown",
        address1: "address.address1",
      }}
      findAddress={findAddress}
    />
  );
};

/** The master as a lookup: 1600022 is 新宿, everything else unknown. */
const master = (code: string) => Promise.resolve(code === "1600022" ? SHINJUKU : null);

const renderFields = (findAddress = master) =>
  render(
    <StrictMode>
      <Harness findAddress={findAddress} />
      <Toaster />
    </StrictMode>,
  );

const typePostCode = (value: string) => {
  fireEvent.change(screen.getByLabelText(/郵便番号/), { target: { value } });
};

/** The read-only value shown under a label. */
const shown = (label: RegExp) => screen.getByLabelText(label).textContent;

describe("AddressFields", () => {
  it("fills 住所(県名) and 住所(市町村名) once a complete post code is typed, hyphen or not", async () => {
    renderFields();

    typePostCode("160-0022");

    expect(await screen.findByText("東京都")).toBeDefined();
    expect(shown(/住所\(市町村名\)/)).toBe("新宿区新宿");
    typePostCode("1600022");
    expect(await screen.findByText("新宿区新宿")).toBeDefined();
  });

  it("empties them and says 郵便番号が見つかりません。 for an unknown post code", async () => {
    renderFields();
    typePostCode("1600022");
    await screen.findByText("東京都");

    typePostCode("0000000");

    expect(await screen.findByText("郵便番号が見つかりません。")).toBeDefined();
    expect(shown(/住所\(県名\)/)).toBe("—");
    expect(shown(/住所\(市町村名\)/)).toBe("—");
  });

  it("empties them while the post code is incomplete", async () => {
    renderFields();
    typePostCode("1600022");
    await screen.findByText("東京都");

    typePostCode("160002");

    expect(shown(/住所\(県名\)/)).toBe("—");
  });

  it("keeps the answer for the latest code when an earlier lookup answers last", async () => {
    let answerFirst: (parts: AddressParts | null) => void = () => undefined;
    const findAddress = (code: string) =>
      code === "1000001"
        ? new Promise<AddressParts | null>((resolve) => {
            answerFirst = resolve;
          })
        : master(code);
    renderFields(findAddress);

    typePostCode("1000001");
    typePostCode("1600022");
    await screen.findByText("東京都");
    answerFirst({ pref: "東京都", city: "千代田区", town: "千代田" });
    await Promise.resolve();

    expect(shown(/住所\(市町村名\)/)).toBe("新宿区新宿");
  });

  it("keeps the typed 住所 line beside the lookup", () => {
    renderFields();

    fireEvent.change(screen.getByLabelText(/^住所/, { selector: "input" }), {
      target: { value: "1-2-3" },
    });

    expect(screen.getByLabelText(/^住所/, { selector: "input" })).toHaveProperty("value", "1-2-3");
  });
});
