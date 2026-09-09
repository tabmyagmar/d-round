/**
 * Registry of every queue in the system. Adding a queue means: add its name here, its
 * payload type next to its producer (ID-only payloads!), a processor in apps/worker.
 * See .claude/rules/queue.md. Phase 0 ships no concrete queues on purpose.
 */
export const QUEUE_NAMES = {} as const satisfies Record<string, string>;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
