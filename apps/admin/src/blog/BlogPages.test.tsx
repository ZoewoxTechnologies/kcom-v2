import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ToastProvider } from "@kcom/ui";
import { BlogPage } from "./BlogPage";
import { BlogEditorPage } from "./BlogEditorPage";
import type { PostRecord } from "./api";

const make = (over: Partial<PostRecord>): PostRecord => ({
  id: "1",
  title: "Hello",
  slug: "hello",
  date: "2026-11-01",
  excerpt: null,
  body: { type: "doc", content: [{ type: "paragraph" }] },
  heroImageUrl: null,
  tags: [],
  authorId: null,
  status: "draft",
  publishAt: null,
  ...over,
});

let store: PostRecord[];
let calls: { method: string; path: string; body?: Record<string, unknown> }[];
let conflictNext: boolean;

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "u", name: "Grace", email: "g@x.org", role: "admin" } }),
}));

beforeEach(() => {
  calls = [];
  conflictNext = false;
  store = [
    make({ id: "1", title: "Hello", date: "2026-11-01" }),
    make({ id: "2", title: "Grace notes", slug: "grace", status: "published", date: "2026-11-10" }),
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const path = new URL(url).pathname.replace("/admin/blog", "") || "/";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path, body });
      const json = (b: unknown, status = 200) =>
        new Response(JSON.stringify(b), {
          status,
          headers: { "content-type": "application/json" },
        });
      if (method !== "GET" && conflictNext) {
        conflictNext = false;
        return json({ error: { code: "conflict", message: "taken" } }, 409);
      }
      if (method === "GET" && path === "/") return json({ items: store, total: store.length });
      if (method === "GET") return json(store.find((p) => p.id === path.slice(1)));
      if (method === "POST") return json(make({ ...body, id: "9" }), 201);
      if (method === "PATCH")
        return json({ ...store.find((p) => p.id === path.slice(1))!, ...body });
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function setup(initial: string) {
  const router = createMemoryRouter(
    [
      { path: "/blog", element: <BlogPage /> },
      { path: "/blog/new", element: <BlogEditorPage isNew /> },
      { path: "/blog/:id", element: <BlogEditorPage /> },
    ],
    { initialEntries: [initial] },
  );
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
  return router;
}

describe("BlogPage", () => {
  it("lists posts newest first and filters by status", async () => {
    setup("/blog");
    await screen.findByText("Grace notes");
    const rows = () => screen.getAllByRole("row").slice(1);
    expect(rows()[0]).toHaveTextContent("Grace notes");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "draft");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Hello");
  });

  it("opens the editor from a row and from New post", async () => {
    const router = setup("/blog");
    await userEvent.click(await screen.findByText("Hello"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/blog/1"));
    await router.navigate("/blog");
    await userEvent.click(await screen.findByRole("button", { name: "New post" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/blog/new"));
  });
});

describe("BlogEditorPage", () => {
  it("derives the slug from the title and publishes a new post", async () => {
    const router = setup("/blog/new");
    await userEvent.type(await screen.findByLabelText(/Title/), "A New Day");
    expect(screen.getByLabelText(/Slug/)).toHaveValue("a-new-day");
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/blog/9"));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toMatchObject({ title: "A New Day", slug: "a-new-day", status: "published" });
  });

  it("shows a slug uniqueness error and keeps the editor open", async () => {
    const router = setup("/blog/new");
    await userEvent.type(await screen.findByLabelText(/Title/), "Hello");
    conflictNext = true;
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText(/already uses this slug/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/blog/new");
  });

  it("validates a missing title", async () => {
    setup("/blog/new");
    await userEvent.click(await screen.findByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Enter a title.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("unpublishes a published post", async () => {
    setup("/blog/2");
    await userEvent.click(await screen.findByRole("button", { name: "Unpublish" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({ status: "draft" }),
    );
  });

  it("asks before closing with unsaved changes", async () => {
    const router = setup("/blog/1");
    await userEvent.type(await screen.findByLabelText(/Title/), " there");
    await userEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/blog/1");
  });

  it("deletes a post after confirming", async () => {
    const router = setup("/blog/1");
    await userEvent.click(await screen.findByRole("button", { name: "Delete post" }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/blog"));
  });
});

describe("scheduled posts", () => {
  it("keeps the schedule when saving and offers Unschedule", async () => {
    store = [
      make({ id: "5", title: "Later", status: "scheduled", publishAt: "2026-12-25T11:00:00.000Z" }),
    ];
    setup("/blog/5");
    expect(await screen.findByText(/Scheduled to publish on/)).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Title/), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      const patch = calls.find((c) => c.method === "PATCH")!;
      expect(patch.body).toMatchObject({ status: "scheduled" });
      expect(patch.body).not.toHaveProperty("publishAt");
    });
    expect(screen.getByRole("button", { name: "Unschedule" })).toBeInTheDocument();
  });
});

describe("listPosts", () => {
  it("reads every page", async () => {
    const many = Array.from({ length: 150 }, (_, i) => make({ id: String(i), title: `P${i}` }));
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      const u = new URL(url);
      const off = Number(u.searchParams.get("offset"));
      const lim = Number(u.searchParams.get("limit"));
      return new Response(JSON.stringify({ items: many.slice(off, off + lim), total: 150 }), {
        headers: { "content-type": "application/json" },
      });
    });
    const { listPosts } = await import("./api");
    expect(await listPosts()).toHaveLength(150);
  });
});
