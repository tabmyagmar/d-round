import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  ALERT_INCIDENT_WINDOW_MS,
  ALERT_MAX_PER_MINUTE,
  ALERT_STACK_LINES,
  ALERT_WINDOW_MS,
  createDiscordAlertStream,
} from "../src/discord-alert-stream";
import { childLogger, createLogger } from "../src/index";

type Field = { name: string; value: string; inline: boolean };
type Embed = {
  title: string;
  description?: string;
  color: number;
  timestamp: string;
  fields: Field[];
};
type Message = { embeds: Embed[]; allowed_mentions: { parse: string[] } };

const noContent = (): Promise<Response> => Promise.resolve(new Response(null, { status: 204 }));

/** A fake Discord (the external provider), a settable clock and a real logger feeding the stream. */
const setup = (respond: () => Promise<Response> = noContent) => {
  const clock = { now: Date.parse("2026-10-08T00:00:00.000Z") };
  const messages: Message[] = [];
  const sendErrors: unknown[] = [];
  const alerts = createDiscordAlertStream({
    webhookUrl: "https://discord.test/api/webhooks/1/secret",
    fetch: (_url, init) => {
      messages.push(JSON.parse(init?.body as string) as Message);
      return respond();
    },
    now: () => clock.now,
    onSendError: (error) => {
      sendErrors.push(error);
    },
  });
  const logger = createLogger(
    { name: "api", base: { env: "test" }, alerts },
    new Writable({
      write: (_chunk, _encoding, callback) => {
        callback();
      },
    }),
  );
  const advance = (ms: number): void => {
    clock.now += ms;
  };
  return { alerts, logger, messages, sendErrors, advance };
};

const embedOf = (message: Message | undefined): Embed => {
  const embed = message?.embeds[0];
  if (!embed) {
    throw new Error("message without an embed");
  }
  return embed;
};

const fieldsOf = (message: Message | undefined): Record<string, string> =>
  Object.fromEntries(embedOf(message).fields.map((field) => [field.name, field.value]));

