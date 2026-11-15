import { Hono } from "hono";
import { latestCapsule, type CapsuleDb } from "@kcom/db";

export function createApp(db: CapsuleDb) {
  const app = new Hono();
  app.onError((err, c) => {
    console.error("unhandled error:", err);
    return c.json({ error: "internal error" }, 500);
  });
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/capsules/latest", async (c) => {
    const capsule = await latestCapsule(db);
    if (!capsule) {
      c.header("Cache-Control", "no-store");
      return c.json({ error: "not found" }, 404);
    }
    c.header("Cache-Control", "public, max-age=60");
    return c.json(capsule);
  });
  return app;
}
