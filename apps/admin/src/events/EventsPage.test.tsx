import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ToastProvider } from "@kcom/ui";
import { EventsPage, formatEventDates } from "./EventsPage";
import type { EventRecord } from "./api";

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const make = (over: Partial<EventRecord>): EventRecord => ({
  id: "1",
  title: "Conference",
  slug: "conference",
  startsAt: future(30),
  endsAt: null,
  place: null,
  description: null,
  status: "draft",
  ...over,
});

let store: EventRecord[];
let calls: { method: string; path: string; body?: Record<string, unknown> }[];

beforeEach(() => {
  calls = [];
  store = [
    make({ id: "1", title: "Conference", status: "draft" }),
    make({
      id: "2",
      title: "Thanksgiving",
      slug: "thanksgiving",
      status: "published",
      startsAt: future(5),
    }),
    make({
      id: "3",
      title: "Old Retreat",
      slug: "old-retreat",
      status: "published",
      startsAt: future(-40),
    }),
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const path = new URL(url).pathname.replace("/admin/events", "") || "/";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path, body });
      const json = (b: unknown, status = 200) =>
        new Response(JSON.stringify(b), {
          status,
          headers: { "content-type": "application/json" },
        });
      if (method === "GET") return json({ items: store, total: store.length });
      if (method === "POST") {
        const row = make({ ...body, id: "9" });
        store.push(row);
        return json(row, 201);
      }
      const id = path.slice(1);
      if (method === "PATCH") {
        store = store.map((e) => (e.id === id ? { ...e, ...body } : e));
        return json(store.find((e) => e.id === id));
      }
      store = store.filter((e) => e.id !== id);
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const router = createMemoryRouter([{ path: "/", element: <EventsPage /> }]);
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}
const rows = () => screen.getAllByRole("row").slice(1);

describe("EventsPage", () => {
  it("lists upcoming events by default and switches to past", async () => {
    setup();
    await screen.findByText("Conference");
    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toHaveTextContent("Thanksgiving");
    await userEvent.click(screen.getByRole("button", { name: "Past" }));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Old Retreat");
  });

  it("shows the nothing-selected panel until an event is opened", async () => {
    setup();
    await screen.findByText("Conference");
    expect(screen.getByText("No event selected")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Conference"));
    expect(await screen.findByRole("region", { name: "Editing" })).toBeInTheDocument();
  });

  it("creates and publishes an event", async () => {
    setup();
    await screen.findByText("Conference");
    await userEvent.click(screen.getAllByRole("button", { name: "New event" })[0]!);
    const dialog = await screen.findByRole("region", { name: "New event" });
    await userEvent.type(within(dialog).getByLabelText(/Title/), "Prayer Night");
    // Start time is required.
    await userEvent.click(within(dialog).getByRole("button", { name: "Publish" }));
    expect(await within(dialog).findByText("Choose a start time.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("saves edits to an existing event and publishes it", async () => {
    setup();
    await userEvent.click(await screen.findByText("Conference"));
    const dialog = await screen.findByRole("region", { name: "Editing" });
    await userEvent.type(within(dialog).getByLabelText(/Description/), "Three days");
    await userEvent.click(within(dialog).getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")).toBeTruthy());
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.path).toBe("/1");
    expect(patch.body).toMatchObject({ status: "published" });
    expect(JSON.stringify(patch.body?.description)).toContain("Three days");
    await waitFor(() => expect(screen.queryByRole("region", { name: "Editing" })).toBeNull());
  });

  it("deletes after confirming", async () => {
    setup();
    await userEvent.click(await screen.findByText("Conference"));
    const dialog = await screen.findByRole("region", { name: "Editing" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete", description: undefined }),
    );
    await waitFor(() =>
      expect(calls.some((c) => c.method === "DELETE" && c.path === "/1")).toBe(true),
    );
  });

  it("asks before closing with unsaved edits, and Esc never closes", async () => {
    setup();
    await userEvent.click(await screen.findByText("Conference"));
    const dialog = await screen.findByRole("region", { name: "Editing" });
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "Editing" })).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Title/), " 2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Editing" })).toBeNull());
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("closes a clean editor without asking", async () => {
    setup();
    await userEvent.click(await screen.findByText("Conference"));
    const dialog = await screen.findByRole("region", { name: "Editing" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Discard your changes?")).toBeNull();
    await waitFor(() => expect(screen.queryByRole("region", { name: "Editing" })).toBeNull());
  });
});

describe("formatEventDates", () => {
  it("formats single days and ranges", () => {
    expect(formatEventDates("2026-12-06T10:00:00Z", null)).toBe("6 Dec 2026");
    expect(formatEventDates("2027-03-12T17:00:00Z", "2027-03-14T13:00:00Z")).toBe("12–14 Mar 2027");
    expect(formatEventDates("2027-03-30T10:00:00Z", "2027-04-02T10:00:00Z")).toBe(
      "30 Mar 2027 – 2 Apr 2027",
    );
  });
});
