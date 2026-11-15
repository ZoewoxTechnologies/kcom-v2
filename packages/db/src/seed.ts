import { createDb } from "./client.js";
import { seed } from "./seed-data.js";

const db = createDb();
await seed(db);
await db.pool.end();
console.log("seeded sample data");
