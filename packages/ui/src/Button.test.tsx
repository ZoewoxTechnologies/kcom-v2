import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./Button";

describe("Button", () => {
  it("renders the variant class", () => {
    expect(renderToStaticMarkup(<Button variant="secondary">Go</Button>)).toContain(
      "kc-btn--secondary",
    );
  });

  it("marks loading buttons busy and shows a spinner", () => {
    const html = renderToStaticMarkup(<Button loading>Save</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("kc-btn__spinner");
  });
});
