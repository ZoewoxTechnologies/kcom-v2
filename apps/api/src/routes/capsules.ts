import { Hono } from "hono";
import { z } from "zod";
import { lagosDate, slug } from "@kcom/content";
import { capsuleBySlug, latestCapsule, type CapsuleDb } from "@kcom/db";
import { HttpError } from "../errors.js";
import { validate } from "../validate.js";

const slugParam = z.object({ slug });

type Capsule = NonNullable<Awaited<ReturnType<typeof latestCapsule>>>;

/** The capsule's day is its publish_at in Africa/Lagos, not UTC. */
const present = (capsule: Capsule) => ({ ...capsule, displayDate: lagosDate(capsule.publishAt) });

export function capsuleRoutes(db: CapsuleDb) {
  return new Hono()
    .get("/latest", async (c) => {
      const capsule = await latestCapsule(db);
      if (!capsule) throw new HttpError(404, "not_found", "not found");
      c.header("Cache-Control", "public, max-age=60");
      return c.json(present(capsule));
    })
    // Sample of the route pattern: validate input, query the db, return a typed body.
    .get("/:slug", validate("param", slugParam), async (c) => {
      const capsule = await capsuleBySlug(db, c.req.valid("param").slug);
      if (!capsule) throw new HttpError(404, "not_found", "capsule not found");
      c.header("Cache-Control", "public, max-age=60");
      return c.json(present(capsule));
    });
}
