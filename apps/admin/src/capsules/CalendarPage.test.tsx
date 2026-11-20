import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "@kcom/ui";
import { CalendarPage } from "./CalendarPage";
import { CapsulesPage } from "./CapsulesPage";
import userEvent from "@testing-library/user-event";

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

function mockApi() {
  const patches: { id: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const json = (b: unknown) =>
        new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
      if (init?.method === "PATCH") {
        const id = url.split("/").pop()!;
        const body = JSON.parse(String(init.body));
        patches.push({ id, body });
        return json({ ...capsules.find((c) => c.id === id), ...body });
      }
      if (url.includes("/admin/series"))
        return json({ items: [{ id: "s1", title: "Renewing the Mind" }], total: 1 });
      return json({ items: capsules, total: capsules.length });
    }),
  );
  return patches;
}

const renderPage = (ui: React.ReactElement) =>
  render(
    <ToastProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ToastProvider>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("calendar", () => {
  it("shows capsules on their Lagos day and marks gaps", async () => {
    mockApi();
    renderPage(<CalendarPage />);
    const day21 = (await screen.findByText("Late night")).closest("[data-day]")!;
    expect(day21).toHaveAttribute("data-day", "2026-11-21");
    const day22 = document.querySelector('[data-day="2026-11-22"]')!;
    expect(within(day22 as HTMLElement).getByText("No capsule")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Draft idea/ })).toHaveAttribute("href", "/capsules/c");
  });

  it("reschedules a scheduled capsule to midnight Lagos on the dropped day", async () => {
    const patches = mockApi();
    renderPage(<CalendarPage />);
    const chip = await screen.findByRole("link", { name: /Late night/ });
    fireEvent.dragStart(chip);
    fireEvent.drop(document.querySelector('[data-day="2026-11-24"]')!);
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({
      id: "b",
      body: { status: "scheduled", publishAt: "2026-11-23T23:00:00.000Z" },
    });
    const moved = (await screen.findByRole("link", { name: /Late night/ })).closest("[data-day]");
    expect(moved).toHaveAttribute("data-day", "2026-11-24");
  });

  it("refuses to move a capsule onto a Lagos day that has already begun", async () => {
    const patches = mockApi();
    renderPage(<CalendarPage />);
    const chip = await screen.findByRole("link", { name: /Late night/ });
    fireEvent.dragStart(chip);
    fireEvent.drop(document.querySelector('[data-day="2026-11-19"]')!);
    expect(await screen.findByText("Pick a day after today")).toBeInTheDocument();
    expect(patches).toHaveLength(0);
  });

  it("does not make published or draft capsules draggable", async () => {
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
    fireEvent.change(screen.getByLabelText("Date (Lagos)"), { target: { value: "2026-11-21" } });
    expect(screen.getByText("Late night")).toBeInTheDocument();
    expect(screen.queryByText("Published one")).not.toBeInTheDocument();
  });
});
