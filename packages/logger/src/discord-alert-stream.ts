import type { DestinationStream } from "pino";

/**
 * Sends the logger's error and fatal lines to a Discord webhook (docs/adr/0010-alerts.md).
 * `createLogger({ alerts })` routes every line at level error and above here through
 * pino.multistream. One message per incident and per problem: lines that share a requestId or jobId
 * within ALERT_INCIDENT_WINDOW_MS fold into the first, a fingerprint is sent once per
 * ALERT_WINDOW_MS (its next message counts the repeats), and at most ALERT_MAX_PER_MINUTE error
 * messages leave a process per minute; a fatal line always goes. Only the allow-listed identifiers,
 * the log message and the error reach Discord: its type, the first line of its message with e-mail
 * addresses masked, and its first stack frames. A failed send is reported once and dropped, never
 * retried: the log line already exists, and an alert must never fail a request or a job.
 */

export const ALERT_INCIDENT_WINDOW_MS = 10_000;
export const ALERT_WINDOW_MS = 5 * 60_000;
export const ALERT_MAX_PER_MINUTE = 10;
export const ALERT_STACK_LINES = 8;
export const ALERT_SEND_TIMEOUT_MS = 5000;
export const ALERT_FLUSH_TIMEOUT_MS = 3000;

/** The identifiers shown as fields, in this order, when a line carries them. Nothing else is sent. */
export const ALERT_CONTEXT_KEYS = [
  "name",
  "env",
  "requestId",
  "userId",
  "traceId",
  "path",
  "type",
  "method",
  "status",
  "queue",
  "jobId",
  "attemptsMade",
  "outboxEmailId",
  "step",
] as const;

export type DiscordAlertStreamOptions = {
  /** The channel's webhook URL. A secret: whoever holds it can post to the channel. */
  webhookUrl: string;
  /** Tests pass a fake Discord; defaults to the global fetch. */
  fetch?: typeof fetch;
  /** Tests pass a clock; defaults to Date.now. */
  now?: () => number;
  /** Called once per message that did not reach Discord; defaults to one line on stderr. */
  onSendError?: (error: unknown) => void;
};

/** A pino destination plus `flush`, which waits for the sends in flight (the last shutdown step). */
export type DiscordAlertStream = DestinationStream & {
  flush: (timeoutMs?: number) => Promise<void>;
};

type LogLine = Record<string, unknown>;
type Field = { name: string; value: string; inline: boolean };
type DiscordMessage = {
  embeds: {
    title: string;
    description?: string;
    color: number;
    timestamp: string;
    fields: Field[];
  }[];
  allowed_mentions: { parse: string[] };
};

// pino's numeric levels.
const ERROR_LEVEL = 50;
const FATAL_LEVEL = 60;
const ONE_MINUTE_MS = 60_000;

// Discord allows a 256-character title, a 4096 description, 1024 per field value and 6000 per
// embed; with at most 16 fields these caps keep the worst case near 4300.
const TITLE_MAX = 256;
const MESSAGE_MAX = 500;
const FRAME_MAX = 200;
const VALUE_MAX = 100;

const STYLE = {
  error: { emoji: "🟠", color: 15_158_332 },
  fatal: { emoji: "🔴", color: 16_711_680 },
};

const cut = (text: string, max: number): string => {
  if (text.length <= max) {
    return text;
  }
  const head = text.slice(0, max - 1);
  // Never end on half of a surrogate pair: Discord refuses the broken character.
  const last = head.charCodeAt(head.length - 1);
  return `${last >= 0xd800 && last <= 0xdbff ? head.slice(0, -1) : head}…`;
};

const asText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value === "" ? undefined : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
};

/** Backticks keep IDs and paths copyable and stop Discord from reading `_` or `*` as markdown. */
const inlineCode = (value: string): string =>
  `\`${cut(value.replaceAll("`", "'"), VALUE_MAX - 2)}\``;

const noFences = (text: string): string => text.replaceAll("```", "'''");

// The personal data error messages quote most: an SMTP 550 names the recipient.
const EMAIL_ADDRESS = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

/** The first line only: Prisma and others print the query and its arguments below it. */
const messageLine = (text: string): string => {
  const first = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "");
  return noFences(cut((first ?? "").replaceAll(EMAIL_ADDRESS, "[email]"), MESSAGE_MAX));
};

