import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ToastProvider } from "@kcom/ui";
import { SettingsPage } from "./SettingsPage";

type Item = Record<string, string | null>;
let state: {
  bank: Record<string, string | null>;
  contact: Record<string, string | null>;
  social: Record<string, string | null>;
  team: Item[];
  arms: Item[];
};
let calls: { method: string; path: string; body?: unknown }[];

beforeEach(() => {
  calls = [];
  state = {
    bank: { bankName: "GTBank", accountName: null, accountNumber: null, sortOrSwift: null },
    contact: { email: null, phone: null, address: null },
    social: { facebook: null },
    team: [
      { id: "a", name: "Ada", role: "Pastor", bio: null, portraitUrl: null },
      { id: "b", name: "Bola", role: "Elder", bio: null, portraitUrl: null },
    ],
    arms: [],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname.replace("/admin/settings", "");
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path, body });
      const json = (b: unknown) =>
        new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
      if (method === "PUT" && path === "/team/order") {
        state.team = (body.ids as string[]).map((id) => state.team.find((t) => t.id === id)!);
        return json({ items: state.team });
      }
      if (method === "PATCH" && path === "") {
        for (const [g, v] of Object.entries(body)) Object.assign(state[g as "bank"], v);
      }
      return json(state);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const setup = () => {
  const router = createMemoryRouter([{ path: "/", element: <SettingsPage /> }]);
  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
};

describe("SettingsPage", () => {
  it("saves a group and only enables Save once edited", async () => {
    setup();
    const bankName = await screen.findByLabelText(/Bank name/);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await userEvent.clear(bankName);
    await userEvent.type(bankName, "Zenith");
    await userEvent.click(save);
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({
        bank: { bankName: "Zenith" },
      }),
    );
  });

  it("reorders the team and persists the order", async () => {
    setup();
    await screen.findByLabelText(/Bank name/);
    await userEvent.click(screen.getByRole("radio", { name: "Team" }));
    await userEvent.click(await screen.findByRole("button", { name: "Move Bola up" }));
    await waitFor(() =>
      expect(calls.find((c) => c.path === "/team/order")?.body).toEqual({ ids: ["b", "a"] }),
    );
    const names = within(screen.getByRole("list", { name: "team" })).getAllByRole("listitem");
    expect(names[0]).toHaveTextContent("Bola");
  });

  it("requires a name and role for a new team member", async () => {
    setup();
    await screen.findByLabelText(/Bank name/);
    await userEvent.click(screen.getByRole("radio", { name: "Team" }));
    await userEvent.click(await screen.findByRole("button", { name: "Add team member" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });
});
