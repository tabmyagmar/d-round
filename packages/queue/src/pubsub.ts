import { createRedisConnection } from "./connection";
import type { RedisConnection } from "./connection";

export type MessageHandler = (message: string, channel: string) => void;

export type PubSub = {
  publish: (channel: string, message: string) => Promise<number>;
  /** Returns an unsubscribe function. */
  subscribe: (channel: string, handler: MessageHandler) => Promise<() => Promise<void>>;
  close: () => Promise<void>;
};

/**
 * Redis pub/sub for "signal + invalidate" realtime. A subscribing connection cannot run
 * regular commands, so publisher and subscriber always get separate connections.
 * Messages are signals (IDs, channel names) — never payloads; the DB row is the truth.
 */
export const createPubSub = (
  url: string,
  connections: { publisher?: RedisConnection; subscriber?: RedisConnection } = {},
): PubSub => {
  const publisher = connections.publisher ?? createRedisConnection(url, { connectionName: "pub" });
  const subscriber =
    connections.subscriber ?? createRedisConnection(url, { connectionName: "sub" });
  const handlers = new Map<string, Set<MessageHandler>>();

  subscriber.on("message", (channel: string, message: string) => {
    handlers.get(channel)?.forEach((handler) => {
      handler(message, channel);
    });
  });

  return {
    publish: (channel, message) => publisher.publish(channel, message),

    subscribe: async (channel, handler) => {
      let channelHandlers = handlers.get(channel);
      if (!channelHandlers) {
        channelHandlers = new Set();
        handlers.set(channel, channelHandlers);
        await subscriber.subscribe(channel);
      }
      channelHandlers.add(handler);

      return async () => {
        const current = handlers.get(channel);
        current?.delete(handler);
        if (current?.size === 0) {
          handlers.delete(channel);
          await subscriber.unsubscribe(channel);
        }
      };
    },

    close: async () => {
      handlers.clear();
      await Promise.all([publisher.quit(), subscriber.quit()]);
    },
  };
};
