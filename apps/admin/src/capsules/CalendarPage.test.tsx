import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "@kcom/ui";
import { CalendarPage } from "./CalendarPage";
import { CapsulesPage } from "./CapsulesPage";

let role = "editor";
vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "1", name: "Grace", email: "g@example.com", role } }),
}));

const NOW = new Date("2026-11-19T22:30:00Z"); // 23:30 on 19 Nov in Lagos

const base = { slug: "x", seriesId: null, partNumber: null };
const capsules = [
  {
    ...base,
    id: "a",
    title: "Published one",
    status: "published",
    publishAt: "2026-11-10T23:00:00Z",
  },
  // 23:30 UTC on the 20th is 00:30 on the 21st in Lagos.
  { ...base, id: "b", title: "Late night", status: "scheduled", publishAt: "2026-11-20T23:30:00Z" },
  {
    ...base,
    id: "c",
    title: "Draft idea",
    status: "draft",
    seriesId: "s1",
    publishAt: "2026-11-25T23:00:00Z",
  },
];

// 22:00 UTC on the 26th is 23:00 on the 26th in Lagos.
const takenDay = {
  ...base,
  id: "d",
  title: "Taken day",
  status: "scheduled",
  publishAt: "2026-11-26T22:00:00Z",
};

function mockApi(patchStatus = 200, extra: (typeof capsules)[number][] = []) {
  const all = [...capsules, ...extra];
  const patches: { id: string; body: Record<string, unknown> }[] = [];
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      urls.push(url);
      const json = (b: unknown) =>
        new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
      if (init?.method === "PATCH") {
        const id = url.split("/").pop()!;
        const body = JSON.parse(String(init.body));
        patches.push({ id, body });
        if (patchStatus === 409)
          return new Response(
            JSON.stringify({
              error: { code: "day_taken", message: "2026-11-30 already has “Other”" },
            }),
            { status: 409, headers: { "content-type": "application/json" } },
          );
        return json({ ...all.find((c) => c.id === id), ...body });
      }
      if (url.includes("/admin/series"))
        return json({ items: [{ id: "s1", title: "Renewing the Mind" }], total: 1 });
      return json({ items: all, total: all.length });
    }),
  );
  return { patches, urls };
}

const renderPage = (ui: React.ReactElement) =>
  render(
    <ToastProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ToastProvider>,
  );

const dayCell = (day: string) => document.querySelector(`[data-day="${day}"]`) as HTMLElement;
const dragTo = (chip: HTMLElement, day: string) => {
  fireEvent.dragStart(chip);
  fireEvent.drop(dayCell(day));
};

