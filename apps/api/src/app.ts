import { Hono } from "hono";
import { latestCapsule, type CapsuleDb } from "@kcom/db";

export function createApp(db: CapsuleDb) {
  const app = new Hono();
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/capsules/latest", async (c) => {
    const capsule = await latestCapsule(db);
    return capsule ? c.json(capsule) : c.json({ error: "not found" }, 404);
  });
  return app;
}
