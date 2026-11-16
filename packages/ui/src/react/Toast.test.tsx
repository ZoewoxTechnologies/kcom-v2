import { describe, expect, it } from "vitest";
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
