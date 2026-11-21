import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { AdminSearch, SEARCH_DELAY_MS } from "./AdminSearch";

const items = [
  { kind: "capsule", id: "c1", title: "Grace for today", status: "published" },
  { kind: "blog", id: "b1", title: "Grace abounds", status: "draft" },
  { kind: "event", id: "e1", title: "Grace night", status: "published" },
];
const fetchMock = vi.fn();

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

const setup = () =>
  render(
    <MemoryRouter>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <AdminSearch />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

const type = (value: string) =>
  fireEvent.change(screen.getByRole("combobox"), { target: { value } });
const settle = () => act(() => vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS + 10));

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ items }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.useRealTimers());

describe("AdminSearch", () => {
  it("waits for a pause in typing, then makes one request", async () => {
    setup();
    type("g");
    type("gr");
    type("gra");
    expect(fetchMock).not.toHaveBeenCalled();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/admin/search?q=gra");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("opens a capsule, blog post or event editor from its result", async () => {
    setup();
    type("grace");
    await settle();
    fireEvent.click(screen.getByRole("option", { name: /Grace for today/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/capsules/c1");

    type("grace");
    await settle();
    fireEvent.click(screen.getByRole("option", { name: /Grace abounds/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/blog/b1");

    type("grace");
    await settle();
    fireEvent.click(screen.getByRole("option", { name: /Grace night/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/events?open=e1");
  });

  it("moves with the arrow keys and opens with Enter", async () => {
    setup();
    type("grace");
    await settle();
    const box = screen.getByRole("combobox");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByTestId("where")).toHaveTextContent("/blog/b1");
  });

  it("says when nothing matches or the search fails, and makes no request for blank input", async () => {
    setup();
    type("   ");
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    type("zzz");
    await settle();
    expect(screen.getByRole("status")).toHaveTextContent("No matches.");

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    type("boom");
    await settle();
    expect(screen.getByRole("status")).toHaveTextContent("Search failed");
  });
});
