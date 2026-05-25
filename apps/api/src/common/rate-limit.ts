import type { Request } from "express";
import Redis from "ioredis";

export type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

export interface RateLimitStore {
  hit(key: string, rule: RateLimitRule, now?: number): Promise<RateLimitResult>;
}

type Bucket = {
  count: number;
  resetAt: number;
};

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  async hit(key: string, rule: RateLimitRule, now = Date.now()) {
    this.pruneExpired(now);

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + rule.windowMs,
      });
      return { allowed: true };
    }

    bucket.count += 1;
    if (bucket.count <= rule.limit) {
      return { allowed: true };
    }

    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000),
      ),
    };
  }

  private pruneExpired(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: Redis) {}

  async hit(key: string, rule: RateLimitRule) {
    const redisKey = `rate-limit:${key}`;
    const result = (await this.redis.eval(
      `
        local current = redis.call("INCR", KEYS[1])
        if current == 1 then
          redis.call("PEXPIRE", KEYS[1], ARGV[1])
        end
        return { current, redis.call("PTTL", KEYS[1]) }
      `,
      1,
      redisKey,
      String(rule.windowMs),
    )) as [number, number];
    const [count, ttl] = result;

    if (count <= rule.limit) {
      return { allowed: true };
    }

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)),
    };
  }
}

export function rateLimitRule(path: string): RateLimitRule | null {
  if (path === "/api/auth/login") {
    return { key: "auth-login", limit: 10, windowMs: 60_000 };
  }
  if (path === "/api/auth/altcha-challenge") {
    return { key: "auth-altcha", limit: 30, windowMs: 60_000 };
  }
  if (path.startsWith("/api/")) {
    return { key: "api", limit: 3_000, windowMs: 60_000 };
  }
  return null;
}

export function rateLimitKey(request: Request, rule: RateLimitRule) {
  return `${rule.key}:${clientIp(request)}`;
}

export function clientIp(request: Request) {
  return request.ip || request.socket.remoteAddress || "unknown";
}
