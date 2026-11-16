import { initSentry } from "./instrument.js";
import { serve } from "@hono/node-server";
import { createDb } from "@kcom/db";
import { createApp } from "./app.js";

initSentry();

const port = Number(process.env.PORT ?? 8787);
const app = createApp(createDb(), {
  corsOrigins: (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
});

serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
