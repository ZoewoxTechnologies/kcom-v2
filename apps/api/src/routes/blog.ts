import { desc } from "drizzle-orm";
import { blogPosts, type CapsuleDb } from "@kcom/db";
import { publicContentRoutes } from "../content/index.js";

/** Public, read-only: only published posts whose publish time has passed. */
export const blogRoutes = (db: CapsuleDb) =>
  publicContentRoutes({
    db,
    table: blogPosts,
    label: "post",
    orderBy: [desc(blogPosts.date), desc(blogPosts.createdAt)],
  });
