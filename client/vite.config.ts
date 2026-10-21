import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// In dev, forward /ws to the local server so the page and socket share one address.
export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom" },
  server: {
    proxy: {
      "/ws": { target: "ws://localhost:3001", ws: true },
      "/rooms": { target: "http://localhost:3001" },
      "/config": { target: "http://localhost:3001" },
    },
  },
});
