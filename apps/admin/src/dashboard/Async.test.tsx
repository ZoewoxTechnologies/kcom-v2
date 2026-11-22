import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Async, AsyncPanel, AsyncTile } from "./Async";

describe("Async", () => {
  it("shows loading, then the data", async () => {
    const load = vi.fn(async () => "hello");
    render(
      <Async load={load} loading="wait" error={() => "bad"}>
        {(d) => <p>got {d}</p>}
      </Async>,
    );
    expect(screen.getByText("wait")).toBeTruthy();
    expect(await screen.findByText("got hello")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("shows the error and loads again on retry", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValueOnce("ok");
    render(
      <Async load={load} loading="wait" error={(retry) => <button onClick={retry}>again</button>}>
        {(d) => <p>got {d}</p>}
      </Async>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "again" }));
    expect(await screen.findByText("got ok")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("AsyncPanel and AsyncTile", () => {
  it("keep the title or label while loading and when failing", async () => {
    const fail = (): Promise<string> => Promise.reject(new Error("x"));
    render(
      <>
        <AsyncPanel title="Recent activity" load={fail}>
          {() => null}
        </AsyncPanel>
        <AsyncTile label="Subscribers" load={fail}>
          {() => null}
        </AsyncTile>
      </>,
    );
    expect(screen.getByRole("heading", { name: "Recent activity" })).toBeTruthy();
    expect(screen.getByText("Subscribers")).toBeTruthy();
    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    expect(screen.getByText("Subscribers")).toBeTruthy();
  });
});
