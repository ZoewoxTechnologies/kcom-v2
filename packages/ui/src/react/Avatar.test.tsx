import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Avatar, initialsOf } from "./Avatar";
import { Badge } from "./Badge";
import { Tag } from "./Tag";

describe("Avatar", () => {
  it("derives initials from first and last name", () => {
    expect(initialsOf("Ada Marie Lovelace")).toBe("AL");
    expect(initialsOf("  grace ")).toBe("G");
    expect(initialsOf("")).toBe("");
  });

  it("renders the size class (Radix mounts the fallback after hydration)", () => {
    const html = renderToStaticMarkup(<Avatar name="Ada Lovelace" size="lg" />);
    expect(html).toContain("kc-avatar--lg");
  });
});

describe("Badge and Tag", () => {
  it("renders the status class", () => {
    expect(renderToStaticMarkup(<Badge status="pending">Pending</Badge>)).toContain(
      "kc-badge--pending",
    );
  });

  it("renders a link tag when href is given", () => {
    const html = renderToStaticMarkup(<Tag href="/series/x">Prophetic</Tag>);
    expect(html).toContain("<a ");
    expect(html).toContain("kc-tag");
  });
});