/** pino's err serializer gives `{ type, message, stack }`; a rejected non-Error arrives as is. */
const describeError = (err: unknown): string | undefined => {
  const text = asText(err);
  if (text !== undefined) {
    return messageLine(text);
  }
  if (typeof err !== "object" || err === null) {
    return undefined;
  }
  const { type, message, stack } = err as LogLine;
  const head = `**${noFences(cut(asText(type) ?? "Error", VALUE_MAX))}:** ${messageLine(
    asText(message) ?? "",
  )}`;
  const frames = (asText(stack) ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "))
    .slice(0, ALERT_STACK_LINES)
    .map((frame) => noFences(cut(frame, FRAME_MAX)));
  return frames.length === 0 ? head : `${head}\n\`\`\`txt\n${frames.join("\n")}\n\`\`\``;
};

const errorType = (err: unknown): string | undefined =>
  typeof err === "object" && err !== null ? asText((err as LogLine)["type"]) : undefined;

/** The same problem: same process, message, error type and, when present, path, queue, status. */
const fingerprintOf = (line: LogLine): string =>
  [line["name"], line["msg"], errorType(line["err"]), line["path"], line["queue"], line["status"]]
    .map((part) => asText(part) ?? "")
    .join("|");

const buildMessage = (
  line: LogLine,
  level: number,
  counts: { repeats: number; dropped: number },
  at: number,
): DiscordMessage => {
  const style = level >= FATAL_LEVEL ? STYLE.fatal : STYLE.error;
  const fields: Field[] = [];
  for (const key of ALERT_CONTEXT_KEYS) {
    const value = asText(line[key]);
    if (value !== undefined) {
      fields.push({ name: key, value: inlineCode(value), inline: true });
    }
  }
  if (counts.repeats > 0) {
    fields.push({
      name: "repeats",
      value: `${counts.repeats} more since the last alert`,
      inline: false,
    });
  }
  if (counts.dropped > 0) {
    fields.push({
      name: "dropped",
      value: `${counts.dropped} not sent (rate limit or failed send); see the logs`,
      inline: false,
    });
  }
  const description = describeError(line["err"]);
  const time = line["time"];
  return {
    embeds: [
      {
        title: cut(`${style.emoji} ${asText(line["msg"]) ?? "(no message)"}`, TITLE_MAX),
        ...(description === undefined ? {} : { description }),
        color: style.color,
        timestamp: typeof time === "string" ? time : new Date(at).toISOString(),
        fields,
      },
    ],
    // An error message that says @everyone must not ping anybody.
    allowed_mentions: { parse: [] },
  };
};

/** stderr, not the logger: the logger feeds this stream, so a failed alert would alert again. */
const reportToStderr = (error: unknown): void => {
  const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const cause =
    error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : "";
  process.stderr.write(`discord alert not sent: ${reason}${cause}\n`);
};

export const createDiscordAlertStream = (
  options: DiscordAlertStreamOptions,
): DiscordAlertStream => {
  const {
    webhookUrl,
    fetch: send = globalThis.fetch,
    now = Date.now,
    onSendError = reportToStderr,
  } = options;
  /** requestId or jobId → when its first line arrived. */
  const incidents = new Map<string, number>();
  /** fingerprint → its last message and the lines suppressed since. */
  const problems = new Map<string, { sentAt: number; repeats: number }>();
  let sentInLastMinute: number[] = [];
  /** Messages lost to the rate limit or a failed send since the last one that left. */
  let dropped = 0;
  const inFlight = new Set<Promise<void>>();

  /** A throwing onSendError must neither reach the logging caller nor leave a rejection behind. */
  const report = (error: unknown): void => {
    try {
      onSendError(error);
    } catch {
      // Nothing is left to tell.
    }
  };

  const post = async (message: DiscordMessage): Promise<void> => {
    const response = await send(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(ALERT_SEND_TIMEOUT_MS),
    });
    // Read the body either way: it frees the connection, and a refusal explains itself there.
    const answer = await response.text();
    if (!response.ok) {
      throw new Error(`Discord answered ${response.status}: ${cut(answer, 200)}`);
    }
  };

  const deliver = (message: DiscordMessage, carried: number): void => {
    const sending = post(message)
      .catch((error: unknown) => {
        dropped += carried + 1;
        report(error);
      })
      .finally(() => {
        inFlight.delete(sending);
      });
    inFlight.add(sending);
  };

  // Both maps are in time order (a sent problem moves to the end), so pruning stops at the first
  // live entry. A problem quiet for two windows is forgotten together with its repeat count.
  const prune = (at: number): void => {
    for (const [key, firstAt] of incidents) {
      if (at - firstAt < ALERT_INCIDENT_WINDOW_MS) {
        break;
      }
      incidents.delete(key);
    }
    for (const [key, problem] of problems) {
      if (at - problem.sentAt < 2 * ALERT_WINDOW_MS) {
        break;
      }
      problems.delete(key);
    }
  };

  const handle = (raw: string): void => {
    const line = JSON.parse(raw) as LogLine;
    const level = typeof line["level"] === "number" ? line["level"] : 0;
    if (level < ERROR_LEVEL) {
      return;
    }
    const at = now();
    prune(at);

    const incident = asText(line["requestId"]) ?? asText(line["jobId"]);
    if (incident !== undefined) {
      if (incidents.has(incident)) {
        return;
      }
      incidents.set(incident, at);
    }

    const fingerprint = fingerprintOf(line);
    const problem = problems.get(fingerprint);
    if (problem && at - problem.sentAt < ALERT_WINDOW_MS) {
      problem.repeats += 1;
      return;
    }

    sentInLastMinute = sentInLastMinute.filter((sentAt) => at - sentAt < ONE_MINUTE_MS);
    // A fatal line always goes: the process is dying, and no later message could count it.
    if (level < FATAL_LEVEL && sentInLastMinute.length >= ALERT_MAX_PER_MINUTE) {
      dropped += 1;
      return;
    }
    sentInLastMinute.push(at);
    problems.delete(fingerprint);
    problems.set(fingerprint, { sentAt: at, repeats: 0 });
    const carried = dropped;
    dropped = 0;
    deliver(
      buildMessage(line, level, { repeats: problem?.repeats ?? 0, dropped: carried }, at),
      carried,
    );
  };

  return {
    write: (raw: string) => {
      try {
        handle(raw);
      } catch (error) {
        report(error);
      }
    },
    flush: async (timeoutMs = ALERT_FLUSH_TIMEOUT_MS) => {
      let timer: NodeJS.Timeout | undefined;
      const deadline = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      });
      await Promise.race([Promise.all(inFlight), deadline]);
      clearTimeout(timer);
    },
  };
};
