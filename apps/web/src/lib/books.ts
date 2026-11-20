import { bookKinds, type Book, type BookKind } from "./data/types";

export const kindFilters = [{ value: "", label: "All" }, ...bookKinds.map((k) => ({ value: k, label: k === "Book" ? "Books" : k === "Mini-book" ? "Mini-books" : "New Year messages" }))] as const;

/** Valid kind from a query value, or null for "all". */
export const parseKind = (v: string | null): BookKind | null => bookKinds.find((k) => k === v) ?? null;

/** Filter only appears when books carry a kind. */
export const hasKinds = (books: Book[]) => books.some((b) => b.kind);

/** The book to feature: the first one people can get. */
export const featuredBook = (books: Book[]): Book | null => books.find((b) => b.purchaseUrl) ?? books[0] ?? null;
