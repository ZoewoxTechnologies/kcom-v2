import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./Button";

describe("Button", () => {
  it("renders the variant class", () => {
    expect(renderToStaticMarkup(<Button variant="secondary">Go</Button>)).toContain(
      "kc-btn--secondary",
    );
  });

  it("supports the give variant and defaults to type=button", () => {
    const html = renderToStaticMarkup(<Button variant="give">Give</Button>);
    expect(html).toContain("kc-btn--give");
    expect(html).toContain('type="button"');
  });

  it("marks loading buttons busy and shows a spinner", () => {
    const html = renderToStaticMarkup(<Button loading>Save</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("kc-btn__spinner");
  });

  it("defaults to md with no size class", () => {
    const html = renderToStaticMarkup(<Button>Go</Button>);
    expect(html).not.toContain("kc-btn--sm");
    expect(html).not.toContain("kc-btn--lg");
  });

  it("applies sm and lg size classes", () => {
    expect(renderToStaticMarkup(<Button size="sm">Go</Button>)).toContain("kc-btn--sm");
    expect(renderToStaticMarkup(<Button size="lg">Go</Button>)).toContain("kc-btn--lg");
  });
});
