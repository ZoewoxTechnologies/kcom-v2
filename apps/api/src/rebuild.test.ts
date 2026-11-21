import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changesSiteContent, createRebuildTrigger, rebuildFromEnv } from "./rebuild.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const ok = (...args: Parameters<typeof fetch>) => (
  void args,
  Promise.resolve(new Response(null, { status: 204 }))
);

describe("createRebuildTrigger", () => {
  it("turns a burst of changes into one request after the quiet period", async () => {
    const fetch = vi.fn(ok);
    const t = createRebuildTrigger({
      url: "http://hook.test",
      token: "tok",
      debounceMs: 1000,
      fetch,
    });
    t.schedule();
    await vi.advanceTimersByTimeAsync(600);
    t.schedule();
    await vi.advanceTimersByTimeAsync(600);
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://hook.test");
    expect(init).toMatchObject({ method: "POST", headers: { authorization: "Bearer tok" } });
    t.schedule();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("reports a failed or rejected request without throwing", async () => {
    const onError = vi.fn();
    const bad = createRebuildTrigger({
      url: "http://hook.test",
      debounceMs: 10,
      fetch: () => Promise.resolve(new Response(null, { status: 500 })),
      onError,
    });
    bad.schedule();
    await vi.advanceTimersByTimeAsync(20);
    expect(onError).toHaveBeenCalledTimes(1);
    const down = createRebuildTrigger({
      url: "http://hook.test",
      debounceMs: 10,
      fetch: () => Promise.reject(new Error("offline")),
      onError,
    });
    down.schedule();
    await vi.advanceTimersByTimeAsync(20);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("sends nothing after cancel", async () => {
    const fetch = vi.fn(ok);
    const t = createRebuildTrigger({ url: "http://hook.test", debounceMs: 10, fetch });
    t.schedule();
    t.cancel();
    await vi.advanceTimersByTimeAsync(50);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("rebuildFromEnv", () => {
  it("is off without a URL and on with one", () => {
    expect(rebuildFromEnv({})).toBeUndefined();
    expect(rebuildFromEnv({ REBUILD_HOOK_URL: "http://hook.test" })).toBeDefined();
  });
});

describe("changesSiteContent", () => {
  it("is true only for successful writes to public content areas", () => {
    expect(changesSiteContent("PATCH", "/admin/blog/1", 200)).toBe(true);
    expect(changesSiteContent("PUT", "/admin/books/order", 200)).toBe(true);
    expect(changesSiteContent("DELETE", "/admin/events/1", 204)).toBe(true);
    expect(changesSiteContent("GET", "/admin/blog", 200)).toBe(false);
    expect(changesSiteContent("PATCH", "/admin/blog/1", 422)).toBe(false);
    expect(changesSiteContent("POST", "/admin/subscribers", 201)).toBe(false);
    expect(changesSiteContent("POST", "/admin/capsules", 201)).toBe(false);
  });
});

describe("app wiring", () => {
  it("asks for a rebuild on a content write and on a capsule publish, not on a read", async () => {
    vi.useRealTimers();
    const { createTestDb } = await import("@kcom/db/test-db");
    const { createApp } = await import("./app.js");
    const { createCapsuleEvents } = await import("./capsule-publishing.js");
    const { seedUser } = await import("./seed-users.js");
    const db = await createTestDb();
    await seedUser(db, {
      email: "e@example.test",
      password: "correct horse battery",
      role: "editor",
    });
    const schedule = vi.fn();
    const capsuleEvents = createCapsuleEvents();
    const app = createApp(db, {
      corsOrigins: ["http://admin.test"],
      auth: { secret: "x".repeat(40), baseURL: "http://api.test" },
      capsuleEvents,
      rebuild: { schedule, cancel: () => {} },
    });
    const signIn = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://admin.test",
        "x-forwarded-for": "10.0.0.1",
      },
      body: JSON.stringify({ email: "e@example.test", password: "correct horse battery" }),
    });
    const cookie = signIn.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const call = (method: string, path: string, json?: unknown) =>
      app.request(path, {
        method,
        headers: {
          cookie,
          origin: "http://admin.test",
          ...(json ? { "content-type": "application/json" } : {}),
        },
        body: json ? JSON.stringify(json) : undefined,
      });
    await call("GET", "/admin/books");
    expect(schedule).not.toHaveBeenCalled();
    const created = await call("POST", "/admin/books", { title: "A", slug: "a" });
    expect(created.status).toBe(201);
    expect(schedule).toHaveBeenCalledTimes(1);
    await capsuleEvents.emitPublished({} as never);
    expect(schedule).toHaveBeenCalledTimes(2);
  });
});
