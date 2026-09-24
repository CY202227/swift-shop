import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend runs on 8010 in dev (8000 occupied by another process on this machine)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8010",
        changeOrigin: true,
      },
    },
  },
});
