/**
 * Registry of every queue in the system. Adding a queue means: add its name here, its
 * payload type in src/jobs/<name>.job.ts (ID-only payloads!), a processor in apps/worker.
 * See .claude/rules/queue.md.
 */
export const QUEUE_NAMES = {
  email: "email",
} as const satisfies Record<string, string>;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
