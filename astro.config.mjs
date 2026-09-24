import { defineConfig } from "astro/config";
import { adminLocal } from "./scripts/admin-local.mjs";

// SITE y BASE los rellena GitHub Actions al publicar en GitHub Pages
// (p. ej. SITE=https://usuario.github.io y BASE=/nombre-repo)
export default defineConfig({
  site: process.env.SITE || "http://localhost:4321",
  base: process.env.BASE || "/",
  trailingSlash: "ignore",
  vite: {
    plugins: [adminLocal()],
  },
});
