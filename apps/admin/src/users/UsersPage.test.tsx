import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@kcom/ui";
import { UsersPage } from "./UsersPage";
import type { UserRecord } from "./api";

const make = (over: Partial<UserRecord>): UserRecord => ({
  id: "1",
  name: "Grace",
  email: "grace@x.org",
  role: "admin",
  deactivatedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

let store: UserRecord[];
let calls: { method: string; path: string; body?: Record<string, unknown> }[];
let refuseLastAdmin: boolean;

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "1", name: "Grace", email: "grace@x.org", role: "admin" } }),
}));

beforeEach(() => {
  calls = [];
  refuseLastAdmin = false;
  store = [
    make({ id: "1" }),
    make({ id: "2", name: "Ed", email: "ed@x.org", role: "editor", invitePending: true }),
    make({ id: "3", name: "Old", email: "old@x.org", role: "editor", deactivatedAt: "2026-02-01" }),
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const path = new URL(url).pathname.replace("/users", "") || "/";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path, body });
      const json = (b: unknown, status = 200) =>
        new Response(JSON.stringify(b), {
          status,
          headers: { "content-type": "application/json" },
        });
      if (method === "GET") return json(store);
      if (refuseLastAdmin)
        return json({ error: { code: "last_admin", message: "last admin" } }, 409);
      if (method === "POST" && path === "/")
        return json(make({ id: "9", name: "new", email: body.email, role: body.role }), 201);
      if (path.endsWith("/resend-invite")) return new Response(null, { status: 204 });
      const id = path.split("/")[1]!;
      const user = store.find((u) => u.id === id)!;
      if (method === "PATCH") return json({ ...user, role: body.role });
      if (path.endsWith("/deactivate")) return json({ ...user, deactivatedAt: "2026-03-01" });
      return json({ ...user, deactivatedAt: null });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const setup = () =>
  render(
    <ToastProvider>
      <UsersPage />
    </ToastProvider>,
  );

describe("UsersPage", () => {
  it("offers resend only to users who have not signed in, and blocks self-demotion", async () => {
    store.push(make({ id: "5", name: "Second", email: "s@x.org", role: "admin" }));
    setup();
    await screen.findByText("ed@x.org");
    expect(screen.getByRole("button", { name: "Resend invite to ed@x.org" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Resend invite to s@x.org/ })).toBeNull();
    expect(screen.getByLabelText("Role for Grace")).toBeDisabled();
    expect(screen.getByLabelText("Role for Second")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Deactivate Grace" })).toBeDisabled();
  });

  it("explains and blocks demoting or deactivating the only admin", async () => {
    setup();
    await screen.findByText("ed@x.org");
    expect(screen.getByText(/There must always be an active admin/)).toBeInTheDocument();
    expect(screen.getByLabelText("Role for Grace")).toBeDisabled();
    expect(screen.getByRole("button", { name: /only active admin/ })).toBeDisabled();
  });

  it("changes a role", async () => {
    setup();
    await screen.findByText("ed@x.org");
    await userEvent.selectOptions(screen.getByLabelText("Role for Ed"), "admin");
    await waitFor(() =>
      expect(calls).toContainEqual({ method: "PATCH", path: "/2", body: { role: "admin" } }),
    );
  });

  it("asks before deactivating", async () => {
    setup();
    await screen.findByText("ed@x.org");
    await userEvent.click(screen.getByRole("button", { name: "Deactivate Ed" }));
    expect(calls.some((c) => c.path === "/2/deactivate")).toBe(false);
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));
    await waitFor(() =>
      expect(calls).toContainEqual({ method: "POST", path: "/2/deactivate", body: undefined }),
    );
  });

  it("reactivates and resends invites", async () => {
    setup();
    await screen.findByText("ed@x.org");
    await userEvent.click(screen.getByRole("button", { name: "Reactivate Old" }));
    await userEvent.click(screen.getByRole("button", { name: "Resend invite to ed@x.org" }));
    await waitFor(() => {
      expect(calls.some((c) => c.path === "/3/reactivate")).toBe(true);
      expect(calls.some((c) => c.path === "/2/resend-invite")).toBe(true);
    });
  });

  it("invites a user", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Invite user" }));
    await userEvent.type(screen.getByLabelText(/Email/), "new@x.org");
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "POST",
        path: "/",
        body: { email: "new@x.org", role: "editor" },
      }),
    );
    expect(await screen.findByText("new")).toBeInTheDocument();
  });

  it("shows the last-admin refusal from the API", async () => {
    setup();
    await screen.findByText("ed@x.org");
    refuseLastAdmin = true;
    await userEvent.selectOptions(screen.getByLabelText("Role for Ed"), "admin");
    expect(await screen.findByText("Keep at least one admin")).toBeInTheDocument();
  });
});
