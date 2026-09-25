import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The mobile app is published next to the desktop dashboard on GitHub Pages:
// https://aubitlabs012.github.io/RAPID-AI/mobile/
export default defineConfig({
  base: "/RAPID-AI/mobile/",
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
