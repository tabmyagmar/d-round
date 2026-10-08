// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useForm, useWatch } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { NameFields } from "@/components/name-fields";

afterEach(cleanup);

type Contact = {
  contactLastName: string;
  contactFirstName: string;
  contactLastNameKana: string;
  contactFirstNameKana: string;
};

/** A form whose name parts sit under other keys, as the 就業先部署's 連絡担当者. */
const ContactHarness = () => {
  const form = useForm<Contact>({
    defaultValues: {
      contactLastName: "",
      contactFirstName: "",
      contactLastNameKana: "",
      contactFirstNameKana: "",
    },
  });
  const values = useWatch({ control: form.control });
  return (
    <>
      <NameFields
        control={form.control}
        names={{
          lastName: "contactLastName",
          firstName: "contactFirstName",
          lastNameKana: "contactLastNameKana",
          firstNameKana: "contactFirstNameKana",
        }}
      />
      <output data-testid="values">{JSON.stringify(values)}</output>
    </>
  );
};

/** A form with the default keys, as the user and staff forms. */
const DefaultHarness = () => {
  const form = useForm({
    defaultValues: { lastName: "山田", firstName: "", lastNameKana: "", firstNameKana: "" },
  });
  return <NameFields control={form.control} />;
};

describe("NameFields", () => {
  it("binds the four parts to the form's own keys by default", () => {
    render(<DefaultHarness />);

    expect(screen.getByLabelText(/^姓/)).toHaveProperty("value", "山田");
  });

  it("binds them to the keys `names` gives, two per row with the legacy labels", () => {
    render(<ContactHarness />);

    fireEvent.change(screen.getByLabelText(/^姓/), { target: { value: "佐藤" } });
    fireEvent.change(screen.getByLabelText(/^メイ/), { target: { value: "イチロウ" } });

    expect(JSON.parse(screen.getByTestId("values").textContent)).toMatchObject({
      contactLastName: "佐藤",
      contactFirstNameKana: "イチロウ",
    });
  });
});
