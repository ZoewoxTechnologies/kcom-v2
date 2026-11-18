import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fontsHref } from "@kcom/ui/fonts";

export default defineConfig({
  plugins: [
    react(),
    // Same font stylesheet as the public site, from one shared constant.
    { name: "brand-fonts", transformIndexHtml: (html) => html.replace("%FONTS_HREF%", fontsHref) },
  ],
  server: { port: 5173 },
});
