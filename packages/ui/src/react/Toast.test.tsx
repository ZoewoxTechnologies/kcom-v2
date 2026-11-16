// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ToastProvider, useToast } from "./Toast";

describe("Toast", () => {
  it("renders an announcing viewport under the provider", () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <p>app</p>
      </ToastProvider>,
    );
    expect(html).toContain("app");
    expect(html).toContain("kc-toast-viewport");
    expect(html).toContain("Notifications");
  });

  it("throws when useToast is used outside the provider", () => {
    function Probe() {
      useToast();
      return null;
    }
    expect(() => renderToStaticMarkup(<Probe />)).toThrow(/ToastProvider/);
  });
});

describe("Toast update", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  let api: ReturnType<typeof useToast>;
  function Capture() {
    api = useToast();
    return null;
  }
  function mount() {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <ToastProvider>
          <Capture />
        </ToastProvider>,
      ),
    );
    return root;
  }
  const titles = () => [...document.querySelectorAll(".kc-toast__title")].map((n) => n.textContent);

  const isOpen = () => document.querySelector(".kc-toast")?.getAttribute("data-state") === "open";

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("changes a toast in place without adding another", () => {
    mount();
    let id = 0;
    act(() => {
      id = api.toast({ title: "Saving…", variant: "info" });
    });
    act(() => api.update(id, { title: "Saved", variant: "success" }));
    expect(titles()).toEqual(["Saved"]);
    expect(document.querySelector(".kc-toast")?.getAttribute("data-variant")).toBe("success");
  });

  it("restarts the auto-dismiss timer on update", () => {
    vi.useFakeTimers();
    mount();
    let id = 0;
    act(() => {
      id = api.toast({ title: "Saving…", variant: "info", duration: 4000 });
    });
    act(() => vi.advanceTimersByTime(3000));
    act(() => api.update(id, { title: "Saved", variant: "success", duration: 4000 }));
    act(() => vi.advanceTimersByTime(3000));
    expect(isOpen()).toBe(true);
    act(() => vi.advanceTimersByTime(1500));
    expect(isOpen()).toBe(false);
  });

  it("makes an error persist and a recovered toast auto-dismiss", () => {
    vi.useFakeTimers();
    mount();
    let id = 0;
    act(() => {
      id = api.toast({ title: "Saving…", variant: "info" });
    });
    act(() => api.update(id, { title: "Failed", variant: "error" }));
    act(() => vi.advanceTimersByTime(10000));
    expect(isOpen()).toBe(true);
    act(() => api.update(id, { title: "Saved", variant: "success" }));
    act(() => vi.advanceTimersByTime(4500));
    expect(isOpen()).toBe(false);
  });

  it("shows a progress bar only for timed toasts", () => {
    mount();
    act(() => {
      api.toast({ title: "Timed", variant: "success", duration: 5000 });
      api.toast({ title: "Error", variant: "error" });
      api.toast({ title: "Forever", variant: "info", duration: Infinity });
    });
    const toasts = [...document.querySelectorAll<HTMLElement>(".kc-toast")];
    const bars = toasts.map((t) => t.querySelector<HTMLElement>(".kc-toast__progress"));
    expect(bars[0]?.style.getPropertyValue("--kc-toast-duration")).toBe("5000ms");
    expect(bars[1]).toBeNull();
    expect(bars[2]).toBeNull();
  });

  it("restarts the bar on update with the new duration", () => {
    mount();
    let id = 0;
    act(() => {
      id = api.toast({ title: "Saving…", variant: "info", duration: 60000 });
    });
    const before = document.querySelector(".kc-toast__progress");
    act(() => api.update(id, { variant: "success", duration: 4000 }));
    const after = document.querySelector<HTMLElement>(".kc-toast__progress");
    expect(after).not.toBe(before);
    expect(after?.style.getPropertyValue("--kc-toast-duration")).toBe("4000ms");
  });

  it("marks the toast paused while the viewport is hovered", () => {
    mount();
    act(() => {
      api.toast({ title: "Hi", variant: "success" });
    });
    const toast = () => document.querySelector(".kc-toast");
    const viewport = document.querySelector(".kc-toast-viewport")!;
    expect(toast()?.hasAttribute("data-paused")).toBe(false);
    act(() => {
      viewport.dispatchEvent(new Event("pointermove", { bubbles: true }));
    });
    expect(toast()?.hasAttribute("data-paused")).toBe(true);
    act(() => {
      viewport.parentElement!.dispatchEvent(new Event("pointerleave"));
    });
    expect(toast()?.hasAttribute("data-paused")).toBe(false);
  });
});
