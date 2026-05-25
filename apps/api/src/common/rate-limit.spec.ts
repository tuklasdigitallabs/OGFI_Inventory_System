import {
  MemoryRateLimitStore,
  RedisRateLimitStore,
  rateLimitRule,
} from "./rate-limit";

describe("rate limiting", () => {
  it("uses stricter limits for login attempts", () => {
    expect(rateLimitRule("/api/auth/login")).toMatchObject({
      key: "auth-login",
      limit: 10,
    });
    expect(rateLimitRule("/api/master-data/items")).toMatchObject({
      key: "api",
      limit: 3000,
    });
    expect(rateLimitRule("/health")).toBeNull();
  });

  it("blocks requests after the configured limit until the window resets", async () => {
    const store = new MemoryRateLimitStore();
    const rule = { key: "test", limit: 2, windowMs: 1000 };

    await expect(store.hit("test:1", rule, 1000)).resolves.toEqual({
      allowed: true,
    });
    await expect(store.hit("test:1", rule, 1001)).resolves.toEqual({
      allowed: true,
    });
    await expect(store.hit("test:1", rule, 1002)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
    await expect(store.hit("test:1", rule, 2001)).resolves.toEqual({
      allowed: true,
    });
  });

  it("uses one Redis script to increment and expire rate limit keys", async () => {
    const redis = {
      eval: jest.fn().mockResolvedValue([3, 1000]),
    };
    const store = new RedisRateLimitStore(redis as never);

    await expect(
      store.hit("auth-login:127.0.0.1", {
        key: "auth-login",
        limit: 2,
        windowMs: 60_000,
      }),
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });

    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("INCR"),
      1,
      "rate-limit:auth-login:127.0.0.1",
      "60000",
    );
  });
});
