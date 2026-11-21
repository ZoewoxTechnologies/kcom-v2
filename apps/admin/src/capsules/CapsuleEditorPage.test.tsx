import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ToastProvider } from "@kcom/ui";
import { nextLagosMidnight } from "@kcom/content";
import type { UserRole } from "@kcom/permissions";
import { CapsuleEditorPage } from "./CapsuleEditorPage";
import type { CapsuleRecord } from "./api";

const role: UserRole = "admin";
vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "u", name: "Grace", email: "g@x.org", role } }),
}));

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const make = (over: Partial<CapsuleRecord> = {}): CapsuleRecord => ({
  id: "c1",
  title: "A Sound Mind",
  slug: "a-sound-mind",
  status: "draft",
  seriesId: "s1",
  partNumber: 5,
  publishAt: future(3),
  scriptureRef: "2 Timothy 1:7",
  scriptureText: doc("For God hath not given us the spirit of fear"),
  body: doc("Fear is not from God."),
  decrees: ["I have the mind of Christ.", "Fear has no place in me."],
  prayer: doc("Father, I receive a sound mind."),
  bibleMeditation: "Romans 12:1–8",
  authorSource: "A. Ilesanmi",
  ...over,
});

let store: CapsuleRecord[];
let series: { id: string; title: string }[];
let calls: { method: string; path: string; body?: Record<string, unknown> }[];
let failNext: { method: string; status: number; code: string; message: string } | null;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  failNext = null;
  calls = [];
  store = [make(), make({ id: "c2", title: "Other", status: "scheduled", publishAt: future(9) })];
  series = [{ id: "s1", title: "The Renewed Mind" }];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const path = new URL(url).pathname;
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path, body });
      if (failNext && failNext.method === method) {
        const { status, code, message } = failNext;
        failNext = null;
        return json({ error: { code, message } }, status);
      }
      if (path === "/admin/series") {
        if (method === "POST") {
          const row = { id: "s9", title: body.title as string };
          series.push(row);
          return json(row, 201);
        }
        return json({ items: series, total: series.length });
      }
      if (path === "/admin/capsules") {
        if (method === "POST") {
          const row = make({ ...body, id: "c9" } as Partial<CapsuleRecord>);
          store.push(row);
          return json(row, 201);
        }
        return json({ items: store, total: store.length });
      }
      const id = path.split("/").pop()!;
      const found = store.find((c) => c.id === id);
      if (!found) return json({ error: { code: "not_found", message: "no" } }, 404);
      if (method === "PATCH") {
        const next = { ...found, ...body } as CapsuleRecord;
        store = store.map((c) => (c.id === id ? next : c));
        return json(next);
      }
      return json(found);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function setup(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/capsules", element: <p>Capsule list</p> },
      { path: "/capsules/new", element: <CapsuleEditorPage isNew /> },
      { path: "/capsules/:id", element: <CapsuleEditorPage /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
  return router;
}
const sent = (method: string) => calls.filter((c) => c.method === method && c.body);

describe("CapsuleEditorPage", () => {
  it("loads every field of an existing capsule", async () => {
    setup("/capsules/c1");
    expect(await screen.findByLabelText(/Title/)).toHaveValue("A Sound Mind");
    expect(screen.getByLabelText(/Scripture reference/)).toHaveValue("2 Timothy 1:7");
    expect(screen.getByLabelText(/Verse text/)).toHaveValue(
      "For God hath not given us the spirit of fear",
    );
    expect(screen.getByLabelText(/Decrees/)).toHaveValue(
      "I have the mind of Christ.\nFear has no place in me.",
    );
    expect(screen.getByLabelText(/Prayer/)).toHaveValue("Father, I receive a sound mind.");
    expect(screen.getByLabelText(/Bible meditation/)).toHaveValue("Romans 12:1–8");
    expect(screen.getByLabelText(/Author/)).toHaveValue("A. Ilesanmi");
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /^Series/ })).toHaveValue("s1"),
    );
    expect(screen.getByLabelText(/Part number/)).toHaveValue("5");
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("saves edited fields and leaves untouched rich text out of the request", async () => {
    setup("/capsules/c1");
    const title = await screen.findByLabelText(/Title/);
    await userEvent.clear(title);
    await userEvent.type(title, "Peace of Mind");
    await userEvent.clear(screen.getByLabelText(/Decrees/));
    await userEvent.type(screen.getByLabelText(/Decrees/), "One{enter}{enter}Two");
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(sent("PATCH")).toHaveLength(1));
    const body = sent("PATCH")[0]!.body!;
    expect(body).toMatchObject({
      title: "Peace of Mind",
      decrees: ["One", "Two"],
      status: "draft",
      seriesId: "s1",
      partNumber: 5,
    });
    expect(body).not.toHaveProperty("prayer");
    expect(body).not.toHaveProperty("scriptureText");
    expect(await screen.findByRole("status")).toHaveTextContent(/Saved/);
  });

  it("defaults a new capsule to the next Lagos midnight and lets the editor change it", async () => {
    setup("/capsules/new");
    await screen.findByLabelText(/Title/);
    expect(screen.getByText(/12:00 am|12:00 AM|00:00/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Title/), "Fresh start");
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(sent("POST").some((c) => c.path === "/admin/capsules")).toBe(true));
    const post = sent("POST").find((c) => c.path === "/admin/capsules")!.body!;
    expect(post.publishAt).toBe(nextLagosMidnight().toISOString());
    expect(post).toMatchObject({ title: "Fresh start", slug: "fresh-start", status: "draft" });
  });

  it("starts a new capsule on the day chosen in the calendar", async () => {
    const day = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    setup(`/capsules/new?day=${day}`);
    await screen.findByLabelText(/Title/);
    await userEvent.type(screen.getByLabelText(/Title/), "Later");
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(sent("POST").length).toBeGreaterThan(0));
    const at = new Date(sent("POST")[0]!.body!.publishAt as string);
    expect(at.getTime()).toBeGreaterThan(Date.now() + 3 * 86_400_000);
  });

  it("shows validation messages and sends nothing", async () => {
    setup("/capsules/new");
    await screen.findByLabelText(/Title/);
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Enter a title.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Title/), "Needs a body");
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(
      await screen.findByText("Write the capsule before scheduling or publishing it."),
    ).toBeInTheDocument();
    expect(sent("POST")).toHaveLength(0);
  });

  it("creates a new series and sends its id with the capsule", async () => {
    setup("/capsules/c1");
    await userEvent.selectOptions(
      await screen.findByRole("combobox", { name: /^Series/ }),
      "__new",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Enter a name for the new series.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/New series name/), "Faith Works");
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(sent("PATCH")).toHaveLength(1));
    expect(sent("POST")[0]!.body).toMatchObject({ title: "Faith Works", slug: "faith-works" });
    expect(sent("PATCH")[0]!.body).toMatchObject({ seriesId: "s9" });
  });

  it("schedules a draft and returns to the list", async () => {
    const router = setup("/capsules/c1");
    await userEvent.click(await screen.findByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/capsules"));
    expect(sent("PATCH")[0]!.body).toMatchObject({ status: "scheduled" });
  });

  it("shows the API's day-taken message on the date and stays open", async () => {
    const router = setup("/capsules/c1");
    const schedule = await screen.findByRole("button", { name: "Schedule" });
    failNext = {
      method: "PATCH",
      status: 409,
      code: "day_taken",
      message: "That day already has “Other”",
    };
    await userEvent.click(schedule);
    expect(await screen.findByText("That day already has “Other”")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/capsules/c1");
  });

  it("shows a published capsule's status and lets it be edited and unpublished", async () => {
    store = [make({ status: "published", publishAt: future(-1) })];
    setup("/capsules/c1");
    expect(await screen.findByText("Published", { selector: ".kc-badge" })).toBeInTheDocument();
    const title = screen.getByLabelText(/Title/);
    await userEvent.type(title, " II");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(sent("PATCH")).toHaveLength(1));
    expect(sent("PATCH")[0]!.body).toMatchObject({ title: "A Sound Mind II", status: "published" });
    await userEvent.click(screen.getByRole("button", { name: "Unpublish" }));
    await waitFor(() => expect(sent("PATCH")).toHaveLength(2));
    expect(sent("PATCH")[1]!.body).toMatchObject({ status: "draft" });
  });

  it("asks before leaving with unsaved edits", async () => {
    const router = setup("/capsules/c1");
    await userEvent.type(await screen.findByLabelText(/Title/), "!");
    await userEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.pathname).toBe("/capsules/c1");
    await userEvent.click(screen.getByRole("button", { name: "Close panel" }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/capsules"));
  });

  it("closes without asking when nothing changed", async () => {
    const router = setup("/capsules/c1");
    await screen.findByLabelText(/Title/);
    await userEvent.click(screen.getByRole("button", { name: "Close panel" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/capsules"));
  });

  it("says when the capsule does not exist", async () => {
    setup("/capsules/nope");
    expect(await screen.findByText(/doesn.t exist/)).toBeInTheDocument();
  });
});
