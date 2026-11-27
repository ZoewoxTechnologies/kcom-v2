import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fontsHref } from "@kcom/ui/fonts";

// Dev port: DEV_PORT from apps/admin/.env.local (set per worktree by `pnpm dev:ports`).
const devPort = Number(loadEnv("development", process.cwd(), "").DEV_PORT) || 5173;

export default defineConfig({
  plugins: [
    react(),
    // Same font stylesheet as the public site, from one shared constant.
    { name: "brand-fonts", transformIndexHtml: (html) => html.replace("%FONTS_HREF%", fontsHref) },
  ],
  server: { port: devPort, strictPort: true },
});
