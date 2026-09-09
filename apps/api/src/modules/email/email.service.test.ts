import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withTransaction } from "@repo/database";
import { EMAIL_TEMPLATES, emailJobId } from "@repo/queue";

import { createHarness } from "../../../test/support";
import type { TestHarness } from "../../../test/support";

import { queueEmailInTransaction, sendEmail } from "./email.service";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

const request = (to: string) => ({
  to,
  template: EMAIL_TEMPLATES.verification,
  payload: { name: "Outbox", url: "https://app.example.com/verify?token=t" },
  traceId: "req-outbox",
});

describe("email outbox producer", () => {
  it("writes the row and enqueues the job with a deterministic id after commit", async () => {
    const to = `${crypto.randomUUID()}@example.com`;

    const row = await sendEmail(h, request(to));

    expect(row.status).toBe("PENDING");
    const job = await h.emailQueue.getJob(emailJobId(row.id));
    expect(job?.data).toEqual({ outboxEmailId: row.id, traceId: "req-outbox" });
    expect(job?.opts.attempts).toBe(5);
  });

  it("leaves no row and no job behind when the surrounding transaction rolls back", async () => {
    const to = `${crypto.randomUUID()}@example.com`;
    let rowId = "";

    await expect(
      withTransaction(h.db, async (transaction) => {
        const row = await queueEmailInTransaction(h, transaction, request(to));
        rowId = row.id;
        throw new Error("business rule failed after the mail was queued");
      }),
    ).rejects.toThrow("business rule failed");

    expect(await h.db.outboxEmail.findMany({ where: { to } })).toHaveLength(0);
    expect(await h.emailQueue.getJob(emailJobId(rowId))).toBeUndefined();
  });
});
