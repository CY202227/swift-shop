import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages deploys to https://<user>.github.io/swift-shop/ (sub-path).
// Set REPO_SLUG only if the repo is renamed later; default matches docs §12.
const REPO = process.env.REPO_SLUG ?? "swift-shop";

export default defineConfig({
  plugins: [react()],
  base: process.env.SITE_BASE === "/" ? "/" : `/${REPO}/`,
});
