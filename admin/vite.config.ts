import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend on 8010 (8000 occupied on this machine); backend CORS already allows 5174
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8010",
        changeOrigin: true,
      },
      // Uploaded product images are served by the backend directly
      "/uploads": {
        target: "http://localhost:8010",
        changeOrigin: true,
      },
    },
  },
});
