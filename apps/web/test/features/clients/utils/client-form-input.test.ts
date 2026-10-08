import { describe, expect, it } from "vitest";

import {
  clientValuesOf,
  emptyClientValues,
  toClientInput,
} from "@/features/clients/utils/client-form-input";

import { clientDetail } from "../fixtures";

describe("client form input", () => {
  it("starts a new client empty, without FAX or URL", () => {
    expect(emptyClientValues()).toMatchObject({
      name: "",
      chargerUserIds: [],
      address: { postCode: "", address1: "", pref: "", cityTown: "" },
      fax: null,
      webUrl: null,
      orderTypes: [],
    });
  });

  it("edits the stored client: the post code with its hyphen, the master's parts, the codes", () => {
    const client = clientDetail({ fax: "03-1234-5679" });

    expect(clientValuesOf(client)).toEqual({
      number: 101,
      name: "株式会社テスト",
      nameKana: "カブシキガイシャテスト",
      areas: ["EAST"],
      regionCodes: [4],
      chargerUserIds: ["charger-1"],
      address: { postCode: "160-0022", address1: "1-2-3", pref: "東京都", cityTown: "新宿区新宿" },
      phoneNumber: "03-1234-5678",
      fax: "03-1234-5679",
      webUrl: null,
      orderTypes: ["DISPATCH"],
    });
  });

  it("sends the address without the parts the lookup filled", () => {
    const input = toClientInput({
      number: 101,
      name: "株式会社テスト",
      nameKana: "カブシキガイシャテスト",
      areas: ["EAST"],
      regionCodes: [4],
      chargerUserIds: ["charger-1"],
      address: { postCode: "1600022", address1: "1-2-3", pref: "東京都", cityTown: "新宿区新宿" },
      phoneNumber: "03-1234-5678",
      fax: null,
      webUrl: "example.com",
      orderTypes: ["DISPATCH"],
    });

    expect(input.address).toEqual({ postCode: "1600022", address1: "1-2-3" });
    expect(input.webUrl).toBe("example.com");
  });
});
