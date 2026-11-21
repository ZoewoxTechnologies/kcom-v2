import { describe, expect, it } from "vitest";
import { featuredBook, hasKinds, parseKind } from "./books";
import type { Book } from "./data/types";

const b = (o: Partial<Book>): Book => ({ slug: "a", title: "A", description: null, coverUrl: null, purchaseUrl: null, publishedYear: null, kind: null, author: null, sampleUrl: null, ...o });

describe("books", () => {
  it("parses kinds", () => {
    expect(parseKind("Mini-book")).toBe("Mini-book");
    expect(parseKind("x")).toBeNull();
    expect(parseKind(null)).toBeNull();
  });
  it("features a gettable book, else the first", () => {
    expect(featuredBook([b({ slug: "1" }), b({ slug: "2", purchaseUrl: "https://x" })])?.slug).toBe("2");
    expect(featuredBook([b({ slug: "1" })])?.slug).toBe("1");
    expect(featuredBook([])).toBeNull();
  });
  it("shows the filter only with kinds", () => {
    expect(hasKinds([b({})])).toBe(false);
    expect(hasKinds([b({ kind: "Book" })])).toBe(true);
  });
});
