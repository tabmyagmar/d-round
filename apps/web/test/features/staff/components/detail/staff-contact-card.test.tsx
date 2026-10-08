// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StaffContactCard } from "@/features/staff/components/detail/staff-contact-card";

import { staffDetail } from "../../fixtures";

afterEach(cleanup);

const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

describe("StaffContactCard", () => {
  it("writes the post code with 〒 and the whole address: the master's part, then the typed line", () => {
    render(<StaffContactCard staff={staffDetail({ email: "hanako@example.com" })} />);

    expect(valueOf("郵便番号")).toBe("〒160-0022");
    expect(valueOf("住所")).toBe("東京都新宿区新宿1-2-3");
    expect(valueOf("電話番号")).toBe("090-1234-5678");
    expect(valueOf("緊急連絡先（電話番号）")).toBe("—");
    expect(valueOf("メールアドレス")).toBe("hanako@example.com");
  });

  it("shows — without an address", () => {
    render(<StaffContactCard staff={staffDetail({ address: null })} />);

    expect(valueOf("郵便番号")).toBe("—");
    expect(valueOf("住所")).toBe("—");
  });
});
