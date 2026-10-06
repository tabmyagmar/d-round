import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EMAIL_TEMPLATES, emailJobId } from "@repo/queue";

import { createAuthEmailSenders } from "../../../src/modules/email/auth-emails";
import { createHarness } from "../../support";
import type { TestHarness } from "../../support";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

const userWith = (name: string) => ({
  id: crypto.randomUUID(),
  email: `${crypto.randomUUID()}@example.com`,
  name,
});

const outboxFor = (to: string) => h.db.outboxEmail.findMany({ where: { to } });

describe("Better Auth mail callbacks → outbox", () => {
  it.each([
    ["invitation", EMAIL_TEMPLATES.accountInvitation],
    ["reset", EMAIL_TEMPLATES.passwordReset],
  ] as const)("writes a %s link as the %s template and enqueues it", async (purpose, template) => {
    const senders = createAuthEmailSenders(h);
    const user = userWith("山田 花子");
    const url = "http://localhost:4000/api/auth/reset-password/tok?callbackURL=x";

    await senders.sendPasswordResetEmail({ user, url, purpose });

    const rows = await outboxFor(user.email);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      template,
      status: "PENDING",
      payload: { name: "山田 花子", url },
    });
    const job = await h.emailQueue.getJob(emailJobId(rows[0]?.id ?? ""));
    expect(job?.data.outboxEmailId).toBe(rows[0]?.id);
  });

  it("writes a verification link as the verification template", async () => {
    const senders = createAuthEmailSenders(h);
    const user = userWith("Verify");

    await senders.sendVerificationEmail({ user, url: "https://app.example.com/v?t=1", token: "t" });

    const rows = await outboxFor(user.email);
    expect(rows.map((row) => row.template)).toEqual([EMAIL_TEMPLATES.verification]);
  });
});
