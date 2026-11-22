import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { ToastProvider } from "@kcom/ui";
import { SitePagesPage } from "./SitePagesPage";

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "u", name: "Grace", email: "g@x.org", role: "admin" } }),
}));

let pageExists: boolean;
let calls: { method: string; path: string; body?: Record<string, unknown> }[];

beforeEach(() => {
  pageExists = true;
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const path = new URL(url).pathname.replace("/admin/pages", "") || "/";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path, body });
      const json = (b: unknown, status = 200) =>
        new Response(JSON.stringify(b), {
          status,
          headers: { "content-type": "application/json" },
        });
      const page = {
        id: "p1",
        title: "Privacy policy",
        slug: "privacy",
        seoTitle: null,
        seoDescription: null,
        status: "draft",
        publishAt: null,
      };
      if (method === "GET" && path === "/")
        return json({ items: pageExists ? [page] : [], total: 1 });
      if (method === "GET" && path.endsWith("/sections"))
        return json({
          sections: [
            {
              type: "richText",
              props: {
                heading: "Your data",
                body: { type: "doc", content: [{ type: "paragraph" }] },
              },
            },
          ],
        });
      if (method === "POST") return json({ ...page, ...body }, 201);
      if (method === "PATCH") return json({ ...page, ...body });
      if (method === "PUT") return json(body);
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const setup = (initial: string) => {
  const router = createMemoryRouter(
    [
      {
        path: "/pages/*",
        element: (
          <>
            <Link to="/elsewhere">Leave</Link>
            <SitePagesPage />
          </>
        ),
      },
      { path: "/elsewhere", element: <p>Elsewhere</p> },
    ],
    { initialEntries: [initial] },
  );
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
};

describe("SitePagesPage", () => {
  it("lists the four editable pages", () => {
    setup("/pages");
    for (const name of [
      "About: Who We Are",
      "About: Team and Arms",
      "Partnership",
      "Privacy policy",
    ])
      expect(screen.getByRole("link", { name: new RegExp(name) })).toBeInTheDocument();
  });

  it("saves edited page text and blocks", async () => {
    setup("/pages/privacy");
    const heading = await screen.findByDisplayValue("Your data");
    await userEvent.clear(heading);
    await userEvent.type(heading, "Your information");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PATCH")?.path).toBe("/p1");
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.path).toBe("/p1/sections");
    expect(put.body).toMatchObject({
      sections: [{ type: "richText", props: { heading: "Your information" } }],
    });
  });

  it("creates the page on first save when it doesn't exist yet", async () => {
    pageExists = false;
    setup("/pages/privacy");
    await userEvent.click(await screen.findByRole("button", { name: "Add block" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({
      slug: "privacy",
      status: "draft",
    });
  });

  it("requires a heading on a title band", async () => {
    setup("/pages/about");
    await screen.findByRole("button", { name: "Add block" });
    await userEvent.selectOptions(screen.getByLabelText("Add a block"), "hero");
    await userEvent.click(screen.getByRole("button", { name: "Add block" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a heading.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("asks before leaving with unsaved edits", async () => {
    setup("/pages/privacy");
    const heading = await screen.findByDisplayValue("Your data");
    await userEvent.type(heading, "!");
    await userEvent.click(screen.getByRole("link", { name: "Leave" }));
    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
  });
});
