import { createDb } from "./client.js";
import { seed } from "./seed-data.js";

if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to seed sample data in production. Pass --force to override.");
  process.exit(1);
}
const db = createDb();
try {
  await seed(db);
  console.log("seeded sample data");
} finally {
  await db.pool.end();
}
