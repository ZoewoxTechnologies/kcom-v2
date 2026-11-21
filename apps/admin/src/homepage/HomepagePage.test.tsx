import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { ToastProvider } from "@kcom/ui";
import { HomepagePage } from "./HomepagePage";

let role = "admin";
vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "u", name: "Grace", email: "g@x.org", role } }),
}));

const KEYS = [
  "todays_capsule",
  "current_series",
  "past_series",
  "blog",
  "events_books",
  "email_signup",
];
let sections: { key: string; position: number; visible: boolean }[];
let puts: { sections: { key: string; visible: boolean }[] }[];

beforeEach(() => {
  role = "admin";
  puts = [];
  sections = KEYS.map((key, position) => ({ key, position, visible: true }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        puts.push(body);
        sections = body.sections.map((s: { key: string; visible: boolean }, position: number) => ({
          ...s,
          position,
        }));
      }
      return new Response(JSON.stringify({ sections }), {
        headers: { "content-type": "application/json" },
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const setup = () => {
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <>
          <Link to="/other">Leave</Link>
          <HomepagePage />
        </>
      ),
    },
    { path: "/other", element: <p>Other page</p> },
  ]);
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
};

const order = () =>
  within(screen.getByRole("list", { name: "Homepage sections" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);

describe("HomepagePage", () => {
  it("shows Today's Capsule as fixed with no handle or switch", async () => {
    setup();
    await screen.findByText("Fixed at top");
    expect(screen.queryByRole("button", { name: /Reorder Today/ })).toBeNull();
    expect(screen.queryByRole("switch", { name: /Today/ })).toBeNull();
  });

  it("reorders with the arrow keys, keeps focus, and publishes the order", async () => {
    setup();
    const handle = await screen.findByRole("button", { name: "Reorder From the blog" });
    handle.focus();
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    expect(order()[1]).toContain("From the blog");
    expect(screen.getByRole("button", { name: "Reorder From the blog" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("From the blog moved to position 2 of 6");
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]!.sections.map((s) => s.key)).toEqual([
      "todays_capsule",
      "blog",
      "current_series",
      "past_series",
      "events_books",
      "email_signup",
    ]);
  });

  it("hides a section and saves it as not visible", async () => {
    setup();
    await userEvent.click(await screen.findByRole("switch", { name: "Show Email signup" }));
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]!.sections.find((s) => s.key === "email_signup")?.visible).toBe(false);
  });

  it("asks before leaving with unsaved changes", async () => {
    setup();
    await userEvent.click(await screen.findByRole("switch", { name: "Show Email signup" }));
    await userEvent.click(screen.getByRole("link", { name: "Leave" }));
    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByText("Other page")).toBeNull();
    await userEvent.click(screen.getByRole("link", { name: "Leave" }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
    expect(await screen.findByText("Other page")).toBeInTheDocument();
  });

  it("is read-only without publish rights", async () => {
    role = "viewer";
    setup();
    expect(await screen.findByText(/You don’t have permission to change/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Show From the blog" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
  });
});
