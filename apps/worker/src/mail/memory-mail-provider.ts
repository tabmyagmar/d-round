import { PermanentMailError } from "./mail-provider";
import type { MailMessage, MailProvider, MailSendResult } from "./mail-provider";

export type MemoryMailProviderOptions = {
  /** Reject the first N sends with a retryable error. */
  failFirst?: number;
  /** Reject every send with a PermanentMailError. */
  alwaysFailPermanently?: boolean;
};

export type MemoryMailProvider = MailProvider & {
  sent: MailMessage[];
  attempts: number;
};

/** Test double for the mail transport — the only thing tests are allowed to fake. */
export const createMemoryMailProvider = (
  options: MemoryMailProviderOptions = {},
): MemoryMailProvider => {
  const sent: MailMessage[] = [];
  const state = { attempts: 0 };

  return {
    sent,
    get attempts() {
      return state.attempts;
    },
    send: (message: MailMessage): Promise<MailSendResult> => {
      state.attempts += 1;
      if (options.alwaysFailPermanently) {
        return Promise.reject(new PermanentMailError("mailbox does not exist"));
      }
      if (options.failFirst !== undefined && state.attempts <= options.failFirst) {
        return Promise.reject(new Error(`smtp unavailable (attempt ${String(state.attempts)})`));
      }
      sent.push(message);
      return Promise.resolve({ messageId: `memory-${String(sent.length)}` });
    },
  };
};
