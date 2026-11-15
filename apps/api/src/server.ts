import { initSentry } from "./instrument.js";
import { serve } from "@hono/node-server";
import { createDb } from "@kcom/db";
import { createApp } from "./app.js";

initSentry();

const port = Number(process.env.PORT ?? 8787);
const app = createApp(createDb());

serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