describe("createDiscordAlertStream", () => {
  it("turns an error line into one embed: title, colour, error, stack frames, identifiers", async () => {
    const { alerts, logger, messages } = setup();

    childLogger(logger, { requestId: "req-1", userId: null }).error(
      { path: "user.list", type: "query", durationMs: 12, err: new TypeError("boom") },
      "request failed",
    );
    await alerts.flush();

    expect(messages).toHaveLength(1);
    expect(messages[0]?.allowed_mentions).toEqual({ parse: [] });
    const embed = embedOf(messages[0]);
    expect(embed.title).toBe("🟠 request failed");
    expect(embed.color).toBe(15_158_332);
    expect(Number.isNaN(Date.parse(embed.timestamp))).toBe(false);
    expect(embed.description).toMatch(/^\*\*TypeError:\*\* boom\n```txt\n/);
    const frames = /```txt\n([\s\S]*)\n```$/.exec(embed.description ?? "")?.[1]?.split("\n") ?? [];
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.length).toBeLessThanOrEqual(ALERT_STACK_LINES);
    expect(frames.every((frame) => frame.startsWith("at "))).toBe(true);
    expect(fieldsOf(messages[0])).toEqual({
      name: "`api`",
      env: "`test`",
      requestId: "`req-1`",
      path: "`user.list`",
      type: "`query`",
    });
  });

  it("marks a fatal line red and needs no error object", async () => {
    const { alerts, logger, messages } = setup();

    logger.fatal({ step: "workers" }, "shutdown timed out, forcing exit");
    await alerts.flush();

    const embed = embedOf(messages[0]);
    expect(embed.title).toBe("🔴 shutdown timed out, forcing exit");
    expect(embed.color).toBe(16_711_680);
    expect(embed.description).toBeUndefined();
    expect(fieldsOf(messages[0])["step"]).toBe("`workers`");
  });

  it("ignores warn and info lines", async () => {
    const { alerts, logger, messages } = setup();

    logger.warn({ err: new Error("not found") }, "request rejected");
    logger.info("request completed");
    await alerts.flush();

    expect(messages).toHaveLength(0);
  });

  it("folds the lines of one failed request or one failed job into one message", async () => {
    const { alerts, logger, messages, advance } = setup();
    const request = childLogger(logger, { requestId: "req-2" });

    request.error({ path: "user.list", err: new Error("db down") }, "request failed");
    request.error({ method: "GET", path: "/trpc/user.list", status: 500 }, "request completed");
    childLogger(logger, { jobId: "email-1" }).error(
      { err: new Error("550 mailbox unavailable") },
      "email delivery failed permanently; row marked FAILED",
    );
    logger.error({ queue: "email", jobId: "email-1", err: new Error("550") }, "job failed");
    advance(ALERT_INCIDENT_WINDOW_MS);
    request.error({ path: "user.list" }, "a later failure under the same request id");
    await alerts.flush();

    expect(messages.map((message) => embedOf(message).title)).toEqual([
      "🟠 request failed",
      "🟠 email delivery failed permanently; row marked FAILED",
      "🟠 a later failure under the same request id",
    ]);
  });

  it("sends a repeated problem once per window and counts the repeats in its next message", async () => {
    const { alerts, logger, messages, advance } = setup();
    const redisDown = (): void => {
      logger.error(
        { err: new Error("connect ECONNREFUSED 127.0.0.1:6380") },
        "redis connection error",
      );
    };

    redisDown();
    redisDown();
    redisDown();
    advance(ALERT_WINDOW_MS - 1);
    redisDown();
    advance(1);
    redisDown();
    await alerts.flush();

    expect(messages).toHaveLength(2);
    expect(fieldsOf(messages[0])["repeats"]).toBeUndefined();
    expect(fieldsOf(messages[1])["repeats"]).toBe("3 more since the last alert");
  });

  it("tells problems apart by path and error type, not by error message", async () => {
    const { alerts, logger, messages } = setup();

    logger.error({ path: "user.list", err: new Error("x") }, "request failed");
    logger.error({ path: "staff.list", err: new Error("x") }, "request failed");
    logger.error({ path: "staff.list", err: new TypeError("x") }, "request failed");
    logger.error({ path: "staff.list", err: new TypeError("y") }, "request failed");
    await alerts.flush();

    expect(messages).toHaveLength(3);
  });

  it("sends at most ALERT_MAX_PER_MINUTE messages a minute and reports what it dropped", async () => {
    const { alerts, logger, messages, advance } = setup();

    for (let index = 0; index <= ALERT_MAX_PER_MINUTE; index += 1) {
      logger.error({ path: `procedure.${index}` }, "request failed");
    }
    await alerts.flush();
    expect(messages).toHaveLength(ALERT_MAX_PER_MINUTE);

    advance(60_000);
    logger.error({ path: "procedure.later" }, "request failed");
    await alerts.flush();

    expect(messages).toHaveLength(ALERT_MAX_PER_MINUTE + 1);
    expect(fieldsOf(messages.at(-1))["dropped"]).toBe(
      "1 not sent (rate limit or failed send); see the logs",
    );
  });

  it("always sends a fatal line, even when the minute's budget is spent", async () => {
    const { alerts, logger, messages } = setup();

    for (let index = 0; index < ALERT_MAX_PER_MINUTE; index += 1) {
      logger.error({ path: `procedure.${index}` }, "request failed");
    }
    logger.fatal({ err: new Error("boom") }, "uncaught exception");
    await alerts.flush();

    expect(messages).toHaveLength(ALERT_MAX_PER_MINUTE + 1);
    expect(embedOf(messages.at(-1)).title).toBe("🔴 uncaught exception");
  });

  it("forgets a problem that stayed quiet for two windows, with its repeat count", async () => {
    const { alerts, logger, messages, advance } = setup();
    const redisDown = (): void => {
      logger.error({ err: new Error("connect ECONNREFUSED") }, "redis connection error");
    };

    redisDown();
    redisDown();
    advance(2 * ALERT_WINDOW_MS);
    redisDown();
    await alerts.flush();

    expect(messages).toHaveLength(2);
    expect(fieldsOf(messages[1])["repeats"]).toBeUndefined();
  });

  it("sends only the first line of an error message, with e-mail addresses masked", async () => {
    const { alerts, logger, messages } = setup();

    logger.error(
      {
        err: new Error(
          '\nInvalid `prisma.staff.create()` invocation:\n\n  data: { phone: "090-1234-5678" }',
        ),
      },
      "request failed",
    );
    logger.error(
      {
        queue: "email",
        err: new Error("all recipients were rejected: 550 <taro.yamada@example.co.jp>: unknown"),
      },
      "job failed",
    );
    await alerts.flush();

    const prisma = embedOf(messages[0]).description ?? "";
    expect(prisma).toContain("**Error:** Invalid `prisma.staff.create()` invocation:\n```txt\n");
    expect(prisma).not.toContain("090-1234-5678");
    const smtp = embedOf(messages[1]).description ?? "";
    expect(smtp).toContain("550 <[email]>: unknown");
    expect(smtp).not.toContain("taro.yamada");
  });

  it("drops a message Discord refuses after one report, without retrying", async () => {
    const { alerts, logger, messages, sendErrors } = setup(() =>
      Promise.resolve(new Response('{"retry_after":1.5}', { status: 429 })),
    );

    logger.error({ err: new Error("boom") }, "request failed");
    await alerts.flush();

    expect(messages).toHaveLength(1);
    expect(sendErrors).toHaveLength(1);
    expect(String(sendErrors[0])).toContain("429");
  });

  it("never throws into the caller when the network fails, and counts the loss", async () => {
    let failing = true;
    const { alerts, logger, messages, sendErrors } = setup(() =>
      failing ? Promise.reject(new TypeError("fetch failed")) : noContent(),
    );

    expect(() => {
      logger.error({ err: new Error("boom") }, "request failed");
    }).not.toThrow();
    await alerts.flush();
    expect(sendErrors).toHaveLength(1);

    failing = false;
    logger.error({ queue: "email", err: new Error("smtp down") }, "job failed");
    await alerts.flush();

    expect(messages).toHaveLength(2);
    expect(fieldsOf(messages[1])["dropped"]).toBe(
      "1 not sent (rate limit or failed send); see the logs",
    );
  });

  it("survives an onSendError that throws", async () => {
    const alerts = createDiscordAlertStream({
      webhookUrl: "https://discord.test/api/webhooks/1/secret",
      fetch: () => Promise.reject(new TypeError("fetch failed")),
      onSendError: () => {
        throw new Error("stderr closed");
      },
    });
    const logger = createLogger(
      { name: "api", alerts },
      new Writable({
        write: (_chunk, _encoding, callback) => {
          callback();
        },
      }),
    );

    expect(() => {
      logger.error("request failed");
    }).not.toThrow();
    // An unguarded rejection would surface here as an unhandled rejection and fail the run.
    await alerts.flush();
  });

  it("keeps every message inside Discord's embed limits", async () => {
    const { alerts, logger, messages } = setup();
    const err = new Error("m".repeat(10_000));
    err.stack = [
      "Error: m",
      ...Array.from(
        { length: 40 },
        (_, index) => `    at f${index} (${"/deep".repeat(80)}.ts:1:1)`,
      ),
    ].join("\n");

    childLogger(logger, { requestId: "r".repeat(2000) }).error(
      { err, path: "p".repeat(5000), status: 500 },
      "t".repeat(1000),
    );
    await alerts.flush();

    const embed = embedOf(messages[0]);
    const description = embed.description ?? "";
    expect(embed.title.length).toBeLessThanOrEqual(256);
    expect(description.length).toBeLessThanOrEqual(4096);
    expect(description.endsWith("```")).toBe(true);
    expect(embed.fields.length).toBeLessThanOrEqual(25);
    for (const field of embed.fields) {
      expect(field.name.length).toBeLessThanOrEqual(256);
      expect(field.value.length).toBeLessThanOrEqual(1024);
    }
    const total = embed.fields.reduce(
      (sum, field) => sum + field.name.length + field.value.length,
      embed.title.length + description.length,
    );
    expect(total).toBeLessThanOrEqual(6000);
  });

  it("flush waits for a send in flight, and gives up after its timeout", async () => {
    let answer: (response: Response) => void = () => undefined;
    const pending = setup(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    pending.logger.error("request failed");
    let flushed = false;
    const flushing = pending.alerts.flush(10_000).then(() => {
      flushed = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(flushed).toBe(false);
    answer(new Response(null, { status: 204 }));
    await flushing;
    expect(flushed).toBe(true);

    const hung = setup(() => new Promise<Response>(() => undefined));
    hung.logger.error("request failed");
    const startedAt = performance.now();
    await hung.alerts.flush(50);
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });
});
