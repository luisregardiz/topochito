import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getEnv } from "./env";

export type RateLimitResult = { success: boolean; retryAfterSeconds: number };

export interface RateLimiter {
  limit(key: string): Promise<RateLimitResult>;
}

type Options = { prefix: string; limit: number; windowSeconds: number };

// shortcut: ventana fija por clave, sin limpieza de claves viejas; solo para desarrollo (un proceso).
export function createMemoryRateLimiter(
  { limit, windowSeconds }: Pick<Options, "limit" | "windowSeconds">,
  now: () => number = Date.now,
): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    async limit(key) {
      const t = now();
      let entry = hits.get(key);
      if (!entry || entry.resetAt <= t) {
        entry = { count: 0, resetAt: t + windowSeconds * 1000 };
        hits.set(key, entry);
      }
      entry.count += 1;
      return {
        success: entry.count <= limit,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - t) / 1000)),
      };
    },
  };
}

let warned = false;

export function createRateLimiter(options: Options): RateLimiter {
  const env = getEnv();
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    if (!warned) {
      warned = true;
      console.warn(
        "[rate-limit] sin Upstash: usando memoria (no apto para producción serverless)",
      );
    }
    return createMemoryRateLimiter(options);
  }
  const upstash = new Ratelimit({
    redis: new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(
      options.limit,
      `${options.windowSeconds} s`,
    ),
    prefix: `rl:${options.prefix}`,
  });
  return {
    async limit(key) {
      const r = await upstash.limit(key);
      return {
        success: r.success,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((r.reset - Date.now()) / 1000),
        ),
      };
    },
  };
}
