import { describe, expect, it } from "vitest";
// @ts-expect-error Vite raw import; the package has no vite client types.
import dialogCss from "../components/dialog.css?raw";
// @ts-expect-error Vite raw import; the package has no vite client types.
import toastCss from "../components/toast.css?raw";

const zIndexes = (css: string) => [...css.matchAll(/z-index:\s*(\d+)/g)].map((m) => Number(m[1]));

describe("layering", () => {
  it("toasts sit above dialogs, so errors raised from an open editor are visible", () => {
    expect(Math.min(...zIndexes(toastCss))).toBeGreaterThan(Math.max(...zIndexes(dialogCss)));
  });
});