beforeEach(() => {
  role = "editor";
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("calendar", () => {
  it("loads only the visible Lagos month", async () => {
    const { urls } = mockApi();
    renderPage(<CalendarPage />);
    await screen.findByText("Late night");
    const request = urls.find((u) => u.includes("/admin/capsules"))!;
    expect(request).toContain("from=2026-10-31T23%3A00%3A00.000Z");
    expect(request).toContain("to=2026-11-30T23%3A00%3A00.000Z");
  });

  it("shows capsules on their Lagos day and offers + Add on future gaps only", async () => {
    mockApi();
    renderPage(<CalendarPage />);
    const chip = await screen.findByText("Late night");
    expect(chip.closest("[data-day]")).toHaveAttribute("data-day", "2026-11-21");
    expect(within(dayCell("2026-11-22")).getByRole("link", { name: /\+ Add/ })).toHaveAttribute(
      "href",
      "/capsules/new?day=2026-11-22",
    );
    // Today (Lagos) and earlier gaps have no add link; days with a capsule neither.
    expect(within(dayCell("2026-11-19")).queryByRole("link")).toBeNull();
    expect(within(dayCell("2026-11-21")).queryByRole("link", { name: /\+ Add/ })).toBeNull();
    expect(screen.getByRole("link", { name: "New capsule" })).toHaveAttribute(
      "href",
      "/capsules/new",
    );
    expect(screen.getByRole("link", { name: "List view" })).toHaveAttribute("href", "/capsules");
    expect(screen.getByRole("link", { name: /Draft idea/ })).toHaveAttribute("href", "/capsules/c");
  });

  it("labels each day in full and uses 7-cell rows", async () => {
    mockApi();
    renderPage(<CalendarPage />);
    await screen.findByText("Late night");
    expect(within(dayCell("2026-11-24")).getByText("Tuesday 24 November")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(7);
    for (const row of rows) {
      expect(within(row).getAllByRole(row === rows[0] ? "columnheader" : "cell")).toHaveLength(7);
    }
  });

  it("reschedules a scheduled capsule to midnight Lagos on the dropped day", async () => {
    const { patches } = mockApi();
    renderPage(<CalendarPage />);
    dragTo(await screen.findByRole("link", { name: /Late night/ }), "2026-11-24");
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({
      id: "b",
      body: { status: "scheduled", publishAt: "2026-11-23T23:00:00.000Z" },
    });
    expect(await screen.findByText("Capsule moved")).toBeInTheDocument();
    expect(screen.getByText(/now scheduled for Tue 24 Nov/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Late night/ }).closest("[data-day]")).toHaveAttribute(
      "data-day",
      "2026-11-24",
    );
  });

  it("refuses a drop on a Lagos day that has already begun", async () => {
    const { patches } = mockApi();
    renderPage(<CalendarPage />);
    dragTo(await screen.findByRole("link", { name: /Late night/ }), "2026-11-19");
    expect(await screen.findByText(/Pick a day after today/)).toBeInTheDocument();
    expect(patches).toHaveLength(0);
  });

  it("refuses a drop on a day that already has a capsule", async () => {
    const { patches } = mockApi(200, [takenDay]);
    renderPage(<CalendarPage />);
    dragTo(await screen.findByRole("link", { name: /Late night/ }), "2026-11-26");
    expect(await screen.findByText("Thu 26 Nov already has “Taken day”")).toBeInTheDocument();
    expect(patches).toHaveLength(0);
  });

  it("allows a drop on a day that only has a draft", async () => {
    const { patches } = mockApi();
    renderPage(<CalendarPage />);
    dragTo(await screen.findByRole("link", { name: /Late night/ }), "2026-11-26");
    await waitFor(() => expect(patches).toHaveLength(1));
  });

  it("keeps the Move dialog open and shows the server's 409 message", async () => {
    mockApi(409);
    renderPage(<CalendarPage />);
    await userEvent
      .setup({ advanceTimers: () => {} })
      .click(await screen.findByRole("button", { name: /Move Late night to date/ }));
    fireEvent.change(screen.getByLabelText("Day (WAT)"), { target: { value: "2026-11-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("2026-11-30 already has “Other”");
    expect(screen.getByLabelText("Day (WAT)")).toBeInTheDocument();
  });

  it("only drags scheduled capsules", async () => {
    mockApi();
    renderPage(<CalendarPage />);
    expect(await screen.findByRole("link", { name: /Published one/ })).not.toHaveAttribute(
      "draggable",
      "true",
    );
    expect(screen.getByRole("link", { name: /Draft idea/ })).not.toHaveAttribute(
      "draggable",
      "true",
    );
    expect(screen.getByRole("link", { name: /Late night/ })).toHaveAttribute("draggable", "true");
  });

  it("hides drag and Move without publish permission", async () => {
    role = "viewer";
    mockApi();
    renderPage(<CalendarPage />);
    expect(await screen.findByRole("link", { name: /Late night/ })).not.toHaveAttribute(
      "draggable",
      "true",
    );
    expect(screen.queryByRole("button", { name: /Move/ })).toBeNull();
  });
});

describe("Move to date", () => {
  const open = async () => {
    const user = userEvent.setup({ advanceTimers: () => {} });
    await user.click(await screen.findByRole("button", { name: "Move Late night to date" }));
    return { user, dialog: await screen.findByRole("dialog") };
  };

  it("moves to Lagos midnight of the chosen day", async () => {
    const { patches } = mockApi();
    renderPage(<CalendarPage />);
    const { user, dialog } = await open();
    const input = within(dialog).getByLabelText("Day (WAT)");
    expect(input).toHaveAttribute("min", "2026-11-20");
    fireEvent.change(input, { target: { value: "2026-11-24" } });
    await user.click(within(dialog).getByRole("button", { name: "Move" }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]!.body).toEqual({
      status: "scheduled",
      publishAt: "2026-11-23T23:00:00.000Z",
    });
  });

  it("disables Move for today or a past day", async () => {
    const { patches } = mockApi();
    renderPage(<CalendarPage />);
    const { dialog } = await open();
    const move = within(dialog).getByRole("button", { name: "Move" });
    for (const day of ["2026-11-19", "2026-11-01"]) {
      fireEvent.change(within(dialog).getByLabelText("Day (WAT)"), { target: { value: day } });
      expect(move).toBeDisabled();
    }
    fireEvent.change(within(dialog).getByLabelText("Day (WAT)"), {
      target: { value: "2026-11-20" },
    });
    expect(move).toBeEnabled();
    expect(patches).toHaveLength(0);
  });

  it("refuses a day that already has a capsule", async () => {
    const { patches } = mockApi(200, [takenDay]);
    renderPage(<CalendarPage />);
    const { user, dialog } = await open();
    fireEvent.change(within(dialog).getByLabelText("Day (WAT)"), {
      target: { value: "2026-11-26" },
    });
    await user.click(within(dialog).getByRole("button", { name: "Move" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Thu 26 Nov already has “Taken day”",
    );
    expect(patches).toHaveLength(0);
  });

  it("changes nothing on Cancel or Escape", async () => {
    const { patches } = mockApi();
    renderPage(<CalendarPage />);
    const { user, dialog } = await open();
    fireEvent.change(within(dialog).getByLabelText("Day (WAT)"), {
      target: { value: "2026-11-24" },
    });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await open();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(patches).toHaveLength(0);
  });
});

describe("capsule list", () => {
  it("filters by title, status, series and Lagos date", async () => {
    mockApi();
    renderPage(<CapsulesPage />);
    expect(await screen.findByText("Late night")).toBeInTheDocument();
    const user = userEvent.setup({ advanceTimers: () => {} });

    await user.type(screen.getByLabelText("Search"), "draft");
    expect(screen.queryByText("Late night")).not.toBeInTheDocument();
    expect(screen.getByText("Draft idea")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Search"));

    await user.selectOptions(screen.getByLabelText("Status"), "scheduled");
    expect(screen.getByText("Late night")).toBeInTheDocument();
    expect(screen.queryByText("Draft idea")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Status"), "");

    await user.selectOptions(screen.getByLabelText("Series"), "s1");
    expect(screen.getByText("Draft idea")).toBeInTheDocument();
    expect(screen.queryByText("Published one")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Series"), "");

    // 23:30 UTC on the 20th is the 21st in Lagos.
    fireEvent.change(screen.getByLabelText("Date (WAT)"), { target: { value: "2026-11-21" } });
    expect(screen.getByText("Late night")).toBeInTheDocument();
    expect(screen.queryByText("Published one")).not.toBeInTheDocument();
  });

  it("sorts status in workflow order", async () => {
    mockApi();
    renderPage(<CapsulesPage />);
    await screen.findByText("Late night");
    const user = userEvent.setup({ advanceTimers: () => {} });
    await user.click(screen.getByRole("button", { name: /Status/ }));
    const titles = screen
      .getAllByRole("row")
      .slice(1)
      .map((r) => within(r).getAllByRole("cell")[0]!.textContent);
    expect(titles).toEqual(["Draft idea", "Late night", "Published one"]);
  });
});
