import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/RAPID-AI/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 4173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
});
