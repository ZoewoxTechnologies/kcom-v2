import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ToastProvider } from "@kcom/ui";
import type { UserRole } from "@kcom/permissions";
import { BooksPage } from "./BooksPage";
import type { BookRecord } from "./api";

const make = (over: Partial<BookRecord>): BookRecord => ({
  id: "1",
  title: "Alpha",
  slug: "alpha",
  description: null,
  coverUrl: null,
  purchaseUrl: null,
  position: 0,
  status: "draft",
  ...over,
});

let role: UserRole = "admin";
vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "u", name: "Grace", email: "g@x.org", role } }),
}));

let store: BookRecord[];
let calls: { method: string; path: string; body?: Record<string, unknown> }[];

beforeEach(() => {
  calls = [];
  role = "admin";
  store = [
    make({ id: "1", title: "Alpha", position: 0 }),
    make({ id: "2", title: "Beta", slug: "beta", position: 1, status: "published" }),
    make({ id: "3", title: "Gamma", slug: "gamma", position: 2 }),
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const path = new URL(url).pathname.replace("/admin/books", "") || "/";
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
      if (method === "PUT") return json({ items: store });
      const id = path.slice(1);
      if (method === "PATCH") {
        store = store.map((b) => (b.id === id ? { ...b, ...body } : b));
        return json(store.find((b) => b.id === id));
      }
      store = store.filter((b) => b.id !== id);
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const router = createMemoryRouter([{ path: "/", element: <BooksPage /> }]);
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}
const rows = () => screen.getAllByRole("row").slice(1);

describe("BooksPage", () => {
  it("lists books in saved order", async () => {
    setup();
    await screen.findByText("Alpha");
    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining("Alpha"),
      expect.stringContaining("Beta"),
      expect.stringContaining("Gamma"),
    ]);
  });

  it("moves a book down and saves the new order", async () => {
    setup();
    await screen.findByText("Alpha");
    await userEvent.click(screen.getByRole("button", { name: "Move Alpha down" }));
    expect(rows()[0]).toHaveTextContent("Beta");
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ ids: ["2", "1", "3"] }),
    );
  });

  it("disables moving the first book up and the last down", async () => {
    setup();
    await screen.findByText("Alpha");
    expect(screen.getByRole("button", { name: "Move Alpha up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Gamma down" })).toBeDisabled();
  });

  it("creates and publishes a book at the end of the list", async () => {
    setup();
    await screen.findByText("Alpha");
    await userEvent.click(screen.getByRole("button", { name: "New book" }));
    const editor = await screen.findByRole("region", { name: "New book" });
    await userEvent.type(within(editor).getByLabelText(/Title/), "Delta");
    await userEvent.click(within(editor).getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")).toBeTruthy());
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toMatchObject({
      title: "Delta",
      slug: "delta",
      status: "published",
      position: 3,
      description: null,
    });
  });

  it("asks for a title", async () => {
    setup();
    await screen.findByText("Alpha");
    await userEvent.click(screen.getByRole("button", { name: "New book" }));
    const editor = await screen.findByRole("region", { name: "New book" });
    await userEvent.click(within(editor).getByRole("button", { name: "Save draft" }));
    expect(await within(editor).findByText("Enter a title.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("asks before leaving unsaved changes", async () => {
    setup();
    await screen.findByText("Alpha");
    await userEvent.click(screen.getByText("Alpha"));
    const editor = await screen.findByRole("region", { name: "Editing" });
    await userEvent.type(within(editor).getByLabelText(/Title/), "!");
    await userEvent.click(screen.getByText("Gamma"));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("deletes after confirming", async () => {
    setup();
    await screen.findByText("Alpha");
    await userEvent.click(screen.getByText("Alpha"));
    await userEvent.click(await screen.findByRole("button", { name: "Delete book" }));
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() =>
      expect(calls.some((c) => c.method === "DELETE" && c.path === "/1")).toBe(true),
    );
  });

  it("hides editing controls from a viewer", async () => {
    role = "viewer" as UserRole;
    setup();
    await screen.findByText("Alpha");
    expect(screen.queryByRole("button", { name: "New book" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move Alpha down" })).toBeNull();
  });
});
