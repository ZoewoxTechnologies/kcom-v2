import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
  fail?: boolean;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const json = (b: unknown) =>
        new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
      if (data.fail) return new Response("{}", { status: 500 });
      if (url.includes("/admin/subscribers/count"))
        return json({ confirmed: 1284, addedThisMonth: 36 });
      if (url.includes("/admin/events/upcoming"))
        return json(data.events ?? { total: 0, next: null });
      const all = data.capsules ?? [];
      const items = url.includes("status=draft")
        ? all.filter((c) => (c as { status: string }).status === "draft")
        : all;
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
    });
    renderPage();
    expect(await screen.findByText("1,284")).toBeTruthy();
    expect(screen.getByText("+36 this month")).toBeTruthy();
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
    expect(screen.queryByText("Heads up")).toBeNull();
  });

  it("says so when loading fails", async () => {
    mockApi({ fail: true });
    renderPage();
    expect((await screen.findByRole("alert")).textContent).toContain("could not be loaded");
  });
});
