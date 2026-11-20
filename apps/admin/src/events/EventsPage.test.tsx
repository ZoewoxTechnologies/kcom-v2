import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ToastProvider } from "@kcom/ui";
import { EventsPage, formatEventDates } from "./EventsPage";
import type { UserRole } from "@kcom/permissions";
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

let role: UserRole = "admin";
vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "u", name: "Grace", email: "g@x.org", role } }),
}));

let store: EventRecord[];
let failNext: { method: string; status: number } | null = null;
let calls: { method: string; path: string; body?: Record<string, unknown> }[];

beforeEach(() => {
  calls = [];
  role = "admin";
  failNext = null;
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
      if (failNext && failNext.method === method) {
        const { status } = failNext;
        failNext = null;
        return new Response(JSON.stringify({ error: { code: "conflict", message: "taken" } }), {
          status,
          headers: { "content-type": "application/json" },
        });
      }
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
    await userEvent.click(within(dialog).getByRole("button", { name: "Close panel" }));
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

async function pickStart(dialog: HTMLElement) {
  await userEvent.click(within(dialog).getByRole("button", { name: "Starts" }));
  await userEvent.click(await screen.findByRole("button", { name: "Next month" }));
  await userEvent.click(screen.getByRole("button", { name: /^15 / }));
  await userEvent.keyboard("{Escape}");
}

describe("EventsPage editing", () => {
  it("creates and publishes with a slug and published status", async () => {
    setup();
    await screen.findByText("Conference");
    await userEvent.click(screen.getAllByRole("button", { name: "New event" })[0]!);
    const editor = await screen.findByRole("region", { name: "New event" });
    await userEvent.type(within(editor).getByLabelText(/Title/), "Prayer Night");
    await pickStart(editor);
    await userEvent.click(within(editor).getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")).toBeTruthy());
    expect(calls.find((c) => c.method === "POST")!.body).toMatchObject({
      title: "Prayer Night",
      slug: "prayer-night",
      status: "published",
    });
  });

  it("shows a duplicate-title error on 409 and keeps the editor open", async () => {
    setup();
    await screen.findByText("Conference");
    await userEvent.click(screen.getAllByRole("button", { name: "New event" })[0]!);
    const editor = await screen.findByRole("region", { name: "New event" });
    await userEvent.type(within(editor).getByLabelText(/Title/), "Conference");
    await pickStart(editor);
    failNext = { method: "POST", status: 409 };
    await userEvent.click(within(editor).getByRole("button", { name: "Publish" }));
    expect(await within(editor).findByText(/already uses this title/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "New event" })).toBeInTheDocument();
  });

  it("unpublishes a published event", async () => {
    setup();
    await userEvent.click(await screen.findByText("Thanksgiving"));
    const editor = await screen.findByRole("region", { name: "Editing" });
    await userEvent.click(within(editor).getByRole("button", { name: "Unpublish" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")).toBeTruthy());
    expect(calls.find((c) => c.method === "PATCH")!.body).toMatchObject({ status: "draft" });
  });

  it("leaves the description out of the save when it was not edited", async () => {
    store[0]!.description = {
      type: "doc",
      content: [{ type: "heading", content: [{ type: "text", text: "Rich" }] }],
    };
    setup();
    await userEvent.click(await screen.findByText("Conference"));
    const editor = await screen.findByRole("region", { name: "Editing" });
    await userEvent.type(within(editor).getByLabelText(/Title/), " 2");
    await userEvent.click(within(editor).getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")).toBeTruthy());
    expect(calls.find((c) => c.method === "PATCH")!.body).not.toHaveProperty("description");
  });

  it('labels the prompt\'s save action "Save changes" for a published event', async () => {
    setup();
    await userEvent.click(await screen.findByText("Thanksgiving"));
    const editor = await screen.findByRole("region", { name: "Editing" });
    await userEvent.type(within(editor).getByLabelText(/Title/), " 2");
    await userEvent.click(within(editor).getByRole("button", { name: "Close panel" }));
    const prompt = await screen.findByRole("alertdialog");
    expect(within(prompt).getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("offers Retry when loading fails, instead of the empty state", async () => {
    const real = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline")));
    setup();
    expect(await screen.findByText("Couldn\u2019t load events")).toBeInTheDocument();
    expect(screen.queryByText("No upcoming events")).toBeNull();
    vi.stubGlobal("fetch", real);
  });

  it("hides publishing actions for a role without publish permission", async () => {
    role = "viewer" as UserRole;
    setup();
    await userEvent.click(await screen.findByText("Conference"));
    const editor = await screen.findByRole("region", { name: "Editing" });
    expect(within(editor).queryByRole("button", { name: "Publish" })).toBeNull();
    expect(within(editor).queryByRole("button", { name: "Delete" })).toBeNull();
  });
});

describe("switching events with unsaved edits", () => {
  const edit = async () => {
    await userEvent.click(await screen.findByText("Conference"));
    const editor = await screen.findByRole("region", { name: "Editing" });
    await userEvent.type(within(editor).getByLabelText(/Title/), " 2");
    return editor;
  };

  it("asks before another row replaces the editor, and Keep editing stays put", async () => {
    setup();
    await edit();
    await userEvent.click(screen.getByText("Thanksgiving"));
    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText(/Title/)).toHaveValue("Conference 2");
  });

  it("Discard switches to the chosen event without saving", async () => {
    setup();
    await edit();
    await userEvent.click(screen.getAllByRole("button", { name: "New event" })[0]!);
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
    expect(await screen.findByRole("region", { name: "New event" })).toBeInTheDocument();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("Save draft saves the edits, then switches", async () => {
    setup();
    await edit();
    await userEvent.click(screen.getByText("Thanksgiving"));
    await userEvent.click(await screen.findByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.path).toBe("/1"));
    await waitFor(() => expect(screen.getByLabelText(/Title/)).toHaveValue("Thanksgiving"));
  });

  it("switches straight away when nothing was edited", async () => {
    setup();
    await userEvent.click(await screen.findByText("Conference"));
    await userEvent.click(screen.getByText("Thanksgiving"));
    expect(screen.queryByText("Discard your changes?")).toBeNull();
    await waitFor(() => expect(screen.getByLabelText(/Title/)).toHaveValue("Thanksgiving"));
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
