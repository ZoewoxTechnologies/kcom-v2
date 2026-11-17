import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { App } from "./App";
import type { UserRole as Role } from "@kcom/permissions";

type Session = { user: { id: string; name: string; email: string; role: Role } } | null;

/** Fake API: a session that sign-in creates and sign-out clears. */
function mockApi(initial: Session, validPassword = "correct-horse-battery") {
  let session = initial;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (url.endsWith("/get-session")) return json(session);
    if (url.endsWith("/sign-in/email")) {
      const { password } = JSON.parse(String(init?.body));
      if (password !== validPassword) return json({ code: "INVALID" }, 401);
      session = {
        user: { id: "1", name: "Grace Adeyemi", email: "grace@example.com", role: "admin" },
      };
      return json({});
    }
    if (url.endsWith("/sign-out")) {
      session = null;
      return json({});
    }
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const user = (role: Role): Session => ({
  user: { id: "1", name: "Grace Adeyemi", email: "grace@example.com", role },
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("route guard", () => {
  it("redirects visitors without a session to sign-in", async () => {
    mockApi(null);
    renderAt("/capsules");
    expect(await screen.findByRole("heading", { name: /sign in to manage/i })).toBeInTheDocument();
  });

  it("serves the demo page without a session in development", async () => {
    mockApi(null);
    renderAt("/demo");
    expect(await screen.findByRole("heading", { name: "KCOM Admin" })).toBeInTheDocument();
  });

  it("does not register the demo page in production", async () => {
    vi.stubEnv("DEV", false);
    mockApi(null);
    renderAt("/demo");
    expect(await screen.findByRole("heading", { name: /sign in to manage/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "KCOM Admin" })).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});

describe("sign in", () => {
  it("shows an error for wrong credentials", async () => {
    mockApi(null);
    renderAt("/");
    await userEvent.type(await screen.findByLabelText(/email address/i), "grace@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/incorrect/i);
  });

  it("signs in, lands on the shell, then signs out", async () => {
    mockApi(null);
    renderAt("/");
    await userEvent.type(await screen.findByLabelText(/email address/i), "grace@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out", hidden: true }));
    expect(await screen.findByRole("heading", { name: /sign in to manage/i })).toBeInTheDocument();
  });
});

describe("phone drawer", () => {
  it("moves focus in on open, and closes on Escape back to the menu button", async () => {
    mockApi(user("editor"));
    renderAt("/");
    const burger = await screen.findByRole("button", { name: "Menu" });
    await userEvent.click(burger);
    expect(burger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(burger).toHaveAttribute("aria-expanded", "false");
    expect(burger).toHaveFocus();
  });
});

describe("page title", () => {
  it("does not match a path that merely starts with a section name", async () => {
    mockApi(user("editor"));
    renderAt("/blogx");
    await screen.findByRole("link", { name: "Blog" });
    expect(document.querySelector(".kc-admin__title")).toBeEmptyDOMElement();
  });
});

describe("role-aware menu", () => {
  it("shows every item to an admin", async () => {
    mockApi(user("admin"));
    renderAt("/");
    expect(await screen.findByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("hides admin-only items from an editor", async () => {
    mockApi(user("editor"));
    renderAt("/");
    expect(await screen.findByRole("link", { name: "Capsules" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("gives an editor a friendly 403 on an admin URL", async () => {
    mockApi(user("editor"));
    renderAt("/users");
    expect(await screen.findByRole("heading", { name: /don’t have access/i })).toBeInTheDocument();
  });

  it("lets an admin open an admin page", async () => {
    mockApi(user("admin"));
    renderAt("/users");
    expect(await screen.findByRole("heading", { name: "Users" })).toBeInTheDocument();
  });
});
