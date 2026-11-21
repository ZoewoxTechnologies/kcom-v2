import { describe, expect, it, vi } from "vitest";
import { buildMap, createRedirectLookup, normalisePath } from "./redirects";

const rules = [
  { from: "/content/Its-A-Test", to: "/capsules/its-a-test", status: 301 },
  { from: "/node/7", to: "/blog/x", status: 301 },
];

describe("normalisePath", () => {
  it("lowercases and drops trailing slashes", () => {
    expect(normalisePath("/Content/Foo/")).toBe("/content/foo");
    expect(normalisePath("/")).toBe("/");
    expect(normalisePath("")).toBe("/");
  });
});

describe("buildMap", () => {
  it("keeps the first rule for a path", () => {
    const map = buildMap([...rules, { from: "/node/7", to: "/other", status: 302 }]);
    expect(map.get("/node/7")).toEqual({ to: "/blog/x", status: 301 });
  });
});

describe("createRedirectLookup", () => {
  it("finds old paths regardless of case and trailing slash", async () => {
    const lookup = createRedirectLookup(async () => rules);
    expect(await lookup.find("/content/its-a-test/")).toEqual({ to: "/capsules/its-a-test", status: 301 });
    expect(await lookup.find("/nope")).toBeNull();
  });

  it("loads once and reuses the map until it expires", async () => {
    let t = 0;
    const load = vi.fn(async () => rules);
    const lookup = createRedirectLookup(load, { ttlMs: 1000, now: () => t });
    await lookup.find("/a");
    await lookup.find("/b");
    expect(load).toHaveBeenCalledTimes(1);
    t = 1001;
    await lookup.find("/a");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between concurrent requests", async () => {
    const load = vi.fn(async () => rules);
    const lookup = createRedirectLookup(load);
    await Promise.all([lookup.find("/a"), lookup.find("/b"), lookup.find("/c")]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps the old map and retries later when a reload fails", async () => {
    let t = 0;
    let fail = false;
    const load = vi.fn(async () => {
      if (fail) throw new Error("down");
      return rules;
    });
    const lookup = createRedirectLookup(load, { ttlMs: 1000, retryMs: 50, now: () => t });
    await lookup.find("/a");
    fail = true;
    t = 1001;
    expect(await lookup.find("/node/7")).toEqual({ to: "/blog/x", status: 301 });
    await lookup.find("/a");
    expect(load).toHaveBeenCalledTimes(2); // not retried inside retryMs
    t = 1100;
    await lookup.find("/a");
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("does not throw when the first load fails", async () => {
    const lookup = createRedirectLookup(async () => {
      throw new Error("down");
    });
    expect(await lookup.find("/a")).toBeNull();
  });
});
