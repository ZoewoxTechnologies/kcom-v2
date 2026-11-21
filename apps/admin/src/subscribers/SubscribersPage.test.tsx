import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@kcom/ui";
import { SubscribersPage } from "./SubscribersPage";

let role: "admin" | "editor";
let urls: URL[];

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "u", name: "Grace", email: "g@x.org", role } }),
}));

const page = {
  items: [
    {
      id: "1",
      name: "Grace Adeyemi",
      email: "grace@example.org",
      status: "confirmed",
      subscribedAt: "2026-11-14T10:00:00Z",
    },
    {
      id: "2",
      name: null,
      email: "ruth@example.org",
      status: "pending",
      subscribedAt: "2026-11-11T10:00:00Z",
    },
  ],
  total: 1312,
  counts: { confirmed: 1284, pending: 14, unsubscribed: 14 },
};

beforeEach(() => {
  role = "admin";
  urls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(new URL(url));
      return new Response(JSON.stringify(page), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const renderPage = () =>
  render(
    <ToastProvider>
      <SubscribersPage />
    </ToastProvider>,
  );

describe("SubscribersPage", () => {
  it("lists subscribers with status counts and the total", async () => {
    renderPage();
    expect(await screen.findByText("Grace Adeyemi")).toBeInTheDocument();
    expect(screen.getByText("14 Nov 2026")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "All 1,312" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Pending 14" })).toBeInTheDocument();
    expect(screen.getByText("Showing 1–25 of 1,312")).toBeInTheDocument();
  });

  it("searches after a pause without a submit button", async () => {
    renderPage();
    await screen.findByText("Grace Adeyemi");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "grace");
    await waitFor(() => expect(urls.at(-1)!.searchParams.get("q")).toBe("grace"));
    expect(urls.filter((u) => u.searchParams.has("q"))).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^search$/i })).toBeNull();
  });

  it("filters by status from the segmented control", async () => {
    renderPage();
    await screen.findByText("Grace Adeyemi");
    await userEvent.click(screen.getByRole("radio", { name: "Pending 14" }));
    await waitFor(() => expect(urls.at(-1)!.searchParams.get("status")).toBe("pending"));
  });

  it("shows Export CSV to admins only", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "Export CSV" })).toBeInTheDocument();
  });

  it("hides Export CSV from editors", async () => {
    role = "editor";
    renderPage();
    await screen.findByText("Grace Adeyemi");
    expect(screen.queryByRole("button", { name: "Export CSV" })).toBeNull();
  });
});
