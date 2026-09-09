/**
 * Deterministic job ids make enqueueing idempotent: adding a job whose id already exists
 * in the queue is a no-op in BullMQ. Every producer must derive the id from the DB row it
 * refers to (e.g. `jobIdFor("email", outboxEmail.id)`), never from a counter or Date.now().
 *
 * BullMQ uses ":" as its key separator, so ids are restricted to a safe character set.
 */
const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

export class InvalidJobIdError extends Error {
  constructor(part: "prefix" | "id", value: string) {
    super(`Invalid job ${part} "${value}": only letters, digits, "_" and "-" are allowed`);
    this.name = "InvalidJobIdError";
  }
}

export const jobIdFor = (prefix: string, id: string): string => {
  if (!SAFE_SEGMENT.test(prefix)) {
    throw new InvalidJobIdError("prefix", prefix);
  }
  if (!SAFE_SEGMENT.test(id)) {
    throw new InvalidJobIdError("id", id);
  }
  return `${prefix}-${id}`;
};
