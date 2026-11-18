import { asc } from "drizzle-orm";
import { books, type CapsuleDb } from "@kcom/db";
import { publicContentRoutes } from "../content/index.js";

/** Public, read-only: only published books whose publish time has passed. */
export const publicBookRoutes = (db: CapsuleDb) =>
  publicContentRoutes({ db, table: books, label: "book", orderBy: [asc(books.title)] });
