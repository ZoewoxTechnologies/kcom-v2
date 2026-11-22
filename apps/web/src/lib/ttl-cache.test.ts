import { describe, expect, it } from "vitest";
import { createTtlCache } from "./ttl-cache";

describe("createTtlCache", () => {
  it("loads once within the TTL and again after it", async () => {
    let t = 0;
    let calls = 0;
    const cache = createTtlCache(async () => ++calls, { ttlMs: 100, now: () => t });
    expect(await cache.get()).toBe(1);
    t = 50;
    expect(await cache.get()).toBe(1);
    t = 150;
    expect(await cache.get()).toBe(2);
    expect(calls).toBe(2);
  });

  it("keeps the last good value when a reload fails, and retries after the short delay", async () => {
    let t = 0;
    let fail = false;
    let calls = 0;
    const cache = createTtlCache(
      async () => {
        calls++;
        if (fail) throw new Error("down");
        return "ok";
      },
      { ttlMs: 100, retryMs: 10, now: () => t },
    );
    expect(await cache.get()).toBe("ok");
    fail = true;
    t = 150;
    expect(await cache.get()).toBe("ok");
    t = 155;
    await cache.get();
    expect(calls).toBe(2);
    t = 170;
    await cache.get();
    expect(calls).toBe(3);
  });

  it("returns null when nothing has ever loaded", async () => {
    const cache = createTtlCache(async () => null);
    expect(await cache.get()).toBeNull();
  });

  it("shares one in-flight load between callers", async () => {
    let calls = 0;
    const cache = createTtlCache(async () => ++calls);
    await Promise.all([cache.get(), cache.get(), cache.get()]);
    expect(calls).toBe(1);
  });
});
