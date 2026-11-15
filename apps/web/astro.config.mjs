import { defineConfig } from "astro/config";
import node from "@astrojs/node";

// Standalone Node server: Cloud Run sets PORT; HOST=0.0.0.0 is set in the container.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { port: 4321, host: true },
});
