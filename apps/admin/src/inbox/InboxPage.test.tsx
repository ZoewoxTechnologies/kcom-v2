import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@kcom/ui";
import { InboxPage, replyHref } from "./InboxPage";
import type { ContactMessage } from "./api";

const make = (over: Partial<ContactMessage>): ContactMessage => ({
  id: "1",
  topic: "question",
  name: "Grace",
  email: "grace@example.org",
  message: "Do you meet on Sundays?",
  keepPrivate: false,
  status: "new",
  createdAt: "2026-11-01T10:00:00Z",
  ...over,
});

let store: ContactMessage[];
let calls: { method: string; url: URL; body?: { status: string } }[];

beforeEach(() => {
  calls = [];
  store = [
    make({ id: "1" }),
    make({ id: "2", name: "Peter", topic: "prayer", keepPrivate: true, message: "Pray for me" }),
    make({ id: "3", name: "Ruth", topic: "testimony", status: "read" }),
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url: u, body });
      const json = (b: unknown) =>
        new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
      if (method === "PATCH") {
        const id = u.pathname.split("/").pop();
        store = store.map((m) => (m.id === id ? { ...m, status: body.status } : m));
        return json(store.find((m) => m.id === id));
      }
      if (u.pathname.endsWith("/unread-count"))
        return json({ unread: store.filter((m) => m.status === "new").length });
      const status = u.searchParams.get("status");
      const topic = u.searchParams.get("topic");
      const items = store.filter(
        (m) => (!status || m.status === status) && (!topic || m.topic === topic),
      );
      return json({ items, total: items.length });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const setup = () =>
  render(
    <ToastProvider>
      <InboxPage />
    </ToastProvider>,
  );
const rows = () => screen.getAllByRole("row").slice(1);

describe("InboxPage", () => {
  it("lists messages with sender, topic and state", async () => {
    setup();
    await screen.findByText("Peter");
    expect(rows()).toHaveLength(3);
    expect(rows()[1]).toHaveTextContent("Private");
    expect(rows()[2]).toHaveTextContent("Read");
  });

  it("sends the status and topic filters to the API", async () => {
    setup();
    await screen.findByText("Peter");
    await userEvent.click(screen.getByRole("radio", { name: "Read" }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(calls.at(-1)!.url.searchParams.get("status")).toBe("read");
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    await userEvent.selectOptions(screen.getByLabelText("Topic"), "prayer");
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(calls.at(-1)!.url.searchParams.get("topic")).toBe("prayer");
  });

  it("opens a message, shows a reply link and marks it read", async () => {
    setup();
    await userEvent.click(await screen.findByText("Grace"));
    expect(await screen.findByText("Do you meet on Sundays?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Reply to grace@example.org/ })).toHaveAttribute(
      "href",
      replyHref({ email: "grace@example.org", topic: "question" }),
    );
    await waitFor(() =>
      expect(calls.some((c) => c.method === "PATCH" && c.body?.status === "read")).toBe(true),
    );
    expect(rows()[0]).toHaveTextContent("Read");
  });

  it("marks an opened message unread again", async () => {
    setup();
    await userEvent.click(await screen.findByText("Ruth"));
    await userEvent.click(screen.getByRole("button", { name: "Mark as unread" }));
    await waitFor(() =>
      expect(calls.at(-2)?.body?.status ?? calls.at(-1)?.body?.status).toBe("new"),
    );
    expect(rows()[2]).toHaveTextContent("New");
  });
});
