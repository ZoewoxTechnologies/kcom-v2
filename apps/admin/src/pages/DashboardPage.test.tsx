import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { DashboardPage } from "./DashboardPage";

const NOW = new Date("2026-11-19T10:00:00Z"); // 11:00 on 19 Nov in Lagos

const cap = (id: string, title: string, status: string, publishAt: string) => ({
  id,
  title,
  slug: id,
  status,
  seriesId: null,
  partNumber: null,
  publishAt,
});

function mockApi(data: {
  capsules?: unknown[];
  events?: { total: number; next: string | null };
  activity?: unknown[];
  fail?: boolean;
  /** Request paths (substrings) that answer 500, the rest working. */
  failing?: string[];
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const json = (b: unknown) =>
        new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
      if (data.fail || data.failing?.some((p) => url.includes(p))) {
        return new Response("{}", { status: 500 });
      }
      if (url.includes("/admin/activity")) return json({ items: data.activity ?? [] });
      if (url.includes("/admin/subscribers/count"))
        return json({ confirmed: 1284, addedThisMonth: 36 });
      if (url.includes("/admin/events/upcoming"))
        return json(data.events ?? { total: 0, next: null });
      const all = data.capsules ?? [];
      const q = new URL(url, "http://x").searchParams;
      const from = q.get("from");
      const to = q.get("to");
      const items = all.filter((c) => {
        const { status, publishAt } = c as { status: string; publishAt: string };
        if (url.includes("status=draft")) return status === "draft";
        return (!from || publishAt >= from) && (!to || publishAt < to);
      });
      return json({ items, total: items.length });
    }),
  );
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: NOW }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("dashboard", () => {
  it("shows live numbers, today, coming up and drafts with editor links", async () => {
    mockApi({
      capsules: [
        cap("t", "Be Ye Transformed", "published", "2026-11-18T23:00:00Z"),
        cap("m", "Thinking on These Things", "scheduled", "2026-11-20T23:00:00Z"),
        cap("d", "A Sound Mind", "draft", "2026-11-25T23:00:00Z"),
      ],
      events: { total: 3, next: "2026-12-06T10:00:00Z" },
      activity: [
        { at: "2026-11-19T08:12:00Z", text: "Grace A. subscribed", href: null, badge: null },
        { at: "2026-11-18T09:00:00Z", text: "Contact: a prayer request", href: null, badge: "New" },
        {
          at: "2026-11-12T09:00:00Z",
          text: "Blog post updated: Hi",
          href: "/blog/b1",
          badge: null,
        },
      ],
    });
    renderPage();
    expect(await screen.findByText("1,284")).toBeTruthy();
    expect(screen.getByText("+36 this month")).toBeTruthy();
    expect(screen.getByText("Grace A. subscribed")).toBeTruthy();
    expect(screen.getByText("09:12")).toBeTruthy();
    expect(screen.getByText("Yesterday")).toBeTruthy();
    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Blog post updated: Hi" }).getAttribute("href")).toBe(
      "/blog/b1",
    );
    expect(screen.getByText("Next: 6 Dec")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Be Ye Transformed" }).getAttribute("href")).toBe(
      "/capsules/t",
    );
    expect(screen.getByRole("link", { name: "A Sound Mind" }).getAttribute("href")).toBe(
      "/capsules/d",
    );
    expect(screen.getByRole("link", { name: "New capsule" }).getAttribute("href")).toBe(
      "/capsules/new",
    );
    // Tomorrow (20 Nov) has no capsule.
    expect(screen.getByRole("link", { name: "Write it now" }).getAttribute("href")).toBe(
      "/capsules/new?day=2026-11-20",
    );
  });

  it("has empty states", async () => {
    mockApi({});
    renderPage();
    expect(await screen.findByText(/No drafts/)).toBeTruthy();
    expect(screen.getByText("None planned")).toBeTruthy();
    expect(screen.getAllByText("Missing")).toHaveLength(4);
  });

  it("hides the heads-up when tomorrow is covered", async () => {
    mockApi({ capsules: [cap("m", "Tomorrow", "draft", "2026-11-19T23:00:00Z")] });
    renderPage();
    await screen.findAllByRole("link", { name: "Tomorrow" });
    expect(screen.queryByText(/isn’t written yet/)).toBeNull();
  });

  it("shows an error in every panel when everything fails, without crashing the page", async () => {
    mockApi({ fail: true });
    renderPage();
    expect(await screen.findAllByRole("alert")).toHaveLength(6);
    expect(screen.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "New capsule" })).toBeTruthy();
  });

  it("keeps the rest of the dashboard working when /admin/activity returns 500", async () => {
    mockApi({
      capsules: [cap("d", "A Sound Mind", "draft", "2026-11-25T23:00:00Z")],
      failing: ["/admin/activity"],
    });
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("recent activity could not be loaded");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Recent activity" })).toBeTruthy();
    expect(await screen.findByText("1,284")).toBeTruthy();
    expect(screen.getByRole("link", { name: "A Sound Mind" })).toBeTruthy();
    expect(screen.getByText("None planned")).toBeTruthy();
  });

  it("breaks only the numbers tile when the subscriber count fails", async () => {
    mockApi({ failing: ["/admin/subscribers/count"] });
    renderPage();
    expect((await screen.findByRole("alert")).textContent).toContain("Could not be loaded");
    expect(await screen.findByText(/No drafts/)).toBeTruthy();
    expect(screen.getByText("Nothing yet.")).toBeTruthy();
  });

  it("retries just the failed panel", async () => {
    mockApi({ failing: ["/admin/activity"] });
    renderPage();
    await screen.findByRole("alert");
    // The endpoint recovers.
    mockApi({
      activity: [
        {
          at: "2026-11-19T08:12:00Z",
          text: "Grace A. updated blog post: Hi",
          href: null,
          badge: null,
        },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Grace A. updated blog post: Hi")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
